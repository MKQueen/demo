/**
 * world/town.js —— 15×15 雨夜小镇的其余街区：
 *   东南商店街（复用街版店铺，压进微缩尺度）、西北住宅 + 学校 + 小公园、
 *   西南 elevated 神社 + 小医院、东侧铁道/站台、南侧小河与桥，以及街上的树和家具。
 *
 * 雨夜便利店本体仍由 store/interior 模块搭在东北角；旧街景（street.js / props.js / car.js）
 * 不再调用，由本文件统一负责小镇的公共空间。
 */
import * as THREE from 'three';
import { C, E, rng } from '../config.js';
import { toon, flat, lightbox, glow, glowSprite, addOutline } from '../lib/toon.js';
import { canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import {
  box, plane, group, mesh, cyl, sphere, torus, catenary, tube,
} from '../lib/kit.js';
import {
  buildShopVisual,
  signTexture,
  verticalSign,
  chochin,
  noren,
  lanternString,
  windowUnit,
  acUnit,
  utilityPole,
  streetLamp,
  vendingMachine,
  bicycle,
  planter,
  postBox,
  cat,
} from './shops.js';

const Y = 0.12;

/* -------------------------------------------------------------------------- */
/*  小工具                                                                     */
/* -------------------------------------------------------------------------- */

function warmWin(parent, { x, y, z, w, h, lit = 1.0, color = '#ffcf94', ry = 0 }) {
  windowUnit(parent, { x, y, z, w, h, lit, color, ry, bars: 1 });
}

function warmSprite(parent, { x, y, z, color = '#ffcf94', size = 1.4, opacity = 0.28 }) {
  const sp = glowSprite(color, size, opacity);
  sp.position.set(x, y, z);
  parent.add(sp);
}

function roofGable(parent, { x, y, z, w, d, h = 0.55, color = '#3f4652' }) {
  const mat = toon(color, { rim: 0.18, rimColor: '#8fa8c8', gradient: 'soft' });
  const slope = Math.sqrt((d / 2) ** 2 + h ** 2);
  for (const s of [-1, 1]) {
    const p = box(w + 0.16, 0.07, slope + 0.12, mat, {
      x,
      y: y + h / 2,
      z: z + (s * d) / 4,
      parent,
      cast: true,
    });
    p.rotation.x = s * Math.atan2(h, d / 2);
  }
  // 屋脊
  box(w + 0.24, 0.08, 0.12, toon('#2a3038', { rim: 0.2 }), { x, y: y + h + 0.01, z, parent, cast: false });
}

function roofHip(parent, { x, y, z, w, d, h = 0.55, color = '#3f4652' }) {
  const mat = toon(color, { rim: 0.18, rimColor: '#8fa8c8', gradient: 'soft' });
  const geo = new THREE.ConeGeometry(1, 1, 4);
  const roof = new THREE.Mesh(geo, mat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set((w + 0.24) / 1.414, h, (d + 0.24) / 1.414);
  roof.position.set(x, y + h / 2, z);
  roof.castShadow = true;
  parent.add(roof);
  box(w + 0.3, 0.05, d + 0.3, toon('#2a3038', { rim: 0.2 }), { x, y: y + 0.02, z, parent, cast: false });
}

function tree(parent, { x, z, h = 1.7, r = 0.5, color = '#3f5a44', trunk = '#4a382a', sway = 0 }) {
  const g = group('tree');
  g.position.set(x, Y, z);
  parent.add(g);
  cyl(0.06, 0.1, h * 0.62, 6, toon(trunk, { rim: 0.16 }), { y: (h * 0.62) / 2, parent: g, cast: true });
  const crown = group('crown');
  crown.position.y = h * 0.7;
  g.add(crown);
  const rand = rng(Math.round(x * 100 + z * 10 + h * 7) + 11);
  for (let i = 0; i < 3; i += 1) {
    sphere(r * (0.85 - i * 0.12), toon(color, { rim: 0.18, rimColor: '#9fd8a0', gradient: 'soft' }), {
      x: (rand() - 0.5) * r * 0.5,
      y: r * 0.55 + i * r * 0.36,
      z: (rand() - 0.5) * r * 0.5,
      parent: crown,
      cast: true,
    });
  }
  if (sway) g.userData.sway = { crown, base: 0, speed: 0.7 + rand() * 0.4, amp: sway };
  return g;
}

function bench(parent, { x, z, ry = 0 }) {
  const g = group('bench');
  g.position.set(x, Y, z);
  g.rotation.y = ry;
  parent.add(g);
  const wood = toon('#6b5238', { rim: 0.16, rimColor: '#ffcf94' });
  box(0.9, 0.07, 0.3, wood, { y: 0.42, parent: g, cast: true });
  box(0.9, 0.28, 0.06, wood, { y: 0.62, z: -0.14, parent: g, cast: true });
  for (const sx of [-0.36, 0.36]) {
    box(0.06, 0.42, 0.3, toon('#3a3f47', { rim: 0.1 }), { x: sx, y: 0.21, parent: g, cast: false });
  }
  return g;
}

function fence(parent, { x0, x1, z, ry = 0, color = '#7a6a52' }) {
  const g = group('fence');
  parent.add(g);
  const mat = toon(color, { rim: 0.12 });
  const len = x1 - x0;
  const n = Math.max(2, Math.round(len / 0.45));
  for (let i = 0; i <= n; i += 1) {
    const px = x0 + (len * i) / n;
    box(0.06, 0.7, 0.06, mat, { x: px, y: Y + 0.35, z, parent: g, cast: false });
  }
  for (const yy of [0.25, 0.55]) {
    box(len, 0.045, 0.04, mat, { x: (x0 + x1) / 2, y: Y + yy, z, parent: g, cast: false });
  }
  return g;
}

/* -------------------------------------------------------------------------- */
/*  住宅                                                                       */
/* -------------------------------------------------------------------------- */

function buildHouse(parent, cfg) {
  const g = group(cfg.id);
  const { x, z, w, d, h } = cfg;
  parent.add(g);
  const wall = toon(cfg.roof === 'hip' ? '#c8bca8' : '#b8ac96', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' });
  box(w, h, d, wall, { x, y: Y + h / 2, z, parent: g, cast: true, receive: true });
  // 二层 / 屋顶
  const roofY = Y + h;
  if (cfg.roof === 'hip') roofHip(g, { x, y: roofY, z, w, d, h: 0.62, color: '#3a4652' });
  else {
    roofGable(g, { x, y: roofY, z, w, d, h: 0.58, color: '#3f4a56' });
  }
  // 深色墙裙
  box(w + 0.03, 0.32, d + 0.03, toon('#4a4038', { rim: 0.12 }), { x, y: Y + 0.16, z, parent: g, cast: false });
  // 门 + 门灯
  const doorX = x - w * 0.22;
  box(0.42, 1.15, 0.06, toon('#5a3f2c', { rim: 0.16, rimColor: '#ffcf94' }), { x: doorX, y: Y + 0.6, z: z + d / 2 + 0.02, parent: g, cast: false });
  warmSprite(g, { x: doorX, y: Y + 1.42, z: z + d / 2 + 0.15, color: '#ffcf94', size: 0.9, opacity: 0.35 });
  // 窗：一楼 + 二楼
  warmWin(g, { x: x + w * 0.22, y: Y + 1.15, z: z + d / 2 + 0.03, w: 0.75, h: 0.62, lit: 0.9 });
  warmWin(g, { x: x + w * 0.02, y: Y + h - 0.55, z: z + d / 2 + 0.03, w: 0.9, h: 0.5, lit: 0.55 });
  // 小庭院 / 围墙 / 信箱
  if (cfg.garden) {
    fence(g, { x0: x - w / 2 - 0.1, x1: x + w / 2 + 0.1, z: z + d / 2 + 0.55, color: '#6b5a44' });
    planter(g, { x: x - w / 2 + 0.25, z: z + d / 2 + 0.55, color: '#4a6b3c' });
    tree(g, { x: x + w * 0.34, z: z + d / 2 + 0.62, h: 1.25, r: 0.32, color: '#456a48', sway: 0.012 });
  }
  // 空调 + 雨棚
  acUnit(g, { x: x + w * 0.34, y: Y + 0.42, z: z - d / 2 - 0.12, ry: Math.PI });
  return g;
}

function buildApartment(parent, cfg) {
  const g = group(cfg.id);
  const { x, z, w, d, h } = cfg;
  parent.add(g);
  const wall = toon('#8a8f96', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' });
  box(w, h, d, wall, { x, y: Y + h / 2, z, parent: g, cast: true, receive: true });
  box(w + 0.12, 0.12, d + 0.12, toon('#3a4652', { rim: 0.16 }), { x, y: Y + h + 0.06, z, parent: g, cast: true });
  // 阳台层
  const floors = cfg.floors || 3;
  for (let f = 1; f <= floors; f += 1) {
    const fy = Y + (h / (floors + 1)) * f;
    box(w * 0.86, 0.06, 0.3, toon('#5a5f66', { rim: 0.14 }), { x, y: fy, z: z + d / 2 + 0.12, parent: g, cast: false });
    for (let i = 0; i < 4; i += 1) {
      const wx = x - w * 0.36 + (w * 0.72 * i) / 3;
      warmWin(g, { x: wx, y: fy + 0.42, z: z + d / 2 + 0.03, w: 0.42, h: 0.5, lit: 0.3 + ((i * 3 + f) % 5) / 7 });
      cyl(0.012, 0.012, 0.32, 4, toon('#6b7178', { rim: 0.1 }), { x: wx, y: fy + 0.2, z: z + d / 2 + 0.26, parent: g, cast: false });
    }
  }
  // 入口
  box(w * 0.32, 1.1, 0.06, toon('#3a3f47', { rim: 0.14 }), { x: x - w * 0.22, y: Y + 0.56, z: z + d / 2 + 0.02, parent: g, cast: false });
  warmSprite(g, { x: x - w * 0.22, y: Y + 1.4, z: z + d / 2 + 0.3, size: 1.1, opacity: 0.3 });
  // 信箱
  box(0.5, 0.34, 0.16, toon('#5a5f66', { rim: 0.14 }), { x: x + w * 0.18, y: Y + 0.9, z: z + d / 2 + 0.12, parent: g, cast: false });
  // 楼顶设备
  acUnit(g, { x: x + w * 0.2, y: Y + h + 0.28, z: z - 0.2 });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  学校 / 公园                                                                */
/* -------------------------------------------------------------------------- */

function buildSchool(parent) {
  const cfg = E.school;
  const g = group('school');
  parent.add(g);
  const { x, z, w, d, h } = cfg;
  const wall = toon('#c8c4b4', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' });
  box(w, h, d, wall, { x, y: Y + h / 2, z, parent: g, cast: true, receive: true });
  roofGable(g, { x, y: Y + h, z, w, d, h: 0.6, color: '#3a4652' });
  // 两层教室窗
  for (let f = 0; f < 2; f += 1) {
    for (let i = 0; i < 4; i += 1) {
      warmWin(g, {
        x: x - w * 0.34 + (w * 0.68 * i) / 3,
        y: Y + 0.95 + f * 1.35,
        z: z + d / 2 + 0.03,
        w: 0.42,
        h: 0.5,
        lit: 0.22 + ((i + f) % 3) / 5,
        color: '#ffe0b0',
      });
    }
  }
  // 校门 + 招牌 + 钟
  box(0.9, 1.1, 0.08, toon('#4a3a30', { rim: 0.16 }), { x: x - w * 0.3, y: Y + 0.55, z: z + d / 2 + 0.03, parent: g, cast: false });
  const signTex = signTexture(512, 160, (ctx, cw, ch) => {
    ctx.fillStyle = '#f0ead8';
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = '#3a4652';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, cw - 12, ch - 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 64px ${JP_FONT}`;
    ctx.fillStyle = '#2a3038';
    ctx.fillText('月見町小学校', cw / 2, ch * 0.42);
    ctx.font = `500 26px ${EN_FONT}`;
    ctx.fillStyle = '#5a6068';
    ctx.fillText('TSUKIMI ELEMENTARY SCHOOL', cw / 2, ch * 0.78);
  });
  const sign = plane(1.5, 0.46, lightbox(signTex, 1.0), { x, y: Y + h * 0.62, z: z + d / 2 + 0.02, parent: g });
  sign.userData.noOutline = true;
  // 时钟
  cyl(0.16, 0.16, 0.04, 16, toon('#e8e4d4', { rim: 0.2 }), { x: x + w * 0.3, y: Y + h * 0.7, z: z + d / 2 + 0.05, rx: Math.PI / 2, parent: g, cast: false });
  // 围墙 + 操场
  fence(g, { x0: x - w / 2, x1: x + w / 2, z: z + d / 2 + 0.6, color: '#6b7178' });
  const yard = cfg.yard;
  box(yard.w, 0.04, yard.d, toon('#5d6b52', { rim: 0.08 }), { x: yard.x, y: Y + 0.14, z: yard.z, parent: g, cast: false, receive: true });
  // 篮球架
  cyl(0.03, 0.03, 1.2, 6, toon('#6b7178', { rim: 0.12 }), { x: yard.x + 0.7, y: Y + 0.72, z: yard.z, parent: g, cast: true });
  torus(0.16, 0.02, 5, 14, toon('#c85a3a', { rim: 0.2 }), { x: yard.x + 0.7, y: Y + 1.32, z: yard.z + 0.14, rx: Math.PI / 2, parent: g, cast: false });
  box(0.5, 0.34, 0.02, toon('#d8d4c8', { rim: 0.12 }), { x: yard.x + 0.7, y: Y + 1.12, z: yard.z + 0.14, parent: g, cast: false });
  // 校门灯
  warmSprite(g, { x: x - w * 0.3, y: Y + 1.5, z: z + d / 2 + 0.3, size: 1.1, opacity: 0.25 });
  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

function buildPark(parent) {
  const cfg = E.park;
  const g = group('park');
  parent.add(g);
  const { x, z, w, d } = cfg;
  box(w, 0.05, d, toon('#3f5a42', { rim: 0.1, rimColor: '#9fd8a0' }), { x, y: Y + 0.145, z, parent: g, cast: false, receive: true });
  tree(g, { x: x - w * 0.24, z: z - d * 0.1, h: 1.9, r: 0.55, color: '#3f6a4a', sway: 0.01 });
  tree(g, { x: x + w * 0.26, z: z + d * 0.12, h: 1.45, r: 0.42, color: '#4a7250', sway: 0.008 });
  bench(g, { x: x + 0.1, z: z + d * 0.25, ry: Math.PI });
  // 秋千
  const swingX = x - w * 0.05;
  for (const sx of [-0.42, 0.42]) {
    cyl(0.025, 0.03, 1.0, 6, toon('#6b7178', { rim: 0.12 }), { x: swingX + sx, y: Y + 0.62, z: z - d * 0.22, rx: 0.12, parent: g, cast: false });
  }
  box(0.9, 0.04, 0.04, toon('#6b7178', { rim: 0.12 }), { x: swingX, y: Y + 1.1, z: z - d * 0.22, parent: g, cast: false });
  box(0.28, 0.03, 0.12, toon('#c85a3a', { rim: 0.1 }), { x: swingX, y: Y + 0.55, z: z - d * 0.22, parent: g, cast: false });
  // 小路
  plane(0.6, d * 0.8, toon('#6b6b64', { rim: 0.1 }), { x, y: Y + 0.152, z, rx: -Math.PI / 2, parent: g });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  神社                                                                       */
/* -------------------------------------------------------------------------- */

function buildShrine(parent) {
  const cfg = E.shrine;
  const g = group('shrine');
  parent.add(g);
  const { x, z, w, d } = cfg;
  // 抬高的石台
  box(w, 0.22, d, toon('#5f625c', { rim: 0.14, rimColor: '#9fb8c8' }), { x, y: Y + 0.11, z, parent: g, cast: false, receive: true });
  box(w - 0.2, 0.03, d - 0.2, toon('#7a7d74', { rim: 0.1 }), { x, y: Y + 0.235, z, parent: g, cast: false, receive: true });
  const yy = Y + 0.24;
  // 参道
  for (let i = 0; i < 4; i += 1) {
    plane(0.52, 0.3, toon('#8a8d84', { rim: 0.1 }), { x, y: yy + 0.006, z: z + d / 2 - 0.3 - i * 0.32, rx: -Math.PI / 2, parent: g });
  }
  // 鸟居
  const red = toon('#b8402f', { rim: 0.22, rimColor: '#ffb0a0', gradient: 'soft' });
  const dark = toon('#4a2a22', { rim: 0.16 });
  const tz = z + d / 2 - 0.55;
  for (const sx of [x - w * 0.3, x + w * 0.3]) {
    cyl(0.09, 0.11, 2.3, 10, red, { x: sx, y: yy + 1.15, z: tz, parent: g, cast: true });
    cyl(0.11, 0.11, 0.1, 10, dark, { x: sx, y: yy + 0.05, z: tz, parent: g, cast: false });
  }
  box(w * 0.7, 0.12, 0.16, red, { x, y: yy + 2.05, z: tz, parent: g, cast: true });
  box(w * 0.82, 0.09, 0.2, red, { x, y: yy + 2.24, z: tz, parent: g, cast: true });
  box(w * 0.86, 0.09, 0.24, dark, { x, y: yy + 2.34, z: tz, parent: g, cast: false });
  // 拜殿
  const hz = z - d * 0.12;
  box(w * 0.52, 0.1, d * 0.34, toon('#7a7064', { rim: 0.12 }), { x, y: yy + 0.1, z: hz, parent: g, cast: false });
  box(w * 0.42, 0.62, d * 0.26, toon('#8a6a4c', { rim: 0.16, rimColor: '#ffd0a0' }), { x, y: yy + 0.44, z: hz, parent: g, cast: true });
  roofGable(g, { x, y: yy + 0.76, z: hz, w: w * 0.5, d: d * 0.34, h: 0.34, color: '#3a3030' });
  // 注连绳
  torus(w * 0.23, 0.025, 5, 20, toon('#d8c8a0', { rim: 0.2 }), { x, y: yy + 1.02, z: tz + 0.08, rx: Math.PI / 2, rz: 0.06, parent: g, cast: false });
  // 灯笼（会轻轻摆动）
  const lanterns = [];
  for (const sx of [x - w * 0.34, x + w * 0.34]) {
    chochin(g, { x: sx, y: yy + 1.05, z: tz - 0.42, r: 0.12, color: '#e8dcc0', text: '献灯', glowSize: 0.9 });
    lanterns.push({ x: sx, z: tz - 0.42 });
  }
  // 石灯笼
  for (const sx of [x - 0.9, x + 0.9]) {
    cyl(0.07, 0.09, 0.42, 8, toon('#8a8f88', { rim: 0.14 }), { x: sx, y: yy + 0.21, z: z + d / 2 - 1.2, parent: g, cast: true });
    box(0.2, 0.14, 0.2, flat('#ffcf94').clone(), { x: sx, y: yy + 0.5, z: z + d / 2 - 1.2, parent: g, cast: false }).material.color.multiplyScalar(1.7);
    warmSprite(g, { x: sx, y: yy + 0.52, z: z + d / 2 - 1.2, color: '#ffb45e', size: 0.8, opacity: 0.3 });
  }
  // 绘马架
  box(0.62, 0.7, 0.06, toon('#5a3f2c', { rim: 0.14 }), { x: x + w * 0.42, y: yy + 0.45, z: z - d * 0.32, parent: g, cast: false });
  for (let i = 0; i < 6; i += 1) {
    box(0.075, 0.05, 0.01, toon('#d8c8a0', { rim: 0.1 }), {
      x: x + w * 0.42 - 0.22 + (i % 3) * 0.15,
      y: yy + 0.38 + Math.floor(i / 3) * 0.16,
      z: z - d * 0.32 + 0.04,
      parent: g,
      cast: false,
    });
  }
  // 树
  tree(g, { x: x - w * 0.46, z: z + d * 0.34, h: 2.1, r: 0.6, color: '#3a5f44', sway: 0.008 });
  tree(g, { x: x + w * 0.55, z: z - d * 0.6, h: 1.5, r: 0.4, color: '#44684a', sway: 0.01 });
  addOutline(g, { width: 0.0009, color: '#080b14' });
  return { g, lanterns };
}

/* -------------------------------------------------------------------------- */
/*  医院 / 车站 / 桥                                                           */
/* -------------------------------------------------------------------------- */

function buildHospital(parent) {
  const cfg = E.hospital;
  const g = group('hospital');
  parent.add(g);
  const { x, z, w, d, h } = cfg;
  const wall = toon('#c8d2dc', { rim: 0.16, rimColor: '#a8c8e8', gradient: 'soft' });
  box(w, h, d, wall, { x, y: Y + h / 2, z, parent: g, cast: true, receive: true });
  box(w + 0.12, 0.12, d + 0.12, toon('#3a4652', { rim: 0.16 }), { x, y: Y + h + 0.06, z, parent: g, cast: true });
  // 窗户
  for (let f = 0; f < (cfg.floors || 3); f += 1) {
    for (let i = 0; i < 2; i += 1) {
      warmWin(g, {
        x: x - w * 0.22 + i * w * 0.44,
        y: Y + 0.8 + f * ((h - 1.2) / ((cfg.floors || 3) - 0.2)),
        z: z + d / 2 + 0.03,
        w: 0.42,
        h: 0.42,
        lit: 0.5 + ((i + f) % 3) / 6,
        color: '#d8f0ff',
      });
    }
  }
  // 红色十字 + 医院招牌
  const cross = new THREE.Group();
  cross.position.set(x, Y + h - 0.55, z + d / 2 + 0.08);
  g.add(cross);
  box(0.22, 0.66, 0.06, glow('#ff5a5a', 1.4), { parent: cross });
  box(0.66, 0.22, 0.06, glow('#ff5a5a', 1.4), { parent: cross });
  const signTex = signTexture(512, 160, (ctx, cw, ch) => {
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(0, 0, cw, 34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 44px ${JP_FONT}`;
    ctx.fillStyle = '#2a3a4a';
    ctx.fillText('月見町クリニック', cw / 2, ch * 0.56);
    ctx.font = `500 22px ${EN_FONT}`;
    ctx.fillStyle = '#5a7a9a';
    ctx.fillText('TSUKIMI CLINIC  ·  24H', cw / 2, ch * 0.82);
  });
  plane(1.2, 0.38, lightbox(signTex, 1.0), { x, y: Y + 2.55, z: z + d / 2 + 0.025, parent: g });
  // 入口雨棚
  box(0.9, 0.06, 0.4, toon('#9fb8c8', { rim: 0.14 }), { x, y: Y + 2.1, z: z + d / 2 + 0.2, parent: g, cast: false });
  warmSprite(g, { x, y: Y + 1.4, z: z + d / 2 + 0.3, color: '#d8f0ff', size: 1.2, opacity: 0.24 });
  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

function buildStation(parent) {
  const g = group('station');
  parent.add(g);
  const p = E.platform;
  const px = (p.x0 + p.x1) / 2;
  const pz = (p.z0 + p.z1) / 2;
  // 站台
  box(p.x1 - p.x0, 0.14, p.z1 - p.z0, toon('#8a8b86', { rim: 0.14, rimColor: '#c8d8e8' }), {
    x: px, y: 0.16, z: pz, parent: g, cast: false, receive: true,
  });
  plane(p.x1 - p.x0 - 0.06, p.z1 - p.z0 - 0.06, toon('#6b6d68', { rim: 0.1 }), {
    x: px, y: 0.235, z: pz, rx: -Math.PI / 2, parent: g,
  });
  // 盲道
  plane(0.16, p.z1 - p.z0 - 0.25, toon('#c9a84c', { rim: 0.1 }), {
    x: p.x1 - 0.22, y: 0.238, z: pz, rx: -Math.PI / 2, parent: g,
  });
  // 站牌 + 雨棚
  cyl(0.035, 0.04, 2.0, 6, toon('#5d636b', { rim: 0.12 }), { x: px - 0.15, y: 1.2, z: p.z0 + 0.55, parent: g, cast: true });
  const signTex = signTexture(256, 512, (ctx, cw, ch) => {
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(0, 0, cw, 42);
    ctx.fillStyle = '#2a5a8a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 58px ${JP_FONT}`;
    ctx.fillText('月見駅', cw / 2, 92);
    ctx.font = `600 26px ${EN_FONT}`;
    ctx.fillText('TSUKIMI', cw / 2, 148);
    ctx.strokeStyle = '#7a9ab8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, 190); ctx.lineTo(cw - 30, 190); ctx.stroke();
    ctx.font = `500 24px ${JP_FONT}`;
    ctx.fillText('次は  ひかり町', cw / 2, 240);
    ctx.fillText('つぎは  ひかりちょう', cw / 2, 282);
    ctx.font = `700 24px ${EN_FONT}`;
    ctx.fillText('NEXT: HIKARI-CHO', cw / 2, 340);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(30, 400, cw - 60, 3);
  });
  const sign = plane(0.42, 0.84, lightbox(signTex, 1.05), { x: px - 0.15, y: 1.8, z: p.z0 + 0.53, parent: g });
  sign.userData.noOutline = true;
  // 站台顶棚
  box(0.9, 0.06, 2.3, toon('#4a5058', { rim: 0.16, rimColor: '#c8d8e8' }), { x: px + 0.05, y: 2.35, z: pz + 0.3, parent: g, cast: true });
  for (const zz of [pz - 0.7, pz + 0.3, pz + 1.1]) {
    cyl(0.025, 0.03, 2.15, 6, toon('#5d636b', { rim: 0.1 }), { x: p.x0 + 0.15, y: 1.2, z: zz, parent: g, cast: false });
  }
  // 长椅 + 贩卖机
  bench(g, { x: p.x0 + 0.28, z: pz + 0.9, ry: Math.PI / 2 });
  vendingMachine(g, { x: p.x1 - 0.16, z: pz - 1.2, ry: Math.PI / 2, hot: false });
  // 站台灯
  warmSprite(g, { x: p.x0 + 0.3, y: 2.15, z: pz + 0.5, color: '#e8f0ff', size: 1.6, opacity: 0.24 });
  // 停靠的电车
  const car = group('railcar');
  car.position.set(7.2, 0.28, 4.6);
  parent.add(car);
  box(0.66, 0.62, 2.1, toon('#c8ccd2', { rim: 0.18, rimColor: '#e8f0ff', gradient: 'soft' }), { y: 0.34, parent: car, cast: true });
  box(0.7, 0.1, 2.0, toon('#2a5a8a', { rim: 0.16 }), { y: 0.14, parent: car, cast: false });
  // 车窗 + 灯
  for (const sx of [-0.335, 0.335]) {
    for (let i = 0; i < 3; i += 1) {
      const win = plane(0.4, 0.22, flat('#ffe0a0').clone(), { x: sx, y: 0.46, z: -0.6 + i * 0.6, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, parent: car });
      win.material.color.multiplyScalar(1.5);
      win.material.toneMapped = false;
      win.userData.noOutline = true;
    }
  }
  for (const zz of [-1.06, 1.06]) {
    const sp = glowSprite('#fff0c0', 1.0, 0.45);
    sp.position.set(0, 0.36, zz);
    car.add(sp);
  }
  // 信号灯
  cyl(0.03, 0.03, 1.1, 6, toon('#3a3f47', { rim: 0.1 }), { x: 6.7, y: 0.7, z: 2.5, parent: g, cast: false });
  for (const [dy, color] of [[0.28, '#ff5a5a'], [0.1, '#ffcf5a'], [-0.08, '#7dffc0']]) {
    sphere(0.055, flat(color).clone(), { x: 6.7, y: 1.2 + dy, z: 2.5, parent: g }).material.color.multiplyScalar(dy === -0.08 ? 1.6 : 0.5);
  }
  // 铁道旁围栏
  for (let z = -7.3; z < 6.7; z += 0.55) {
    cyl(0.015, 0.015, 0.7, 4, toon('#5d636b', { rim: 0.1 }), { x: 6.8, y: 0.45, z, parent: g, cast: false });
  }
  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

function buildBridges(parent) {
  const g = group('bridges');
  parent.add(g);
  const stone = toon('#7a7a72', { rim: 0.14, rimColor: '#c8d8e8', gradient: 'soft' });
  const dark = toon('#4a4a44', { rim: 0.12 });
  // 主桥（南北向道路跨河）
  const b = E.bridgeMain;
  box(b.x1 - b.x0 + 0.4, 0.12, 0.9, stone, { x: (b.x0 + b.x1) / 2, y: 0.08, z: b.z, parent: g, cast: false, receive: true });
  for (const sx of [b.x0, b.x1]) {
    box(0.1, 0.32, 1.1, stone, { x: sx, y: 0.16, z: b.z, parent: g, cast: false });
    // 栏杆
    for (let i = 0; i <= 4; i += 1) {
      cyl(0.02, 0.02, 0.34, 4, stone, { x: sx, y: 0.36, z: b.z - 0.4 + i * 0.2, parent: g, cast: false });
    }
  }
  // 拱
  torus(0.5, 0.06, 6, 16, stone, { x: 0, y: -0.02, z: b.z, rx: Math.PI / 2, arc: Math.PI, parent: g, cast: false });
  // 桥头红柱 + 灯笼
  const redMat = toon('#b8402f', { rim: 0.2, rimColor: '#ffb0a0' });
  for (const [sx, sz] of [[b.x0 - 0.1, b.z - 0.45], [b.x1 + 0.1, b.z - 0.45], [b.x0 - 0.1, b.z + 0.45], [b.x1 + 0.1, b.z + 0.45]]) {
    cyl(0.04, 0.05, 0.7, 6, redMat, { x: sx, y: 0.4, z: sz, parent: g, cast: false });
    sphere(0.07, glow('#ff8a5c', 1.3), { x: sx, y: 0.78, z: sz, parent: g });
  }
  // 步行小桥
  const f = E.bridgeFoot;
  for (let i = 0; i < 5; i += 1) {
    box(0.22, 0.05, 0.9, dark, { x: f.x0 + (i * (f.x1 - f.x0)) / 4, y: 0.12 + Math.sin((i / 4) * Math.PI) * 0.12, z: f.z, parent: g, cast: false });
  }
  for (const sx of [f.x0, f.x1]) {
    box(0.05, 0.3, 0.9, dark, { x: sx, y: 0.28, z: f.z, parent: g, cast: false });
  }
  // 铁道桥
  box(0.8, 0.1, 0.9, dark, { x: 7.2, y: 0.22, z: E.river.minZ + 0.1, parent: g, cast: false });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  街道家具                                                                   */
/* -------------------------------------------------------------------------- */

function flowerStand(parent, { x, z }) {
  const g = group('flower-stand');
  g.position.set(x, Y, z);
  parent.add(g);
  box(1.0, 0.55, 0.42, toon('#6b5238', { rim: 0.14 }), { y: 0.27, parent: g, cast: true });
  const colors = ['#ff6f8a', '#ffd166', '#c89bff', '#ff8a5c', '#9dffb0'];
  for (let i = 0; i < 5; i += 1) {
    cyl(0.09, 0.075, 0.16, 8, toon('#8a8f88', { rim: 0.12 }), { x: -0.4 + i * 0.2, y: 0.62, parent: g, cast: false });
    sphere(0.1, toon(colors[i], { rim: 0.2, rimColor: '#ffe0b0' }), { x: -0.4 + i * 0.2, y: 0.76, parent: g, cast: false });
  }
  const sp = glowSprite('#ffb45e', 1.4, 0.22);
  sp.position.set(0, 0.8, 0.2);
  g.add(sp);
  return g;
}

function barberPole(parent, { x, z }) {
  const g = group('barber');
  g.position.set(x, Y, z);
  parent.add(g);
  cyl(0.07, 0.07, 1.2, 12, toon('#e8e4dc', { rim: 0.16 }), { y: 0.6, parent: g, cast: true });
  for (let i = 0; i < 5; i += 1) {
    cyl(0.075, 0.075, 0.08, 12, toon(i % 2 ? '#c8433a' : '#3a5a8a', { rim: 0.2 }), { y: 0.32 + i * 0.14, parent: g, cast: false });
  }
  const sp = glowSprite('#ff8a8a', 0.8, 0.2);
  sp.position.set(0, 0.9, 0.1);
  g.add(sp);
  return g;
}

function powerPoles(parent) {
  const poles = [];
  for (const [x, z] of [[-2.0, -1.1], [2.0, -1.1], [-2.0, 2.3], [2.0, 2.3], [-6.9, -1.1], [-6.9, 2.3]]) {
    const p = utilityPole(parent, { x, z, h: 4.6, flip: x > 0 ? 1 : -1 });
    poles.push(p.top);
  }
  const wireMat = toon('#1c1f24', { rim: 0 });
  for (let i = 0; i < poles.length - 1; i += 1) {
    const a = poles[i].clone();
    const b = poles[i + 1].clone();
    if (Math.abs(a.z - b.z) > 1.5) continue;
    tube(catenary(a, b, 0.28), 0.01, wireMat, { parent, segments: 14 });
  }
}

/* -------------------------------------------------------------------------- */
/*  build                                                                      */
/* -------------------------------------------------------------------------- */

export function buildTown(ctx) {
  const g = group('town');
  const lanternGroups = [];
  const swayTrees = [];

  // 东南商店街（缩放后的街版店铺）
  for (const cfg of E.commercial) {
    const visual = buildShopVisual(cfg.style, cfg.info);
    const wrap = group(`commercial-${cfg.id}`);
    wrap.add(visual);
    wrap.scale.set(cfg.scale.x, cfg.scale.y, cfg.scale.z);
    wrap.rotation.y = cfg.rotation;
    // 店铺正面统一落在脚本给的 position；朝向决定位置偏移
    const frontLocal = 0.9;
    const y = Y - Y * cfg.scale.y;
    if (Math.abs(cfg.rotation - Math.PI / 2) < 0.01) {
      wrap.position.set(cfg.position.x - frontLocal * cfg.scale.z, y, cfg.position.z);
    } else if (Math.abs(cfg.rotation + Math.PI / 2) < 0.01) {
      wrap.position.set(cfg.position.x + frontLocal * cfg.scale.z, y, cfg.position.z);
    } else if (Math.abs(cfg.rotation - Math.PI) < 0.01) {
      wrap.position.set(cfg.position.x, y, cfg.position.z + frontLocal * cfg.scale.z);
    } else {
      wrap.position.set(cfg.position.x, y, cfg.position.z - frontLocal * cfg.scale.z);
    }
    g.add(wrap);
  }
  // 花摊 / 理发店转灯 / 药店十字
  flowerStand(g, { x: -1.7, z: 3.45 });
  barberPole(g, { x: 2.0, z: 4.1 });
  // 住宅
  for (const h of E.houses) g.add(buildHouse(g, h));
  g.add(buildApartment(g, E.apartment));
  g.add(buildSchool(g));
  g.add(buildPark(g));
  const shrine = buildShrine(g);
  g.add(shrine.g);
  lanternGroups.push(...shrine.lanterns);
  g.add(buildHospital(g));
  g.add(buildStation(g));
  g.add(buildBridges(g));

  // 树：街道两侧 + 神社/学校
  for (const [x, z, h, r, c] of [
    [-2.0, -1.0, 1.7, 0.42, '#3f5a44'],
    [2.0, -1.0, 1.5, 0.36, '#456a48'],
    [-2.0, 2.2, 1.6, 0.4, '#3f5a44'],
    [2.0, 2.2, 1.5, 0.36, '#456a48'],
    [4.2, 2.5, 1.7, 0.44, '#3a5f44'],
    [-7.05, 2.9, 1.9, 0.48, '#3a5f44'],
    [-7.05, -1.0, 1.7, 0.44, '#3a5f44'],
  ]) {
    const t = tree(g, { x, z, h, r, color: c, sway: 0.008 });
    swayTrees.push(t);
  }

  // 街道家具
  vendingMachine(g, { x: 2.25, z: 1.95, ry: Math.PI, hot: false });
  vendingMachine(g, { x: 2.25, z: 0.55, ry: Math.PI, hot: true });
  bicycle(g, { x: -1.7, z: 3.0, ry: -Math.PI / 2 });
  bicycle(g, { x: -1.7, z: 6.4, ry: -Math.PI / 2 });
  postBox(g, { x: -1.8, z: -1.05 });
  planter(g, { x: 5.9, z: 1.95, color: '#4a6b3c' });
  planter(g, { x: -1.8, z: 2.25, color: '#5a7a4a' });
  const cats = [];
  cats.push(cat(g, { x: 3.4, z: 2.35, ry: 2.1 }));
  cats.push(cat(g, { x: -6.7, z: 2.4, ry: 0.5 }));
  // 街灯
  for (const [x, z] of [[-2.0, 1.9], [2.0, 1.9], [-2.0, -0.95], [2.0, -0.95]]) {
    streetLamp(g, { x, z });
  }
  powerPoles(g);
  riverSide(g);
  stationBooth(g);
  extraStreetLife(g);
  applyDetailPass(g, cats);
  roofDetailPass(g);
  townDensityPass(g, cats);
  northShopUpperFloors(g);

  addOutline(g, { width: 0.0008, color: '#080b14' });

  return {
    group: g,
    update(t) {
      for (const treeObj of swayTrees) {
        const sway = treeObj.userData.sway;
        if (!sway) continue;
        const crown = sway.crown;
        crown.rotation.z = Math.sin(t * sway.speed + 1.2) * sway.amp;
        crown.rotation.x = Math.cos(t * sway.speed * 0.7) * sway.amp * 0.6;
      }
      for (const l of lanternGroups) {
        // 灯笼自身在小组里，简单用全局查找太麻烦：交给 fx 的风铃/灯笼摆动
        l.phase = l.phase || Math.random() * Math.PI * 2;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  细节层：可见侧墙 / 屋顶杂物 / 街边道具                                       */
/* -------------------------------------------------------------------------- */

function sideWindows(parent, { x, z, y0, floors = 2, count = 3, span = 1.6, ry = 0, color = '#ffcf94', litBase = 0.45 }) {
  for (let f = 0; f < floors; f += 1) {
    for (let i = 0; i < count; i += 1) {
      const o = -span / 2 + (span / Math.max(1, count - 1)) * i;
      windowUnit(parent, {
        x: ry % Math.PI === 0 ? x + o : x,
        y: y0 + f * 1.05,
        z: ry % Math.PI === 0 ? z : z + o,
        w: 0.5,
        h: 0.5,
        lit: litBase + ((i + f) % 3) / 8,
        color,
        ry,
        bars: 1,
      });
    }
  }
}

function pipeDown(parent, { x, z, top, bottom = 0.2, color = '#6b7178' }) {
  cyl(0.035, 0.035, top - bottom, 6, toon(color, { rim: 0.18, rimColor: '#c8d8e8' }), {
    x, y: (top + bottom) / 2, z, parent, cast: false,
  });
  for (const yy of [bottom + 0.4, top - 0.4]) {
    box(0.1, 0.05, 0.1, toon('#4a5058', { rim: 0.12 }), { x, y: yy, z, parent, cast: false });
  }
}

function rooftopClutter(parent, { x, z, w = 1.2, d = 1.0, h = 1.0, wood = false }) {
  // 水箱
  cyl(0.24, 0.24, 0.42, 10, toon('#b9c0c8', { rim: 0.2, rimColor: '#e8f4ff' }), {
    x: x - w * 0.16, y: h + 0.3, z: z - d * 0.13, parent, cast: true,
  });
  for (const [dx, dz] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]]) {
    box(0.04, 0.2, 0.04, toon('#5d636b', { rim: 0.1 }), { x: x - w * 0.16 + dx, y: h + 0.1, z: z - d * 0.13 + dz, parent, cast: false });
  }
  // 空调组
  for (let i = 0; i < 2; i += 1) {
    acUnit(parent, { x: x + w * 0.2 + i * 0.5, y: h + 0.18, z: z + d * 0.12, ry: Math.PI });
  }
  // 天线
  cyl(0.015, 0.02, 1.0, 4, toon('#8a9199', { rim: 0.1 }), { x: x + w * 0.28, y: h + 0.5, z: z - d * 0.24, parent, cast: false });
  for (let i = 0; i < 3; i += 1) {
    box(0.4, 0.012, 0.012, toon('#8a9199', { rim: 0.1 }), { x: x + w * 0.28, y: h + 0.55 + i * 0.12, z: z - d * 0.24, parent, cast: false });
  }
  // 排气管
  cyl(0.05, 0.05, 0.3, 6, toon('#5d636b', { rim: 0.12 }), { x: x - w * 0.3, y: h + 0.15, z: z + d * 0.2, parent, cast: false });
  // 屋顶护栏
  if (!wood) {
    for (const [px, pz, ry] of [[0, -d * 0.36, 0], [0, d * 0.36, 0]]) {
      box(w * 0.8, 0.04, 0.03, toon('#5d636b', { rim: 0.1 }), { x: x + px, y: h + 0.45, z: z + pz, parent, cast: false });
      for (let i = 0; i < 5; i += 1) {
        cyl(0.012, 0.012, 0.42, 4, toon('#5d636b', { rim: 0.1 }), {
          x: x - w * 0.36 + (w * 0.72 * i) / 4, y: h + 0.24, z: z + pz, parent, cast: false,
        });
      }
    }
  }
}

function shopFrontDetail(parent) {
  // 便利店东侧（面向铁道）的侧墙细节
  const sx = 6.72;
  const sz = -4.4;
  // 侧窗
  for (let i = 0; i < 2; i += 1) {
    windowUnit(parent, { x: sx + 0.01, y: 1.9, z: sz - 0.9 + i * 1.7, w: 0.7, h: 0.5, lit: 0.65, ry: Math.PI / 2, bars: 1 });
  }
  // 侧挂灯箱
  const tex = signTexture(256, 640, (ctx, w, h) => {
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#20304f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 54px ${JP_FONT}`;
    ['つ', 'き', 'み', 'マ', 'ー', 'ト'].forEach((ch, i) => ctx.fillText(ch, w / 2, 62 + i * 92));
  });
  verticalSign(parent, { x: sx + 0.22, y: 2.7, z: sz - 1.95, w: 0.38, h: 1.6, tex, intensity: 1.35, ry: Math.PI / 2 });
  // 空调 + 水管
  acUnit(parent, { x: sx + 0.18, y: 0.74, z: sz + 0.9, ry: Math.PI / 2 });
  pipeDown(parent, { x: sx + 0.03, z: -2.0, top: 3.3 });
  // 小海报
  const poster = plane(0.4, 0.55, flat('#ffffff', { map: signTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8433a'; ctx.fillRect(0, 0, w, 78);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${JP_FONT}`; ctx.fillStyle = '#fff4dc'; ctx.fillText('新発売', w / 2, 42);
    ctx.fillStyle = '#20304f'; ctx.font = `700 44px ${JP_FONT}`; ctx.fillText('おにぎり', w / 2, 170);
    ctx.font = `600 30px ${JP_FONT}`; ctx.fillText('100円', w / 2, 280);
  }), fog: false }), { x: sx + 0.012, y: 1.55, z: -2.6, ry: Math.PI / 2, parent });
  poster.userData.noOutline = true;
}

function streetFurniture(parent) {
  // 路口：信号灯 + 路牌 + 护柱
  const poleMat = toon('#5d636b', { rim: 0.12, rimColor: '#9fb8d8' });
  cyl(0.04, 0.05, 3.0, 8, poleMat, { x: 2.1, y: 1.62, z: 2.3, parent, cast: true });
  box(0.7, 0.16, 0.18, toon('#2a3038', { rim: 0.16 }), { x: 2.1, y: 2.85, z: 2.3, parent, cast: true });
  for (const [dx, color] of [[-0.22, '#ff5a5a'], [0, '#ffcf5a'], [0.22, '#7dffc0']]) {
    sphere(0.07, flat(color).clone(), { x: 2.1 + dx, y: 2.85, z: 2.42, parent });
  }
  // 街名牌
  const streetSign = signTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8f0f8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a5a8a'; ctx.fillRect(0, 0, w, 20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 38px ${JP_FONT}`; ctx.fillStyle = '#2a3a4a'; ctx.fillText('月見町二丁目', w / 2, h * 0.56);
    ctx.font = `600 20px ${EN_FONT}`; ctx.fillStyle = '#5a7a9a'; ctx.fillText('TSUKIMI 2-CHOME', w / 2, h * 0.8);
  });
  const ss = plane(0.8, 0.2, lightbox(streetSign, 1.1), { x: 2.1, y: 2.55, z: 2.3, ry: 0, parent });
  ss.userData.noOutline = true;
  // 护柱（路口四角）
  for (const [x, z] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 1.8], [1.25, 1.8]]) {
    cyl(0.035, 0.04, 0.6, 6, toon('#d8d4c8', { rim: 0.18 }), { x, y: 0.42, z, parent, cast: false });
    sphere(0.045, flat('#ffcf94').clone(), { x, y: 0.76, z, parent }).material.color.multiplyScalar(1.6);
  }
  // 垃圾桶 / 消防栓 / 自动贩卖机
  for (const [x, z, color] of [[2.9, 1.85, '#4a6b8c'], [2.9, 1.35, '#b83a32']]) {
    box(0.26, 0.5, 0.24, toon(color, { rim: 0.16 }), { x, y: 0.37, z, parent, cast: true });
  }
  // 花坛 / 树篱
  for (const [x, z, w, d] of [[-2.35, -1.1, 0.35, 1.0], [2.35, -1.1, 0.35, 1.0], [-2.35, 2.3, 0.35, 1.0], [2.35, 1.3, 0.35, 1.0]]) {
    box(w, 0.22, d, toon('#4a6b4a', { rim: 0.16, rimColor: '#9fd8a0' }), { x, y: 0.23, z, parent, cast: false });
    for (let i = 0; i < 4; i += 1) {
      sphere(0.14, toon(i % 2 ? '#3f5a44' : '#4a7250', { rim: 0.16 }), {
        x: x + (i % 2 ? 0.06 : -0.06), y: 0.38, z: z - d / 3 + (i * d) / 4.5, parent, cast: false,
      });
    }
  }
}

/* 侧墙 / 屋顶 / 街道细节挂到现有 builders 之后 */
function applyDetailPass(parent, cats) {
  // 医院：东南角，可见东/南面
  const h = E.hospital;
  sideWindows(parent, { x: h.x + h.w / 2 + 0.01, z: h.z, y0: Y + 0.9, floors: 2, count: 3, span: 1.8, ry: Math.PI / 2, color: '#d8f0ff', litBase: 0.5 });
  sideWindows(parent, { x: h.x, z: h.z + h.d / 2 + 0.01, y0: Y + 0.9, floors: 2, count: 3, span: 1.8, ry: 0, color: '#d8f0ff', litBase: 0.5 });
  acUnit(parent, { x: h.x + h.w / 2 + 0.14, y: Y + 1.5, z: h.z - 0.6, ry: Math.PI / 2 });
  acUnit(parent, { x: h.x + h.w / 2 + 0.14, y: Y + 2.6, z: h.z - 0.6, ry: Math.PI / 2 });
  const hSign = signTexture(256, 640, (ctx, w, hh) => {
    ctx.fillStyle = '#f0f6fb'; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = '#2a5a8a'; ctx.fillRect(0, 0, w, 26);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 52px ${JP_FONT}`;
    ['月', '見', 'ク', 'リ', 'ニ', 'ッ', 'ク'].forEach((ch, i) => { ctx.fillStyle = i < 2 ? '#2a5a8a' : '#5a7a9a'; ctx.fillText(ch, w / 2, 58 + i * 76); });
  });
  verticalSign(parent, { x: h.x + h.w / 2 + 0.18, y: Y + 2.3, z: h.z + 0.75, w: 0.34, h: 1.4, tex: hSign, intensity: 1.2, ry: Math.PI / 2 });
  pipeDown(parent, { x: h.x + h.w / 2 + 0.04, z: h.z + h.d / 2 - 0.15, top: Y + h.h - 0.2 });

  // 公寓：可见南 / 东面
  const a = E.apartment;
  sideWindows(parent, { x: a.x + a.w / 2 + 0.01, z: a.z, y0: Y + 1.0, floors: 3, count: 2, span: 1.2, ry: Math.PI / 2, color: '#ffcf94', litBase: 0.45 });
  sideWindows(parent, { x: a.x, z: a.z + a.d / 2 + 0.01, y0: Y + 1.0, floors: 3, count: 2, span: 1.3, ry: 0, color: '#ffd9a0', litBase: 0.5 });
  rooftopClutter(parent, { x: a.x, z: a.z, w: a.w, d: a.d, h: Y + a.h });
  // 公寓招牌
  const aTex = signTexture(256, 128, (ctx, w, hh) => {
    ctx.fillStyle = '#f0ece0'; ctx.fillRect(0, 0, w, hh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 40px ${JP_FONT}`; ctx.fillStyle = '#3a3f47'; ctx.fillText('朝日ハイツ', w / 2, hh * 0.58);
  });
  const aSign = plane(0.7, 0.3, lightbox(aTex, 1.0), { x: a.x + a.w / 2 + 0.02, y: Y + 2.1, z: a.z + a.d / 2 - 0.1, ry: Math.PI / 2, parent });
  aSign.userData.noOutline = true;

  // 学校侧墙
  const sc = E.school;
  sideWindows(parent, { x: sc.x + sc.w / 2 + 0.01, z: sc.z, y0: Y + 1.0, floors: 2, count: 2, span: 1.6, ry: Math.PI / 2, color: '#ffe0b0', litBase: 0.4 });
  rooftopClutter(parent, { x: sc.x, z: sc.z, w: sc.w, d: sc.d, h: Y + sc.h });

  // 商业店铺侧面（南墙）挂灯与侧招牌
  for (const cfg of E.commercial) {
    // 南侧端头：一个小侧招牌 + 空调
    const zSouth = cfg.position.z + 1.1;
    const sTex = signTexture(256, 128, (ctx, w, hh) => {
      ctx.fillStyle = '#241c18'; ctx.fillRect(0, 0, w, hh);
      ctx.strokeStyle = '#ffcf94'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, hh - 8);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 34px ${JP_FONT}`; ctx.fillStyle = '#ffd9a0';
      ctx.fillText(cfg.id === 'ramen' ? '営業中' : 'お食事処', w / 2, hh / 2);
    });
    const face = plane(0.5, 0.25, lightbox(sTex, 1.1), { x: cfg.position.x - 0.9, y: Y + 1.8, z: zSouth + 0.01, parent });
    face.userData.noOutline = true;
    acUnit(parent, { x: cfg.position.x - 1.2, y: Y + 0.9, z: zSouth + 0.16, ry: 0 });
  }

  // 便利店侧墙
  shopFrontDetail(parent);

  // 路口 / 街道道具
  streetFurniture(parent);

  // 增加路边植被
  for (const [x, z, s] of [[-2.9, 2.05, 0.18], [2.9, -1.35, 0.16], [-3.8, -1.15, 0.2], [3.7, 5.9, 0.18], [-2.9, 6.1, 0.16]]) {
    sphere(s, toon('#3f5a44', { rim: 0.18, rimColor: '#9fd8a0' }), { x, y: 0.24, z, parent, cast: true });
  }

  // 2~3 只猫
  cats.push(cat(parent, { x: 1.4, z: 2.4, ry: 1.2 }));
  cats.push(cat(parent, { x: -2.95, z: -1.2, ry: 2.7 }));
}

/* -------------------------------------------------------------------------- */
/*  河边 / 车站 / 小汽车（补足前景密度）                                        */
/* -------------------------------------------------------------------------- */

function riverSide(parent) {
  const g = group('riverside');
  parent.add(g);
  const bank = toon('#7a7d74', { rim: 0.12, rimColor: '#9fb8c8' });
  // 亲水步道栏杆
  for (let x = -7.2; x < 6.6; x += 1.6) {
    if (x > -1.6 && x < 1.6) continue; // 主桥位置
    cyl(0.025, 0.025, 0.55, 6, toon('#4a5058', { rim: 0.1 }), { x, y: 0.4, z: 6.84, parent: g, cast: false });
    box(0.03, 0.035, 1.55, toon('#4a5058', { rim: 0.1 }), { x: x + 0.8, y: 0.66, z: 6.84, parent: g, cast: false });
  }
  // 河堤灯（暖色小球）
  for (const x of [-6.4, -3.2, 2.6, 5.2]) {
    cyl(0.03, 0.04, 0.9, 6, toon('#5d636b', { rim: 0.12 }), { x, y: 0.57, z: 6.88, parent: g, cast: false });
    sphere(0.06, glow('#ffcf94', 1.6), { x, y: 1.03, z: 6.88, parent: g });
    const sp = glowSprite('#ffcf94', 1.2, 0.35);
    sp.position.set(x, 1.03, 6.88);
    g.add(sp);
  }
  // 主桥灯 + 桥栏
  for (const sx of [-1.05, 1.05]) {
    for (const z of [7.0, 7.3]) {
      cyl(0.02, 0.02, 0.6, 4, toon('#5d636b', { rim: 0.1 }), { x: sx, y: 0.38, z, parent: g, cast: false });
    }
    box(0.05, 0.04, 1.2, toon('#5d636b', { rim: 0.1 }), { x: sx, y: 0.66, z: 7.15, parent: g, cast: false });
    const sp = glowSprite('#ffcf94', 1.3, 0.4);
    sp.position.set(sx, 0.84, 7.0);
    g.add(sp);
  }
  // 桥头石柱
  for (const [x, z] of [[-1.3, 6.7], [1.3, 6.7], [-1.3, 7.45], [1.3, 7.45]]) {
    box(0.18, 0.5, 0.18, toon('#8a8d84', { rim: 0.14 }), { x, y: 0.34, z, parent: g, cast: true });
    sphere(0.07, glow('#ffcf94', 1.4), { x, y: 0.65, z, parent: g });
  }
  // 铁道桥护栏
  for (const x of [6.95, 7.5]) {
    box(0.04, 0.5, 0.8, toon('#3a3f47', { rim: 0.1 }), { x, y: 0.55, z: 7.15, parent: g, cast: false });
  }
  // 芦苇
  for (const [x, z] of [[-6.9, 7.0], [-4.2, 7.2], [3.4, 7.05], [5.8, 7.1]]) {
    for (let i = 0; i < 5; i += 1) {
      cyl(0.008, 0.012, 0.45 + (i % 3) * 0.12, 4, toon('#5a6b4a', { rim: 0.12 }), {
        x: x + (i - 2) * 0.07, y: 0.32, z: z + (i % 2) * 0.05, parent: g, cast: false,
      });
    }
  }
}

function stationBooth(parent) {
  const g = group('station-booth');
  parent.add(g);
  const p = E.platform;
  // 站房（小体量，但做出候车室 + 钟 + 站名）
  const bx = p.x0 + 0.12;
  const bz = p.z0 + 0.55;
  box(0.56, 1.85, 0.9, toon('#d8d4c8', { rim: 0.16, rimColor: '#c8d8e8' }), { x: bx, y: 1.08, z: bz, parent: g, cast: true });
  box(0.66, 0.1, 1.0, toon('#2a5a8a', { rim: 0.16 }), { x: bx, y: 2.03, z: bz, parent: g, cast: true });
  warmWin(g, { x: bx + 0.29, y: 1.2, z: bz + 0.15, w: 0.48, h: 0.5, lit: 1.2, ry: Math.PI / 2, color: '#fff0c8' });
  const stationName = signTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f0f4f8'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${JP_FONT}`; ctx.fillStyle = '#2a3a4a'; ctx.fillText('月見駅', w / 2, h * 0.54);
  });
  const namePlate = plane(0.62, 0.22, lightbox(stationName, 1.2), { x: bx + 0.29, y: 1.92, z: bz - 0.36, ry: Math.PI / 2, parent: g });
  namePlate.userData.noOutline = true;
  // 钟
  cyl(0.11, 0.11, 0.035, 14, toon('#e8e4d4', { rim: 0.2 }), { x: bx + 0.29, y: 1.7, z: bz + 0.5, rx: Math.PI / 2, parent: g, cast: false });
  warmSprite(g, { x: bx + 0.4, y: 1.2, z: bz, color: '#ffe0b0', size: 1.3, opacity: 0.35 });
  // 站台灯带
  for (const z of [p.z0 + 0.4, p.z1 - 0.4]) {
    const strip = box(0.06, 0.04, 1.1, flat('#e8f4ff').clone(), { x: p.x0 + 0.32, y: 2.28, z, parent: g });
    strip.material.color.multiplyScalar(1.8);
    strip.material.toneMapped = false;
    strip.userData.noOutline = true;
  }
  // 时刻表
  const board = plane(0.5, 0.7, lightbox(signTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#0f2030'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 30px ${JP_FONT}`; ctx.fillStyle = '#8fd8ff'; ctx.fillText('発車時刻', w / 2, 40);
    ctx.font = `500 22px ${EN_FONT}`; ctx.fillStyle = '#e8f4ff';
    ['06:12  ひかり', '06:28  各停', '06:45  快速', '07:02  ひかり'].forEach((t, i) => ctx.fillText(t, w / 2, 100 + i * 48));
  }), 1.1), { x: p.x0 + 0.02, y: 1.5, z: pzMid(parent), ry: Math.PI / 2, parent: g });
  board.userData.noOutline = true;
}

function pzMid() {
  return (E.platform.z0 + E.platform.z1) / 2;
}

function parkedCar(parent, { x, z, ry = 0, color = '#4a5a6a' }) {
  const g = group('car');
  g.position.set(x, 0.02, z);
  g.rotation.y = ry;
  parent.add(g);
  box(0.62, 0.32, 1.05, toon(color, { rim: 0.16, rimColor: '#c8d8e8', gradient: 'soft' }), { y: 0.26, parent: g, cast: true });
  box(0.52, 0.24, 0.52, toon('#26303a', { rim: 0.14 }), { y: 0.5, z: -0.05, parent: g, cast: true });
  for (const [wx, wz] of [[-0.28, -0.34], [0.28, -0.34], [-0.28, 0.34], [0.28, 0.34]]) {
    cyl(0.085, 0.085, 0.12, 8, toon('#1b1e24', { rim: 0.1 }), { x: wx, y: 0.14, z: wz, rx: Math.PI / 2, parent: g, cast: false });
  }
  for (const zz of [-0.53, 0.53]) {
    const sp = glowSprite(zz > 0 ? '#ff4a3a' : '#fff0c0', 0.7, zz > 0 ? 0.4 : 0.25);
    sp.position.set(0, 0.28, zz);
    g.add(sp);
  }
  // 车窗
  for (const sx of [-0.27, 0.27]) {
    const win = plane(0.32, 0.18, flat('#9fd8ff').clone(), { x: sx, y: 0.52, z: -0.05, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, parent: g });
    win.material.color.multiplyScalar(0.7);
    win.material.toneMapped = false;
    win.userData.noOutline = true;
  }
  return g;
}

function bridgeTorii(parent) {
  const g = group('bridge-torii');
  parent.add(g);
  const red = toon('#b8402f', { rim: 0.22, rimColor: '#ffb0a0', gradient: 'soft' });
  const dark = toon('#3a241e', { rim: 0.16 });
  const x = 0;
  const z = 6.72;
  for (const sx of [x - 0.85, x + 0.85]) {
    cyl(0.075, 0.09, 2.1, 10, red, { x: sx, y: 0.35 + 1.05, z, parent: g, cast: true });
    cyl(0.11, 0.11, 0.1, 10, dark, { x: sx, y: 0.17, z, parent: g, cast: false });
  }
  box(2.2, 0.12, 0.16, red, { x, y: 2.05, z, parent: g, cast: true });
  box(2.45, 0.09, 0.2, red, { x, y: 2.25, z, parent: g, cast: true });
  box(2.5, 0.09, 0.24, dark, { x, y: 2.35, z, parent: g, cast: false });
  // 灯笼一对
  for (const sx of [x - 0.62, x + 0.62]) {
    chochin(g, { x: sx, y: 1.78, z: z + 0.12, r: 0.1, color: '#e8dcc0', text: '献灯', glowSize: 0.8 });
    const sp = glowSprite('#ffcf94', 1.2, 0.35);
    sp.position.set(sx, 1.78, z + 0.2);
    g.add(sp);
  }
  return g;
}

function extraStreetLife(parent) {
  bridgeTorii(parent);
  // 主街上空的灯笼串（跨街）
  lanternString(parent, { x0: -2.1, x1: 2.1, y: 2.8, z: 0.5, count: 6, color: '#ffb35e', sag: 0.3 });
  lanternString(parent, { x0: -2.1, x1: 2.1, y: 2.7, z: 2.2, count: 6, color: '#ffcf94', sag: 0.25 });
  // 路边停一辆小货车
  parkedCar(parent, { x: 4.6, z: 0.05, ry: Math.PI / 2, color: '#4a5a6a' });
  parkedCar(parent, { x: -5.4, z: 1.0, ry: -Math.PI / 2, color: '#6a5a4a' });
  // 路口另一侧的小公园长椅 + 自动贩卖机
  vendingMachine(parent, { x: -2.35, z: 6.55, ry: Math.PI, hot: true });
  bench(parent, { x: -3.8, z: 6.6, ry: 0 });
  // 邮筒 / 公共电话
  postBox(parent, { x: -2.35, z: 2.3 });
  box(0.26, 1.8, 0.26, toon('#2a5a8a', { rim: 0.16 }), { x: 2.35, y: 0.92, z: 6.55, parent, cast: true });
  box(0.22, 0.3, 0.05, flat('#d8f0ff').clone(), { x: 2.35, y: 1.55, z: 6.68, parent }).material.color.multiplyScalar(1.2);
  // 街边灯笼串（商业街上方）
  for (const z of [3.4, 4.4, 5.4]) {
    lanternString(parent, { x0: -2.2, x1: -1.6, y: 2.5, z, count: 3, color: '#ffb35e', sag: 0.08 });
  }
  // 自动贩卖机群（城镇角落）
  vendingMachine(parent, { x: 2.35, z: 5.8, ry: -Math.PI / 2, hot: false });
}

/* -------------------------------------------------------------------------- */
/*  屋顶细节（大幅减少「空白大盒子」的观感）                                    */
/* -------------------------------------------------------------------------- */

function roofBillboard(parent, { x, y, z, w, h, tex, ry = 0, intensity = 1.2 }) {
  const g = group('roof-sign');
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(w + 0.1, h + 0.1, 0.1, toon('#20242a', { rim: 0.2, rimColor: '#8fa8c8' }), { parent: g, cast: true });
  const face = plane(w, h, lightbox(tex, intensity), { z: 0.056, parent: g });
  face.userData.noOutline = true;
  // 支架
  for (const dx of [-w * 0.32, w * 0.32]) {
    box(0.05, 0.55, 0.05, toon('#4a5058', { rim: 0.1 }), { x: dx, y: -h / 2 - 0.25, parent: g, cast: false });
  }
  return g;
}

function roofDetailPass(parent) {
  // 便利店屋顶：大字招牌 + 设备 + 天窗
  roofBillboard(parent, {
    x: 4.4, y: 4.28, z: -4.0, w: 2.5, h: 0.62, ry: 0,
    tex: signTexture(1024, 256, (ctx, w, h) => {
      ctx.fillStyle = '#20304f'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 86px ${JP_FONT}`; ctx.fillStyle = '#f2ead8';
      ctx.fillText('つきみマート', w / 2, h * 0.42);
      ctx.font = `600 34px ${EN_FONT}`; ctx.fillStyle = '#9fd8ff';
      ctx.fillText('TSUKIMI MART  ·  24H  ·  月見町二丁目店', w / 2, h * 0.8);
    }),
    intensity: 1.25,
  });
  // 便利店屋顶设备
  for (const [x, z] of [[3.0, -5.6], [5.6, -5.4], [3.3, -3.2]]) {
    acUnit(parent, { x, y: 3.95, z, ry: 0 });
  }
  box(0.9, 0.35, 0.7, toon('#8f969f', { rim: 0.18 }), { x: 5.3, y: 4.0, z: -3.1, parent, cast: true });
  cyl(0.16, 0.16, 0.22, 10, toon('#5d636b', { rim: 0.12 }), { x: 5.3, y: 4.25, z: -3.1, parent, cast: false });
  // 屋顶栏杆
  for (const [x0, z0, x1, z1] of [[2.2, -7.0, 6.6, -7.0], [6.6, -7.0, 6.6, -1.6]]) {
    box(Math.abs(x1 - x0) || 0.04, 0.03, Math.abs(z1 - z0) || 0.04, toon('#4a5058', { rim: 0.1 }), {
      x: (x0 + x1) / 2, y: 4.0, z: (z0 + z1) / 2, parent, cast: false,
    });
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      cyl(0.012, 0.012, 0.35, 4, toon('#4a5058', { rim: 0.1 }), {
        x: x0 + (x1 - x0) * t, y: 3.82, z: z0 + (z1 - z0) * t, parent, cast: false,
      });
    }
  }
  // 医院屋顶招牌
  roofBillboard(parent, {
    x: 3.0, y: 4.25, z: 5.1, w: 1.4, h: 0.34, ry: 0,
    tex: signTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f0f6fb'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a5a8a'; ctx.fillRect(0, 0, w, 22);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 40px ${JP_FONT}`; ctx.fillStyle = '#2a3a4a'; ctx.fillText('月見町クリニック', w / 2, h * 0.58);
    }),
    intensity: 1.1,
  });
  // 公寓屋顶招牌
  roofBillboard(parent, {
    x: -6.0, y: 5.6, z: -1.5, w: 1.5, h: 0.34, ry: 0,
    tex: signTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2a3038'; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 44px ${JP_FONT}`; ctx.fillStyle = '#ffe0b0'; ctx.fillText('朝日ハイツ', w / 2, h * 0.56);
    }),
    intensity: 1.0,
  });
  // 学校屋顶：钟楼 + 天线
  cyl(0.05, 0.06, 0.9, 6, toon('#c8c4b4', { rim: 0.16 }), { x: -6.0, y: 4.25, z: -6.15, parent, cast: true });
  box(0.3, 0.3, 0.3, toon('#e8e4d4', { rim: 0.2 }), { x: -6.0, y: 4.75, z: -6.15, parent, cast: true });
  cyl(0.13, 0.13, 0.03, 14, toon('#2a3038', { rim: 0.2 }), { x: -6.0, y: 4.78, z: -5.99, rx: Math.PI / 2, parent, cast: false });
  // 商业街屋顶水箱
  for (const cfg of E.commercial) {
    cyl(0.18, 0.18, 0.3, 10, toon('#b9c0c8', { rim: 0.18 }), { x: cfg.position.x - 1.1, y: Y + 2.9, z: cfg.position.z + 0.5, parent, cast: true });
  }
}

/* -------------------------------------------------------------------------- */
/*  第二/第三轮密度：小门面、理发店、学校体育馆、医院/车站内景、平交道口          */
/* -------------------------------------------------------------------------- */

function interiorTexture(kind = 'cafe') {
  return signTexture(512, 320, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, kind === 'laundry' ? '#c8eef8' : '#3a2a20');
    grd.addColorStop(1, kind === 'pharmacy' ? '#d8f0e8' : '#1a1210');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    // 后墙灯带
    ctx.fillStyle = kind === 'laundry' ? 'rgba(255,255,255,0.75)' : 'rgba(255,210,150,0.85)';
    ctx.fillRect(0, 20, w, 10);
    // 货架 / 桌椅剪影
    ctx.fillStyle = 'rgba(20,14,12,0.72)';
    if (kind === 'cafe') {
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(40 + i * 150, 170, 100, 14);
        ctx.fillRect(46 + i * 150, 184, 10, 70);
        ctx.fillRect(124 + i * 150, 184, 10, 70);
        ctx.fillStyle = 'rgba(255,210,150,0.55)';
        ctx.beginPath(); ctx.arc(90 + i * 150, 140, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(20,14,12,0.72)';
      }
    } else if (kind === 'pharmacy') {
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 7; c += 1) {
        ctx.fillStyle = ['#e8f0e8', '#7fd8b8', '#e8d070', '#c8e8ff'][(r + c) % 4];
        ctx.fillRect(30 + c * 66, 80 + r * 62, 54, 44);
      }
      ctx.fillStyle = 'rgba(30,80,70,0.8)';
      ctx.fillRect(350, 200, 140, 18);
      ctx.fillRect(360, 218, 12, 60);
      ctx.fillRect(466, 218, 12, 60);
    } else if (kind === 'laundry') {
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = '#e8f0f2';
        ctx.fillRect(28 + i * 120, 120, 90, 140);
        ctx.fillStyle = '#7fbfd8';
        ctx.beginPath(); ctx.arc(73 + i * 120, 180, 26, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'barber') {
      ctx.fillStyle = 'rgba(240,240,240,0.85)';
      ctx.fillRect(30, 60, 120, 200);
      ctx.fillRect(380, 60, 100, 200);
      ctx.fillStyle = 'rgba(30,30,34,0.8)';
      ctx.fillRect(80, 170, 120, 14);
      ctx.fillRect(220, 160, 120, 14);
      ctx.fillRect(86, 184, 10, 76);
      ctx.fillRect(304, 174, 10, 86);
    } else if (kind === 'books') {
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 5; c += 1) {
          ctx.fillStyle = ['#8c3a2a', '#3a5a4a', '#7a5a2a', '#3a4a6a', '#c8a060'][(r + c * 2) % 5];
          ctx.fillRect(28 + c * 92, 96 + r * 62, 76, 42);
        }
      }
      ctx.fillStyle = 'rgba(255,210,150,0.7)';
      ctx.beginPath(); ctx.arc(300, 80, 24, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'thrift') {
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 6; c += 1) {
        ctx.fillStyle = ['#ff8a5c', '#7fd8b8', '#e8d070', '#c8a7ff', '#ff6f9c'][(r * 2 + c) % 5];
        ctx.fillRect(24 + c * 78, 84 + r * 68, 48, 36);
      }
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 62px sans-serif';
      ctx.fillText('100', 30, 290);
    }
    // 玻璃反光
    ctx.fillStyle = 'rgba(200,230,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w * 0.4, 0); ctx.lineTo(w * 0.1, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  });
}

