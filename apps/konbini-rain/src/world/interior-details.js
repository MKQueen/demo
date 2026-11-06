/**
 * world/interior-details.js —— 便利店店内「细节点心」层。
 *
 * 叠在 interior.js 的基础布局之上（地砖/货架/冷柜/收银台/热食/关东煮/咖啡机/
 * ATM/复印机/杂志架/灯牌/监控球机 都由 interior.js 负责），本模块只补充：
 *
 *   - 后场 staff 区：咖啡机支撑台、员工储物柜、扫除道具（拖把桶/扫帚）、纸箱、
 *     员工凳、灭火器 + 消火器贴纸、小垃圾桶
 *   - 货架：层板前缘价格槽条（instanced）、Shelftalker 小 POP、便当柜价格槽
 *   - 天花板：喇叭 / 烟感 / 喷淋头 / 第二颗监控球机（带呼吸灯） / 窗边小吊旗
 *   - 玻璃内侧小贴纸：24時間営業 / 支払い方法 / 防犯カメラ / 営業中 / レジ袋有料
 *   - 地面：「レジ」贴纸 + 箭头 refinement（不覆盖已有黄色引导线）/ 暖光光斑 / 落小票
 *   - 右墙挂钟（秒针走动）、入口分类垃圾桶、垃圾分别贴纸
 *   - 收银台：レジ袋 dispenser、笔筒/卡片座/割箸盒、台面小物
 *   - 卖场：门口小促销立牌（おでん）
 *
 * 坐标全部取自 Lead 的 interior.js，不新增真实 PointLight，不覆盖已有导视。
 */
import * as THREE from 'three';
import { C, L } from '../config.js';
import { TEX, canvasTexture, JP_FONT, EN_FONT, roundRect, labelTex, decalMaterial } from '../lib/textures.js';
import { toon, flat, lightbox, glowTexture, addOutline } from '../lib/toon.js';
import { box, roundedBox, plane, cyl, sphere, group, shadow, planeGeo, DEG } from '../lib/kit.js';

const I = L.store.interior;
const FLOOR = I.floorY; // 0.14
const CEIL = I.ceilY; // 2.52
const WALL_R = I.maxX; // 1.52
const WALL_L = I.minX; // -2.72

/* ========================================================================== */
/*  与 interior.js 对齐的布局常量                                                */
/* ========================================================================== */

const LAY = {
  // 货架（gondola）：三排中心 z，层板顶面相对地面高度，货架长度/进深
  rowZ: [-1.0, -1.95, -2.9],
  rowDepth: 0.34,
  lenX0: -2.15,
  lenX1: 0.05,
  tiers: [0.12, 0.46, 0.8, 1.14],
  // 收银台（正面朝 +Z）
  counter: { x0: 0.15, x1: 1.45, zFront: -2.9, zBack: -3.38, top: 1.15 },
  // 咖啡机（后场小台面上）
  coffee: { x: 1.18, z: -3.86 },
  // 便当冷藏柜（左墙，开放区朝 +X）
  bento: { x: -2.55, d: 0.34, z0: -2.42, z1: -0.72, floor0: 0.24, step: 0.34 },
  // 后场区
  staff: { minX: 0.2, maxX: 1.5, minZ: -4.42, maxZ: -3.45 },
};

/* ========================================================================== */
/*  程序化贴图                                                                 */
/* ========================================================================== */

