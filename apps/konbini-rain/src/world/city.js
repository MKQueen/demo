/**
 * world/city.js —— 44×44 日式雨夜小镇（v4 大版本）
 *
 * 结构：中央十字街 + 四条次街，东侧铁道/车站，南侧河与桥；
 * 东北角便利店（保留完整内景），主街商店街、北侧小门面；
 * 北侧大校园（校舍/体育馆/泳池/操场），西侧神社，东侧医院，
 * 外圈住宅与公寓、河岸公园和夜市。动效层包含列车、汽车、行人、
 * 猫、灯笼、信号灯、站牌、花瓣、蒸汽等。
 */
import * as THREE from 'three';
import { E } from '../config.js';
import { toon, flat, lightbox, glow, glowSprite, addOutline } from '../lib/toon.js';
import { canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import { box, plane, group, cyl, sphere, mesh, torus } from '../lib/kit.js';
import {
  signTexture, chochin, noren, windowUnit, acUnit,
  streetLamp, vendingMachine, bicycle, planter, postBox, cat, lanternString,
} from './shops.js';

const Y = Y0();
function Y0() { return 0.12; }
const rand = mulberry32(20261106);

function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*  小工具                                                                     */
/* -------------------------------------------------------------------------- */

function litWindow(parent, { x, y, z, w = 0.6, h = 0.55, color = '#ffd9a0', lit = 0.85, ry = 0 }) {
  const m = flat(color, { fog: false });
  m.color.multiplyScalar(lit);
  m.toneMapped = false;
  const p = plane(w, h, m, { x, y, z, ry, parent });
  p.userData.noOutline = true;
  return p;
}

function windowGrid(parent, { x, y0, z, w, h, cols, rows, gapX, gapY, color = '#ffd9a0', ry = 0, litBase = 0.55 }) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      litWindow(parent, {
        x: x + (c - (cols - 1) / 2) * gapX,
        y: y0 + r * gapY,
        z,
        w, h, ry,
        color,
        lit: litBase + ((r * 3 + c * 5) % 5) * 0.09,
      });
    }
  }
}

function tree(parent, { x, z, h = 3.2, r = 0.9, color = '#3f5a44', sway = 0.006 }) {
  const g = group('tree');
  g.position.set(x, Y, z);
  parent.add(g);
  cyl(0.1, 0.14, h * 0.55, 6, toon('#4a3728', { rim: 0.16 }), { y: h * 0.28, parent: g, cast: true });
  const crown = group('crown');
  crown.position.y = h * 0.62;
  g.add(crown);
  sphere(r, toon(color, { rim: 0.18, rimColor: '#9fd8a0' }), { y: 0.0, parent: crown, cast: true });
  sphere(r * 0.75, toon(color, { rim: 0.16 }), { x: r * 0.55, y: r * 0.35, parent: crown, cast: true });
  sphere(r * 0.7, toon(color, { rim: 0.16 }), { x: -r * 0.5, y: r * 0.25, parent: crown, cast: true });
  crown.userData.sway = { crown, amp: sway, speed: 0.8 + (x + z) % 0.5 };
  return g;
}

function bench(parent, { x, z, ry = 0 }) {
  const g = group('bench');
  g.position.set(x, Y, z); g.rotation.y = ry;
  parent.add(g);
  box(1.1, 0.06, 0.34, toon('#6a4a32', { rim: 0.14 }), { y: 0.42, parent: g, cast: true });
  box(1.1, 0.34, 0.05, toon('#6a4a32', { rim: 0.14 }), { y: 0.63, z: -0.14, parent: g, cast: true });
  for (const dx of [-0.42, 0.42]) cyl(0.03, 0.03, 0.4, 4, toon('#3a3f47', { rim: 0.1 }), { x: dx, y: 0.21, parent: g, cast: false });
  return g;
}

function hedge(parent, { x, z, w, d, h = 0.5 }) {
  const g = group('hedge');
  g.position.set(x, Y, z);
  parent.add(g);
  box(w, h, d, toon('#3f5a44', { rim: 0.16, rimColor: '#9fd8a0' }), { y: h / 2, parent: g, cast: true });
  for (let i = 0; i < Math.ceil(w / 0.4); i += 1) {
    sphere(0.2, toon(i % 2 ? '#44684a' : '#3f5a44', { rim: 0.14 }), { x: -w / 2 + 0.2 + i * 0.4, y: h, parent: g, cast: false });
  }
}

/* 正确的四坡屋顶：矩形底面 + 屋脊，避免 ConeGeometry 非均匀缩放后旋转造成的歪斜和巨大出檐 */
function hipRoof(w, d, rise, opts = {}) {
  const overhang = opts.overhang ?? 0.3;
  const ridge = opts.ridge ?? 0.28;
  const color = opts.color || '#2f343c';
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const alongX = w >= d;
  const rh = Math.max(0.15, (alongX ? w : d) * ridge * 0.5);
  const pos = alongX
    ? [
        -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,  -hw, 0, hd,
        -rh, rise, 0,  rh, rise, 0,
      ]
    : [
        -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,  -hw, 0, hd,
        0, rise, -rh,  0, rise, rh,
      ];
  const idx = alongX
    ? [0,1,5, 0,5,4, 2,3,4, 2,4,5, 3,0,4, 1,2,5]
    : [0,1,4, 2,3,5, 3,0,4, 3,4,5, 1,2,5, 1,5,4];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo, toon(color, { rim: 0.2, rimColor: '#8fa8c8', side: THREE.DoubleSide }));
  roof.castShadow = true;
  roof.receiveShadow = true;
  // 屋脊
  const ridgeMesh = box(alongX ? rh * 2 : 0.14, 0.08, alongX ? 0.14 : rh * 2, toon('#20242a', { rim: 0.16 }), {
    y: rise + 0.02, parent: roof,
  });
  ridgeMesh.castShadow = false;
  return roof;
}

/* -------------------------------------------------------------------------- */
/*  住宅                                                                       */
/* -------------------------------------------------------------------------- */

