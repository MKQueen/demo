/**
 * layout.js —— 「清明上河图」长卷的真源。
 *
 * 尺度：1 世界单位 = 1 米（不再做京城那种 1:50 的压缩，因为长卷要看见人）。
 * 长卷沿 X 轴展开，卷首（郊野）在 -190，卷尾（城内街市）在 +190；
 * 相机站在卷子南侧（+Z）向北看，像把一卷画摊在面前。
 *
 * 一条汴河从西到东横贯画面，河北岸是城、河南岸是郊野；
 * 虹桥跨河，城门口在河东，过了城门就是街市。
 */

/* -------------------------------------------------------------------------- */
/*  卷轴                                                                        */
/* -------------------------------------------------------------------------- */

export const SCROLL = {
  minX: -190,
  maxX: 190,
  get length() {
    return this.maxX - this.minX;
  },
};

/** 长卷八段：卷首郊野 → 汴河 → 虹桥 → 城门 → 街市 → 州桥 → 御街 → 大内。 */
export const SCENES = [
  {
    id: 'country',
    name: '郊野',
    seal: '野',
    en: 'THE COUNTRYSIDE',
    t: 0.052,
    at: [-150, -10],
    text: '疏林薄雾，农舍田畴。驮炭的驴队从柳树下走过，扫墓的人循着小路回城——长卷从这一片安静的春寒里起笔。',
    cam: { dist: 86, elevation: 0.55, azimuth: 0.14 },
  },
  {
    id: 'river',
    name: '河市',
    seal: '河',
    en: 'THE BIAN RIVER',
    t: 0.163,
    at: [-66, -10],
    text: '汴河自西而来，河面渐宽。货船、客船、漕船挤在岸边，纤夫弓着身子把船拖过浅滩，码头上的茶棚已经支起来了。',
    cam: { dist: 80, elevation: 0.52, azimuth: 0.2 },
  },
  {
    id: 'bridge',
    name: '桥市',
    seal: '桥',
    en: 'THE RAINBOW BRIDGE',
    t: 0.24,
    at: [-7, -6],
    text: '虹桥无柱，一木架成。桥上是市：摊贩、算命先生、轿夫、看船的人挤得水泄不通。桥下正有一条大船要过，桅杆放倒了一半。',
    cam: { dist: 104, elevation: 0.46, azimuth: 0.98 },
  },
  {
    id: 'gate',
    name: '城门',
    seal: '城',
    en: 'THE CITY GATE',
    t: 0.32,
    at: [52, -22],
    text: '一座城门楼，几匹骆驼正从门洞里出来。城门外是关厢的脚店与茶坊，进城就是另一番声响了。',
    cam: { dist: 84, elevation: 0.5, azimuth: 0.24 },
  },
  {
    id: 'market',
    name: '街市',
    seal: '市',
    en: 'THE STREET MARKET',
    t: 0.42,
    at: [130, -24],
    text: '十字街头，酒楼搭起彩楼欢门，茶坊、香药铺、正店、脚店一路排开。轿子、马、驴、挑夫、货郎从人群里挤过去，幌子在风里翻。',
    cam: { dist: 66, elevation: 0.6, azimuth: 0.12 },
  },
  {
    id: 'zhouqiao',
    name: '州桥',
    seal: '州',
    en: 'THE STATE BRIDGE',
    t: 0.6,
    at: [250, 6],
    text: '御街跨过汴河的州桥。桥两岸是东京城最热闹的河市，桥面上车马行人昼夜不绝；桥下船过，桥头就是樊楼的灯火。',
    cam: { dist: 72, elevation: 0.42, azimuth: 0.9 },
  },
  {
    id: 'yujie',
    name: '御街',
    seal: '御',
    en: 'THE IMPERIAL WAY',
    t: 0.79,
    at: [250, -140],
    text: '御街宽数十步，居中为御道，两旁的御廊下开满了铺席。往北望去，宣德门的朱墙已经看得见了。',
    cam: { dist: 96, elevation: 0.34, azimuth: 0.05 },
  },
  {
    id: 'palace',
    name: '大内',
    seal: '内',
    en: 'THE IMPERIAL PALACE',
    t: 0.975,
    at: [250, -300],
    text: '宣德门五门洞开，门楼九间，朱墙黄瓦。门内大庆殿的鸱吻在暮色里发黑——汴京的中心到了。',
    cam: { dist: 92, elevation: 0.46, azimuth: 0.05 },
  },
];

/** 某一段落的索引。 */
export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));

