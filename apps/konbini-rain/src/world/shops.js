/**
 * world/shops.js —— 整条商店街的日式店铺、对面的浅立面与街道家具。
 *
 * 设计原则：
 *   - 沿用便利店的三渲二 / 暖光冷雨风格：墙 = toon，灯箱 = lightbox，霓虹 = glow；
 *   - 所有招牌、窗贴、菜单、自动贩卖机面板都是 Canvas 程序化绘制，零外部贴图；
 *   - 近侧店铺（world/shops.js 左侧）完整可看：门头 + 浅店内 + 楼上 + 屋顶设备；
 *   - 对面（右侧/远端）是浅立面，主要贡献街道另一侧的轮廓、灯牌和公寓窗光；
 *   - 没有人物，克制、安静，让雨声和灯牌自己说话。
 */
import * as THREE from 'three';
import { C, E, rng } from '../config.js';
import { toon, flat, lightbox, glow, glowSprite, addOutline } from '../lib/toon.js';
import { canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import {
  box,
  plane,
  group,
  mesh,
  cyl,
  sphere,
  torus,
  roundedBox,
  instanced,
  trs,
  catenary,
  tube,
} from '../lib/kit.js';

const FRONT_Z = 0.9;
const BACK_Z = -5.92;
const ROOF_Y = 0.12;

const PAL = {
  wallCream: '#d8d0bd',
  wallShade: '#bfb7a3',
  wallWarm: '#c9b594',
  wallGrey: '#6f747c',
  wallDark: '#3a3f47',
  wood: '#5a3d2b',
  woodLight: '#8a6444',
  woodDark: '#33231a',
  metal: '#8f969f',
  metalDark: '#4a5058',
  tile: '#3c4654',
  tileAlt: '#2e3742',
  paper: '#efe6d4',
  warm: '#ffd9a0',
  warmDeep: '#ffb45e',
  cool: '#9fd8ff',
  neonPink: '#ff6f9c',
  neonCyan: '#7fe8e0',
  red: '#c8433a',
  gutter: '#333842',
};

/* -------------------------------------------------------------------------- */
/*  小型工具                                                                   */
/* -------------------------------------------------------------------------- */

function signTexture(w, h, draw) {
  return canvasTexture(w, h, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  });
}

function textOf(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** 横向门头灯箱 */
function signBox(parent, { w, h, x, y, z, tex, intensity = 1.35, ry = 0, depth = 0.1 }) {
  const shell = box(w + 0.08, h + 0.08, depth, toon('#20242a', { rim: 0.2, rimColor: '#8fa8c8' }), {
    x,
    y,
    z: z - 0.055,
    ry,
    parent,
    cast: true,
    receive: true,
  });
  const face = plane(w, h, lightbox(tex, intensity), {
    x,
    y,
    z: z + 0.006,
    ry,
    parent,
  });
  face.userData.noOutline = true;
  return { shell, face };
}

/** 侧挂竖招牌（双面） */
function verticalSign(parent, { x, y, z, w, h, tex, ry = 0, intensity = 1.5, color = '#2a2026' }) {
  const g = group('v-sign');
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(w + 0.07, h + 0.07, 0.09, toon(color, { rim: 0.2, rimColor: '#ffcf94' }), { parent: g, cast: true });
  const mat = lightbox(tex, intensity);
  plane(w, h, mat, { z: 0.052, parent: g });
  plane(w, h, mat, { z: -0.052, ry: Math.PI, parent: g });
  // 支架
  box(0.05, 0.05, 0.26, toon(PAL.metalDark, { rim: 0.2 }), { y: h * 0.28, z: -0.16, parent: g, cast: false });
  box(0.05, 0.05, 0.26, toon(PAL.metalDark, { rim: 0.2 }), { y: -h * 0.28, z: -0.16, parent: g, cast: false });
  return g;
}

/** 日式暖帘 */
function noren(parent, { w, h, x, y, z, color = '#25344a', text = '', textColor = '#f2ead8' }) {
  const mat = toon(color, { rim: 0.12, rimColor: '#9fb8d8', gradient: 'soft', side: THREE.DoubleSide });
  const g = group('noren');
  g.position.set(x, y, z);
  parent.add(g);
  // 三片垂布
  const count = 3;
  const gap = 0.015;
  const panelW = (w - gap * (count - 1)) / count;
  for (let i = 0; i < count; i += 1) {
    const px = -w / 2 + panelW / 2 + i * (panelW + gap);
    const cloth = plane(panelW, h, mat, { x: px, z: 0.01, parent: g });
    cloth.userData.noOutline = true;
  }
  // 顶部横杆
  cyl(0.016, 0.016, w + 0.1, 8, toon(PAL.woodDark, { rim: 0.2 }), {
    x: 0,
    y: h / 2 + 0.01,
    rx: 0,
    rz: Math.PI / 2,
    parent: g,
    cast: false,
    receive: false,
  });
  if (text) {
    const tex = signTexture(512, 160, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      textOf(ctx, text, width / 2, height / 2, `700 96px ${JP_FONT}`, textColor);
    });
    const label = plane(w * 0.72, w * 0.72 * 0.31, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), {
      x: 0,
      y: 0,
      z: 0.026,
      parent: g,
    });
    label.userData.noOutline = true;
  }
  return g;
}

/** 红灯笼 / 白灯笼 */
function chochin(parent, { x, y, z, r = 0.16, color = '#ff6f5c', text = '', glowSize = 1.1 }) {
  const g = group('chochin');
  g.position.set(x, y, z);
  parent.add(g);
  const body = cyl(r, r, r * 1.5, 14, toon(color, {
    rim: 0.3,
    rimColor: '#ffe0a0',
    emissive: color,
    emissiveIntensity: 0.55,
    gradient: 'soft',
  }), { y: 0, parent: g, cast: true });
  body.userData.noOutline = true;
  // 上下黑边
  cyl(r * 0.62, r * 0.62, 0.04, 12, toon('#1b1715', { rim: 0.2 }), { y: r * 0.78, parent: g, cast: false });
  cyl(r * 0.62, r * 0.62, 0.04, 12, toon('#1b1715', { rim: 0.2 }), { y: -r * 0.78, parent: g, cast: false });
  // 挂绳
  cyl(0.008, 0.008, 0.24, 4, toon('#1b1715', { rim: 0 }), { y: r * 0.95 + 0.12, parent: g, cast: false, receive: false });
  if (text) {
    const tex = signTexture(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      textOf(ctx, text, w / 2, h / 2, `700 120px ${JP_FONT}`, '#2b1512');
    });
    plane(r * 1.3, r * 1.3, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), {
      y: 0,
      z: r + 0.005,
      parent: g,
    });
    plane(r * 1.3, r * 1.3, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), {
      y: 0,
      z: -r - 0.005,
      ry: Math.PI,
      parent: g,
    });
  }
  const sprite = glowSprite(color, glowSize, 0.4);
  sprite.position.set(0, 0, 0.02);
  g.add(sprite);
  return g;
}

/** 一串小灯泡 / 提灯线 */
function lanternString(parent, { x0, x1, y, z, count = 8, color = '#ffcf94', sag = 0.18 }) {
  const pts = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    pts.push([x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z]);
  }
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = new THREE.Vector3(...pts[i]);
    const b = new THREE.Vector3(...pts[i + 1]);
    tube(catenary(a, b, 0.015), 0.006, toon('#1e1b19', { rim: 0 }), { parent, segments: 6 });
  }
  for (let i = 1; i < pts.length - 1; i += 1) {
    sphere(0.035, glow(color, 1.6), { x: pts[i][0], y: pts[i][1] - 0.045, z: pts[i][2], parent });
  }
}

/** 窗（框 + 发光玻璃 + 可选窗棂） */
function windowUnit(parent, { x, y, z, w, h, lit = 0.8, color = PAL.warm, frame = PAL.metalDark, ry = 0, bars = 1, white = false }) {
  const g = group('window');
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(w + 0.07, h + 0.07, 0.06, toon(frame, { rim: 0.16, rimColor: '#9fb8d8' }), { parent: g, cast: false, receive: true });
  const glassMat = flat(white ? '#e8f2ff' : color, { fog: false });
  glassMat.color.multiplyScalar(lit);
  plane(w, h, glassMat, { z: 0.036, parent: g });
  glassMat.toneMapped = false;
  // 窗棂
  if (bars) {
    for (let i = 1; i <= bars; i += 1) {
      box(0.025, h, 0.02, toon(frame, { rim: 0.1 }), { x: -w / 2 + (w / (bars + 1)) * i, z: 0.045, parent: g, cast: false });
    }
  }
  return g;
}

/** 空调外机 */
function acUnit(parent, { x, y, z, ry = 0 }) {
  const g = group('ac');
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(0.5, 0.34, 0.24, toon('#d8d6cd', { rim: 0.16, rimColor: '#9fb8d8' }), { parent: g, cast: true });
  cyl(0.12, 0.12, 0.03, 12, toon('#8a8f96', { rim: 0.2 }), { x: 0.1, z: 0.13, rx: Math.PI / 2, parent: g, cast: false });
  box(0.46, 0.05, 0.02, toon('#5d636b', { rim: 0.1 }), { y: -0.15, z: 0.13, parent: g, cast: false });
  return g;
}

function roofProps(parent, info) {
  const x = (info.x0 + info.x1) / 2;
  const z = (FRONT_Z + BACK_Z) / 2 + 0.6;
  // 水箱
  if (info.style !== 'kissaten' && info.style !== 'books') {
    const tank = box(0.8, 0.55, 0.8, toon('#b9c0c8', { rim: 0.2, rimColor: '#e4f0ff', gradient: 'soft' }), {
      x: x + 0.7,
      y: info.h + 0.4,
      z: z - 1.2,
      parent,
      cast: true,
    });
    tank.userData.noOutline = false;
    cyl(0.04, 0.04, 1.2, 6, toon('#6b7178', { rim: 0.1 }), { x: x + 0.7, y: info.h + 0.05, z: z - 1.2, parent, cast: false });
  }
  // 空调 + 天线
  acUnit(parent, { x: info.x1 - 0.7, y: info.h + 0.32, z: z + 0.4 });
  cyl(0.02, 0.02, 1.0, 4, toon('#8a9199', { rim: 0.1 }), { x: info.x0 + 0.5, y: info.h + 0.62, z: z + 0.6, parent, cast: false });
}

