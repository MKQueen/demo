/**
 * camera-scroll.js —— 长卷的「展卷」相机。
 *
 * 不是自由 Orbiter：清明上河图是一卷横向的画，观众的眼睛沿着画往右走。
 * 所以相机主要自由度只有一个——卷轴进度 t（0 = 卷首郊野，1 = 卷尾街市），
 * 次要自由度是远近 / 一点仰角 / 一点左右偏角，用来让人觉得这是一卷有厚度的画。
 *
 * 交互：
 *   - 横向拖动 / 滚轮 / ← → ：展卷
 *   - 纵向拖动 / Ctrl+滚轮：仰角与远近
 *   - 点卷下「五段」标记：跳到该段
 *   - 停手一会儿自动缓缓展卷（可在界面里关）
 */
import * as THREE from 'three';
import { CAMERA, SCROLL, SCENES, pathAt, pathTangent, tToX, xToT } from './layout.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t; // 卷轴是匀速的，不需要缓动

export class CameraScroll {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.t = 0;
    this.targetT = 0;
    this.dist = CAMERA.dist;
    this.targetDist = CAMERA.dist;
    this.elevation = CAMERA.elevation;
    this.targetElevation = CAMERA.elevation;
    this.azimuth = CAMERA.azimuth;
    this.targetAzimuth = CAMERA.azimuth;
    this.targetZ = CAMERA.targetZ;
    this.targetY = CAMERA.targetY;
    this.enabled = true;
    this.auto = true;
    this.autoSpeed = 0.017; // 每秒展卷比例
    this.userTouched = false;

    this._pointer = null;
    this._last = { x: 0, y: 0 };
    this._bind();
    this._apply(1);
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      this._pointer = e.pointerId;
      this._last = { x: e.clientX, y: e.clientY };
      c.setPointerCapture?.(e.pointerId);
      this.userTouched = true;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.enabled || this._pointer !== e.pointerId) return;
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last = { x: e.clientX, y: e.clientY };
      const k = 1 / Math.max(400, window.innerWidth);
      this.targetT = clamp(this.targetT - dx * k * 0.9, 0, 1);
      this.targetElevation = clamp(
        this.targetElevation + dy * 0.0016,
        CAMERA.minElevation,
        CAMERA.maxElevation,
      );
    });
    const end = (e) => {
      if (this._pointer !== e.pointerId) return;
      this._pointer = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.userTouched = true;
        if (e.ctrlKey || e.metaKey) {
          this.targetDist = clamp(this.targetDist + e.deltaY * 0.12, CAMERA.minDist, CAMERA.maxDist);
        } else {
          const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
          this.targetT = clamp(this.targetT + d * 0.00035, 0, 1);
        }
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        this.targetT = clamp(this.targetT + 0.02, 0, 1);
        this.userTouched = true;
      } else if (e.key === 'ArrowLeft') {
        this.targetT = clamp(this.targetT - 0.02, 0, 1);
        this.userTouched = true;
      }
    });
  }

  /** 重置到指定进度。 */
  setT(t, { instant = false } = {}) {
    this.targetT = clamp(t, 0, 1);
    if (instant) {
      this.t = this.targetT;
      this._apply(1);
    }
  }

  /** 跳到某世界 x。 */
  jumpToX(x, opts) {
    this.setT(xToT(x), opts);
  }

  /** 卷首 → 卷尾自动展卷的开关。 */
  setAuto(on) {
    this.auto = !!on;
    this.userTouched = false;
  }

  /** 当前镜头目标点（世界坐标）。 */
  targetPoint(out = new THREE.Vector3()) {
    const [x, z] = pathAt(this.t);
    return out.set(x, this.targetY, z);
  }

  /** 相机离卷心的距离（给界面 / 标签用）。 */
  get viewDist() {
    return this.dist;
  }

  /** 长卷八段的镜头预设：按 t 在相邻两段之间插值。 */
  _presetAt() {
    const list = SCENES;
    if (!list.length || !list[0].cam) return null;
    let a = list[0];
    let b = list[list.length - 1];
    for (let i = 0; i < list.length - 1; i++) {
      if (this.t >= list[i].t && this.t <= list[i + 1].t) {
        a = list[i];
        b = list[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = Math.max(0, Math.min(1, (this.t - a.t) / span));
    const smooth = k * k * (3 - 2 * k);
    const ca = a.cam || CAMERA;
    const cb = b.cam || CAMERA;
    const mix = (p, q, f) => (p == null ? q : q == null ? p : p + (q - p) * f);
    return {
      dist: mix(ca.dist, cb.dist, smooth),
      elevation: mix(ca.elevation, cb.elevation, smooth),
      azimuth: mix(ca.azimuth, cb.azimuth, smooth),
    };
  }

  update(dt) {
    if (!this.enabled) return;
    if (this.auto && !this._pointer) {
      this.targetT += dt * this.autoSpeed;
      if (this.targetT >= 1) this.targetT = 1;
    }
    const k = 1 - Math.exp(-dt * 4.2);
    this.t += (this.targetT - this.t) * k;
    const ke = 1 - Math.exp(-dt * 6);
    // 按段落预设平滑地推拉/俯仰，像有人在慢慢移动看画
    const p = this._presetAt();
    if (p) {
      this.targetDist = p.dist;
      this.targetElevation = p.elevation;
      this.targetAzimuth = p.azimuth;
    }
    this.dist += (this.targetDist - this.dist) * ke;
    this.elevation += (this.targetElevation - this.elevation) * ke;
    this.azimuth += (this.targetAzimuth - this.azimuth) * ke;
    if (Math.abs(this.t - this.targetT) < 0.0004) this.t = this.targetT;
    this._apply(dt);
  }

  _apply() {
    const [x, z] = pathAt(this.t);
    const target = new THREE.Vector3(x, this.targetY, z);
    const ce = Math.cos(this.elevation);
    const dir = new THREE.Vector3(
      Math.sin(this.azimuth) * ce,
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * ce,
    );
    this.camera.position.copy(target).addScaledVector(dir, this.dist);
    this.camera.lookAt(target.x, target.y + 2.2, target.z);
    this.camera.updateMatrixWorld();
  }
}
