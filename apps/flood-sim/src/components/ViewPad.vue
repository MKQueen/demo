<script setup>
/**
 * ViewPad —— 视角微调按钮组（无需键盘即可旋转/俯仰/缩放/重置）。
 * 通过 store.viewCommand 向 floodApp 下发指令（@see INTERFACES / floodApp §6.5）：
 *   { type: 'orbit', dh: ±12, dp: ±8 }（度）
 *   { type: 'zoom', dir: 1 | -1 }
 *   { type: 'reset' }
 * 方向与键盘 ←/→/↑/↓ 完全一致：orbitBy 约定「正 = 向右转 / 抬头」，
 * 因此左转 dh=-12、右转 dh=+12、上仰 dp=+8、下俯 dp=-8；点击一次 = 键盘按一次。
 */
import { store } from '../store.js';

const ORBIT_STEP = 12;
const PITCH_STEP = 8;

const GROUPS = [
  {
    key: 'orbit',
    items: [
      {
        key: 'left',
        label: '向左转 12°（←）',
        cmd: { type: 'orbit', dh: -ORBIT_STEP, dp: 0 },
        paths: ['M13.4 8H3.2', 'M7.2 3.8 3 8l4.2 4.2'],
      },
      {
        key: 'right',
        label: '向右转 12°（→）',
        cmd: { type: 'orbit', dh: ORBIT_STEP, dp: 0 },
        paths: ['M2.6 8h10.2', 'M8.8 3.8 13 8l-4.2 4.2'],
      },
      {
        key: 'up',
        label: '上仰 8°（↑）',
        cmd: { type: 'orbit', dh: 0, dp: PITCH_STEP },
        paths: ['M8 13.2V3', 'M3.8 7.2 8 3l4.2 4.2'],
      },
      {
        key: 'down',
        label: '下俯 8°（↓）',
        cmd: { type: 'orbit', dh: 0, dp: -PITCH_STEP },
        paths: ['M8 2.8V13', 'M3.8 8.8 8 13l4.2-4.2'],
      },
    ],
  },
  {
    key: 'zoom',
    items: [
      {
        key: 'zoom-in',
        label: '放大（+）',
        cmd: { type: 'zoom', dir: 1 },
        paths: [
          'M6.8 2.2a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z',
          'M10.4 10.4 14 14',
          'M6.8 4.9v3.8M4.9 6.8h3.8',
        ],
      },
      {
        key: 'zoom-out',
        label: '缩小（−）',
        cmd: { type: 'zoom', dir: -1 },
        paths: ['M6.8 2.2a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z', 'M10.4 10.4 14 14', 'M4.9 6.8h3.8'],
      },
    ],
  },
  {
    key: 'reset',
    items: [
      {
        key: 'reset',
        label: '重置视角（R）',
        cmd: { type: 'reset' },
        paths: ['M3 13.2V7.4L8 3l5 4.4v5.8', 'M6 13.2V9.2h4v4'],
      },
    ],
  },
];

const send = (cmd) => {
  // 每次写入新对象，floodApp 的 watch 才会触发
  store.viewCommand = { ...cmd };
};
</script>

<template>
  <div class="view-pad" role="group" aria-label="视角微调：旋转、俯仰、缩放与重置">
    <span class="pad-caption" aria-hidden="true">视角</span>
    <template v-for="(group, gi) in GROUPS" :key="group.key">
      <span v-if="gi > 0" class="pad-sep" aria-hidden="true"></span>
      <button
        v-for="btn in group.items"
        :key="btn.key"
        class="pad-btn"
        type="button"
        :title="btn.label"
        :aria-label="btn.label"
        @click="send(btn.cmd)"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            v-for="(d, i) in btn.paths"
            :key="i"
            :d="d"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </template>
  </div>
</template>
