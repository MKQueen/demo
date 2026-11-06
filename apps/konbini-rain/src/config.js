/**
 * config.js —— 雨夜便利店微缩场景的「唯一真源」。
 *
 * 坐标系：+X 向右、+Y 向上、+Z 朝向观众/街道正面。
 * 地面（马路）y = 0；人行道/地块顶面 y = 0.12；便利店室内地面 y = 0.14。
 * 底座顶面是一个 11 × 11 的正方形（x/z ∈ [-5.5, 5.5]），所有元素都落在它上面。
 *
 * 所有模块统一从这里取尺寸 / 颜色，禁止各自硬编码关键坐标。
 */

/* ========================================================================== */
/*  调色板                                                                     */
/* ========================================================================== */

export const C = {
  // 夜
  bgTop: '#04060d',
  bgHorizon: '#0d1730',
  bgBottom: '#070a12',
  fog: '#0a1020',
  hemiSky: '#6f95cf',
  hemiGround: '#141826',
  moon: '#b7d0ff',

  // 室外硬质
  road: '#171c27',
  roadDark: '#0f1420',
  roadLine: '#e7edf5',
  roadStop: '#efd98a',
  lot: '#34343c',
  lotTile: '#3d3d45',
  lotTileAlt: '#36363e',
  curb: '#555560',
  curbTop: '#6b6b75',
  gutter: '#20242e',
  manhole: '#3f434c',
  tactile: '#c9a84c',

  // 便利店外壳
  wall: '#ded8c6',
  wallShade: '#c4beac',
  wallPanel: '#e8e2d1',
  kick: '#3e4450',
  frame: '#eef0ec',
  frameShade: '#b9bdb9',
  roof: '#5f656d',
  roofDark: '#454b54',
  canopy: '#e6e9e3',
  interiorFloor: '#cfc8b4',
  interiorCeil: '#efeadd',
  shelf: '#f2eee3',
  shelfMetal: '#9aa0a8',
  fridgeGlass: '#b9e4e3',

  // 品牌
  brand: {
    cream: '#fbf3dd',
    navy: '#20304f',
    teal: '#3fa8a0',
    amber: '#ffc96b',
    coral: '#ff7a5e',
    pink: '#ff6f9c',
  },

  // 霓虹 / 灯光
  warm: '#ffd9a0',
  warmDeep: '#ffb45e',
  warmHot: '#ff9b4a',
  cool: '#9fd8ff',
  neonPink: '#ff6f9c',
  neonCyan: '#7fe8e0',
  neonAmber: '#ffca7a',
  trafficGreen: '#7dffc0',
  trafficRed: '#ff5a5a',

  // 底座
  wood: '#2a1e19',
  woodLight: '#3b2a22',
  brass: '#c09a5c',
  brassDark: '#7a5c30',
};

/* ========================================================================== */
/*  布局（单位：米）                                                            */
/* ========================================================================== */

