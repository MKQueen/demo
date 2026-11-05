/**
 * villageLayout.js —— 「澜屿港」（Lanyu Harbor）城镇布局（纯 JS，无 Cesium 依赖，Node / 浏览器通用）。
 *
 * 本轮升级：由单一村庄扩展为「山脚老城 + 滨海新区」的双组团市镇，约 360 栋建筑。
 *
 * 一、老城组团（澜屿老城）
 *   - 中心约 (-450, 700)，可建半径约 1000m（西侧沿山脚自然收边），地面 5~14m；
 *   - 保留上一轮村庄的街道肌理：澜屿街（东西主街）、溪岸路（向北到河口渡口）、
 *     城北街、后巷、石阶巷、井边巷、打铁巷、城隍巷、南门街；
 *   - 2~4 层坡屋顶民居（暖陶瓦）+ 沿街商铺 + 2 栋公共建筑（文化礼堂、防汛调度站）。
 *
 * 二、滨海新区（澜屿港新区）
 *   - 规划中心 (1700, 450)。受地形限制：地面高程从 x≈1500 往东快速降到初始水位
 *     2.5m 以下（真正海岸线 coastX≈2860~3140），所以实际可建带是 x≈950~1950 /
 *     y≈-50~1050（越往北可建范围越靠东）。建筑沿真实等高线落在西侧，
 *     东侧留出滨海大道 + 浅海 + 栈桥（符合「东侧临海留白」）；
 *   - 滨海大道沿 2.6~2.9m 等高线南北向弯曲，东侧为浅海；4 座栈桥从大道东侧伸入水面；
 *   - 4~8 层公寓/酒店/商住 + 3 栋地标塔楼（32~48m）。
 *
 * 三、两团通过 2 条主路相连：港城大道（北线）、临港大道（南线），中间不空。
 *
 * 数据与规则：
 *   - 所有坐标先统一用**场景局部米**（terrainModel 坐标系，x 东 / y 北），
 *     buildings.json 里的 localX/localY = 场景坐标 - 村庄中心（3D Tiles 根 ENU）；
 *   - 高程真值全部来自 `heightAtLocal()`：groundHeight / minGround / maxGround；
 *   - 避河（距河心 > 180m）、避海（地面 > 2.2m；新区更严 ~2.62m 保证初始水位不淹脚）、
 *     避陡坡；地基一律下埋 2m；建筑互不重叠（OBB + 间距）；
 *   - 固定种子（mulberry32）→ 完全可复现；生成脚本与运行时共用本模块。
 */

import {
  heightAtLocal,
  localToLonLat,
  VILLAGE,
  RIVER_PATH,
  coastX,
} from './terrainModel.js';

// ---------------------------------------------------------------------------
// 常量 / 世界设定
// ---------------------------------------------------------------------------

/** 默认随机种子：改动它会得到另一座（同样合理的）城镇。数据可复现。 */
export const LAYOUT_SEED = 20261104;
export const LAYOUT_VERSION = 2;

/** 3D Tiles 根节点 / buildings.json 的参考中心（沿用 terrainModel 的村庄中心） */
export const VILLAGE_CENTER = {
  x: VILLAGE.centerX,
  y: VILLAGE.centerY,
  lon: VILLAGE.centerLon,
  lat: VILLAGE.centerLat,
};

/** 城镇元数据（供生成脚本 / 文档 / 调试使用） */
export const TOWN = {
  name: '澜屿市',
  districts: [
    { id: 'old', name: '澜屿老城', center: { x: -450, y: 700 }, buildRadius: 1000, kind: 'old' },
    { id: 'west', name: '西城片区', center: { x: -1150, y: -250 }, buildRadius: 1550, kind: 'old' },
    { id: 'north', name: '北城片区', center: { x: -300, y: 1400 }, buildRadius: 1150, kind: 'old' },
    { id: 'harbor', name: '澜屿港新区', center: { x: 1300, y: 500 }, buildRadius: 900, kind: 'harbor' },
    { id: 'cbd', name: '滨海 CBD', center: { x: 1700, y: 650 }, buildRadius: 620, kind: 'cbd' },
    { id: 'waterfront', name: '滨水公共带', center: { x: 1350, y: -800 }, buildRadius: 1100, kind: 'harbor' },
  ],
  links: ['港城大道', '临港大道', '澜屿街', '西环路', '南环路'],
};

/** 基础下埋深度（m） */
export const FOUNDATION_DEPTH = 2.0;

// ---------------------------------------------------------------------------
// 建址限制
// ---------------------------------------------------------------------------

/** 各片区建址限制（中心 / 半径 / 地面高程区间 / 外观风格） */
const DISTRICT_LIMITS = {
  old: { flavor: 'old', center: { x: -450, y: 700 }, radius: 1000, minGround: 2.2, maxGround: 14.0 },
  west: { flavor: 'old', center: { x: -1150, y: -250 }, radius: 1300, minGround: 2.72, maxGround: 24.0 },
  north: { flavor: 'old', center: { x: -300, y: 1400 }, radius: 1150, minGround: 2.72, maxGround: 24.0 },
  harbor: { flavor: 'harbor', center: { x: 1300, y: 0 }, radius: 1650, minGround: 2.72, maxGround: 8.0 },
  cbd: { flavor: 'cbd', center: { x: 1700, y: 650 }, radius: 620, minGround: 2.72, maxGround: 8.0 },
  waterfront: { flavor: 'harbor', center: { x: 1350, y: -800 }, radius: 1300, minGround: 2.72, maxGround: 8.0 },
};
const FLAVOR_LIMITS = {
  old: { minGround: 2.2, maxGround: 24.0 },
  harbor: { minGround: 2.62, maxGround: 8.0 },
};
/** 占地范围高差/短边超过该值视为陡坡，不建 */
const MAX_SLOPE = 0.26;
/** 到河心线最小距离（m） */
const MIN_RIVER_DIST = 180;
/** 建筑之间的最小间距（m） */
const BUILDING_GAP = 1.2;
/** 到海岸线（terrainModel.coastX）的最小内缩距离（m），非栈桥建筑 */
const MIN_COAST_DIST = 260;

// ---------------------------------------------------------------------------
// 随机数（mulberry32）
// ---------------------------------------------------------------------------

/**
 * mulberry32 PRNG：输入 32 位种子，返回 () => [0,1) 的函数。
 * @param {number} seed
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rng, min, max) {
  return min + rng() * (max - min);
}
function pick(rng, arr) {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}
function chance(rng, p) {
  return rng() < p;
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
function round2(v) {
  return Math.round(v * 100) / 100;
}

/** 加权抽样：weights = {key:number} */
function weightedPick(rng, weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = rng() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  const keys = Object.keys(weights);
  return keys[keys.length - 1];
}

// ---------------------------------------------------------------------------
// 折线 / 曲线工具（场景局部米）
// ---------------------------------------------------------------------------

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function distToPolyline(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const { d2 } = segDistSq(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * 把锚点插值成平滑折线并按等弧长重采样。
 * @param {{x:number,y:number}[]} anchors
 * @param {number} spacing 采样间距（m）
 */
function buildRoadCurve(anchors, spacing = 9) {
  const pad = (p) => ({ x: p.x, y: p.y });
  const ext = [pad(anchors[0]), ...anchors.map(pad), pad(anchors[anchors.length - 1])];
  const raw = [];
  for (let i = 0; i < ext.length - 3; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    const segLen = dist2D(p1, p2);
    const n = Math.max(2, Math.ceil(segLen / spacing));
    for (let j = 0; j < n; j++) raw.push(catmullRom(p0, p1, p2, p3, j / n));
  }
  raw.push(pad(anchors[anchors.length - 1]));

  const pts = [raw[0]];
  for (const p of raw.slice(1)) {
    if (dist2D(p, pts[pts.length - 1]) > 1e-6) pts.push(p);
  }

  const cum = [0];
  const angles = [];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + dist2D(pts[i - 1], pts[i]));
    angles.push(Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x));
  }
  angles.push(angles[angles.length - 1]);
  const length = cum[cum.length - 1];

  function at(s) {
    const clamped = Math.max(0, Math.min(length - 1e-6, s));
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= clamped) lo = mid;
      else hi = mid;
    }
    const t = (clamped - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]);
    const a = pts[lo];
    const b = pts[lo + 1];
    const angle = angles[lo];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle,
      nx: -Math.sin(angle),
      ny: Math.cos(angle),
    };
  }

  return { points: pts, cum, angleAt: angles, length, at };
}

// ---------------------------------------------------------------------------
// 几何工具：建筑占地矩形（OBB）
// ---------------------------------------------------------------------------

/** 建筑本地坐标 (lx, ly) → 世界（场景局部米） */
function toWorld(b, lx, ly) {
  const c = Math.cos(b.rotation);
  const s = Math.sin(b.rotation);
  return { x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c };
}

/** 占地四角点（场景局部米）；margin 为向外扩的间距 */
export function footprintCorners(b, margin = 0) {
  const hw = b.width / 2 + margin;
  const hd = b.depth / 2 + margin;
  return [
    toWorld(b, -hw, -hd),
    toWorld(b, hw, -hd),
    toWorld(b, hw, hd),
    toWorld(b, -hw, hd),
  ];
}