function storefrontGlass(parent, { x0, x1, y0, y1, z }) {
  const w = x1 - x0;
  const h = y1 - y0;
  const glassMat = toon('#b9e4e3', {
    transparent: true,
    opacity: 0.16,
    rim: 0.26,
    rimColor: '#cfefff',
    gradient: 'soft',
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glass = plane(w, h, glassMat, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, parent, renderOrder: 2 });
  glass.userData.noOutline = true;
  // 竖向门框
  for (let i = 0; i <= 3; i += 1) {
    const x = x0 + (w / 3) * i;
    box(0.045, h, 0.06, toon('#d8d4c8', { rim: 0.18, rimColor: '#e8f2ff' }), { x, y: (y0 + y1) / 2, z: z + 0.015, parent, cast: false });
  }
  box(w, 0.06, 0.07, toon('#d8d4c8', { rim: 0.18 }), { x: (x0 + x1) / 2, y: y1, z: z + 0.015, parent, cast: false });
  box(w, 0.06, 0.07, toon('#d8d4c8', { rim: 0.18 }), { x: (x0 + x1) / 2, y: y0, z: z + 0.015, parent, cast: false });
  return glass;
}

/** 浅店内：地面 / 后墙 / 灯带 / 货架，足够透过玻璃看出内容 */
function shallowInterior(parent, info, { wallColor = '#d8cdb8', shelfColor = '#efe6d4', lightColor = PAL.warm } = {}) {
  const x0 = info.x0 + 0.12;
  const x1 = info.x1 - 0.12;
  const w = x1 - x0;
  const z0 = -0.34;
  const z1 = FRONT_Z - 0.06;
  const g = group('interior-front');
  parent.add(g);
  // 地台
  box(w, 0.04, z1 - z0, toon('#6d5d4c', { rim: 0.1, rimColor: '#b8a080', gradient: 'soft' }), {
    x: (x0 + x1) / 2,
    y: ROOF_Y + 0.03,
    z: (z0 + z1) / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  // 后墙
  plane(w, 2.5, toon(wallColor, { rim: 0.12, rimColor: '#e8c890', gradient: 'soft' }), {
    x: (x0 + x1) / 2,
    y: ROOF_Y + 1.32,
    z: z0,
    ry: 0,
    parent: g,
  });
  // 侧墙
  for (const sx of [x0, x1]) {
    plane(z1 - z0, 2.5, toon(wallColor, { rim: 0.12 }), {
      x: sx,
      y: ROOF_Y + 1.32,
      z: (z0 + z1) / 2,
      ry: Math.PI / 2,
      parent: g,
    });
  }
  // 顶
  plane(w, z1 - z0, toon('#4a3d30', { rim: 0.12 }), {
    x: (x0 + x1) / 2,
    y: ROOF_Y + 2.55,
    z: (z0 + z1) / 2,
    rx: Math.PI / 2,
    parent: g,
  });
  // 暖光灯带
  for (let i = 0; i < 2; i += 1) {
    const lx = x0 + w * (0.32 + i * 0.36);
    const strip = plane(w * 0.24, 0.1, flat(lightColor).clone(), {
      x: lx,
      y: ROOF_Y + 2.5,
      z: z1 - 0.45,
      rx: Math.PI / 2,
      parent: g,
    });
    strip.material.color.multiplyScalar(2.2);
    strip.material.toneMapped = false;
    strip.userData.noOutline = true;
    const sp = glowSprite(lightColor, 1.4, 0.35);
    sp.position.set(lx, ROOF_Y + 2.4, z1 - 0.5);
    g.add(sp);
  }
  // 靠墙货架 / 柜台剪影
  const shelfCount = 3;
  for (let i = 0; i < shelfCount; i += 1) {
    const sw = w * 0.18;
    box(sw, 1.1, 0.22, toon(shelfColor, { rim: 0.1, rimColor: '#ffd9a0' }), {
      x: x0 + w * (0.16 + i * 0.22),
      y: ROOF_Y + 0.62,
      z: z0 + 0.16,
      parent: g,
      cast: false,
    });
    // 彩色商品
    const rand = rng(100 + i + Math.round(x0 * 10));
    for (let k = 0; k < 6; k += 1) {
      const col = ['#ef7d6a', '#7ec8b8', '#e8c05e', '#7fa8d8', '#c98fb8'][k % 5];
      box(sw * 0.12, 0.12, 0.04, flat(col, { fog: true }), {
        x: x0 + w * (0.16 + i * 0.22) - sw * 0.4 + k * sw * 0.14 + rand() * 0.01,
        y: ROOF_Y + 0.35 + (k % 3) * 0.28,
        z: z0 + 0.28,
        parent: g,
        cast: false,
      });
    }
  }
  // 柜台
  box(w * 0.56, 0.82, 0.36, toon('#7b5b3e', { rim: 0.16, rimColor: '#ffd9a0', gradient: 'soft' }), {
    x: (x0 + x1) / 2 + w * 0.08,
    y: ROOF_Y + 0.45,
    z: z0 + 0.72,
    parent: g,
    cast: true,
  });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  近侧店铺                                                                   */
/* -------------------------------------------------------------------------- */

function shopCommon(info, ctx) {
  const g = group(`shop-${info.id}`);
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const depth = FRONT_Z - BACK_Z;
  const bodyDepth = FRONT_Z - 0.34 - BACK_Z;
  const bodyZ = (FRONT_Z - 0.34 + BACK_Z) / 2;
  const wallColor = info.wall || PAL.wallCream;

  // 主体（负 Z 方向后退 0.34，给门面玻璃留出浅进深）
  box(w, info.h, bodyDepth, toon(wallColor, { rim: 0.14, rimColor: '#a8c4e4', gradient: 'soft' }), {
    x,
    y: ROOF_Y + info.h / 2,
    z: bodyZ,
    parent: g,
    cast: true,
    receive: true,
  });
  // 山墙压顶 / 屋檐线
  box(w + 0.16, 0.12, depth + 0.16, toon(PAL.tileAlt, { rim: 0.18, rimColor: '#8fa8c8', gradient: 'soft' }), {
    x,
    y: ROOF_Y + info.h + 0.06,
    z: (FRONT_Z + BACK_Z) / 2,
    parent: g,
    cast: true,
  });
  // 底层侧墙（玻璃两侧包边）
  for (const sx of [info.x0 + 0.05, info.x1 - 0.05]) {
    box(0.12, 2.75, 1.2, toon(wallColor, { rim: 0.14 }), {
      x: sx,
      y: ROOF_Y + 1.38,
      z: FRONT_Z - 0.56,
      parent: g,
      cast: true,
    });
  }
  // 门头横梁 + 招牌位
  box(w, 0.9, 0.14, toon(info.fasciaColor || '#33383f', { rim: 0.18, rimColor: '#ffcf94', gradient: 'soft' }), {
    x,
    y: ROOF_Y + 3.1,
    z: FRONT_Z - 0.07,
    parent: g,
    cast: true,
  });
  // 上沿小挑檐
  box(w + 0.12, 0.08, 1.25, toon(PAL.tileAlt, { rim: 0.16, rimColor: '#8fa8c8' }), {
    x,
    y: ROOF_Y + 3.54,
    z: FRONT_Z - 0.52,
    parent: g,
    cast: true,
  });
  // 雨棚（部分店铺有）
  if (info.awning !== false) {
    const aw = box(w - 0.25, 0.05, 1.05, toon(info.awningColor || '#3f5a5a', { rim: 0.16, rimColor: '#9fd8c8', gradient: 'soft' }), {
      x,
      y: ROOF_Y + 2.72,
      z: FRONT_Z + 0.5,
      parent: g,
      cast: true,
    });
    aw.rotation.x = -0.12;
    // 支撑杆
    for (const sx of [info.x0 + 0.35, info.x1 - 0.35]) {
      cyl(0.012, 0.012, 0.7, 4, toon('#2a2d33', { rim: 0.1 }), {
        x: sx,
        y: ROOF_Y + 2.55,
        z: FRONT_Z + 0.82,
        rz: 0.05,
        parent: g,
        cast: false,
      });
    }
  }

  shallowInterior(g, info, {
    wallColor: info.interiorWall || '#d8cdb8',
    lightColor: info.interiorLight || PAL.warm,
  });
  storefrontGlass(g, { x0: info.x0 + 0.2, x1: info.x1 - 0.2, y0: ROOF_Y + 0.14, y1: ROOF_Y + 2.62, z: FRONT_Z - 0.015 });

  // 店前踏板
  box(w - 0.3, 0.08, 0.42, toon('#5b5750', { rim: 0.12, rimColor: '#8fa8c8', gradient: 'soft' }), {
    x,
    y: ROOF_Y + 0.04,
    z: FRONT_Z + 0.28,
    parent: g,
    cast: false,
    receive: true,
  });

  // 楼上窗 / 阳台 / 空调
  const upperY = ROOF_Y + 3.62;
  const upperH = info.h - 3.62;
  if (upperH > 0.8) {
    const floors = info.floors || 2;
    const floorH = upperH / Math.max(1, floors - 1);
    for (let f = 0; f < Math.max(1, floors - 1); f += 1) {
      const wy = upperY + f * floorH + Math.min(0.85, floorH * 0.45);
      const count = Math.max(1, Math.round(w / 1.15));
      const gap = w / count;
      for (let i = 0; i < count; i += 1) {
        const lit = 0.42 + ((i * 7 + f * 3 + Math.round(x)) % 10) / 14;
        windowUnit(g, {
          x: info.x0 + gap * (i + 0.5),
          y: wy,
          z: FRONT_Z + 0.005,
          w: Math.min(0.8, gap * 0.55),
          h: Math.min(1.05, floorH * 0.5),
          lit,
          color: info.windowColor || PAL.warm,
          bars: 1,
        });
      }
      // 楼层分隔线
      if (f > 0) {
        box(w, 0.05, 0.08, toon(info.trimColor || '#8c8579', { rim: 0.1 }), {
          x,
          y: upperY + f * floorH - 0.22,
          z: FRONT_Z + 0.01,
          parent: g,
          cast: false,
        });
      }
    }
    // 阳台（公寓 / 楼上住宅）
    if (info.balcony) {
      const balH = Math.min(1.4, upperH * 0.55);
      const by = upperY + balH;
      box(w * 0.82, 0.08, 0.42, toon('#5a5f66', { rim: 0.16, rimColor: '#9fb8d8' }), {
        x,
        y: by,
        z: FRONT_Z + 0.2,
        parent: g,
        cast: false,
      });
      // 栏杆
      for (let i = 0; i <= 8; i += 1) {
        const rx = x - (w * 0.8) / 2 + ((w * 0.8) / 8) * i;
        cyl(0.015, 0.015, 0.85, 4, toon('#6b7178', { rim: 0.1 }), { x: rx, y: by + 0.44, z: FRONT_Z + 0.4, parent: g, cast: false });
      }
      box(w * 0.8, 0.04, 0.04, toon('#6b7178', { rim: 0.1 }), { x, y: by + 0.86, z: FRONT_Z + 0.4, parent: g, cast: false });
    }
  }

  roofProps(g, info);
  addOutline(g, { width: 0.00085, color: '#080b14' });
  return g;
}

function buildRamen(info) {
  const g = shopCommon({ ...info, wall: '#cbb99c', fasciaColor: '#7a2f26', awningColor: '#9e3c32', interiorWall: '#d8c0a0' });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  // 门头招牌
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    const grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, '#2a1512');
    grd.addColorStop(1, '#150b0a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,209,160,0.45)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, 'ラーメン', width / 2, height * 0.4, `700 96px ${JP_FONT}`, '#ffd9a0');
    textOf(ctx, '麺屋 灯  ·  MENYA AKARI', width / 2, height * 0.78, `500 34px ${EN_FONT}`, '#e8c090');
  });
  signBox(g, { w: w - 0.4, h: 0.66, x, y: ROOF_Y + 3.1, z: FRONT_Z + 0.02, tex, intensity: 1.45 });
  verticalSign(g, {
    x: info.x1 - 0.22,
    y: ROOF_Y + 3.05,
    z: FRONT_Z + 0.34,
    w: 0.5,
    h: 1.7,
    tex: signTexture(256, 768, (ctx, width, height) => {
      ctx.fillStyle = '#7a2f26';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, width - 12, height - 12);
      textOf(ctx, 'ラ', width / 2, height * 0.22, `700 150px ${JP_FONT}`, '#ffe4b0');
      textOf(ctx, 'ー', width / 2, height * 0.44, `700 150px ${JP_FONT}`, '#ffe4b0');
      textOf(ctx, 'メ', width / 2, height * 0.66, `700 150px ${JP_FONT}`, '#ffe4b0');
      textOf(ctx, 'ン', width / 2, height * 0.88, `700 150px ${JP_FONT}`, '#ffe4b0');
    }),
    intensity: 1.7,
  });
  // 红灯笼
  for (const [lx, lz] of [
    [info.x0 + 0.35, FRONT_Z + 0.5],
    [info.x1 - 0.35, FRONT_Z + 0.5],
  ]) {
    chochin(g, { x: lx, y: ROOF_Y + 2.42, z: lz, r: 0.17, color: '#d24a38', text: '灯', glowSize: 1.3 });
  }
  lanternString(g, { x0: info.x0 + 0.5, x1: info.x1 - 0.5, y: ROOF_Y + 2.7, z: FRONT_Z + 0.55, count: 5, color: '#ffb35e' });
  // 暖帘
  noren(g, { w: w * 0.72, h: 0.48, x, y: ROOF_Y + 2.36, z: FRONT_Z + 0.06, color: '#7a2f26', text: '麺屋 灯', textColor: '#ffe0b0' });
  // 菜单立牌
  const menu = box(0.4, 0.62, 0.06, toon('#2a1c18', { rim: 0.2, rimColor: '#ffd9a0' }), {
    x: info.x0 + 0.5,
    y: ROOF_Y + 0.36,
    z: FRONT_Z + 0.62,
    parent: g,
    cast: true,
  });
  menu.rotation.y = 0.18;
  plane(0.32, 0.5, lightbox(signTexture(256, 384, (ctx, width, height) => {
    ctx.fillStyle = '#f2e3c4';
    ctx.fillRect(0, 0, width, height);
    textOf(ctx, 'おすすめ', width / 2, 42, `700 36px ${JP_FONT}`, '#8c2f22');
    textOf(ctx, '醤油', width / 2, 130, `700 58px ${JP_FONT}`, '#2b1d18');
    textOf(ctx, 'らーめん', width / 2, 200, `600 40px ${JP_FONT}`, '#2b1d18');
    textOf(ctx, '¥880', width / 2, 300, `700 62px ${EN_FONT}`, '#8c2f22');
  }), 1.05), {
    x: info.x0 + 0.5,
    y: ROOF_Y + 0.36,
    z: FRONT_Z + 0.655,
    ry: 0.18,
    parent: g,
  });
  ctxSteam(g, { x: info.x0 + 1.0, y: ROOF_Y + 2.0, z: FRONT_Z + 0.9, kind: 'ramen' });
  return g;
}

function buildIzakaya(info) {
  const g = shopCommon({ ...info, wall: '#6b4a36', fasciaColor: '#2a1a14', awningColor: '#5a2f26', interiorWall: '#8a6040', interiorLight: '#ffb45e' });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    const grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, '#1d1712');
    grd.addColorStop(1, '#120d0a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,200,140,0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, '居酒屋  とり吉', width / 2, height * 0.42, `700 82px ${JP_FONT}`, '#ffcf94');
    textOf(ctx, 'IZAKAYA  TORIYOSHI', width / 2, height * 0.78, `500 30px ${EN_FONT}`, '#e8b880');
  });
  signBox(g, { w: w - 0.4, h: 0.62, x, y: ROOF_Y + 3.1, z: FRONT_Z + 0.02, tex, intensity: 1.4 });
  // 木格栅
  const lattice = group('lattice');
  lattice.position.set(x, ROOF_Y + 2.15, FRONT_Z + 0.02);
  g.add(lattice);
  for (let i = 0; i <= 10; i += 1) {
    box(0.035, 1.1, 0.05, toon(PAL.wood, { rim: 0.16, rimColor: '#ffcf94' }), {
      x: -w / 2 + 0.3 + (w - 0.6) * (i / 10),
      parent: lattice,
      cast: false,
    });
  }
  for (let i = 0; i <= 2; i += 1) {
    box(w - 0.55, 0.035, 0.06, toon(PAL.wood, { rim: 0.16 }), { y: -0.5 + i * 0.5, parent: lattice, cast: false });
  }
  // 红灯笼串
  for (let i = 0; i < 3; i += 1) {
    chochin(g, { x: info.x0 + 0.6 + i * 0.85, y: ROOF_Y + 2.5, z: FRONT_Z + 0.62, r: 0.16, color: '#d24a38', text: '酒', glowSize: 1.2 });
  }
  lanternString(g, { x0: info.x0 + 0.35, x1: info.x1 - 0.35, y: ROOF_Y + 2.86, z: FRONT_Z + 0.55, count: 8, color: '#ffb35e' });
  noren(g, { w: w * 0.6, h: 0.5, x, y: ROOF_Y + 2.32, z: FRONT_Z + 0.05, color: '#24262b', text: 'とり吉', textColor: '#f2e3c4' });
  // 门口酒桶
  for (let i = 0; i < 2; i += 1) {
    cyl(0.18, 0.2, 0.45, 12, toon('#d8c8a8', { rim: 0.16, rimColor: '#ffe0b0' }), {
      x: info.x0 + 0.4 + i * 0.5,
      y: ROOF_Y + 0.34,
      z: FRONT_Z + 0.7,
      parent: g,
      cast: true,
    });
  }
  ctxSteam(g, { x: x + 0.6, y: ROOF_Y + 2.0, z: FRONT_Z + 0.8, kind: 'yakitori' });
  return g;
}