export const L = {
  baseHalf: 5.5,
  plinthHalf: 5.82,
  plinthH: 0.95,

  // 近侧地块（人行道 + 店铺基地）：抬高 0.12
  lot: { minX: -5.5, maxX: 3.2, minZ: -5.5, maxZ: 3.0, top: 0.12 },

  // 马路：L 形（正面一条 + 右侧一条）
  road: {
    front: { minX: -5.5, maxX: 5.0, minZ: 3.0, maxZ: 5.0 },
    right: { minX: 3.2, maxX: 5.0, minZ: -5.5, maxZ: 3.0 },
    intersection: { minX: 3.2, maxX: 5.0, minZ: 3.0, maxZ: 5.0 },
  },

  // 远侧人行道（底座边缘的一条薄边，像模型被切下来前的一截街道）
  farWalk: {
    front: { minX: -5.5, maxX: 5.5, minZ: 5.0, maxZ: 5.5, top: 0.12 },
    right: { minX: 5.0, maxX: 5.5, minZ: -5.5, maxZ: 5.0, top: 0.12 },
  },

  crosswalkFront: { x0: 1.3, x1: 2.9, z0: 3.06, z1: 4.94, stripes: 8 },
  crosswalkRight: { x0: 3.26, x1: 4.94, z0: 1.35, z1: 2.9, stripes: 7 },

  // 便利店外壳
  store: {
    minX: -2.9,
    maxX: 1.7,
    minZ: -4.6,
    maxZ: 1.0,
    wallT: 0.18,
    floorY: 0.14,
    wallTopY: 3.52,
    parapetY: 3.74,
    glassY0: 0.45,
    glassY1: 2.5,
    fasciaY0: 2.5,
    fasciaY1: 3.4,
    windowX0: -2.72,
    windowX1: 0.54,
    doorX0: 0.62,
    doorX1: 1.5,
    // 室内净空间
    interior: {
      minX: -2.72,
      maxX: 1.52,
      minZ: -4.42,
      maxZ: 0.82,
      floorY: 0.14,
      ceilY: 2.52,
    },
    // 雨棚
    canopy: { x0: -1.3, x1: 1.78, z0: 1.0, z1: 2.28, y: 2.4, thickness: 0.09 },
    // 招牌
    sign: { x0: -2.78, x1: 1.56, y0: 2.62, y1: 3.3, z: 1.03 },
  },

  // 左侧旧楼（在底座边缘被「切」掉，作为街角的另外一边）
  neighbor: { minX: -5.5, maxX: -4.0, minZ: -4.8, maxZ: 1.0, height: 6.2, floor2Y: 3.2 },

  // 小巷（旧楼与便利店之间）
  alley: { minX: -4.0, maxX: -2.9, minZ: -5.5, maxZ: 1.0 },

  // 关键城市家具位置
  pylon: { x: 2.82, z: 1.5, baseY: 0.12 },
  poleMain: { x: 3.02, z: 2.74 },
  poleFront: { x: -5.25, z: 2.72 },
  poleBack: { x: 3.04, z: -5.24 },
  trafficLight: { x: 5.16, z: -5.14 },
  vending: {
    // 两台自动贩卖机靠在便利店右侧外墙，朝 +X
    x: 1.7,
    zCold: -0.95,
    zHot: -2.02,
  },
  parking: {
    // 右侧马路边的两个平行停车位
    x0: 3.32,
    x1: 4.92,
    bays: [
      { z0: -4.35, z1: -2.4 },
      { z0: -2.15, z1: -0.2 },
    ],
  },

  // 屋顶设备
  roof: { acX: -1.4, acZ: -2.6, ventX: 0.6, ventZ: -3.6 },

  // 灯位（主光由 main.js 统一创建，这里只放位置）
  lights: {
    interior: [
      { x: -1.6, y: 2.35, z: -0.4, color: 'warm', intensity: 1.95, distance: 3.8, decay: 2 },
      { x: -0.5, y: 2.35, z: -2.2, color: 'warm', intensity: 2.1, distance: 4.0, decay: 2 },
      { x: 0.9, y: 2.3, z: -3.4, color: 'warm', intensity: 1.5, distance: 3.5, decay: 2 },
      { x: 1.15, y: 2.1, z: -0.6, color: 'warmDeep', intensity: 0.8, distance: 2.6, decay: 2 },
      { x: -1.65, y: 2.3, z: 0.3, color: 'warm', intensity: 1.15, distance: 3.0, decay: 2 },
    ],
    streetLamp: { x: 4.15, y: 5.55, z: 4.0, color: 'warmDeep', intensity: 4.2, distance: 12, decay: 2 },
    canopy: { x: 0.35, y: 2.2, z: 1.65, color: 'warm', intensity: 0.85, distance: 3.0, decay: 2 },
    sign: { x: -0.6, y: 3.0, z: 1.9, color: 'warm', intensity: 0.6, distance: 3.2, decay: 2 },
    vending: { x: 2.5, y: 1.0, z: -1.5, color: 'cool', intensity: 0.45, distance: 2.8, decay: 2 },
    neonPink: { x: -4.35, y: 3.6, z: 1.5, color: 'neonPink', intensity: 0.55, distance: 3.6, decay: 2 },
  },
};

