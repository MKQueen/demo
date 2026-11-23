/**
 * flora.js —— 水墨树 v3：骨架 + 笔触叶团 + 球形法线。
 *
 * v2 是「两张交叉片贴一张整树笔触」，远看是一片薄纸、近看没有结构，
 * 鸟瞰时只剩一根根竖线。这一版换成参考 procedural-tree 的思路：
 *
 *   1. 骨架：递归 samplePath() 逐步前进生成枝条点串（噪声扰动 + 向光性 + 重力），
 *      每种树 2~4 个变体（不同种子），所有枝条沿曲线扫成圆管，
 *      合并成一个 BufferGeometry（枝条 1 draw）；
 *   2. 叶团：每个枝梢挂「笔触叶团」实例——松针扫笔 / 槐树点叶 / 柳丝 / 粉白花簇，
 *      都是 Canvas 现画的；同一棵树上的叶团大小、滚转、明度都分散；
 *   3. 球形法线：叶团明暗不按单片叶子算，而是按「树冠球心 → 叶团」的球面方向算，
 *      同一棵树的叶团共享一个球心，整丛叶子明暗连续，看着像一团有体积的树冠。
 *      叶团片在顶点着色器里做全向广告牌，鸟瞰和低角度都不会变成一条线；
 *      法线逐顶点从球面方向取，所以每一团还带一点球面弧度；
 *   4. 风：叶团和枝条在顶点着色器里轻摆，uTime 由 ctx.onTick 统一驱动。
 *
 * 性能：全场景的树共享 10 个（种 × 变体）批次，每批枝条 1 draw + 叶团 1 draw，
 * 一共 20 个 draw call；实例矩阵、实例色、球心、相位、滚转都是 InstancedBufferAttribute。
 * 为了容纳分多次 buildTrees 调用（city / landmarks / nature / modern / outskirts），
 * 批次是模块级共享的，第一次调用时挂到 ctx.scene 上，后续调用只往里追加实例。
 *
 * 用法（对外 API 与 v2 完全一致）：
 *   import { buildTrees, lineOfTrees } from '../lib/flora.js';
 *   group.add(buildTrees([
 *     { kind: 'pine'|'locust'|'willow'|'blossom', x, z, y?, h?, w?, rot? },
 *   ], ctx));
 */
import * as THREE from 'three';
import { makeRng, fbm2 } from './rand.js';

const TAU = Math.PI * 2;
const TEX = 320; // 叶团贴图分辨率（每 种×变体 一张）
const WIND = { value: 0 }; // 所有树共享的风时钟
const UP = new THREE.Vector3(0, 1, 0);

/* ========================================================================== */
/*  Canvas 笔触工具                                                            */
/* ========================================================================== */

function makeCanvas(size = TEX) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** 柔边的墨点（点叶用）：边缘化开，后期不会给每个点都描一圈硬线。 */
function softDot(g, x, y, rx, ry, rot, color, alpha) {
  if (rx < 0.2 || ry < 0.2) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, Math.max(0.12, ry / rx));
  const grd = g.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
  grd.addColorStop(0, rgbStr(color, Math.min(1, alpha)));
  grd.addColorStop(0.55, rgbStr(color, alpha * 0.8));
  grd.addColorStop(1, rgbStr(color, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

/** 渐细的一笔（点串折线，逐段收笔）。 */
function taperStroke(g, pts, w, color, alpha) {
  const n = pts.length - 1;
  if (n < 1) return;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = i / n;
    g.strokeStyle = rgbStr(color, alpha * (0.6 + 0.4 * (1 - t)));
    g.lineWidth = Math.max(0.45, w * (1 - 0.5 * t));
    g.beginPath();
    g.moveTo(pts[i][0], pts[i][1]);
    g.lineTo(pts[i + 1][0], pts[i + 1][1]);
    g.stroke();
  }
}

/** 带抖动 / 弧度的短线。 */
function jitterLine(g, x0, y0, x1, y1, w, color, alpha, rng, bend = 0, segs = 5) {
  const pts = [];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const off = Math.sin(t * Math.PI) * bend + (rng() - 0.5) * w * 0.7;
    pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
  }
  taperStroke(g, pts, w, color, alpha);
}

/** 飞白：刮掉一些细竖条，透出纸色。 */
function dryBrush(g, rng, n, x, y, w, h, strength = 0.2) {
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${0.04 + rng() * strength})`;
    g.fillRect(x + rng() * w, y + rng() * h, 0.8 + rng() * 1.6, 3 + rng() * (h * 0.1));
  }
  g.globalCompositeOperation = 'source-over';
}

/** 挖几个小洞，让叶团边缘透气（不是一整块实心圆）。 */
function punchHoles(g, rng, n, cx, cy, radius, size, alpha = 0.85) {
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const r = radius * (0.55 + rng() * 0.5);
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, size * (0.4 + rng()), size * (0.3 + rng() * 0.7), rng() * TAU, 0, TAU);
    g.fillStyle = `rgba(0,0,0,${alpha})`;
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

/** 只作用在已有笔画上的内部明暗（让每一团自己有体积）。 */
function innerShade(g, S, rng, dark = 0.3, light = 0.16) {
  g.globalCompositeOperation = 'source-atop';
  const grd = g.createLinearGradient(0, S, S, 0); // 左下暗 → 右上亮
  grd.addColorStop(0, `rgba(18,26,20,${dark})`);
  grd.addColorStop(0.42, 'rgba(18,26,20,0)');
  grd.addColorStop(0.72, `rgba(255,252,240,${light * 0.4})`);
  grd.addColorStop(1, `rgba(255,252,240,${light})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
}

/**
 * 叶团边缘的 alpha 衰减：叶团之间叠在一起时能化成一团墨，
 * 而不是一个个描了边的圆球。
 */
function softenAlpha(g, S, inner = 0.56, outer = 0.99) {
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createRadialGradient(S * 0.5, S * 0.5, S * inner * 0.5, S * 0.5, S * 0.5, S * outer * 0.5);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.72, 'rgba(0,0,0,0.86)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
}

/* ========================================================================== */
/*  四种叶团笔触（Canvas 现画）                                                 */
/* ========================================================================== */