function house(parent, cfg) {
  const g = group(`house-${cfg.id || cfg.x}-${cfg.z}`);
  g.position.set(cfg.x, Y, cfg.z);
  g.rotation.y = cfg.ry || 0;
  parent.add(g);
  const { w, d, h } = cfg;
  const wall = toon(cfg.wall || '#c8c0b0', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' });
  box(w, h, d, wall, { y: h / 2, parent: g, cast: true, receive: true });
  // 基座
  box(w + 0.16, 0.18, d + 0.16, toon('#8a8170', { rim: 0.12 }), { y: 0.09, parent: g, cast: false });
  // 屋顶（四坡屋面，底面贴合建筑）
  const roofH = h * 0.32;
  const roof = hipRoof(w, d, roofH, {
    overhang: 0.26, ridge: 0.34, color: cfg.roofColor || '#2f343c',
  });
  roof.position.y = h + 0.04;
  g.add(roof);
  // 正门 + 窗
  const zf = d / 2 + 0.01;
  box(0.7, 1.45, 0.08, toon('#6a4a32', { rim: 0.14 }), { z: zf, y: 0.8, parent: g, cast: false });
  box(0.86, 0.1, 0.4, toon('#3a3430', { rim: 0.12 }), { z: zf + 0.18, y: 1.65, parent: g, cast: true });
  litWindow(g, { x: -w * 0.28, y: 1.25, z: zf + 0.02, w: 0.8, h: 0.65, color: cfg.warm, lit: 0.55 + rand() * 0.3 });
  if (w > 2.8) litWindow(g, { x: w * 0.28, y: 1.25, z: zf + 0.02, w: 0.8, h: 0.65, color: cfg.warm, lit: 0.45 + rand() * 0.35 });
  // 二层窗
  if (h > 2.6) {
    litWindow(g, { x: -w * 0.24, y: h * 0.62, z: zf + 0.02, w: 0.7, h: 0.55, color: cfg.warm, lit: 0.4 + rand() * 0.3 });
    litWindow(g, { x: w * 0.24, y: h * 0.62, z: zf + 0.02, w: 0.7, h: 0.55, color: cfg.warm, lit: 0.35 + rand() * 0.3 });
  }
  // 侧窗
  for (const sx of [-1, 1]) {
    litWindow(g, { x: sx * (w / 2 + 0.01), y: h * 0.55, z: -d * 0.15, w: 0.5, h: 0.5, ry: sx * Math.PI / 2, color: cfg.warm, lit: 0.3 + rand() * 0.3 });
  }
  // 信箱 / 空调 / 小院
  box(0.22, 0.34, 0.16, toon('#3a4652', { rim: 0.12 }), { x: -w / 2 + 0.3, z: zf + 0.15, y: 0.35, parent: g, cast: false });
  acUnit(g, { x: w * 0.32, y: 0.65, z: zf + 0.14, ry: 0 });
  if (cfg.garden) {
    hedge(g, { x: -w / 2 - 0.5, z: 0.2, w: 0.3, d: d * 0.8, h: 0.55 });
    tree(g, { x: w * 0.42, z: d * 0.55, h: h * 0.62, r: 0.55, color: '#3f5a44' });
  }
  // 屋顶水箱
  if (rand() > 0.55) cyl(0.22, 0.22, 0.3, 8, toon('#b9c0c8', { rim: 0.16 }), { x: -w * 0.2, y: h + roofH * 0.6, z: 0, parent: g, cast: false });
  addOutline(g, { width: 0.0012, color: '#080b14' });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  公寓                                                                       */
/* -------------------------------------------------------------------------- */

function apartment(parent, cfg) {
  const g = group('apartment');
  g.position.set(cfg.x, Y, cfg.z);
  g.rotation.y = cfg.ry || 0;
  parent.add(g);
  const { w, d, h, floors } = cfg;
  box(w, h, d, toon('#9a9284', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), { y: h / 2, parent: g, cast: true, receive: true });
  box(w + 0.2, 0.2, d + 0.2, toon('#6a6558', { rim: 0.12 }), { y: 0.1, parent: g, cast: false });
  const fh = (h - 0.6) / floors;
  for (let f = 0; f < floors; f += 1) {
    const y = 0.9 + f * fh;
    // 正面窗 / 阳台
    windowGrid(g, { x: 0, y0: y, z: d / 2 + 0.01, w: 0.62, h: 0.5, cols: Math.max(2, Math.round(w / 1.1)), rows: 1, gapX: 0.95, gapY: 0.5, color: '#ffd9a0', litBase: 0.45 });
    box(w * 0.86, 0.08, 0.4, toon('#5a5f66', { rim: 0.12 }), { y: y - 0.34, z: d / 2 + 0.2, parent: g, cast: false });
    for (let i = 0; i < 7; i += 1) cyl(0.01, 0.01, 0.34, 4, toon('#6b7178', { rim: 0.08 }), { x: -w * 0.38 + (w * 0.76 * i) / 6, y: y - 0.14, z: d / 2 + 0.38, parent: g, cast: false });
    // 侧面窗
    windowGrid(g, { x: w / 2 + 0.01, y0: y, z: 0, w: 0.5, h: 0.48, cols: Math.max(1, Math.round(d / 1.6)), rows: 1, gapX: 1.0, gapY: 0.5, ry: Math.PI / 2, color: '#ffcd94', litBase: 0.4 });
    acUnit(g, { x: w * 0.32, y: y + 0.1, z: d / 2 + 0.06, ry: 0 });
  }
  // 入口
  box(1.2, 0.12, 0.8, toon('#3a4652', { rim: 0.14 }), { y: 0.32, z: d / 2 + 0.42, parent: g, cast: true });
  box(0.1, 2.2, 0.1, toon('#4a5058', { rim: 0.1 }), { x: -0.55, y: 1.2, z: d / 2 + 0.7, parent: g, cast: false });
  box(0.1, 2.2, 0.1, toon('#4a5058', { rim: 0.1 }), { x: 0.55, y: 1.2, z: d / 2 + 0.7, parent: g, cast: false });
  box(1.25, 0.1, 0.9, toon('#3a4652', { rim: 0.14 }), { y: 2.3, z: d / 2 + 0.45, parent: g, cast: true });
  // 屋顶
  box(w + 0.2, 0.12, d + 0.2, toon('#4a5058', { rim: 0.14 }), { y: h + 0.06, parent: g, cast: true });
  cyl(0.26, 0.26, 0.4, 10, toon('#b9c0c8', { rim: 0.16 }), { x: -w * 0.22, y: h + 0.34, z: -d * 0.12, parent: g, cast: true });
  cyl(0.02, 0.03, 1.6, 4, toon('#8a9199', { rim: 0.1 }), { x: w * 0.25, y: h + 0.8, z: -d * 0.1, parent: g, cast: false });
  box(w * 0.7, 0.03, 0.03, toon('#8a9199', { rim: 0.1 }), { x: w * 0.25, y: h + 1.4, z: -d * 0.1, parent: g, cast: false });
  // 屋顶招牌
  const tex = signTexture(512, 128, (ctx, sw, sh) => {
    ctx.fillStyle = '#2a3038'; ctx.fillRect(0, 0, sw, sh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 44px ${JP_FONT}`; ctx.fillStyle = '#ffe0b0'; ctx.fillText('月見ハイツ', sw / 2, sh / 2);
  });
  plane(w * 0.5, 0.32, lightbox(tex, 1.1), { y: h + 0.2, z: d / 2 + 0.03, parent: g }).userData.noOutline = true;
  addOutline(g, { width: 0.0012, color: '#080b14' });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  商店                                                                       */
/* -------------------------------------------------------------------------- */

function shopFrontTexture(kind, accent) {
  return signTexture(512, 320, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, kind === 'laundry' ? '#d8f0f8' : '#3a281e');
    grd.addColorStop(1, kind === 'laundry' ? '#8fc8d8' : '#17100d');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    // 灯
    ctx.fillStyle = 'rgba(255,220,160,0.75)';
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(50 + i * 135, 30, 12, 0, Math.PI * 2); ctx.fill(); }
    if (kind === 'books') {
      for (let r = 0; r < 4; r += 1) for (let c = 0; c < 7; c += 1) {
        ctx.fillStyle = ['#8c3a2a', '#3a5a4a', '#7a5a2a', '#3a4a6a', '#c8a060'][(r + c) % 5];
        ctx.fillRect(22 + c * 68, 70 + r * 56, 56, 40);
      }
    } else if (kind === 'pharmacy') {
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 8; c += 1) {
        ctx.fillStyle = ['#e8f0e8', '#7fd8b8', '#e8d070', '#c8e8ff'][(r + c) % 4];
        ctx.fillRect(18 + c * 60, 68 + r * 58, 48, 42);
      }
    } else if (kind === 'laundry') {
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = '#e8f0f2'; ctx.fillRect(24 + i * 118, 90, 88, 150);
        ctx.fillStyle = '#7fbfd8'; ctx.beginPath(); ctx.arc(68 + i * 118, 165, 26, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'barber') {
      ctx.fillStyle = '#e8e8e0'; ctx.fillRect(24, 46, 100, 220); ctx.fillRect(388, 46, 100, 220);
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(60, 160, 140, 14); ctx.fillRect(300, 150, 130, 14);
    } else {
      // 居酒屋/拉面/咖啡的柜台与暖光
      ctx.fillStyle = 'rgba(30,18,14,0.85)'; ctx.fillRect(0, 190, w, 130);
      ctx.fillStyle = 'rgba(255,200,140,0.75)';
      for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.arc(60 + i * 100, 210, 10, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = 'rgba(40,24,18,0.9)';
        ctx.fillRect(50 + i * 160, 250, 110, 16); ctx.fillRect(60 + i * 160, 266, 10, 50); ctx.fillRect(140 + i * 160, 266, 10, 50);
      }
    }
    // 玻璃反光
    ctx.fillStyle = 'rgba(210,235,255,0.08)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.35, 0); ctx.lineTo(w * 0.1, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  });
}

function shop(parent, cfg) {
  const g = group(`shop-${cfg.id}`);
  const { w, d, h } = cfg;
  // cfg.x / cfg.z 是「店门中心」的世界坐标：按朝向把体块退到门后
  const ry = cfg.ry || 0;
  const offX = Math.abs(ry - Math.PI / 2) < 0.01 ? -d / 2 : Math.abs(ry + Math.PI / 2) < 0.01 ? d / 2 : 0;
  const offZ = Math.abs(ry) < 0.01 ? -d / 2 : Math.abs(Math.abs(ry) - Math.PI) < 0.01 ? d / 2 : 0;
  g.position.set(cfg.x + offX, Y, cfg.z + offZ);
  g.rotation.y = ry;
  parent.add(g);
  box(w, h, d, toon('#b8ac98', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), { y: h / 2, parent: g, cast: true, receive: true });
  box(w + 0.16, 0.16, d + 0.16, toon('#6a6558', { rim: 0.12 }), { y: 0.08, parent: g, cast: false });
  // 屋顶：四坡屋面 + 屋脊
  const roofH = Math.max(0.65, w * 0.2);
  const shopRoof = hipRoof(w, d, roofH, { overhang: 0.32, ridge: 0.24, color: '#2f343c' });
  shopRoof.position.y = h + 0.04;
  g.add(shopRoof);
  // 一层店面玻璃
  const glassW = w - 0.5;
  const glassH = 2.3;
  const zf = d / 2 + 0.01;
  plane(glassW, glassH, lightbox(shopFrontTexture(cfg.kind, cfg.accent), 1.0), { z: zf, y: 1.35, parent: g }).userData.noOutline = true;
  // 门
  box(0.8, 1.9, 0.05, toon('#2a2a2e', { rim: 0.12 }), { x: w * 0.25, z: zf + 0.03, y: 1.05, parent: g, cast: false });
  // 招牌
  const tex = signTexture(512, 128, (ctx, sw, sh) => {
    ctx.fillStyle = cfg.paper || '#2a1c14'; ctx.fillRect(0, 0, sw, sh);
    ctx.strokeStyle = cfg.accent; ctx.lineWidth = 5; ctx.strokeRect(5, 5, sw - 10, sh - 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 50px ${JP_FONT}`; ctx.fillStyle = cfg.sign || '#ffd9a0'; ctx.fillText(cfg.jp, sw / 2, sh * 0.42);
    ctx.font = `500 22px ${EN_FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(cfg.en, sw / 2, sh * 0.78);
  });
  plane(w * 0.92, 0.52, lightbox(tex, 1.25), { z: zf + 0.04, y: 2.95, parent: g }).userData.noOutline = true;
  // 雨棚
  const aw = box(w * 0.98, 0.05, 0.85, toon(cfg.accent, { rim: 0.18, opacity: 1 }), { z: zf + 0.35, y: 2.55, parent: g, cast: true });
  aw.rotation.x = -0.12;
  // 暖帘 / 灯笼
  if (cfg.kind === 'izakaya' || cfg.kind === 'ramen') {
    noren(g, { x: 0, y: 2.1, z: zf + 0.08, w: w * 0.7, h: 0.65, color: cfg.paper, text: cfg.jp.slice(0, 4) });
    chochin(g, { x: -w * 0.36, y: 2.5, z: zf + 0.2, r: 0.16, color: '#d24a38', text: '', glowSize: 0.9 });
    chochin(g, { x: w * 0.36, y: 2.5, z: zf + 0.2, r: 0.16, color: '#d24a38', text: '', glowSize: 0.9 });
  }
  if (cfg.kind === 'barber') {
    for (let i = 0; i < 6; i += 1) box(0.08, 0.22, 0.08, toon(i % 2 ? '#e8e8e0' : '#c8433a', { rim: 0.1 }), { x: w * 0.42, y: 1.7 + i * 0.24, z: zf + 0.35, parent: g, cast: false });
  }
  if (cfg.kind === 'cafe') {
    box(0.5, 0.04, 0.3, toon('#3a2a20', { rim: 0.1 }), { x: -w * 0.3, y: 1.0, z: zf + 0.5, parent: g, cast: false });
  }
  // 二层窗 / 空调
  if (h > 4.2) {
    windowGrid(g, { x: 0, y0: h * 0.64, z: zf + 0.02, w: 0.56, h: 0.5, cols: Math.max(2, Math.round(w / 1.0)), rows: 1, gapX: 0.95, gapY: 0.5, color: '#ffd9a0', litBase: 0.35 });
    acUnit(g, { x: w * 0.32, y: h * 0.55, z: zf + 0.12, ry: 0 });
  }
  // 侧墙窗
  for (const sx of [-1, 1]) litWindow(g, { x: sx * (w / 2 + 0.01), y: 2.2, z: -d * 0.12, w: 0.45, h: 0.45, ry: sx * Math.PI / 2, color: '#ffd9a0', lit: 0.35 });
  addOutline(g, { width: 0.0012, color: '#080b14' });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  大校园                                                                     */
/* -------------------------------------------------------------------------- */

function schoolCampus(parent) {
  const g = group('school-campus');
  parent.add(g);
  const s = E.school;
  // 校舍（4F）
  const sg = group('school-main');
  sg.position.set(s.x, Y, s.z);
  g.add(sg);
  box(s.w, s.h, s.d, toon('#c8c4b0', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), { y: s.h / 2, parent: sg, cast: true, receive: true });
  box(s.w + 0.3, 0.2, s.d + 0.3, toon('#7a7468', { rim: 0.14 }), { y: 0.1, parent: sg, cast: false });
  // 正面四层连续窗带
  const floors = s.floors || 4;
  const fh = (s.h - 0.8) / floors;
  for (let f = 0; f < floors; f += 1) {
    const y = 1.1 + f * fh;
    for (let c = 0; c < 10; c += 1) {
      litWindow(sg, { x: -s.w / 2 + 0.9 + c * ((s.w - 1.8) / 9), y, z: s.d / 2 + 0.02, w: 0.85, h: 0.62, color: f === 0 ? '#ffe8c0' : '#ffd9a0', lit: f === 0 ? 0.55 : 0.35 + ((c + f) % 4) * 0.1 });
    }
    box(s.w * 0.94, 0.05, 0.06, toon('#8a8478', { rim: 0.1 }), { y: y - 0.45, z: s.d / 2 + 0.06, parent: sg, cast: false });
  }
  // 背部 / 侧面窗
  for (let f = 0; f < floors; f += 1) {
    const y = 1.1 + f * fh;
    for (let c = 0; c < 8; c += 1) litWindow(sg, { x: -s.w / 2 + 1.0 + c * ((s.w - 2) / 7), y, z: -s.d / 2 - 0.02, w: 0.75, h: 0.58, ry: Math.PI, color: '#ffcf94', lit: 0.25 + ((c + f) % 3) * 0.12 });
  }
  // 入口
  box(2.2, 2.6, 1.1, toon('#7a7468', { rim: 0.16 }), { z: s.d / 2 + 0.45, y: 1.3, parent: sg, cast: true });
  box(2.6, 0.14, 1.4, toon('#3a4652', { rim: 0.14 }), { z: s.d / 2 + 0.6, y: 2.75, parent: sg, cast: true });
  const nameTex = signTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8f0f8'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 74px ${JP_FONT}`; ctx.fillStyle = '#2a3a4a'; ctx.fillText('月見町立 月見小学校', w / 2, h / 2);
  });
  plane(6.4, 1.0, lightbox(nameTex, 1.1), { z: s.d / 2 + 0.06, y: 3.8, parent: sg }).userData.noOutline = true;
  // 钟楼 + 钟
  cyl(0.16, 0.22, 4.0, 8, toon('#d8d4c8', { rim: 0.18 }), { x: -s.w * 0.36, y: s.h + 2.0, z: 0, parent: sg, cast: true });
  box(0.5, 0.5, 0.5, toon('#f0ece0', { rim: 0.2 }), { x: -s.w * 0.36, y: s.h + 4.1, z: 0, parent: sg, cast: true });
  cyl(0.19, 0.19, 0.04, 16, toon('#2a3038', { rim: 0.2 }), { x: -s.w * 0.36, y: s.h + 4.18, z: 0.24, rx: Math.PI / 2, parent: sg, cast: false });
  // 大屋顶（贴合校舍轮廓）
  const schoolRoof = hipRoof(s.w + 0.4, s.d + 0.4, 2.2, { overhang: 0.55, ridge: 0.26, color: '#2a3038' });
  schoolRoof.position.y = s.h + 0.08;
  sg.add(schoolRoof);
  for (let i = 0; i < 8; i += 1) cyl(0.02, 0.02, 0.4, 4, toon('#5d636b', { rim: 0.1 }), { x: -s.w / 2 + 0.8 + i * ((s.w - 1.6) / 7), y: s.h + 0.2, z: s.d / 2 - 0.1, parent: sg, cast: false });
  box(s.w, 0.03, 0.03, toon('#5d636b', { rim: 0.1 }), { y: s.h + 0.4, z: s.d / 2 - 0.1, parent: sg, cast: false });

  // 体育馆
  const gym = E.gym;
  const gg = group('school-gym');
  gg.position.set(gym.x, Y, gym.z);
  g.add(gg);
  box(gym.w, gym.h, gym.d, toon('#9a9488', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), { y: gym.h / 2, parent: gg, cast: true });
  box(gym.w + 0.3, 0.2, gym.d + 0.3, toon('#6a6558', { rim: 0.12 }), { y: 0.1, parent: gg, cast: false });
  box(gym.w + 0.6, 0.35, gym.d + 0.6, toon('#3a4652', { rim: 0.18 }), { y: gym.h + 0.1, parent: gg, cast: true });
  for (let i = 0; i < 4; i += 1) litWindow(gg, { x: -gym.w * 0.34 + i * (gym.w * 0.68 / 3), y: gym.h * 0.62, z: gym.d / 2 + 0.02, w: 0.8, h: 0.5, color: '#fff0c8', lit: 0.55 });
  for (let i = 0; i < 3; i += 1) litWindow(gg, { x: -gym.w / 2 - 0.01, y: gym.h * 0.58, z: -gym.d * 0.28 + i * gym.d * 0.28, w: 0.5, h: 0.45, ry: -Math.PI / 2, color: '#ffd9a0', lit: 0.4 });
  const gymTex = signTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f0ece0'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 44px ${JP_FONT}`; ctx.fillStyle = '#3a3028'; ctx.fillText('月見小学校 体育館', w / 2, h / 2);
  });
  plane(4.0, 0.8, lightbox(gymTex, 1.1), { z: gym.d / 2 + 0.03, y: 4.1, parent: gg }).userData.noOutline = true;

  // 泳池
  const pool = E.pool;
  box(pool.w, 0.12, pool.d, toon('#d8e8f0', { rim: 0.14 }), { x: pool.x, y: Y + 0.14, z: pool.z, parent: g, cast: false });
  const water = plane(pool.w - 0.3, pool.d - 0.3, flat('#3a8ab8', { fog: false }), { x: pool.x, y: Y + 0.21, z: pool.z, rx: -Math.PI / 2, parent: g });
  water.material.color.multiplyScalar(1.2);
  box(pool.w, 0.4, 0.08, toon('#8a8d84', { rim: 0.12 }), { x: pool.x, y: Y + 0.3, z: pool.z - pool.d / 2, parent: g, cast: false });

  // 操场 / 跑道
  const yard = E.schoolYard;
  box(yard.w, 0.02, yard.d, toon('#8a6a4a', { rim: 0.1 }), { x: yard.x, y: Y + 0.13, z: yard.z, parent: g, cast: false });
  for (let i = 0; i < 4; i += 1) {
    box(yard.w - 1.0, 0.01, 0.06, flat('#e8e0d0').clone(), { x: yard.x, y: Y + 0.145, z: yard.z - yard.d / 2 + 0.4 + i * (yard.d - 0.8) / 3, parent: g, cast: false });
  }
  // 篮球架
  for (const dx of [-3.2, 3.2]) {
    cyl(0.05, 0.05, 2.2, 6, toon('#5d636b', { rim: 0.12 }), { x: yard.x + dx, y: Y + 1.2, z: yard.z, parent: g, cast: false });
    box(0.1, 0.55, 0.9, toon('#e8e4d4', { rim: 0.14 }), { x: yard.x + dx, y: Y + 2.0, z: yard.z + 0.3, parent: g, cast: false });
    torus(0.17, 0.02, 4, 8, toon('#d24a38', { rim: 0.1 }), { x: yard.x + dx, y: Y + 1.75, z: yard.z + 0.7, rx: Math.PI / 2, parent: g, cast: false });
  }
  // 围栏与校门
  for (const x of [-s.w / 2 - 0.8, s.w / 2 + 0.8]) {
    box(0.06, 1.3, yard.d + 1.0, toon('#5d636b', { rim: 0.1 }), { x, y: Y + 0.65, z: yard.z, parent: g, cast: false });
  }
  for (let i = 0; i < 7; i += 1) {
    box(0.03, 1.1, 0.03, toon('#5d636b', { rim: 0.1 }), { x: -s.w / 2 + i * (s.w / 6), y: Y + 0.55, z: yard.z - yard.d / 2, parent: g, cast: false });
  }
  for (const dx of [-1.1, 1.1]) box(0.16, 1.8, 0.16, toon('#8a8d84', { rim: 0.14 }), { x: yard.x + dx, y: Y + 0.9, z: yard.z + yard.d / 2, parent: g, cast: true });
  // 树
  for (const [x, z] of [[-s.w / 2 - 2.2, s.z + 1.5], [-s.w / 2 - 3.2, s.z - 2.0], [s.w / 2 + 1.6, s.z + 2.0], [s.w / 2 + 2.8, s.z - 2.2]]) {
    tree(g, { x, z, h: 3.8, r: 1.1, color: '#3f5a44' });
  }
  addOutline(sg, { width: 0.0012, color: '#080b14' });
  addOutline(gg, { width: 0.0012, color: '#080b14' });
}

/* -------------------------------------------------------------------------- */
/*  神社                                                                       */
/* -------------------------------------------------------------------------- */

function shrine(parent) {
  const s = E.shrine;
  const g = group('shrine');
  g.position.set(s.x, Y, s.z);
  g.rotation.y = Math.PI / 2; // 正门朝东（朝主街）
  parent.add(g);
  const w = s.w, d = s.d;
  // 石台
  box(w, 0.35, d, toon('#6a6a62', { rim: 0.14 }), { y: 0.175, parent: g, cast: true });
  box(w - 0.4, 0.06, d - 0.4, toon('#8a8d84', { rim: 0.12 }), { y: 0.38, parent: g, cast: false });
  // 参道
  for (let i = 0; i < 7; i += 1) {
    box(1.5, 0.05, 0.5, toon('#a8a89a', { rim: 0.1 }), { y: 0.41, z: d / 2 - 0.6 - i * 0.9, parent: g, cast: false });
  }
  // 大鸟居
  const red = toon('#b8402f', { rim: 0.22, rimColor: '#ffb0a0', gradient: 'soft' });
  const tz = d / 2 - 0.7;
  for (const sx of [-1.25, 1.25]) {
    cyl(0.13, 0.16, 3.9, 12, red, { x: sx, y: 2.35, z: tz, parent: g, cast: true });
    cyl(0.2, 0.2, 0.16, 12, toon('#3a241e', { rim: 0.16 }), { x: sx, y: 0.48, z: tz, parent: g, cast: false });
  }
  box(3.6, 0.22, 0.26, red, { y: 3.7, z: tz, parent: g, cast: true });
  box(4.2, 0.16, 0.32, red, { y: 4.05, z: tz, parent: g, cast: true });
  box(4.3, 0.16, 0.36, toon('#3a241e', { rim: 0.16 }), { y: 4.2, z: tz, parent: g, cast: false });
  // 灯笼
  for (const [lx, lz] of [[-1.9, d / 2 - 2.0], [1.9, d / 2 - 2.0], [-1.9, 0.6], [1.9, 0.6]]) {
    cyl(0.06, 0.08, 1.2, 8, toon('#6a6a62', { rim: 0.14 }), { x: lx, y: 0.95, z: lz, parent: g, cast: true });
    box(0.42, 0.3, 0.42, toon('#8a8d84', { rim: 0.16 }), { x: lx, y: 1.62, z: lz, parent: g, cast: true });
    litWindow(g, { x: lx, y: 1.64, z: lz + 0.22, w: 0.24, h: 0.16, color: '#ffcf94', lit: 1.1 });
    warmSprite(g, { x: lx, y: 1.65, z: lz + 0.3, color: '#ffcf94', size: 0.7, opacity: 0.25 });
  }
  // 拜殿 / 本殿
  const shrineBody = group('haiden');
  shrineBody.position.set(0, 0.35, -0.6);
  g.add(shrineBody);
  box(4.0, 2.0, 2.8, toon('#8a6a4c', { rim: 0.16 }), { y: 1.0, parent: shrineBody, cast: true });
  box(4.8, 0.26, 3.4, toon('#3a3030', { rim: 0.2 }), { y: 2.15, parent: shrineBody, cast: true });
  const roof = hipRoof(4.0, 2.8, 1.25, { overhang: 0.5, ridge: 0.3, color: '#3a3030' });
  roof.position.y = 2.15;
  shrineBody.add(roof);
  // 注连绳 / 铃
  cyl(0.05, 0.05, 4.2, 8, toon('#d8d4c8', { rim: 0.12 }), { y: 2.05, z: 1.5, rx: Math.PI / 2, parent: shrineBody, cast: false });
  for (const dx of [-0.5, 0.5]) chochin(shrineBody, { x: dx, y: 1.75, z: 1.6, r: 0.13, color: '#e8dcc0', text: '献灯', glowSize: 0.8 });
  // 绘马架
  const ema = group('ema');
  ema.position.set(-2.4, 0.35, 0.4);
  g.add(ema);
  for (const dz of [-0.5, 0.5]) box(0.08, 1.4, 0.08, toon('#6a4a32', { rim: 0.12 }), { z: dz, y: 0.7, parent: ema, cast: true });
  box(1.2, 0.08, 1.1, toon('#5a3f2c', { rim: 0.12 }), { y: 1.3, parent: ema, cast: true });
  for (let i = 0; i < 8; i += 1) box(0.16, 0.12, 0.02, toon('#e8dcc0', { rim: 0.1 }), { x: -0.45 + (i % 4) * 0.3, y: 1.05 - Math.floor(i / 4) * 0.22, z: 0.56, parent: ema, cast: false });
  // 池塘
  const pond = plane(2.2, 1.4, flat('#1a4a5a', { fog: false }), { x: 2.2, y: 0.44, z: -2.4, rx: -Math.PI / 2, parent: g });
  pond.material.color.multiplyScalar(1.1);
  for (let i = 0; i < 9; i += 1) cyl(0.02, 0.02, 0.5 + (i % 3) * 0.12, 4, toon('#5a6b4a', { rim: 0.1 }), { x: 1.2 + (i % 3) * 0.7, y: 0.7, z: -1.9 - Math.floor(i / 3) * 0.3, parent: g, cast: false });
  // 树与石墙
  for (const [x, z, h] of [[-3.0, 3.4, 4.5], [3.0, 3.2, 4.0], [-3.2, -2.8, 4.2], [3.2, -3.0, 3.8]]) tree(g, { x, z, h, r: 1.2, color: '#3f5a44' });
  for (let i = 0; i < 8; i += 1) box(0.6, 0.45, 0.4, toon('#7a7d74', { rim: 0.12 }), { x: -w / 2 + 0.3 + i * 0.6, y: 0.22, z: d / 2 + 0.25, parent: g, cast: true });
  addOutline(g, { width: 0.0012, color: '#080b14' });
}

/* -------------------------------------------------------------------------- */
/*  医院 / 车站                                                                */
/* -------------------------------------------------------------------------- */

function hospital(parent) {
  const h = E.hospital;
  const g = group('hospital');
  g.position.set(h.x, Y, h.z);
  parent.add(g);
  box(h.w, h.h, h.d, toon('#cfd8de', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), { y: h.h / 2, parent: g, cast: true, receive: true });
  box(h.w + 0.2, 0.2, h.d + 0.2, toon('#6a7468', { rim: 0.12 }), { y: 0.1, parent: g, cast: false });
  const floors = h.floors || 5;
  const fh = (h.h - 1.0) / floors;
  for (let f = 0; f < floors; f += 1) {
    const y = 1.2 + f * fh;
    for (let c = 0; c < 4; c += 1) litWindow(g, { x: -h.w * 0.35 + c * (h.w * 0.7 / 3), y, z: h.d / 2 + 0.02, w: 0.55, h: 0.5, color: '#d8f0ff', lit: 0.35 + ((c + f) % 3) * 0.12, ry: 0 });
    for (let c = 0; c < 7; c += 1) litWindow(g, { x: -h.w / 2 - 0.01, y, z: -h.d * 0.4 + c * (h.d * 0.8 / 6), w: 0.45, h: 0.45, ry: -Math.PI / 2, color: '#d8f0ff', lit: 0.3 + ((c + f) % 4) * 0.1 });
    for (let c = 0; c < 7; c += 1) litWindow(g, { x: h.w / 2 + 0.01, y, z: -h.d * 0.4 + c * (h.d * 0.8 / 6), w: 0.45, h: 0.45, ry: Math.PI / 2, color: '#cfe8ff', lit: 0.25 + ((c + f) % 3) * 0.12 });
  }
  // 红十字
  box(1.0, 0.34, 0.06, flat('#d24a38', { fog: false }), { y: h.h * 0.78, z: h.d / 2 + 0.04, parent: g }).material.color.multiplyScalar(1.2);
  box(0.34, 1.0, 0.06, flat('#d24a38', { fog: false }), { y: h.h * 0.78, z: h.d / 2 + 0.04, parent: g }).material.color.multiplyScalar(1.2);
  // 入口
  box(2.4, 2.6, 1.0, toon('#7a7468', { rim: 0.16 }), { z: h.d / 2 + 0.4, y: 1.3, parent: g, cast: true });
  box(2.8, 0.14, 1.4, toon('#3a4652', { rim: 0.14 }), { z: h.d / 2 + 0.55, y: 2.8, parent: g, cast: true });
  litWindow(g, { x: -0.4, y: 1.2, z: h.d / 2 + 0.9, w: 1.5, h: 2.0, color: '#d8f0ff', lit: 1.0 });
  // 屋顶 + 设备
  box(h.w + 0.2, 0.12, h.d + 0.2, toon('#4a5058', { rim: 0.14 }), { y: h.h + 0.06, parent: g, cast: true });
  box(1.4, 0.9, 1.0, toon('#8a8f96', { rim: 0.16 }), { x: -0.5, y: h.h + 0.55, z: -1.2, parent: g, cast: true });
  cyl(0.3, 0.3, 0.25, 10, toon('#b9c0c8', { rim: 0.16 }), { x: 0.7, y: h.h + 0.28, z: -1.6, parent: g, cast: true });
  box(0.1, 2.2, 0.1, toon('#8a9199', { rim: 0.1 }), { x: 0.9, y: h.h + 1.1, z: 1.6, parent: g, cast: false });
  // 招牌
  const tex = signTexture(256, 640, (ctx, w, hh) => {
    ctx.fillStyle = '#f0f6fb'; ctx.fillRect(0, 0, w, hh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 50px ${JP_FONT}`;
    ['月', '見', 'ク', 'リ', 'ニ', 'ッ', 'ク'].forEach((ch, i) => { ctx.fillStyle = i < 2 ? '#2a5a8a' : '#5a7a9a'; ctx.fillText(ch, w / 2, 55 + i * 80); });
  });
  plane(0.5, 1.5, lightbox(tex, 1.2), { x: h.w / 2 + 0.03, y: h.h * 0.55, z: h.d * 0.32, ry: Math.PI / 2, parent: g }).userData.noOutline = true;
  // 停车位 + 救护车
  const lot = E.parking;
  box(lot.w, 0.02, lot.d, toon('#23262c', { rim: 0.1 }), { x: lot.x, y: Y + 0.105, z: lot.z, parent: parent, cast: false });
  for (let i = 0; i <= 4; i += 1) box(0.04, 0.005, lot.d - 0.2, flat('#d8d4c8').clone(), { x: lot.x - lot.w / 2 + 0.3 + i * 1.5, y: Y + 0.12, z: lot.z, parent, cast: false });
  parkedCar(parent, { x: lot.x - 1.4, z: lot.z, ry: Math.PI / 2, color: '#cfd8de' });
  parkedCar(parent, { x: lot.x + 0.3, z: lot.z, ry: Math.PI / 2, color: '#4a5a6a' });
  addOutline(g, { width: 0.0012, color: '#080b14' });
}

function station(parent) {
  const st = E.station;
  const g = group('station');
  parent.add(g);
  const px0 = st.platformX0, px1 = st.platformX1, z0 = st.z0, z1 = st.z1;
  const pcx = (px0 + px1) / 2, pcz = (z0 + z1) / 2;
  const pw = px1 - px0;
  // 站台
  box(pw, 0.3, z1 - z0, toon('#8a8d84', { rim: 0.14 }), { x: pcx, y: Y + 0.15, z: pcz, parent: g, cast: true });
  box(pw - 0.1, 0.02, z1 - z0 - 0.1, toon('#a8a89a', { rim: 0.1 }), { x: pcx, y: Y + 0.31, z: pcz, parent: g, cast: false });
  box(0.12, 0.03, z1 - z0 - 0.4, toon('#e8c04a', { rim: 0.1 }), { x: px1 - 0.4, y: Y + 0.325, z: pcz, parent: g, cast: false });
  // 站房（西侧，面向街道）
  const bx = px0 - 0.6;
  box(2.4, 3.6, 5.2, toon('#d8d4c8', { rim: 0.16, rimColor: '#a8c4e4' }), { x: bx, y: Y + 1.8, z: -3.6, parent: g, cast: true });
  box(2.6, 0.16, 5.4, toon('#2a5a8a', { rim: 0.16 }), { x: bx, y: Y + 3.65, z: -3.6, parent: g, cast: true });
  for (let i = 0; i < 3; i += 1) litWindow(g, { x: bx - 1.21, y: Y + 1.7, z: -5.3 + i * 1.6, w: 0.7, h: 1.0, ry: -Math.PI / 2, color: '#fff0c8', lit: 0.8 });
  // 站名牌
  const nameTex = signTexture(512, 160, (ctx, w, hh) => {
    ctx.fillStyle = '#f0f4f8'; ctx.fillRect(0, 0, w, hh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 66px ${JP_FONT}`; ctx.fillStyle = '#2a3a4a'; ctx.fillText('月見駅', w / 2, hh * 0.42);
    ctx.font = `500 24px ${EN_FONT}`; ctx.fillStyle = '#5a7a9a'; ctx.fillText('TSUKIMI STATION', w / 2, hh * 0.78);
  });
  plane(2.2, 0.7, lightbox(nameTex, 1.2), { x: bx - 1.22, y: Y + 2.9, z: -3.6, ry: -Math.PI / 2, parent: g }).userData.noOutline = true;
  // 站台顶棚
  box(pw - 0.1, 0.08, z1 - z0 - 1.2, toon('#3a4652', { rim: 0.14 }), { x: pcx, y: Y + 3.0, z: pcz, parent: g, cast: true });
  for (let z = z0 + 1.0; z < z1 - 0.6; z += 3.4) {
    cyl(0.04, 0.04, 2.7, 6, toon('#5d636b', { rim: 0.12 }), { x: pcx - pw * 0.3, y: Y + 1.65, z, parent: g, cast: false });
    cyl(0.04, 0.04, 2.7, 6, toon('#5d636b', { rim: 0.12 }), { x: pcx + pw * 0.3, y: Y + 1.65, z, parent: g, cast: false });
  }
  // 顶棚灯带
  for (let z = z0 + 1.4; z < z1 - 0.6; z += 2.6) {
    const m = flat('#e8f4ff', { fog: false });
    m.color.multiplyScalar(1.6); m.toneMapped = false;
    plane(pw * 0.65, 0.05, m, { x: pcx, y: Y + 2.94, z, rx: -Math.PI / 2, parent: g }).userData.noOutline = true;
  }
  // 长椅 / 贩卖机
  bench(g, { x: px0 + 0.5, z: -1.4, ry: Math.PI / 2 });
  bench(g, { x: px0 + 0.5, z: 3.0, ry: Math.PI / 2 });
  vendingMachine(g, { x: px0 + 0.55, z: 5.4, ry: -Math.PI / 2, hot: false });
  // 站牌动态屏
  const board = stationDisplay(g, { x: px0 + 0.65, y: Y + 2.05, z: -5.4 });
  // 钟
  cyl(0.22, 0.22, 0.06, 16, toon('#f0ece0', { rim: 0.2 }), { x: bx - 1.25, y: Y + 4.2, z: -3.6, rx: Math.PI / 2, parent: g, cast: false });
  // 平交道口（主路与铁道交叉）
  levelCrossing(g, { x: E.rail.minX + 0.4, z: 0.0 });
  // 站前广场 / 出租车 / 巴士
  box(6.0, 0.02, 7.0, toon('#6a6a62', { rim: 0.1 }), { x: px0 - 4.2, y: Y + 0.105, z: -1.2, parent: g, cast: false });
  taxi(g, { x: px0 - 4.8, z: -3.4 });
  taxi(g, { x: px0 - 2.8, z: -3.4 });
  bus(g, { x: px0 - 4.4, z: 1.4 });
  addOutline(g, { width: 0.0012, color: '#080b14' });
  return { g, board };
}

/* -------------------------------------------------------------------------- */
/*  车辆 / 站牌 / 道口等辅助                                                    */
/* -------------------------------------------------------------------------- */

function warmSprite(parent, { x, y, z, color = '#ffcf94', size = 1.2, opacity = 0.25 }) {
  const sp = glowSprite(color, size, 0);
  sp.position.set(x, y, z);
  sp.material.opacity = opacity;
  parent.add(sp);
  return sp;
}

function parkedCar(parent, { x, z, ry = 0, color = '#4a5a6a' }) {
  const g = group('parked-car');
  g.position.set(x, Y + 0.02, z);
  g.rotation.y = ry;
  parent.add(g);
  box(1.7, 0.75, 3.6, toon(color, { rim: 0.16, rimColor: '#c8d8e8', gradient: 'soft' }), { y: 0.5, parent: g, cast: true });
  box(1.5, 0.55, 1.7, toon('#26303a', { rim: 0.14 }), { y: 1.05, z: -0.2, parent: g, cast: true });
  for (const [wx, wz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]]) {
    cyl(0.28, 0.28, 0.22, 8, toon('#1b1e24', { rim: 0.1 }), { x: wx, y: 0.28, z: wz, rx: Math.PI / 2, parent: g, cast: false });
  }
  for (const zz of [-1.82, 1.82]) {
    const sp = glowSprite(zz > 0 ? '#ff4a3a' : '#fff0c0', 1.4, 0.6);
    sp.position.set(0, 0.55, zz);
    g.add(sp);
  }
  for (const [sx, sz] of [[-0.9, -0.2], [0.9, -0.2]]) {
    litWindow(g, { x: sx, y: 1.1, z: sz, w: 1.2, h: 0.4, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, color: '#9fd8ff', lit: 0.6 });
  }
  return g;
}

function taxi(parent, { x, z }) {
  const g = parkedCar(parent, { x, z, ry: Math.PI / 2, color: '#d8c04a' });
  box(0.7, 0.16, 0.5, flat('#ffe0a0', { fog: false }), { y: 1.45, x: 0.2, parent: g, cast: false });
  return g;
}

function bus(parent, { x, z }) {
  const g = group('bus');
  g.position.set(x, Y + 0.02, z);
  parent.add(g);
  box(2.4, 2.4, 7.2, toon('#d8d4c8', { rim: 0.18, rimColor: '#cfe8ff' }), { y: 1.25, parent: g, cast: true });
  box(2.42, 0.3, 7.25, toon('#2a5a8a', { rim: 0.16 }), { y: 0.6, parent: g, cast: false });
  for (let i = 0; i < 4; i += 1) {
    for (const sx of [-1.21, 1.21]) litWindow(g, { x: sx, y: 1.55, z: -2.3 + i * 1.5, w: 0.7, h: 0.7, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, color: '#ffe0b0', lit: 0.6 });
  }
  for (const [wx, wz] of [[-1.1, -2.2], [1.1, -2.2], [-1.1, 2.2], [1.1, 2.2]]) {
    cyl(0.32, 0.32, 0.24, 8, toon('#1b1e24', { rim: 0.1 }), { x: wx, y: 0.32, z: wz, rx: Math.PI / 2, parent: g, cast: false });
  }
  return g;
}

function stationDisplay(parent, { x, y, z }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 224;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const g = group('station-board');
  g.position.set(x, y, z);
  g.rotation.y = -Math.PI / 2; // 面向西侧街道
  parent.add(g);
  plane(1.1, 0.48, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), { parent: g }).userData.noOutline = true;
  box(1.18, 0.56, 0.05, toon('#20242a', { rim: 0.2 }), { z: -0.03, parent: g, cast: false });
  let last = 0;
  function draw(now) {
    const sec = Math.floor(now / 1000);
    const mm = String(Math.floor(sec / 60) % 60).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const wait = 45 - (sec % 60);
    ctx.fillStyle = '#081420'; ctx.fillRect(0, 0, 512, 224);
    ctx.strokeStyle = '#2a6a8a'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 216);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 34px monospace'; ctx.fillStyle = '#9fe8ff'; ctx.fillText('月見駅  TSUKIMI', 22, 36);
    ctx.font = '700 52px monospace'; ctx.fillStyle = '#ffd9a0'; ctx.fillText(`${mm}:${ss}`, 22, 96);
    ctx.font = '500 24px sans-serif'; ctx.fillStyle = '#c8e8ff'; ctx.fillText('上り  各停  6番線', 22, 148);
    ctx.fillStyle = wait < 10 ? '#ffcf5a' : '#7dffc0'; ctx.font = '700 30px monospace'; ctx.fillText(`まもなく  ${wait}s`, 22, 190);
    texture.needsUpdate = true;
  }
  draw(0);
  return { g, update(t) { if (t - last > 0.5) { last = t; draw(t * 1000); } } };
}

