import { attachImportedCharacter, updateImportedCharacter, importedAnchor } from './importedCharacters.js';
import * as THREE from 'three';
import { clamp, damp, lerp, easeOutCubic, easeInCubic, glowTexture, makeRng } from '../utils.js';

import { buildMonster, disposeCharacter } from './characterDesign.js';

export const MONSTER_ATTACKS = {
  swipe: { duration: 1.72, impact: 0.78, recover: 0.5 },
  doubleClaw: { duration: 2.12, impact: 0.98, recover: 0.5 },
  tail: { duration: 1.7, impact: 0.82, recover: 0.4 },
  breath: { duration: 2.18, impact: 1.18, recover: 0.55 },
  slam: { duration: 1.82, impact: 0.94, recover: 0.45 },
  charge: { duration: 2.25, impact: 1.0, recover: 0.7 },
  eruption: { duration: 2.5, impact: 1.35, recover: 0.65 },
  enrage: { duration: 2.9, impact: 0.9, recover: 0.8 },
  roar: { duration: 1.55, impact: 0.45, recover: 0.7 },
};


export class Monster {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'monster';
    this.root.position.set(0, 0, -2);
    this.visual = new THREE.Group();
    this.visual.scale.setScalar(3.15);
    this.root.add(this.visual);
    scene.add(this.root);
    this.time = 0;
    this.walkPhase = 0;
    this.action = null;
    this.actionT = 0;
    this.actionDuration = 0;
    this.hitFlash = 0;
    this.recoil = 0;
    this.health = 1000;
    this.maxHealth = 1000;
    this.enraged = false;
    this.alive = true;
    this.mouthOpen = 0;
    this.target = null;
    this.speed = 0;
    this.footstepCallback = null;
    this.lastStride = 0;
    this.heading = Math.PI;
    this.shadowBlob = this.createShadowBlob();
    scene.add(this.shadowBlob);
    this.rng = makeRng(665);
    this.buildModel();
    attachImportedCharacter(this, 'monster');
    this.root.rotation.y = Math.PI;
  }

  createShadowBlob() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,0.7)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    return mesh;
  }

  buildModel() {
    buildMonster(this);
  }

  playAction(type, extra = {}) {
    if (!this.alive && type !== 'death') return;
    const cfg = MONSTER_ATTACKS[type] || { duration: 1.2 };
    this.action = { type, ...extra, duration: cfg.duration, impact: cfg.impact };
    this.actionT = 0;
    this.actionDuration = cfg.duration;
    this.impactDone = false;
  }

  stopAction() {
    this.action = null;
    this.actionT = 0;
  }

  hit(amount = 1, contact = {}) {
    if (contact.direction) {
      const local = contact.direction.clone().applyQuaternion(this.root.quaternion.clone().invert());
      const hitPoint = contact.point ? this.root.worldToLocal(contact.point.clone()) : new THREE.Vector3();
      this.contactReaction = { side: THREE.MathUtils.clamp(hitPoint.x / 4,-1,1), x: local.x, z: local.z, strength: Math.min(1.4,amount), part: contact.part, time: 0, duration: amount >= 1 ? .48 : .3 };
    }
    this.hitToken = {};
    this.flinchTimer = .36;
    this.hitFlash = Math.min(1, 0.3 + amount * 0.15);
    this.recoil = Math.min(1, this.recoil + 0.35 + amount * 0.1);
    if (this.enraged) this.hitFlash = Math.min(0.8, this.hitFlash);
  }

  stagger(duration = 3.2) {
    if (!this.alive) return;
    this.action = { type: 'stagger', duration, impact: 0 };
    this.actionT = 0;
    this.actionDuration = duration;
    this.mouthOpen = 0;
  }

  setEnraged(v = true) {
    this.enraged = v;
    this.aura.visible = v;
    this.rageEmbers.visible = v;
    this.eyeMat.color.set(v ? '#ff3a1a' : '#ffb15b');
    this.chestGlow.material.opacity = v ? 0.8 : 0.5;
    this.magmaMats.forEach((m) => {
      if (m.color) m.color.set(v ? '#ff2e08' : '#ff5a19');
    });
  }

  die() {
    this.alive = false;
    this.action = { type: 'death', duration: 3.0, impact: 0 };
    this.actionT = 0;
    this.actionDuration = 3.0;
    this.mouthOpen = 0.55;
  }

  setRootPosition(x, y, z) {
    this.root.position.set(x, y, z);
    this.shadowBlob.position.set(x, 0.07, z);
  }

  faceToward(x, z, dt = 0.1) {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    const want = Math.atan2(dx, dz);
    this.heading = Math.atan2(dx, dz);
    this.root.rotation.y = this.angleDamp(this.root.rotation.y, want, 2.2, dt);
  }

  angleDamp(a, b, lambda, dt) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * (1 - Math.exp(-lambda * dt));
  }

  getChestWorld(out = new THREE.Vector3()) {
    const anchor = importedAnchor(this, 'torso', out);
    if (anchor) return anchor;
    return this.torso.localToWorld(out.set(0, 0.6, 0.8));
  }

  getMouthWorld(out = new THREE.Vector3()) {
    const anchor = importedAnchor(this, 'head', out);
    if (anchor) return anchor.add(new THREE.Vector3(Math.sin(this.root.rotation.y), -.5, Math.cos(this.root.rotation.y)).multiplyScalar(1.5));
    return this.mouthPoint.getWorldPosition(out);
  }

  getHeadWorld(out = new THREE.Vector3()) {
    const anchor = importedAnchor(this, 'head', out);
    if (anchor) return anchor;
    return this.head.getWorldPosition(out);
  }

  getClawWorld(side, out = new THREE.Vector3()) {
    return importedAnchor(this, side === 'left' ? 'middle1l' : 'middle1r', out)
      || (side === 'left' ? this.armL : this.armR).hand.getWorldPosition(out);
  }

  update(dt, time, input = {}) {
    this.time = time;
    this.target = input.target || null;
    this.speed = input.speed ?? 0;
    const moving = this.speed > 0.05;
    this.walkPhase += dt * (moving ? 2.5 + this.speed * 0.45 : 0);
    if (this.action) {
      this.actionT += dt;
      if (this.action.type !== 'death' && this.actionT >= this.actionDuration) {
        this.action = null;
      }
    }
    const p = this.walkPhase;
    const walk = moving ? clamp(this.speed / 6, 0.25, 1) : 0;

    // targets
    let hipsY = 3.35 + (moving ? Math.abs(Math.sin(p)) * 0.15 * walk : Math.sin(time * 0.9) * 0.028);
    let hipsX = 0, hipsZ = 0;
    let torsoX = -0.28 + (moving ? Math.sin(p * 2) * 0.03 : 0);
    let torsoY = moving ? Math.sin(p) * 0.04 : 0;
    let torsoZ = moving ? Math.sin(p * 2) * 0.025 : Math.sin(time * 0.55) * 0.018;
    let headX = 0, headY = 0;
    let jaw = 0.06 + Math.sin(time * 0.8) * 0.02;
    let shoulderL = { x: 0.05, z: -0.42 };
    let shoulderR = { x: 0.05, z: 0.42 };
    let elbowL = { x: -0.25 };
    let elbowR = { x: -0.25 };
    let legLhip = { x: moving ? Math.sin(p) * 0.45 * walk : 0.04 };
    let legRhip = { x: moving ? -Math.sin(p) * 0.45 * walk : -0.04 };
    let legLknee = { x: 0.15 + (moving ? Math.max(0, Math.sin(p + 0.8)) * 0.5 * walk : 0) };
    let legRknee = { x: 0.15 + (moving ? Math.max(0, -Math.sin(p + 0.8)) * 0.5 * walk : 0) };
    let tailSway = Math.sin(time * 0.9) * 0.12 + Math.sin(p * 0.5) * 0.14 * walk;
    let visualYaw = 0;
    let mouthOpen = 0.05 + Math.sin(time * 1.1) * 0.02;

    if (this.action) {
      const a = this.action;
      const t = this.actionT;
      const dur = this.actionDuration;
      const pn = clamp(t / dur);
      if (a.type === 'swipe') {
        const side = a.side === 'left' ? -1 : 1;
        const sign = side < 0 ? -1 : 1;
        const wind = easeOutCubic(clamp(pn / 0.34));
        const strike = pn > 0.34 ? easeOutCubic(clamp((pn - 0.34) / 0.2)) : 0;
        const rec = pn > 0.64 ? easeOutCubic(clamp((pn - 0.64) / 0.3)) : 0;
        const arm = side < 0 ? shoulderL : shoulderR;
        const elbow = side < 0 ? elbowL : elbowR;
        arm.z = sign * 0.42 - sign * 1.45 * wind + sign * 2.55 * strike - sign * 0.9 * rec;
        arm.x = 0.05 - 0.35 * wind - 1.0 * strike + 0.25 * rec;
        elbow.x = -0.25 - 0.25 * wind + 0.38 * strike;
        torsoY = side * (0.32 * wind - 0.7 * strike);
        torsoX += -0.06 * wind + 0.25 * strike;
        hipsZ = side * 0.045 * strike;
        headY = side * 0.28 * wind - side * 0.15 * strike;
        jaw = 0.18 + 0.25 * wind;
        mouthOpen = 0.2;
        if (strike > 0) {
          const other = side < 0 ? shoulderR : shoulderL;
          other.x = -0.25;
          other.z = side < 0 ? 0.55 : -0.55;
        }
      } else if (a.type === 'doubleClaw') {
        const wind = easeOutCubic(clamp(pn / 0.34));
        const strike = pn > 0.34 ? easeOutCubic(clamp((pn - 0.34) / 0.24)) : 0;
        const settle = pn > 0.66 ? easeOutCubic(clamp((pn - 0.66) / 0.2)) : 0;
        shoulderL.z = -0.42 - 1.5 * wind + 2.1 * strike;
        shoulderR.z = 0.42 + 1.5 * wind - 2.1 * strike;
        shoulderL.x = -0.2 - 0.75 * strike;
        shoulderR.x = -0.2 - 0.75 * strike;
        elbowL.x = -0.3 - 0.2 * wind + 0.4 * strike;
        elbowR.x = -0.3 - 0.2 * wind + 0.4 * strike;
        torsoX = -0.28 + 0.18 * wind + 0.5 * strike - 0.2 * settle;
        torsoY = Math.sin(pn * Math.PI * 3) * 0.05;
        jaw = 0.4;
        mouthOpen = 0.35;
        headX = -0.1 + 0.3 * strike;
        hipsY = 3.35 - 0.1 * wind + 0.18 * strike;
      } else if (a.type === 'tail') {
        const coil = clamp(pn / 0.24);
        const spinT = clamp((pn - 0.24) / 0.4);
        const spin = easeInCubic(spinT);
        visualYaw = -Math.PI * 2 * spin * (a.reverse ? -1 : 1);
        hipsY = 3.35 - 0.25 * coil + 0.12 * Math.sin(spinT * Math.PI);
        hipsZ = 0.18 * coil;
        torsoX = -0.28 - 0.1 * coil;
        torsoY = -0.25 * coil;
        legLhip.x = 0.12 * coil; legRhip.x = -0.12 * coil;
        legLknee.x = 0.3 * coil; legRknee.x = 0.3 * coil;
        shoulderL.z = -0.42 - 1.0 * coil; shoulderR.z = 0.42 + 1.0 * coil;
        shoulderL.x = -0.2; shoulderR.x = -0.2;
        elbowL.x = -0.55; elbowR.x = -0.55;
        tailSway = 0.02;
        jaw = 0.35;
        mouthOpen = 0.25;
      } else if (a.type === 'breath') {
        const charge = pn < 0.52 ? easeOutCubic(pn / 0.52) : 1;
        const release = pn > 0.52 ? easeOutCubic(clamp((pn - 0.52) / 0.25)) : 0;
        headX = -0.25 - charge * 0.12;
        torsoX = -0.28 - charge * 0.14;
        jaw = 0.08 + charge * 0.75;
        mouthOpen = 0.25 + charge * 0.75;
        shoulderL.x = -0.25; shoulderR.x = -0.25;
        shoulderL.z = -0.4 - charge * 0.35;
        shoulderR.z = 0.4 + charge * 0.35;
        elbowL.x = -0.5; elbowR.x = -0.5;
        torsoY = 0.05 * charge;
        const shake = release * 0.03;
        torsoZ += Math.sin(time * 38) * shake;
        this.mouthGlow.material.opacity = charge * 0.9;
        this.mouthGlow.scale.setScalar(1.2 + charge * 1.2 + release * 0.8);
      } else if (a.type === 'slam') {
        const raise = easeOutCubic(clamp(pn / 0.3));
        const down = easeInCubic(clamp((pn - 0.34) / 0.16));
        const recover = easeOutCubic(clamp((pn - 0.7) / 0.3));
        let armX = lerp(0.18, -2.7, raise);
        armX = lerp(armX, -0.38, down);
        armX = lerp(armX, 0.18, recover);
        shoulderL.x = armX;
        shoulderR.x = armX;
        shoulderL.z = lerp(-0.42, -1.02, raise) + down * 0.9;
        shoulderR.z = lerp(0.42, 1.02, raise) - down * 0.9;
        elbowL.x = lerp(-0.25, -0.1, raise) - down * 0.15;
        elbowR.x = lerp(-0.25, -0.1, raise) - down * 0.15;
        torsoX = -0.28 - raise * 0.2 + down * 0.72 - recover * 0.25;
        hipsY = 3.35 + raise * 0.3 - down * 0.78 + recover * 0.2;
        headX = -0.12 * raise + 0.3 * down;
        jaw = 0.3 + 0.2 * down;
        mouthOpen = 0.25 + 0.2 * down;
      } else if (a.type === 'charge') {
        const crouch = pn < 0.32 ? easeOutCubic(pn / 0.32) : pn < 0.52 ? 1 : 1 - easeOutCubic(clamp((pn - 0.52) / 0.48));
        const run = pn > 0.46 && pn < 0.78 ? Math.sin(time * 34) : 0;
        torsoX = -0.28 + 0.5 * crouch + Math.abs(run) * 0.05;
        hipsY = 3.35 - 0.35 * crouch + Math.abs(run) * 0.06;
        headX = 0.32 * crouch - 0.08;
        jaw = 0.4;
        mouthOpen = 0.3;
        shoulderL.x = 0.55 * crouch; shoulderR.x = 0.55 * crouch;
        shoulderL.z = -0.42 - 0.55 * crouch; shoulderR.z = 0.42 + 0.55 * crouch;
        elbowL.x = -0.5; elbowR.x = -0.5;
        legLhip.x = run * 0.65 - 0.2 * crouch;
        legRhip.x = -run * 0.65 - 0.2 * crouch;
        legLknee.x = 0.25 + Math.max(0, run) * 0.5;
        legRknee.x = 0.25 + Math.max(0, -run) * 0.5;
        tailSway = Math.sin(pn * Math.PI) * 0.25;
      } else if (a.type === 'eruption') {
        const rear = pn < 0.28 ? easeOutCubic(pn / 0.28) : 1;
        const smash = pn < 0.32 ? 0 : pn < 0.52 ? easeInCubic((pn - 0.32) / 0.2) : pn < 0.8 ? 1 : 1 - easeOutCubic((pn - 0.8) / 0.2);
        torsoX = -0.28 - 0.3 * rear + 0.62 * smash;
        torsoY = Math.sin(pn * Math.PI * 2.5) * 0.05;
        hipsY = 3.35 + 0.15 * rear - 0.5 * smash;
        headX = -0.35 * rear + 0.45 * smash;
        jaw = 0.45;
        mouthOpen = 0.4 + rear * 0.4;
        shoulderL.x = -1.25 * rear + 1.35 * smash;
        shoulderR.x = -1.25 * rear + 1.35 * smash;
        shoulderL.z = -0.42 - 0.8 * rear; shoulderR.z = 0.42 + 0.8 * rear;
        elbowL.x = -0.35 - 0.3 * rear; elbowR.x = -0.35 - 0.3 * rear;
        legLknee.x = 0.2 + 0.45 * smash; legRknee.x = 0.2 + 0.45 * smash;
        legLhip.x = -0.2 * smash; legRhip.x = -0.2 * smash;
        if (smash > 0.3) {
          hipsZ = Math.sin(time * 38) * 0.012;
          torsoZ = Math.sin(time * 39) * 0.018;
        }
      } else if (a.type === 'enrage') {
        const rear = Math.sin(Math.min(1, pn) * Math.PI) * (1 - 0.25 * pn);
        torsoX = -0.28 - 0.38 * rear;
        headX = -0.55 * rear;
        jaw = 0.1 + 0.85 * rear;
        mouthOpen = 0.4 + 0.55 * rear;
        shoulderL.z = -0.42 - 1.1 * rear;
        shoulderR.z = 0.42 + 1.1 * rear;
        shoulderL.x = 0.1 - 0.55 * rear;
        shoulderR.x = 0.1 - 0.55 * rear;
        elbowL.x = -0.25 - 0.3 * rear;
        elbowR.x = -0.25 - 0.3 * rear;
        hipsY = 3.35 + 0.16 * rear;
        legLhip.x = -0.15 * rear; legRhip.x = -0.15 * rear;
        legLknee.x = 0.35 * rear; legRknee.x = 0.35 * rear;
        this.mouthGlow.material.opacity = rear * 0.65;
        this.mouthGlow.scale.setScalar(1.2 + rear * 1.4);
      } else if (a.type === 'roar') {
        const env = Math.sin(Math.min(1, pn) * Math.PI) * (pn < 0.75 ? 1 : 0.6);
        jaw = 0.1 + env * 0.9;
        headX = -env * 0.5;
        torsoX = -0.2 - env * 0.23;
        mouthOpen = 0.3 + env * 0.7;
        shoulderL.z = -0.18 - env * 0.5;
        shoulderR.z = 0.18 + env * 0.5;
        shoulderL.x = 0.18 - env * 0.3;
        shoulderR.x = 0.18 - env * 0.3;
        this.mouthGlow.material.opacity = env * 0.35;
        this.mouthGlow.scale.setScalar(1.2 + env * 0.7);
      } else if (a.type === 'stagger') {
        const env = Math.min(1, pn * 4) * (pn > 0.74 ? Math.max(0, (1 - pn) / 0.26) : 1);
        const wobble = Math.sin(time * 7) * 0.04 * env;
        torsoX = 0.38 * env + wobble;
        hipsZ = 0.24 * env;
        hipsY = 3.35 - 0.42 * env;
        headX = 0.4 * env;
        headY = Math.sin(time * 5) * 0.15 * env;
        jaw = 0.3 + 0.2 * env;
        shoulderL.x = 0.55 * env; shoulderR.x = 0.55 * env;
        shoulderL.z = -0.2; shoulderR.z = 0.2;
        elbowL.x = -0.08; elbowR.x = -0.08;
        legLhip.x = -0.18 * env; legRhip.x = -0.18 * env;
        legLknee.x = 0.45 * env; legRknee.x = 0.45 * env;
      } else if (a.type === 'death') {
        const e = easeOutCubic(clamp(pn / 0.75));
        this.root.rotation.z = damp(this.root.rotation.z, e * 0.24, 2, dt);
        hipsY = 3.35 - e * 1.6;
        torsoX = -0.28 + e * 0.9;
        headX = 0.3 * e;
        jaw = 0.5;
        shoulderL.x = -0.8 * e; shoulderR.x = -0.8 * e;
        shoulderL.z = -0.4 - e * 0.5; shoulderR.z = 0.4 + e * 0.5;
        legLhip.x = -0.4 * e; legRhip.x = -0.4 * e;
        legLknee.x = 0.8 * e; legRknee.x = 0.8 * e;
        visualYaw = Math.sin(pn * Math.PI) * 0.1;
      }
    }

    this.recoil = Math.max(0, this.recoil - dt * 2.2);
    if (!this.action && this.recoil > 0) {
      torsoX += this.recoil * 0.055;
      headX += this.recoil * 0.04;
      hipsZ += this.recoil * 0.012;
    }

    // head/neck aim toward target when alive and not busy with head-specific action
    if (this.target && this.alive) {
      const dx = this.target.x - this.root.position.x;
      const dz = this.target.z - this.root.position.z;
      const local = Math.atan2(dx, dz) - this.root.rotation.y;
      const wrapped = Math.atan2(Math.sin(local), Math.cos(local));
      headY = clamp(wrapped, -0.65, 0.65);
      const targetY = (this.target.y ?? 0) + 6;
      const myY = this.head.getWorldPosition(new THREE.Vector3()).y;
      headX += clamp(-(targetY - myY) * 0.01, -0.18, 0.15);
    }

    this.hips.position.y = damp(this.hips.position.y, hipsY, 7, dt);
    this.hips.rotation.z = damp(this.hips.rotation.z, hipsZ, 5, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, torsoX, 7, dt);
    this.torso.rotation.y = damp(this.torso.rotation.y, torsoY, 6, dt);
    this.torso.rotation.z = damp(this.torso.rotation.z, torsoZ, 4, dt);
    this.neck.rotation.x = damp(this.neck.rotation.x, headX, 6, dt);
    this.neck.rotation.y = damp(this.neck.rotation.y, headY, 5, dt);
    this.neck.rotation.z = damp(this.neck.rotation.z, 0.04, 4, dt);
    this.jaw.rotation.x = damp(this.jaw.rotation.x, jaw, 14, dt);
    this.armL.shoulder.rotation.x = damp(this.armL.shoulder.rotation.x, shoulderL.x, 6, dt);
    this.armL.shoulder.rotation.z = damp(this.armL.shoulder.rotation.z, shoulderL.z, 6, dt);
    this.armR.shoulder.rotation.x = damp(this.armR.shoulder.rotation.x, shoulderR.x, 6, dt);
    this.armR.shoulder.rotation.z = damp(this.armR.shoulder.rotation.z, shoulderR.z, 6, dt);
    this.armL.elbow.rotation.x = damp(this.armL.elbow.rotation.x, elbowL.x, 6, dt);
    this.armR.elbow.rotation.x = damp(this.armR.elbow.rotation.x, elbowR.x, 6, dt);
    this.legL.hip.rotation.x = damp(this.legL.hip.rotation.x, legLhip.x, 7, dt);
    this.legR.hip.rotation.x = damp(this.legR.hip.rotation.x, legRhip.x, 7, dt);
    this.legL.knee.rotation.x = damp(this.legL.knee.rotation.x, legLknee.x, 7, dt);
    this.legR.knee.rotation.x = damp(this.legR.knee.rotation.x, legRknee.x, 7, dt);
    this.legL.ankle.rotation.x = damp(this.legL.ankle.rotation.x, -0.12 - Math.max(0, Math.sin(p)) * 0.18 * walk, 6, dt);
    this.legR.ankle.rotation.x = damp(this.legR.ankle.rotation.x, -0.12 - Math.max(0, -Math.sin(p)) * 0.18 * walk, 6, dt);

    this.tail.forEach((seg, i) => {
      const sway = tailSway * (0.4 + i * 0.12);
      seg.joint.rotation.y = damp(seg.joint.rotation.y, sway + Math.sin(time * 0.7 + i * 0.4) * 0.03, 3, dt);
      seg.joint.rotation.x = damp(seg.joint.rotation.x, (i === 0 ? 0.04 : 0.045) + Math.sin(time * 0.8 + i) * 0.012, 2, dt);
    });
    if (this.action?.type === 'tail') {
      this.visual.rotation.y = visualYaw;
    } else if (!this.action && Math.abs(this.visual.rotation.y) > Math.PI) {
      // A full 360° spin is visually identical to zero; snap instead of unwinding backwards.
      this.visual.rotation.y = 0;
    } else {
      this.visual.rotation.y = damp(this.visual.rotation.y, visualYaw, 5, dt);
    }

    const keepMouthGlow = this.action && ['breath', 'roar', 'enrage'].includes(this.action.type);
    if (!keepMouthGlow) {
      this.mouthGlow.material.opacity = damp(this.mouthGlow.material.opacity, 0, 8, dt);
      this.mouthGlow.scale.setScalar(damp(this.mouthGlow.scale.x, 1.2, 8, dt));
    }
    this.mouthOpen = mouthOpen;
    const magmaPulse = 0.65 + Math.sin(time * (this.enraged ? 5.2 : 2.2)) * 0.22;
    this.magmaMats[0].color.setRGB(1, 0.22 + magmaPulse * 0.18, 0.03);
    this.coreLight.intensity = (this.enraged ? 110 : 52) + Math.sin(time * 2.6) * 8;
    this.chestGlow.material.opacity = (this.enraged ? 0.74 : 0.42) + Math.sin(time * 2.6) * 0.12;
    this.backGlow.material.opacity = (this.enraged ? 0.36 : 0.18) + Math.sin(time * 2.1 + 1) * 0.08;
    if (this.aura.visible) {
      this.aura.material.opacity = 0.06 + Math.sin(time * 3.2) * 0.025;
      this.aura.rotation.y += dt * 0.26;
      this.aura.rotation.x += dt * 0.11;
      this.aura.scale.set(7, 6 + Math.sin(time * 1.6) * 0.15, 7);
    }
    if (this.rageEmbers.visible) {
      const positions = this.rageEmbers.geometry.attributes.position.array;
      for (let i = 0; i < this.emberSpeed.length; i++) {
        this.emberAngle[i] += dt * (0.15 + (i % 5) * 0.025);
        positions[i * 3] = Math.cos(this.emberAngle[i]) * this.emberRadius[i];
        positions[i * 3 + 1] += dt * this.emberSpeed[i];
        positions[i * 3 + 2] = Math.sin(this.emberAngle[i]) * this.emberRadius[i];
        if (positions[i * 3 + 1] > 25) positions[i * 3 + 1] = 0.3;
      }
      this.rageEmbers.geometry.attributes.position.needsUpdate = true;
      this.rageEmbers.material.opacity = 0.45 + Math.sin(time * 4.1) * 0.16;
    }

    updateImportedCharacter(this, dt);

    // hit flash
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 3.2);
      const f = this.hitFlash;
      for (const m of this.flashMats) {
        m.emissive.setRGB(f * .22, f * .13, f * .09);
        m.emissiveIntensity = .8;
      }
    } else {
      for (const m of this.flashMats) {
        if (m.emissiveIntensity) m.emissiveIntensity = 0;
      }
    }

    if (!this.imported?.motion && moving) {
      const stride = Math.sin(this.walkPhase);
      if (stride * this.lastStride < 0) {
        this.footstepCallback?.(this.root.position);
      }
      this.lastStride = stride;
    }

    this.hips.position.x = damp(this.hips.position.x, 0, 5, dt);
    this.shadowBlob.position.x = this.root.position.x;
    this.shadowBlob.position.z = this.root.position.z;
    this.shadowBlob.rotation.z = this.root.rotation.y;
  }

  dispose() {
    this.imported?.mixer.stopAllAction();
    if (this.imported) this.imported.mixer.uncacheRoot(this.imported.model);
    this.scene.remove(this.root);
    this.scene.remove(this.shadowBlob);
    disposeCharacter(this.root, this.shadowBlob);
  }
}