/** 松 / 柏：一根小枝上炸开的扇形松针（贴图上方 = 枝梢朝外方向）。 */
function paintPine(variant) {
  const S = TEX;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const rng = makeRng(9101 + variant * 613);
  const dark = [54, 66, 56];
  const mid = [78, 92, 76];
  const light = [108, 120, 96];
  const ink = [42, 40, 32];
  const bx = S * 0.5;
  const by = S * 0.97;
  const spread = 0.86;
  const R = S * 1.02;

  // 1) 一层极淡的扇形墨底（让远看有块，不画满）
  const grd = g.createRadialGradient(bx, by, S * 0.03, bx, by, R);
  grd.addColorStop(0, rgbStr(dark, 0.28));
  grd.addColorStop(0.5, rgbStr(mid, 0.2));
  grd.addColorStop(1, rgbStr(mid, 0));
  g.beginPath();
  g.moveTo(bx, by);
  g.arc(bx, by, R, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
  g.closePath();
  g.fillStyle = grd;
  g.fill();

  // 2) 小枝 + 松针：针尖伸出墨底，剪影才毛
  const nSp = 10 + (variant % 3);
  for (let i = 0; i < nSp; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / nSp - 0.5) * spread * 1.84 + (rng() - 0.5) * 0.12;
    const len = S * (0.44 + rng() * 0.52);
    jitterLine(g, bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, S * 0.008, ink, 0.5, rng, (rng() - 0.5) * S * 0.03, 5);

    const nNeedle = 38 + Math.floor(rng() * 18);
    for (let k = 0; k < nNeedle; k++) {
      const t = 0.06 + rng() * 0.96;
      const px = bx + Math.cos(a) * len * t;
      const py = by + Math.sin(a) * len * t;
      const side = rng() < 0.5 ? -1 : 1;
      const na = a + side * (0.35 + rng() * 0.85);
      const nl = S * (0.04 + rng() * 0.09);
      const r = rng();
      const col = r < 0.36 ? dark : r < 0.74 ? mid : light;
      jitterLine(g, px, py, px + Math.cos(na) * nl, py + Math.sin(na) * nl, S * (0.0045 + rng() * 0.0045), col, 0.42 + rng() * 0.34, rng, 0, 2);
    }
  }

  // 3) 根部浓墨 + 明暗
  g.beginPath();
  g.ellipse(bx, by - S * 0.01, S * 0.05, S * 0.032, 0, 0, TAU);
  g.fillStyle = rgbStr(ink, 0.42);
  g.fill();
  innerShade(g, S, rng, 0.24, 0.16);
  punchHoles(g, rng, 8, bx, by - S * 0.32, S * 0.34, S * 0.022, 0.6);
  dryBrush(g, rng, 26, S * 0.02, 0, S * 0.96, S * 0.95, 0.14);
  softenAlpha(g, S, 0.5, 0.99);
  return c;
}

/** 槐 / 杂树：几块洇墨 + 满团点叶（芥子园「点叶」的墨点）。 */
function paintLocust(variant) {
  const S = TEX;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const rng = makeRng(2303 + variant * 771);
  const dark = [58, 72, 56];
  const mid = [84, 98, 72];
  const light = [114, 124, 92];
  const ink = [46, 44, 34];
  const cx = S * 0.5;
  const cy = S * 0.52;

  // 1) 极淡的洇墨（统一底色，不画成实心圆）
  for (let i = 0; i < 4; i++) {
    const x = cx + (rng() - 0.5) * S * 0.42;
    const y = cy + (rng() - 0.5) * S * 0.36;
    const grd = g.createRadialGradient(x, y, 0, x, y, S * (0.2 + rng() * 0.1));
    grd.addColorStop(0, rgbStr(mid, 0.2));
    grd.addColorStop(1, rgbStr(mid, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, S * (0.2 + rng() * 0.1), 0, TAU);
    g.fill();
  }

  // 2) 露头的细枝
  for (let i = 0; i < 12; i++) {
    const a = rng() * TAU;
    const r0 = S * 0.03;
    const r1 = S * (0.2 + rng() * 0.28);
    jitterLine(
      g,
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1,
      S * 0.006,
      ink,
      0.3,
      rng,
      (rng() - 0.5) * S * 0.04,
      3,
    );
  }

  // 3) 点叶（柔边、成簇、疏密不均，下暗上亮）
  const clumps = 16;
  for (let cl = 0; cl < clumps; cl++) {
    const ca = rng() * TAU;
    const cr = Math.pow(rng(), 0.5) * S * 0.36;
    const ccx = cx + Math.cos(ca) * cr;
    const ccy = cy + Math.sin(ca) * cr * 0.92;
    const n = 5 + Math.floor(rng() * 9);
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU;
      const rr = Math.pow(rng(), 0.5) * S * 0.1;
      const x = ccx + Math.cos(a) * rr;
      const y = ccy + Math.sin(a) * rr;
      const up = y < cy;
      const col = rng() < 0.34 ? dark : up && rng() < 0.5 ? light : mid;
      const rad = S * (0.014 + rng() * 0.022);
      softDot(g, x, y, rad * (1 + rng() * 0.45), rad * (0.66 + rng() * 0.4), rng() * Math.PI, col, 0.5 + rng() * 0.35);
    }
  }

  innerShade(g, S, rng, 0.24, 0.16);
  punchHoles(g, rng, 14, cx, cy, S * 0.36, S * 0.03, 0.5);
  dryBrush(g, rng, 24, S * 0.08, S * 0.08, S * 0.84, S * 0.84, 0.14);
  softenAlpha(g, S, 0.42, 0.98);
  return c;
}

/** 柳：一条条垂下来的柳丝（贴图上方 = 枝头，丝往下垂）。 */
function paintWillow(variant) {
  const S = TEX;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const rng = makeRng(5501 + variant * 397);
  const dark = [94, 102, 66];
  const mid = [120, 130, 84];
  const light = [156, 158, 110];

  // 枝头一点淡墨
  for (let i = 0; i < 2; i++) {
    const x = S * (0.4 + rng() * 0.2);
    const y = S * (0.05 + rng() * 0.06);
    const grd = g.createRadialGradient(x, y, 0, x, y, S * 0.2);
    grd.addColorStop(0, rgbStr(mid, 0.22));
    grd.addColorStop(1, rgbStr(mid, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, S * 0.2, 0, TAU);
    g.fill();
  }

  // 垂丝：长短不齐，从上方散下来
  const n = 16 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const x0 = S * (0.06 + (0.88 * (i + 0.5)) / n) + (rng() - 0.5) * S * 0.04;
    const y0 = S * (0.02 + rng() * 0.14);
    const len = S * (0.36 + rng() * 0.6);
    const sway = (rng() - 0.5) * S * 0.16;
    const pts = [];
    const segs = 8;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      pts.push([x0 + Math.sin(t * 2.8 + i * 0.7) * sway * t + (rng() - 0.5) * S * 0.008, y0 + len * t]);
    }
    taperStroke(g, pts, S * (0.0045 + rng() * 0.0025), rng() < 0.3 ? dark : mid, 0.36 + rng() * 0.26);

    const nl = 12 + Math.floor(rng() * 12);
    for (let k = 0; k < nl; k++) {
      const t = 0.04 + rng() * 0.94;
      const idx = Math.min(segs - 1, Math.floor(t * segs));
      const f = t * segs - idx;
      const px = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * f;
      const py = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * f;
      const col = rng() < 0.5 ? mid : rng() < 0.5 ? light : dark;
      softDot(
        g,
        px + (rng() - 0.5) * S * 0.035,
        py + (rng() - 0.5) * S * 0.02,
        S * (0.011 + rng() * 0.014),
        S * (0.005 + rng() * 0.005),
        (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0.6 : -0.6),
        col,
        0.4 + rng() * 0.3,
      );
    }
  }

  innerShade(g, S, rng, 0.2, 0.14);
  dryBrush(g, rng, 20, S * 0.04, S * 0.02, S * 0.92, S * 0.92, 0.16);
  softenAlpha(g, S, 0.44, 0.99);
  return c;
}

