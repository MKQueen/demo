/**
 * rand.js —— 确定性随机数。同一个种子每次生成完全一样的城市，
 * 这样「水墨北京」每次打开都是同一幅画，截图和审美调参才可控。
 */

/** 32 位整数哈希 → [0,1) */
export function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** 二维格子哈希 → [0,1) */
export function hash2(x, y, seed = 0) {
  return hash01((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791));
}

/** 简单 LCG，可复现，`r()` 返回 [0,1)。 */
export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 范围内随机 */
export function range(rng, a, b) {
  return a + (b - a) * rng();
}

/** 从数组里挑一个 */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** 平滑的二维值噪声（双线性），用于山形、纸纹、雾的扰动。 */
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const n00 = hash2(xi, yi, seed);
  const n10 = hash2(xi + 1, yi, seed);
  const n01 = hash2(xi, yi + 1, seed);
  const n11 = hash2(xi + 1, yi + 1, seed);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

/** 分形噪声（4 层），返回 [-1,1]。 */
export function fbm2(x, y, seed = 0, octaves = 4) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise2(x * freq, y * freq, seed + i * 17) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
