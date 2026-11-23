/**
 * camera-rig.js —— 一只「手」，托着整幅画。
 *
 * 交互：拖拽旋转（方位角 + 俯仰）、滚轮推拉、右键/双指平移、双指捏合缩放。
 * 相机始终看向 target，球坐标绕 target 转；所有量都带阻尼，避免机械感。
 * 点击地标时用 flyTo 缓动过去 —— 像把目光慢慢移到那座塔上。
 */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;

    this.target = new THREE.Vector3(0, 0, 0);
    this.targetGoal = new THREE.Vector3(0, 0, 0);
    this.azimuth = 0.4;
    this.azimuthGoal = 0.4;
    this.elevation = 0.6;
    this.elevationGoal = 0.6;
    this.dist = 300;
    this.distGoal = 300;

    this.minDist = 5;
    this.maxDist = 520;
    this.minElevation = 0.04; // 接近地平线
    this.maxElevation = 1.44; // 接近正俯视

    this.home = null;
    this.tween = null;
    this.userActive = false;

    this._pointers = new Map();
    this._mode = null;
    this._last = { x: 0, y: 0 };
    this._pinchDist = 0;

    this._bind();
  }

  /** 初始机位（不需要动画）。 */
  setHome(view) {
    this.home = view;
    this.setView(view, { instant: true });
  }

  setView(view = {}, { instant = false, duration = 1.5 } = {}) {
    const target = view.target ? new THREE.Vector3(...view.target) : this.targetGoal.clone();
    const dist = view.dist ?? this.distGoal;
    const azimuth = view.azimuth ?? this.azimuthGoal;
    const elevation = view.elevation ?? this.elevationGoal;
    if (instant) {
      this.tween = null;
      this.target.copy(target);
      this.targetGoal.copy(target);
      this.dist = this.distGoal = clamp(dist, this.minDist, this.maxDist);
      this.azimuth = this.azimuthGoal = azimuth;
      this.elevation = this.elevationGoal = clamp(elevation, this.minElevation, this.maxElevation);
      this.update(0, true);
      return;
    }
    this.tween = {
      t: 0,
      duration,
      from: {
        target: this.target.clone(),
        dist: this.dist,
        azimuth: this.azimuth,
        elevation: this.elevation,
      },
      to: { target, dist, azimuth, elevation: clamp(elevation, this.minElevation, this.maxElevation) },
    };
  }

  focusLandmark(landmark, { duration = 1.6 } = {}) {
    if (!landmark) return;
    this.setView(
      {
        target: landmark.target || landmark.anchor,
        dist: landmark.dist ?? 80,
        azimuth: landmark.azimuth ?? this.azimuth,
        elevation: landmark.elevation ?? 0.5,
      },
      { duration },
    );
  }

  reset(duration = 1.8) {
    if (!this.home) return;
    this.setView(this.home, { duration });
  }

  update(dt = 0.016, force = false) {
    // 相机缓动
    if (this.tween) {
      this.tween.t += dt;
      const k = clamp(this.tween.t / this.tween.duration, 0, 1);
      const e = easeInOutCubic(k);
      const { from, to } = this.tween;
      this.target.lerpVectors(from.target, to.target, e);
      this.dist = from.dist + (to.dist - from.dist) * e;
      // 方位角走最短路径
      let da = to.azimuth - from.azimuth;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.azimuth = from.azimuth + da * e;
      this.elevation = from.elevation + (to.elevation - from.elevation) * e;
      this.targetGoal.copy(this.target);
      this.distGoal = this.dist;
      this.azimuthGoal = this.azimuth;
      this.elevationGoal = this.elevation;
      if (k >= 1) this.tween = null;
    } else if (!force) {
      // 阻尼跟随
      const k = 1 - Math.exp(-dt * 7.5);
      this.target.lerp(this.targetGoal, k);
      this.dist += (this.distGoal - this.dist) * k;
      let da = this.azimuthGoal - this.azimuth;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.azimuth += da * k;
      this.elevation += (this.elevationGoal - this.elevation) * k;
    }

    // 球坐标 → 世界坐标
    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    const x = this.target.x + this.dist * ce * Math.sin(this.azimuth);
    const z = this.target.z + this.dist * ce * Math.cos(this.azimuth);
    const y = this.target.y + this.dist * se;
    // 不许钻到纸下面
    this.camera.position.set(x, Math.max(y, 0.7), z);
    this.camera.lookAt(this.target);
  }

  /** 让地标标签/其他系统知道相机是否在动 */
  get moving() {
    return (
      !!this.tween ||
      this.target.distanceToSquared(this.targetGoal) > 1e-4 ||
      Math.abs(this.dist - this.distGoal) > 0.01 ||
      Math.abs(this.azimuth - this.azimuthGoal) > 1e-4 ||
      Math.abs(this.elevation - this.elevationGoal) > 1e-4
    );
  }

  /* ------------------------------------------------------------------------ */

  _bind() {
    const dom = this.dom;
    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    window.addEventListener('pointercancel', (e) => this._onUp(e));
    dom.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // 键盘：方向键微调，R 回正
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const step = e.shiftKey ? 0.12 : 0.045;
      if (e.key === 'ArrowLeft') this.azimuthGoal += step;
      else if (e.key === 'ArrowRight') this.azimuthGoal -= step;
      else if (e.key === 'ArrowUp') this.elevationGoal = clamp(this.elevationGoal + step * 0.8, this.minElevation, this.maxElevation);
      else if (e.key === 'ArrowDown') this.elevationGoal = clamp(this.elevationGoal - step * 0.8, this.minElevation, this.maxElevation);
      else if (e.key === 'r' || e.key === 'R') this.reset();
    });
  }

  _onDown(e) {
    if (e.target.closest && e.target.closest('.card, .seal-btn, .ink-range, .label, #intro')) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._last = { x: e.clientX, y: e.clientY };
    this._mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this._mode = 'pinch';
    }
    this.userActive = true;
    this.dom.setPointerCapture?.(e.pointerId);
  }

  _onMove(e) {
    if (!this._pointers.has(e.pointerId)) return;
    const prev = this._pointers.get(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this._last = { x: e.clientX, y: e.clientY };

    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinchDist > 0) {
        const k = clamp(this._pinchDist / Math.max(1, d), 0.5, 2);
        this.distGoal = clamp(this.distGoal * k, this.minDist, this.maxDist);
      }
      this._pinchDist = d;
      return;
    }

    if (this._mode === 'pan') {
      const speed = this.dist * 0.0016;
      const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
      const forward = new THREE.Vector3(Math.sin(this.azimuth), 0, Math.cos(this.azimuth));
      this.targetGoal.addScaledVector(right, -dx * speed);
      this.targetGoal.addScaledVector(forward, dy * speed);
      this.tween = null;
    } else {
      this.azimuthGoal -= dx * 0.0052;
      this.elevationGoal = clamp(this.elevationGoal + dy * 0.0038, this.minElevation, this.maxElevation);
      this.tween = null;
    }
  }

  _onUp(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size === 0) {
      this._mode = null;
      this.userActive = false;
    } else if (this._pointers.size === 1) {
      const [p] = [...this._pointers.values()];
      this._last = p;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const k = Math.exp(clamp(e.deltaY, -260, 260) * 0.0012);
    this.distGoal = clamp(this.distGoal * k, this.minDist, this.maxDist);
    this.tween = null;
  }
}
