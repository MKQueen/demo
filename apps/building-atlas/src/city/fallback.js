/**
 * city/fallback.js —— 程序化街区 fallback
 *
 * 当 public/data/site 的 OSM 产物缺失 / 加载失败时（例如首屏离线、数据尚未生成），
 * 用 9 个低模街区 + 环形路 + 简化绿地和地标 POI 构造一份与真实数据结构完全一致的
 * 语境数据，保证 city.js 的所有能力（图层 / 夜态 / 小地图 / 标签 / 地块高亮）都可工作。
 *
 * 所有坐标均为局部米（+X 东 / +Z 南），原点 = 富华大厦地块中心。
 * 仅供语境示意，非地理配准数据。
 */

const SITE_HALF_X = 64;
const SITE_HALF_Z = 65;

const TOWER_BOXES = [
  { id: 'A', x: -27, z: -28, w: 23, d: 25 },
  { id: 'B', x: -27, z: 0, w: 19, d: 31 },
  { id: 'C', x: -27, z: 28, w: 23, d: 25 },
  { id: 'D', x: 27, z: 28, w: 23, d: 25 },
  { id: 'E', x: 27, z: 0, w: 19, d: 31 },
  { id: 'F', x: 27, z: -28, w: 23, d: 25 },
];

/** 9 个街区体块：{x,z,w,d,h} 主楼 + 顶部小体量（屋顶机房/塔冠） */
function blockMasses() {
  const blocks = [
    { x: -260, z: -190, w: 110, d: 70, h: 26 },
    { x: -260, z: -32, w: 96, d: 78, h: 38 },
    { x: -260, z: 182, w: 118, d: 68, h: 21 },
    { x: 205, z: -190, w: 104, d: 70, h: 31 },
    { x: 205, z: -4, w: 90, d: 76, h: 44 },
    { x: 205, z: 168, w: 110, d: 70, h: 23 },
    { x: -52, z: -250, w: 140, d: 60, h: 35 },
    { x: 132, z: -254, w: 80, d: 52, h: 18 },
    { x: 6, z: 252, w: 176, d: 70, h: 27 },
  ];
  const masses = [];
  blocks.forEach((b, index) => {
    masses.push(b);
    const capW = b.w * (0.42 + ((index * 7) % 5) * 0.03);
    const capD = b.d * (0.4 + ((index * 11) % 4) * 0.03);
    masses.push({
      x: b.x + b.w * 0.06,
      z: b.z - b.d * 0.05,
      w: capW,
      d: capD,
      h: b.h + 7 + ((index * 13) % 17),
      baseY: b.h,
    });
  });
  return masses;
}

function rectRing(cx, cz, w, d) {
  const hx = w / 2;
  const hz = d / 2;
  return [
    [cx - hx, cz - hz], [cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz],
  ];
}

/** 圆角矩形环线（Ring road）：直边 + 四角圆弧 */
function roundedRectLoop(halfX, halfZ, corner = 46, segmentsPerCorner = 5) {
  const pts = [];
  const arc = (cx, cz, startDeg, endDeg) => {
    for (let i = 0; i <= segmentsPerCorner; i += 1) {
      const a = ((startDeg + ((endDeg - startDeg) * i) / segmentsPerCorner) * Math.PI) / 180;
      pts.push([cx + Math.cos(a) * corner, cz + Math.sin(a) * corner]);
    }
  };
  // 从北侧（-z）右端出发顺时针一圈
  pts.push([halfX - corner, -halfZ]);
  pts.push([halfX, -halfZ + corner]);
  arc(halfX - corner, halfZ - corner, 0, 90);
  pts.push([halfX - corner, halfZ]);
  pts.push([-halfX + corner, halfZ]);
  arc(-halfX + corner, halfZ - corner, 90, 180);
  pts.push([-halfX, halfZ - corner]);
  pts.push([-halfX, -halfZ + corner]);
  arc(-halfX + corner, -halfZ + corner, 180, 270);
  pts.push([-halfX + corner, -halfZ]);
  arc(halfX - corner, -halfZ + corner, 270, 360);
  return pts;
}

function makeRoad(id, name, cls, points, width) {
  const tier = /motorway|trunk|primary/.test(cls) ? 0 : /secondary|tertiary/.test(cls) ? 1 : /pedestrian|footway/.test(cls) ? 3 : 2;
  return { id, name, class: cls, tier, width, points, oneway: false, bridge: false, tunnel: false, ref: '' };
}

