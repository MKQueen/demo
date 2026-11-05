/**
 * city/minimap.js —— 纯 SVG 街区小地图（契约 §3 minimapSvg）
 *
 * 输出可直接 innerHTML 注入 `.context-map` 的 SVG 字符串：
 *  - 道路按 4 档 class 分色；绿地 / 水系 / 地块底色；地块金色填充+描边；
 *  - 地铁站 + 主要 POI 圆点，POI 元素带 data-poi-id / class="mm-poi"
 *    （主工程用事件委托做点击 → 飞行）；
 *  - 外圈 + N 指北 + 中心点 + 比例尺 + © OSM。
 */

const TIER_CLASS = ['arterial', 'secondary', 'local', 'walk'];

export const MAP_PALETTES = {
  day: {
    landuseBuilt: '#1c2b35',
    landuseGreen: '#2c4034',
    landuseWater: '#1b3643',
    roads: ['#aebcc6', '#8b9ca8', '#6b7c88', '#576873'],
    walkDash: '2 2',
    siteFill: 'rgba(199,181,143,0.22)',
    siteStroke: '#f4b35b',
    towerFill: 'rgba(232,200,148,0.4)',
    towerStroke: 'rgba(244,179,91,0.55)',
    boundary: 'rgba(113,138,156,0.32)',
    ringDashed: 'rgba(199,181,143,0.24)',
    poiText: '#c9d5dd',
    poiTextDim: '#8fa1ac',
    poiDot: '#d8e2e8',
    metro: '#f4b35b',
    metroRing: '#0f1c25',
    center: '#f4b35b',
    north: '#c7b58f',
    attribution: 'rgba(143,161,172,0.6)',
  },
  dusk: {
    landuseBuilt: '#1d2a31',
    landuseGreen: '#2c3d33',
    landuseWater: '#1c333d',
    roads: ['#b5a07c', '#92815f', '#6f6453', '#5b5347'],
    walkDash: '2 2',
    siteFill: 'rgba(222,184,126,0.26)',
    siteStroke: '#f4b35b',
    towerFill: 'rgba(238,196,132,0.44)',
    towerStroke: 'rgba(244,179,91,0.6)',
    boundary: 'rgba(120,140,152,0.3)',
    ringDashed: 'rgba(224,167,106,0.24)',
    poiText: '#d8cdb7',
    poiTextDim: '#9a8f7c',
    poiDot: '#e2d3b8',
    metro: '#f0b268',
    metroRing: '#121d24',
    center: '#f4b35b',
    north: '#e0a76a',
    attribution: 'rgba(150,142,124,0.6)',
  },
  night: {
    landuseBuilt: '#101b22',
    landuseGreen: '#1b2a25',
    landuseWater: '#122631',
    roads: ['#c3d3df', '#9db1bf', '#7c909d', '#647884'],
    walkDash: '2 3',
    siteFill: 'rgba(244,179,91,0.24)',
    siteStroke: '#f7c072',
    towerFill: 'rgba(244,179,91,0.34)',
    towerStroke: 'rgba(247,192,114,0.6)',
    boundary: 'rgba(108,132,150,0.36)',
    ringDashed: 'rgba(199,181,143,0.26)',
    poiText: '#dbe6ee',
    poiTextDim: '#93a7b5',
    poiDot: '#e6eef3',
    metro: '#f4b35b',
    metroRing: '#0a151d',
    center: '#f4b35b',
    north: '#f4b35b',
    attribution: 'rgba(130,150,164,0.65)',
  },
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function ringPath(ring, project, close = true) {
  const parts = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`);
  }
  if (close) parts.push('Z');
  return parts.join('');
}

function polygonPath(rings, project) {
  if (!Array.isArray(rings) || !rings.length) return '';
  return rings.map((ring) => ringPath(ring, project)).join('');
}

function polylinePath(points, project, tolerance) {
  const parts = [];
  let px = null;
  let py = null;
  for (const point of points) {
    const [x, y] = project(point[0], point[1]);
    if (parts.length && Math.abs(x - px) < tolerance && Math.abs(y - py) < tolerance) continue;
    parts.push(`${parts.length ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`);
    px = x;
    py = y;
  }
  return parts.length >= 2 ? parts.join('') : '';
}

function shortLabel(name, max = 10) {
  const text = String(name || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * 生成街区小地图 SVG 字符串。
 * @param {object} options
 * @param {number} [options.width=240]
 * @param {number} [options.height=240]
 * @param {number} [options.rangeM=1200] 覆盖半径（米）
 * @param {'day'|'dusk'|'night'} [options.mode='day']
 * @param {boolean} [options.highlight=false] 地块高亮
 * @param {boolean} [options.showPoi=true]
 * @param {object} options.data { roads, landuse, poi, site }
 * @param {object} options.layers 图层开关
 */
export function renderMinimapSvg({
  width = 240,
  height = 240,
  rangeM = 1200,
  mode = 'day',
  highlight = false,
  showPoi = true,
  data = {},
  layers = {},
  className = 'city-minimap-svg',
  ariaLabel = '东四十条街区示意小地图',
} = {}) {
  const w = Math.max(80, Number(width) || 240);
  const h = Math.max(80, Number(height) || 240);
  const range = Math.max(60, Number(rangeM) || 1200);
  const palette = MAP_PALETTES[mode] || MAP_PALETTES.day;
  const k = Math.min(w, h) / 240;
  const cx = w / 2;
  const cy = h / 2;
  const pad = 8 * k;
  const radius = Math.min(w, h) / 2 - pad;
  const scale = radius / range;
  const clipId = 'city-map-clip';

  const project = (x, z) => [cx + x * scale, cy + z * scale];
  const clipRadius = radius + 2 * k;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" width="${fmt(w)}" height="${fmt(h)}" class="${esc(className)}" role="img" aria-label="${esc(ariaLabel)}" font-family="'SFMono-Regular',Consolas,'Liberation Mono',monospace">`,
  );
  parts.push(`<defs><clipPath id="${clipId}"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(clipRadius)}"/></clipPath></defs>`);

  // 外圈底
  parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius)}" fill="none" stroke="${palette.boundary}" stroke-width="${fmt(1 * k)}"/>`);
  parts.push(`<g clip-path="url(#${clipId})">`);

  // 绿地 / 水系 / 地块底色
  if (layers.landuse !== false) {
    const buckets = { built: [], green: [], water: [] };
    for (const area of data.landuse || []) {
      if (!area || !area.rings) continue;
      const key = area.kind === 'water' ? 'water' : area.kind === 'green' ? 'green' : 'built';
      buckets[key].push(area.rings);
    }
    const bucketFill = { built: palette.landuseBuilt, green: palette.landuseGreen, water: palette.landuseWater };
    for (const key of ['built', 'green', 'water']) {
      if (!buckets[key].length) continue;
      const d = buckets[key].map((rings) => polygonPath(rings, project)).join('');
      if (!d) continue;
      parts.push(`<path class="mm-landuse mm-landuse-${key}" d="${d}" fill="${bucketFill[key]}" fill-rule="evenodd" stroke="none"/>`);
    }
  }

  // 地块填充
  if (layers.site !== false) {
    const sitePolys = (data.site || []).filter((f) => f.kind === 'site');
    const towerPolys = (data.site || []).filter((f) => f.kind === 'tower');
    if (sitePolys.length) {
      const d = sitePolys.map((f) => polygonPath(f.rings, project)).join('');
      parts.push(`<path class="mm-site" d="${d}" fill="${palette.siteFill}" fill-rule="evenodd" stroke="${palette.siteStroke}" stroke-width="${fmt((highlight ? 1.8 : 1.1) * k)}" stroke-opacity="${highlight ? 1 : 0.9}"/>`);
    }
    if (towerPolys.length) {
      const d = towerPolys.map((f) => polygonPath(f.rings, project)).join('');
      parts.push(`<path class="mm-tower" d="${d}" fill="${palette.towerFill}" fill-rule="evenodd" stroke="${palette.towerStroke}" stroke-width="${fmt(0.7 * k)}"/>`);
    }
  }

  // 虚线距离圈（500m / 1000m 参照环）
  parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(500 * scale)}" fill="none" stroke="${palette.ringDashed}" stroke-width="${fmt(0.7 * k)}" stroke-dasharray="${fmt(3 * k)} ${fmt(3 * k)}"/>`);
  if (range > 900) {
    parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(1000 * scale)}" fill="none" stroke="${palette.ringDashed}" stroke-width="${fmt(0.7 * k)}" stroke-dasharray="${fmt(2 * k)} ${fmt(4 * k)}" stroke-opacity="0.7"/>`);
  }

  // 路网（4 档）
  if (layers.roads !== false) {
    const byTier = [[], [], [], []];
    for (const road of data.roads || []) {
      const tier = Number.isInteger(road.tier) ? road.tier : 2;
      (byTier[tier] || byTier[2]).push(road);
    }
    const widths = [2.4, 1.7, 1.15, 0.7];
    for (let tier = 0; tier < 4; tier += 1) {
      if (!byTier[tier].length) continue;
      const tolerance = 1.3;
      const d = byTier[tier].map((road) => polylinePath(road.points, project, tolerance)).join('');
      if (!d) continue;
      const dash = tier === 3 ? ` stroke-dasharray="${palette.walkDash}"` : '';
      const op = tier === 3 ? '0.75' : '0.95';
      parts.push(`<path class="mm-road mm-road-${TIER_CLASS[tier]}" d="${d}" fill="none" stroke="${palette.roads[tier]}" stroke-width="${fmt(widths[tier] * k)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"${dash}/>`);
    }
  }

  // POI 圆点
  const poi = Array.isArray(data.poi) ? data.poi : [];
  const visiblePois = poi.filter((p) => p && Math.hypot(p.x, p.z) <= range * 1.05);
  const sorted = visiblePois.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0) || a.distanceM - b.distanceM);
  if (layers.poi !== false && showPoi) {
    const dotGroup = [];
    for (const p of sorted) {
      const [x, y] = project(p.x, p.z);
      const weight = Math.max(1, Math.min(5, Number(p.weight) || 2));
      const isMetro = p.kind === 'metro';
      const r = (isMetro ? 2.9 : 1.3 + weight * 0.34) * k;
      const id = esc(p.id);
      const kindClass = `mm-poi-${esc(p.kind || 'landmark')}`;
      if (isMetro) {
        dotGroup.push(
          `<g class="mm-poi mm-metro ${kindClass}" data-poi-id="${id}"><title>${esc(p.name)}</title>`
          + `<circle data-poi-id="${id}" cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${palette.metro}" stroke="${palette.metroRing}" stroke-width="${fmt(1.1 * k)}"/>`
          + `<circle data-poi-id="${id}" cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r * 0.36)}" fill="${palette.metroRing}"/></g>`,
        );
      } else {
        dotGroup.push(
          `<circle class="mm-poi ${kindClass}" data-poi-id="${id}" cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${palette.poiDot}" stroke="${palette.poiTextDim}" stroke-width="${fmt(0.5 * k)}"><title>${esc(p.name)}</title></circle>`,
        );
      }
    }
    parts.push(`<g class="mm-pois">${dotGroup.join('')}</g>`);
  }

  // 中心点（富华大厦）
  const centerR = 3.1 * k;
  parts.push(
    `<g class="mm-center">`
    + `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(centerR + 1.6 * k)}" fill="none" stroke="${palette.center}" stroke-width="${fmt(0.7 * k)}" stroke-opacity="0.6"/>`
    + `<path d="M${fmt(cx)} ${fmt(cy - centerR)}L${fmt(cx + centerR)} ${fmt(cy)}L${fmt(cx)} ${fmt(cy + centerR)}L${fmt(cx - centerR)} ${fmt(cy)}Z" fill="${palette.center}"/>`
    + `<text x="${fmt(cx + centerR + 3 * k)}" y="${fmt(cy + 2.4 * k)}" font-size="${fmt(7 * k)}" fill="${palette.poiText}" paint-order="stroke" stroke="#0f1c25" stroke-width="${fmt(2 * k)}">富华大厦</text>`
    + `</g>`,
  );

  // POI 短标签（按 weight 取前 7 个，地铁优先）
  if (layers.poi !== false && showPoi) {
    const labeled = sorted.filter((p) => (p.weight || 0) >= 3).slice(0, 7);
    const labels = [];
    for (const p of labeled) {
      const [x, y] = project(p.x, p.z);
      const isMetro = p.kind === 'metro';
      const anchor = isMetro ? 'start' : (p.x >= 0 ? 'start' : 'end');
      const lx = anchor === 'end' ? x - 4 * k : x + 4 * k;
      const ly = y - 2.6 * k;
      const fill = isMetro ? palette.metro : palette.poiTextDim;
      labels.push(`<text class="mm-poi-label" data-poi-id="${esc(p.id)}" x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="${anchor}" font-size="${fmt(7 * k)}" fill="${fill}" paint-order="stroke" stroke="#0f1c25" stroke-width="${fmt(2.2 * k)}" stroke-opacity="0.9">${esc(shortLabel(p.name, 11))}</text>`);
    }
    parts.push(`<g class="mm-poi-labels">${labels.join('')}</g>`);
  }

  parts.push('</g>'); // clip

  // 比例尺（左下）
  const barM = 500;
  const barPx = Math.min(radius * 1.2, barM * scale);
  const barLabel = barPx >= 400 * scale ? '500 m' : '200 m';
  const barMeters = barLabel === '500 m' ? 500 : 200;
  const barW = Math.min(radius * 1.2, barMeters * scale);
  const barX = cx - radius * 0.86;
  const barY = cy + radius * 0.86;
  parts.push(
    `<g class="mm-scale" opacity="0.8"><path d="M${fmt(barX)} ${fmt(barY)}h${fmt(barW)}" stroke="${palette.poiTextDim}" stroke-width="${fmt(1 * k)}"/>`
    + `<path d="M${fmt(barX)} ${fmt(barY - 2 * k)}v${fmt(4 * k)}M${fmt(barX + barW)} ${fmt(barY - 2 * k)}v${fmt(4 * k)}" stroke="${palette.poiTextDim}" stroke-width="${fmt(0.8 * k)}"/>`
    + `<text x="${fmt(barX)}" y="${fmt(barY - 4 * k)}" font-size="${fmt(6 * k)}" fill="${palette.poiTextDim}">${barLabel}</text></g>`,
  );

  // 指北针（右上）
  parts.push(
    `<g class="mm-north" transform="translate(${fmt(w - 18 * k)},${fmt(18 * k)})">`
    + `<path d="M0 7 L0 -5" stroke="${palette.north}" stroke-width="${fmt(1 * k)}"/>`
    + `<path d="M0 -9 L${fmt(-3.4 * k)} ${fmt(-2 * k)} L0 ${fmt(-4.4 * k)} L${fmt(3.4 * k)} ${fmt(-2 * k)} Z" fill="${palette.north}"/>`
    + `<text x="0" y="${fmt(12 * k)}" text-anchor="middle" font-size="${fmt(7 * k)}" fill="${palette.north}">N</text></g>`,
  );

  // 署名
  parts.push(`<text class="mm-attribution" x="${fmt(w - 6 * k)}" y="${fmt(h - 5 * k)}" text-anchor="end" font-size="${fmt(5.6 * k)}" fill="${palette.attribution}">© OSM</text>`);

  parts.push('</svg>');
  return parts.join('');
}
