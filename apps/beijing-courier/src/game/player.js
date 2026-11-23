// Planet walking controller + third-person follow camera + keyboard/mouse input.
// The original site's follow camera uses (0,1,5) spherical offset and a
// (-0.65,0,1) target offset; the planet collision comes from hitmesh_0..4.

import * as THREE from 'three';

const WALK_SPEED = 2.6;
const RUN_SPEED = 5.0;
const TURN_RATE = 9;
const GRAVITY = 16;
const JUMP_SPEED = 5.2;

export function createInput(canvas) {
  const state = {
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    drag: false,
    lookDelta: { x: 0, y: 0 },
    jumpRequested: false,
    interactRequested: false,
    touchMove: null,
    touchLook: null,
  };

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    state.keys.add(e.code);
    if (e.code === 'Space') state.jumpRequested = true;
    if (e.code === 'KeyE') state.interactRequested = true;
  });
  addEventListener('keyup', (e) => state.keys.delete(e.code));
  addEventListener('blur', () => state.keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.drag = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.drag) return;
    state.lookDelta.x += e.clientX - state.lastX;
    state.lookDelta.y += e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  });
  const stopDrag = () => { state.drag = false; };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('pointerleave', stopDrag);
  canvas.addEventListener('wheel', (e) => {
    state.wheel = (state.wheel || 0) + Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });

  return state;
}

export class PlayerController {
  constructor({ collision, spawn, scene, avatar }) {
    this.collision = collision;
    this.scene = scene;
    this.avatar = avatar;

    const radial = spawn.point.clone().normalize();
    const n = spawn.normal.clone().normalize();
    this.position = spawn.point.clone().addScaledVector(radial, 0.02);
    // keep the initial up vector calm: a steep triangle normal would make the
    // idle ground sample jump to a completely different place
    this.normal = radial.clone().lerp(n, 0.36).normalize();
    this.heading = spawn.heading || 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.speed = 0;
    this.forward = new THREE.Vector3(1, 0, 0);
    this.moving = false;
    this.jumpCooldown = 0;
    this._settleFrames = 0;
    this._lastMoving = false;
    this._smoothedNormal = this.normal.clone();
    this._groundRadius = this.position.length();
    this.colliders = [];
  }

  /** Horizontal OBB colliders for self-built buildings (see world/beijing.js). */
  setColliders(colliders) {
    this.colliders = Array.isArray(colliders) ? colliders : [];
  }

  /** Test a candidate position against the horizontal OBB colliders. */
  _blocked(point) {
    if (!this.colliders.length) return false;
    for (const collider of this.colliders) {
      const center = collider.centerGround;
      if (!center) continue;
      const dx = point.x - center[0];
      const dy = point.y - center[1];
      const dz = point.z - center[2];
      const up = collider.up;
      const h = dx * up[0] + dy * up[1] + dz * up[2];
      if (h < -0.15 || h > (collider.height || 2) + 0.5) continue;
      const right = collider.right;
      const forward = collider.forward;
      const x = dx * right[0] + dy * right[1] + dz * right[2];
      const z = dx * forward[0] + dy * forward[1] + dz * forward[2];
      const margin = 0.3;
      if (Math.abs(x) < (collider.half?.[0] || 1) + margin && Math.abs(z) < (collider.half?.[1] || 1) + margin) {
        return true;
      }
    }
    return false;
  }

  _tryMove(nextPos, oldPos, moveVec, step) {
    if (!this._blocked(nextPos)) return nextPos;
    // slide along the wall: try each tangent component separately
    const n = this._smoothedNormal;
    const slideRight = moveVec.clone().addScaledVector(n, -moveVec.dot(n));
    const base = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
    if (base.lengthSq() < 1e-6) base.set(0, 0, 1).addScaledVector(n, -n.z);
    base.normalize();
    const rightAxis = new THREE.Vector3().crossVectors(n, base).normalize();
    const candidates = [
      oldPos.clone().addScaledVector(rightAxis, slideRight.dot(rightAxis) * step),
      oldPos.clone().addScaledVector(base, slideRight.dot(base) * step),
    ];
    for (const candidate of candidates) {
      const dir = candidate.clone().normalize();
      const ground = this.collision.groundAtDirection(dir);
      if (!ground) continue;
      const hitPos = dir.clone().multiplyScalar(ground.point.length() + 0.02);
      if (!this._blocked(hitPos)) return hitPos;
    }
    return oldPos;
  }