function levelCrossing(parent, { x, z }) {
  const g = group('level-crossing');
  g.position.set(x, Y, z);
  parent.add(g);
  // 道口杆
  for (const dz of [-2.6, 2.6]) {
    cyl(0.07, 0.08, 1.7, 8, toon('#2a3038', { rim: 0.16 }), { y: 0.85, z: dz, parent: g, cast: true });
    box(1.9, 0.1, 0.1, toon('#e8c04a', { rim: 0.14 }), { y: 1.15, z: dz, parent: g, cast: false });
    for (let i = 0; i < 5; i += 1) box(0.18, 0.12, 0.12, toon('#2a3038', { rim: 0.1 }), { x: -0.8 + i * 0.4, y: 1.15, z: dz, parent: g, cast: false });
    box(0.16, 0.22, 0.12, toon('#3a3f47', { rim: 0.12 }), { y: 1.55, z: dz, parent: g, cast: false });
    const lamp = sphere(0.07, flat('#ff4a3a').clone(), { y: 1.55, z: dz + 0.1, parent: g });
    lamp.material.color.multiplyScalar(1.6); lamp.material.toneMapped = false;
  }
  // 踏切牌
  const tex = signTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8d04a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px sans-serif'; ctx.fillText('踏切', w / 2, h / 2);
  });
  plane(0.5, 0.3, lightbox(tex, 1.2), { x: -0.6, y: 1.25, z: 0, ry: -Math.PI / 2, parent: g }).userData.noOutline = true;
  return { g };
}

