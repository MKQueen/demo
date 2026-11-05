<script setup lang="ts">
import { computed } from 'vue';
import { POI_CATEGORY_META } from '../data/poi';
import type { Poi } from '../data/types';

const props = defineProps<{
  poi: Poi;
  anchor: { x: number; y: number; visible: boolean };
  viewportWidth: number;
  viewportHeight: number;
  orbitActive: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'toggle-orbit'): void;
  (event: 'focus'): void;
}>();

const meta = computed(() => POI_CATEGORY_META[props.poi.category]);
const isMobile = computed(() => props.viewportWidth < 760);

const placement = computed(() => {
  if (isMobile.value) return { below: false, style: {} as Record<string, string> };
  const half = 190;
  const width = props.viewportWidth;
  const height = props.viewportHeight;
  const x = Math.min(Math.max(props.anchor.x, half), Math.max(half, width - half));
  const below = props.anchor.y < 430;
  const top = below
    ? Math.min(Math.max(props.anchor.y + 28, 96), height - 120)
    : Math.min(Math.max(props.anchor.y - 18, 430), height - 26);
  return {
    below,
    style: {
      left: `${x}px`,
      top: `${top}px`,
      transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    },
  };
});

const coordinate = computed(() => `${props.poi.lon.toFixed(5)}°E  ${props.poi.lat.toFixed(5)}°N`);
</script>

<template>
  <div
    class="info-window"
    :class="[`is-${poi.category}`, { 'is-mobile': isMobile, 'is-below': placement.below }]"
    :style="{ '--poi-color': meta.color, ...placement.style }"
    role="dialog"
    aria-modal="false"
    :aria-label="`${poi.name} 信息`"
  >
    <span class="info-arrow" aria-hidden="true"></span>
    <span class="info-scan" aria-hidden="true"></span>

    <div class="info-head">
      <div class="info-heading">
        <span class="info-category">
          <i aria-hidden="true"></i>
          {{ meta.label }}
          <em>{{ meta.en }}</em>
        </span>
        <h3>{{ poi.name }}</h3>
        <p class="info-en">{{ poi.en }}</p>
      </div>
      <button class="info-close" type="button" aria-label="关闭信息窗" @click="emit('close')">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="info-stats">
      <div v-for="stat in poi.stats" :key="stat.label" class="info-stat">
        <span>{{ stat.label }}</span>
        <b>{{ stat.value }}</b>
      </div>
    </div>

    <p class="info-desc">{{ poi.description }}</p>

    <div class="info-tags">
      <span v-for="tag in poi.tags" :key="tag">{{ tag }}</span>
    </div>

    <p v-if="poi.modelCredit" class="info-model-credit">
      3D 模型：{{ poi.modelCredit }}
    </p>

    <div class="info-foot">
      <span class="info-coordinate">{{ coordinate }}</span>
      <div class="info-actions">
        <button class="info-button ghost" type="button" @click="emit('focus')">重新聚焦</button>
        <button class="info-button primary" type="button" @click="emit('toggle-orbit')">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 2.8a5.2 5.2 0 1 1-4.9 3.4"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path d="M2.8 2.9v3.3H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ orbitActive ? '停止环绕' : '环绕浏览' }}
        </button>
      </div>
    </div>
  </div>
</template>