  get up() { return this.normal; }

  /** cameraForward: tangent forward vector of the follow camera */
  update(dt, input, cameraForward) {
    const keys = input.keys;
    let ix = 0;
    let iy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (input.joystick) { ix += input.joystick.x; iy += input.joystick.y; }
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');

    const n = this.normal.clone().normalize();
    // camera basis on the tangent plane
    const camForward = cameraForward.clone();
    camForward.addScaledVector(n, -camForward.dot(n));
    if (camForward.lengthSq() < 1e-6) camForward.set(1, 0, 0).addScaledVector(n, -n.x);
    camForward.normalize();
    const camRight = new THREE.Vector3().crossVectors(n, camForward).normalize();

    const move = new THREE.Vector3()
      .addScaledVector(camForward, iy)
      .addScaledVector(camRight, ix);
    const moveLen = move.length();
    this.moving = moveLen > 0.001;

    let targetHeading = this.heading;
    if (this.moving) {
      move.normalize();
      const base = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
      if (base.lengthSq() < 1e-6) base.set(0, 0, 1).addScaledVector(n, -n.z);
      base.normalize();
      const right = new THREE.Vector3().crossVectors(n, base).normalize();
      targetHeading = Math.atan2(move.dot(right), move.dot(base));
      this.desiredDir = move.clone();
    }

    const speed = this.moving ? (run ? RUN_SPEED : WALK_SPEED) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, speed, 10, dt);
    this.run = run;

    // --- stable idle -------------------------------------------------------
    // While standing still we do NOT re-sample the collision mesh every frame:
    // triangle-edge normal changes were causing a visible idle vibration.
    if (!this.moving && this.grounded) {
      this._settleFrames += 1;
      if (this._settleFrames <= 3) {
        const radial = this.position.clone().normalize();
        const ground = this.collision.groundAtDirection(radial);
        if (ground) {
          this._groundRadius = ground.point.length();
          this.position.copy(radial).multiplyScalar(this._groundRadius + 0.02);
          this._smoothedNormal.lerp(this._toStableNormal(ground.normal, radial), 1 - Math.exp(-20 * dt)).normalize();
        }
      }
    } else if (this.moving) {
      this._settleFrames = 0;
      const oldPos = this.position.clone();
      const step = this.speed * dt;
      let nextPos = oldPos.clone().addScaledVector(this.desiredDir, step);
      const blockedByBuilding = this._blocked(nextPos);
      if (blockedByBuilding) nextPos = this._tryMove(nextPos, oldPos, this.desiredDir, step);
      const nextNormal = nextPos.clone().normalize();
      const ground = this.collision.groundAtDirection(nextNormal);
      if (ground) {
        const currentRadius = oldPos.length();
        const nextRadius = ground.point.length();
        const climb = nextRadius - currentRadius;
        const maxClimb = Math.max(0.5, step * 2.2);
        if (!this.grounded || climb < maxClimb) {
          this._groundRadius = THREE.MathUtils.damp(currentRadius, nextRadius, this.grounded ? 26 : 5, dt);
          this.position.copy(nextNormal).multiplyScalar(this._groundRadius + 0.02);
          // blend the triangle normal with the radial direction for stability,
          // then damp it so crossing triangle edges does not flicker
          const stable = this._toStableNormal(ground.normal, nextNormal);
          this._smoothedNormal.lerp(stable, 1 - Math.exp(-10 * dt)).normalize();
          this.normal.copy(this._smoothedNormal);
        }
      }
    }

    // jump / gravity
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    if (input.jumpRequested) {
      input.jumpRequested = false;
      if (this.grounded && this.jumpCooldown <= 0) {
        this.verticalVelocity = JUMP_SPEED;
        this.grounded = false;
        this.jumpCooldown = 0.15;
      }
    }
    if (!this.grounded) {
      this.verticalVelocity -= GRAVITY * dt;
      const r = this.position.length() + this.verticalVelocity * dt;
      const dir = this.position.clone().normalize();
      this.position.copy(dir).multiplyScalar(r);
      const ground = this.collision.groundAtDirection(dir);
      if (ground && r <= ground.point.length() + 0.05 && this.verticalVelocity <= 0) {
        this.position.copy(ground.point).addScaledVector(dir, 0.02);
        this._groundRadius = ground.point.length();
        this.normal.copy(this._toStableNormal(ground.normal, dir));
        this._smoothedNormal.copy(this.normal);
        this.grounded = true;
        this.verticalVelocity = 0;
        this._settleFrames = 0;
      }
    }

