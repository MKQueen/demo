/**
 * labels.js —— 地标朱印。
 *
 * 地标标签是 HTML 元素：3D 里只存一个锚点，每帧投影到屏幕。
 * 这样字体永远清晰、竖排排版交给 CSS，还能直接 hover / 点击。
 * 标签随距离淡出、随距离轻微缩放，避免远处一片红块。
 */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Labels {
  constructor({ container, camera, landmarks, onPick }) {
    this.container = container;
    this.camera = camera;
    this.onPick = onPick;
    this.enabled = false;
    this.activeId = null;
    this.items = [];
    this._v = new THREE.Vector3();
    this._cam = new THREE.Vector3();
    this._size = new THREE.Vector2();
    this._placed = [];
    this._lastViewDist = 300;

    for (const landmark of landmarks) {
      const el = document.createElement('button');
      el.className = 'label';
      el.type = 'button';
      el.setAttribute('aria-label', `查看${landmark.name}`);
      el.innerHTML = `<span class="label-stem"></span><span class="label-tag">${landmark.name}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPick?.(landmark);
      });
      container.appendChild(el);
      this.items.push({
        landmark,
        el,
        pos: new THREE.Vector3(...landmark.anchor),
      });
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) for (const it of this.items) it.el.classList.remove('is-visible');
  }

  setActive(id) {
    this.activeId = id;
    for (const it of this.items) it.el.classList.toggle('is-active', it.landmark.id === id);
  }

  /**
   * @param {number} viewDist 相机到观察目标的距离，用来决定「这一屏该显示哪些地标」：
   *   贴地看长城时，几百单位外的城里地标不该挤在画面里。
   */
  update(viewDist = this._lastViewDist) {
    if (!this.enabled) return;
    for (const it of this.items) {
      it.el.classList.remove('is-visible');
      it.el.tabIndex = -1;
      it.el.setAttribute('aria-hidden', 'true');
    }
    this._lastViewDist = viewDist;
    this.camera.updateMatrixWorld();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const camPos = this.camera.position;
    const maxDist = clamp(viewDist * 2.8 + 60, 220, 1500);
    const placed = [];

    // 近的先占位，远的让路：先按相机距离排序
    const candidates = [];
    for (const it of this.items) {
      this._cam.copy(it.pos).applyMatrix4(this.camera.matrixWorldInverse);
      if (this._cam.z > -this.camera.near) continue;
      const dist = camPos.distanceTo(it.pos);
      if (dist > maxDist) continue;
      this._v.copy(it.pos).project(this.camera);
      const x = (this._v.x * 0.5 + 0.5) * w;
      const y = Math.max((-this._v.y * 0.5 + 0.5) * h, 120);
      if (x < 34 || x > w - 34 || y > h - 74) continue;
      candidates.push({ it, x, y, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    // 拉远看全城时数量太多会堆叠：只保留最近的一批
    const maxLabels = window.innerWidth < 720 ? 4 : viewDist > 220 ? 6 : 7;
    if (candidates.length > maxLabels) candidates.length = maxLabels;

    for (const c of candidates) {
      const { it, x, y, dist } = c;
      const active = it.landmark.id === this.activeId;
      // 标签尺寸（竖排红签）用于避让：用真实 DOM 尺寸 × 距离缩放
      const scaleGuess = clamp(1.1 - (dist - 40) / 2400, 0.62, 1.1);
      const bw = Math.max(28, (it.el.offsetWidth || 34) * scaleGuess);
      const bh = Math.max(64, (it.el.offsetHeight || 96) * scaleGuess);
      const rect = { x0: x - bw / 2, x1: x + bw / 2, y0: y - bh, y1: y };
      const overlaps = placed.some(
        (r) => !(rect.x1 < r.x0 - 6 || rect.x0 > r.x1 + 6 || rect.y1 < r.y0 - 6 || rect.y0 > r.y1 + 6),
      );
      if (overlaps && !active) {
        it.el.classList.remove('is-visible');
        continue;
      }
      placed.push(rect);
      const scale = scaleGuess;
      const fade = clamp(1.2 - (dist - maxDist * 0.62) / (maxDist * 0.42), 0.22, 1);
      it.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      it.el.style.opacity = String(active ? 1 : fade);
      it.el.classList.add('is-visible');
      it.el.tabIndex = 0;
      it.el.setAttribute('aria-hidden', 'false');
    }

    // 没有进入候选的（被排除/被挤掉）统一隐藏
    for (const it of this.items) {
      if (!placed.length || !candidates.some((c) => c.it === it)) {
        if (it.landmark.id !== this.activeId) it.el.classList.remove('is-visible');
      }
    }
  }
}
