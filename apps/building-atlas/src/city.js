/**
 * city.js —— 街区语境渲染模块（东四十条 · 富华大厦周边）
 *
 * 自包含 ES module，按 docs/upgrade-contract.md §3 对外暴露：
 *   group / loaded / meta / data / layers / setLayer / toggleLayer / setAllVisible /
 *   setNight / setHighlightSite / update / minimapSvg / poisWithin / stats / dispose
 *
 * 数据来源：public/data/site/*（OpenStreetMap，ODbL 1.0；由 tools/build-site-context.py 生成）。
 * 数据缺失 / 解析失败时降级为程序化 9 个低模街区（console.warn，不 console.error、不阻塞页面）。
 *
 * 坐标约定（契约 §1）：+X = 东，+Y = 上，+Z = 南（北 = -Z）；白模顶点已是该轴向，
 * 加载后不做任何旋转 / 缩放。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadSiteContext, buildNameIndex } from './city/data.js';
import { buildProceduralContext, buildFallbackMasses } from './city/fallback.js';
import {
  buildGlbWhiteModels,
  buildFallbackWhiteModels,
  makeBuildingMaterial,
  buildRoads,
  buildLanduse,
  buildSite,
  buildRings,
  countDrawCalls,
  disposeObject3D,
} from './city/build.js';
import { renderMinimapSvg } from './city/minimap.js';

const BASE_URL = import.meta.env.BASE_URL;

const MAX_POI_LABELS = 14;
const LABEL_MAX_DISTANCE = 1700;
const RANK_INTERVAL_MS = 450;

/** 三态调色：白模 / 道路 / 绿地水系 / 地块 / 距离环 / 标签亮度 */
const MODES = {
  day: {
    buildings: { color: 0xe4e7ea, emissive: 0x000000, emissiveIntensity: 0, envMapIntensity: 0.6 },
    roads: [0x9aa7b2, 0x7f8d99, 0x64737e, 0x50606b],
    green: 0x33493d,
    water: 0x1e3d4a,
    built: 0x22333d,
    waterEmissive: 0x000000,
    waterEmissiveIntensity: 0,
    siteFillOpacity: 0.16,
    siteGlowOpacity: 0.14,
    siteLine: 0xffffff,
    siteLineOpacity: 0.9,
    rings: 0xc7b58f,
    ringsOpacity: 0.45,
    poiOpacity: 1,
  },
  dusk: {
    buildings: { color: 0xd9c8b2, emissive: 0x1a1108, emissiveIntensity: 0.1, envMapIntensity: 0.4 },
    roads: [0x77694f, 0x665a45, 0x554c3c, 0x464034],
    green: 0x293a2b,
    water: 0x1c3038,
    built: 0x1a252c,
    waterEmissive: 0x0e0a05,
    waterEmissiveIntensity: 0.16,
    siteFillOpacity: 0.2,
    siteGlowOpacity: 0.18,
    siteLine: 0xffd9a0,
    siteLineOpacity: 0.94,
    rings: 0xd7b783,
    ringsOpacity: 0.4,
    poiOpacity: 1,
  },
  night: {
    buildings: { color: 0x4a5a6a, emissive: 0x0a141c, emissiveIntensity: 0.22, envMapIntensity: 0.2 },
    roads: [0x3f4d56, 0x38454d, 0x303b43, 0x29333a],
    green: 0x151f1a,
    water: 0x0f1c23,
    built: 0x0e161c,
    waterEmissive: 0x06121a,
    waterEmissiveIntensity: 0.3,
    siteFillOpacity: 0.18,
    siteGlowOpacity: 0.26,
    siteLine: 0xffcf8a,
    siteLineOpacity: 1,
    rings: 0x9db4c4,
    ringsOpacity: 0.42,
    poiOpacity: 0.92,
  },
};

const LABEL_ANCHOR_Y = {
  metro: 2.6,
  landmark: 20,
  culture: 15,
  hotel: 17,
  office: 15,
  stadium: 20,
  park: 3,
  education: 12,
  government: 14,
};