/** 两个 OBB 是否相交（SAT），margin 让彼此再外扩 */
function obbOverlap(a, b, margin = 0) {
  const axes = [
    [Math.cos(a.rotation), Math.sin(a.rotation)],
    [-Math.sin(a.rotation), Math.cos(a.rotation)],
    [Math.cos(b.rotation), Math.sin(b.rotation)],
    [-Math.sin(b.rotation), Math.cos(b.rotation)],
  ];
  const project = (rect, ax) => {
    const axA = [Math.cos(rect.rotation), Math.sin(rect.rotation)];
    const axB = [-Math.sin(rect.rotation), Math.cos(rect.rotation)];
    const r =
      Math.abs(axA[0] * ax[0] + axA[1] * ax[1]) * (rect.width / 2) +
      Math.abs(axB[0] * ax[0] + axB[1] * ax[1]) * (rect.depth / 2);
    return { c: rect.x * ax[0] + rect.y * ax[1], r };
  };
  for (const ax of axes) {
    const pa = project(a, ax);
    const pb = project(b, ax);
    if (Math.abs(pa.c - pb.c) > pa.r + pb.r + margin) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 道路定义（场景局部米，x 东 / y 北）
// ---------------------------------------------------------------------------

/**
 * kind: main（主街）/ lane（巷）/ boulevard（滨海大道）/ promenade（滨海长廊）
 * surface 供地表贴图着色。
 */
const ROAD_DEFS = [
  // ===================== 老城 =====================
  {
    id: 'old-main-a',
    name: '澜屿街',
    kind: 'main',
    surface: 'paved',
    width: 10.0,
    anchors: [
      { x: -1150, y: 760 },
      { x: -900, y: 745 },
      { x: -620, y: 720 },
      { x: -350, y: 700 },
      { x: -80, y: 690 },
      { x: 200, y: 710 },
      { x: 450, y: 760 },
      { x: 700, y: 820 },
    ],
  },
  {
    id: 'old-main-b',
    name: '溪岸路',
    kind: 'main',
    surface: 'paved',
    width: 9.0,
    anchors: [
      { x: -500, y: 712 },
      { x: -470, y: 900 },
      { x: -530, y: 1150 },
      { x: -600, y: 1400 },
      { x: -648, y: 1650 },
      { x: -655, y: 1845 },
    ],
  },
  {
    id: 'old-main-c',
    name: '城北街',
    kind: 'main',
    surface: 'paved',
    width: 9.0,
    anchors: [
      { x: -950, y: 1120 },
      { x: -600, y: 1085 },
      { x: -250, y: 1070 },
      { x: 80, y: 1085 },
      { x: 380, y: 1120 },
      { x: 620, y: 1160 },
    ],
  },
  {
    id: 'old-lane-d',
    name: '后巷',
    kind: 'lane',
    surface: 'gravel',
    width: 5.5,
    anchors: [
      { x: -950, y: 430 },
      { x: -620, y: 435 },
      { x: -280, y: 455 },
      { x: 70, y: 495 },
      { x: 350, y: 545 },
    ],
  },
  {
    id: 'old-lane-e',
    name: '石阶巷',
    kind: 'lane',
    surface: 'stone',
    width: 4.2,
    anchors: [
      { x: -880, y: 742 },
      { x: -858, y: 600 },
      { x: -840, y: 470 },
      { x: -828, y: 420 },
    ],
  },
  {
    id: 'old-lane-f',
    name: '井边巷',
    kind: 'lane',
    surface: 'stone',
    width: 4.2,
    anchors: [
      { x: -120, y: 692 },
      { x: -100, y: 610 },
      { x: -80, y: 540 },
      { x: -70, y: 500 },
    ],
  },
  {
    id: 'old-lane-g',
    name: '打铁巷',
    kind: 'lane',
    surface: 'stone',
    width: 4.4,
    anchors: [
      { x: -450, y: 700 },
      { x: -430, y: 565 },
      { x: -412, y: 450 },
    ],
  },
  {
    id: 'old-lane-h',
    name: '城隍巷',
    kind: 'lane',
    surface: 'stone',
    width: 4.6,
    anchors: [
      { x: -620, y: 720 },
      { x: -600, y: 900 },
      { x: -580, y: 1085 },
    ],
  },
  {
    id: 'old-lane-j',
    name: '南门街',
    kind: 'lane',
    surface: 'paved',
    width: 6.0,
    anchors: [
      { x: 200, y: 710 },
      { x: 260, y: 600 },
      { x: 320, y: 500 },
      { x: 370, y: 430 },
    ],
  },

  // ===================== 老城 → 新区 两条连接主路 =====================
  {
    id: 'conn-north',
    name: '港城大道',
    kind: 'main',
    surface: 'paved',
    width: 11.0,
    anchors: [
      { x: 700, y: 820 },
      { x: 950, y: 830 },
      { x: 1200, y: 830 },
      { x: 1450, y: 820 },
      { x: 1650, y: 800 },
      { x: 1810, y: 748 },
    ],
  },
  {
    id: 'conn-south',
    name: '临港大道',
    kind: 'main',
    surface: 'paved',
    width: 10.0,
    anchors: [
      { x: 370, y: 430 },
      { x: 650, y: 425 },
      { x: 950, y: 435 },
      { x: 1250, y: 460 },
      { x: 1450, y: 480 },
      { x: 1570, y: 500 },
    ],
  },

  // ===================== 滨海新区 =====================
  {
    id: 'harbor-blvd',
    name: '滨海大道',
    kind: 'boulevard',
    surface: 'paved',
    width: 12.0,
    anchors: [
      { x: 1540, y: -60 },
      { x: 1520, y: 100 },
      { x: 1490, y: 200 },
      { x: 1480, y: 300 },
      { x: 1510, y: 400 },
      { x: 1570, y: 500 },
      { x: 1660, y: 600 },
      { x: 1770, y: 700 },
      { x: 1870, y: 800 },
      { x: 1940, y: 900 },
      { x: 2000, y: 1000 },
    ],
  },
  {
    id: 'harbor-main-1',
    name: '滨海横街',
    kind: 'main',
    surface: 'paved',
    width: 9.0,
    anchors: [
      { x: 830, y: 620 },
      { x: 1080, y: 640 },
      { x: 1330, y: 660 },
      { x: 1560, y: 665 },
      { x: 1690, y: 640 },
    ],
  },
  {
    id: 'harbor-lane-s1',
    name: '渔行街',
    kind: 'lane',
    surface: 'paved',
    width: 6.0,
    anchors: [
      { x: 900, y: 200 },
      { x: 1100, y: 200 },
      { x: 1330, y: 210 },
      { x: 1490, y: 230 },
      { x: 1560, y: 260 },
    ],
  },
  {
    id: 'harbor-lane-n1',
    name: '港前巷',
    kind: 'lane',
    surface: 'paved',
    width: 5.2,
    anchors: [
      { x: 1080, y: 180 },
      { x: 1090, y: 400 },
      { x: 1090, y: 620 },
      { x: 1080, y: 860 },
    ],
  },
  {
    id: 'harbor-lane-n2',
    name: '渔港巷',
    kind: 'lane',
    surface: 'paved',
    width: 5.0,
    anchors: [
      { x: 1320, y: 160 },
      { x: 1330, y: 400 },
      { x: 1330, y: 640 },
      { x: 1320, y: 880 },
    ],
  },

  // ===================== 码头引道（滨海大道 → 栈桥）=====================
  {
    id: 'quay-1',
    name: '一号码头路',
    kind: 'lane',
    surface: 'paved',
    width: 6.5,
    anchors: [
      { x: 1505, y: 150 },
      { x: 1535, y: 150 },
    ],
  },
  {
    id: 'quay-2',
    name: '二号码头路',
    kind: 'lane',
    surface: 'paved',
    width: 6.5,
    anchors: [
      { x: 1486, y: 320 },
      { x: 1512, y: 320 },
    ],
  },
  {
    id: 'quay-3',
    name: '三号码头路',
    kind: 'lane',
    surface: 'paved',
    width: 7.0,
    anchors: [
      { x: 1906, y: 820 },
      { x: 1946, y: 820 },
    ],
  },
  {
    id: 'quay-4',
    name: '四号码头路',
    kind: 'lane',
    surface: 'paved',
    width: 6.5,
    anchors: [
      { x: 1970, y: 950 },
      { x: 2026, y: 950 },
    ],
  },

  // ===================== 滨海长廊（大道东侧、水线边的木栈道）=====================
  {
    id: 'promenade',
    name: '滨海长廊',
    kind: 'promenade',
    surface: 'boardwalk',
    width: 6.0,
    anchors: [
      { x: 1545, y: -40 },
      { x: 1525, y: 100 },
      { x: 1500, y: 200 },
      { x: 1495, y: 300 },
      { x: 1525, y: 400 },
      { x: 1585, y: 500 },
      { x: 1675, y: 600 },
      { x: 1785, y: 700 },
      { x: 1885, y: 800 },
      { x: 1955, y: 900 },
    ],
  },

  // ===================== 城市扩展路网（北城 / 西城 / 南城 / CBD / 新码头） =====================
  { id: 'north-1', name: '北城横街', kind: 'main', surface: 'paved', width: 10.0,
    anchors: [{ x: -1300, y: 1250 }, { x: -300, y: 1245 }, { x: 900, y: 1255 }] },
  { id: 'north-2', name: '北二街', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: -1350, y: 1450 }, { x: -200, y: 1445 }, { x: 900, y: 1455 }] },
  { id: 'north-3', name: '北环路', kind: 'main', surface: 'paved', width: 12.0,
    anchors: [{ x: -1350, y: 1700 }, { x: -200, y: 1695 }, { x: 850, y: 1705 }] },
  { id: 'south-1', name: '南城一街', kind: 'main', surface: 'paved', width: 10.0,
    anchors: [{ x: -1750, y: -100 }, { x: -200, y: -105 }, { x: 1000, y: -100 }, { x: 1750, y: -95 }] },
  { id: 'south-2', name: '南城二街', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: -1800, y: -450 }, { x: -200, y: -455 }, { x: 1000, y: -450 }, { x: 1850, y: -445 }] },
  { id: 'south-3', name: '南环路', kind: 'main', surface: 'paved', width: 12.0,
    anchors: [{ x: -1800, y: -800 }, { x: -200, y: -805 }, { x: 1000, y: -800 }, { x: 1850, y: -795 }] },
  { id: 'south-4', name: '南城三街', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: -1700, y: -1150 }, { x: -200, y: -1155 }, { x: 1000, y: -1150 }, { x: 1750, y: -1145 }] },
  { id: 'south-5', name: '南五街', kind: 'lane', surface: 'gravel', width: 8.0,
    anchors: [{ x: -1650, y: -1500 }, { x: -200, y: -1505 }, { x: 900, y: -1500 }, { x: 1600, y: -1495 }] },
  { id: 'west-ring', name: '西环路', kind: 'main', surface: 'paved', width: 12.0,
    anchors: [{ x: -1900, y: -1500 }, { x: -1860, y: -800 }, { x: -1780, y: -200 }, { x: -1650, y: 400 }, { x: -1450, y: 1000 }] },
  { id: 'west-1', name: '西城一路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: -1700, y: -1600 }, { x: -1700, y: -700 }, { x: -1700, y: 200 }, { x: -1700, y: 700 }] },
  { id: 'west-2', name: '西城二路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: -1500, y: -1650 }, { x: -1500, y: -700 }, { x: -1500, y: 200 }, { x: -1500, y: 950 }] },
  { id: 'west-3', name: '西城三路', kind: 'main', surface: 'paved', width: 10.0,
    anchors: [{ x: -1250, y: -1650 }, { x: -1250, y: -700 }, { x: -1250, y: 300 }, { x: -1250, y: 1200 }, { x: -1250, y: 1750 }] },
  { id: 'north-4', name: '北城一路', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: -950, y: 1200 }, { x: -950, y: 1450 }, { x: -950, y: 1750 }] },
  { id: 'south-grid-1', name: '城南一路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: 850, y: -1550 }, { x: 850, y: -800 }, { x: 850, y: -100 }, { x: 850, y: 80 }] },
  { id: 'south-grid-3', name: '城南三路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: 1250, y: -1550 }, { x: 1250, y: -800 }, { x: 1250, y: -100 }, { x: 1250, y: 80 }] },
  { id: 'south-grid-4', name: '城南四路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: 1450, y: -1550 }, { x: 1450, y: -800 }, { x: 1450, y: -100 }, { x: 1450, y: 80 }] },
  { id: 'south-grid-5', name: '城南五路', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: 1650, y: -1500 }, { x: 1650, y: -800 }, { x: 1650, y: -100 }, { x: 1650, y: 60 }] },
  { id: 'sea-wall', name: '海堤路', kind: 'main', surface: 'paved', width: 10.0,
    anchors: [{ x: 1850, y: -1550 }, { x: 1850, y: -800 }, { x: 1850, y: -100 }, { x: 1850, y: 100 }] },
  { id: 'cbd-a', name: '金融街', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: 1380, y: 550 }, { x: 1620, y: 550 }, { x: 1880, y: 555 }] },
  { id: 'cbd-b', name: '总部路', kind: 'lane', surface: 'paved', width: 9.0,
    anchors: [{ x: 1300, y: 1050 }, { x: 1620, y: 1055 }, { x: 1930, y: 1060 }] },
  { id: 'south-mid-a', name: '南城四街', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: -1500, y: -270 }, { x: -200, y: -275 }, { x: 1000, y: -270 }, { x: 1750, y: -265 }] },
  { id: 'south-mid-b', name: '南城五街', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: -1550, y: -630 }, { x: -200, y: -635 }, { x: 1000, y: -630 }, { x: 1850, y: -625 }] },
  { id: 'south-mid-c', name: '南城六街', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: -1600, y: -980 }, { x: -200, y: -985 }, { x: 1000, y: -980 }, { x: 1750, y: -975 }] },
  { id: 'harbor-mid-b', name: '城南二路', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: 1150, y: -1400 }, { x: 1150, y: -800 }, { x: 1150, y: -100 }, { x: 1150, y: 80 }] },
  { id: 'harbor-mid-d', name: '城南四路', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: 1550, y: -1400 }, { x: 1550, y: -800 }, { x: 1550, y: -100 }, { x: 1550, y: 60 }] },
  { id: 'north-mid', name: '北城三街', kind: 'lane', surface: 'paved', width: 8.0,
    anchors: [{ x: -1350, y: 1550 }, { x: -200, y: 1545 }, { x: 900, y: 1555 }] },
  { id: 'quay-5', name: '五号码头路', kind: 'lane', surface: 'paved', width: 7.0,
    anchors: [{ x: 1908, y: -260 }, { x: 1948, y: -260 }] },
];