function buildPachinko(info) {
  const g = shopCommon({
    ...info,
    wall: '#4b4a58',
    fasciaColor: '#1d1a24',
    awning: false,
    interiorWall: '#221c2a',
    interiorLight: '#ff6f9c',
    windowColor: '#7fe8e0',
    trimColor: '#6b5f78',
  });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  // 大灯箱
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, '#2a0f2a');
    grd.addColorStop(0.5, '#4a0f3a');
    grd.addColorStop(1, '#1a0a24');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 18; i += 1) {
      ctx.fillStyle = i % 2 ? 'rgba(255,111,156,0.5)' : 'rgba(127,232,224,0.5)';
      ctx.fillRect(12 + i * 56, 8, 30, 10);
    }
    textOf(ctx, 'パチンコ 月見', width / 2, height * 0.44, `700 86px ${JP_FONT}`, '#ffd9f0');
    textOf(ctx, 'PACHINKO  TSUKIMI  ·  新台入替', width / 2, height * 0.8, `600 30px ${EN_FONT}`, '#9ff0e8');
  });
  signBox(g, { w: w - 0.3, h: 0.78, x, y: ROOF_Y + 3.08, z: FRONT_Z + 0.02, tex, intensity: 1.7 });
  // 竖招牌 + 霓虹管
  verticalSign(g, {
    x: info.x1 - 0.28,
    y: ROOF_Y + 4.1,
    z: FRONT_Z + 0.36,
    w: 0.55,
    h: 2.4,
    tex: signTexture(256, 1024, (ctx, width, height) => {
      ctx.fillStyle = '#1a0a1c';
      ctx.fillRect(0, 0, width, height);
      const chars = ['パ', 'チ', 'ン', 'コ'];
      chars.forEach((ch, i) => textOf(ctx, ch, width / 2, 130 + i * 220, `700 150px ${JP_FONT}`, i % 2 ? '#7fe8e0' : '#ff9fce'));
    }),
    intensity: 2.0,
  });
  // 门面霓虹横条
  for (const [yy, color] of [
    [ROOF_Y + 2.62, '#ff6f9c'],
    [ROOF_Y + 2.72, '#7fe8e0'],
  ]) {
    const tubeMesh = box(w - 0.5, 0.035, 0.04, glow(color, 1.8), { x, y: yy, z: FRONT_Z + 0.08, parent: g, cast: false });
    tubeMesh.userData.noOutline = true;
  }
  // 门口霓虹灯牌
  const neon = box(0.12, 1.9, 0.12, glow('#ff6f9c', 1.6), {
    x: info.x0 + 0.25,
    y: ROOF_Y + 1.7,
    z: FRONT_Z + 0.22,
    parent: g,
    cast: false,
  });
  neon.userData.noOutline = true;
  // 店内一排排机器
  const rand = rng(51);
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 6; i += 1) {
      const machine = box(0.34, 0.8, 0.22, flat(row ? '#5a2a4a' : '#243a4a', { fog: true }), {
        x: info.x0 + 0.45 + i * 0.36,
        y: ROOF_Y + 0.58,
        z: FRONT_Z - 0.72 + row * 0.36,
        parent: g,
        cast: false,
      });
      machine.userData.noOutline = true;
      const screen = plane(0.16, 0.24, flat(row ? '#ff9fce' : '#8ff0e8').clone(), {
        x: info.x0 + 0.45 + i * 0.36,
        y: ROOF_Y + 0.7,
        z: FRONT_Z - 0.605 + row * 0.36,
        parent: g,
      });
      screen.material.color.multiplyScalar(1.6);
      screen.material.toneMapped = false;
      screen.userData.noOutline = true;
      if (rand() > 0.6) {
        const sp = glowSprite(row ? '#ff6f9c' : '#7fe8e0', 0.8, 0.25);
        sp.position.set(info.x0 + 0.45 + i * 0.36, ROOF_Y + 0.7, FRONT_Z - 0.58 + row * 0.36);
        g.add(sp);
      }
    }
  }
  return g;
}

