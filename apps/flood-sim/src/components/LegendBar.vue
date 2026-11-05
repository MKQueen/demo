<script setup>
/**
 * LegendBar —— 底部中间图例 + 水位刻度尺。
 * 只读 store.waterLevel，用于在刻度尺上标出当前水位位置。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const WATER_MAX = 30;

const level = computed(() => {
  const v = Number(store.waterLevel);
  return Number.isFinite(v) ? Math.min(WATER_MAX, Math.max(0, v)) : 0;
});
const levelText = computed(() => level.value.toFixed(1));
const pct = computed(() => (level.value / WATER_MAX) * 100);
</script>

<template>
  <div class="legend-bar glass" aria-label="图例与水位刻度">
    <span class="legend-title">图例</span>
    <span class="legend-item">
      <i class="legend-swatch is-land" aria-hidden="true"></i>陆地
    </span>
    <span class="legend-item">
      <i class="legend-swatch is-shallow" aria-hidden="true"></i>浅水
    </span>
    <span class="legend-item">
      <i class="legend-swatch is-deep" aria-hidden="true"></i>深水
    </span>
    <span class="legend-item">
      <i class="legend-swatch is-danger" aria-hidden="true"></i>危险水位
    </span>

    <span class="legend-sep" aria-hidden="true"></span>

    <div class="ruler" :title="`当前水位 ${levelText} m`">
      <div class="ruler-head">
        <span>水位</span>
        <b>{{ levelText }}<i>m</i></b>
      </div>
      <div class="ruler-track" aria-hidden="true">
        <i class="ruler-marker" :style="{ left: pct + '%' }"></i>
      </div>
      <div class="ruler-ticks" aria-hidden="true">
        <span>0</span><span>15</span><span>30</span>
      </div>
    </div>
  </div>
</template>