/* -------------------------------------------------------------------------- */
/*  次街 / 公园 / 市场 / 河岸                                                   */
/* -------------------------------------------------------------------------- */

function minorRoads(parent) {
  const g = group('minor-roads');
  parent.add(g);
  const B = E.bounds;
  const mkRoad = (axis, center) => {
    if (axis === 'ew') {
      const z = center;
      box(B.maxX - B.minX, 0.02, 2.0, toon('#1c2026', { rim: 0.1, rimColor: '#8fa8c8' }), { x: 0, y: Y + 0.108, z, parent: g, cast: false, receive: true });
      for (const dz of [-1.25, 1.25]) box(B.maxX - B.minX, 0.035, 0.5, toon('#8a8170', { rim: 0.1 }), { x: 0, y: Y + 0.12, z: z + dz, parent: g, cast: false });
      for (let x = B.minX + 1; x < B.maxX - 1; x += 2.4) box(0.7, 0.006, 0.07, flat('#d8d4c8').clone(), { x, y: Y + 0.12, z, parent: g, cast: false });
      for (let x = B.minX + 1; x < B.maxX - 1; x += 1.0) box(0.3, 0.02, 0.55, flat('#d8d4c8').clone(), { x: x + 0.15, y: Y + 0.122, z: z + 0.6, parent: g, cast: false });
    } else {
      const x = center;
      box(2.0, 0.02, B.maxZ - B.minZ, toon('#1c2026', { rim: 0.1, rimColor: '#8fa8c8' }), { x, y: Y + 0.108, z: 0, parent: g, cast: false, receive: true });
      for (const dx of [-1.25, 1.25]) box(0.5, 0.035, B.maxZ - B.minZ, toon('#8a8170', { rim: 0.1 }), { x: x + dx, y: Y + 0.12, z: 0, parent: g, cast: false });
      for (let z = B.minZ + 1; z < B.maxZ - 1; z += 2.4) box(0.07, 0.006, 0.7, flat('#d8d4c8').clone(), { x, y: Y + 0.12, z, parent: g, cast: false });
      for (let z = B.minZ + 1; z < B.maxZ - 1; z += 1.0) box(0.55, 0.02, 0.3, flat('#d8d4c8').clone(), { x: x + 0.6, y: Y + 0.122, z: z + 0.15, parent: g, cast: false });
    }
  };
  for (const r of E.minorEW) mkRoad('ew', (r.minZ + r.maxZ) / 2);
  for (const r of E.minorNS) mkRoad('ns', (r.minX + r.maxX) / 2);
}

