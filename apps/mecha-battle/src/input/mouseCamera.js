import * as THREE from 'three';

/**
 * MouseCamera —— 给 STEEL DAWN 增加「鼠标看视角」。
 *
 * 战斗相机原本完全由 combatFrame 脚本驱动，鼠标没有任何作用。这里在
 * 脚本相机算出的「基准位姿」之上叠加一个环绕（yaw / pitch）和缩放（scale）偏移：
 *
 *   左键拖拽 / 右键拖拽 → 绕当前注视点旋转视角
 *   滚轮                → 拉近 / 拉远
 *   双击 / X            → 视角复位
 *
 * 战斗状态下停手约 3 秒会自动缓慢回到标准战斗构图，保证不会因为视角被转走
 * 而看不清双方动作；主菜单里则保留玩家自己转的角度。
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 这些元素上的指针事件视为 UI 操作，不触发视角旋转 */
const UI_SELECTOR =
  'button, a, input, select, textarea, label, kbd, dialog, [contenteditable="true"], [data-no-camera-drag]';

const YAW_SENSITIVITY = 0.0042;
const PITCH_SENSITIVITY = 0.0026;
const PITCH_MIN = -0.42;
const PITCH_MAX = 0.5;
const SCALE_MIN = 0.62;
const SCALE_MAX = 1.85;
const IDLE_RECENTER_MS = 3200;
const SMOOTH = 14;
const SCALE_SMOOTH = 9;

