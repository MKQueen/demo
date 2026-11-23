/**
 * layout.js —— 水墨北京的总平面。
 *
 * 这是全场景唯一的一份「地理底稿」：宫城、城墙、湖面、山形、长城、地标坐标
 * 都从这里取。各个 world 模块只负责把这份底稿「画」出来，不要各自硬编码坐标。
 *
 * 坐标：x 向东，z 向南，y 向上；中轴线在 x = 0，北是 -z。
 * 尺度：1 世界单位 = 50 米（见 lib/units.js）。
 *
 * 参考的真实中轴距离（从永定门到钟楼约 7.8 km）：
 *   永定门 ─ 正阳门 ─ 天安门 ─ 午门 ─ 太和殿 ─ 神武门 ─ 景山 ─ 钟鼓楼
 *     z=105    z=51     z=21    z=7     z=0      z=-8    z=-13   z=-58
 */
import { u, h } from './lib/units.js';
import { hash01, fbm2 } from './lib/rand.js';

export { u, h };

/* -------------------------------------------------------------------------- */
/*  一、重要标高                                                                */
/* -------------------------------------------------------------------------- */

/** 纸面（平原地面）高度。全城建筑都站在 0 上。 */
export const GROUND_Y = 0;
/** 水面高度：略低于纸面，靠一圈更深的水岸墨线压住。 */
export const WATER_Y = -0.06;
/** 水面以下再压一层「湿墨」，做岸线的阴影。 */
export const WATER_EDGE_Y = -0.13;

/* -------------------------------------------------------------------------- */
/*  二、中轴与城墙                                                              */
/* -------------------------------------------------------------------------- */

export const AXIS = { x: 0 };

/** 紫禁城（宫城）范围：961m × 753m。 */
export const PALACE = {
  x: 0,
  w: u(961),
  d: u(753),
  south: u(350), // 午门
  north: -u(400), // 神武门
  wallH: h(10),
  wallT: u(10),
  moatW: u(52),
  centerZ: (u(350) - u(400)) / 2,
};
PALACE.halfW = PALACE.w / 2;
PALACE.centerZ = (PALACE.south + PALACE.north) / 2;

/** 内城（九门）城墙：约 6650m 宽、5200m 深。 */
export const INNER_CITY = {
  halfX: u(3325),
  south: u(2550), // 正阳门一线
  north: -u(3200), // 德胜门 / 安定门一线
  wallH: h(12),
  wallT: u(16),
};
INNER_CITY.depth = INNER_CITY.south - INNER_CITY.north;
INNER_CITY.centerZ = (INNER_CITY.south + INNER_CITY.north) / 2;

/** 外城：从正阳门到永定门，东西更宽。 */
export const OUTER_CITY = {
  halfX: u(3950),
  south: u(5250), // 永定门
  north: INNER_CITY.south,
  wallH: h(10),
  wallT: u(14),
};
OUTER_CITY.depth = OUTER_CITY.south - OUTER_CITY.north;
OUTER_CITY.centerZ = (OUTER_CITY.south + OUTER_CITY.north) / 2;

/** 城门位置（沿内城/外城）。 */
export const GATES = [
  { id: 'zhengyang', name: '正阳门', x: 0, z: INNER_CITY.south, side: 's', main: true },
  { id: 'chongwen', name: '崇文门', x: u(1800), z: INNER_CITY.south, side: 's' },
  { id: 'xuanwu', name: '宣武门', x: -u(1800), z: INNER_CITY.south, side: 's' },
  { id: 'chaoyang', name: '朝阳门', x: INNER_CITY.halfX, z: u(900), side: 'e' },
  { id: 'dongzhi', name: '东直门', x: INNER_CITY.halfX, z: -u(900), side: 'e' },
  { id: 'fucheng', name: '阜成门', x: -INNER_CITY.halfX, z: u(900), side: 'w' },
  { id: 'xizhi', name: '西直门', x: -INNER_CITY.halfX, z: -u(900), side: 'w' },
  { id: 'desheng', name: '德胜门', x: -u(900), z: INNER_CITY.north, side: 'n' },
  { id: 'anding', name: '安定门', x: u(900), z: INNER_CITY.north, side: 'n' },
  { id: 'yongding', name: '永定门', x: 0, z: OUTER_CITY.south, side: 's', outer: true },
  { id: 'zuoan', name: '左安门', x: u(2300), z: OUTER_CITY.south, side: 's', outer: true },
  { id: 'youan', name: '右安门', x: -u(2300), z: OUTER_CITY.south, side: 's', outer: true },
];
export const GATE_BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g]));