// ---------------------------------------------------------------------------
// 建筑外观原型（顶点色方案：墙 / 台基 / 屋顶 / 窗 / 门）
// ---------------------------------------------------------------------------

/** 老城民居：2~3 层坡屋顶，暖陶瓦 + 低饱和暖白墙 */
const HOUSE_PALETTES = [
  { wallColor: '#ded6c7', roofColor: '#9a6a4e', plinthColor: '#9a9287' },
  { wallColor: '#e4dccd', roofColor: '#a5745a', plinthColor: '#938b80' },
  { wallColor: '#d6cdbd', roofColor: '#8f5f45', plinthColor: '#a09789' },
  { wallColor: '#e8e1d3', roofColor: '#a97a5f', plinthColor: '#8f877c' },
  { wallColor: '#d9d0bf', roofColor: '#96684b', plinthColor: '#9b9285' },
];

/** 老城沿街商铺：稍亮陶瓦、墙偏暖 */
const OLD_SHOP_PALETTES = [
  { wallColor: '#e0d2b8', roofColor: '#a3704f', plinthColor: '#9c917f' },
  { wallColor: '#d8c9ae', roofColor: '#996a4c', plinthColor: '#968b7a' },
  { wallColor: '#e5d8c0', roofColor: '#ab7855', plinthColor: '#a29683' },
];

/** 新区商住：浅灰/米白墙、灰屋顶（少量陶瓦坡顶） */
const HARBOR_SHOP_PALETTES = [
  { wallColor: '#e8e4da', roofColor: '#6e6a62', plinthColor: '#9d9a94', flat: true },
  { wallColor: '#dcd8cc', roofColor: '#76726a', plinthColor: '#96938c', flat: true },
  { wallColor: '#e5ded0', roofColor: '#6a6660', plinthColor: '#a19d95', flat: false },
  { wallColor: '#d8d4c8', roofColor: '#7c786e', plinthColor: '#918e88', flat: true },
  { wallColor: '#efeae0', roofColor: '#8c6a52', plinthColor: '#a5a19a', flat: false },
];

/** 公寓/酒店：浅灰白 + 冷灰蓝屋顶，带阳台带 */
const APARTMENT_PALETTES = [
  { wallColor: '#e9e7e0', roofColor: '#6b6f74', plinthColor: '#a3a29c', balconyColor: '#cfcdc5' },
  { wallColor: '#dcdcd6', roofColor: '#74787c', plinthColor: '#9c9b96', balconyColor: '#c6c6c0' },
  { wallColor: '#d8dee0', roofColor: '#666c72', plinthColor: '#98999a', balconyColor: '#c2c9cb' },
  { wallColor: '#efeae0', roofColor: '#707478', plinthColor: '#a8a49c', balconyColor: '#d3cfc6' },
];

/** CBD 塔楼：冷灰玻璃幕墙 + 深灰屋顶 + 冷蓝装饰带 */
const TOWER_PALETTES = [
  { wallColor: '#dfe6ea', roofColor: '#4e565e', plinthColor: '#8f979d', accentColor: '#3f8fa6' },
  { wallColor: '#e6ebee', roofColor: '#545c64', plinthColor: '#98a0a5', accentColor: '#4a8ba4' },
  { wallColor: '#d9e2e7', roofColor: '#485159', plinthColor: '#8a939a', accentColor: '#3a7f96' },
  { wallColor: '#e9edf0', roofColor: '#5a626a', plinthColor: '#a0a7ab', accentColor: '#558fa2' },
  { wallColor: '#e2e8ea', roofColor: '#515a62', plinthColor: '#959da2', accentColor: '#468aa0' },
];

/** 公共建筑 / 地标：灰白屋顶 + 更亮墙体 */
const PUBLIC_PALETTES = [
  { wallColor: '#eee9dd', roofColor: '#c2bfb5', plinthColor: '#a29c91' },
  { wallColor: '#e8e3d7', roofColor: '#b8b5ab', plinthColor: '#9d978c' },
];

const PIER_COLORS = { wallColor: '#8c7253', roofColor: '#6e5b45', plinthColor: '#7b6349' };

// ---------------------------------------------------------------------------
// 固定建筑（公共建筑 / 地标塔楼）
// ---------------------------------------------------------------------------

