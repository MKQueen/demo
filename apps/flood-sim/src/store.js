/**
 * store.js —— 全局共享状态（Vue reactive）。
 *
 * 约定见 docs/INTERFACES.md §2：
 * - UI 组件只「写」交互字段（targetLevel / autoRise / ...），只「读」渲染字段（waterLevel / fps / stats）。
 * - 渲染循环（src/cesium/floodApp.js）负责把 targetLevel 平滑成 waterLevel，并写回 stats。
 */
import { reactive } from 'vue';

export const CAMERA_PRESETS = [
  { key: 'overview', label: '全景', hint: '山体 · 老城 · 滨海新区 · 海' },
  { key: 'village', label: '老城', hint: '近距离观察淹没' },
  { key: 'river', label: '河口', hint: '河流入海口与渡口' },
  { key: 'sea', label: '滨海', hint: '滨海新区与码头' },
  { key: 'compare', label: '对比', hint: '高空俯视全貌' },
];

export const QUALITY_LABEL = { high: '高', medium: '中', low: '低' };

/** 水位刻度语义（UI 标注用） */
export const WATER_MARKS = [
  { m: 2.5, label: '常水位', tone: 'safe' },
  { m: 6, label: '安全', tone: 'safe' },
  { m: 15, label: '警戒', tone: 'warn' },
  { m: 24, label: '危险', tone: 'danger' },
];

export const store = reactive({
  // ---- 水位 ----
  waterLevel: 2.5, // 实际水位 m（渲染循环写）
  targetLevel: 2.5, // 滑块目标 m（UI 写）
  autoRise: false, // 自动上涨（UI 写）
  riseSpeed: 0.6, // m/s
  risingFrom: null, // 自动上涨起点（内部）
  // ---- 水体表现 ----
  waterEnabled: true,
  waveIntensity: 0.65, // 0..1
  waveSpeed: 0.8, // 0..2
  caustics: 0.8, // 0..1
  quality: 'high', // high | medium | low
  // ---- 场景 ----
  showBuildings: true,
  showLabels: false,
  cameraPreset: 'overview',
  // ---- 状态 ----
  loading: { visible: true, progress: 0, label: '正在生成地形…' },
  fps: 0,
  stats: {
    totalBuildings: 0,
    floodedBuildings: 0,
    dangerBuildings: 0,
    floodedRatio: 0,
    inundatedAreaM2: 0,
    totalAreaM2: 0,
    inundatedRatio: 0,
    maxDepth: 0,
    meanDepth: 0,
    histogram: [],
    floodedList: [],
  },
  showInfo: false,
  selectedBuilding: null, // 点击 3D Tiles 建筑时由渲染层写入

  // ---- 蓄水区（在地形上框选矩形 → 区域内填水 + 分析）----
  zoneMode: false, // 框选模式（UI 写）
  zone: null, // 已框选区域（渲染层写）：{minX,maxX,minY,maxY,level,stats:{...}}
  zoneLevel: 0, // 区域水面高度（ENU 米；渲染层初始化 / UI 可拖）
  zoneLevelRange: [0, 100], // 滑块范围（渲染层写）
  zoneCommand: null, // UI → 渲染层：{type:'clear'|'reselect'|'cancel', seq}
  /**
   * 视角指令（UI → 渲染层，单向下发）：
   *   { type: 'orbit', dh: ±度, dp: ±度 }  旋转/俯仰视角
   *   { type: 'zoom', dir: 1|-1 }          放大/缩小
   *   { type: 'reset' }                    回到当前相机预设
   * floodApp 用 watch 消费；每次写入都应是新对象（触发变更）。
   */
  viewCommand: null,
  error: null,
});

/** 兼容 DataSource 风格：组件里 `const s = useFloodStore()` */
export function useFloodStore() {
  return store;
}

/** 重置到初始状态（保留相机与场景） */
export function resetFloodState() {
  store.targetLevel = 2.5;
  store.autoRise = false;
  store.risingFrom = null;
  store.waveIntensity = 0.65;
  store.waveSpeed = 0.8;
  store.caustics = 0.8;
  store.quality = 'high';
}
