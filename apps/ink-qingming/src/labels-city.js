/**
 * labels-city.js —— 全城地标的朱印签（只在全城视角显示）。
 */
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class CityLabels {
  constructor({ container, camera, landmarks, onPick }) {
    this.container = container;
    this.camera = camera;
    this.onPick = onPick;
    this.enabled = false;
    this.items = [];
    for (const lm of landmarks) {
      const el = document.createElement('button');
      el.className = 'label label--city';
      el.type = 'button';
      el.innerHTML = `<span class="label-tag">${lm.name || lm.seal}</span>`;
      el.addEventListener('click', () => this.onPick?.(lm));
      this.container.appendChild(el);
      this.items.push({ lm, el });
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) for (const it of this.items) it.el.classList.remove('is-visible');
  }

  update() {
    if (!this.enabled) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const it of this.items) {
      _v.set(it.lm.x, 24, it.lm.z).project(this.camera);
      const sx = (_v.x * 0.5 + 0.5) * w;
      const sy = (-_v.y * 0.5 + 0.5) * h;
      const vis = _v.z < 1 && sx > 60 && sx < w - 60 && sy > 80 && sy < h - 160;
      it.el.classList.toggle('is-visible', vis);
      if (vis) it.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
  }
}