function buildRoads() {
  const roads = [];
  const line = (x1, z1, x2, z2) => [[x1, z1], [x2, z2]];
  // 外围干路（名字用于小地图/可读性）
  roads.push(makeRoad('fb-2ring', '东二环', 'motorway', line(-520, -1200, -520, 1200), 26));
  roads.push(makeRoad('fb-dzj', '东中街', 'secondary', line(520, -1200, 520, 1200), 12.5));
  roads.push(makeRoad('fb-dss', '东四十条', 'secondary', line(-1200, -380, 1200, -380), 12.5));
  roads.push(makeRoad('fb-dzmn', '东直门内大街', 'primary', line(-1200, -1000, 1200, -1000), 17));
  roads.push(makeRoad('fb-cymn', '朝阳门内大街', 'primary', line(-1200, 1000, 1200, 1000), 17));
  // 环形路（fallback 的「环形路」要求）
  roads.push(makeRoad('fb-ring', '环行路', 'primary', roundedRectLoop(340, 340), 14));
  // 连接线
  roads.push(makeRoad('fb-link-n', '', 'tertiary', line(0, -340, 0, -1000), 10));
  roads.push(makeRoad('fb-link-s', '', 'tertiary', line(0, 340, 0, 1000), 10));
  roads.push(makeRoad('fb-link-w', '', 'tertiary', line(-340, 0, -520, 0), 10));
  roads.push(makeRoad('fb-link-e', '', 'tertiary', line(340, 0, 520, 0), 10));
  // 街区内部的支路
  for (const z of [-120, 90]) {
    roads.push(makeRoad(`fb-local-h${z}`, '', 'residential', line(-340, z, 340, z), 6.5));
  }
  for (const x of [-140, 100]) {
    roads.push(makeRoad(`fb-local-v${x}`, '', 'residential', line(x, -340, x, 340), 6.5));
  }
  // 步行连廊（示意，靠近地块）
  roads.push(makeRoad('fb-walk-n', '', 'pedestrian', line(-64, -68, 64, -68), 3.2));
  roads.push(makeRoad('fb-walk-s', '', 'pedestrian', line(-64, 68, 64, 68), 3.2));
  return roads;
}

