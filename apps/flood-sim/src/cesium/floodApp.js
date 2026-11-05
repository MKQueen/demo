/**
 * floodApp.js —— 场景总装：Cesium Viewer + 程序化地形 + 地表贴图 + 3D Tiles 村庄 +
 *                水面 Shader（src/water）+ 淹没分析 + 相机预设 + 每帧驱动。
 *
 * 这是 UI 与 Cesium 之间唯一的桥。UI 只依赖 store 和本函数返回的控制器。
 */
import * as Cesium from 'cesium';
// Cesium 默认控件/画布的布局样式（Viewer 依赖）
import 'cesium/Source/Widgets/widgets.css';
import { watch } from 'vue';
import {
  SCENE,
  WATER,
  VILLAGE,
  localToLonLat,
  lonLatToLocal,
  heightAtLocal,
} from '../geo/terrainModel.js';
import { CAMERA_PRESETS } from '../store.js';
import { createTerrainProvider } from './terrainProvider.js';
import { createGroundImagery } from './groundTexture.js';
import { createGroundMaterial } from './groundMaterial.js';
import { createSkyStage } from './skyStage.js';
import { loadBuildingManifest, buildAnalyzer } from '../analysis/floodAnalysis.js';
import { createWaterMaterial } from '../water/waterMaterial.js';

const assetURL = (relativePath) => new URL(relativePath, document.baseURI).href;

/**
 * 相机预设：cam = 相机局部 ENU 位置（x 东 / y 北 / 高度米），
 * target = 画面中心对准的局部坐标。heading / pitch 由两点自动求解，
 * 避免手写角度和坐标系对不上（Cesium heading 0=北，顺时针）。
 */
// 澜屿港：老城中心 (-450, 700)、滨海新区实际布局中心 (1300, 500)、海岸线 x≈2600-3000
const PRESETS = {
  overview: {
    // 从东南海面望向内陆：老城 + 西城 + 北城 + 滨海新区 + CBD 天际线 + 海面
    cam: { x: 3000, y: -800, h: 450 },
    target: { x: 500, y: 400, h: 60 },
  },
  village: {
    // 老城街区平视（贴地看淹没）
    cam: { x: VILLAGE.centerX + 520, y: VILLAGE.centerY - 880, h: 130 },
    target: { x: VILLAGE.centerX - 120, y: VILLAGE.centerY + 160, h: 8 },
  },
  river: {
    // 河口与渡口栈桥
    cam: { x: 1450, y: -1500, h: 170 },
    target: { x: 150, y: -620, h: 1 },
  },
  sea: {
    // 海上回看滨海 CBD 天际线 + 码头
    cam: { x: 3400, y: 300, h: 260 },
    target: { x: 1900, y: 500, h: 100 },
  },
  compare: {
    // 高空俯瞰全城
    cam: { x: 4000, y: -3000, h: 1800 },
    target: { x: 0, y: 500, h: 80 },
  },
};

/** 由相机位置与目标点求 Cesium 的 heading / pitch（弧度） */
function solveOrientation(preset) {
  const dx = preset.target.x - preset.cam.x; // 东
  const dy = preset.target.y - preset.cam.y; // 北
  const dz = preset.target.h - preset.cam.h; // 上
  const horiz = Math.hypot(dx, dy);
  return {
    heading: Math.atan2(dx, dy),
    pitch: Math.atan2(dz, horiz),
    roll: 0,
  };
}

/** 黄金时刻：11 月 3 日 16:40（北京时间）的太阳，低角度侧光 */
const GOLDEN_HOUR = '2026-11-03T08:40:00Z';

function cameraDestination(preset) {
  const { lon, lat } = localToLonLat(preset.cam.x, preset.cam.y);
  return Cesium.Cartesian3.fromDegrees(lon, lat, preset.cam.h);
}