let TEXC = null;
function tex() {
  if (TEXC) return TEXC;

  /* --- 层板前缘价格槽：白底 + 一排彩色价签 --- */
  const priceRail = canvasTexture(2048, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f7f3e6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(32,48,79,0.18)';
    ctx.fillRect(0, h - 5, w, 5);
    const tagColors = ['#fbf3dd', '#ffe8b0', '#ffd0c4', '#c9f0e4', '#d8e8ff', '#fbf3dd'];
    const prices = ['¥128', '¥98', '¥198', '¥158', '¥248', '¥88', '¥178', '¥120', '¥298', '¥108'];
    const tagW = 118;
    const gap = 10;
    let i = 0;
    for (let x = 6; x + tagW < w; x += tagW + gap) {
      const col = tagColors[i % tagColors.length];
      ctx.fillStyle = col;
      roundRect(ctx, x, 6, tagW, h - 14, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(32,48,79,0.14)';
      ctx.lineWidth = 2;
      roundRect(ctx, x, 6, tagW, h - 14, 6);
      ctx.stroke();
      // 小色条（品类）
      ctx.fillStyle = ['#ff7a5e', '#3fa8a0', '#ffc96b', '#7ab0e0'][i % 4];
      ctx.fillRect(x + 6, 10, 14, h - 22);
      ctx.fillStyle = '#20304f';
      ctx.font = `700 30px ${EN_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(prices[i % prices.length], x + 28, h / 2 + 1);
      i += 1;
    }
  });

  /* --- 玻璃贴纸：いらっしゃいませ（不与 store.js 的 24H 贴纸重复） --- */
  const g24 = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(251,243,221,0.94)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 20);
    ctx.fill();
    ctx.strokeStyle = '#3fa8a0';
    ctx.lineWidth = 6;
    roundRect(ctx, 4, 4, w - 8, h - 8, 20);
    ctx.stroke();
    ctx.fillStyle = '#20304f';
    ctx.font = `700 56px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('いらっしゃいませ', w / 2, h / 2 - 12);
    ctx.fillStyle = '#3fa8a0';
    ctx.font = `600 30px ${EN_FONT}`;
    ctx.fillText('WELCOME  ·  TSUKIMI MART', w / 2, h / 2 + 38);
    ctx.textAlign = 'left';
  });

  /* --- 玻璃贴纸：支払い方法 --- */
  const payStrip = canvasTexture(768, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cells = [
      { bg: '#e60012', fg: '#ffffff', text: 'PayPay' },
      { bg: '#004098', fg: '#ffffff', text: '交通系' },
      { bg: '#1b3fa0', fg: '#ffffff', text: 'VISA' },
      { bg: '#3fa8a0', fg: '#ffffff', text: '現金' },
    ];
    const cw = w / cells.length;
    cells.forEach((c, i) => {
      const x = i * cw + 6;
      ctx.fillStyle = c.bg;
      roundRect(ctx, x, 10, cw - 12, h - 20, 12);
      ctx.fill();
      ctx.fillStyle = c.fg;
      ctx.font = `800 34px ${EN_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.text, x + (cw - 12) / 2, h / 2 - 12);
      ctx.font = `600 20px ${JP_FONT}`;
      ctx.fillText('ご利用いただけます', x + (cw - 12) / 2, h / 2 + 30);
    });
    ctx.textAlign = 'left';
  });

  /* --- 玻璃贴纸：防犯カメラ --- */
  const camSticker = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(251,243,221,0.94)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 16);
    ctx.fill();
    ctx.strokeStyle = '#3f5f8a';
    ctx.lineWidth = 6;
    roundRect(ctx, 4, 4, w - 8, h - 8, 16);
    ctx.stroke();
    ctx.fillStyle = '#3f5f8a';
    ctx.beginPath();
    ctx.arc(64, h / 2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4efe0';
    ctx.beginPath();
    ctx.arc(64, h / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20304f';
    ctx.textBaseline = 'middle';
    ctx.font = `700 40px ${JP_FONT}`;
    ctx.fillText('防犯カメラ', 116, h / 2 - 22);
    ctx.font = `600 30px ${JP_FONT}`;
    ctx.fillText('作動中です', 116, h / 2 + 26);
  });

  /* --- 玻璃贴纸：営業中 --- */
  const openSticker = canvasTexture(384, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(32,48,79,0.92)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 18);
    ctx.fill();
    ctx.fillStyle = '#ffc96b';
    ctx.font = `800 74px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('営業中', w / 2, h / 2);
    ctx.textAlign = 'left';
  });

  /* --- 地面「レジ」贴纸（透明底） --- */
  const floorRegi = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,205,92,0.92)';
    roundRect(ctx, 12, 26, w - 24, h - 52, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 8;
    roundRect(ctx, 12, 26, w - 24, h - 52, 24);
    ctx.stroke();
    ctx.fillStyle = '#20304f';
    ctx.font = `800 112px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('レジ', w / 2, h / 2 - 4);
    ctx.font = `700 30px ${EN_FONT}`;
    ctx.fillText('CASHIER', w / 2, h / 2 + 70);
    ctx.textAlign = 'left';
  });

  /* --- 地面小箭头（透明底） --- */
  const floorArrow = canvasTexture(256, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(63,168,160,0.88)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w - 40, 170);
    ctx.lineTo(w / 2 + 34, 170);
    ctx.lineTo(w / 2 + 34, h - 40);
    ctx.lineTo(w / 2 - 34, h - 40);
    ctx.lineTo(w / 2 - 34, 170);
    ctx.lineTo(40, 170);
    ctx.closePath();
    ctx.fill();
  });

  /* --- 灭火器贴纸 --- */
  const fireSticker = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9482f';
    roundRect(ctx, 8, 8, w - 16, h - 16, 20);
    ctx.fill();
    ctx.fillStyle = '#fff4e2';
    ctx.font = `800 74px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('消火器', w / 2, 96);
    ctx.font = `700 26px ${EN_FONT}`;
    ctx.fillText('FIRE EXTINGUISHER', w / 2, 172);
  });

  /* --- 垃圾分别贴纸 --- */
  const recycleSign = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(251,243,221,0.94)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 16);
    ctx.fill();
    ctx.strokeStyle = '#3fa8a0';
    ctx.lineWidth = 6;
    roundRect(ctx, 4, 4, w - 8, h - 8, 16);
    ctx.stroke();
    ctx.fillStyle = '#20304f';
    ctx.textBaseline = 'middle';
    ctx.font = `700 38px ${JP_FONT}`;
    ctx.fillText('ゴミは分別にご協力ください', 24, h / 2);
  });

  /* --- 玻璃贴纸：レジ袋有料 --- */
  const bagSticker = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(63,168,160,0.92)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 14);
    ctx.fill();
    ctx.fillStyle = '#f4fffb';
    ctx.textBaseline = 'middle';
    ctx.font = `700 38px ${JP_FONT}`;
    ctx.fillText('レジ袋は有料です', 24, h / 2 - 20);
    ctx.font = `600 26px ${JP_FONT}`;
    ctx.fillText('S ¥3 / M ¥5 / L ¥10', 24, h / 2 + 32);
  });

  /* --- 窗边吊旗（竖排字） --- */
  const makeBanner = (text, sub, bg, fg, accent) =>
    canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w, 42);
      ctx.fillRect(0, h - 42, w, 42);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = text.split('');
      const step = (h - 160) / chars.length;
      ctx.font = `800 88px ${JP_FONT}`;
      chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 110 + i * step));
      ctx.fillStyle = accent;
      ctx.font = `700 30px ${EN_FONT}`;
      ctx.fillText(sub, w / 2, h - 64);
      ctx.textAlign = 'left';
    });
  const bannerOden = makeBanner('おでん', 'ODEN', '#7a2f24', '#ffe8bc', '#ffc96b');
  const bannerKaraage = makeBanner('からあげ', 'KARAAGE', '#8a4a1e', '#fff0d4', '#ffb45e');
  const bannerCoffee = makeBanner('コーヒー', 'COFFEE', '#20304f', '#ffe3b0', '#ffc96b');

  /* --- 挂钟表盘 --- */
  const clockFace = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f7f3e8';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20304f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    ctx.stroke();
    // 刻度
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const r0 = i % 3 === 0 ? 86 : 96;
      ctx.strokeStyle = '#20304f';
      ctx.lineWidth = i % 3 === 0 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
      ctx.lineTo(w / 2 + Math.cos(a) * 108, h / 2 + Math.sin(a) * 108);
      ctx.stroke();
    }
    ctx.fillStyle = '#3fa8a0';
    ctx.font = `700 22px ${EN_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('TSUKIMI', w / 2, h / 2 + 54);
    ctx.textAlign = 'left';
  });

  /* --- 分类垃圾桶标签 --- */
  const binLabel = (text, sub, bg, fg) =>
    canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 34px ${JP_FONT}`;
      ctx.fillText(text, w / 2, h / 2 - 16);
      ctx.font = `600 20px ${EN_FONT}`;
      ctx.fillText(sub, w / 2, h / 2 + 26);
      ctx.textAlign = 'left';
    });

  TEXC = {
    priceRail, g24, payStrip, camSticker, openSticker, floorRegi, floorArrow,
    fireSticker, recycleSign, bagSticker, bannerOden, bannerKaraage, bannerCoffee,
    clockFace,
    binCan: binLabel('かん・びん', 'CANS & BOTTLES', '#3f6fb0', '#f4f8ff'),
    binPet: binLabel('ペットボトル', 'PET BOTTLES', '#3fa8a0', '#f4fffb'),
    popNew: labelTex({ w: 384, h: 256, bg: '#ff7a5e', fg: '#fff7e3', text: '新発売', sub: 'NEW', size: 96 }),
    popNo1: labelTex({ w: 384, h: 256, bg: '#3fa8a0', fg: '#f4fffb', text: '人気No.1', sub: 'からあげ', size: 72 }),
    pop100: labelTex({ w: 384, h: 256, bg: '#ffc96b', fg: '#3a2a08', text: '100円', sub: 'お試し価格', size: 92 }),
    popRecommend: labelTex({ w: 384, h: 256, bg: '#20304f', fg: '#ffd9a0', text: 'おすすめ', sub: '店長イチオシ', size: 76 }),
    bagBox: labelTex({ w: 512, h: 192, bg: '#f7f3e8', fg: '#20304f', text: 'レジ袋', sub: 'S ¥3 / M ¥5 / L ¥10', size: 64 }),
    chopstick: labelTex({ w: 512, h: 160, bg: '#f7f3e8', fg: '#a2622c', text: 'お箸・スプーン', sub: 'ご自由にお取りください', size: 46 }),
  };
  return TEXC;
}