const FIXED_BUILDINGS = [
  // --- 老城公共建筑（沿用上一轮位置）---
  {
    id: 'public-hall',
    name: '澜屿村文化礼堂',
    kind: 'public',
    district: 'old',
    x: -630,
    y: 724,
    width: 30,
    depth: 20,
    floors: 5,
    floorHeight: 3.6,
    roofStyle: 'flat',
    rotation: 0.125,
    facing: -1,
    ...PUBLIC_PALETTES[0],
    plaza: { x: -630, y: 701, width: 40, depth: 22, rotation: 0.125 },
  },
  {
    id: 'public-station',
    name: '澜屿防汛调度站',
    kind: 'public',
    district: 'old',
    x: -207,
    y: 730,
    width: 22,
    depth: 17,
    floors: 6,
    floorHeight: 3.5,
    roofStyle: 'flat',
    rotation: 0.17,
    facing: -1,
    ...PUBLIC_PALETTES[1],
    plaza: { x: -207, y: 710, width: 30, depth: 20, rotation: 0.17 },
  },

  // --- 新区地标（沿滨海大道形成天际线）---
  {
    id: 'landmark-hotel',
    name: '澜屿港大酒店',
    kind: 'landmark',
    district: 'harbor',
    x: 1710,
    y: 680,
    width: 42,
    depth: 29,
    floors: 18,
    podiumFloors: 2,
    floorHeight: 3.4,
    roofStyle: 'tower',
    rotation: 0.74,
    facing: -1,
    wallColor: '#eceae4',
    roofColor: '#5f646a',
    plinthColor: '#a4a29b',
    accentColor: '#4a6a78',
    antenna: false,
  },
  {
    id: 'landmark-port',
    name: '澜屿港务大厦',
    kind: 'landmark',
    district: 'harbor',
    x: 1860,
    y: 845,
    width: 38,
    depth: 32,
    floors: 22,
    podiumFloors: 2,
    floorHeight: 3.5,
    roofStyle: 'tower',
    rotation: 0.72,
    facing: -1,
    wallColor: '#e2e0d8',
    roofColor: '#5a5f66',
    plinthColor: '#9b988f',
    accentColor: '#55707c',
    antenna: true,
  },
  {
    id: 'landmark-service',
    name: '澜屿港客服务中心',
    kind: 'landmark',
    district: 'harbor',
    x: 1420,
    y: 255,
    width: 34,
    depth: 26,
    floors: 17,
    podiumFloors: 1,
    floorHeight: 3.4,
    roofStyle: 'tower',
    rotation: -1.67,
    facing: 1,
    wallColor: '#e9e6de',
    roofColor: '#646a70',
    plinthColor: '#a09d95',
    accentColor: '#5c7884',
    antenna: false,
  },

  // --- 滨海 CBD 地标（150~190m，从海面看的天际线）---
  {
    id: 'cbd-tower-a', name: '澜屿金融中心', kind: 'landmark', district: 'cbd',
    x: 1470, y: 300, width: 40, depth: 32, floors: 50, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: 0.5, facing: -1,
    wallColor: '#e6e9ec', roofColor: '#4d545c', plinthColor: '#9aa0a6',
    accentColor: '#3f8fa6', antenna: true,
  },
  {
    id: 'cbd-tower-b', name: '澜屿中心大厦', kind: 'landmark', district: 'cbd',
    x: 1660, y: 700, width: 42, depth: 34, floors: 46, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: 0.7, facing: -1,
    wallColor: '#e2e6e9', roofColor: '#505860', plinthColor: '#969c9f',
    accentColor: '#4a86a0', antenna: true,
  },
  {
    id: 'cbd-tower-c', name: '港城国际中心', kind: 'landmark', district: 'cbd',
    x: 1720, y: 1000, width: 38, depth: 30, floors: 42, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: -0.6, facing: -1,
    wallColor: '#e8ebee', roofColor: '#545b62', plinthColor: '#9fa4a8',
    accentColor: '#3f89a2', antenna: true,
  },
  {
    id: 'cbd-tower-d', name: '澜屿滨水大厦', kind: 'landmark', district: 'cbd',
    x: 1500, y: 950, width: 36, depth: 30, floors: 40, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: 0.3, facing: -1,
    wallColor: '#e5e9ec', roofColor: '#596068', plinthColor: '#a0a5a9',
    accentColor: '#52879b', antenna: false,
  },

  {
    id: 'cbd-tower-e', name: '澜屿国际金融中心二期', kind: 'landmark', district: 'cbd',
    x: 1330, y: 620, width: 40, depth: 32, floors: 46, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: 0.4, facing: -1,
    wallColor: '#e4e8eb', roofColor: '#4b535b', plinthColor: '#99a0a5',
    accentColor: '#3d8ba3', antenna: true,
  },
  {
    id: 'cbd-tower-f', name: '澜屿海景中心', kind: 'landmark', district: 'cbd',
    x: 1300, y: 980, width: 36, depth: 30, floors: 42, podiumFloors: 2, floorHeight: 3.6,
    roofStyle: 'tower', rotation: -0.3, facing: -1,
    wallColor: '#e7ebee', roofColor: '#525a62', plinthColor: '#9ea5a9',
    accentColor: '#4d8ba0', antenna: true,
  },

  // --- 滨水公共建筑（会展 / 客运 / 文化 / 海关）---
  {
    id: 'public-convention', name: '澜屿国际会展中心', kind: 'public', district: 'waterfront',
    x: 1250, y: -720, width: 70, depth: 46, floors: 6, floorHeight: 5.2,
    roofStyle: 'flat', rotation: 0.08, facing: 1,
    wallColor: '#eceef0', roofColor: '#b9c2c8', plinthColor: '#a4a8aa',
    roofEquipment: true, plaza: { x: 1250, y: -680, width: 86, depth: 30, rotation: 0.08 },
  },
  {
    id: 'public-ferry', name: '澜屿港客运中心', kind: 'public', district: 'waterfront',
    x: 1400, y: -950, width: 52, depth: 34, floors: 6, floorHeight: 4.6,
    roofStyle: 'flat', rotation: -0.1, facing: 1,
    wallColor: '#e8e6de', roofColor: '#a9a49a', plinthColor: '#9c968c',
    roofEquipment: true,
  },
  {
    id: 'public-culture', name: '澜屿滨海文化中心', kind: 'public', district: 'waterfront',
    x: 900, y: -1100, width: 58, depth: 40, floors: 4, floorHeight: 5.4,
    roofStyle: 'flat', rotation: 0.2, facing: 1,
    wallColor: '#e6e2d8', roofColor: '#b7b2a6', plinthColor: '#a29c92',
    roofEquipment: false,
  },
  {
    id: 'public-customs', name: '澜屿海关大厦', kind: 'public', district: 'waterfront',
    x: 1700, y: -420, width: 38, depth: 30, floors: 18, floorHeight: 3.5,
    roofStyle: 'flat', rotation: -0.25, facing: -1,
    wallColor: '#e3e6e8', roofColor: '#8b9298', plinthColor: '#9da1a4',
    roofEquipment: true,
  },
];

// ---------------------------------------------------------------------------
// 栈桥 / 码头
// ---------------------------------------------------------------------------

const PIER_DEFS = [
  // 河口渡口（老城北，上一轮保留）
  {
    id: 'pier-river',
    name: '澜屿渡口栈桥',
    kind: 'pier',
    district: 'old',
    x: -646,
    y: 1855,
    width: 9,
    depth: 28,
    rotation: 0.06,
    deckTop: 9.92,
    facing: -1,
    ...PIER_COLORS,
  },
  // 滨海码头 1~4（从滨海大道东侧伸入浅海；rotation=-90° → 长轴朝东）
  {
    id: 'pier-1',
    name: '澜屿港一号码头',
    kind: 'pier',
    district: 'harbor',
    x: 1615,
    y: 150,
    width: 11,
    depth: 180,
    rotation: -Math.PI / 2,
    deckTop: 3.0,
    facing: 1,
    ...PIER_COLORS,
  },
  {
    id: 'pier-2',
    name: '澜屿港二号码头',
    kind: 'pier',
    district: 'harbor',
    x: 1590,
    y: 320,
    width: 11,
    depth: 180,
    rotation: -Math.PI / 2,
    deckTop: 3.05,
    facing: 1,
    ...PIER_COLORS,
  },
  {
    id: 'pier-3',
    name: '澜屿港三号码头',
    kind: 'pier',
    district: 'harbor',
    x: 2025,
    y: 820,
    width: 11,
    depth: 180,
    rotation: -Math.PI / 2,
    deckTop: 3.05,
    facing: 1,
    ...PIER_COLORS,
  },
  {
    id: 'pier-4',
    name: '澜屿港四号码头',
    kind: 'pier',
    district: 'harbor',
    x: 2095,
    y: 950,
    width: 11,
    depth: 160,
    rotation: -Math.PI / 2,
    deckTop: 3.1,
    facing: 1,
    ...PIER_COLORS,
  },
  {
    id: 'pier-5',
    name: '澜屿港五号码头',
    kind: 'pier',
    district: 'waterfront',
    x: 2000,
    y: -260,
    width: 11,
    depth: 170,
    rotation: -Math.PI / 2,
    deckTop: 3.0,
    facing: 1,
    ...PIER_COLORS,
  },
];

// ---------------------------------------------------------------------------
// 街区布置规格
// ---------------------------------------------------------------------------

/**
 * 沿街成排的建筑规格：
 *   quotaPerSide 每侧最多放几栋（控制总量）
 *   mix          建筑原型权重（house/shop/apartment）
 *   skipProb     整段空地概率；blockMin~blockMax 一串几栋；gap 栋间距；blockGap 组间距
 *   start        从道路弧长 s 起点开始布置（连接路只布置新区段时用）
 */