/** 花树（杏 / 海棠 / 桃）：墨枝 + 粉白花簇，画面里少有的暖色。 */
function paintBlossom(variant) {
  const S = TEX;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const rng = makeRng(2281 + variant * 991);
  const ink = [58, 50, 42];
  const rose = [196, 126, 130];
  const pink = [214, 152, 154];
  const pale = [228, 188, 184];
  const white = [240, 228, 220];
  const bx = S * 0.5;
  const by = S * 0.98;

  // 淡粉雾
  for (let i = 0; i < 4; i++) {
    const x = S * (0.28 + rng() * 0.44);
    const y = S * (0.22 + rng() * 0.38);
    const grd = g.createRadialGradient(x, y, 0, x, y, S * (0.18 + rng() * 0.1));
    grd.addColorStop(0, rgbStr(pink, 0.2));
    grd.addColorStop(1, rgbStr(pink, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, S * (0.18 + rng() * 0.1), 0, TAU);
    g.fill();
  }

  // 墨枝：先画骨架，花是「挂」在它上面的
  const nBranch = 8 + (variant % 3);
  for (let i = 0; i < nBranch; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / nBranch - 0.5) * 1.95 + (rng() - 0.5) * 0.16;
    const len = S * (0.34 + rng() * 0.3);
    jitterLine(g, bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, S * 0.007, ink, 0.56, rng, (rng() - 0.5) * S * 0.04, 5);

    const nf = 10 + Math.floor(rng() * 8);
    for (let k = 0; k < nf; k++) {
      const t = 0.22 + rng() * 0.78;
      const fx = bx + Math.cos(a) * len * t + (rng() - 0.5) * S * 0.09;
      const fy = by + Math.sin(a) * len * t + (rng() - 0.5) * S * 0.09;
      const r = S * (0.018 + rng() * 0.02);
      const base = rng() < 0.58 ? pink : rng() < 0.55 ? pale : white;
      // 花瓣：几片柔边的椭圆叠成一朵
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * TAU + rng() * 0.7;
        softDot(
          g,
          fx + Math.cos(pa) * r * 0.8,
          fy + Math.sin(pa) * r * 0.8,
          r * 0.72,
          r * 0.58,
          pa,
          base,
          0.34 + rng() * 0.22,
        );
      }
      // 花心：一点点更深的粉
      softDot(g, fx, fy, r * 0.4, r * 0.36, 0, rng() < 0.55 ? rose : pink, 0.34);
      if (rng() < 0.25) softDot(g, fx + (rng() - 0.5) * r, fy + (rng() - 0.5) * r, r * 0.3, r * 0.26, 0, white, 0.35);
    }
  }

  punchHoles(g, rng, 8, bx, by - S * 0.32, S * 0.34, S * 0.026, 0.4);
  innerShade(g, S, rng, 0.1, 0.16);
  dryBrush(g, rng, 8, S * 0.1, S * 0.06, S * 0.8, S * 0.86, 0.1);
  softenAlpha(g, S, 0.4, 0.98);
  return c;
}

/* ========================================================================== */
/*  树种参数                                                                   */
/* ========================================================================== */

const SPECIES = {
  pine: {
    defaultH: 0.62,
    variants: 3,
    upBias: 0.55,
    roll: 0.6, // 松针扇面不整圈乱转
    aspect: [1.18, 0.82], // 横向的针叶扇
    leafCap: 10240,
    crownW: 0.46,
    paint: paintPine,
  },
  locust: {
    defaultH: 0.58,
    variants: 3,
    upBias: 0.35,
    roll: TAU,
    aspect: [1.06, 0.94],
    leafCap: 10240,
    crownW: 0.7,
    paint: paintLocust,
  },
  willow: {
    defaultH: 0.78,
    variants: 2,
    upBias: 0.12,
    roll: 0.35,
    aspect: [0.78, 1.28], // 竖着垂下来的柳丝
    leafCap: 8192,
    crownW: 0.8,
    paint: paintWillow,
  },
  blossom: {
    defaultH: 0.46,
    variants: 2,
    upBias: 0.4,
    roll: TAU,
    aspect: [1.05, 0.95],
    leafCap: 6144,
    crownW: 0.64,
    paint: paintBlossom,
  },
};

/* ========================================================================== */
/*  骨架生成：一粒种子长出一棵树                                                */
/* ========================================================================== */

const _noiseV = new THREE.Vector3();
const _refX = new THREE.Vector3(1, 0, 0);

/** 沿 dir 前进，每走一步用噪声 + 向光性 + 重力改一次方向。 */
function samplePath(start, dir, length, segs, cfg, seed) {
  const pts = [start.clone()];
  const d = dir.clone().normalize();
  const p = start.clone();
  const step = length / Math.max(1, segs);
  const ns = cfg.noiseScale ?? 1.1;
  const gravityBase = cfg.gravityBase ?? 0;
  for (let i = 1; i <= segs; i++) {
    const f = i / segs;
    const nx = fbm2(p.x * ns + 13.1, p.z * ns + 7.7, seed, 2);
    const ny = fbm2(p.y * ns + 3.3, p.x * ns + 5.9, seed + 17, 2);
    const nz = fbm2(p.z * ns + 9.1, p.y * ns + 2.3, seed + 31, 2);
    _noiseV.set(nx, ny * 0.5, nz);
    // 只保留垂直于枝方向的分量，否则枝条会像抽搐一样忽长忽短
    _noiseV.addScaledVector(d, -_noiseV.dot(d));
    d.addScaledVector(_noiseV, (cfg.wander ?? 0.35) * (0.35 + 0.85 * f));
    d.y += (cfg.tropism ?? 0.05) * (0.3 + 0.7 * f);
    d.y -= (cfg.gravity ?? 0.01) * (gravityBase + (1 - gravityBase) * f);
    if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
    d.normalize();
    p.addScaledVector(d, step);
    if (p.y < 0.012) {
      p.y = 0.012;
      pts.push(p.clone());
      break;
    }
    pts.push(p.clone());
  }
  return pts;
}

