import * as Cesium from 'cesium';
import {
  BEIJING_CENTER,
  CBD_VIEW,
  CITY_CENTER,
  DISTRICT_CENTER,
  DISTRICT_LABELS,
  DISTRICT_VIEW,
  INITIAL_VIEW,
  LANDMARKS,
  POIS,
  POI_CATEGORY_META,
} from '../data/poi';
import type {
  BeijingDataBundle,
  BeijingMeta,
  CityDataBundle,
  DataMeta,
  DistrictDataBundle,
  DistrictMeta,
  LayerKey,
  LayerState,
  Poi,
  QualityPreset,
  QualityState,
  SceneProgress,
  SceneStats,
  ScreenAnchor,
} from '../data/types';
import { summarizeMeta } from '../data/meta';
import { createGlowDot, createPoiMarker, createPulseRing } from './utils/canvas';
import {
  assetUrl,
  bboxToRectangle,
  cameraStats,
  distanceMeters,
  fetchJson,
  lineToPositions,
  longestLineMidpoint,
  metaBasemapRectangle,
  worldToScreen,
} from './utils/geo';

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export interface CbdSceneCallbacks {
  onProgress?: (progress: SceneProgress) => void;
  onReady?: (meta: DataMeta | null, districtMeta?: DistrictMeta | null, beijingMeta?: BeijingMeta | null) => void;
  onNotice?: (message: string) => void;
  onPoiSelect?: (poi: Poi | null) => void;
  onAnchor?: (anchor: ScreenAnchor) => void;
  onStats?: (stats: SceneStats) => void;
  onOrbitChange?: (active: boolean) => void;
  onQuality?: (quality: QualityState) => void;
  onFatal?: (message: string) => void;
}

/** 画质档位对应的 resolutionScale（1 = 设备原生像素） */
const PRESET_SCALES: Record<Exclude<QualityPreset, 'auto'>, number> = {
  high: 1,
  medium: 0.82,
  low: 0.65,
};
/** 自适应画质的分辨率倍率上下限：不超过设备原生像素，避免无意义的超采样 */
const AUTO_MIN_SCALE = 0.55;
const AUTO_MAX_SCALE = 1;

export interface CbdSceneOptions {
  quality?: QualityPreset;
}

interface FlowRoute {
  samples: Cesium.Cartesian3[];
  length: number;
  step: number;
}

interface FlowParticle {
  billboard: Cesium.Billboard;
  route: FlowRoute;
  speed: number;
  offset: number;
}

interface OrbitState {
  active: boolean;
  transform: Cesium.Matrix4;
  heading: number;
  pitch: number;
  range: number;
  speed: number;
  lastNow: number;
}

const COLORS = {
  accent: Cesium.Color.fromCssColorString('#6ce5ff'),
  accentSoft: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.22),
  warm: Cesium.Color.fromCssColorString('#ffc46b'),
  white: Cesium.Color.fromCssColorString('#eaf4fb'),
  water: Cesium.Color.fromCssColorString('#0a2737').withAlpha(0.72),
  park: Cesium.Color.fromCssColorString('#0c241b').withAlpha(0.6),
  block: Cesium.Color.fromCssColorString('#0b1420').withAlpha(0.08),
  whiteModel: Cesium.Color.fromCssColorString('#dceaf5'),
  fallbackModel: Cesium.Color.fromCssColorString('#cbdde9'),
};

const MAJOR_CLASSES = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']);
const MID_CLASSES = new Set(['secondary', 'secondary_link', 'tertiary', 'tertiary_link']);
const MINOR_CLASSES = new Set(['residential', 'unclassified', 'living_street']);

/**
 * CbdScene —— 把 Cesium 的命令式世界封装在一个类里，Vue 只负责 UI 状态。
 * 这样相机、图层、图元生命周期都可控，也避免响应式对象持有 Cesium 内部实例。
 */
export class CbdScene {
  private readonly container: HTMLElement;
  private readonly callbacks: CbdSceneCallbacks;
  private viewer!: Cesium.Viewer;
  private destroyed = false;
  private ready = false;

  /* 数据 */
  private meta: DataMeta | null = null;
  private districtMeta: DistrictMeta | null = null;
  private beijingMeta: BeijingMeta | null = null;
  private layerState: LayerState = {
    beijingMassing: true,
    beijingBoundary: true,
    whiteModels: true,
    districtMassing: true,
    landmarks: true,
    roads: true,
    boundary: true,
    context: true,
    pois: true,
    flow: true,
  };

  /* 北京市全域 */
  private beijingBasemapLayer?: Cesium.ImageryLayer;
  private beijingContextBasemapLayer?: Cesium.ImageryLayer;
  private beijingMassing?: Cesium.Cesium3DTileset;
  private beijingBoundaryDataSource?: Cesium.DataSource;
  private beijingBoundaryLines?: Cesium.PolylineCollection;
  private beijingDistrictLines?: Cesium.PolylineCollection;
  private beijingLabels?: Cesium.LabelCollection;
  private beijingMajorRoads?: Cesium.PolylineCollection;
  private beijingMinorRoads?: Cesium.PolylineCollection;
  private activeDistrict: string | null = null;
  private districtFeatures = new Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>>>();
  private selectedDistrictDataSource?: Cesium.DataSource;
  private selectedDistrictLines?: Cesium.PolylineCollection;
  private selectedDistrictLabels?: Cesium.LabelCollection;
  private landmarkModelById = new Map<string, Cesium.Model>();
  private landmarkLabelById = new Map<string, Cesium.Label>();
  private landmarkDecorById = new Map<string, Cesium.Entity>();

  /* 朝阳区全域 */
  private districtBasemapLayer?: Cesium.ImageryLayer;
  private districtMassing?: Cesium.Cesium3DTileset;
  private districtBoundaryDataSource?: Cesium.DataSource;
  private districtBoundaryLines?: Cesium.PolylineCollection;
  private districtBoundaryLabels?: Cesium.LabelCollection;
  private districtMajorRoads?: Cesium.PolylineCollection;
  private districtMinorRoads?: Cesium.PolylineCollection;
  private overviewRoads?: Cesium.PolylineCollection;
  private overviewMode = false;
  private beijingLabelMode = false;
  private massingDetailMode = true;
  private closeBasemapMode = false;
  private districtMassingDetailMode = true;
  private landmarkCloseupMode = false;
  private freeLandmarksStarter?: () => void;

  /* 白模 / 地标 */
  private whiteTileset?: Cesium.Cesium3DTileset;
  private whiteFallback?: Cesium.DataSource;
  private landmarkModels: Cesium.Model[] = [];
  private landmarkLabels?: Cesium.LabelCollection;
  private landmarkDecor: Cesium.Entity[] = [];

  /* 道路 */
  private majorRoads?: Cesium.PolylineCollection;
  private majorRoadCores?: Cesium.PolylineCollection;
  private majorRoadHalos?: Cesium.PolylineCollection;
  private midRoads?: Cesium.PolylineCollection;
  private minorRoads?: Cesium.PolylineCollection;
  private railwayLines?: Cesium.PolylineCollection;
  private roadLabels?: Cesium.LabelCollection;
  private majorPaths: Array<{ coords: GeoJSON.Position[]; klass: string }> = [];

  /* 流光 */
  private flowBillboards?: Cesium.BillboardCollection;
  private flowParticles: FlowParticle[] = [];
  private flowStart = performance.now();

  /* 点位 */
  private poiById = new Map(POIS.map((poi) => [poi.id, poi]));
  private poiBillboards?: Cesium.BillboardCollection;
  private poiLabels?: Cesium.LabelCollection;
  private poiMarkers = new Map<string, Cesium.Billboard>();
  private poiLabelMap = new Map<string, Cesium.Label>();
  private pulseBillboard?: Cesium.Billboard;
  private hoveredPoiId: string | null = null;
  private selectedPoi: Poi | null = null;
  private selectedWorld: Cesium.Cartesian3 | null = null;
  private lastAnchor: ScreenAnchor = { x: 0, y: 0, visible: false };

  /* 其它 */
  private contextDataSource?: Cesium.DataSource;
  private basemapLayer?: Cesium.ImageryLayer;
  private screenSpaceHandler?: Cesium.ScreenSpaceEventHandler;
  private inputCleanup: Array<() => void> = [];
  private preRenderCleanup?: () => void;
  private postRenderCleanup?: () => void;
  private orbit: OrbitState | null = null;
  private frames = 0;
  private fpsWindowAt = performance.now();
  private lastStatsAt = 0;

  /* 画质 / 自适应分辨率 */
  private qualityPreset: QualityPreset;
  private qualityScale = 1;
  private qualityWarmupUntil = performance.now() + 4500;
  private lastQualityAdjustAt = 0;
  private lowFpsStreak = 0;
  private highFpsStreak = 0;
  private qualityNoticeShown = false;
  private lastHoverPickAt = 0;
  private markerStyleKeys = new Map<string, string>();
  private orbitWasActive = false;
  private compactViewport = typeof window !== 'undefined' && window.innerWidth < 760;

  constructor(container: HTMLElement, callbacks: CbdSceneCallbacks = {}, options: CbdSceneOptions = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.qualityPreset = options.quality ?? 'auto';
  }

  /* ---------------------------------------------------------------------- */
  /* 生命周期                                                               */
  /* ---------------------------------------------------------------------- */

