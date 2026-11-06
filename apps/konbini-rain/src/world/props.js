/**
 * world/props.js —— 店面小道具：自动贩卖机 / 妈妈车自行车 / 伞架 / 分类垃圾桶 /
 * 门口地垫 / A 字咖啡立牌 / 右墙灯箱广告与公告栏 / 空调外机 / 排水管 / 电表箱 /
 * 屋顶设备 / 一只躲雨的小猫。
 *
 * 全部程序化生成：几何用 lib/kit、材质用 lib/toon、贴图在本文件内用 canvas 画。
 * 坐标以 src/config.js 为准；不新增任何真实光源（发光靠自发光材质 + glowSprite）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../config.js';
import { TEX, JP_FONT, EN_FONT, canvasTexture, roundRect, moonLogo, labelTex } from '../lib/textures.js';
import { toon, flat, lightbox, glow, glowSprite, addOutline } from '../lib/toon.js';
import {
  box,
  roundedBox,
  plane,
  mesh,
  group,
  cyl,
  sphere,
  torus,
  tube,
  boxGeo,
  cylGeo,
  sphereGeo,
  torusGeo,
  instanced,
  trs,
} from '../lib/kit.js';

const PI = Math.PI;
const HALF = PI / 2;
const LOT = L.lot.top; // 人行道/地块顶面 0.12

/* ========================================================================== */
/*  小工具：矩阵 / 零件合并                                                    */
/* ========================================================================== */

function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);

/** 一根从 a 到 b 的圆柱的变换矩阵 */
function rodMatrix(a, b) {
  const A = new THREE.Vector3(a[0], a[1], a[2]);
  const B = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  if (len < 1e-6) return new THREE.Matrix4();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  return new THREE.Matrix4().compose(A.clone().addScaledVector(dir, len / 2), q, new THREE.Vector3(1, 1, 1));
}

function rodPart(a, b, r, seg = 6) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return { geo: cylGeo(r, r, Math.max(len, 1e-4), seg), matrix: rodMatrix(a, b) };
}

function boxPart(w, h, d, pos, rot) {
  return { geo: boxGeo(w, h, d), matrix: mat4(pos, rot) };
}

function cylPart(rt, rb, h, seg, pos, rot) {
  return { geo: cylGeo(rt, rb, Math.max(h, 1e-4), seg), matrix: mat4(pos, rot) };
}

function torusPart(r, tubeR, rs, ts, arc, pos, rot) {
  return { geo: torusGeo(r, tubeR, rs, ts, arc), matrix: mat4(pos, rot) };
}

function spherePart(r, ws, hs, pos, scale) {
  return { geo: sphereGeo(r, ws, hs), matrix: mat4(pos, [0, 0, 0], scale || [1, 1, 1]) };
}

/** 一串点生成一段弯管（返回 geometry 零件，供合并） */
function curvePart(points, r, seg = 12, radial = 5) {
  const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts);
  return { geo: new THREE.TubeGeometry(curve, seg, r, radial, false), matrix: null };
}

/**
 * 把若干几何零件按同一材质合并成一个 Mesh（减少 draw call）。
 * 只允许合并 three 内建的 indexed 几何（Box/Cylinder/Torus/Sphere/Tube/Plane）。
 */
function mergeParts(parent, material, parts, opts = {}) {
  const geos = [];
  for (const p of parts) {
    const gg = p.geo.clone();
    if (p.matrix) gg.applyMatrix4(p.matrix);
    geos.push(gg);
  }
  const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
  for (const gg of geos) if (gg !== merged) gg.dispose();
  if (!merged) return null;
  const m = new THREE.Mesh(merged, material);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.name) m.name = opts.name;
  parent.add(m);
  return m;
}

function noOutline(o) {
  o.userData.noOutline = true;
  return o;
}

/* ========================================================================== */
/*  程序化贴图                                                                 */
/* ========================================================================== */

/** 贩卖机正面商品窗：3 排饮料罐/瓶 + 底部价格按钮带 */
function drinkWindowTexture(hot) {
  return canvasTexture(768, 610, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, hot ? '#170d0a' : '#08131f');
    bg.addColorStop(0.6, hot ? '#20130d' : '#0b1b28');
    bg.addColorStop(1, hot ? '#120b08' : '#060f18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cols = 6;
    const rows = 3;
    const band = 112;
    const gridH = h - band;
    const cw = w / cols;
    const ch = gridH / rows;
    const coldPalette = ['#7fd8e8', '#aee8a2', '#ffd98a', '#93aef2', '#f4f0e2', '#f6a9bd'];
    const hotPalette = ['#c9483a', '#e8b96a', '#8a5a3a', '#f4e4bc', '#d94a3a', '#b06a2a'];
    const palette = hot ? hotPalette : coldPalette;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw;
        const y = r * ch;
        const col = palette[(r * 2 + c * 3) % palette.length];
        ctx.fillStyle = 'rgba(130,190,220,0.045)';
        ctx.fillRect(x + 5, y + 5, cw - 10, ch - 10);

        const bottle = (r + c) % 3 === 1;
        const cx = x + cw / 2;
        const baseY = y + ch - 20;
        if (bottle) {
          // PET 瓶
          const bw = 40;
          const bh = 92;
          const grad = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0.92)');
          grad.addColorStop(0.1, col);
          grad.addColorStop(0.72, col);
          grad.addColorStop(0.92, 'rgba(0,0,0,0.4)');
          grad.addColorStop(1, 'rgba(255,255,255,0.85)');
          ctx.fillStyle = grad;
          roundRect(ctx, cx - bw / 2, baseY - bh, bw, bh - 22, 9);
          ctx.fill();
          // 肩部
          ctx.beginPath();
          ctx.moveTo(cx - bw / 2 + 7, baseY - bh);
          ctx.lineTo(cx - 8, baseY - bh + 3);
          ctx.lineTo(cx - 8, baseY - bh - 26);
          ctx.lineTo(cx + 8, baseY - bh - 26);
          ctx.lineTo(cx + 8, baseY - bh + 3);
          ctx.lineTo(cx + bw / 2 - 7, baseY - bh);
          ctx.closePath();
          ctx.fill();
          // 瓶盖
          ctx.fillStyle = hot ? '#f0e0b8' : '#e8f4f4';
          roundRect(ctx, cx - 10, baseY - bh - 36, 20, 11, 3);
          ctx.fill();
          // 标签
          ctx.fillStyle = 'rgba(251,248,236,0.9)';
          ctx.fillRect(cx - bw / 2 + 3, baseY - bh + 30, bw - 6, 24);
          ctx.fillStyle = '#20304f';
          ctx.font = `700 13px ${JP_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hot ? 'HOT' : 'COLD', cx, baseY - bh + 42);
        } else {
          // 易拉罐
          const bw = 46;
          const bh = 88;
          const grad = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0.95)');
          grad.addColorStop(0.1, col);
          grad.addColorStop(0.72, col);
          grad.addColorStop(0.92, 'rgba(0,0,0,0.42)');
          grad.addColorStop(1, 'rgba(255,255,255,0.9)');
          ctx.fillStyle = grad;
          roundRect(ctx, cx - bw / 2, baseY - bh, bw, bh, 7);
          ctx.fill();
          ctx.fillStyle = '#c9d2d6';
          roundRect(ctx, cx - bw / 2 + 6, baseY - bh - 5, bw - 12, 9, 4);
          ctx.fill();
          ctx.fillStyle = '#eef6f8';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - bh - 5, 9, 3, 0, 0, PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(250,247,235,0.94)';
          ctx.fillRect(cx - bw / 2 + 2, baseY - bh + 32, bw - 4, 26);
          ctx.fillStyle = '#20304f';
          ctx.font = `700 14px ${JP_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hot ? 'あたたか' : 'つめたい', cx, baseY - bh + 45);
        }
      }
      // 层板高光
      ctx.fillStyle = 'rgba(190,220,240,0.16)';
      ctx.fillRect(0, (r + 1) * ch - 7, w, 3);
    }

    // ---- 底部价格 / 按钮带 ----
    ctx.fillStyle = hot ? '#2b1712' : '#0d1d2c';
    ctx.fillRect(0, gridH, w, band);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(0, gridH, w, 4);

    const prices = hot ? [130, 140, 130, 150, 140, 130] : [130, 130, 150, 150, 160, 130];
    prices.forEach((price, i) => {
      const cx = i * cw + cw / 2;
      ctx.fillStyle = hot ? '#ff9a64' : '#7fe8e0';
      roundRect(ctx, cx - cw / 2 + 18, gridH + 20, cw - 36, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.font = `800 25px ${EN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`¥${price}`, cx, gridH + 39);
      ctx.fillStyle = 'rgba(238,244,240,0.6)';
      ctx.font = `600 17px ${JP_FONT}`;
      ctx.fillText(hot ? 'あったか〜い' : 'つめた〜い', cx, gridH + 80);
    });

    // 玻璃反光
    const gloss = ctx.createLinearGradient(0, 0, w * 0.8, h);
    gloss.addColorStop(0, 'rgba(255,255,255,0.10)');
    gloss.addColorStop(0.28, 'rgba(255,255,255,0.02)');
    gloss.addColorStop(0.55, 'rgba(255,255,255,0.07)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, gridH);
  });
}

/** 贩卖机顶部灯箱：品牌 + 冷/热标语 */
function vendingHeaderTexture(hot) {
  return canvasTexture(768, 184, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (hot) {
      g.addColorStop(0, '#b83a2b');
      g.addColorStop(0.55, '#e2603f');
      g.addColorStop(1, '#ff9c63');
    } else {
      g.addColorStop(0, '#0d6f80');
      g.addColorStop(0.55, '#1e9fae');
      g.addColorStop(1, '#4fd2d8');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(0, 0, w, 5);

    moonLogo(ctx, {
      cx: 86,
      cy: 92,
      r: 54,
      disc: hot ? '#b83a2b' : '#0d6f80',
      moon: '#ffc96b',
      star: '#fff6e0',
    });

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff8ea';
    ctx.font = `700 36px ${JP_FONT}`;
    ctx.fillText('つきみマート', 158, 58);
    ctx.font = `800 72px ${JP_FONT}`;
    ctx.fillText(hot ? 'あったか〜い' : 'つめた〜い', 152, 130);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,248,234,0.92)';
    ctx.font = `700 28px ${EN_FONT}`;
    ctx.fillText(hot ? 'HOT DRINKS' : 'COLD DRINKS', w - 34, 58);

    // 小图标：雪花 / 蒸汽
    ctx.strokeStyle = 'rgba(255,248,234,0.92)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    if (!hot) {
      const cx = w - 96;
      const cy = 128;
      for (let i = 0; i < 3; i += 1) {
        const a = (PI / 3) * i;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * 26, cy - Math.sin(a) * 26);
        ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 3; i += 1) {
        const x = w - 132 + i * 26;
        ctx.beginPath();
        ctx.moveTo(x, 148);
        ctx.bezierCurveTo(x - 14, 128, x + 14, 108, x, 86);
        ctx.stroke();
      }
    }
  });
}

/** 贩卖机下部的小品牌贴纸 */
function vendingBrandTexture(hot) {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f6f3e6';
    roundRect(ctx, 4, 4, w - 8, h - 8, 14);
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(160,52,36,0.55)' : 'rgba(32,90,96,0.5)';
    ctx.lineWidth = 4;
    roundRect(ctx, 4, 4, w - 8, h - 8, 14);
    ctx.stroke();
    ctx.fillStyle = hot ? '#a83a2a' : '#245a60';
    ctx.font = `800 50px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('つきみ', w / 2, h / 2 - 12);
    ctx.font = `600 21px ${EN_FONT}`;
    ctx.fillText('TSUKIMI MART', w / 2, h / 2 + 32);
  });
}