function pointAt(pts, t) {
  const f = Math.min(1, Math.max(0, t)) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(f)));
  return pts[i].clone().lerp(pts[i + 1], f - i);
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 松 / 柏：一根直干，主枝分层轮生，枝梢挂松针扇面。 */
function genPine(rng, variant) {
  const seed = 5000 + variant * 911;
  const branches = [];
  const clusters = [];
  const lean = (rng() - 0.5) * 0.1;
  const trunk = samplePath(
    V(0, 0, 0),
    V(lean, 1, (rng() - 0.5) * 0.1).normalize(),
    1.0,
    3,
    { wander: 0.26, tropism: 0.03, gravity: 0, noiseScale: 1.0 },
    seed,
  );
  branches.push({ pts: trunk, r0: 0.023, r1: 0.004, level: 0 });

  const layers = 4 + (variant === 0 ? 1 : 0);
  for (let l = 0; l < layers; l++) {
    const t = 0.22 + 0.72 * (l / (layers - 1));
    const origin = pointAt(trunk, t);
    const halfW = 0.5 * 0.54 * Math.pow(1 - t, 0.75) * (0.92 + rng() * 0.24);
    const n = 2;
    for (let k = 0; k < n; k++) {
      const az = (k / n) * TAU + l * 2.15 + 0.5 + rng() * 0.7;
      const out = V(Math.cos(az), 0, Math.sin(az));
      const rise = -0.2 + 0.95 * t + (rng() - 0.5) * 0.2;
      const dir = out.clone().addScaledVector(UP, rise).normalize();
      const len = halfW * (1.0 + rng() * 0.35) + 0.03;
      const path = samplePath(origin, dir, len, 1, { wander: 0.22, tropism: 0.02, gravity: 0, noiseScale: 1.6 }, seed + l * 37 + k * 7);
      const r0 = 0.008 * (1 - 0.35 * t);
      branches.push({ pts: path, r0, r1: r0 * 0.2, level: 1 });
      const cs = (0.23 + rng() * 0.06) * (1.02 - 0.26 * t);
      // 球心 = 该层主干上的着生点（略向下压，让松针朝上受光）
      const anchor = origin.clone().addScaledVector(UP, -0.05);
      clusters.push({ p: pointAt(path, 1), size: cs, clump: l, anchor });
      if (l < 2) clusters.push({ p: pointAt(path, 0.52), size: cs * 0.74, clump: l, anchor });
    }
  }
  clusters.push({ p: pointAt(trunk, 1), size: 0.16, clump: layers, anchor: pointAt(trunk, 0.88) });

  return { branches, clusters };
}

/** 槐：短干 + 多分叉，枝条上扬成圆冠。 */
function genLocust(rng, variant) {
  const seed = 7000 + variant * 733;
  const branches = [];
  const clusters = [];
  const trunkLen = 0.4 + rng() * 0.08;
  const trunk = samplePath(
    V(0, 0, 0),
    V((rng() - 0.5) * 0.12, 1, (rng() - 0.5) * 0.12).normalize(),
    trunkLen,
    3,
    { wander: 0.34, tropism: 0.03, gravity: 0, noiseScale: 1.0 },
    seed,
  );
  branches.push({ pts: trunk, r0: 0.026, r1: 0.013, level: 0 });

  const limbs = 4 + (variant === 1 ? 1 : 0);
  for (let i = 0; i < limbs; i++) {
    const t = 0.5 + 0.48 * (i / (limbs - 1));
    const origin = pointAt(trunk, t);
    const az = (i / limbs) * TAU + 0.45 + (rng() - 0.5) * 0.6;
    const pitch = 0.5 + rng() * 0.35;
    const out = V(Math.cos(az), 0, Math.sin(az));
    const dir = out.clone().addScaledVector(UP, pitch).normalize();
    const len = (0.34 + rng() * 0.09) * (1 - 0.15 * t);
    const path = samplePath(origin, dir, len, 2, { wander: 0.4, tropism: 0.06, gravity: 0.014, noiseScale: 1.2 }, seed + i * 31);
    const r0 = 0.015 * (1 - 0.4 * t);
    branches.push({ pts: path, r0, r1: r0 * 0.4, level: 1 });

    // 子枝：让「槐要分叉多」读得出来
    const base = pointAt(path, 0.68);
    const saz = az + (rng() < 0.5 ? -1 : 1) * (0.75 + rng() * 0.55);
    const sdir = V(Math.cos(saz), 0, Math.sin(saz)).addScaledVector(UP, 0.62).normalize();
    const slen = 0.16 + rng() * 0.09;
    const spath = samplePath(base, sdir, slen, 1, { wander: 0.3, tropism: 0.04, gravity: 0.008, noiseScale: 1.8 }, seed + i * 17 + 3);
    const sr0 = 0.0075 * (1 - 0.35 * t);
    branches.push({ pts: spath, r0: sr0, r1: sr0 * 0.25, level: 2 });

    const anchor = pointAt(path, 0.78).addScaledVector(UP, -0.02);
    clusters.push({ p: pointAt(path, 0.55), size: 0.22 + rng() * 0.06, clump: i, anchor });
    clusters.push({ p: pointAt(path, 0.95), size: 0.22 + rng() * 0.05, clump: i, anchor });
    clusters.push({ p: pointAt(spath, 1), size: 0.2 + rng() * 0.05, clump: i, anchor });
  }
  clusters.push({ p: pointAt(trunk, 1), size: 0.18, clump: limbs, anchor: pointAt(trunk, 0.9).addScaledVector(UP, -0.05) });
  // 冠顶补两团，把树冠收圆
  for (let k = 0; k < 2; k++) {
    const a = rng() * TAU;
    const p = pointAt(trunk, 1).add(V(Math.cos(a) * 0.11, 0.06 + rng() * 0.08, Math.sin(a) * 0.11));
    clusters.push({ p, size: 0.17 + rng() * 0.04, clump: limbs, anchor: pointAt(trunk, 0.92).addScaledVector(UP, -0.04) });
  }

  return { branches, clusters };
}

