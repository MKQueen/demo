<script setup lang="ts">
import { computed } from 'vue';
import { LAYERS } from '../data/poi';
import type { BeijingMeta, DataMeta, DistrictMeta, LayerKey, LayerState } from '../data/types';
import { summarizeMeta } from '../data/meta';

const props = defineProps<{
  open: boolean;
  layers: LayerState;
  meta: DataMeta | null;
  districtMeta: DistrictMeta | null;
  beijingMeta: BeijingMeta | null;
}>();

const emit = defineEmits<{
  (event: 'toggle', key: LayerKey): void;
  (event: 'close'): void;
  (event: 'reset'): void;
  (event: 'open-districts'): void;
  (event: 'focus-cbd'): void;
  (event: 'about'): void;
}>();

const summary = computed(() => summarizeMeta(props.meta));
const buildingCount = computed(() =>
  summary.value.buildingCount === null ? '—' : summary.value.buildingCount.toLocaleString('zh-CN'),
);
const roadCount = computed(() =>
  summary.value.roadCount === null ? '—' : summary.value.roadCount.toLocaleString('zh-CN'),
);
const districtInstances = computed(() => {
  const count = props.districtMeta?.counts?.instances ?? props.districtMeta?.tiles?.massing?.instances;
  return typeof count === 'number' ? count.toLocaleString('zh-CN') : '—';
});
const districtArea = computed(() => {
  const area = props.districtMeta?.areaKm2;
  return typeof area === 'number' ? `${area.toFixed(1)} km²` : '465 km²';
});
const beijingArea = computed(() => {
  const area = props.beijingMeta?.areaKm2;
  return typeof area === 'number' ? `${area.toFixed(0)} km²` : '16,410 km²';
});
const beijingInstances = computed(() => {
  const count = props.beijingMeta?.counts?.instances ?? props.beijingMeta?.tiles?.massing?.instances;
  return typeof count === 'number' ? count.toLocaleString('zh-CN') : '—';
});
const generatedAt = computed(() => {
  const value = summary.value.generatedAt;
  if (!value) return 'OSM extract';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'OSM extract' : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
});
</script>

<template>
  <transition name="panel-slide">
    <section v-if="open" class="layer-panel" aria-label="图层控制">
      <div class="layer-head">
        <div>
          <p class="panel-kicker">SCENE LAYERS <span>/ 数据图层</span></p>
          <h2>场景控制</h2>
        </div>
        <button class="icon-button" type="button" aria-label="关闭图层面板" @click="emit('close')">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="layer-list">
        <div v-for="(layer, index) in LAYERS" :key="layer.key" class="layer-row">
          <span class="layer-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="layer-copy">
            <span class="layer-title">{{ layer.label }}<em>{{ layer.en }}</em></span>
            <span class="layer-hint">{{ layer.hint }}</span>
          </span>
          <button
            class="layer-switch"
            :class="{ 'is-on': layers[layer.key] }"
            type="button"
            role="switch"
            :aria-checked="layers[layer.key]"
            :aria-label="`切换 ${layer.label} 图层`"
            @click.prevent="emit('toggle', layer.key)"
          >
            <span></span>
          </button>
        </div>
      </div>

      <div class="layer-meta">
        <div class="layer-meta-row">
          <span>北京市面积</span>
          <b>{{ beijingArea }}</b>
        </div>
        <div class="layer-meta-row">
          <span>中心城区体块</span>
          <b>{{ beijingInstances }}</b>
        </div>
        <div class="layer-meta-row">
          <span>朝阳区面积</span>
          <b>{{ districtArea }}</b>
        </div>
        <div class="layer-meta-row">
          <span>朝阳低模体块</span>
          <b>{{ districtInstances }}</b>
        </div>
        <div class="layer-meta-row">
          <span>CBD 精细白模</span>
          <b>{{ buildingCount }}</b>
        </div>
        <div class="layer-meta-row">
          <span>CBD 道路要素</span>
          <b>{{ roadCount }}</b>
        </div>
        <div class="layer-meta-row">
          <span>数据版本</span>
          <b>{{ generatedAt }}</b>
        </div>
        <p class="layer-source">
          数据源 OSM · ODbL / Sentinel-2 · CC BY 4.0 / DataV<br />
          3D Tiles 1.1 / glTF 2.0 / ENU
        </p>
      </div>

      <div class="layer-actions layer-actions--four">
        <button class="panel-button" type="button" @click="emit('reset')">北京全境</button>
        <button class="panel-button" type="button" @click="emit('open-districts')">行政区</button>
        <button class="panel-button" type="button" @click="emit('focus-cbd')">国贸 CBD</button>
        <button class="panel-button subtle" type="button" @click="emit('about')">数据与精度</button>
      </div>
    </section>
  </transition>
</template>
