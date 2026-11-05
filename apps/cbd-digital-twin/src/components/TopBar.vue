<script setup lang="ts">
import { computed } from 'vue';
import type { BeijingMeta, DataMeta, DistrictMeta, QualityPreset, ViewMode } from '../data/types';
import { summarizeMeta } from '../data/meta';

const props = defineProps<{
  layerPanelOpen: boolean;
  sidebarOpen: boolean;
  meta: DataMeta | null;
  districtMeta: DistrictMeta | null;
  beijingMeta: BeijingMeta | null;
  quality: QualityPreset;
  viewMode: ViewMode;
  activeDistrict: string | null;
  qualityScale: number;
}>();

const emit = defineEmits<{
  (event: 'reset'): void;
  (event: 'open-districts'): void;
  (event: 'focus-cbd'): void;
  (event: 'toggle-layers'): void;
  (event: 'toggle-sidebar'): void;
  (event: 'cycle-quality'): void;
  (event: 'about'): void;
}>();

const summary = computed(() => summarizeMeta(props.meta));
const buildingCount = computed(() =>
  summary.value.buildingCount === null ? '—' : summary.value.buildingCount.toLocaleString('zh-CN'),
);
const roadCount = computed(() =>
  summary.value.roadCount === null ? '—' : summary.value.roadCount.toLocaleString('zh-CN'),
);
const districtArea = computed(() => {
  const area = props.districtMeta?.areaKm2;
  return typeof area === 'number' ? `${area.toFixed(1)} km²` : '465 km²';
});
const districtBuildings = computed(() => {
  const count = props.districtMeta?.counts?.instances ?? props.districtMeta?.counts?.buildings;
  return typeof count === 'number' ? count.toLocaleString('zh-CN') : '—';
});
const beijingArea = computed(() => {
  const area = props.beijingMeta?.areaKm2;
  return typeof area === 'number' ? `${area.toFixed(0)} km²` : '16,410 km²';
});
const beijingInstances = computed(() => {
  const count = props.beijingMeta?.counts?.instances ?? props.beijingMeta?.tiles?.massing?.instances;
  return typeof count === 'number' ? count.toLocaleString('zh-CN') : '—';
});
const qualityLabel = computed(() => {
  if (props.quality === 'auto') return `自动 ${Math.round(props.qualityScale * 100)}%`;
  return { high: '高', medium: '中', low: '低' }[props.quality];
});
</script>

<template>
  <header class="topbar">
    <div class="topbar-brand">
      <span class="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M20 3.5 35.5 12v16L20 36.5 4.5 28V12L20 3.5Z" stroke="currentColor" stroke-width="1.2" opacity=".5" />
          <path d="M12.5 28V18.5L20 13l7.5 5.5V28" stroke="currentColor" stroke-width="1.4" />
          <path d="M17 28v-7h6v7M12.5 28h15" stroke="currentColor" stroke-width="1.4" />
          <circle cx="20" cy="10.8" r="1.7" fill="#ffc46b" />
        </svg>
      </span>
      <div class="brand-copy">
        <p class="brand-kicker">BEIJING <span>/</span> DIGITAL TWIN</p>
        <h1>北京 <em>数字孪生</em></h1>
      </div>
    </div>

    <div class="topbar-center" aria-hidden="true">
      <span class="data-pill">
        <i></i>
        OSM + S2 DATA
      </span>
      <span class="data-stat">北京 <b>{{ beijingArea }}</b></span>
      <span class="data-stat">中心体块 <b>{{ beijingInstances }}</b></span>
      <span class="data-stat">朝阳体块 <b>{{ districtBuildings }}</b></span>
      <span class="data-stat">CBD 白模 <b>{{ buildingCount }}</b></span>
      <span class="topbar-rule"></span>
      <span class="data-coord">WGS84 · 40.252°N / 116.469°E</span>
    </div>

    <div class="topbar-actions">
      <button class="icon-button mobile-only" :class="{ 'is-active': sidebarOpen }" type="button" aria-label="打开点位列表" @click="emit('toggle-sidebar')">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 6h12M4 10h12M4 14h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span>点位</span>
      </button>
      <button
        class="text-button reset-button"
        :class="{ 'is-active': viewMode === 'beijing' }"
        type="button"
        title="回到整个北京市视角"
        @click="emit('reset')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4.5 8.2A6 6 0 1 1 4 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path d="M4.2 4.8v3.9h3.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        北京全境
      </button>
      <button
        class="text-button district-button"
        :class="{ 'is-active': viewMode === 'district' }"
        type="button"
        :title="`选择行政区（当前：${activeDistrict || '北京全境'}）`"
        @click="emit('open-districts')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 4.5h12v11H4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
          <path d="M7 4.5v11M13 4.5v11M4 10h12" stroke="currentColor" stroke-width="1.2" />
        </svg>
        行政区
      </button>
      <button
        class="text-button cbd-button"
        :class="{ 'is-active': viewMode === 'cbd' }"
        type="button"
        title="飞入国贸 CBD 核心区"
        @click="emit('focus-cbd')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 16V8.8l4-2.4v9.6M8 16V6l5 3v7M13 16V9.5l3.2 1.9V16M3 16h14" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
        </svg>
        国贸 CBD
      </button>
      <button
        class="text-button layers-button"
        :class="{ 'is-active': layerPanelOpen }"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="layerPanelOpen"
        @click="emit('toggle-layers')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m10 3 7 3.8-7 3.8-7-3.8L10 3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="m3 10 7 3.8 7-3.8M3 13.5l7 3.8 7-3.8" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
        图层
      </button>
      <button
        class="text-button quality-button"
        :class="{ 'is-auto': quality === 'auto' }"
        type="button"
        :title="`渲染画质：${qualityLabel}（点击切换 自动 / 高 / 中 / 低，Q 键同效）`"
        @click="emit('cycle-quality')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 6.5h12M4 13.5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="7.6" cy="6.5" r="2" stroke="currentColor" stroke-width="1.3" />
          <circle cx="12.4" cy="13.5" r="2" stroke="currentColor" stroke-width="1.3" />
        </svg>
        <span>画质 {{ qualityLabel }}</span>
      </button>
      <button class="text-button about-button" type="button" @click="emit('about')">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M10 9v4.2M10 6.5v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        数据说明
      </button>
    </div>
  </header>
</template>