export class MouseCamera {
  /**
   * @param {HTMLElement} domElement 渲染画布（用于设置 grab 光标）
   * @param {{ isEnabled?: () => boolean }} [options]
   */
  constructor(domElement, { isEnabled = () => true } = {}) {
    this.dom = domElement;
    this.isEnabled = isEnabled;

    this.dragging = false;
    this.pointerId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.dragDistance = 0;

    /** 目标偏移（用户输入后立即变化） */
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.targetScale = 1;
    /** 平滑后的实际偏移 */
    this.yaw = 0;
    this.pitch = 0;
    this.scale = 1;
    this.lastInputAt = performance.now();

    this._offset = new THREE.Vector3();
    this._spherical = new THREE.Spherical();

    this._onPointerDown = (event) => this.handlePointerDown(event);
    this._onPointerMove = (event) => this.handlePointerMove(event);
    this._onPointerUp = (event) => this.handlePointerUp(event);
    this._onWheel = (event) => this.handleWheel(event);
    this._onContextMenu = (event) => this.handleContextMenu(event);
    this._onDoubleClick = (event) => this.handleDoubleClick(event);

    // capture 阶段监听：即使主菜单遮罩层覆盖画布，也能接到拖拽
    window.addEventListener('pointerdown', this._onPointerDown, { capture: true, passive: true });
    window.addEventListener('pointermove', this._onPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', this._onPointerUp, { capture: true, passive: true });
    window.addEventListener('wheel', this._onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', this._onContextMenu, { capture: true, passive: false });
    window.addEventListener('dblclick', this._onDoubleClick, { capture: true, passive: true });

    if (domElement instanceof HTMLElement) domElement.style.cursor = 'grab';
  }

  isUiTarget(target) {
    return target instanceof Element && !!target.closest(UI_SELECTOR);
  }

  handlePointerDown(event) {
    if (!this.isEnabled() || this.dragging) return;
    if (event.button !== 0 && event.button !== 2) return;
    if (this.isUiTarget(event.target)) return;
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.dragDistance = 0;
    this.lastInputAt = performance.now();
    document.body.classList.add('camera-dragging');
  }

  handlePointerMove(event) {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (!dx && !dy) return;

    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    if (this.dragDistance > 3 && event.cancelable) event.preventDefault();

    // 直接操作感：向右拖 → 视角绕到目标右侧；向下拖 → 机位抬高俯视
    this.targetYaw -= dx * YAW_SENSITIVITY;
    this.targetPitch = clamp(this.targetPitch + dy * PITCH_SENSITIVITY, PITCH_MIN, PITCH_MAX);
    this.lastInputAt = performance.now();
  }

  handlePointerUp(event) {
    if (!this.dragging) return;
    if (event.pointerId !== undefined && event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    document.body.classList.remove('camera-dragging');
  }

  handleWheel(event) {
    if (!this.isEnabled()) return;
    if (this.isUiTarget(event.target)) return;
    if (event.cancelable) event.preventDefault();
    const step = Math.sign(event.deltaY) * 0.1;
    this.targetScale = clamp(this.targetScale + step, SCALE_MIN, SCALE_MAX);
    this.lastInputAt = performance.now();
  }

  handleContextMenu(event) {
    if (!this.isEnabled()) return;
    if (this.isUiTarget(event.target)) return;
    // 右键用于拖拽视角，屏蔽浏览器右键菜单
    event.preventDefault();
  }

  handleDoubleClick(event) {
    if (!this.isEnabled() || this.isUiTarget(event.target)) return;
    this.reset();
  }

  /** 立即复位到脚本相机构图 */
  reset() {
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.targetScale = 1;
    this.lastInputAt = performance.now();
  }

  /** 中断当前拖拽（暂停 / 切场景时调用） */
  cancel() {
    this.dragging = false;
    this.pointerId = null;
    document.body.classList.remove('camera-dragging');
  }

  get active() {
    return (
      this.dragging ||
      Math.abs(this.yaw) > 1e-4 ||
      Math.abs(this.pitch) > 1e-4 ||
      Math.abs(this.scale - 1) > 1e-4
    );
  }

  /** 每帧平滑偏移；recenter=true 时停手一段时间后缓慢回到标准构图 */
  update(dt, recenter) {
    const now = performance.now();
    if (
      recenter &&
      !this.dragging &&
      now - this.lastInputAt > IDLE_RECENTER_MS &&
      this.active
    ) {
      const k = 1 - Math.exp(-1.4 * dt);
      this.targetYaw += (0 - this.targetYaw) * k;
      this.targetPitch += (0 - this.targetPitch) * k;
      this.targetScale += (1 - this.targetScale) * k;
    }

    const k = 1 - Math.exp(-SMOOTH * dt);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    const ks = 1 - Math.exp(-SCALE_SMOOTH * dt);
    this.scale += (this.targetScale - this.scale) * ks;
  }

  /**
   * 把偏移叠加到相机上：camera 与 target 由脚本相机决定，
   * 这里只改变「相机相对 target 的球坐标」。
   */
  apply(camera, target, dt, recenter = false) {
    this.update(dt, recenter);
    if (!this.active) return;

    this._offset.copy(camera.position).sub(target);
    const radius = this._offset.length();
    if (radius < 1e-3) return;

    this._spherical.setFromVector3(this._offset);
    this._spherical.theta += this.yaw;

    // pitch 是「抬高机位」量：向上拖动会让 phi 变小（相机更高）
    this._spherical.phi = clamp(this._spherical.phi - this.pitch, 0.16, 1.42);
    this._spherical.radius = radius * this.scale;
    this._spherical.makeSafe();

    this._offset.setFromSpherical(this._spherical);
    camera.position.copy(target).add(this._offset);
  }

  destroy() {
    this.cancel();
    window.removeEventListener('pointerdown', this._onPointerDown, { capture: true });
    window.removeEventListener('pointermove', this._onPointerMove, { capture: true });
    window.removeEventListener('pointerup', this._onPointerUp, { capture: true });
    window.removeEventListener('pointercancel', this._onPointerUp, { capture: true });
    window.removeEventListener('wheel', this._onWheel, { capture: true });
    window.removeEventListener('contextmenu', this._onContextMenu, { capture: true });
    window.removeEventListener('dblclick', this._onDoubleClick, { capture: true });
    if (this.dom instanceof HTMLElement) this.dom.style.cursor = '';
  }
}
