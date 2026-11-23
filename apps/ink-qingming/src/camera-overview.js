/**
 * camera-overview.js —— 全城鸟瞰的简易轨道相机。
 * 拖动旋转、滚轮远近；点地标可直接飞到。
 */
import * as THREE from 'three';
import { OVERVIEW } from './layout.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class CameraOverview {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.target = new THREE.Vector3(...OVERVIEW.target);
    this.targetTarget = this.target.clone();
    this.azimuth = OVERVIEW.azimuth;
    this.targetAzimuth = this.azimuth;
    this.elevation = OVERVIEW.elevation;
    this.targetElevation = this.elevation;
    this.dist = OVERVIEW.dist;
    this.targetDist = this.dist;
    this.enabled = false;
    this._pointer = null;
    this._last = { x: 0, y: 0 };
    this._bind();
    this._apply();
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      this._pointer = e.pointerId;
      this._last = { x: e.clientX, y: e.clientY };
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.enabled || this._pointer !== e.pointerId) return;
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last = { x: e.clientX, y: e.clientY };
      this.targetAzimuth -= dx * 0.005;
      this.targetElevation = clamp(this.targetElevation + dy * 0.004, 0.14, 1.35);
    });
    const end = (e) => {
      if (this._pointer === e.pointerId) this._pointer = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.targetDist = clamp(this.targetDist * (1 + e.deltaY * 0.0012), OVERVIEW.minDist, OVERVIEW.maxDist);
    }, { passive: false });
  }

  focusAt(x, z, dist = 180) {
    this.targetTarget.set(x, 0, z);
    this.targetDist = dist;
    this.targetElevation = 0.7;
  }

  reset() {
    this.targetTarget.set(...OVERVIEW.target);
    this.targetDist = OVERVIEW.dist;
    this.targetAzimuth = OVERVIEW.azimuth;
    this.targetElevation = OVERVIEW.elevation;
  }

  update(dt) {
    if (!this.enabled) return;
    const k = 1 - Math.exp(-dt * 4.5);
    this.azimuth += (this.targetAzimuth - this.azimuth) * k;
    this.elevation += (this.targetElevation - this.elevation) * k;
    this.dist += (this.targetDist - this.dist) * k;
    this.target.lerp(this.targetTarget, k);
    this._apply();
  }

  _apply() {
    const ce = Math.cos(this.elevation);
    const dir = new THREE.Vector3(
      Math.sin(this.azimuth) * ce,
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * ce,
    );
    this.camera.position.copy(this.target).addScaledVector(dir, this.dist);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
