<script setup>
/**
 * CameraDock —— 底部视角预设 Dock。
 * 点击写入 store.cameraPreset，由 floodApp 的渲染循环消费并飞向该机位。
 */
import { store, CAMERA_PRESETS } from '../store.js';

const presets = CAMERA_PRESETS;

/** 每个机位一个 16px 线性图标（纯 path，无图标库） */
const ICONS = {
  overview: [
    'M2.2 5.4V2.6a.4.4 0 0 1 .4-.4h2.8M10.6 2.2h2.8a.4.4 0 0 1 .4.4v2.8M13.8 10.6v2.8a.4.4 0 0 1-.4.4h-2.8M5.4 13.8H2.6a.4.4 0 0 1-.4-.4v-2.8',
    'M8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  ],
  village: [
    'M2.4 8 8 3l5.6 5',
    'M4.4 7v6.6h7.2V7',
    'M7 13.6V10h2v3.6',
  ],
  river: [
    'M1.8 6.2c1.8 0 1.8-1.9 3.6-1.9s1.8 1.9 3.6 1.9 1.8-1.9 3.6-1.9 1.4 1.4 1.4 1.4',
    'M1.8 10c1.8 0 1.8-1.9 3.6-1.9s1.8 1.9 3.6 1.9 1.8-1.9 3.6-1.9 1.4 1.4 1.4 1.4',
    'M1.8 13.8c1.8 0 1.8-1.9 3.6-1.9s1.8 1.9 3.6 1.9 1.8-1.9 3.6-1.9 1.4 1.4 1.4 1.4',
  ],
  sea: [
    'M1.8 9.6c1.9 0 1.9-2 3.8-2s1.9 2 3.8 2 1.9-2 3.8-2 1.4 1.5 1.4 1.5',
    'M1.8 13c1.9 0 1.9-2 3.8-2s1.9 2 3.8 2 1.9-2 3.8-2 1.4 1.5 1.4 1.5',
    'M9.4 4.9a2 2 0 1 1 4 0',
    'M3.2 4.9h3.6',
  ],
  compare: [
    'M2.2 2.8h5.2v10.4H2.2zM8.6 2.8h5.2v10.4H8.6z',
    'M8 4.6v8',
  ],
};

const select = (key) => {
  if (store.cameraPreset !== key) store.cameraPreset = key;
};
</script>

<template>
  <nav class="camera-dock glass" aria-label="视角预设">
    <span class="dock-caption" aria-hidden="true">机位</span>
    <button
      v-for="preset in presets"
      :key="preset.key"
      class="dock-btn"
      :class="{ 'is-active': store.cameraPreset === preset.key }"
      type="button"
      :aria-pressed="store.cameraPreset === preset.key"
      :title="preset.hint || preset.label"
      @click="select(preset.key)"
    >
      <svg class="dock-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path
          v-for="(d, i) in ICONS[preset.key] || ICONS.overview"
          :key="i"
          :d="d"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="dock-text">{{ preset.label }}</span>
    </button>
  </nav>
</template>
