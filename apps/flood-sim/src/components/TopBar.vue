<script setup>
/**
 * TopBar —— 左上品牌区 + 当前水位实时读数。
 * 只读 store.waterLevel / autoRise / targetLevel，不写任何状态。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const current = computed(() => {
  const v = Number(store.waterLevel);
  return Number.isFinite(v) ? v : 0;
});

const currentText = computed(() => current.value.toFixed(1));

/** 风险等级：安全 < 6 / 警戒 6–15 / 危险 15–24 / 极端 ≥ 24（与 WATER_MARKS 语义一致） */
const risk = computed(() => {
  const v = current.value;
  if (v >= 24) return { cls: 'is-danger', label: '极端水位' };
  if (v >= 15) return { cls: 'is-danger', label: '危险水位' };
  if (v >= 6) return { cls: 'is-warn', label: '警戒水位' };
  return { cls: 'is-safe', label: '安全水位' };
});


const rising = computed(() => {
  const target = Number(store.targetLevel);
  if (store.autoRise) return true;
  return Number.isFinite(target) && target > current.value + 0.04;
});
</script>

<template>
  <header class="topbar">
    <div class="topbar-brand">
      <p class="eyebrow">
        <span class="status-dot" aria-hidden="true"></span>
        澜屿湾 · 海岸淹没推演
      </p>
      <h1 class="brand-title">
        潮线<span class="brand-latin">TIDELINE</span>
      </h1>
      <p class="brand-sub">3D 动态水淹模拟分析</p>
    </div>

    <div class="water-readout">
      <span class="readout-label">当前水位</span>
      <div class="readout-value">
        <span class="readout-num">{{ currentText }}</span>
        <span class="readout-unit">m</span>
      </div>
      <div class="readout-meta">
        <span class="risk-pill" :class="risk.cls">{{ risk.label }}</span>
        <span v-if="rising" class="rise-flag">
          <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
            <path d="M5 1.5 8.5 6H6.2v2.5H3.8V6H1.5L5 1.5Z" fill="currentColor" />
          </svg>
          上涨中
        </span>
      </div>
    </div>
  </header>
</template>