/* ========================================================================== */
/*  雨夜小镇布局（十字街 · 15×15 收藏模型）                                      */
/* ========================================================================== */

/**
 * 整座小镇都落在一个约 15×15 的方形底座上：
 *   - 中心是十字路口，向四个方向伸出主街
 *   - 东北：便利店（保留原来完整的内景，作为视觉焦点）
 *   - 东南：居酒屋 / 拉面 / 古书 三家小店组成的商店街
 *   - 西北：日式住宅 + 小公寓 + 学校 + 小公园
 *   - 西南： elevated 神社 + 小医院
 *   - 东侧：一条被切到模型边缘的铁道、站台与一列电车
 *   - 南侧：一条穿过底座边缘的小河，两座桥
 *
 * 旧模型仍是 11×11 的街角；这里通过 storeOffset 把它整体平移到小镇东北角。
 * 旧模块只认 L 里的坐标，因此这里的坐标系与 L 兼容：地面 y=0、地块顶面 y=0.12。
 */
export const E = {
  bounds: { minX: -7.6, maxX: 7.6, minZ: -7.6, maxZ: 7.6 },
  top: 0.12,

  // 十字街
  road: {
    ew: { minX: -7.6, maxX: 7.6, minZ: -0.5, maxZ: 1.7 },
    ns: { minX: -1.1, maxX: 1.1, minZ: -7.6, maxZ: 7.6 },
  },
  walk: {
    north: { minZ: -1.5, maxZ: -0.5 },
    south: { minZ: 1.7, maxZ: 2.7 },
    east: { minX: 1.1, maxX: 2.1 },
    west: { minX: -2.1, maxX: -1.1 },
  },

  // 把旧便利店整体移到东北角（front +Z 正对东西向主街）
  storeOffset: { dx: 5.0, dz: -2.5 },

  // 东南商业街：复用街版店铺，压进小镇尺度（两家最抢眼的 + 花摊）
  commercial: [
    {
      id: 'izakaya', style: 'izakaya', position: { x: -2.6, z: 3.85 },
      scale: { x: 0.5, y: 0.7, z: 0.56 }, rotation: Math.PI / 2,
      info: {
        id: 'izakaya', x0: -1.7, x1: 1.7, h: 4.6, floors: 2, style: 'izakaya',
        jp: '居酒屋 とり吉', en: 'TORIYOSHI', short: 'とり吉',
        accent: '#ff6f5e', sign: '#ffd28a', glow: '#ff8a5c', paper: '#2a1c18',
      },
    },
    {
      id: 'ramen', style: 'ramen', position: { x: -2.6, z: 5.8 },
      scale: { x: 0.5, y: 0.7, z: 0.56 }, rotation: Math.PI / 2,
      info: {
        id: 'ramen', x0: -1.9, x1: 1.9, h: 5.2, floors: 2, style: 'ramen',
        jp: 'ラーメン 麺屋 灯', en: 'MENYA AKARI', short: '麺屋 灯',
        accent: '#ff8a5c', sign: '#ffd9a0', glow: '#ff9b5e', paper: '#f3ead8',
      },
    },
  ],

  // 西北住宅区 + 学校 + 小公园（密度优先的微缩尺度）
  houses: [
    { id: 'house-1', x: -6.35, z: -3.15, w: 1.9, d: 1.9, h: 2.4, roof: 'gable', warm: '#ffcf94', garden: true },
    { id: 'house-2', x: -3.5, z: -6.45, w: 1.8, d: 2.0, h: 2.3, roof: 'hip', warm: '#ffd9a0', garden: false },
  ],
  apartment: { id: 'apartment', x: -6.3, z: -6.0, w: 2.2, d: 2.5, h: 5.0, floors: 3 },
  school: { x: -3.5, z: -3.6, w: 2.2, d: 2.8, h: 3.4, yard: { x: -3.5, z: -2.0, w: 2.2, d: 0.7 } },
  park: { x: -6.3, z: -4.55, w: 1.8, d: 0.55 },

  // 南侧小河
  river: { minZ: 6.9, maxZ: 7.42, y: 0.045 },
  bridgeMain: { x0: -1.1, x1: 1.1, z: 6.7 },
  bridgeFoot: { x0: -5.6, x1: -4.4, z: 6.75 },

  // 东侧铁道（模型边缘的「切面」）
  rail: { minX: 6.85, maxX: 7.6, minZ: -7.4, maxZ: 6.8, y: 0.06 },
  platform: { x0: 6.08, x1: 6.85, z0: 2.8, z1: 5.55 },

  // 西南： elevated 神社 + 小医院
  shrine: { x: 5.05, z: 6.25, w: 2.3, d: 1.1 },
  hospital: { x: 3.0, z: 4.2, w: 1.9, d: 2.2, h: 3.6, floors: 2 },

  // 街上的灯
  townLights: [
    { x: 0.2, y: 3.6, z: 0.2, color: 'warm', intensity: 1.6, distance: 5.0, decay: 2 },
    { x: 4.6, y: 2.6, z: 2.3, color: 'warm', intensity: 1.4, distance: 4.5, decay: 2 },
    { x: -5.6, y: 2.8, z: -2.4, color: 'warmDeep', intensity: 1.2, distance: 4.5, decay: 2 },
    { x: -5.0, y: 2.4, z: 5.3, color: 'warm', intensity: 1.1, distance: 4.0, decay: 2 },
    { x: 6.9, y: 3.0, z: 4.6, color: 'cool', intensity: 0.9, distance: 4.0, decay: 2 },
  ],

  // 雨区（fx）
  rainCenter: { x: 0, z: 0 },
  rainHalf: { x: 8.0, z: 8.0 },
};

