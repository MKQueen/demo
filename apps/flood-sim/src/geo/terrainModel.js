/**
 * terrainModel.js —— 「澜屿湾」程序化地形模型（纯 JS，无 Cesium 依赖，浏览器 / Node 通用）。
 *
 * 这是整个 demo 的「世界真值」：Cesium 地形 Provider、地表贴图、淹没面积统计、
 * 3D Tiles 村庄建筑落位（scripts/generate-village-tiles.mjs）全部共用这一份高程函数，
 * 保证三者严格一致。
 *
 * 地形构成（局部坐标 x=东, y=北, 原点在场景中心，单位米）：
 *   1) 东侧海岸线（波浪形）→ 海床
 *   2) 海岸冲积平原（自东向西缓慢抬升）
 *   3) 西侧山脉（多峰高斯 + ridged 分形噪声）
 *   4) 河谷：河流从山里蜿蜒入海，切出河道与河谷
 *   5) 近岸小丘
 *
 * 参考：闵东海岸（lon 120.05, lat 26.98），纯虚构地形，不代表真实地点。
 */

// ---------------------------------------------------------------------------
// 世界常量
// ---------------------------------------------------------------------------

export const SCENE = {
  name: '澜屿湾',
  lon0: 120.05,
  lat0: 26.98,
  /** 场景东西 / 南北跨度（米），用于相机、贴图、统计范围 */
  widthMeters: 14000,
  heightMeters: 12000,
};

/** WGS84 椭球下，该纬度「1 度经/纬度」约等于多少米（局部平面近似足够） */
export const M_PER_DEG_LON = 99287;
export const M_PER_DEG_LAT = 110803;

export const HALF_W = SCENE.widthMeters / 2; // 7000
export const HALF_H = SCENE.heightMeters / 2; // 6000

export const WATER = {
  min: 0,
  max: 30,
  initial: 2.5,
  /** 水位语义（UI 标注 & 分析着色） */
  safe: 6,
  warn: 15,
  danger: 24,
  /** 统计用：水位每 2m 一档（0..30） */
  histogramStep: 2,
};

export const VILLAGE = {
  centerX: -450,
  centerY: 700,
  radiusMeters: 900,
  name: '澜屿村',
};
VILLAGE.centerLon = localToLonLat(VILLAGE.centerX, VILLAGE.centerY).lon;
VILLAGE.centerLat = localToLonLat(VILLAGE.centerX, VILLAGE.centerY).lat;

export const ELEVATION = { min: -22, max: 720, seaLevel: 0 };

// ---------------------------------------------------------------------------
// 坐标转换
// ---------------------------------------------------------------------------

/** 经纬度 → 局部米（x 东, y 北, 原点 SCENE 中心） */
export function lonLatToLocal(lon, lat) {
  return {
    x: (lon - SCENE.lon0) * M_PER_DEG_LON,
    y: (lat - SCENE.lat0) * M_PER_DEG_LAT,
  };
}

/** 局部米 → 经纬度 */
export function localToLonLat(x, y) {
  return {
    lon: SCENE.lon0 + x / M_PER_DEG_LON,
    lat: SCENE.lat0 + y / M_PER_DEG_LAT,
  };
}

/** 局部矩形（米）→ 经纬度矩形（度） */
export function localRectToDegrees(x0, y0, x1, y1) {
  const a = localToLonLat(Math.min(x0, x1), Math.min(y0, y1));
  const b = localToLonLat(Math.max(x0, x1), Math.max(y0, y1));
  return { west: a.lon, south: a.lat, east: b.lon, north: b.lat };
}

// ---------------------------------------------------------------------------
// 基础数学 / 噪声
// ---------------------------------------------------------------------------

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 0..1 值噪声（无纹理，纯计算；只用 imul 保证 int 稳定） */
function hash2(ix, iy) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bot = c + (d - c) * ux;
  return top + (bot - top) * uy; // 0..1
}
/** 分形噪声，返回 0..1 */
function fbm(x, y, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(px, py) * amp;
    norm += amp;
    amp *= gain;
    px *= lacunarity;
    py *= lacunarity;
  }
  return sum / norm;
}
/** 山脊噪声，返回 0..1（尖锐山脊） */
function ridgedFbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise(px, py) * 2 - 1;
    n = 1 - Math.abs(n);
    n *= n;
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    px = px * 2.03 + 17.1;
    py = py * 2.03 - 9.7;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// 海岸线 / 山峰
// ---------------------------------------------------------------------------