function buildKissaten(info) {
  const g = shopCommon({
    ...info,
    wall: '#d8cfb8',
    fasciaColor: '#355a4a',
    awningColor: '#3d6a56',
    interiorWall: '#e0d4bc',
    interiorLight: '#ffcf94',
    windowColor: '#ffd9a0',
    trimColor: '#8c8579',
  });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#f2e8d2';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#355a4a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, '喫茶  純', width / 2, height * 0.42, `700 96px ${JP_FONT}`, '#2b4a3c');
    textOf(ctx, 'JUN  KISSATEN  ·  SINCE 1972', width / 2, height * 0.78, `500 28px ${EN_FONT}`, '#5a6a58');
    // 小咖啡杯图形
    ctx.strokeStyle = '#8c5a3c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(width - 80, height / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width - 44, height / 2, 14, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  });
  signBox(g, { w: w - 0.45, h: 0.64, x, y: ROOF_Y + 3.08, z: FRONT_Z + 0.02, tex, intensity: 1.25 });
  // 条纹雨棚
  for (let i = 0; i < 6; i += 1) {
    const aw = box((w - 0.3) / 6 - 0.02, 0.05, 1.0, toon(i % 2 ? '#e8ddc4' : '#3d6a56', { rim: 0.1 }), {
      x: info.x0 + 0.15 + (w - 0.3) / 6 * (i + 0.5),
      y: ROOF_Y + 2.72,
      z: FRONT_Z + 0.48,
      parent: g,
      cast: false,
    });
    aw.rotation.x = -0.12;
  }
  // 圆窗招牌
  const round = signTexture(256, 256, (ctx, width, height) => {
    ctx.fillStyle = '#f2e8d2';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#355a4a';
    ctx.lineWidth = 10;
    ctx.stroke();
    textOf(ctx, '珈琲', width / 2, height * 0.42, `700 76px ${JP_FONT}`, '#2b4a3c');
    textOf(ctx, '純', width / 2, height * 0.68, `600 54px ${JP_FONT}`, '#8c5a3c');
  });
  const roundSign = plane(1.0, 1.0, lightbox(round, 1.3), {
    x: info.x1 - 0.55,
    y: ROOF_Y + 2.15,
    z: FRONT_Z + 0.08,
    parent: g,
  });
  roundSign.userData.noOutline = true;
  // 门口绿植
  for (let i = 0; i < 2; i += 1) {
    cyl(0.16, 0.12, 0.3, 8, toon('#8c5a3c', { rim: 0.16 }), {
      x: info.x0 + 0.4 + i * 0.5,
      y: ROOF_Y + 0.27,
      z: FRONT_Z + 0.62,
      parent: g,
      cast: true,
    });
    sphere(0.24, toon('#4a6b3c', { rim: 0.2, rimColor: '#9fd8a0', gradient: 'soft' }), {
      x: info.x0 + 0.4 + i * 0.5,
      y: ROOF_Y + 0.62,
      z: FRONT_Z + 0.62,
      parent: g,
      cast: true,
    });
  }
  return g;
}

function buildLaundry(info) {
  const g = shopCommon({
    ...info,
    wall: '#c8d4d8',
    fasciaColor: '#274b5a',
    awning: false,
    interiorWall: '#bfdbe4',
    interiorLight: '#c8f4ff',
    windowColor: '#d8fbff',
    trimColor: '#7f9aa8',
  });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#e8f6fa';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#274b5a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, 'コインランドリー', width / 2, height * 0.42, `700 82px ${JP_FONT}`, '#1e4a5a');
    textOf(ctx, 'COIN LAUNDRY  ·  24H', width / 2, height * 0.78, `600 30px ${EN_FONT}`, '#3a6a7a');
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = i % 2 ? '#7fe8e0' : '#9fd8ff';
      ctx.fillRect(40 + i * 74, 12, 30, 8);
    }
  });
  signBox(g, { w: w - 0.35, h: 0.62, x, y: ROOF_Y + 3.08, z: FRONT_Z + 0.02, tex, intensity: 1.5 });
  // 洗衣机排
  for (let i = 0; i < 4; i += 1) {
    const wx = info.x0 + 0.4 + i * 0.72;
    box(0.64, 0.82, 0.6, toon('#e8edf0', { rim: 0.14, rimColor: '#9fd8ff' }), {
      x: wx,
      y: ROOF_Y + 0.55,
      z: FRONT_Z - 0.74,
      parent: g,
      cast: true,
    });
    const door = cyl(0.22, 0.22, 0.03, 16, toon('#6f9aa8', { rim: 0.2, rimColor: '#d8fbff' }), {
      x: wx,
      y: ROOF_Y + 0.58,
      z: FRONT_Z - 0.43,
      rx: Math.PI / 2,
      parent: g,
      cast: false,
    });
    door.userData.noOutline = true;
    const win = plane(0.3, 0.3, flat('#bfefff').clone(), {
      x: wx,
      y: ROOF_Y + 0.58,
      z: FRONT_Z - 0.41,
      parent: g,
    });
    win.material.color.multiplyScalar(1.4);
    win.material.toneMapped = false;
    win.userData.noOutline = true;
  }
  // 荧光灯条
  for (let i = 0; i < 3; i += 1) {
    const bar = box(w - 0.6, 0.05, 0.1, glow('#d8fbff', 1.6), {
      x,
      y: ROOF_Y + 2.5,
      z: FRONT_Z - 0.5 + i * 0.16,
      parent: g,
      cast: false,
    });
    bar.userData.noOutline = true;
  }
  // 等待长椅
  box(w * 0.5, 0.1, 0.32, toon('#8c8a7c', { rim: 0.16 }), { x, y: ROOF_Y + 0.22, z: FRONT_Z + 0.7, parent: g, cast: true });
  return g;
}