const OLD_ROW_SPECS = [
  {
    roadId: 'old-main-a',
    sides: [1, -1],
    start: 30,
    endPad: 30,
    quotaPerSide: 31,
    mix: { house: 12, shop: 8 },
    skipProb: 0.18,
    skipMin: 20,
    skipMax: 70,
    blockMin: 3,
    blockMax: 6,
    gapMin: 0.5,
    gapMax: 1.5,
    blockGapMin: 4,
    blockGapMax: 12,
    backRowProb: 0.5,
  },
  {
    roadId: 'old-main-c',
    sides: [1, -1],
    start: 40,
    endPad: 40,
    quotaPerSide: 18,
    mix: { house: 7, shop: 3 },
    skipProb: 0.2,
    skipMin: 20,
    skipMax: 70,
    blockMin: 3,
    blockMax: 6,
    gapMin: 0.5,
    gapMax: 1.6,
    blockGapMin: 4,
    blockGapMax: 12,
    backRowProb: 0.45,
  },
  {
    roadId: 'old-lane-d',
    sides: [1, -1],
    start: 30,
    endPad: 40,
    quotaPerSide: 14,
    mix: { house: 9, shop: 1 },
    skipProb: 0.24,
    skipMin: 18,
    skipMax: 60,
    blockMin: 3,
    blockMax: 5,
    gapMin: 0.5,
    gapMax: 1.6,
    blockGapMin: 4,
    blockGapMax: 12,
    backRowProb: 0.36,
  },
  {
    roadId: 'old-main-b',
    sides: [1, -1],
    start: 60,
    endPad: 180,
    quotaPerSide: 8,
    mix: { house: 8.5, shop: 1.5 },
    skipProb: 0.42,
    skipMin: 40,
    skipMax: 140,
    blockMin: 1,
    blockMax: 3,
    gapMin: 1.0,
    gapMax: 3.2,
    blockGapMin: 10,
    blockGapMax: 30,
    backRowProb: 0.2,
  },
  {
    roadId: 'old-lane-j',
    sides: [1, -1],
    start: 20,
    endPad: 30,
    quotaPerSide: 5,
    mix: { house: 8.5, shop: 1.5 },
    skipProb: 0.42,
    skipMin: 25,
    skipMax: 80,
    blockMin: 1,
    blockMax: 3,
    gapMin: 1.0,
    gapMax: 3.0,
    blockGapMin: 8,
    blockGapMax: 20,
    backRowProb: 0.2,
  },
  {
    roadId: 'old-lane-e',
    sides: [1, -1],
    start: 20,
    endPad: 20,
    quotaPerSide: 3,
    mix: { house: 10 },
    skipProb: 0.45,
    skipMin: 20,
    skipMax: 60,
    blockMin: 1,
    blockMax: 2,
    gapMin: 1.0,
    gapMax: 3.0,
    blockGapMin: 6,
    blockGapMax: 16,
    backRowProb: 0.1,
  },
  {
    roadId: 'old-lane-f',
    sides: [1, -1],
    start: 20,
    endPad: 20,
    quotaPerSide: 4,
    mix: { house: 10 },
    skipProb: 0.45,
    skipMin: 20,
    skipMax: 60,
    blockMin: 1,
    blockMax: 2,
    gapMin: 1.0,
    gapMax: 3.0,
    blockGapMin: 6,
    blockGapMax: 16,
    backRowProb: 0.1,
  },
  {
    roadId: 'old-lane-g',
    sides: [1, -1],
    start: 20,
    endPad: 20,
    quotaPerSide: 3,
    mix: { house: 10 },
    skipProb: 0.45,
    skipMin: 20,
    skipMax: 50,
    blockMin: 1,
    blockMax: 2,
    gapMin: 1.0,
    gapMax: 2.6,
    blockGapMin: 6,
    blockGapMax: 14,
    backRowProb: 0.08,
  },
  {
    roadId: 'old-lane-h',
    sides: [1, -1],
    start: 20,
    endPad: 25,
    quotaPerSide: 5,
    mix: { house: 10 },
    skipProb: 0.45,
    skipMin: 25,
    skipMax: 70,
    blockMin: 1,
    blockMax: 3,
    gapMin: 1.0,
    gapMax: 3.0,
    blockGapMin: 8,
    blockGapMax: 18,
    backRowProb: 0.15,
  },
];

const HARBOR_ROW_SPECS = [
  {
    // 滨海大道西侧：酒店/公寓 + 商住，朝向海
    roadId: 'harbor-blvd',
    sides: [1],
    start: 60,
    endPad: 120,
    quotaPerSide: 32,
    mix: { apartment: 4.2, shop: 4.2, house: 1.6 },
    skipProb: 0.22,
    skipMin: 18,
    skipMax: 55,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.8,
    gapMax: 2.2,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.18,
  },
  {
    // 临港大道（南线连接路）新区段两侧：商住街
    roadId: 'conn-south',
    sides: [1, -1],
    start: 500,
    endPad: 30,
    quotaPerSide: 10,
    mix: { apartment: 1.6, shop: 5.4, house: 3.0 },
    skipProb: 0.34,
    skipMin: 18,
    skipMax: 55,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.8,
    gapMax: 2.4,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.2,
  },
  {
    // 港城大道（北线）新区段两侧
    roadId: 'conn-north',
    sides: [1, -1],
    start: 620,
    endPad: 20,
    quotaPerSide: 9,
    mix: { apartment: 2.0, shop: 4.6, house: 3.4 },
    skipProb: 0.32,
    skipMin: 18,
    skipMax: 55,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.8,
    gapMax: 2.4,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.2,
  },
  {
    // 滨海横街：商住次街
    roadId: 'harbor-main-1',
    sides: [1, -1],
    start: 30,
    endPad: 30,
    quotaPerSide: 10,
    mix: { apartment: 1.2, shop: 5.0, house: 3.0 },
    skipProb: 0.3,
    skipMin: 16,
    skipMax: 50,
    blockMin: 2,
    blockMax: 5,
    gapMin: 0.8,
    gapMax: 2.2,
    blockGapMin: 6,
    blockGapMax: 16,
    backRowProb: 0.22,
  },
  {
    // 渔行街（南侧小街）
    roadId: 'harbor-lane-s1',
    sides: [1, -1],
    start: 40,
    endPad: 40,
    quotaPerSide: 6,
    mix: { apartment: 0.6, shop: 3.6, house: 5.8 },
    skipProb: 0.36,
    skipMin: 18,
    skipMax: 60,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.9,
    gapMax: 2.6,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.18,
  },
  {
    // 港前巷：南北向生活街
    roadId: 'harbor-lane-n1',
    sides: [1, -1],
    start: 40,
    endPad: 40,
    quotaPerSide: 6,
    mix: { apartment: 1.0, shop: 3.2, house: 5.0 },
    skipProb: 0.36,
    skipMin: 18,
    skipMax: 60,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.9,
    gapMax: 2.6,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.2,
  },
  {
    // 渔港巷：南北向生活街
    roadId: 'harbor-lane-n2',
    sides: [1, -1],
    start: 40,
    endPad: 40,
    quotaPerSide: 5,
    mix: { apartment: 1.0, shop: 2.8, house: 5.2 },
    skipProb: 0.38,
    skipMin: 18,
    skipMax: 60,
    blockMin: 2,
    blockMax: 4,
    gapMin: 0.9,
    gapMax: 2.6,
    blockGapMin: 7,
    blockGapMax: 18,
    backRowProb: 0.2,
  },
];

// ---------------------------------------------------------------------------
// 城市扩展路网的沿街排布（数据驱动：每条路一段 spec，按片区配额控量）
// ---------------------------------------------------------------------------

const CITY_ROW_SPECS = [];
function cityRow(spec) {
  CITY_ROW_SPECS.push({
    start: 24,
    endPad: 30,
    sides: [1, -1],
    quotaPerSide: 12,
    skipProb: 0.08,
    skipMin: 12,
    skipMax: 40,
    blockMin: 4,
    blockMax: 8,
    gapMin: 0.4,
    gapMax: 1.2,
    blockGapMin: 2,
    blockGapMax: 8,
    backRowProb: 0.55,
    mix: { house: 4, shop: 1.4 },
    ...spec,
  });
}

// --- 南城东西向（先铺满整幅，west 只占西段、harbor 占东段）---
for (const roadId of ['south-1', 'south-2', 'south-3', 'south-4', 'south-5', 'south-mid-a', 'south-mid-b', 'south-mid-c']) {
  cityRow({ roadId, district: 'west', quotaPerSide: 22, skipProb: 0.1, backRowProb: 0.5 });
  cityRow({ roadId, district: 'harbor', quotaPerSide: 22, skipProb: 0.1, backRowProb: 0.5,
    mix: { house: 3, shop: 4.5, apartment: 1.6 } });
}
// --- 西城纵街 / 南城纵街 ---
for (const roadId of ['west-ring', 'west-1', 'west-2', 'west-3']) {
  cityRow({ roadId, district: 'west', quotaPerSide: 24, skipProb: 0.1, backRowProb: 0.55 });
}
for (const roadId of ['south-grid-1', 'south-grid-3', 'south-grid-4', 'south-grid-5', 'sea-wall', 'harbor-mid-b', 'harbor-mid-d']) {
  cityRow({ roadId, district: 'harbor', quotaPerSide: 22, skipProb: 0.1, backRowProb: 0.5,
    mix: { house: 3, shop: 4.5, apartment: 1.8 } });
}
// --- 北城 ---
for (const roadId of ['north-1', 'north-2', 'north-3', 'north-4', 'north-mid']) {
  cityRow({ roadId, district: 'north', quotaPerSide: 24, skipProb: 0.1, backRowProb: 0.5 });
}
cityRow({ roadId: 'west-3', district: 'north', quotaPerSide: 13, skipProb: 0.12, backRowProb: 0.4 });
// --- CBD：金融街 / 总部路 + 滨海大道东侧临水界面，只排塔楼 ---
for (const roadId of ['cbd-a', 'cbd-b']) {
  cityRow({
    roadId, district: 'cbd', quotaPerSide: 10, skipProb: 0.24,
    skipMin: 24, skipMax: 70, blockMin: 1, blockMax: 2,
    gapMin: 4, gapMax: 9, blockGapMin: 12, blockGapMax: 34,
    backRowProb: 0, mix: { tower: 1 },
  });
}
cityRow({
  roadId: 'harbor-blvd', district: 'cbd', sides: [-1], quotaPerSide: 14, skipProb: 0.26,
  skipMin: 26, skipMax: 80, blockMin: 1, blockMax: 2,
  gapMin: 5, gapMax: 11, blockGapMin: 14, blockGapMax: 38,
  backRowProb: 0, mix: { tower: 1 },
});

