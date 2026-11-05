<script setup>
/**
 * InteractionHint —— 首次进入场景后的轻量操作提示浮层。
 * 显隐与自动淡出由 App.vue 控制（open prop + close emit），
 * 右上角帮助按钮 / InfoModal「重新显示操作提示」可再次唤起。
 */
defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);
</script>

<template>
  <Transition name="hint">
    <aside v-if="open" class="interaction-hint" role="status" aria-live="polite">
      <header class="hint-head">
        <span class="hint-title">
          <span class="overline">CONTROLS</span>
          <b>操作提示</b>
        </span>
        <button class="hint-close" type="button" aria-label="关闭操作提示" @click="emit('close')">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="m4.5 4.5 7 7m0-7-7 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <ul class="hint-rows">
        <li class="hint-row">
          <span class="hint-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <rect x="4.9" y="1.4" width="6.2" height="13.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M8 4.1v2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </span>
          <span class="hint-text">
            <b>鼠标</b>
            <em>左键拖拽旋转</em> · 右键拖拽倾斜 · 滚轮缩放
          </span>
        </li>
        <li class="hint-row">
          <span class="hint-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <rect x="1.6" y="4" width="12.8" height="8.4" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path
                d="M4.2 6.4h.1M6.4 6.4h.1M8.6 6.4h.1M10.8 6.4h.1M4.2 8.4h.1M6.4 8.4h.1M8.6 8.4h.1M10.8 8.4h.1M5.4 10.5h5.2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="hint-text">
            <b>键盘</b>
            ← → ↑ ↓ 旋转 · ＋ / － 缩放 · R 重置 · 1~5 切机位
          </span>
        </li>
        <li class="hint-row">
          <span class="hint-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.4 1.6" />
              <path d="M8 5.9c1.1 1.1 1.9 1.9 1.9 2.8a1.9 1.9 0 1 1-3.8 0c0-.9.8-1.7 1.9-2.8Z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="hint-text">
            <b>蓄水区</b>
            点「框选蓄水池」后在地形上拖拽，可模拟山间水库
          </span>
        </li>
      </ul>
    </aside>
  </Transition>
</template>