/* -------------------------------------------------------------------------- */
/*  汴河                                                                        */
/* -------------------------------------------------------------------------- */

/** 水面高度：比岸略低，像真的河。 */
export const WATER_Y = 0.35;

/** 岸顶（绢面）高度。人物、房子、树都站在这个高度上。 */
export const GROUND_Y = 1.2;

/** 河北岸（城一侧）与河南岸（郊野一侧）的岸线高度。 */
export const BANK_Y = 1.6;

/**
 * 汴河中心线：从西到东，河道略有摆动。
 * [x, z]
 */
export const RIVER = {
  halfWidth: 21,
  path: [
    [-230, 2],
    [-190, 3],
    [-160, 4],
    [-130, 7],
    [-100, 10],
    [-70, 11],
    [-40, 9],
    [-10, 6],
    [20, 8],
    [50, 11],
    [80, 13],
    [120, 12],
    [160, 10],
    [200, 8],
    [240, 7],
    [280, 9],
    [320, 6],
    [360, 10],
    [420, 12],
    [480, 9],
    [540, 10],
  ],
};

/** 线性插值：某处河心的 z。 */
export function riverZ(x) {
  const p = RIVER.path;
  if (x <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, z0] = p[i];
    const [x1, z1] = p[i + 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return z0 + (z1 - z0) * t;
    }
  }
  return p[p.length - 1][1];
}

/** 北岸边缘 z（城一侧）。 */
export const northBankZ = (x) => riverZ(x) - RIVER.halfWidth;
/** 南岸边缘 z（郊野一侧）。 */
export const southBankZ = (x) => riverZ(x) + RIVER.halfWidth;

/* -------------------------------------------------------------------------- */
/*  虹桥                                                                        */
/* -------------------------------------------------------------------------- */

export const BRIDGE = {
  x: -6, // 桥心
  span: 58, // 跨径（沿 z 方向，放大，让拱读得出来）
  width: 13, // 桥面宽（沿 x 方向）
  deckY: 9.6, // 桥心桥面高
  rise: 15.5, // 拱高
  railing: 1.2,
};

/** 桥面中心线的 z 范围（南岸到北岸）。 */
export const BRIDGE_SOUTH = southBankZ(BRIDGE.x) + 2;
export const BRIDGE_NORTH = northBankZ(BRIDGE.x) - 2;

/* -------------------------------------------------------------------------- */
/*  城与街                                                                      */
/* -------------------------------------------------------------------------- */

export const CITY = {
  /** 城墙：沿 x 方向的一段，在街市北侧 */
  wallZ: -44,
  wallX0: 18,
  wallX1: 205,
  wallH: 9,
  wallT: 4,
  /** 城门楼 */
  gateX: 52,
  gateW: 16,
  gateTowerW: 22,
  gateTowerH: 15,
};

/** 河北岸的沿河主街（从虹桥往东） */
export const ROAD = {
  main: [
    [-210, -16],
    [-160, -18],
    [-110, -20],
    [-60, -22],
    [-20, -22],
    [10, -24],
    [40, -22],
    [70, -20],
    [110, -18],
    [150, -16],
    [200, -15],
  ],
  /** 南岸郊野的土路 */
  south: [
    [-200, 40],
    [-150, 36],
    [-100, 33],
    [-60, 32],
    [-30, 34],
    [-6, 36],
  ],
};

/** 街市（过城门后）：街心 z 与两侧铺面退距。 */
export const MARKET = {
  x0: 58,
  x1: 195,
  streetZ: -24,
  halfWidth: 7, // 街宽 14 米
  shopDepth: 9,
};

/* -------------------------------------------------------------------------- */
/*  东京城（长卷之外的城）                                                       */
/* -------------------------------------------------------------------------- */

/** 御街：南北向，自州桥往北直抵大内宣德门。 */
export const YUJIE = {
  x: 250, // 街心 x
  halfWidth: 17, // 街宽 34 米
  southZ: 52, // 南端（州桥以南）
  northZ: -300, // 北端（宣德门）
};

/** 州桥：御街跨汴河的石拱桥。 */
export const ZHOUQIAO = {
  x: YUJIE.x, // 250
  z: 8, // 汴河在此处
  span: 46,
  width: 18,
  rise: 7,
};

/** 相国寺：御街西侧的大寺（山门 / 大殿 / 资圣阁 / 塔）。 */
export const XIANGOU = {
  cx: 172,
  cz: -132,
  w: 96,
  d: 118,
  gateX: 220,
};