/* ========================================================================== */
/*  build                                                                      */
/* ========================================================================== */

export function buildInteriorDetails(ctx) {
  const { handles } = ctx;
  const T = tex();
  const g = group('interior-details');
  const solid = group('details-solid');
  const emit = group('details-emit');
  g.add(solid, emit);

  /* ------------------------------ 材质 ------------------------------ */
  const M = {
    cream: toon('#f0e9d9', { gradient: 'soft', rim: 0.1, rimColor: '#ffe6b8' }),
    white: toon('#f7f3e8', { gradient: 'soft', rim: 0.08, rimColor: '#ffe6b8' }),
    steel: toon('#b9c0c8', { gradient: 'soft', rim: 0.22, rimColor: '#eef8ff' }),
    steelDark: toon('#7e858f', { gradient: 'soft', rim: 0.18 }),
    dark: toon('#2b313a', { gradient: 'soft', rim: 0.14, rimColor: '#8fb4dd' }),
    red: toon('#cf4a3c', { gradient: 'soft', rim: 0.2, rimColor: '#ffb0a0' }),
    blue: toon('#3f6fb0', { gradient: 'soft', rim: 0.16 }),
    teal: toon('#3fa8a0', { gradient: 'soft', rim: 0.16, rimColor: '#8ff0e8' }),
    navy: toon('#24334f', { gradient: 'soft', rim: 0.14 }),
    amber: toon('#c98a3c', { gradient: 'soft', rim: 0.16 }),
    pet: flat('#bfe8e0', { transparent: true, opacity: 0.6 }),
    cans: flat('#cfe4f5', { transparent: true, opacity: 0.6 }),
  };

  const nn = (m) => {
    m.userData.noOutline = true;
    return m;
  };
  const lit = (w, h, map, opts = {}) => {
    const m = plane(w, h, lightbox(map, opts.intensity ?? 1.0), { cast: false, receive: false, ...opts });
    return nn(m);
  };
  const decal = (w, h, map, opts = {}) => {
    const m = plane(w, h, decalMaterial(map, { opacity: opts.opacity ?? 1 }), {
      cast: false,
      receive: false,
      ...opts,
    });
    return nn(m);
  };
  const litCol = (w, h, color, mult = 1.3, opts = {}) => {
    const mat = flat(color);
    mat.color.multiplyScalar(mult);
    const m = plane(w, h, mat, { cast: false, receive: false, ...opts });
    return nn(m);
  };

  /* ======================================================================== */
  /*  A. 后场 staff 区：咖啡机支撑台 / 储物柜 / 扫除道具 / 灭火器               */
  /* ======================================================================== */

  const S = LAY.staff;
  const staffArea = group('staff-area');

  /* --- 咖啡机不锈钢后柜台（托住 interior.js 的咖啡机，消灭悬空） --- */
  {
    const table = group('coffee-stand');
    const tx0 = 0.93;
    const tx1 = 1.43;
    const tz0 = -4.08;
    const tz1 = -3.62;
    const tx = (tx0 + tx1) / 2;
    const tz = (tz0 + tz1) / 2;
    // 不锈钢台面（顶面 1.18，正好接住咖啡机底座）
    box(tx1 - tx0, 0.035, tz1 - tz0, M.steel, { x: tx, y: 1.16, z: tz, parent: table, cast: false });
    box(tx1 - tx0 + 0.03, 0.02, tz1 - tz0 + 0.03, M.steelDark, { x: tx, y: 1.135, z: tz, parent: table, cast: false });
    // 下层板
    box(tx1 - tx0 - 0.04, 0.02, tz1 - tz0 - 0.04, M.steelDark, { x: tx, y: 0.45, z: tz, parent: table, cast: false });
    // 四腿 + 横撑
    for (const [lx, lz] of [
      [tx0 + 0.03, tz0 + 0.03],
      [tx1 - 0.03, tz0 + 0.03],
      [tx0 + 0.03, tz1 - 0.03],
      [tx1 - 0.03, tz1 - 0.03],
    ]) {
      cyl(0.014, 0.014, 1.0, 8, M.steel, { x: lx, y: 0.64, z: lz, parent: table, cast: false });
    }
    // 下层收纳：纸箱 / 糖浆瓶 / 备品
    box(0.26, 0.2, 0.3, toon('#b99460', { gradient: 'soft', rim: 0.12 }), { x: 1.03, y: 0.56, z: tz, parent: table, cast: false });
    box(0.2, 0.02, 0.24, toon('#d8c8a0'), { x: 1.03, y: 0.665, z: tz, parent: table, cast: false });
    for (let i = 0; i < 3; i += 1) {
      cyl(0.03, 0.03, 0.14, 8, i === 0 ? M.amber : i === 1 ? M.cream : M.blue, {
        x: 1.33,
        y: 0.53,
        z: tz - 0.1 + i * 0.1,
        parent: table,
        cast: false,
      });
    }
    // 台面上的糖包盒 / 搅拌棒
    box(0.12, 0.06, 0.08, M.white, { x: 0.98, y: 1.21, z: -3.66, parent: table, cast: false });
    box(0.1, 0.025, 0.05, M.cream, { x: 1.38, y: 1.2, z: -3.66, parent: table, cast: false });
    staffArea.add(table);
  }

  /* --- 员工储物柜（后墙右角、STAFF ONLY 门右侧） --- */
  {
    const lk = group('staff-lockers');
    const x0 = 1.18;
    const x1 = 1.5;
    const z0 = -4.42;
    const z1 = -4.2;
    const h = 1.45;
    const lt = toon('#c6d0d8', { gradient: 'soft', rim: 0.14, rimColor: '#eaf4ff' });
    box(x1 - x0, h, z1 - z0, toon('#aeb9c3', { gradient: 'soft', rim: 0.12 }), {
      x: (x0 + x1) / 2,
      y: FLOOR + h / 2,
      z: (z0 + z1) / 2,
      parent: lk,
    });
    const dw = (x1 - x0) / 2;
    for (let i = 0; i < 2; i += 1) {
      const dx = x0 + dw / 2 + i * dw;
      box(dw - 0.02, h - 0.12, 0.02, lt, { x: dx, y: FLOOR + h / 2, z: z1 + 0.009, parent: lk, cast: false });
      // 通风格栅
      for (let k = 0; k < 3; k += 1) {
        box(dw - 0.08, 0.012, 0.012, M.dark, { x: dx, y: FLOOR + h - 0.18 - k * 0.03, z: z1 + 0.02, parent: lk, cast: false });
      }
      // 把手 + 号码
      box(0.03, 0.06, 0.02, M.steel, { x: dx + dw / 2 - 0.05, y: FLOOR + 0.72, z: z1 + 0.025, parent: lk, cast: false });
      lit(0.055, 0.04, labelTex({ w: 128, h: 96, bg: '#f4efe0', fg: '#20304f', text: String(i + 1), size: 52 }), {
        x: dx,
        y: FLOOR + h - 0.3,
        z: z1 + 0.022,
        parent: emit,
        intensity: 0.85,
      });
    }
    box(x1 - x0 + 0.02, 0.03, z1 - z0 + 0.02, M.steelDark, { x: (x0 + x1) / 2, y: FLOOR + h + 0.015, z: (z0 + z1) / 2, parent: lk, cast: false });
    staffArea.add(lk);
  }

  /* --- 拖把桶 + 拖把 --- */
  {
    const mb = group('mop-bucket');
    mb.position.set(0.43, FLOOR, -3.66);
    cyl(0.13, 0.145, 0.3, 12, toon('#d8c22f', { gradient: 'soft', rim: 0.16 }), { y: 0.15, parent: mb });
    cyl(0.105, 0.105, 0.02, 12, M.steelDark, { y: 0.31, parent: mb, cast: false });
    // 拧水篮
    box(0.1, 0.1, 0.14, toon('#bfae2c', { gradient: 'soft' }), { x: 0.1, y: 0.31, z: 0, parent: mb, cast: false });
    // 拖把杆 + 布头
    cyl(0.012, 0.012, 1.1, 8, toon('#b8bcc4', { rim: 0.2, rimColor: '#f2faff' }), { x: 0.02, y: 0.85, z: 0.04, rz: 0.08, parent: mb, cast: false });
    box(0.12, 0.09, 0.12, toon('#d8d2c2', { gradient: 'soft' }), { x: 0.05, y: 0.36, z: 0.05, parent: mb, cast: false });
    staffArea.add(mb);
  }

  /* --- 扫帚 + 簸箕（收在烟柜下方，别戳进柜体） --- */
  {
    const br = group('broom');
    br.position.set(1.455, FLOOR, -3.66);
    br.rotation.z = -0.09;
    cyl(0.013, 0.013, 0.9, 8, M.steelDark, { y: 0.5, parent: br, cast: false });
    box(0.09, 0.2, 0.16, toon('#c98a3c', { gradient: 'soft', rim: 0.14 }), { y: 0.11, parent: br, cast: false });
    box(0.1, 0.02, 0.17, M.red, { y: 0.02, parent: br, cast: false });
    staffArea.add(br);
    // 簸箕（放在咖啡小台与右墙之间的窄缝）
    box(0.18, 0.02, 0.2, M.steelDark, { x: 1.41, y: FLOOR + 0.01, z: -3.9, parent: staffArea, cast: false });
    cyl(0.01, 0.01, 0.36, 6, M.steelDark, { x: 1.41, y: FLOOR + 0.2, z: -3.96, rx: 0.4, parent: staffArea, cast: false });
  }

  /* --- 纸箱堆 --- */
  {
    const bx = group('staff-boxes');
    const bmat = toon('#bd9a66', { gradient: 'soft', rim: 0.12, rimColor: '#ffe6b8' });
    const btop = toon('#d8c8a0', { gradient: 'soft', rim: 0.1 });
    for (let i = 0; i < 3; i += 1) {
      const px = i === 2 ? 0.62 : 0.36;
      const py = i === 2 ? 0 : i * 0.25;
      const pz = i === 2 ? -3.78 : -3.74;
      box(0.3, 0.24, 0.3, bmat, { x: px, y: FLOOR + 0.12 + py, z: pz, ry: i * 0.16, parent: bx, cast: false });
      box(0.2, 0.012, 0.03, btop, { x: px, y: FLOOR + 0.24 + py, z: pz, ry: i * 0.16, parent: bx, cast: false });
    }
    staffArea.add(bx);
  }

  /* --- 员工小圆凳 --- */
  {
    const st = group('staff-stool');
    st.position.set(0.78, FLOOR, -3.56);
    cyl(0.15, 0.15, 0.045, 14, M.red, { y: 0.42, parent: st, cast: false });
    cyl(0.145, 0.145, 0.01, 14, M.dark, { y: 0.395, parent: st, cast: false });
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      cyl(0.012, 0.012, 0.4, 6, M.steelDark, {
        x: Math.cos(a) * 0.1,
        y: 0.2,
        z: Math.sin(a) * 0.1,
        rx: Math.sin(a) * 0.08,
        rz: -Math.cos(a) * 0.08,
        parent: st,
        cast: false,
      });
    }
    staffArea.add(st);
  }

  /* --- 灭火器 + 贴纸（右墙，烟柜下方） --- */
  {
    const fg = group('fire-extinguisher');
    fg.position.set(WALL_R - 0.085, FLOOR, -3.5);
    cyl(0.052, 0.052, 0.4, 12, M.red, { y: 0.24, parent: fg, cast: false });
    cyl(0.028, 0.042, 0.05, 10, M.dark, { y: 0.465, parent: fg, cast: false });
    cyl(0.01, 0.01, 0.09, 6, M.dark, { x: 0, y: 0.51, z: 0.03, rx: 0.5, parent: fg, cast: false });
    box(0.02, 0.09, 0.05, M.dark, { x: 0, y: 0.4, z: 0.055, parent: fg, cast: false });
    box(0.07, 0.12, 0.06, M.steelDark, { y: 0.11, z: -0.07, parent: fg, cast: false });
    staffArea.add(fg);
    decal(0.12, 0.12, T.fireSticker, { x: WALL_R - 0.03, y: 0.92, z: -3.5, ry: -Math.PI / 2, parent: emit });
  }

  /* --- staff 区小垃圾桶 / 垃圾袋 --- */
  {
    cyl(0.11, 0.09, 0.34, 12, M.blue, { x: 0.24, y: FLOOR + 0.17, z: -3.56, parent: staffArea, cast: false });
    box(0.12, 0.06, 0.12, M.white, { x: 0.24, y: FLOOR + 0.36, z: -3.56, parent: staffArea, cast: false });
  }

  solid.add(staffArea);

  /* ======================================================================== */
  /*  B. 货架价格槽 + Shelftalker POP + 便当柜价格槽                             */
  /* ======================================================================== */

  {
    const shelf = group('shelf-price');
    const railGeo = planeGeo(1, 1);
    const railMat = flat('#ffffff', { map: T.priceRail });
    railMat.side = THREE.DoubleSide;
    const items = [];
    for (const rz of LAY.rowZ) {
      for (const ty of LAY.tiers) {
        for (const side of [1, -1]) {
          items.push({
            x: (LAY.lenX0 + LAY.lenX1) / 2,
            y: FLOOR + ty - 0.006,
            z: rz + side * (LAY.rowDepth / 2 + 0.006),
            ry: side > 0 ? 0 : Math.PI,
          });
        }
      }
    }
    const im = new THREE.InstancedMesh(railGeo, railMat, items.length);
    const m4 = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    items.forEach((it, idx) => {
      p.set(it.x, it.y, it.z);
      e.set(0, it.ry, 0);
      q.setFromEuler(e);
      s.set(LAY.lenX1 - LAY.lenX0 - 0.06, 0.052, 1);
      m4.compose(p, q, s);
      im.setMatrixAt(idx, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = false;
    im.receiveShadow = false;
    im.userData.noOutline = true;
    shelf.add(im);

    // Shelftalker 小 POP（夹在货架前缘）
    const popMats = [T.popNew, T.popNo1, T.pop100, T.popRecommend];
    const popPos = [
      [-1.92, 0, 0.46],
      [-1.35, 0, 0.8],
      [-0.7, 0, 0.46],
      [-0.25, 1, 0.8],
      [-1.6, 1, 1.14],
      [-0.95, 1, 0.12],
      [-1.95, 2, 0.8],
      [-0.45, 2, 0.46],
    ];
    let pi = 0;
    for (const [px, rowIdx, ty] of popPos) {
      const rz = LAY.rowZ[rowIdx];
      const pop = plane(0.15, 0.11, new THREE.MeshBasicMaterial({ map: popMats[pi % popMats.length], fog: true }), {
        x: px,
        y: FLOOR + ty + 0.055,
        z: rz + LAY.rowDepth / 2 + 0.016,
        cast: false,
        receive: false,
        parent: shelf,
      });
      pop.rotation.x = -0.18;
      pop.userData.noOutline = true;
      pi += 1;
    }

    // 便当冷藏柜价格槽（左墙，朝 +X）
    for (let s2 = 0; s2 < 3; s2 += 1) {
      const y = FLOOR + LAY.bento.floor0 + s2 * LAY.bento.step + 0.03;
      const rail = plane(1.62, 0.05, railMat, {
        x: LAY.bento.x + LAY.bento.d / 2 + 0.008,
        y,
        z: (LAY.bento.z0 + LAY.bento.z1) / 2,
        ry: Math.PI / 2,
        cast: false,
        receive: false,
        parent: shelf,
      });
      rail.userData.noOutline = true;
    }
    solid.add(shelf);
  }

  /* ======================================================================== */
  /*  C. 天花板补充：监控球机 / 喇叭 / 烟感 / 喷淋 / 窗边吊旗                     */
  /* ======================================================================== */

  const blinkers = [];
  {
    // 第二颗监控球机（后场冷柜方向）
    const dome = group('camera-dome-2');
    dome.position.set(-1.5, CEIL - 0.02, -3.6);
    dome.rotation.y = 0.7;
    cyl(0.075, 0.075, 0.024, 14, M.white, { parent: dome, cast: false });
    cyl(0.066, 0.066, 0.02, 14, M.dark, { y: -0.02, parent: dome, cast: false });
    const ball = sphere(0.058, flat('#2b313a', { transparent: true, opacity: 0.85 }), { y: -0.048, parent: dome, sy: 0.6, cast: false });
    ball.userData.noOutline = true;
    const lens = sphere(0.024, flat('#0b0e13'), { y: -0.068, parent: dome, cast: false });
    lens.userData.noOutline = true;
    const led = sphere(0.01, flat(new THREE.Color('#ff3b30').multiplyScalar(2)), { x: -0.045, y: -0.05, z: 0.04, parent: dome, cast: false });
    led.userData.noOutline = true;
    blinkers.push(led);
    solid.add(dome);

    // 天花喇叭 ×2
    for (const [x, z, ry] of [
      [-0.35, 0.12, 0.3],
      [0.9, -1.9, -0.5],
    ]) {
      const sp = group('speaker');
      sp.position.set(x, CEIL - 0.055, z);
      sp.rotation.y = ry;
      box(0.15, 0.09, 0.1, M.white, { parent: sp, cast: false });
      for (let i = 0; i < 5; i += 1) {
        box(0.12, 0.005, 0.005, M.dark, { y: -0.03 + i * 0.016, z: 0.052, parent: sp, cast: false });
      }
      solid.add(sp);
    }

    // 烟感 ×3 + 喷淋头 ×2
    for (const [x, z] of [
      [-1.3, -0.5],
      [0.2, -2.2],
      [-1.9, -3.9],
    ]) {
      cyl(0.045, 0.045, 0.016, 12, M.white, { x, y: CEIL - 0.008, z, parent: solid, cast: false });
      cyl(0.022, 0.022, 0.026, 8, M.steel, { x, y: CEIL - 0.026, z, parent: solid, cast: false });
    }
    for (const [x, z] of [
      [0.45, -3.3],
      [-2.2, -1.6],
    ]) {
      cyl(0.014, 0.014, 0.05, 8, M.steel, { x, y: CEIL - 0.03, z, parent: solid, cast: false });
      cyl(0.03, 0.03, 0.012, 8, M.steelDark, { x, y: CEIL - 0.058, z, parent: solid, cast: false });
    }

    // 窗边小吊旗（透玻璃可见的促销旗）
    const banners = [
      { map: T.bannerOden, x: -1.86 },
      { map: T.bannerKaraage, x: -1.2 },
      { map: T.bannerCoffee, x: -0.54 },
    ];
    for (const b of banners) {
      const bn = group('hanging-banner');
      bn.position.set(b.x, 0, 0.06);
      // 吊杆
      cyl(0.006, 0.006, 0.16, 5, M.steelDark, { y: CEIL - 0.08, parent: bn, cast: false });
      const flag = plane(0.22, 0.4, new THREE.MeshBasicMaterial({ map: b.map, side: THREE.DoubleSide, fog: true }), {
        y: CEIL - 0.38,
        cast: false,
        receive: false,
        parent: bn,
      });
      flag.userData.noOutline = true;
      solid.add(bn);
    }
  }

  /* ======================================================================== */
  /*  D. 玻璃内侧小贴纸                                                       */
  /* ======================================================================== */

  {
    const GZ = 0.868; // 玻璃(z≈0.89)内侧
    decal(0.3, 0.075, T.g24, { x: -0.18, y: 1.12, z: GZ, parent: emit, opacity: 0.95 });
    decal(0.42, 0.105, T.payStrip, { x: 0.0, y: 1.32, z: GZ, parent: emit, opacity: 0.94 });
    decal(0.28, 0.088, T.camSticker, { x: 1.18, y: 1.62, z: GZ, parent: emit, opacity: 0.92 });
    decal(0.2, 0.083, T.openSticker, { x: 0.72, y: 1.18, z: GZ, parent: emit, opacity: 0.95 });
    decal(0.26, 0.081, T.bagSticker, { x: 0.06, y: 1.02, z: GZ, parent: emit, opacity: 0.92 });
  }

  /* ======================================================================== */
  /*  E. 地面 refinement：レジ贴纸 / 小箭头 / 暖光光斑 / 落小票                  */
  /* ======================================================================== */

  {
    const DG = group('floor-refine');
    // 「レジ」贴纸：收银台正前方（不覆盖 interior.js 的 x0.45..1.35 / z-2.6..0 引导带）
    decal(0.42, 0.21, T.floorRegi, { x: 0.82, y: FLOOR + 0.0085, z: -2.72, rx: -Math.PI / 2, parent: DG, opacity: 0.95 });
    // 指向柜台的小箭头
    decal(0.16, 0.24, T.floorArrow, { x: 1.2, y: FLOOR + 0.0085, z: -2.72, rx: -Math.PI / 2, rz: -Math.PI / 2, parent: DG, opacity: 0.9 });
    // 收银台前的暖光光斑（假的设备/灯箱溢光）
    const poolMat = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: new THREE.Color('#ffcf94'),
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const pool = plane(1.5, 1.5, poolMat, { x: 0.7, y: FLOOR + 0.007, z: -2.66, rx: -Math.PI / 2, parent: emit });
    nn(pool);
    // 地上的一张落小票
    const receipt = plane(0.07, 0.13, flat('#f8f4e8'), { x: 0.58, y: FLOOR + 0.004, z: -2.5, rx: -Math.PI / 2, rz: 0.5, parent: DG });
    nn(receipt);
    receipt.userData.noOutline = true;
    solid.add(DG);
  }

  /* ======================================================================== */
  /*  F. 右墙挂钟（秒针走动）+ 入口分类垃圾桶 + 垃圾分别贴纸                     */
  /* ======================================================================== */

  const clockHands = { h: null, m: null, s: null };
  {
    const clock = group('wall-clock');
    clock.position.set(WALL_R - 0.016, 2.1, -0.12);
    clock.rotation.y = -Math.PI / 2; // 面向店内 -X
    cyl(0.135, 0.135, 0.03, 24, M.white, { rx: Math.PI / 2, parent: clock, cast: false });
    cyl(0.14, 0.14, 0.012, 24, M.dark, { z: -0.014, rx: Math.PI / 2, parent: clock, cast: false });
    const face = plane(0.25, 0.25, flat('#ffffff', { map: T.clockFace, transparent: true }), { z: 0.012, parent: clock, cast: false });
    face.userData.noOutline = true;
    clockHands.h = box(0.012, 0.075, 0.006, M.dark, { y: 0.035, z: 0.02, parent: clock, cast: false });
    clockHands.m = box(0.009, 0.1, 0.005, M.dark, { y: 0.048, z: 0.022, parent: clock, cast: false });
    clockHands.s = box(0.004, 0.105, 0.004, M.red, { y: 0.05, z: 0.024, parent: clock, cast: false });
    cyl(0.012, 0.012, 0.02, 8, M.red, { z: 0.024, rx: Math.PI / 2, parent: clock, cast: false });
    solid.add(clock);

    // 入口右墙：分类垃圾桶 ×2（透明罐瓶 / 绿 PET）
    const bins = group('recycle-bins');
    const binDefs = [
      { x: 1.38, z: -0.24, mat: M.cans, label: T.binCan, lid: '#9fc4e8' },
      { x: 1.38, z: -0.62, mat: M.pet, label: T.binPet, lid: '#8fd8c0' },
    ];
    for (const b of binDefs) {
      cyl(0.14, 0.12, 0.46, 14, b.mat, { x: b.x, y: FLOOR + 0.23, z: b.z, parent: bins, cast: false });
      cyl(0.145, 0.145, 0.035, 14, toon(b.lid, { gradient: 'soft' }), { x: b.x, y: FLOOR + 0.48, z: b.z, parent: bins, cast: false });
      // 圆形投口
      cyl(0.035, 0.035, 0.05, 10, M.dark, { x: b.x, y: FLOOR + 0.5, z: b.z, parent: bins, cast: false });
      // 标签
      lit(0.17, 0.085, b.label, { x: b.x, y: FLOOR + 0.3, z: b.z + 0.135, parent: emit, intensity: 0.92 });
    }
    addOutline(bins, { width: 0.0007, color: '#080b14' });
    solid.add(bins);
    decal(0.34, 0.085, T.recycleSign, { x: WALL_R - 0.028, y: 1.35, z: -0.42, ry: -Math.PI / 2, parent: emit, opacity: 0.92 });
  }

  /* ======================================================================== */
  /*  G. 收银台补充小物：レジ袋 dispenser / 笔筒 / 卡片座 / 割箸盒 / 会計トレイ   */
  /* ======================================================================== */

  {
    const ct = LAY.counter;
    const cg = group('counter-extras');

    // レジ袋 dispenser（挂在柜台客人一侧）
    const disp = group('bag-dispenser');
    disp.position.set(1.28, FLOOR + 0.86, ct.zFront + 0.004);
    box(0.24, 0.13, 0.07, M.white, { parent: disp, cast: false });
    lit(0.2, 0.1, T.bagBox, { z: 0.036, parent: disp, intensity: 0.9 });
    // 抽出的塑料袋
    const bagMat = flat('#f0f4f2', { transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const bag = plane(0.14, 0.16, bagMat, { y: -0.14, z: 0.03, rx: 0.25, parent: disp });
    bag.userData.noOutline = true;
    cg.add(disp);

    // 柜台后缘小物（避开已有机器的位置）
    // 笔筒
    cyl(0.022, 0.02, 0.075, 8, M.teal, { x: 0.55, y: ct.top + 0.04, z: -3.33, parent: cg, cast: false });
    cyl(0.003, 0.003, 0.1, 4, M.dark, { x: 0.552, y: ct.top + 0.08, z: -3.332, rz: 0.12, parent: cg, cast: false });
    cyl(0.003, 0.003, 0.1, 4, M.red, { x: 0.556, y: ct.top + 0.08, z: -3.326, rz: -0.08, parent: cg, cast: false });
    // ポイントカード座
    box(0.15, 0.05, 0.1, M.white, { x: 0.73, y: ct.top + 0.025, z: -3.33, parent: cg, cast: false });
    for (let i = 0; i < 5; i += 1) {
      box(0.13, 0.004, 0.002, toon(i % 2 ? '#3fa8a0' : '#ff7a5e'), { x: 0.73, y: ct.top + 0.028 + i * 0.006, z: -3.282, parent: cg, cast: false });
    }
    // 割箸・スプーン盒
    box(0.16, 0.09, 0.12, M.cream, { x: 0.9, y: ct.top + 0.045, z: -3.33, parent: cg, cast: false });
    lit(0.14, 0.05, T.chopstick, { x: 0.9, y: ct.top + 0.06, z: -3.269, parent: emit, intensity: 0.9 });
    // お会計トレイ
    box(0.2, 0.018, 0.13, M.steelDark, { x: 1.3, y: ct.top + 0.01, z: -3.01, parent: cg, cast: false });
    box(0.19, 0.004, 0.12, M.steel, { x: 1.3, y: ct.top + 0.02, z: -3.01, parent: cg, cast: false });
    // 割り箸小箱（櫃台角落）
    box(0.1, 0.07, 0.08, M.cream, { x: 0.4, y: ct.top + 0.035, z: -3.3, parent: cg, cast: false });
    solid.add(cg);
  }

  /* ======================================================================== */
  /*  H. 卖场生活感：门口小促销立牌                                             */
  /* ======================================================================== */

  {
    const stand = group('promo-stand');
    stand.position.set(-0.55, FLOOR, -0.35);
    stand.rotation.y = 0.18;
    // A 字立牌
    box(0.34, 0.02, 0.2, M.steelDark, { y: 0.01, parent: stand, cast: false });
    const back = box(0.3, 0.42, 0.02, M.white, { y: 0.24, z: -0.06, rx: -0.14, parent: stand, cast: false });
    nn(back);
    const front = box(0.3, 0.42, 0.02, M.white, { y: 0.24, z: 0.06, rx: 0.14, parent: stand, cast: false });
    nn(front);
    // 正面海报
    const poster = plane(0.26, 0.36, new THREE.MeshBasicMaterial({ map: TEX.posterMoonDango(), fog: true }), {
      y: 0.25,
      z: 0.077,
      rx: 0.14,
      parent: stand,
      cast: false,
    });
    poster.userData.noOutline = true;
    // 顶部小字
    box(0.32, 0.03, 0.14, M.red, { y: 0.47, parent: stand, cast: false });
    addOutline(stand, { width: 0.0006, color: '#080b14' });
    solid.add(stand);
  }

  /* ======================================================================== */
  /*  收尾 & update                                                             */
  /* ======================================================================== */

  shadow(solid, false, true);
  g.traverse((o) => {
    if (o.isSprite) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  if (handles && handles.debug) {
    let meshes = 0;
    let instanced = 0;
    g.traverse((o) => {
      if (o.isMesh) meshes += 1;
      if (o.isInstancedMesh) instanced += 1;
    });
    handles.debug.interiorDetails = { meshes, instanced };
  }

  ctx.root.add(g);

  return {
    group: g,
    update(t) {
      // 监控球机指示灯呼吸（约 2.6s 一次短亮）
      const on = (t % 2.6) < 0.18;
      for (const l of blinkers) l.visible = on;
      // 挂钟走动
      const sec = t % 60;
      if (clockHands.s) clockHands.s.rotation.z = -(sec / 60) * Math.PI * 2;
      if (clockHands.m) clockHands.m.rotation.z = -((sec / 60) / 60) * Math.PI * 2 - 1.2;
      if (clockHands.h) clockHands.h.rotation.z = -((sec / 3600) / 12) * Math.PI * 2 - 0.9;
    },
  };
}
