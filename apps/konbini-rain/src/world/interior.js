/**
 * world/interior.js —— 便利店内部。
 *
 * 这是整个模型的视觉中心：干净的暖光、密实的商品、典型的日本便利店布局。
 * 从街上的玻璃窗看进来，要一眼认出「便利店」，并且和外面冷雨的夜形成强对比。
 *
 * 布局（店内净空间 x[-2.72,1.52] z[-4.42,0.82]，地面 y=0.14，天花板 y=2.52）：
 *   - 正面靠窗：杂志架 + 促销立牌，透过玻璃就能看到彩色封面
 *   - 中间：三排岛式货架（零食 / 泡面 / 日用品），上面挂 aisle 灯牌
 *   - 后墙：三扇发光玻璃门饮料冷柜
 *   - 左墙：便当 / 饭团开放式冷藏柜
 *   - 右后：L 形收银台 + 热食柜 + 关东煮 + 咖啡机 + 烟柜
 *   - 右墙：ATM、多功能复印机
 *   - 天花板：暖白长条灯箱 + 通风口 + 监控球机
 */
import * as THREE from 'three';
import { C, L, rng } from '../config.js';
import { TEX, canvasTexture, JP_FONT, EN_FONT, roundRect } from '../lib/textures.js';
import { toon, flat, lightbox, glow, addOutline, glowSprite } from '../lib/toon.js';
import { box, roundedBox, plane, mesh, group, cyl, sphere, torus, instanced, trs, shadow } from '../lib/kit.js';

const I = L.store.interior;
const FLOOR = I.floorY;
const CEIL = I.ceilY;
const MIDX = (I.minX + I.maxX) / 2;

/* ========================================================================== */
/*  局部纹理                                                                   */
/* ========================================================================== */

function floorTexture() {
  return canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      // 浅暖灰地砖，2×2 块/贴图，靠窗处更亮
      ctx.fillStyle = '#cec8b8';
      ctx.fillRect(0, 0, w, h);
      const rand = rng(202);
      const n = 4;
      const tile = w / n;
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const v = 196 + Math.floor(rand() * 16);
          ctx.fillStyle = `rgb(${v},${v - 4},${v - 16})`;
          ctx.fillRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6);
          for (let i = 0; i < 120; i += 1) {
            const px = x * tile + rand() * tile;
            const py = y * tile + rand() * tile;
            ctx.fillStyle = `rgba(120,110,92,${0.03 + rand() * 0.05})`;
            ctx.fillRect(px, py, 2, 2);
          }
        }
      }
      // 门口落尘
      const grd = ctx.createRadialGradient(w * 0.86, h * 0.9, 0, w * 0.86, h * 0.9, w * 0.3);
      grd.addColorStop(0, 'rgba(110,100,84,0.16)');
      grd.addColorStop(1, 'rgba(110,100,84,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: [2.2, 2.7] },
  );
}

function magazineTexture(i) {
  const covers = [
    { bg: '#e9d8bd', accent: '#d95f46', title: 'アニメ', sub: '冬の新作' },
    { bg: '#20304f', accent: '#ffc96b', title: '週刊 旅', sub: '雪の温泉' },
    { bg: '#a8d8c8', accent: '#204a4a', title: 'カー', sub: 'NEW MODEL' },
    { bg: '#f2d7d0', accent: '#7a3f52', title: 'neko', sub: 'ねこの本' },
    { bg: '#f4e6c8', accent: '#3fa8a0', title: '料理', sub: '冬の煮込み' },
    { bg: '#404a68', accent: '#f2b0c0', title: '音楽', sub: 'LIVE 2026' },
  ];
  const c = covers[i % covers.length];
  return canvasTexture(256, 360, (ctx, w, h) => {
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    // 顶部标题
    ctx.fillStyle = c.accent;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = '#20304f';
    ctx.font = `700 44px ${JP_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(c.title, 18, 78);
    ctx.font = `600 20px ${EN_FONT}`;
    ctx.fillStyle = 'rgba(32,48,79,0.7)';
    ctx.fillText(c.sub, 20, 110);
    // 中间图画：抽象人物/风景
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(w * 0.56, h * 0.47, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(32,48,79,0.8)';
    ctx.fillRect(20, h * 0.72, w - 40, 10);
    ctx.fillRect(20, h * 0.77, (w - 40) * 0.7, 8);
    // 底部色带
    ctx.fillStyle = c.accent;
    ctx.fillRect(0, h - 36, w, 36);
    ctx.fillStyle = '#fbf3dd';
    ctx.font = `700 24px ${JP_FONT}`;
    ctx.fillText('月見町 書店', 16, h - 12);
  });
}

function aisleSignTexture(label, en, color) {
  return canvasTexture(768, 192, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 0, 18, h);
    ctx.fillStyle = '#f7f6ec';
    ctx.font = `700 88px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2 + 20, h / 2 - 8);
    ctx.font = `600 26px ${EN_FONT}`;
    ctx.fillStyle = 'rgba(247,246,236,0.72)';
    ctx.letterSpacing = '6px';
    ctx.fillText(en, w / 2 + 20, h / 2 + 58);
    ctx.letterSpacing = '0px';
    // 小月亮标记
    ctx.fillStyle = '#ffc96b';
    ctx.beginPath();
    ctx.arc(72, h / 2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(84, h / 2 - 8, 26, 0, Math.PI * 2);
    ctx.fill();
  });
}

function registerScreenTexture() {
  return canvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#182a2a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3f6f6a';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#9fe8d8';
    ctx.font = `600 24px ${JP_FONT}`;
    ctx.fillText('つきみマート', 20, 46);
    ctx.fillStyle = '#c8f2e8';
    ctx.font = `700 30px ${JP_FONT}`;
    ctx.fillText('おにぎり  ¥140', 20, 92);
    ctx.fillText('コーヒー  ¥100', 20, 130);
    ctx.fillStyle = '#ffd26a';
    ctx.font = `700 26px ${JP_FONT}`;
    ctx.fillText('合計  ¥240', 20, 168);
  });
}

function atmTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#1f3f66';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4efe0';
    ctx.font = `700 52px ${EN_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ATM', w / 2, 76);
    ctx.fillStyle = '#7fe8e0';
    ctx.fillRect(28, 100, w - 56, 4);
    ctx.fillStyle = 'rgba(244,239,224,0.85)';
    ctx.font = `500 22px ${JP_FONT}`;
    ctx.fillText('お引き出し', w / 2, 150);
    ctx.fillText('お預け入れ', w / 2, 186);
    ctx.fillStyle = '#ffc96b';
    roundRect(ctx, 52, 220, w - 104, 58, 10);
    ctx.fill();
    ctx.fillStyle = '#20304f';
    ctx.font = `700 26px ${JP_FONT}`;
    ctx.fillText('24時間', w / 2, 258);
    ctx.fillStyle = 'rgba(127,232,224,0.7)';
    ctx.font = `600 18px ${JP_FONT}`;
    ctx.fillText('月見銀行', w / 2, 330);
  });
}

function coolerHeaderTexture() {
  return canvasTexture(1024, 192, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#2b5fa8');
    grd.addColorStop(0.5, '#3f8ac0');
    grd.addColorStop(1, '#2b5fa8');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f7f4e8';
    ctx.font = `700 86px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('つめた〜い ドリンク', w / 2, h / 2 - 4);
    ctx.fillStyle = '#b9efff';
    ctx.font = `600 26px ${EN_FONT}`;
    ctx.letterSpacing = '10px';
    ctx.fillText('COLD DRINKS', w / 2, h / 2 + 58);
    ctx.letterSpacing = '0px';
  });
}

function coffeeMenuTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f6efe0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#20304f';
    ctx.fillRect(0, 0, w, 86);
    ctx.fillStyle = '#ffc96b';
    ctx.font = `700 46px ${JP_FONT}`;
    ctx.fillText('カウンターコーヒー', 28, 58);
    const items = [
      ['ブレンド M', '¥100'],
      ['ブレンド L', '¥150'],
      ['カフェラテ', '¥180'],
      ['ホットココア', '¥150'],
    ];
    ctx.fillStyle = '#20304f';
    items.forEach(([n, p], i) => {
      const y = 180 + i * 78;
      ctx.font = `600 40px ${JP_FONT}`;
      ctx.fillText(n, 32, y);
      ctx.fillStyle = '#ff7a5e';
      ctx.font = `700 40px ${EN_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(p, w - 32, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#20304f';
      ctx.strokeStyle = 'rgba(32,48,79,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(32, y + 20);
      ctx.lineTo(w - 32, y + 20);
      ctx.stroke();
    });
    ctx.fillStyle = '#3fa8a0';
    ctx.font = `600 22px ${JP_FONT}`;
    ctx.fillText('店内で挽きたてをどうぞ', 32, h - 32);
  });
}

function staffDoorTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#4b5360';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#f2ecdc';
    ctx.font = `700 30px ${EN_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('STAFF ONLY', w / 2, 160);
    ctx.font = `500 22px ${JP_FONT}`;
    ctx.fillStyle = 'rgba(242,236,220,0.7)';
    ctx.fillText('関係者以外', w / 2, 210);
    ctx.fillText('立入禁止', w / 2, 242);
    // 小窗
    ctx.fillStyle = 'rgba(160,210,220,0.5)';
    ctx.fillRect(56, 60, w - 112, 60);
  });
}

function cigTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e7e2d4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#20304f';
    ctx.fillRect(0, 0, w, 64);
    ctx.fillStyle = '#fbf3dd';
    ctx.font = `700 34px ${JP_FONT}`;
    ctx.fillText('たばこ', 24, 44);
    const colors = ['#c94a3e', '#3f7ac0', '#e2b04a', '#5aa86a', '#7c5fb0', '#d87a3a'];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        ctx.fillStyle = colors[(r * 6 + c) % colors.length];
        ctx.fillRect(20 + c * 80, 96 + r * 100, 68, 78);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(28 + c * 80, 118 + r * 100, 52, 8);
      }
    }
  });
}

function openNeonTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,111,156,0.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffb3c8';
    ctx.font = `700 104px ${EN_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', w / 2, h / 2 - 2);
    ctx.fillStyle = 'rgba(127,232,224,0.95)';
    ctx.font = `600 40px ${EN_FONT}`;
    ctx.fillText('24 HOURS', w / 2, h / 2 + 78);
  });
}

function welcomeBannerTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff7a5e';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
    ctx.fillStyle = '#20304f';
    ctx.font = `700 74px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('いらっしゃいませ', w / 2, h / 2 - 8);
    ctx.fillStyle = '#3fa8a0';
    ctx.font = `600 26px ${EN_FONT}`;
    ctx.letterSpacing = '8px';
    ctx.fillText('TSUKIMI MART', w / 2, h / 2 + 64);
    ctx.letterSpacing = '0px';
  });
}

function guideTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // 黄色引导线
    ctx.fillStyle = 'rgba(240,196,92,0.55)';
    ctx.fillRect(w / 2 - 12, 0, 24, h * 0.62);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 40, h * 0.52);
    ctx.lineTo(w / 2 + 40, h * 0.52);
    ctx.lineTo(w / 2, h * 0.68);
    ctx.closePath();
    ctx.fill();
    // レジ 文字
    ctx.save();
    ctx.translate(w / 2, h * 0.82);
    ctx.fillStyle = 'rgba(240,196,92,0.75)';
    ctx.font = `700 64px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('レジ', 0, 0);
    ctx.restore();
  });
}

function windowBannerTexture() {
  return canvasTexture(384, 768, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#7a2f24');
    grd.addColorStop(1, '#b8492f');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(251,243,221,0.35)';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#ffc96b';
    ctx.beginPath();
    ctx.arc(w / 2, 150, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a2f24';
    ctx.beginPath();
    ctx.arc(w / 2 + 24, 132, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbf3dd';
    ctx.textAlign = 'center';
    ctx.font = `700 58px ${JP_FONT}`;
    ctx.fillText('おでん', w / 2, 340);
    ctx.fillText('はじめました', w / 2, 410);
    ctx.font = `600 30px ${JP_FONT}`;
    ctx.fillStyle = 'rgba(251,243,221,0.8)';
    ctx.fillText('だいこん・たまご・ちくわ', w / 2, 510);
    ctx.fillStyle = '#ffc96b';
    roundRect(ctx, 52, 580, w - 104, 96, 16);
    ctx.fill();
    ctx.fillStyle = '#5c231c';
    ctx.font = `700 46px ${JP_FONT}`;
    ctx.fillText('全品 70円', w / 2, 644);
  });
}

/* ========================================================================== */
/*  商品实例化                                                                 */
/* ========================================================================== */

const DRINK_COLORS = ['#f2ead6', '#1fae9e', '#f2b32b', '#e0473a', '#2f6fd0', '#8fd06a', '#f2e2b0', '#b45fd0', '#f5f1e6', '#3fc0d8'];
const SNACK_COLORS = ['#e84a3a', '#f2b32b', '#1fae8e', '#2f6fd0', '#c84a9a', '#f2e6c8', '#3fc0d8', '#f09a2a', '#b8342a', '#7ac04a', '#e05a8a'];

function buildProducts(parent, handles) {
  const rand = rng(4242);
  const boxes = []; // 零食袋 / 盒
  const cans = [];
  const bottles = [];
  const bentos = [];
  const onigiris = [];
  const cups = [];
  const mags = [];

  const zRows = [-1.0, -1.95, -2.9];
  const rowDepth = 0.34;
  const lenX0 = -2.15;
  const lenX1 = 0.05;
  const tiers = [0.12, 0.46, 0.8, 1.14];
  const heights = { box: 0.13, can: 0.11, bottle: 0.17 };

  for (const rz of zRows) {
    for (let ti = 0; ti < tiers.length; ti += 1) {
      for (const side of [-1, 1]) {
        const zPos = rz + side * (rowDepth / 2 - 0.06);
        let x = lenX0 + 0.14;
        const kind = ti === 0 ? 'box' : ti === 1 ? 'can' : 'box';
        while (x < lenX1 - 0.08) {
          if (rand() > 0.1) {
            const color = SNACK_COLORS[Math.floor(rand() * SNACK_COLORS.length)];
            const jitter = (rand() - 0.5) * 0.015;
            if (kind === 'box') {
              boxes.push({
                x,
                y: FLOOR + tiers[ti] + 0.5 * heights.box,
                z: zPos + jitter,
                ry: (rand() - 0.5) * 0.24,
                color,
                s: 0.8 + rand() * 0.35,
              });
            } else if (kind === 'can') {
              cans.push({
                x,
                y: FLOOR + tiers[ti] + 0.5 * heights.can,
                z: zPos + jitter,
                ry: rand() * 6.28,
                color,
              });
            } else {
              bottles.push({
                x,
                y: FLOOR + tiers[ti] + 0.5 * heights.bottle,
                z: zPos + jitter,
                ry: rand() * 6.28,
                color,
              });
            }
          }
          x += 0.075 + rand() * 0.02;
        }
      }
    }
  }

  // 冷柜里的饮料
  const coolerDoors = [
    { x0: -2.64, x1: -1.72 },
    { x0: -1.68, x1: -0.78 },
    { x0: -0.74, x1: 0.2 },
  ];
  for (const door of coolerDoors) {
    const step = 0.083;
    for (let shelf = 0; shelf < 5; shelf += 1) {
      const y = FLOOR + 0.28 + shelf * 0.38;
      for (let x = door.x0 + 0.12; x < door.x1 - 0.08; x += step) {
        if (rand() > 0.14) {
          const tall = rand() > 0.45;
          const item = {
            x,
            y,
            z: -4.32 + rand() * 0.06,
            ry: 0,
            color: DRINK_COLORS[Math.floor(rand() * DRINK_COLORS.length)],
          };
          (tall ? bottles : cans).push(item);
        }
      }
    }
  }

  // 便当冷藏柜（左墙）
  const bentoZ0 = -2.42;
  const bentoZ1 = -0.72;
  for (let shelf = 0; shelf < 3; shelf += 1) {
    const y = FLOOR + 0.35 + shelf * 0.34;
    for (let z = bentoZ0; z < bentoZ1; z += 0.19) {
      if (rand() > 0.18) {
        bentos.push({
          x: -2.5 + rand() * 0.06,
          y,
          z,
          ry: Math.PI / 2 + (rand() - 0.5) * 0.1,
          color: ['#f2e6d2', '#e8d6b8', '#d8b48a', '#f5efe2'][Math.floor(rand() * 4)],
        });
      }
    }
  }
  // 柜台上的饭团
  for (let i = 0; i < 14; i += 1) {
    onigiris.push({
      x: -2.46 + rand() * 0.08,
      y: FLOOR + 1.08,
      z: bentoZ0 + (i / 14) * (bentoZ1 - bentoZ0),
      ry: Math.PI / 2,
    });
  }

  // 杂志架（靠窗左侧）：斜面上一排 + 下层立一排
  for (let i = 0; i < 4; i += 1) {
    mags.push({ x: -2.56 + i * 0.21, y: FLOOR + 0.83, z: 0.72, i, rot: -0.24 });
    mags.push({ x: -2.56 + i * 0.21, y: FLOOR + 0.55, z: 0.77, i: i + 2, rot: 0 });
  }

  // 一次性杯子堆
  for (let i = 0; i < 9; i += 1) {
    cups.push({ x: 0.98, y: FLOOR + 1.03 + i * 0.012, z: -3.72, r: 0.032 });
  }

  /* ---- 几何 & 材质（每类商品 1 个 InstancedMesh + 逐实例颜色）---- */
  const boxGeo = new THREE.BoxGeometry(0.086, 0.15, 0.052);
  const canGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.11, 8);
  const bottleGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.17, 8);
  const bentoGeo = new THREE.BoxGeometry(0.16, 0.055, 0.115);
  const onigiriGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.038, 3);
  const cupGeo = new THREE.CylinderGeometry(0.03, 0.024, 0.045, 10);

  const white = toon('#ffffff', { gradient: 'soft', rim: 0.05, rimColor: '#fff2d0', emissive: '#221607', emissiveIntensity: 0.22 });
  white.vertexColors = false;

  function makeInstanced(geo, items, opt = {}) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, white, items.length);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    items.forEach((it, idx) => {
      p.set(it.x, it.y, it.z);
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      s.set(it.s || 1, it.s || 1, it.s || 1);
      m.compose(p, q, s);
      im.setMatrixAt(idx, m);
      im.setColorAt(idx, new THREE.Color(it.color || '#ffffff'));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = opt.cast ?? true;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  }

  makeInstanced(boxGeo, boxes);
  makeInstanced(canGeo, cans);
  makeInstanced(bottleGeo, bottles);
  makeInstanced(bentoGeo, bentos);
  makeInstanced(onigiriGeo, onigiris);
  makeInstanced(cupGeo, cups);

  // 杂志：每一本用一张封面贴图（7×2 张）
  const magGroup = group('magazines');
  for (const it of mags) {
    const tex = magazineTexture(it.i);
    const m = plane(0.17, 0.24, new THREE.MeshBasicMaterial({ map: tex, fog: true }), {
      x: it.x,
      y: it.y,
      z: it.z + 0.045,
      cast: false,
      receive: false,
      parent: magGroup,
    });
    m.rotation.x = it.rot ? -0.2 : 0;
    m.userData.noOutline = true;
  }
  parent.add(magGroup);
}

/* ========================================================================== */
/*  货架 / 冷柜 / 收银台                                                        */
/* ========================================================================== */

function buildGondola(parent) {
  const g = group('gondola');
  const shelfWhite = toon('#e8dfcc', { rim: 0.12, rimColor: '#ffe9c4', gradient: 'soft', emissive: '#33200e', emissiveIntensity: 0.3 });
  const shelfTrim = toon('#c8bfa8', { rim: 0.1, rimColor: '#e8d8b8', gradient: 'soft' });
  const shelfTop = toon('#c8c2b4', { rim: 0.1, rimColor: '#e8d8b8', gradient: 'soft' });
  const lenX0 = -2.15;
  const lenX1 = 0.05;
  const len = lenX1 - lenX0;
  const cx = (lenX0 + lenX1) / 2;
  const rowDepth = 0.34;
  const tiers = [0.12, 0.46, 0.8, 1.14];
  const rowZ = [-1.0, -1.95, -2.9];

  const tagItems = [];
  const tagColors = ['#e85f4a', '#f2b544', '#3fa8a0', '#4f7fd0', '#d86fa8', '#f0e8d8'];
  for (const rz of rowZ) {
    // 底座
    box(len, 0.1, rowDepth + 0.06, shelfTrim, { x: cx, y: FLOOR + 0.05, z: rz, parent: g });
    // 中央脊板
    box(len, 1.28, 0.05, shelfWhite, { x: cx, y: FLOOR + 0.72, z: rz, parent: g });
    // 两端封板
    for (const ex of [lenX0, lenX1]) {
      box(0.05, 1.4, rowDepth + 0.05, shelfWhite, { x: ex, y: FLOOR + 0.7, z: rz, parent: g });
      box(0.07, 0.05, rowDepth + 0.09, shelfTrim, { x: ex, y: FLOOR + 1.41, z: rz, parent: g });
    }
    // 层板 + 层板前缘价格槽
    for (const ty of tiers) {
      box(len, 0.028, rowDepth, shelfWhite, { x: cx, y: FLOOR + ty, z: rz, parent: g });
    }
    // 层板前缘的暖白 LED 灯条（便利店的标志性横光线）
    for (const ty of tiers) {
      for (const side of [-1, 1]) {
        box(len - 0.08, 0.014, 0.018, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffefc8').multiplyScalar(2.1) }), {
          x: cx,
          y: FLOOR + ty - 0.018,
          z: rz + side * (rowDepth / 2 + 0.006),
          parent: g,
          cast: false,
          receive: false,
        });
      }
    }
    // 层板前缘的彩色价签（一排小米粒一样的颜色，从街上就能看到）
    for (const ty of tiers) {
      for (const side of [-1, 1]) {
        for (let tx = lenX0 + 0.18; tx < lenX1 - 0.05; tx += 0.19) {
          tagItems.push({
            x: tx,
            y: FLOOR + ty + 0.005,
            z: rz + side * (rowDepth / 2 + 0.012),
            color: tagColors[tagItems.length % tagColors.length],
          });
        }
      }
    }
    // 顶部灯箱条（每排货架顶）
    box(len - 0.1, 0.06, 0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3d6').multiplyScalar(1.35) }), {
      x: cx,
      y: FLOOR + 1.37,
      z: rz,
      parent: g,
      cast: false,
    });
    // 两端端架（面向通道的促销位）
    for (const [ex, side] of [
      [lenX0 - 0.08, -1],
      [lenX1 + 0.08, 1],
    ]) {
      box(0.14, 1.05, rowDepth + 0.16, shelfWhite, { x: ex, y: FLOOR + 0.55, z: rz, parent: g });
      // 端架上的小商品色块
      const colors = ['#ef6f5e', '#f4c65a', '#7ac7a6', '#5e9fe0'];
      for (let i = 0; i < 4; i += 1) {
        box(0.1, 0.12, 0.1, toon(colors[i % colors.length], { gradient: 'soft' }), {
          x: ex,
          y: FLOOR + 0.5 + (i % 2) * 0.24,
          z: rz - 0.12 + Math.floor(i / 2) * 0.24,
          parent: g,
          cast: false,
        });
      }
    }
  }

  // 货架顶部的小吊牌 / 促销卡（2 种图，数量克制，避免同图重复）
  const popTex = [TEX.posterMoonDango(), TEX.posterOnigiri()];
  let popIdx = 0;
  for (const rz of rowZ) {
    for (const px of [-1.55, -0.55]) {
      const pop = plane(0.2, 0.28, new THREE.MeshBasicMaterial({ map: popTex[popIdx % 2], fog: true }), {
        x: px,
        y: FLOOR + 1.62,
        z: rz + 0.1,
        cast: false,
        receive: false,
        parent: g,
      });
      pop.scale.set(0.75, 0.75, 0.75);
      pop.rotation.z = (px + rz) * 0.05;
      pop.userData.noOutline = true;
      popIdx += 1;
    }
  }

  // 价签：一个 InstancedMesh
  if (tagItems.length) {
    const tagGeo = new THREE.BoxGeometry(0.055, 0.032, 0.012);
    const tagMat = toon('#ffffff', { gradient: 'tiny', rim: 0 });
    const tags = new THREE.InstancedMesh(tagGeo, tagMat, tagItems.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    tagItems.forEach((it, i) => {
      p.set(it.x, it.y, it.z);
      q.identity();
      m.compose(p, q, s);
      tags.setMatrixAt(i, m);
      tags.setColorAt(i, new THREE.Color(it.color));
    });
    tags.instanceMatrix.needsUpdate = true;
    if (tags.instanceColor) tags.instanceColor.needsUpdate = true;
    tags.computeBoundingSphere();
    tags.castShadow = false;
    tags.receiveShadow = false;
    g.add(tags);
  }

  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
  return g;
}

function buildCooler(parent) {
  const g = group('cooler');
  const frameMat = toon('#dfe3e0', { rim: 0.16, rimColor: '#a8d8e8', gradient: 'soft' });
  const darkFrame = toon('#3b4148', { rim: 0.12, rimColor: '#7f9ec4' });
  const backMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(0.85) });
  const shelfGlass = new THREE.MeshBasicMaterial({
    color: '#bfe8f0',
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const doors = [
    { x0: -2.64, x1: -1.72 },
    { x0: -1.68, x1: -0.78 },
    { x0: -0.74, x1: 0.2 },
  ];
  const zFront = -3.98;
  const zBack = -4.42;
  const height = 2.08;
  const y0 = FLOOR;

  // 柜体外壳
  box(3.1, height, 0.1, frameMat, { x: -1.22, y: y0 + height / 2, z: zBack + 0.03, parent: g });
  box(3.16, 0.12, 0.5, darkFrame, { x: -1.22, y: y0 + height + 0.03, z: zFront + 0.12, parent: g });
  box(3.16, 0.1, 0.5, darkFrame, { x: -1.22, y: y0 + 0.05, z: zFront + 0.12, parent: g });
  for (const ex of [-2.67, 0.23]) {
    box(0.06, height, 0.46, frameMat, { x: ex, y: y0 + height / 2, z: zFront + 0.1, parent: g });
  }
  // 内部背光板
  plane(3.0, height - 0.16, backMat, { x: -1.22, y: y0 + height / 2, z: zBack + 0.085, cast: false, receive: false, parent: g });
  // 内部层板
  for (let s = 0; s < 5; s += 1) {
    const y = y0 + 0.28 + s * 0.38;
    plane(3.0, 0.34, shelfGlass, { x: -1.22, y, z: zFront + 0.06, rx: -Math.PI / 2, cast: false, receive: false, parent: g });
  }
  // 玻璃门 + 门框
  for (const d of doors) {
    const cx = (d.x0 + d.x1) / 2;
    const w = d.x1 - d.x0;
    const glassMat = new THREE.MeshBasicMaterial({
      color: '#cbeef2',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    plane(w - 0.06, height - 0.2, glassMat, { x: cx, y: y0 + height / 2, z: zFront, cast: false, receive: false, parent: g });
    // 门框
    box(0.045, height - 0.1, 0.05, frameMat, { x: d.x0 + 0.01, y: y0 + height / 2, z: zFront, parent: g, cast: false });
    box(0.045, height - 0.1, 0.05, frameMat, { x: d.x1 - 0.01, y: y0 + height / 2, z: zFront, parent: g, cast: false });
    box(w - 0.02, 0.045, 0.05, frameMat, { x: cx, y: y0 + height - 0.08, z: zFront, parent: g, cast: false });
    // 门把手
    cyl(0.012, 0.012, 0.6, 8, toon('#c8ccd2', { rim: 0.3, rimColor: '#f2faff' }), {
      x: cx + w * 0.32,
      y: y0 + 1.1,
      z: zFront + 0.035,
      parent: g,
      cast: false,
    });
  }
  // 冷柜顶部招牌
  const header = plane(2.9, 0.42, lightbox(coolerHeaderTexture(), 1.05), {
    x: -1.22,
    y: y0 + height + 0.25,
    z: zFront + 0.12,
    cast: false,
    receive: false,
    parent: g,
  });
  header.userData.noOutline = true;
  // 侧边价格/标签条
  box(3.12, 0.03, 0.02, flat('#cfe0e8'), { x: -1.22, y: y0 + height + 0.02, z: zFront + 0.34, parent: g, cast: false });
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
  return g;
}

function buildBentoFridge(parent) {
  const g = group('bento-fridge');
  const frameMat = toon('#eef0e8', { rim: 0.14, rimColor: '#ffe8c0', gradient: 'soft' });
  const z0 = -2.42;
  const z1 = -0.72;
  const zc = (z0 + z1) / 2;
  const h = 1.42;
  const d = 0.34;
  const x = -2.55;
  // 柜体
  box(d, h, z1 - z0, frameMat, { x, y: FLOOR + h / 2, z: zc, parent: g });
  // 开放冷藏区（面向 +X）
  plane(z1 - z0 - 0.1, h - 0.2, new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d8').multiplyScalar(0.5) }), {
    x: x + d / 2 + 0.001,
    y: FLOOR + h / 2,
    z: zc,
    ry: Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  // 层板
  for (let s = 0; s < 3; s += 1) {
    const y = FLOOR + 0.24 + s * 0.34;
    box(0.3, 0.025, z1 - z0 - 0.12, toon('#dfe8e4'), { x: x + 0.03, y, z: zc, parent: g, cast: false });
    box(0.03, 0.07, z1 - z0 - 0.12, toon('#c8d0cc'), { x: x + d / 2, y: y + 0.035, z: zc, parent: g, cast: false });
  }
  // 顶部灯箱
  const header = plane(z1 - z0 - 0.1, 0.26, lightbox(TEX.aisleSign(), 1.2), {
    x: x + d / 2 + 0.06,
    y: FLOOR + h + 0.18,
    z: zc,
    ry: Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  header.userData.noOutline = true;
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
  return g;
}

function buildMagazineRack(parent) {
  const g = group('magazine-rack');
  const white = toon('#f0ece2', { rim: 0.12, rimColor: '#ffe9c4', gradient: 'soft' });
  const x0 = -2.62;
  const x1 = -1.7;
  const zc = 0.6;
  // 矮柜
  box(x1 - x0, 0.8, 0.34, white, { x: (x0 + x1) / 2, y: FLOOR + 0.4, z: zc, parent: g });
  // 斜面杂志展示台
  box(x1 - x0 - 0.04, 0.03, 0.38, toon('#d8d2c4'), {
    x: (x0 + x1) / 2,
    y: FLOOR + 0.78,
    z: zc + 0.02,
    rx: -0.4,
    parent: g,
    cast: false,
  });
  // 挡边
  box(x1 - x0, 0.05, 0.03, white, { x: (x0 + x1) / 2, y: FLOOR + 0.85, z: zc + 0.19, parent: g, cast: false });
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
  return g;
}

function buildFrontDisplay(parent) {
  const g = group('front-display');
  const wood = toon('#a98d6b', { rim: 0.14, rimColor: '#ffd9a0', gradient: 'soft' });
  const white = toon('#f2eee4', { rim: 0.1, rimColor: '#ffe9c4', gradient: 'soft' });
  // 靠窗的低矮促销台（在窗外就能看到大件商品）
  box(1.15, 0.58, 0.4, white, { x: -0.95, y: FLOOR + 0.29, z: 0.52, parent: g });
  box(1.2, 0.04, 0.44, wood, { x: -0.95, y: FLOOR + 0.6, z: 0.52, parent: g });
  box(1.1, 0.03, 0.02, flat('#3fa8a0'), { x: -0.95, y: FLOOR + 0.55, z: 0.73, parent: g, cast: false });
  // 台面上的便当 / 大瓶饮料 / 促销品
  const bentoCols = ['#f2e6d2', '#e8d6b8', '#f5efe2'];
  for (let i = 0; i < 3; i += 1) {
    box(0.28, 0.08, 0.2, toon(bentoCols[i], { rim: 0.08 }), {
      x: -1.3 + i * 0.3,
      y: FLOOR + 0.66,
      z: 0.48,
      parent: g,
      cast: false,
    });
    // 便当里的彩色料理格子
    for (let k = 0; k < 3; k += 1) {
      box(0.07, 0.02, 0.06, toon(['#d8684a', '#f0c86a', '#7ac7a6'][k]), {
        x: -1.36 + i * 0.3 + (k % 2) * 0.09,
        y: FLOOR + 0.71,
        z: 0.44 + Math.floor(k / 2) * 0.08,
        parent: g,
        cast: false,
      });
    }
  }
  // 大瓶饮料两排
  for (let r = 0; r < 2; r += 1) {
    for (let i = 0; i < 5; i += 1) {
      cyl(0.042, 0.046, 0.2, 8, toon(DRINK_COLORS[(i + r * 3) % DRINK_COLORS.length], { rim: 0.12 }), {
        x: -1.48 + i * 0.13,
        y: FLOOR + 0.72,
        z: 0.6 + r * 0.1,
        parent: g,
        cast: false,
      });
      cyl(0.018, 0.02, 0.05, 6, toon('#d8d8d0'), {
        x: -1.48 + i * 0.13,
        y: FLOOR + 0.83,
        z: 0.6 + r * 0.1,
        parent: g,
        cast: false,
      });
    }
  }
  // 促销小立牌
  const pop = plane(0.26, 0.18, lightbox(TEX.posterOnigiri(), 0.9), {
    x: -0.62,
    y: FLOOR + 0.72,
    z: 0.7,
    cast: false,
    receive: false,
    parent: g,
  });
  pop.userData.noOutline = true;
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
}

function buildCounter(parent, handles) {
  const g = group('counter');
  const cream = toon('#ece6d6', { rim: 0.12, rimColor: '#ffe9c0', gradient: 'soft' });
  const topMat = toon('#6d6255', { rim: 0.16, rimColor: '#d8b080', gradient: 'soft' });
  const metal = toon('#b7bcc4', { rim: 0.22, rimColor: '#f2faff', gradient: 'soft' });
  const dark = toon('#343a44', { rim: 0.1, rimColor: '#7f9ec4' });

  const x0 = 0.15;
  const x1 = 1.45;
  const zFront = -2.9;
  const zBack = -3.38;
  const h = 0.98;
  const cx = (x0 + x1) / 2;

  // 柜台主体
  box(x1 - x0, h - 0.08, zFront - zBack, cream, {
    x: cx,
    y: FLOOR + (h - 0.08) / 2,
    z: (zFront + zBack) / 2,
    parent: g,
  });
  // 台面
  box(x1 - x0 + 0.08, 0.06, zFront - zBack + 0.1, topMat, {
    x: cx,
    y: FLOOR + h,
    z: (zFront + zBack) / 2,
    parent: g,
  });
  // 柜台正面灯槽
  box(x1 - x0 - 0.1, 0.03, 0.02, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0b0').multiplyScalar(1.2) }), {
    x: cx,
    y: FLOOR + 0.12,
    z: zFront + 0.01,
    parent: g,
    cast: false,
  });
  // 侧挡板
  for (const ex of [x0, x1]) {
    box(0.04, h, zFront - zBack, cream, { x: ex, y: FLOOR + h / 2, z: (zFront + zBack) / 2, parent: g });
  }

  // 收银机（面向顾客 +Z）
  const reg = group('register');
  reg.position.set(1.16, FLOOR + h + 0.06, -3.12);
  box(0.3, 0.12, 0.26, dark, { y: 0.06, parent: reg });
  box(0.26, 0.2, 0.04, dark, { y: 0.2, z: 0.08, rx: -0.2, parent: reg });
  const screenTex = registerScreenTexture();
  plane(0.22, 0.16, new THREE.MeshBasicMaterial({ map: screenTex, fog: false }), {
    y: 0.2,
    z: 0.101,
    rx: -0.2,
    cast: false,
    receive: false,
    parent: reg,
  });
  // 键盘
  box(0.24, 0.02, 0.14, dark, { y: 0.13, z: -0.02, parent: reg });
  for (let i = 0; i < 8; i += 1) {
    box(0.025, 0.008, 0.02, toon('#c8ccd2'), {
      x: -0.09 + (i % 4) * 0.06,
      y: 0.143,
      z: -0.05 + Math.floor(i / 4) * 0.05,
      parent: reg,
      cast: false,
    });
  }
  // 客显
  const disp = plane(0.12, 0.2, lightbox(registerScreenTexture(), 0.8), {
    x: 1.36,
    y: FLOOR + h + 0.28,
    z: -2.96,
    ry: -0.35,
    cast: false,
    receive: false,
    parent: g,
  });
  disp.userData.noOutline = true;
  box(0.04, 0.3, 0.03, metal, { x: 1.36, y: FLOOR + h + 0.14, z: -2.98, parent: g, cast: false });
  // 刷卡机 + 扫码枪 + 小票机
  box(0.12, 0.05, 0.16, dark, { x: 0.96, y: FLOOR + h + 0.09, z: -2.96, parent: g });
  box(0.16, 0.05, 0.1, dark, { x: 0.78, y: FLOOR + h + 0.09, z: -2.96, parent: g });
  box(0.05, 0.24, 0.05, metal, { x: 1.38, y: FLOOR + h + 0.12, z: -3.3, parent: g, cast: false });
  // 小票纸
  plane(0.08, 0.18, new THREE.MeshBasicMaterial({ color: '#f8f4e8' }), {
    x: 1.38,
    y: FLOOR + h + 0.02,
    z: -3.26,
    rx: -0.14,
    cast: false,
    receive: false,
    parent: g,
  });

  /* ---- 关东煮 ---- */
  const oden = group('oden');
  oden.position.set(0.62, FLOOR + h + 0.04, -3.08);
  const odenMetal = toon('#8f949c', { rim: 0.3, rimColor: '#e8f2ff', gradient: 'soft' });
  box(0.44, 0.05, 0.3, odenMetal, { parent: oden });
  box(0.42, 0.14, 0.28, toon('#b8bcc4', { rim: 0.22, rimColor: '#f0f8ff' }), { y: 0.02, parent: oden });
  // 汤面
  plane(0.37, 0.23, new THREE.MeshBasicMaterial({ color: new THREE.Color('#c98a3a') }), {
    y: 0.1,
    rx: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: oden,
  });
  // 分格
  for (const x of [-0.15, 0, 0.15]) {
    box(0.012, 0.09, 0.26, odenMetal, { x, y: 0.05, parent: oden, cast: false });
  }
  for (const z of [-0.09, 0.09]) {
    box(0.37, 0.09, 0.012, odenMetal, { y: 0.05, z, parent: oden, cast: false });
  }
  // 萝卜 / 丸子 / 竹轮 / 蛋
  const odenItems = [
    [-0.19, -0.09, '#f2e2b8'],
    [-0.19, 0.09, '#f2e2b8'],
    [0.05, 0.09, '#e8cfa0'],
    [0.18, -0.02, '#b8693f'],
    [0.05, -0.1, '#f5edda'],
    [-0.02, 0.0, '#f2e8d8'],
    [0.2, 0.08, '#d8a060'],
  ];
  for (const [x, z, col] of odenItems) {
    if (x > 0.15) {
      torus(0.03, 0.012, 8, 12, toon(col), { x, y: 0.08, z, rx: Math.PI / 2, parent: oden, cast: false });
    } else {
      sphere(0.033, toon(col, { rim: 0.1 }), { x, y: 0.07, z, parent: oden, cast: false });
    }
  }
  // 玻璃罩
  box(0.48, 0.16, 0.34, new THREE.MeshBasicMaterial({
    color: '#d8eef0',
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), { y: 0.2, parent: oden, cast: false });
  // 签子筒
  cyl(0.03, 0.03, 0.12, 8, odenMetal, { x: 0.22, y: 0.16, z: 0.1, parent: oden, cast: false });
  addOutline(oden, { width: 0.0008, color: '#0d1220' });
  g.add(oden);

  /* ---- 热食柜（炸鸡） ---- */
  const hot = group('hot-snack');
  hot.position.set(0.26, FLOOR + h + 0.06, -3.14);
  const hotFrame = toon('#4f5560', { rim: 0.16, rimColor: '#a8c0dc' });
  box(0.36, 0.28, 0.28, hotFrame, { y: 0.14, parent: hot });
  box(0.32, 0.2, 0.24, new THREE.MeshBasicMaterial({
    color: '#ffe8c0',
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  }), { y: 0.15, parent: hot, cast: false });
  for (let i = 0; i < 10; i += 1) {
    const c = i % 2 ? '#d88a3a' : '#c4702a';
    box(0.055, 0.045, 0.055, toon(c), {
      x: -0.11 + (i % 4) * 0.07,
      y: 0.08 + Math.floor(i / 4) * 0.06,
      z: -0.06 + (i % 2) * 0.08,
      parent: hot,
      cast: false,
    });
  }
  box(0.4, 0.04, 0.32, hotFrame, { y: 0.3, parent: hot });
  addOutline(hot, { width: 0.0008, color: '#0d1220' });
  g.add(hot);

  /* ---- 咖啡机（后柜台） ---- */
  const coffee = group('coffee');
  coffee.position.set(1.18, FLOOR + h + 0.06, -3.86);
  box(0.5, 0.12, 0.42, cream, { y: 0.06, parent: coffee });
  box(0.48, 0.62, 0.36, toon('#3f4650', { rim: 0.16, rimColor: '#8fb4dd' }), { y: 0.42, parent: coffee });
  // 屏幕
  const scr = plane(0.3, 0.2, new THREE.MeshBasicMaterial({ map: coffeeMenuTexture(), fog: false }), {
    y: 0.58,
    z: 0.19,
    cast: false,
    receive: false,
    parent: coffee,
  });
  scr.userData.noOutline = true;
  // 出水口 + 杯座
  box(0.12, 0.16, 0.1, dark, { y: 0.24, z: 0.16, parent: coffee });
  box(0.28, 0.04, 0.22, metal, { y: 0.1, z: 0.18, parent: coffee, cast: false });
  box(0.04, 0.12, 0.04, dark, { y: 0.16, z: 0.16, parent: coffee, cast: false });
  // 杯塔
  cyl(0.045, 0.045, 0.22, 10, toon('#f2ecdc'), { x: -0.16, y: 0.24, z: 0.16, parent: coffee, cast: false });
  // 顶部灯带
  box(0.42, 0.03, 0.05, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), { y: 0.83, z: -0.1, parent: coffee, cast: false });
  addOutline(coffee, { width: 0.0008, color: '#0d1220' });
  g.add(coffee);

  /* ---- 烟柜（收银台后墙） ---- */
  const cig = plane(1.0, 1.0, lightbox(cigTexture(), 0.98), {
    x: 1.42,
    y: FLOOR + 1.55,
    z: -3.3,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  cig.userData.noOutline = true;
  box(1.04, 1.06, 0.06, toon('#d8d2c4'), { x: 1.46, y: FLOOR + 1.55, z: -3.3, ry: -Math.PI / 2, parent: g, cast: false });

  /* ---- 挂着的「レジ」灯牌 ---- */
  const signTex = aisleSignTexture('レジ・お会計', 'CASHIER', '#2b5fa8');
  const regSign = plane(1.2, 0.3, lightbox(signTex, 1.3), {
    x: 0.85,
    y: 2.12,
    z: -2.95,
    cast: false,
    receive: false,
    parent: g,
  });
  regSign.userData.noOutline = true;
  // 吊杆
  for (const x of [0.38, 1.32]) {
    cyl(0.008, 0.008, 0.32, 6, metal, { x, y: 2.32, z: -2.95, parent: g, cast: false });
  }

  // 台面下的白色小标牌
  const promo = plane(0.5, 0.34, new THREE.MeshBasicMaterial({ map: TEX.aFrame(), fog: true }), {
    x: 0.62,
    y: FLOOR + 0.58,
    z: zFront + 0.011,
    cast: false,
    receive: false,
    parent: g,
  });
  promo.userData.noOutline = true;

  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });

  // 蒸汽位置
  handles.steamSources = handles.steamSources || [];
  handles.steamSources.push(new THREE.Vector3(0.62, FLOOR + h + 0.22, -3.08));
  handles.steamSources.push(new THREE.Vector3(1.18, FLOOR + h + 0.5, -3.7));
  return g;
}

function buildIceFreezer(parent) {
  const g = group('ice-freezer');
  const body = toon('#e8f2f4', { rim: 0.12, rimColor: '#9fd8e8', gradient: 'soft' });
  const blue = toon('#3f8ac0', { rim: 0.14, rimColor: '#9fd8ff', gradient: 'soft' });
  const glass = new THREE.MeshBasicMaterial({
    color: '#c8ecf2',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // 卧式冰柜（x -0.42..0.36, z -2.92..-2.52）
  box(0.78, 0.78, 0.4, body, { x: -0.03, y: FLOOR + 0.39, z: -2.72, parent: g });
  box(0.8, 0.06, 0.42, blue, { x: -0.03, y: FLOOR + 0.79, z: -2.72, parent: g });
  // 玻璃推拉盖
  plane(0.72, 0.34, glass, { x: -0.03, y: FLOOR + 0.76, z: -2.72, rx: -Math.PI / 2, cast: false, receive: false, parent: g });
  // 里面一排冰品
  const iceCols = ['#f2e8d0', '#f2b0c8', '#8fd0e8', '#f2d070', '#b8a0e0', '#f5f1e6'];
  for (let i = 0; i < 10; i += 1) {
    box(0.06, 0.03, 0.09, toon(iceCols[i % iceCols.length], { gradient: 'tiny' }), {
      x: -0.27 + (i % 5) * 0.13,
      y: FLOOR + 0.63,
      z: -2.82 + Math.floor(i / 5) * 0.13,
      parent: g,
      cast: false,
    });
  }
  // 正面贴纸「アイス」
  const decal = plane(0.3, 0.16, lightbox(TEX.sticker(), 0.8), {
    x: -0.03,
    y: FLOOR + 0.45,
    z: -2.518,
    cast: false,
    receive: false,
    parent: g,
  });
  decal.userData.noOutline = true;
  parent.add(g);
  addOutline(g, { width: 0.0008, color: '#0d1220' });
}

function buildATM(parent) {
  const g = group('atm');
  const body = toon('#dcd8cc', { rim: 0.12, rimColor: '#b8d8f0', gradient: 'soft' });
  const dark = toon('#3a404a', { rim: 0.12 });
  const x = 1.4;
  const z = -1.35;
  // 机体（贴右墙，面向 -X）
  box(0.32, 1.85, 0.72, body, { x, y: FLOOR + 0.925, z, parent: g });
  box(0.34, 0.1, 0.76, dark, { x, y: FLOOR + 1.86, z, parent: g });
  // 屏幕
  const scr = plane(0.5, 0.4, new THREE.MeshBasicMaterial({ map: atmTexture(), fog: false }), {
    x: x - 0.165,
    y: FLOOR + 1.32,
    z,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  scr.userData.noOutline = true;
  // 顶部灯箱
  const top = plane(0.6, 0.22, lightbox(atmTexture(), 1.0), {
    x: x - 0.17,
    y: FLOOR + 2.0,
    z,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  top.userData.noOutline = true;
  // 按键
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      box(0.03, 0.03, 0.03, toon('#c8ccd2'), {
        x: x - 0.17,
        y: FLOOR + 0.86 - r * 0.07,
        z: z - 0.22 + c * 0.07,
        parent: g,
        cast: false,
      });
    }
  }
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
}

function buildCopier(parent) {
  const g = group('copier');
  const body = toon('#e8e4d8', { rim: 0.12, rimColor: '#b8d8f0', gradient: 'soft' });
  const dark = toon('#454b55', { rim: 0.1 });
  const x = 1.36;
  const z = 0.32;
  box(0.42, 0.95, 0.56, body, { x, y: FLOOR + 0.475, z, parent: g });
  box(0.46, 0.1, 0.6, dark, { x, y: FLOOR + 0.98, z, parent: g });
  // 操作面板
  const panel = plane(0.22, 0.16, new THREE.MeshBasicMaterial({ color: '#2b4a66' }), {
    x: x - 0.22,
    y: FLOOR + 1.04,
    z: z + 0.1,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  panel.userData.noOutline = true;
  // 出纸口
  box(0.03, 0.06, 0.4, dark, { x: x - 0.23, y: FLOOR + 0.6, z, parent: g, cast: false });
  parent.add(g);
  addOutline(g, { width: 0.00085, color: '#0d1220' });
}

/* ========================================================================== */
/*  天花板 / 墙面 / 小物                                                         */
/* ========================================================================== */

function buildCeiling(parent) {
  const g = group('ceiling');
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0aa').multiplyScalar(1.6) });
  const housing = toon('#cdc8bc', { rim: 0.08, rimColor: '#e8d8b0', gradient: 'soft' });
  const zs = [0.3, -1.15, -2.55, -3.85];
  for (const z of zs) {
    // 灯槽
    box(3.3, 0.06, 0.24, housing, { x: -0.8, y: CEIL - 0.04, z, parent: g, cast: false });
    box(3.16, 0.035, 0.16, lightMat, { x: -0.8, y: CEIL - 0.075, z, parent: g, cast: false });
    // 暖色光晕
    const gl = glowSprite('#ffd9a0', 1.4, 0.07);
    gl.position.set(-0.8, CEIL - 0.2, z);
    g.add(gl);
  }
  // 靠窗的一条长灯带（从街上抬头能看到暖光）
  box(3.5, 0.05, 0.12, lightMat, { x: -0.75, y: CEIL - 0.1, z: 0.72, parent: g, cast: false });
  for (const gx of [-2.2, -1.1, 0, 1.1]) {
    const gl2 = glowSprite('#ffe0b0', 1.2, 0.06);
    gl2.position.set(gx, CEIL - 0.25, 0.7);
    g.add(gl2);
  }
  // 通风口
  for (const [x, z] of [
    [-2.3, -3.5],
    [1.2, -1.2],
  ]) {
    box(0.5, 0.03, 0.4, toon('#b8bcc4'), { x, y: CEIL - 0.01, z, parent: g, cast: false });
    for (let i = 0; i < 5; i += 1) {
      box(0.42, 0.01, 0.02, toon('#8d929a'), { x, y: CEIL - 0.026, z: z - 0.14 + i * 0.07, parent: g, cast: false });
    }
  }
  // 监控球机
  sphere(0.07, toon('#e8e4d8'), { x: 1.2, y: CEIL - 0.12, z: 0.4, parent: g, cast: false });
  cyl(0.02, 0.02, 0.1, 8, toon('#9aa0a8'), { x: 1.2, y: CEIL - 0.03, z: 0.4, parent: g, cast: false });
  parent.add(g);

  // 吊挂 aisle 灯牌
  const signs = [
    { label: 'お菓子・スナック', en: 'SNACKS', color: '#2b5fa8', x: -1.7, z: -1.0 },
    { label: 'おにぎり・お弁当', en: 'RICE & BENTO', color: '#2f7a62', x: -1.7, z: -1.95 },
    { label: '飲み物・日用品', en: 'DRINKS & GOODS', color: '#8a4a2b', x: -1.7, z: -2.9 },
  ];
  const metal = toon('#9aa0a8', { rim: 0.2, rimColor: '#e8f2ff' });
  for (const s of signs) {
    const tex = aisleSignTexture(s.label, s.en, s.color);
    const board = plane(1.16, 0.28, lightbox(tex, 1.0), {
      x: s.x,
      y: 2.14,
      z: s.z,
      cast: false,
      receive: false,
      parent: g,
    });
    board.userData.noOutline = true;
    // 吊杆
    for (const dx of [-0.45, 0.45]) {
      cyl(0.008, 0.008, 0.38, 6, metal, { x: s.x + dx, y: 2.38, z: s.z, parent: g, cast: false });
    }
  }
  parent.add(g);
}

function buildWalls(parent) {
  const g = group('walls');
  // 靠窗的欢迎横幅（从天花板垂下来，透玻璃可见）
  const banner = plane(0.52, 1.0, new THREE.MeshBasicMaterial({ map: windowBannerTexture(), fog: true }), {
    x: 0.25,
    y: 1.86,
    z: 0.62,
    cast: false,
    receive: false,
    parent: g,
  });
  banner.userData.noOutline = true;
  // 室内墙面：比室外略深的暖色护墙板，压出室内层次
  const wallWarm = toon('#c4b69c', { rim: 0.08, rimColor: '#ffe2b8', gradient: 'soft', emissive: '#2a1a0c', emissiveIntensity: 0.25 });
  // 左墙内侧
  plane(0.02, I.maxZ - I.minZ - 0.04, wallWarm, { x: I.minX + 0.012, y: 1.0, z: (I.minZ + I.maxZ) / 2, ry: Math.PI / 2, cast: false, receive: true, parent: g });
  // 右墙内侧
  plane(0.02, I.maxZ - I.minZ - 0.04, wallWarm, { x: I.maxX - 0.012, y: 1.0, z: (I.minZ + I.maxZ) / 2, ry: -Math.PI / 2, cast: false, receive: true, parent: g });
  // 后墙内侧（冷柜上方的暖色墙）
  plane(I.maxX - I.minX - 0.04, 0.5, wallWarm, { x: MIDX, y: 2.32, z: I.minZ + 0.012, ry: 0, cast: false, receive: true, parent: g });

  // 左侧墙的便当海报
  const poster1 = plane(0.66, 0.92, new THREE.MeshBasicMaterial({ map: TEX.posterOnigiri(), fog: true }), {
    x: -2.7,
    y: 1.9,
    z: -3.45,
    ry: Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  poster1.userData.noOutline = true;
  // 右墙咖啡菜单
  const menu = plane(0.62, 0.62, lightbox(coffeeMenuTexture(), 0.9), {
    x: 1.5,
    y: 1.9,
    z: -0.55,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  menu.userData.noOutline = true;
  // 右墙靠入口的促销小灯箱
  const poster2 = plane(0.42, 0.58, new THREE.MeshBasicMaterial({ map: TEX.posterMoonDango(), fog: true }), {
    x: 1.505,
    y: 1.86,
    z: 0.12,
    ry: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  poster2.userData.noOutline = true;
  // STAFF ONLY 门
  const door = plane(0.78, 1.9, new THREE.MeshBasicMaterial({ map: staffDoorTexture(), fog: true }), {
    x: 0.72,
    y: FLOOR + 0.95,
    z: -4.405,
    cast: false,
    receive: false,
    parent: g,
  });
  door.userData.noOutline = true;
  box(0.86, 0.06, 0.08, toon('#8d939c'), { x: 0.72, y: FLOOR + 1.99, z: -4.42, parent: g, cast: false });
  // 门上的出路灯
  box(0.12, 0.06, 0.1, flat('#ffd9a0'), { x: 0.72, y: FLOOR + 2.12, z: -4.38, parent: g, cast: false });
  // 后墙「いらっしゃいませ」小横幅
  const backBanner = plane(1.1, 0.24, lightbox(welcomeBannerTexture(), 0.95), {
    x: 0.95,
    y: 2.28,
    z: -4.41,
    cast: false,
    receive: false,
    parent: g,
  });
  backBanner.userData.noOutline = true;
  // OPEN 霓虹（店内，抬头可见）
  const neon = plane(0.62, 0.31, new THREE.MeshBasicMaterial({
    map: openNeonTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }), {
    x: 0.98,
    y: 2.28,
    z: 0.55,
    cast: false,
    receive: false,
    parent: g,
  });
  neon.userData.noOutline = true;
  parent.add(g);
}

function buildFloor(parent) {
  const g = group('floor');
  const tex = floorTexture();
  const floorMat = toon('#d8d2c2', { map: tex, rim: 0.08, rimColor: '#ffe9c0', gradient: 'soft', emissive: '#2a1c0e', emissiveIntensity: 0.3 });
  plane(I.maxX - I.minX, I.maxZ - I.minZ, floorMat, {
    x: MIDX,
    y: FLOOR + 0.002,
    z: (I.minZ + I.maxZ) / 2,
    rx: -Math.PI / 2,
    cast: false,
    receive: true,
    parent: g,
  });
  // 门口到收银台的导视
  const guide = plane(0.9, 2.6, new THREE.MeshBasicMaterial({
    map: guideTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
  }), {
    x: 0.9,
    y: FLOOR + 0.006,
    z: -1.3,
    rx: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  guide.userData.noOutline = true;
  // 玻璃下的暖色反光条
  const refl = plane(2.6, 0.26, new THREE.MeshBasicMaterial({
    color: '#ffdba8',
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), {
    x: -1.0,
    y: FLOOR + 0.005,
    z: 0.68,
    rx: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  refl.userData.noOutline = true;
  // 购物篮堆叠
  const basketMat = toon('#3f7ac0', { rim: 0.2, rimColor: '#9fd8ff', gradient: 'soft' });
  for (let i = 0; i < 4; i += 1) {
    box(0.5, 0.09, 0.36, basketMat, { x: 0.36, y: FLOOR + 0.05 + i * 0.075, z: 0.5, parent: g, cast: false });
  }
  // 门口的防滑垫
  box(0.9, 0.012, 0.5, toon('#3a4250'), { x: 0.98, y: FLOOR + 0.007, z: 0.55, parent: g, cast: false });
  parent.add(g);
}

/* ========================================================================== */
/*  build                                                                      */
/* ========================================================================== */

export function buildInterior(ctx) {
  const { handles } = ctx;
  const g = group('interior');

  buildFloor(g);
  buildCeiling(g);
  buildProducts(g, handles);
  buildGondola(g);
  buildCooler(g);
  buildBentoFridge(g);
  buildMagazineRack(g);
  buildFrontDisplay(g);
  buildCounter(g, handles);
  buildIceFreezer(g);
  buildATM(g);
  buildCopier(g);
  buildWalls(g);

  ctx.root.add(g);

  // 室内不需要投射/接收外部阳光阴影（屋顶遮挡 + 会浪费 shadow pass），只靠室内点光
  shadow(g, false, true);
  g.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.transparent) {
      obj.castShadow = false;
    }
    if (obj.isSprite) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  return {
    group: g,
    update(t) {
      // 收银机屏幕极轻微亮度呼吸（非常克制）
      // 保持静态为主；动效由 fx 统一负责
    },
  };
}