  async init(): Promise<void> {
    try {
      this.report(3, '创建 Cesium WebGL 渲染器');
      this.createViewer();
      this.configureScene();
      this.bindCameraInput();
      this.bindPicking();
      this.installRenderHooks();
      this.setInitialView();
      this.overviewMode = this.viewer.scene.camera.positionCartographic.height > 15000;
      this.beijingLabelMode = this.viewer.scene.camera.positionCartographic.height > 70000;
      this.massingDetailMode = this.viewer.scene.camera.positionCartographic.height > 250;
      this.closeBasemapMode = this.viewer.scene.camera.positionCartographic.height < 5000;
      this.districtMassingDetailMode = this.viewer.scene.camera.positionCartographic.height > 1800;
      if (import.meta.env.DEV) {
        // 仅开发环境暴露，便于 Playwright / 控制台调试相机与图元状态
        (window as unknown as Record<string, unknown>).__CBD_SCENE__ = this;
        (window as unknown as Record<string, unknown>).Cesium = Cesium;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CBD] Cesium 初始化失败', error);
      this.callbacks.onFatal?.(`Cesium 初始化失败：${message}`);
      return;
    }

    try {
      await this.loadCityLayers();
    } catch (error) {
      console.error('[CBD] 城市数据加载失败', error);
      this.callbacks.onNotice?.('部分城市数据加载失败，场景将以精简模式显示。');
    }

    if (this.destroyed) return;
    this.ready = true;
    // 场景刚就绪的几秒内仍在编译 shader / 上传纹理，FPS 不具代表性，先给 3.5 秒热身期
    this.qualityWarmupUntil = performance.now() + 3500;
    this.report(100, '数字孪生场景就绪');
    this.callbacks.onReady?.(this.meta, this.districtMeta, this.beijingMeta);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ready = false;
    this.preRenderCleanup?.();
    this.postRenderCleanup?.();
    this.screenSpaceHandler?.destroy();
    for (const cleanup of this.inputCleanup) cleanup();
    this.inputCleanup = [];
    try {
      this.viewer?.destroy();
    } catch {
      /* Viewer 可能已经被页面卸载流程销毁 */
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** 响应式布局变化时由 Vue 调用：小屏隐藏 POI 文字标签，避免遮挡三维场景 */
  refreshLayout(): void {
    const compact = window.innerWidth < 760;
    if (compact === this.compactViewport) return;
    this.compactViewport = compact;
    this.applyLayerState();
  }

  /* ---------------------------------------------------------------------- */
  /* Viewer / 场景                                                          */
  /* ---------------------------------------------------------------------- */

  private createViewer(): void {
    // 默认 credit 会显示在底部，这里用隐藏容器接管，署名统一收进「数据说明」面板。
    const creditContainer = document.createElement('div');
    creditContainer.className = 'cesium-credit-hidden';
    this.container.appendChild(creditContainer);

    this.viewer = new Cesium.Viewer(this.container, {
      animation: false,
      timeline: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
      shouldAnimate: true,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      creditContainer,
      creditViewport: creditContainer,
      useBrowserRecommendedResolution: false,
      targetFrameRate: 60,
      shadows: false,
      msaaSamples: 1,
    });

    // 移除 Cesium 默认 UI 容器的可见性（Viewer 默认创建但无内容）
    const widget = this.viewer.cesiumWidget;
    widget.container.classList.add('cbd-cesium-widget');
  }

  private configureScene(): void {
    const { scene, camera } = this.viewer;
    const canvas = this.viewer.canvas;

    // 画质：MSAA 已在 Viewer 上关闭（改为 1x + FXAA），这里按设备像素控制渲染分辨率。
    // 旧实现固定 resolutionScale=1.5，在 Retina 屏上等于 3x CSS 像素（约 1700 万像素/帧），
    // 是此前卡顿的主因；现在默认 1x（设备原生），并由 auto 档按实测帧率自适应下调。
    this.applyQualityScale(this.qualityPreset === 'auto' ? 1 : PRESET_SCALES[this.qualityPreset]);
    this.viewer.clock.shouldAnimate = true;

    // 空天 / 地球基础色：无在线底图时仍然保持「深空 + 暗色地表」数字孪生观感
    scene.backgroundColor = Cesium.Color.fromCssColorString('#04070d');
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#071019');
    scene.globe.showGroundAtmosphere = false;
    scene.globe.enableLighting = false;
    scene.globe.depthTestAgainstTerrain = true;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.fog.enabled = false;
    if (scene.skyBox) scene.skyBox.show = true;

    // 关闭阴影以换取城市级白模的稳定帧率；glTF 地标用 PBR 高光塑造体积感
    scene.shadowMap.enabled = false;
    camera.frustum.near = 0.5;

    // 相机操作手感
    const controller = scene.screenSpaceCameraController;
    controller.minimumZoomDistance = 70;
    controller.maximumZoomDistance = 600000;
    controller.enableCollisionDetection = false;
    controller.maximumTiltAngle = Cesium.Math.toRadians(89);

    // 鼠标操作映射：
    //   左键拖拽 = 旋转（局部聚焦时视觉上近似平移，本质是地球旋转）
    //   右键拖拽 = 倾斜（改变俯仰角，不缩放）
    //   滚轮     = 缩放
    // 触屏额外保留 PINCH：双指缩放/倾斜，避免移动端失去缩放能力。
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
    controller.tiltEventTypes = coarsePointer
      ? [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.PINCH]
      : [Cesium.CameraEventType.RIGHT_DRAG];
    controller.zoomEventTypes = coarsePointer
      ? [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]
      : [Cesium.CameraEventType.WHEEL];

    // 固定一盏来自南方偏西的冷色方向光，保证南向立面（初始镜头看到的面）有明暗层次
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(CITY_CENTER.lon, CITY_CENTER.lat, 0),
    );
    const direction = Cesium.Matrix4.multiplyByPointAsVector(
      frame,
      new Cesium.Cartesian3(0.42, 0.58, -0.7),
      new Cesium.Cartesian3(),
    );
    Cesium.Cartesian3.normalize(direction, direction);
    scene.light = new Cesium.DirectionalLight({
      direction,
      intensity: 2.4,
      color: Cesium.Color.fromCssColorString('#dcefff'),
    });

    // 让 canvas 接收键盘事件，Esc / R 快捷键由 App 统一处理
    canvas.setAttribute('aria-label', '北京朝阳区三维数字孪生场景');
    canvas.tabIndex = 0;

    this.viewer.scene.postProcessStages.fxaa.enabled = true;
  }

  /** 小屏需要更远一点才能看到完整朝阳区；桌面使用既定总览距离。 */
  private getDistrictViewRange(): number {
    return window.innerWidth < 760 ? 52000 : DISTRICT_VIEW.range;
  }

  /** 北京全境约 180km 跨度，小屏再拉远一档。 */
  private getBeijingViewRange(): number {
    return window.innerWidth < 760 ? 350000 : INITIAL_VIEW.range;
  }

  private setInitialView(): void {
    const target = Cesium.Cartesian3.fromDegrees(INITIAL_VIEW.lon, INITIAL_VIEW.lat, INITIAL_VIEW.targetHeight);
    this.viewer.camera.lookAt(
      target,
      new Cesium.HeadingPitchRange(INITIAL_VIEW.heading, INITIAL_VIEW.pitch, this.getBeijingViewRange()),
    );
    // lookAt 会锁定局部参考系；立刻释放，后续 flyTo / 用户拖拽都在世界坐标系中
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }

  /* ---------------------------------------------------------------------- */
  /* 数据加载                                                               */
  /* ---------------------------------------------------------------------- */

  private async loadCityLayers(): Promise<void> {
    this.report(6, '读取朝阳区 / CBD 数据清单');
    const [
      meta,
      districtMeta,
      beijingMeta,
      beijingBoundary,
      beijingDistricts,
      beijingRoads,
      districtBoundary,
      districtRoads,
      roads,
      context,
      railways,
    ] = await Promise.all([
      fetchJson<DataMeta>('data/meta.json'),
      fetchJson<DistrictMeta>('data/district/meta.json'),
      fetchJson<BeijingMeta>('data/beijing/meta.json'),
      fetchJson<BeijingDataBundle['boundary']>('data/beijing/boundary.geojson'),
      fetchJson<BeijingDataBundle['districts']>('data/beijing/districts.geojson'),
      fetchJson<BeijingDataBundle['roads']>('data/beijing/roads.geojson'),
      fetchJson<DistrictDataBundle['boundary']>('data/district/boundary.geojson'),
      fetchJson<DistrictDataBundle['roads']>('data/district/roads.geojson'),
      fetchJson<CityDataBundle['roads']>('data/roads.geojson'),
      fetchJson<CityDataBundle['context']>('data/context.geojson'),
      fetchJson<CityDataBundle['railways']>('data/railways.geojson'),
    ]);
    this.meta = meta;
    this.districtMeta = districtMeta;
    this.beijingMeta = beijingMeta;

    // 底图叠加顺序：北京卫星底图 → 朝阳暗色底图 → 更清晰的 CBD 底图。
    this.report(9, '绘制北京市卫星底图');
    this.buildBeijingContextBasemap(beijingMeta);
    this.buildBeijingBasemap(beijingMeta);
    this.report(13, '叠加朝阳 / CBD 精细底图');
    this.buildDistrictBasemap(districtMeta);
    this.buildBasemap(meta);

    this.report(19, '绘制北京市界 / 朝阳区界与城市地块');
    this.buildBeijingBoundary(beijingBoundary, beijingDistricts, beijingMeta);
    this.buildDistrictBoundary(districtBoundary, districtMeta);
    this.buildContext(context);
    this.buildRailways(railways);

    this.report(28, '构建北京中心城区 + 朝阳路网');
    this.buildBeijingRoads(beijingRoads);
    this.buildRoads(roads);
    this.buildDistrictRoads(districtRoads);

    this.report(42, '加载北京中心城区低模体块');
    await this.buildBeijingMassing();
    this.report(52, '加载朝阳全域低模体块');
    await this.buildDistrictMassing();

    this.report(62, '启动主干道流光');
    this.buildFlow();
    this.report(70, '加载 CBD 精细白模 3D Tiles');
    await this.buildWhiteModels();

    this.report(84, '加载地标 glTF 模型');
    await this.buildLandmarks();
    this.report(94, '布置业务点位与交互');
    this.buildPois();
    this.applyLayerState();
  }

  private report(percent: number, label: string): void {
    if (this.destroyed) return;
    this.callbacks.onProgress?.({ percent: Math.round(percent), label });
  }

  /* ---------------------------------------------------------------------- */
  /* 底图 / 地块 / 铁路                                                      */
  /* ---------------------------------------------------------------------- */

  private buildBasemap(meta: DataMeta | null): void {
    const summary = summarizeMeta(meta);
    const rectangle = summary.basemapRectangle;
    const file = summary.basemapFile;
    if (!rectangle || !file) {
      this.callbacks.onNotice?.('未找到离线底图，场景将使用暗色矢量基底。');
      return;
    }
    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: assetUrl(file.startsWith('data/') ? file : `data/${file}`),
        rectangle: bboxToRectangle(rectangle),
        // Cesium 1.147 的构造函数在 debug 检查里要求显式宽高；提供真实图片尺寸
        // 比默认值更有利于 mipmap 采样与清晰度。
        tileWidth: summary.basemapWidth,
        tileHeight: summary.basemapHeight,
        credit: '© OpenStreetMap contributors',
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      layer.brightness = 1.38;
      layer.contrast = 1.15;
      layer.saturation = 1.0;
      layer.gamma = 1;
      this.basemapLayer = layer;
      provider.errorEvent.addEventListener(() => {
        this.callbacks.onNotice?.('离线底图加载失败，已切换为纯矢量基底。');
        if (!this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(layer, true);
      });
    } catch (error) {
      console.warn('[CBD] 底图创建失败', error);
    }
  }

  /** 最外层低分辨率卫星上下文，覆盖初始北京全境视距；z11 市域底图叠在它上面。 */
  private buildBeijingContextBasemap(meta: BeijingMeta | null): void {
    const basemap = meta?.basemapContext;
    if (!basemap?.rectangle) return;
    const raw = String(basemap.file || 'data/beijing/basemap-context.jpg').replace(/^\/+/, '');
    const file = raw.startsWith('data/') ? raw : `data/beijing/${raw}`;
    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: assetUrl(file),
        rectangle: bboxToRectangle(basemap.rectangle),
        tileWidth: typeof basemap.width === 'number' ? basemap.width : 2816,
        tileHeight: typeof basemap.height === 'number' ? basemap.height : 3072,
        credit: typeof basemap.credit === 'string'
          ? basemap.credit
          : 'Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)',
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      this.beijingContextBasemapLayer = layer;
      layer.brightness = 0.62;
      layer.contrast = 1.1;
      layer.saturation = 0.45;
      layer.gamma = 0.98;
      provider.errorEvent.addEventListener(() => {
        if (!this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(layer, true);
      });
    } catch (error) {
      console.warn('[CBD] 北京上下文底图创建失败', error);
    }
  }

  private buildBeijingBasemap(meta: BeijingMeta | null): void {
    const basemap = meta?.basemap;
    if (!basemap?.rectangle) return;
    const raw = String(basemap.file || basemap.path || basemap.url || 'data/beijing/basemap.jpg').replace(/^\/+/, '');
    const file = raw.startsWith('data/') ? raw : `data/beijing/${raw}`;
    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: assetUrl(file),
        rectangle: bboxToRectangle(basemap.rectangle),
        tileWidth: typeof basemap.width === 'number' ? basemap.width : 3072,
        tileHeight: typeof basemap.height === 'number' ? basemap.height : 2816,
        credit: typeof basemap.credit === 'string'
          ? basemap.credit
          : 'Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)',
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      // 卫星影像偏亮；压暗、降饱和后与暗色 UI / 白模统一。
      layer.brightness = 0.78;
      layer.contrast = 1.15;
      layer.saturation = 0.55;
      layer.gamma = 1;
      this.beijingBasemapLayer = layer;
      provider.errorEvent.addEventListener(() => {
        this.callbacks.onNotice?.('北京卫星底图加载失败，仍可查看行政区界与矢量路网。');
        if (!this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(layer, true);
      });
    } catch (error) {
      console.warn('[CBD] 北京底图创建失败', error);
    }
  }

  /** 从任意 GeoJSON 面要素估算一个可用的标签中心（优先 properties.center）。 */
  private featureCenter(
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>>,
  ): { lon: number; lat: number } | null {
    const center = feature.properties?.center;
    if (Array.isArray(center) && center.length >= 2 && typeof center[0] === 'number' && typeof center[1] === 'number') {
      return { lon: center[0], lat: center[1] };
    }
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    const walk = (coords: unknown): void => {
      if (!Array.isArray(coords)) return;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const lon = coords[0] as number;
        const lat = coords[1] as number;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        return;
      }
      for (const item of coords) walk(item);
    };
    walk(feature.geometry.coordinates);
    if (!Number.isFinite(minLon)) return null;
    return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
  }