function compactShopFront(parent, cfg) {
  const g = group(`shop-${cfg.id}`);
  const w = cfg.width;
  const h = cfg.height || 2.35;
  const frontZ = cfg.zFront;
  const depth = cfg.depth || 0.95;
  const cx = cfg.x;
  parent.add(g);
  // 主体
  box(w, h, depth, toon(cfg.wall || '#c8bca8', { rim: 0.16, rimColor: '#a8c4e4', gradient: 'soft' }), {
    x: cx, y: Y + h / 2, z: frontZ - depth / 2, parent: g, cast: true, receive: true,
  });
  // 店头玻璃 + 内景图
  const glassW = w - 0.16;
  const glassH = 1.35;
  const interior = plane(glassW, glassH, lightbox(interiorTexture(cfg.kind), 0.95), {
    x: cx, y: Y + 1.05, z: frontZ + 0.005, parent: g,
  });
  interior.userData.noOutline = true;
  // 玻璃斜反光
  const glass = plane(glassW, glassH, toon('#cfe8ff', { transparent: true, opacity: 0.12, rim: 0.2, side: THREE.DoubleSide, depthWrite: false }), {
    x: cx, y: Y + 1.05, z: frontZ + 0.012, parent: g,
  });
  glass.userData.noOutline = true;
  // 框
  for (const dx of [-w / 2 + 0.06, 0, w / 2 - 0.06]) {
    box(0.045, glassH + 0.12, 0.05, toon('#d8d4c8', { rim: 0.16 }), { x: cx + dx, y: Y + 1.05, z: frontZ + 0.02, parent: g, cast: false });
  }
  box(glassW, 0.05, 0.05, toon('#d8d4c8', { rim: 0.16 }), { x: cx, y: Y + 1.74, z: frontZ + 0.02, parent: g, cast: false });
  // 门
  const doorX = cx + w * 0.22;
  box(w * 0.22, 1.5, 0.04, toon('#2a2a2e', { rim: 0.14 }), { x: doorX, y: Y + 0.83, z: frontZ + 0.03, parent: g, cast: false });
  // 招牌
  const signTex = signTexture(512, 160, (ctx, sw, sh) => {
    ctx.fillStyle = cfg.signBg || '#2a1c14';
    ctx.fillRect(0, 0, sw, sh);
    ctx.strokeStyle = cfg.accent || '#ffd9a0';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, sw - 10, sh - 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 54px ${JP_FONT}`;
    ctx.fillStyle = cfg.accent || '#ffd9a0';
    ctx.fillText(cfg.jp, sw / 2, sh * 0.42);
    ctx.font = `500 22px ${EN_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(cfg.en, sw / 2, sh * 0.78);
  });
  const sign = plane(w - 0.1, 0.38, lightbox(signTex, 1.25), { x: cx, y: Y + 2.03, z: frontZ + 0.02, parent: g });
  sign.userData.noOutline = true;
  box(w + 0.04, 0.44, 0.06, toon('#20242a', { rim: 0.16 }), { x: cx, y: Y + 2.03, z: frontZ + 0.005, parent: g, cast: false });
  // 雨棚
  if (cfg.awning !== false) {
    const aw = box(w + 0.1, 0.04, 0.5, toon(cfg.awningColor || '#3f5a5a', { rim: 0.14 }), {
      x: cx, y: Y + 1.82, z: frontZ + 0.25, parent: g, cast: true,
    });
    aw.rotation.x = -0.12;
  }
  // 小灯笼 / 灯
  if (cfg.lantern) {
    chochin(g, { x: cx - w / 2 - 0.1, y: Y + 1.7, z: frontZ + 0.2, r: 0.1, color: '#d24a38', text: '', glowSize: 0.9 });
    warmSprite(g, { x: cx, y: Y + 1.1, z: frontZ + 0.35, color: cfg.color || '#ffcf94', size: 0.8, opacity: 0.22 });
  }
  // 门垫 / 小推牌
  box(w * 0.5, 0.025, 0.3, toon('#4a4a46', { rim: 0.08 }), { x: cx, y: Y + 0.13, z: frontZ + 0.22, parent: g, cast: false });
  warmSprite(g, { x: cx, y: Y + 1.2, z: frontZ + 0.6, color: cfg.color || '#ffcf94', size: 0.9, opacity: 0.2 });
  return g;
}

function buildNorthShops(parent) {
  for (const cfg of E.northShops) {
    compactShopFront(parent, { ...cfg, width: cfg.w, zFront: -1.5, kind: cfg.id, height: 2.35 });
  }
}

function buildBarberShop(parent) {
  const cfg = E.barber;
  compactShopFront(parent, {
    id: 'barber', x: cfg.x, zFront: 6.85 - 0.9 * 0.52 - 0.5,
    width: cfg.width, height: 2.25, depth: 0.9, kind: 'barber',
    jp: '床屋 タカハシ', en: 'TAKAHASHI BARBER', signBg: '#1e2a3a', accent: '#9fd8ff',
    wall: '#c8d0d8', color: '#cfe8ff', awningColor: '#2a4a5a', lantern: false,
  });
  const g = group('barber-extra');
  parent.add(g);
  // 理发店转灯
  barberPole(g, { x: cfg.x - cfg.width * 0.7, z: 6.85, });
  warmSprite(g, { x: cfg.x, y: Y + 1.1, z: 6.9, color: '#cfe8ff', size: 0.9, opacity: 0.22 });
  return g;
}

function schoolExtras(parent) {
  const s = E.school;
  // 屋顶体育馆 / 操场看台（微缩体量）
  box(s.w * 0.7, 0.9, s.d * 0.55, toon('#8a8f96', { rim: 0.16 }), {
    x: s.x + s.w * 0.05, y: Y + s.h + 0.45, z: s.z - s.d * 0.15, parent, cast: true,
  });
  box(s.w * 0.74, 0.1, s.d * 0.6, toon('#3a4652', { rim: 0.14 }), {
    x: s.x + s.w * 0.05, y: Y + s.h + 0.95, z: s.z - s.d * 0.15, parent, cast: true,
  });
  for (let i = 0; i < 3; i += 1) {
    const win = plane(0.6, 0.4, flat('#e8f4ff').clone(), {
      x: s.x - s.w * 0.2 + i * 0.5, y: Y + s.h + 0.45, z: s.z - s.d * 0.15 + s.d * 0.28, parent,
    });
    win.material.color.multiplyScalar(1.4);
    win.material.toneMapped = false;
    win.userData.noOutline = true;
  }
  // 操场滑梯 / 沙坑
  const yard = s.yard;
  box(0.7, 0.04, 0.4, toon('#c8b890', { rim: 0.1 }), { x: yard.x - 0.4, y: Y + 0.16, z: yard.z, parent, cast: false });
  const slide = box(0.24, 0.05, 0.6, toon('#e8c05e', { rim: 0.14 }), { x: yard.x + 0.45, y: Y + 0.35, z: yard.z, parent, cast: true });
  slide.rotation.x = 0.32;
  cyl(0.02, 0.02, 0.5, 4, toon('#8a8f96', { rim: 0.1 }), { x: yard.x + 0.45, y: Y + 0.42, z: yard.z - 0.05, parent, cast: false });
}

function hospitalLobby(parent) {
  const h = E.hospital;
  const lobby = plane(h.w * 0.62, 0.95, lightbox(interiorTexture('pharmacy'), 0.9), {
    x: h.x, y: Y + 0.78, z: h.z + h.d / 2 + 0.02, parent,
  });
  lobby.userData.noOutline = true;
  // 玻璃门框
  box(h.w * 0.64, 0.04, 0.05, toon('#d8e8f0', { rim: 0.16 }), { x: h.x, y: Y + 1.28, z: h.z + h.d / 2 + 0.03, parent, cast: false });
  for (const dx of [-h.w * 0.16, h.w * 0.16]) {
    box(0.035, 1.0, 0.04, toon('#d8e8f0', { rim: 0.16 }), { x: h.x + dx, y: Y + 0.8, z: h.z + h.d / 2 + 0.03, parent, cast: false });
  }
  warmSprite(parent, { x: h.x, y: Y + 1.1, z: h.z + h.d / 2 + 0.35, color: '#d8f0ff', size: 1.0, opacity: 0.2 });
}

function stationInterior(parent) {
  const p = E.platform;
  const bz = p.z0 + 0.55;
  const bx = p.x0 + 0.12;
  // 候车室玻璃内景
  const wait = plane(0.44, 0.55, lightbox(interiorTexture('cafe'), 0.95), {
    x: bx + 0.30, y: Y + 1.15, z: bz + 0.15, ry: Math.PI / 2, parent,
  });
  wait.userData.noOutline = true;
  // 站台长椅 + 行李
  bench(parent, { x: p.x0 + 0.3, z: p.z0 + 1.25, ry: Math.PI / 2 });
  // 平交道口：道口信号 + 栏杆
  const cx = 7.2;
  const cz = 5.55;
  for (const dx of [-0.45, 0.45]) {
    cyl(0.03, 0.03, 0.9, 6, toon('#e8e4d4', { rim: 0.16 }), { x: cx + dx, y: 0.57, z: cz, parent, cast: false });
    box(0.1, 0.14, 0.1, toon('#2a3038', { rim: 0.14 }), { x: cx + dx, y: 1.05, z: cz, parent, cast: false });
    const red = sphere(0.05, flat('#ff5a5a').clone(), { x: cx + dx, y: 1.08, z: cz + 0.08, parent });
    red.material.color.multiplyScalar(1.6);
    // 黄黑栏杆
    const arm = box(0.9, 0.05, 0.05, toon('#e8c05e', { rim: 0.12 }), { x: cx + dx * 0.4, y: 0.85, z: cz, parent, cast: false });
    arm.rotation.z = dx > 0 ? 0.12 : -0.12;
  }
  // 道口标志
  const crossSign = plane(0.5, 0.3, lightbox(signTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8d04a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('踏切', w / 2, h / 2);
  }), 1.2), { x: 6.55, y: 1.25, z: cz, ry: -Math.PI / 2, parent });
  crossSign.userData.noOutline = true;
}

