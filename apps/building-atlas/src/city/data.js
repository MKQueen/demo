/**
 * city/data.js —— 街区语境数据：加载 / 解析 / 经纬度 → 局部米坐标归一化
 *
 * 仅做纯数据工作（不发散 THREE 对象），供 src/city.js 使用。
 * 数据契约见 docs/upgrade-contract.md §2；本文件对缺失字段尽量宽容，
 * 解析失败会抛出带说明的 Error，由 city.js 决定降级策略。
 */

const DEG = Math.PI / 180;

/** 经纬度 → 局部米：x=(lon-lon0)*111320*cos(lat0)，z=-(lat-lat0)*110540（契约 §1） */
export function createProjector(origin = {}) {
  const lon0 = Number(origin.lon);
  const lat0 = Number(origin.lat);
  if (!Number.isFinite(lon0) || !Number.isFinite(lat0)) {
    throw new Error('meta.origin 缺少有效 lon/lat');
  }
  const kx = 111320 * Math.cos(lat0 * DEG);
  const kz = 110540;
  return {
    origin: { ...origin, lon: lon0, lat: lat0 },
    project(lon, lat) {
      return [(lon - lon0) * kx, -(lat - lat0) * kz];
    },
  };
}

/** 把 meta.layers.*.path 解析成可直接 fetch 的 URL（契约：路径为站点根相对 path） */
export function resolveAssetUrl(path, baseUrl = './') {
  if (!path || typeof path !== 'string') return null;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  if (path.startsWith('/')) return path;
  const clean = path.replace(/^\.\//, '');
  if (clean.startsWith('data/site/')) return `${baseUrl}${clean}`;
  return `${baseUrl}data/site/${clean}`;
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`);
    const text = await res.text();
    const first = text.trimStart().charAt(0);
    if (first !== '{' && first !== '[') throw new Error(`响应不是 JSON · ${url}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function toFeatureArray(geojson) {
  if (!geojson) return [];
  if (Array.isArray(geojson)) return geojson;
  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) return geojson.features;
  if (geojson.type === 'Feature') return [geojson];
  if (geojson.features) return geojson.features;
  return [];
}

function geometryOf(feature) {
  return feature && (feature.geometry || feature);
}

function toLocalLine(coords, project) {
  if (!Array.isArray(coords)) return null;
  const out = [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const [x, z] = project(lon, lat);
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[0] - x) < 0.05 && Math.abs(prev[1] - z) < 0.05) continue;
    out.push([x, z]);
  }
  return out.length >= 2 ? out : null;
}

function toLocalPolygon(rings, project) {
  if (!Array.isArray(rings) || !rings.length) return null;
  const out = [];
  for (const ring of rings) {
    if (!Array.isArray(ring)) return null;
    const pts = [];
    for (const c of ring) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const [x, z] = project(lon, lat);
      const prev = pts[pts.length - 1];
      if (prev && Math.abs(prev[0] - x) < 0.05 && Math.abs(prev[1] - z) < 0.05) continue;
      pts.push([x, z]);
    }
    // 去掉 GeoJSON 闭合重复点（渲染时按闭合环处理）
    if (pts.length > 1) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) pts.pop();
    }
    if (pts.length >= 3) out.push(pts);
  }
  return out.length ? out : null;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % n];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

/* ------------------------------- 路网 -------------------------------- */

