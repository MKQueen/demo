import { clamp, formatTime, worldToScreen } from './utils.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      boot: $('boot'),
      bootProgress: $('boot-progress'),
      bootStatus: $('boot-status'),
      menu: $('menu'),
      setup: $('setup'),
      setupVideo: $('setup-video'),
      setupSkeleton: $('setup-skeleton'),
      gameVideo: $('game-video'),
      gameSkeleton: $('game-skeleton'),
      setupLoading: $('setup-loading'),
      setupLoadingText: $('setup-loading-text'),
      setupSignal: $('setup-signal'),
      setupSignalText: $('setup-signal-text'),
      qualityBar: $('quality-bar'),
      qualityLabel: $('quality-label'),
      setupError: $('setup-error'),
      activateBtn: $('btn-activate'),
      activateSub: $('activate-sub'),
      cinematic: $('cinematic'),
      cineCaption: $('cine-caption'),
      hud: $('hud'),
      hpFill: $('mech-hp-fill'),
      hpText: $('mech-hp-text'),
      energyFill: $('mech-energy-fill'),
      energyText: $('mech-energy-text'),
      playerFrame: document.querySelector('.player-frame'),
      bossFill: $('boss-hp-fill'),
      bossHpLag: $('boss-hp-lag'),
      bossText: $('boss-hp-text'),
      bossPhase: $('boss-phase'),
      bossStaggerFill: $('boss-stagger-fill'),
      bossOverhead: $('boss-overhead'),
      overheadHpFill: $('overhead-hp-fill'),
      overheadHpText: $('overhead-hp-text'),
      overheadPhase: $('overhead-phase'),
      overheadStaggerFill: $('overhead-stagger-fill'),
      phaseCutin: $('phase-cutin'),
      breakBanner: $('break-banner'),
      cityIntegrity: $('city-integrity'),
      cityFill: $('city-fill'),
      cityLosses: $('city-losses'),
      battleTime: $('battle-time'),
      lockOn: $('lock-on'),
      lockDist: $('lock-dist'),
      warning: $('warning-banner'),
      warningTitle: $('warning-title'),
      warningSub: $('warning-sub'),
      warningTimer: $('warning-timer-fill'),
      combo: $('combo'),
      comboNum: $('combo-num'),
      comboRank: $('combo-rank'),
      cameraPanel: $('camera-panel'),
      camState: $('cam-state'),
      camNoDetect: $('cam-nodetect'),
      gestureState: $('gesture-state'),
      camQuality: $('cam-quality'),
      hint: $('hint'),
      hintKey: $('hint-key'),
      hintTitle: $('hint-title'),
      hintSub: $('hint-sub'),
      moveState: $('move-state'),
      jetFuelFill: $('jet-fuel-fill'), jetFuelText: $('jet-fuel-text'), jetStatus: $('jet-status'), jetReadout: document.querySelector('.jet-readout'),
      speedPips: document.querySelectorAll('.speed-pips i'),
      skillPunch: $('skill-punch'),
      skillBlast: $('skill-blast'),
      skillMissile: $('skill-missile'),
      skillBlade: $('skill-blade'),
      skillBlock: $('skill-block'),
      skillUltimate: $('skill-ultimate'),
      blastCd: $('blast-cd'),
      missileCd: $('missile-cd'),
      bladeCd: $('blade-cd'),
      hitMarker: $('hit-marker'),
      hitFlash: $('hit-flash'),
      ultCd: $('ult-cd'),
      ultimateCinematic: $('ultimate-cinematic'),
      damageLayer: $('damage-layer'),
      feed: $('kill-feed'),
      pause: $('pause'),
      help: $('help'),
      result: $('result'),
      toast: $('toast'),
      flash: $('flash'),
      hitFx: $('hit-fx'),
      systemError: $('system-error'),
      resultTitle: $('result-title'),
      resultSub: $('result-sub'),
      resultLetter: $('result-letter'),
      resultOverline: $('result-overline'),
      statTime: $('stat-time'),
      statCombo: $('stat-combo'),
      statDamage: $('stat-damage'),
      statBuildings: $('stat-buildings'),
      statCity: $('stat-city'),
      statHits: $('stat-hits'),
      btnSound: $('btn-sound'),
      hudSound: $('btn-hud-sound'),
      camPanel: $('camera-panel'),
    };
    this.helpReturn = 'menu';
    this.soundOn = true;
    this.damageItems = [];
    this.damagePool = [];
    this.lastHud = {};
    this.lastCombo = 0;
    this.toastTimer = 0;
    this.flashTimer = 0;
    this.hitTimer = 0;
    this.lastWarning = '';
    this.lastGesture = '';
    this.overheadVisible = false;
    this.phaseTimer = 0;
    this.breakTimer = 0;
    this.lastOverhead = {};
    this.cinematicTimer = 0;
    this._initDamagePool(28);
  }

  _initDamagePool(count) {
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      d.className = 'dmg-number';
      d.style.opacity = '0';
      d.innerHTML = '<span class="num"></span><span class="tag"></span>';
      this.el.damageLayer.appendChild(d);
      this.damagePool.push({ el: d, active: false, world: null, life: 0, maxLife: 1, vy: 0, offset: 0, numEl: d.children[0], tagEl: d.children[1] });
    }
  }

  bind(handlers) {
    const on = (id, ev, fn) => {
      const node = $(id);
      if (node) node.addEventListener(ev, fn);
    };
    on('btn-camera', 'click', handlers.onCamera);
    on('btn-keyboard', 'click', handlers.onKeyboard);
    on('btn-setup-keyboard', 'click', handlers.onKeyboard);
    on('btn-close-setup', 'click', handlers.onCloseSetup);
    on('btn-activate', 'click', handlers.onActivate);
    on('btn-retrack', 'click', handlers.onRetrack);
    on('btn-retrack-game', 'click', handlers.onRetrack);
    on('btn-skip-intro', 'click', handlers.onSkipIntro);
    on('btn-hud-sound', 'click', handlers.onSound);
    on('btn-help', 'click', handlers.onHelp);
    on('btn-help-pause', 'click', handlers.onHelp);
    on('btn-close-help', 'click', handlers.onCloseHelp);
    on('btn-pause', 'click', handlers.onPause);
    on('btn-resume', 'click', handlers.onResume);
    on('btn-restart-pause', 'click', handlers.onRestart);
    on('btn-quit', 'click', handlers.onQuit);
    on('btn-restart', 'click', handlers.onRestart);
    on('btn-menu', 'click', handlers.onQuit);
    on('btn-sound', 'click', handlers.onSound);
    on('btn-fullscreen', 'click', handlers.onFullscreen);
  }

  initSettings(settings,onChange,onClose) {
    const dialog=$('game-settings');
    const controls=dialog.querySelectorAll('[data-setting]');
    for(const input of controls){
      const key=input.dataset.setting;
      if(input.type==='checkbox')input.checked=settings[key];else input.value=settings[key];
      input.addEventListener('change',()=>{
        const next={};for(const node of controls)next[node.dataset.setting]=node.type==='checkbox'?node.checked:node.type==='range'?Number(node.value):node.value;
        onChange(next);
      });
    }
    for(const id of ['btn-settings','btn-settings-pause'])$(id).addEventListener('click',()=>{this.onSettingsOpen?.();dialog.showModal();});
    $('btn-settings-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>onClose());
  }

  initHangar(roster, selected, onSelect) {
    const node = document.getElementById('hangar-roster');
    const draw = id => {
      node.innerHTML = roster.map(m => `<button type="button" class="hangar-card ${m.id === id ? 'selected' : ''}" data-mech="${m.id}" aria-pressed="${m.id === id}" style="--mech-accent:${m.color}"><span class="hangar-serial">${m.serial}<i>${m.id === id ? '已装载' : '选择'}</i></span><strong>${m.name}<em>${m.role}</em></strong><small>${m.equipment}</small><span class="hangar-bars">${['防护', '机动', '火力'].map((label, i) => `<span>${label}<b><i style="width:${m.stats[i]}%"></i></b></span>`).join('')}</span></button>`).join('');
      document.getElementById('hangar-description').textContent = roster.find(m => m.id === id).description;
    };
    draw(selected);
    node.addEventListener('click', e => { const card = e.target.closest('[data-mech]'); if (card) { onSelect(card.dataset.mech); draw(card.dataset.mech); } });
  }

  setSound(on) {
    this.soundOn = on;
    if (this.el.btnSound) this.el.btnSound.textContent = `SOUND: ${on ? 'ON' : 'OFF'}`;
    if (this.el.hudSound) {
      this.el.hudSound.textContent = on ? 'SND' : 'MUTE';
      this.el.hudSound.classList.toggle('muted', !on);
      this.el.hudSound.title = on ? '关闭声音' : '开启声音';
    }
  }

  setBootProgress(p, text) {
    this.el.bootProgress.style.width = `${clamp(p * 100, 2, 100)}%`;
    if (text) this.el.bootStatus.textContent = text;
  }

  finishBoot() {
    this.el.boot.classList.add('done');
    setTimeout(() => this.el.boot.classList.add('hidden'), 800);
  }

  showMenu() {
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.setup.classList.add('hidden');
    this.el.cinematic.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.help.classList.add('hidden');
    this.el.result.classList.add('hidden');
    this.el.cameraPanel.classList.add('hidden');
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
  }

  openSetup() {
    this.el.setup.classList.remove('hidden');
    this.el.setupError.classList.add('hidden');
    this.el.activateBtn.disabled = true;
    this.el.activateSub.textContent = '等待体感链路';
    this.el.setupLoading.classList.remove('done');
    this.el.setupLoadingText.textContent = '正在请求摄像头…';
    this.el.setupSignal.className = '';
    this.el.setupSignalText.textContent = 'WAITING FOR SIGNAL';
    this.el.qualityBar.style.width = '0%';
    this.el.qualityLabel.textContent = '—';
    const steps = this.el.setup.querySelectorAll('.setup-step');
    steps.forEach((s) => s.classList.remove('active', 'done'));
    steps[0]?.classList.add('active');
  }

  closeSetup() {
    this.el.setup.classList.add('hidden');
  }

  setupStatus(text) {
    this.el.setupLoadingText.textContent = text;
    if (!this.el.setupLoading.classList.contains('done')) {
      this.el.setupLoading.classList.remove('hidden');
    }
  }

  setupReady(delegate) {
    this.el.setupLoading.classList.add('done');
    this.el.activateBtn.disabled = true;
    this.el.activateSub.textContent = '请站在中央，等待锁定与校准';
    this.el.setupSignal.className = '';
    this.el.setupSignalText.textContent = '等待玩家锁定';
  }

  setupQuality(info) {
    const q = info.quality ?? 0;
    const pct = Math.round(clamp(q) * 100);
    this.el.qualityBar.style.width = `${pct}%`;
    this.el.qualityLabel.textContent = pct > 0 ? `${pct}%` : '—';
    const steps = this.el.setup.querySelectorAll('.setup-step');
    const phase=info.state?.tracking?.phase||'searching';
    const locked=['tracked','calibrating','active','skeleton-lost'].includes(phase);
    const skeleton=info.state?.skeletonVisible||info.state?.controlReady;
    const ready=info.state?.controlReady===true;
    [locked,skeleton,ready].forEach((done,i)=>{
      steps[i]?.classList.toggle('done',!!done);
      steps[i]?.classList.toggle('active',!done&&(i===0||[locked,skeleton][i-1]));
    });
    const messages={searching:'请站到画面中央',acquiring:'发现人物，正在确认玩家',tracked:'玩家已锁定，正在识别骨骼',calibrating:`请站定校准 ${Math.round((info.state?.calibration||0)*100)}%`,active:info.fullBody?'全身体感已就绪':'半身体感已就绪',lost:'玩家丢失，请回到原位置','skeleton-lost':'请露出头肩和双手',stale:'画面中断，等待恢复'};
    const message=messages[phase]||'追踪暂时中断，请重新锁定';
    this.el.activateBtn.disabled=!ready;
    this.el.activateSub.textContent=message;
    this.el.setupSignal.className=ready?'ok':locked?'warn':'';
    this.el.setupSignalText.textContent=message;
    const metrics=document.getElementById('tracking-metrics');
    if(metrics)metrics.textContent=`画面人物 ${info.state?.tracking?.personCount??0} · ${locked?'已锁定玩家':'等待锁定'} · 推理 ${Math.round(info.inferenceMs||0)} ms`;
  }

  setupError(message) {
    this.el.setupError.textContent = message;
    this.el.setupError.classList.remove('hidden');
    this.el.setupLoading.classList.add('done');
    this.el.activateBtn.disabled = true;
    this.el.activateSub.textContent = '摄像头体感不可用';
    this.el.setupSignal.className = 'warn';
    this.el.setupSignalText.textContent = 'SIGNAL ERROR';
  }

  showHud(hasCamera) {
    this.el.hud.classList.remove('hidden');
    this.el.cameraPanel.classList.toggle('hidden', !hasCamera);
    const labels = hasCamera ? ['交替出拳', '双掌前推 · 30 EN', '双臂张开 / R · 20 EN', '单臂高举 / F · 20 EN', '双手护胸', '双手高举 · 100 EN']
      : ['J / K · 三连击', 'L · 30 EN', 'R · 20 EN', 'F · 20 EN', 'Space · 防御', 'U · 100 EN'];
    document.querySelectorAll('.skill-dock .skill small').forEach((el, i) => { el.textContent = labels[i]; });
  }

  hideHud() {
    this.el.hud.classList.add('hidden');
  }

  updateMission(mission, camera, monster, cityAttack) {
    const node=$('mission-status'),marker=$('mission-waypoint');
    if(!node || !mission)return;
    const active=mission.active;
    const remaining=active?Math.ceil(mission.required-active.progress):0;
    node.textContent=active
      ? `撤离 ${mission.saved}/300 · ${active.name} ${mission.blocked?'受威胁 · 引开巨兽':`剩余 ${remaining}s`} · 抛射可集火打断`
      : `撤离结束 · 获救 ${mission.saved}/300 · 消灭巨兽`;
    node.classList.toggle('threatened',mission.blocked);
    marker.classList.toggle('hidden',!active);
    if(active){
      const p=monster.root.position.clone().set(active.building.x,active.building.h+3,active.building.z);
      const projected=p.project(camera);
      const behind=projected.z>1;
      const x=clamp((behind?-projected.x:projected.x)*.5+.5,.08,.92);
      const y=clamp((behind?projected.y:-projected.y)*.5+.5,.24,.72);
      marker.style.left=`${x*100}%`;marker.style.top=`${y*100}%`;
      marker.textContent=`◇ ${active.name}撤离点${cityAttack?.building===active.building?' · 遭锁定':''}`;
      marker.classList.toggle('offscreen',behind||Math.abs(projected.x)>1||Math.abs(projected.y)>1);
    }
  }

  updateHud(dt, data) {
    const e = this.el;
    const callout = document.getElementById('skill-callout');
    const casts = { blast: ['等离子炮', '蓄能', '炮口释放'], missile: ['肩部导弹', '锁定', '齐射'], blade: ['等离子长刃', '展刃', '横斩'], ultimate: ['天基打击', '信标锁定', '轨道火力'] };
    const cast = casts[data.action];
    callout.classList.toggle('hidden', !cast);
    if (cast) callout.textContent = `${cast[0]} / ${cast[data.actionProgress < .4 ? 1 : 2]}`;
    const intent=document.getElementById('boss-intent');
    intent.textContent=data.bossIntent || '';
    intent.classList.toggle('opening',!!data.bossOpening);
    const hp = Math.max(0, Math.round(data.hp));
    const energy = Math.round(data.energy);
    e.jetFuelFill.style.width = `${Math.round(data.jetFuel ?? 100)}%`;
    e.jetFuelText.textContent = Math.round(data.jetFuel ?? 100);
    e.jetStatus.textContent = data.jetActive ? '空中机动 · 松开 V 降落' : data.jetCooldown > 0 ? '推进器冷却中' : 'Q / E 喷气闪避 · V 短飞';
    e.jetReadout.classList.toggle('active', !!data.jetActive);
    if (this.lastHud.hp !== hp) {
      e.hpFill.style.width = `${clamp(hp, 0, 100)}%`;
      e.hpText.textContent = String(hp);
      e.playerFrame.classList.toggle('low', hp <= 30);
      this.lastHud.hp = hp;
    }
    if (this.lastHud.energy !== energy) {
      e.energyFill.style.width = `${clamp(energy, 0, 100)}%`;
      e.energyText.textContent = String(energy);
      e.skillUltimate.classList.toggle('ready', energy >= 100);
      e.skillUltimate.classList.toggle('disabled', energy < 100);
      e.skillMissile.classList.toggle('disabled', energy < 20);
      e.skillBlade.classList.toggle('disabled', energy < 20);
      this.lastHud.energy = energy;
    }
    const bossPct = clamp(data.bossHp / data.bossMax) * 100;
    if (this.lastHud.boss !== bossPct.toFixed(1)) {
      e.bossFill.style.width = `${bossPct}%`;
      if (e.bossHpLag) e.bossHpLag.style.width = `${bossPct}%`;
      e.bossText.textContent = `${bossPct.toFixed(1)}%`;
      this.lastHud.boss = bossPct.toFixed(1);
    }
    if (this.lastHud.phase !== data.phase) {
      e.bossPhase.textContent = data.phase;
      this.lastHud.phase = data.phase;
    }
    const stagger = clamp(data.bossStagger ?? 0, 0, 100);
    if (this.lastHud.stagger !== stagger.toFixed(0)) {
      e.bossStaggerFill.style.width = `${stagger}%`;
      this.lastHud.stagger = stagger.toFixed(0);
      e.bossStaggerFill.classList.toggle('charged', stagger >= 80);
    }
    const city = Math.max(0, Math.round(data.city));
    if (this.lastHud.city !== city) {
      e.cityIntegrity.textContent = String(city);
      e.cityFill.style.width = `${city}%`;
      this.lastHud.city = city;
    }
    if (this.lastHud.losses !== data.losses) {
      e.cityLosses.textContent = String(data.losses);
      this.lastHud.losses = data.losses;
    }
    const time = formatTime(data.time);
    if (this.lastHud.time !== time) {
      e.battleTime.textContent = time;
      this.lastHud.time = time;
    }
    e.blastCd.style.width = `${clamp(1 - (data.blastCooldown ?? 0)) * 100}%`;
    if (e.missileCd) e.missileCd.style.width = `${clamp(1 - (data.missileCooldown ?? 0)) * 100}%`;
    if (e.bladeCd) e.bladeCd.style.width = `${clamp(1 - (data.bladeCooldown ?? 0)) * 100}%`;
    e.ultCd.style.width = `${energy}%`;
    e.skillBlast.classList.toggle('disabled', data.energy < 30 || data.blastCooldown > 0);
    e.skillMissile.classList.toggle('disabled', data.energy < 20 || data.missileCooldown > 0);
    e.skillBlade.classList.toggle('disabled', data.energy < 20 || data.bladeCooldown > 0);
    e.skillBlast.classList.toggle('active', data.action === 'blast');
    if (data.mechName) document.getElementById('hud-mech-name').textContent = data.mechName;
    e.skillBlock.classList.toggle('active', data.blocking);
    e.skillPunch.classList.toggle('active', data.punching);
    e.skillMissile.classList.toggle('active', !!data.missileActive);
    e.skillBlade.classList.toggle('active', !!data.bladeActive);
    e.skillUltimate.classList.toggle('active', data.ultimateActive);
    if (data.jetActive) {
      e.moveState.textContent = '喷气悬飞';
    } else if (data.move || data.running) {
      e.moveState.textContent = data.ultimateActive ? '必杀' : data.running ? '奔跑' : '行军';
    } else if (data.blocking) {
      e.moveState.textContent = '防御';
    } else {
      e.moveState.textContent = '待机';
    }
    const pips = data.moveLevel ?? 0;
    e.speedPips.forEach((p, i) => p.classList.toggle('on', i < pips));
  }

  setCombo(count) {
    const e = this.el;
    if (count > 0) {
      e.combo.classList.add('show');
      if (count !== this.lastCombo) {
        e.comboNum.textContent = String(count);
        e.combo.classList.remove('bump');
        void e.combo.offsetWidth;
        e.combo.classList.add('bump');
        e.comboRank.textContent = count >= 20 ? '毁灭级连击' : count >= 10 ? '压制' : count >= 5 ? '连击上升' : '保持连击';
      }
    } else {
      e.combo.classList.remove('show');
    }
    this.lastCombo = count;
  }

  showWarning(title, sub) {
    const key = title + sub;
    if (this.lastWarning !== key) {
      this.el.warningTitle.textContent = title;
      this.el.warningSub.textContent = sub;
      this.lastWarning = key;
    }
    this.el.warning.classList.add('show');
    this.el.warningTimer.style.width = '100%';
  }

  setWarningProgress(p) {
    this.el.warningTimer.style.width = `${clamp(p) * 100}%`;
  }

  hideWarning() {
    this.el.warning.classList.remove('show');
    this.lastWarning = '';
  }

  setLockOn(pos, camera, distance, active) {
    if (!active || !pos) {
      this.el.lockOn.classList.add('hidden');
      return;
    }
    const p = worldToScreen(pos, camera, window.innerWidth, window.innerHeight);
    if (!p.visible) {
      this.el.lockOn.classList.add('hidden');
      return;
    }
    this.el.lockOn.classList.remove('hidden');
    this.el.lockOn.style.left = `${p.x}px`;
    this.el.lockOn.style.top = `${p.y}px`;
    this.el.lockDist.textContent = `${Math.round(distance)} m`;
  }

  lockOnHit() {
    const el = this.el.lockOn;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  setUltimateCinematic(show) {
    this.el.ultimateCinematic.classList.toggle('hidden', !show);
  }

  updateOverhead(data) {
    const e = this.el;
    if (!data || !data.screen || data.screen.y < 236 || data.screen.y > window.innerHeight - 114 || data.screen.x < 80 || data.screen.x > window.innerWidth - 80) {
      e.bossOverhead.classList.add('hidden');
      this.overheadVisible = false;
      return;
    }
    e.bossOverhead.classList.remove('hidden');
    this.overheadVisible = true;
    e.bossOverhead.style.left = `${data.screen.x}px`;
    e.bossOverhead.style.top = `${data.screen.y}px`;
    const hpPct = clamp(data.hp / data.max) * 100;
    const key = `${hpPct.toFixed(1)}-${data.phase}-${data.stagger.toFixed(0)}`;
    if (this.lastOverhead.key !== key) {
      this.lastOverhead.key = key;
      e.overheadHpFill.style.width = `${hpPct}%`;
      e.overheadHpText.textContent = `${hpPct.toFixed(0)}%`;
      e.overheadPhase.textContent = data.phase === 2 ? 'PHASE 2' : 'PHASE 1';
      e.overheadStaggerFill.style.width = `${clamp(data.stagger, 0, 100)}%`;
      e.bossOverhead.classList.toggle('phase2', data.phase === 2);
    }
  }

  hideOverhead() {
    this.el.bossOverhead.classList.add('hidden');
    this.overheadVisible = false;
  }

  screenHit(crit = false) {
    const e = this.el.hitFlash;
    if (!e) return;
    e.classList.remove('show', 'crit');
    void e.offsetWidth;
    e.classList.toggle('crit', !!crit);
    e.classList.add('show');
    clearTimeout(this.hitFlashTimer);
    this.hitFlashTimer = setTimeout(() => e.classList.remove('show'), 200);
  }

  hitMarker(crit = false) {
    const e = this.el.hitMarker;
    if (!e) return;
    e.classList.remove('show');
    void e.offsetWidth;
    e.classList.toggle('crit', !!crit);
    e.classList.add('show');
    clearTimeout(this.hitMarkerTimer);
    this.hitMarkerTimer = setTimeout(() => e.classList.remove('show'), 420);
  }

  showPhaseCutin() {
    const e = this.el.phaseCutin;
    e.classList.remove('hidden');
    e.classList.remove('show');
    void e.offsetWidth;
    e.classList.add('show');
    clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => {
      e.classList.remove('show');
      this.phaseTimer = setTimeout(() => e.classList.add('hidden'), 500);
    }, 2200);
  }

  showBreak() {
    const e = this.el.breakBanner;
    e.classList.remove('hidden');
    e.classList.remove('show');
    void e.offsetWidth;
    e.classList.add('show');
    clearTimeout(this.breakTimer);
    this.breakTimer = setTimeout(() => {
      e.classList.remove('show');
      this.breakTimer = setTimeout(() => e.classList.add('hidden'), 450);
    }, 1400);
  }

  updateCamera(poseState, quality, fullBody, visible) {
    const e = this.el;
    if (!e.cameraPanel || e.cameraPanel.classList.contains('hidden')) return;
    const lost = !visible || quality < 0.15;
    e.camState.textContent = poseState?.tracking?.phase==='calibrating'?'校准中':lost?'追踪中断':'玩家已锁定';
    e.camState.classList.toggle('lost', lost);
    e.camNoDetect.classList.toggle('show', lost);
    e.camQuality.textContent = `${Math.round((quality || 0) * 100)}%`;
    let gesture = poseState?.gesture || '待机';
    if (poseState?.blocking) gesture = '防御';
    if (poseState?.ultimateCharge > 0) gesture = `必杀蓄力 ${Math.round(poseState.ultimateCharge * 100)}%`;
    if (gesture !== this.lastGesture) {
      e.gestureState.textContent = gesture;
      this.lastGesture = gesture;
    }
  }

  updatePoseBadge(text) {
    if (this.el.gestureState.textContent !== text) this.el.gestureState.textContent = text;
  }

  setHint(key, title, sub, visible = true) {
    if (this.el.hintTitle.textContent !== title) {
      this.el.hintKey.textContent = key;
      this.el.hintTitle.textContent = title;
      this.el.hintSub.textContent = sub;
    }
    this.el.hint.classList.toggle('fade', !visible);
  }

  hideHint() {
    this.el.hint.classList.add('fade');
  }

  spawnDamage(world, value, opts = {}) {
    let item = this.damagePool.find((d) => !d.active);
    if (!item) item = this.damagePool[0];
    item.active = true;
    item.world = world.clone ? world.clone() : { ...world };
    item.life = opts.life ?? 0.9;
    item.maxLife = item.life;
    item.offset = 0;
    item.el.style.opacity = '1';
    item.el.classList.toggle('crit', !!opts.crit);
    item.el.classList.toggle('heal', !!opts.heal);
    item.numEl.textContent = typeof value === 'number' ? `${opts.prefix || ''}${Math.round(value)}` : value;
    item.tagEl.textContent = opts.label || (opts.crit ? 'CRITICAL' : '');
    item.el.style.fontSize = '';
    item.active = true;
    item.numEl.style.opacity = '1';
    item.tagEl.style.opacity = '1';
    return item;
  }

  updateDamage(camera, dt) {
    for (const item of this.damagePool) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.el.style.opacity = '0';
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const p = worldToScreen(item.world, camera, window.innerWidth, window.innerHeight);
      if (!p.visible) {
        item.el.style.opacity = '0';
        continue;
      }
      const rise = t * 55;
      item.el.style.opacity = String(Math.min(1, item.life * 3.5));
      item.el.style.transform = `translate(-50%, calc(-50% - ${rise}px)) scale(${1 + (1 - t) * 0.12})`;
      item.el.style.left = `${p.x}px`;
      item.el.style.top = `${p.y - (item.world.y || 0) * 0}px`;
    }
  }

  addFeed(text) {
    const span = document.createElement('span');
    span.textContent = text;
    this.el.feed.appendChild(span);
    setTimeout(() => {
      span.style.opacity = '0';
      span.style.transition = 'opacity .6s';
      setTimeout(() => span.remove(), 700);
    }, 3200);
    while (this.el.feed.children.length > 4) this.el.feed.firstChild.remove();
  }

  clearFeed() {
    this.el.feed.innerHTML = '';
  }

  flash(color = '#dffcff', strength = 0.6) {
    const el = this.el.flash;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(clamp(strength));
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      el.style.transition = 'opacity .5s ease-out';
      el.style.opacity = '0';
    }, 40);
  }

  hitFlash(strength = 0.9) {
    const el = this.el.hitFx;
    el.style.opacity = String(clamp(strength));
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => { el.style.opacity = '0'; }, 160);
  }

  toast(text, type = '', duration = 2400) {
    const el = this.el.toast;
    el.textContent = text;
    el.className = `toast show${type ? ' ' + type : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.classList.remove('show'); }, duration);
  }

  showCinematic() {
    this.el.cinematic.classList.remove('hidden');
  }

  hideCinematic() {
    this.el.cinematic.classList.add('hidden');
    this.el.cineCaption.classList.remove('visible');
  }

  setCaption(kicker, title, klass = '') {
    const c = this.el.cineCaption;
    c.className = `cine-caption ${klass}`;
    c.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = title;
    const s = document.createElement('span');
    s.textContent = kicker;
    c.appendChild(b);
    c.appendChild(s);
    void c.offsetWidth;
    c.classList.add('visible');
  }

  clearCaption() {
    this.el.cineCaption.classList.remove('visible');
  }

  setCinematicVisible(visible) {
    this.el.cinematic.classList.toggle('hidden', !visible);
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show);
  }

  openHelp(returnTo = 'menu') {
    this.helpReturn = returnTo;
    this.el.help.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
  }

  closeHelp() {
    const wasOpen = !this.el.help.classList.contains('hidden');
    this.el.help.classList.add('hidden');
    if (wasOpen && this.helpReturn === 'pause') this.el.pause.classList.remove('hidden');
  }

  showResult(win, stats) {
    const e = this.el;
    this.el.result.classList.remove('hidden');
    this.el.result.classList.toggle('defeat', !win);
    e.resultOverline.textContent = win ? 'BATTLE REPORT // CITY SECURED' : 'BATTLE REPORT // CITY LOST';
    e.resultTitle.textContent = win ? '城市守住了。' : stats.reason==='city'?'城市防线崩溃。':'机体失去响应。';
    e.resultSub.textContent = win ? '巨兽「蚀」已停止活动 · 新港市仍在呼吸' : 'RX-09 信号中断 · 中央城区已经沦陷';
    const grade = win
      ? (stats.city >= 88 && stats.time < 130 && stats.saved>=300 ? 'S' : stats.city >= 65 && stats.saved>=200 ? 'A' : stats.city >= 40 ? 'B' : 'C')
      : 'D';
    e.resultLetter.textContent = grade;
    e.resultSub.textContent = `${win?'巨兽已被压制':'机体停止作战'} · 获救 ${stats.saved || 0}/300 · 精准格挡 ${stats.parries || 0} 次`;
    e.statTime.textContent = formatTime(stats.time);
    e.statCombo.textContent = String(stats.maxCombo);
    e.statDamage.textContent = String(Math.round(stats.damage));
    e.statBuildings.textContent = String(stats.buildings);
    e.statCity.textContent = `${Math.round(stats.city)}%`;
    e.statHits.textContent = String(stats.hits);
    if(stats.record)e.resultSub.textContent+=` · ${stats.record.isBest?'新纪录 ': '本次评分 '}${stats.record.score} / 同难度最佳 ${stats.record.best}${stats.record.saved?'':'（记录未保存）'}`;
  }

  hideResult() {
    this.el.result.classList.add('hidden');
  }

  showSystemError(text) {
    this.el.systemError.classList.remove('hidden');
    this.el.systemError.textContent = text;
  }

  hideSystemError() {
    this.el.systemError.classList.add('hidden');
  }

  setLowHealth(on) {
    this.el.hud.classList.toggle('low-hp', !!on);
  }

  clearTransient() {
    this.clearFeed();
    clearTimeout(this.flashTimer);clearTimeout(this.hitTimer);
    this.el.flash.style.opacity='0';this.el.hitFx.style.opacity='0';
    for(const item of this.damagePool){item.active=false;if(item.el)item.el.style.opacity='0';}
    this.hideWarning();
    this.setCombo(0);
    this.setUltimateCinematic(false);
    this.setLowHealth(false);
    this.hideHint();
    this.hideOverhead();
    this.el.phaseCutin.classList.add('hidden');
    this.el.breakBanner.classList.add('hidden');
    clearTimeout(this.phaseTimer);
    clearTimeout(this.breakTimer);
    clearTimeout(this.hitMarkerTimer);
    clearTimeout(this.hitFlashTimer);
    this.el.hitMarker?.classList.remove('show');
    this.el.hitFlash?.classList.remove('show');
    if (this.el.bossStaggerFill) this.el.bossStaggerFill.style.width = '0%';
  }
}
