<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import TopBar from './components/TopBar.vue';
import PoiSidebar from './components/PoiSidebar.vue';
import PoiInfoWindow from './components/PoiInfoWindow.vue';
import LayerPanel from './components/LayerPanel.vue';
import SceneHud from './components/SceneHud.vue';
import AboutDialog from './components/AboutDialog.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';
import DistrictPanel from './components/DistrictPanel.vue';
import { CbdScene, type CbdSceneCallbacks } from './cesium/CbdScene';
import { POIS } from './data/poi';
import { DEFAULT_DISTRICT } from './data/districts';
import type {
  BeijingMeta,
  DataMeta,
  DistrictMeta,
  LayerKey,
  LayerState,
  Poi,
  PoiCategory,
  QualityPreset,
  SceneStats,
  ViewMode,
  ScreenAnchor,
} from './data/types';

const viewportEl = ref<HTMLDivElement | null>(null);
const scene = shallowRef<CbdScene | null>(null);
const ready = ref(false);
const meta = ref<DataMeta | null>(null);
const districtMeta = ref<DistrictMeta | null>(null);
const beijingMeta = ref<BeijingMeta | null>(null);
const viewMode = ref<ViewMode>('district');
const activeDistrict = ref<string | null>(DEFAULT_DISTRICT);
const districtPanelOpen = ref(false);
const selectedPoi = ref<Poi | null>(null);
const anchor = reactive<ScreenAnchor>({ x: 0, y: 0, visible: false });
const orbitActive = ref(false);
const quality = ref<QualityPreset>('auto');
const qualityScale = ref(1);
const layers = reactive<LayerState>({
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
});
const activeCategory = ref<'all' | PoiCategory>('all');
const layerPanelOpen = ref(false);
const aboutOpen = ref(false);
const sidebarOpen = ref(false);
const toast = ref('');
const loading = reactive({
  visible: true,
  percent: 0,
  label: '初始化数字孪生场景',
  error: '',
});
const stats = reactive<SceneStats>({
  fps: 0,
  altitude: 270000,
  lon: 116.05,
  lat: 40.2,
  heading: 0,
  pitch: -1.3,
});
const viewport = reactive({
  width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  height: typeof window === 'undefined' ? 900 : window.innerHeight,
});

const isMobile = computed(() => viewport.width < 760);
const filteredPois = computed(() => {
  let list = activeDistrict.value
    ? POIS.filter((poi) => poi.district === activeDistrict.value)
    : POIS;
  if (activeCategory.value !== 'all') {
    list = list.filter((poi) => poi.category === activeCategory.value);
  }
  return list;
});

const loadingSteps = [
  '创建 Cesium WebGL 渲染器',
  '读取北京市 / 朝阳区数据',
  '绘制北京市界与全域底图',
  '构建中心城区 + 朝阳路网',
  '加载中心城区体块',
  '加载朝阳全域体块',
  '加载 OSM 白模 3D Tiles',
  '加载地标 glTF 模型',
  '布置业务点位与交互',
];

function scopeToView(scope: Poi['scope']): ViewMode {
  return scope === 'beijing' ? 'beijing' : scope === 'district' ? 'district' : 'cbd';
}

let disposed = false;
let toastTimer: number | undefined;
let readyTimer: number | undefined;

function showToast(message: string) {
  toast.value = message;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = '';
  }, 4200);
}

const callbacks: CbdSceneCallbacks = {
  onProgress(progress) {
    loading.percent = progress.percent;
    loading.label = progress.label;
  },
  onReady(data, district, beijing) {
    meta.value = data;
    districtMeta.value = district ?? null;
    beijingMeta.value = beijing ?? null;
    ready.value = true;
    // 首屏直接进入默认行政区（一次只看一个区），而非一次性铺开整个北京的点位。
    if (activeDistrict.value) scene.value?.focusDistrict(activeDistrict.value, { immediate: true });
    if (readyTimer) window.clearTimeout(readyTimer);
    readyTimer = window.setTimeout(() => {
      if (disposed) return;
      loading.visible = false;
      // 首屏完全退出后再加载 3D Warehouse 免费地标，避免纹理上传阻塞 loading 淡出。
      window.setTimeout(() => {
        if (!disposed) scene.value?.loadFreeLandmarks();
      }, 1800);
    }, 650);
  },
  onNotice(message) {
    showToast(message);
  },
  onPoiSelect(poi) {
    selectedPoi.value = poi;
    if (poi) {
      viewMode.value = scopeToView(poi.scope);
      if (activeDistrict.value && poi.scope !== 'cbd') viewMode.value = 'district';
    }
    if (!poi) orbitActive.value = false;
    if (poi && isMobile.value) sidebarOpen.value = false;
  },
  onAnchor(next) {
    anchor.x = next.x;
    anchor.y = next.y;
    anchor.visible = next.visible;
  },
  onStats(next) {
    Object.assign(stats, next);
  },
  onOrbitChange(active) {
    orbitActive.value = active;
  },
  onQuality(next) {
    quality.value = next.preset;
    qualityScale.value = next.scale;
  },
  onFatal(message) {
    loading.visible = true;
    loading.error = message;
  },
};