function buildLanduse() {
  const list = [];
  const push = (id, kind, name, rings) => list.push({ id, kind, name, class: kind, rings, area: Math.abs(rings[0].reduce((s, p, i) => {
    const q = rings[0][(i + 1) % rings[0].length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2 });
  // 西北公园 + 水面
  push('fb-park-nw', 'green', '街心公园（示意）', [[[-760, -720], [-540, -720], [-540, -430], [-760, -430]]]);
  push('fb-water-nw', 'water', '', [[[-720, -660], [-620, -660], [-600, -520], [-700, -500]]]);
  // 地块周边广场
  push('fb-plaza-w', 'built', '', [[[-120, -90], [-70, -90], [-70, 90], [-120, 90]]]);
  push('fb-plaza-e', 'built', '', [[[70, -90], [120, -90], [120, 90], [70, 90]]]);
  push('fb-plaza-n', 'built', '', [[[-64, -120], [64, -120], [64, -70], [-64, -70]]]);
  push('fb-plaza-s', 'built', '', [[[-64, 70], [64, 70], [64, 120], [-64, 120]]]);
  // 东二环沿线绿化带
  push('fb-green-ring', 'green', '', [[[-600, -340], [-540, -340], [-540, 340], [-600, 340]]]);
  // 9 个街区的地块底色（比白模略暗，避免空白）
  blockMasses().filter((m) => m.baseY === undefined).forEach((b, i) => {
    push(`fb-block-${i}`, 'built', '', [rectRing(b.x, b.z, b.w + 18, b.d + 18)]);
  });
  return list;
}

function buildSite() {
  const site = [{
    id: 'fb-site',
    kind: 'site',
    name: '富华大厦',
    rings: [rectRing(0, 0, SITE_HALF_X * 2, SITE_HALF_Z * 2)],
  }];
  for (const t of TOWER_BOXES) {
    site.push({
      id: `fb-tower-${t.id}`,
      kind: 'tower',
      name: `${t.id} 座`,
      rings: [rectRing(t.x, t.z, t.w, t.d)],
    });
  }
  site.push({
    id: 'fb-courtyard',
    kind: 'courtyard',
    name: '中央庭院',
    rings: [rectRing(0, 0, 32, 73)],
  });
  return site;
}

function buildPoi() {
  const raw = [
    { id: 'fb-metro-dss', name: '东四十条地铁站', kind: 'metro', x: -545, z: -405, weight: 5, note: '2 号线 · 示意位置' },
    { id: 'fb-metro-dzm', name: '东直门站', kind: 'metro', x: -545, z: -1030, weight: 5, note: '2 / 13 / 机场线' },
    { id: 'fb-metro-cym', name: '朝阳门站', kind: 'metro', x: -545, z: 1030, weight: 5, note: '2 / 6 号线' },
    { id: 'fb-poly', name: '保利大厦', kind: 'landmark', x: 400, z: -790, weight: 5, note: '东直门南大街' },
    { id: 'fb-poly-theatre', name: '保利剧院', kind: 'culture', x: 455, z: -845, weight: 4 },
    { id: 'fb-hk-macau', name: '港澳中心', kind: 'hotel', x: 760, z: -575, weight: 4 },
    { id: 'fb-shouchuang', name: '首创大厦', kind: 'office', x: -250, z: -640, weight: 4 },
    { id: 'fb-asia-hotel', name: '亚洲大酒店', kind: 'hotel', x: 360, z: 285, weight: 3 },
    { id: 'fb-donghuan', name: '东环广场', kind: 'office', x: 715, z: 390, weight: 3 },
    { id: 'fb-gongti', name: '工人体育馆', kind: 'stadium', x: 250, z: -1120, weight: 4 },
    { id: 'fb-guijie', name: '簋街', kind: 'culture', x: 830, z: -960, weight: 4 },
    { id: 'fb-joy-city', name: '悠唐购物中心', kind: 'office', x: 985, z: 245, weight: 3 },
    { id: 'fb-sunshine', name: '阳光国际大厦', kind: 'office', x: -635, z: 485, weight: 3 },
    { id: 'fb-xinzhong', name: '新中大厦', kind: 'office', x: 630, z: 680, weight: 2 },
    { id: 'fb-comedy', name: '北京喜剧院', kind: 'culture', x: -90, z: 545, weight: 3 },
    { id: 'fb-yifu', name: '颐堤港方向', kind: 'office', x: 1090, z: -180, weight: 2 },
  ];
  return raw.map((p) => ({
    ...p,
    lon: null,
    lat: null,
    distanceM: Math.hypot(p.x, p.z),
    source: 'fallback',
  }));
}

/** 供 city.js 在「GLB 白模加载失败但其它真数据可用」时兜底体块 */
export function buildFallbackMasses() {
  return blockMasses();
}

/**
 * 构建程序化 fallback 数据（结构与 loadSiteContext() 的返回值一致）。
 * @returns {object} 归一化语境数据 + blocks（供几何构建使用）
 */
export function buildProceduralContext() {
  const roads = buildRoads();
  const landuse = buildLanduse();
  const poi = buildPoi();
  const site = buildSite();
  const masses = blockMasses();
  const meta = {
    name: '东四十条 · 街区语境（程序化 fallback）',
    generatedAt: null,
    source: 'procedural fallback',
    attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    license: 'ODbL 1.0',
    origin: { lon: 116.429613, lat: 39.929566, label: '富华大厦' },
    bbox: [116.41, 39.918, 116.45, 39.942],
    radiusM: 1200,
    localExtent: { minX: -1250, maxX: 1250, minZ: -1250, maxZ: 1250 },
    layers: {
      whiteModels: { path: null, count: 9, triangles: 0, fallback: true },
      roads: { path: null, count: roads.length },
      landuse: { path: null, count: landuse.length },
      poi: { path: null, count: poi.length },
      siteFootprint: { path: null },
    },
    stats: {
      buildings: 9,
      roads: roads.length,
      landuse: landuse.length,
      poi: poi.length,
      fallback: true,
    },
    heightModel: { levelHeight: 3.2, groundExtra: 1.2, note: 'fallback 示意体量' },
    fallback: true,
    note: 'OSM 街区数据未就绪时的程序化示意，非地理配准数据。',
  };
  return {
    fallback: true,
    meta,
    projector: null,
    roads,
    landuse,
    poi,
    site,
    warnings: ['使用程序化街区 fallback（public/data/site 数据缺失或加载失败）'],
    buildingModelUrl: null,
    stats: meta.stats,
    masses,
  };
}