/** 柳：高干 + 拱起的主枝 + 大量下垂柳丝。 */
function genWillow(rng, variant) {
  const seed = 9000 + variant * 571;
  const branches = [];
  const clusters = [];
  const trunkLen = 0.52 + rng() * 0.08;
  const trunk = samplePath(
    V(0, 0, 0),
    V((rng() - 0.5) * 0.1, 1, (rng() - 0.5) * 0.1).normalize(),
    trunkLen,
    3,
    { wander: 0.32, tropism: 0.03, gravity: 0, noiseScale: 1.0 },
    seed,
  );
  branches.push({ pts: trunk, r0: 0.025, r1: 0.013, level: 0 });

  const limbs = 4;
  for (let i = 0; i < limbs; i++) {
    const t = 0.58 + 0.4 * (i / (limbs - 1));
    const origin = pointAt(trunk, t);
    const az = (i / limbs) * TAU + 0.2 + (rng() - 0.5) * 0.7;
    const out = V(Math.cos(az), 0, Math.sin(az));
    const dir = out.clone().addScaledVector(UP, 0.85 + rng() * 0.4).normalize();
    const len = 0.24 + rng() * 0.1;
    const path = samplePath(origin, dir, len, 2, { wander: 0.32, tropism: 0.1, gravity: 0.03, noiseScale: 1.2 }, seed + i * 23);
    const r0 = 0.013 * (1 - 0.4 * t);
    branches.push({ pts: path, r0, r1: r0 * 0.4, level: 1 });

    // 柳丝下垂：球心往下压一点，受光的柳叶才亮得起来
    const anchor = pointAt(path, 1).addScaledVector(UP, -0.2);
    for (let k = 0; k < 2; k++) {
      const at = 0.5 + 0.5 * k;
      const base = pointAt(path, at);
      const saz = az + (k === 0 ? -0.7 : 0.7) + (rng() - 0.5) * 0.5;
      const sdir = V(Math.cos(saz) * 0.6, -0.9, Math.sin(saz) * 0.6).normalize();
      const slen = 0.3 + rng() * 0.16;
      const spath = samplePath(base, sdir, slen, 2, { wander: 0.28, tropism: -0.03, gravity: 0.26, gravityBase: 0.45, noiseScale: 1.4 }, seed + i * 19 + k * 5);
      const sr0 = 0.0055 * (1 - 0.3 * t);
      branches.push({ pts: spath, r0: sr0, r1: sr0 * 0.2, level: 2 });
      clusters.push({ p: pointAt(spath, 0.35), size: 0.27 + rng() * 0.05, clump: i, anchor });
      clusters.push({ p: pointAt(spath, 0.7), size: 0.29 + rng() * 0.06, clump: i, anchor });
      clusters.push({ p: pointAt(spath, 1), size: 0.3 + rng() * 0.06, clump: i, anchor });
    }
    clusters.push({ p: pointAt(path, 1), size: 0.23 + rng() * 0.05, clump: i, anchor });
  }
  clusters.push({ p: pointAt(trunk, 1), size: 0.2, clump: limbs, anchor: pointAt(trunk, 0.9) });

  return { branches, clusters };
}

/** 花树：细干细枝，冠薄，花团挂在枝梢。 */
function genBlossom(rng, variant) {
  const seed = 3000 + variant * 607;
  const branches = [];
  const clusters = [];
  const trunkLen = 0.34 + rng() * 0.08;
  const trunk = samplePath(
    V(0, 0, 0),
    V((rng() - 0.5) * 0.14, 1, (rng() - 0.5) * 0.14).normalize(),
    trunkLen,
    2,
    { wander: 0.4, tropism: 0.03, gravity: 0, noiseScale: 1.0 },
    seed,
  );
  branches.push({ pts: trunk, r0: 0.023, r1: 0.012, level: 0 });

  const limbs = 5;
  for (let i = 0; i < limbs; i++) {
    const t = 0.46 + 0.52 * (i / (limbs - 1));
    const origin = pointAt(trunk, t);
    const az = (i / limbs) * TAU + 0.9 + (rng() - 0.5) * 0.7;
    const pitch = 0.6 + rng() * 0.45;
    const out = V(Math.cos(az), 0, Math.sin(az));
    const dir = out.clone().addScaledVector(UP, pitch).normalize();
    const len = 0.3 + rng() * 0.1;
    const path = samplePath(origin, dir, len, 2, { wander: 0.48, tropism: 0.07, gravity: 0.012, noiseScale: 1.3 }, seed + i * 29);
    const r0 = 0.0105 * (1 - 0.35 * t);
    branches.push({ pts: path, r0, r1: r0 * 0.35, level: 1 });

    // 细枝
    const base = pointAt(path, 0.64);
    const saz = az + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.6);
    const sdir = V(Math.cos(saz), 0, Math.sin(saz)).addScaledVector(UP, 0.75).normalize();
    const spath = samplePath(base, sdir, 0.18 + rng() * 0.1, 1, { wander: 0.35, tropism: 0.05, gravity: 0.01, noiseScale: 1.8 }, seed + i * 13 + 2);
    const sr0 = 0.005 * (1 - 0.35 * t);
    branches.push({ pts: spath, r0: sr0, r1: sr0 * 0.2, level: 2 });

    const anchor = pointAt(path, 0.8).addScaledVector(UP, -0.03);
    clusters.push({ p: pointAt(path, 0.5), size: 0.145 + rng() * 0.03, clump: i, anchor });
    clusters.push({ p: pointAt(path, 0.78), size: 0.155 + rng() * 0.03, clump: i, anchor });
    clusters.push({ p: pointAt(path, 1), size: 0.15 + rng() * 0.035, clump: i, anchor });
    clusters.push({ p: pointAt(spath, 0.65), size: 0.14 + rng() * 0.035, clump: i, anchor });
    clusters.push({ p: pointAt(spath, 1), size: 0.15 + rng() * 0.035, clump: i, anchor });
  }

  return { branches, clusters };
}

const GENERATORS = { pine: genPine, locust: genLocust, willow: genWillow, blossom: genBlossom };

/**
 * 归一化：把树高收到 1（实例矩阵再按 h 缩放），算树冠球心 / 冠幅 / 叶团明暗。
 */
