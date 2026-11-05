import { POI_CATEGORY_META } from '../../data/poi';
import type { PoiCategory } from '../../data/types';

/**
 * Cesium Billboard / Label 需要位图。这里用 Canvas 在运行时生成
 * 2x 分辨率的 POI 图标、脉冲光环、流光粒子与光点，避免额外图片请求。
 * 返回 DataURL 可直接用于 Billboard.image。
 */

const iconCache = new Map<string, string>();
const dotCache = new Map<string, string>();
const pulseCache = new Map<string, string>();

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 深色描边 + 彩色填充的「数字孪生」风格 POI 图钉 */
export function createPoiMarker(category: PoiCategory, selected = false): string {
  const cacheKey = `${category}-${selected ? 'sel' : 'normal'}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const meta = POI_CATEGORY_META[category];
  const W = 96;
  const H = 124;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const color = meta.color;
  const glow = selected ? 0.7 : 0.45;
  const scale = 1;

  ctx.save();
  ctx.translate(W / 2, 0);

  // 底部投影
  const shadow = ctx.createRadialGradient(0, 116, 2, 0, 116, 26);
  shadow.addColorStop(0, 'rgba(0,0,0,.55)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, 116, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 外发光
  const halo = ctx.createRadialGradient(0, 43, 16, 0, 43, 46);
  halo.addColorStop(0, hexToRgba(color, glow * 0.65));
  halo.addColorStop(0.55, hexToRgba(color, glow * 0.18));
  halo.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 43, 46, 0, Math.PI * 2);
  ctx.fill();

  // 图钉主体
  ctx.beginPath();
  ctx.moveTo(0, 114);
  ctx.bezierCurveTo(-18 * scale, 90, -34 * scale, 68, -34 * scale, 43);
  ctx.arc(0, 43, 34 * scale, Math.PI, 0, false);
  ctx.bezierCurveTo(34 * scale, 68, 18 * scale, 90, 0, 114);
  ctx.closePath();

  const bodyGradient = ctx.createLinearGradient(0, 8, 0, 114);
  bodyGradient.addColorStop(0, '#0a1622');
  bodyGradient.addColorStop(0.45, '#071019');
  bodyGradient.addColorStop(1, '#03080d');
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  // 内侧颜色环
  ctx.lineWidth = selected ? 4.5 : 3.5;
  ctx.strokeStyle = hexToRgba(color, selected ? 1 : 0.9);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,.42)';
  ctx.stroke();

  // 中心圆盘
  const disc = ctx.createRadialGradient(0, 38, 2, 0, 43, 26);
  disc.addColorStop(0, hexToRgba(color, 0.32));
  disc.addColorStop(1, 'rgba(3,10,16,.92)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 43, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hexToRgba(color, 0.55);
  ctx.stroke();

  // 类别符号
  ctx.strokeStyle = selected ? '#ffffff' : hexToRgba(color, 0.97);
  ctx.fillStyle = selected ? '#ffffff' : hexToRgba(color, 0.97);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(0, 43);

  if (meta.glyph === 'tower') {
    // 天际线：中国尊轮廓 + 两侧楼
    ctx.beginPath();
    ctx.moveTo(-13, 10);
    ctx.lineTo(-13, -1);
    ctx.lineTo(-9, -1);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-3, -13);
    ctx.lineTo(3, -13);
    ctx.lineTo(9, -10);
    ctx.lineTo(9, -1);
    ctx.lineTo(13, -1);
    ctx.lineTo(13, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, 3);
    ctx.lineTo(9, 3);
    ctx.stroke();
  } else if (meta.glyph === 'business') {
    // 公文包
    roundRect(ctx, -12, -6, 24, 17, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(-5, -10);
    ctx.lineTo(5, -10);
    ctx.lineTo(5, -6);
    ctx.moveTo(-12, 1);
    ctx.lineTo(12, 1);
    ctx.stroke();
  } else if (meta.glyph === 'shop') {
    // 购物袋
    roundRect(ctx, -11, -6, 22, 18, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -6, 6, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(5, 2);
    ctx.stroke();
  } else {
    // 地铁 M
    ctx.font = '800 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 0, 1);
    ctx.beginPath();
    ctx.arc(0, 12, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  const url = canvas.toDataURL('image/png');
  iconCache.set(cacheKey, url);
  return url;
}

/** 选中点位的脉冲光环（含四段弧线，科技感） */
export function createPulseRing(color: string): string {
  const cached = pulseCache.get(color);
  if (cached) return cached;
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 30, c, c, 92);
  gradient.addColorStop(0, hexToRgba(color, 0));
  gradient.addColorStop(0.72, hexToRgba(color, 0.04));
  gradient.addColorStop(0.9, hexToRgba(color, 0.6));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(c, c, 96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, 0.95);
  ctx.lineWidth = 3;
  const segments = 4;
  for (let i = 0; i < segments; i += 1) {
    const start = (i / segments) * Math.PI * 2 + 0.18;
    const end = start + Math.PI / 7;
    ctx.beginPath();
    ctx.arc(c, c, 78, start, end);
    ctx.stroke();
  }
  const url = canvas.toDataURL('image/png');
  pulseCache.set(color, url);
  return url;
}

/** 流光 / 光点用的径向渐变圆点 */
export function createGlowDot(color: string): string {
  const cached = dotCache.get(color);
  if (cached) return cached;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,0.98)');
  gradient.addColorStop(0.18, hexToRgba(color, 0.95));
  gradient.addColorStop(0.48, hexToRgba(color, 0.35));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  const url = canvas.toDataURL('image/png');
  dotCache.set(color, url);
  return url;
}

/** 建筑顶部标签用的细发光点（用于地标顶点标记） */
export function createVerticeDot(color: string): string {
  return createGlowDot(color);
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