/** 各街区建筑总量配额（含固定建筑），用于整体控量 */
const DISTRICT_QUOTAS = {
  // 目标总量 ~830（780~880）：老城 196 + 西城 220 + 北城 145 + 新区 223 + CBD 40 + 滨水公共 6
  old: { house: 186, shop: 44, public: 2 },
  west: { house: 215, shop: 105 },
  north: { house: 140, shop: 60 },
  harbor: { house: 80, shop: 110, apartment: 66, landmark: 3 },
  cbd: { tower: 40, landmark: 6 },
  waterfront: { public: 4 },
};

/** 街区块填充（在路网间隙补零星建筑，形成组团而不是均匀网格） */
const CLUSTER_SPECS = {
  old: { target: 34, center: { x: -450, y: 700 }, radius: 1000, nearRoad: 190, nearBuilding: 130 },
  west: { target: 95, center: { x: -1150, y: -350 }, radius: 1450, nearRoad: 280, nearBuilding: 180 },
  north: { target: 65, center: { x: -300, y: 1400 }, radius: 1000, nearRoad: 260, nearBuilding: 170 },
  harbor: { target: 55, center: { x: 1450, y: -700 }, radius: 1050, nearRoad: 270, nearBuilding: 180 },
  cbd: { target: 26, center: { x: 1600, y: 650 }, radius: 680, nearRoad: 340, nearBuilding: 240 },
};

const QUOTA_MIX = {
  old: { house: 4, shop: 1 },
  west: { house: 4, shop: 1.6 },
  north: { house: 4, shop: 1.4 },
  harbor: { apartment: 1, shop: 3, house: 5 },
  cbd: { tower: 1 },
};

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 生成澜屿港城镇布局（确定性）。
 *
 * @param {object} [options]
 * @param {number} [options.seed=LAYOUT_SEED] 随机种子
 * @returns {{
 *   version: number, seed: number, generatedBy: string,
 *   center: {x:number,y:number,lon:number,lat:number},
 *   town: object, districts: object[],
 *   roads: object[], buildings: object[], plazas: object[], stats: object,
 * }}
 */
export function generateVillageLayout(options = {}) {
  const seed = Number.isFinite(options.seed) ? options.seed : LAYOUT_SEED;
  const rng = mulberry32(seed);

  const center = { ...VILLAGE_CENTER };
  const buildings = [];
  const reserved = [];
  const counts = {};
  for (const d of TOWN.districts) {
    counts[d.id] = { house: 0, shop: 0, public: 0, apartment: 0, tower: 0, landmark: 0, pier: 0 };
  }

  // --- 道路 ---
  const roads = ROAD_DEFS.map((def) => {
    const curve = buildRoadCurve(def.anchors);
    return {
      id: def.id,
      name: def.name,
      kind: def.kind,
      surface: def.surface,
      width: def.width,
      anchors: def.anchors.map((p) => ({ ...p })),
      points: curve.points.map((p) => ({ x: round2(p.x), y: round2(p.y) })),
      length: round2(curve.length),
      _curve: curve,
    };
  });
  const roadById = new Map(roads.map((r) => [r.id, r]));

  // --- 广场（公共建筑前的开敞空间，成排建筑避让）---
  const plazas = [];
  for (const def of FIXED_BUILDINGS) {
    if (!def.plaza) continue;
    plazas.push({
      name: `${def.name}前广场`,
      x: def.plaza.x,
      y: def.plaza.y,
      width: def.plaza.width,
      depth: def.plaza.depth,
      rotation: def.plaza.rotation,
    });
  }

  const ctx = { rng, buildings, reserved, roads, roadById, plazas, counts };

  // --- 固定建筑（公共建筑 / 地标）---
  for (const def of FIXED_BUILDINGS) {
    const b = makeFixedBuilding(def);
    const placed = tryPlaceBuilding(b, ctx, { isFixed: true });
    if (!placed) {
      throw new Error(`固定建筑未能落位：${def.name}（地形/冲突问题）`);
    }
    buildings.push(placed);
    reserved.push(placed);
    counts[def.district][def.kind] += 1;
  }

  // --- 栈桥 / 码头（可越过避海/地面规则）---
  for (const def of PIER_DEFS) {
    const b = {
      ...def,
      type: 'pier',
      floors: 1,
      floorHeight: 0,
      roofStyle: 'deck',
      pierSpec: { deckTop: def.deckTop, overWater: def.id !== 'pier-river' },
    };
    const placed = tryPlaceBuilding(b, ctx, { isPier: true });
    if (!placed) throw new Error(`栈桥未能落位：${def.name}`);
    buildings.push(placed);
    reserved.push(placed);
    counts[def.district].pier += 1;
  }

  // --- 沿街成排布置（老城/新区原有排布 + 城市扩展路网）---
  for (const spec of OLD_ROW_SPECS) placeRow(ctx, 'old', spec);
  for (const spec of HARBOR_ROW_SPECS) placeRow(ctx, 'harbor', spec);
  for (const spec of CITY_ROW_SPECS) placeRow(ctx, spec.district, spec);

  // --- 零散组团填充 ---
  for (const d of ['old', 'west', 'north', 'harbor', 'cbd']) placeClusterFill(ctx, d);

  // --- 编号 / 命名 / 派生 ---
  finalizeBuildings(buildings);

  // --- 统计 ---
  const stats = summarize(buildings, roads, counts);
  return {
    version: LAYOUT_VERSION,
    seed,
    generatedBy: 'src/geo/villageLayout.js',
    center,
    town: TOWN,
    districts: TOWN.districts,
    roads,
    buildings,
    plazas,
    stats,
  };
}

// ---------------------------------------------------------------------------
// 固定建筑 → 建筑对象
// ---------------------------------------------------------------------------

function makeFixedBuilding(def) {
  const b = { ...def };
  b.type =
    def.kind === 'landmark' || def.kind === 'public'
      ? 'public'
      : def.kind === 'apartment' || def.kind === 'tower'
        ? 'shop'
        : def.kind;
  if (def.kind === 'landmark') {
    b.podiumFloors = def.podiumFloors ?? 2;
    b.antenna = !!def.antenna;
    b.accentColor = def.accentColor || '#55707c';
  }
  return b;
}

// ---------------------------------------------------------------------------
// 落位 / 校验
// ---------------------------------------------------------------------------

const DEBUG_LAYOUT =
  typeof process !== 'undefined' && process.env && process.env.VILLAGE_LAYOUT_DEBUG === '1';

/**
 * 尝试把一栋建筑放到地图上；成功返回补齐高程/尺寸信息的建筑对象，失败返回 null。
 */
function tryPlaceBuilding(raw, ctx, opts = {}) {
  const { buildings, roads } = ctx;
  const isPier = !!opts.isPier;
  const isFixed = !!opts.isFixed;
  const b = { ...raw };
  const district = DISTRICT_LIMITS[b.district] ? b.district : 'old';
  const cfg = DISTRICT_LIMITS[district];
  const isHarbor = cfg.flavor === 'harbor' || cfg.flavor === 'cbd';
  const fail = (reason) => {
    if (DEBUG_LAYOUT) {
      console.warn(
        `[villageLayout] 落位失败(${reason}) kind=${b.kind} district=${district} x=${b.x?.toFixed(1)} y=${b.y?.toFixed(1)}`,
      );
    }
    return null;
  };

  // 1) 街区范围
  const radius = Math.hypot(b.x - cfg.center.x, b.y - cfg.center.y);
  if (!isPier && radius > cfg.radius) {
    return fail('district-radius');
  }

  // 2) 高程采样（四角 + 边中点 + 中心，共 9 点）
  const corners = footprintCorners(b, 0);
  const samples = [
    ...corners,
    toWorld(b, 0, 0),
    toWorld(b, -b.width / 2, 0),
    toWorld(b, b.width / 2, 0),
    toWorld(b, 0, -b.depth / 2),
    toWorld(b, 0, b.depth / 2),
  ];
  const groundCenter = heightAtLocal(b.x, b.y);
  let minG = groundCenter;
  let maxG = groundCenter;
  for (const c of samples) {
    const h = heightAtLocal(c.x, c.y);
    if (h < minG) minG = h;
    if (h > maxG) maxG = h;
  }

  if (!isPier) {
    const minGround = cfg.minGround;
    const maxGround = cfg.maxGround;
    // 海面：海岸线（coastX）以西留出内缩距离
    if (b.x > coastX(b.y) - MIN_COAST_DIST) return fail('sea');
    // 地面高程：太低会进河滩/潮间带（初始水位），太高已是山脚
    if (minG < minGround) return fail(`low-ground(${minG.toFixed(2)})`);
    if (groundCenter > maxGround) return fail(`high-ground(${groundCenter.toFixed(2)})`);
    // 陡坡
    const shortSide = Math.min(b.width, b.depth);
    const slope = (maxG - minG) / Math.max(1, shortSide);
    if (slope > MAX_SLOPE) return fail('steep');
  }

  // 3) 河道避让（栈桥除外）
  if (!isPier) {
    const dRiver = distToPolyline(b.x, b.y, RIVER_PATH);
    if (dRiver < MIN_RIVER_DIST) return fail('river');
  }

  // 4) 与其它道路的距离（自身街道跳过；栈桥是道路终点，跳过；固定建筑允许贴近道路）
  const halfDiag = 0.5 * Math.hypot(b.width, b.depth);
  for (const road of isPier ? [] : roads) {
    if (road.id === b._hostRoadId) continue;
    const d = distToPolyline(b.x, b.y, road.points);
    if (d < road.width / 2 + halfDiag + 0.4 && !isFixed) {
      return fail(`road:${road.id}`);
    }
  }

  // 5) 广场留空
  if (ctx.plazas) {
    for (const p of ctx.plazas) {
      if (obbOverlap(b, p, 0.5)) return fail(`plaza:${p.name}`);
    }
  }

  // 6) 与其它建筑碰撞
  for (const other of buildings) {
    if (obbOverlap(b, other, BUILDING_GAP)) return fail(`building:${other.id || other.name}`);
  }

  // 7) 补齐高程与派生字段
  b.groundHeight = round2(groundCenter);
  b.minGround = round2(minG);
  b.maxGround = round2(maxG);
  if (isPier) {
    // 栈桥：minGround 按「桥面被水漫过」判定（桥下地面不参与淹没阈值），
    // 但几何仍需要桥下地面的最低点来生成桩基
    b.pierGroundMin = round2(minG);
    b.minGround = round2((b.deckTop ?? groundCenter) - 0.35);
  }
  b.footprintArea = round1(b.width * b.depth);
  b.localX = round2(b.x - VILLAGE_CENTER.x);
  b.localY = round2(b.y - VILLAGE_CENTER.y);
  const ll = localToLonLat(b.x, b.y);
  b.lon = Number(ll.lon.toFixed(7));
  b.lat = Number(ll.lat.toFixed(7));
  return b;
}