function handleSelectPoi(poi: Poi) {
  viewMode.value = scopeToView(poi.scope);
  if (activeDistrict.value && poi.scope !== 'cbd') viewMode.value = 'district';
  if (poi.district) activeDistrict.value = poi.district;
  scene.value?.focusPoi(poi);
}

function handleSelectDistrict(name: string) {
  activeDistrict.value = name;
  viewMode.value = 'district';
  districtPanelOpen.value = false;
  activeCategory.value = 'all';
  selectedPoi.value = null;
  scene.value?.clearSelection();
  scene.value?.focusDistrict(name);
}

function handleOpenDistricts() {
  districtPanelOpen.value = true;
  layerPanelOpen.value = false;
  aboutOpen.value = false;
  sidebarOpen.value = false;
}

function handleFocusDistrict() {
  activeDistrict.value = '朝阳区';
  viewMode.value = 'district';
  scene.value?.focusDistrict('朝阳区');
}

function handleFocusCbd() {
  activeDistrict.value = '朝阳区';
  viewMode.value = 'cbd';
  scene.value?.focusCbdView();
}

function handleCloseInfo() {
  scene.value?.clearSelection();
}

function handleToggleOrbit() {
  if (orbitActive.value) {
    scene.value?.stopOrbit();
  } else {
    scene.value?.orbitSelected();
  }
}

function handleFocusPoi() {
  if (selectedPoi.value) scene.value?.focusPoi(selectedPoi.value);
}

function handleStopOrbit() {
  scene.value?.stopOrbit();
}

const QUALITY_ORDER: QualityPreset[] = ['auto', 'high', 'medium', 'low'];
const QUALITY_LABEL: Record<QualityPreset, string> = {
  auto: '自动',
  high: '高',
  medium: '中',
  low: '低',
};

function applyQuality(preset: QualityPreset) {
  quality.value = preset;
  scene.value?.setQuality(preset);
  try {
    window.localStorage.setItem('cbd-quality', preset);
  } catch {
    /* 隐私模式下 localStorage 可能不可用 */
  }
  showToast(`画质已切换：${QUALITY_LABEL[preset]}${preset === 'auto' ? '（按帧率自适应）' : ''}`);
}

function cycleQuality() {
  const index = QUALITY_ORDER.indexOf(quality.value);
  applyQuality(QUALITY_ORDER[(index + 1) % QUALITY_ORDER.length]);
}

function handleReset() {
  layerPanelOpen.value = false;
  viewMode.value = 'beijing';
  activeDistrict.value = null;
  selectedPoi.value = null;
  scene.value?.clearSelection();
  scene.value?.resetView();
}

function toggleLayer(key: LayerKey) {
  const next = !layers[key];
  layers[key] = next;
  scene.value?.setLayer(key, next);
}

function setCategory(category: string) {
  activeCategory.value = category as 'all' | PoiCategory;
}

function toggleLayerPanel() {
  layerPanelOpen.value = !layerPanelOpen.value;
  if (layerPanelOpen.value) aboutOpen.value = false;
}

function openAbout() {
  aboutOpen.value = true;
  layerPanelOpen.value = false;
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (event.key === 'Escape') {
    if (districtPanelOpen.value) districtPanelOpen.value = false;
    else if (aboutOpen.value) aboutOpen.value = false;
    else if (layerPanelOpen.value) layerPanelOpen.value = false;
    else if (sidebarOpen.value) sidebarOpen.value = false;
    else scene.value?.clearSelection();
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    handleReset();
  }
  if (event.key === 'l' || event.key === 'L') {
    toggleLayerPanel();
  }
  if (event.key === 'q' || event.key === 'Q') {
    cycleQuality();
  }
}

function onResize() {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  scene.value?.refreshLayout();
  if (!isMobile.value) sidebarOpen.value = false;
}