export const ROAD_TIERS = [
  {
    key: 'arterial',
    label: '干路',
    classes: new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']),
  },
  {
    key: 'secondary',
    label: '次干路',
    classes: new Set(['secondary', 'secondary_link', 'tertiary', 'tertiary_link']),
  },
  {
    key: 'local',
    label: '支路',
    classes: new Set(['residential', 'unclassified', 'living_street', 'road', 'service', 'track']),
  },
  {
    key: 'walk',
    label: '步行',
    classes: new Set(['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'bridleway', 'corridor']),
  },
];

/** 道路绘制宽度（米），按 OSM class 粗分；_link 收窄 */
export function roadWidthForClass(cls = '') {
  const c = String(cls).toLowerCase();
  const link = c.includes('_link');
  switch (c.replace(/_link$/, '')) {
    case 'motorway': return link ? 8 : 26;
    case 'trunk': return link ? 7.5 : 21;
    case 'primary': return link ? 7 : 17;
    case 'secondary': return link ? 6 : 12.5;
    case 'tertiary': return link ? 5.5 : 10;
    case 'residential': return 6.5;
    case 'unclassified': return 6;
    case 'living_street': return 5;
    case 'service': return 3.4;
    case 'track': return 2.6;
    case 'pedestrian': return 3.2;
    case 'footway': return 2;
    case 'path': return 1.7;
    case 'steps': return 1.6;
    case 'cycleway': return 2;
    case 'bridleway': return 1.6;
    case 'corridor': return 2;
    default: return 5;
  }
}

export function roadTierIndex(cls = '') {
  const c = String(cls).toLowerCase();
  for (let i = 0; i < ROAD_TIERS.length; i += 1) {
    if (ROAD_TIERS[i].classes.has(c)) return i;
  }
  return 2;
}

function normalizeRoads(geojson, project) {
  const out = [];
  const features = toFeatureArray(geojson);
  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const props = f.properties || f;
    const geometry = geometryOf(f);
    if (!geometry) continue;
    let lines = null;
    if (geometry.type === 'LineString') lines = [geometry.coordinates];
    else if (geometry.type === 'MultiLineString') lines = geometry.coordinates;
    else if (geometry.type === 'Polygon') lines = [geometry.coordinates[0]];
    else if (Array.isArray(geometry.coordinates) && geometry.type === undefined) lines = [geometry.coordinates];
    if (!lines) continue;
    const cls = String(props.class || props.highway || 'unclassified').toLowerCase();
    const name = props.name || props.ref || '';
    for (const line of lines) {
      const points = toLocalLine(line, project);
      if (!points) continue;
      out.push({
        id: String(props.id || f.id || `road-${out.length}`),
        class: cls,
        name: String(name || ''),
        ref: props.ref ? String(props.ref) : '',
        tier: roadTierIndex(cls),
        width: roadWidthForClass(cls),
        oneway: Boolean(props.oneway),
        bridge: Boolean(props.bridge),
        tunnel: Boolean(props.tunnel),
        points,
      });
    }
  }
  return out;
}

/* ------------------------------ 绿地/水系 ------------------------------ */

function landuseKindOf(props = {}) {
  const raw = [
    props.kind, props.landuse, props.leisure, props.natural, props.waterway,
    props.amenity, props.class, props.type,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/water|river|canal|basin|reservoir|pond|lake|stream|ditch|moat|fountain/.test(raw)) return 'water';
  if (/park|forest|garden|grass|meadow|green|sport|pitch|wood|tree|cemetery|recreation|playground|farmland/.test(raw)) return 'green';
  return 'built';
}

function normalizeLanduse(geojson, project) {
  const out = [];
  const features = toFeatureArray(geojson);
  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const props = f.properties || f;
    const geometry = geometryOf(f);
    if (!geometry) continue;
    let polygons = null;
    if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
    else if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
    if (!polygons) continue;
    const kind = landuseKindOf(props);
    for (const polygon of polygons) {
      const rings = toLocalPolygon(polygon, project);
      if (!rings) continue;
      const area = ringArea(rings[0]);
      const minArea = kind === 'built' ? 30 : 10;
      if (area < minArea) continue;
      out.push({
        id: String(props.id || f.id || `lu-${out.length}`),
        kind,
        area,
        class: String(props.class || props.landuse || props.leisure || props.natural || ''),
        name: props.name ? String(props.name) : '',
        rings,
      });
    }
  }
  return out;
}

/* ----------------------------- 地块足迹 ------------------------------- */

function normalizeSite(geojson, project) {
  const out = [];
  const features = toFeatureArray(geojson);
  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const props = f.properties || f;
    const geometry = geometryOf(f);
    if (!geometry) continue;
    let polygons = null;
    if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
    else if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
    if (!polygons) continue;
    const rawKind = String(props.kind || f.kind || props.type || 'site').toLowerCase();
    const kind = /tower|building|podium/.test(rawKind) ? 'tower'
      : /court|yard|patio/.test(rawKind) ? 'courtyard'
        : 'site';
    for (const polygon of polygons) {
      const rings = toLocalPolygon(polygon, project);
      if (!rings) continue;
      out.push({
        id: String(props.id || f.id || `site-${out.length}`),
        kind,
        name: props.name ? String(props.name) : '',
        rings,
      });
    }
  }
  return out;
}

/* -------------------------------- POI -------------------------------- */

const POI_DEFAULT_WEIGHT = {
  metro: 5, landmark: 5, culture: 4, hotel: 4, stadium: 4,
  office: 3, park: 3, education: 3, government: 3,
};

