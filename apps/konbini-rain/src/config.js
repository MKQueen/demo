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
/*  雨夜小镇布局（十字街 · 24×24 收藏模型）                                      */
/* ========================================================================== */

/**
 * 整座小镇都落在一个 24×24 的方形底座上：
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
  bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
  top: 0.12,

  // 中央十字街
  road: {
    ew: { minX: -12, maxX: 12, minZ: -1.3, maxZ: 1.5 },
    ns: { minX: -1.5, maxX: 1.3, minZ: -12, maxZ: 12 },
  },
  walk: {
    north: { minZ: -2.6, maxZ: -1.3 },
    south: { minZ: 1.5, maxZ: 2.8 },
    east: { minX: 1.3, maxX: 2.6 },
    west: { minX: -2.8, maxX: -1.5 },
  },

  // 便利店整体平移到东北角（front +Z 朝东西向主街）
  storeOffset: { dx: 5.7, dz: -3.6 },

  // 主街南侧的一排店面（朝北，面向东西向主街）
  commercial: [
    {
      id: 'izakaya', style: 'izakaya', position: { x: -2.8, z: 3.7 },
      scale: { x: 0.55, y: 0.72, z: 0.58 }, rotation: Math.PI / 2,
      info: {
        id: 'izakaya', x0: -1.7, x1: 1.7, h: 4.6, floors: 2, style: 'izakaya',
        jp: '居酒屋 とり吉', en: 'TORIYOSHI', short: 'とり吉',
        accent: '#ff6f5e', sign: '#ffd28a', glow: '#ff8a5c', paper: '#2a1c18',
      },
    },
    {
      id: 'ramen', style: 'ramen', position: { x: -2.8, z: 5.85 },
      scale: { x: 0.55, y: 0.72, z: 0.58 }, rotation: Math.PI / 2,
      info: {
        id: 'ramen', x0: -1.9, x1: 1.9, h: 5.2, floors: 2, style: 'ramen',
        jp: 'ラーメン 麺屋 灯', en: 'MENYA AKARI', short: '麺屋 灯',
        accent: '#ff8a5c', sign: '#ffd9a0', glow: '#ff9b5e', paper: '#f3ead8',
      },
    },
    {
      id: 'books', style: 'books', position: { x: -2.8, z: 7.9 },
      scale: { x: 0.45, y: 0.7, z: 0.56 }, rotation: Math.PI / 2,
      info: {
        id: 'books', style: 'books', x0: -1.3, x1: 1.3, h: 4.6, floors: 2,
        jp: '古書 かもめ', en: 'KAMOME BOOKS', short: '古書',
        accent: '#d8b06a', sign: '#ffe0a8', glow: '#ffcf94', paper: '#f0e2c8',
      },
    },
  ],
  barber: { x: 9.2, z: 2.85, width: 1.2, h: 2.6 },

  // 主街北侧西段的小门面（朝南）
  northShops: [
    { id: 'cafe', kind: 'cafe', x: -10.2, w: 1.5, jp: '喫茶 ひかり', en: 'HIKARI', color: '#ffcf94', signBg: '#2a1c14', accent: '#ffd9a0' },
    { id: 'pharmacy', kind: 'pharmacy', x: -8.55, w: 1.45, jp: 'くすり 月見', en: 'PHARMACY', color: '#c8f0ff', signBg: '#1a3a3a', accent: '#7dffc0' },
    { id: 'thrift', kind: 'thrift', x: -6.95, w: 1.4, jp: '100円ショップ', en: 'HYAKU-EN', color: '#ffe0b0', signBg: '#5a2a2a', accent: '#ff8a5c' },
    { id: 'barber', kind: 'barber', x: -5.35, w: 1.35, jp: '床屋 タカハシ', en: 'BARBER', color: '#cfe8ff', signBg: '#1e2a3a', accent: '#9fd8ff' },
    { id: 'laundry', kind: 'laundry', x: -3.75, w: 1.35, jp: 'コインランドリー', en: 'LAUNDRY', color: '#d8fbff', signBg: '#1a3a4a', accent: '#7fe8e0' },
  ],

  // 住宅区
  houses: [
    { id: 'house-1', x: -10.4, z: -5.4, w: 2.8, d: 2.4, h: 2.7, roof: 'gable', warm: '#ffcf94', garden: true },
    { id: 'house-2', x: -7.1, z: -5.4, w: 2.8, d: 2.4, h: 2.6, roof: 'hip', warm: '#ffd9a0', garden: true },
    { id: 'house-3', x: -3.9, z: -5.2, w: 2.3, d: 2.2, h: 2.5, roof: 'gable', warm: '#ffcf94', garden: false },
    { id: 'house-4', x: 4.6, z: 4.6, w: 2.4, d: 2.2, h: 2.5, roof: 'gable', warm: '#ffd9a0', garden: true },
    { id: 'house-5', x: 4.6, z: 6.85, w: 2.4, d: 2.0, h: 2.4, roof: 'hip', warm: '#ffcf94', garden: false },
    { id: 'house-6', x: -7.35, z: 4.25, w: 1.65, d: 2.0, h: 2.2, roof: 'gable', warm: '#ffd9a0', garden: false },
    { id: 'house-7', x: -7.35, z: 6.6, w: 1.65, d: 2.0, h: 2.15, roof: 'hip', warm: '#ffcf94', garden: false },
  ],
  apartment: { id: 'apartment', x: -4.1, z: -9.3, w: 3.0, d: 2.8, h: 8.0, floors: 6 },
  school: { x: -9.6, z: -9.5, w: 4.4, d: 3.0, h: 4.4, yard: { x: -9.6, z: -7.3, w: 4.4, d: 1.4 } },
  park: { x: -7.6, z: -7.6, w: 2.2, d: 1.2 },

  // 南侧小河
  river: { minZ: 10.3, maxZ: 11.7, y: 0.045 },
  bridgeMain: { x0: -1.5, x1: 1.3, z: 10.15 },
  bridgeFoot: { x0: -8.6, x1: -7.1, z: 10.2 },

  // 东侧铁道
  rail: { minX: 10.6, maxX: 11.9, minZ: -12, maxZ: 10.2, y: 0.06 },
  platform: { x0: 9.6, x1: 10.6, z0: 2.9, z1: 7.4 },

  // 神社 / 医院 / 河岸公园
  shrine: { x: -10.6, z: 6.2, w: 4.2, d: 4.4 },
  hospital: { x: 8.2, z: -8.2, w: 2.2, d: 4.2, h: 6.4, floors: 4 },
  riversidePark: { x: 7.6, z: 8.7, w: 4.8, d: 1.5 },

  // 街上的灯
  townLights: [
    { x: 0.2, y: 3.8, z: 0.2, color: 'warm', intensity: 2.0, distance: 7.0, decay: 2 },
    { x: 4.9, y: 3.2, z: 2.2, color: 'warm', intensity: 1.8, distance: 6.0, decay: 2 },
    { x: -6.6, y: 3.0, z: -2.4, color: 'warmDeep', intensity: 1.5, distance: 5.5, decay: 2 },
    { x: -9.5, y: 2.8, z: 6.0, color: 'warmDeep', intensity: 1.3, distance: 5.0, decay: 2 },
    { x: 9.8, y: 3.2, z: 5.6, color: 'cool', intensity: 1.2, distance: 5.0, decay: 2 },
    { x: 8.6, y: 3.0, z: -5.5, color: 'warm', intensity: 1.2, distance: 5.0, decay: 2 },
  ],

  rainCenter: { x: 0, z: 0 },
  rainHalf: { x: 12, z: 12 },
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
  // 开场：整座 24×24 雨夜小镇的四分之三俯瞰
  hero: { target: [0.2, 2.2, 0.6], radius: 55, az: 0.7, el: 0.9, fov: 30 },
  // 便利店
  front: { target: [5.1, 1.5, -1.8], radius: 13.5, az: 0.16, el: 1.02, fov: 36 },
  // 主街商店街
  shops: { target: [6.0, 1.4, 4.5], radius: 16, az: 0.55, el: 0.95, fov: 36 },
  // 住宅区
  homes: { target: [-6.4, 1.4, -4.6], radius: 17, az: 0.66, el: 0.92, fov: 36 },
  // 神社
  shrine: { target: [-9.2, 1.5, 6.0], radius: 14, az: 0.82, el: 0.88, fov: 38 },
  // 车站 / 铁道
  rail: { target: [10.3, 1.6, 4.8], radius: 13, az: 1.35, el: 0.9, fov: 36 },
  // 河岸
  river: { target: [0.0, 1.2, 9.2], radius: 18, az: 0.35, el: 0.82, fov: 36 },
  // 俯瞰模型
  top: { target: [0, 0.6, 0.2], radius: 42, az: 0.55, el: 0.5, fov: 33 },
  // 店内
  inside: { target: [5.1, 1.3, -5.3], radius: 4.8, az: 0.14, el: 1.42, fov: 44 },
  // 背面服务通道
  back: { target: [5.1, 1.3, -7.4], radius: 11, az: 2.6, el: 1.02, fov: 36 },
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