onMounted(() => {
  if (!viewportEl.value) return;
  try {
    const saved = window.localStorage.getItem('cbd-quality') as QualityPreset | null;
    if (saved && QUALITY_ORDER.includes(saved)) quality.value = saved;
  } catch {
    /* ignore */
  }
  scene.value = new CbdScene(viewportEl.value, callbacks, { quality: quality.value });
  void scene.value.init();
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  disposed = true;
  if (toastTimer) window.clearTimeout(toastTimer);
  if (readyTimer) window.clearTimeout(readyTimer);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeydown);
  scene.value?.destroy();
  scene.value = null;
});
</script>

<template>
  <div class="app-shell">
    <!-- Cesium canvas 挂载点 -->
    <div ref="viewportEl" class="scene-stage"></div>

    <!-- 纯 CSS 的暗角 / 扫描线 / HUD 边框，增强数字孪生氛围，不拦截鼠标 -->
    <div class="scene-chrome" aria-hidden="true">
      <div class="scene-vignette"></div>
      <div class="scene-scanlines"></div>
      <div class="scene-frame scene-frame--tl"></div>
      <div class="scene-frame scene-frame--tr"></div>
      <div class="scene-frame scene-frame--bl"></div>
      <div class="scene-frame scene-frame--br"></div>
      <div class="scene-side-label">BEIJING · 116.469°E / 40.252°N</div>
    </div>

    <TopBar
      :layer-panel-open="layerPanelOpen"
      :sidebar-open="sidebarOpen"
      :meta="meta"
      :district-meta="districtMeta"
      :beijing-meta="beijingMeta"
      :quality="quality"
      :quality-scale="qualityScale"
      :view-mode="viewMode"
      :active-district="activeDistrict"
      @reset="handleReset"
      @open-districts="handleOpenDistricts"
      @focus-cbd="handleFocusCbd"
      @toggle-layers="toggleLayerPanel"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
      @cycle-quality="cycleQuality"
      @about="openAbout"
    />

    <PoiSidebar
      :pois="filteredPois"
      :selected-id="selectedPoi?.id ?? null"
      :active-category="activeCategory"
      :open="sidebarOpen"
      :total="POIS.length"
      :active-district="activeDistrict"
      :loading="!ready"
      @open-districts="handleOpenDistricts"
      @select="handleSelectPoi"
      @update:category="setCategory"
      @close="sidebarOpen = false"
    />

    <button
      v-if="!loading.visible && !selectedPoi"
      class="sidebar-fab mobile-only"
      :class="{ 'is-open': sidebarOpen }"
      type="button"
      aria-label="打开点位列表"
      @click="sidebarOpen = !sidebarOpen"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 6h12M4 10h12M4 14h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      <span>点位</span>
    </button>

    <div v-if="sidebarOpen" class="sidebar-scrim mobile-only" aria-hidden="true" @click="sidebarOpen = false"></div>

    <PoiInfoWindow
      v-if="selectedPoi && anchor.visible && !loading.visible"
      :key="selectedPoi.id"
      :poi="selectedPoi"
      :anchor="anchor"
      :viewport-width="viewport.width"
      :viewport-height="viewport.height"
      :orbit-active="orbitActive"
      @close="handleCloseInfo"
      @toggle-orbit="handleToggleOrbit"
      @focus="handleFocusPoi"
    />

    <LayerPanel
      :open="layerPanelOpen"
      :layers="layers"
      :meta="meta"
      :district-meta="districtMeta"
      :beijing-meta="beijingMeta"
      @toggle="toggleLayer"
      @close="layerPanelOpen = false"
      @reset="handleReset"
      @open-districts="handleOpenDistricts"
      @focus-cbd="handleFocusCbd"
      @about="openAbout"
    />

    <SceneHud
      :stats="stats"
      :selected-name="selectedPoi?.name ?? ''"
      :orbit-active="orbitActive"
      :total-pois="filteredPois.length"
      @stop-orbit="handleStopOrbit"
    />

    <DistrictPanel
      :open="districtPanelOpen"
      :active-district="activeDistrict"
      @select="handleSelectDistrict"
      @reset="handleReset"
      @close="districtPanelOpen = false"
    />

    <AboutDialog :open="aboutOpen" :meta="meta" :district-meta="districtMeta" :beijing-meta="beijingMeta" @close="aboutOpen = false" />

    <div class="toast" :class="{ 'is-visible': !!toast }" role="status" aria-live="polite">
      <i></i>{{ toast }}
    </div>

    <LoadingOverlay
      :visible="loading.visible"
      :percent="loading.percent"
      :label="loading.label"
      :error="loading.error"
      :steps="loadingSteps"
    />
  </div>
</template>