function finishSkeleton(kind, raw, rng) {
  const S = SPECIES[kind];
  const { branches, clusters } = raw;

  let maxY = 1e-3;
  for (const b of branches) for (const p of b.pts) if (p.y > maxY) maxY = p.y;
  for (const c of clusters) if (c.p.y > maxY) maxY = c.p.y;
  const s = 1 / maxY;
  for (const b of branches) {
    for (const p of b.pts) p.multiplyScalar(s);
    b.r0 *= s;
    b.r1 *= s;
  }
  for (const c of clusters) {
    c.p.multiplyScalar(s);
    c.size *= s;
  }

  // 树冠球心：整棵树的叶团重心（只用来算 AO / 冠幅）
  const crownCenter = new THREE.Vector3();
  for (const c of clusters) crownCenter.add(c.p);
  crownCenter.multiplyScalar(1 / clusters.length);

  let crownR = 1e-3;
  for (const c of clusters) crownR = Math.max(crownR, c.p.distanceTo(crownCenter) + c.size * 0.3);
  for (const b of branches) for (const p of b.pts) crownR = Math.max(crownR, Math.hypot(p.x, p.z));

  let topY = 1e-3;
  for (const c of clusters) topY = Math.max(topY, c.p.y);

  // 每团叶子的球心：优先用生成时给的「杈心」，否则用同杈叶团的重心
  const sums = new Map();
  for (const c of clusters) {
    if (c.anchor) continue;
    let e = sums.get(c.clump);
    if (!e) {
      e = { c: new THREE.Vector3(), n: 0 };
      sums.set(c.clump, e);
    }
    e.c.add(c.p);
    e.n += 1;
  }

  // 每个叶团的明暗（假 AO）：冠顶亮、冠底暗、冠心暗、外缘亮
  for (const c of clusters) {
    if (c.anchor) {
      c.center = c.anchor.clone();
    } else {
      const e = sums.get(c.clump);
      c.center = e ? e.c.clone().multiplyScalar(1 / e.n) : crownCenter.clone();
    }
    const hf = Math.min(1, Math.max(0, c.p.y / topY));
    const rad = Math.min(1, c.p.distanceTo(crownCenter) / Math.max(0.02, crownR));
    c.t = hf;
    c.ao = (0.68 + 0.4 * hf) * (0.9 + 0.2 * rad);
    c.roll = (rng() - 0.5) * S.roll;
  }

  return { branches, clusters, crownCenter, crownR };
}

/* ========================================================================== */
/*  骨架 → 管道几何（合并成一个 BufferGeometry）                                */
/* ========================================================================== */

/** 每层树枝的截面边数：主干圆一点，枝梢省一点。 */
const RAD_BY_LEVEL = [4, 3, 3];

function buildBranchGeometry(branches) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const ink = new THREE.Color(0x30332d); // 枝干墨色（线性空间）
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bit = new THREE.Vector3();
  const ref = new THREE.Vector3();
  let vBase = 0;

  for (const b of branches) {
    const pts = b.pts;
    const n = pts.length;
    if (n < 2) continue;
    const RAD = RAD_BY_LEVEL[Math.min(RAD_BY_LEVEL.length - 1, b.level)];
    tan.subVectors(pts[1], pts[0]).normalize();
    ref.copy(Math.abs(tan.y) > 0.9 ? _refX : UP);
    nrm.crossVectors(tan, ref).normalize();

    for (let i = 0; i < n; i++) {
      if (i === 0) tan.subVectors(pts[1], pts[0]).normalize();
      else if (i === n - 1) tan.subVectors(pts[n - 1], pts[n - 2]).normalize();
      else tan.subVectors(pts[i + 1], pts[i - 1]).normalize();
      // 平行传输标架：把上一圈的法线投影到当前切平面，避免扭转
      nrm.addScaledVector(tan, -nrm.dot(tan));
      if (nrm.lengthSq() < 1e-8) nrm.crossVectors(tan, ref);
      nrm.normalize();
      bit.crossVectors(tan, nrm).normalize();

      const t = i / (n - 1);
      const r = b.r0 + (b.r1 - b.r0) * Math.pow(t, 0.62);
      const flare = i === 0 ? 1.36 : 1; // 根部一点起翘，像树根扎进纸里
      const rr = r * flare;
      for (let j = 0; j < RAD; j++) {
        const a = (j / RAD) * TAU;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = nrm.x * ca + bit.x * sa;
        const ny = nrm.y * ca + bit.y * sa;
        const nz = nrm.z * ca + bit.z * sa;
        pos.push(pts[i].x + nx * rr, pts[i].y + ny * rr, pts[i].z + nz * rr);
        nor.push(nx, ny, nz);
        // 顶点色当 AO：枝越细越暗，梢部略淡，背光面再压一点
        const shade =
          (0.68 + 0.32 * (1 - Math.abs(ny) * 0.55)) * (1 - Math.min(0.3, b.level * 0.08)) * (0.84 + 0.26 * (1 - t));
        col.push(ink.r * shade, ink.g * shade, ink.b * shade);
      }
    }

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = vBase + i * RAD + j;
        const a1 = vBase + i * RAD + ((j + 1) % RAD);
        const b1 = vBase + (i + 1) * RAD + ((j + 1) % RAD);
        const b2 = vBase + (i + 1) * RAD + j;
        idx.push(a, a1, b2, a1, b1, b2);
      }
    }
    vBase += n * RAD;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/* ========================================================================== */
/*  叶团几何 / 材质                                                             */
/* ========================================================================== */

let _leafQuadGeo = null;
function leafQuadGeometry() {
  if (_leafQuadGeo) return _leafQuadGeo;
  // 局部 XY 平面，边长 1（广告牌在顶点着色器里做）
  const geo = new THREE.PlaneGeometry(1, 1);
  // 顶点色：上亮下暗，让每团叶子自己有一点从上往下的光线过渡
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const v = 0.74 + 0.34 * (y + 0.5);
    const w = 0.94 + 0.06 * (x + 0.5);
    colors[i * 3] = v * w;
    colors[i * 3 + 1] = v * w;
    colors[i * 3 + 2] = v * (0.96 + 0.04 * (x + 0.5));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  _leafQuadGeo = geo;
  return _leafQuadGeo;
}

/**
 * 叶团材质：
 *   · 顶点着色器里做全向广告牌（鸟瞰 / 低角度都看得见）；
 *   · 法线 = 「树冠球心 → 叶团顶点」的球面方向；
 *   · 风：整团平移 + 自身轻轻开合。
 */
