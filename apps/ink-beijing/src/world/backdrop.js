/**
 * backdrop.js —— 远景的那一道「远山如黛」。
 *
 * 为什么需要它：3D 地形里的西山/燕山在雾里会化得几乎看不见，
 * 而一张水墨画的天际线上必须有一道层次分明的山影——那是整幅画的「背景音乐」。
 * 这里用一张 360° 程序化画布，画三层远山 + 地平线雾气，
 * 贴在一个大圆筒内壁上（BackSide），相机绕到哪个方向都有山。
 *
 * 它不参与雾（否则会被雾色吃掉），但颜色本身已经调得极淡，
 * 只作为纸上的「淡墨一抹」，不抢主体。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { makeRng, fbm2 } from '../lib/rand.js';

const W = 4096;
const H = 768;

function makeRidgeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(20240511);

  // 透明底
  ctx.clearRect(0, 0, W, H);

  // 三层山：远、中、近。每层用若干整数频率正弦叠加，保证 360° 无缝。
  const layers = [
    {
      base: H * 0.6,
      amp: H * 0.16,
      color: [138, 148, 144],
      alpha: 0.42,
      freqs: [2, 3, 5, 8, 13],
      weights: [1, 0.62, 0.42, 0.24, 0.14],
      detail: 1.0,
    },
    {
      base: H * 0.72,
      amp: H * 0.2,
      color: [104, 116, 112],
      alpha: 0.55,
      freqs: [1, 2, 4, 7, 11],
      weights: [1, 0.7, 0.45, 0.28, 0.16],
      detail: 1.3,
    },
    {
      base: H * 0.86,
      amp: H * 0.22,
      color: [76, 89, 85],
      alpha: 0.66,
      freqs: [1, 3, 5, 9, 14],
      weights: [1, 0.55, 0.38, 0.22, 0.12],
      detail: 1.6,
    },
  ];

  const phases = layers.map(() => Array.from({ length: 8 }, () => rng() * Math.PI * 2));

  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const ph = phases[li];
    const pts = [];
    for (let x = 0; x <= W; x += 2) {
      const t = x / W;
      let v = 0;
      let norm = 0;
      for (let k = 0; k < L.freqs.length; k++) {
        v += Math.sin(t * Math.PI * 2 * L.freqs[k] + ph[k]) * L.weights[k];
        norm += L.weights[k];
      }
      v /= norm;
      // 高频细节：让山脊有毛边
      const n = fbm2(t * 22, li * 7.3, 13 + li, 4) * 0.22;
      const y = L.base - L.amp * (v * 0.85 + n * L.detail);
      pts.push([x, y]);
    }

    // 山体：从脊线往下填到画布底，底部换成为透明（化进纸里）
    const g = ctx.createLinearGradient(0, L.base - L.amp, 0, H);
    g.addColorStop(0, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},${L.alpha})`);
    g.addColorStop(0.72, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},${L.alpha * 0.92})`);
    g.addColorStop(1, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // 山脊线：一道更深的墨，强化「远山」的轮廓
    ctx.strokeStyle = `rgba(${L.color[0] - 16},${L.color[1] - 16},${L.color[2] - 16},${L.alpha * 0.55})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
      else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }

  // 地平线附近的一条极淡雾带
  const mist = ctx.createLinearGradient(0, H * 0.8, 0, H);
  mist.addColorStop(0, 'rgba(241,233,215,0)');
  mist.addColorStop(0.65, 'rgba(241,233,215,0.55)');
  mist.addColorStop(1, 'rgba(241,233,215,1)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, H * 0.8, W, H * 0.2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function buildBackdrop(ctx) {
  const group = new THREE.Group();
  group.name = 'backdrop';

  const tex = makeRidgeCanvas();
  const radius = 1900;
  const height = 640;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    opacity: 0.95,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(0, height * 0.5 - 12, 0);
  ring.renderOrder = -5;
  group.add(ring);

  // 圆筒底边压一圈纸色雾，把「山脚」和地面黏在一起
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 8;
  mistCanvas.height = 128;
  const mctx = mistCanvas.getContext('2d');
  const mg = mctx.createLinearGradient(0, 0, 0, 128);
  mg.addColorStop(0, 'rgba(239,230,212,0)');
  mg.addColorStop(1, 'rgba(239,230,212,0.9)');
  mctx.fillStyle = mg;
  mctx.fillRect(0, 0, 8, 128);
  const mistTex = new THREE.CanvasTexture(mistCanvas);
  mistTex.colorSpace = THREE.SRGBColorSpace;
  const mistGeo = new THREE.CylinderGeometry(radius - 6, radius - 6, height * 0.32, 96, 1, true);
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const mistRing = new THREE.Mesh(mistGeo, mistMat);
  mistRing.position.set(0, height * 0.16 - 12, 0);
  mistRing.renderOrder = -4;
  group.add(mistRing);

  group.userData.ring = ring;
  return group;
}
