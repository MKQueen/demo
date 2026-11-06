/**
 * lib/textures.js —— 程序化 Canvas 纹理库（不依赖任何外部图片）。
 *
 * 全部在浏览器里用 Canvas 2D 画出来：招牌、海报、灯箱、木纹、铜牌、贴纸……
 * 统一 sRGB 色彩空间，保证与卡通材质 + HDR 灯箱一致。
 */
import * as THREE from 'three';
import { BRAND } from '../config.js';

export const JP_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "YuGothic", "Noto Sans JP", "PingFang SC", sans-serif';
export const EN_FONT = '"Avenir Next", "Helvetica Neue", "Hiragino Sans", Arial, sans-serif';

/* -------------------------------------------------------------------------- */
/*  Canvas 基础                                                                */
/* -------------------------------------------------------------------------- */

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function canvasTexture(w, h, draw, opts = {}) {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.minFilter = opts.minFilter ?? THREE.LinearMipmapLinearFilter;
  tex.magFilter = opts.magFilter ?? THREE.LinearFilter;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  if (opts.wrap) {
    tex.wrapS = tex.wrapT = opts.wrap;
  }
  tex.needsUpdate = true;
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function star(ctx, cx, cy, r, points = 4, inset = 0.32) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inset;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* -------------------------------------------------------------------------- */
/*  品牌图形：月牙 + 星                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 月牙 logo
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o { cx, cy, r, disc, moon, star }
 */
export function moonLogo(ctx, o) {
  const { cx, cy, r } = o;
  const disc = o.disc ?? '#20304f';
  const moon = o.moon ?? '#ffc96b';
  const starColor = o.star ?? '#fbf3dd';
  ctx.save();
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 月牙：亮圆叠一个偏移的暗圆
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(cx - r * 0.08, cy - r * 0.04, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx + r * 0.26, cy - r * 0.2, r * 0.58, 0, Math.PI * 2);
  ctx.fill();

  // 小星星
  ctx.fillStyle = starColor;
  star(ctx, cx + r * 0.44, cy + r * 0.38, r * 0.18, 4, 0.36);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.1, cy + r * 0.55, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/*  TEX：懒加载纹理集合                                                        */
/* -------------------------------------------------------------------------- */

const cache = new Map();
function lazy(name, factory) {
  return () => {
    if (!cache.has(name)) cache.set(name, factory());
    return cache.get(name);
  };
}

export const TEX = {
  /** 主招牌灯箱：横向长条，米白底 + 深蓝字 + 珊瑚色 24H */
  mainSign: lazy('mainSign', () =>
    canvasTexture(2048, 320, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#fff9e9');
      bg.addColorStop(0.62, '#f8efd8');
      bg.addColorStop(1, '#efe3c7');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 底部窄条 + 顶边细线
      ctx.fillStyle = '#2b3a60';
      ctx.fillRect(0, h - 26, w, 26);
      ctx.fillStyle = '#3fa8a0';
      ctx.fillRect(0, 0, w, 10);

      // 月亮 logo
      moonLogo(ctx, { cx: 190, cy: 150, r: 108, disc: '#20304f', moon: '#ffc96b', star: '#fbf3dd' });

      // 主标题
      ctx.fillStyle = '#20304f';
      ctx.textBaseline = 'middle';
      ctx.font = `700 138px ${JP_FONT}`;
      ctx.fillText('つきみマート', 330, 138);

      // 英文副标
      ctx.fillStyle = '#3fa8a0';
      ctx.font = `600 44px ${EN_FONT}`;
      ctx.letterSpacing = '10px';
      ctx.fillText('TSUKIMI MART', 336, 242);
      ctx.letterSpacing = '0px';

      // 小字店名
      ctx.fillStyle = 'rgba(32,48,79,0.62)';
      ctx.font = `500 30px ${JP_FONT}`;
      ctx.fillText('月見町二丁目店', 1330, 253);

      // 24H 徽章
      ctx.fillStyle = '#ff7a5e';
      roundRect(ctx, 1716, 64, 238, 190, 34);
      ctx.fill();
      ctx.fillStyle = '#fff7e3';
      ctx.font = `800 98px ${EN_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('24H', 1835, 138);
      ctx.font = `600 28px ${JP_FONT}`;
      ctx.fillText('24時間営業', 1835, 207);
      ctx.textAlign = 'left';
    }),
  ),

  /** 街角立柱灯箱：竖排 */
  pylonSign: lazy('pylonSign', () =>
    canvasTexture(512, 1536, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#fff9e9');
      bg.addColorStop(1, '#f4e9d2');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 顶部深蓝块 + 月亮
      ctx.fillStyle = '#20304f';
      ctx.fillRect(0, 0, w, 430);
      moonLogo(ctx, { cx: 256, cy: 195, r: 118, disc: '#20304f', moon: '#ffc96b', star: '#fbf3dd' });
      ctx.fillStyle = '#fbf3dd';
      ctx.textAlign = 'center';
      ctx.font = `700 54px ${EN_FONT}`;
      ctx.letterSpacing = '6px';
      ctx.fillText('TSUKIMI', 256, 372);
      ctx.letterSpacing = '0px';

      // 竖排日文
      ctx.fillStyle = '#20304f';
      ctx.font = `700 116px ${JP_FONT}`;
      const chars = 'つきみマート'.split('');
      chars.forEach((ch, i) => ctx.fillText(ch, 256, 560 + i * 134));

      // 细线
      ctx.strokeStyle = 'rgba(32,48,79,0.28)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(64, 1240);
      ctx.lineTo(448, 1240);
      ctx.stroke();

      ctx.fillStyle = '#3fa8a0';
      ctx.font = `600 36px ${JP_FONT}`;
      ctx.fillText('24時間営業', 256, 1310);

      // 24H 珊瑚块
      ctx.fillStyle = '#ff7a5e';
      roundRect(ctx, 96, 1352, 320, 132, 26);
      ctx.fill();
      ctx.fillStyle = '#fff7e3';
      ctx.font = `800 86px ${EN_FONT}`;
      ctx.fillText('24H', 256, 1420);
    }),
  ),

  /** 自动门贴纸（透明底白字 + 青色图形） */
  doorSticker: lazy('doorSticker', () =>
    canvasTexture(512, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      roundRect(ctx, 10, 10, w - 20, h - 20, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(63,168,160,0.9)';
      ctx.lineWidth = 6;
      roundRect(ctx, 10, 10, w - 20, h - 20, 18);
      ctx.stroke();

      // 箭头
      ctx.strokeStyle = '#3fa8a0';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(70, 128);
      ctx.lineTo(150, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(120, 88);
      ctx.lineTo(158, 128);
      ctx.lineTo(120, 168);
      ctx.stroke();

      ctx.fillStyle = '#20304f';
      ctx.font = `700 58px ${JP_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('自動ドア', 330, 112);
      ctx.fillStyle = 'rgba(32,48,79,0.55)';
      ctx.font = `500 40px ${EN_FONT}`;
      ctx.letterSpacing = '3px';
      ctx.fillText('AUTOMATIC DOOR', 330, 178);
    }),
  ),

  /** 透明小贴纸（ATM / Wi-Fi / 24h / コピー） */
  sticker: lazy('sticker', () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#20304f';
      ctx.fillStyle = 'rgba(251,243,221,0.95)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(256, 256, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#20304f';
      ctx.textAlign = 'center';
      ctx.font = `700 180px ${EN_FONT}`;
      ctx.fillText('ATM', 256, 300);
      ctx.font = `600 60px ${JP_FONT}`;
      ctx.fillText('24時間', 256, 396);
    }),
  ),

  /** 右侧外墙灯箱广告（饮料广告） */
  wallAd: lazy('wallAd', () =>
    canvasTexture(768, 1024, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#19384f');
      bg.addColorStop(0.55, '#2a6072');
      bg.addColorStop(1, '#c8efe8');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 远处月亮
      ctx.fillStyle = 'rgba(255,201,107,0.95)';
      ctx.beginPath();
      ctx.arc(560, 190, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(25,56,79,0.9)';
      ctx.beginPath();
      ctx.arc(608, 158, 92, 0, Math.PI * 2);
      ctx.fill();

      // 气泡
      for (let i = 0; i < 38; i += 1) {
        const x = (i * 137.5) % w;
        const y = 260 + ((i * 83) % 620);
        const r = 5 + ((i * 37) % 16);
        ctx.fillStyle = `rgba(220,255,250,${0.12 + (i % 5) * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 瓶身
      ctx.save();
      ctx.translate(w / 2, 500);
      ctx.fillStyle = 'rgba(245,255,252,0.92)';
      roundRect(ctx, -100, -150, 200, 470, 54);
      ctx.fill();
      ctx.fillStyle = '#3fa8a0';
      roundRect(ctx, -100, -40, 200, 210, 22);
      ctx.fill();
      ctx.fillStyle = '#fbf3dd';
      ctx.font = `800 68px ${JP_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('月のしずく', 0, 60);
      ctx.font = `600 34px ${EN_FONT}`;
      ctx.fillText('MOON DROP', 0, 112);
      ctx.fillStyle = '#20304f';
      roundRect(ctx, -62, -220, 124, 80, 18);
      ctx.fill();
      ctx.fillStyle = '#ffc96b';
      ctx.beginPath();
      ctx.arc(0, -180, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 文案
      ctx.fillStyle = '#fbf3dd';
      ctx.font = `700 92px ${JP_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('つめた〜い', w / 2, 150);
      ctx.fillStyle = '#20304f';
      roundRect(ctx, 148, 880, 472, 96, 22);
      ctx.fill();
      ctx.fillStyle = '#fbf3dd';
      ctx.font = `700 52px ${JP_FONT}`;
      ctx.fillText('新発売', w / 2, 946);
      ctx.textAlign = 'left';
    }),
  ),

  /** 门口地垫：深蓝底 + 米白 logo */
  doorMat: lazy('doorMat', () =>
    canvasTexture(768, 384, (ctx, w, h) => {
      ctx.fillStyle = '#1c2740';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(251,243,221,0.5)';
      ctx.lineWidth = 10;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      moonLogo(ctx, { cx: 210, cy: h / 2, r: 92, disc: '#1c2740', moon: '#ffc96b', star: '#fbf3dd' });
      ctx.fillStyle = '#fbf3dd';
      ctx.font = `700 88px ${JP_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText('つきみマート', 330, 170);
      ctx.fillStyle = '#3fa8a0';
      ctx.font = `600 34px ${EN_FONT}`;
      ctx.letterSpacing = '6px';
      ctx.fillText('TSUKIMI MART', 334, 262);
      ctx.letterSpacing = '0px';
    }),
  ),

  /** 右墙海报栏 / 公告栏用的小海报 */
  noticePosters: lazy('noticePosters', () =>
    canvasTexture(768, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#d8c8a4';
      ctx.fillRect(0, 0, w, h);
      // 软木纹理点
      for (let i = 0; i < 2600; i += 1) {
        const x = (i * 61.7) % w;
        const y = (i * 131.3) % h;
        ctx.fillStyle = `rgba(90,66,36,${0.03 + (i % 7) * 0.012})`;
        ctx.fillRect(x, y, 3, 3);
      }
      // 三张海报
      const card = (x, y, cw, ch, bg, tilt) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(10, 10, cw - 20, ch - 20);
        ctx.restore();
      };
      card(70, 80, 240, 320, '#f2e6c8', -0.035);
      card(360, 120, 260, 350, '#e9dcc0', 0.028);
      card(160, 500, 280, 380, '#efe2c4', -0.012);
      // 内容笔触
      ctx.strokeStyle = 'rgba(40,50,70,0.55)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(110, 180 + i * 36);
        ctx.lineTo(270, 180 + i * 36);
        ctx.stroke();
      }
      ctx.fillStyle = '#ff7a5e';
      ctx.beginPath();
      ctx.arc(440, 250, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20304f';
      ctx.font = `700 54px ${JP_FONT}`;
      ctx.fillText('ねこ', 405, 270);
      ctx.fillStyle = '#20304f';
      ctx.font = `700 48px ${JP_FONT}`;
      ctx.fillText('夏祭り', 200, 570);
      ctx.fillText('お知らせ', 200, 630);
      ctx.fillStyle = '#3fa8a0';
      ctx.fillRect(200, 660, 180, 14);
      // 图钉
      const pin = (x, y, c) => {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.arc(x + 3, y + 4, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      };
      pin(190, 100, '#ff7a5e');
      pin(490, 140, '#3fa8a0');
      pin(300, 520, '#ffc96b');
    }),
  ),

  /** A 字立牌 / 咖啡宣传 */
  aFrame: lazy('aFrame', () =>
    canvasTexture(512, 768, (ctx, w, h) => {
      ctx.fillStyle = '#26324d';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(251,243,221,0.35)';
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.fillStyle = '#ffc96b';
      ctx.beginPath();
      ctx.arc(w / 2, 170, 86, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#26324d';
      ctx.beginPath();
      ctx.arc(w / 2 + 30, 148, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbf3dd';
      ctx.textAlign = 'center';
      ctx.font = `700 62px ${JP_FONT}`;
      ctx.fillText('できたて', w / 2, 330);
      ctx.fillText('コーヒー', w / 2, 404);
      ctx.fillStyle = '#ff7a5e';
      ctx.font = `800 150px ${EN_FONT}`;
      ctx.fillText('100', w / 2, 570);
      ctx.font = `700 58px ${EN_FONT}`;
      ctx.fillText('円', w / 2, 640);
      ctx.fillStyle = 'rgba(251,243,221,0.65)';
      ctx.font = `500 30px ${JP_FONT}`;
      ctx.fillText('M サイズ / 税込', w / 2, 710);
      ctx.textAlign = 'left';
    }),
  ),

  /** 雨夜便利店玻璃贴（大张海报，海报贴在玻璃内侧） */
  glassPosterOden: lazy('glassPosterOden', () =>
    posterCanvas({
      w: 640,
      h: 900,
      bg: '#7a2f24',
      bg2: '#b8492f',
      title: 'おでん',
      sub: 'はじめました',
      accent: '#ffc96b',
      kind: 'oden',
    }),
  ),
  glassPosterCoffee: lazy('glassPosterCoffee', () =>
    posterCanvas({
      w: 640,
      h: 900,
      bg: '#20304f',
      bg2: '#3a5478',
      title: 'できたて',
      sub: 'COFFEE',
      accent: '#ffc96b',
      kind: 'coffee',
    }),
  ),
  posterMoonDango: lazy('posterMoonDango', () =>
    posterCanvas({
      w: 640,
      h: 900,
      bg: '#1f4a55',
      bg2: '#3f8a84',
      title: '月見だんご',
      sub: '今夜、月がきれい',
      accent: '#ffe3a3',
      kind: 'dango',
    }),
  ),
  posterOnigiri: lazy('posterOnigiri', () =>
    posterCanvas({
      w: 640,
      h: 900,
      bg: '#f5ead0',
      bg2: '#fbf7ea',
      title: 'おにぎり',
      sub: '新発売',
      accent: '#ff7a5e',
      dark: true,
      kind: 'onigiri',
    }),
  ),

  /** 店内侧挂招牌（蓝底白字） */
  aisleSign: lazy('aisleSign', () =>
    canvasTexture(1024, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2b5fa8');
      g.addColorStop(1, '#1d4379');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f7f4e8';
      ctx.fillRect(0, 0, 26, h);
      ctx.fillRect(0, 0, w, 10);
      ctx.fillStyle = '#eaf6ff';
      ctx.font = `700 120px ${JP_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('おにぎり・お弁当', w / 2 + 20, h / 2 + 4);
      // 小月亮标记
      ctx.fillStyle = '#ffc96b';
      ctx.beginPath();
      ctx.arc(110, 118, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d4379';
      ctx.beginPath();
      ctx.arc(124, 108, 32, 0, Math.PI * 2);
      ctx.fill();
    }),
  ),

  /** 咖啡机 / 收银台背板菜单 */
  menuBoard: lazy('menuBoard', () =>
    canvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#f5efdd';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#20304f';
      ctx.fillRect(0, 0, w, 96);
      ctx.fillStyle = '#ffc96b';
      ctx.font = `700 58px ${JP_FONT}`;
      ctx.fillText('ホットスナック', 40, 68);
      ctx.fillStyle = '#20304f';
      const items = [
        ['からあげ', '¥240'],
        ['フランク', '¥190'],
        ['ナゲット', '¥220'],
        ['ポテト', '¥180'],
      ];
      items.forEach(([n, p], i) => {
        const y = 200 + i * 78;
        ctx.font = `600 52px ${JP_FONT}`;
        ctx.fillText(n, 48, y);
        ctx.font = `700 52px ${EN_FONT}`;
        ctx.fillStyle = '#ff7a5e';
        ctx.textAlign = 'right';
        ctx.fillText(p, w - 48, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#20304f';
        ctx.strokeStyle = 'rgba(32,48,79,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(48, y + 28);
        ctx.lineTo(w - 48, y + 28);
        ctx.stroke();
      });
    }),
  ),
};

/* -------------------------------------------------------------------------- */
/*  海报绘制                                                                   */
/* -------------------------------------------------------------------------- */

function posterCanvas({ w, h, bg, bg2, title, sub, accent, dark = false, kind }) {
  return canvasTexture(w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg);
    g.addColorStop(1, bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 边框
    ctx.strokeStyle = dark ? 'rgba(32,48,79,0.35)' : 'rgba(251,243,221,0.4)';
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // 顶部装饰
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.16, w * 0.14, 0, Math.PI * 2);
    ctx.fill();

    const fg = dark ? '#20304f' : '#fbf3dd';

    // 插画
    if (kind === 'oden') {
      // 关东煮锅
      ctx.fillStyle = 'rgba(251,243,221,0.92)';
      roundRect(ctx, w * 0.16, h * 0.42, w * 0.68, h * 0.2, 26);
      ctx.fill();
      ctx.fillStyle = '#d2a04c';
      roundRect(ctx, w * 0.2, h * 0.45, w * 0.6, h * 0.08, 18);
      ctx.fill();
      // 萝卜 / 竹轮 / 蛋
      ctx.fillStyle = '#f5e6bb';
      ctx.beginPath();
      ctx.ellipse(w * 0.33, h * 0.5, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c97a3f';
      roundRect(ctx, w * 0.44, h * 0.455, 90, 44, 20);
      ctx.fill();
      ctx.fillStyle = '#f7ecd2';
      ctx.beginPath();
      ctx.arc(w * 0.61, h * 0.5, 30, 0, Math.PI * 2);
      ctx.fill();
      // 热气
      ctx.strokeStyle = 'rgba(251,243,221,0.75)';
      ctx.lineWidth = 10;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(w * (0.3 + i * 0.18), h * 0.38);
        ctx.bezierCurveTo(w * (0.26 + i * 0.18), h * 0.32, w * (0.36 + i * 0.18), h * 0.28, w * (0.32 + i * 0.18), h * 0.22);
        ctx.stroke();
      }
    } else if (kind === 'coffee') {
      // 咖啡杯
      ctx.fillStyle = '#fbf3dd';
      roundRect(ctx, w * 0.3, h * 0.36, w * 0.4, h * 0.2, 18);
      ctx.fill();
      ctx.fillStyle = '#6b3f27';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.37, w * 0.19, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbf3dd';
      ctx.lineWidth = 10;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(w * (0.38 + i * 0.12), h * 0.3);
        ctx.bezierCurveTo(w * 0.34 + i * 0.12 * w, h * 0.24, w * 0.42 + i * 0.12 * w, h * 0.2, w * 0.38 + i * 0.12 * w, h * 0.14);
        ctx.stroke();
      }
    } else if (kind === 'dango') {
      // 月 + 团子串
      ctx.fillStyle = '#ffe3a3';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.32, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.arc(w * 0.56, h * 0.29, w * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8d3a8';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.42);
      ctx.lineTo(w * 0.5, h * 0.62);
      ctx.stroke();
      ['#f7ead0', '#f0d3a8', '#f7ead0'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * (0.44 + i * 0.07), 42, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (kind === 'onigiri') {
      // 饭团
      ctx.fillStyle = '#fbf7ea';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.32);
      ctx.lineTo(w * 0.72, h * 0.58);
      ctx.lineTo(w * 0.28, h * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#20304f';
      ctx.fillRect(w * 0.34, h * 0.48, w * 0.32, h * 0.12);
      ctx.fillStyle = '#3fa8a0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.4, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // 标题
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = `800 ${kind === 'onigiri' ? 118 : 128}px ${JP_FONT}`;
    ctx.fillText(title, w / 2, h * 0.78);
    ctx.fillStyle = accent;
    ctx.font = `700 52px ${JP_FONT}`;
    ctx.fillText(sub, w / 2, h * 0.855);

    // 底部条
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 74, w, 74);
    ctx.fillStyle = dark ? '#20304f' : '#20304f';
    ctx.font = `600 32px ${EN_FONT}`;
    ctx.letterSpacing = '8px';
    ctx.fillText('TSUKIMI MART', w / 2, h - 26);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  });
}

/* -------------------------------------------------------------------------- */
/*  底座：木纹 / 铜牌                                                          */
/* -------------------------------------------------------------------------- */

export const BASE_TEX = {
  wood: lazy('wood', () =>
    canvasTexture(1024, 1024, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2a1d17');
      g.addColorStop(0.45, '#33231b');
      g.addColorStop(1, '#241812');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 木纹
      let seed = 12345;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let i = 0; i < 190; i += 1) {
        const y = rand() * h;
        const amp = 6 + rand() * 22;
        const freq = 0.002 + rand() * 0.01;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(120,82,52,${0.04 + rand() * 0.08})` : `rgba(10,6,4,${0.05 + rand() * 0.12})`;
        ctx.lineWidth = 0.6 + rand() * 2.6;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * freq + rand() * 0.2) * amp + Math.sin(x * freq * 2.7) * amp * 0.25;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // 细密纹理
      for (let i = 0; i < 4200; i += 1) {
        const x = rand() * w;
        const y = rand() * h;
        ctx.fillStyle = `rgba(255,220,180,${rand() * 0.02})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      // 暗角
      const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    }),
  ),

  brassPlate: lazy('brassPlate', () =>
    canvasTexture(1024, 192, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#d9b570');
      g.addColorStop(0.35, '#c49a55');
      g.addColorStop(0.55, '#e0c084');
      g.addColorStop(1, '#9c7639');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 拉丝
      for (let i = 0; i < 90; i += 1) {
        ctx.strokeStyle = `rgba(255,240,200,${0.03 + (i % 6) * 0.012})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, (i * 23) % h);
        ctx.lineTo(w, (i * 23) % h);
        ctx.stroke();
      }

      // 刻字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,246,214,0.55)';
      ctx.font = `700 74px ${JP_FONT}`;
      ctx.fillText('雨夜のコンビニ', w / 2 + 2, 74);
      ctx.fillStyle = 'rgba(58,38,16,0.92)';
      ctx.fillText('雨夜のコンビニ', w / 2, 72);

      ctx.fillStyle = 'rgba(58,38,16,0.78)';
      ctx.font = `600 26px ${EN_FONT}`;
      ctx.letterSpacing = '9px';
      ctx.fillText('RAINY KONBINI  ·  TSUKIMI MART', w / 2, 140);
      ctx.letterSpacing = '0px';

      // 螺丝
      const screw = (x, y) => {
        const rg = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 12);
        rg.addColorStop(0, '#f0d8a0');
        rg.addColorStop(1, '#8a6630');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,40,16,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.stroke();
      };
      screw(36, 30);
      screw(w - 36, 30);
      screw(36, h - 30);
      screw(w - 36, h - 30);
    }),
  ),
};

/* -------------------------------------------------------------------------- */
/*  通用小工具                                                                 */
/* -------------------------------------------------------------------------- */

/** 透明贴纸 / 贴花材质（用于玻璃、墙面；避免 z-fighting） */
export function decalMaterial(tex, opts = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthWrite: false,
    side: opts.side ?? THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: true,
    fog: false,
  });
  return material;
}

/** 简单色块标签（价格牌、包装、小告示） */
export function labelTex({
  w = 256,
  h = 128,
  bg = '#fbf3dd',
  fg = '#20304f',
  text = '',
  sub = '',
  font = JP_FONT,
  size = 52,
}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(32,48,79,0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${size}px ${font}`;
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h * 0.52);
    if (sub) {
      ctx.font = `600 ${Math.round(size * 0.58)}px ${font}`;
      ctx.fillStyle = 'rgba(32,48,79,0.65)';
      ctx.fillText(sub, w / 2, h * 0.7);
    }
  });
}