function warn(...args) {
  // 契约要求：降级只 warn，不能 console.error
  console.warn('[city]', ...args);
}

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch (error) {
    warn('回调执行失败', error && error.message ? error.message : error);
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 9950 ? 0 : 1)} km`;
  const step = meters < 100 ? 5 : 10;
  return `${Math.round(meters / step) * step} m`;
}

function poiAnchorY(poi) {
  const value = LABEL_ANCHOR_Y[poi.kind];
  return Number.isFinite(value) ? value : 9;
}

function poiClassName(poi) {
  const kind = String(poi.kind || 'landmark').replace(/[^a-z]/g, '') || 'landmark';
  const extra = kind === 'metro' ? ' metro' : kind === 'landmark' ? ' landmark' : '';
  return `city-poi city-poi--${kind}${extra}`;
}

export class CityContext {
  constructor({
    scene = null,
    camera = null,
    renderer = null,
    labelHost = null,
    onProgress = null,
    onPoiClick = null,
  } = {}) {
    this.scene = scene || null;
    this.camera = camera || null;
    this.renderer = renderer || null;
    this.labelHost = typeof labelHost === 'string'
      ? (typeof document !== 'undefined' ? document.querySelector(labelHost) : null)
      : (labelHost || null);
    this.onProgress = onProgress;
    this.onPoiClick = onPoiClick;

    this.group = new THREE.Group();
    this.group.name = 'city-context';

    this.loaded = false;
    this.fallback = false;
    this.meta = null;
    this.data = {
      roads: [], landuse: [], poi: [], site: [], byName: new Map(),
    };
    this.layers = {
      whiteModels: true,
      roads: true,
      landuse: true,
      poi: true,
      site: true,
      rings: false,
    };
    this.mode = 'day';
    this.highlightSite = false;
    this.disposed = false;

    this._allVisible = true;
    this._activePoiId = null;
    this._objects = { whiteModels: null, roads: null, landuse: null, site: null, rings: null };
    this._materials = { buildings: null, roads: [], landuse: null, siteFill: null, siteLine: null, siteGlow: null, rings: null };
    this._labels = [];
    this._ringLabels = [];
    this._rankedPois = [];
    this._lastRank = 0;
    this._grid = null;
    this._gridCols = 0;
    this._gridRows = 0;
    this._gridKey = '';
    this._vp = { w: 1280, h: 720 };
    this._size = new THREE.Vector2();
    this._pA = new THREE.Vector3();
    this._pB = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._screen = { x: 0, y: 0, visible: false };
    this._siteBaseFill = MODES.day.siteFillOpacity;
    this._siteBaseLine = MODES.day.siteLineOpacity;
    this._siteBaseGlow = MODES.day.siteGlowOpacity;
    this._statsBase = {
      buildings: 0, roads: 0, landuse: 0, poi: 0, triangles: 0,
    };
    this._dataVersion = 'empty';
    this._minimapCache = { key: '', svg: '' };
  }

  /* ------------------------------ 初始化 ------------------------------ */

  _progress(percent, text, phase = 'city') {
    safeCall(this.onProgress, { text, percent, phase });
  }

  _loadGltf(url) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn) => (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => finish(reject)(new Error('白模加载超时')), 20000);
      try {
        const loader = new GLTFLoader();
        loader.load(
          url,
          finish(resolve),
          (event) => {
            if (event && event.total) {
              this._progress(0.55 + 0.22 * (event.loaded / event.total), '载入周边建筑白模…', 'glb');
            }
          },
          (error) => finish(reject)(error instanceof Error ? error : new Error(String((error && error.message) || error))),
        );
      } catch (error) {
        finish(reject)(error);
      }
    });
  }

  async init() {
    this._progress(0.02, '载入街区语境…', 'start');

    let contextData = null;
    try {
      contextData = await loadSiteContext({
        baseUrl: BASE_URL,
        onProgress: (info) => {
          if (info) this._progress(info.percent, info.text, info.phase);
        },
      });
    } catch (error) {
      warn('街区数据不可用，改用程序化 fallback：', error && error.message ? error.message : error);
      contextData = buildProceduralContext();
    }
    if (!contextData || !contextData.meta) contextData = buildProceduralContext();

    // 有真 meta 但所有图层都空 → 仍按降级处理，避免空白街区
    if (!contextData.fallback && !contextData.roads.length && !contextData.site.length && !contextData.landuse.length) {
      warn('街区图层为空，改用程序化 fallback');
      contextData = buildProceduralContext();
    }

    this.fallback = Boolean(contextData.fallback);
    this.meta = contextData.meta || {};
    this.data = {
      roads: contextData.roads || [],
      landuse: contextData.landuse || [],
      poi: contextData.poi || [],
      site: contextData.site || [],
      byName: buildNameIndex({
        roads: contextData.roads || [],
        landuse: contextData.landuse || [],
        poi: contextData.poi || [],
      }),
    };
    this._dataVersion = `${this.fallback ? 'fallback' : 'real'}-${this.data.roads.length}-${this.data.landuse.length}-${this.data.site.length}-${(this.meta && this.meta.generatedAt) || ''}`;
    for (const message of contextData.warnings || []) warn(message);

    if (!this.fallback) {
      this._progress(0.52, '构建街区几何…', 'build');
    } else {
      this._progress(0.5, '构建程序化街区…', 'fallback');
    }

    // 白模（真实 GLB 优先；失败则用程序化体块）
    const buildingMaterial = makeBuildingMaterial();
    let buildingResult = null;
    if (!this.fallback && contextData.buildingModelUrl) {
      this._progress(0.56, '载入周边建筑白模…', 'glb');
      try {
        const gltf = await this._loadGltf(contextData.buildingModelUrl);
        buildingResult = buildGlbWhiteModels(gltf && gltf.scene, buildingMaterial);
        if (!buildingResult) warn('白模 GLB 中无可用 mesh，改用程序化体块');
      } catch (error) {
        warn('白模 GLB 加载失败，改用程序化体块：', error && error.message ? error.message : error);
      }
    }
    if (!buildingResult) {
      const masses = contextData.masses || buildFallbackMasses();
      buildingResult = buildFallbackWhiteModels(masses, buildingMaterial);
    }
    this._materials.buildings = buildingMaterial;
    this._objects.whiteModels = buildingResult.object;
    this._statsBase.buildings = Number((this.meta.stats && this.meta.stats.buildings) || (this.fallback ? 9 : 0));
    this._statsBase.triangles += buildingResult.triangles || 0;

    this._progress(0.78, '构建路网 / 绿地 / 地块…', 'build');
    this._buildLayers();

    if (this.scene) this.scene.add(this.group);
    this.group.visible = true;
    this._allVisible = true;

    this._setupPoiLabels();
    this._setupRingLabels();
    this._applyModeToMaterials();
    this._applyModeToLabels();
    this._applyLayerVisibility();

    this.loaded = true;
    this._progress(1, '街区语境就绪', 'done');
    return this;
  }

  _buildLayers() {
    // 路网
    const roads = buildRoads(this.data.roads);
    this._objects.roads = roads.group;
    this._materials.roads = roads.materials;
    this._statsBase.triangles += roads.triangles || 0;

    // 绿地 / 水系 / 地块底色
    const landuse = buildLanduse(this.data.landuse);
    this._objects.landuse = landuse.group;
    this._materials.landuse = landuse.materials;
    this._statsBase.triangles += landuse.triangles || 0;

    // 地块填充 + 金色描边
    const site = buildSite(this.data.site);
    this._objects.site = site.group;
    this._materials.siteFill = site.fillMaterial;
    this._materials.siteLine = site.lineMaterial;
    this._materials.siteGlow = site.glowMaterial;
    this._statsBase.triangles += site.triangles || 0;

    // 距离环（默认关闭）
    const rings = buildRings([200, 500, 1000]);
    this._objects.rings = rings.group;
    this._materials.rings = rings.material;

    this._statsBase.roads = this.data.roads.length;
    this._statsBase.landuse = this.data.landuse.length;
    this._statsBase.poi = this.data.poi.length;

    for (const key of ['whiteModels', 'roads', 'landuse', 'site', 'rings']) {
      const object = this._objects[key];
      if (!object) continue;
      object.visible = Boolean(this.layers[key]);
      this.group.add(object);
    }
  }

  _applyLayerVisibility() {
    for (const key of ['whiteModels', 'roads', 'landuse', 'site', 'rings']) {
      const object = this._objects[key];
      if (object) object.visible = Boolean(this.layers[key]);
    }
    if (!this.layers.poi) this._hideAllLabels();
    if (!this.layers.rings) this._hideRingLabels();
  }

  /* ------------------------------ POI 标签 ------------------------------ */

  _setupPoiLabels() {
    const host = this.labelHost;
    this._labels = [];
    this._rankedPois = [];
    if (!host) return;
    // 清理可能残留的旧标签（热更新 / 重复初始化）
    for (const el of [...host.querySelectorAll(':scope > .city-poi, :scope > .city-ring-label')]) el.remove();

    const pois = Array.isArray(this.data.poi) ? this.data.poi : [];
    this._rankedPois = pois.map((poi) => ({ poi, score: 0, dist: 0 }));
    const slotCount = Math.min(MAX_POI_LABELS, this._rankedPois.length);
    for (let i = 0; i < slotCount; i += 1) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'city-poi';
      el.hidden = true;
      el.setAttribute('aria-label', '街区地标');
      const nameEl = document.createElement('span');
      nameEl.className = 'name';
      const distEl = document.createElement('span');
      distEl.className = 'dist';
      el.append(nameEl, distEl);
      const label = {
        el, nameEl, distEl, poi: null, lastDistText: '', lastOpacity: -1, width: 0, height: 0,
      };
      el.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const poi = label.poi;
        if (!poi) return;
        this.setActivePoi(poi.id);
        safeCall(this.onPoiClick, poi);
      });
      host.appendChild(el);
      this._labels.push(label);
    }
    this._rankPois(0, true);
  }

  _setupRingLabels() {
    this._ringLabels = [];
    const host = this.labelHost;
    if (!host) return;
    const radii = [200, 500, 1000];
    radii.forEach((radius) => {
      const el = document.createElement('div');
      el.className = 'city-ring-label';
      el.textContent = `${radius} m`;
      el.hidden = true;
      el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font:8px var(--mono,monospace);'
        + 'letter-spacing:1px;color:rgba(199,181,143,.78);pointer-events:none;'
        + 'text-shadow:0 1px 3px #000a;white-space:nowrap;display:none';
      host.appendChild(el);
      this._ringLabels.push({ el, radius });
    });
  }

  /** 按 weight + 相机距离重排 POI 候选（不是每帧都排，默认 450ms 一次） */
  _rankPois(now, force = false) {
    if (!this.camera || !this._rankedPois.length) return;
    if (!force && now - this._lastRank < RANK_INTERVAL_MS) return;
    this._lastRank = now;
    const camera = this.camera;
    for (const entry of this._rankedPois) {
      const poi = entry.poi;
      const dx = poi.x - camera.position.x;
      const dz = poi.z - camera.position.z;
      entry.dist = Math.hypot(dx, dz);
      // 权重主导、距离辅助：重要地标更愿意出现，但近处地标优先于远处同类
      entry.score = (Number(poi.weight) || 2) * 260 - entry.dist;
    }
    this._rankedPois.sort((a, b) => b.score - a.score || a.dist - b.dist);
  }

  _viewport() {
    if (this.renderer && typeof this.renderer.getSize === 'function') {
      this.renderer.getSize(this._size);
      if (this._size.x > 0 && this._size.y > 0) {
        this._vp.w = this._size.x;
        this._vp.h = this._size.y;
        return this._vp;
      }
    }
    if (this._vp.w <= 0) {
      this._vp.w = typeof window !== 'undefined' ? window.innerWidth : 1280;
      this._vp.h = typeof window !== 'undefined' ? window.innerHeight : 720;
    }
    return this._vp;
  }

  _ensureGrid(w, h) {
    // 屏幕空间简易避让：每个 ~72x34px 单元只保留最高分（weight + 距离）的标签
    const cellW = Math.max(72, Math.round(w / 16));
    const cellH = Math.max(34, Math.round(h / 22));
    const cols = Math.max(1, Math.ceil(w / cellW));
    const rows = Math.max(1, Math.ceil(h / cellH));
    const key = `${cols}x${rows}`;
    if (key !== this._gridKey) {
      this._gridKey = key;
      this._gridCols = cols;
      this._gridRows = rows;
      this._grid = new Uint8Array(cols * rows);
    } else {
      this._grid.fill(0);
    }
    this._cellW = cellW;
    this._cellH = cellH;
    return this._grid;
  }

  _hideLabel(label) {
    if (!label.el.hidden) label.el.hidden = true;
    label.lastOpacity = -1;
  }

  _hideAllLabels() {
    for (const label of this._labels) this._hideLabel(label);
  }

  _hideRingLabels() {
    for (const ring of this._ringLabels) {
      if (!ring.el.hidden) ring.el.hidden = true;
      ring.el.style.display = 'none';
    }
  }

  _applyLabel(label, poi, sx, sy, distance, viewportW, viewportH) {
    const distText = formatDistance(distance);
    if (label.poi !== poi) {
      label.poi = poi;
      const className = poiClassName(poi);
      if (label.el.className !== className) label.el.className = className;
      label.el.dataset.poiId = poi.id;
      label.nameEl.textContent = poi.name;
      label.lastDistText = distText;
      label.distEl.textContent = distText;
      label.el.classList.toggle('active', Boolean(this._activePoiId) && poi.id === this._activePoiId);
      // 仅在换地标时做一次尺寸读取（隐藏元素量不到，先显示）
      label.el.hidden = false;
      label.width = label.el.offsetWidth || 0;
      label.height = label.el.offsetHeight || 0;
    } else if (distText !== label.lastDistText) {
      label.lastDistText = distText;
      label.distEl.textContent = distText;
    }
    const palette = MODES[this.mode] || MODES.day;
    const opacity = clamp((palette.poiOpacity || 1) * (1.15 - distance / 1800), 0.32, 1);
    if (Math.abs(opacity - label.lastOpacity) > 0.05) {
      label.lastOpacity = opacity;
      label.el.style.opacity = opacity.toFixed(2);
    }
    if (label.el.hidden) label.el.hidden = false;
    // 视口内 clamp：窄屏（390px）时标签贴边显示而不是被左右裁切
    const marginX = 8;
    const marginY = 6;
    const halfW = Math.max(24, Math.min((label.width || 96) / 2 + 8, (viewportW - marginX * 2) / 2));
    const halfH = Math.max(9, Math.min((label.height || 22) / 2, (viewportH - marginY * 2) / 2));
    const x = clamp(sx, marginX + halfW, viewportW - marginX - halfW);
    const y = clamp(sy, marginY + halfH, viewportH - marginY - halfH);
    label.el.style.left = `${x.toFixed(1)}px`;
    label.el.style.top = `${y.toFixed(1)}px`;
  }

  _updatePoiLabels(now) {
    const labels = this._labels;
    if (!labels.length) return;
    const visible = this._allVisible && this.group.visible && this.layers.poi && this.camera;
    if (!visible) {
      this._hideAllLabels();
      return;
    }
    const camera = this.camera;
    const { w, h } = this._viewport();
    this._rankPois(now);
    const grid = this._ensureGrid(w, h);
    camera.updateMatrixWorld();
    camera.getWorldDirection(this._forward);
    const cameraPos = camera.position;
    let shown = 0;
    for (const entry of this._rankedPois) {
      if (shown >= labels.length) break;
      const poi = entry.poi;
      const dx = poi.x - cameraPos.x;
      const dz = poi.z - cameraPos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > LABEL_MAX_DISTANCE) continue;
      this._pA.set(poi.x, poiAnchorY(poi), poi.z);
      this._pB.copy(this._pA).sub(cameraPos);
      if (this._pB.dot(this._forward) < 1) continue;
      this._pA.project(camera);
      if (this._pA.z > 1 || this._pA.z < -1) continue;
      const sx = (this._pA.x * 0.5 + 0.5) * w;
      const sy = (-this._pA.y * 0.5 + 0.5) * h;
      if (sx < 34 || sx > w - 34 || sy < 26 || sy > h - 34) continue;
      // 避开界面固定区域：左上标题/建筑索引、底部视角控制条（否则标签会盖住标题或按钮）
      if (sx < Math.min(380, w * 0.38) && sy < Math.min(360, h * 0.42)) continue;
      if (sy > h - 118) continue;
      const col = Math.min(this._gridCols - 1, Math.max(0, Math.floor(sx / this._cellW)));
      const row = Math.min(this._gridRows - 1, Math.max(0, Math.floor(sy / this._cellH)));
      const cell = row * this._gridCols + col;
      if (grid[cell]) continue;
      grid[cell] = 1;
      this._applyLabel(labels[shown], poi, sx, sy, distance, w, h);
      shown += 1;
    }
    for (let i = shown; i < labels.length; i += 1) this._hideLabel(labels[i]);
  }

  _updateRingLabels() {
    if (!this._ringLabels.length) return;
    const visible = this._allVisible && this.group.visible && this.layers.rings && this.camera;
    if (!visible) {
      this._hideRingLabels();
      return;
    }
    const camera = this.camera;
    const { w, h } = this._viewport();
    camera.updateMatrixWorld();
    camera.getWorldDirection(this._forward);
    const cameraPos = camera.position;
    for (const ring of this._ringLabels) {
      this._pA.set(0, 0.5, -ring.radius);
      this._pB.copy(this._pA).sub(cameraPos);
      if (this._pB.dot(this._forward) < 1) { ring.el.style.display = 'none'; continue; }
      this._pA.project(camera);
      const sx = (this._pA.x * 0.5 + 0.5) * w;
      const sy = (-this._pA.y * 0.5 + 0.5) * h;
      if (this._pA.z > 1 || this._pA.z < -1 || sx < 12 || sx > w - 12 || sy < 12 || sy > h - 12) {
        ring.el.style.display = 'none';
        continue;
      }
      ring.el.style.display = 'block';
      ring.el.hidden = false;
      ring.el.style.left = `${sx.toFixed(1)}px`;
      ring.el.style.top = `${sy.toFixed(1)}px`;
    }
  }

  /** 主工程可选：与地标列表联动高亮 */
  setActivePoi(id) {
    this._activePoiId = id || null;
    for (const label of this._labels) {
      label.el.classList.toggle('active', Boolean(this._activePoiId) && Boolean(label.poi) && label.poi.id === this._activePoiId);
    }
    return this._activePoiId;
  }

  /* ------------------------------- 夜态 -------------------------------- */

  _applyModeToMaterials() {
    const palette = MODES[this.mode] || MODES.day;

    const buildings = this._materials.buildings;
    if (buildings) {
      buildings.color.setHex(palette.buildings.color);
      buildings.emissive.setHex(palette.buildings.emissive);
      buildings.emissiveIntensity = palette.buildings.emissiveIntensity;
      buildings.envMapIntensity = palette.buildings.envMapIntensity;
    }
    for (let i = 0; i < this._materials.roads.length; i += 1) {
      const material = this._materials.roads[i];
      if (material) material.color.setHex(palette.roads[i] != null ? palette.roads[i] : palette.roads[2]);
    }
    const landuse = this._materials.landuse;
    if (landuse) {
      if (landuse.green) landuse.green.color.setHex(palette.green);
      if (landuse.built) landuse.built.color.setHex(palette.built);
      if (landuse.water) {
        landuse.water.color.setHex(palette.water);
        landuse.water.emissive.setHex(palette.waterEmissive);
        landuse.water.emissiveIntensity = palette.waterEmissiveIntensity;
      }
    }
    this._applySiteHighlight();
    if (this._materials.rings) {
      this._materials.rings.color.setHex(palette.rings);
      this._materials.rings.opacity = palette.ringsOpacity;
    }
  }

  _applySiteHighlight() {
    const palette = MODES[this.mode] || MODES.day;
    const fill = this._materials.siteFill;
    const line = this._materials.siteLine;
    const glow = this._materials.siteGlow;
    const highlight = this.highlightSite;
    this._siteBaseFill = palette.siteFillOpacity + (highlight ? 0.12 : 0);
    this._siteBaseLine = highlight ? 1 : palette.siteLineOpacity;
    this._siteBaseGlow = palette.siteGlowOpacity + (highlight ? 0.24 : 0);
    if (fill) fill.opacity = this._siteBaseFill;
    if (line) {
      line.opacity = this._siteBaseLine;
      line.color.setHex(highlight ? 0xffd9a0 : palette.siteLine);
    }
    if (glow) {
      glow.opacity = this._siteBaseGlow;
      glow.color.setHex(highlight ? 0xffc978 : 0xc7b58f);
    }
  }

  _applyModeToLabels() {
    if (!this.labelHost || !this.labelHost.classList) return;
    this.labelHost.classList.remove('city-mode-day', 'city-mode-dusk', 'city-mode-night');
    this.labelHost.classList.add(`city-mode-${this.mode}`);
    this.labelHost.dataset.cityMode = this.mode;
    for (const label of this._labels) label.lastOpacity = -1;
  }

  /* ------------------------------- 公开 API ---------------------------- */

  setLayer(name, on) {
    if (!Object.prototype.hasOwnProperty.call(this.layers, name)) return false;
    this.layers[name] = Boolean(on);
    const object = this._objects[name];
    if (object) object.visible = Boolean(on);
    if (name === 'poi' && !on) this._hideAllLabels();
    if (name === 'rings' && !on) this._hideRingLabels();
    return true;
  }

  toggleLayer(name) {
    if (!Object.prototype.hasOwnProperty.call(this.layers, name)) return false;
    this.setLayer(name, !this.layers[name]);
    return Boolean(this.layers[name]);
  }

  /** 楼层模式用：只切换整组可见性，保留 layers 状态 */
  setAllVisible(on) {
    this._allVisible = Boolean(on);
    this.group.visible = this._allVisible;
    if (!this._allVisible) {
      this._hideAllLabels();
      this._hideRingLabels();
    }
    return this._allVisible;
  }

  setNight(mode) {
    const next = MODES[mode] ? mode : 'day';
    this.mode = next;
    this._applyModeToMaterials();
    this._applyModeToLabels();
    this._minimapCache.key = '';
    return this.mode;
  }

  setHighlightSite(on) {
    this.highlightSite = Boolean(on);
    this._applySiteHighlight();
    this._minimapCache.key = '';
    return this.highlightSite;
  }

  update(dt = 0, now = 0) {
    if (this.disposed) return;
    const time = Number.isFinite(now) && now > 0 ? now : (typeof performance !== 'undefined' ? performance.now() : 0);
    if (this.highlightSite) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.0032);
      if (this._materials.siteFill) this._materials.siteFill.opacity = this._siteBaseFill + pulse * 0.09;
      if (this._materials.siteLine) this._materials.siteLine.opacity = this._siteBaseLine - pulse * 0.09;
      if (this._materials.siteGlow) this._materials.siteGlow.opacity = this._siteBaseGlow + pulse * 0.12;
    }
    this._updatePoiLabels(time);
    this._updateRingLabels();
  }

  minimapSvg({ width = 240, height = 240, rangeM = 1200 } = {}) {
    const w = Math.max(80, Number(width) || 240);
    const h = Math.max(80, Number(height) || 240);
    const range = Math.max(60, Number(rangeM) || 1200);
    const key = `${w}|${h}|${range}|${this.mode}|${this.highlightSite}|${this.layers.roads}${this.layers.landuse}${this.layers.poi}${this.layers.site}|${this._dataVersion}`;
    if (this._minimapCache.key === key && this._minimapCache.svg) return this._minimapCache.svg;
    const svg = renderMinimapSvg({
      width: w,
      height: h,
      rangeM: range,
      mode: this.mode,
      highlight: this.highlightSite,
      data: this.data,
      layers: this.layers,
      className: 'city-minimap-svg',
    });
    this._minimapCache = { key, svg };
    return svg;
  }

  /** 按 weight、距离排序返回 rangeM 内的 POI（主工程地标列表用） */
  poisWithin(rangeM = 1200) {
    const range = Number.isFinite(rangeM) ? rangeM : 1200;
    return this.data.poi
      .filter((poi) => poi.distanceM <= range)
      .sort((a, b) => (b.weight - a.weight) || (a.distanceM - b.distanceM));
  }

  /** 可选：返回街区视角预设（相机飞行由主工程控制） */
  setView(viewName) {
    const views = {
      city: { position: [0, 560, -430], target: [0, 8, 0], rangeM: 1200 },
      site: { position: [-140, 112, 153], target: [0, 24, 0], rangeM: 600 },
      ring: { position: [0, 980, 0.01], target: [0, 0, 0], rangeM: 1200 },
    };
    const preset = views[viewName];
    if (!preset) return false;
    if (viewName === 'city') this.setLayer('rings', false);
    if (viewName === 'ring') this.setLayer('rings', true);
    return preset;
  }

  get stats() {
    return {
      buildings: Math.round(this._statsBase.buildings || 0),
      roads: this._statsBase.roads,
      landuse: this._statsBase.landuse,
      poi: this._statsBase.poi,
      triangles: Math.round(this._statsBase.triangles || 0),
      drawCalls: this.group.visible ? countDrawCalls(this.group) : 0,
      fallback: this.fallback,
      labels: this._labels.length,
      mode: this.mode,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._hideAllLabels();
    this._hideRingLabels();
    for (const label of this._labels) label.el.remove();
    for (const ring of this._ringLabels) ring.el.remove();
    this._labels = [];
    this._ringLabels = [];
    if (this.group.parent) this.group.parent.remove(this.group);
    disposeObject3D(this.group);
    this.group.clear();
    if (this.scene && this.scene.remove) this.scene.remove(this.group);
    this.data = {
      roads: [], landuse: [], poi: [], site: [], byName: new Map(),
    };
    this._objects = { whiteModels: null, roads: null, landuse: null, site: null, rings: null };
    this._materials = { buildings: null, roads: [], landuse: null, siteFill: null, siteLine: null, siteGlow: null, rings: null };
    this.loaded = false;
  }
}

/**
 * 创建街区语境（契约 §3）。
 * @param {object} options
 * @param {THREE.Scene} [options.scene]
 * @param {THREE.Camera} [options.camera]
 * @param {THREE.WebGLRenderer} [options.renderer]
 * @param {HTMLElement|string} [options.labelHost] POI 标签容器（主工程传 #city-labels）
 * @param {(info: {text: string, percent: number, phase: string}) => void} [options.onProgress]
 * @param {(poi: object) => void} [options.onPoiClick]
 * @returns {Promise<CityContext>} 永不 reject；数据失败自动降级
 */
export async function createCityContext({
  scene = null,
  camera = null,
  renderer = null,
  labelHost = null,
  onProgress = null,
  onPoiClick = null,
} = {}) {
  const city = new CityContext({
    scene, camera, renderer, labelHost, onProgress, onPoiClick,
  });
  try {
    await city.init();
  } catch (error) {
    warn('街区语境初始化失败，已降级为空街区：', error && error.message ? error.message : error);
    try {
      city.fallback = true;
      city.loaded = true;
      if (scene && !city.group.parent) scene.add(city.group);
      safeCall(onProgress, { text: '街区语境不可用', percent: 1, phase: 'error' });
    } catch {
      /* 静默 */
    }
  }
  return city;
}

export default createCityContext;