// ---------------------------------------------------------------------------
// 沿街成排布置
// ---------------------------------------------------------------------------

function placeRow(ctx, districtId, spec) {
  const { rng, counts } = ctx;
  const road = ctx.roadById.get(spec.roadId);
  if (!road) return;
  const curve = road._curve;
  const len = curve.length;
  const quota = DISTRICT_QUOTAS[districtId];

  for (const side of spec.sides) {
    const sideSign = side >= 0 ? 1 : -1;
    const halfRoad = road.width / 2;
    let s = spec.start ?? 20;
    const end = Math.max(s + 1, len - (spec.endPad ?? 20));
    let count = 0;
    let guard = 0;

    while (s < end && count < spec.quotaPerSide && guard++ < 400) {
      // 空地 / 院落
      if (chance(rng, spec.skipProb)) {
        s += range(rng, spec.skipMin, spec.skipMax);
        continue;
      }
      const blockCount = Math.round(range(rng, spec.blockMin, spec.blockMax + 0.49));
      for (let k = 0; k < blockCount && s < end && count < spec.quotaPerSide; k++) {
        const kind = pickRowKind(rng, spec.mix, districtId, counts, quota);
        if (!kind) break;
        const placed = placeOneFront(ctx, districtId, road, curve, sideSign, halfRoad, s, spec, kind);
        if (!placed) {
          s += 2.0;
          continue;
        }
        counts[districtId][kind] += 1;
        count++;
        s += placed.width + range(rng, spec.gapMin, spec.gapMax);

        // 后排（第二进 / 院落）
        if (chance(rng, spec.backRowProb)) {
          const backKind = districtId === 'old' ? 'house' : chance(rng, 0.45) ? 'shop' : 'house';
          const backQuota = quota[backKind] ?? 0;
          if ((counts[districtId][backKind] || 0) < backQuota) {
            const back = placeBackBuilding(ctx, districtId, road, curve, sideSign, halfRoad, placed, backKind);
            if (back) counts[districtId][backKind] += 1;
          }
        }
      }
      s += range(rng, spec.blockGapMin, spec.blockGapMax);
    }
  }
}

/** 按权重选建筑原型，并受街区配额约束（接近配额的类别降权） */
function pickRowKind(rng, mix, districtId, counts, quota) {
  const c = counts[districtId];
  const allowed = {};
  let any = false;
  for (const k in mix) {
    const cap = quota[k] ?? 0;
    const used = c[k] || 0;
    if (cap > used) {
      allowed[k] = mix[k] * (used / Math.max(1, cap) > 0.85 ? 0.15 : 1);
      any = true;
    }
  }
  if (any) return weightedPick(rng, allowed);
  // 配额全满：退化为还有空余的类别
  for (const k in quota) {
    if ((c[k] || 0) < quota[k] && mix[k] !== undefined) return k;
  }
  return null;
}

function placeOneFront(ctx, districtId, road, curve, sideSign, halfRoad, s, spec, kind) {
  const { rng } = ctx;
  const at = curve.at(s);
  const flavor = (DISTRICT_LIMITS[districtId] || DISTRICT_LIMITS.old).flavor;

  const arch = makeArchetype(rng, kind, flavor);
  if (!arch) return null;

  const offset = halfRoad + arch.setback + arch.depth / 2;
  const cx = at.x + at.nx * offset * sideSign;
  const cy = at.y + at.ny * offset * sideSign;
  const rotation = at.angle + range(rng, -0.06, 0.06);

  const b = {
    district: districtId,
    kind,
    type: arch.type,
    x: cx,
    y: cy,
    width: arch.width,
    depth: arch.depth,
    floors: arch.floors,
    floorHeight: arch.floorHeight,
    rotation,
    facing: -sideSign,
    roofStyle: arch.roofStyle,
    wallColor: arch.wallColor,
    roofColor: arch.roofColor,
    plinthColor: arch.plinthColor,
    balconyColor: arch.balconyColor,
    balconies: arch.balconies,
    roofEquipment: arch.roofEquipment,
    accentColor: arch.accentColor,
    _hostRoadId: road.id,
    _frontS: s + arch.width / 2,
  };
  const placed = tryPlaceBuilding(b, ctx);
  if (!placed) return null;
  placed.road = road.name;
  ctx.buildings.push(placed);
  return placed;
}

/** 生成建筑原型的尺寸/层数/外观（按 kind + 街区） */
function makeArchetype(rng, kind, flavor) {
  const isHarbor = flavor === 'harbor';
  if (kind === 'tower') {
    // CBD 高层：总层数 20~40F、70~150m（podium 2 层裙楼 + 塔身 18~38 层）
    const podiumFloors = pick(rng, [2, 2, 2, 3]);
    const towerFloors = pick(rng, [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]);
    const pal = pick(rng, TOWER_PALETTES);
    return {
      type: 'shop', // 商业/办公归入 schema 的 shop（kind=tower 区分）
      width: range(rng, 30, 45),
      depth: range(rng, 26, 38),
      floors: towerFloors,
      podiumFloors,
      floorHeight: range(rng, 3.5, 3.65),
      setback: range(rng, 3.5, 7.0),
      roofStyle: 'tower',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      accentColor: pal.accentColor,
      antenna: chance(rng, 0.45),
      balconies: false,
      roofEquipment: false,
    };
  }
  if (kind === 'house') {
    // 体量放大：民居 14~20m 面宽、3~4 层（10~14m，坡屋顶）
    const floors = isHarbor ? pick(rng, [3, 3, 4]) : pick(rng, [3, 3, 3, 4, 4]);
    const pal = pick(rng, HOUSE_PALETTES);
    return {
      type: 'house',
      width: range(rng, 13.5, 19.5),
      depth: range(rng, 11.5, 16.5),
      floors,
      floorHeight: range(rng, 2.7, 2.85),
      setback: range(rng, 2.0, 4.6),
      roofStyle: 'gable',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      balconies: false,
      roofEquipment: false,
    };
  }
  if (kind === 'shop') {
    const pal = isHarbor ? pick(rng, HARBOR_SHOP_PALETTES) : pick(rng, OLD_SHOP_PALETTES);
    const floors = isHarbor ? pick(rng, [4, 5, 5, 6, 6, 7]) : pick(rng, [4, 4, 5, 5, 6]);
    const flat = isHarbor ? pal.flat !== false : chance(rng, 0.18);
    return {
      type: 'shop',
      width: range(rng, isHarbor ? 14 : 13, isHarbor ? 22 : 20),
      depth: range(rng, isHarbor ? 13 : 12, isHarbor ? 20 : 18),
      floors,
      floorHeight: range(rng, 3.3, 3.7),
      setback: range(rng, isHarbor ? 1.6 : 1.4, isHarbor ? 3.0 : 2.6),
      roofStyle: flat ? 'flat' : 'gable',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      balconies: isHarbor && chance(rng, 0.4),
      roofEquipment: flat,
    };
  }
  if (kind === 'apartment') {
    const pal = pick(rng, APARTMENT_PALETTES);
    // 公寓/酒店 10~18 层（30~60m）
    const floors = pick(rng, [10, 12, 12, 13, 14, 15, 16, 18]);
    return {
      type: 'shop', // schema 只有 house/shop/public/pier：公寓/酒店归入商住（kind 字段区分）
      width: range(rng, 22, 38),
      depth: range(rng, 19, 30),
      floors,
      floorHeight: range(rng, 3.0, 3.25),
      setback: range(rng, 2.2, 4.5),
      roofStyle: 'flat',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      balconyColor: pal.balconyColor,
      balconies: true,
      roofEquipment: true,
    };
  }
  return null;
}