function makeLeafMaterial(map) {
  const mat = new THREE.MeshLambertMaterial({
    map,
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    // cutout 保证叶团颜色够实、不糊成一片；
    // 但 depthWrite 关掉，别让后期在每团叶子上都描一圈墨线（那就成一颗颗卷心菜了）
    transparent: false,
    depthWrite: false,
    alphaTest: 0.14,
    toneMapped: false,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWind;
        attribute vec3 aCenter;   // 树冠球心（世界空间）
        attribute float aPhase;   // 风相位
        attribute float aRoll;    // 片自身滚转
        attribute float aSway;    // 风摆幅度
        vec3 gLeafCenter;         // 叶团世界中心
        vec2 gLeafSize;           // 叶团世界尺寸（x/y 可以不同）
        vec2 gLeafOffset;         // 广告牌平面内偏移（已滚转）
        `,
      )
      // 球面法线：树冠球心 → 叶团顶点
      .replace(
        '#include <beginnormal_vertex>',
        `
        vec3 objectNormal = vec3(0.0, 1.0, 0.0);
        gLeafCenter = vec3(0.0);
        gLeafSize = vec2(1.0, 1.0);
        gLeafOffset = vec2(0.0);
        #ifdef USE_INSTANCING
          gLeafCenter = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          gLeafSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          float rl = aRoll;
          float cr = cos(rl);
          float sr = sin(rl);
          gLeafOffset = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr);
          // 相机的世界右 / 上方向（viewMatrix 的行），用来把广告牌偏移还原到世界空间
          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 worldVert = gLeafCenter + camRight * (gLeafOffset.x * gLeafSize.x) + camUp * (gLeafOffset.y * gLeafSize.y);
          vec3 sphDir = worldVert - aCenter;
          float sphLen = length(sphDir);
          objectNormal = sphLen > 0.0001 ? sphDir / sphLen : vec3(0.0, 1.0, 0.0);
        #endif
        `,
      )
      // 球面法线已经是世界空间，不能再被 instanceMatrix 转一次
      .replace(
        '#include <defaultnormal_vertex>',
        `
        vec3 transformedNormal = normalMatrix * objectNormal;
        #ifdef FLIP_SIDED
          transformedNormal = -transformedNormal;
        #endif
        `,
      )
      // 广告牌 + 风：替换整个 project_vertex
      .replace(
        '#include <project_vertex>',
        `
        vec4 mvPosition = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          // 风：整团在世界上平移（越高的叶团摆得越明显）
          float windT = uWind * 1.05 + aPhase;
          float gust = sin(windT) * 0.72 + sin(uWind * 2.31 + aPhase * 1.7) * 0.28;
          float amp = aSway * 0.05;
          gLeafCenter.x += gust * amp;
          gLeafCenter.z += gust * amp * 0.55;
          gLeafCenter.y += sin(uWind * 1.7 + aPhase * 1.3) * amp * 0.3;
          mvPosition = modelViewMatrix * vec4(gLeafCenter, 1.0);
          // 自身轻微开合
          float flap = sin(uWind * 2.4 + aPhase * 2.1) * 0.05;
          float fcr = cos(flap);
          float fsr = sin(flap);
          vec2 p = vec2(gLeafOffset.x * fcr - gLeafOffset.y * fsr, gLeafOffset.x * fsr + gLeafOffset.y * fcr);
          mvPosition.xy += p * gLeafSize * (1.0 + flap * 0.5);
        #else
          mvPosition = modelViewMatrix * vec4(position, 1.0);
        #endif
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
    // 双面材质会按面朝向翻法线，把球形法线打碎；这里强制用插值后的球面法线
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      #ifndef FLAT_SHADED
        normal = normalize(vNormal);
      #endif
      `,
    );
  };
  return mat;
}

/** 枝干材质：顶点色 AO + 风。 */
const _branchMat = new THREE.MeshLambertMaterial({
  color: 0xffffff,
  vertexColors: true,
  toneMapped: false,
});
_branchMat.onBeforeCompile = (shader) => {
  shader.uniforms.uWind = WIND;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uWind;')
    .replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float wgt = smoothstep(0.3, 1.0, clamp(position.y, 0.0, 1.0));
        float wp = uWind * 0.85 + iPos.x * 0.37 + iPos.z * 0.29;
        transformed.x += sin(wp) * wgt * 0.012;
        transformed.z += cos(wp * 1.27 + 0.6) * wgt * 0.009;
      #endif
      `,
    );
};

/* ========================================================================== */
/*  实例池：全场景共享的 (种 × 变体) 批次                                       */
/* ========================================================================== */

const LEAF_CAP = 8192;
const BRANCH_CAP = 2048;

const REG = {
  built: false,
  mounted: false,
  root: null,
  buckets: new Map(),
  ctxs: new Set(),
};

