import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const rad = (deg) => (deg * Math.PI) / 180;
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = 9317) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(w, h, draw) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const glowCache = new Map();
export function glowTexture(color = '#9ffcff', soft = 1) {
  const key = color + soft;
  if (glowCache.has(key)) return glowCache.get(key);
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, hexToRgba(color, 1));
    grd.addColorStop(0.14, hexToRgba(color, 0.9));
    grd.addColorStop(0.35, hexToRgba(color, 0.32 * soft));
    grd.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  });
  tex.userData.shared = true;
  glowCache.set(key, tex);
  return tex;
}

export function hexToRgba(hex, alpha = 1) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}

let smokeTex = null;
export function smokeTexture() {
  if (smokeTex) return smokeTex;
  smokeTex = canvasTexture(128, 128, (ctx, w, h) => {
    const grd = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(72, 70, 67, 0.55)');
    grd.addColorStop(0.4, 'rgba(45, 44, 43, 0.3)');
    grd.addColorStop(1, 'rgba(20, 20, 20, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(55);
    for (let i = 0; i < 32; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = rng() * 18 + 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(200, 190, 175, ${rng() * 0.09})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  smokeTex.userData.shared = true;
  return smokeTex;
}

let scorchTex = null;
export function scorchTexture() {
  if (scorchTex) return scorchTex;
  scorchTex = canvasTexture(256, 256, (ctx, w, h) => {
    const rng = mulberry32(224);
    const grd = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(4,4,4,0.92)');
    grd.addColorStop(0.45, 'rgba(9,8,7,0.68)');
    grd.addColorStop(0.75, 'rgba(14,12,10,0.24)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 94, 31, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const a = rng() * Math.PI * 2;
      const len = 30 + rng() * 90;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 16, h / 2 + Math.sin(a) * 16);
      let x = w / 2;
      let y = h / 2;
      for (let s = 0; s < 4; s++) {
        x += Math.cos(a + (rng() - 0.5) * 0.6) * len / 4;
        y += Math.sin(a + (rng() - 0.5) * 0.6) * len / 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  scorchTex.userData.shared = true;
  return scorchTex;
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of materials) {
        for (const key of Object.keys(m)) {
          const val = m[key];
          if (val && val.isTexture && !val.userData.shared) val.dispose();
        }
        m.dispose();
      }
    }
  });
  if (object.parent) object.parent.remove(object);
}

export function setShadow(object, cast = true, receive = false) {
  object.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}

export function makeBarSprite(color, width = 1.4, height = 0.14) {
  const canvas = makeCanvas(256, 32);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 8, 256, 16);
  ctx.fillStyle = color;
  ctx.fillRect(3, 11, 250, 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(width, height, 1);
  return s;
}

export function seededColor(rng, palette) {
  return new THREE.Color(palette[Math.floor(rng() * palette.length)]);
}

export function worldToScreen(vector3, camera, width, height) {
  const v = vector3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
    visible: v.z < 1 && v.z > -1,
  };
}

export function buildGlowSprite(color, scale = 2, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}
