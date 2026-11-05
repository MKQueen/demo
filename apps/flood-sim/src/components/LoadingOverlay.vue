<script setup>
/**
 * LoadingOverlay —— 全屏加载遮罩。
 * 读 store.loading.visible / progress / label；visible 变 false 后由 CSS 完成 1.2s 淡出。
 * progress 兼容 0..1 与 0..100 两种写法。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const loading = computed(() => store.loading || {});
const visible = computed(() => loading.value.visible !== false && !!loading.value.visible);

const pct = computed(() => {
  const raw = Number(loading.value.progress);
  if (!Number.isFinite(raw)) return null;
  const v = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, v));
});
const pctText = computed(() => (pct.value === null ? '--' : Math.round(pct.value)));
const label = computed(() => loading.value.label || '正在初始化场景…');
</script>

<template>
  <Transition name="loader-fade">
    <div v-if="visible" class="loading-overlay" role="status" aria-live="polite">
      <div class="loader-grid" aria-hidden="true"></div>
      <div class="loader-topo" aria-hidden="true"></div>
      <div class="loader-glow" aria-hidden="true"></div>
      <div class="loader-horizon" aria-hidden="true"></div>

      <div class="loader-inner">
        <div class="loader-mark">
          <span class="loader-mark-cn">潮线</span>
          <span class="loader-mark-en">TIDELINE</span>
        </div>
        <p class="loader-sub">3D 动态水淹模拟分析</p>

        <div class="loader-bar" :class="{ 'is-indeterminate': pct === null }">
          <span class="loader-fill" :style="pct === null ? null : { transform: `scaleX(${pct / 100})` }"></span>
        </div>

        <div class="loader-meta">
          <span class="loader-label">{{ label }}</span>
          <span class="loader-pct">{{ pctText }}<i v-if="pct !== null">%</i></span>
        </div>

        <div class="loader-scene" aria-hidden="true">澜屿湾 · 14 × 12 km 程序化地形</div>
      </div>
    </div>
  </Transition>
</template>
