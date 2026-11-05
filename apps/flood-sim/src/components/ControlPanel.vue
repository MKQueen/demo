<script setup>
/**
 * ControlPanel —— 右侧核心控制台。
 * 只写交互字段（targetLevel / autoRise / riseSpeed / waveIntensity /
 * waveSpeed / caustics / quality / showBuildings / waterEnabled），
 * 不直接操作 Cesium。所有数值由 store 驱动，拖动即写。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { store, resetFloodState } from '../store.js';

const emit = defineEmits(['close']);

const WATER_MIN = 0;
const WATER_MAX = 30;

const QUALITIES = [
  { key: 'high', label: '高', hint: '全分辨率水面' },
  { key: 'medium', label: '中', hint: '降采样 · 平衡帧率' },
  { key: 'low', label: '低', hint: '最低采样 · 优先帧率' },
];

const clampLevel = (v) => Math.min(WATER_MAX, Math.max(WATER_MIN, Number(v) || 0));

const target = computed(() => clampLevel(store.targetLevel));
const targetText = computed(() => target.value.toFixed(1));
const targetPct = computed(() => (target.value / WATER_MAX) * 100);

const actual = computed(() => clampLevel(store.waterLevel));
const actualText = computed(() => actual.value.toFixed(1));

/** 水位色相：安全青蓝 → 警戒琥珀 → 危险赤橙 */
const levelTone = computed(() => {
  if (target.value >= 24) return 'danger';
  if (target.value >= 15) return 'warn';
  return 'safe';
});

/** 面板内容超出时，底部渐隐提示可继续滚动 */
const scrollEl = ref(null);
const canScroll = ref(false);
const atBottom = ref(true);
const updateScrollState = () => {
  const el = scrollEl.value;
  if (!el) return;
  canScroll.value = el.scrollHeight - el.clientHeight > 10;
  atBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
};
onMounted(() => {
  nextTick(updateScrollState);
  window.addEventListener('resize', updateScrollState);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateScrollState));

/** 水位风险分区：安全 <6 · 警戒 6–15 · 危险 15–24 · 极端 >24（与顶栏 pill 一致） */
const ZONE_MARKS = [
  { m: 6, label: '警戒', tone: 'warn' },
  { m: 15, label: '危险', tone: 'danger' },
  { m: 24, label: '极端', tone: 'danger' },
];

const thresholdMarks = ZONE_MARKS;

const qualityHint = computed(
  () => QUALITIES.find((q) => q.key === store.quality)?.hint ?? ''
);

const RISE_MIN = 0.1;
const RISE_MAX = 3;
const risePct = computed(
  () => ((Number(store.riseSpeed) - RISE_MIN) / (RISE_MAX - RISE_MIN)) * 100
);

const fmt = (v, digits = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
};

const onLevelInput = (event) => {
  store.targetLevel = Number(event.target.value);
};
const onRiseSpeed = (event) => {
  store.riseSpeed = Number(event.target.value);
};
const onWaveIntensity = (event) => {
  store.waveIntensity = Number(event.target.value);
};
const onWaveSpeed = (event) => {
  store.waveSpeed = Number(event.target.value);
};
const onCaustics = (event) => {
  store.caustics = Number(event.target.value);
};

const resetAll = () => {
  resetFloodState(); // Lead 提供：水位 / 上涨 / 波浪 / 焦散 / 画质
  store.showBuildings = true;
  store.waterEnabled = true;
};

const toggleAutoRise = () => {
  store.autoRise = !store.autoRise;
};

/** 蓄水区框选模式：进入后在地图上按住左键拖拽框选 */
const zoneMode = computed(() => store.zoneMode === true);
const toggleZoneMode = () => {
  store.zoneMode = !zoneMode.value;
};

/** 刻度位置：以百分比定位在轨道可用宽度上（CSS 用 7px 内缩补偿滑块拇指） */
const tickLeft = (m) => `${(m / WATER_MAX) * 100}%`;
</script>