function parks(parent) {
  for (const p of E.parks) {
    const g = group('park');
    parent.add(g);
    box(p.w, 0.03, p.d, toon('#4a5a42', { rim: 0.1 }), { x: p.x, y: Y + 0.14, z: p.z, parent: g, cast: false });
    box(p.w, 0.02, 0.3, toon('#8a8070', { rim: 0.1 }), { x: p.x, y: Y + 0.16, z: p.z + 0.3, parent: g, cast: false });
    bench(g, { x: p.x - p.w * 0.25, z: p.z + 0.4, ry: Math.PI });
    bench(g, { x: p.x + p.w * 0.25, z: p.z + 0.4, ry: Math.PI });
    for (let i = 0; i < 3; i += 1) tree(g, { x: p.x - p.w * 0.35 + i * p.w * 0.35, z: p.z - p.d * 0.25, h: 3.0 + (i % 2) * 0.5, r: 0.85, color: '#3f5a44' });
    for (const dx of [-p.w * 0.3, p.w * 0.3]) {
      cyl(0.04, 0.05, 1.1, 6, toon('#5d636b', { rim: 0.12 }), { x: p.x + dx, y: Y + 0.7, z: p.z + p.d * 0.3, parent: g, cast: false });
      warmSprite(g, { x: p.x + dx, y: Y + 1.25, z: p.z + p.d * 0.3, color: '#ffcf94', size: 1.1, opacity: 0.28 });
      sphere(0.08, glow('#ffcf94', 1.5), { x: p.x + dx, y: Y + 1.25, z: p.z + p.d * 0.3, parent: g });
    }
    hedge(g, { x: p.x, z: p.z - p.d / 2 + 0.1, w: p.w * 0.9, d: 0.35, h: 0.5 });
  }
}