/** 前排后面的第二进（院落式，错开角度） */
function placeBackBuilding(ctx, districtId, road, curve, sideSign, halfRoad, front, kind) {
  const { rng } = ctx;
  if (kind === 'tower' || kind === 'landmark' || kind === 'public' || kind === 'pier') return null;
  const at = curve.at(front._frontS);
  const flavor = (DISTRICT_LIMITS[districtId] || DISTRICT_LIMITS.old).flavor;
  const isHarbor = flavor === 'harbor';
  // 第二进比前排略小，但仍保持放大后的体量（民居 12~18m、商铺 13~20m）
  const rawWidth = front.width * range(rng, 0.72, 0.95);
  const width = kind === 'shop' ? Math.min(20, Math.max(13, rawWidth)) : Math.min(18, Math.max(12, rawWidth));
  const depth = isHarbor ? range(rng, 12, 18) : range(rng, 11, 16);
  const gap = range(rng, 2.5, 7.0); // 院落
  const offset = halfRoad + 4 + front.depth + gap + depth / 2;
  const cx = at.x + at.nx * offset * sideSign;
  const cy = at.y + at.ny * offset * sideSign;

  let b;
  if (kind === 'shop') {
    const pal = pick(rng, isHarbor ? HARBOR_SHOP_PALETTES : OLD_SHOP_PALETTES);
    b = {
      district: districtId,
      kind: 'shop',
      type: 'shop',
      x: cx,
      y: cy,
      width,
      depth,
      floors: isHarbor ? pick(rng, [4, 5, 5, 6]) : pick(rng, [4, 4, 5, 6]),
      floorHeight: range(rng, 3.3, 3.6),
      rotation: at.angle + range(rng, -0.15, 0.15),
      facing: -sideSign,
      roofStyle: isHarbor ? 'flat' : chance(rng, 0.3) ? 'flat' : 'gable',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      balconies: isHarbor && chance(rng, 0.3),
      roofEquipment: true,
      _hostRoadId: road.id,
    };
  } else {
    const pal = pick(rng, HOUSE_PALETTES);
    b = {
      district: districtId,
      kind: 'house',
      type: 'house',
      x: cx,
      y: cy,
      width,
      depth,
      floors: pick(rng, [3, 3, 4]),
      floorHeight: range(rng, 2.7, 2.85),
      rotation: at.angle + range(rng, -0.16, 0.16),
      facing: -sideSign,
      roofStyle: 'gable',
      wallColor: pal.wallColor,
      roofColor: pal.roofColor,
      plinthColor: pal.plinthColor,
      balconies: false,
      roofEquipment: false,
      _hostRoadId: road.id,
    };
  }
  const placed = tryPlaceBuilding(b, ctx);
  if (placed) {
    placed.road = road.name;
    ctx.buildings.push(placed);
  }
  return placed;
}

// ---------------------------------------------------------------------------
// 零散组团填充
// ---------------------------------------------------------------------------

function placeClusterFill(ctx, districtId) {
  const { rng, counts } = ctx;
  const spec = CLUSTER_SPECS[districtId];
  const quota = DISTRICT_QUOTAS[districtId];
  const cfg = DISTRICT_LIMITS[districtId] || DISTRICT_LIMITS.old;
  let remaining = 0;
  for (const k in QUOTA_MIX[districtId]) {
    remaining += Math.max(0, (quota[k] ?? 0) - (counts[districtId][k] || 0));
  }
  const target = Math.min(spec.target, remaining);
  let added = 0;
  let tries = 0;
  while (added < target && tries++ < 1600) {
    const ang = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * spec.radius;
    const x = spec.center.x + Math.cos(ang) * r;
    const y = spec.center.y + Math.sin(ang) * r;
    if (heightAtLocal(x, y) < cfg.minGround) continue;

    // 必须靠近道路（保持「沿街聚集」）
    const nearest = nearestRoadSample(x, y, ctx.roads);
    if (!nearest || nearest.dist > spec.nearRoad) continue;

    // 必须靠近已有建筑（抱团）
    let nearestBuilding = Infinity;
    for (const b of ctx.buildings) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < nearestBuilding) nearestBuilding = d;
    }
    if (nearestBuilding > spec.nearBuilding) continue;

    const kind = pickRowKind(rng, QUOTA_MIX[districtId], districtId, counts, quota);
    if (!kind) break;
    const arch = makeArchetype(rng, kind, cfg.flavor);
    if (!arch) continue;

    const b = {
      district: districtId,
      kind,
      type: arch.type,
      x,
      y,
      width: arch.width,
      depth: arch.depth,
      floors: arch.floors,
      floorHeight: arch.floorHeight,
      rotation: nearest.angle + range(rng, -0.5, 0.5),
      facing: nearest.side,
      roofStyle: arch.roofStyle,
      wallColor: arch.wallColor,
      roofColor: arch.roofColor,
      plinthColor: arch.plinthColor,
      balconyColor: arch.balconyColor,
      balconies: arch.balconies,
      roofEquipment: arch.roofEquipment,
      accentColor: arch.accentColor,
    };
    const placed = tryPlaceBuilding(b, ctx);
    if (placed) {
      placed.road = nearest.road.name;
      ctx.buildings.push(placed);
      counts[districtId][kind] += 1;
      added++;
    }
  }
}

/** 找离 (x,y) 最近的街道采样点，返回 {road, dist, angle, side} */
function nearestRoadSample(x, y, roads) {
  let best = null;
  for (const road of roads) {
    const pts = road._curve.points;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - x, pts[i].y - y);
      if (!best || d < best.dist) {
        const angle = road._curve.angleAt[i];
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        const dot = (x - pts[i].x) * nx + (y - pts[i].y) * ny;
        best = { road, dist: d, angle, side: dot > 0 ? -1 : 1 };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 编号 / 命名 / 派生
// ---------------------------------------------------------------------------

const KIND_ORDER = { public: 0, landmark: 1, apartment: 2, shop: 3, house: 4, pier: 5 };

function finalizeBuildings(buildings) {
  buildings.sort((a, b) => {
    const t = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (t !== 0) return t;
    if (a.district !== b.district) return a.district === 'old' ? -1 : 1;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const counters = {};

  buildings.forEach((b, i) => {
    b.index = i;
    b.id = `b-${String(i + 1).padStart(3, '0')}`;

    const housePrefix = {
      old: '老城民居', west: '西城民居', north: '北城民居', harbor: '滨海民居', cbd: 'CBD 公寓',
    };
    const shopPrefix = {
      old: '老城商铺', west: '西城商铺', north: '北城商铺', harbor: '滨海商住', cbd: 'CBD 商街',
    };
    switch (b.kind) {
      case 'house': {
        const key = `house:${b.district}`;
        counters[key] = (counters[key] || 0) + 1;
        b.name = `${housePrefix[b.district] || '民居'} ${String(counters[key]).padStart(3, '0')}`;
        break;
      }
      case 'shop': {
        const key = `shop:${b.district}`;
        counters[key] = (counters[key] || 0) + 1;
        b.name = `${shopPrefix[b.district] || '商铺'} ${String(counters[key]).padStart(3, '0')}`;
        break;
      }
      case 'apartment': {
        const key = 'apartment';
        counters[key] = (counters[key] || 0) + 1;
        b.name = `澜屿港公寓 ${String(counters[key]).padStart(2, '0')}`;
        break;
      }
      case 'tower': {
        const key = 'tower';
        counters[key] = (counters[key] || 0) + 1;
        b.name = `澜屿 CBD 大厦 ${String(counters[key]).padStart(2, '0')}`;
        break;
      }
      default:
        // public / landmark / pier 使用固定名称
        break;
    }

    // 屋顶参数 & 总高度（几何与 buildings.json 共用）
    const shortSide = Math.min(b.width, b.depth);
    if (b.kind === 'pier') {
      b.eaveHeight = 2.6;
      b.roofHeight = 0;
      b.height = round1(2.6);
    } else if (b.roofStyle === 'tower') {
      const podiumFloors = b.podiumFloors ?? 2;
      b.totalFloors = podiumFloors + b.floors;
      b.eaveHeight = round2(b.totalFloors * b.floorHeight);
      b.roofHeight = 1.0;
      // 天线/桅杆只做视觉，不计入「建筑高度」
      b.height = round1(b.eaveHeight + b.roofHeight);
    } else if (b.roofStyle === 'flat') {
      b.eaveHeight = round2(b.floors * b.floorHeight);
      b.roofHeight = 0.85; // 女儿墙 / 挑檐板
      b.height = round1(b.eaveHeight + b.roofHeight);
    } else {
      b.eaveHeight = round2(b.floors * b.floorHeight);
      b.roofHeight = round2(Math.max(1.05, Math.min(2.5, shortSide * 0.27)));
      b.height = round1(b.eaveHeight + b.roofHeight);
    }

    // floors 字段：地标按总层数（含裙楼）给，便于统计
    if (b.roofStyle === 'tower') b.floors = b.totalFloors;

    delete b._hostRoadId;
    delete b._frontS;
  });
}

function summarize(buildings, roads, counts) {
  const byKind = { house: 0, shop: 0, apartment: 0, tower: 0, public: 0, landmark: 0, pier: 0 };
  const byType = { house: 0, shop: 0, public: 0, pier: 0 };
  const byDistrict = {};
  for (const d of TOWN.districts) {
    byDistrict[d.id] = { house: 0, shop: 0, apartment: 0, tower: 0, public: 0, landmark: 0, pier: 0, total: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minG = Infinity;
  let maxG = -Infinity;
  let minGround = Infinity;
  let maxGround = -Infinity;
  let maxH = 0;
  for (const b of buildings) {
    byKind[b.kind] = (byKind[b.kind] || 0) + 1;
    byType[b.type] = (byType[b.type] || 0) + 1;
    const d = byDistrict[b.district];
    if (d) {
      d[b.type] = (d[b.type] || 0) + 1;
      d.total++;
    }
    if (b.x < minX) minX = b.x;
    if (b.x > maxX) maxX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.y > maxY) maxY = b.y;
    if (b.minGround < minG) minG = b.minGround;
    if (b.maxGround > maxG) maxG = b.maxGround;
    if (b.groundHeight < minGround) minGround = b.groundHeight;
    if (b.groundHeight > maxGround) maxGround = b.groundHeight;
    if (b.height > maxH) maxH = b.height;
  }
  let roadLength = 0;
  for (const r of roads) roadLength += r.length;
  return {
    town: TOWN.name,
    buildingCount: buildings.length,
    byKind,
    byType,
    byDistrict,
    footprintBBox: {
      minX: round2(minX),
      maxX: round2(maxX),
      minY: round2(minY),
      maxY: round2(maxY),
    },
    groundRange: { min: round2(minGround), max: round2(maxGround) },
    minGroundRange: { min: round2(minG), max: round2(maxG) },
    heightMax: round1(maxH),
    totalFloorArea: round1(
      buildings.reduce((sum, b) => sum + b.footprintArea * (b.floors || 1), 0),
    ),
    roadCount: roads.length,
    roadLength: round1(roadLength),
    quotaCounts: counts,
  };
}