/** 海岸线 x 坐标（随 y 弯曲）；x > coastX(y) 为海 */
export function coastX(y) {
  return (
    2560 +
    640 * Math.sin(y * 0.00042 + 0.8) +
    250 * Math.sin(y * 0.00105 - 1.4) +
    120 * Math.sin(y * 0.0023 + 0.3)
  );
}

/** 海岸线采样（供贴图 / 道路绘制） */
export const COASTLINE = (() => {
  const pts = [];
  for (let y = -HALF_H - 2600; y <= HALF_H + 2600; y += 220) {
    pts.push({ x: coastX(y), y });
  }
  return pts;
})();

/** 山峰（高斯）：[x, y, 高度, sigmaX, sigmaY] */
const PEAKS = [
  [-4900, 2500, 560, 2300, 1900],
  [-3200, 4300, 430, 1700, 1500],
  [-5400, -1000, 450, 1900, 2100],
  [-3600, -2800, 380, 1900, 1600],
  [-2600, 3600, 260, 1100, 1200],
  [-6600, 1300, 420, 1700, 2400],
  [-4200, 600, 240, 1400, 1300],
];

// ---------------------------------------------------------------------------
// 河流
// ---------------------------------------------------------------------------

/**
 * 河道路径：从西侧山区出发，沿基础地形「最陡下降方向」自动寻路到海（梯度下降 + 朝海偏置 + 动量），
 * 自动贴合山谷，比手写折线自然。bedHeight 在模块初始化时按河谷底面反算。
 */
let RIVER_XY = null;
function buildRiverPath() {
  const pts = [];
  let x = -5900;
  let y = 2350;
  let dirX = 0.86;
  let dirY = -0.5;
  const eps = 28;
  for (let i = 0; i < 110; i++) {
    pts.push([x, y]);
    if (x > coastX(y) + 250 || x > HALF_W + 1600 || Math.abs(y) > HALF_H + 1800) break;
    const gx = (baseHeight(x + eps, y, Infinity) - baseHeight(x - eps, y, Infinity)) / (2 * eps);
    const gy = (baseHeight(x, y + eps, Infinity) - baseHeight(x, y - eps, Infinity)) / (2 * eps);
    const glen = Math.hypot(gx, gy) || 1;
    // 最陡下降方向 + 朝海（+x）偏置，避免在高山局部洼地里打转
    let dx = (-gx / glen) * 0.55 + 0.45;
    let dy = (-gy / glen) * 0.55;
    // 朝向海的方向做一点牵引
    dx += 0.12;
    dirX = dirX * 0.55 + dx * 0.45;
    dirY = dirY * 0.55 + dy * 0.45;
    const dl = Math.hypot(dirX, dirY) || 1;
    dirX /= dl;
    dirY /= dl;
    const step = 105;
    x += dirX * step;
    y += dirY * step;
  }
  // 平滑 2 遍（去掉噪声导致的锯齿）
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i][0] = (pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4;
      pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
    }
  }
  return pts;
}

function segDistSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  let t = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return { d2: dx * dx + dy * dy, t };
}

/** 到河流中心线的最短距离、沿线归一化位置（0=上游,1=下游） */
function riverInfo(x, y) {
  let bestD2 = Infinity;
  let bestT = 0;
  let segIndex = 0;
  for (let i = 0; i < RIVER_XY.length - 1; i++) {
    const a = RIVER_XY[i];
    const b = RIVER_XY[i + 1];
    const { d2, t } = segDistSq(x, y, a[0], a[1], b[0], b[1]);
    if (d2 < bestD2) {
      bestD2 = d2;
      segIndex = i;
      bestT = t;
    }
  }
  const along = (segIndex + bestT) / (RIVER_XY.length - 1);
  return { d: Math.sqrt(bestD2), along };
}

/** 河道宽度（米）：上游窄、下游宽 */
function riverWidth(along) {
  return 34 + 150 * Math.pow(along, 1.35);
}

// ---------------------------------------------------------------------------
// 高程核心
// ---------------------------------------------------------------------------