function buildSento(info) {
  const g = shopCommon({
    ...info,
    wall: '#c8d2dc',
    fasciaColor: '#1f3e5a',
    awning: false,
    interiorWall: '#c8d8e8',
    interiorLight: '#c8e8ff',
    windowColor: '#c8e8ff',
    trimColor: '#7f96b0',
  });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  // 招牌
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#e8eef8';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1f3e5a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, '銭湯  松の湯', width / 2, height * 0.42, `700 92px ${JP_FONT}`, '#1f3e5a');
    textOf(ctx, 'MATSUYU  SENTO  ·  since 1958', width / 2, height * 0.78, `500 28px ${EN_FONT}`, '#5a7a96');
    // 波浪
    ctx.strokeStyle = '#7fb8d8';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) {
        const px = 30 + k * 120;
        const py = 178 + i * 10 + Math.sin(k * 1.4) * 5;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  });
  signBox(g, { w: w - 0.4, h: 0.66, x, y: ROOF_Y + 3.1, z: FRONT_Z + 0.02, tex, intensity: 1.4 });
  // 蓝色暖帘
  noren(g, { w: w * 0.58, h: 0.62, x, y: ROOF_Y + 2.3, z: FRONT_Z + 0.05, color: '#2b4a6a', text: 'ゆ', textColor: '#e8f4ff' });
  // 红色「ゆ」灯箱
  const yuTex = signTexture(256, 320, (ctx, width, height) => {
    ctx.fillStyle = '#f2f6ff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#c8433a';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 92, 0, Math.PI * 2);
    ctx.fill();
    textOf(ctx, 'ゆ', width / 2, height / 2, `700 120px ${JP_FONT}`, '#fff4dc');
  });
  verticalSign(g, { x: info.x1 - 0.25, y: ROOF_Y + 2.4, z: FRONT_Z + 0.36, w: 0.5, h: 0.68, tex: yuTex, intensity: 1.8 });
  // 入口木格门 + 台子
  box(w * 0.5, 2.2, 0.08, toon('#3a2a20', { rim: 0.16, rimColor: '#ffcf94' }), {
    x,
    y: ROOF_Y + 1.25,
    z: FRONT_Z - 0.02,
    parent: g,
    cast: true,
  });
  // 烟囱
  const chimney = cyl(0.3, 0.34, 3.2, 12, toon('#8a8f96', { rim: 0.18, rimColor: '#c8d8e8', gradient: 'soft' }), {
    x: info.x0 + 0.7,
    y: ROOF_Y + info.h - 0.6,
    z: BACK_Z + 1.4,
    parent: g,
    cast: true,
  });
  chimney.userData.noOutline = false;
  cyl(0.34, 0.34, 0.12, 12, toon('#5d636b', { rim: 0.2 }), {
    x: info.x0 + 0.7,
    y: ROOF_Y + info.h + 1.06,
    z: BACK_Z + 1.4,
    parent: g,
    cast: false,
  });
  ctxSteam(g, { x: info.x0 + 0.7, y: ROOF_Y + info.h + 1.2, z: BACK_Z + 1.4, kind: 'sento' });
  // 门口长凳 + 桶
  box(w * 0.38, 0.12, 0.34, toon('#7f6a50', { rim: 0.16, rimColor: '#ffd9a0' }), {
    x: info.x0 + 0.55,
    y: ROOF_Y + 0.32,
    z: FRONT_Z + 0.62,
    parent: g,
    cast: true,
  });
  for (const sx of [info.x0 + 0.35, info.x0 + 0.75]) {
    cyl(0.16, 0.14, 0.26, 10, toon('#d8c8a8', { rim: 0.16 }), {
      x: sx,
      y: ROOF_Y + 0.28,
      z: FRONT_Z + 0.62,
      parent: g,
      cast: true,
    });
  }
  return g;
}

function buildBooks(info) {
  const g = shopCommon({
    ...info,
    wall: '#8a6a4c',
    fasciaColor: '#3a2a1e',
    awningColor: '#6a4a30',
    interiorWall: '#a8845c',
    interiorLight: '#ffcf94',
    windowColor: '#ffcf94',
    trimColor: '#6b5238',
  });
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const tex = signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#f0e2c8';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, '古書  かもめ', width / 2, height * 0.42, `700 88px ${JP_FONT}`, '#3a2a1e');
    textOf(ctx, 'KAMOME  BOOKS  ·  古本 / 買取', width / 2, height * 0.78, `500 28px ${EN_FONT}`, '#6b5238');
    // 书堆
    ctx.fillStyle = '#8c3a2a';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(60 + i * 24, height - 60 - i * 14, 30, 12);
  });
  signBox(g, { w: w - 0.3, h: 0.62, x, y: ROOF_Y + 3.08, z: FRONT_Z + 0.02, tex, intensity: 1.2 });
  // 窗内书堆
  const rand = rng(812);
  for (let i = 0; i < 4; i += 1) {
    const sx = info.x0 + 0.4 + i * 0.55;
    for (let k = 0; k < 3; k += 1) {
      const bw = 0.3 + rand() * 0.2;
      box(bw, 0.28, 0.22, toon(['#8c3a2a', '#3a5a4a', '#7a5a2a', '#3a4a6a'][k % 4], { rim: 0.12 }), {
        x: sx,
        y: ROOF_Y + 0.4 + k * 0.29,
        z: FRONT_Z - 0.7,
        parent: g,
        cast: false,
      });
    }
  }
  // 门口书车
  box(0.55, 0.5, 0.4, toon('#5a4a38', { rim: 0.14 }), {
    x: info.x0 + 0.55,
    y: ROOF_Y + 0.32,
    z: FRONT_Z + 0.62,
    parent: g,
    cast: true,
  });
  for (let i = 0; i < 5; i += 1) {
    box(0.42, 0.05, 0.24, toon(['#8c3a2a', '#3a5a4a', '#7a5a2a'][i % 3], { rim: 0.1 }), {
      x: info.x0 + 0.55,
      y: ROOF_Y + 0.4 + i * 0.07,
      z: FRONT_Z + 0.62,
      parent: g,
      cast: false,
    });
  }
  return g;
}

/* -------------------------------------------------------------------------- */
/*  对面浅立面                                                                 */
/* -------------------------------------------------------------------------- */

function farFacadeBase(info) {
  const g = group(`far-${info.id}`);
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const zFront = E.farPlot.minZ + 0.02;
  const depth = E.farPlot.maxZ - E.farPlot.minZ - 0.04;
  const zBody = zFront + depth / 2;
  box(w, info.h, depth, toon(info.wall || '#8a8074', { rim: 0.14, rimColor: '#a8c4e4', gradient: 'soft' }), {
    x,
    y: ROOF_Y + info.h / 2,
    z: zBody,
    parent: g,
    cast: true,
    receive: true,
  });
  box(w + 0.12, 0.1, depth + 0.12, toon(PAL.tileAlt, { rim: 0.16 }), {
    x,
    y: ROOF_Y + info.h + 0.05,
    z: zBody,
    parent: g,
    cast: true,
  });
  // 面向街道的立面（-Z 方向）
  const facadeZ = zFront - 0.005;
  // 首层门头
  if (info.style !== 'apartment' && info.style !== 'apartment2' && info.style !== 'office' && info.style !== 'coinpark') {
    box(w - 0.2, 1.9, 0.08, toon(info.baseColor || '#3a3f47', { rim: 0.16 }), {
      x,
      y: ROOF_Y + 1.1,
      z: facadeZ + 0.04,
      parent: g,
      cast: false,
    });
    // 门面暖光
    const light = plane(w - 0.5, 1.35, flat(info.storeColor || '#ffcf94').clone(), {
      x,
      y: ROOF_Y + 0.95,
      z: facadeZ - 0.005,
      ry: Math.PI,
      parent: g,
    });
    light.material.color.multiplyScalar(1.5);
    light.material.toneMapped = false;
    light.userData.noOutline = true;
  }
  // 楼上窗户
  const floors = info.floors || 2;
  const floorH = (info.h - 1.2) / Math.max(1, floors);
  for (let f = 1; f < floors; f += 1) {
    const wy = ROOF_Y + 0.6 + f * floorH;
    const count = Math.max(1, Math.round(w / 1.25));
    for (let i = 0; i < count; i += 1) {
      const lit = 0.25 + ((i * 5 + f * 7 + Math.round(x)) % 10) / 16;
      windowUnit(g, {
        x: info.x0 + (w / count) * (i + 0.5),
        y: wy,
        z: facadeZ,
        ry: Math.PI,
        w: Math.min(0.8, (w / count) * 0.5),
        h: 0.85,
        lit,
        color: info.glow || PAL.warm,
        bars: 0,
      });
    }
  }
  // 屋顶设备
  acUnit(g, { x: x - w * 0.25, y: ROOF_Y + info.h + 0.3, z: zBody, ry: Math.PI });
  cyl(0.02, 0.02, 1.0, 4, toon('#8a9199', { rim: 0.1 }), { x: x + w * 0.28, y: ROOF_Y + info.h + 0.6, z: zBody, parent: g, cast: false });
  return { g, w, x, zFront: facadeZ };
}

function farSign(g, info, { w, x, zFront }, texture, { h = 0.8, y = 2.7, intensity = 1.3 } = {}) {
  const face = plane(w - 0.35, h, lightbox(texture, intensity), {
    x,
    y,
    z: zFront - 0.08,
    ry: Math.PI,
    parent: g,
  });
  face.userData.noOutline = true;
  box(w - 0.2, h + 0.12, 0.06, toon('#20242a', { rim: 0.18 }), {
    x,
    y,
    z: zFront - 0.04,
    parent: g,
    cast: false,
  });
}

