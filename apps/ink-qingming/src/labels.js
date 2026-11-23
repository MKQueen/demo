/**
 * labels.js —— 长卷五段的朱印签。
 *
 * 五段各有坐标：郊野 / 河市 / 桥市 / 城门 / 街市。
 * 每帧把世界坐标投影到屏幕，签子按远近缩放、按屏幕外裁掉；
 * 点签子 = 展卷到那一段并弹出纸卡。
 */
import * as THREE from 'three';
import { riverZ } from './layout.js';

const _v = new THREE.Vector3();

export class SceneLabels {
  constructor({ container, camera, scenes, onPick, y = 14 }) {
    this.container = container;
    this.camera = camera;
    this.scenes = scenes;
    this.onPick = onPick;
    this.y = y;
    this.enabled = false;
    this.activeId = null;
    this.items = [];

    for (const s of scenes) {
      const el = document.createElement('button');
      el.className = 'label';
      el.type = 'button';
      el.innerHTML = `<span class="label-tag">${s.name}</span><span class="label-sub">${s.en}</span><span class="label-stem"></span>`;
      el.addEventListener('click', () => this.onPick?.(s));
      this.container.appendChild(el);
      this.items.push({ scene: s, el, x: s.at?.[0] ?? s.x, z: (s.at?.[1] ?? -4) + 4 });
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  setActive(id) {
    this.activeId = id;
    for (const it of this.items) it.el.classList.toggle('is-active', it.scene.id === id);
  }

  update(rig) {
    if (!this.enabled) {
      for (const it of this.items) it.el.classList.remove('is-visible');
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const camX = rig.targetPoint(_v).x;
    for (const it of this.items) {
      _v.set(it.x, this.y + 6, it.z);
      _v.project(this.camera);
      const sx = (_v.x * 0.5 + 0.5) * w;
      const sy = (-_v.y * 0.5 + 0.5) * h;
      const dx = Math.abs(it.x - camX);
      const inView = sx > 70 && sx < w - 70 && sy > 80 && sy < h - 150 && _v.z < 1 && dx < 170;
      it.el.classList.toggle('is-visible', inView);
      if (!inView) continue;
      const scale = Math.max(0.6, Math.min(1, 1.15 - dx / 380));
      it.el.style.transform = `translate(${sx.toFixed(1)}px, ${(sy + 34).toFixed(1)}px) scale(${scale.toFixed(3)})`;
    }
  }
}
