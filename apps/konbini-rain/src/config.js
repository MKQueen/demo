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
  // 44×44 的大镇：中央十字街 + 四条次街 + 东侧铁道 + 南侧河
  bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
  top: 0.12,

  road: {
    ew: { minX: -22, maxX: 22, minZ: -2.2, maxZ: 1.8 },
    ns: { minX: -2.2, maxX: 1.8, minZ: -22, maxZ: 22 },
  },
  walk: {
    north: { minZ: -3.7, maxZ: -2.2 },
    south: { minZ: 1.8, maxZ: 3.3 },
    east: { minX: 1.8, maxX: 3.3 },
    west: { minX: -3.7, maxX: -2.2 },
  },

  // 次级街道（东西 / 南北各两条）
  minorEW: [ { minZ: -15.4, maxZ: -13.4 }, { minZ: 13.4, maxZ: 15.4 } ],
  minorNS: [ { minX: -15.4, maxX: -13.4 }, { minX: 13.4, maxX: 15.4 } ],

  // 便利店：主路口东北角
  storeOffset: { dx: 5.5, dz: -3.2 },

  // 商店街：主街西侧（朝东）+ 主街北侧（朝南）
  shops: [
    { id: 'izakaya', style: 'izakaya', jp: '居酒屋 とり吉', en: 'TORIYOSHI', kind: 'izakaya', x: -2.4, z: 4.4, ry: Math.PI / 2, w: 3.6, d: 5.0, h: 6.2, accent: '#ff6f5e', sign: '#ffd28a', paper: '#2a1c18' },
    { id: 'ramen', style: 'ramen', jp: 'ラーメン 麺屋 灯', en: 'MENYA AKARI', kind: 'ramen', x: -2.4, z: 7.0, ry: Math.PI / 2, w: 3.8, d: 5.0, h: 6.6, accent: '#ff8a5c', sign: '#ffd9a0', paper: '#f3ead8' },
    { id: 'books', style: 'books', jp: '古書 かもめ', en: 'KAMOME BOOKS', kind: 'books', x: -2.4, z: 9.6, ry: Math.PI / 2, w: 3.0, d: 4.6, h: 5.4, accent: '#d8b06a', sign: '#ffe0a8', paper: '#f0e2c8' },
    { id: 'cafe', style: 'cafe', jp: '喫茶 ひかり', en: 'HIKARI COFFEE', kind: 'cafe', x: -2.4, z: 11.8, ry: Math.PI / 2, w: 2.8, d: 4.2, h: 5.0, accent: '#ffcf94', sign: '#ffd9a0', paper: '#2a1c14' },
    { id: 'barber', style: 'barber', jp: '床屋 タカハシ', en: 'TAKAHASHI', kind: 'barber', x: -2.4, z: 13.8, ry: Math.PI / 2, w: 2.6, d: 3.8, h: 4.8, accent: '#9fd8ff', sign: '#cfe8ff', paper: '#1e2a3a' },
    { id: 'north-cafe', style: 'cafe', jp: '喫茶 月見', en: 'TSUKIMI CAFE', kind: 'cafe', x: -11.8, z: -2.4, ry: 0, w: 3.0, d: 4.0, h: 5.2, accent: '#ffcf94', sign: '#ffd9a0', paper: '#2a1c14' },
    { id: 'pharmacy', style: 'pharmacy', jp: 'くすり 月見', en: 'PHARMACY', kind: 'pharmacy', x: -8.6, z: -2.4, ry: 0, w: 2.8, d: 4.0, h: 5.0, accent: '#7dffc0', sign: '#c8f0ff', paper: '#1a3a3a' },
    { id: 'thrift', style: 'thrift', jp: '100円ショップ', en: 'HYAKU-EN', kind: 'thrift', x: -5.8, z: -2.4, ry: 0, w: 2.6, d: 4.0, h: 4.8, accent: '#ff8a5c', sign: '#ffe0b0', paper: '#5a2a2a' },
    { id: 'laundry', style: 'laundry', jp: 'コインランドリー', en: 'LAUNDRY', kind: 'laundry', x: -3.4, z: -2.4, ry: 0, w: 2.2, d: 3.6, h: 4.6, accent: '#7fe8e0', sign: '#d8fbff', paper: '#1a3a4a' },
  ],

  // 大校园（北侧）
  school: { x: -10.5, z: -9.8, w: 12.0, d: 5.0, h: 12.0, floors: 4 },
  gym: { x: -18.6, z: -17.6, w: 5.0, d: 6.2, h: 7.0 },
  pool: { x: -3.2, z: -18.2, w: 3.6, d: 3.2 },
  schoolYard: { x: -10.5, z: -6.2, w: 12.0, d: 2.4 },

  // 神社（西侧，带池塘）
  shrine: { x: -18.4, z: 7.2, w: 6.4, d: 9.2 },
  hospital: { x: 16.6, z: -10.8, w: 3.4, d: 6.0, h: 15.0, floors: 5 },
  station: { platformX0: 17.3, platformX1: 19.2, z0: -7.0, z1: 9.0 },
  river: { minZ: 18.6, maxZ: 22.0, y: 0.045 },
  rail: { minX: 19.2, maxX: 22.0, minZ: -22, maxZ: 18.6, y: 0.06 },
  bridgeMain: { x0: -2.2, x1: 1.8, z: 18.6 },
  bridgeWest: { x0: -15.4, x1: -13.4, z: 18.6 },

  // 住宅（外圈 + 内圈，按街道朝向）
  houses: [
    // 西侧外圈
    { x: -19.0, z: -12.0, w: 3.0, d: 2.6, h: 3.1, ry: Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: -19.0, z: -8.6, w: 3.0, d: 2.6, h: 3.0, ry: Math.PI / 2, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: -19.0, z: -5.2, w: 3.0, d: 2.6, h: 3.2, ry: Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: false },
    { x: -19.0, z: 14.4, w: 3.0, d: 2.4, h: 3.0, ry: Math.PI / 2, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: -19.0, z: 16.8, w: 3.0, d: 2.4, h: 2.9, ry: Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: false },
    // 北侧外圈
    { x: -12.0, z: -18.5, w: 3.2, d: 3.0, h: 3.3, ry: 0, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: -8.0, z: -18.5, w: 3.2, d: 3.0, h: 3.1, ry: 0, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: -4.0, z: -18.5, w: 3.0, d: 3.0, h: 3.0, ry: 0, roof: 'hip', warm: '#ffcf94', garden: false },
    // 内圈东南
    { x: 5.4, z: 5.0, w: 3.2, d: 2.8, h: 3.2, ry: -Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: 5.4, z: 9.4, w: 3.2, d: 2.8, h: 3.0, ry: -Math.PI / 2, roof: 'hip', warm: '#ffd9a0', garden: false },
    { x: 10.4, z: 5.2, w: 3.0, d: 2.6, h: 3.1, ry: -Math.PI / 2, roof: 'hip', warm: '#ffcf94', garden: true },
    // 东侧外圈
    { x: 16.6, z: 12.8, w: 3.0, d: 2.4, h: 3.0, ry: -Math.PI / 2, roof: 'gable', warm: '#ffd9a0', garden: false },
    { x: 16.6, z: 15.4, w: 3.0, d: 2.4, h: 2.9, ry: -Math.PI / 2, roof: 'hip', warm: '#ffcf94', garden: true },
    // 补充住宅（填充北侧 / 内圈 / 东侧空地）
    { x: 2.0, z: -19.0, w: 3.2, d: 3.0, h: 3.3, ry: 0, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: 6.0, z: -19.0, w: 3.2, d: 3.0, h: 3.1, ry: 0, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: 10.0, z: -19.0, w: 3.0, d: 3.0, h: 3.0, ry: 0, roof: 'hip', warm: '#ffcf94', garden: false },
    { x: 14.0, z: -19.0, w: 3.0, d: 3.0, h: 3.2, ry: 0, roof: 'gable', warm: '#ffd9a0', garden: true },
    { x: -13.0, z: 4.4, w: 3.0, d: 3.0, h: 3.2, ry: Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: -13.0, z: 7.8, w: 3.0, d: 3.0, h: 3.0, ry: Math.PI / 2, roof: 'hip', warm: '#ffd9a0', garden: false },
    { x: -13.0, z: 11.2, w: 3.0, d: 3.0, h: 3.1, ry: Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: true },
    { x: 11.0, z: 9.2, w: 3.0, d: 2.8, h: 3.1, ry: -Math.PI / 2, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: 12.6, z: 3.8, w: 2.4, d: 2.4, h: 3.0, ry: -Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: false },
    { x: 10.0, z: -4.6, w: 3.0, d: 2.8, h: 3.2, ry: 0, roof: 'hip', warm: '#ffd9a0', garden: true },
    { x: 16.6, z: 10.4, w: 3.0, d: 2.4, h: 3.0, ry: -Math.PI / 2, roof: 'gable', warm: '#ffcf94', garden: true },
  ],

  apartments: [
    { x: -8.8, z: 6.2, w: 3.2, d: 3.0, h: 11.0, floors: 3, ry: 0 },
    { x: 10.5, z: -9.2, w: 3.4, d: 3.2, h: 15.0, floors: 5, ry: 0 },
    { x: -19.2, z: -1.6, w: 3.2, d: 2.8, h: 9.0, floors: 3, ry: 0 },
  ],


  // 公园 / 车位 / 河岸
  parks: [
    { x: -6.8, z: -3.2, w: 3.0, d: 2.6 },
    { x: -10.0, z: 16.2, w: 6.0, d: 2.8 },
    { x: 6.0, z: 16.4, w: 6.0, d: 2.6 },
  ],
  parking: { x: 4.8, z: -11.0, w: 6.0, d: 3.6 },
  riversidePark: { x: 0.0, z: 16.6, w: 18.0, d: 2.4 },
  market: { x: -4.2, z: 17.0, w: 5.0, d: 2.2 },

  // 街灯
  townLights: [
    { x: 0.2, y: 4.0, z: 0.2, color: 'warm', intensity: 2.2, distance: 9.0, decay: 2 },
    { x: -2.4, y: 3.4, z: 7.0, color: 'warm', intensity: 2.0, distance: 8.0, decay: 2 },
    { x: 5.0, y: 3.2, z: -3.0, color: 'warm', intensity: 1.8, distance: 7.0, decay: 2 },
    { x: -15.0, y: 3.4, z: 7.0, color: 'warmDeep', intensity: 1.4, distance: 7.0, decay: 2 },
    { x: 16.8, y: 4.0, z: 2.0, color: 'cool', intensity: 1.5, distance: 7.0, decay: 2 },
    { x: -15.0, y: 3.2, z: -9.0, color: 'warmDeep', intensity: 1.3, distance: 7.0, decay: 2 },
  ],

  rainCenter: { x: 0, z: 0 },
  rainHalf: { x: 22, z: 22 },
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
  hero: { target: [0.4, 2.4, 1.2], radius: 74, az: 0.7, el: 0.86, fov: 32 },
  front: { target: [5.6, 1.6, -2.2], radius: 16, az: 0.16, el: 1.0, fov: 36 },
  shops: { target: [-2.6, 1.6, 8.0], radius: 20, az: 0.75, el: 0.92, fov: 36 },
  homes: { target: [-10.0, 1.8, -8.0], radius: 24, az: 0.65, el: 0.9, fov: 36 },
  shrine: { target: [-18.0, 1.8, 7.0], radius: 18, az: 0.85, el: 0.88, fov: 38 },
  rail: { target: [17.8, 1.8, 2.0], radius: 17, az: 1.3, el: 0.9, fov: 36 },
  school: { target: [-10.0, 2.0, -9.8], radius: 24, az: 0.42, el: 0.92, fov: 36 },
  river: { target: [0.0, 1.4, 16.8], radius: 26, az: 0.45, el: 0.82, fov: 36 },
  top: { target: [0, 1.0, 0.2], radius: 112, az: 0.55, el: 0.5, fov: 33 },
  inside: { target: [5.6, 1.3, -5.4], radius: 4.8, az: 0.14, el: 1.42, fov: 44 },
  back: { target: [5.6, 1.3, -8.0], radius: 11, az: 2.6, el: 1.02, fov: 36 },
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