function buildFarApartment(info, variant = 1) {
  const base = farFacadeBase({ ...info, wall: variant === 1 ? '#7d848e' : '#8a7f74', floors: info.floors, h: info.h });
  const { g, w, x, zFront } = base;
  for (let f = 1; f < (info.floors || 4); f += 1) {
    const fy = ROOF_Y + 0.7 + f * ((info.h - 1.2) / (info.floors || 4));
    box(w * 0.9, 0.07, 0.34, toon('#5a5f66', { rim: 0.14 }), {
      x,
      y: fy,
      z: zFront - 0.12,
      parent: g,
      cast: false,
    });
    for (let i = 0; i <= 10; i += 1) {
      cyl(0.012, 0.012, 0.75, 4, toon('#6b7178', { rim: 0.1 }), {
        x: x - w * 0.44 + (w * 0.88 * i) / 10,
        y: fy + 0.4,
        z: zFront - 0.28,
        parent: g,
        cast: false,
      });
    }
    box(w * 0.88, 0.035, 0.035, toon('#6b7178', { rim: 0.1 }), { x, y: fy + 0.78, z: zFront - 0.28, parent: g, cast: false });
    acUnit(g, { x: x + w * 0.28, y: fy + 0.28, z: zFront - 0.2, ry: Math.PI });
  }
  // 入口 + 名字牌
  box(w * 0.36, 1.9, 0.1, toon('#3a3f47', { rim: 0.14 }), { x: x - w * 0.2, y: ROOF_Y + 0.96, z: zFront - 0.02, parent: g, cast: false });
  farSign(g, info, base, signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    textOf(ctx, info.jp, width / 2, height * 0.42, `700 82px ${JP_FONT}`, '#2a2f37');
    textOf(ctx, info.en, width / 2, height * 0.78, `600 28px ${EN_FONT}`, '#5a6068');
  }), { h: 0.62, y: ROOF_Y + 3.0, intensity: 1.05 });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildFarTeishoku(info) {
  const base = farFacadeBase({ ...info, wall: '#8a6a4c', baseColor: '#3a2a20', storeColor: '#ffd9a0' });
  const { g, w, x, zFront } = base;
  farSign(g, info, base, signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ffcf94';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    textOf(ctx, '定食  さくら', width / 2, height * 0.42, `700 88px ${JP_FONT}`, '#ffd9a0');
    textOf(ctx, 'SAKURA  DINER  ·  営業中', width / 2, height * 0.78, `500 28px ${EN_FONT}`, '#e8b880');
  }), { h: 0.7, y: ROOF_Y + 2.8, intensity: 1.5 });
  // 门口暖帘
  noren(g, { w: w * 0.55, h: 0.5, x, y: ROOF_Y + 2.28, z: zFront - 0.16, color: '#7a2f26', text: 'さくら', textColor: '#ffe0b0' });
  // 暖光
  const sp = glowSprite('#ffcf94', 3.0, 0.25);
  sp.position.set(x, ROOF_Y + 1.2, zFront - 0.6);
  g.add(sp);
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildFarCoinpark(info) {
  const g = group(`far-${info.id}`);
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const z0 = E.farPlot.minZ;
  // 地块
  box(w - 0.1, 0.08, E.farPlot.maxZ - z0 - 0.1, toon('#3a3a42', { rim: 0.12 }), {
    x,
    y: ROOF_Y + 0.04,
    z: (z0 + E.farPlot.maxZ) / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  // 车位线
  const lineMat = toon('#e7edf5', { rim: 0.1 });
  for (let i = 0; i < 3; i += 1) {
    const px = info.x0 + 0.4 + i * 1.05;
    plane(0.05, 1.6, lineMat, { x: px, y: ROOF_Y + 0.087, z: z0 + 1.2, rx: -Math.PI / 2, parent: g });
  }
  // 简化车
  const rand = rng(61);
  for (let i = 0; i < 2; i += 1) {
    const cx = info.x0 + 0.85 + i * 1.05;
    const cz = z0 + 1.2;
    box(0.62, 0.32, 1.1, toon(i ? '#4a5a6a' : '#6a5a4a', { rim: 0.16 }), { x: cx, y: ROOF_Y + 0.3, z: cz, parent: g, cast: true });
    box(0.54, 0.25, 0.55, toon('#5a6a78', { rim: 0.14, transparent: true, opacity: 0.8 }), { x: cx, y: ROOF_Y + 0.52, z: cz - 0.1, parent: g, cast: true });
    for (const [wx, wz] of [[-0.28, -0.36], [0.28, -0.36], [-0.28, 0.36], [0.28, 0.36]]) {
      cyl(0.09, 0.09, 0.12, 8, toon('#20242a', { rim: 0.1 }), { x: cx + wx, y: ROOF_Y + 0.16, z: cz + wz, rx: Math.PI / 2, parent: g, cast: false });
    }
    if (rand() > 0.5) {
      const sp = glowSprite('#ff4a3a', 0.35, 0.35);
      sp.position.set(cx, ROOF_Y + 0.35, cz + 0.56);
      g.add(sp);
    }
  }
  // P 灯箱
  const pTex = signTexture(256, 320, (ctx, width, height) => {
    ctx.fillStyle = '#1f3a4a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    textOf(ctx, 'P', width / 2, height * 0.38, `700 180px ${EN_FONT}`, '#c8f0ff');
    textOf(ctx, '24H', width / 2, height * 0.76, `700 52px ${EN_FONT}`, '#9fd8ff');
  });
  const sign = plane(0.7, 1.0, lightbox(pTex, 1.6), { x: info.x1 - 0.4, y: ROOF_Y + 1.4, z: z0 + 0.2, ry: Math.PI, parent: g });
  sign.userData.noOutline = true;
  // 计费机
  box(0.3, 1.0, 0.24, toon('#4a5058', { rim: 0.14 }), { x: info.x0 + 0.2, y: ROOF_Y + 0.6, z: z0 + 0.3, parent: g, cast: true });
  return g;
}

function buildFarShrine(info) {
  const g = group(`far-${info.id}`);
  const w = info.x1 - info.x0;
  const x = (info.x0 + info.x1) / 2;
  const zFront = E.farPlot.minZ;
  // 小而浅的神社前庭
  box(w - 0.1, 0.07, E.farPlot.maxZ - zFront - 0.1, toon('#5b5f58', { rim: 0.12, rimColor: '#9fb8c8' }), {
    x,
    y: ROOF_Y + 0.035,
    z: (zFront + E.farPlot.maxZ) / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  // 参道
  for (let i = 0; i < 4; i += 1) {
    plane(0.55, 0.28, toon('#8a8f88', { rim: 0.12 }), {
      x,
      y: ROOF_Y + 0.082,
      z: zFront + 0.35 + i * 0.34,
      rx: -Math.PI / 2,
      parent: g,
    });
  }
  // 鸟居
  const red = toon('#b8402f', { rim: 0.22, rimColor: '#ffb0a0', gradient: 'soft' });
  const dark = toon('#4a2a22', { rim: 0.16 });
  const toriiZ = zFront + 0.62;
  for (const sx of [x - 0.75, x + 0.75]) {
    cyl(0.09, 0.11, 2.0, 10, red, { x: sx, y: ROOF_Y + 1.0, z: toriiZ, parent: g, cast: true });
    cyl(0.13, 0.13, 0.12, 10, dark, { x: sx, y: ROOF_Y + 0.08, z: toriiZ, parent: g, cast: false });
  }
  box(2.0, 0.14, 0.18, red, { x, y: ROOF_Y + 1.85, z: toriiZ, parent: g, cast: true });
  box(2.3, 0.1, 0.22, red, { x, y: ROOF_Y + 2.05, z: toriiZ, parent: g, cast: true });
  box(2.4, 0.09, 0.26, dark, { x, y: ROOF_Y + 2.15, z: toriiZ, parent: g, cast: false });
  // 小祠
  const hokoraZ = zFront + 1.25;
  box(1.0, 0.1, 0.7, toon('#7a7064', { rim: 0.14 }), { x, y: ROOF_Y + 0.1, z: hokoraZ, parent: g, cast: false });
  box(0.62, 0.62, 0.5, toon('#8a6a4c', { rim: 0.16, rimColor: '#ffd0a0' }), { x, y: ROOF_Y + 0.46, z: hokoraZ, parent: g, cast: true });
  // 屋顶（两片斜板）
  for (const s of [-1, 1]) {
    const roof = box(0.52, 0.06, 0.7, toon('#4a3a30', { rim: 0.14 }), { x: x + s * 0.2, y: ROOF_Y + 0.84, z: hokoraZ, parent: g, cast: true });
    roof.rotation.z = s * 0.42;
  }
  // 小灯笼
  for (const sx of [x - 1.0, x + 1.0]) {
    cyl(0.08, 0.1, 0.5, 8, toon('#8a8f88', { rim: 0.14 }), { x: sx, y: ROOF_Y + 0.25, z: zFront + 1.1, parent: g, cast: true });
    box(0.2, 0.16, 0.2, flat('#ffcf94').clone(), { x: sx, y: ROOF_Y + 0.58, z: zFront + 1.1, parent: g, cast: false }).material.color.multiplyScalar(1.8);
    const sp = glowSprite('#ffb45e', 1.0, 0.35);
    sp.position.set(sx, ROOF_Y + 0.6, zFront + 1.1);
    g.add(sp);
  }
  // 石灯基础 + 树影
  for (const sx of [x - 1.5, x + 1.5]) {
    sphere(0.32, toon('#3a4a3a', { rim: 0.18, rimColor: '#7fb890', gradient: 'soft' }), {
      x: sx,
      y: ROOF_Y + 0.62,
      z: zFront + 1.4,
      parent: g,
      cast: true,
    });
  }
  // 神社牌子
  plane(0.5, 1.2, lightbox(signTexture(128, 320, (ctx, width, height) => {
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, width, height);
    ['稲', '荷', '神', '社'].forEach((ch, i) => textOf(ctx, ch, width / 2, 46 + i * 74, `700 46px ${JP_FONT}`, '#2a1c18'));
  }), 1.1), { x: x + 1.0, y: ROOF_Y + 1.35, z: toriiZ - 0.04, ry: Math.PI, parent: g });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildFarOffice(info) {
  const base = farFacadeBase({ ...info, wall: '#5f6672', floors: info.floors, h: info.h });
  const { g, w, x, zFront } = base;
  // 办公楼的网格窗
  for (let f = 1; f < (info.floors || 5); f += 1) {
    const fy = ROOF_Y + 0.7 + f * ((info.h - 1.2) / (info.floors || 5));
    for (let i = 0; i < 4; i += 1) {
      const lit = ((f * 3 + i * 7 + Math.round(x)) % 10) / 12;
      windowUnit(g, {
        x: info.x0 + (w / 4) * (i + 0.5),
        y: fy,
        z: zFront,
        ry: Math.PI,
        w: Math.min(1.0, w / 4 - 0.35),
        h: 0.9,
        lit: 0.2 + lit,
        color: '#cfe4ff',
        bars: 0,
      });
    }
  }
  farSign(g, info, base, signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#1f2630';
    ctx.fillRect(0, 0, width, height);
    textOf(ctx, '月見ビル', width / 2, height * 0.4, `700 80px ${JP_FONT}`, '#cfe4ff');
    textOf(ctx, 'TSUKIMI  BLDG.  ·  OFFICE / CLINIC', width / 2, height * 0.78, `500 26px ${EN_FONT}`, '#9fb8d8');
  }), { h: 0.62, y: ROOF_Y + 2.7, intensity: 1.2 });
  // 竖招牌
  verticalSign(g, {
    x: info.x1 - 0.3,
    y: ROOF_Y + 4.6,
    z: zFront - 0.3,
    w: 0.42,
    h: 1.8,
    tex: signTexture(192, 768, (ctx, width, height) => {
      ctx.fillStyle = '#1f2630';
      ctx.fillRect(0, 0, width, height);
      textOf(ctx, '月見', width / 2, height * 0.32, `700 58px ${JP_FONT}`, '#cfe4ff');
      textOf(ctx, 'ビル', width / 2, height * 0.62, `700 58px ${JP_FONT}`, '#cfe4ff');
      textOf(ctx, '5F', width / 2, height * 0.85, `600 38px ${EN_FONT}`, '#9fd8ff');
    }),
    intensity: 1.4,
  });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildFarSlot(info) {
  const base = farFacadeBase({ ...info, wall: '#3c3448', baseColor: '#1a1424', storeColor: '#ff6f9c' });
  const { g, w, x, zFront } = base;
  farSign(g, info, base, signTexture(1024, 224, (ctx, width, height) => {
    const grd = ctx.createLinearGradient(0, 0, width, 0);
    grd.addColorStop(0, '#2a0f2a');
    grd.addColorStop(0.5, '#4a0f3a');
    grd.addColorStop(1, '#1a0a24');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    textOf(ctx, 'スロット 月', width / 2, height * 0.42, `700 84px ${JP_FONT}`, '#ffd9f0');
    textOf(ctx, 'SLOT  &  PACHINKO', width / 2, height * 0.78, `600 30px ${EN_FONT}`, '#9ff0e8');
  }), { h: 0.7, y: ROOF_Y + 2.8, intensity: 1.7 });
  const sp = glowSprite('#ff6f9c', 3.4, 0.3);
  sp.position.set(x, ROOF_Y + 1.2, zFront - 0.7);
  g.add(sp);
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildFarCafe(info) {
  const base = farFacadeBase({ ...info, wall: '#8a7f6a', baseColor: '#3a3028', storeColor: '#ffd9a0' });
  const { g, w, x, zFront } = base;
  farSign(g, info, base, signTexture(1024, 224, (ctx, width, height) => {
    ctx.fillStyle = '#f0e2c8';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#3a3028';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    textOf(ctx, '純喫茶 ひかり', width / 2, height * 0.42, `700 84px ${JP_FONT}`, '#3a3028');
    textOf(ctx, 'HIKARI  COFFEE  ·  1968', width / 2, height * 0.78, `500 28px ${EN_FONT}`, '#6b5a44');
  }), { h: 0.62, y: ROOF_Y + 2.75, intensity: 1.25 });
  noren(g, { w: w * 0.48, h: 0.45, x, y: ROOF_Y + 2.2, z: zFront - 0.16, color: '#3a3028', text: 'ひかり', textColor: '#ffe0b0' });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

/* -------------------------------------------------------------------------- */
/*  街道家具                                                                   */
/* -------------------------------------------------------------------------- */

function utilityPole(parent, { x, z, h = 6.2, flip = 1 }) {
  const g = group('pole');
  g.position.set(x, ROOF_Y, z);
  parent.add(g);
  cyl(0.11, 0.15, h, 10, toon('#8a8f96', { rim: 0.16, rimColor: '#c8d8e8' }), { y: h / 2, parent: g, cast: true });
  // 横担
  for (let i = 0; i < 2; i += 1) {
    const y = h - 0.55 - i * 0.55;
    box(1.35, 0.07, 0.08, toon('#5d636b', { rim: 0.12 }), { y, parent: g, cast: true });
    for (const o of [-0.55, 0, 0.55]) {
      cyl(0.035, 0.05, 0.12, 8, toon('#3a3f47', { rim: 0.1 }), { x: o, y: y + 0.1, parent: g, cast: false });
    }
  }
  // 变压器
  cyl(0.16, 0.16, 0.5, 10, toon('#6b7178', { rim: 0.16 }), { x: 0.22 * flip, y: h - 1.45, z: 0.12, parent: g, cast: true });
  // 路灯臂
  tube(catenary(new THREE.Vector3(0, h - 1.0, 0.05), new THREE.Vector3(0.85 * flip, h - 1.05, 0.05), 0.12), 0.03, toon('#5d636b', { rim: 0.12 }), { parent: g });
  const lampX = 0.85 * flip;
  const lamp = sphere(0.13, glow('#ffd9a0', 1.6), { x: lampX, y: h - 1.2, parent: g });
  lamp.userData.noOutline = true;
  const sp = glowSprite('#ffcf94', 2.2, 0.4);
  sp.position.set(lampX, h - 1.2, 0.05);
  g.add(sp);
  // 小牌
  if (z > 2.5) {
    box(0.28, 0.42, 0.03, toon('#e8e2d4', { rim: 0.12 }), { x: 0.22, y: h - 2.6, z: 0.04, parent: g, cast: false });
  }
  return { g, top: new THREE.Vector3(x, ROOF_Y + h - 0.55, z) };
}

function streetLamp(parent, { x, z }) {
  const g = group('street-lamp');
  g.position.set(x, ROOF_Y, z);
  parent.add(g);
  cyl(0.05, 0.08, 3.4, 8, toon('#4a5058', { rim: 0.14 }), { y: 1.7, parent: g, cast: true });
  // 弯臂
  tube(
    catenary(new THREE.Vector3(0, 3.3, 0), new THREE.Vector3(0.7, 3.55, 0), 0.12),
    0.04,
    toon('#4a5058', { rim: 0.14 }),
    { parent: g },
  );
  const head = sphere(0.16, glow('#ffd9a0', 1.8), { x: 0.7, y: 3.45, parent: g });
  head.userData.noOutline = true;
  const sp = glowSprite('#ffcf94', 2.6, 0.4);
  sp.position.set(0.7, 3.4, 0);
  g.add(sp);
  return g;
}

function vendingMachine(parent, { x, z, ry = 0, hot = true }) {
  const g = group('vending');
  g.position.set(x, ROOF_Y, z);
  g.rotation.y = ry;
  parent.add(g);
  box(0.78, 1.8, 0.7, toon(hot ? '#b83a32' : '#3a5a8a', { rim: 0.2, rimColor: '#ffd9a0', gradient: 'soft' }), { y: 0.9, parent: g, cast: true });
  // 灯箱
  const tex = signTexture(256, 512, (ctx, width, height) => {
    ctx.fillStyle = hot ? '#d8e8f8' : '#d8eef8';
    ctx.fillRect(0, 0, width, height);
    const colors = ['#e85a4a', '#5aa86a', '#e8c04a', '#4a8ad8', '#d86aa8'];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ctx.fillStyle = colors[(r * 3 + c) % colors.length];
        ctx.fillRect(16 + c * 78, 16 + r * 92, 58, 66);
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(26 + c * 78, 44 + r * 92, 38, 8);
      }
    }
    ctx.fillStyle = hot ? '#b83a32' : '#3a5a8a';
    ctx.fillRect(0, height - 70, width, 70);
    textOf(ctx, hot ? 'HOT' : 'COLD', width / 2, height - 34, `700 42px ${EN_FONT}`, '#f8f0e0');
  });
  const face = plane(0.68, 1.55, lightbox(tex, 1.7), { y: 1.02, z: 0.36, parent: g });
  face.userData.noOutline = true;
  // 出货口
  box(0.5, 0.16, 0.08, toon('#1b1e24', { rim: 0.1 }), { y: 0.18, z: 0.36, parent: g, cast: false });
  const sp = glowSprite(hot ? '#ffb0a0' : '#9fd8ff', 2.0, 0.25);
  sp.position.set(0, 1.0, 0.5);
  g.add(sp);
  return g;
}

function bicycle(parent, { x, z, ry = 0 }) {
  const g = group('bicycle');
  g.position.set(x, ROOF_Y, z);
  g.rotation.y = ry;
  parent.add(g);
  const frameMat = toon('#3a4a5a', { rim: 0.14 });
  for (const sx of [-0.42, 0.42]) {
    torus(0.25, 0.012, 4, 20, toon('#2a2f37', { rim: 0.1 }), { x: sx, y: 0.27, z: 0, parent: g, cast: false });
  }
  tube(
    [
      [-0.42, 0.27, 0],
      [0, 0.5, 0],
      [0.42, 0.27, 0],
      [0, 0.5, 0],
      [0, 0.35, 0],
    ],
    0.018,
    frameMat,
    { parent: g },
  );
  box(0.22, 0.04, 0.1, toon('#1e2228', { rim: 0.1 }), { x: 0.42, y: 0.52, z: 0, parent: g, cast: false });
  const cage = box(0.3, 0.2, 0.26, toon('#8a9199', { rim: 0.12 }), { x: 0.48, y: 0.36, z: 0, parent: g, cast: false });
  cage.userData.noOutline = true;
  return g;
}

function planter(parent, { x, z, color = '#5a7a4a' }) {
  const g = group('planter');
  g.position.set(x, ROOF_Y, z);
  parent.add(g);
  cyl(0.24, 0.2, 0.32, 8, toon('#6b5a48', { rim: 0.14 }), { y: 0.16, parent: g, cast: true });
  sphere(0.28, toon(color, { rim: 0.18, rimColor: '#9fd8a0', gradient: 'soft' }), { y: 0.5, parent: g, cast: true });
  sphere(0.2, toon(color, { rim: 0.18 }), { x: 0.18, y: 0.42, z: 0.1, parent: g, cast: true });
  return g;
}

function aframeSign(parent, { x, z, ry = 0, text = '本日のおすすめ' }) {
  const g = group('aframe');
  g.position.set(x, ROOF_Y, z);
  g.rotation.y = ry;
  parent.add(g);
  for (const s of [-1, 1]) {
    const board = box(0.48, 0.68, 0.04, toon('#3a3028', { rim: 0.14, rimColor: '#ffcf94' }), {
      x: 0,
      y: 0.44,
      z: s * 0.11,
      parent: g,
      cast: true,
    });
    board.rotation.x = s * 0.16;
    const tex = signTexture(256, 384, (ctx, width, height) => {
      ctx.fillStyle = '#f0e2c8';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#8c2f22';
      ctx.fillRect(0, 0, width, 60);
      textOf(ctx, '営業中', width / 2, 30, `700 34px ${JP_FONT}`, '#f8f0e0');
      textOf(ctx, text, width / 2, 170, `600 30px ${JP_FONT}`, '#3a2a20');
      textOf(ctx, 'ランチ  ¥980', width / 2, 270, `600 26px ${JP_FONT}`, '#8c2f22');
    });
    plane(0.42, 0.58, flat('#ffffff', { map: tex, fog: false }), { y: 0.44, z: s * 0.135, ry: s > 0 ? 0 : Math.PI, parent: g });
  }
  return g;
}

function busStop(parent, { x, z }) {
  const g = group('bus-stop');
  g.position.set(x, ROOF_Y, z);
  parent.add(g);
  cyl(0.05, 0.06, 2.4, 8, toon('#5d636b', { rim: 0.14 }), { y: 1.2, parent: g, cast: true });
  const tex = signTexture(256, 320, (ctx, width, height) => {
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#2a5a8a';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    textOf(ctx, 'バス', width / 2, 62, `700 52px ${JP_FONT}`, '#2a5a8a');
    textOf(ctx, '月見町', width / 2, 138, `700 40px ${JP_FONT}`, '#2a5a8a');
    textOf(ctx, 'つきみマート前', width / 2, 188, `600 24px ${JP_FONT}`, '#4a6a8a');
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(30, 226, width - 60, 4);
    textOf(ctx, '〇 系統  ·  23:41 最終', width / 2, 262, `500 22px ${JP_FONT}`, '#4a6a8a');
  });
  plane(0.5, 0.62, lightbox(tex, 1.1), { y: 2.05, z: 0.03, parent: g });
  // 长椅
  box(1.1, 0.08, 0.3, toon('#6b5a48', { rim: 0.14 }), { x: 0.6, y: 0.42, z: 0.05, parent: g, cast: true });
  return g;
}

function postBox(parent, { x, z }) {
  const g = group('postbox');
  g.position.set(x, ROOF_Y, z);
  parent.add(g);
  cyl(0.05, 0.06, 0.8, 8, toon('#4a5058', { rim: 0.14 }), { y: 0.4, parent: g, cast: true });
  box(0.42, 0.5, 0.36, toon('#b83a32', { rim: 0.2, rimColor: '#ffb0a0' }), { y: 0.95, parent: g, cast: true });
  box(0.28, 0.05, 0.05, toon('#8a2f28', { rim: 0.12 }), { y: 1.06, z: 0.19, parent: g, cast: false });
  const sp = glowSprite('#ff8a6a', 0.8, 0.2);
  sp.position.set(0, 1.0, 0.2);
  g.add(sp);
  return g;
}

function cat(parent, { x, z, ry = 0 }) {
  const g = group('cat');
  g.position.set(x, ROOF_Y, z);
  g.rotation.y = ry;
  parent.add(g);
  const fur = toon('#d8c8a8', { rim: 0.18, rimColor: '#ffe0b0', gradient: 'soft' });
  sphere(0.13, fur, { y: 0.2, z: 0, sx: 1.1, sy: 0.8, sz: 1.4, parent: g, cast: true });
  sphere(0.1, fur, { y: 0.3, z: 0.16, parent: g, cast: true });
  for (const s of [-1, 1]) {
    mesh(new THREE.ConeGeometry(0.035, 0.09, 4), fur, { x: s * 0.05, y: 0.4, z: 0.16, parent: g, cast: false });
  }
  return g;
}

/* -------------------------------------------------------------------------- */
/*  蒸汽 / 落水点                                                              */
/* -------------------------------------------------------------------------- */

function ctxSteam(parent, { x, y, z, kind = 'ramen' }) {
  const mod = parent.userData.handles;
  // 由 buildShops 统一登记，这里只做视觉上的小蒸汽片
  const sp = glowSprite('#e8f0ff', 1.6, 0.16);
  sp.position.set(x, y + 0.35, z);
  parent.add(sp);
}

/* -------------------------------------------------------------------------- */
/*  build                                                                      */
/* -------------------------------------------------------------------------- */

export function buildShops(ctx) {
  const g = group('shops');
  const rand = rng(20260311);
  const shopBuilders = {
    ramen: buildRamen,
    izakaya: buildIzakaya,
    pachinko: buildPachinko,
    kissaten: buildKissaten,
    laundry: buildLaundry,
    sento: buildSento,
    books: buildBooks,
  };
  for (const info of E.shops) {
    const builder = shopBuilders[info.style] || buildKissaten;
    g.add(builder(info));
  }

  // 对面一排
  const farBuilders = {
    apartment: () => buildFarApartment(E.farBuildings[0], 1),
    teishoku: () => buildFarTeishoku(E.farBuildings[1]),
    coinpark: () => buildFarCoinpark(E.farBuildings[2]),
    shrine: () => buildFarShrine(E.farBuildings[3]),
    office: () => buildFarOffice(E.farBuildings[4]),
    slot: () => buildFarSlot(E.farBuildings[5]),
    cafe: () => buildFarCafe(E.farBuildings[6]),
    apartment2: () => buildFarApartment(E.farBuildings[7], 2),
  };
  for (const info of E.farBuildings) {
    g.add(farBuilders[info.style]());
  }

  // 电线杆 + 电线：沿近侧人行道每隔约 5m 一根
  const poles = [];
  for (let x = 6.6; x <= 28.2; x += 5.4) {
    const pole = utilityPole(g, { x, z: 2.92, flip: 1 });
    poles.push(pole.top);
  }
  // 对面两根
  const farPoles = [];
  for (const x of [1.2, 12.0, 22.8, 28.0]) {
    const pole = utilityPole(g, { x, z: 5.86, flip: 1 });
    farPoles.push(pole.top);
  }
  const wireMat = toon('#1c1f24', { rim: 0 });
  const addWires = (list) => {
    for (let i = 0; i < list.length - 1; i += 1) {
      for (const dy of [0, -0.32, -0.62]) {
        const a = list[i].clone();
        const b = list[i + 1].clone();
        a.y += dy;
        b.y += dy;
        tube(catenary(a, b, 0.35 + Math.abs(dy) * 0.2), 0.012, wireMat, { parent: g, segments: 18 });
      }
    }
  };
  addWires(poles);
  addWires(farPoles);

  // 路灯（近侧人行道，暖光）
  for (const x of [9.6, 17.6, 25.4]) {
    streetLamp(g, { x, z: 2.7 });
  }
  // 贩卖机靠便利店东侧 / 拉面店门口
  vendingMachine(g, { x: 2.15, z: 0.2, ry: 0, hot: true });
  vendingMachine(g, { x: 8.55, z: 0.35, ry: 0, hot: false });
  // 拉面店门口自行车 / A 字牌
  bicycle(g, { x: 6.0, z: 2.15, ry: 0.35 });
  bicycle(g, { x: 25.6, z: 2.3, ry: -0.4 });
  aframeSign(g, { x: 7.3, z: 2.45, ry: -0.22, text: '醤油らーめん' });
  aframeSign(g, { x: 13.0, z: 2.45, ry: 0.18, text: '新台入替' });
  // 花盆 / 长椅 / 猫 / 邮筒
  for (const [x, z, color] of [
    [9.35, 2.55, '#4a6b3c'],
    [16.5, 2.55, '#5a7a4a'],
    [23.2, 2.55, '#4a6b3c'],
  ]) {
    planter(g, { x, z, color });
  }
  busStop(g, { x: 18.4, z: 5.92 });
  postBox(g, { x: 4.0, z: 5.9 });
  cat(g, { x: 11.3, z: 2.42, ry: 1.9 });
  // 侧巷口的旧灯与杂物（接旧街景）
  for (let i = 0; i < 3; i += 1) {
    box(0.28 + rand() * 0.16, 0.32, 0.3, toon('#4a4a42', { rim: 0.1 }), {
      x: 4.65 + i * 0.06,
      y: ROOF_Y + 0.16 + i * 0.02,
      z: 0.25 + i * 0.12,
      parent: g,
      cast: false,
    });
  }

  // 登记给 fx 的蒸汽 / 落水点（雨滴从雨棚边缘落下）
  if (Array.isArray(ctx.handles.steamSources)) {
    for (const src of [
      { x: 7.6, y: ROOF_Y + 2.1, z: 1.6 },
      { x: 10.7, y: ROOF_Y + 2.0, z: 1.7 },
      { x: 24.4, y: ROOF_Y + 4.6, z: -2.6 },
    ]) {
      ctx.handles.steamSources.push(src);
    }
  }
  if (Array.isArray(ctx.handles.dripPoints)) {
    for (const info of E.shops) {
      ctx.handles.dripPoints.push({
        x: (info.x0 + info.x1) / 2,
        y: ROOF_Y + 3.45,
        z: FRONT_Z + 1.05,
        w: info.x1 - info.x0 - 0.4,
      });
    }
    ctx.handles.dripPoints.push({ x: 17.0, y: ROOF_Y + 3.4, z: 6.2, w: 3.0 });
    ctx.handles.dripPoints.push({ x: 24.6, y: ROOF_Y + 3.6, z: 6.2, w: 3.0 });
  }

  addOutline(g, { width: 0.0008, color: '#080b14' });

  return {
    group: g,
    shops: E.shops,
    farBuildings: E.farBuildings,
  };
}

/* -------------------------------------------------------------------------- */
/*  给「小镇」模块复用的导出                                                   */
/* -------------------------------------------------------------------------- */

export const SHOP_BUILDERS = {
  ramen: buildRamen,
  izakaya: buildIzakaya,
  pachinko: buildPachinko,
  kissaten: buildKissaten,
  laundry: buildLaundry,
  sento: buildSento,
  books: buildBooks,
};

export function buildShopVisual(style, info) {
  const builder = SHOP_BUILDERS[style] || buildKissaten;
  return builder(info);
}

export {
  FRONT_Z,
  BACK_Z,
  ROOF_Y,
  PAL,
  signTexture,
  verticalSign,
  noren,
  chochin,
  lanternString,
  windowUnit,
  acUnit,
  utilityPole,
  streetLamp,
  vendingMachine,
  bicycle,
  planter,
  aframeSign,
  busStop,
  postBox,
  cat,
};