/** Globe.tilesLoaded 是 boolean getter：轮询直到瓦片队列清空（或超时） */
function waitForGlobe(viewer, timeoutMs = 9000) {
  return new Promise((resolve) => {
    const globe = viewer.scene.globe;
    const started = performance.now();
    let frames = 0;
    const check = () => {
      frames += 1;
      if (globe.tilesLoaded || performance.now() - started > timeoutMs || frames > 1200) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

function setLoading(store, progress, label) {
  store.loading.progress = Math.max(store.loading.progress, progress);
  if (label) store.loading.label = label;
}

/** 3D Tiles 加载失败时的兜底：用 Entity 方块摆出村庄（保证 demo 不空） */
function addBuildingFallback(viewer, buildings) {
  const entities = [];
  for (const b of buildings) {
    const centerLocal = { x: VILLAGE.centerX + b.localX, y: VILLAGE.centerY + b.localY };
    const { lon, lat } = localToLonLat(centerLocal.x, centerLocal.y);
    const side = Math.sqrt(Math.max(24, b.footprintArea || 80));
    entities.push(
      viewer.entities.add({
        name: b.name,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, b.groundHeight + b.height / 2),
        box: {
          dimensions: new Cesium.Cartesian3(side, side, b.height),
          material: Cesium.Color.fromCssColorString('#b9b1a3').withAlpha(0.96),
          outline: false,
        },
      }),
    );
  }
  return entities;
}

/**
 * 创建 flood-sim 场景。
 * @param {{ container: HTMLElement, store: object }} options
 */
export async function createFloodApp({ container, store }) {
  if (!window.CESIUM_BASE_URL) {
    window.CESIUM_BASE_URL = new URL('cesium/', document.baseURI).href;
  }
  // 调试开关：?noWater=1 跳过水面（排查地形/相机时用）；?noTiles=1 跳过 3D Tiles
  const debugFlags = new URLSearchParams(location.search);
  const t0 = performance.now();
  const mark = (name) => {
    if (debugFlags.has('timing')) console.log(`[flood-sim timing] ${name}: ${(performance.now() - t0).toFixed(0)}ms`);
  };

  // -------------------------------------------------------------------------
  // 1. Viewer / 场景基础设置
  // -------------------------------------------------------------------------
  const credits = document.createElement('div');
  credits.className = 'flood-credits';
  credits.style.cssText =
    'position:absolute;left:12px;bottom:6px;z-index:6;font-size:10px;line-height:1.4;opacity:0.5;pointer-events:none;max-width:60%;';
  container.appendChild(credits);

  const viewer = new Cesium.Viewer(container, {
    baseLayer: false,
    terrainProvider: debugFlags.has('flatTerrain') ? new Cesium.EllipsoidTerrainProvider() : createTerrainProvider(),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: false,
    shadows: false,
    creditContainer: credits,
    creditViewport: credits,
    contextOptions: {
      webgl: { alpha: false, antialias: true, powerPreference: 'high-performance' },
    },
  });
  viewer.creditDisplay.addStaticCredit(new Cesium.Credit('潮线 TIDELINE · 程序化地形与村庄 · 水面基于 ShaderToy「Seascape」(TDM, CC BY-NC-SA 3.0) 移植'));

  const scene = viewer.scene;
  const globe = scene.globe;

  scene.highDynamicRange = false;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1b22');
  globe.enableLighting = false;
  globe.depthTestAgainstTerrain = true;
  globe.maximumScreenSpaceError = 2;
  globe.tileCacheSize = 240;

  // 天空交给自定义后处理（见 skyStage.js）：关掉 Cesium 默认大气/星空/雾/太阳光斑。
  // 这样金色黄昏的观感完全可控，也不受 headless WebGL 环境影响。
  scene.skyAtmosphere.show = false;
  scene.skyBox.show = false;
  scene.sun.show = false;
  scene.moon.show = false;
  scene.fog.enabled = false;
  scene.backgroundColor = new Cesium.Color(0.72, 0.56, 0.43, 1.0); // 抗锯齿边缘的兜底色（暖色）
  scene.postProcessStages.fxaa.enabled = true;
  if (!debugFlags.has('noSky')) scene.postProcessStages.add(createSkyStage({ debug: debugFlags.has('skyDebug') }));
  if (debugFlags.has('redGlobe')) {
    scene.globe.material = new Cesium.Material({
      fabric: { type: 'DebugRed', uniforms: { color: new Cesium.Color(1, 0.1, 0.1, 1) }, components: { diffuse: 'color.rgb', alpha: 'color.a' } },
    });
  }
  // 相机操作：Cesium 原生控制器 + 显式事件映射（更接近主流 3D 软件）
  //   左键拖拽 = 旋转（3D 下环绕地球；贴近地面时范围小，观感类似平移）
  //   右键拖拽 = 倾斜视角
  //   滚轮     = 缩放
  const cameraController = scene.screenSpaceCameraController;
  cameraController.enableInputs = true;
  cameraController.enableCollisionDetection = true;
  cameraController.minimumZoomDistance = 60;
  cameraController.maximumZoomDistance = 3600;
  cameraController.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
  cameraController.tiltEventTypes = [Cesium.CameraEventType.RIGHT_DRAG];
  cameraController.zoomEventTypes = [Cesium.CameraEventType.WHEEL];
  // 关闭 Shift+左键自由观察（look）与中键/双指默认倾斜，避免误操作
  cameraController.lookEventTypes = [];
  // 右键拖拽时不要弹浏览器菜单；画布给 grab/grabbing 光标反馈
  scene.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  scene.canvas.style.cursor = 'grab';

  const clock = viewer.clock;
  clock.currentTime = Cesium.JulianDate.fromIso8601(GOLDEN_HOUR);
  clock.shouldAnimate = false;

  // 初始视角
  const initial = PRESETS[store.cameraPreset] || PRESETS.overview;
  viewer.camera.setView({
    destination: cameraDestination(initial),
    orientation: solveOrientation(initial),
  });

  // -------------------------------------------------------------------------
  // 2. 村庄建筑数据 + 3D Tiles
  // -------------------------------------------------------------------------
  setLoading(store, 0.02, '正在载入村庄数据…');
  const manifest = await loadBuildingManifest();
  mark('manifest');
  const buildings = manifest ? manifest.buildings : [];

  let tileset = null;
  let fallbackEntities = [];
  try {
    if (debugFlags.has('noTiles')) throw new Error('debug: noTiles');
    setLoading(store, 0.1, '正在载入 3D Tiles 村庄…');
    tileset = await Cesium.Cesium3DTileset.fromUrl(assetURL('generated/village/tileset.json'), {
      maximumScreenSpaceError: 4,
      dynamicScreenSpaceError: true,
      cullRequestsWhileMoving: true,
      preloadWhenHidden: false,
    });
    tileset.shadows = Cesium.ShadowMode.RECEIVE_ONLY;
    scene.primitives.add(tileset);
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 5000);
      tileset.initialTilesLoaded.addEventListener(done);
    });
  } catch (error) {
    console.warn('[flood-sim] 3D Tiles 加载失败，使用 Entity 兜底：', error?.message || error);
    tileset = null;
  }
  if (!tileset && buildings.length) {
    fallbackEntities = addBuildingFallback(viewer, buildings);
  }
  mark('buildings');

  // -------------------------------------------------------------------------
  // 3. 地表贴图（程序化卫星影像）
  // -------------------------------------------------------------------------
  let groundTextureUrl = null;
  try {
    if (debugFlags.has('noImagery')) throw new Error('debug: noImagery');
    const ground = await createGroundImagery({
      onProgress: (p, label) => setLoading(store, 0.15 + p * 0.6, label),
    });
    groundTextureUrl = ground.textureUrl;
    // 用 Globe Material 上色：自己算 ENU 局部 UV，避免单张 imagery 在场景边界的
    // 纹理 clamp 拉伸（见 groundMaterial.js 注释）
    if (!debugFlags.has('redGlobe')) scene.globe.material = createGroundMaterial(groundTextureUrl);
  } catch (error) {
    console.warn('[flood-sim] 地表材质生成失败：', error?.message || error);
  }
  mark('imagery');

  // -------------------------------------------------------------------------
  // 4. 淹没分析（读建筑清单 + 预采样高程网格）
  // -------------------------------------------------------------------------
  const analyzer = buildAnalyzer(buildings);
  mark('analyzer');
  store.stats = analyzer.compute(store.waterLevel);

  // -------------------------------------------------------------------------
  // 5. 水面 Shader（由 shader-dev 提供；未就绪时不影响场景）
  // -------------------------------------------------------------------------
  let water = null;
  try {
    if (debugFlags.has('noWater')) throw new Error('debug: noWater');
    const mod = await import('../water/WaterRenderer.js');
    water = new mod.WaterRenderer(viewer, {
      store,
      centerLon: SCENE.lon0,
      centerLat: SCENE.lat0,
      sceneWidth: SCENE.widthMeters,
      sceneHeight: SCENE.heightMeters,
    });
  } catch (error) {
    console.warn('[flood-sim] 水面模块未就绪：', error?.message || error);
  }
  mark('water');

  // 关键：水面 uniform 必须在 Cesium 的 preRender 阶段更新。
  // 独立 rAF 与 Cesium 渲染循环没有顺序保证；缩放/飞行时若相机矩阵晚一帧，
  // 水面求交会与场景深度错位一像素，表现就是“水一直闪”。
  let waterFrameListener = null;
  if (water) {
    waterFrameListener = () => {
      // 水位先同步（watcher 在微任务里可能晚于本帧渲染）
      water.setWaterLevel(store.waterLevel);
      water.update(performance.now() / 1000);
    };
    scene.preRender.addEventListener(waterFrameListener);
  }

  // -------------------------------------------------------------------------
  // 6.6 蓄水区：在地形上拖拽框选矩形 → 矩形内按水位填水 + 区域分析
  //   - 水面：Cesium 矩形实体 + waterMaterial.js 的 Seascape Material 版（地形遮挡形成岸线）
  //   - 交互：store.zoneMode 打开框选，左键拖拽出矩形；Esc/取消退出
  //   - 分析：区域内地形网格采样 → 面积/水面面积/最大水深/蓄水量/区内建筑
  // -------------------------------------------------------------------------
  const sceneEllipsoid = scene.globe.ellipsoid;
  const zoneFrame = (() => {
    const center = Cesium.Cartesian3.fromDegrees(SCENE.lon0, SCENE.lat0, 0);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const col = (i) => {
      const c = Cesium.Matrix4.getColumn(enu, i, new Cesium.Cartesian4());
      return new Cesium.Cartesian3(c.x, c.y, c.z);
    };
    const east = col(0);
    const north = col(1);
    const up = col(2);
    Cesium.Cartesian3.normalize(east, east);
    Cesium.Cartesian3.normalize(north, north);
    Cesium.Cartesian3.normalize(up, up);
    return { center, east, north, up };
  })();

  let zoneEntities = [];
  let zonePrimitive = null;
  let zoneMaterial = null;
  let zoneDraftEntity = null;
  let zoneDrawStart = null;
  let zoneDrawing = false;
  let zoneCameraWasEnabled = true;

  const destroyZoneEntities = () => {
    for (const entity of zoneEntities) viewer.entities.remove(entity);
    zoneEntities = [];
    if (zonePrimitive) {
      scene.primitives.remove(zonePrimitive);
      zonePrimitive = null;
    }
  };

  const zoneRenderTick = () => {
    if (zoneMaterial) zoneMaterial.uniforms.u_time = performance.now() / 1000;
  };
  scene.preRender.addEventListener(zoneRenderTick);

  const zoneCorners = (zone) => {
    const a = localToLonLat(zone.minX, zone.minY);
    const b = localToLonLat(zone.maxX, zone.maxY);
    const west = Math.min(a.lon, b.lon);
    const east = Math.max(a.lon, b.lon);
    const south = Math.min(a.lat, b.lat);
    const north = Math.max(a.lat, b.lat);
    return { west, south, east, north };
  };

  /** 地形网格采样统计（N×N；返回面积/水深/蓄水量/建筑） */
  const computeZoneStats = (zone, level) => {
    const w = zone.maxX - zone.minX;
    const h = zone.maxY - zone.minY;
    const areaM2 = Math.max(1, w * h);
    const N = 64;
    const cellArea = areaM2 / (N * N);
    let minH = Infinity;
    let maxH = -Infinity;
    let waterCells = 0;
    let volume = 0;
    let maxDepth = 0;
    let depthSum = 0;

    for (let j = 0; j < N; j += 1) {
      const y = zone.minY + ((j + 0.5) / N) * h;
      for (let i = 0; i < N; i += 1) {
        const x = zone.minX + ((i + 0.5) / N) * w;
        const terrainH = heightAtLocal(x, y);
        if (terrainH < minH) minH = terrainH;
        if (terrainH > maxH) maxH = terrainH;
        if (terrainH < level) {
          const depth = level - terrainH;
          waterCells += 1;
          volume += depth * cellArea;
          depthSum += depth;
          if (depth > maxDepth) maxDepth = depth;
        }
      }
    }

    let buildingsTotal = 0;
    let buildingsFlooded = 0;
    for (const b of buildings) {
      const bx = VILLAGE.centerX + (b.localX ?? 0);
      const by = VILLAGE.centerY + (b.localY ?? 0);
      if (bx >= zone.minX && bx <= zone.maxX && by >= zone.minY && by <= zone.maxY) {
        buildingsTotal += 1;
        if (level - b.minGround > 0.15) buildingsFlooded += 1;
      }
    }

    return {
      areaKm2: areaM2 / 1e6,
      waterAreaKm2: (waterCells * cellArea) / 1e6,
      maxDepth: Math.max(0, maxDepth),
      meanDepth: waterCells > 0 ? depthSum / waterCells : 0,
      volumeWanM3: volume / 1e4,
      buildingsTotal,
      buildingsFlooded,
      terrainMin: minH,
      terrainMax: maxH,
    };
  };

  const updateZoneStats = () => {
    if (!store.zone) return;
    const stats = computeZoneStats(store.zone, store.zoneLevel);
    store.zone = { ...store.zone, level: store.zoneLevel, stats };
  };

  /** 建/更新矩形水面 + 地形上的围栏线 */
  const buildZoneWater = (zone) => {
    destroyZoneEntities();
    const { west, south, east, north } = zoneCorners(zone);
    const widthM = zone.maxX - zone.minX;
    const heightM = zone.maxY - zone.minY;

    try {
      zoneMaterial = createWaterMaterial({
        stScale: new Cesium.Cartesian2(
          Math.max(60, widthM / 7),
          Math.max(60, heightM / 7),
        ),
      });
      zoneMaterial.uniforms.u_eastWC = Cesium.Cartesian3.clone(zoneFrame.east);
      zoneMaterial.uniforms.u_northWC = Cesium.Cartesian3.clone(zoneFrame.north);
      zoneMaterial.uniforms.u_upWC = Cesium.Cartesian3.clone(zoneFrame.up);
      zoneMaterial.uniforms.u_waterLevel = zone.level;
      zoneMaterial.uniforms.u_waveSpeed = 0.7;
      zoneMaterial.uniforms.u_waveHeight = 0.06;
      zoneMaterial.uniforms.u_foam = 0.7;
      // 水色/亮度用 waterMaterial.js 的新默认（shader-dev 提亮后的湖面观感），这里不再覆盖
    } catch (error) {
      console.warn('[flood-sim] 蓄水区水面材质不可用，退回半透明色：', error?.message || error);
      zoneMaterial = Cesium.Color.fromCssColorString('#2f8fa8').withAlpha(0.62);
    }

    // 水面用 Primitive：Entity 的 RectangleGraphics 不接受自定义 Material 实例，
    // 而 MaterialAppearance 可以挂 waterMaterial.js 的 Seascape Material。
    const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
    const geometry = new Cesium.RectangleGeometry({
      rectangle,
      height: 0,
      vertexFormat: Cesium.MaterialAppearance.VERTEX_FORMAT,
    });
    const appearance = new Cesium.MaterialAppearance({
      material: zoneMaterial,
      translucent: true,
      closed: false,
      faceForward: true,
    });
    zonePrimitive = scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({ geometry }),
        appearance,
        asynchronous: false,
      }),
    );
    zonePrimitive.modelMatrix = Cesium.Matrix4.fromTranslation(
      Cesium.Cartesian3.multiplyByScalar(zoneFrame.up, zone.level, new Cesium.Cartesian3()),
    );

    // 地形上的矩形边线（贴地），让“画出来的方形”看得见
    const cornerLonLat = [
      localToLonLat(zone.minX, zone.minY),
      localToLonLat(zone.maxX, zone.minY),
      localToLonLat(zone.maxX, zone.maxY),
      localToLonLat(zone.minX, zone.maxY),
      localToLonLat(zone.minX, zone.minY),
    ];
    const outline = viewer.entities.add({
      name: 'zone-outline',
      polyline: {
        positions: cornerLonLat.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat)),
        clampToGround: true,
        width: 2.5,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.fromCssColorString('#6ef0ff').withAlpha(0.95),
          glowPower: 0.18,
        }),
      },
    });

    zoneEntities = [outline];
  };

  const refreshZoneEntity = () => {
    if (!store.zone || !zonePrimitive) return;
    zonePrimitive.modelMatrix = Cesium.Matrix4.fromTranslation(
      Cesium.Cartesian3.multiplyByScalar(zoneFrame.up, store.zoneLevel, new Cesium.Cartesian3()),
    );
    if (zoneMaterial instanceof Cesium.Material) {
      zoneMaterial.uniforms.u_waterLevel = store.zoneLevel;
    }
  };

  /** 提示草稿矩形（拖拽过程中） */
  const updateZoneDraft = (p) => {
    if (zoneDraftEntity) viewer.entities.remove(zoneDraftEntity);
    const x0 = Math.min(zoneDrawStart.x, p.x);
    const x1 = Math.max(zoneDrawStart.x, p.x);
    const y0 = Math.min(zoneDrawStart.y, p.y);
    const y1 = Math.max(zoneDrawStart.y, p.y);
    const c = [
      localToLonLat(x0, y0),
      localToLonLat(x1, y0),
      localToLonLat(x1, y1),
      localToLonLat(x0, y1),
      localToLonLat(x0, y0),
    ];
    zoneDraftEntity = viewer.entities.add({
      polyline: {
        positions: c.map((p2) => Cesium.Cartesian3.fromDegrees(p2.lon, p2.lat)),
        clampToGround: true,
        width: 2,
        material: Cesium.Color.fromCssColorString('#ffd166').withAlpha(0.95),
      },
    });
  };

  const clearZoneDraft = () => {
    if (zoneDraftEntity) {
      viewer.entities.remove(zoneDraftEntity);
      zoneDraftEntity = null;
    }
    zoneDrawStart = null;
    zoneDrawing = false;
  };

  const pickZoneENU = (offsetX, offsetY) => {
    const pos = new Cesium.Cartesian2(offsetX, offsetY);
    let cartesian = null;
    if (scene.pickPositionSupported) {
      try {
        cartesian = scene.pickPosition(pos);
      } catch (error) {
        cartesian = null;
      }
    }
    if (!cartesian) cartesian = camera.pickEllipsoid(pos, sceneEllipsoid);
    if (!cartesian) return null;
    const carto = sceneEllipsoid.cartesianToCartographic(cartesian);
    if (!carto) return null;
    return lonLatToLocal(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude));
  };

  const enterZoneMode = () => {
    if (!store.zoneMode) return;
    zoneCameraWasEnabled = scene.screenSpaceCameraController.enableInputs;
    scene.screenSpaceCameraController.enableInputs = false;
    scene.canvas.style.cursor = 'crosshair';
    scene.canvas.addEventListener('pointerdown', onZonePointerDown);
    window.addEventListener('pointermove', onZonePointerMove);
    window.addEventListener('pointerup', onZonePointerUp);
    window.addEventListener('keydown', onZoneEsc);
  };

  const exitZoneMode = () => {
    scene.screenSpaceCameraController.enableInputs = zoneCameraWasEnabled;
    scene.canvas.style.cursor = 'grab';
    scene.canvas.removeEventListener('pointerdown', onZonePointerDown);
    window.removeEventListener('pointermove', onZonePointerMove);
    window.removeEventListener('pointerup', onZonePointerUp);
    window.removeEventListener('keydown', onZoneEsc);
    clearZoneDraft();
  };

  const onZoneEsc = (event) => {
    if (event.key === 'Escape') {
      store.zoneMode = false;
    }
  };

  const onZonePointerDown = (event) => {
    if (!store.zoneMode || event.button !== 0) return;
    const p = pickZoneENU(event.offsetX, event.offsetY);
    if (!p) return;
    event.preventDefault();
    event.stopPropagation();
    zoneDrawStart = p;
    zoneDrawing = true;
    scene.canvas.setPointerCapture?.(event.pointerId);
    updateZoneDraft(p);
  };

  const onZonePointerMove = (event) => {
    if (!zoneDrawing || !zoneDrawStart) return;
    const p = pickZoneENU(event.offsetX, event.offsetY);
    if (!p) return;
    updateZoneDraft(p);
  };

  const onZonePointerUp = (event) => {
    if (!zoneDrawing || !zoneDrawStart) return;
    const p = pickZoneENU(event.offsetX, event.offsetY);
    zoneDrawing = false;
    if (!p) {
      clearZoneDraft();
      return;
    }
    const minX = Math.min(zoneDrawStart.x, p.x);
    const maxX = Math.max(zoneDrawStart.x, p.x);
    const minY = Math.min(zoneDrawStart.y, p.y);
    const maxY = Math.max(zoneDrawStart.y, p.y);
    clearZoneDraft();

    if (maxX - minX < 30 || maxY - minY < 30) return;

    // 先粗采样地形，给一个默认水位（保证能看到水）
    let minH = Infinity;
    let maxH = -Infinity;
    const N = 24;
    for (let j = 0; j < N; j += 1) {
      const y = minY + ((j + 0.5) / N) * (maxY - minY);
      for (let i = 0; i < N; i += 1) {
        const x = minX + ((i + 0.5) / N) * (maxX - minX);
        const h = heightAtLocal(x, y);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    const level = minH + Math.min(80, Math.max(5, (maxH - minH) * 0.35));
    const zone = { minX, maxX, minY, maxY };
    store.zoneLevelRange = [Math.floor(minH - 1), Math.ceil(maxH + 40)];
    store.zoneLevel = Number(level.toFixed(1));
    store.zone = { ...zone, level: store.zoneLevel, stats: computeZoneStats(zone, store.zoneLevel) };
    buildZoneWater(store.zone);
    store.zoneMode = false;
  };

  // UI → 渲染层：清除 / 重新框选
  const onZoneCommand = (cmd) => {
    if (!cmd) return;
    if (cmd.type === 'clear') {
      destroyZoneEntities();
      clearZoneDraft();
      store.zone = null;
      store.zoneMode = false;
      return;
    }
    if (cmd.type === 'reselect') {
      store.zone = null;
      destroyZoneEntities();
      store.zoneMode = true;
      return;
    }
    if (cmd.type === 'cancel') {
      store.zoneMode = false;
    }
  };

  // -------------------------------------------------------------------------
  // 6. 交互：点击 3D Tiles 建筑显示属性（UI 读 store.selectedBuilding）
  // -------------------------------------------------------------------------
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((movement) => {
    const picked = scene.pick(movement.position);
    if (picked && picked instanceof Cesium.Cesium3DTileFeature) {
      const name = picked.getProperty('name') || '建筑';
      const b = buildings.find((item) => item.name === name || item.id === picked.getProperty('id'));
      const base = b ? b.minGround : Number(picked.getProperty('minGround'));
      const depth = store.waterLevel - base;
      store.selectedBuilding = {
        name,
        type: picked.getProperty('type') || '',
        height: Number(picked.getProperty('height')) || (b ? b.height : 0),
        floors: Number(picked.getProperty('floors')) || (b ? b.floors : 0),
        groundHeight: base,
        depth: Math.max(0, depth),
        flooded: depth > 0.15,
      };
    } else {
      store.selectedBuilding = null;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // -------------------------------------------------------------------------
  // 6.5 相机辅助（右键倾斜/滚轮缩放/左键旋转由 Cesium 原生控制器负责）
  //   这里只保留：预设 flyTo、键盘快捷键、ViewPad（store.viewCommand）要用的 API
  // -------------------------------------------------------------------------
  const camera = viewer.camera;
  const clampPitch = (pitch) => Math.min(0.10, Math.max(-1.25, pitch));

  /** 回到当前相机预设 */
  const flyToPreset = (key) => {
    const preset = PRESETS[key] || PRESETS.overview;
    viewer.camera.flyTo({
      destination: cameraDestination(preset),
      orientation: solveOrientation(preset),
      duration: 2.2,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  };

  /** 原地旋转/俯仰（度）：键盘、ViewPad、store.viewCommand 共用 */
  function orbitCamera(dHeadingDeg = 0, dPitchDeg = 0) {
    const heading = camera.heading + Cesium.Math.toRadians(dHeadingDeg);
    const pitch = clampPitch(camera.pitch + Cesium.Math.toRadians(dPitchDeg));
    camera.setView({ destination: camera.positionWC, orientation: { heading, pitch, roll: 0 } });
  }

  /** dir > 0 放大（拉近），dir < 0 缩小 */
  function zoomCamera(dir = 1) {
    const height = Math.max(1, camera.positionCartographic.height);
    const amount = Math.min(4000, Math.max(120, height * 0.32));
    if (dir > 0) camera.zoomIn(amount);
    else camera.zoomOut(amount);
  }

  const resetCamera = () => flyToPreset(store.cameraPreset);

  // 键盘快捷键
  const KEY_ORBIT = {
    ArrowLeft: [-12, 0],
    ArrowRight: [12, 0],
    ArrowUp: [0, 8],
    ArrowDown: [0, -8],
  };
  const onViewKeydown = (event) => {
    const tag = String(event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const step = event.shiftKey ? 2 : 1;
    if (KEY_ORBIT[event.key]) {
      event.preventDefault();
      orbitCamera(KEY_ORBIT[event.key][0] * step, KEY_ORBIT[event.key][1] * step);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomCamera(1);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomCamera(-1);
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      resetCamera();
      return;
    }
    if (/^[1-5]$/.test(event.key)) {
      const preset = CAMERA_PRESETS[Number(event.key) - 1];
      if (preset) {
        event.preventDefault();
        store.cameraPreset = preset.key;
      }
    }
  };
  window.addEventListener('keydown', onViewKeydown);

  // 拖拽时光标反馈
  const onCanvasPointerDown = () => { scene.canvas.style.cursor = 'grabbing'; };
  const onCanvasPointerUp = () => { scene.canvas.style.cursor = 'grab'; };
  scene.canvas.addEventListener('pointerdown', onCanvasPointerDown);
  scene.canvas.addEventListener('pointerup', onCanvasPointerUp);
  scene.canvas.addEventListener('pointercancel', onCanvasPointerUp);

  // 相机边界约束：Cesium 原生 tilt 会绕“视线落点”旋转，低空右拖容易把相机抬高到很远，
  // 这里在每帧渲染前夹一次高度与 pitch，保证画面始终在场景附近、不把视角抬到整屏天空。
  const ellipsoid = scene.globe.ellipsoid;
  const cartoScratch = new Cesium.Cartographic();
  const limitScratch = new Cesium.Cartesian3();
  const clampCameraLimits = () => {
    const carto = ellipsoid.cartesianToCartographic(camera.positionWC, cartoScratch);
    if (!carto) return;
    let pitch = camera.pitch;
    let height = carto.height;
    let needs = false;

    if (pitch > 0.10) {
      pitch = 0.10;
      needs = true;
    } else if (pitch < -1.35) {
      pitch = -1.35;
      needs = true;
    }
    if (height > 3600) {
      height = 3600;
      needs = true;
    } else if (height < 60) {
      height = 60;
      needs = true;
    }
    if (!needs) return;

    let destination = camera.positionWC;
    if (height !== carto.height) {
      carto.height = height;
      destination = ellipsoid.cartographicToCartesian(carto, limitScratch);
    }
    camera.setView({
      destination,
      orientation: { heading: camera.heading, pitch, roll: 0 },
    });
  };
  scene.preRender.addEventListener(clampCameraLimits);

  // -------------------------------------------------------------------------
  // 7. UI store → 场景/水面 的参数联动
  // -------------------------------------------------------------------------
  const applyQuality = (quality) => {
    if (quality === 'low') {
      viewer.resolutionScale = 0.72;
      globe.maximumScreenSpaceError = 4;
      water?.setQuality('low');
    } else if (quality === 'medium') {
      viewer.resolutionScale = 0.86;
      globe.maximumScreenSpaceError = 3;
      water?.setQuality('medium');
    } else {
      viewer.resolutionScale = 1.0;
      globe.maximumScreenSpaceError = 2;
      water?.setQuality('high');
    }
  };

  const applyWaveOptions = () => {
    water?.setWaveOptions({
      intensity: store.waveIntensity,
      speed: store.waveSpeed,
      caustics: store.caustics,
    });
  };

  const unsubs = [
    watch(() => store.cameraPreset, (key) => {
      flyToPreset(key);
    }),
    watch(() => store.quality, applyQuality, { immediate: true }),
    watch(
      () => [store.waveIntensity, store.waveSpeed, store.caustics],
      applyWaveOptions,
      { immediate: true },
    ),
    watch(() => store.waterEnabled, (v) => water?.setEnabled(v)),
    watch(
      () => store.showBuildings,
      (v) => {
        if (tileset) tileset.show = v;
        for (const e of fallbackEntities) e.show = v;
      },
    ),
    watch(() => store.waterLevel, (level) => water?.setWaterLevel(level)),
    watch(
      () => store.zoneMode,
      (enabled) => {
        if (enabled) enterZoneMode();
        else exitZoneMode();
      },
    ),
    watch(
      () => store.zoneLevel,
      () => {
        if (!store.zone) return;
        updateZoneStats();
        refreshZoneEntity();
      },
    ),
    watch(() => store.zoneCommand, (cmd) => onZoneCommand(cmd)),
    watch(() => store.viewCommand, (cmd) => {
      if (!cmd) return;
      if (cmd.type === 'orbit') orbitCamera(cmd.dh || 0, cmd.dp || 0);
      else if (cmd.type === 'zoom') zoomCamera(cmd.dir > 0 ? 1 : -1);
      else if (cmd.type === 'reset') resetCamera();
    }),
  ];

  // -------------------------------------------------------------------------
  // 8. 每帧循环：水位平滑 / 自动上涨 / FPS / 统计
  // -------------------------------------------------------------------------
  let rafId = 0;
  let lastTime = performance.now();
  let lastStatsTime = 0;
  let fpsAcc = 0;
  let fpsCount = 0;
  let fpsLast = performance.now();
  let destroyed = false;

  function tick(now) {
    if (destroyed) return;
    rafId = requestAnimationFrame(tick);
    const dt = Math.min((now - lastTime) / 1000, 0.12);
    lastTime = now;

    // 自动上涨
    if (store.autoRise) {
      const next = Math.min(WATER.max, store.targetLevel + store.riseSpeed * dt);
      store.targetLevel = next;
      if (next >= WATER.max) store.autoRise = false;
    }

    // 平滑水位（指数趋近，避免滑块瞬移）
    const diff = store.targetLevel - store.waterLevel;
    if (Math.abs(diff) > 0.001) {
      const step = diff * Math.min(1, dt * 3.2);
      store.waterLevel = Math.abs(diff) < 0.01 ? store.targetLevel : store.waterLevel + step;
    } else if (store.waterLevel !== store.targetLevel) {
      store.waterLevel = store.targetLevel;
    }

    if (now - lastStatsTime > 180) {
      lastStatsTime = now;
      store.stats = analyzer.compute(store.waterLevel);
    }

    fpsAcc += dt;
    fpsCount += 1;
    if (now - fpsLast > 900) {
      store.fps = Math.round(fpsCount / Math.max(1e-3, fpsAcc));
      fpsAcc = 0;
      fpsCount = 0;
      fpsLast = now;
    }
  }
  rafId = requestAnimationFrame(tick);

  // -------------------------------------------------------------------------
  // 9. 等待地形瓦片就绪后收起加载遮罩
  // -------------------------------------------------------------------------
  setLoading(store, 0.85, '正在等待地形瓦片…');
  await waitForGlobe(viewer, 6000);
  mark('globeTiles');
  setLoading(store, 0.97, '正在收尾…');
  // 多等两帧，确保第一帧画面已经渲染出来
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  setTimeout(() => {
    store.loading.progress = 1;
    store.loading.visible = false;
  }, 450);

  // -------------------------------------------------------------------------
  // 10. 控制器
  // -------------------------------------------------------------------------
  const controller = {
    viewer,
    scene,
    flyTo(key) {
      store.cameraPreset = key;
    },
    orbitCamera,
    zoomCamera,
    resetCamera,
    getAnalyzer() {
      return analyzer;
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      for (const unsub of unsubs) unsub?.();
      handler.destroy();
      exitZoneMode();
      scene.preRender.removeEventListener(zoneRenderTick);
      destroyZoneEntities();
      window.removeEventListener('keydown', onViewKeydown);
      scene.canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      scene.canvas.removeEventListener('pointerup', onCanvasPointerUp);
      scene.canvas.removeEventListener('pointercancel', onCanvasPointerUp);
      scene.preRender.removeEventListener(clampCameraLimits);
      if (waterFrameListener) scene.preRender.removeEventListener(waterFrameListener);
      water?.destroy();
      for (const e of fallbackEntities) viewer.entities.remove(e);
      // 释放贴图 blob
      if (groundTextureUrl) URL.revokeObjectURL(groundTextureUrl);
      viewer.destroy();
    },
  };
  // 调试/截图脚本用（也方便线上排查）
  window.__Cesium = Cesium; // 调试：材质/相机诊断用（不影响正常交互）
  window.__floodApp = controller;
  window.__floodStore = store;
  window.__floodReady = true;
  mark('ready');
  return controller;
}