function normalizePoi(raw, project) {
  const list = Array.isArray(raw) ? raw
    : Array.isArray(raw && raw.pois) ? raw.pois
      : toFeatureArray(raw).map((f) => ({ ...(f.properties || {}), lon: (geometryOf(f).coordinates || [])[0], lat: (geometryOf(f).coordinates || [])[1] }));
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || p.title || '').trim();
    if (!name) continue;
    let lon = Number(p.lon);
    let lat = Number(p.lat);
    let x = Number(p.x);
    let z = Number(p.z);
    const hasLocal = Number.isFinite(x) && Number.isFinite(z);
    if (!hasLocal) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      [x, z] = project(lon, lat);
    } else {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        // 反向换算，仅用于展示/调试（数据通常已含 lon/lat）
        lon = project.origin.lon + x / (111320 * Math.cos(project.origin.lat * DEG));
        lat = project.origin.lat - z / 110540;
      }
    }
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const kind = String(p.kind || p.type || 'landmark').toLowerCase();
    const weightRaw = Number(p.weight);
    const weight = Number.isFinite(weightRaw) ? Math.max(1, Math.min(5, weightRaw)) : (POI_DEFAULT_WEIGHT[kind] || 2);
    const distanceM = Math.hypot(x, z);
    const poi = {
      id: String(p.id || `poi-${i}`),
      name,
      kind,
      lon,
      lat,
      x,
      z,
      distanceM,
      weight,
      note: p.note ? String(p.note) : '',
      source: p.source ? String(p.source) : '',
    };
    if (Array.isArray(p.footprintBBox) && p.footprintBBox.length === 4) {
      poi.footprintBBox = p.footprintBBox.map(Number);
    }
    out.push(poi);
  }
  return out;
}

/* ----------------------------- 主加载入口 ----------------------------- */

/**
 * 加载 public/data/site 下的全部街区数据。
 * meta 失败时直接抛错（由 city.js 走 fallback）；其它图层失败只记录 warning 并用空数组兜底。
 * @returns {Promise<{meta, roads, landuse, poi, site, warnings, buildingModelUrl, stats}>}
 */
export async function loadSiteContext({ baseUrl = './', onProgress = null } = {}) {
  const root = `${baseUrl}data/site/`;
  const report = (percent, text, phase = 'city') => {
    if (typeof onProgress === 'function') {
      try { onProgress({ text, percent, phase }); } catch { /* 回调异常不影响加载 */ }
    }
  };

  report(0.04, '读取街区语境索引…', 'meta');
  const meta = await fetchJson(`${root}meta.json`);
  const projector = createProjector(meta.origin);
  const project = projector.project;

  const layers = meta.layers || {};
  const layerUrl = (key, fallbackFile) => resolveAssetUrl(
    (layers[key] && layers[key].path) || `data/site/${fallbackFile}`,
    baseUrl,
  );
  const buildingModelUrl = layerUrl('whiteModels', 'white-models.glb');

  report(0.1, '载入街区数据…', 'data');
  const warnings = [];
  const loadLayer = async (key, file, normalizer) => {
    const url = layerUrl(key, file);
    if (!url) return [];
    try {
      const json = await fetchJson(url);
      const data = normalizer(json, project);
      report(
        0.1 + Math.min(0.35, 0.35 * ((Object.keys(layers).indexOf(key) + 1) / Object.keys(layers).length || 1)),
        `载入 ${key}…`,
        key,
      );
      return data;
    } catch (error) {
      warnings.push(`${key} 加载失败（${error && error.message ? error.message : error}）`);
      return [];
    }
  };

  const [roads, landuse, poi, site] = await Promise.all([
    loadLayer('roads', 'roads.geojson', normalizeRoads),
    loadLayer('landuse', 'landuse.geojson', normalizeLanduse),
    loadLayer('poi', 'poi.json', normalizePoi),
    loadLayer('siteFootprint', 'site-footprint.geojson', normalizeSite),
  ]);

  report(0.5, '街区数据就绪', 'data');

  const stats = { ...(meta.stats || {}) };
  if (!stats.roads) stats.roads = roads.length;
  if (!stats.landuse) stats.landuse = landuse.length;
  if (!stats.poi) stats.poi = poi.length;
  if (!stats.buildings && layers.whiteModels && layers.whiteModels.count) stats.buildings = layers.whiteModels.count;

  return {
    meta,
    projector,
    roads,
    landuse,
    poi,
    site,
    warnings,
    buildingModelUrl,
    stats,
  };
}

/** 由 meta + 归一化数据构建 byName 索引（契约 city.data.byName） */
export function buildNameIndex({ roads = [], landuse = [], poi = [] } = {}) {
  const byName = new Map();
  const put = (name, type, item) => {
    if (!name) return;
    const key = String(name).trim();
    if (!key) return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push({ type, item });
  };
  for (const road of roads) put(road.name, 'road', road);
  for (const area of landuse) put(area.name, 'landuse', area);
  for (const p of poi) put(p.name, 'poi', p);
  return byName;
}
