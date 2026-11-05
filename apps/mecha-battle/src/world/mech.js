import { PLASMA } from '../combat/plasmaCycle.js';
import { getMechConfig } from './mechRoster.js';
import { installLoadout, updateLoadout } from './mechLoadout.js';
import { installWeaponRig } from './combatVFX.js';
import { installJetRig } from './jetRig.js';
import { attachImportedCharacter, updateImportedCharacter, importedAnchor } from './importedCharacters.js';
import * as THREE from 'three';
import { clamp, damp, lerp, easeOutCubic, easeInCubic, glowTexture } from '../utils.js';
import { buildMech, disposeCharacter } from './characterDesign.js';

export class Mech {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.team = 'player';
    this.config = getMechConfig(options.id);
    this.root = new THREE.Group();
    this.root.name = 'mech';
    this.visual = new THREE.Group();
    this.visual.scale.setScalar(2.16);
    this.root.add(this.visual);
    scene.add(this.root);
    this.time = 0;
    this.walkCycle = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.guarding = false;
    this.poseSync = null;
    this.action = null;
    this.actionT = 0;
    this.actionDuration = 0;
    this.hitFlash = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.energy = 60;
    this.alive = true;
    this.footstepCallback = null;
    this.lastFootstep = 0;
    this.lastStepSide = 0;
    this.damageSmoke = 0;
    this.buildModel();
    attachImportedCharacter(this, 'mech');
    installJetRig(this);
    installWeaponRig(this);
    installLoadout(this);
    this.createShield();
    this.setIdle();
    this.root.position.set(0, 0, 42);
    this.root.rotation.y = Math.PI;
    this.shadowBlob = this.createShadowBlob();
    scene.add(this.shadowBlob);
  }

  createShadowBlob() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.08;
    return mesh;
  }

  buildModel() {
    buildMech(this);
  }

  createShield() {
    this.shield = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(9.5, 3),
      new THREE.MeshBasicMaterial({
        color: '#6ef5ff', transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      })
    );
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(9.55, 2),
      new THREE.MeshBasicMaterial({
        color: '#9ffcff', transparent: true, opacity: 0.13, wireframe: true,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      })
    );
    this.shield.add(sphere, wire);
    this.shield.position.y = 10;
    this.shield.visible = false;
    this.shield.radius = 9.5;
    this.root.add(this.shield);
    this.shieldSphere = sphere;
    this.shieldWire = wire;
  }

  setIdle() {
    this.action = null;
  }

  punch(side, heavy = false) {
    if (!this.alive) return;
    this.action = { type: 'punch', side, heavy, duration: heavy ? 1.05 : 0.72 };
    this.actionT = 0;
    this.actionDuration = this.action.duration;
  }

  blast() {
    if (!this.alive) return;
    this.action = { type: 'blast', duration: PLASMA.duration };
    this.actionT = 0;
    this.actionDuration = PLASMA.duration;
  }

  missileVolley() {
    if (!this.alive) return;
    this.action = { type: 'missile', duration: 0.95 };
    this.actionT = 0;
    this.actionDuration = 0.95;
  }

  bladeAttack(side = 'right') {
    if (!this.alive) return;
    this.action = { type: 'blade', side: side === 'left' ? 'left' : 'right', duration: 0.82 };
    this.actionT = 0;
    this.actionDuration = 0.82;
  }

  setPoseSync(pose) {
    this.poseSync = pose || null;
  }

  guard(on) {
    this.guarding = on;
  }

  dodge(side) {
    if (!this.alive) return;
    this.action = { type: 'dodge', side, duration: 0.55 };
    this.actionT = 0;
    this.actionDuration = 0.55;
  }

  jet() {
    if (!this.alive) return;
    this.action = { type: 'jet', duration: 2.8 };
    this.actionT = 0;
    this.actionDuration = 2.8;
  }

  hit(strength = 1) {
    if (!this.alive) return;
    this.hitFlash = Math.min(1, 0.45 + strength * 0.35);
    if (!['ultimate','dead','victory'].includes(this.action?.type)) {
      this.action = { type: 'hit', duration: 0.45 };
      this.actionT = 0;
      this.actionDuration = 0.45;
    }
  }

  ultimate() {
    if (!this.alive) return;
    this.action = { type: 'ultimate', duration: 3.4 };
    this.actionT = 0;
    this.actionDuration = 3.4;
  }

  landing() {
    this.action = { type: 'landing', duration: 0.75 };
    this.actionT = 0;
    this.actionDuration = 0.75;
  }

  die() {
    this.alive = false;
    this.action = { type: 'dead', duration: 2.5 };
    this.actionT = 0;
    this.actionDuration = 2.5;
    this.guarding = false;
    this.shield.visible = false;
  }

  victory() {
    this.alive = true;
    this.action = { type: 'victory', duration: 999 };
    this.actionT = 0;
    this.actionDuration = 999;
    this.guarding = false;
    this.shield.visible = false;
  }

  setWorldPosition(x, y, z) {
    this.root.position.set(x, y, z);
    this.shadowBlob.position.set(x, 0.085, z);
  }

  faceToward(x, z) {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  getChestWorld(out = new THREE.Vector3()) {
    const anchor = importedAnchor(this, 'torso1', out);
    if (anchor) return anchor;
    return this.torso.getWorldPosition(out).add(new THREE.Vector3(0, 1.0, 0.6));
  }

  getHeadWorld(out = new THREE.Vector3()) {
    const anchor = importedAnchor(this, 'head', out);
    if (anchor) return anchor;
    return this.head.getWorldPosition(out);
  }

  getFistWorld(side, out = new THREE.Vector3()) {
    return importedAnchor(this, side === 'left' ? 'middle1l' : 'middle1r', out)
      || (side === 'left' ? this.shoulderL : this.shoulderR).fist.getWorldPosition(out);
  }

  getShoulderWorld(side, out = new THREE.Vector3()) {
    return importedAnchor(this, side === 'left' ? 'shoulderl' : 'shoulderr', out)
      || (side === 'left' ? this.shoulderL : this.shoulderR).shoulder.getWorldPosition(out);
  }

  getBackWorld(out = new THREE.Vector3()) {
    const chest = importedAnchor(this, 'torso1', out);
    if (chest) return chest.add(new THREE.Vector3(0, 0, -2.1).applyQuaternion(this.root.quaternion));
    return this.backpack.getWorldPosition(out);
  }

  update(dt, time, input = {}) {
    this.time = time;
    const speed = input.speed ?? 0;
    const running = input.running ?? false;
    this.speed = speed;
    const moving = speed > 0.4;
    this.walkPhase += dt * (moving ? (running ? 9.2 : 5.4) : 0);
    const walk = moving ? clamp(speed / 12, 0.3, 1.3) : 0;
    const p = this.walkPhase;

    if (this.action) {
      this.actionT += dt;
      if (this.action.type !== 'victory' && this.action.type !== 'dead' && this.actionT >= this.actionDuration) {
        this.action = null;
      }
    }

    // base pose
    let hipsY = 2.85 + (moving ? Math.abs(Math.sin(p)) * 0.055 * walk : Math.sin(time * 1.5) * 0.014);
    let hipsRotX = 0, hipsRotZ = 0;
    let torsoX = moving ? -0.06 * walk : 0.012 + Math.sin(time * 1.2) * 0.012;
    let torsoY = moving ? Math.sin(p) * 0.045 * walk : 0;
    let torsoZ = moving ? Math.sin(p) * 0.03 : 0;
    let headX = 0, headY = 0;
    let shoulderL = { x: -0.08 + Math.sin(p) * 0.52 * walk, y: 0.06, z: -0.26 };
    let shoulderR = { x: -0.08 - Math.sin(p) * 0.52 * walk, y: -0.06, z: 0.26 };
    let elbowL = { x: -0.36 - Math.abs(Math.sin(p)) * 0.15 * walk, y: 0, z: 0 };
    let elbowR = { x: -0.36 - Math.abs(Math.sin(p)) * 0.15 * walk, y: 0, z: 0 };
    let hipL = { x: Math.sin(p) * 0.62 * walk, z: 0.025 };
    let hipR = { x: -Math.sin(p) * 0.62 * walk, z: -0.025 };
    let kneeL = { x: Math.max(0, -Math.sin(p) * 0.9) * walk + 0.03 };
    let kneeR = { x: Math.max(0, Math.sin(p) * 0.9) * walk + 0.03 };
    let footL = { x: -Math.sin(p) * 0.24 * walk };
    let footR = { x: Math.sin(p) * 0.24 * walk };
    let bodyLean = 0;
    let bodyLeanSide = 0;
    let crouch = 0;
    let guardWeight = this.guarding ? 1 : 0;

    if (guardWeight > 0) {
      shoulderL = { x: -0.98, y: -0.28, z: -0.38 };
      shoulderR = { x: -0.98, y: 0.28, z: 0.38 };
      elbowL = { x: -1.62, y: 0, z: 0 };
      elbowR = { x: -1.62, y: 0, z: 0 };
      torsoX = -0.02;
      crouch = 0.08;
    }

    if (this.action) {
      const t = this.actionT;
      const dur = this.actionDuration;
      const type = this.action.type;
      if (type === 'punch') {
        const pnorm = clamp(t / dur);
        const wind = easeOutCubic(clamp(pnorm / 0.22));
        const strike = easeOutCubic(clamp((pnorm - 0.22) / 0.21))
          * (1 - easeOutCubic(clamp((pnorm - 0.54) / 0.46)));
        const coil = wind * (1 - strike);
        const side = this.action.side === 'left' ? -1 : 1;
        const arm = this.action.side === 'left' ? shoulderL : shoulderR;
        const elbow = this.action.side === 'left' ? elbowL : elbowR;
        arm.x += coil * 0.32;
        elbow.x -= coil * 0.4;
        torsoY -= side * 0.17 * coil;
        crouch += 0.045 * coil;
        arm.x = lerp(arm.x, -1.48 - (this.action.heavy ? 0.08 : 0), strike);
        arm.y = lerp(arm.y, side * -0.24 * strike, strike);
        arm.z = lerp(arm.z, side * 0.06, strike);
        elbow.x = lerp(elbow.x, -0.04, strike);
        torsoY = lerp(torsoY, side * 0.42 * strike, strike);
        torsoX += -0.13 * strike;
        hipsRotZ = side * 0.03 * strike;
        headY = side * 0.12 * strike;
      } else if (type === 'blast') {
        const pnorm = clamp(t / dur);
        const charge = pnorm < 0.44 ? easeOutCubic(pnorm / 0.44) : 1;
        const release = pnorm > 0.56 ? easeOutCubic(clamp((pnorm - 0.56) / 0.25)) : 0;
        const thrust = 0.35 + charge * 0.65 - release * 0.45;
        shoulderL.x = lerp(shoulderL.x, -1.5, thrust);
        shoulderR.x = lerp(shoulderR.x, -1.5, thrust);
        shoulderL.y = -0.28; shoulderR.y = 0.28;
        shoulderL.z = -0.22; shoulderR.z = 0.22;
        elbowL.x = lerp(elbowL.x, -0.05, thrust);
        elbowR.x = lerp(elbowR.x, -0.05, thrust);
        torsoX = -0.18 * charge + 0.1 * release;
        crouch = 0.1 * charge;
      } else if (type === 'missile') {
        const pnorm = clamp(t / dur);
        const open = pnorm < 0.3 ? easeOutCubic(pnorm / 0.3) : 1;
        const release = pnorm > 0.58 ? easeOutCubic(clamp((pnorm - 0.58) / 0.3)) : 0;
        shoulderL.x = lerp(shoulderL.x, -0.26, open);
        shoulderR.x = lerp(shoulderR.x, -0.26, open);
        shoulderL.z = lerp(shoulderL.z, -1.5, open) + release * 0.25;
        shoulderR.z = lerp(shoulderR.z, 1.5, open) - release * 0.25;
        shoulderL.y = -0.16; shoulderR.y = 0.16;
        elbowL.x = lerp(elbowL.x, -0.58, open);
        elbowR.x = lerp(elbowR.x, -0.58, open);
        torsoX = -0.08 - open * 0.12 + release * 0.16;
        headX = -0.12 * open;
        hipsRotZ = Math.sin(time * 30) * 0.012 * open;
      } else if (type === 'blade') {
        const pnorm = clamp(t / dur);
        const sign = this.action.side === 'left' ? -1 : 1;
        const arm = sign < 0 ? shoulderL : shoulderR;
        const other = sign < 0 ? shoulderR : shoulderL;
        const elbow = sign < 0 ? elbowL : elbowR;
        const wind = easeOutCubic(clamp(pnorm / 0.3));
        const slash = pnorm > 0.3 ? easeOutCubic(clamp((pnorm - 0.3) / 0.2)) : 0;
        const recover = pnorm > 0.62 ? easeOutCubic(clamp((pnorm - 0.62) / 0.38)) : 0;
        arm.z = sign * (0.08 + 1.4 * wind) - sign * 1.15 * slash;
        arm.x = -0.1 - 0.35 * wind - 0.85 * slash + 0.2 * recover;
        elbow.x = -0.5 + 0.4 * slash;
        other.z = sign * -0.3;
        torsoY = sign * (0.28 * wind - 0.55 * slash);
        torsoX = -0.06 + 0.18 * slash;
        headY = sign * (0.2 * wind - 0.25 * slash);
        hipsRotZ = sign * 0.04 * slash;
      } else if (type === 'dodge') {
        const side = this.action.side;
        const pnorm = clamp(t / dur);
        const env = Math.sin(Math.min(1, pnorm) * Math.PI);
        bodyLeanSide = side * 0.4 * env;
        crouch = 0.28 * env;
        torsoY = side * -0.2 * env;
        shoulderL.x = lerp(shoulderL.x, -0.55, env);
        shoulderR.x = lerp(shoulderR.x, -0.55, env);
        shoulderL.z = -0.5;
        shoulderR.z = 0.5;
        hipL.z = -side * 0.08;
        hipR.z = -side * 0.08;
      } else if (type === 'hit') {
        const pnorm = clamp(t / dur);
        const env = Math.sin(pnorm * Math.PI) * (1 - pnorm * 0.4);
        torsoX = -0.28 * env;
        torsoY = 0.15 * env;
        hipsRotZ = 0.05 * env;
        shoulderL.x = -0.34 - 0.4 * env;
        shoulderR.x = -0.34 - 0.4 * env;
        crouch = 0.13 * env;
        headX = -0.2 * env;
      } else if (type === 'ultimate') {
        const pnorm = clamp(t / dur);
        const raise = pnorm < 0.25 ? easeOutCubic(pnorm / 0.25) : pnorm < 0.8 ? 1 : 1 - easeInCubic((pnorm - 0.8) / 0.2);
        shoulderL = { x: lerp(shoulderL.x, -0.1, raise), y: 0, z: lerp(-0.08, -2.65, raise) };
        shoulderR = { x: lerp(shoulderR.x, -0.1, raise), y: 0, z: lerp(0.08, 2.65, raise) };
        elbowL.x = lerp(elbowL.x, -0.08, raise);
        elbowR.x = lerp(elbowR.x, -0.08, raise);
        torsoX = -0.1 * raise;
        torsoZ = Math.sin(time * 1.2) * 0.02 * raise;
        headX = -0.28 * raise;
        crouch = 0.02;
        bodyLeanSide = 0;
      } else if (type === 'landing') {
        const pnorm = clamp(t / dur);
        const env = Math.sin(pnorm * Math.PI) * (1 - pnorm * 0.3);
        crouch = 0.36 * env;
        torsoX = 0.22 * env;
        kneeL.x += 0.7 * env;
        kneeR.x += 0.7 * env;
        hipL.x -= 0.35 * env;
        hipR.x -= 0.35 * env;
        shoulderL.x = -0.6; shoulderR.x = -0.6;
        elbowL.x = -0.8; elbowR.x = -0.8;
      } else if (type === 'dead') {
        const pnorm = clamp(t / 2.2);
        const e = easeOutCubic(pnorm);
        bodyLean = e * 1.35;
        crouch = e * 1.2;
        hipsY -= e * 1.0;
        torsoX = 0.8 * e;
        shoulderL.x = -0.2; shoulderR.x = -0.2;
        elbowL.x = -0.2; elbowR.x = -0.2;
        kneeL.x = 0.4; kneeR.x = 0.4;
      } else if (type === 'victory') {
        shoulderR.x = -0.2;
        shoulderR.z = 2.9;
        elbowR.x = -1.1;
        shoulderL.x = -0.1;
        torsoX = -0.08;
        headX = -0.25;
        const breathe = Math.sin(time * 1.4) * 0.015;
        torsoX += breathe;
      }
    }

    // real-time upper-body mirror from the pose analyzer
    if (this.poseSync && !this.action && !this.guarding) {
      const syncArm = (a, side, pose, elbow) => {
        const out = clamp(a.out ?? 0, 0, 1.8);
        const lift = clamp(a.lift ?? 0, -0.8, 1.9);
        const forward = clamp(a.forward ?? 0, 0, 1);
        pose.z = side * (0.08 + out * 1.22 + Math.max(0, lift) * 1.05);
        pose.x = -0.08 - forward * 1.22 - Math.max(0, lift) * 0.14;
        pose.y = side * (out - forward * 0.5) * 0.08;
        elbow.x = -0.36 + clamp(a.straight ?? 0, 0, 1) * 0.32;
      };
      syncArm(this.poseSync.arms.left, -1, shoulderL, elbowL);
      syncArm(this.poseSync.arms.right, 1, shoulderR, elbowR);
      torsoZ += clamp(this.poseSync.tilt ?? 0, -1.2, 1.2) * 0.1;
      headY = clamp(this.poseSync.headX ?? 0, -1.2, 1.2) * 0.34;
    }

    // smooth application
    const k = this.action && this.action.type === 'punch' ? 34 : 15;
    this.hips.position.y = damp(this.hips.position.y, hipsY - crouch, 18, dt);
    this.hips.rotation.x = damp(this.hips.rotation.x, hipsRotX + bodyLean, 13, dt);
    this.hips.rotation.z = damp(this.hips.rotation.z, bodyLeanSide + hipsRotZ, 10, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, torsoX, k, dt);
    this.torso.rotation.y = damp(this.torso.rotation.y, torsoY, k, dt);
    this.torso.rotation.z = damp(this.torso.rotation.z, torsoZ, 12, dt);
    this.head.rotation.x = damp(this.head.rotation.x, headX, 10, dt);
    this.head.rotation.y = damp(this.head.rotation.y, headY, 10, dt);

    const applyArm = (arm, pose, elbow) => {
      arm.shoulder.rotation.x = damp(arm.shoulder.rotation.x, pose.x, k, dt);
      arm.shoulder.rotation.y = damp(arm.shoulder.rotation.y, pose.y, k, dt);
      arm.shoulder.rotation.z = damp(arm.shoulder.rotation.z, pose.z, k, dt);
      arm.elbow.rotation.x = damp(arm.elbow.rotation.x, elbow.x, k, dt);
      arm.elbow.rotation.y = damp(arm.elbow.rotation.y, elbow.y, k, dt);
      arm.elbow.rotation.z = damp(arm.elbow.rotation.z, elbow.z, k, dt);
    };
    applyArm(this.shoulderL, shoulderL, elbowL);
    applyArm(this.shoulderR, shoulderR, elbowR);

    this.legL.hip.rotation.x = damp(this.legL.hip.rotation.x, hipL.x, 15, dt);
    this.legL.hip.rotation.z = damp(this.legL.hip.rotation.z, hipL.z, 10, dt);
    this.legR.hip.rotation.x = damp(this.legR.hip.rotation.x, hipR.x, 15, dt);
    this.legR.hip.rotation.z = damp(this.legR.hip.rotation.z, hipR.z, 10, dt);
    this.legL.knee.rotation.x = damp(this.legL.knee.rotation.x, kneeL.x, 15, dt);
    this.legR.knee.rotation.x = damp(this.legR.knee.rotation.x, kneeR.x, 15, dt);
    this.legL.foot.rotation.x = damp(this.legL.foot.rotation.x, footL.x, 15, dt);
    this.legR.foot.rotation.x = damp(this.legR.foot.rotation.x, footR.x, 15, dt);

    // guard shield
    const guardTarget = this.guarding && this.alive ? 1 : 0;
    const shieldOp = damp(this.shield.userData.op ?? 0, guardTarget, 10, dt);
    this.shield.userData.op = shieldOp;
    this.shield.visible = shieldOp > 0.01;
    this.shieldSphere.material.opacity = 0.055 * shieldOp;
    this.shieldWire.material.opacity = 0.13 * shieldOp;
    this.shield.rotation.y += dt * 0.42;
    this.shield.rotation.z += dt * 0.17;
    this.shield.scale.setScalar(0.94 + Math.sin(time * 2.2) * 0.015);
    this.shield.position.y = 10;

    // core + thruster glow
    const pulse = 0.82 + Math.sin(time * 2.5) * 0.16 + (this.guarding ? 0.2 : 0);
    this.core.material.color.setRGB(0.55 * pulse + 0.35, 0.9 * pulse + 0.1, 1);
    this.coreGlow.material.opacity = 0.3 + pulse * 0.18;
    this.coreGlow.scale.setScalar(0.82 + pulse * 0.14);
    this.coreRing.rotation.z += dt * 0.7;
    this.visorGlow = this.visorGlow || null;
    const boosting = moving && this.speed > 8 || this.action?.type === 'dodge' || !this.alive;
    const flameScale = boosting ? 1.2 + Math.sin(time * 28) * 0.18 : 0.45 + Math.sin(time * 9) * 0.06;
    this.flameL.scale.set(1, flameScale, 1);
    this.flameR.scale.set(1, flameScale, 1);
    this.flameL.visible = true;
    this.flameR.visible = true;
    this.backGlow.material.opacity = 0.22 + flameScale * 0.22;
    this.wristGlowL.material.opacity = damp(this.wristGlowL.material.opacity, this.action?.type === 'punch' && this.action.side === 'left' ? 0.9 : 0, 15, dt);
    this.wristGlowR.material.opacity = damp(this.wristGlowR.material.opacity, this.action?.type === 'punch' && this.action.side === 'right' ? 0.9 : 0, 15, dt);
    if (this.missilePodGlows) {
      const podTarget = this.action?.type === 'missile' ? 0.95 : 0.2;
      for (const g of this.missilePodGlows) g.material.opacity = damp(g.material.opacity, podTarget, 10, dt);
    }

    // hard-light blades follow the blade action; fade out on recovery
    const bladeAction = this.action?.type === 'blade';
    for (const [arm, isLeft] of [[this.shoulderL, true], [this.shoulderR, false]]) {
      const active = bladeAction && this.action.side === (isLeft ? 'left' : 'right');
      arm.bladeGroup.visible = active || arm.bladeMat.opacity > 0.01;
      arm.bladeMat.opacity = damp(arm.bladeMat.opacity, active ? 0.88 : 0, active ? 22 : 12, dt);
      arm.bladeCoreMat.opacity = damp(arm.bladeCoreMat.opacity, active ? 1 : 0, active ? 22 : 12, dt);
      arm.bladeGlow.material.opacity = damp(arm.bladeGlow.material.opacity, active ? 0.65 : 0, 14, dt);
      arm.bladeGroup.scale.setScalar(damp(arm.bladeGroup.scale.x, active ? 1 : 0.75, 14, dt));
    }

    updateImportedCharacter(this, dt);
    updateLoadout(this);

    // hit flash
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.8);
      const f = this.hitFlash;
      for (const m of this.flashMats) {
        m.emissive.setRGB(f * 0.55, f * 0.08, f * 0.04);
        m.emissiveIntensity = 1.3;
      }
    } else {
      for (const m of this.flashMats) {
        if (m.emissive && m.emissiveIntensity !== 0) {
          m.emissiveIntensity = 0;
        }
      }
    }

    // footsteps
    if (!this.imported?.motion && moving && this.alive && this.root.position.y < .5 && this.action?.type !== 'dodge') {
      const stride = Math.sin(this.walkPhase);
      const side = stride > 0 ? 1 : -1;
      if (stride * this.lastStepSide < 0) {
        this.footstepCallback?.(side, this.root.position);
      }
      this.lastStepSide = stride;
    }

    // visual landing bob
    this.visual.position.y = damp(this.visual.position.y, 0, 10, dt);
    this.visual.rotation.z = damp(this.visual.rotation.z, 0, 10, dt);
    this.shadowBlob.position.x = this.root.position.x;
    this.shadowBlob.position.z = this.root.position.z;
    this.shadowBlob.material.opacity = Math.max(.15, 1 - this.root.position.y / 20);
    this.shadowBlob.scale.setScalar(1 + this.root.position.y * .035);
    this.shadowBlob.rotation.z = -this.root.rotation.y;
  }

  dispose() {
    this.imported?.mixer.stopAllAction();
    if (this.imported) this.imported.mixer.uncacheRoot(this.imported.model);
    this.scene.remove(this.root);
    this.scene.remove(this.shadowBlob);
    disposeCharacter(this.root, this.shadowBlob);
  }
}