<template>
  <aside class="control-panel glass" aria-label="运行控制面板">
    <span class="drawer-handle" aria-hidden="true"></span>
    <header class="panel-head">
      <div class="panel-heading">
        <span class="overline">CONTROL</span>
        <h2 class="panel-title">运行控制</h2>
      </div>
      <button class="panel-close" type="button" aria-label="收起控制面板" @click="emit('close')">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <div ref="scrollEl" class="panel-scroll" @scroll.passive="updateScrollState">
      <!-- 水位 -->
      <section class="level-block" :class="'tone-' + levelTone">
        <div class="level-head">
          <span class="control-label">目标水位</span>
          <span class="level-actual">实际 {{ actualText }} m</span>
        </div>
        <div class="level-value">
          <span class="level-num">{{ targetText }}</span>
          <span class="level-unit">m</span>
        </div>

        <div class="range range-level" :style="{ '--fill': targetPct + '%' }">
          <input
            class="range-input"
            type="range"
            :min="WATER_MIN"
            :max="WATER_MAX"
            step="0.1"
            :value="target"
            aria-label="目标水位（米）"
            @input="onLevelInput"
          />
        </div>

        <div class="range-ticks" aria-hidden="true">
          <span class="range-edge is-start">0m</span>
          <span
            v-for="m in thresholdMarks"
            :key="m.label"
            class="range-tick"
            :class="'is-' + m.tone"
            :style="{ left: tickLeft(m.m) }"
          >
            <i></i>
            <em>{{ m.label }} {{ m.m }}</em>
          </span>
          <span class="range-edge is-end">30m</span>
        </div>
        <p class="level-zones">
          <span class="zone is-safe">安全 &lt;6m</span>
          <span class="zone is-warn">警戒 6–15m</span>
          <span class="zone is-danger">危险 15–24m</span>
          <span class="zone is-extreme">极端 &gt;24m</span>
        </p>
      </section>

      <!-- 自动上涨 -->
      <div class="toggle-row">
        <div class="row-text">
          <span class="row-title">自动上涨</span>
          <span class="row-hint">水位按设定速度持续抬升</span>
        </div>
        <button
          class="toggle"
          :class="{ 'is-on': store.autoRise }"
          type="button"
          role="switch"
          :aria-checked="store.autoRise"
          aria-label="自动上涨"
          @click="toggleAutoRise"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="slider-row" :class="{ 'is-muted': !store.autoRise }">
        <div class="slider-head">
          <span class="row-title">上涨速度</span>
          <span class="slider-value">{{ fmt(store.riseSpeed, 1) }} <i>m/s</i></span>
        </div>
        <div class="range" :style="{ '--fill': risePct + '%' }">
          <input
            class="range-input"
            type="range"
            :min="RISE_MIN"
            :max="RISE_MAX"
            step="0.1"
            :value="store.riseSpeed"
            aria-label="自动上涨速度（米每秒）"
            @input="onRiseSpeed"
          />
        </div>
      </div>

      <!-- 水体表现 -->
      <section class="panel-section">
        <div class="section-title">
          <span>水体表现</span>
          <span class="section-en">WATER</span>
        </div>

        <div class="slider-row">
          <div class="slider-head">
            <span class="row-title">波浪强度</span>
            <span class="slider-value">{{ fmt(store.waveIntensity) }}</span>
          </div>
          <div class="range" :style="{ '--fill': store.waveIntensity * 100 + '%' }">
            <input
              class="range-input"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="store.waveIntensity"
              aria-label="波浪强度"
              @input="onWaveIntensity"
            />
          </div>
        </div>

        <div class="slider-row">
          <div class="slider-head">
            <span class="row-title">波浪速度</span>
            <span class="slider-value">{{ fmt(store.waveSpeed) }}</span>
          </div>
          <div class="range" :style="{ '--fill': (store.waveSpeed / 2) * 100 + '%' }">
            <input
              class="range-input"
              type="range"
              min="0"
              max="2"
              step="0.02"
              :value="store.waveSpeed"
              aria-label="波浪速度"
              @input="onWaveSpeed"
            />
          </div>
        </div>

        <div class="slider-row">
          <div class="slider-head">
            <span class="row-title">焦散强度</span>
            <span class="slider-value">{{ fmt(store.caustics) }}</span>
          </div>
          <div class="range" :style="{ '--fill': store.caustics * 100 + '%' }">
            <input
              class="range-input"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="store.caustics"
              aria-label="焦散强度"
              @input="onCaustics"
            />
          </div>
        </div>
      </section>

      <!-- 蓄水分析 -->
      <section class="panel-section">
        <div class="section-title">
          <span>蓄水分析</span>
          <span class="section-en">RESERVOIR</span>
        </div>
        <button
          class="zone-mode-btn"
          :class="{ 'is-active': zoneMode }"
          type="button"
          :aria-pressed="zoneMode"
          @click="toggleZoneMode"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <rect
              x="2.4"
              y="3.2"
              width="11.2"
              height="9.6"
              rx="1.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-dasharray="2.4 1.6"
            />
            <path
              d="M8 5.9c1.1 1.1 1.9 1.9 1.9 2.8a1.9 1.9 0 1 1-3.8 0c0-.9.8-1.7 1.9-2.8Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ zoneMode ? '取消框选' : '在地图上框选蓄水池' }}</span>
          <span v-if="zoneMode" class="zone-mode-live" aria-hidden="true"></span>
        </button>
        <p class="section-hint" :class="{ 'is-zone-active': zoneMode }">
          {{ zoneMode ? '在地形上按住左键拖拽，框出矩形蓄水区' : '框选后按设定水位蓄水，并分析面积与蓄水量' }}
        </p>
      </section>


      <!-- 画质 -->
      <section class="panel-section">
        <div class="section-title">
          <span>渲染画质</span>
          <span class="section-en">QUALITY</span>
        </div>
        <div class="seg" role="group" aria-label="渲染画质">
          <button
            v-for="q in QUALITIES"
            :key="q.key"
            class="seg-btn"
            :class="{ 'is-active': store.quality === q.key }"
            type="button"
            :aria-pressed="store.quality === q.key"
            @click="store.quality = q.key"
          >
            {{ q.label }}
          </button>
        </div>
        <p class="section-hint">{{ qualityHint }}</p>
      </section>

      <!-- 显示 -->
      <section class="panel-section">
        <div class="section-title">
          <span>场景显示</span>
          <span class="section-en">SCENE</span>
        </div>
        <div class="toggle-row is-compact">
          <span class="row-title">显示建筑</span>
          <button
            class="toggle"
            :class="{ 'is-on': store.showBuildings }"
            type="button"
            role="switch"
            :aria-checked="store.showBuildings"
            aria-label="显示建筑"
            @click="store.showBuildings = !store.showBuildings"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
        <div class="toggle-row is-compact">
          <span class="row-title">水面渲染</span>
          <button
            class="toggle"
            :class="{ 'is-on': store.waterEnabled }"
            type="button"
            role="switch"
            :aria-checked="store.waterEnabled"
            aria-label="水面渲染"
            @click="store.waterEnabled = !store.waterEnabled"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </section>

      <button class="reset-btn" type="button" @click="resetAll">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path
            d="M3 8a5 5 0 1 1 1.6 3.7M3 12V8.6h3.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        重置模拟参数
      </button>
    </div>

    <span v-if="canScroll && !atBottom" class="panel-scroll-fade" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="12" height="12">
        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </aside>
</template>