/** 不含河道切割 / 河谷削弱的「基础地形」（米） */
function baseHeight(x, y, riverD) {
  const cx = coastX(y);
  const inland = cx - x; // >0 陆地，<0 海

  // 海床：近岸 -3.5m，向外快速变深
  const sea = -3.2 - 17 * smoothstep(0, 2400, -inland);
  // 冲积平原：海岸附近约 1.5m，向西缓慢抬升到 25m 左右
  const plainRise = 1.4 + 22 * smoothstep(0, 9000, inland);
  const plainNoise =
    (fbm(x * 0.0011 + 3.3, y * 0.0011 - 7.2, 3) - 0.5) * 3.6 +
    (fbm(x * 0.0042 - 1.7, y * 0.0042 + 2.9, 2) - 0.5) * 0.9;
  const plain = plainRise + plainNoise * smoothstep(-200, 700, inland);
  let h = plain + (sea - plain) * (1 - smoothstep(-300, 260, inland));

  // 山脉：多峰高斯叠加，只在远离海岸的内陆出现（用 inland 掩膜保护村庄平原）
  const mountainMask = smoothstep(4000, 7200, inland);
  if (mountainMask > 0.001) {
    let mountain = 0;
    for (let i = 0; i < PEAKS.length; i++) {
      const p = PEAKS[i];
      const dx = (x - p[0]) / p[3];
      const dy = (y - p[1]) / p[4];
      mountain += p[2] * Math.exp(-(dx * dx + dy * dy) * 0.5);
    }
    // 软上限：避免多峰叠加后过高、山头过圆
    mountain = 760 * (1 - Math.exp(-mountain / 760));
    // 河谷削弱：靠河越近，山体越「让路」
    const valley = 0.45 + 0.55 * smoothstep(120, 1600, riverD);
    mountain *= valley * mountainMask;
    // 山体细节：ridged 噪声让脊线更真实
    const ridge = ridgedFbm(x * 0.0016 + 11.3, y * 0.0016 - 4.7, 4);
    mountain *= 0.84 + 0.16 * ridge;
    h += mountain;
    // 高山碎石起伏
    h += (fbm(x * 0.0034 + 8.1, y * 0.0034 + 1.7, 3) - 0.5) * 14 * smoothstep(90, 420, mountain);
  }

  // 远山/远景：不放巨大的程序化“高原”，只做低矮的远处丘陵 + 大气透视，
  // 让地平线自然消失在雾霭里（避免用户缩小地图时看到一块平板状远山）。
  const rr = Math.hypot(x, y);
  if (rr > 9000) {
    const farMask = smoothstep(9000, 24000, rr) * (1 - smoothstep(60000, 110000, rr));
    if (farMask > 0.001) {
      const landMask = smoothstep(-400, 900, inland);
      const hill = ridgedFbm(x * 0.00045 + 12.6, y * 0.00045 - 3.9, 4);
      h += (60 + 180 * hill) * landMask * farMask;
    }
  }

  return h;
}

/** 河道切割 */
function carveRiver(h, x, y, riverD, along) {
  if (riverD > 900) return h;
  const w = riverWidth(along);
  const reach = w * 2.4;
  if (riverD > reach) return h;
  // 河床：沿河插值的 bedHeight
  const bed = riverBedAt(along);
  // 横断面：中心最低，向两侧抬升
  const profile = Math.pow(riverD / w, 1.65) * 11;
  const target = bed + profile;
  if (target >= h) return h;
  // 靠近河心更陡，靠近岸边平滑过渡
  const blend = smoothstep(reach, w * 0.55, riverD);
  return h + (target - h) * Math.max(blend, 0.65);
}