    // smooth heading toward movement direction
    if (this.moving) {
      this.heading = dampAngle(this.heading, targetHeading, TURN_RATE, dt);
    }
    this.syncAvatar();
  }

  /** Blend the triangle normal with the radial direction; radial is stable and
   *  makes the character/camera feel calm on a hand-painted planet. */
  _toStableNormal(groundNormal, direction) {
    const radial = (direction || this.position).clone().normalize();
    const blended = radial.clone().lerp(groundNormal, 0.55);
    if (blended.lengthSq() < 1e-6) return radial;
    return blended.normalize();
  }

  syncAvatar() {
    if (!this.avatar) return;
    const up = this.normal;
    // build an orthonormal basis whose +Z is the character facing direction
    const forward = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1).addScaledVector(up, -up.z);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const heading = this.heading;
    const dir = forward.clone().multiplyScalar(Math.cos(heading)).addScaledVector(right, Math.sin(heading)).normalize();
    const side = new THREE.Vector3().crossVectors(up, dir).normalize();
    const basis = new THREE.Matrix4().makeBasis(side, up, dir);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    this.avatar.root.position.copy(this.position);
    this.avatar.root.quaternion.copy(quat);
  }
}

function dampAngle(current, target, lambda, dt) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export class FollowCamera {
  constructor({ camera, controller, collision }) {
    this.camera = camera;
    this.controller = controller;
    this.collision = collision;
    this.yaw = controller.heading;
    this.pitch = 1.19; // radians from up axis (~68deg)
    this.distance = 5.4;
    this.targetOffset = 1.15;
    this.currentTarget = controller.position.clone();
    this.currentPos = controller.position.clone().addScaledVector(controller.normal, 3);
    this.manualTimer = 0;
    this.mouseSensitivity = 0.005;
    this.focus = false;
    this.focusAmount = 0;
    this.frameUp = controller.normal.clone();
    this.collisionDist = this.distance;
    this._lastDesired = new THREE.Vector3();
  }

  /** Cinematic framing used while a dialogue is open (matches the reference site). */
  setFocus(focus) {
    this.focus = !!focus;
  }

  getForward() {
    const up = this.frameUp.clone().normalize();
    const base = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x);
    if (base.lengthSq() < 1e-5) base.set(0, 0, 1).addScaledVector(up, -up.z);
    base.normalize();
    const right = new THREE.Vector3().crossVectors(up, base).normalize();
    return base.clone().multiplyScalar(Math.cos(this.yaw)).addScaledVector(right, Math.sin(this.yaw)).normalize();
  }

  update(dt, input) {
    const c = this.controller;
    // a smoothed up vector: triangle normals on the collision mesh can flip
    // between neighbouring triangles, which used to roll the camera slightly.
    this.frameUp.lerp(c.normal, 1 - Math.exp(-5 * dt)).normalize();
    if (this.frameUp.lengthSq() < 1e-6) this.frameUp.copy(c.normal);
    const up = this.frameUp;

    // manual look
    if (input.drag) {
      this.yaw -= input.lookDelta.x * this.mouseSensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.lookDelta.y * this.mouseSensitivity, 0.32, 1.42);
      this.manualTimer = 1.2;
      input.lookDelta.x = 0;
      input.lookDelta.y = 0;
    }
    if (input.wheel) {
      this.distance = THREE.MathUtils.clamp(this.distance + input.wheel * 0.55, 3.2, 9);
      input.wheel = 0;
    }
    this.manualTimer = Math.max(0, this.manualTimer - dt);

    // dialogue close-up: swing around to a front three-quarter view so the
    // character's face is visible (matches the reference screenshots)
    if (this.focusAmount > 0.02 && this.manualTimer <= 0) {
      const frontYaw = c.heading + Math.PI * 0.82;
      this.yaw = dampAngle(this.yaw, frontYaw, 3.4 * this.focusAmount, dt);
    } else if (this.manualTimer <= 0 && c.moving && c.speed > 0.5) {
      // auto-centre behind the player while walking
      this.yaw = dampAngle(this.yaw, c.heading, 1.4, dt);
    }

    // blend toward the dialogue close-up framing
    const focusTarget = this.focus ? 1 : 0;
    this.focusAmount = THREE.MathUtils.damp(this.focusAmount, focusTarget, 5, dt);
    const distance = THREE.MathUtils.lerp(this.distance, 2.55, this.focusAmount);
    const targetOffset = THREE.MathUtils.lerp(this.targetOffset, 1.2, this.focusAmount);
    const pitch = THREE.MathUtils.lerp(this.pitch, 1.33, this.focusAmount * 0.65);

    // desired camera position around the player, in the planet's tangent frame
    const n = up.clone();
    const base = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
    if (base.lengthSq() < 1e-5) base.set(0, 0, 1).addScaledVector(n, -n.z);
    base.normalize();
    const right = new THREE.Vector3().crossVectors(n, base).normalize();
    const forward = new THREE.Vector3()
      .addScaledVector(base, Math.cos(this.yaw))
      .addScaledVector(right, Math.sin(this.yaw))
      .normalize();
    const back = forward.clone().negate();

    const target = c.position.clone().addScaledVector(n, targetOffset);
    const dir = new THREE.Vector3()
      .addScaledVector(n, Math.cos(pitch))
      .addScaledVector(back, Math.sin(pitch))
      .normalize();
    let desired = target.clone().addScaledVector(dir, distance);

    // avoid clipping through walls: pull the camera in when the ground/walls
    // intersect the target->camera ray. When the low ray is squeezed (narrow
    // alley / shop corner) we lift the camera and look down instead of pushing
    // the lens into the character's head.
    const toCam = desired.clone().sub(target);
    const freeDist = toCam.length();
    if (freeDist > 0.01) {
      const camDir = toCam.clone().normalize();
      const lowHit = this.collision.raycast(target, camDir, 7.5);
      let wanted = lowHit ? Math.max(0.9, lowHit.distance * 0.86) : freeDist;
      let base = target;
      if (wanted < 2.2) {
        // top-down rescue: lift above the low roofs and look down at the courier
        const highTarget = target.clone().addScaledVector(up, 3.4);
        const highHit = this.collision.raycast(highTarget, camDir, 4.5);
        const highWanted = highHit ? Math.max(1.0, highHit.distance * 0.8) : 2.0;
        if (!highHit || highWanted > 1.0) {
          base = highTarget;
          wanted = Math.max(1.0, highWanted);
        }
      }
      if (wanted < 0.9) {
        // last resort: overhead view, always keeps the courier on screen
        base = target.clone().addScaledVector(up, 3.2);
        wanted = 0.45;
      }
      const speed = wanted < this.collisionDist ? 22 : 6;
      this.collisionDist = this.collisionDist
        ? THREE.MathUtils.damp(this.collisionDist, wanted, speed, dt)
        : wanted;
      const dist = Math.min(this.collisionDist, freeDist);
      desired.copy(base).addScaledVector(camDir, dist);
    }

    // keep camera above ground
    const ground = this.collision.groundAt(desired);
    if (ground && desired.length() < ground.point.length() + 0.4) {
      desired.copy(target).addScaledVector(dir, this.distance * 0.5);
    }

    const lerp = 1 - Math.exp(-(this.manualTimer > 0 ? 18 : 8) * dt);
    this.currentTarget.lerp(target, 1 - Math.exp(-16 * dt));
    this.currentPos.lerp(desired, lerp);
    // dead-zone: when we are already at the desired spot, keep the frame
    // perfectly still instead of chasing sub-pixel differences.
    if (this.currentPos.distanceToSquared(desired) < 4e-6) this.currentPos.copy(desired);
    if (this.currentTarget.distanceToSquared(target) < 4e-6) this.currentTarget.copy(target);
    this.camera.position.copy(this.currentPos);
    this.camera.up.copy(this.frameUp);
    this.camera.lookAt(this.currentTarget);
  }
}
