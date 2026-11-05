<script setup>
/**
 * ZonePanel —— 蓄水区（山间水库）分析卡。
 *
 * 数据契约（store，由 Lead 的 floodApp 写入）：
 *   store.zone: null | {
 *     minX, maxX, minY, maxY, level,
 *     stats: { areaKm2, waterAreaKm2, maxDepth, meanDepth,
 *              volumeWanM3, buildingsTotal, buildingsFlooded }
 *   }
 *   store.zoneLevel: number           // 蓄水水位（UI 写，渲染层 watch 重算）
 *   store.zoneLevelRange: [min, max]  // 水位区间（Lead 写）
 *   store.zoneCommand: {type:'clear'|'reselect', seq}
 *
 * 只读 zone / 写 zoneLevel / 通过 zoneCommand 下发清空与重选。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const zone = computed(() => (store.zone && typeof store.zone === 'object' ? store.zone : null));
const visible = computed(() => !!zone.value);

const range = computed(() => {
  const r = store.zoneLevelRange;
  if (Array.isArray(r) && r.length === 2 && r.every((v) => Number.isFinite(Number(v)))) {
    const min = Number(r[0]);
    const max = Number(r[1]);
    if (max > min) return [min, max];
  }
  return [0, 30];
});

const level = computed(() => {
  const [min, max] = range.value;
  const raw = Number(store.zoneLevel);
  const fallback = Number(zone.value?.level);
  const v = Number.isFinite(raw) ? raw : Number.isFinite(fallback) ? fallback : min;
  return Math.min(max, Math.max(min, v));
});
const levelText = computed(() => level.value.toFixed(1));
const levelPct = computed(() => {
  const [min, max] = range.value;
  return ((level.value - min) / Math.max(0.0001, max - min)) * 100;
});

const stats = computed(() => (zone.value?.stats && typeof zone.value.stats === 'object' ? zone.value.stats : {}));
const rangeText = computed(() => {
  const [min, max] = range.value;
  return `${Number(min).toFixed(0)}–${Number(max).toFixed(0)} m`;
});

function fmt(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  return n.toFixed(digits);
}

const area = computed(() => fmt(stats.value.areaKm2, 2));
const waterArea = computed(() => fmt(stats.value.waterAreaKm2, 2));
const maxDepth = computed(() => fmt(stats.value.maxDepth, 1));
const meanDepth = computed(() => fmt(stats.value.meanDepth, 1));
const volume = computed(() => {
  const n = Number(stats.value.volumeWanM3);
  if (!Number.isFinite(n)) return '—';
  return n >= 1000
    ? n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
    : n.toFixed(1);
});
const buildingsFlooded = computed(() => {
  const n = Number(stats.value.buildingsFlooded);
  return Number.isFinite(n) ? Math.round(n) : 0;
});
const buildingsTotal = computed(() => {
  const n = Number(stats.value.buildingsTotal);
  return Number.isFinite(n) ? Math.round(n) : 0;
});
const hasBuildings = computed(() => buildingsTotal.value > 0);

const onLevelInput = (event) => {
  store.zoneLevel = Number(event.target.value);
};

let commandSeq = 0;
function sendCommand(type) {
  commandSeq += 1;
  store.zoneCommand = { type, seq: commandSeq };
}

const reselect = () => sendCommand('reselect');
const clear = () => sendCommand('clear');

const selecting = computed(() => store.zoneMode === true);
</script>

<template>
  <Transition name="zone-card">
    <section v-if="visible" class="zone-panel glass" aria-label="蓄水区分析">
      <header class="zone-head">
        <div class="panel-heading">
          <span class="overline">RESERVOIR</span>
          <h2 class="panel-title">蓄水区分析</h2>
        </div>
        <div class="zone-actions">
          <button class="zone-action" type="button" title="重新框选蓄水区" @click="reselect">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M2.6 5.4V2.6h2.8M10.6 2.6h2.8v2.8M13.4 10.6v2.8h-2.8M5.4 13.4H2.6v-2.8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="8" cy="8" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
            重新框选
          </button>
          <button class="zone-action is-ghost" type="button" title="清除蓄水区" @click="clear">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="m4.5 4.5 7 7m0-7-7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
            清除
          </button>
        </div>
      </header>

      <div class="zone-level">
        <div class="zone-level-head">
          <span class="control-label">蓄水水位</span>
          <span class="zone-level-value">{{ levelText }}<i>m</i></span>
        </div>
        <div class="range" :style="{ '--fill': levelPct + '%' }">
          <input
            class="range-input"
            type="range"
            :min="range[0]"
            :max="range[1]"
            step="0.1"
            :value="level"
            aria-label="蓄水区水位（米）"
            @input="onLevelInput"
          />
        </div>
        <div class="zone-level-ends" aria-hidden="true"><span>{{ rangeText }}</span><span>水位</span></div>
      </div>

      <dl class="zone-stats">
        <div class="zone-stat">
          <dt>矩形面积</dt>
          <dd>{{ area }}<i>km²</i></dd>
        </div>
        <div class="zone-stat">
          <dt>水面面积</dt>
          <dd>{{ waterArea }}<i>km²</i></dd>
        </div>
        <div class="zone-stat">
          <dt>蓄水量</dt>
          <dd>{{ volume }}<i>万m³</i></dd>
        </div>
        <div class="zone-stat">
          <dt>最大水深</dt>
          <dd>{{ maxDepth }}<i>m</i></dd>
        </div>
        <div class="zone-stat">
          <dt>平均水深</dt>
          <dd>{{ meanDepth }}<i>m</i></dd>
        </div>
        <div class="zone-stat" :class="{ 'is-warn': buildingsFlooded > 0 }">
          <dt>区内建筑</dt>
          <dd v-if="hasBuildings">{{ buildingsFlooded }}<i>/ {{ buildingsTotal }} 栋</i></dd>
          <dd v-else>—</dd>
        </div>
      </dl>

      <p v-if="selecting" class="zone-selecting">
        <span class="zone-selecting-dot" aria-hidden="true"></span>
        在地形上按住左键拖拽，重新框选蓄水区
      </p>
    </section>
  </Transition>
</template>
