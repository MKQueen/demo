/**
 * groundTexture.js —— 程序化「卫星影像」地表贴图（浏览器 Canvas 生成，单张瓦片）。
 *
 * 与 Cesium 的 SingleTileImageryProvider 配合：整块 14km × 12km 的地表用一张
 * 2048px 贴图覆盖。颜色不是随便涂的，而是基于 terrainModel 的同一份高程：
 *   - 高程分级色带（海床 / 滩涂 / 农田 / 林地 / 山岩）
 *   - 由高程梯度计算的山体阴影（西侧黄昏侧光，和场景光照方向一致）
 *   - 河流 / 道路 / 建筑基底（读 public/generated/village/ 数据）
 *
 * 生成过程约 0.5~1.5s，在加载遮罩里显示进度。
 */
import {
  SCENE,
  HALF_W,
  HALF_H,
  VILLAGE,
  RIVER_PATH,
  heightAtLocal,
  lonLatToLocal,
} from '../geo/terrainModel.js';

const TEX_W = 2048;
const TEX_H = Math.round((TEX_W * SCENE.heightMeters) / SCENE.widthMeters);
const GRID_W = 640;
const GRID_H = Math.round((GRID_W * SCENE.heightMeters) / SCENE.widthMeters);
const M_PER_PX_X = SCENE.widthMeters / TEX_W;
const M_PER_PX_Y = SCENE.heightMeters / TEX_H;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(ix, iy) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// 高程色带（stop, rgb）
const STOPS = [
  [-24, [13, 34, 44]],
  [-9, [30, 62, 72]],
  [-3, [74, 96, 94]],
  [-0.8, [142, 132, 106]],
  [0.8, [201, 187, 150]],
  [3.2, [190, 178, 143]],
  [6.0, [136, 152, 107]],
  [14, [112, 134, 91]],
  [45, [82, 112, 76]],
  [130, [63, 92, 66]],
  [260, [102, 103, 88]],
  [430, [146, 142, 130]],
  [680, [181, 179, 172]],
];
function elevationColor(h) {
  if (h <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** 农田 / 林地 / 岩地的细节彩色（返回乘性系数） */
function detailTint(h, x, y) {
  if (h > 3 && h < 22) {
    // 农田拼块：按 ~110m 网格 + 噪声分块
    const cx = Math.floor(x / 110 + hash2(Math.floor(y / 110), 7) * 0.8);
    const cy = Math.floor(y / 110);
    const r = hash2(cx * 3 + 11, cy * 5 - 7);
    const green = [0.92, 1.0, 0.9];
    const gold = [1.08, 1.02, 0.82];
    const brown = [1.02, 0.92, 0.78];
    const palette = r < 0.34 ? green : r < 0.68 ? gold : brown;
    const micro = 0.92 + 0.12 * hash2(Math.floor(x / 9), Math.floor(y / 9));
    return [palette[0] * micro, palette[1] * micro, palette[2] * micro];
  }
  if (h >= 22 && h < 160) {
    const n = 0.88 + 0.2 * hash2(Math.floor(x / 24), Math.floor(y / 24));
    return [n * 0.97, n * 1.02, n * 0.95];
  }
  if (h >= 160) {
    const n = 0.9 + 0.18 * hash2(Math.floor(x / 34) + 5, Math.floor(y / 34));
    // 山体偏灰、偶发绿色植被斑块
    const veg = smoothstep(0.55, 0.9, hash2(Math.floor(x / 260) + 3, Math.floor(y / 260) + 8));
    return [n * (0.98 + 0.03 * veg), n * (1.0 + 0.04 * veg), n * (0.99 - 0.02 * veg)];
  }
  return [1, 1, 1];
}

/** 由高程网格计算山体阴影（光来自西偏北，和黄昏太阳方向一致） */
function hillshadeAt(grid, gx, gy) {
  const ix = Math.min(GRID_W - 1, Math.max(0, Math.round(gx)));
  const iy = Math.min(GRID_H - 1, Math.max(0, Math.round(gy)));
  const ix0 = Math.max(0, ix - 1);
  const ix1 = Math.min(GRID_W - 1, ix + 1);
  const iy0 = Math.max(0, iy - 1);
  const iy1 = Math.min(GRID_H - 1, iy + 1);
  const dzdx = (grid[iy * GRID_W + ix1] - grid[iy * GRID_W + ix0]) / ((ix1 - ix0) * (SCENE.widthMeters / (GRID_W - 1)));
  const dzdy = (grid[iy0 * GRID_W + ix] - grid[iy1 * GRID_W + ix]) / ((iy1 - iy0) * (SCENE.heightMeters / (GRID_H - 1)));
  const nx = -dzdx;
  const ny = -dzdy;
  const nz = 1;
  const inv = 1 / Math.hypot(nx, ny, nz);
  // 光照方向（指向光源）：西偏南、高度角 ~28°
  const lx = -0.86;
  const ly = -0.18;
  const lz = 0.48;
  const ll = Math.hypot(lx, ly, lz);
  const dot = (nx * lx + ny * ly + nz * lz) * inv / ll;
  return clamp(0.62 + dot * 0.62, 0.38, 1.18);
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 生成地表贴图并返回 Cesium ImageryProvider。
 * @param {{ onProgress?: (p:number, label:string)=>void }} [options]
 */
export async function createGroundImagery(options = {}) {
  const { onProgress = () => {} } = options;
  onProgress(0.04, '正在采样地形高程…');

  // 1) 高程网格（用于取色 + 山体阴影 + 坡度）
  const grid = new Float32Array(GRID_W * GRID_H);
  const gxStep = (SCENE.widthMeters / (GRID_W - 1));
  const gyStep = (SCENE.heightMeters / (GRID_H - 1));
  for (let j = 0; j < GRID_H; j++) {
    const y = HALF_H - j * gyStep;
    for (let i = 0; i < GRID_W; i++) {
      grid[j * GRID_W + i] = heightAtLocal(-HALF_W + i * gxStep, y);
    }
    if (j % 60 === 0) onProgress(0.04 + 0.16 * (j / GRID_H), '正在采样地形高程…');
  }

  // 2) 读村庄数据（可选，生成脚本没跑时自动跳过）
  onProgress(0.22, '正在绘制河道与道路…');
  const [buildingsData, roadsData] = await Promise.all([
    fetchJSON(new URL('generated/village/buildings.json', document.baseURI).href),
    fetchJSON(new URL('generated/village/roads.json', document.baseURI).href),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  if (typeof window !== 'undefined') window.__groundCanvas = canvas;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = ctx.createImageData(TEX_W, TEX_H);
  const data = image.data;

  // 3) 逐像素着色
  const gridDx = (GRID_W - 1) / TEX_W;
  const gridDy = (GRID_H - 1) / TEX_H;
  for (let py = 0; py < TEX_H; py++) {
    const gy = py * gridDy;
    const y = HALF_H - (py + 0.5) * M_PER_PX_Y;
    for (let px = 0; px < TEX_W; px++) {
      const gx = px * gridDx;
      const x = -HALF_W + (px + 0.5) * M_PER_PX_X;
      const h = heightAtLocal(x, y); // 精确高程（兼顾河道）
      let c = elevationColor(h);
      const tint = detailTint(h, x, y);
      const shade = hillshadeAt(grid, gx, gy);
      const grain = 0.97 + 0.06 * hash2(px, py);
      const k = (py * TEX_W + px) * 4;
      data[k] = clamp(c[0] * tint[0] * shade * grain, 0, 255);
      data[k + 1] = clamp(c[1] * tint[1] * shade * grain, 0, 255);
      data[k + 2] = clamp(c[2] * tint[2] * shade * grain, 0, 255);
      data[k + 3] = 255;
    }
    if (py % 250 === 0) onProgress(0.22 + 0.5 * (py / TEX_H), '正在绘制地表贴图…');
  }
  ctx.putImageData(image, 0, 0);

  // 4) 河流（河道底色：湿砾石 + 河心深色，水面由 Shader 后处理叠加）
  const toPx = (x, y) => [((x + HALF_W) / SCENE.widthMeters) * TEX_W, ((HALF_H - y) / SCENE.heightMeters) * TEX_H];
  const river = RIVER_PATH;
  function strokePath(points, widthMeters, color, alpha = 1) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const [px, py] = toPx(points[i].x, points[i].y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = Math.max(1.5, (widthMeters / M_PER_PX_X));
    ctx.stroke();
    ctx.restore();
  }
  // 外圈滩地
  strokePath(
    river.map((p) => ({ x: p.x, y: p.y })),
    220,
    'rgba(150,143,120,0.55)',
  );
  strokePath(
    river.map((p) => ({ x: p.x, y: p.y })),
    70,
    'rgba(96,98,84,0.9)',
  );
  strokePath(
    river.map((p) => ({ x: p.x, y: p.y })),
    26,
    'rgba(58,74,76,0.85)',
  );

  // 5) 道路
  if (roadsData && Array.isArray(roadsData.roads)) {
    for (const road of roadsData.roads) {
      const pts = (road.points || []).map((p) => ({ x: p.x, y: p.y }));
      strokePath(pts, (road.width || 6) * 1.8, 'rgba(70,64,52,0.5)');
      strokePath(pts, road.width || 6, 'rgba(196,182,150,0.9)');
    }
  } else {
    // 兜底：一条从村庄通往海岸的土路
    strokePath(
      [
        { x: VILLAGE.centerX, y: VILLAGE.centerY },
        { x: VILLAGE.centerX + 700, y: VILLAGE.centerY - 380 },
        { x: 1500, y: 200 },
        { x: 2300, y: 120 },
      ],
      7,
      'rgba(196,182,150,0.85)',
    );
  }

  // 6) 建筑基底（屋顶俯视图；3D Tiles 在上面，正射时更自然）
  if (buildingsData && Array.isArray(buildingsData.buildings)) {
    ctx.save();

    // 6a) 城镇底噪：各片区的铺装/院落地色，让鸟瞰时城市轮廓更清晰
    for (const center of [
      { x: VILLAGE.centerX, y: VILLAGE.centerY, r: 560 }, // 老城（相对村庄中心 -450,700）
      { x: VILLAGE.centerX - 700, y: VILLAGE.centerY - 950, r: 720 }, // 西城
      { x: VILLAGE.centerX + 150, y: VILLAGE.centerY + 700, r: 620 }, // 北城
      { x: VILLAGE.centerX + 1750, y: VILLAGE.centerY - 200, r: 720 }, // 滨海新区
      { x: VILLAGE.centerX + 2150, y: VILLAGE.centerY - 50, r: 420 }, // CBD
      { x: VILLAGE.centerX + 1800, y: VILLAGE.centerY - 1500, r: 260 }, // 滨水公共带
    ]) {
      const [cxp, cyp] = toPx(center.x, center.y);
      const rp = center.r / M_PER_PX_X;
      const grd = ctx.createRadialGradient(cxp, cyp, rp * 0.12, cxp, cyp, rp);
      grd.addColorStop(0, 'rgba(150,138,118,0.22)');
      grd.addColorStop(0.62, 'rgba(144,132,112,0.13)');
      grd.addColorStop(1, 'rgba(144,132,112,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cxp, cyp, rp, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6b) 建筑基底：按占地放大一些，保证鸟瞰能看出成片屋顶
    for (const b of buildingsData.buildings) {
      // manifest 里同时有绝对经纬度和相对村庄中心的 localX/localY
      const p = b.lon != null ? lonLatToLocal(b.lon, b.lat) : { x: VILLAGE.centerX + b.localX, y: VILLAGE.centerY + b.localY };
      const [px, py] = toPx(p.x, p.y);
      const side = (Math.sqrt(Math.max(20, b.footprintArea || 80)) / M_PER_PX_X) * 1.15;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-(b.rotation || 0));
      ctx.fillStyle = b.type === 'public' ? 'rgba(118,118,116,0.92)' : 'rgba(110,98,86,0.92)';
      ctx.fillRect(-side / 2, -side / 2, side, side);
      ctx.restore();
    }
    // 村庄中心小广场
    const [vx, vy] = toPx(VILLAGE.centerX, VILLAGE.centerY);
    ctx.globalAlpha = 0.25;
    const grd = ctx.createRadialGradient(vx, vy, 4, vx, vy, 120);
    grd.addColorStop(0, 'rgba(200,190,160,0.9)');
    grd.addColorStop(1, 'rgba(200,190,160,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(vx - 120, vy - 120, 240, 240);
    ctx.restore();
  }

  onProgress(0.82, '正在生成地表纹理…');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const textureUrl = URL.createObjectURL(blob);
  onProgress(0.92, '地表纹理就绪');
  return { textureUrl, canvas };
}
