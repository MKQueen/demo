<script setup lang="ts">
import { computed } from 'vue';
import type { SceneStats } from '../data/types';

const props = defineProps<{
  stats: SceneStats;
  selectedName: string;
  orbitActive: boolean;
  totalPois: number;
}>();

const emit = defineEmits<{
  (event: 'stop-orbit'): void;
}>();

const altitude = computed(() => {
  const value = props.stats.altitude;
  if (!Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
});

const fps = computed(() => (props.stats.fps > 0 ? String(Math.min(120, Math.round(props.stats.fps))) : '—'));

const lon = computed(() => (Number.isFinite(props.stats.lon) ? `${props.stats.lon.toFixed(4)}°E` : '—'));
const lat = computed(() => (Number.isFinite(props.stats.lat) ? `${props.stats.lat.toFixed(4)}°N` : '—'));

const heading = computed(() => {
  const value = ((props.stats.heading % 360) + 360) % 360;
  if (value < 22.5 || value >= 337.5) return 'N';
  if (value < 67.5) return 'NE';
  if (value < 112.5) return 'E';
  if (value < 157.5) return 'SE';
  if (value < 202.5) return 'S';
  if (value < 247.5) return 'SW';
  if (value < 292.5) return 'W';
  return 'NW';
});
</script>

<template>
  <footer class="scene-hud">
    <div class="hud-left">
      <div class="hud-live"><i></i>SCENE ONLINE</div>
      <div class="hud-metrics">
        <span class="hud-metric">
          <em>ALT</em>
          <b>{{ altitude }}</b>
        </span>
        <span class="hud-metric">
          <em>CAM</em>
          <b>{{ lon }} / {{ lat }}</b>
        </span>
        <span class="hud-metric hud-hide-mobile">
          <em>HDG</em>
          <b>{{ heading }}</b>
        </span>
        <span class="hud-metric">
          <em>FPS</em>
          <b :class="{ 'is-low': stats.fps > 0 && stats.fps < 30 }">{{ fps }}</b>
        </span>
      </div>
    </div>

    <div class="hud-center">
      <span class="hud-selected" :class="{ 'has-selection': selectedName }">
        {{ selectedName ? `已聚焦 · ${selectedName}` : `${totalPois} 个业务点位待探索` }}
      </span>
      <span class="hud-hint">左键旋转 · 右键倾斜 · 滚轮缩放 · 点击点位</span>
    </div>

    <div class="hud-right">
      <span class="hud-credit">© OSM · EOX/Sentinel-2 · 3DW contributors · CesiumJS</span>
      <button v-if="orbitActive" class="orbit-stop" type="button" @click="emit('stop-orbit')">
        <i></i>停止环绕
      </button>
      <span v-else class="hud-ready"><i></i>READY</span>
    </div>
  </footer>
</template>
