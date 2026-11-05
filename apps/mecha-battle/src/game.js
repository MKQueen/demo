import { PLASMA } from './combat/plasmaCycle.js';
import { driveProfile, stepDrive, turnChassis, actionStage, contactImpulse } from './combat/heavyDrive.js';
import { strikeTravel, comboBufferLifetime } from './combat/attackTiming.js';
import { readSettings, normaliseSettings, writeSettings, recordBattle } from './runtime/profile.js';
import { Evacuation } from './combat/evacuation.js';
import { combatFrame } from './world/combatCamera.js';
import { createDangerDecal } from './world/dangerDecal.js';
import { difficultyFor, canPerfectGuard, attackWeight } from './combat/balance.js';
import { breathVolume, breathContact } from './combat/breathVolume.js';
import { bodyCapsules } from './world/contact.js';
import { updatePlayerProjectiles as stepPlayerProjectiles } from './combat/playerProjectiles.js';
import { createFlow } from './world/flowVFX.js';
import { stepBattle } from './combat/battleStep.js';
import { startMelee } from './world/melee.js';
import { updateCameraOcclusion } from './world/cameraOcclusion.js';
import { MouseCamera } from './input/mouseCamera.js';
import { MECH_ROSTER, getMechConfig } from './world/mechRoster.js';
import * as THREE from 'three';
import { Environment } from './world/environment.js';
import { City } from './world/city.js';
import { Mech } from './world/mech.js';
import { Monster, MONSTER_ATTACKS } from './world/monster.js';
import { Effects } from './world/effects.js';
import { updateJetRig } from './world/jetRig.js';
import { PoseCamera } from './pose/poseCamera.js';
import { KeyboardInput } from './input/keyboard.js';

import {
  clamp, damp, lerp, rand, pick, randInt, easeOutCubic, easeInCubic, easeInOutCubic,
  glowTexture, distXZ, formatTime, worldToScreen, canvasTexture,
} from './utils.js';

const BOSS_MAX = 1100;
const PLAYER_MAX = 100;
const WALK_SPEED = 10;
const RUN_SPEED = 22;
const CITY_LIMIT = 242;
const MELEE_RANGE = 21;
const LANDING_HEIGHT = 52;