/* 在 buildTown 中调用这些补充层 */
function townDensityPass(parent, cats) {
  buildNorthShops(parent);
  barberPole(parent, { x: -3.78, z: -1.92 });
  schoolExtras(parent);
  hospitalLobby(parent);
  stationInterior(parent);
}

/* 北侧小门面上方的两层住宅（混合用途长屋，补住宅数量与街道密度） */
function northShopUpperFloors(parent) {
  const shops = E.northShops;
  const x0 = shops[0].x - shops[0].w / 2;
  const x1 = shops[shops.length - 1].x + shops[shops.length - 1].w / 2;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const zFront = -1.5;
  const depth = 1.0;
  const baseY = Y + 2.4;
  const wall = toon('#b8b0a0', { rim: 0.14, rimColor: '#a8c4e4', gradient: 'soft' });
  const warm = toon('#8a7f6e', { rim: 0.12 });
  // 两层住宅体块
  box(w, 3.3, depth, wall, { x: cx, y: baseY + 1.65, z: zFront - depth / 2, parent, cast: true, receive: true });
  // 楼层线 / 屋顶
  for (const yy of [baseY + 1.6]) {
    box(w + 0.08, 0.06, depth + 0.08, warm, { x: cx, y: yy, z: zFront - depth / 2, parent, cast: false });
  }
  box(w + 0.14, 0.1, depth + 0.14, toon('#3f4a56', { rim: 0.16 }), { x: cx, y: baseY + 3.3, z: zFront - depth / 2, parent, cast: true });
  // 每层窗 + 空调 + 阳台
  for (let level = 0; level < 2; level += 1) {
    const wy = baseY + 0.85 + level * 1.6;
    for (let i = 0; i < 5; i += 1) {
      const px = x0 + (w / 5) * (i + 0.5);
      warmWin(parent, { x: px, y: wy, z: zFront + 0.01, w: 0.36, h: 0.5, lit: 0.25 + ((i + level) % 4) / 7, color: '#ffd9a0' });
    }
    box(w * 0.94, 0.04, 0.24, toon('#5a5f66', { rim: 0.12 }), { x: cx, y: wy - 0.42, z: zFront + 0.12, parent, cast: false });
    for (let i = 0; i < 9; i += 1) {
      cyl(0.008, 0.008, 0.28, 4, toon('#6b7178', { rim: 0.1 }), { x: x0 + (w / 9) * i + 0.1, y: wy - 0.26, z: zFront + 0.22, parent, cast: false });
    }
    // 阳台 AC
    acUnit(parent, { x: x0 + w * 0.83, y: wy - 0.18, z: zFront + 0.16 });
  }
  // 屋顶水箱 / 天线 / 晒衣杆
  cyl(0.2, 0.2, 0.32, 10, toon('#b9c0c8', { rim: 0.18 }), { x: cx - w * 0.28, y: baseY + 3.55, z: zFront - 0.3, parent, cast: true });
  cyl(0.014, 0.02, 1.0, 4, toon('#8a9199', { rim: 0.1 }), { x: cx + w * 0.3, y: baseY + 3.8, z: zFront - 0.3, parent, cast: false });
  box(w * 0.6, 0.025, 0.025, toon('#8a9199', { rim: 0.1 }), { x: cx, y: baseY + 4.0, z: zFront - 0.3, parent, cast: false });
  // 长屋门牌
  const plate = signTexture(512, 96, (ctx, sw, sh) => {
    ctx.fillStyle = '#f0e8d8'; ctx.fillRect(0, 0, sw, sh);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 38px ${JP_FONT}`; ctx.fillStyle = '#3a3028'; ctx.fillText('月見長屋  ·  2F / 3F', sw / 2, sh / 2);
  });
  const label = plane(w * 0.42, 0.16, lightbox(plate, 0.9), { x: cx, y: baseY + 2.5, z: zFront + 0.012, parent });
  label.userData.noOutline = true;
}