/** 车筐铁丝纹（带 alpha 的网格） */
let basketTex = null;
function basketWireTexture() {
  if (basketTex) return basketTex;
  basketTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#f4eee0';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.lineWidth = 5;
    for (let i = 1; i < 7; i += 1) {
      const p = (i / 7) * h;
      ctx.beginPath();
      ctx.moveTo(5, p);
      ctx.lineTo(w - 5, p);
      ctx.stroke();
      const q = (i / 7) * w;
      ctx.beginPath();
      ctx.moveTo(q, 5);
      ctx.lineTo(q, h - 5);
      ctx.stroke();
    }
  });
  return basketTex;
}

/** 地面湿渍 / 空调滴水痕 */
let stainTex = null;
function stainTexture() {
  if (stainTex) return stainTex;
  stainTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(6,10,16,0.7)');
    g.addColorStop(0.55, 'rgba(8,12,20,0.32)');
    g.addColorStop(1, 'rgba(8,12,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return stainTex;
}

const stainMat = () =>
  flat('#ffffff', {
    map: stainTexture(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });

/* ========================================================================== */
/*  自动贩卖机                                                                 */
/* ========================================================================== */

/**
 * 日式自动贩卖机，局部坐标：原点在底面中心，正面朝 +Z。
 * @param {boolean} hot true = 珊瑚红热饮机，false = 白青冷饮机
 */
function buildVendingMachine(hot) {
  const g = group(hot ? 'vending-hot' : 'vending-cold');
  const W = 1.06;
  const H = 1.84;
  const D = 0.7;
  const bodyColor = hot ? '#e2583f' : '#e2ebe9';
  const trimColor = hot ? '#8e3124' : '#8ea6a8';
  const accent = hot ? '#ffa95c' : '#7fe8e0';
  const rimColor = hot ? '#ffb08a' : '#bfe6f2';

  const bodyMat = () => toon(bodyColor, { rim: 0.2, rimColor, gradient: 'soft' });
  const trimMat = () => toon(trimColor, { rim: 0.16, rimColor: '#9fc4dc', gradient: 'soft' });
  const faceMat = () => toon(hot ? '#f7ecdc' : '#eef5f2', { rim: 0.14, rimColor: '#e8e2d0', gradient: 'soft' });
  const darkMat = () => toon('#1c2430', { rim: 0.1, rimColor: '#5a7fa6', gradient: 'tiny' });
  const metalMat = () => toon('#b9c2cb', { rim: 0.2, rimColor: '#eef8ff', gradient: 'tiny' });

  // 机身 + 正面面板（只给外壳描边，细节件不描边免得糊成一团）
  const shell = group('shell');
  g.add(shell);
  roundedBox(W, H, D, 0.05, bodyMat(), { y: H / 2, parent: shell, seg: 2 });
  box(W - 0.06, H - 0.2, 0.02, faceMat(), { y: 0.93, z: D / 2 + 0.01, parent: shell });

  // 底座 + 边框 + 顶盖（合并成一块）
  const trimParts = [];
  trimParts.push(boxPart(W + 0.02, 0.09, D + 0.02, [0, 0.045, 0]));
  trimParts.push(boxPart(W - 0.03, 0.05, D - 0.06, [0, H + 0.012, 0]));
  // 商品窗边框
  trimParts.push(boxPart(0.028, 0.74, 0.035, [-0.454, 1.19, 0.361]));
  trimParts.push(boxPart(0.028, 0.74, 0.035, [0.454, 1.19, 0.361]));
  trimParts.push(boxPart(0.936, 0.028, 0.035, [0, 1.554, 0.361]));
  trimParts.push(boxPart(0.936, 0.028, 0.035, [0, 0.826, 0.361]));
  // 顶部灯箱边框
  trimParts.push(boxPart(0.964, 0.028, 0.035, [0, 1.808, 0.361]));
  trimParts.push(boxPart(0.964, 0.032, 0.035, [0, 1.568, 0.361]));
  trimParts.push(boxPart(0.028, 0.26, 0.035, [-0.472, 1.688, 0.361]));
  trimParts.push(boxPart(0.028, 0.26, 0.035, [0.472, 1.688, 0.361]));
  // 正面左右立边
  trimParts.push(boxPart(0.03, H - 0.12, 0.02, [-(W / 2 - 0.015), H / 2, D / 2 + 0.005]));
  trimParts.push(boxPart(0.03, H - 0.12, 0.02, [W / 2 - 0.015, H / 2, D / 2 + 0.005]));
  mergeParts(shell, trimMat(), trimParts);

  // 顶部灯箱（自发光）
  plane(0.92, 0.22, lightbox(vendingHeaderTexture(hot), hot ? 1.08 : 1.02), {
    y: 1.688,
    z: 0.3705,
    cast: false,
    receive: false,
    parent: g,
  });
  // 商品窗（自发光，注意别比店内暖光更抢）
  plane(0.88, 0.7, lightbox(drinkWindowTexture(hot), hot ? 0.92 : 0.88), {
    y: 1.19,
    z: 0.3705,
    cast: false,
    receive: false,
    parent: g,
  });
  // 下部品牌贴纸 + 面板分缝
  noOutline(
    plane(0.17, 0.11, flat('#ffffff', { map: vendingBrandTexture(hot) }), {
      x: -0.37,
      y: 0.61,
      z: 0.3715,
      parent: g,
      cast: false,
      receive: false,
    }),
  );
  noOutline(box(0.98, 0.006, 0.003, darkMat(), { y: 0.555, z: 0.3715, parent: g, cast: false, receive: false }));

  // 按钮（6 个，合并）
  const btnMat = toon(hot ? '#ffcf8a' : '#b8f6f0', {
    emissive: hot ? '#ff9a4a' : '#5fd8cc',
    emissiveIntensity: 1,
    rim: 0.2,
    rimColor: '#ffffff',
    gradient: 'tiny',
  });
  const btnParts = [];
  for (let i = 0; i < 6; i += 1) {
    btnParts.push(boxPart(0.085, 0.032, 0.02, [-0.35 + i * 0.14, 0.895, 0.382]));
  }
  mergeParts(g, btnMat, btnParts, { cast: false, receive: false });

  // 投币区 / 取物口 / 侧散热格栅（深色件）
  const darkParts = [];
  darkParts.push(boxPart(0.2, 0.3, 0.02, [0.34, 0.66, 0.376])); // 投币面板
  darkParts.push(boxPart(0.016, 0.07, 0.008, [0.382, 0.72, 0.387])); // 硬币口
  darkParts.push(boxPart(0.09, 0.012, 0.008, [0.34, 0.62, 0.387])); // 纸币口
  darkParts.push(boxPart(0.09, 0.085, 0.022, [0.34, 0.5, 0.375])); // 退币口
  darkParts.push(boxPart(0.56, 0.3, 0.025, [0, 0.34, 0.372])); // 取物口外框
  darkParts.push(boxPart(0.5, 0.22, 0.01, [0, 0.33, 0.383])); // 取物口内凹
  darkParts.push(boxPart(0.52, 0.03, 0.02, [0, 0.475, 0.384])); // 取物口上沿
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      darkParts.push(boxPart(0.012, 0.03, 0.44, [sx * (W / 2 + 0.004), 0.32 + i * 0.07, 0]));
    }
  }
  mergeParts(g, darkMat(), darkParts, { cast: false });

  // 顶部灯带（发光条）
  noOutline(
    box(W - 0.24, 0.024, 0.024, glow(accent, hot ? 1.1 : 1.05), {
      y: H - 0.026,
      z: D / 2 + 0.002,
      parent: g,
      cast: false,
      receive: false,
    }),
  );

  // 投币口小绿 LED + 返币按钮
  noOutline(
    box(0.02, 0.014, 0.008, glow('#7dffb0', 1.15), {
      x: 0.3,
      y: 0.73,
      z: 0.387,
      parent: g,
      cast: false,
      receive: false,
    }),
  );
  cyl(0.015, 0.015, 0.012, 10, metalMat(), {
    x: 0.3,
    y: 0.585,
    z: 0.386,
    rx: HALF,
    parent: g,
    cast: false,
  });

  // 柔和光晕（纯视觉，不是真实光源；放在机顶后方，让墙面有一圈溢光）
  const halo = glowSprite(hot ? '#ffb070' : '#a8efff', 2.3, hot ? 0.075 : 0.06);
  halo.position.set(0, H + 0.34, -0.22);
  g.add(halo);
  const ledHalo = glowSprite('#7dffb0', 0.3, 0.16);
  ledHalo.position.set(0.3, 0.73, D / 2 + 0.06);
  g.add(ledHalo);

  addOutline(shell, { width: 0.0011, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  妈妈车自行车                                                               */
/* ========================================================================== */

/**
 * 日式妈妈车（低多边形），局部坐标：原点在两轮之间的地面，车头朝 +X，宽度沿 Z。
 */
function buildBicycle({ frame = '#79c7b8', fender = '#efe7d4', saddle = '#4a3526' } = {}) {
  const g = group('bicycle');
  const tyreMat = toon('#1d222b', { rim: 0.1, rimColor: '#7f9ec4' });
  const rimMat = toon('#c2cad2', { rim: 0.22, rimColor: '#eaf6ff', gradient: 'soft' });
  const frameMat = toon(frame, { rim: 0.26, rimColor: '#dcfff6', gradient: 'soft' });
  const fenderMat = toon(fender, { rim: 0.2, rimColor: '#fff6dd', gradient: 'soft' });
  const metalMat = toon('#b7bfc7', { rim: 0.24, rimColor: '#f0fbff', gradient: 'soft' });
  const darkMat = toon('#2b303a', { rim: 0.1, rimColor: '#6f8fb4' });
  const saddleMat = toon(saddle, { rim: 0.12, rimColor: '#9c7648' });
  const basketMat = toon('#ffffff', {
    map: basketWireTexture(),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    rim: 0.14,
    rimColor: '#fff1d0',
  });

  const wheels = [
    [-0.54, 0.315],
    [0.54, 0.315],
  ];

  // 轮胎 / 轮圈 / 轮毂
  mergeParts(
    g,
    tyreMat,
    wheels.map(([x, y]) => torusPart(0.285, 0.03, 5, 22, PI * 2, [x, y, 0])),
  );
  mergeParts(
    g,
    rimMat,
    wheels.map(([x, y]) => torusPart(0.252, 0.011, 4, 22, PI * 2, [x, y, 0])),
  );
  const hubParts = wheels.map(([x, y]) => cylPart(0.034, 0.034, 0.07, 10, [x, y, 0], [HALF, 0, 0]));
  mergeParts(g, metalMat, hubParts);

  // 辐条（每轮 6 根贯穿的细杆，用 InstancedMesh 省 draw call）
  for (const [x, y] of wheels) {
    const mats = [];
    for (let i = 0; i < 6; i += 1) mats.push(trs(x, y, 0, 0, 0, (i * PI) / 6));
    instanced(cylGeo(0.0042, 0.0042, 0.5, 4), rimMat, mats, { parent: g, cast: true, receive: true });
  }

  // 挡泥板（圆弧管）
  const fenderParts = [
    torusPart(0.352, 0.02, 4, 20, 2.5, [-0.54, 0.315, 0], [0, 0, HALF - 1.25 + 0.22]),
    torusPart(0.352, 0.02, 4, 20, 2.35, [0.54, 0.315, 0], [0, 0, HALF - 1.175 + 0.12]),
  ];
  mergeParts(g, fenderMat, fenderParts);

  // 车架管
  const frameParts = [
    rodPart([0.36, 0.64, 0], [0.39, 0.94, 0], 0.028), // 头管
    curvePart(
      [
        [0.38, 0.92, 0],
        [0.24, 0.82, 0],
        [0.08, 0.72, 0],
        [-0.03, 0.65, 0],
      ],
      0.024,
      10,
    ), // 弯梁（低跨）
    rodPart([0.36, 0.66, 0], [-0.05, 0.31, 0], 0.027), // 下管
    rodPart([-0.05, 0.31, 0], [-0.12, 0.77, 0], 0.026), // 立管
    rodPart([-0.05, 0.31, 0], [-0.54, 0.315, 0], 0.016), // 后下叉
    rodPart([-0.12, 0.75, 0], [-0.54, 0.315, 0], 0.014), // 后上叉
    curvePart(
      [
        [0.37, 0.68, 0],
        [0.46, 0.56, 0],
        [0.52, 0.4, 0],
        [0.54, 0.315, 0],
      ],
      0.017,
      10,
    ), // 前叉
  ];
  mergeParts(g, frameMat, frameParts);

  // 链条罩（一块圆角板）
  roundedBox(0.3, 0.085, 0.016, 0.03, frameMat, {
    x: -0.29,
    y: 0.345,
    z: 0.076,
    rz: -0.03,
    parent: g,
    cast: false,
  });

  // 金属件：车把 / 立管 / 座管 / 后货架 / 牙盘 / 脚踏 / 脚撑 / 车筐支架
  const metalParts = [];
  metalParts.push(rodPart([0.38, 0.94, 0], [0.4, 1.005, 0], 0.02)); // 把立
  metalParts.push(
    curvePart(
      [
        [0.4, 1.0, 0.02],
        [0.43, 1.01, 0.12],
        [0.4, 1.02, 0.22],
        [0.355, 1.02, 0.272],
      ],
      0.015,
      10,
    ),
  );
  metalParts.push(
    curvePart(
      [
        [0.4, 1.0, -0.02],
        [0.43, 1.01, -0.12],
        [0.4, 1.02, -0.22],
        [0.355, 1.02, -0.272],
      ],
      0.015,
      10,
    ),
  );
  metalParts.push(rodPart([-0.12, 0.76, 0], [-0.145, 0.845, 0], 0.016)); // 座管
  // 后货架
  metalParts.push(boxPart(0.34, 0.016, 0.19, [-0.36, 0.735, 0]));
  metalParts.push(rodPart([-0.54, 0.315, 0.07], [-0.52, 0.72, 0.07], 0.011));
  metalParts.push(rodPart([-0.54, 0.315, -0.07], [-0.52, 0.72, -0.07], 0.011));
  metalParts.push(rodPart([-0.2, 0.735, 0.09], [-0.2, 0.6, 0.09], 0.01));
  metalParts.push(rodPart([-0.2, 0.735, -0.09], [-0.2, 0.6, -0.09], 0.01));
  // 牙盘 / 曲柄 / 脚踏
  metalParts.push(cylPart(0.105, 0.105, 0.012, 16, [-0.05, 0.31, 0.078], [HALF, 0, 0]));
  metalParts.push(rodPart([-0.05, 0.31, 0.09], [-0.02, 0.19, 0.09], 0.011));
  metalParts.push(boxPart(0.09, 0.018, 0.05, [-0.02, 0.175, 0.115]));
  // 脚撑
  metalParts.push(rodPart([-0.5, 0.31, 0.03], [-0.43, 0.02, 0.13], 0.011));
  metalParts.push(boxPart(0.06, 0.012, 0.045, [-0.43, 0.012, 0.15]));
  // 车筐支架
  metalParts.push(rodPart([0.5, 0.71, 0.1], [0.44, 0.52, 0.085], 0.011));
  metalParts.push(rodPart([0.5, 0.71, -0.1], [0.44, 0.52, -0.085], 0.011));
  mergeParts(g, metalMat, metalParts, { cast: true, receive: true });

  // 车座（圆角块 + 前鼻）
  sphere(0.1, saddleMat, {
    x: -0.175,
    y: 0.87,
    z: 0,
    sx: 1,
    sy: 0.32,
    sz: 0.68,
    rz: -0.05,
    parent: g,
    ws: 12,
    hs: 8,
  });
  sphere(0.06, saddleMat, {
    x: -0.075,
    y: 0.862,
    z: 0,
    sx: 1.1,
    sy: 0.42,
    sz: 0.5,
    parent: g,
    ws: 10,
    hs: 6,
  });

  // 车把握把
  const gripParts = [
    rodPart([0.355, 1.02, 0.235], [0.33, 1.02, 0.31], 0.021),
    rodPart([0.355, 1.02, -0.235], [0.33, 1.02, -0.31], 0.021),
  ];
  mergeParts(g, darkMat, gripParts, { cast: false });

  // 车筐（铁丝网面片，全部合并为一块）
  const basketParts = [];
  const bx = 0.66;
  const by0 = 0.7;
  const by1 = 0.9;
  const bz = 0.135;
  const bb = 0.53; // 后壁
  const bf = 0.79; // 前壁
  basketParts.push({
    geo: new THREE.PlaneGeometry(bf - bb, bz * 2),
    matrix: mat4([bx, by0, 0], [-HALF, 0, 0]),
  });
  basketParts.push({
    geo: new THREE.PlaneGeometry(bz * 2, by1 - by0),
    matrix: mat4([bf, (by0 + by1) / 2, 0], [0, HALF, 0]),
  });
  basketParts.push({
    geo: new THREE.PlaneGeometry(bz * 2, by1 - by0),
    matrix: mat4([bb, (by0 + by1) / 2, 0], [0, -HALF, 0]),
  });
  basketParts.push({
    geo: new THREE.PlaneGeometry(bf - bb, by1 - by0),
    matrix: mat4([bx, (by0 + by1) / 2, bz], [0, 0, 0]),
  });
  basketParts.push({
    geo: new THREE.PlaneGeometry(bf - bb, by1 - by0),
    matrix: mat4([bx, (by0 + by1) / 2, -bz], [0, PI, 0]),
  });
  const basketMesh = mergeParts(g, basketMat, basketParts, { cast: false, receive: false });
  noOutline(basketMesh);

  // 车铃（金色小圆顶 + 底座）
  const bellMat = toon('#d8b06a', { rim: 0.4, rimColor: '#fff0c0', gradient: 'soft' });
  cyl(0.03, 0.03, 0.012, 10, metalMat, { x: 0.405, y: 1.032, z: -0.15, parent: g, cast: false });
  sphere(0.038, bellMat, { x: 0.405, y: 1.05, z: -0.15, sy: 0.62, parent: g, ws: 12, hs: 8 });

  // 尾灯反光片
  noOutline(
    box(0.02, 0.05, 0.075, glow('#ff5a5a', 1.1), {
      x: -0.875,
      y: 0.42,
      z: 0,
      parent: g,
      cast: false,
      receive: false,
    }),
  );

  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  门口：伞架 + 伞                                                           */
/* ========================================================================== */

function buildUmbrellaStand() {
  const g = group('umbrella-stand');
  const metalMat = toon('#9aa4ae', { rim: 0.24, rimColor: '#dff2ff', gradient: 'soft' });
  const darkMat = toon('#2c333d', { rim: 0.1, rimColor: '#6f8fb4' });

  // 底盘 / 筒身 / 上沿 / 竖条（合并为两块）
  const darkParts = [cylPart(0.2, 0.19, 0.03, 18, [0, 0.015, 0]), torusPart(0.152, 0.01, 4, 20, PI * 2, [0, 0.07, 0], [HALF, 0, 0])];
  mergeParts(g, darkMat, darkParts, { cast: false });
  const metalParts = [
    cylPart(0.165, 0.15, 0.52, 18, [0, 0.29, 0]),
    torusPart(0.166, 0.012, 4, 20, PI * 2, [0, 0.55, 0], [HALF, 0, 0]),
  ];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * PI * 2 + PI / 4;
    metalParts.push(boxPart(0.014, 0.46, 0.014, [Math.cos(a) * 0.158, 0.29, Math.sin(a) * 0.158]));
  }
  mergeParts(g, metalMat, metalParts);

  // 三把伞：透明 / 红 / 藏青（合拢状态，伞尖朝下插在伞架里，弯钩把手露在外面）
  const makeUmbrella = (color, transparent, ax, az, lean) => {
    const u = group('umbrella');
    u.position.set(ax, 0.16, az);
    u.rotation.set(lean[0], lean[1], lean[2]);

    const shaftMat = toon('#5a5148', { rim: 0.12, rimColor: '#b99060' });
    const canopyMat = transparent
      ? toon(color, {
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          side: THREE.DoubleSide,
          rim: 0.3,
          rimColor: '#dff8ff',
          gradient: 'soft',
        })
      : toon(color, { rim: 0.3, rimColor: '#ffd9d0', gradient: 'soft' });

    // 收拢的伞面（上宽下窄）
    cyl(0.062, 0.016, 0.5, 8, canopyMat, { y: 0.4, parent: u });
    // 束带
    cyl(0.064, 0.064, 0.028, 8, darkMat, { y: 0.5, parent: u, cast: false });
    // 伞尖 + 伞杆 + 弯钩把手（合并）
    const shaftParts = [
      cylPart(0.014, 0.004, 0.14, 6, [0, 0.05, 0]),
      cylPart(0.012, 0.012, 0.42, 6, [0, 0.85, 0]),
      torusPart(0.045, 0.012, 4, 10, PI, [0.045, 1.06, 0]),
    ];
    mergeParts(u, shaftMat, shaftParts, { cast: false });
    return u;
  };

  g.add(makeUmbrella('#dfeef2', true, -0.055, -0.035, [0.12, 0.4, -0.1]));
  g.add(makeUmbrella('#d9534f', false, 0.06, 0.03, [-0.1, -0.3, 0.14]));
  g.add(makeUmbrella('#2f3f6e', false, -0.005, 0.075, [0.16, -0.1, 0.05]));

  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  门口：三色分类垃圾桶                                                       */
/* ========================================================================== */

function buildTrashBins() {
  const g = group('trash-bins');
  const clearMat = toon('#d8eef0', {
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide,
    rim: 0.28,
    rimColor: '#d8f8ff',
  });
  const clearFrameMat = toon('#cfdad8', { rim: 0.2, rimColor: '#e8f8ff', gradient: 'soft' });
  const darkMat = toon('#2b333d', { rim: 0.1, rimColor: '#6f8fb4' });

  const bins = [
    {
      x: -0.37,
      body: null,
      lid: '#eef4f2',
      label: { text: 'かん・びん', sub: 'CAN / BOTTLE', fg: '#20304f', bg: '#f4f5ec' },
    },
    {
      x: 0,
      body: '#4a86c8',
      lid: '#2f66a8',
      label: { text: 'ペット', sub: 'PET BOTTLE', fg: '#20304f', bg: '#f4f5ec' },
    },
    {
      x: 0.37,
      body: '#4da87c',
      lid: '#2e7a58',
      label: { text: 'もえる', sub: 'BURNABLE', fg: '#20304f', bg: '#f4f5ec' },
    },
  ];

  for (const b of bins) {
    const bg = group('bin');
    bg.position.x = b.x;
    const lidMat = toon(b.lid, { rim: 0.2, rimColor: '#e8f6ff', gradient: 'soft' });
    const bodyMat = b.body ? toon(b.body, { rim: 0.2, rimColor: '#cfe8ff', gradient: 'soft' }) : clearMat;

    roundedBox(0.36, 0.62, 0.34, 0.05, bodyMat, { y: 0.34, parent: bg, seg: 2 });
    // 透明桶的骨架 + 内袋
    if (!b.body) {
      const posts = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          posts.push(boxPart(0.022, 0.6, 0.022, [sx * 0.17, 0.35, sz * 0.155]));
        }
      }
      mergeParts(bg, clearFrameMat, posts);
      roundedBox(0.3, 0.48, 0.27, 0.04, toon('#f2f4f0', { transparent: true, opacity: 0.32, depthWrite: false, rim: 0.1 }), {
        y: 0.3,
        parent: bg,
        cast: false,
      });
    }
    // 盖子 + 圆形投入口
    roundedBox(0.38, 0.07, 0.36, 0.03, lidMat, { y: 0.675, parent: bg, seg: 2 });
    torus(0.078, 0.013, 4, 14, lidMat, { y: 0.712, rx: HALF, parent: bg, cast: false });
    mesh(
      new THREE.CircleGeometry(0.075, 16),
      flat('#0c1117'),
      { x: 0, y: 0.716, z: 0, rx: -HALF, parent: bg, cast: false, receive: false },
    );
    // 四个脚垫（合并）
    const feet = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        feet.push(boxPart(0.06, 0.03, 0.06, [sx * 0.13, 0.015, sz * 0.12]));
      }
    }
    mergeParts(bg, darkMat, feet, { cast: false });
    // 日文标签
    const labTex = labelTex({
      w: 320,
      h: 200,
      bg: b.label.bg,
      fg: b.label.fg,
      text: b.label.text,
      sub: b.label.sub,
      size: 46,
    });
    plane(0.27, 0.17, flat('#ffffff', { map: labTex }), {
      y: 0.45,
      z: 0.1715,
      parent: bg,
      cast: false,
      receive: false,
    });
    g.add(bg);
  }

  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  门口：地垫 / A 字立牌                                                      */
/* ========================================================================== */

function buildDoorMat() {
  const g = group('door-mat');
  box(0.92, 0.022, 0.48, toon('#141c2b', { rim: 0.12, rimColor: '#5f8fca', gradient: 'soft' }), {
    y: 0.011,
    parent: g,
    cast: false,
  });
  plane(0.86, 0.42, toon('#ffffff', { map: TEX.doorMat(), rim: 0.05, rimColor: '#7f9ec4', gradient: 'soft' }), {
    y: 0.0235,
    rx: -HALF,
    parent: g,
    cast: false,
    receive: true,
  });
  return g;
}

function buildAFrame() {
  const g = group('a-frame');
  const boardMat = toon('#26324d', { rim: 0.2, rimColor: '#8fb4dd', gradient: 'soft' });
  const hingeMat = toon('#9aa4ae', { rim: 0.2, rimColor: '#e0f4ff' });
  const posterMat = toon('#ffffff', { map: TEX.aFrame(), rim: 0.12, rimColor: '#8fb4dd', gradient: 'soft' });

  const lean = 0.2;
  const h = 0.66;
  const w = 0.46;
  const cy = (h / 2) * Math.cos(lean);
  const b1 = box(w, h, 0.024, boardMat, { y: cy, z: 0.08, rx: -lean, parent: g });
  plane(0.42, 0.6, posterMat, { z: 0.0135, parent: b1, cast: false, receive: false });
  box(w, h, 0.024, boardMat, { y: cy, z: -0.08, rx: lean, parent: g });
  // 顶部铰链
  box(w + 0.02, 0.04, 0.06, hingeMat, { y: cy + (h / 2) * Math.cos(lean) + 0.005, z: 0, parent: g, cast: false });
  // 底部横撑
  box(w + 0.02, 0.022, 0.045, hingeMat, { y: 0.05, z: 0, parent: g, cast: false });

  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  右侧外墙：灯箱广告 / 公告栏 / 电表箱 / 排水管                                */
/* ========================================================================== */

function buildWallAd() {
  const g = group('wall-ad');
  // 局部坐标：原点在墙脚，+X 朝外，z 沿墙。放在 z=0 处，实际位置由调用者摆放。
  const frameMat = toon('#2c3c5c', { rim: 0.24, rimColor: '#8fb4dd', gradient: 'soft' });
  const darkMat = toon('#1c2430', { rim: 0.1, rimColor: '#5a7fa6', gradient: 'tiny' });

  box(0.07, 1.06, 0.76, frameMat, { x: 0.035, y: 1.86, parent: g });
  box(0.11, 0.05, 0.82, frameMat, { x: 0.045, y: 2.415, parent: g, cast: false });
  box(0.11, 0.05, 0.82, frameMat, { x: 0.045, y: 1.305, parent: g, cast: false });
  const adMat = lightbox(TEX.wallAd(), 1.12);
  plane(0.68, 0.98, adMat, { x: 0.0715, y: 1.86, ry: HALF, parent: g, cast: false, receive: false });
  // 上下小支架
  box(0.16, 0.03, 0.03, darkMat, { x: 0.08, y: 2.47, parent: g, cast: false });
  box(0.16, 0.03, 0.03, darkMat, { x: 0.08, y: 1.25, parent: g, cast: false });

  const halo = glowSprite('#bfeff0', 2.1, 0.1);
  halo.position.set(0.5, 1.9, 0);
  g.add(halo);

  addOutline(g, { width: 0.0009, color: '#080b14' });
  return { group: g, mat: adMat };
}

function buildNoticeBoard() {
  const g = group('notice-board');
  const woodMat = toon('#7d5a3a', { rim: 0.24, rimColor: '#e0b070', gradient: 'soft' });
  const darkMat = toon('#2a231c', { rim: 0.1, rimColor: '#8a6a44' });
  const woodParts = [];
  woodParts.push(boxPart(0.06, 0.78, 0.05, [0.03, 1.6, -0.47]));
  woodParts.push(boxPart(0.06, 0.78, 0.05, [0.03, 1.6, 0.47]));
  woodParts.push(boxPart(0.06, 0.05, 0.99, [0.03, 1.965, 0]));
  woodParts.push(boxPart(0.06, 0.05, 0.99, [0.03, 1.235, 0]));
  mergeParts(g, woodMat, woodParts);
  // 软木板
  plane(
    0.86,
    0.66,
    toon('#ffffff', {
      map: TEX.noticePosters(),
      rim: 0.14,
      rimColor: '#ffe6c0',
      emissive: '#3c3326',
      emissiveIntensity: 0.45,
      gradient: 'soft',
    }),
    { x: 0.0625, y: 1.6, ry: HALF, parent: g, cast: false, receive: false },
  );
  // 挡雨小檐
  box(0.14, 0.03, 1.02, darkMat, { x: 0.06, y: 2.005, parent: g, cast: false });
  // 图钉
  const pinParts = [];
  const pinSpots = [
    [1.72, -0.24, '#ff7a5e'],
    [1.55, 0.2, '#3fa8a0'],
    [1.44, -0.1, '#ffc96b'],
  ];
  for (const [y, z] of pinSpots) {
    pinParts.push(cylPart(0.014, 0.014, 0.012, 8, [0.072, y, z], [0, 0, HALF]));
  }
  noOutline(mergeParts(g, toon('#d8d8d0', { rim: 0.3, rimColor: '#ffffff', gradient: 'tiny' }), pinParts, { cast: false }));
  // 一张翘起的小纸条
  const paperMat = toon('#f2ead8', { rim: 0.12, rimColor: '#fff6dd', gradient: 'soft' });
  noOutline(box(0.006, 0.14, 0.1, paperMat, { x: 0.07, y: 1.4, z: 0.28, rz: 0.1, parent: g, cast: false }));

  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

function buildMeterBox() {
  const g = group('meter-box');
  const metalMat = toon('#b9bdb4', { rim: 0.2, rimColor: '#e8f6ff', gradient: 'soft' });
  const darkMat = toon('#2b3138', { rim: 0.1, rimColor: '#6f8fb4', gradient: 'tiny' });
  const pipeMat = toon('#9aa4ad', { rim: 0.16, rimColor: '#e0f4ff', gradient: 'tiny' });

  box(0.12, 0.34, 0.26, metalMat, { x: 0.06, y: 1.32, parent: g });
  // 观察窗
  plane(0.2, 0.24, flat('#2b3138'), { x: 0.1215, y: 1.32, ry: HALF, parent: g, cast: false, receive: false });
  // 表盘玻璃
  cyl(0.045, 0.045, 0.012, 12, flat('#cfe8e0'), {
    x: 0.127,
    y: 1.4,
    rz: HALF,
    parent: g,
    cast: false,
    receive: false,
  });
  // 黄色警示贴
  plane(0.1, 0.06, flat('#e8c969'), { x: 0.122, y: 1.22, ry: HALF, parent: g, cast: false, receive: false });
  // 上下线管
  tube(
    [
      [0.05, 1.15, 0.02],
      [0.05, 0.9, 0.02],
      [0.05, 0.3, 0.02],
      [0.05, 0.13, 0.02],
    ],
    0.016,
    pipeMat,
    { parent: g, segments: 10, radialSegments: 5 },
  );
  tube(
    [
      [0.05, 1.49, 0.02],
      [0.05, 2.2, 0.02],
      [0.05, 3.0, 0.02],
    ],
    0.016,
    pipeMat,
    { parent: g, segments: 8, radialSegments: 5 },
  );
  // 管卡
  box(0.06, 0.03, 0.08, darkMat, { x: 0.045, y: 0.6, parent: g, cast: false });
  box(0.06, 0.03, 0.08, darkMat, { x: 0.045, y: 2.4, parent: g, cast: false });

  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

function buildDrainPipe() {
  const g = group('drain-pipe');
  const pvcMat = toon('#d4d6ce', { rim: 0.2, rimColor: '#e8f6ff', gradient: 'soft' });
  const metalMat = toon('#6f7a86', { rim: 0.16, rimColor: '#c8dcef', gradient: 'tiny' });
  const darkMat = toon('#2a313a', { rim: 0.1, rimColor: '#6f8fb4', gradient: 'tiny' });

  const X = 0.075;
  const y0 = 0.34;
  const y1 = 3.6;
  mergeParts(
    g,
    pvcMat,
    [cylPart(0.045, 0.045, y1 - y0, 10, [X, (y0 + y1) / 2, 0])],
  );
  // 接头
  const jointParts = [];
  for (const y of [1.16, 1.98, 2.8]) jointParts.push(cylPart(0.056, 0.056, 0.07, 10, [X, y, 0]));
  mergeParts(g, pvcMat, jointParts, { cast: false });
  // 底部弯头 + 排水口
  tube(
    [
      [X, 0.36, 0],
      [X, 0.24, 0],
      [X + 0.07, 0.15, 0],
      [X + 0.15, 0.125, 0],
    ],
    0.045,
    pvcMat,
    { parent: g, segments: 12, radialSegments: 6 },
  );
  // 顶部弯头进墙
  tube(
    [
      [X, 3.58, 0],
      [X, 3.66, 0],
      [X - 0.02, 3.72, 0],
    ],
    0.045,
    pvcMat,
    { parent: g, segments: 8, radialSegments: 6 },
  );
  // 管卡
  for (let i = 0; i < 3; i += 1) {
    box(0.06, 0.04, 0.11, metalMat, { x: 0.035, y: 1.05 + i * 1.1, parent: g, cast: false });
  }
  // 地面排水格栅
  box(0.24, 0.02, 0.18, darkMat, { x: X + 0.2, y: 0.012, parent: g, cast: false, receive: true });
  addOutline(g, { width: 0.0008, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  空调外机                                                                   */
/* ========================================================================== */

/**
 * 挂墙空调外机。局部坐标：原点在机器底面中心，正面朝 +Z。
 * 下面带两根落地的支撑脚 + 铜管。
 */
function buildACUnit({ w = 0.82, h = 0.58, d = 0.3, fanR = 0.185 } = {}) {
  const g = group('ac-unit');
  const bodyMat = toon('#d3d5cc', { rim: 0.22, rimColor: '#e8f6ff', gradient: 'soft' });
  const darkMat = toon('#39424c', { rim: 0.1, rimColor: '#7fa0c8', gradient: 'tiny' });
  const metalMat = toon('#9aa4ad', { rim: 0.22, rimColor: '#e0f4ff', gradient: 'tiny' });
  const copperMat = toon('#b5723e', { rim: 0.35, rimColor: '#ffd098', gradient: 'soft' });
  const hoseMat = toon('#2f3742', { rim: 0.1, rimColor: '#6f8fb4' });

  roundedBox(w, h, d, 0.03, bodyMat, { y: h / 2, parent: g, seg: 2 });
  // 前面板风扇格栅
  const fy = h * 0.54;
  noOutline(
    mesh(new THREE.CircleGeometry(fanR, 20), darkMat, {
      y: fy,
      z: d / 2 + 0.004,
      parent: g,
      cast: false,
      receive: false,
    }),
  );
  torus(0.192, 0.012, 4, 20, metalMat, { y: fy, z: d / 2 + 0.008, parent: g, cast: false });
  const vaneParts = [];
  for (let i = 0; i < 4; i += 1) {
    vaneParts.push(boxPart(fanR * 1.7, 0.012, 0.01, [0, fy, d / 2 + 0.012], [0, 0, (i * PI) / 4]));
  }
  vaneParts.push(boxPart(fanR * 1.7, 0.01, 0.01, [0, fy, d / 2 + 0.014], [0, 0, 0]));
  noOutline(mergeParts(g, metalMat, vaneParts, { cast: false, receive: false }));
  // 风扇中心
  noOutline(cyl(0.03, 0.03, 0.014, 8, darkMat, { y: fy, z: d / 2 + 0.016, rx: HALF, parent: g, cast: false }));
  // 右侧百叶
  const louvreParts = [];
  for (let i = 0; i < 4; i += 1) {
    louvreParts.push(boxPart(0.016, 0.03, d * 0.66, [w / 2 + 0.004, 0.16 + i * 0.085, 0]));
  }
  noOutline(mergeParts(g, darkMat, louvreParts, { cast: false, receive: false }));
  // 顶部散热筋
  const topParts = [];
  for (let i = 0; i < 4; i += 1) {
    topParts.push(boxPart(w * 0.6, 0.008, 0.02, [0, h + 0.004, -d * 0.22 + i * 0.05]));
  }
  noOutline(mergeParts(g, darkMat, topParts, { cast: false, receive: false }));
  // 铜管（沿墙往侧面再往下）
  noOutline(
    tube(
      [
        [w / 2 - 0.02, h * 0.72, -d * 0.32],
        [w / 2 + 0.08, h * 0.7, -d * 0.38],
        [w / 2 + 0.11, 0.3, -d * 0.42],
        [w / 2 + 0.11, 0.04, -d * 0.42],
      ],
      0.018,
      copperMat,
      { parent: g, segments: 12, radialSegments: 6 },
    ),
  );
  noOutline(
    tube(
      [
        [w / 2 - 0.06, h * 0.66, -d * 0.32],
        [w / 2 + 0.03, h * 0.64, -d * 0.4],
        [w / 2 + 0.06, 0.28, -d * 0.44],
        [w / 2 + 0.06, 0.04, -d * 0.44],
      ],
      0.024,
      hoseMat,
      { parent: g, segments: 12, radialSegments: 6 },
    ),
  );
  // 支撑脚 + 斜撑
  const legParts = [];
  for (const sx of [-1, 1]) {
    legParts.push(boxPart(0.05, 0.3, 0.05, [sx * (w / 2 - 0.14), -0.15, -d / 2 + 0.05]));
    legParts.push(rodPart([sx * (w / 2 - 0.14), -0.28, d / 2 + 0.02], [sx * (w / 2 - 0.14), -0.02, -d / 2 + 0.02], 0.012));
  }
  mergeParts(g, metalMat, legParts, { cast: false, receive: true });

  addOutline(g, { width: 0.0009, color: '#080b14' });
  return g;
}

/* ========================================================================== */
/*  屋顶设备                                                                   */
/* ========================================================================== */

function buildRoofKit() {
  const g = group('roof-kit');
  const roofTop = L.store.wallTopY + 0.16; // store.js 屋顶盒顶面 3.68
  const metalMat = toon('#98a0a8', { rim: 0.2, rimColor: '#dff2ff', gradient: 'soft' });
  const darkMat = toon('#3a4149', { rim: 0.1, rimColor: '#7fa0c8', gradient: 'tiny' });
  const greyMat = toon('#c9cbc3', { rim: 0.18, rimColor: '#e8f6ff', gradient: 'soft' });

  // ---- 屋顶空调外机（L.roof）----
  const pad = box(1.32, 0.1, 0.92, toon('#6f747b', { rim: 0.14, rimColor: '#b8cde0', gradient: 'soft' }), {
    x: L.roof.acX,
    y: roofTop + 0.05,
    z: L.roof.acZ,
    parent: g,
  });
  pad.castShadow = false;
  const ac = group('roof-ac');
  ac.position.set(L.roof.acX, roofTop + 0.1, L.roof.acZ);
  ac.rotation.y = 0.32;
  const acW = 1.15;
  const acH = 0.78;
  const acD = 0.62;
  roundedBox(acW, acH, acD, 0.04, greyMat, { y: acH / 2, parent: ac, seg: 2 });
  // 风扇格栅（朝 +Z）
  mesh(new THREE.CircleGeometry(0.27, 18), darkMat, { y: acH * 0.52, z: acD / 2 + 0.005, parent: ac, cast: false });
  torus(0.28, 0.016, 4, 18, metalMat, { y: acH * 0.52, z: acD / 2 + 0.01, parent: ac, cast: false });
  const roofVan = [];
  for (let i = 0; i < 4; i += 1) {
    roofVan.push(boxPart(0.46, 0.016, 0.012, [0, acH * 0.52, acD / 2 + 0.014], [0, 0, (i * PI) / 4]));
  }
  mergeParts(ac, metalMat, roofVan, { cast: false, receive: false });
  // 顶部排风管
  tube(
    [
      [-0.3, acH + 0.02, 0.05],
      [-0.3, acH + 0.16, 0.05],
      [-0.12, acH + 0.24, 0.02],
      [0.1, acH + 0.24, -0.02],
    ],
    0.05,
    metalMat,
    { parent: ac, segments: 10, radialSegments: 6 },
  );
  // 底座枕木
  const skids = [];
  for (const sz of [-1, 1]) skids.push(boxPart(acW - 0.1, 0.08, 0.09, [0, -0.04, sz * (acD / 2 - 0.1)]));
  mergeParts(ac, darkMat, skids, { cast: false, receive: true });
  addOutline(ac, { width: 0.0009 });
  g.add(ac);

  // ---- 排风管（L.roof.vent）----
  const vent = group('roof-vent');
  vent.position.set(L.roof.ventX, roofTop, L.roof.ventZ);
  box(0.4, 0.05, 0.4, darkMat, { y: 0.025, parent: vent, cast: false });
  mergeParts(
    vent,
    metalMat,
    [cylPart(0.15, 0.15, 0.92, 12, [0, 0.51, 0]), cylPart(0.2, 0.18, 0.07, 12, [0, 0.99, 0])],
  );
  torus(0.2, 0.014, 4, 16, darkMat, { y: 1.03, rx: HALF, parent: vent, cast: false });
  cyl(0.02, 0.2, 0.1, 10, metalMat, { y: 1.09, parent: vent, cast: false });
  addOutline(vent, { width: 0.0009 });
  g.add(vent);

  // ---- 天线（剪影）----
  const ant = group('roof-antenna');
  ant.position.set(1.12, roofTop, -3.0);
  box(0.3, 0.06, 0.3, darkMat, { y: 0.03, parent: ant });
  const mastParts = [
    cylPart(0.028, 0.032, 2.6, 6, [0, 1.33, 0]), // 主杆
    cylPart(0.012, 0.012, 0.3, 5, [0, 2.78, 0]), // 顶部细杆
  ];
  mergeParts(ant, darkMat, mastParts);
  // 三根横担 + 端头小立杆（八木天线的剪影）
  const armParts = [];
  const bandsY = [
    [2.95, 0.98, 0.06],
    [2.6, 0.78, -0.1],
    [2.26, 0.6, 0.16],
  ];
  for (const [y, len, rz] of bandsY) {
    armParts.push(cylPart(0.011, 0.011, len, 4, [0, y, 0], [0, 0, HALF + rz]));
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    for (const sgn of [-1, 1]) {
      armParts.push(cylPart(0.007, 0.007, 0.13, 4, [sgn * (len / 2) * c, y + sgn * (len / 2) * s, 0]));
    }
  }
  mergeParts(ant, darkMat, armParts, { cast: false });
  // 屋面短斜撑
  tube(
    [
      [0.11, 0.02, 0.11],
      [0.03, 0.5, 0.03],
      [0, 0.96, 0],
    ],
    0.006,
    darkMat,
    { parent: ant, segments: 6, radialSegments: 4 },
  );
  addOutline(ant, { width: 0.00085 });
  g.add(ant);

  return g;
}

/* ========================================================================== */
/*  躲雨的小猫                                                                 */
/* ========================================================================== */

function buildCat() {
  const g = group('cat');
  const fur = toon('#8a97a9', { rim: 0.56, rimColor: '#ffdfb0', gradient: 'soft' });
  const fur2 = toon('#9aa7b9', { rim: 0.52, rimColor: '#ffe6bf', gradient: 'soft' });
  const cream = toon('#f0e6cf', { rim: 0.22, rimColor: '#fff2d8', gradient: 'soft' });
  const pink = toon('#d58a8f', { rim: 0.1, rimColor: '#ffd0d0', gradient: 'tiny' });
  const eyeMat = glow('#f5c96a', 1.05);
  const pupilMat = flat('#121822');

  // 身体（呼吸缩放用）
  const body = sphere(0.12, fur, {
    x: 0,
    y: 0.135,
    z: -0.012,
    sx: 1,
    sy: 1.16,
    sz: 0.92,
    rz: 0.09,
    parent: g,
    ws: 14,
    hs: 10,
  });
  // 胸口浅色（挂在身体上，随呼吸一起动）
  sphere(0.07, cream, {
    x: 0,
    y: 0.02,
    z: 0.074,
    sx: 0.9,
    sy: 1.38,
    sz: 0.5,
    parent: body,
    ws: 10,
    hs: 8,
  });

  // 后腿 / 前腿
  const legParts = [];
  for (const sx of [-1, 1]) {
    legParts.push(rodPart([sx * 0.046, 0.115, 0.085], [sx * 0.046, 0.022, 0.1], 0.021, 6));
    legParts.push(spherePart(0.05, 8, 6, [sx * 0.075, 0.06, -0.03], [0.9, 1.05, 1.25]));
  }
  mergeParts(g, fur, legParts);
  // 前爪
  const pawParts = [];
  for (const sx of [-1, 1]) pawParts.push(spherePart(0.028, 8, 6, [sx * 0.046, 0.016, 0.105], [1, 0.62, 1.25]));
  mergeParts(g, cream, pawParts);

  // 头
  const head = group('cat-head');
  head.position.set(0, 0.3, 0.045);
  g.add(head);
  sphere(0.09, fur2, { parent: head, sy: 0.95, sz: 0.97, ws: 14, hs: 10 });
  // 腮 / 嘴 / 鼻
  for (const sx of [-1, 1]) {
    noOutline(
      sphere(0.03, cream, {
        parent: head,
        x: sx * 0.033,
        y: -0.024,
        z: 0.066,
        sx: 1,
        sy: 0.82,
        sz: 0.72,
        ws: 8,
        hs: 6,
      }),
    );
  }
  noOutline(sphere(0.038, cream, { parent: head, y: -0.026, z: 0.08, sx: 1.1, sy: 0.74, sz: 0.8, ws: 10, hs: 8 }));
  noOutline(sphere(0.01, pink, { parent: head, y: -0.004, z: 0.109, ws: 8, hs: 6 }));
  // 眼睛（暖色微亮 + 深色瞳孔，别做成外星人）
  for (const sx of [-1, 1]) {
    noOutline(
      sphere(0.0115, eyeMat, { parent: head, x: sx * 0.034, y: 0.014, z: 0.08, ws: 8, hs: 6, cast: false }),
    );
    noOutline(
      sphere(0.0055, pupilMat, { parent: head, x: sx * 0.034, y: 0.014, z: 0.0895, ws: 6, hs: 4, cast: false }),
    );
  }
  // 耳朵
  const earL = cyl(0.0, 0.037, 0.09, 4, fur2, { parent: head, x: -0.056, y: 0.084, z: 0.004, rz: 0.28, cast: false });
  const earR = cyl(0.0, 0.037, 0.09, 4, fur2, { parent: head, x: 0.056, y: 0.084, z: 0.004, rz: -0.28, cast: false });
  noOutline(cyl(0.0, 0.019, 0.058, 4, pink, { parent: head, x: -0.056, y: 0.078, z: 0.024, rz: 0.28, cast: false }));
  noOutline(cyl(0.0, 0.019, 0.058, 4, pink, { parent: head, x: 0.056, y: 0.078, z: 0.024, rz: -0.28, cast: false }));

  // 尾巴
  const tail = group('cat-tail');
  tail.position.set(0, 0.09, -0.095);
  g.add(tail);
  tube(
    [
      [0, 0, 0],
      [0.02, 0.09, -0.06],
      [0.05, 0.19, -0.05],
      [0.078, 0.26, 0.015],
      [0.07, 0.29, 0.095],
    ],
    0.021,
    fur,
    { parent: tail, segments: 12, radialSegments: 6 },
  );
  noOutline(sphere(0.023, cream, { parent: tail, x: 0.07, y: 0.29, z: 0.095, ws: 8, hs: 6 }));

  addOutline(g, { width: 0.00055, color: '#080b14' });

  return {
    group: g,
    body,
    head,
    tail,
    earL,
    earR,
    bodyBase: [1, 1.16, 0.92],
    headY: head.position.y,
    earLBase: earL.rotation.z,
    earRBase: earR.rotation.z,
  };
}

/* ========================================================================== */
/*  组装                                                                       */
/* ========================================================================== */

export function buildProps(ctx) {
  const g = group('props');
  const handles = ctx?.handles || {};

  /* ---- 自动贩卖机（贴右墙，面朝 +X）---- */
  const cold = buildVendingMachine(false);
  cold.position.set(L.store.maxX + 0.02 + 0.35, LOT, L.vending.zCold);
  cold.rotation.y = HALF;
  g.add(cold);

  const hot = buildVendingMachine(true);
  hot.position.set(L.store.maxX + 0.02 + 0.35, LOT, L.vending.zHot);
  hot.rotation.y = HALF;
  g.add(hot);

  /* ---- 自行车 ---- */
  const bikeFocus = buildBicycle({ frame: '#7fc9bb', fender: '#efe7d4', saddle: '#4a3526' });
  bikeFocus.position.set(-2.02, LOT + 0.004, 1.4);
  bikeFocus.rotation.set(-0.04, 0.06, 0);
  g.add(bikeFocus);

  const bikeSide = buildBicycle({ frame: '#e3a0a6', fender: '#efe4d2', saddle: '#3f2d20' });
  bikeSide.position.set(2.02, LOT + 0.004, -3.3);
  bikeSide.rotation.y = HALF;
  g.add(bikeSide);

  /* ---- 门口 ---- */
  const umbrella = buildUmbrellaStand();
  umbrella.position.set(0.32, LOT, 1.24);
  umbrella.rotation.y = -0.35;
  g.add(umbrella);

  const bins = buildTrashBins();
  bins.position.set(-0.55, LOT, 1.22);
  g.add(bins);

  const doorMat = buildDoorMat();
  doorMat.position.set(1.06, LOT + 0.001, 1.22);
  g.add(doorMat);

  const aFrame = buildAFrame();
  aFrame.position.set(-0.42, LOT, 1.98);
  aFrame.rotation.y = 0.3;
  g.add(aFrame);

  /* ---- 右墙附件 ---- */
  const ad = buildWallAd();
  ad.group.position.set(L.store.maxX, 0, 0.62);
  g.add(ad.group);

  const notice = buildNoticeBoard();
  notice.position.set(L.store.maxX, 0, -3.05);
  g.add(notice);

  const meter = buildMeterBox();
  meter.position.set(L.store.maxX, 0, -3.78);
  g.add(meter);

  const drain = buildDrainPipe();
  drain.position.set(L.store.maxX, 0, -4.38);
  g.add(drain);

  /* ---- 空调外机（后墙 + 巷侧墙）---- */
  const acBack = buildACUnit({ w: 0.84, h: 0.58, d: 0.3 });
  acBack.position.set(-1.25, LOT + 0.33, -4.6 - 0.15);
  acBack.rotation.y = PI; // 正面朝 -Z（后墙外侧）
  g.add(acBack);

  // 第二台放在后墙（巷子留给 street 的杂物，避免互相打架）
  const acBack2 = buildACUnit({ w: 0.78, h: 0.54, d: 0.28 });
  acBack2.position.set(-2.35, LOT + 0.33, -4.6 - 0.15);
  acBack2.rotation.y = PI;
  g.add(acBack2);

  // 空调滴水的湿痕（地面）
  for (const [x, z, sx, sz, rot] of [
    [-1.25, -4.92, 0.62, 0.36, 0.2],
    [-2.35, -4.92, 0.46, 0.3, 1.2],
  ]) {
    const p = plane(1, 1, stainMat(), {
      x,
      y: LOT + 0.004,
      z,
      rx: -HALF,
      rz: rot,
      cast: false,
      receive: false,
      parent: g,
    });
    p.scale.set(sx, sz, 1);
  }

  /* ---- 屋顶设备 ---- */
  const roofKit = buildRoofKit();
  g.add(roofKit);

  /* ---- 纸箱 + 躲雨的小猫（贩卖机侧边，冷光/暖光交界处，不挡商品窗）---- */
  const cardboard = group('cardboard-boxes');
  cardboard.position.set(1.98, LOT, -0.16);
  cardboard.rotation.y = 0.14;
  const cardMat = toon('#b9855a', { rim: 0.26, rimColor: '#ffd9a8', gradient: 'soft' });
  const cardMat2 = toon('#a9764d', { rim: 0.24, rimColor: '#ffd0a0', gradient: 'soft' });
  const tapeMat = toon('#e4d3ae', { rim: 0.16, rimColor: '#fff3d4', gradient: 'tiny' });
  // 底层纸箱（封箱带 + 微翘的盖子）
  box(0.4, 0.3, 0.34, cardMat, { y: 0.15, parent: cardboard });
  noOutline(box(0.405, 0.012, 0.055, tapeMat, { y: 0.302, parent: cardboard, cast: false, receive: false }));
  noOutline(box(0.4, 0.011, 0.12, cardMat2, { y: 0.315, z: 0.15, rx: -0.16, parent: cardboard, cast: false }));
  // 上层小纸箱
  box(0.32, 0.24, 0.28, cardMat2, { x: 0.01, y: 0.42, z: 0.01, ry: 0.22, parent: cardboard });
  noOutline(box(0.322, 0.011, 0.05, tapeMat, { x: 0.01, y: 0.542, z: 0.01, ry: 0.22, parent: cardboard, cast: false, receive: false }));
  noOutline(box(0.3, 0.01, 0.1, cardMat, { x: 0.01, y: 0.55, z: 0.16, ry: 0.22, rx: -0.2, parent: cardboard, cast: false }));
  addOutline(cardboard, { width: 0.0008, color: '#080b14' });
  g.add(cardboard);

  const cat = buildCat();
  cat.group.position.set(1.99, LOT + 0.545, -0.16);
  cat.group.rotation.y = 1.2;
  g.add(cat.group);

  /* ---- 共享 handles：滴水点 ---- */
  if (handles.dripPoints) {
    const top = LOT + 1.84;
    handles.dripPoints.push(
      new THREE.Vector3(L.store.maxX + 0.74, top - 0.03, L.vending.zCold - 0.42),
      new THREE.Vector3(L.store.maxX + 0.74, top - 0.03, L.vending.zHot + 0.42),
      new THREE.Vector3(L.store.maxX + 0.1, 1.25, 0.62),
    );
  }

  /* ---- 小零件不投射阴影（减少 shadow pass 的 draw call）---- */
  g.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const geo = o.geometry;
    if (!geo) return;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    if (geo.boundingSphere && geo.boundingSphere.radius < 0.085) o.castShadow = false;
  });

  /* ---- 每帧：猫的呼吸 / 尾巴 / 耳朵 ---- */
  const catState = cat;
  return {
    group: g,
    update(t) {
      const breathe = 1 + Math.sin(t * 1.75) * 0.018;
      catState.body.scale.set(
        catState.bodyBase[0],
        catState.bodyBase[1] * breathe,
        catState.bodyBase[2],
      );
      catState.head.position.y = catState.headY + Math.sin(t * 1.75 + 0.55) * 0.003;
      catState.tail.rotation.y = Math.sin(t * 0.85) * 0.1 + Math.sin(t * 0.37 + 1.2) * 0.035;
      catState.tail.rotation.x = Math.sin(t * 0.63 + 0.8) * 0.05;
      catState.earL.rotation.z = catState.earLBase + Math.sin(t * 0.52) * 0.03;
      catState.earR.rotation.z = catState.earRBase - Math.sin(t * 0.52 + 0.6) * 0.03;
    },
  };
}