let bladeWaveTex = null;
function getBladeWaveTexture() {
  if (bladeWaveTex) return bladeWaveTex;
  bladeWaveTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const arc = (width, color) => {
      ctx.beginPath();
      ctx.arc(256, 300, 220, -2.5, -0.64);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    arc(48, 'rgba(6, 14, 18, .95)');
    arc(34, 'rgba(72, 246, 255, .96)');
    arc(20, 'rgba(186, 255, 255, 1)');
    arc(7, 'rgba(255, 255, 255, 1)');
    ctx.lineCap = 'butt';
    for (let i = 0; i < 8; i++) {
      const a = -2.36 + i * 0.26;
      const x1 = 256 + Math.cos(a) * 236;
      const y1 = 300 + Math.sin(a) * 236;
      const x2 = 256 + Math.cos(a) * (270 + i * 5);
      const y2 = 300 + Math.sin(a) * (270 + i * 5);
      ctx.strokeStyle = i % 2 ? 'rgba(210,255,255,.9)' : 'rgba(5, 16, 20, .9)';
      ctx.lineWidth = i % 2 ? 3 : 7;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  });
  bladeWaveTex.userData.shared = true;
  return bladeWaveTex;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const BOSS_MOVE_META = {
  swipe: { name: '巨爪横扫', sub: '向两侧闪避 · 或双手护胸' },
  doubleClaw: { name: '双牙裂爪', sub: '两次连击 · 侧闪后离开正面 / 防住第二击' },
  tail: { name: '尾锤回旋', sub: '全域扫击 · 侧闪或护盾' },
  slam: { name: '地裂踏击', sub: 'V 升空避震 / 离开红圈 · 护盾会被破防' },
  breath: { name: '熔核吐息', sub: '横向闪避 · 远离红色轨迹' },
  charge: { name: '熔岩突进', sub: '不要直线后退 · 向两侧闪避' },
  eruption: { name: '熔岩喷发', sub: '连续移动 · 离开所有红圈' },
};
const BOSS_SKILL_CD = {
  swipe: 1.2, doubleClaw: 4.1, tail: 2.9, slam: 2.25,
  breath: 4.0, charge: 4.8, eruption: 6.2,
};

export class Game {
  constructor({ scene, camera, renderer, ui, audio }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.state = 'boot';
    this.settings = readSettings(window.localStorage);
    this.audio.setLevels(this.settings.volume, this.settings.music);
    try { this.selectedMech = getMechConfig(localStorage.getItem('steel-mech')).id; } catch { this.selectedMech = 'vanguard'; }
    this.setupOpen = false;
    this.transitioning = false;
    this.inputMode = 'keyboard';
    this.hasCamera = false;
    this.time = 0;
    this.menuAngle = -0.7;
    this.cameraMode = 'menu';
    this.cameraTarget = new THREE.Vector3(0, 10, 0);
    this.cameraLook = new THREE.Vector3(0, 10, 0);
    this.cameraSnap = true;
    /** 鼠标环绕/缩放叠加在脚本相机的基准位姿之上 */
    this.baseCameraPos = camera.position.clone();
    this.fov = 52;
    this.city = null;
    this.mech = null;
    this.monster = null;
    this.telegraph = null;
    this.meteor = null;
    this.cityAttack = null;
    this.monsterAttack = null;
    this.pendingImpacts = [];
    this.response = { shake: 0 };
    this.hitStop = 0;
    this.raycaster = new THREE.Raycaster();
    this.tmpVec = new THREE.Vector3();
    this.tmpVec2 = new THREE.Vector3();
    this.tmpVec3 = new THREE.Vector3();
    this.poseState = null;
    this.poseQuality = 0;
    this.poseFullBody = false;
    this.poseVisible = false;
    this.lastPoseUI = 0;
    this.lastCameraToggle = false;
    this.helpOpen = false;
    this.audioReady = false;
    this.outcomeTimer = 0;
    this.outcomeDuration = 4.3;
    this.outcomeWin = false;
    this.timeScale = 1;
    this.footTimer = 0;
    this.meteorTrailTimer = 0;
    this.hintsShown = [];
    this.hintIndex = 0;
    this.hintTimer = 0;
    this.battle = null;
    this.intro = null;
    this.lastErrorToast = 0;

    this.environment = new Environment(scene, renderer);
    this.effects = new Effects(scene);
    this.effects.onFlash = (color, strength) => this.ui.flash(color, strength);


    this.ui.bind({
      onCamera: () => this.openCameraSetup(),
      onKeyboard: () => this.startAs('keyboard'),
      onCloseSetup: () => this.closeCameraSetup(),
      onActivate: () => this.startAs('camera'),
      onRetrack: () => this.pose.resetTracking(),
      onSkipIntro: () => this.skipIntro(),
      onHelp: () => this.openHelp(),
      onCloseHelp: () => this.closeHelp(),
      onPause: () => this.togglePause(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartRun(),
      onQuit: () => this.quitToMenu(),
      onSound: () => this.toggleSound(),
      onFullscreen: () => this.toggleFullscreen(),
    });

    this.ui.initSettings(this.settings, value => {
      this.settings=normaliseSettings(value);
      writeSettings(window.localStorage,this.settings);
      this.audio.setLevels(this.settings.volume,this.settings.music);
      this.onSettingsChange?.(this.settings);
    }, () => {
      if(this.settingsResume){this.settingsResume=false;this.resumeGame();}
    });
    this.ui.onSettingsOpen=()=>{
      this.settingsResume=this.state==='playing';
      if(this.settingsResume)this.pauseGame();
      this.keyboard?.reset();
    };
    this.ui.initHangar(MECH_ROSTER, this.selectedMech, id => this.selectMech(id));
    this.keyboard = new KeyboardInput();
    this.mouseCamera = new MouseCamera(renderer.domElement, { isEnabled: () => this.mouseCameraEnabled() });
    this.pose = new PoseCamera({
      video: this.ui.el.setupVideo,
      gameVideo: this.ui.el.gameVideo,
      setupCanvas: this.ui.el.setupSkeleton,
      gameCanvas: this.ui.el.gameSkeleton,
      onStatus: (text) => {
        if (this.setupOpen) this.ui.setupStatus(text);
      },
      onReady: ({ delegate }) => {
        this.cameraReady = true;
        if (this.setupOpen) this.ui.setupReady(delegate);
      },
      onError: (message) => {
        this.cameraReady = false;
        if (this.setupOpen) this.ui.setupError(message);
      },
      onQuality: (info) => {
        this.poseQuality = info.quality;
        this.poseFullBody = info.fullBody;
        this.poseVisible = info.visible;
        this.poseState = info.state;
        if (this.setupOpen) this.ui.setupQuality(info);
      },
      onPose: (state) => {
        this.poseState = state;
        this.poseVisible = state.visible;
        this.poseQuality = state.quality;
        this.poseFullBody = state.fullBody;
      },
    });
    this.cameraReady = false;

    this.ui.setSound(true);
    this.prepareMenuScene();
    this.ui.showMenu();
    this.ui.setBootProgress(0.15, '正在生成新港市街区…');

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
    window.addEventListener('beforeunload', () => this.dispose());
  }

  async ensureAudio() {
    if (this.audioReady) {
      if (this.audio.ctx?.state === 'suspended') {
        try { await this.audio.ctx.resume(); } catch (e) {}
      }
      return true;
    }
    if (this._audioInitPromise) return this._audioInitPromise;
    this._audioInitPromise = (async () => {
      try {
        const ok = await Promise.race([
          this.audio.init(),
          new Promise((resolve) => setTimeout(() => resolve(false), 1600)),
        ]);
        this.audioReady = !!ok && !!this.audio.ready;
        this.ui.setSound(!this.audio.muted);
        return this.audioReady;
      } catch (err) {
        console.warn('Audio init failed', err);
        return false;
      } finally {
        this._audioInitPromise = null;
      }
    })();
    return this._audioInitPromise;
  }

  async toggleSound() {
    const ok = await this.ensureAudio();
    if (!ok) {
      this.ui.toast('当前浏览器无法初始化音频', 'warn');
      return;
    }
    const muted = this.audio.toggleMute();
    this.ui.setSound(!muted);
    this.ui.toast(muted ? '声音已关闭' : '声音已开启');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => this.ui.toast('浏览器不允许进入全屏', 'warn'));
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  // ---------------------------------------------------------------- setup
  async openCameraSetup() {
    if (this.state !== 'menu' || this.transitioning) return;
    this.setupOpen = true;
    this.ui.openSetup();
    this.ensureAudio();
    if (this.pose.ready) {
      this.ui.setupReady(this.pose.delegate);
      this.ui.setupQuality({
        quality: this.poseQuality,
        fullBody: this.poseFullBody,
        visible: this.poseVisible,
        state: this.poseState,
        delegate: this.pose.delegate,
      });
      return;
    }
    this.pose.init();
  }

  closeCameraSetup() {
    this.setupOpen = false;
    this.ui.closeSetup();
  }

  async startAs(mode) {
    if (this.state !== 'menu' || this.transitioning) return;
    this.transitioning = true;
    try {
      await this.ensureAudio();
      if (mode === 'camera') {
        if (!this.pose.ready || !this.pose.getState().controlReady) {
          if (this.setupOpen) this.ui.setupError('体感链路尚未就绪，请等待摄像头初始化完成，或改用键盘模式。');
          this.ui.toast('请先锁定玩家并完成站定校准', 'warn');
          return;
        }
        this.ui.closeSetup();
        this.setupOpen = false;
        this.inputMode = 'pose';
        this.hasCamera = true;
      } else {
        this.ui.closeSetup();
        this.setupOpen = false;
        this.inputMode = 'keyboard';
        this.hasCamera = false;
      }
      this.beginRun();
    } finally {
      this.transitioning = false;
    }
  }

  // ---------------------------------------------------------------- world
  clearRun() {
    this.audio.setThrust(0);
    this.clearTelegraph();
    this.clearMeteor();
    this.clearPlayerProjectiles();
    for (const h of this.hazards || []) this.removeHazard(h);
    this.hazards = []; this.jetState = null;
    this.monsterAttack = null;
    this.cityAttack = null;
    this.pendingImpacts = [];
    this.meleeStrike = null;
    this.effects.clear();
    if (this.mech) { this.mech.dispose(); this.mech = null; }
    if (this.monster) { this.monster.dispose(); this.monster = null; }
    if (this.city) { this.city.dispose(); this.city = null; }
    this.battle = null;
    this.intro = null;
    this.state = 'boot';
    this.settings = readSettings(window.localStorage);
    this.audio.setLevels(this.settings.volume, this.settings.music);
  }

  decorateCity(city) {
    if (!city) return;
    // Keep buildings quiet and let combat lights carry the warm/cool accents.
    if (city.plazaRing) city.plazaRing.material.opacity = 0.09;
    for (const strip of city.neonStrips || []) strip.material.opacity = 0.22;
  }

  decorateCharacter(character, type) {
    if (!character) return;
    character.root.userData.design = 'pacific-rigged-combat';
  }

  prepareMenuScene() {
    this.clearRun();
    this.city = new City(this.scene, {
      seed: 9317,
      onBuildingDestroyed: (b) => this.onBuildingDestroyed(b),
    });
    this.decorateCity(this.city);
    this.spawnHangarMech();
    this.effects.clear();
    this.environment.setBattleMood(0);
    this.ui.setLowHealth(false);
    this.ui.setCombo(0);
    this.ui.hideWarning();
    this.ui.hideHint();
    this.ui.setUltimateCinematic(false);
    this.menuAngle = 1.02 + Math.random() * 0.2;
    this.cameraMode = 'menu';
    this.cameraSnap = true;
    this.mouseCamera?.reset();
    this.state = 'menu';
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
  }

  selectMech(id) {
    if (this.state !== 'menu') return;
    this.selectedMech = getMechConfig(id).id;
    try { localStorage.setItem('steel-mech', this.selectedMech); } catch {}
    this.spawnHangarMech();
  }

  spawnHangarMech() {
    this.mech?.dispose();
    this.mech = new Mech(this.scene, { id: this.selectedMech });
    this.mech.root.position.set(0, 0, 40);
    this.mech.root.rotation.y = .35;
  }

  createBattleScene() {
    this.clearRun();
    this.city = new City(this.scene, {
      seed: Math.floor(Math.random() * 100000),
      onBuildingDestroyed: (b) => this.onBuildingDestroyed(b),
    });
    this.effects.clear();
    this.decorateCity(this.city);
    this.mech = new Mech(this.scene, { id: this.selectedMech });
    this.decorateCharacter(this.mech, 'mech');
    this.mech.combatReady = true;
    this.mech.root.position.set(0, 0, 40);
    this.mech.root.visible = false;
    this.mech.footstepCallback = (side, pos) => {
      if (this.state === 'playing') {
        this.audio.metalStep(false);
        this.mech.groundCompression=1;
        const foot=this.mech.imported?.bones[side>0?'footr':'footl'];
        const contact=foot?foot.getWorldPosition(_v1):_v1.copy(pos);contact.y=.15;
        this.effects.smokePuff(contact,2,.35,'#96968b');
      }
    };
    this.monster = new Monster(this.scene);
    this.decorateCharacter(this.monster, 'monster');
    this.monster.root.position.set(0, -30, -2);
    this.monster.root.rotation.y = Math.PI;
    this.monster.root.visible = false;
    this.monster.footstepCallback = (pos) => {
      if (this.state === 'playing' || this.state === 'intro') {
        this.audio.metalStep(true);
        this.monster.groundCompression=1;
        const bones=this.monster.imported?.bones;
        const left=bones?.footl.getWorldPosition(new THREE.Vector3()),right=bones?.footr.getWorldPosition(new THREE.Vector3());
        const contact=left&&right?(left.y<right.y?left:right):pos.clone();contact.y=.15;
        const distance=this.mech.root.position.distanceTo(pos);
        this.effects.screenShake(.16*clamp(1-distance/120,0,1),.2);
        this.effects.dustRise(contact,3,1.5,'#96968b');
      }
    };
    this.playerVel = new THREE.Vector3();
    this.mech.driveAcceleration = new THREE.Vector3();
    this.monster.driveVelocity = new THREE.Vector3();
    this.cameraTarget.set(0, 10, 20);
    this.cameraSnap = true;
  }

  async beginRun() {
    this.motionLossTime=0;this.motionPaused=false;
    this.ui.hideMenu();
    this.ui.hideResult();
    this.ui.showPause(false);
    this.ui.closeHelp?.();
    this.ui.hideHud();
    this.ui.clearTransient();
    this.ui.clearFeed();
    this.ui.showCinematic();
    this.ui.setCaption('HONG KONG · NEW HARBOR / 12:30', '灾难发生之前', '');
    this.ui.setLowHealth(false);
    this.ui.showPause(false);
    this.ui.el.help.classList.add('hidden');
    this.audio.stopMusic(0.2);
    this.audio.setPaused(false);
    this.environment.setBattleMood(0);
    this.createBattleScene();
    this.initBattleState();
    this.state = 'intro';
    this.introTime = 0;
    this.introFlags = {
      siren: false, rift: false, roar: false, mech: false, landed: false,
      music: false, caption1: false, caption2: false, caption3: false,
    };
    this.cameraMode = 'intro';
    this.cameraSnap = true;
    this.mouseCamera?.reset();
    this.keyboard.reset();
    this.pose.clearEvents();
    this.mech.root.visible = false;
    this.monster.root.visible = false;
    this.playerVel.set(0, 0, 0);
    this.hitStop = 0;
    this.timeScale = 1;
    this.ui.setBootProgress(1, '');
  }

  resetBossAi() {
    this.bossCooldowns = { swipe: 0, doubleClaw: 0, tail: 0, slam: 0, breath: 0, charge: 0, eruption: 0 };
    this.bossLastAttack = '';
    this.bossRecent = [];
    this.bossStrafeDir = Math.random() < 0.5 ? -1 : 1;
    this.bossStrafeAt = 1.8;
    this.bossStagger = 0;
    this.bossStaggerIdle = 0;
    this.bossStaggerLock = 0;
    this.bossTransition = 0;
    this.playerBlockHold = 0;
    this.guardBrokenUntil = 0;
  }

  initBattleState() {
    this.resetBossAi();
    this.encounterDifficulty = this.settings?.difficulty || 'veteran';
    this.difficulty = difficultyFor(this.encounterDifficulty);
    this.guardStartedAt = -Infinity;
    this.perfectGuardConsumed = false;
    this.perfectGuards = 0;
    this.hp = PLAYER_MAX;
    this.energy = 60;
    this.bossMax = Math.round(BOSS_MAX * this.difficulty.bossHealth);
    this.monster.health = this.bossMax;
    this.monster.maxHealth = this.bossMax;
    this.phase = 1;
    this.battleTime = 0;
    this.evacuation = new Evacuation(this.city?.buildings || []);
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.damageDealt = 0;
    this.hitsTaken = 0;
    this.blastCooldown = 0;
    this.blastCooldownMax = 2.2;
    this.missileCooldown = 0;
    this.missileCooldownMax = 6.2;
    this.bladeCooldown = 0;
    this.bladeCooldownMax = 5.4;
    this.playerProjectiles = [];
    this.dodgeCooldown = 0;
    this.dodgeCooldownMax = .95;
    this.jetState = null;
    this.jetFuel = 100;
    this.fuelRegenDelay = 0;
    this.jetCooldown = 0;
    for (const h of this.hazards || []) this.removeHazard(h);
    this.hazards = [];
    this.punchBuffer = null;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.attackLunge = null;
    this.meleeStrike = null;
    this.bossRecoveryUntil = 0;
    this.counterUntil = 0;
    this.lastMeleeContact = null;
    this.invuln = 0;
    this.dodgeTimer = 0;
    this.dodgeDir = new THREE.Vector3();
    this.blocking = false;
    this.ultimateActive = false;
    this.ultimateTimer = 0;
    this.ultimateStruck = false;
    this.playerBusy = null;
    this.nextMonsterAttackAt = 1.8;
    this.nextCityAttackAt = 12.5;
    this.graceUntil = 1.8;
    this.monsterAttack = null;
    this.cityAttack = null;
    this.pendingImpacts = [];
    this.hitStop = 0;
    this.timeScale = 1;
    this.outcomeTimer = 0;
    this.outcomeWin = false;
    this.defeatReason = null;
    this.lastTooFarToast = -10;
    this.enrageTriggered = false;
    this.lastShieldSound = 0;
    this.punchSoundAt = 0;
    this.hintIndex = 0;
    this.hintTimer = 0;
    this.nextHintAt = 7.5;
    this.tutorialDone = false;
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
    this.battle = { started: false };
  }

  onBuildingDestroyed(b) {
    this.city.options.onCollapseImpact=(building,part)=>{
      // Both halves of one floor can land together. Emit one floor impulse.
      building.landedEffectFloors ||= new Set();
      if(building.landedEffectFloors.has(part.index))return;
      building.landedEffectFloors.add(part.index);
      const p=part.mesh.position.clone().add(building.collapseGroup.position);p.y=.5;
      this.effects.dustRise(p,3,Math.min(9,building.w*.65),'#958b7e');
      this.effects.debrisBurst(p,4,.7);
      if(part.index%3===0){this.audio.impact(.8,true);this.effects.screenShake(.16,.16);}
    };
    const pos = new THREE.Vector3(b.x, Math.min(b.h * 0.45, 7), b.z);
    const scale = clamp(b.h / 32, 1, 2.8);
    this.effects.explosion(pos, scale);
    this.effects.dustRise(new THREE.Vector3(b.x, 0, b.z), Math.round(4 * scale), 6 + scale * 2, '#7f7268');
    this.effects.screenShake(0.5 + scale * 0.15, 0.55);
    this.audio.explosion(clamp(scale * 0.85, 1, 2));
    if (this.state === 'playing' || this.state === 'victory') {
      this.ui.addFeed(`建筑坍塌 · 中环 ${String(Math.floor((b.x + b.z + 300) % 99)).padStart(2, '0')} 区`);
      this.effects.scorch(new THREE.Vector3(b.x, 0, b.z), 12 * scale);
      if (this.getCityIntegrity() <= 0 && this.state === 'playing') {
        this.defeat('city');
      }
    }
  }

  getCityIntegrity() {
    if (!this.city) return 100;
    return clamp(100 * (1 - this.city.destroyedCount / Math.max(1, this.city.buildingCount)), 0, 100);
  }

  // ---------------------------------------------------------------- intro
  updateIntro(dt) {
    this.introTime += dt;
    const t = this.introTime;
    this.city.update(dt, this.time);

    if (!this.introFlags.siren && t > 1.7) {
      this.introFlags.siren = true;
      this.audio.siren(2.6);
      this.ui.setCaption('SEISMIC ALERT / 震源不明', '城市在震动。', 'warning');
      this.effects.screenShake(0.1, 2.0);
    }

    if (!this.introFlags.rift && t > 2.65) {
      this.introFlags.rift = true;
      this.doRiftSequence();
    }

    if (this.monster && this.monster.root.visible) {
      const rise = clamp((t - 2.65) / 2.25);
      this.monster.root.position.y = -30 * (1 - easeOutCubic(rise));
      if (rise >= 1) this.monster.root.position.y = 0;
      if (rise >= 1 && !this.introFlags.roar && t > 4.9) {
        this.introFlags.roar = true;
        this.monster.playAction('roar');
        this.audio.roar(1.15);
        this.ui.setCaption('THREAT LEVEL OMEGA / 灾厄确认', '巨兽降临', 'red');
        this.ui.flash('#ff7b46', 0.32);
        this.effects.screenShake(1.2, 0.9);
        this.effects.dustRise(this.monster.root.position, 7, 12, '#71675f');
        this.environment.setBattleMood(1);
      }
      this.monster.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      this.monster.update(dt, this.time, {
        target: this.mech.root.position,
        speed: 0,
      });
    }

    if (!this.introFlags.mech && t > 5.75) {
      this.introFlags.mech = true;
      this.mech.root.visible = true;
      this.mech.root.position.set(0, 0, 40);
      this.mech.root.position.y = LANDING_HEIGHT;
      this.mech.faceToward(0, 0);
      this.mech.setIdle();
      this.ui.setCaption('RX-09 / 黎明号', '紧急空投', '');
      this.audio.whoosh();
      this.ui.setCinematicVisible(true);
    }
    if (this.introFlags.mech && !this.introFlags.landed) {
      const p = clamp((t - 5.75) / 1.35);
      const fall = Math.pow(p, 2.2);
      this.mech.root.position.y = lerp(LANDING_HEIGHT, 0, fall);
      this.mech.update(dt, this.time, { speed: 0, running: false });
      if (Math.random() < 0.45) {
        this.effects.glowBurst(this.mech.getBackWorld(_v1), '#63eaff', 2.6 + Math.random() * 2, 0.28, new THREE.Vector3(rand(-1, 1), rand(2, 6), rand(-1, 1)), 0.55);
      }
      if (p >= 1) {
        this.introFlags.landed = true;
        this.mech.root.position.y = 0;
        this.mech.landing();
        this.audio.mechLand();
        this.effects.explosion(new THREE.Vector3(0, 1, 40), 1.9, { color: '#87e9ff', smokeColor: '#8b8278' });
        this.effects.shockwave(new THREE.Vector3(0, 0.2, 40), '#8af6ff', 2, 35, 1.2);
        this.effects.screenShake(1.4, 0.8);
        this.ui.flash('#ccfaff', 0.2);
        this.ui.setCaption('RX-09 / 黎明号', '机身同步完成 · 驾驶协议启动', '');
      }
    }
    if (this.introFlags.landed) {
      this.mech.update(dt, this.time, { speed: 0, running: false });
    }

    if (!this.introFlags.music && t > 2.65) {
      this.introFlags.music = true;
      this.audio.startMusic(0.4);
    }

    this.effects.update(dt, this.time);
    this.environment.update(dt, this.time);
    this.updateIntroCamera(t);

    if (t >= 8.9) this.startBattle();
  }

  doRiftSequence() {
    const destroyed = this.city.openRift();
    this.city.setPanic(new THREE.Vector3(0, 0, 0));
    this.environment.setBattleMood(1);
    this.monster.root.visible = true;
    this.monster.root.position.y = -30;
    this.audio.roar(0.6);
    this.effects.screenShake(1.8, 1.7);
    this.ui.flash('#ff9a62', 0.3);
    this.effects.explosion(new THREE.Vector3(0, 2, -2), 2.1, { color: '#ff7b3a' });
    this.effects.dustRise(new THREE.Vector3(0, 0, -2), 10, 16, '#776b60');
    this.ui.setCaption('UNDERGROUND ANOMALY / 地底异常', '有什么东西，醒了。', 'warning');
  }

  updateIntroCamera(t) {
    const cam = this.camera;
    this.effects.screenShake(Math.sin(t * 30) * 0 + 0, 0);
    if (t < 2.65) {
      const a = this.menuAngle + t * 0.028;
      const r = 105 - t * 6;
      cam.position.set(Math.cos(a) * r, 56 - t * 3.5, Math.sin(a) * r);
      this.cameraTarget.set(0, 12, -4);
      cam.lookAt(this.cameraTarget);
    } else if (t < 5.75) {
      const k = t - 2.65;
      cam.position.set(Math.sin(k * 0.55) * 4.5, 10.2 + k * 0.45, 47 - k * 0.8);
      this.cameraTarget.set(0, 13 + k * 0.5, -2);
      cam.lookAt(this.cameraTarget);
    } else if (t < 7.35) {
      const k = clamp((t - 5.75) / 1.6);
      cam.position.set(33, 25 - k * 2, 64 - k * 3);
      this.cameraTarget.set(0, clamp(this.mech.root.position.y * 0.62 + 6, 8, 42), 40);
      cam.lookAt(this.cameraTarget);
    } else {
      const ease = easeInOutCubic(clamp((t - 7.35) / 1.55));
      cam.position.set(lerp(32, 8, ease), lerp(24, 11, ease), lerp(64, 52, ease));
      this.cameraTarget.set(lerp(0, 0, ease), lerp(18, 8, ease), lerp(40, 12, ease));
      cam.lookAt(this.cameraTarget);
    }
    this.applyCameraShake();
    this.setFov(t > 5.75 && t < 7.35 ? 56 : 52);
  }

  skipIntro() {
    if (this.state !== 'intro') return;
    if (!this.introFlags.rift) {
      this.introFlags.rift = true;
      this.doRiftSequence();
      this.monster.root.visible = true;
      this.monster.root.position.y = 0;
    }
    if (!this.introFlags.mech) {
      this.introFlags.mech = true;
      this.mech.root.visible = true;
    }
    this.mech.root.position.y = 0;
    this.introFlags.landed = true;
    this.ui.hideCinematic();
    this.ui.hideWarning();
    this.startBattle(true);
  }

  startBattle(fromSkip = false) {
    this.state = 'playing';
    this.city.setPanic(new THREE.Vector3(0, 0, 0));
    this.environment.setBattleMood(1);
    this.ui.hideCinematic();
    this.ui.hideWarning();
    this.ui.showHud(this.hasCamera);
    if (this.hasCamera) this.pose.resumeVideoFeed();
    this.ui.clearTransient();
    this.ui.setCombo(0);
    this.ui.showPause(false);
    this.monster.stopAction();
    this.mech.faceToward(this.monster.root.position.x,this.monster.root.position.z);
    this.monster.root.rotation.y = Math.atan2(this.mech.root.position.x - this.monster.root.position.x, this.mech.root.position.z - this.monster.root.position.z);
    this.ui.el.help.classList.add('hidden');
    this.ui.setCaption('', '', '');
    this.mech.setIdle();
    this.mech.root.position.y = 0;
    this.monster.root.position.y = 0;
    this.monster.root.visible = true;
    this.monster.setEnraged(false);
    this.cameraMode = 'gameplay';
    this.cameraSnap = fromSkip;
    this.audio.startMusic(1);
    this.audio.setIntensity(1);
    this.audio.setPaused(false);
    this.audioReady = this.audio.ready;
    this.monsterAttack = null;
    this.cityAttack = null;
    this.phase = 1;
    this.ultimateActive = false;
    this.playerBusy = null;
    this.nextMonsterAttackAt = this.battleTime + 3.4;
    this.nextCityAttackAt = this.battleTime + 16.5;
    this.nextHintAt = this.battleTime + 7.5;
    this.resetBossAi();
    this.keyboard.reset();
    this.pose.clearEvents();
    if (this.inputMode === 'pose') {
      if (this.poseVisible) {
        this.ui.toast('半身体感接入 · 站定倾身走位，手臂动作同步', '', 3200);
      } else {
        this.ui.toast('未捕捉到上半身 · 站近一点，让头、肩和双手入镜', 'warn', 4200);
      }
    } else {
      this.ui.toast('键盘驾驶 · WASD 移动 / J K 出拳 · 鼠标拖拽转视角', '', 3200);
    }
    this.setHint(0, true);
  }

  setHint(index, force = false) {
    if (!force && this.hintIndex > index) return;
    this.hintIndex = index;
    const pose = this.inputMode === 'pose';
    const hints = [
      { key: pose ? 'LEAN' : 'A / D', title: pose ? '身体倾斜' : '左右移动', sub: pose ? '横向走位 · 快速侧倾闪避' : '贴近巨兽 · 也可用 A/D 绕行' },
      { key: pose ? '拳' : 'J / K', title: pose ? '交替出拳' : '左右出拳', sub: pose ? '左右手交替向镜头出拳 · 连击增伤' : 'J 左拳 / K 右拳 · 连击增伤' },
      { key: pose ? '炮' : 'L', title: pose ? '双掌前推' : '等离子炮', sub: '消耗 30 能量 · 发射可见等离子弹' },
      { key: pose ? '弹' : 'R', title: pose ? '双臂横向张开' : '导弹齐射', sub: '消耗 20 能量 · 四枚追踪导弹' },
      { key: pose ? '刃' : 'F', title: pose ? '单臂高举' : '光刃斩', sub: '消耗 20 能量 · 发射巨大光刃波' },
      { key: pose ? '盾' : 'SPACE', title: pose ? '双手护胸' : '装甲防御', sub: '抬盾瞬间精准格挡 · 出拳承诺阶段不能抬盾' },
      { key: pose ? '终' : 'U', title: pose ? '双手高举' : '天基裁决', sub: '能量满格 · 召唤轨道炮击' },
    ];
    const h = hints[index % hints.length];
    this.ui.setHint(h.key, h.title, h.sub, true);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const realDt = Math.min(dt, 0.05);
    this.time += realDt;
    this.handleGlobalInput();
    switch (this.state) {
      case 'menu':
        this.updateMenu(realDt);
        break;
      case 'intro':
        this.updateIntro(realDt);
        break;
      case 'playing':
        this.updatePlaying(realDt);
        break;
      case 'paused':
        this.environment.update(realDt, this.time);
        this.effects.update(realDt, this.time);
        break;
      case 'victory':
      case 'defeat':
        this.updateOutcome(realDt);
        break;
      case 'result':
        this.updateResult(realDt);
        break;
      default:
        break;
    }
    if (this.state !== 'paused' && this.state !== 'menu') {
      this.updatePoseUI(realDt);
    }

  }

  updateMenu(dt) {
    this.mech?.update(dt, this.time, {});
    if (this.city) this.city.update(dt, this.time);
    this.effects.update(dt, this.time);
    this.environment.update(dt, this.time);
    this.updateMenuCamera(dt);
    this.updatePoseUI(dt);
  }

  updateMenuCamera(dt) {
    this.menuAngle += dt * .05;
    this.camera.position.set(32 + Math.sin(this.menuAngle) * 2, 19, 80);
    this.cameraTarget.set(-5, 10, 40);
    // 主菜单也开放鼠标环绕/缩放，方便先观察机体
    this.mouseCamera?.apply(this.camera, this.cameraTarget, dt, false);
    this.camera.lookAt(this.cameraTarget);
    this.setFov(43);
  }

  updatePlaying(dt) { stepBattle(this, dt); }

  present(dt) {
    if (this.state === 'playing') {
      this.updateCamera(dt);
      this.updateBossOverhead();
      this.updateHUD();
      this.updateLockOn();
    }
    this.ui.updateDamage(this.camera, dt);
  }

  updateMechVisuals(dt) {
    if (!this.mech) return;
    if (this.inputMode === 'pose' && this.poseVisible && this.poseState?.arms) {
      this.mech.setPoseSync({
        arms: this.poseState.arms,
        tilt: this.poseState.shoulderTilt ?? 0,
        headX: this.poseState.headX ?? 0,
      });
    } else {
      this.mech.setPoseSync(null);
    }
    this.mech.guard(this.blocking && this.hp > 0 && !this.ultimateActive);
    const speed = this.lastMoveSpeed || 0;
    this.mech.update(dt, this.time, {
      speed,
      running: speed > WALK_SPEED * 1.15,
    });
    updateJetRig(this.mech, dt, this.time, this.effects, this.jetState, this.dodgeTimer > 0 ? this.dodgeDir : null);
    this.audio.setThrust(this.jetState ? 1 : this.dodgeTimer > 0 ? .8 : speed > 20 ? .25 : 0);
    if (this.monster && !this.playerAttackCommitted()) this.mech.faceToward(this.monster.root.position.x, this.monster.root.position.z);
  }

  updateCombo(dt) {
    if (this.combo > 0) {
      // 连击窗口在受伤/超时重置；这里只负责 UI 数字刷新
    }
  }

  updateHints(dt) {
    if (this.state !== 'playing') return;
    this.hintTimer += dt;
    if (this.hintIndex < 7 && this.battleTime >= this.nextHintAt) {
      this.nextHintAt = this.battleTime + 8.2;
      if (this.hintIndex < 6) {
        this.hintIndex++;
        this.setHint(this.hintIndex, true);
        this.hintTimer = 0;
      } else {
        this.hintIndex++;
        this.ui.hideHint();
      }
    } else if (this.hintTimer > 6.4 && this.hintIndex < 7 && this.hintIndex >= 0) {
      this.ui.hideHint();
    }
    if (this.hintIndex >= 7) this.ui.hideHint();
  }

  updateMission(dt) {
    if(this.state !== 'playing' || !this.evacuation)return;
    const events=this.evacuation.step(dt,this.monster.root.position,this.cityAttack?.building);
    for(const event of events){
      const saved=event.type==='saved';
      if(saved){this.energy=clamp(this.energy+18,0,100);this.hp=Math.min(PLAYER_MAX,this.hp+8);}
      this.ui.addFeed(`${event.shelter.name} ${saved?'撤离完成 · 100 人获救 / 装甲 +8 / 能量 +18':'避难所被毁 · 100 人失联'}`);
      this.ui.toast(saved?'撤离完成 · 补给已接入':'避难所损失 · 保护下一个撤离点',saved?'':'warn',2400);
    }
  }

  updateHUD() {
    if (!this.monster) return;
    this.ui.updateMission(this.evacuation, this.camera, this.monster, this.cityAttack);
    const bossPhase = this.phase === 2 ? 'PHASE 2 · 暴走' : 'PHASE 1';
    this.ui.updateHud(1, {
      mechName: this.mech.config.name,
      action: this.mech.action?.type, actionProgress: this.mech.actionT / (this.mech.actionDuration || 1),
      jetFuel: this.jetFuel, jetActive: !!this.jetState, jetCooldown: this.jetCooldown,
      hp: this.hp,
      energy: this.energy,
      bossHp: this.monster.health,
      bossMax: this.bossMax,
      bossStagger: this.bossStagger,
      bossIntent: this.monster.action?.type==='stagger' ? '失衡 · 全力追击' : this.battleTime < this.bossRecoveryUntil ? '收招破绽 · 近战伤害 +30%' : this.monsterAttack ? this.monsterAttack.resolved ? '出招中 · 保持走位' : this.monsterAttack.locked ? '方向已锁定 · 离开攻击轨迹' : '蓄力 · 即将锁定方向' : '侧后方攻击 · 额外失衡',
      bossOpening: this.battleTime < this.bossRecoveryUntil || this.monster.action?.type==='stagger',
      phase: bossPhase,
      city: this.getCityIntegrity(),
      losses: this.city.destroyedCount,
      time: this.battleTime,
      blastCooldown: this.blastCooldown / this.blastCooldownMax,
      missileCooldown: this.missileCooldown / this.missileCooldownMax,
      bladeCooldown: this.bladeCooldown / this.bladeCooldownMax,
      blocking: this.blocking,
      punching: this.mech.action?.type === 'punch',
      missileActive: this.mech.action?.type === 'missile',
      bladeActive: this.mech.action?.type === 'blade',
      ultimateActive: this.ultimateActive,
      running: (this.lastMoveSpeed || 0) > WALK_SPEED * 1.15,
      move: (this.lastMoveSpeed || 0) > 1,
      moveLevel: Math.ceil(clamp((this.lastMoveSpeed || 0) / RUN_SPEED) * 5),
    });
    if (!this.lastPoseUI || this.time - this.lastPoseUI > 0.1) {
      this.lastPoseUI = this.time;
      if (this.hasCamera) this.ui.updateCamera(this.poseState, this.poseQuality, this.poseFullBody, this.poseVisible);
    }
  }

  updateBossOverhead() {
    if (!this.monster || this.state !== 'playing' || this.ultimateActive) {
      this.ui.hideOverhead();
      return;
    }
    const head = this.monster.getHeadWorld(new THREE.Vector3());
    head.y += 6.5;
    const distance = this.camera.position.distanceTo(head);
    if (distance > 120) {
      this.ui.hideOverhead();
      return;
    }
    const screen = worldToScreen(head, this.camera, window.innerWidth, window.innerHeight);
    if (!screen.visible) {
      this.ui.hideOverhead();
      return;
    }
    this.ui.updateOverhead({
      screen,
      hp: this.monster.health,
      max: this.bossMax,
      phase: this.phase,
      stagger: this.bossStagger,
    });
  }

  updateLockOn() {
    if (!this.monster || this.monster.root.visible === false || this.monster.health <= 0) {
      this.ui.el.lockOn.classList.add('hidden');
      return;
    }
    const p = this.monster.getChestWorld(_v1);
    const distance = this.mech ? distXZ(this.mech.root.position, this.monster.root.position) : 0;
    this.ui.setLockOn(p, this.camera, distance, !this.ultimateActive);
  }

  // ---------------------------------------------------------------- input
  /** 鼠标视角只在主菜单 / 战斗（非必杀演出）里生效；暂停、过场、设置面板不抢指针 */
  mouseCameraEnabled() {
    if (this.transitioning || this.setupOpen) return false;
    if (this.state === 'menu') return true;
    if (this.state === 'playing') return !this.ultimateActive;
    return false;
  }

  handleGlobalInput() {
    const kbEvents = this.keyboard.takeEvents();
    for (const ev of kbEvents) {
      if (ev.type === 'pause') {
        if (this.state === 'intro') { this.skipIntro(); continue; }
        if (this.state === 'playing') { this.pauseGame(); continue; }
        if (this.state === 'paused') {
          if (!this.ui.el.help.classList.contains('hidden')) this.ui.closeHelp();
          else this.resumeGame();
          continue;
        }
      }
      if (ev.type === 'help') {
        if (this.state === 'playing') { this.pauseGame(); this.ui.openHelp('pause'); this.helpOpen = true; }
        else if (this.state === 'paused') { this.ui.openHelp('pause'); this.helpOpen = true; }
        continue;
      }
      if (ev.type === 'resetCamera') {
        this.mouseCamera?.reset();
        this.cameraSnap = true;
        this.ui.toast('视角已复位', '', 1400);
        continue;
      }
      if (ev.type === 'toggleCamera') {
        if (this.hasCamera && (this.state === 'playing' || this.state === 'paused')) {
          this.ui.el.cameraPanel.classList.toggle('hidden');
          this.ui.toast(this.ui.el.cameraPanel.classList.contains('hidden') ? '摄像头小窗已隐藏' : '摄像头小窗已显示');
        }
        continue;
      }
      if (this.state === 'playing') this.handlePlayerAction(ev);
    }
    if (this.inputMode === 'pose' && this.state === 'playing') {
      const evs = this.pose.takeEvents();
      for (const ev of evs) {
        if (ev.type === 'punch') this.handlePlayerAction(ev);
        else if (ev.type === 'blast') this.handlePlayerAction(ev);
        else if (ev.type === 'missile') this.handlePlayerAction(ev);
        else if (ev.type === 'blade') this.handlePlayerAction(ev);
        else if (ev.type === 'ultimate') this.handlePlayerAction(ev);
        else if (ev.type === 'dodge') this.handlePlayerAction(ev);
      }
    } else {
      // 丢弃过期的体感事件，避免切回时爆发
      this.pose.takeEvents();
    }
  }

  handlePlayerAction(ev) {
    if (!this.mech || !this.monster || this.hp <= 0) return;
    if (this.ultimateActive) return;
    if (ev.type === 'jet') {
      this.performJet();
    } else if (ev.type === 'missile') {
      this.performMissile();
    } else if (ev.type === 'blade') {
      this.performBlade(ev.side === 'left' ? 'left' : 'right');
    } else if (ev.type === 'punch') {
      if (this.time - this.punchSoundAt < 0.08) return;
      this.punchSoundAt = this.time;
      this.performPunch(ev.side === 'right' ? 'right' : 'left');
    } else if (ev.type === 'blast') {
      this.performBlast();
    } else if (ev.type === 'ultimate') {
      this.performUltimate();
    } else if (ev.type === 'dodge') {
      this.performDodge(ev.side === 'left' ? -1 : 1);
    }
  }

  performPunch(side) {
    if (this.playerBusy || !this.mech?.alive || this.dodgeTimer > 0) return;
    if (this.mech.action?.type === 'hit' || (this.mech.action?.type !== 'punch' && this.playerAttackCommitted())) return;
    if (this.mech.action?.type === 'punch') {
      // Keep one deliberate input through recovery, including the slower finisher.
      const ttl = comboBufferLifetime(this.mech.actionT, this.mech.actionDuration);
      if (ttl > 0) this.punchBuffer = { side, ttl };
      return;
    }
    this.blocking = false; this.mech.guard(false);
    if (this.comboWindow <= 0) this.comboStep = 0;
    this.comboStep = this.comboStep % 3 + 1;
    const heavy = this.comboStep === 3;
    const strikeSide = heavy ? side : this.comboStep === 1 ? 'left' : 'right';
    this.comboWindow = 1.8;
    this.mech.punch(strikeSide, heavy);
    const duration = this.mech.actionDuration;
    this.attackLunge = { elapsed: 0, duration, distance: heavy ? 2.4 : 1.6 };
    this.audio.whoosh();
    startMelee(this, 'punch', this.mech.action, { side: strikeSide, heavy, step: this.comboStep });
    if (this.hintIndex === 0) { this.hintIndex = 1; this.setHint(1, true); }
  }

  updateCombatInput(dt) {
    if (['blast', 'missile', 'blade'].includes(this.playerBusy) && !this.mech.action) this.playerBusy = null;
    this.comboWindow = Math.max(0, (this.comboWindow || 0) - dt);
    if (this.punchBuffer) {
      this.punchBuffer.ttl -= dt;
      if (this.punchBuffer.ttl <= 0) this.punchBuffer = null;
      else if (!this.mech.action && !this.playerBusy) {
        const side = this.punchBuffer.side; this.punchBuffer = null; this.performPunch(side);
      }
    }
    if (this.attackLunge) {
      const lunge = this.attackLunge;
      if (!['punch','blade'].includes(this.mech.action?.type)) { this.attackLunge = null; return; }
      const prior = strikeTravel(this.mech.action, lunge.elapsed / lunge.duration);
      lunge.elapsed += dt;
      const next = strikeTravel(this.mech.action, lunge.elapsed / lunge.duration);
      const distance = this.getMonsterDistance();
      if (distance > 14.2 && distance < 29) {
        if(!lunge.direction || !this.playerAttackCommitted())lunge.direction=new THREE.Vector3(Math.sin(this.mech.root.rotation.y),0,Math.cos(this.mech.root.rotation.y));
        const direction=lunge.direction;
        this.mech.root.position.addScaledVector(direction, Math.min(distance - 14.2, lunge.distance * (next - prior)));
      }
      if (next >= 1) this.attackLunge = null;
    }
  }

  performBlast() {
    if(this.playerAttackCommitted() || this.mech.action?.type==='hit')return;
    if (this.playerBusy) return;
    if (this.blastCooldown > 0) return;
    if (this.energy < 30) {
      this.ui.toast('能量不足 · 用拳击积攒能量', 'warn', 1800);
      this.audio.uiDeny();
      return;
    }
    if (this.blocking) {
      this.blocking = false;
      this.mech.guard(false);
    }
    this.energy -= 30;
    this.blastCooldown = this.blastCooldownMax;
    this.playerBusy = 'blast';
    this.mech.blast();
    this.audio.laserCharge(PLASMA.release);
    const target = this.monster.getChestWorld(new THREE.Vector3());
    this.pendingImpacts.push({ type: 'projectile', kind: 'plasma', delay: PLASMA.release, action: this.mech.action, opts: { target, duration: .34, damage: 44 } });


  }

  performMissile() {
    if(this.playerAttackCommitted() || this.mech.action?.type==='hit')return;
    if (this.playerBusy) return;
    if (this.missileCooldown > 0) return;
    if (this.energy < 20) {
      this.ui.toast('导弹齐射需要 20 能量', 'warn', 1800);
      this.audio.uiDeny();
      return;
    }
    if (this.blocking) {
      this.blocking = false;
      this.mech.guard(false);
    }
    this.energy -= 20;
    this.missileCooldown = this.missileCooldownMax;
    this.playerBusy = 'missile';
    this.mech.missileVolley();
    this.audio.laserCharge(0.35);
    const target = this.monster.getChestWorld(new THREE.Vector3());
    const forward = new THREE.Vector3(
      this.monster.root.position.x - this.mech.root.position.x, 0,
      this.monster.root.position.z - this.mech.root.position.z,
    ).normalize();
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? 'left' : 'right';
      const origin = this.mech.getShoulderWorld(side, new THREE.Vector3());
      origin.y += 1.1;
      origin.addScaledVector(forward, 1.1 + (i >> 1) * 0.28);
      origin.x += (side === 'left' ? -1.75 : 1.75) * (1 + (i >> 1) * 0.16);
      origin.y += (i % 2) * 0.38;
      this.pendingImpacts.push({ type: 'projectile', kind: 'missile', delay: .24 + i * .075, action: this.mech.action, opts: {
        from: origin, target: target.clone().add(new THREE.Vector3((i - 1.5) * 0.85, (i % 2) * 0.5, 0)), duration: 0.72 + (i >> 1) * 0.08,
        damage: 9, arc: 4.5 + i * 0.6,
      } });

    }
    this.ui.toast('肩部导弹 · 齐射', '', 900);

  }

  performBlade(side = 'right') {
    if(this.playerAttackCommitted() || this.mech.action?.type==='hit')return;
    if (this.playerBusy) return;
    if (this.bladeCooldown > 0) return;
    if (this.energy < 20) {
      this.ui.toast('光刃需要 20 能量', 'warn', 1800);
      this.audio.uiDeny();
      return;
    }
    if (this.blocking) {
      this.blocking = false;
      this.mech.guard(false);
    }
    this.energy -= 20;
    this.bladeCooldown = this.bladeCooldownMax;
    this.playerBusy = 'blade';
    this.mech.bladeAttack(side);
    this.audio.laserCharge(0.22);
    this.audio.laserFire();
    const from = this.mech.getFistWorld(side, new THREE.Vector3());
    const target = this.monster.getChestWorld(new THREE.Vector3());
    startMelee(this, 'blade', this.mech.action, { side, heavy: true });
    this.attackLunge = { elapsed: 0, duration: this.mech.actionDuration, distance: 1.6 };



  }

  spawnPlayerProjectile(kind, opts = {}) {
    const group = new THREE.Group();
    const from = opts.from?.clone() || this.mech.getChestWorld(new THREE.Vector3());
    const building = opts.building || null;
    const target = building ? new THREE.Vector3(building.x, Math.min(building.h * .5, 16), building.z)
      : opts.target?.clone() || this.monster.getChestWorld(new THREE.Vector3());
    let model = null;
    let glow = null;
    let bladeSprite = null;
    let flow = null;
    if (kind === 'plasma') {
      model = new THREE.Mesh(new THREE.SphereGeometry(.38,12,8),new THREE.MeshBasicMaterial({color:'#e8fbff',toneMapped:false}));
      model.scale.set(1,1,3.2);
      flow=createFlow({color:'#60ceff'});flow.rotation.y=Math.PI;
      flow.scale.set(1.1,1.1,5);group.add(model,flow);
    } else if (kind === 'missile') {
      const bodyMat = new THREE.MeshBasicMaterial({ color: '#ffe0a2', toneMapped: false });
      model = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.45, 5), bodyMat);
      const finMat = new THREE.MeshBasicMaterial({ color: '#ff8c3a', toneMapped: false });
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 4), finMat);
      fin.position.y = -0.72;
      const missile = new THREE.Group();
      model.scale.setScalar(1.25);
      fin.scale.setScalar(1.2);
      const exhaust = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('#ff9b42'), color: '#ffb05c', transparent: true, opacity: 0.9,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      exhaust.scale.set(1.7, 4.6, 1);
      exhaust.position.y = -1.45;
      const exhaustCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('#fff2c0'), color: '#fff4d0', transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      exhaustCore.scale.set(0.7, 2.3, 1);
      exhaustCore.position.y = -1.5;
      missile.add(model, fin, exhaust, exhaustCore);
      group.add(missile);
      model = missile;
      missile.rotation.x = Math.PI / 2;
    } else if (kind === 'blade') {
      bladeSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getBladeWaveTexture(), color: '#c8ffff', transparent: true,
        depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
      }));
      bladeSprite.scale.set(14, 5.5, 1);
      bladeSprite.material.rotation = opts.side === 'left' ? -0.18 : 0.18;
      group.add(bladeSprite);
      group.scale.setScalar(1.15);
    }
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(kind === 'missile' ? '#ffb05e' : '#8dfcff'),
      color: kind === 'missile' ? '#ffb05e' : '#8dfcff',
      transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    glow.scale.setScalar(kind === 'blade' ? 5 : kind === 'missile' ? 1.8 : 2.3);
    group.add(glow);
    group.position.copy(from);
    group.renderOrder = 4;
    group.visible = !(opts.delay > 0);
    this.scene.add(group);
    const p = {
      kind, group, model, glow, bladeSprite, flow,
      from, target, t: 0, duration: opts.duration ?? 0.4, delay: opts.delay ?? 0,
      damage: opts.damage ?? 20, arc: opts.arc ?? 0, side: opts.side,
      trailTimer: 0, building: null, aimedBuilding: building,
      direction: target.clone().sub(from).normalize(),
      speed: opts.speed ?? (kind === 'missile' ? 64 : 115),
      turnRate: opts.turnRate ?? 2.1, radius: kind === 'missile' ? .3 : .65,
      ttl: opts.ttl ?? (kind === 'missile' ? 4 : 2.8),
    };
    if (kind === 'missile') p.direction.y += .28;
    p.direction.normalize();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),p.direction);
    this.playerProjectiles.push(p);
    return p;
  }

  updatePlayerProjectiles(dt) { stepPlayerProjectiles(this, dt); }

  impactPlayerProjectile(p, point) {
    if (this.state !== 'playing') return;
    this.city.damageRadius(point, p.kind === 'blade' ? 19 : p.kind === 'plasma' ? 14 : 7, p.damage * 3.5, this.mech.root.position);
    const hitBoss = p.hitKind === 'boss' && this.monster?.alive;
    if (p.kind === 'plasma') {
      this.effects.energyImpact(point,p.hitNormal,'#a6dbe8');
      this.effects.screenShake(hitBoss ? .28 : .12, .18);
      this.audio.impact(1.2, true);
      if (hitBoss) this.damageMonster(p.damage, { source: 'blast', point, direction:p.direction, heavy: true, crit: true, silentAudio:true });
      this.hitStop = Math.max(this.hitStop, 0.045);
      this.ui.flash('#d7feff', .045);
    } else if (p.kind === 'missile') {
      this.effects.explosion(point, 0.72, { color: '#ff9a48', smokeColor: '#5f5048' });
      this.effects.sparkBurst(point, 12, '#ffbe66', 0.9);
      this.effects.screenShake(0.2, 0.18);
      this.audio.explosion(0.35);
      if (hitBoss) this.damageMonster(p.damage, { source: 'missile', point, direction:p.direction, silentAudio:true });
    } else if (p.kind === 'blade') {
      this.effects.toonSlash(point, { scale: 44, rotation: p.side === 'left' ? -0.38 : 2.5, color: '#d5ffff' });
      this.effects.sparkBurst(point, 32, '#d9ffff', 1.5);
      this.effects.explosion(point, 1.7, { color: '#8ffcff', smokeColor: '#526568' });
      this.effects.shockwave(point, '#bdffff', 2, 38, 0.85);
      this.effects.screenShake(0.75, 0.5);
      this.audio.laserFire();
      this.audio.metalClang();
      if (hitBoss) this.damageMonster(p.damage, { source: 'blade', point, heavy: true, crit: true });
      this.hitStop = Math.max(this.hitStop, 0.07);
      this.ui.flash('#eaffff', 0.2);
    }
  }

  removePlayerProjectile(p) {
    this.scene.remove(p.group);
    p.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map && !m.map.userData?.shared) m.map.dispose();
          m.dispose();
        }
      }
    });
  }

  clearPlayerProjectiles() {
    if (!this.playerProjectiles) { this.playerProjectiles = []; return; }
    for (const p of this.playerProjectiles) this.removePlayerProjectile(p);
    this.playerProjectiles.length = 0;
  }

  performDodge(side) {
    if (this.dodgeCooldown > 0 || this.playerBusy || this.jetState || this.playerAttackCommitted() || this.mech.action?.type==='hit') return;
    if (this.blocking) return;
    if (this.jetFuel < 10) { this.ui.toast('推进燃料不足 · 等待回充', 'warn', 1000); return; }
    this.jetFuel -= 10; this.fuelRegenDelay = .65; this.dodgeRewarded = false;
    this.dodgeCooldown = this.dodgeCooldownMax;
    this.dodgeTimer = 0.34;
    this.invuln = Math.max(this.invuln, 0.48);
    this.invulnFromDodge = true;
    this.pendingImpacts = this.pendingImpacts.filter(p => p.type !== 'punch');
    this.attackLunge = null; this.punchBuffer = null;
    this.meleeStrike = null;
    this.mech.dodge(side);
    this.audio.dodge();
    this.effects.screenShake(0.16, 0.18);
    const dir = this.monster ? new THREE.Vector3(
      this.monster.root.position.x - this.mech.root.position.x, 0,
      this.monster.root.position.z - this.mech.root.position.z
    ).normalize() : new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    this.dodgeDir.copy(right).multiplyScalar(side);
    this.effects.shockwave(this.mech.root.position, '#9efcff', 1, 8, 0.35);
    for (let i = 0; i < 4; i++) {
      this.effects.glowBurst(this.mech.root.position.clone().add(new THREE.Vector3(0, 2 + i * 1.8, 0)), '#5defff', 4 + i, 0.25, this.dodgeDir.clone().multiplyScalar(-4), 0.2);
    }
  }

  performJet() {
    if (this.jetState) { this.jetState.descending = true; return; }
    if (this.playerAttackCommitted() || this.mech.action?.type==='hit' || this.playerBusy || this.jetCooldown > 0 || this.jetFuel < 28 || !this.mech.alive) return;
    this.blocking = false;
    this.mech.guard(false);
    this.jetFuel -= 12;
    this.jetState = { t: 0, descending: false, fx: 0 };
    this.playerVel.set(0, 0, 0);
    this.pendingImpacts = this.pendingImpacts.filter(p => p.type !== 'punch');
    this.attackLunge = null; this.punchBuffer = null;
    this.mech.jet();
    this.audio.dodge();
    this.effects.shockwave(this.mech.root.position, '#9efcff', 1, 12, .4);
    this.effects.dustRise(this.mech.root.position, 8, 6, '#a0a4a5');
    this.ui.toast('推进器点火 · 按住 V 悬飞，松开降落', '', 1800);
  }

  updateJet(dt) {
    const j = this.jetState;
    j.t += dt;
    const kb = this.keyboard.getInput();
    if (j.t > .65 && (!this.keyboard.held.has('KeyV') || this.jetFuel <= 0 || j.t >= 2.4)) j.descending = true;
    const p = this.mech.root.position;
    if (!j.descending) {
      this.jetFuel = Math.max(0, this.jetFuel - dt * 34);
      p.y = Math.min(14, p.y + dt * 23);
    } else p.y = Math.max(0, p.y - dt * 22);
    const dir = this.monster.root.position.clone().sub(p).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const pose = this.inputMode === 'pose' && this.poseVisible ? this.poseState : null;
    const move = dir.clone().multiplyScalar(kb.forward + (pose?.move || 0)).addScaledVector(right, kb.strafe + (pose?.strafe || 0));
    if (move.lengthSq() > 1) move.normalize();
    this.playerVel.lerp(move.multiplyScalar(32), 1 - Math.exp(-7 * dt));
    p.addScaledVector(this.playerVel, dt);
    p.x = clamp(p.x, -CITY_LIMIT, CITY_LIMIT); p.z = clamp(p.z, -CITY_LIMIT, CITY_LIMIT);
    const offset = p.clone().sub(this.monster.root.position).setY(0);
    const separation = offset.length();
    if (separation < 14) p.add((separation > .01 ? offset.normalize() : dir.clone().negate()).multiplyScalar(14 - separation));
    // A thrust pack cannot pass through an intact tower: contact breaks the
    // flight, rather than clipping a 20m actor through an invisible wall.
    if (this.city.buildings.some(b => !b.destroyed && b.h > p.y && this.city.footprintDistance(b, p) < 3)) {
      p.addScaledVector(this.playerVel, -dt); this.playerVel.multiplyScalar(-.25); j.descending = true;
    }
    this.lastMoveSpeed = this.playerVel.length();
    this.blocking = false;
    if (!this.mech.action || this.mech.action.type === 'jet') {
      if (this.mech.action?.type !== 'jet') this.mech.jet();
    }
    if (j.descending && p.y <= 0) {
      this.jetState = null; this.jetCooldown = 1.4;
      this.mech.landing();this.mech.groundCompression=1.6;this.playerVel.multiplyScalar(.4);
      this.effects.shockwave(p, '#b5efff', 1, 15, .5);
      this.effects.dustRise(p, 8, 5, '#979b9c');
      this.effects.screenShake(.35, .25); this.audio.impact(.6, false);
    }
  }

  addHazard(center, radius = 8, life = 3.2) {
    if (this.hazards.length >= 12) this.removeHazard(this.hazards.shift());
    const group = new THREE.Group(); group.position.set(center.x, .16, center.z);
    const mat = new THREE.MeshBasicMaterial({ color: '#ff5924', transparent: true, opacity: .26, depthWrite: false, side: THREE.DoubleSide });
    const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 36), mat); disk.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * .93, radius, 40), mat.clone()); rim.rotation.x = -Math.PI / 2;
    group.add(disk, rim); this.scene.add(group);
    this.hazards.push({ center: center.clone().setY(0), radius, life, maxLife: life, tick: .4, fx: 0, group, disk, rim });
  }

  removeHazard(h) {
    this.scene.remove(h.group);
    h.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.life -= dt; h.tick -= dt; h.fx -= dt;
      if (h.life <= 0) { this.removeHazard(h); this.hazards.splice(i, 1); continue; }
      h.disk.material.opacity = Math.min(1, h.life) * (.2 + Math.sin(this.time * 8) * .045);
      h.rim.material.opacity = Math.min(1, h.life) * .7;
      if (h.fx <= 0) { h.fx = .32; this.effects.glowBurst(h.center.clone().setY(1), '#ff7629', h.radius, .45, new THREE.Vector3(0, 3, 0), .25); }
      if (h.tick <= 0) {
        h.tick = .7;
        if (this.mech.root.position.y < 5 && distXZ(h.center, this.mech.root.position) < h.radius) this.damagePlayer(8, '熔灼', { guardBreak: true });
      }
    }
  }

  performUltimate() {
    if(this.playerAttackCommitted() || this.mech.action?.type==='hit')return;
    if (this.ultimateActive || this.playerBusy) return;
    if (this.energy < 100) {
      this.ui.toast(`天基裁决需要 100 能量 · 当前 ${Math.round(this.energy)}`, 'warn', 2000);
      this.audio.uiDeny();
      return;
    }
    this.energy = 0;
    this.ultimateActive = true;
    this.ultimateTimer = 0;
    this.ultimateStruck = false;
    this.playerBusy = 'ultimate';
    this.invuln = 3.5;
    this.invulnFromDodge = true;
    this.mech.ultimate();
    this.audio.orbitalStrike();
    this.ui.setUltimateCinematic(true);
    this.ui.setCombo(this.combo);
    this.cancelMonsterAttack();
    if (this.cityAttack) {
      this.clearMeteor();
      this.cityAttack = null;
    }
    this.ui.flash('#d8fdff', 0.22);
    this.audio.setIntensity(2);
  }

  updateUltimate(dt) {
    this.ultimateTimer += dt;
    this.lastMoveSpeed = 0;
    this.blocking = false;
    this.mech.guard(false);
    if (!this.ultimateStruck && this.ultimateTimer >= 1.35) {
      this.ultimateStruck = true;
      this.ui.setUltimateCinematic(false);
      const target = this.monster.root.position.clone();
      const from = target.clone().add(new THREE.Vector3(0, 170, 0));
      this.effects.energyColumn(from, target.clone().add(new THREE.Vector3(0, 2, 0)), 1.15, 5.5);
      this.effects.glowBurst(from, '#d7feff', 30, 0.7, null, 0.9);
      this.effects.glowBurst(target.clone().add(new THREE.Vector3(0, 3, 0)), '#ffffff', 42, 0.7, null, 1);
      this.effects.explosion(target.clone().add(new THREE.Vector3(0, 3, 0)), 3.2, { color: '#8ff8ff', smokeColor: '#79848a' });
      this.effects.shockwave(target.clone().add(new THREE.Vector3(0, 0.3, 0)), '#9ffcff', 3, 55, 1.4);
      this.effects.screenShake(1.7, 1.2);
      this.ui.flash('#e7feff', 0.28);
      this.city.damageRadius(this.monster.root.position, 38, 400, this.mech.root.position);
      this.damageMonster(240, { source: 'ultimate', silentAudio: true });
      let broke = false;
      if (this.state === 'playing' && this.monster && this.monster.health > 0) {
        broke = this.triggerBossBreak(4.3);
      }
      this.ui.toast(broke ? '天基炮命中 · 巨兽失衡，全力输出' : '天基炮命中 · 巨兽外壳过载', '', 2400);
      this.audio.megaExplosion();
    }
    this.mech.update(dt, this.time, { speed: 0, running: false });
    if (this.ultimateTimer >= 3.35) {
      this.ultimateActive = false;
      this.playerBusy = null;
      this.ultimateTimer = 0;
      this.ui.setUltimateCinematic(false);
      this.audio.setIntensity(this.phase === 2 ? 2 : 1);
      this.invuln = Math.max(this.invuln, 0.3);
    }
  }

  updatePlayerMovement(dt) {
    if (!this.mech || !this.monster) return;
    if (this.jetState) { this.updateJet(dt); return; }
    const kb = this.keyboard.getInput();
    const pose = this.inputMode === 'pose' && this.poseVisible ? this.poseState : null;
    let forward = kb.forward + (pose ? (pose.move ?? 0) : 0);
    let strafe = kb.strafe + (pose ? (pose.strafe ?? 0) : 0);
    if (pose && pose.blocking) {
      forward *= 0.2;
      strafe *= 0.2;
    }
    if (!Number.isFinite(forward)) forward = 0;
    if (!Number.isFinite(strafe)) strafe = 0;
    this.blocking = !!((pose && pose.blocking) || kb.blocking) && this.hp > 0 && !this.ultimateActive && this.battleTime > this.guardBrokenUntil && !this.playerAttackCommitted() && this.mech.action?.type!=='hit';
    if (this.blocking && !this.lastBlocking) {
      this.guardStartedAt = this.battleTime;
      this.perfectGuardConsumed = false;
      this.audio.shieldUp();
      this.mech.guard(true);
    }
    this.lastBlocking = this.blocking;
    const monsterPos = this.monster.root.position;
    const toMonster = _v1.set(monsterPos.x - this.mech.root.position.x, 0, monsterPos.z - this.mech.root.position.z);
    const dist = toMonster.length();
    if (dist > 0.001) toMonster.divideScalar(dist);
    const right = _v2.crossVectors(toMonster, UP).normalize();
    const move = new THREE.Vector3().addScaledVector(toMonster, forward).addScaledVector(right, strafe);
    const inputMag = Math.min(1.25, move.length());
    if (inputMag > 0.02) move.divideScalar(Math.max(1, move.length()));
    const run = !!(kb.run || (pose && pose.running));
    let targetSpeed = 0;
    if (inputMag > 0.03) {
      targetSpeed = (run ? RUN_SPEED : WALK_SPEED) * this.mech.config.speed * Math.min(1, inputMag);
      if (this.blocking) targetSpeed *= 0.24;
    }
    if (this.mech.action?.type==='punch') targetSpeed *= this.playerAttackCommitted() ? .05 : .3;
    if (this.mech.action?.type==='hit') targetSpeed=0;
    if (this.playerBusy) targetSpeed *= .3;
    if (this.dodgeTimer > 0) {
      this.playerVel.copy(this.dodgeDir).multiplyScalar(48);
      this.effects.glowBurst(this.mech.root.position.clone().add(new THREE.Vector3(0, 3, 0)), '#6ff5ff', 6, 0.22, this.dodgeDir.clone().multiplyScalar(-3), 0.15);
    } else {
      const desired = move.multiplyScalar(targetSpeed);
      const before=this.playerVel.clone();
      const profile=driveProfile(this.mech.config.id);
      stepDrive(this.playerVel,desired,dt,this.playerAttackCommitted()?{...profile,braking:profile.braking*1.6}:profile);
      this.mech.driveAcceleration.copy(this.playerVel).sub(before).divideScalar(Math.max(dt,.00001));

    }
    const pos = this.mech.root.position;
    pos.x += this.playerVel.x * dt;
    pos.z += this.playerVel.z * dt;
    // The complete city is playable; only its outer map edge is bounded.
    pos.x = clamp(pos.x, -CITY_LIMIT, CITY_LIMIT);
    pos.z = clamp(pos.z, -CITY_LIMIT, CITY_LIMIT);
    this.crushCityAt(pos, 4.5, dt, this.lastMoveSpeed > 18 ? 220 : 110);
    // 不可穿入巨兽身体
    const newDist = Math.hypot(pos.x - monsterPos.x, pos.z - monsterPos.z);
    if (newDist < 14) {
      const nx = pos.x - monsterPos.x;
      const nz = pos.z - monsterPos.z;
      const len = Math.hypot(nx, nz) || 1;
      pos.x = monsterPos.x + (nx / len) * 14;
      pos.z = monsterPos.z + (nz / len) * 14;
      this.playerVel.multiplyScalar(0.5);
    }
    this.lastMoveSpeed = this.playerVel.length();
    if (this.dodgeTimer > 0) this.lastMoveSpeed = 30;
    if (!this.playerAttackCommitted()) {
      const desiredYaw=Math.atan2(monsterPos.x-pos.x,monsterPos.z-pos.z);
      const drive=driveProfile(this.mech.config.id);
      this.mech.root.rotation.y=turnChassis(this.mech.root.rotation.y,desiredYaw,dt,drive.turnRate*(this.blocking ? .6 : 1));
    }
    this.mech.root.position.y = 0;
    if (this.blocking) this.mech.guard(true);
  }

  updatePendingImpacts(dt) {
    for (let i = this.pendingImpacts.length - 1; i >= 0; i--) {
      const p = this.pendingImpacts[i];
      p.delay -= dt;
      if (p.delay <= 0) {
        this.pendingImpacts.splice(i, 1);
        if (p.type === 'projectile' && p.action === this.mech.action) {
          const origin = p.kind === 'missile' ? p.opts.from : this.mech.getFistWorld(p.opts.side || 'right', new THREE.Vector3());
          this.spawnPlayerProjectile(p.kind, { ...p.opts, from: origin, target: p.kind === 'plasma' ? this.monster.getChestWorld(new THREE.Vector3()) : p.opts.target });
          if (p.kind === 'plasma') this.audio.plasmaBlast();
        }
        else if (p.type === 'blast') this.resolveBlast(p);
      }
    }
  }

  getMonsterDistance() {
    if (!this.mech || !this.monster) return 999;
    return distXZ(this.mech.root.position, this.monster.root.position);
  }

  crushCityAt(pos, radius, dt, damage) {
    this.city?.damageRadius(pos, radius, dt * damage);
  }

  // A closer facade intercepts fire aimed toward the boss. Nearby buildings
  // also remain attackable when the boss is outside melee distance.
  pickBuildingTarget(range = 95) {
    const pos = this.mech.root.position;
    const boss = this.monster.root.position;
    const direction = boss.clone().sub(pos); direction.y = 0; direction.normalize();
    let best = null, bestDistance = Math.min(range, this.getMonsterDistance() - 8);
    for (const b of this.city.buildings) {
      if (b.destroyed) continue;
      const distance = this.city.footprintDistance(b, pos);
      const dx = b.x - pos.x, dz = b.z - pos.z;
      const forward = dx * direction.x + dz * direction.z;
      const lateral = Math.abs(dx * direction.z - dz * direction.x);
      if (distance < bestDistance && (distance < 12 || (forward > 0 && lateral < Math.max(b.w, b.d) / 2 + 5))) {
        best = b; bestDistance = distance;
      }
    }
    return best;
  }

  playerAttackCommitted() {
    return actionStage(this.mech.action,this.mech.actionT,this.mech.actionDuration)==='committed';
  }

  resolveMeleeContact(strike, contact) {
    const heavy = strike.heavy, blade = strike.type === 'blade';
    const multiplier = 1 + Math.min(this.combo,20) * .035;
    const damage = blade ? 62 : (heavy ? 37 : strike.step === 2 ? 18 : 15) * multiplier;
    const direction = this.monster.root.position.clone().sub(this.mech.root.position).setY(0).normalize();
    this.damageMonster(damage, { source: blade ? 'blade' : 'punch', point: contact.point, part: contact.part, direction, heavy, silentAudio:true });
    this.effects.punchImpact(contact.point, blade ? '#96d9ee' : '#d5e4e7', heavy,
      {surface:'carapace',normal:direction.clone().negate()});
    this.audio.impact(heavy ? 1.2 : .7, heavy);
    if (blade || heavy) this.audio.metalClang();
    this.hitStop = heavy ? .085 : .045;
    this.monster.contactVelocity ||= new THREE.Vector3();
    const mass=driveProfile(this.mech.config.id).mass;
    const resistance=this.monster.action?.type==='stagger' ? 1.5 : driveProfile('kaiju').mass;
    const impulse=contactImpulse(heavy?10:3.5,mass,resistance);
    this.monster.contactVelocity.addScaledVector(direction,impulse);
    this.mech.contactVelocity ||= new THREE.Vector3();
    this.mech.contactVelocity.addScaledVector(direction,-impulse*.28/mass);
    this.mech.groundCompression=heavy?.8:.35;
    // Only a fully committed heavy hit interrupts windup; ordinary hits cannot
    // stunlock the boss. Superarmored charge and area attacks require a break.
    if (heavy && this.monsterAttack && ['swipe','doubleClaw','breath'].includes(this.monsterAttack.type)
      && this.monsterAttack.t < this.monsterAttack.impact) {
      this.cancelMonsterAttack(); this.monster.stagger(.85);
      this.nextMonsterAttackAt = this.battleTime + 1.2;
      this.ui.toast('重击打断 · 追击窗口', '', 900);
    }
    this.ui.lockOnHit();
    this.lastMeleeContact = { ...contact, type: strike.type, time: this.battleTime };
  }

  updateContactMotion(dt) {
    for (const actor of [this.mech,this.monster]) {
      if (!actor?.contactVelocity) continue;
      const delta=actor.contactVelocity.clone().multiplyScalar(dt);
      actor.root.position.add(delta);
      actor.root.position.x=clamp(actor.root.position.x,-CITY_LIMIT,CITY_LIMIT);
      actor.root.position.z=clamp(actor.root.position.z,-CITY_LIMIT,CITY_LIMIT);
      actor.contactVelocity.multiplyScalar(Math.exp(-8*dt));
      if(delta.lengthSq()>.0001) this.city.damageRadius(actor.root.position,actor===this.monster?5:3,delta.length()*28);
    }
  }

  resolveBlast() {
    if (!this.monster || this.monster.health <= 0 || this.state !== 'playing') return;
    const point = this.monster.getChestWorld(new THREE.Vector3());
    this.damageMonster(44, { source: 'blast', point, heavy: true, crit: true });
    this.audio.impact(1.4, true);
    this.effects.monsterHit(point, true);
    this.effects.laserImpact?.(point);
    this.hitStop = 0.045;
    this.ui.lockOnHit();
  }

  damageMonster(amount, opts = {}) {
    const cfg = this.mech.config;
    amount *= opts.source === 'blast' ? cfg.plasma : opts.source === 'missile' ? cfg.missile : opts.source === 'blade' ? cfg.blade : opts.source === 'punch' ? cfg.melee : 1;
    if (!this.monster || this.monster.health <= 0) return;
    if(this.cityAttack && !this.cityAttack.resolved){
      this.cityAttack.interruptDamage=(this.cityAttack.interruptDamage||0)+amount;
      if(this.cityAttack.interruptDamage>=70){
        this.clearMeteor();this.cityAttack=null;this.ui.hideWarning();
        this.monster.stagger(1.5);this.bossRecoveryUntil=this.battleTime+1.5;
        this.nextMonsterAttackAt=this.battleTime+1.7;this.nextCityAttackAt=this.battleTime+20;
        this.energy=clamp(this.energy+10,0,100);
        this.ui.toast('城市攻击打断 · 撤离恢复 / 能量 +10','',1800);
      }
    }
    const staggered = this.monster.action?.type === 'stagger';
    const opening = this.battleTime < this.bossRecoveryUntil || this.battleTime < this.counterUntil;
    const punish = opening && ['punch','blade'].includes(opts.source);
    const flank = opts.direction && opts.direction.dot(new THREE.Vector3(0,0,1).applyQuaternion(this.monster.root.quaternion))>.4;
    const dmg = amount * (staggered ? 1.35 : punish ? 1.3 : 1);
    if (punish) { this.lastPunishAt=this.battleTime; this.ui.toast('抓住破绽 · 伤害 +30%', '', 750); }
    this.monster.health = Math.max(0, this.monster.health - dmg);
    this.damageDealt += dmg;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 3.2;
    this.ui.setCombo(this.combo);
    const point = opts.point || this.monster.getChestWorld(new THREE.Vector3());
    this.ui.spawnDamage(point, dmg, {
      crit: opts.crit || opts.heavy,
      label: opts.source === 'ultimate' ? 'ORBITAL' : opts.source === 'blast' ? 'PLASMA'
        : opts.source === 'blade' ? 'BLADE' : opts.source === 'missile' ? 'MISSILE' : opts.heavy ? 'HEAVY' : '',
    });
    this.monster.hit(opts.heavy ? 1 : .4, { point, part: opts.part, direction: opts.direction || this.monster.root.position.clone().sub(this.mech.root.position).setY(0).normalize() });
    if (!opts.silentAudio) this.audio.impact(0.65, false);
    this.energy = clamp(this.energy + (opts.source === 'ultimate' ? 0 : opts.source === 'missile' ? 2 : 4), 0, 100);
    this.ui.hitMarker?.(!!(opts.heavy || opts.crit));
    this.ui.screenHit?.(!!(opts.heavy || opts.crit));
    if(opts.source==='ultimate')this.ui.flash('#d9feff',.08);

    const gain = opts.source === 'ultimate' ? 0 : opts.source === 'blade' ? 34
      : opts.source === 'missile' ? 5 : opts.source === 'blast' ? 18 : opts.heavy ? 12 : 6;
    if (!staggered && this.bossTransition <= 0 && this.bossStaggerLock <= 0) {
      this.bossStagger = clamp(this.bossStagger + gain * (flank ? 1.6 : 1), 0, 100);
      this.bossStaggerIdle = 0;
    }

    if (this.phase === 1 && this.monster.health > 0 && this.monster.health <= this.bossMax * 0.62) {
      this.enterPhase2();
    }
    if (this.monster.health <= 0) {
      this.victory();
      return;
    }
    if (!staggered && this.bossTransition <= 0 && this.bossStagger >= 100) {
      this.triggerBossBreak(this.phase === 2 ? 3.2 : 4.0);
    }
  }

  enterPhase2() {
    if (this.phase === 2 || !this.monster || this.monster.health <= 0) return;
    this.phase = 2;
    this.enrageTriggered = true;
    this.cancelMonsterAttack();
    if (this.cityAttack) {
      this.clearMeteor();
      this.cityAttack = null;
    }
    this.bossTransition = 2.9;
    this.bossStagger = 0;
    this.bossStaggerIdle = 0;
    this.bossStaggerLock = 2.9;
    this.nextMonsterAttackAt = this.battleTime + 4.2;
    this.playerBlockHold = 0;
    this.bossCooldowns = { swipe: 0, doubleClaw: 0, tail: 0, slam: 0, breath: 0, charge: 0, eruption: 0 };
    this.monster.setEnraged(true);
    this.monster.playAction('enrage');
    this.audio.roar(1.25);
    this.audio.setIntensity(2);
    this.ui.showPhaseCutin();
    this.ui.flash('#ff5a2f', 0.28);
    this.effects.screenShake(1.1, 0.9);
    const chest = this.monster.getChestWorld(new THREE.Vector3());
    this.effects.dustRise(this.monster.root.position, 8, 5, '#a79a87');
    this.effects.smokePuff(chest, 3, .8, '#8c857a');
    this.effects.shockwave(this.monster.root.position, '#ff6a2f', 2, 46, 1.1);
    this.effects.sparkBurst(chest, 38, '#ffa459', 1.2);
    // Give the player breathing room while the boss tears through its limiters.
    const away = this.mech.root.position.clone().sub(this.monster.root.position).setY(0);
    if (away.lengthSq() > 0.01) {
      away.normalize();
      this.mech.root.position.addScaledVector(away, 5);
      this.playerVel.multiplyScalar(0.2);
    }
    this.ui.toast('巨兽解除限界 · 新技能已解锁', 'warn', 2400);
  }

  // ---------------------------------------------------------------- monster
  updateMonster(dt) {
    if (!this.monster || this.state !== 'playing') return;
    const m = this.monster;
    for (const key of Object.keys(this.bossCooldowns)) {
      this.bossCooldowns[key] = Math.max(0, this.bossCooldowns[key] - dt);
    }
    if (this.bossTransition > 0) this.bossTransition = Math.max(0, this.bossTransition - dt);
    if (this.bossStaggerLock > 0) this.bossStaggerLock = Math.max(0, this.bossStaggerLock - dt);
    if (this.bossStagger > 0 && this.bossStaggerLock <= 0) {
      this.bossStaggerIdle += dt;
      if (this.bossStaggerIdle > 2.4) this.bossStagger = Math.max(0, this.bossStagger - dt * 8);
    }

    const alive = m.health > 0;
    if (!alive) {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      m.update(dt, this.time, { target: this.mech.root.position, speed: 0 });
      return;
    }
    if (this.ultimateActive) {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      m.update(dt, this.time, { target: this.mech.root.position, speed: 0 });
      return;
    }
    if (this.bossTransition > 0) {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      m.update(dt, this.time, { target: this.mech.root.position, speed: 0 });
      return;
    }
    if (this.monsterAttack) {
      this.updateMonsterAttack(dt);
      const a = this.monsterAttack;
      if (a) {
        if (a.type === 'charge' && a.t >= a.impact) {
          m.root.rotation.y = damp(m.root.rotation.y, a.chargeAngle, 10, dt);
        }
        m.update(dt, this.time, {
          target: this.mech.root.position,
          speed: a.charging ? (a.chargeSpeed || 24) : 0,
        });
      }
      return;
    }
    if (this.battleTime < this.bossRecoveryUntil) {
      m.update(dt,this.time,{target:this.mech.root.position,speed:0});
      return;
    }
    if (m.action?.type === 'stagger') {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      m.update(dt, this.time, { target: this.mech.root.position, speed: 0 });
      return;
    }
    if (this.cityAttack) {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      m.update(dt, this.time, { target: this.mech.root.position, speed: 0 });
      return;
    }

    // Between attacks the boss does not just stand still: it circles, closes
    // distance, and occasionally gives ground while keeping its head on you.
    let moveSpeed = 0;
    if (this.battleTime > this.graceUntil) {
      if (this.battleTime > this.bossStrafeAt) {
        this.bossStrafeDir = Math.random() < 0.35 ? -this.bossStrafeDir : this.bossStrafeDir;
        if (Math.random() < 0.28) this.bossStrafeDir = Math.random() < 0.5 ? -1 : 1;
        this.bossStrafeAt = this.battleTime + rand(1.5, 3.4);
      }
      const dist = this.getMonsterDistance();
      const dx = this.mech.root.position.x - m.root.position.x;
      const dz = this.mech.root.position.z - m.root.position.z;
      const len = Math.hypot(dx, dz) || 1;
      const dir = new THREE.Vector3(dx / len, 0, dz / len);
      const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
      const move = new THREE.Vector3();
      let speed = 0;
      if (dist > 19.5) {
        move.addScaledVector(dir, 0.92).addScaledVector(right, this.bossStrafeDir * 0.3);
        speed = this.phase === 2 ? 15 : 11;
      } else if (dist < 15) {
        move.addScaledVector(dir, -0.68).addScaledVector(right, this.bossStrafeDir * 0.72);
        speed = this.phase === 2 ? 2.5 : 1.7;
      } else {
        move.addScaledVector(right, this.bossStrafeDir);
        speed = this.phase === 2 ? 2.0 : 1.25;
      }
      if (move.lengthSq() > 0.001) {
        move.normalize();
        stepDrive(m.driveVelocity,move.multiplyScalar(speed),dt,driveProfile('kaiju'));
        m.root.position.addScaledVector(m.driveVelocity,dt);
        const center = Math.hypot(m.root.position.x, m.root.position.z);
        if (center > CITY_LIMIT) {
          m.root.position.x *= CITY_LIMIT / center;
          m.root.position.z *= CITY_LIMIT / center;
        }
        moveSpeed = m.driveVelocity.length();
      }
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
      if (this.battleTime >= this.nextMonsterAttackAt) {
        if (this.nextCityAttackAt <= this.battleTime) this.startCityAttack();
        else this.startMonsterAttack();
      }
    } else {
      m.faceToward(this.mech.root.position.x, this.mech.root.position.z, dt);
    }
    this.crushCityAt(m.root.position, 7, dt, 240);
    m.update(dt, this.time, { target: this.mech.root.position, speed: moveSpeed });
  }

  chooseBossAttack(dist, behind) {
    const p2 = this.phase === 2;
    const options = [];
    const add = (type, weight) => {
      if (this.bossCooldowns[type] > 0) return;
      if (!p2 && !['swipe', 'slam', 'breath', 'charge'].includes(type)) return;
      if (type === 'eruption' && !p2) return;
      options.push({ type, weight });
    };
    if (dist < 32.5) {
      add('swipe', 3.2);
      add('doubleClaw', 2.5);
      add('slam', 1.65 + (this.playerBlockHold > 0.7 ? 2.8 : 0));
    }
    if (dist < 29.5) add('tail', 1.4 + (behind ? 3.8 : 0));
    if (dist > 18) add('breath', dist > 36 ? 4.2 : 1.2);
    if (dist > 20) add('charge', 2.3 + (p2 ? 1.4 : 0) + (this.playerBlockHold > 0.7 ? 1.2 : 0));
    if (p2 && dist < 62) add('eruption', 2.8);
    if (!options.length) return null;
    for (const opt of options) {
      opt.weight = attackWeight(opt.type, opt.weight, this.bossRecent);
    }
    let total = 0;
    for (const o of options) total += o.weight;
    let roll = Math.random() * total;
    for (const o of options) {
      roll -= o.weight;
      if (roll <= 0) return o.type;
    }
    return options[options.length - 1].type;
  }

  startMonsterAttack(forcedType = null) {
    if (!this.monster || !this.mech || this.monster.health <= 0) return;
    if (this.monsterAttack || this.cityAttack || this.bossTransition > 0 || this.ultimateActive) return;
    if (this.monster.action?.type === 'stagger' || this.monster.action?.type === 'enrage') return;
    const dist = this.getMonsterDistance();
    const toPlayer = this.mech.root.position.clone().sub(this.monster.root.position);
    const lineAngle = Math.atan2(toPlayer.x, toPlayer.z);
    const facingDiff = Math.atan2(
      Math.sin(lineAngle - this.monster.root.rotation.y),
      Math.cos(lineAngle - this.monster.root.rotation.y),
    );
    const behind = Math.abs(facingDiff) > 1.08;
    const type = forcedType || this.chooseBossAttack(dist, behind);
    if (!type) {
      this.nextMonsterAttackAt = this.battleTime + 0.6;
      return;
    }
    const cfg = MONSTER_ATTACKS[type] || MONSTER_ATTACKS.swipe;
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const a = {
      type,
      side,
      reverse: Math.random() < 0.5,
      t: 0,
      impact: cfg.impact * (this.phase === 2 ? .83 : .95),
      duration: cfg.duration * (this.phase === 2 ? .88 : .96),
      targetPos: this.mech.root.position.clone(),
      lineAngle,
      resolved: false,
      hit: false,
    };
    if (type === 'charge') {
      a.chargeAngle = lineAngle;
      a.chargeDir = new THREE.Vector3(Math.sin(lineAngle), 0, Math.cos(lineAngle));
      a.charging = false;
      a.chargeElapsed = 0;
      a.chargeHit = false;
      a.chargeDuration = this.phase === 2 ? 0.62 : 0.54;
      a.chargeDistance = clamp(dist - 11, 8, this.phase === 2 ? 68 : 56);
      a.chargeSpeed = a.chargeDistance / a.chargeDuration;
      a.trailTimer = 0;
    }
    if (type === 'eruption') {
      const center = this.mech.root.position.clone();
      const zones = [center.clone()];
      for (let i = 0; i < 4; i++) {
        const ang = rand(0, Math.PI * 2) + i * 1.35;
        const r = rand(10, 17);
        const pos = center.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
        const rad = Math.hypot(pos.x, pos.z);
        if (rad > CITY_LIMIT) {
          pos.x *= CITY_LIMIT / rad;
          pos.z *= CITY_LIMIT / rad;
        }
        zones.push(pos);
      }
      a.zones = zones;
    }
    this.monster.driveVelocity?.set(0,0,0);
    this.monster.groundCompression=.7;
    this.monsterAttack = a;
    this.monster.playAction(type, { side, reverse: a.reverse });
    a.lineAngle=this.monster.root.rotation.y;
    if(type==='charge'){a.chargeAngle=a.lineAngle;a.chargeDir.set(Math.sin(a.lineAngle),0,Math.cos(a.lineAngle));}
    this.monster.actionDuration = a.duration;
    this.monster.action.impact = a.impact;
    this.monster.action.duration = a.duration;
    this.bossCooldowns[type] = BOSS_SKILL_CD[type] || 3;
    this.bossLastAttack = type;
    this.bossRecent.push(type);
    if (this.bossRecent.length > 6) this.bossRecent.shift();
    const meta = BOSS_MOVE_META[type] || { name: type, sub: '' };
    this.ui.showWarning(
      this.phase === 2 ? `暴走 · ${meta.name}` : meta.name,
      this.phase === 2 ? meta.sub : `${meta.sub} · 观察起手动作`,
    );
    this.showBossTelegraph(type, a);
    this.audio.warnBeep();
    if (type === 'charge' || type === 'eruption' || type === 'doubleClaw') {
      this.audio.rumble(0.5);
    }
    if (type === 'eruption') this.audio.roar(0.65);
    if (type === 'charge') this.audio.roar(0.4);
  }

  showBossTelegraph(type, a) {
    const m = this.monster;
    if (!m) return;
    if (type === 'swipe') {
      this.showTelegraph('cone', {
        center: m.root.position.clone(), radius: 24, spread: 1.05,
        follow: true, color: '#ff4b32',
      });
    } else if (type === 'doubleClaw') {
      this.showTelegraph('cone', {
        center: m.root.position.clone(), radius: 24, spread: 1.28,
        follow: true, color: '#ff7135',
      });
    } else if (type === 'tail') {
      this.showTelegraph('ring', { center: m.root.position.clone(), radius: 32, color: '#ff6a36' });
    } else if (type === 'slam') {
      this.showTelegraph('circle', { center: m.root.position.clone(), radius: 33, color: '#ff4b26', heavy: true });
    } else if (type === 'breath') {
      this.showTelegraph('line', {
        center: m.root.position.clone(), angle: a.lineAngle,
        width: 19, length: 80, color: '#ff4b26',
      });
    } else if (type === 'charge') {
      this.showTelegraph('line', {
        center: m.root.position.clone(), angle: a.chargeAngle,
        width: 18, length: Math.min(62, a.targetPos.distanceTo(m.root.position) + 8),
        color: '#ff9a32', lane: true,
      });
    } else if (type === 'eruption') {
      this.showTelegraph('multi', {
        centers: a.zones, radius: 9, color: '#ff6a2c',
      });
    }
  }

  updateMonsterAttack(dt) {
    const a = this.monsterAttack;
    if (!a) return;
    a.t += dt;
    const lockAt=a.impact*(['breath','charge'].includes(a.type)?.42:.35);
    if(a.t<lockAt) {
      this.monster.faceToward(this.mech.root.position.x,this.mech.root.position.z,dt);
      a.lineAngle=this.monster.root.rotation.y;
      if(a.type==='charge') {a.chargeAngle=a.lineAngle;a.chargeDir.set(Math.sin(a.lineAngle),0,Math.cos(a.lineAngle));}
    } else if(!a.locked) {
      a.locked=true; a.lineAngle=this.monster.root.rotation.y;
      if(a.type==='charge'){a.chargeAngle=a.lineAngle;a.chargeDir.set(Math.sin(a.lineAngle),0,Math.cos(a.lineAngle));}
    }
    if(['swipe','doubleClaw'].includes(a.type)) {
      const step=(start,end,distance)=>{
        const before=clamp((a.t-dt-start)/(end-start)), after=clamp((a.t-start)/(end-start));
        const remaining=Math.max(0,this.getMonsterDistance()-14.2);
        this.monster.root.position.addScaledVector(new THREE.Vector3(Math.sin(a.lineAngle),0,Math.cos(a.lineAngle)),Math.min(remaining,(after-before)*distance));
      };
      step(a.impact*.35,a.impact*.9,2.4);
      if(a.type==='doubleClaw')step(a.impact+.28,a.impact+.6,3.2);
    }
    this.updateTelegraph(a.t);
    if (a.type === 'breath' && !a.resolved) {
      a.fxTimer = (a.fxTimer ?? 0) - dt;
      if (a.fxTimer <= 0) {
        a.fxTimer = 0.1;
        const mouth = this.monster.getMouthWorld(new THREE.Vector3());
        this.effects.glowBurst(mouth, '#ffb35a', 4 + (a.t / a.impact) * 5, 0.22, null, 0.85);
        this.effects.sparkBurst(mouth, 3, '#ffc36a', 0.6);
      }
    }
    if (!a.resolved) {
      const p = clamp(a.t / a.impact);
      this.ui.setWarningProgress(1 - p);
      if (a.t >= a.impact) {
        a.resolved = true;
        this.ui.hideWarning();
        this.clearTelegraph();
        if (a.type === 'charge') {
          a.charging = true;
          a.chargeElapsed = 0;
          this.audio.roar(0.55);
          this.effects.screenShake(0.7, 0.35);
          this.effects.dustRise(this.monster.root.position, 8, 5, '#806b5c');
        } else {
          this.resolveMonsterAttack(a);
        }
      }
    }
    if(a.type==='breath' && a.resolved && a.breathVolume && !a.breathDamaged && a.t<a.impact+.8){
      const v=a.breathVolume;
      const contact=breathContact(v.from,v.end,v.startRadius,v.endRadius,bodyCapsules(this.mech));
      if(contact){
        a.breathDamaged=true;a.hit=true;
        this.damagePlayer(this.phase===2?36:30,'breath',{point:contact.point});
      }
    }
    if (a.type === 'charge' && a.charging) {
      a.chargeElapsed += dt;
      const m = this.monster;
      m.root.position.addScaledVector(a.chargeDir, a.chargeSpeed * dt);
      const center = Math.hypot(m.root.position.x, m.root.position.z);
      if (center > CITY_LIMIT) {
        m.root.position.x *= CITY_LIMIT / center;
        m.root.position.z *= CITY_LIMIT / center;
        a.charging = false;
      }
      this.crushCityAt(m.root.position, 9, dt, 700);
      const distToPlayer = this.getMonsterDistance();
      if (!a.chargeHit && distToPlayer < 18 && this.mech.root.position.y < 11) {
        a.chargeHit = true;
        this.damagePlayer(this.phase === 2 ? 27 : 23, 'charge', { guardBreak: true });
        this.effects.screenShake(0.95, 0.45);
      }
      a.trailTimer -= dt;
      if (a.trailTimer <= 0) {
        a.trailTimer = 0.055;
        this.effects.dustRise(m.root.position, 1, 3.2, '#8d7662');
        this.effects.sparkBurst(m.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 3, '#ff9a44', 0.5);
      }
      if (a.chargeElapsed >= a.chargeDuration) {
        a.charging = false;
        this.effects.shockwave(m.root.position, '#ff8a4c', 2, 24, 0.65);
        this.effects.dustRise(m.root.position, 5, 6, '#806a5b');
        this.effects.screenShake(0.45, 0.3);
      }
    }
    if (a.type === 'doubleClaw' && a.resolved && !a.secondStrike && a.t >= a.impact + .72) {
      a.secondStrike = true;
      this.resolveMonsterAttack({ ...a, side: a.side === 'left' ? 'right' : 'left', secondStrike: true });
    }
    if (a.t >= a.duration) {
      this.monsterAttack = null;
      this.ui.hideWarning();
      this.clearTelegraph();
      const recovery = {swipe:.45,doubleClaw:.65,slam:.85,breath:.9,charge:1.1,tail:.5,eruption:.7}[a.type] || .6;
      this.bossRecoveryUntil=this.battleTime+recovery*(this.phase===2?.8:1)*(this.difficulty?.recovery || 1);
      this.nextMonsterAttackAt=this.bossRecoveryUntil+(this.phase===2?.16:.25);
      this.ui.toast('巨兽收招 · 近战反击', '', 700);
    }
  }

  resolveMonsterAttack(a) {
    if (!this.mech || this.hp <= 0) return;
    const m = this.monster;
    const playerPos = this.mech.root.position;
    const dist = this.getMonsterDistance();
    if (a.type === 'breath') {
      // Breath collision and destruction are resolved below, before mutating cover.
    } else if (a.type === 'eruption') {
      for (const zone of a.zones || [a.targetPos]) if (zone) this.city.damageRadius(zone, 14, 220);
    } else this.city.damageRadius(m.root.position, a.type === 'slam' ? 33 : 24, a.type === 'slam' ? 180 : 110);
    let damage = 0;
    let hit = false;
    if (a.type === 'swipe' || a.type === 'doubleClaw') {
      hit = false; // Swept claw contacts own damage, sparks and impact audio.
      this.audio.punch(false);
    } else if (a.type === 'tail') {
      hit = dist < 31;
      damage = this.phase === 2 ? 24 : 21;
      this.effects.shockwave(m.root.position, '#ff8a4c', 2, 38, 0.65);
      this.effects.dustRise(m.root.position, 7, 8, '#8b7565');
      this.effects.screenShake(0.6, 0.4);
      this.audio.impact(1.1, true);
    } else if (a.type === 'slam') {
      hit = dist < 33;
      damage = this.phase === 2 ? 34 : 28;
      const foot = m.root.position.clone();
      this.effects.debrisBurst(foot.clone().setY(.8), 18, 1.2, '#89857c');
      this.effects.shockwave(foot, '#ff8a4a', 2, 42, 0.9);
      this.effects.shockwave(foot, '#ffe0a0', 1.4, 30, 0.55);
      this.effects.dustRise(foot, 10, 10, '#8b7565');
      this.effects.screenShake(0.9, 0.6);
      this.audio.impact(1.35, true);
    } else if (a.type === 'breath') {
      const angle = a.lineAngle;
      const mouth = m.getMouthWorld(new THREE.Vector3());
      const requestedEnd = m.root.position.clone().add(new THREE.Vector3(Math.sin(angle)*78,1.3,Math.cos(angle)*78));
      const volume = breathVolume(mouth,requestedEnd,this.city.buildings,bodyCapsules(this.mech),8);
      const end=volume.end;
      a.breathVolume=volume;
      hit=!!volume.contact;
      a.breathDamaged=hit;
      damage=this.phase===2?36:30;
      this.effects.breathStream(mouth,end,.8,8,volume.endRadius/8);
      if(volume.obstruction?.kind==='building')this.city.damageBuilding(volume.obstruction.object,170,m.root.position);
      const length=mouth.distanceTo(end);
      for(let distance=12;distance<length;distance+=13){
        const surface=mouth.clone().lerp(end,distance/length);
        if(surface.y>7)continue;
        surface.y=0;
        this.addHazard(surface,5.5,2.8);
        this.effects.smokePuff(surface,2,.7,'#82746a');
      }
      this.effects.glowBurst(mouth,'#ffd7a1',3.4,.12,null,.6);
      this.effects.smokePuff(end,5,1.2,'#716c60');
      this.effects.sparkBurst(end,18,'#f5b66c',.9);
      if(end.y<4)this.effects.scorch(end.clone().setY(.15),6);
      this.effects.screenShake(hit?.3:.1,.22);
      this.audio.monsterBreath();
    } else if (a.type === 'eruption') {
      const zones = a.zones || [a.targetPos];
      let closest = 999;
      for (const z of zones) {
        closest = Math.min(closest, distXZ(playerPos, z));
        this.effects.eruption(z, 1);
        this.addHazard(z, 8, 3.8);
      }
      hit = closest < 9;
      damage = 27;
      this.effects.screenShake(0.9, 0.6);
      this.audio.explosion(1.5);
      this.audio.roar(0.7);
    } else {
      return;
    }
    if (['slam', 'tail', 'eruption'].includes(a.type) && this.mech.root.position.y > 6) hit = false;
    if (hit) {
      a.hit = true;
      this.damagePlayer(damage, a.type, { guardBreak: a.type === 'slam' || a.type === 'charge' || a.type === 'eruption' });
    } else {
      // Whiff feedback stays subtle; the attack animation and VFX still carry the moment.
      this.audio.whoosh();
    }
  }

  triggerBossBreak(duration = 4.0) {
    if (!this.monster || this.monster.health <= 0 || this.state !== 'playing') return false;
    if (this.bossTransition > 0) return false;
    if (this.monster.action?.type === 'stagger') return false;
    this.cancelMonsterAttack();
    if (this.cityAttack) {
      this.clearMeteor();
      this.cityAttack = null;
    }
    this.bossStagger = 0;
    this.bossStaggerIdle = 0;
    this.bossStaggerLock = duration + 0.6;
    this.nextMonsterAttackAt = this.battleTime + duration + 1.1;
    this.monster.stagger(duration);
    this.ui.showBreak();
    this.ui.hideWarning();
    this.ui.flash('#ffd58a', 0.24);
    const chest = this.monster.getChestWorld(new THREE.Vector3());
    this.effects.shockwave(this.monster.root.position, '#ffcf72', 2, 38, 0.8);
    this.effects.sparkBurst(chest, 38, '#ffb458', 1.25);
    this.effects.screenShake(1.0, 0.6);
    this.audio.metalClang();
    this.audio.roar(0.5);
    this.hitStop = 0.1;
    return true;
  }

  damagePlayer(amount, kind = 'hit', opts = {}) {
    amount *= (this.mech?.config.armor || 1) * (this.difficulty?.damage || 1);
    if (this.hp <= 0 || this.state !== 'playing') return;
    if (this.dodgeTimer > 0) {
      if (!this.dodgeRewarded) {
        this.dodgeRewarded = true;
        this.counterUntil=this.battleTime+1.4;
        this.ui.toast('完美闪避 · +8 能量', '', 1000);
        this.energy = clamp(this.energy + 8, 0, 100);
      }
      this.effects.shockwave(this.mech.root.position, '#a8fbff', 1.2, 10, 0.4);
      return;
    }
    if (this.invuln > 0) return;
    const playerPos = this.mech.getChestWorld(new THREE.Vector3());
    if (canPerfectGuard({ blocking: this.blocking, guardStartedAt: this.guardStartedAt,
      now: this.battleTime, consumed: this.perfectGuardConsumed, unblockable: opts.guardBreak,
      window: this.difficulty?.parry || .22 })) {
      this.perfectGuardConsumed = true;
      this.perfectGuards++;
      this.energy = clamp(this.energy + 12, 0, 100);
      this.counterUntil = this.battleTime + 1.8;
      this.invuln = .18;
      this.hitStop = .065;
      this.effects.energyImpact(playerPos, this.mech.root.position.clone().sub(this.monster.root.position).normalize(), '#bceeff');
      this.audio.metalClang();
      this.ui.toast('精准格挡 · 无伤 / 能量 +12 / 反击强化', '', 1400);
      return;
    }
    if (this.blocking) {
      const guardBreak = !!opts.guardBreak || this.playerBlockHold > 2.0;
      const blocked = Math.max(1, Math.round(amount * (guardBreak ? 0.48 : 0.17)));
      this.hp = Math.max(0, this.hp - blocked);
      this.hitsTaken++;
      // Holding guard across hits must not reset the guard-break clock.
      this.ui.hitFlash(guardBreak ? 0.6 : 0.25);
      this.ui.spawnDamage(playerPos, blocked, { label: guardBreak ? 'GUARD BREAK' : 'BLOCKED' });
      this.effects.shieldBurst?.(playerPos);
      this.effects.sparkBurst(playerPos, guardBreak ? 24 : 10, guardBreak ? '#ffb06e' : '#87f4ff', guardBreak ? 1 : 0.6);
      this.audio.impact(guardBreak ? 1.1 : 0.5, guardBreak);
      this.audio.shieldUp();
      this.invuln = guardBreak ? .45 : .3;
      this.effects.screenShake(guardBreak ? 0.7 : 0.25, guardBreak ? 0.42 : 0.2);
      if (guardBreak) {
        this.guardBrokenUntil = this.battleTime + 1.0;
        this.blocking = false;
        this.lastBlocking = false;
        this.mech.guard(false);
        this.energy = Math.max(0, this.energy - 10);
        this.ui.flash('#ff6b3c', 0.32);
        this.ui.toast('防御被击穿 · 拉开距离', 'warn', 1500);
      }
      this.ui.setLowHealth(this.hp <= 30);
      if (this.hp <= 0) this.defeat('mech');
      return;
    }
    this.playerBlockHold = 0;
    this.hp = Math.max(0, this.hp - amount);
    this.hitsTaken++;
    this.combo = 0;
    this.comboTimer = 0;
    this.ui.setCombo(0);
    this.ui.spawnDamage(playerPos, amount, { label: kind.toUpperCase() });
    this.ui.hitFlash(0.8);
    this.ui.flash('#ff3b45', 0.3);
    this.audio.hurt();
    const interrupted=this.mech.action;
    this.pendingImpacts=this.pendingImpacts.filter(p=>p.action!==interrupted);
    this.playerBusy=null;this.meleeStrike=null;
    this.punchBuffer=null;this.attackLunge=null;
    this.mech.hit(1);
    this.effects.sparkBurst(playerPos, 30, '#ffb06e', 1.1);
    this.effects.explosion(playerPos, 0.8, { color: '#ff8c4b', smokeColor: '#51433f' });
    this.effects.screenShake(0.9, 0.5);
    this.invuln = .62;
    this.invulnFromDodge = false;
    this.energy = Math.max(0, this.energy - 12);
    const away = this.mech.root.position.clone().sub(this.monster.root.position).setY(0).normalize();
    this.mech.contactVelocity ||= new THREE.Vector3();
    this.mech.contactVelocity.addScaledVector(away,(['swipe','doubleClaw'].includes(kind)?8:18)/driveProfile(this.mech.config.id).mass);
    this.playerVel.multiplyScalar(0.2);
    this.ui.setLowHealth(this.hp <= 30);
    if (this.hp <= 0) this.defeat('mech');
  }

  cancelMonsterAttack() {
    this.monsterAttack = null;
    this.clearTelegraph();
    this.ui.hideWarning();
  }

  // ---------------------------------------------------------------- city attacks
  startCityAttack() {
    if (!this.city || !this.monster || !this.mech) return;
    const candidates = this.city.intactBuildings().filter((b) => b.h > 22 && Math.hypot(b.x - this.monster.root.position.x, b.z - this.monster.root.position.z) < 100);
    if (!candidates.length) {
      this.nextCityAttackAt = this.battleTime + 30;
      return;
    }
    const shelter=this.evacuation?.active?.building;
    const target = shelter && !shelter.destroyed && Math.hypot(shelter.x-this.monster.root.position.x,shelter.z-this.monster.root.position.z)<160 ? shelter : pick(candidates);
    this.cityAttack = {
      t: 0,
      duration: 3.1,
      impact: 2.15,
      building: target,
      resolved: false,
    };
    this.monster.playAction('enrage');
    this.monster.faceToward(target.x, target.z, 1);
    this.audio.roar(0.75);
    this.audio.warnBeep();
    this.ui.showWarning('熔岩抛射 · 城市目标', '蓄力期间造成 70 伤害可打断 · 炮击 / 导弹集中火力');
    this.createMeteor(target);
  }

  createMeteor(building) {
    this.clearMeteor();
    const start = new THREE.Vector3(building.x + rand(-28, 28), 165, building.z + rand(-28, 28));
    const end = new THREE.Vector3(building.x, Math.min(building.h * 0.65, 22), building.z);
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.4, 1),
      new THREE.MeshStandardMaterial({ color: '#33231b', roughness: .92, emissive: '#dc4b13', emissiveIntensity: 1.3 })
    );
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('#ff7a30'), color: '#ff7a30', transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    glow.scale.set(30, 30, 1);
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('#ffb266'), color: '#ffb266', transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    trail.scale.set(10, 34, 1);
    group.add(core, glow, trail);
    group.position.copy(start);
    this.scene.add(group);
    this.meteor = {
      group, start, end, t: 0, duration: 2.15, target: building,
      trailTimer: 0,
    };
  }

  updateCityAttack(dt) {
    if (this.state !== 'playing' || !this.cityAttack || !this.meteor) return;
    this.cityAttack.t += dt;
    const a = this.cityAttack;
    const m = this.meteor;
    m.t += dt;
    const p = clamp(m.t / m.duration);
    const ease = p * p;
    const pos = m.start.clone().lerp(m.end, ease);
    pos.x += Math.sin(p * Math.PI) * 10;
    pos.z += Math.cos(p * Math.PI * 1.2) * 6;
    m.group.position.copy(pos);
    m.group.rotation.x += dt * 2.4;
    m.group.rotation.y += dt * 1.9;
    m.trailTimer -= dt;
    if (m.trailTimer <= 0) {
      m.trailTimer = 0.06;
      this.effects.glowBurst(pos, '#ff8b3c', 11, 0.38, new THREE.Vector3(0, 2, 0), 0.38);
      this.effects.smokePuff(pos, 1, 1.2, '#5e4b42');
    }
    if (!a.resolved) {
      this.ui.setWarningProgress(1 - clamp(a.t / a.impact));
      if (a.t >= a.impact) {
        a.resolved = true;
        const b = a.building;
        if (b && !b.destroyed) {
          this.city.destroyBuilding(b, this.monster.root.position, false);
          this.effects.explosion(new THREE.Vector3(b.x, 8, b.z), 3.2, { color: '#ff8a3e' });
          this.effects.screenShake(1.1, 0.8);
          this.ui.flash('#ff914f', 0.28);
          this.audio.explosion(2);
          this.effects.scorch(new THREE.Vector3(b.x, 0, b.z), 18);
        }
        this.clearMeteor();
        this.ui.hideWarning();
      }
    }
    if (a.t >= a.duration) {
      this.cityAttack = null;
      this.clearMeteor();
      this.ui.hideWarning();
      this.nextCityAttackAt = this.battleTime + rand(18, 26) + (this.phase === 2 ? -5 : 0);
      this.nextMonsterAttackAt = this.battleTime + 1.8;
    }
  }

  clearMeteor() {
    if (this.meteor) {
      this.scene.remove(this.meteor.group);
      this.meteor.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
      this.meteor = null;
    }
  }

  // ---------------------------------------------------------------- telegraph
  showTelegraph(type, opts) {
    this.clearTelegraph();
    this.telegraph = createDangerDecal(type, opts);
    this.scene.add(this.telegraph.group);
  }

  updateTelegraph() {
    if (!this.telegraph) return;
    const { group, mat, follow, type } = this.telegraph;
    if (follow && this.monster) {
      group.position.set(this.monster.root.position.x, 0, this.monster.root.position.z);
      group.rotation.y = this.monster.root.rotation.y;
    }
    if (type === 'line' && this.monsterAttack) group.rotation.y = this.monsterAttack.lineAngle;
    const attack = this.monsterAttack;
    mat.uniforms.progress.value = attack ? clamp(attack.t / attack.impact) : 0;
  }

  clearTelegraph() {
    if (!this.telegraph) return;
    this.scene.remove(this.telegraph.group);
    this.telegraph.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const k of Object.keys(m)) if (m[k]?.isTexture && !m[k].userData.shared) m[k].dispose();
          m.dispose();
        }
      }
    });
    this.telegraph = null;
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    if (this.state === 'menu') {
      this.updateMenuCamera(dt);
      return;
    }
    if (this.state === 'intro') {
      // updateIntroCamera 已在 updateIntro 中调用
      return;
    }
    if (!this.mech || !this.monster) return;
    if (this.ultimateActive) {
      this.updateUltimateCamera(dt);
      return;
    }
    const p = this.mech.root.position;
    const m = this.monster.root.position;
    const speedBoost = clamp((this.lastMoveSpeed || 0) / RUN_SPEED, 0, 1);
    const fov = this.settings?.comfort ? 54 : 54 + speedBoost * 4;
    const {position: desired, target} = combatFrame(p, m, this.camera.aspect, fov);
    // 脚本相机给出基准位姿；鼠标环绕只叠加在它上面，不破坏战斗构图逻辑
    if (this.cameraSnap) {
      this.baseCameraPos.copy(desired);
      this.cameraTarget.copy(target);
    } else {
      this.baseCameraPos.lerp(desired, 1 - Math.exp(-4.6 * dt));
      this.cameraTarget.lerp(target, 1 - Math.exp(-5.5 * dt));
    }
    this.camera.position.copy(this.baseCameraPos);
    this.cameraSnap = false;
    this.setFov(fov);
    // 鼠标拖拽环绕 / 滚轮缩放；停手 3.2 秒后自动缓慢回到标准战斗构图
    this.mouseCamera?.apply(this.camera, this.cameraTarget, dt, true);
    updateCameraOcclusion(this.city, this.camera.position, [... [2,12,22].map(y=>p.clone().add(new THREE.Vector3(0,y,0))), ... [2,15,27].map(y=>m.clone().add(new THREE.Vector3(0,y,0)))], dt);
    this.camera.lookAt(this.cameraTarget);
    this.applyCameraShake();
    this.updateCameraRoll(dt);
  }

  updateUltimateCamera(dt) {
    const p = this.mech.root.position;
    const m = this.monster.root.position;
    const mid = p.clone().lerp(m, 0.52);
    const strike = easeInOutCubic(clamp((this.ultimateTimer - 1.0) / 0.55));
    const angle = Math.atan2(p.x - m.x, p.z - m.z) + 1.2 + strike * 0.22;
    const radius = lerp(50, 35, strike);
    const height = lerp(31, 18, strike);
    const desired = new THREE.Vector3(
      mid.x + Math.sin(angle) * radius,
      height,
      mid.z + Math.cos(angle) * radius
    );
    this.camera.position.lerp(desired, 1 - Math.exp(-3.8 * dt));
    this.cameraTarget.lerp(new THREE.Vector3(mid.x, lerp(8, 12, strike), mid.z), 1 - Math.exp(-4.2 * dt));
    this.setFov(lerp(45, 54, strike));
    this.camera.lookAt(this.cameraTarget);
    this.applyCameraShake();
  }

  updateCameraRoll(dt) {
    if (!this.effects || this.settings?.comfort) return;
    const targetRoll = this.effects.shakeX * 0.004;
    this.camera.rotateZ(targetRoll);
  }

  applyCameraShake() {
    if (!this.effects || this.settings?.comfort) return;
    const shake = this.effects;
    if (!shake.shakeX && !shake.shakeY) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(right, shake.shakeX * 0.55);
    this.camera.position.addScaledVector(up, shake.shakeY * 0.45);
    this.camera.rotateZ(shake.shakeX * 0.002);
  }

  setFov(fov) {
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, fov, 5, 1 / 60);
      this.camera.updateProjectionMatrix();
    }
  }

  // ---------------------------------------------------------------- outcome
  victory() {
    if (this.state !== 'playing') return;
    this.evacuation?.secure();
    this.state = 'victory';
    this.outcomeWin = true;
    this.jetState = null; this.mech.root.position.y = 0;
    this.outcomeTimer = 0;
    this.outcomeDuration = 4.8;
    this.ultimateActive = false;
    this.ui.setUltimateCinematic(false);
    this.playerBusy = 'outcome';
    this.cancelMonsterAttack();
    if (this.cityAttack) {
      this.clearMeteor();
      this.cityAttack = null;
    }
    this.ui.hideWarning();
    this.ui.hideHint();
    this.ui.setCombo(this.combo);
    this.ui.setLowHealth(false);
    this.mech.victory();
    this.monster.die();
    this.audio.stopMusic(1.4);
    this.audio.victory();
    this.cameraMode = 'victory';
    this.ui.hideOverhead();
    this.timeScale = 0.35;
    this.effects.slowMo = true;
    this.ui.flash('#d9feff', 0.28);
    this.ui.toast('巨兽核心停止活动', '', 3000);
    this.ui.el.lockOn.classList.add('hidden');
    setTimeout(() => {
      if (this.state === 'victory') {
        this.audio.megaExplosion();
        this.effects.explosion(this.monster.getChestWorld(new THREE.Vector3()), 3.4, { color: '#ffb15a', smokeColor: '#7f6b5e' });
        this.effects.screenShake(1.4, 1);
      }
    }, 900);
  }

  defeat(reason = 'mech') {
    if (this.state !== 'playing') return;
    this.defeatReason = reason;
    this.state = 'defeat';
    this.outcomeWin = false;
    this.jetState = null;
    if (this.mech) this.mech.root.position.y = 0;
    this.outcomeTimer = 0;
    this.outcomeDuration = 4.5;
    this.ultimateActive = false;
    this.ui.setUltimateCinematic(false);
    this.playerBusy = 'outcome';
    this.cancelMonsterAttack();
    if (this.cityAttack) {
      this.clearMeteor();
      this.cityAttack = null;
    }
    this.ui.hideWarning();
    this.ui.hideHint();
    this.ui.setLowHealth(true);
    this.mech.die();
    this.audio.stopMusic(1.4);
    this.audio.defeat();
    this.audio.megaExplosion();
    this.cameraMode = 'defeat';
    this.ui.hideOverhead();
    this.timeScale = 0.42;
    this.effects.screenShake(1.2, 1.2);
    this.ui.flash('#ff3b45', 0.4);
    this.ui.toast(reason === 'city' ? '城市完整度归零 · 防线崩溃' : 'RX-09 装甲失效', 'warn', 3000);
    this.ui.el.lockOn.classList.add('hidden');
    this.monster.playAction('roar');
  }

  updateOutcome(dt) {
    this.audio.setThrust(0);
    const gameDt = dt * (this.timeScale || 1);
    this.city.update(gameDt * 0.45, this.time);
    this.environment.update(dt, this.time);
    this.effects.update(dt, this.time);
    this.monster.faceToward(this.mech.root.position.x, this.mech.root.position.z, gameDt);
    this.monster.update(gameDt, this.time, { target: this.mech.root.position, speed: 0 });
    this.mech.update(gameDt, this.time, { speed: 0, running: false });
    updateJetRig(this.mech, gameDt, this.time, this.effects);
    this.mech.weaponRig.group.visible = false;
    this.outcomeTimer += dt;
    this.timeScale = damp(this.timeScale, 1, 0.8, dt);
    const p = clamp(this.outcomeTimer / this.outcomeDuration);
    if (this.outcomeWin) {
      const mid = this.mech.root.position.clone().lerp(this.monster.root.position, 0.45);
      const angle = this.time * 0.12 - 0.6;
      const r = lerp(48, 33, easeOutCubic(p));
      this.camera.position.lerp(new THREE.Vector3(mid.x + Math.sin(angle) * r, lerp(28, 15, p), mid.z + Math.cos(angle) * r), 1 - Math.exp(-1.7 * dt));
      this.cameraTarget.lerp(new THREE.Vector3(mid.x, 8, mid.z), 1 - Math.exp(-2.5 * dt));
    } else {
      const target = this.mech.root.position.clone().add(new THREE.Vector3(0, 4, 0));
      const angle = -0.9;
      const r = lerp(35, 24, p);
      this.camera.position.lerp(new THREE.Vector3(target.x + Math.sin(angle) * r, lerp(14, 7, p), target.z + Math.cos(angle) * r), 1 - Math.exp(-1.8 * dt));
      this.cameraTarget.lerp(target, 1 - Math.exp(-2.6 * dt));
    }
    this.setFov(this.outcomeWin ? 44 : 50);
    this.camera.lookAt(this.cameraTarget);
    this.applyCameraShake();
    this.updateHUD();
    if (this.outcomeTimer >= this.outcomeDuration) this.showResult();
  }

  showResult() {
    if (this.state === 'result') return;
    this.state = 'result';
    const stats = {
      time: this.battleTime,
      maxCombo: this.maxCombo,
      damage: this.damageDealt,
      buildings: this.city?.destroyedCount ?? 0,
      city: this.getCityIntegrity(),
      hits: this.hitsTaken,
      saved: this.evacuation?.saved || 0,
      lost: this.evacuation?.lost || 0,
      parries: this.perfectGuards,
      reason: this.defeatReason,
      difficulty: this.encounterDifficulty,
    };
    const record=recordBattle(window.localStorage,stats,this.outcomeWin);
    this.ui.showResult(this.outcomeWin, {...stats,record});
    this.ui.setCombo(0);
    this.ui.hideHint();
    this.ui.setUltimateCinematic(false);
    this.timeScale = 1;
    this.audio.stopMusic(1.2);
  }

  updateResult(dt) {
    this.environment.update(dt, this.time);
    this.effects.update(dt, this.time);
    if (this.outcomeWin) {
      const mid = this.mech.root.position.clone().lerp(this.monster.root.position, 0.45);
      const angle = this.time * 0.09 - 0.4;
      const r = 33 + Math.sin(this.time * 0.2) * 2;
      this.camera.position.lerp(new THREE.Vector3(mid.x + Math.sin(angle) * r, 16, mid.z + Math.cos(angle) * r), 1 - Math.exp(-0.6 * dt));
      this.cameraTarget.lerp(new THREE.Vector3(mid.x, 8, mid.z), 1 - Math.exp(-1.2 * dt));
      this.camera.lookAt(this.cameraTarget);
    }
  }

  updatePoseUI(dt) {
    if (!this.hasCamera) return;
    if (!this.ui.el.hud.classList.contains('hidden') && this.time - this.lastPoseUI > 0.1) {
      this.lastPoseUI = this.time;
      this.ui.updateCamera(this.poseState, this.poseQuality, this.poseFullBody, this.poseVisible);
    }
  }

  // ---------------------------------------------------------------- pause/menu/restart
  pauseGame() {
    if (this.state !== 'playing') return;
    this.mouseCamera?.cancel();
    this.state = 'paused';
    this.audio.setThrust(0);
    this.ui.showPause(true);
    this.audio.setPaused(true);
    this.keyboard.reset();
    this.pose.clearEvents();
    this.mech.guard(false);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    if(this.motionPaused&&this.inputMode==='pose'&&!this.pose.getState().controlReady){
      this.ui.toast('请回到画面中央，等待玩家锁定与校准完成','warn');return;
    }
    this.motionPaused=false;this.motionLossTime=0;
    this.state = 'playing';
    this.ui.closeHelp();
    this.ui.showPause(false);
    this.audio.setPaused(false);
    this.keyboard.reset();
    this.pose.clearEvents();
    this.cameraSnap = false;
  }

  togglePause() {
    if (this.state === 'playing') this.pauseGame();
    else if (this.state === 'paused') this.resumeGame();
  }

  openHelp() {
    if (this.state === 'playing') this.pauseGame();
    if (this.state === 'paused') {
      this.ui.openHelp('pause');
      this.helpOpen = true;
      this.audio.setPaused(true);
    }
  }

  closeHelp() {
    this.ui.closeHelp();
    this.helpOpen = false;
    this.audio.setPaused(this.state === 'paused');
  }

  restartRun() {
    if (this.transitioning) return;
    if (this.state === 'result' || this.state === 'paused') {
      this.ui.showPause(false);
      this.ui.closeHelp?.();
      this.ui.hideResult();
      return this.beginRun();
    }
  }

  quitToMenu() {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      this.audio.stopMusic(0.5);
      this.audio.setPaused(false);
      this.ui.showPause(false);
      this.ui.closeHelp?.();
      this.ui.hideResult();
      this.ui.hideCinematic();
      this.ui.hideHud();
      this.ui.setUltimateCinematic(false);
      this.ui.clearTransient();
      this.clearRun();
      this.city = new City(this.scene, { seed: 9317, onBuildingDestroyed: (b) => this.onBuildingDestroyed(b) });
      this.decorateCity(this.city);
      this.spawnHangarMech();
      this.effects.clear();
      this.environment.setBattleMood(0);
      this.cameraMode = 'menu';
      this.cameraSnap = true;
      this.menuAngle = 1.02 + Math.random() * 0.2;
      this.state = 'menu';
      this.hasCamera = false;
      this.inputMode = 'keyboard';
      this.keyboard.reset();
      this.pose.clearEvents();
      this.ui.showMenu();
    } finally {
      this.transitioning = false;
    }
  }

  // ---------------------------------------------------------------- debug helpers
  debugSkipIntro() {
    if (this.state === 'intro') this.skipIntro();
  }

  debugWin() {
    if (this.state === 'playing') {
      this.monster.health = 0;
      this.victory();
    }
  }

  debugDamage(amount) {
    if (this.state === 'playing') this.damageMonster(amount, { source: 'debug' });
  }

  debugPoseKick() {
    const state = this.pose.getState();
    this.handlePlayerAction({ type: 'punch', side: 'left' });
  }

  dispose() {
    this.mouseCamera?.destroy();
    this.keyboard.dispose();
    this.pose.dispose();
    this.clearRun();
    this.effects.dispose();
  }
}