/** 中轴线上的关键节点（从南到北），城市模块用它来排建筑。 */
export const AXIS_NODES = [
  { id: 'yongding', z: u(5250), name: '永定门' },
  { id: 'tiantan', z: u(3550), name: '天桥' },
  { id: 'zhengyang', z: u(2550), name: '正阳门' },
  { id: 'tiananmen', z: u(1050), name: '天安门' },
  { id: 'wumen', z: u(350), name: '午门' },
  { id: 'taihe', z: 0, name: '太和殿' },
  { id: 'shenwu', z: -u(400), name: '神武门' },
  { id: 'jingshan', z: -u(650), name: '景山' },
  { id: 'drum', z: -u(2900), name: '钟鼓楼' },
];

/* -------------------------------------------------------------------------- */
/*  三、湖、河、护城河                                                          */
/* -------------------------------------------------------------------------- */

/** 生成一个「像手画出来的」湖岸多边形（确定性）。 */
export function blobPolygon(cx, cz, rx, rz, seed = 1, n = 26, wobble = 0.16) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + (hash01(seed * 7919 + i * 131) - 0.5) * 2 * wobble;
    const w2 = 1 + Math.sin(a * 3 + seed) * wobble * 0.4;
    pts.push([cx + Math.cos(a) * rx * w * w2, cz + Math.sin(a) * rz * w]);
  }
  return pts;
}

/**
 * 湖面：人工修过的「有机形」——用 48~64 个控制点 + 小幅度扰动，
 * 再由 water.js 做 Chaikin 平滑，避免出现多边形硬折角。
 * 形状按北京真实水系意译：昆明湖的西北水口、北海的圆、什刹海的一串葫芦。
 */
function organicLake(cx, cz, rx, rz, seed, n = 56, wobble = 0.06) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + (hash01(seed * 7919 + i * 131) - 0.5) * 2 * wobble;
    const w2 = 1 + Math.sin(a * 2 + seed) * wobble * 0.5 + Math.sin(a * 5 + seed * 2) * wobble * 0.3;
    pts.push([cx + Math.cos(a) * rx * w * w2, cz + Math.sin(a) * rz * w]);
  }
  return pts;
}

/** 什刹海：前海—后海—西海 的一串葫芦（手绘折线 + 平滑）。 */
function shichahaiOutline() {
  const pts = [];
  const chain = [
    { cx: -u(700), cz: -u(3600), rx: u(420), rz: u(300) }, // 前海
    { cx: -u(1150), cz: -u(4300), rx: u(430), rz: u(340) }, // 后海西段
    { cx: -u(1800), cz: -u(4900), rx: u(380), rz: u(300) }, // 后海
    { cx: -u(2500), cz: -u(5300), rx: u(340), rz: u(260) }, // 西海
  ];
  for (let k = 0; k < chain.length; k++) {
    const c = chain[k];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const w = 1 + (hash01(9001 + k * 71 + i * 13) - 0.5) * 0.16;
      pts.push([c.cx + Math.cos(a) * c.rx * w, c.cz + Math.sin(a) * c.rz * w]);
    }
  }
  return pts;
}