function makeLeafPage(bucket) {
  const geo = bucket.leafGeo.clone();
  const cap = bucket.S.leafCap || LEAF_CAP;
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  geo.setAttribute('aRoll', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  const mesh = new THREE.InstancedMesh(geo, bucket.leafMat, cap);
  mesh.name = `flora-${bucket.kind}${bucket.variant}-leaf`;
  mesh.frustumCulled = false;
  // 叶团不写深度（避免后期给每团叶子描边），所以必须排在所有不透明几何之后画，
  // 否则会被后画的屋顶整片盖掉。
  mesh.renderOrder = 10;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  REG.root.add(mesh);
  const page = {
    mesh,
    cap,
    used: 0,
    centers: geo.getAttribute('aCenter'),
    phases: geo.getAttribute('aPhase'),
    rolls: geo.getAttribute('aRoll'),
    sways: geo.getAttribute('aSway'),
  };
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  return page;
}

function makeBranchPage(bucket) {
  const mesh = new THREE.InstancedMesh(bucket.branchGeo, _branchMat, BRANCH_CAP);
  mesh.name = `flora-${bucket.kind}${bucket.variant}-stem`;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  REG.root.add(mesh);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  return { mesh, cap: BRANCH_CAP, used: 0 };
}

function leafPage(bucket) {
  let p = bucket.leafPages[bucket.leafPages.length - 1];
  if (!p || p.used >= p.cap) {
    p = makeLeafPage(bucket);
    bucket.leafPages.push(p);
  }
  return p;
}

function branchPage(bucket) {
  let p = bucket.branchPages[bucket.branchPages.length - 1];
  if (!p || p.used >= p.cap) {
    p = makeBranchPage(bucket);
    bucket.branchPages.push(p);
  }
  return p;
}

/* ========================================================================== */
/*  建批次                                                                     */
/* ========================================================================== */

function buildAllAssets() {
  REG.built = true;
  REG.root = new THREE.Group();
  REG.root.name = 'flora-shared';
  for (const kind of Object.keys(SPECIES)) {
    const S = SPECIES[kind];
    for (let variant = 0; variant < S.variants; variant++) {
      const rng = makeRng(0x5f3a + variant * 9173 + kind.length * 733);
      const raw = GENERATORS[kind](rng, variant);
      const sk = finishSkeleton(kind, raw, rng);
      const bucket = {
        kind,
        variant,
        S,
        sk,
        branchGeo: buildBranchGeometry(sk.branches),
        leafGeo: leafQuadGeometry(),
        leafMat: makeLeafMaterial(toTexture(S.paint(variant))),
        branchPages: [],
        leafPages: [],
        trees: 0,
        clusterCount: 0,
      };
      REG.buckets.set(`${kind}:${variant}`, bucket);
    }
  }
}

/* ========================================================================== */
/*  对外 API                                                                   */
/* ========================================================================== */

const _treeRng = makeRng(0x1a2b3c4d);
const _treeM = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _identQ = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _instColor = new THREE.Color();
const _m4 = new THREE.Matrix4();
const _centerW = new THREE.Vector3();
const _worldP = new THREE.Vector3();
const _sizeV = new THREE.Vector3();

/**
 * 生成一组树。
 * specs: [{ kind: 'willow'|'locust'|'pine'|'blossom', x, z, y?, h?, w?, rot? }]
 */
export function buildTrees(specs = [], ctx = null) {
  const group = new THREE.Group();
  group.name = 'flora';
  if (!Array.isArray(specs) || !specs.length) return group;

  if (!REG.built) buildAllAssets();

  // 第一批的批次挂到场景（或本组）上，之后所有模块的树都追加进来
  if (!REG.mounted) {
    REG.mounted = true;
    if (ctx && ctx.scene && ctx.scene.isObject3D) ctx.scene.add(REG.root);
    else group.add(REG.root);
  }

  if (ctx && typeof ctx.onTick === 'function' && !REG.ctxs.has(ctx)) {
    REG.ctxs.add(ctx);
    ctx.onTick((t) => {
      WIND.value = t;
    });
  }

  const quality = (ctx && ctx.quality) || 'high';
  const low = quality === 'low';
  const dirtyBuckets = new Set();

  for (let si = 0; si < specs.length; si++) {
    const spec = specs[si];
    const kind = SPECIES[spec.kind] ? spec.kind : 'locust';
    const S = SPECIES[kind];
    const variant = Math.floor(_treeRng() * S.variants) % S.variants;
    const bucket = REG.buckets.get(`${kind}:${variant}`);
    if (!bucket) continue;

    const hBase = spec.h ?? S.defaultH;
    const h = Math.max(0.03, hBase * (0.92 + _treeRng() * 0.16));
    const wMul = spec.w ? Math.max(0.4, spec.w / S.crownW) : 1;
    const rot = spec.rot ?? _treeRng() * TAU;

    // 树实例矩阵：落点 + 随机朝向 + 一点点歪（像手种下去的）
    _euler.set((_treeRng() - 0.5) * 0.05, rot, (_treeRng() - 0.5) * 0.05, 'YXZ');
    _quat.setFromEuler(_euler);
    _pos.set(spec.x || 0, spec.y ?? 0, spec.z || 0);
    _scl.set(h * wMul, h, h * wMul);
    _treeM.compose(_pos, _quat, _scl);

    // —— 枝条实例 ——
    const bp = branchPage(bucket);
    bp.mesh.setMatrixAt(bp.used, _treeM);
    const bt = 0.82 + _treeRng() * 0.26;
    _instColor.setRGB(bt, bt, bt * 0.985);
    bp.mesh.setColorAt(bp.used, _instColor);
    bp.used += 1;

    // —— 叶团实例 ——
    const clusters = bucket.sk.clusters;
    const step = low && clusters.length > 10 ? 2 : 1;
    for (let ci = 0; ci < clusters.length; ci += step) {
      const c = clusters[ci];
      // 叶团世界中心（受树的落点 / 朝向 / 缩放影响）
      _worldP.copy(c.p).applyMatrix4(_treeM);
      // 球心也变换到世界空间
      _centerW.copy(c.center).applyMatrix4(_treeM);
      const sizeW = h * c.size * (0.9 + _treeRng() * 0.24);
      _m4.compose(
        _worldP,
        _identQ,
        _sizeV.set(sizeW * S.aspect[0], sizeW * S.aspect[1], sizeW),
      );

      // 明暗：假 AO（冠顶亮、冠底暗、冠心暗、外缘亮）+ 随机
      const tint = Math.min(1.22, c.ao * (0.9 + _treeRng() * 0.24));
      const warm = 0.982 + _treeRng() * 0.045;
      _instColor.setRGB(tint, tint * warm, tint * 0.98);

      const lp = leafPage(bucket);
      const i = lp.used;
      lp.mesh.setMatrixAt(i, _m4);
      lp.mesh.setColorAt(i, _instColor);
      lp.centers.setXYZ(i, _centerW.x, _centerW.y, _centerW.z);
      lp.phases.setX(i, _treeRng() * TAU + _pos.x * 0.21 + _pos.z * 0.17);
      lp.rolls.setX(i, c.roll + (_treeRng() - 0.5) * 0.35);
      lp.sways.setX(i, 0.5 + c.t * 1.4);
      lp.used += 1;
      bucket.clusterCount += 1;
    }
    bucket.trees += 1;
    dirtyBuckets.add(bucket);
  }

  flushBuckets(dirtyBuckets);
  updateDebugInfo();
  return group;
}

function flushBuckets(buckets) {
  for (const b of buckets) {
    for (const p of b.branchPages) {
      p.mesh.count = p.used;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
    for (const p of b.leafPages) {
      p.mesh.count = p.used;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      p.centers.needsUpdate = true;
      p.phases.needsUpdate = true;
      p.rolls.needsUpdate = true;
      p.sways.needsUpdate = true;
    }
  }
}

/** 调试面板 / 截图脚本用：树模块真实的 draw call 与三角形估算。 */
function updateDebugInfo() {
  let trees = 0;
  let draws = 0;
  let tris = 0;
  const buckets = [];
  for (const b of REG.buckets.values()) {
    const leafTris = b.leafGeo.index ? b.leafGeo.index.count / 3 : 0;
    const stemTris = b.branchGeo.index ? b.branchGeo.index.count / 3 : 0;
    trees += b.trees;
    draws += b.branchPages.length + b.leafPages.length;
    tris += b.trees * stemTris + b.clusterCount * leafTris;
    buckets.push({
      kind: b.kind,
      variant: b.variant,
      trees: b.trees,
      leaves: b.clusterCount,
      stemTris,
      leafTris,
      branchDraws: b.branchPages.length,
      leafDraws: b.leafPages.length,
    });
  }
  const info = { trees, draws, tris, buckets };
  if (typeof window !== 'undefined') window.__flora = info;
  return info;
}

/** 便捷：沿一条线撒一排树（签名与 v2 完全一致）。 */
export function lineOfTrees({ from, to, count = 10, kind = 'willow', h = 0.8, jitter = 0.5, seed = 7, y = 0 }) {
  const rng = makeRng(seed);
  const specs = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = from[0] + (to[0] - from[0]) * t + (rng() - 0.5) * jitter * 2;
    const z = from[1] + (to[1] - from[1]) * t + (rng() - 0.5) * jitter * 2;
    specs.push({ kind, x, z, y, h: h * (0.88 + rng() * 0.3) });
  }
  return specs;
}