function market(parent) {
  const m = E.market;
  const g = group('market');
  parent.add(g);
  box(m.w, 0.02, m.d, toon('#5a4a3a', { rim: 0.1 }), { x: m.x, y: Y + 0.14, z: m.z, parent: g, cast: false });
  const names = [['たこ焼き', '#ffcf94'], ['焼き鳥', '#ff8a5c'], ['甘味処', '#ffd9a0']];
  for (let i = 0; i < 3; i += 1) {
    const x = m.x - m.w / 3 + i * (m.w / 3);
    const z = m.z + 0.2;
    box(1.2, 1.1, 1.0, toon('#3a2f28', { rim: 0.14 }), { x, y: Y + 0.55, z, parent: g, cast: true });
    box(1.4, 0.07, 1.2, toon('#5a3a2a', { rim: 0.14 }), { x, y: Y + 1.2, z, parent: g, cast: true });
    const [name, color] = names[i];
    const tex = signTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = '#2a1c18'; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 38px ${JP_FONT}`; ctx.fillStyle = color; ctx.fillText(name, w / 2, h / 2);
    });
    plane(0.95, 0.28, lightbox(tex, 1.2), { x, y: Y + 1.02, z: z + 0.52, parent: g }).userData.noOutline = true;
    chochin(g, { x: x - 0.52, y: Y + 0.95, z: z + 0.55, r: 0.13, color: '#d24a38', text: '', glowSize: 0.9 });
    warmSprite(g, { x, y: Y + 0.7, z: z + 0.6, color: '#ffb45e', size: 1.2, opacity: 0.32 });
  }
}

function riverside(parent) {
  const p = E.riversidePark;
  const g = group('riverside-park');
  parent.add(g);
  box(p.w, 0.03, p.d, toon('#4a5a42', { rim: 0.1 }), { x: p.x, y: Y + 0.14, z: p.z, parent: g, cast: false });
  box(p.w, 0.02, 0.4, toon('#8a8070', { rim: 0.1 }), { x: p.x, y: Y + 0.16, z: p.z + 0.4, parent: g, cast: false });
  for (let i = 0; i < 8; i += 1) {
    const x = p.x - p.w / 2 + 1.2 + i * ((p.w - 2.4) / 7);
    tree(g, { x, z: p.z - p.d * 0.15, h: 3.4 + (i % 3) * 0.4, r: 0.9, color: i % 2 ? '#3f5a44' : '#44684a' });
    if (i % 2 === 0) bench(g, { x: x + 0.7, z: p.z + 0.5, ry: Math.PI });
    if (i % 2 === 1) {
      cyl(0.03, 0.04, 1.0, 6, toon('#5d636b', { rim: 0.12 }), { x, y: Y + 0.62, z: p.z + 0.7, parent: g, cast: false });
      warmSprite(g, { x, y: Y + 1.15, z: p.z + 0.7, color: '#ffcf94', size: 1.1, opacity: 0.3 });
      sphere(0.07, glow('#ffcf94', 1.5), { x, y: Y + 1.15, z: p.z + 0.7, parent: g });
    }
  }
}

function bridges(parent) {
  const g = group('bridges');
  parent.add(g);
  for (const [b, name] of [[E.bridgeMain, 'main'], [E.bridgeWest, 'west']]) {
    const z = b.z;
    const w = b.x1 - b.x0;
    box(w + 0.8, 0.16, 3.2, toon('#8a8d84', { rim: 0.16 }), { x: (b.x0 + b.x1) / 2, y: Y + 0.14, z: z, parent: g, cast: true });
    for (const dz of [-1.4, 1.4]) {
      box(w + 0.8, 0.08, 0.12, toon('#5d636b', { rim: 0.12 }), { x: (b.x0 + b.x1) / 2, y: Y + 0.62, z: z + dz, parent: g, cast: false });
      for (let i = 0; i <= 4; i += 1) {
        cyl(0.03, 0.03, 0.55, 4, toon('#5d636b', { rim: 0.1 }), { x: b.x0 + 0.2 + i * (w / 4), y: Y + 0.45, z: z + dz, parent: g, cast: false });
      }
    }
    // 桥头灯 / 红柱
    for (const sx of [b.x0 - 0.2, b.x1 + 0.2]) {
      cyl(0.05, 0.06, 1.2, 6, toon('#b8402f', { rim: 0.16 }), { x: sx, y: Y + 0.7, z: z + 1.3, parent: g, cast: false });
      warmSprite(g, { x: sx, y: Y + 1.35, z: z + 1.3, color: '#ffcf94', size: 1.2, opacity: 0.35 });
      chochin(g, { x: sx, y: Y + 1.15, z: z + 1.3, r: 0.14, color: '#d24a38', text: '', glowSize: 0.9 });
    }
  }
  // 河岸灯 / 芦苇
  const z = E.river.minZ - 0.15;
  for (let x = -20; x < 19; x += 4.2) {
    if (x > -4 && x < 3) continue;
    cyl(0.03, 0.04, 0.9, 6, toon('#5d636b', { rim: 0.1 }), { x, y: Y + 0.6, z, parent: g, cast: false });
    sphere(0.07, glow('#ffcf94', 1.4), { x, y: Y + 1.05, z, parent: g });
    warmSprite(g, { x, y: Y + 1.05, z, color: '#ffcf94', size: 1.0, opacity: 0.28 });
  }
}

/* -------------------------------------------------------------------------- */
/*  街道道具                                                                   */
/* -------------------------------------------------------------------------- */

function streetProps(parent) {
  const g = group('street-props');
  parent.add(g);
  // 主街路灯
  for (const x of [-18, -12, -6, 6, 12, 18]) {
    for (const z of [-3.9, 3.6]) streetLamp(g, { x, z });
  }
  for (const z of [-18, -12, -6, 6, 12, 18]) {
    streetLamp(g, { x: -4.0, z });
    streetLamp(g, { x: 3.6, z });
  }
  // 次街路灯
  for (const r of E.minorEW) {
    const z = (r.minZ + r.maxZ) / 2 + 1.5;
    for (const x of [-18, -9, 0, 9, 18]) streetLamp(g, { x, z });
  }
  // 贩卖机 / 自行车 / 邮筒 / 垃圾桶
  vendingMachine(g, { x: 3.7, z: -4.4, ry: Math.PI, hot: true });
  vendingMachine(g, { x: 3.7, z: -5.6, ry: Math.PI, hot: false });
  vendingMachine(g, { x: -4.3, z: 5.2, ry: -Math.PI / 2, hot: false });
  bicycle(g, { x: -4.2, z: 3.0, ry: Math.PI / 2 });
  bicycle(g, { x: 4.2, z: 3.2, ry: -Math.PI / 2 });
  bicycle(g, { x: -2.9, z: 7.2, ry: Math.PI / 2 });
  postBox(g, { x: -4.1, z: -3.2 });
  box(0.5, 0.7, 0.45, toon('#3a4652', { rim: 0.12 }), { x: 4.1, z: -7.0, y: Y + 0.35, parent: g, cast: true });
  box(0.5, 0.7, 0.45, toon('#4a6b8c', { rim: 0.12 }), { x: 4.7, z: -7.0, y: Y + 0.35, parent: g, cast: true });
  // 自动售货机群（车站前）
  vendingMachine(g, { x: 14.0, z: 5.0, ry: -Math.PI / 2, hot: false });
  // 花坛 / 树
  for (const [x, z] of [[-4.0, -9], [-4.0, 9], [3.8, -9], [3.8, 9], [-13.2, 0], [13.2, 0]]) {
    planter(g, { x, z, color: '#4a6b3c' });
    tree(g, { x: x + 0.5, z: z + 0.4, h: 3.0, r: 0.8, color: '#3f5a44' });
  }
  // 主街灯笼串
  for (const z of [4.6, 8.0, 11.4]) lanternString(g, { x0: -4.0, x1: 3.4, y: 5.2, z, count: 8, color: '#ffb35e', sag: 0.5 });
  for (const x of [-12.6, -9.0, -5.4]) lanternString(g, { x0: x, x1: x + 3.2, y: 5.0, z: -4.0, count: 6, color: '#ffcf94', sag: 0.4 });
  // 猫
  cat(g, { x: 2.2, z: 2.6, ry: 1.2 });
  cat(g, { x: -5.0, z: -2.6, ry: 2.1 });
}

/* -------------------------------------------------------------------------- */
/*  动效层                                                                     */
/* -------------------------------------------------------------------------- */

function movingTrain(parent) {
  const g = group('train');
  const x = (E.rail.minX + E.rail.maxX) / 2;
  g.position.set(x, Y + 0.08, -16);
  parent.add(g);
  const body = toon('#d8dce2', { rim: 0.22, rimColor: '#cfe8ff', gradient: 'soft' });
  const stripe = toon('#2a5a8a', { rim: 0.18 });
  for (let i = 0; i < 3; i += 1) {
    const z = (i - 1) * 8.2;
    box(2.8, 2.9, 7.6, body, { y: 1.55, z, parent: g, cast: true });
    box(2.84, 0.28, 7.66, stripe, { y: 0.55, z, parent: g, cast: false });
    box(2.9, 0.14, 7.7, toon('#3a4652', { rim: 0.16 }), { y: 3.05, z, parent: g, cast: true });
    for (let k = 0; k < 4; k += 1) {
      for (const sx of [-1.41, 1.41]) {
        litWindow(g, { x: sx, y: 2.0, z: z - 2.4 + k * 1.6, w: 1.1, h: 0.7, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, color: '#ffe0b0', lit: 0.65 });
      }
    }
    for (const [wx, wz] of [[-1.2, z - 2.6], [1.2, z - 2.6], [-1.2, z + 2.6], [1.2, z + 2.6]]) {
      cyl(0.32, 0.32, 0.24, 8, toon('#1b1e24', { rim: 0.1 }), { x: wx, y: 0.32, z: wz, rx: Math.PI / 2, parent: g, cast: false });
    }
  }
  for (const dz of [-16, 16]) {
    for (const dx of [-0.7, 0.7]) {
      const sp = glowSprite(dz > 0 ? '#fff2cc' : '#ff4a3a', 2.0, 0.8);
      sp.position.set(dx, 0.9, dz);
      g.add(sp);
    }
  }
  return {
    g,
    update(t) {
      const phase = (t * 0.55) % 36;
      let z;
      if (phase < 14) z = -16 + phase * 1.2;
      else if (phase < 17) z = 1.0;
      else z = 1.0 + (phase - 17) * 1.3;
      g.position.z = z;
    },
  };
}

function signals(parent) {
  const list = [];
  const make = (x, z, ry) => {
    const g = group('traffic-signal');
    g.position.set(x, Y, z); g.rotation.y = ry;
    parent.add(g);
    cyl(0.06, 0.07, 3.6, 8, toon('#4a5058', { rim: 0.14 }), { y: 1.8, parent: g, cast: true });
    box(0.3, 0.8, 0.24, toon('#2a3038', { rim: 0.16 }), { y: 3.4, parent: g, cast: true });
    const bulbs = [];
    for (let i = 0; i < 3; i += 1) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(['#ff4a3a', '#ffcf5a', '#7dffc0'][i]).multiplyScalar(0.3), toneMapped: false });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), m);
      b.position.set(0, 3.65 - i * 0.22, 0.14);
      g.add(b); bulbs.push(m);
    }
    list.push({ bulbs });
  };
  make(-4.2, 2.4, Math.PI / 2);
  make(4.0, -2.8, -Math.PI / 2);
  make(-4.2, -2.8, Math.PI / 2);
  make(4.0, 2.4, -Math.PI / 2);
  make(-16.0, 2.4, Math.PI / 2);
  make(-16.0, -2.8, Math.PI / 2);
  return {
    update(t) {
      const stage = (t % 12) < 5 ? 0 : (t % 12) < 10 ? 2 : 1;
      for (const s of list) s.bulbs.forEach((m, i) => {
        m.color.set(['#ff4a3a', '#ffcf5a', '#7dffc0'][i]).multiplyScalar(i === stage ? 1.5 : 0.2);
      });
    },
  };
}

function movingCars(parent) {
  const cars = [];
  const mk = (color) => {
    const g = group('moving-car');
    parent.add(g);
    box(1.7, 0.75, 3.6, toon(color, { rim: 0.16 }), { y: 0.5, parent: g, cast: true });
    box(1.5, 0.55, 1.7, toon('#26303a', { rim: 0.14 }), { y: 1.05, z: -0.2, parent: g, cast: true });
    for (const [wx, wz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]]) cyl(0.28, 0.28, 0.22, 8, toon('#1b1e24', { rim: 0.1 }), { x: wx, y: 0.28, z: wz, rx: Math.PI / 2, parent: g, cast: false });
    for (const sp of [glowSprite('#fff0c0', 1.4, 0.7), glowSprite('#ff4a3a', 1.0, 0.6)]) g.add(sp);
    g.children[g.children.length - 2].position.set(0, 0.5, 1.85);
    g.children[g.children.length - 1].position.set(0, 0.5, -1.85);
    return g;
  };
  cars.push({ g: mk('#4a5a6a'), lane: 'ew', speed: 2.2, offset: 0 });
  cars.push({ g: mk('#6a4a4a'), lane: 'ew', speed: -1.8, offset: 8 });
  cars.push({ g: mk('#4a6a5a'), lane: 'ns', speed: 1.6, offset: 3 });
  return {
    update(t) {
      for (const car of cars) {
        if (car.lane === 'ew') {
          const z = 0.5;
          const x = ((t * car.speed + car.offset) % 44) - 22;
          car.g.position.set(car.speed > 0 ? -22 + ((t * car.speed + car.offset) % 44) : 22 - ((t * -car.speed + car.offset) % 44), 0.02, z);
          car.g.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          const x = -0.6;
          car.g.position.set(x, 0.02, -22 + ((t * car.speed + car.offset) % 44));
          car.g.rotation.y = 0;
        }
      }
    },
  };
}

function movingCats(parent) {
  const specs = [
    { cx: 2.4, cz: 2.0, rx: 1.2, rz: 0.5, speed: 0.2, phase: 0 },
    { cx: -5.6, cz: 4.8, rx: 1.4, rz: 0.6, speed: -0.15, phase: 2.2 },
    { cx: 14.6, cz: 6.2, rx: 1.1, rz: 0.8, speed: 0.18, phase: 4.1 },
  ];
  const cats = specs.map((s) => ({ c: cat(parent, { x: s.cx, z: s.cz, ry: 0 }), s }));
  for (const it of cats) it.c.scale.setScalar(1.9);
  return {
    update(t) {
      for (const { c, s } of cats) {
        const a = t * s.speed + s.phase;
        c.position.x = s.cx + Math.cos(a) * s.rx;
        c.position.z = s.cz + Math.sin(a) * s.rz;
        c.rotation.y = -a + Math.PI / 2;
      }
    },
  };
}

function pedestrians(parent) {
  const peds = [];
  const paths = [
    { x0: -3.0, x1: 3.0, z: 3.0, speed: 0.8, phase: 0 },
    { x0: 3.1, x1: -3.1, z: -3.4, speed: 0.7, phase: 2 },
    { x0: -3.2, x1: -3.2, z0: -12, z1: 12, speed: 0.9, phase: 1 },
    { x0: 3.1, x1: 3.1, z0: 12, z1: -12, speed: 0.75, phase: 3 },
    { x0: 13.0, x1: 16.5, z: 3.2, speed: 0.6, phase: 4 },
  ];
  const make = () => {
    const g = group('pedestrian');
    parent.add(g);
    cyl(0.12, 0.16, 0.9, 6, toon('#2a3038', { rim: 0.14 }), { y: 0.45, parent: g, cast: false });
    sphere(0.15, toon('#d8b89a', { rim: 0.18 }), { y: 1.05, parent: g, cast: false });
    const um = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.22, 8), toon(['#2a3a4a', '#5a2a2a', '#3a4a3a'][peds.length % 3], { rim: 0.16, transparent: true, opacity: 0.9 }));
    um.position.y = 1.5; parent.add; g.add(um);
    return g;
  };
  for (const p of paths) peds.push({ g: make(), p });
  return {
    update(t) {
      for (const { g, p } of peds) {
        if (p.x0 !== undefined) {
          const span = Math.abs(p.x1 - p.x0);
          const dir = p.speed > 0 ? 1 : -1;
          const a = ((t * Math.abs(p.speed) + p.phase) % (span * 2 + 2));
          const d = a < span ? a : span * 2 + 2 - a;
          g.position.set(p.x0 + dir * d * Math.sign(p.x1 - p.x0), Y, p.z);
          g.rotation.y = dir * Math.sign(p.x1 - p.x0) > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          const span = Math.abs(p.z1 - p.z0);
          const a = ((t * p.speed + p.phase) % (span * 2 + 2));
          const d = a < span ? a : span * 2 + 2 - a;
          g.position.set(p.x0, Y, p.z0 + d * Math.sign(p.z1 - p.z0));
          g.rotation.y = Math.sign(p.z1 - p.z0) > 0 ? 0 : Math.PI;
        }
      }
    },
  };
}

function boat(parent) {
  const g = group('boat');
  parent.add(g);
  box(1.2, 0.35, 3.2, toon('#6a4a32', { rim: 0.16 }), { y: Y + 0.3, parent: g, cast: false });
  box(0.9, 0.25, 1.6, toon('#3a2f28', { rim: 0.14 }), { y: Y + 0.5, z: -0.3, parent: g, cast: false });
  const sp = glowSprite('#ffcf94', 1.5, 0.5);
  sp.position.set(0, Y + 0.8, -1.2); g.add(sp);
  return {
    update(t) {
      g.position.set(-14 + ((t * 0.5) % 28), 0, (E.river.minZ + E.river.maxZ) / 2);
    },
  };
}

function petals(parent) {
  const count = 260;
  const geo = new THREE.PlaneGeometry(0.07, 0.05);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffc8d8', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  parent.add(inst);
  const data = [];
  for (let i = 0; i < count; i += 1) data.push({ x: (rand() - 0.5) * 40, y: rand() * 10, z: (rand() - 0.5) * 40, vy: 0.3 + rand() * 0.5, phase: rand() * Math.PI * 2, spin: (rand() - 0.5) * 1.5 });
  const dummy = new THREE.Object3D();
  return {
    update(t, dt) {
      for (let i = 0; i < count; i += 1) {
        const d = data[i];
        d.y -= d.vy * dt;
        d.x += Math.sin(t * 0.4 + d.phase) * 0.1 * dt;
        if (d.y < Y + 0.05) { d.y = 9 + rand() * 3; d.x = (rand() - 0.5) * 40; d.z = (rand() - 0.5) * 40; }
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(t * d.spin + d.phase, t * d.spin * 0.5, d.phase);
        dummy.scale.setScalar(0.7 + Math.sin(t + d.phase) * 0.2);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

function lanternSwings(parent) {
  const items = [];
  for (const [x, z] of [[-2.5, 4.6], [-2.5, 8.0], [-2.5, 11.4], [-11.8, -2.5], [-8.6, -2.5], [-5.8, -2.5], [14.1, 5.0]]) {
    const pivot = group('lantern-pivot');
    pivot.position.set(x, Y + 4.8, z);
    parent.add(pivot);
    cyl(0.006, 0.006, 0.4, 4, toon('#2a2420', { rim: 0.1 }), { y: -0.2, parent: pivot, cast: false });
    const body = group('lantern');
    body.position.y = -0.5;
    pivot.add(body);
    chochin(body, { x: 0, y: 0, z: 0, r: 0.18, color: '#d24a38', text: '', glowSize: 1.0 });
    warmSprite(body, { x: 0, y: 0, z: 0.15, color: '#ff8a5c', size: 1.2, opacity: 0.3 });
    items.push({ pivot, phase: rand() * Math.PI * 2, speed: 0.7 + rand() * 0.6 });
  }
  return { update(t) { for (const it of items) { it.pivot.rotation.z = Math.sin(t * it.speed + it.phase) * 0.12; it.pivot.rotation.x = Math.cos(t * it.speed * 0.8 + it.phase) * 0.06; } } };
}

function steam(parent) {
  const items = [];
  for (const [x, y, z, n] of [[-2.8, 2.2, 7.0, 4], [-4.2, 2.0, 9.6, 3], [14.8, 1.8, 16.0, 3]]) {
    for (let i = 0; i < n; i += 1) {
      const sp = glowSprite('#e8f0ff', 1.0, 0);
      sp.position.set(x + (i - n / 2) * 0.15, y, z);
      parent.add(sp);
      items.push({ sp, baseX: sp.position.x, baseY: y, baseZ: z, phase: i / n * Math.PI * 2 });
    }
  }
  return {
    update(t) {
      for (const it of items) {
        const a = (t * 0.18 + it.phase / (Math.PI * 2)) % 1;
        it.sp.position.set(it.baseX + Math.sin(t * 0.6 + it.phase) * 0.25, it.baseY + a * 2.8, it.baseZ);
        it.sp.scale.setScalar(0.3 + a * 1.8);
        it.sp.material.opacity = Math.sin(a * Math.PI) * 0.16;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  装配                                                                       */
/* -------------------------------------------------------------------------- */

export function buildCity(ctx) {
  const g = group('city');
  minorRoads(g);

  // 商店街
  for (const cfg of E.shops) g.add(shop(g, cfg));

  // 住宅 / 公寓
  for (let i = 0; i < E.houses.length; i += 1) {
    g.add(house(g, { ...E.houses[i], id: `h${i}` }));
  }
  for (const a of E.apartments) g.add(apartment(g, a));

  // 地标
  schoolCampus(g);
  shrine(g);
  hospital(g);
  const stationMod = station(g);

  // 公园 / 市场 / 河岸 / 桥
  parks(g);
  market(g);
  riverside(g);
  bridges(g);

  // 街道道具 / 招牌 / 广场
  streetProps(g);
  signsAndPlaza(g);

  // 动效
  const train = movingTrain(g);
  const sig = signals(g);
  const cars = movingCars(g);
  const cats = movingCats(g);
  const boats = boat(g);
  const petalsMod = petals(g);
  const lan = lanternSwings(g);
  const st = steam(g);

  return {
    group: g,
    update(t, dt) {
      train.update(t);
      sig.update(t);
      cars.update(t);
      cats.update(t);
      boats.update(t);
      petalsMod.update(t, dt);
      lan.update(t);
      st.update(t);
      stationMod.board.update(t);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  商业街招牌 / 小广场                                                         */
/* -------------------------------------------------------------------------- */

function signsAndPlaza(parent) {
  const g = group('signs-plaza');
  parent.add(g);
  // 主街竖招牌
  const names = [
    ['-2.25', 4.4, '居酒屋', '#ff6f5e'], ['-2.25', 7.0, 'ラーメン', '#ff8a5c'],
    ['-2.25', 9.6, '古書', '#ffd28a'], ['-2.25', 11.8, '喫茶', '#ffcf94'],
    ['-2.25', 13.8, '床屋', '#9fd8ff'], ['-11.8', -2.25, '喫茶', '#ffcf94'],
    ['-8.6', -2.25, '薬', '#7dffc0'], ['-5.8', -2.25, '100円', '#ff8a5c'],
  ];
  for (const [x, z, label, color] of names) {
    const isWest = Number(x) < 0;
    const px = Number(x) + (isWest ? 0.05 : 0);
    const pz = Number(z);
    const c = document.createElement('canvas'); c.width = 256; c.height = 640;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16110f'; ctx.fillRect(0, 0, 256, 640);
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.strokeRect(6, 6, 244, 628);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 68px ${JP_FONT}`; ctx.fillStyle = color;
    const chars = label.split('');
    chars.forEach((ch, i) => ctx.fillText(ch, 128, 90 + i * 82));
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); mat.color.setScalar(1.5);
    const p = plane(0.72, 1.8, mat, { x: px + 0.02, y: Y + 3.2, z: pz, ry: Math.PI / 2, parent: g });
    p.userData.noOutline = true;
    box(0.8, 1.9, 0.08, toon('#20242a', { rim: 0.2 }), { x: px - 0.03, y: Y + 3.2, z: pz, ry: Math.PI / 2, parent: g, cast: false });
    warmSprite(g, { x: px + 0.25, y: Y + 3.2, z: pz, color, size: 1.8, opacity: 0.2 });
  }
  // 北侧店铺竖招牌
  for (const [z, x, label, color] of [[-2.25, -11.8, '喫茶', '#ffcf94'], [-2.25, -8.6, '薬', '#7dffc0'], [-2.25, -5.8, '100円', '#ff8a5c'], [-2.25, -3.4, '洗濯', '#7fe8e0']]) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 640;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16110f'; ctx.fillRect(0, 0, 256, 640);
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.strokeRect(6, 6, 244, 628);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 72px ${JP_FONT}`; ctx.fillStyle = color;
    label.split('').forEach((ch, i) => ctx.fillText(ch, 128, 100 + i * 90));
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); mat.color.setScalar(1.5);
    plane(0.72, 1.8, mat, { x, y: Y + 3.8, z: -2.2, parent: g }).userData.noOutline = true;
    box(0.8, 1.9, 0.08, toon('#20242a', { rim: 0.2 }), { x, y: Y + 3.8, z: -2.16, parent: g, cast: false });
    warmSprite(g, { x, y: Y + 3.8, z: -1.9, color, size: 1.8, opacity: 0.2 });
  }
  // 路口小广场：铺地 + 灯串 + 长椅
  box(8.0, 0.03, 4.0, toon('#2a2a2e', { rim: 0.1, rimColor: '#8fa8c8' }), { x: 0, y: Y + 0.125, z: 0.2, parent: g, cast: false });
  for (let i = 0; i < 6; i += 1) {
    box(0.5, 0.01, 0.5, toon('#4a4a4e', { rim: 0.1 }), { x: -3.5 + i * 1.4, y: Y + 0.145, z: 1.4, parent: g, cast: false });
  }
  bench(g, { x: -3.2, z: 1.9, ry: Math.PI });
  bench(g, { x: 3.2, z: 1.9, ry: Math.PI });
  for (const x of [-4.2, 4.2]) {
    cyl(0.04, 0.05, 4.2, 6, toon('#4a5058', { rim: 0.12 }), { x, y: Y + 2.1, z: -2.6, parent: g, cast: true });
    warmSprite(g, { x, y: Y + 4.2, z: -2.6, color: '#ffcf94', size: 2.2, opacity: 0.3 });
  }
  lanternString(g, { x0: -4.2, x1: 4.2, y: 4.3, z: -2.6, count: 10, color: '#ffb35e', sag: 0.6 });
}

/* 樱花树点缀（河岸 / 校园 / 神社） */
function sakura(parent) {
  const spots = [
    [-12.0, 17.2], [-9.0, 16.8], [-6.4, 17.4], [3.0, 17.2], [6.6, 16.8], [9.8, 17.3],
    [-16.4, -14.2], [2.2, -16.2], [13.6, -15.8], [-16.0, 13.6],
  ];
  for (let i = 0; i < spots.length; i += 1) {
    const [x, z] = spots[i];
    const g = group('sakura');
    g.position.set(x, Y, z);
    parent.add(g);
    const h = 4.0 + (i % 3) * 0.4;
    cyl(0.1, 0.14, h * 0.55, 6, toon('#4a3728', { rim: 0.16 }), { y: h * 0.28, parent: g, cast: true });
    const crown = group('crown');
    crown.position.y = h * 0.64;
    g.add(crown);
    const pink = toon('#ffb7c5', { rim: 0.22, rimColor: '#ffd9e0' });
    sphere(1.05, pink, { y: 0, parent: crown, cast: true });
    sphere(0.8, pink, { x: 0.65, y: 0.3, parent: crown, cast: true });
    sphere(0.75, pink, { x: -0.6, y: 0.25, parent: crown, cast: true });
    sphere(0.6, toon('#ffc8d4', { rim: 0.2 }), { y: 0.6, z: 0.2, parent: crown, cast: true });
    addOutline(g, { width: 0.0012, color: '#080b14' });
  }
}

/* -------------------------------------------------------------------------- */
/*  外圈填充住宅：让 44×44 的大镇没有空块                                        */
/* -------------------------------------------------------------------------- */

function cottage(parent, x, z, ry, color) {
  const g = group('cottage');
  g.position.set(x, Y, z);
  g.rotation.y = ry;
  parent.add(g);
  const w = 2.2 + rand() * 1.0;
  const d = 1.9 + rand() * 0.8;
  const h = 2.5 + rand() * 0.8;
  box(w, h, d, toon(color, { rim: 0.14, rimColor: '#a8c4e4', gradient: 'soft' }), { y: h / 2, parent: g, cast: true });
  box(w + 0.12, 0.14, d + 0.12, toon('#6a6558', { rim: 0.1 }), { y: 0.07, parent: g, cast: false });
  const roofH = h * 0.34;
  const roof = hipRoof(w, d, roofH, { overhang: 0.24, ridge: 0.3, color: '#2f343c' });
  roof.position.y = h + 0.03;
  g.add(roof);
  box(0.6, 1.3, 0.06, toon('#5a3f2c', { rim: 0.12 }), { z: d / 2 + 0.02, y: 0.72, parent: g, cast: false });
  litWindow(g, { x: -w * 0.26, y: 1.35, z: d / 2 + 0.03, w: 0.55, h: 0.5, color: rand() > 0.5 ? '#ffcf94' : '#ffd9a0', lit: 0.6 + rand() * 0.4 });
  litWindow(g, { x: w * 0.26, y: 1.35, z: d / 2 + 0.03, w: 0.55, h: 0.5, color: '#ffd9a0', lit: 0.45 + rand() * 0.4 });
  if (rand() > 0.4) litWindow(g, { x: w / 2 + 0.01, y: 1.3, z: -d * 0.1, w: 0.4, h: 0.4, ry: Math.PI / 2, color: '#ffcf94', lit: 0.4 + rand() * 0.3 });
  if (rand() > 0.6) tree(g, { x: w * 0.55, z: d * 0.55, h: 1.8, r: 0.5, color: rand() > 0.5 ? '#ffb7c5' : '#3f5a44' });
}

function fillHouses(parent) {
  const blocked = [
    [2.6, 7.2, -8.2, -2.2], // store
    [-6.6, -2.2, 2.8, 15.2], // west shops
    [-13.2, -2.2, -6.2, -2.2], // north shops
    [-16.6, -4.2, -12.4, -7.2], // school
    [-21.2, -15.8, -20.8, -14.2], // gym
    [14.8, 18.4, -14.0, -7.6], // hospital
    [15.6, 19.2, -7.2, 9.2], // station
    [-21.8, -15.0, 2.4, 12.0], // shrine
    [1.8, 7.8, -12.8, -9.2], // parking
    [8.8, 12.2, -10.8, -7.6], // apartment
    [-10.6, -7.0, 4.6, 7.8], // apartment
    [-20.8, -17.6, -3.0, -0.2], // apartment
    [-12.1, -3.1, 14.0, 18.4], // west park
    [-9.0, 3.0, 15.2, 18.4], // riverside park
    [-6.8, -1.6, 15.6, 18.4], // market
  ];
  for (const h of E.houses) blocked.push([h.x - h.w / 2 - 0.3, h.x + h.w / 2 + 0.3, h.z - h.d / 2 - 0.3, h.z + h.d / 2 + 0.3]);
  for (const a of E.apartments) blocked.push([a.x - a.w / 2, a.x + a.w / 2, a.z - a.d / 2, a.z + a.d / 2]);
  const roads = [];
  for (const r of E.minorEW) roads.push([-22, 22, r.minZ - 1.6, r.maxZ + 1.6]);
  for (const r of E.minorNS) roads.push([r.minX - 1.6, r.maxX + 1.6, -22, 22]);
  roads.push([-22, 22, -3.7, 3.3]); roads.push([-3.7, 3.3, -22, 22]);
  const blocksRoad = (x, z) => roads.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const inside = (x, z) => blocked.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  let count = 0;
  for (let z = -20.0; z <= 17.0; z += 3.4) {
    for (let x = -20.0; x <= 17.5; x += 3.4) {
      if (count >= 34) break;
      if (x > E.rail.minX - 1 || z > E.river.minZ - 1) continue;
      if (blocksRoad(x, z) || inside(x, z)) continue;
      // 避开已有住宅太近
      let tooClose = false;
      for (const h of E.houses) if (Math.hypot(h.x - x, h.z - z) < 3.0) { tooClose = true; break; }
      if (tooClose) continue;
      // 朝向最近道路
      const ry = Math.abs(x) < 8 ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 0 ? Math.PI : 0);
      cottage(parent, x + (rand() - 0.5) * 0.6, z + (rand() - 0.5) * 0.6, ry, ['#c8c0b0', '#bfb8a8', '#d0c8b8'][count % 3]);
      count += 1;
    }
  }
}
