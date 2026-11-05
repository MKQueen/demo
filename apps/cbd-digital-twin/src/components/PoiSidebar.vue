<script setup lang="ts">
import { computed } from 'vue';
import { POI_CATEGORIES, POI_CATEGORY_META } from '../data/poi';
import type { Poi } from '../data/types';
import { getDistrict } from '../data/districts';

const props = defineProps<{
  pois: Poi[];
  selectedId: string | null;
  activeCategory: string;
  open: boolean;
  total: number;
  activeDistrict: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', poi: Poi): void;
  (event: 'update:category', category: string): void;
  (event: 'close'): void;
  (event: 'open-districts'): void;
}>();

const sortedPois = computed(() => {
  const order = ['landmark', 'corporate', 'retail', 'transit'];
  return [...props.pois].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
});

const activeLabel = computed(
  () => POI_CATEGORIES.find((category) => category.key === props.activeCategory)?.label ?? '全部点位',
);
const district = computed(() => getDistrict(props.activeDistrict));
const districtTitle = computed(() => district.value?.name ?? '北京全境');
const districtMeta = computed(() =>
  district.value ? `${district.value.en} · ${district.value.areaKm2.toFixed(1)} km²` : '16,432 km² · 16 区',
);
</script>

<template>
  <aside class="poi-sidebar" :class="{ 'is-open': open }" aria-label="业务点位列表">
    <div class="sidebar-head">
      <div>
        <p class="panel-kicker">SITE INDEX <span>/ POINTS</span></p>
        <h2>业务点位</h2>
      </div>
      <button class="icon-button sidebar-close mobile-only" type="button" aria-label="关闭点位列表" @click="emit('close')">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="sidebar-district">
      <div class="sidebar-district-main">
        <span class="sidebar-district-kicker">CURRENT DISTRICT</span>
        <b>{{ districtTitle }}</b>
        <em>{{ districtMeta }}</em>
      </div>
      <button class="sidebar-district-switch" type="button" @click="emit('open-districts')">切换行政区</button>
    </div>

    <div class="sidebar-summary">
      <span><b>{{ pois.length }}</b> 个交互点位</span>
      <span class="sidebar-summary-sep"></span>
      <span>{{ activeLabel }}</span>
    </div>

    <div class="category-filter" role="group" aria-label="按类型筛选点位">
      <button
        v-for="category in POI_CATEGORIES"
        :key="category.key"
        class="category-chip"
        :class="{ 'is-active': activeCategory === category.key }"
        :style="{ '--chip-color': category.color }"
        type="button"
        @click="emit('update:category', category.key)"
      >
        <i aria-hidden="true"></i>
        {{ category.label }}
      </button>
    </div>

    <div class="poi-list" role="list">
      <p v-if="loading" class="sidebar-loading">
        <span class="spinner-dot"></span>
        正在接入场景…
      </p>
      <button
        v-for="(poi, index) in sortedPois"
        :key="poi.id"
        class="poi-row"
        :class="{ 'is-active': selectedId === poi.id }"
        :style="{ '--poi-color': POI_CATEGORY_META[poi.category].color }"
        type="button"
        role="listitem"
        @click="emit('select', poi)"
      >
        <span class="poi-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="poi-row-main">
          <span class="poi-row-title">
            {{ poi.name }}
            <em>{{ POI_CATEGORY_META[poi.category].label }}</em>
          </span>
          <span class="poi-row-en">{{ poi.en }}</span>
        </span>
        <span class="poi-row-meta">
          <b v-if="poi.height">{{ poi.height }}<i>m</i></b>
          <b v-else>{{ poi.floors ? `${poi.floors}F` : '—' }}</b>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>
      <p v-if="!loading && !pois.length" class="sidebar-empty">该分类下暂无点位</p>
    </div>

    <div class="sidebar-foot">
      <span class="foot-dot"></span>
      <span>点击点位 → 相机飞行 / 信息窗</span>
      <span class="sidebar-foot-count">{{ String(pois.length).padStart(2, '0') }} / {{ String(total).padStart(2, '0') }}</span>
    </div>
  </aside>
</template>