let RIVER_BED = null; // 初始化后填充
function riverBedAt(along) {
  if (!RIVER_BED) initRiver();
  const n = RIVER_BED.length - 1;
  const f = clamp(along, 0, 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const t = f - i;
  return RIVER_BED[i] + (RIVER_BED[i + 1] - RIVER_BED[i]) * t;
}
function initRiver() {
  if (!RIVER_XY) RIVER_XY = buildRiverPath();
  // 河谷底面（把河当在中心，取完整河谷削弱）再下切 3m 得到河床；强制下游单调不升。
  const pts = RIVER_XY.map(([x, y]) => baseHeight(x, y, 0) - 3.0);
  for (let i = 1; i < pts.length; i++) {
    pts[i] = Math.min(pts[i], pts[i - 1] - 0.15);
  }
  const last = pts.length - 1;
  pts[last] = Math.min(pts[last], -2.2);
  RIVER_BED = pts;
}

export const RIVER_PATH = (() => {
  if (!RIVER_XY) initRiver();
  return RIVER_XY.map(([x, y], i) => {
    const ri = riverInfo(x, y);
    return {
      x,
      y,
      along: i / (RIVER_XY.length - 1),
      bedHeight: RIVER_BED[i],
      elevation: RIVER_BED[i] - 2.6, // 水面参考（低水位时可见的河面）
      width: riverWidth(i / (RIVER_XY.length - 1)),
      ...ri,
    };
  });
})();

// ---------------------------------------------------------------------------
// 河流距离加速：粗网格距离场（远处直接跳过精确折线距离计算）
// ---------------------------------------------------------------------------

const DIST_GRID = { x0: -HALF_W - 2200, y0: -HALF_H - 2200, cell: 260, nx: 0, ny: 0, data: null };
DIST_GRID.nx = Math.ceil((SCENE.widthMeters + 4400) / DIST_GRID.cell) + 1;
DIST_GRID.ny = Math.ceil((SCENE.heightMeters + 4400) / DIST_GRID.cell) + 1;

function exactRiverDistance(x, y) {
  let best = Infinity;
  for (let i = 0; i < RIVER_XY.length - 1; i++) {
    const a = RIVER_XY[i];
    const b = RIVER_XY[i + 1];
    const { d2 } = segDistSq(x, y, a[0], a[1], b[0], b[1]);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function ensureDistGrid() {
  if (DIST_GRID.data) return;
  if (!RIVER_XY) initRiver();
  const { nx, ny, cell, x0, y0 } = DIST_GRID;
  const data = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      data[j * nx + i] = exactRiverDistance(x0 + (i + 0.5) * cell, y);
    }
  }
  DIST_GRID.data = data;
}

/** 粗网格双线性距离（误差 < 1 格内，只用于「远离河流」的快速剔除） */
function coarseRiverDistance(x, y) {
  ensureDistGrid();
  const { nx, ny, cell, x0, y0, data } = DIST_GRID;
  let fx = (x - x0) / cell - 0.5;
  let fy = (y - y0) / cell - 0.5;
  if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return 1e6;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  fx -= ix;
  fy -= iy;
  const i00 = iy * nx + ix;
  const a = data[i00] + (data[i00 + 1] - data[i00]) * fx;
  const b = data[i00 + nx] + (data[i00 + nx + 1] - data[i00 + nx]) * fx;
  return a + (b - a) * fy;
}

/** 核心高程函数：局部米 → 海拔米（可为负） */
export function heightAtLocal(x, y) {
  // 远离河流（>1.8km）时河谷削弱已饱和、河道切割为 0，直接走快速路径
  const dCoarse = coarseRiverDistance(x, y);
  if (dCoarse > 1800) return baseHeight(x, y, dCoarse);
  const ri = riverInfo(x, y);
  return carveRiver(baseHeight(x, y, ri.d), x, y, ri.d, ri.along);
}

export function heightAtLonLat(lon, lat) {
  const { x, y } = lonLatToLocal(lon, lat);
  return heightAtLocal(x, y);
}

/**
 * 采样规则网格高程（row-major，先行后列；y 从北到南或南到北由调用方决定）。
 * 供贴图生成 / 淹没面积统计复用，避免重复计算。
 */
export function sampleHeights(x0, y0, dx, dy, nx, ny) {
  const out = new Float32Array(nx * ny);
  let k = 0;
  for (let j = 0; j < ny; j++) {
    const y = y0 + dy * j;
    for (let i = 0; i < nx; i++) {
      out[k++] = heightAtLocal(x0 + dx * i, y);
    }
  }
  return out;
}

/** 高程分级色带（贴图 / 图例共用） */
export const ELEVATION_BANDS = [
  { min: -999, max: -6, color: '#12333f', label: '深水' },
  { min: -6, max: 0, color: '#3d6b75', label: '浅海' },
  { min: 0, max: 2.5, color: '#c9b98a', label: '滩涂' },
  { min: 2.5, max: 15, color: '#7a9a5f', label: '村庄平原' },
  { min: 15, max: 120, color: '#3f6b45', label: '林地' },
  { min: 120, max: 380, color: '#6f7358', label: '山地' },
  { min: 380, max: 9999, color: '#9b968a', label: '山顶' },
];

/** 淹没面积统计（米² / 占比），网格采样地形，场景矩形内 */
export function computeInundatedArea(waterLevel, samples = 160) {
  const nx = samples;
  const ny = Math.max(2, Math.round((samples * HALF_H) / HALF_W));
  const dx = SCENE.widthMeters / (nx - 1);
  const dy = SCENE.heightMeters / (ny - 1);
  const x0 = -HALF_W;
  const y0 = -HALF_H;
  let inundated = 0;
  let total = 0;
  for (let j = 0; j < ny - 1; j++) {
    const y = y0 + dy * (j + 0.5);
    for (let i = 0; i < nx - 1; i++) {
      const x = x0 + dx * (i + 0.5);
      const h = heightAtLocal(x, y);
      total += 1;
      if (h < waterLevel) inundated += 1;
    }
  }
  return {
    inundatedAreaM2: inundated * dx * dy,
    totalAreaM2: total * dx * dy,
    ratio: total ? inundated / total : 0,
  };
}

/** 便捷：局部点是否在水下 */
export function isUnderwater(x, y, waterLevel) {
  return heightAtLocal(x, y) < waterLevel;
}