  private buildBeijingBoundary(
    boundary: BeijingDataBundle['boundary'] | null,
    districts: BeijingDataBundle['districts'] | null,
    meta: BeijingMeta | null,
  ): void {
    if (!boundary?.features?.length) return;
    const dataSource = new Cesium.CustomDataSource('beijing-boundary');
    const outline = new Cesium.PolylineCollection();
    const fill = Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.008);
    const outlineColor = Cesium.Color.fromCssColorString('#8ceeff').withAlpha(0.62);

    for (const feature of boundary.features) {
      const polygons =
        feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) {
        if (!polygon?.length) continue;
        const outer: GeoJSON.Position[] = polygon[0];
        if (outer.length < 3) continue;
        const positions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.3));
        const holes = polygon.slice(1).map(
          (ring) =>
            new Cesium.PolygonHierarchy(
              ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.3)),
            ),
        );
        dataSource.entities.add(
          new Cesium.Entity({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions, holes),
              height: 0.3,
              material: new Cesium.ColorMaterialProperty(fill),
              outline: false,
            },
          }),
        );
        const linePositions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 2.2));
        if (linePositions.length >= 2) {
          outline.add({
            positions: linePositions,
            width: 2.6,
            material: Cesium.Material.fromType('Color', { color: outlineColor }),
          });
        }
      }
    }

    void this.viewer.dataSources.add(dataSource);
    this.beijingBoundaryDataSource = dataSource;
    if (outline.length) {
      this.viewer.scene.primitives.add(outline);
      this.beijingBoundaryLines = outline;
    }

    // 16 区边界单独一层，弱化到市界以下，避免总览时过密。
    if (districts?.features?.length) {
      this.districtFeatures.clear();
      for (const feature of districts.features) {
        const name = String(feature.properties?.name || '').trim();
        if (name) this.districtFeatures.set(name, feature);
      }
      const districtLines = new Cesium.PolylineCollection();
      const districtMaterial = Cesium.Material.fromType('Color', {
        color: Cesium.Color.fromCssColorString('#72a9bb').withAlpha(0.22),
      });
      for (const feature of districts.features) {
        const polygons =
          feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const polygon of polygons) {
          if (!polygon?.length) continue;
          const linePositions = polygon[0].map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 1.7));
          if (linePositions.length >= 2) {
            districtLines.add({ positions: linePositions, width: 1.1, material: districtMaterial });
          }
        }
      }
      if (districtLines.length) {
        this.viewer.scene.primitives.add(districtLines);
        this.beijingDistrictLines = districtLines;
      }
    }

    const labels = new Cesium.LabelCollection();
    const compact = this.compactViewport;
    const boundaryProps = boundary.features[0]?.properties as Record<string, unknown> | undefined;
    const boundaryCenter = boundaryProps?.center;
    const metaCenter = meta?.center;
    const center = Array.isArray(boundaryCenter)
      ? { lon: boundaryCenter[0] as number, lat: boundaryCenter[1] as number }
      : Array.isArray(metaCenter)
        ? { lon: metaCenter[0], lat: metaCenter[1] }
        : metaCenter ?? BEIJING_CENTER;
    const areaText = typeof meta?.areaKm2 === 'number' ? `${Math.round(meta.areaKm2).toLocaleString('zh-CN')} km²` : '16,410 km²';
    labels.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 260),
      text: `北京市\n${areaText}`,
      font: compact ? '600 13px "PingFang SC", "Microsoft YaHei", sans-serif' : '600 19px "PingFang SC", "Microsoft YaHei", sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#f1fcff'),
      outlineColor: Cesium.Color.fromCssColorString('#030c14').withAlpha(0.95),
      outlineWidth: 5,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#06121c').withAlpha(0.6),
      backgroundPadding: new Cesium.Cartesian2(11, 8),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: compact
        ? new Cesium.NearFarScalar(60000, 0.9, 500000, 0.9)
        : new Cesium.NearFarScalar(60000, 1.0, 500000, 0.88),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(30000, 500000),
    });

    if (districts?.features?.length) {
      for (const feature of districts.features) {
        if (compact) continue;
        const name = String(feature.properties?.name || '').trim();
        if (!name) continue;
        const c = this.featureCenter(feature);
        if (!c) continue;
        labels.add({
          position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 55),
          text: name,
          font: '500 12px "PingFang SC", "Microsoft YaHei", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#a9d9e7').withAlpha(0.82),
          outlineColor: Cesium.Color.fromCssColorString('#030a10').withAlpha(0.85),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#041019').withAlpha(0.4),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(30000, 1.0, 240000, 0.85),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(15000, 240000),
          translucencyByDistance: new Cesium.NearFarScalar(30000, 1.0, 240000, 0.55),
        });
      }
    }
    this.viewer.scene.primitives.add(labels);
    this.beijingLabels = labels;
  }

  private buildBeijingRoads(roads: BeijingDataBundle['roads'] | null): void {
    if (!roads?.features?.length) return;
    const major = new Cesium.PolylineCollection();
    const minor = new Cesium.PolylineCollection();
    const majorMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#5e8c9c').withAlpha(0.34),
    });
    const minorMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#284c5a').withAlpha(0.28),
    });
    const majorClasses = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']);

    for (const feature of roads.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as GeoJSON.Position[];
      if (coords.length < 2) continue;
      const klass = String(feature.properties?.class || '');
      const isMajor = majorClasses.has(klass);
      (isMajor ? major : minor).add({
        positions: lineToPositions(coords, 1.5),
        width: isMajor ? 3.2 : 1.15,
        material: isMajor ? majorMaterial : minorMaterial,
      });
    }
    if (major.length) {
      this.viewer.scene.primitives.add(major);
      this.beijingMajorRoads = major;
    }
    if (minor.length) {
      this.viewer.scene.primitives.add(minor);
      this.beijingMinorRoads = minor;
    }
  }

  private async buildBeijingMassing(): Promise<void> {
    const url = String(
      this.beijingMeta?.tiles?.massing?.tileset || 'data/beijing/tiles/massing/tileset.json',
    ).replace(/^\/+/, '');
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(assetUrl(url), {
        // 单 root、无 LOD 的 instanced tileset：若 maxSSE 太大，远视距（北京全境）
        // Cesium 会判断 root 已足够精细而跳过 content 请求；压到 4 保证首屏体块加载。
        maximumScreenSpaceError: 0.1,
        dynamicScreenSpaceError: false,
        shadows: Cesium.ShadowMode.DISABLED,
      });
      tileset.show = this.layerState.beijingMassing;
      this.viewer.scene.primitives.add(tileset);
      this.beijingMassing = tileset;
    } catch (error) {
      console.warn('[CBD] 北京中心城区体块加载失败', error);
      this.callbacks.onNotice?.('北京中心城区体块未加载，仍可浏览卫星底图与地标。');
    }
  }

  private buildDistrictBasemap(meta: DistrictMeta | null): void {
    const basemap = meta?.basemap;
    if (!basemap?.rectangle) return;
    const file = String(basemap.file || basemap.path || basemap.url || 'data/district/basemap.jpg').replace(/^\/+/, '');
    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: assetUrl(file),
        rectangle: bboxToRectangle(basemap.rectangle),
        tileWidth: typeof basemap.width === 'number' ? basemap.width : 3072,
        tileHeight: typeof basemap.height === 'number' ? basemap.height : 2304,
        credit: '© OpenStreetMap contributors',
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      layer.brightness = 1.32;
      layer.contrast = 1.1;
      layer.saturation = 0.92;
      this.districtBasemapLayer = layer;
      provider.errorEvent.addEventListener(() => {
        this.callbacks.onNotice?.('朝阳区全域底图加载失败，仍可查看矢量路网与体块。');
        if (!this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(layer, true);
      });
    } catch (error) {
      console.warn('[CBD] 朝阳区底图创建失败', error);
    }
  }

  private buildDistrictBoundary(
    boundary: DistrictDataBundle['boundary'] | null,
    meta: DistrictMeta | null,
  ): void {
    if (!boundary?.features?.length) return;
    const dataSource = new Cesium.CustomDataSource('chaoyang-boundary');
    const outline = new Cesium.PolylineCollection();
    const fill = Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.014);
    const outlineColor = Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.68);

    for (const feature of boundary.features) {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) {
        if (!polygon?.length) continue;
        const outer: GeoJSON.Position[] = polygon[0];
        const positions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.25));
        if (positions.length < 3) continue;
        const holes = polygon.slice(1).map(
          (ring: GeoJSON.Position[]) =>
            new Cesium.PolygonHierarchy(
              ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.25)),
            ),
        );
        dataSource.entities.add(
          new Cesium.Entity({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions, holes),
              height: 0.25,
              material: new Cesium.ColorMaterialProperty(fill),
              outline: false,
            },
          }),
        );

        const linePositions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 1.6));
        if (linePositions.length >= 2) {
          outline.add({
            positions: linePositions,
            width: 2.4,
            material: Cesium.Material.fromType('Color', { color: outlineColor }),
          });
        }
      }
    }

    void this.viewer.dataSources.add(dataSource);
    this.districtBoundaryDataSource = dataSource;
    if (outline.length) {
      this.viewer.scene.primitives.add(outline);
      this.districtBoundaryLines = outline;
    }

    const labels = new Cesium.LabelCollection();
    const compact = this.compactViewport;
    const center = meta?.center ?? DISTRICT_CENTER;
    const areaText = typeof meta?.areaKm2 === 'number' ? `${meta.areaKm2.toFixed(1)} km²` : '465 km²';
    labels.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 120),
      text: `北京市 · 朝阳区\n${areaText}`,
      font: compact ? '600 12px "PingFang SC", "Microsoft YaHei", sans-serif' : '600 17px "PingFang SC", "Microsoft YaHei", sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#eefbff'),
      outlineColor: Cesium.Color.fromCssColorString('#030c14').withAlpha(0.95),
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#06121c').withAlpha(0.62),
      backgroundPadding: new Cesium.Cartesian2(10, 7),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: compact ? new Cesium.NearFarScalar(5000, 0.8, 70000, 0.8) : new Cesium.NearFarScalar(5000, 1.0, 70000, 0.95),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(3000, 90000),
    });

    for (const label of DISTRICT_LABELS) {
      if (compact) continue;
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(label.lon, label.lat, 30),
        text: label.name,
        font: '500 13px "PingFang SC", "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#bfeaf8').withAlpha(0.9),
        outlineColor: Cesium.Color.fromCssColorString('#030a10').withAlpha(0.9),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#041019').withAlpha(0.42),
        backgroundPadding: new Cesium.Cartesian2(5, 3),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(3000, 1.0, 55000, 0.85),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(6500, 60000),
        translucencyByDistance: new Cesium.NearFarScalar(8000, 1.0, 60000, 0.7),
      });
    }
    this.viewer.scene.primitives.add(labels);
    this.districtBoundaryLabels = labels;
  }

  private buildDistrictRoads(roads: DistrictDataBundle['roads'] | null): void {
    if (!roads?.features?.length) return;
    const major = new Cesium.PolylineCollection();
    const minor = new Cesium.PolylineCollection();
    const majorMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#8fbcca').withAlpha(0.42),
    });
    const minorMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#2e5668').withAlpha(0.38),
    });
    const majorClasses = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']);

    for (const feature of roads.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as GeoJSON.Position[];
      if (coords.length < 2) continue;
      const klass = String(feature.properties?.class || '');
      const isMajor = majorClasses.has(klass);
      (isMajor ? major : minor).add({
        positions: lineToPositions(coords, 1.8),
        width: isMajor ? 4.4 : 1.5,
        material: isMajor ? majorMaterial : minorMaterial,
      });
    }

    if (major.length) {
      this.viewer.scene.primitives.add(major);
      this.districtMajorRoads = major;
    }
    if (minor.length) {
      this.viewer.scene.primitives.add(minor);
      this.districtMinorRoads = minor;
    }
  }

  private async buildDistrictMassing(): Promise<void> {
    const url = String(
      this.districtMeta?.tiles?.massing?.tileset || 'data/district/tiles/district-massing/tileset.json',
    ).replace(/^\/+/, '');
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(assetUrl(url), {
        maximumScreenSpaceError: 32,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.002,
        shadows: Cesium.ShadowMode.DISABLED,
      });
      tileset.show = this.layerState.districtMassing;
      this.viewer.scene.primitives.add(tileset);
      this.districtMassing = tileset;
    } catch (error) {
      console.warn('[CBD] 朝阳区低模体块加载失败', error);
      this.callbacks.onNotice?.('朝阳区全域体块未加载，仍可浏览 CBD 精细模型。');
    }
  }

  private buildContext(context: CityDataBundle['context'] | null): void {
    if (!context?.features?.length) return;
    const dataSource = new Cesium.CustomDataSource('cbd-context');

    for (const feature of context.features) {
      const kind = String(feature.properties?.kind || 'block');
      const color = kind === 'water' ? COLORS.water : kind === 'park' ? COLORS.park : COLORS.block;
      const polygons: GeoJSON.Position[][][] =
        feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) {
        if (!polygon?.length) continue;
        const outer: GeoJSON.Position[] = polygon[0];
        const positions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.35));
        if (positions.length < 3) continue;
        const holes = polygon.slice(1).map(
          (ring: GeoJSON.Position[]) =>
            new Cesium.PolygonHierarchy(
              ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.35)),
            ),
        );
        const entity = new Cesium.Entity({
          id: `context-${kind}-${Math.random().toString(36).slice(2, 9)}`,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions, holes),
            height: 0.35,
            material: new Cesium.ColorMaterialProperty(color),
            outline: false,
            perPositionHeight: false,
          },
        });
        dataSource.entities.add(entity);
      }
    }
    void this.viewer.dataSources.add(dataSource);
    this.contextDataSource = dataSource;
  }

  private buildRailways(railways: CityDataBundle['railways'] | null): void {
    if (!railways?.features?.length) return;
    const collection = new Cesium.PolylineCollection();
    for (const feature of railways.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const positions = lineToPositions(feature.geometry.coordinates, 1.05);
      if (positions.length < 2) continue;
      const isSubway = String(feature.properties?.kind || '').includes('subway') || String(feature.properties?.name || '').includes('地铁');
      collection.add({
        positions,
        width: isSubway ? 2.2 : 1.4,
        material: Cesium.Material.fromType('Color', {
          color: isSubway ? Cesium.Color.fromCssColorString('#2d6b78').withAlpha(0.5) : Cesium.Color.fromCssColorString('#1c303d').withAlpha(0.6),
        }),
      });
    }
    if (collection.length) {
      this.viewer.scene.primitives.add(collection);
      this.railwayLines = collection;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 道路与流光                                                             */
  /* ---------------------------------------------------------------------- */

  private buildRoads(roads: CityDataBundle['roads'] | null): void {
    if (!roads?.features?.length) {
      this.callbacks.onNotice?.('道路数据缺失，已跳过路网绘制。');
      return;
    }

    const midCollection = new Cesium.PolylineCollection();
    const minorCollection = new Cesium.PolylineCollection();
    const majorCollection = new Cesium.PolylineCollection();
    const majorCoreCollection = new Cesium.PolylineCollection();
    const majorHaloCollection = new Cesium.PolylineCollection();
    const overviewCollection = new Cesium.PolylineCollection();
    const overviewMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#628a9c').withAlpha(0.38),
    });
    const labelCollection = new Cesium.LabelCollection();
    const labelCandidates = new Map<string, Array<GeoJSON.Position[]>>();

    // 共享材质：445 条主干道放进同一个 Primitive，避免逐条 Entity；
    // PolylineCollection 会按材质/顶点缓冲合批，这也是 Primitive API 的收益所在。
    const majorGlowWarm = Cesium.Material.fromType('PolylineGlow', {
      color: Cesium.Color.fromCssColorString('#ffbd6f').withAlpha(0.5),
      glowPower: 0.22,
      taperPower: 0.7,
    });
    const majorGlowCool = Cesium.Material.fromType('PolylineGlow', {
      color: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.48),
      glowPower: 0.2,
      taperPower: 0.7,
    });
    const majorCoreMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#ffe8c4').withAlpha(0.82),
    });
    const majorCoreCoolMaterial = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#bff7ff').withAlpha(0.8),
    });
    // 宽而淡的光晕层，配合窄亮芯形成「霓虹道路」；全部同材质，合批为 2 个 draw call
    const majorHaloWarm = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#ffb35c').withAlpha(0.075),
    });
    const majorHaloCool = Cesium.Material.fromType('Color', {
      color: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.065),
    });

    for (const feature of roads.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as GeoJSON.Position[];
      if (coords.length < 2) continue;
      const klass = String(feature.properties?.class || feature.properties?.highway || '');
      const name = String(feature.properties?.name || '');
      const isTunnel = String(feature.properties?.tunnel || '') === 'yes';
      const overviewPositions = lineToPositions(coords, 1.85);
      const overviewWidth = MAJOR_CLASSES.has(klass) ? 2.6 : MID_CLASSES.has(klass) ? 1.5 : 0.9;
      overviewCollection.add({ positions: overviewPositions, width: overviewWidth, material: overviewMaterial });

      if (MAJOR_CLASSES.has(klass)) {
        const height = isTunnel ? 1.6 : 2.4;
        const positions = lineToPositions(coords, height);
        const warm = klass.startsWith('motorway') || klass.startsWith('trunk') || klass.startsWith('primary');
        majorHaloCollection.add({
          positions,
          width: 17,
          material: warm ? majorHaloWarm : majorHaloCool,
        });
        majorCollection.add({
          positions,
          width: 8,
          material: warm ? majorGlowWarm : majorGlowCool,
        });
        majorCoreCollection.add({
          positions,
          width: 1.45,
          material: warm ? majorCoreMaterial : majorCoreCoolMaterial,
        });

        this.majorPaths.push({ coords, klass });
        if (name) {
          if (!labelCandidates.has(name)) labelCandidates.set(name, []);
          labelCandidates.get(name)!.push(coords);
        }
      } else if (MID_CLASSES.has(klass)) {
        const positions = lineToPositions(coords, isTunnel ? 1.0 : 1.55);
        midCollection.add({
          positions,
          width: klass.startsWith('secondary') ? 2.4 : 1.7,
          material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.fromCssColorString('#2c6e83').withAlpha(0.46),
          }),
        });
        if (name) {
          if (!labelCandidates.has(name)) labelCandidates.set(name, []);
          labelCandidates.get(name)!.push(coords);
        }
      } else if (MINOR_CLASSES.has(klass)) {
        minorCollection.add({
          positions: lineToPositions(coords, 1.15),
          width: 1.05,
          material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.fromCssColorString('#153243').withAlpha(0.58),
          }),
        });
      }
    }

    if (overviewCollection.length) {
      this.viewer.scene.primitives.add(overviewCollection);
      this.overviewRoads = overviewCollection;
    }
    if (majorHaloCollection.length) {
      this.viewer.scene.primitives.add(majorHaloCollection);
      this.majorRoadHalos = majorHaloCollection;
    }
    if (majorCollection.length) {
      this.viewer.scene.primitives.add(majorCollection);
      this.majorRoads = majorCollection;
      if (majorCoreCollection.length) {
        this.viewer.scene.primitives.add(majorCoreCollection);
        this.majorRoadCores = majorCoreCollection;
      }
    }
    if (midCollection.length) {
      this.viewer.scene.primitives.add(midCollection);
      this.midRoads = midCollection;
    }
    if (minorCollection.length) {
      this.viewer.scene.primitives.add(minorCollection);
      this.minorRoads = minorCollection;
    }

    // 道路名称：同名只标注一次，取最长的一段中点
    for (const [name, lines] of labelCandidates) {
      if (labelCollection.length >= 18) break;
      const longest = lines.sort((a, b) => b.length - a.length)[0];
      const midpoint = longestLineMidpoint(longest);
      if (!midpoint) continue;
      labelCollection.add({
        position: Cesium.Cartesian3.fromDegrees(midpoint[0], midpoint[1], 6),
        text: name,
        font: '500 11px "PingFang SC", "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#87a9bb').withAlpha(0.82),
        outlineColor: Cesium.Color.fromCssColorString('#04080d').withAlpha(0.9),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2600),
        scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 2600, 0.7),
      });
    }
    if (labelCollection.length) {
      this.viewer.scene.primitives.add(labelCollection);
      this.roadLabels = labelCollection;
    }

    this.buildCityRings();
  }

  private buildCityRings(): void {
    const center = Cesium.Cartesian3.fromDegrees(CITY_CENTER.lon, CITY_CENTER.lat, 0);
    for (const [radius, alpha] of [
      [520, 0.12],
      [1050, 0.08],
      [1780, 0.05],
    ] as const) {
      this.landmarkDecor.push(
        this.viewer.entities.add({
          position: center,
          ellipse: {
            semiMajorAxis: radius,
            semiMinorAxis: radius,
            height: 0.6,
            material: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.008),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(alpha),
            outlineWidth: 1,
          },
        }),
      );
    }
    const bbox = this.meta?.coreBbox || this.meta?.bbox;
    if (bbox) {
      const [w, s, e, n] = bbox;
      this.landmarkDecor.push(
        this.viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              w, s, 3,
              e, s, 3,
              e, n, 3,
              w, n, 3,
              w, s, 3,
            ]),
            width: 1.2,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.3),
              dashLength: 18,
            }),
            arcType: Cesium.ArcType.GEODESIC,
          },
        }),
      );
    }
  }

  private buildFlow(): void {
    if (!this.majorPaths.length) return;
    const collection = new Cesium.BillboardCollection({ scene: this.viewer.scene });
    const dotImages = {
      warm: createGlowDot('#ffc46b'),
      cool: createGlowDot('#6ce5ff'),
    };

    for (const path of this.majorPaths) {
      const route = this.sampleRoute(path.coords, 15);
      if (!route || route.length < 300) continue;
      const particles = Math.min(3, Math.max(1, Math.round(route.length / 900)));
      for (let i = 0; i < particles; i += 1) {
        const img = path.klass.startsWith('primary') ? dotImages.cool : dotImages.warm;
        const billboard = collection.add({
          position: route.samples[0],
          image: img,
          width: 18,
          height: 18,
          scale: 0.82,
          scaleByDistance: new Cesium.NearFarScalar(300, 1.15, 4500, 0.35),
          disableDepthTestDistance: 0,
        });
        this.flowParticles.push({
          billboard,
          route: route,
          speed: 26 + (i % 3) * 7,
          offset: (route.length / particles) * i,
        });
      }
      if (this.flowParticles.length >= 160) break;
    }

    if (collection.length) {
      this.viewer.scene.primitives.add(collection);
      this.flowBillboards = collection;
      this.flowBillboards.show = this.layerState.flow;
      this.flowStart = performance.now();
    }
  }

  private sampleRoute(coords: GeoJSON.Position[], stepMeters: number): FlowRoute | null {
    if (coords.length < 2) return null;
    // 先按折线累计长度插值，得到等距采样点，流光位置更新时可直接索引，避免每帧分配对象
    const pieces: Array<{ a: GeoJSON.Position; b: GeoJSON.Position; start: number; len: number }> = [];
    let total = 0;
    for (let i = 0; i < coords.length - 1; i += 1) {
      const len = distanceMeters(coords[i], coords[i + 1]);
      pieces.push({ a: coords[i], b: coords[i + 1], start: total, len });
      total += len;
    }
    if (!Number.isFinite(total) || total < 20) return null;
    const count = Math.max(2, Math.floor(total / stepMeters));
    const step = total / count;
    const samples: Cesium.Cartesian3[] = [];
    let pieceIndex = 0;
    for (let i = 0; i <= count; i += 1) {
      const s = Math.min(total, i * step);
      while (pieceIndex < pieces.length - 1 && s > pieces[pieceIndex].start + pieces[pieceIndex].len) pieceIndex += 1;
      const piece = pieces[pieceIndex];
      const t = piece.len > 0 ? Math.min(1, Math.max(0, (s - piece.start) / piece.len)) : 0;
      const lon = piece.a[0] + (piece.b[0] - piece.a[0]) * t;
      const lat = piece.a[1] + (piece.b[1] - piece.a[1]) * t;
      samples.push(Cesium.Cartesian3.fromDegrees(lon, lat, 4.2));
    }
    return { samples, length: total, step };
  }

  /* ---------------------------------------------------------------------- */
  /* 白模 3D Tiles                                                          */
  /* ---------------------------------------------------------------------- */

  private async buildWhiteModels(): Promise<void> {
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(assetUrl('data/tiles/white-models/tileset.json'), {
        maximumScreenSpaceError: 16,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.002,
        shadows: Cesium.ShadowMode.DISABLED,
      });
      tileset.show = this.layerState.whiteModels;
      // 白模体块统一提亮一档，避免在暗色底图上发灰；真实生产数据建议通过
      // 3D Tiles metadata / batch table 做按高度或业态的分级配色。
      tileset.style = new Cesium.Cesium3DTileStyle({
        color: "color('#d7e7f2')",
      });
      this.viewer.scene.primitives.add(tileset);
      this.whiteTileset = tileset;
    } catch (error) {
      console.warn('[CBD] 3D Tiles 白模加载失败，改用 GeoJSON 兜底', error);
      this.callbacks.onNotice?.('白模 3D Tiles 加载失败，已切换为 GeoJSON 建筑兜底渲染。');
      await this.buildWhiteFallback();
    }
  }

  private async buildWhiteFallback(): Promise<void> {
    try {
      const dataSource = await Cesium.GeoJsonDataSource.load(assetUrl('data/buildings-fallback.geojson'), {
        clampToGround: false,
        markerSize: 0,
        describe: undefined,
      });
      for (const entity of dataSource.entities.values) {
        const polygon = entity.polygon;
        if (!polygon) continue;
        const heightValue = entity.properties?.height?.getValue();
        const height = Number.isFinite(Number(heightValue)) ? Math.max(3, Number(heightValue)) : 12;
        polygon.height = new Cesium.ConstantProperty(0);
        polygon.extrudedHeight = new Cesium.ConstantProperty(height);
        polygon.material = new Cesium.ColorMaterialProperty(COLORS.fallbackModel);
        polygon.outline = new Cesium.ConstantProperty(false);
        polygon.closeTop = new Cesium.ConstantProperty(true);
        polygon.shadows = new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED);
      }
      dataSource.show = this.layerState.whiteModels;
      this.whiteFallback = dataSource;
      void this.viewer.dataSources.add(dataSource);
    } catch (error) {
      console.warn('[CBD] GeoJSON 兜底白模也加载失败', error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 地标 glTF                                                              */
  /* ---------------------------------------------------------------------- */

  private async buildLandmarks(): Promise<void> {
    const labels = new Cesium.LabelCollection();

    // 地标模型并行加载；6 个模型（含 3D Warehouse 的 6 个免费模型）串行 await
    // 会把首屏拖到 20s+，并行加载显著缩短 loading。
    const loadOne = async (landmark: (typeof LANDMARKS)[number]): Promise<void> => {
      try {
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
          Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, 0),
        );
        const yaw = Cesium.Matrix4.fromRotationTranslation(
          Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(landmark.yaw ?? 0)),
          Cesium.Cartesian3.ZERO,
          new Cesium.Matrix4(),
        );
        const modelMatrix = Cesium.Matrix4.multiply(enu, yaw, new Cesium.Matrix4());
        const poiDistrict = landmark.poiId ? this.poiById.get(landmark.poiId)?.district : undefined;
        const districtVisible = !this.activeDistrict || poiDistrict === this.activeDistrict;
        const model = await Cesium.Model.fromGltfAsync({
          url: assetUrl(landmark.glb),
          modelMatrix,
          // glTF 采用 x=东 / y=上 / z=南 的局部约定；Cesium 独立 Model 默认
          // forwardAxis=Z 会再绕 Y 轴转 90°，导致 CCTV 这类长轴建筑朝向错误。
          // 显式声明 forwardAxis=X，只保留 Y-up→Z-up 的轴向修正。
          forwardAxis: Cesium.Axis.X,
          scale: landmark.scale ?? 1,
          shadows: Cesium.ShadowMode.DISABLED,
          show: this.layerState.landmarks && districtVisible,
          cull: true,
        });
        if (this.destroyed) {
          model.destroy();
          return;
        }
        this.viewer.scene.primitives.add(model);
        this.landmarkModels.push(model);
        this.landmarkModelById.set(landmark.id, model);

        const label = labels.add({
          position: Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, landmark.height + 16),
          text: `${landmark.name}  ${landmark.height}m`,
          font: '600 12px "PingFang SC", "Microsoft YaHei", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#dff6ff'),
          outlineColor: Cesium.Color.fromCssColorString('#040a10').withAlpha(0.92),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#06121c').withAlpha(0.6),
          backgroundPadding: new Cesium.Cartesian2(7, 5),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 24000, 0.68),
          translucencyByDistance: new Cesium.NearFarScalar(2500, 1.0, 26000, 0.25),
          show: this.layerState.landmarks && districtVisible,
        });
        this.landmarkLabelById.set(landmark.id, label);

        const ringRadius = landmark.id === 'citic-tower' ? 66 : landmark.id === 'forbidden-city' ? 240 : 52;
        const decor = this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, 0.5),
          ellipse: {
            semiMajorAxis: ringRadius,
            semiMinorAxis: ringRadius,
            height: 0.55,
            material: Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.04),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#85e8ff').withAlpha(0.55),
            outlineWidth: 1.5,
          },
          show: this.layerState.landmarks && districtVisible,
        });
        this.landmarkDecor.push(decor);
        this.landmarkDecorById.set(landmark.id, decor);
      } catch (error) {
        console.warn(`[CBD] 地标模型加载失败：${landmark.id}`, error);
        this.callbacks.onNotice?.(`地标模型 ${landmark.name} 加载失败，其余场景不受影响。`);
      }
    };

    // 首屏只等轻量程序化地标；3D Warehouse 免费模型（约 11MB）后台加载，
    // 避免 loading 遮罩被模型解析/纹理上传拖到 20s+。
    const coreLandmarks = LANDMARKS.filter((landmark) => !landmark.glb.includes('/free/'));
    const freeLandmarks = LANDMARKS.filter((landmark) => landmark.glb.includes('/free/'));
    await Promise.all(coreLandmarks.map(loadOne));

    if (labels.length) {
      labels.show = this.layerState.landmarks;
      this.viewer.scene.primitives.add(labels);
      this.landmarkLabels = labels;
    }
    if (freeLandmarks.length) {
      this.freeLandmarksStarter = () => {
        this.freeLandmarksStarter = undefined;
        void (async () => {
          // 串行加载，避免一次性上传 11MB 纹理把主线程卡住；loading 遮罩已先隐藏。
          for (const landmark of freeLandmarks) {
            if (this.destroyed) return;
            await loadOne(landmark);
          }
        })().catch((error) => {
          console.warn('[CBD] 免费地标后台加载异常', error);
        });
      };
    }
  }

  /** 由 App 在 loading 遮罩消失后调用，避免免费模型阻塞首屏。 */
  loadFreeLandmarks(): void {
    this.freeLandmarksStarter?.();
  }

  /* ---------------------------------------------------------------------- */
  /* POI 点位                                                               */
  /* ---------------------------------------------------------------------- */

  private buildPois(): void {
    this.markerStyleKeys.clear();
    const billboards = new Cesium.BillboardCollection({ scene: this.viewer.scene });
    const labels = new Cesium.LabelCollection();

    for (const poi of POIS) {
      const meta = POI_CATEGORY_META[poi.category];
      const position = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, poi.altitude ?? 8);
      const billboard = billboards.add({
        id: poi,
        position,
        image: createPoiMarker(poi.category, false),
        width: 34,
        height: 44,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: 0.95,
        scaleByDistance: new Cesium.NearFarScalar(280, 0.95, 16000, 0.55),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
      this.poiMarkers.set(poi.id, billboard);

      const label = labels.add({
        id: poi,
        position,
        text: poi.name,
        font: '600 12px "PingFang SC", "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString(meta.color).withAlpha(0.96),
        outlineColor: Cesium.Color.fromCssColorString('#040a10').withAlpha(0.9),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -42),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 26000, 0.72),
        translucencyByDistance: new Cesium.NearFarScalar(700, 1.0, 4400, 0.15),
      });
      this.poiLabelMap.set(poi.id, label);
    }

    const pulse = billboards.add({
      position: Cesium.Cartesian3.fromDegrees(POIS[0].lon, POIS[0].lat, 9),
      image: createPulseRing('#6ce5ff'),
      width: 150,
      height: 150,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: false,
    });
    this.pulseBillboard = pulse;

    billboards.show = this.layerState.pois;
    labels.show = this.layerState.pois && !this.compactViewport;
    this.viewer.scene.primitives.add(billboards);
    this.viewer.scene.primitives.add(labels);
    this.poiBillboards = billboards;
    this.poiLabels = labels;
    this.updatePoiDistrictVisibility();
  }

  /** 相机高度跨越阈值时，切换「全域总览」与「CBD 精细」两套路网/标签，避免总览时 CBD 过曝。 */
  /** 是否处于免费地标近景（Forbidden City / Bird's Nest 等）：是则临时隐藏低模体块，避免 box 与地标模型穿插。 */
  private isFreeLandmarkCloseup(): boolean {
    const camera = this.viewer.scene.camera.positionWC;
    for (const landmark of LANDMARKS) {
      if (!landmark.glb.includes('/free/')) continue;
      const center = Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, landmark.height * 0.5);
      if (Cesium.Cartesian3.distance(camera, center) < 5200) return true;
    }
    return false;
  }

  private updateLandmarkCloseupMode(): void {
    const next = this.isFreeLandmarkCloseup();
    if (next === this.landmarkCloseupMode) return;
    this.landmarkCloseupMode = next;
    if (this.beijingMassing) {
      this.beijingMassing.show =
        this.layerState.beijingMassing && this.massingDetailMode && !next;
    }
    if (this.districtMassing) {
      this.districtMassing.show =
        this.layerState.districtMassing && this.massingDetailMode && this.districtMassingDetailMode && !next;
    }
  }

  /** 行政区要素包围盒与中心（DataV 的 center/centroid 已是 WGS84 数组）。 */
  private featureBounds(
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>>,
  ): { west: number; south: number; east: number; north: number; center: { lon: number; lat: number } } | null {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    const walk = (coords: unknown): void => {
      if (!Array.isArray(coords)) return;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const lon = coords[0] as number;
        const lat = coords[1] as number;
        west = Math.min(west, lon);
        east = Math.max(east, lon);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
        return;
      }
      for (const item of coords) walk(item);
    };
    walk(feature.geometry.coordinates);
    if (!Number.isFinite(west)) return null;
    const props = feature.properties;
    const centerValue = props?.center;
    const centroidValue = props?.centroid;
    const center = Array.isArray(centerValue)
      ? { lon: centerValue[0] as number, lat: centerValue[1] as number }
      : Array.isArray(centroidValue)
        ? { lon: centroidValue[0] as number, lat: centroidValue[1] as number }
        : { lon: (west + east) / 2, lat: (south + north) / 2 };
    return { west, south, east, north, center };
  }

  /** 当前选中行政区的填充/轮廓/名称标签。 */
  private updateSelectedDistrictVisuals(): void {
    if (this.selectedDistrictDataSource) {
      this.viewer.dataSources.remove(this.selectedDistrictDataSource, true);
      this.selectedDistrictDataSource = undefined;
    }
    if (this.selectedDistrictLines) {
      this.viewer.scene.primitives.remove(this.selectedDistrictLines);
      this.selectedDistrictLines = undefined;
    }
    if (this.selectedDistrictLabels) {
      this.viewer.scene.primitives.remove(this.selectedDistrictLabels);
      this.selectedDistrictLabels = undefined;
    }
    const name = this.activeDistrict;
    if (!name) return;
    const feature = this.districtFeatures.get(name);
    if (!feature) return;
    const bounds = this.featureBounds(feature);
    if (!bounds) return;

    const dataSource = new Cesium.CustomDataSource('selected-district');
    const outline = new Cesium.PolylineCollection();
    const fill = Cesium.Color.fromCssColorString('#6ce5ff').withAlpha(0.035);
    const outlineColor = Cesium.Color.fromCssColorString('#8ceeff').withAlpha(0.92);
    const polygons =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      if (!polygon?.length) continue;
      const outer = polygon[0];
      const positions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.45));
      const holes = polygon.slice(1).map(
        (ring) =>
          new Cesium.PolygonHierarchy(
            ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0.45)),
          ),
      );
      dataSource.entities.add(
        new Cesium.Entity({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions, holes),
            height: 0.45,
            material: new Cesium.ColorMaterialProperty(fill),
            outline: false,
          },
        }),
      );
      const linePositions = outer.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 2.8));
      if (linePositions.length >= 2) {
        outline.add({
          positions: linePositions,
          width: 3.2,
          material: Cesium.Material.fromType('Color', { color: outlineColor }),
        });
      }
    }
    void this.viewer.dataSources.add(dataSource);
    this.selectedDistrictDataSource = dataSource;
    if (outline.length) {
      this.viewer.scene.primitives.add(outline);
      this.selectedDistrictLines = outline;
    }

    const labels = new Cesium.LabelCollection();
    const area = Number(feature.properties?.areaKm2);
    const areaText = Number.isFinite(area) ? ` · ${area.toFixed(1)} km²` : '';
    const en = String(feature.properties?.['name:en'] || feature.properties?.en || '').trim();
    labels.add({
      position: Cesium.Cartesian3.fromDegrees(bounds.center.lon, bounds.center.lat, 90),
      text: `${name}${en ? `\n${en}` : ''}${areaText}`.trim(),
      font: '600 17px "PingFang SC", "Microsoft YaHei", sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#eefbff'),
      outlineColor: Cesium.Color.fromCssColorString('#030c14').withAlpha(0.95),
      outlineWidth: 5,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#06121c').withAlpha(0.72),
      backgroundPadding: new Cesium.Cartesian2(10, 7),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(3000, 1.0, 160000, 0.82),
    });
    labels.show = this.layerState.beijingBoundary;
    this.viewer.scene.primitives.add(labels);
    this.selectedDistrictLabels = labels;
  }

  private updatePoiDistrictVisibility(): void {
    for (const [id, billboard] of this.poiMarkers) {
      const poi = this.poiById.get(id);
      billboard.show = !this.activeDistrict || poi?.district === this.activeDistrict;
    }
    for (const [id, label] of this.poiLabelMap) {
      const poi = this.poiById.get(id);
      label.show = !this.activeDistrict || poi?.district === this.activeDistrict;
    }
  }

  private updateLandmarkDistrictVisibility(): void {
    for (const landmark of LANDMARKS) {
      const poi = landmark.poiId ? this.poiById.get(landmark.poiId) : undefined;
      const visible =
        this.layerState.landmarks && (!this.activeDistrict || poi?.district === this.activeDistrict);
      const model = this.landmarkModelById.get(landmark.id);
      if (model) model.show = visible;
      const label = this.landmarkLabelById.get(landmark.id);
      if (label) label.show = visible;
      const decor = this.landmarkDecorById.get(landmark.id);
      if (decor) decor.show = visible;
    }
    if (this.landmarkLabels) this.landmarkLabels.show = this.layerState.landmarks && !this.overviewMode;
  }

  /** 选中一个行政区：收敛 POI/地标，并飞入该区边界。 */
  focusDistrict(name: string, options: { immediate?: boolean } = {}): void {
    const feature = this.districtFeatures.get(name);
    if (!feature) return;
    this.clearSelection();
    this.stopOrbit();
    this.activeDistrict = name;
    this.updateSelectedDistrictVisuals();
    this.updatePoiDistrictVisibility();
    this.updateLandmarkDistrictVisibility();
    this.applyLayerState();
    const bounds = this.featureBounds(feature);
    if (!bounds) return;
    const lat = bounds.center.lat * (Math.PI / 180);
    const widthM = (bounds.east - bounds.west) * 111320 * Math.cos(lat);
    const heightM = (bounds.north - bounds.south) * 111320;
    const radius = Math.max(2500, Math.max(widthM, heightM) / 2);
    const range = Math.max(6500, radius * 2.25);
    const target = Cesium.Cartesian3.fromDegrees(bounds.center.lon, bounds.center.lat, 0);
    const offset = new Cesium.HeadingPitchRange(0.03, -1.15, range);
    if (options.immediate) {
      this.viewer.camera.lookAt(target, offset);
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      const height = this.viewer.scene.camera.positionCartographic.height;
      this.overviewMode = height > 15000;
      this.beijingLabelMode = height > 70000;
      this.massingDetailMode = height > 250;
      this.closeBasemapMode = height < 5000;
      this.districtMassingDetailMode = height > 1800;
      this.applyLayerState();
    } else {
      this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, radius), {
        offset,
        duration: 2.1,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }
  }

  private syncOverviewMode(): void {
    const height = this.viewer.scene.camera.positionCartographic.height;
    this.updateLandmarkCloseupMode();
    const closeBasemap = height < 5000;
    if (closeBasemap !== this.closeBasemapMode) {
      this.closeBasemapMode = closeBasemap;
      // 近景把卫星底图提亮，避免地标周围出现近乎全黑的“虚空”；远景保持暗色数字孪生调性。
      if (this.beijingBasemapLayer) {
        this.beijingBasemapLayer.brightness = closeBasemap ? 1.25 : 0.78;
        this.beijingBasemapLayer.contrast = closeBasemap ? 1.05 : 1.15;
      }
      if (this.beijingContextBasemapLayer) {
        this.beijingContextBasemapLayer.brightness = closeBasemap ? 1.0 : 0.62;
      }
    }
    // 极近景（<250m）才隐藏低模体块；POI 聚焦通常 600-3000m，仍保留体块作空间上下文。
    const nextMassingDetail = height > 250;
    if (nextMassingDetail !== this.massingDetailMode) {
      this.massingDetailMode = nextMassingDetail;
      if (this.beijingMassing) {
        this.beijingMassing.show =
          this.layerState.beijingMassing && nextMassingDetail && !this.landmarkCloseupMode;
      }
    }
    // 朝阳已有更精细的 CBD 白模；近景隐藏朝阳体块，避免 box 穿插 Bird's Nest / 798 等免费地标。
    const nextDistrictMassing = height > 1800;
    if (nextDistrictMassing !== this.districtMassingDetailMode) {
      this.districtMassingDetailMode = nextDistrictMassing;
      if (this.districtMassing) {
        this.districtMassing.show =
          this.layerState.districtMassing && this.massingDetailMode && nextDistrictMassing && !this.landmarkCloseupMode;
      }
    }
    const nextBeijingLabels = height > 70000;
    if (nextBeijingLabels !== this.beijingLabelMode) {
      this.beijingLabelMode = nextBeijingLabels;
      if (this.beijingLabels) this.beijingLabels.show = this.layerState.beijingBoundary && nextBeijingLabels;
    }
    const next = height > 15000;
    if (next === this.overviewMode) return;
    this.overviewMode = next;
    this.applyLayerState();
  }

  private updatePoiLabelsVisibility(): void {
    if (!this.poiLabels || !this.viewer) return;
    const height = this.viewer.scene.camera.positionCartographic.height;
    this.poiLabels.show = this.layerState.pois && !this.compactViewport && height < 12000;
  }

  /* ---------------------------------------------------------------------- */
  /* 相机 / 点位交互                                                        */
  /* ---------------------------------------------------------------------- */

  focusPoi(poi: Poi, options: { orbit?: boolean } = {}): void {
    this.stopOrbit();
    this.selectPoi(poi);
    const targetHeight = Math.max(35, (poi.height ?? 40) * 0.52);
    const target = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, targetHeight);
    const range = poi.focusRange ?? 650;
    const pitch = poi.focusPitch ?? -0.4;
    const heading = 0.32;
    this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, Math.max(30, (poi.height ?? 60) * 0.16)), {
      offset: new Cesium.HeadingPitchRange(heading, pitch, range),
      duration: 2.1,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      complete: () => {
        if (this.destroyed) return;
        if (options.orbit) this.startOrbit(poi);
      },
    });
  }

  selectPoi(poi: Poi): void {
    this.selectedPoi = poi;
    this.selectedWorld = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, (poi.altitude ?? 8) + 7);
    this.updateMarkerStyles();
    this.updatePulse();
    this.callbacks.onPoiSelect?.(poi);
    this.syncAnchor(true);
  }

  clearSelection(): void {
    if (!this.selectedPoi) return;
    this.stopOrbit();
    this.selectedPoi = null;
    this.selectedWorld = null;
    this.updateMarkerStyles();
    if (this.pulseBillboard) this.pulseBillboard.show = false;
    this.callbacks.onPoiSelect?.(null);
    this.lastAnchor = { x: 0, y: 0, visible: false };
    this.callbacks.onAnchor?.(this.lastAnchor);
  }

  orbitSelected(): void {
    if (!this.selectedPoi) return;
    this.focusPoi(this.selectedPoi, { orbit: true });
  }

  startOrbit(poi: Poi): void {
    this.selectPoi(poi);
    const targetHeight = Math.max(35, (poi.height ?? 40) * 0.52);
    const target = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, targetHeight);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(target);
    const pitch = poi.focusPitch ?? -0.4;
    const range = poi.focusRange ?? 650;
    this.orbit = {
      active: true,
      transform,
      heading: 0.32,
      pitch,
      range,
      speed: 0.14,
      lastNow: performance.now(),
    };
    this.viewer.camera.lookAtTransform(transform, new Cesium.HeadingPitchRange(this.orbit.heading, pitch, range));
    if (!this.orbitWasActive) {
      this.orbitWasActive = true;
      this.callbacks.onOrbitChange?.(true);
    }
  }

  stopOrbit(): void {
    if (!this.orbit?.active) return;
    this.orbit = null;
    // 退出 lookAt 的局部参考系，保持当前世界位姿
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    if (this.orbitWasActive) {
      this.orbitWasActive = false;
      this.callbacks.onOrbitChange?.(false);
    }
  }

  resetView(): void {
    this.activeDistrict = null;
    this.updateSelectedDistrictVisuals();
    this.updatePoiDistrictVisibility();
    this.updateLandmarkDistrictVisibility();
    this.applyLayerState();
    this.flyToConfiguredView(INITIAL_VIEW, 100000, this.getBeijingViewRange());
  }

  /** 北京全境 -> 朝阳区全域 */
  focusDistrictView(): void {
    this.focusDistrict('朝阳区');
  }

  /** 从全域总览快速回到国贸 CBD 初始视角 */
  focusCbdView(): void {
    this.activeDistrict = '朝阳区';
    this.updateSelectedDistrictVisuals();
    this.updatePoiDistrictVisibility();
    this.updateLandmarkDistrictVisibility();
    this.applyLayerState();
    this.flyToConfiguredView(CBD_VIEW, 80);
  }

  private flyToConfiguredView(
    view: { lon: number; lat: number; targetHeight: number; heading: number; pitch: number; range: number },
    radius: number,
    rangeOverride?: number,
  ): void {
    this.clearSelection();
    this.stopOrbit();
    const target = Cesium.Cartesian3.fromDegrees(view.lon, view.lat, view.targetHeight);
    this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, radius), {
      offset: new Cesium.HeadingPitchRange(view.heading, view.pitch, rangeOverride ?? view.range),
      duration: 2.2,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  zoomToOverview(): void {
    this.resetView();
  }

  /* ---------------------------------------------------------------------- */
  /* 图层控制                                                               */
  /* ---------------------------------------------------------------------- */

  setLayer(key: LayerKey, visible: boolean): void {
    this.layerState[key] = visible;
    this.applyLayerState();
  }

  private applyLayerState(): void {
    const chaoyangActive = !this.activeDistrict || this.activeDistrict === '朝阳区';
    if (this.beijingMassing) {
      this.beijingMassing.show =
        this.layerState.beijingMassing && this.massingDetailMode && !this.landmarkCloseupMode;
    }
    if (this.beijingBoundaryDataSource) this.beijingBoundaryDataSource.show = this.layerState.beijingBoundary;
    if (this.beijingBoundaryLines) this.beijingBoundaryLines.show = this.layerState.beijingBoundary;
    if (this.beijingDistrictLines) {
      this.beijingDistrictLines.show = this.layerState.beijingBoundary && !this.activeDistrict;
    }
    if (this.beijingLabels) {
      this.beijingLabels.show =
        this.layerState.beijingBoundary && this.beijingLabelMode && !this.activeDistrict;
    }
    if (this.selectedDistrictDataSource) {
      this.selectedDistrictDataSource.show = this.layerState.beijingBoundary && !!this.activeDistrict;
    }
    if (this.selectedDistrictLines) {
      this.selectedDistrictLines.show = this.layerState.beijingBoundary && !!this.activeDistrict;
    }
    if (this.selectedDistrictLabels) {
      this.selectedDistrictLabels.show = this.layerState.beijingBoundary && !!this.activeDistrict;
    }
    if (this.beijingMajorRoads) this.beijingMajorRoads.show = this.layerState.roads;
    if (this.beijingMinorRoads) this.beijingMinorRoads.show = this.layerState.roads;
    if (this.whiteTileset) this.whiteTileset.show = this.layerState.whiteModels && chaoyangActive;
    if (this.whiteFallback) this.whiteFallback.show = this.layerState.whiteModels && chaoyangActive;
    if (this.districtMassing) {
      this.districtMassing.show =
        this.layerState.districtMassing &&
        this.massingDetailMode &&
        this.districtMassingDetailMode &&
        !this.landmarkCloseupMode &&
        chaoyangActive;
    }
    if (this.districtBoundaryDataSource) this.districtBoundaryDataSource.show = this.layerState.boundary && chaoyangActive;
    if (this.districtBoundaryLines) this.districtBoundaryLines.show = this.layerState.boundary && chaoyangActive;
    if (this.districtBoundaryLabels) {
      this.districtBoundaryLabels.show = this.layerState.boundary && this.overviewMode && !this.activeDistrict;
    }
    if (this.districtMajorRoads) this.districtMajorRoads.show = this.layerState.roads && chaoyangActive;
    if (this.districtMinorRoads) this.districtMinorRoads.show = this.layerState.roads && chaoyangActive;
    this.updateLandmarkDistrictVisibility();
    const showDetailedCore = this.layerState.roads && !this.overviewMode && chaoyangActive;
    if (this.majorRoads) this.majorRoads.show = showDetailedCore;
    if (this.majorRoadCores) this.majorRoadCores.show = showDetailedCore;
    if (this.majorRoadHalos) this.majorRoadHalos.show = showDetailedCore;
    if (this.midRoads) this.midRoads.show = showDetailedCore;
    if (this.minorRoads) this.minorRoads.show = showDetailedCore;
    if (this.roadLabels) this.roadLabels.show = showDetailedCore;
    if (this.overviewRoads) this.overviewRoads.show = this.layerState.roads && this.overviewMode && chaoyangActive;
    if (this.flowBillboards) {
      this.flowBillboards.show = this.layerState.flow && this.layerState.roads && !this.overviewMode && chaoyangActive;
    }
    if (this.contextDataSource) this.contextDataSource.show = this.layerState.context && chaoyangActive;
    if (this.railwayLines) this.railwayLines.show = this.layerState.context && chaoyangActive;
    if (this.poiBillboards) this.poiBillboards.show = this.layerState.pois;
    this.updatePoiDistrictVisibility();
    this.updatePoiLabelsVisibility();
    if (this.pulseBillboard) {
      this.pulseBillboard.show =
        this.layerState.pois &&
        !!this.selectedPoi &&
        (!this.activeDistrict || this.selectedPoi.district === this.activeDistrict);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 交互绑定                                                               */
  /* ---------------------------------------------------------------------- */

  private bindCameraInput(): void {
    const canvas = this.viewer.canvas;
    const stopOrbit = () => {
      if (this.orbit?.active) this.stopOrbit();
    };
    const preventContextMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener('pointerdown', stopOrbit);
    canvas.addEventListener('wheel', stopOrbit, { passive: true });
    canvas.addEventListener('touchstart', stopOrbit, { passive: true });
    // 右键拖拽用于倾斜，右键释放时不要弹出浏览器菜单
    canvas.addEventListener('contextmenu', preventContextMenu);
    this.inputCleanup.push(() => {
      canvas.removeEventListener('pointerdown', stopOrbit);
      canvas.removeEventListener('wheel', stopOrbit);
      canvas.removeEventListener('touchstart', stopOrbit);
      canvas.removeEventListener('contextmenu', preventContextMenu);
    });
  }

  private bindPicking(): void {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = this.viewer.scene.pick(movement.position);
      const poi = this.poiFromPicked(picked);
      if (poi) {
        this.selectPoi(poi);
      } else {
        this.clearSelection();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      // mousemove 会以 100+ Hz 触发，每次都做 scene.pick 会在拖拽时抖动；
      // 节流到 ~15Hz，并且只在悬停目标变化时才刷新标记样式。
      const now = performance.now();
      if (now - this.lastHoverPickAt < 66) return;
      this.lastHoverPickAt = now;
      const picked = this.viewer.scene.pick(movement.endPosition);
      const poi = this.poiFromPicked(picked);
      const nextId = poi?.id ?? null;
      if (nextId !== this.hoveredPoiId) {
        this.hoveredPoiId = nextId;
        this.updateMarkerStyles();
      }
      this.viewer.canvas.style.cursor = poi ? 'pointer' : '';
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.screenSpaceHandler = handler;
  }

  private poiFromPicked(picked: unknown): Poi | null {
    if (!picked || typeof picked !== 'object') return null;
    const id = (picked as { id?: unknown }).id;
    if (id && typeof id === 'object' && 'category' in id && 'id' in id) {
      const candidate = id as Poi;
      if (this.poiById.has(candidate.id)) return candidate;
    }
    return null;
  }

  private updateMarkerStyles(): void {
    // 只有在「选中 / 悬停」状态真的变化时才改 Cesium 属性，避免高频重设
    // 图片 / 字体导致 Billboard 与 Label 纹理反复重建。
    for (const [id, billboard] of this.poiMarkers) {
      const selected = this.selectedPoi?.id === id;
      const hovered = this.hoveredPoiId === id;
      const styleKey = `${selected ? 's' : ''}${hovered ? 'h' : ''}`;
      if (this.markerStyleKeys.get(id) === styleKey) continue;
      this.markerStyleKeys.set(id, styleKey);

      billboard.scale = selected ? 1.16 : hovered ? 1.06 : 0.95;
      const poi = this.poiById.get(id);
      if (!poi) continue;
      billboard.image = createPoiMarker(poi.category, selected);
      const label = this.poiLabelMap.get(id);
      if (label) {
        const meta = POI_CATEGORY_META[poi.category];
        label.fillColor = Cesium.Color.fromCssColorString(selected || hovered ? '#ffffff' : meta.color).withAlpha(selected ? 1 : 0.86);
        label.font = `${selected ? '700' : '600'} 12px "PingFang SC", "Microsoft YaHei", sans-serif`;
      }
    }
  }

  private updatePulse(): void {
    if (!this.pulseBillboard || !this.selectedPoi) return;
    const poi = this.selectedPoi;
    const color = POI_CATEGORY_META[poi.category].color;
    this.pulseBillboard.show = this.layerState.pois;
    this.pulseBillboard.position = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, (poi.altitude ?? 8) - 2);
    this.pulseBillboard.image = createPulseRing(color);
    this.pulseBillboard.width = poi.category === 'landmark' ? 190 : 150;
    this.pulseBillboard.height = this.pulseBillboard.width;
  }

  /* ---------------------------------------------------------------------- */
  /* 渲染钩子 / HUD                                                        */
  /* ---------------------------------------------------------------------- */

  private installRenderHooks(): void {
    const scene = this.viewer.scene;
    this.preRenderCleanup = scene.preRender.addEventListener(() => {
      if (this.destroyed) return;
      this.updateFlow();
      this.updateOrbit();
    });
    this.postRenderCleanup = scene.postRender.addEventListener(() => {
      if (this.destroyed) return;
      this.updatePulseAnimation();
      this.syncAnchor(false);
      this.updateStats();
    });
  }

  private updateFlow(): void {
    if (!this.flowBillboards?.show || !this.flowParticles.length) return;
    const t = (performance.now() - this.flowStart) / 1000;
    for (const particle of this.flowParticles) {
      const s = (particle.offset + t * particle.speed) % particle.route.length;
      const index = Math.min(particle.route.samples.length - 1, Math.max(0, Math.floor(s / particle.route.step)));
      particle.billboard.position = particle.route.samples[index];
    }
  }

  private updateOrbit(): void {
    if (!this.orbit?.active) return;
    const now = performance.now();
    const dt = Math.min(0.12, Math.max(0, (now - this.orbit.lastNow) / 1000));
    this.orbit.lastNow = now;
    this.orbit.heading += dt * this.orbit.speed;
    this.viewer.camera.lookAtTransform(
      this.orbit.transform,
      new Cesium.HeadingPitchRange(this.orbit.heading, this.orbit.pitch, this.orbit.range),
    );
  }

  private updatePulseAnimation(): void {
    if (!this.pulseBillboard?.show || !this.selectedPoi) return;
    const t = (performance.now() / 1000) % 2.2;
    const progress = t / 2.2;
    const scale = 0.75 + progress * 0.65;
    this.pulseBillboard.scale = scale;
    this.pulseBillboard.color = Cesium.Color.WHITE.withAlpha(0.85 * (1 - progress));
  }

  private syncAnchor(force: boolean): void {
    if (!this.selectedPoi || !this.selectedWorld || !this.poiBillboards?.show) {
      if (force || this.lastAnchor.visible) {
        this.lastAnchor = { x: 0, y: 0, visible: false };
        this.callbacks.onAnchor?.(this.lastAnchor);
      }
      return;
    }
    const anchor = worldToScreen(this.viewer.scene, this.selectedWorld);
    const next = {
      x: Math.round(anchor.x),
      y: Math.round(anchor.y),
      visible: anchor.visible,
    };
    if (force || next.x !== this.lastAnchor.x || next.y !== this.lastAnchor.y || next.visible !== this.lastAnchor.visible) {
      this.lastAnchor = next;
      this.callbacks.onAnchor?.(next);
    }
  }

  private updateStats(): void {
    const now = performance.now();
    this.frames += 1;
    if (now - this.lastStatsAt < 500) return;
    this.lastStatsAt = now;
    const windowSeconds = Math.max(0.2, (now - this.fpsWindowAt) / 1000);
    const fps = Math.min(120, Math.round(this.frames / windowSeconds));
    this.adaptQuality(fps, now);
    this.syncOverviewMode();
    this.updatePoiLabelsVisibility();
    this.callbacks.onStats?.(cameraStats(this.viewer.scene, fps));
    this.frames = 0;
    this.fpsWindowAt = now;
  }

  /* ---------------------------------------------------------------------- */
  /* 画质 / 自适应分辨率                                                     */
  /* ---------------------------------------------------------------------- */

  /** 切换画质档位：auto 会以当前倍率为起点继续自适应 */
  setQuality(preset: QualityPreset): void {
    this.qualityPreset = preset;
    this.lowFpsStreak = 0;
    this.highFpsStreak = 0;
    this.lastQualityAdjustAt = performance.now();
    this.qualityWarmupUntil = performance.now() + 1200;
    // 切回 auto 时从满分辨率重新收敛，避免从低档位恢复过慢
    const scale = preset === 'auto' ? 1 : PRESET_SCALES[preset];
    this.applyQualityScale(scale);
    this.callbacks.onQuality?.({ preset, scale: this.qualityScale });
  }

  getQuality(): QualityState {
    return { preset: this.qualityPreset, scale: this.qualityScale };
  }

  private applyQualityScale(scale: number): void {
    const clamped = Math.max(AUTO_MIN_SCALE, Math.min(AUTO_MAX_SCALE, scale));
    this.qualityScale = Math.round(clamped * 1000) / 1000;
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.resolutionScale = this.qualityScale;
    this.callbacks.onQuality?.({ preset: this.qualityPreset, scale: this.qualityScale });
  }

  /**
   * auto 档的闭环调节：每 500ms 拿到一次实测 FPS，
   * 连续两次 < 50 就降一档分辨率，连续三次 >= 58 再慢慢升回来。
   * 使用连续计数 + 冷却时间，避免在相机飞行/旋转时来回抖动。
   */
  private adaptQuality(fps: number, now: number): void {
    if (this.qualityPreset !== 'auto' || this.destroyed) return;
    if (now < this.qualityWarmupUntil || now - this.lastQualityAdjustAt < 1000) return;
    if (!Number.isFinite(fps) || fps <= 0) return;

    if (fps < 55) {
      this.lowFpsStreak += 1;
      this.highFpsStreak = 0;
    } else if (fps >= 59) {
      this.highFpsStreak += 1;
      this.lowFpsStreak = 0;
    } else {
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
      return;
    }

    if (this.lowFpsStreak >= 2 && this.qualityScale > AUTO_MIN_SCALE) {
      this.applyQualityScale(this.qualityScale - 0.07);
      this.lastQualityAdjustAt = now;
      this.lowFpsStreak = 0;
      if (!this.qualityNoticeShown && this.qualityScale < 0.8) {
        this.qualityNoticeShown = true;
        this.callbacks.onNotice?.('检测到帧率偏低，已自动降低渲染分辨率；可在顶栏「画质」中手动切换。');
      }
    } else if (this.highFpsStreak >= 4 && this.qualityScale < AUTO_MAX_SCALE) {
      // 升档比降档保守：需要连续 2 秒稳定 59+ 才加 3%，避免在临界点来回抖动
      this.applyQualityScale(this.qualityScale + 0.03);
      this.lastQualityAdjustAt = now;
      this.highFpsStreak = 0;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 调试 / 辅助                                                            */
  /* ---------------------------------------------------------------------- */

  getViewer(): Cesium.Viewer | null {
    return this.destroyed ? null : this.viewer;
  }

  getMeta(): DataMeta | null {
    return this.meta;
  }
}