/** 樊楼（丰乐楼）：州桥东北的三层酒楼。 */
export const FANLOU = {
  x: 305,
  z: -66,
  w: 34,
  d: 24,
  floors: 3,
};

/** 大内（宫城）：宣德门 + 宫墙 + 大庆殿。 */
export const PALACE = {
  x0: 168,
  x1: 332,
  z0: -470,
  z1: -302,
  gateZ: -302,
  gateW: 26,
  wallH: 13,
  hallW: 52,
  hallD: 30,
};

/** 东水门：汴河出东城墙的水门（外城墙在 x≈520）。 */
export const EAST_WATER_GATE = { x: 520, z: 10, w: 30, h: 16 };

/* -------------------------------------------------------------------------- */
/*  长卷路径：从卷首郊野，一路进东京城                                          */
/* -------------------------------------------------------------------------- */

/**
 * 长卷的相机路径（2D）：[x, z]
 * 卷首沿汴河西行，进街市后折向北，沿御街直上到大内。
 */
export const SCROLL_PATH = [
  [-190, -10],
  [-120, -12],
  [-60, -10],
  [-7, -6],
  [52, -18],
  [130, -24],
  [200, -22],
  [238, -18],
  [250, 6],
  [250, -60],
  [250, -140],
  [250, -230],
  [250, -300],
];

/** 路径累计长度 → t 采样。 */
const PATH_LEN = (() => {
  const cum = [0];
  for (let i = 1; i < SCROLL_PATH.length; i++) {
    const dx = SCROLL_PATH[i][0] - SCROLL_PATH[i - 1][0];
    const dz = SCROLL_PATH[i][1] - SCROLL_PATH[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dz));
  }
  return cum;
})();

export function pathAt(t) {
  const total = PATH_LEN[PATH_LEN.length - 1];
  const d = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < PATH_LEN.length - 1 && PATH_LEN[i] < d) i++;
  const d0 = PATH_LEN[i - 1];
  const d1 = PATH_LEN[i] || d0 + 1;
  const k = (d - d0) / (d1 - d0 || 1);
  const a = SCROLL_PATH[i - 1];
  const b = SCROLL_PATH[i];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** 路线上某处 t 的大致朝向（给镜头偏角用）。 */
export function pathTangent(t) {
  const p0 = pathAt(Math.max(0, t - 0.01));
  const p1 = pathAt(Math.min(1, t + 0.01));
  const dx = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}


/* -------------------------------------------------------------------------- */
/*  整个东京城：三重城、四水、街巷、宫观园林                                     */
/* -------------------------------------------------------------------------- */

/** 外城（罗城）：东西约 1120m、南北约 940m（画面里做了压缩）。 */
export const OUTER_CITY = {
  x0: -320,
  x1: 800,
  z0: -640,
  z1: 300,
  wallH: 12,
  wallT: 8,
  gates: [
    { id: 'xinzheng', name: '新郑门', side: 'w', x: -320, z: -180 },
    { id: 'wansheng', name: '万胜门', side: 'w', x: -320, z: 40 },
    { id: 'guzi', name: '固子门', side: 'n', x: -170, z: -640 },
    { id: 'chenqiao', name: '陈桥门', side: 'n', x: 60, z: -640 },
    { id: 'suanzao', name: '新酸枣门', side: 'n', x: 300, z: -640 },
    { id: 'dongbei', name: '东北水门', side: 'n', x: 560, z: -640 },
    { id: 'xincao', name: '新曹门', side: 'e', x: 800, z: -300 },
    { id: 'xinsongmen', name: '新宋门', side: 'e', x: 800, z: -20 },
    { id: 'dongshuimen', name: '东水门', side: 'e', x: 800, z: 10 },
    { id: 'xinnan', name: '新南门', side: 's', x: 320, z: 300 },
    { id: 'chenzhou', name: '陈州门', side: 's', x: 620, z: 300 },
    { id: 'xinmen', name: '新门', side: 's', x: -60, z: 300 },
  ],
};

/** 里城（旧城）：包着宫城与相国寺、樊楼。 */
export const INNER_CITY = {
  x0: 70,
  x1: 450,
  z0: -540,
  z1: 120,
  wallH: 10,
  wallT: 6,
  gates: [
    { id: 'zhengmen', name: '郑门', side: 'w', x: 70, z: -120 },
    { id: 'songmen', name: '宋门', side: 'e', x: 450, z: -30 },
    { id: 'chenqiao2', name: '陈桥门', side: 'n', x: 200, z: -540 },
    { id: 'xinmen2', name: '新门', side: 's', x: 300, z: 120 },
    { id: 'caomen', name: '曹门', side: 'n', x: 380, z: -540 },
  ],
};

