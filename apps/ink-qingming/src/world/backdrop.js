/**
 * backdrop.js —— 长卷的远景与雾。
 *
 * 清明上河图的背景其实很空：一片绢色，几抹远树、几段淡墨的城郭剪影，
 * 全靠雾把它们化进纸里。这里用几层手绘的远树/城影条幅 + 漂移的雾带。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { makeRng } from '../lib/rand.js';

function treeStripTexture() {
  const w = 2048;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rng = makeRng(8811);
  ctx.clearRect(0, 0, w, h);
  // 远树：一排软边的墨点，越远越淡
  for (let layer = 0; layer < 3; layer++) {
    const alpha = 0.18 - layer * 0.05;
    for (let i = 0; i < 260; i++) {
      const x = rng() * w;
      const y = h * (0.55 + rng() * 0.4);
      const r = 6 + rng() * 22;
      const g = ctx.createRadialGradient(x, y - r, 0, x, y - r, r);
      g.addColorStop(0, `rgba(52,60,56,${alpha})`);
      g.addColorStop(1, 'rgba(52,60,56,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r * 2, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function citySilhouetteTexture() {
  const w = 2048;
  const h = 320;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rng = makeRng(3311);
  ctx.clearRect(0, 0, w, h);
  const ink = 'rgba(58,62,55,';
  // 远处一条城墙 + 城门楼 + 几座塔，极淡
  ctx.fillStyle = ink + '0.14)';
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  // 城垛
  ctx.fillStyle = ink + '0.18)';
  for (let x = 0; x < w; x += 26) ctx.fillRect(x, h * 0.46, 12, 14);
  // 城门楼
  for (const cx of [w * 0.52, w * 0.86]) {
    ctx.fillStyle = ink + '0.2)';
    ctx.fillRect(cx - 46, h * 0.3, 92, h * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx - 66, h * 0.3);
    ctx.quadraticCurveTo(cx, h * 0.16, cx + 66, h * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  // 塔
  for (let i = 0; i < 5; i++) {
    const x = rng() * w;
    const base = h * 0.5;
    ctx.fillStyle = ink + (0.1 + rng() * 0.08) + ')';
    ctx.fillRect(x - 4, base - 90, 8, 90);
    for (let k = 0; k < 4; k++) {
      const y = base - 90 + k * 18;
      ctx.fillRect(x - 16 + k * 3, y, 32 - k * 6, 5);
    }
  }
  // 远处成片的屋顶（城里的坊巷，只作剪影）
  for (let row = 0; row < 5; row++) {
    const y = h * (0.42 + row * 0.055);
    const roofH = h * (0.05 + 0.012 * row);
    for (let x = 0; x < w; x += 18 + rng() * 26) {
      const bw = 12 + rng() * 26;
      ctx.fillStyle = ink + (0.2 + row * 0.02) + ')';
      ctx.beginPath();
      ctx.moveTo(x, y + roofH);
      ctx.quadraticCurveTo(x + bw * 0.5, y - roofH * 0.9, x + bw, y + roofH);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 远树
  for (let i = 0; i < 500; i++) {
    const x = rng() * w;
    const y = h * (0.55 + rng() * 0.35);
    const r = 4 + rng() * 12;
    const g = ctx.createRadialGradient(x, y - r, 0, x, y - r, r);
    g.addColorStop(0, ink + (0.08 + rng() * 0.1) + ')');
    g.addColorStop(1, ink + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r * 2, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mistTexture() {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w;
    const y = h * (0.3 + Math.random() * 0.5);
    const rx = 60 + Math.random() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, 'rgba(245,238,224,0.55)');
    g.addColorStop(1, 'rgba(245,238,224,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.22);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function buildBackdrop(ctx) {
  const group = new THREE.Group();
  group.name = 'backdrop';

  // —— 远城剪影：城墙、门楼、塔，压在树带后面 ——
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: citySilhouetteTexture(),
      transparent: true,
      opacity: 0.72 - i * 0.22,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(820, 74 - i * 8), mat);
    plane.position.set(i === 0 ? 200 : 20, 16 - i * 2, -820 - i * 40);
    plane.renderOrder = 2;
    group.add(plane);
  }

  // —— 远树三层：北岸尽头的树影 ——
  const treeTex = treeStripTexture();
  for (let i = 0; i < 3; i++) {
    const z = -800 - i * 30;
    const mat = new THREE.MeshBasicMaterial({
      map: treeTex,
      transparent: true,
      opacity: 0.5 - i * 0.12,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    mat.map = treeTex.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(2.4, 1);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(760, 64 + i * 16), mat);
    plane.position.set(0, 12 + i * 6, z);
    plane.renderOrder = 2;
    group.add(plane);
  }

  // —— 漂移的雾带 ——
  const mistTex = mistTexture();
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  mistMat.map.repeat.set(3, 1);
  const mists = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(620, 34), mistMat.clone());
    m.material.opacity = 0.24 + i * 0.06;
    m.position.set(0, 5 + i * 3.0, -780 - i * 40);
    m.renderOrder = 3;
    group.add(m);
    mists.push(m);
  }

  // —— 远岸收口：一道竖直的绢色雾墙，把地面尽头化进纸里 ——
  {
    const cw = 1024;
    const ch = 256;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g2 = c.getContext('2d');
    const lg = g2.createLinearGradient(0, 0, 0, ch);
    lg.addColorStop(0, 'rgba(239,229,207,0.95)');
    lg.addColorStop(0.45, 'rgba(239,229,207,0.75)');
    lg.addColorStop(1, 'rgba(239,229,207,0)');
    g2.fillStyle = lg;
    g2.fillRect(0, 0, cw, ch);
    const wt = new THREE.CanvasTexture(c);
    wt.colorSpace = THREE.SRGBColorSpace;
    const wm = new THREE.MeshBasicMaterial({
      map: wt,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(900, 90), wm);
    wall.position.set(0, 30, -775);
    wall.renderOrder = 2;
    group.add(wall);
  }

  ctx.onTick?.((time) => {
    for (let i = 0; i < mists.length; i++) {
      const m = mists[i];
      m.position.x = Math.sin(time * 0.012 + i * 1.7) * 24;
      m.material.map.offset.x = time * (0.003 + i * 0.0015);
    }
  });

  return group;
}