/* ========================================================================== */
/*  品牌                                                                       */
/* ========================================================================== */

export const BRAND = {
  nameJa: 'つきみマート',
  nameEn: 'TSUKIMI MART',
  nameShort: 'TSUKIMI',
  tagline: '24H',
  taglineLong: '24時間営業',
  storeNo: '月見町二丁目店',
  poster: {
    oden: 'おでん はじめました',
    coffee: 'できたてコーヒー',
    onigiri: '新発売 おにぎり',
    moon: '月見だんご',
  },
};

/* ========================================================================== */
/*  相机预设（自检截图与开场镜头共用；不是 UI）                                  */
/* ========================================================================== */

export const VIEWS = {
  // 开场：45° 略带俯视，整座小镇尽收眼底
  hero: { target: [0.2, 1.2, 0.8], radius: 33, az: 0.7, el: 0.82, fov: 32 },
  // 便利店正前方
  front: { target: [4.4, 1.4, -1.0], radius: 11.5, az: 0.16, el: 1.05, fov: 36 },
  // 商店街（西南，朝东的居酒屋/拉面）
  shops: { target: [-3.4, 1.2, 4.6], radius: 11.5, az: 1.05, el: 1.0, fov: 36 },
  // 住宅区
  homes: { target: [-4.4, 1.2, -3.4], radius: 10.5, az: 0.58, el: 0.95, fov: 36 },
  // 神社 / 医院（东南）
  shrine: { target: [4.8, 1.2, 4.9], radius: 10.0, az: 0.82, el: 0.9, fov: 38 },
  // 铁道 / 站台
  rail: { target: [6.5, 1.4, 2.0], radius: 10.0, az: 1.45, el: 0.95, fov: 36 },
  // 俯瞰模型
  top: { target: [0, 0.6, 0.2], radius: 34.0, az: 0.55, el: 0.48, fov: 33 },
  // 贴近玻璃看店内
  inside: { target: [4.4, 1.3, -3.0], radius: 4.6, az: 0.14, el: 1.42, fov: 44 },
  // 背面服务通道
  back: { target: [4.4, 1.3, -6.2], radius: 10.5, az: 2.6, el: 1.02, fov: 36 },
};

/* ========================================================================== */
/*  小工具                                                                     */
/* ========================================================================== */

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 确定性随机数（mulberry32）——纹理与杂物摆放保持每次一致 */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

/** 把颜色 hex 转 THREE.Color 之前用的统一入口（供模块里 new THREE.Color 用） */
export function colorOf(hex) {
  return hex;
}