export const LAKES = {
  beihai: {
    id: 'beihai',
    name: '北海',
    cx: -u(1450),
    cz: -u(900),
    points: organicLake(-u(1450), -u(900), u(760), u(700), 3, 56, 0.05),
    rx: u(760),
    rz: u(700),
  },
  zhongnanhai: {
    id: 'zhongnanhai',
    name: '中南海',
    cx: -u(1350),
    cz: u(450),
    points: organicLake(-u(1350), u(450), u(450), u(640), 7, 52, 0.05),
    rx: u(450),
    rz: u(640),
  },
  shichahai: {
    id: 'shichahai',
    name: '什刹海',
    cx: -u(1400),
    cz: -u(4300),
    points: shichahaiOutline(),
    rx: u(1500),
    rz: u(1100),
  },
  kunming: {
    id: 'kunming',
    name: '昆明湖',
    cx: -u(11500),
    cz: -u(10000),
    points: organicLake(-u(11500), -u(10000), u(1080), u(860), 17, 64, 0.05),
    rx: u(1080),
    rz: u(860),
  },
  fuhai: {
    id: 'fuhai',
    name: '福海',
    cx: -u(8800),
    cz: -u(7600),
    points: organicLake(-u(8800), -u(7600), u(620), u(560), 29, 48, 0.05),
    rx: u(620),
    rz: u(560),
  },
};

/** 护城河：内城一圈矩形水环。 */
export const MOAT = {
  inner: { halfX: INNER_CITY.halfX + u(30), north: INNER_CITY.north - u(30), south: INNER_CITY.south + u(30) },
  outer: { halfX: INNER_CITY.halfX + u(120), north: INNER_CITY.north - u(120), south: INNER_CITY.south + u(120) },
  width: u(70),
};

/** 河道：由折线 + 宽度描述，转成带状水面。 */
export const CANALS = [
  {
    id: 'changhe',
    name: '长河',
    width: u(70),
    points: [
      [-u(10700), -u(9800)],
      [-u(9000), -u(8600)],
      [-u(7000), -u(7000)],
      [-u(5200), -u(5600)],
      [-u(3600), -u(3800)],
      [-u(2600), -u(2600)],
      [-u(1700), -u(2100)],
      [-u(1200), -u(2000)],
    ],
  },
  {
    id: 'tonghui',
    name: '通惠河',
    width: u(90),
    points: [
      [u(3100), u(2500)],
      [u(4400), u(2400)],
      [u(6200), u(2600)],
      [u(9000), u(3000)],
      [u(13000), u(3400)],
    ],
  },
];

