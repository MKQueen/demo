/**
 * textures.js —— 全部纹理由 Canvas 程序化生成，不依赖任何外部图片。
 *
 * 这是「水墨感」的第一层：纸纹、墨晕、水波线、雾带、树影。
 * 所有纹理都在 sRGB 空间，配合 three 的 colorSpace 设置。
 */
import * as THREE from 'three';
import { makeRng, hash2, fbm2 } from './rand.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { repeat = [1, 1], srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 宣纸：米白底 + 细纤维 + 大块云斑 + 极细颗粒。
 * 既做场景背景叠层，也做 UI 的纸卡底纹。
 */
export function createPaperTexture(size = 1024) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(20240301);

  ctx.fillStyle = '#f2ead9';
  ctx.fillRect(0, 0, size, size);

  // 云斑：低频噪声叠几层很淡的暖灰，模拟纸浆不均匀
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x / 220, y / 220, 11, 4) * 0.5 + fbm2(x / 40, y / 40, 7, 3) * 0.12;
      const v = Math.round(n * 8 - 2);
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, Math.max(0, d[i] + v));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + v));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + v - 2));
    }
  }
  ctx.putImageData(img, 0, 0);

  // 纤维：细短毛边
  for (let i = 0; i < 2600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 3 + rng() * 22;
    const a = rng() * Math.PI * 2;
    ctx.strokeStyle = `rgba(120,108,88,${0.025 + rng() * 0.05})`;
    ctx.lineWidth = 0.6 + rng() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // 少量深色草屑
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(90,80,64,${0.05 + rng() * 0.08})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  return toTexture(c, { srgb: true });
}

/**
 * 大块墨晕：用于地面留白处的淡墨渲染（一张 512 的灰度图，alpha 控制）。
 */
export function createWashTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        fbm2(x / 90, y / 90, 31, 5) * 0.7 +
        fbm2(x / 26, y / 26, 55, 3) * 0.3;
      const v = Math.max(0, n);
      const i = (y * size + x) * 4;
      d[i] = 42;
      d[i + 1] = 52;
      d[i + 2] = 54;
      d[i + 3] = Math.min(255, Math.pow(v, 2.2) * 210);
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: true });
}

/**
 * 水波线：一层层横向的细墨线，带断裂与浓淡，铺在水面上做「线描水纹」。
 * R 通道 = 线浓度（白线），用于 shader 叠加。
 */
export function createWaterLineTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(7788);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const rows = 26;
  for (let r = 0; r < rows; r++) {
    const y0 = (r / rows) * size + rng() * 3;
    const amp = 1.5 + rng() * 4.5;
    const phase = rng() * Math.PI * 2;
    const freq = (1 + Math.floor(rng() * 3)) * Math.PI * 2;
    const alpha = 0.12 + rng() * 0.35;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 0.7 + rng() * 1.1;
    ctx.beginPath();
    let started = false;
    for (let x = 0; x <= size; x += 4) {
      const y = y0 + Math.sin((x / size) * freq + phase) * amp + Math.sin((x / size) * freq * 2.7 + phase * 1.7) * amp * 0.28;
      // 断笔：随机跳过一段
      const gap = hash2(Math.floor(x / 8), r, 5) < 0.16;
      if (gap) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  return toTexture(c, { srgb: false });
}

/**
 * 雾带 / 云气：横向拉长的柔和墨团，中心淡、边缘散开。
 * RGB 是墨色，A 是浓度。
 */
export function createMistTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(99123);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = size * (0.5 + (rng() - 0.5) * 0.85);
    const y = size * (0.5 + (rng() - 0.5) * 0.6);
    const rx = size * (0.1 + rng() * 0.3);
    const ry = rx * (0.12 + rng() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    const a = 0.05 + rng() * 0.1;
    g.addColorStop(0, `rgba(90,98,96,${a})`);
    g.addColorStop(0.55, `rgba(96,104,102,${a * 0.55})`);
    g.addColorStop(1, 'rgba(100,108,106,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 纵向压扁一点，做出横雾
  const out = makeCanvas(size, size);
  const octx = out.getContext('2d');
  octx.drawImage(c, 0, 0);
  return toTexture(out, { srgb: true });
}

/**
 * 树冠的笔触：一团不规则的墨点，外缘飞白。多帧并列生成 2×2 图集？
 * 这里生成单张即可，树叶用多张不同种子纹理随机挑。
 */
export function createFoliageTexture(seed = 3, size = 256, color = [60, 76, 66]) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(seed * 7717 + 13);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const blobCount = 26 + Math.floor(rng() * 18);
  for (let i = 0; i < blobCount; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.pow(rng(), 0.6) * size * 0.34;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.92;
    const rad = size * (0.03 + rng() * 0.09);
    const alpha = 0.1 + rng() * 0.24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 1.6);
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
    g.addColorStop(0.6, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.5})`);
    g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 飞白：随机刮掉一些
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rng() * 0.35})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 12);
  }
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(c, { srgb: true });
}

/**
 * 一笔墨（用于飞鸟、小舟、屋脊装饰等 billboard）。
 * 返回一张 128×128 的墨迹纹理。
 */
export function createInkBlobTexture(seed = 7, size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = makeRng(seed * 131 + 5);
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5);
  g.addColorStop(0, 'rgba(32,38,42,0.95)');
  g.addColorStop(0.55, 'rgba(32,38,42,0.55)');
  g.addColorStop(1, 'rgba(32,38,42,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.5, size * 0.48, size * 0.3, rng() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c, { srgb: true });
}

/** 平滑径向渐变（太阳、灯晕、光斑） */
export function createGlowTexture(size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: true });
}

/** 所有纹理一次性生成（首帧用，避免各自 new 造成重复）。 */
export function createTextureSet() {
  return {
    paper: createPaperTexture(),
    wash: createWashTexture(),
    waterLine: createWaterLineTexture(),
    mist: createMistTexture(),
    foliage: [createFoliageTexture(1), createFoliageTexture(2), createFoliageTexture(4)],
    ink: createInkBlobTexture(),
    glow: createGlowTexture(),
  };
}