/** 外城护城河。 */
export const MOAT = { offset: 30, width: 32 };

/** 蔡河：城南东西向；五丈河：城东北；金水河：城西入宫。 */
export const CANALS = {
  caihe: {
    width: 18,
    path: [[-320, 150], [-120, 165], [80, 155], [280, 170], [480, 160], [700, 175], [800, 170]],
  },
  wuzhanghe: {
    width: 16,
    path: [[300, -640], [340, -560], [380, -460], [420, -380], [460, -300], [520, -240]],
  },
  jinshuihe: {
    width: 12,
    path: [[-320, -260], [-220, -270], [-120, -280], [-20, -290], [80, -300], [168, -310]],
  },
};

/** 全城街巷（宽 8~34m）。 */
export const STREETS = [
  { id: 'yujie', width: 34, pts: [[250, 120], [250, 52], [250, -302]] },
  { id: 'songmen', width: 24, pts: [[70, -120], [150, -110], [230, -96], [305, -66], [450, -40], [620, -30], [800, -20]] },
  { id: 'maxing', width: 22, pts: [[380, 120], [380, -60], [380, -240], [380, -420], [380, -540]] },
  { id: 'donghua', width: 18, pts: [[332, -330], [450, -330], [620, -340], [800, -340]] },
  { id: 'xihua', width: 18, pts: [[168, -330], [70, -330], [-120, -340], [-320, -340]] },
  { id: 'nanmen', width: 20, pts: [[320, 300], [320, 120], [320, -60], [320, -302]] },
  { id: 'bei', width: 16, pts: [[60, -640], [60, -540], [60, -420], [60, -300], [70, -120]] },
];

/** 全城地标（墨线剪影 + 朱印）。 */
export const CITY_LANDMARKS = [
  { id: 'huangcheng', name: '大内', x: 250, z: -380, seal: '内' },
  { id: 'xiangguo', name: '相国寺', x: 172, z: -132, seal: '寺' },
  { id: 'fanlou', name: '樊楼', x: 305, z: -66, seal: '楼' },
  { id: 'zhouqiao', name: '州桥', x: 250, z: 8, seal: '桥' },
  { id: 'hongqiao', name: '虹桥', x: -6, z: 4, seal: '虹' },
  { id: 'maxing', name: '马行街', x: 380, z: -160, seal: '马' },
  { id: 'washe', name: '瓦舍', x: 380, z: -60, seal: '瓦' },
  { id: 'tiemota', name: '开宝寺塔', x: 540, z: -430, seal: '塔' },
  { id: 'fanpagoda', name: '繁塔', x: 600, z: 190, seal: '繁' },
  { id: 'taimiao', name: '太庙', x: 160, z: -250, seal: '庙' },
  { id: 'jingling', name: '景灵宫', x: 110, z: -430, seal: '景' },
  { id: 'jinmingchi', name: '金明池', x: -190, z: -270, seal: '池' },
  { id: 'qionglin', name: '琼林苑', x: -60, z: -180, seal: '苑' },
  { id: 'dongshuimen', name: '东水门', x: 800, z: 10, seal: '水' },
  { id: 'xinsongmen', name: '新宋门', x: 800, z: -20, seal: '宋' },
  { id: 'dongjing', name: '东京城', x: 250, z: 40, seal: '京' },
];

/** 全城视角。 */
export const OVERVIEW = {
  target: [240, 0, -170],
  dist: 1500,
  elevation: 0.9,
  azimuth: 0.12,
  minDist: 260,
  maxDist: 2000,
};

/* -------------------------------------------------------------------------- */
/*  相机                                                                        */
/* -------------------------------------------------------------------------- */

export const CAMERA = {
  /** 目标点高度与默认离岸距离 */
  targetZ: -18,
  targetY: 7,
  dist: 86,
  elevation: 0.47, // 仰角（弧度），约 24°
  azimuth: 0.02,
  minDist: 62,
  maxDist: 150,
  minElevation: 0.18,
  maxElevation: 0.72,
  /** 卷首 / 卷尾留一点余量 */
  minX: SCROLL.minX + 10,
  maxX: SCROLL.maxX - 10,
};

/** scroll t (0..1) → 目标 x */
export const tToX = (t) => CAMERA.minX + (CAMERA.maxX - CAMERA.minX) * t;
export const xToT = (x) => (x - CAMERA.minX) / (CAMERA.maxX - CAMERA.minX);
