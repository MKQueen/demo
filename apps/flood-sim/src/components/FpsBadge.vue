<script setup>
/**
 * FpsBadge —— 右上角运行状态：FPS 圆点 + 数字 + 当前画质。
 * FPS 由渲染循环以低频写入，这里只做整数化，避免每帧触发无意义渲染。
 */
import { computed } from 'vue';
import { store, QUALITY_LABEL } from '../store.js';

const props = defineProps({
  sceneStatus: { type: String, default: 'booting' }, // booting | ready | missing | failed
});

const fps = computed(() => {
  const v = Number(store.fps);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
});

const tone = computed(() => {
  if (!fps.value) return 'idle';
  if (fps.value >= 50) return 'good';
  if (fps.value >= 30) return 'mid';
  return 'low';
});

const quality = computed(() => QUALITY_LABEL[store.quality] ?? '高');
const preview = computed(() => props.sceneStatus === 'missing' || props.sceneStatus === 'failed');
</script>

<template>
  <div class="fps-badge" :class="'tone-' + tone">
    <span class="fps-dot" aria-hidden="true"></span>
    <template v-if="preview">
      <span class="fps-preview">界面预览</span>
    </template>
    <template v-else>
      <span class="fps-num">{{ fps || '--' }}</span>
      <span class="fps-unit">FPS</span>
    </template>
    <span class="fps-sep" aria-hidden="true"></span>
    <span class="fps-quality">{{ quality }}画质</span>
  </div>
</template>