/** 永定河：西南方向的大河，卢沟桥横跨其上。 */
export const RIVERS = [
  {
    id: 'yongding',
    name: '永定河',
    width: u(260),
    points: [
      [-u(16000), -u(2000)],
      [-u(13500), u(1200)],
      [-u(11000), u(3200)],
      [-u(8600), u(4800)],
      [-u(6000), u(6200)],
      [-u(3000), u(7400)],
      [-u(800), u(8200)],
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  四、山形                                                                    */
/* -------------------------------------------------------------------------- */

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const _lakeEllipses = Object.values(LAKES).map((l) => ({ cx: l.cx, cz: l.cz, rx: l.rx, rz: l.rz }));
const _ribbons = [
  ...RIVERS.map((r) => ({ points: r.points, width: r.width })),
  ...CANALS.map((c) => ({ points: c.points, width: c.width })),
];

function distToPolyline(x, z, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0];
    const az = points[i][1];
    const bx = points[i + 1][0];
    const bz = points[i + 1][1];
    const vx = bx - ax;
    const vz = bz - az;
    const wx = x - ax;
    const wz = z - az;
    const len2 = vx * vx + vz * vz || 1;
    let t = (wx * vx + wz * vz) / len2;
    t = Math.min(1, Math.max(0, t));
    const dx = wx - vx * t;
    const dz = wz - vz * t;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 湖面 / 河道的「湿区」权重：1 = 水面中心（地形必须压平到 0），0 = 不受影响。
 * 这样山可以很近地围住昆明湖，但湖面不会被山埋掉。
 */
function wetMask(x, z) {
  let wet = 0;
  for (const l of _lakeEllipses) {
    const d = Math.sqrt(((x - l.cx) / l.rx) ** 2 + ((z - l.cz) / l.rz) ** 2);
    wet = Math.max(wet, 1 - smoothstep(1.02, 2.35, d));
  }
  for (const r of _ribbons) {
    const d = distToPolyline(x, z, r.points);
    wet = Math.max(wet, 1 - smoothstep(r.width * 0.75, r.width * 3.4, d));
  }
  return wet;
}

/**
 * 地形高度（世界单位）。城市平原恒为 0；
 * 北面燕山、西面西山逐渐抬高；昆明湖/永定河/长河一带压平成湖盆与河谷；
 * 昆明湖北岸单独起一座万寿山（颐和园）。
 * 所有放在地面上的模块（长城、山寺、树）都用它取高度。
 */
export function terrainHeight(x, z) {
  // 北：燕山。z 越小越高（从城北 14 km 起坡，26 km 处达最高）。
  const northMask = smoothstep(-u(14000), -u(26000), z);
  // 西：西山。x 越小越高。
  const westMask = smoothstep(-u(14000), -u(26000), x);
  // 西南：太行山余脉，压低一些，给永定河留出河谷
  const southWestMask = smoothstep(-u(15000), -u(26000), x) * smoothstep(u(14000), u(5000), z);

  const mask = Math.max(northMask, westMask * 0.92, southWestMask * 0.7);
  let height = 0;
  if (mask > 0.001) {
    const n = fbm2(x / u(5200), z / u(5200), 21, 5) * 0.5 + 0.5;
    const ridged = 1 - Math.abs(fbm2(x / u(2600), z / u(2600), 33, 4));
    const shape = 0.55 * n + 0.45 * ridged;
    height = Math.pow(mask, 1.55) * (h(420) * 0.35 + h(900) * shape);
  }

  // 湖盆 / 河谷：湿区把山压回平原，水面才有地方铺
  height *= 1 - wetMask(x, z);

  // 万寿山：昆明湖北岸的小山（颐和园佛香阁的台座）
  const wx = x - -u(11800);
  const wz = z - -u(11200);
  const wanshou = Math.exp(-(wx * wx) / (u(720) * u(720)) - (wz * wz) / (u(430) * u(430)));
  height += wanshou * h(74);

  return height;
}

/** 一条山脊上的「最高线」，长城模块用来落墙。 */
export function ridgeHeight(x, z) {
  return terrainHeight(x, z);
}

/* -------------------------------------------------------------------------- */
/*  五、长城                                                                    */
/* -------------------------------------------------------------------------- */

/** 长城走线：沿燕山山脊。高度由 terrainHeight 给出。 */
export const GREAT_WALL = {
  points: [
    [-u(18000), -u(16000)],
    [-u(13000), -u(18500)],
    [-u(8000), -u(20500)],
    [-u(3000), -u(21500)],
    [u(2000), -u(22000)],
    [u(7500), -u(21500)],
    [u(12500), -u(20000)],
    [u(16500), -u(18000)],
  ],
  towerEvery: 4,
};

/* -------------------------------------------------------------------------- */
/*  四·五、皇城 / 坛庙 / 外城 / 街道（城市规划层）                                */
/* -------------------------------------------------------------------------- */

/** 皇城：包着紫禁城与西苑三海，南天安门、北地安门、东西安门。 */
export const HUANGCHENG = {
  south: u(1050), // 天安门一线
  north: -u(1200), // 地安门一线
  halfX: u(1250), // 东安门 / 西安门
  wallH: h(8),
  wallT: u(12),
};

/** 太庙：宫城东南、皇城内，天安门东侧。 */
export const TAMIAO = { x: u(950), z: u(520), w: u(300), d: u(420) };
/** 社稷坛（今中山公园）：宫城西南、皇城内，天安门西侧。 */
export const SHEJITAN = { x: -u(950), z: u(520), w: u(320), d: u(420) };

/** 外城七门（内城南墙已由九门承担）。 */
export const OUTER_GATES = [
  { id: 'yongding', name: '永定门', x: 0, z: OUTER_CITY.south, side: 's' },
  { id: 'zuoan', name: '左安门', x: u(2600), z: OUTER_CITY.south, side: 's' },
  { id: 'youan', name: '右安门', x: -u(2600), z: OUTER_CITY.south, side: 's' },
  { id: 'guangqu', name: '广渠门', x: OUTER_CITY.halfX, z: u(4200), side: 'e' },
  { id: 'dongbian', name: '东便门', x: OUTER_CITY.halfX, z: u(900), side: 'e' },
  { id: 'guangan', name: '广安门', x: -OUTER_CITY.halfX, z: u(4200), side: 'w' },
  { id: 'xibian', name: '西便门', x: -OUTER_CITY.halfX, z: u(900), side: 'w' },
];

/** 四郊坛庙：日坛（东）、月坛（西）、地坛（北）、先农坛（外城西）。 */
export const ALTARS = {
  ridan: { name: '日坛', x: u(3400), z: u(900), r: u(300) },
  yuetan: { name: '月坛', x: -u(3400), z: u(900), r: u(300) },
  ditan: { name: '地坛', x: u(1800), z: -u(3900), r: u(320) },
  xiannongtan: { name: '先农坛', x: -u(2900), z: u(4200), r: u(420) },
};

/** 玉河（通惠河故道）：从什刹海东南角引出，沿皇城东墙南下，出东便门。 */
export const YUHE = {
  width: u(55),
  points: [
    [-u(900), -u(3600)],
    [-u(200), -u(2600)],
    [u(600), -u(1400)],
    [u(1000), u(200)],
    [u(1500), u(1600)],
    [u(1900), u(3000)],
    [u(2800), u(3600)],
    [u(3400), u(3900)],
  ],
};

/* -------------------------------------------------------------------------- */
/*  五、现代北京（CBD / 奥体 / 大剧院）                                          */
/* -------------------------------------------------------------------------- */

/**
 * 现代北京的地标群：古都是纸上的重彩，现代建筑是纸上的一抹淡墨。
 * 位置按真实方位意译（1 单位 = 50m），具体形体由 world/modern.js 生成。
 */
export const MODERN = {
  /** 国贸 CBD：天安门以东约 5.5km，长安街延长线南侧 */
  cbd: {
    name: '国贸 CBD',
    x: u(5800),
    z: u(1600),
    towers: [
      { id: 'citic', name: '中国尊', dx: u(0), dz: u(0), w: u(82), d: u(82), h: h(528) },
      { id: 'guomao3', name: '国贸三期', dx: -u(560), dz: -u(180), w: u(70), d: u(62), h: h(330) },
      { id: 'cctv', name: '央视大楼', dx: u(720), dz: u(260), w: u(210), d: u(130), h: h(234) },
      { id: 'yintai', name: '银泰中心', dx: -u(880), dz: u(220), w: u(52), d: u(52), h: h(249) },
      { id: 'jingguang', name: '京广中心', dx: -u(760), dz: -u(700), w: u(46), d: u(46), h: h(208) },
      { id: 'soho', name: '建外 SOHO', dx: u(300), dz: -u(460), w: u(160), d: u(120), h: h(90) },
    ],
  },
  /** 奥林匹克公园：中轴北延约 9km */
  nest: { name: '鸟巢', x: -u(500), z: -u(9000), w: u(330), d: u(280), h: h(68) },
  waterCube: { name: '水立方', x: u(650), z: -u(9100), w: u(177), d: u(177), h: h(31) },
  /** 奥林匹克塔：奥体公园南侧，五环塔座 + 高塔 */
  olympicTower: { name: '奥林匹克塔', x: u(0), z: -u(7800), w: u(60), d: u(60), h: h(246) },
  /** 国家大剧院：天安门以西、人民大会堂西侧的水中穹顶 */
  ncpac: { name: '国家大剧院', x: -u(1200), z: u(1050), w: u(210), d: u(210), h: h(46) },
};

/** 地标锚点：给 2D 印章标签用（位置 + 相机停靠参数）。 */
export const LANDMARKS = [
  {
    id: 'palace',
    name: '紫禁城',
    en: 'THE FORBIDDEN CITY',
    seal: '禁',
    anchor: [0, h(26), 0],
    target: [0, h(10), 0],
    dist: 78,
    azimuth: 0.38,
    elevation: 0.62,
    text: '九重宫阙，龙脊承天。太和殿重檐庑殿，金瓦压着三百年的晴空；一砖一瓦，都是把整座天下收进一个院子的野心。',
  },
  {
    id: 'jingshan',
    name: '景山',
    en: 'JINGSHAN PARK',
    seal: '景',
    anchor: [0, h(45) + u(700), -u(650)],
    target: [0, h(20), -u(650)],
    dist: 46,
    azimuth: 0.1,
    elevation: 0.5,
    text: '煤山一峰，万春亭上望中轴。故宫的屋顶一层层铺开，像墨在纸上洇成的一整片金。',
  },
  {
    id: 'beihai',
    name: '北海',
    en: 'BEIHAI PARK',
    seal: '海',
    anchor: [-u(1550), h(36), -u(900)],
    target: [-u(1450), h(18), -u(900)],
    dist: 60,
    azimuth: -0.7,
    elevation: 0.45,
    text: '琼华岛上一座白塔，一池三山。太液秋风起时，湖面是整张纸最淡的那一笔。',
  },
  {
    id: 'drum',
    name: '钟鼓楼',
    en: 'DRUM & BELL TOWERS',
    seal: '鼓',
    anchor: [0, h(48), -u(2900)],
    target: [0, h(22), -u(2900)],
    dist: 42,
    azimuth: 0.2,
    elevation: 0.4,
    text: '晨钟暮鼓，胡同深处。鸽哨掠过灰瓦，把一整座城的清晨拉得很长。',
  },
  {
    id: 'tiantan',
    name: '天坛',
    en: 'TEMPLE OF HEAVEN',
    seal: '坛',
    anchor: [u(1700), h(38), u(3550)],
    target: [u(1700), h(16), u(3550)],
    dist: 66,
    azimuth: 0.6,
    elevation: 0.42,
    text: '祈年殿三重青瓦，圜丘坛上，天人相接。一片柏树林里，只留一条通往天的线。',
  },
  {
    id: 'summer',
    name: '颐和园',
    en: 'SUMMER PALACE',
    seal: '园',
    anchor: [-u(11500), terrainHeight(-u(11500), -u(10300)) + h(52), -u(10300)],
    target: [-u(11500), h(26), -u(10300)],
    dist: 78,
    azimuth: -0.5,
    elevation: 0.38,
    text: '昆明湖上十七孔，佛香阁浮于万寿山。借西山为屏，把一整片湖收进一个园子。',
  },
  {
    id: 'wall',
    name: '长城',
    en: 'THE GREAT WALL',
    seal: '塞',
    anchor: [u(2400), terrainHeight(u(2400), -u(22000)) + h(12), -u(22000)],
    target: [u(2400), 0, -u(22000)],
    dist: 90,
    azimuth: 0.15,
    elevation: 0.32,
    text: '燕山脊上，砖石如墨。烽燧一座接一座，把山脊写成一道不肯断的线。',
  },
  {
    id: 'cbd',
    name: '国贸 CBD',
    en: 'BEIJING CBD',
    seal: '都',
    anchor: [u(5800), h(560), u(1600)],
    target: [u(5800), h(220), u(1600)],
    dist: 78,
    azimuth: 0.55,
    elevation: 0.3,
    text: '中国尊起于国贸，央视的两个人字在空中握手。古都往东长出了另一座城，玻璃幕墙把夕阳切成很多块。',
  },
  {
    id: 'nest',
    name: '鸟巢',
    en: 'THE BIRD\'S NEST',
    seal: '奥',
    anchor: [-u(500), h(80), -u(9000)],
    target: [-u(500), h(20), -u(9000)],
    dist: 42,
    azimuth: 0.35,
    elevation: 0.36,
    text: '中轴北延，钢铁编成的巢。二〇〇八年的那场火，至今还在这座城的记忆里烧着。',
  },
  {
    id: 'olympic',
    name: '奥林匹克塔',
    en: 'OLYMPIC TOWER',
    seal: '塔',
    anchor: [u(0), h(270), -u(7800)],
    target: [u(0), h(40), -u(7800)],
    dist: 60,
    azimuth: 0.32,
    elevation: 0.4,
    text: '五环从塔顶散开，像一朵不会谢的花。中轴线从这里继续往北，把鸟巢、水立方和整片奥体公园串在一条线上。',
  },
  {
    id: 'ncpac',
    name: '国家大剧院',
    en: 'NCPA',
    seal: '海',
    anchor: [-u(1200), h(52), u(1050)],
    target: [-u(1200), h(12), u(1050)],
    dist: 22,
    azimuth: 0.7,
    elevation: 0.4,
    text: '长安街南，一颗浮在水上的银蛋。水面一响，整座城的夜色都有了回声。',
  },
  {
    id: 'yuanmingyuan',
    name: '圆明园',
    en: 'OLD SUMMER PALACE',
    seal: '园',
    anchor: [-u(8800), h(26), -u(7600)],
    target: [-u(8800), h(6), -u(7600)],
    dist: 60,
    azimuth: 0.5,
    elevation: 0.42,
    text: '福海还在，瑶台三岛还在。西洋楼的几根断柱立在草里，风一过，纸上的废墟比完整的宫殿更响。',
  },
  {
    id: 'yuquan',
    name: '玉泉山',
    en: 'JADE SPRING HILL',
    seal: '泉',
    anchor: [-u(14500), terrainHeight(-u(14500), -u(11000)) + h(70), -u(11000)],
    target: [-u(14500), terrainHeight(-u(14500), -u(11000)) + h(20), -u(11000)],
    dist: 72,
    azimuth: 0.55,
    elevation: 0.36,
    text: '玉峰塔瘦瘦地立在西山脚。泉眼在山下，塔影落在湖里，是京西最好看的一条竖线。',
  },
  {
    id: 'xiangshan',
    name: '香山',
    en: 'FRAGRANT HILLS',
    seal: '香',
    anchor: [-u(20000), terrainHeight(-u(20000), -u(13000)) + h(80), -u(13000)],
    target: [-u(20000), terrainHeight(-u(20000), -u(13000)) + h(25), -u(13000)],
    dist: 95,
    azimuth: 0.5,
    elevation: 0.34,
    text: '霜降之后，香山的叶子先红。琉璃塔站在山肩上，看着一整条西山慢慢变淡。',
  },
  {
    id: 'lugou',
    name: '卢沟桥',
    en: 'LUGOUT BRIDGE',
    seal: '桥',
    anchor: [-u(8600), terrainHeight(-u(8600), u(4800)) + h(14), u(4800)],
    target: [-u(8600), h(6), u(4800)],
    dist: 42,
    azimuth: 0.55,
    elevation: 0.34,
    text: '永定河上，石狮五百。晓月还没落，桥上的露水先亮了。',
  },
  {
    id: 'hutong',
    name: '胡同',
    en: 'HUTONGS',
    seal: '巷',
    anchor: [u(1900), h(8), u(2600)],
    target: [u(1500), h(4), u(2300)],
    dist: 40,
    azimuth: 0.6,
    elevation: 0.5,
    text: '灰瓦连片，槐树当街。一条巷子走到底，就是一座城的日常。',
  },
];

export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((l) => [l.id, l]));

/** 开场标题与文案。 */
export const COPY = {
  title: '水墨北京',
  subtitle: '一纸山河 · 九门烟树',
  intro: '燕山如黛，宫阙生烟',
  introSub: '拖动旋转 · 滚轮远近 · 点击朱印读一座城',
  start: '起卷',
  hint: '拖动旋转 · 滚轮远近 · 点击朱印',
  center: '地图中心',
  dawn: '晨光',
  dusk: '暮色',
  ink: '墨色',
};

/** 首发机位：从东南上空斜望中轴——宫城、景山、北海、钟鼓楼一屏收下。 */
export const HOME_VIEW = {
  target: [-u(300), h(2), u(100)],
  azimuth: 0.42,
  elevation: 0.38,
  dist: 128,
};

/** From the north of Jingshan, looking south along the palace axis. */
export const SCENIC_VIEW = {
  target: [u(60), h(5), u(180)],
  azimuth: 3.42,
  elevation: 0.25,
  dist: 58,
};
export const COUNTRYSIDE_VIEW = {
  target: [-u(4800), 0, u(3800)],
  azimuth: 0.62,
  elevation: 0.57,
  dist: 190,
};
