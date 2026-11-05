<script setup>
/**
 * BuildingCard —— 3D Tiles 建筑点选后的轻量详情卡。
 * 数据来自 store.selectedBuilding（floodApp 在 pick 时写入，点空白清空）：
 *   { name, type, height, floors, groundHeight, depth, flooded }
 * 本组件只读 store；关闭按钮仅清空选中态（视图层行为）。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const TYPE_LABEL = {
  house: '民居',
  shop: '商铺',
  public: '公共建筑',
  pier: '码头',
};

const building = computed(() => {
  const b = store.selectedBuilding;
  if (!b || typeof b !== 'object') return null;
  if (!b.name && b.height == null) return null;
  return b;
});

const visible = computed(() => !!building.value);

const typeLabel = computed(() => {
  const t = building.value?.type;
  if (!t) return '建筑';
  return TYPE_LABEL[t] || t;
});

const height = computed(() => fmt(building.value?.height));
const ground = computed(() => fmt(building.value?.groundHeight));
const floors = computed(() => {
  const f = Number(building.value?.floors);
  return Number.isFinite(f) && f > 0 ? String(Math.round(f)) : '—';
});

// depth 由 floodApp 写入；若暂未提供，则用「当前水位 - 地基海拔」兜底，保证卡片随水位联动
// 优先用当前水位与地基海拔实时计算，保证拖水位时卡片水深同步；
// floodApp 只在点选瞬间写入 depth，不能直接作为长期显示值。
const depth = computed(() => {
  const level = Number(store.waterLevel) || 0;
  const ground = Number(building.value?.groundHeight);
  if (Number.isFinite(ground)) return Math.max(0, level - ground);
  const d = Number(building.value?.depth);
  return Number.isFinite(d) ? Math.max(0, d) : 0;
});
const depthText = computed(() => depth.value.toFixed(1));
const flooded = computed(() => {
  if (!building.value) return false;
  // 有地基高程时以实时水深判定，水位变化后状态跟着变
  if (Number.isFinite(Number(building.value.groundHeight))) return depth.value > 0.15;
  return building.value.flooded === true || depth.value > 0.01;
});

/** 淹没深度 / 建筑高度，用于右侧细进度条 */
const depthRatio = computed(() => {
  const h = Number(building.value?.height);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.min(1, depth.value / h);
});

function fmt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : '—';
}

const clear = () => {
  store.selectedBuilding = null;
};
</script>

<template>
  <Transition name="build-card">
    <section
      v-if="visible"
      class="building-card glass"
      :class="{ 'is-flooded': flooded }"
      aria-live="polite"
    >
      <header class="building-head">
        <span class="overline">STRUCTURE</span>
        <button class="building-close" type="button" aria-label="关闭建筑详情" @click="clear">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
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

      <div class="building-title-row">
        <h2 class="building-name">{{ building.name || '未命名建筑' }}</h2>
        <span class="type-badge">{{ typeLabel }}</span>
      </div>

      <dl class="building-metrics">
        <div class="building-metric">
          <dt>建筑高度</dt>
          <dd>{{ height }}<i>m</i></dd>
        </div>
        <div class="building-metric">
          <dt>地基海拔</dt>
          <dd>{{ ground }}<i>m</i></dd>
        </div>
        <div class="building-metric">
          <dt>楼层</dt>
          <dd>{{ floors }}<i>层</i></dd>
        </div>
        <div class="building-metric" :class="{ 'is-flooded': flooded }">
          <dt>淹没深度</dt>
          <dd>{{ depthText }}<i>m</i></dd>
        </div>
      </dl>

      <div class="depth-meter" aria-hidden="true">
        <span class="depth-fill" :style="{ transform: `scaleX(${depthRatio})` }"></span>
      </div>

      <p class="building-status" :class="{ 'is-flooded': flooded }">
        <span class="status-dot" aria-hidden="true"></span>
        {{ flooded ? `已被淹没 · 水深 ${depthText} m` : '当前水位未淹没该建筑' }}
      </p>
    </section>
  </Transition>
</template>
