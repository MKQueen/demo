<script setup>
/**
 * StatsPanel —— 左下淹没分析统计。
 * 数据来自 store.stats（渲染循环 5Hz 写回）；直方图与 Top3 均用内联 SVG / 纯 CSS 呈现。
 * 当渲染管线尚未提供统计（首次集成前的静态预览）时，使用一份确定性的示例数据兜底，
 * 该兜底只影响显示，不写入 store。
 */
import { computed } from 'vue';
import { store } from '../store.js';

const WATER_MAX = 30;

/* ---------- 示例数据兜底（仅当 store.stats 尚无有效值时使用） ---------- */
const DEMO_NAMES = [
  '临江民居',
  '潮汐民宿',
  '河口商铺',
  '渔港仓房',
  '望海茶室',
  '旧渡口屋',
  '盐仓',
  '海防哨所',
];
// 村庄建筑地基高程（m）：集中在 3~14m 的冲积平原，按确定顺序分布
const DEMO_GROUNDS = Array.from({ length: 48 }, (_, i) => {
  const t = ((i * 37) % 48) / 47;
  return 3.2 + t * 10.6;
});

function demoStats(level) {
  const grounds = DEMO_GROUNDS;
  const depths = grounds.map((g) => Math.max(0, level - g));
  const sorted = depths
    .map((d, i) => ({ d, i }))
    .filter((o) => o.d > 0.5)
    .sort((a, b) => b.d - a.d);
  const flooded = sorted.length;
  const danger = depths.filter((d) => d > 2).length;
  const maxDepth = depths.reduce((m, d) => Math.max(m, d), 0);
  const meanDepth = flooded
    ? sorted.reduce((s, o) => s + o.d, 0) / flooded
    : 0;
  const total = grounds.length;
  const histogram = [];
  for (let l = 0; l <= WATER_MAX; l += 2) {
    histogram.push({ level: l, flooded: grounds.filter((g) => g < l).length });
  }
  const floodedList = sorted.slice(0, 3).map((o, k) => ({
    name: `${DEMO_NAMES[k % DEMO_NAMES.length]} ${String(o.i + 1).padStart(2, '0')}`,
    depth: o.d,
  }));
  return {
    totalBuildings: total,
    floodedBuildings: flooded,
    dangerBuildings: danger,
    floodedRatio: flooded / total,
    inundatedAreaM2: (0.05 * level + 0.004 * level * level) * 1e6,
    maxDepth,
    meanDepth,
    histogram,
    floodedList,
  };
}

/* ---------- 数据整理 ---------- */
const hasLiveStats = computed(() => Number(store.stats?.totalBuildings) > 0);
const stats = computed(() => {
  if (hasLiveStats.value) return store.stats;
  return demoStats(Number(store.waterLevel) || 0);
});

const total = computed(() => Math.max(1, Number(stats.value.totalBuildings) || 0));
const flooded = computed(() => Number(stats.value.floodedBuildings) || 0);
const danger = computed(() => Number(stats.value.dangerBuildings) || 0);
const ratioPct = computed(() =>
  Math.round((Number(stats.value.floodedRatio) || flooded.value / total.value) * 100)
);
const areaKm2 = computed(() => {
  const km2 = (Number(stats.value.inundatedAreaM2) || 0) / 1e6;
  return km2 >= 10 ? km2.toFixed(1) : km2.toFixed(2);
});
const maxDepth = computed(() => (Number(stats.value.maxDepth) || 0).toFixed(1));
const meanDepth = computed(() => (Number(stats.value.meanDepth) || 0).toFixed(1));
const waterLevel = computed(() => {
  const v = Number(store.waterLevel);
  return Number.isFinite(v) ? Math.min(WATER_MAX, Math.max(0, v)) : 0;
});

const top3 = computed(() => {
  const list = Array.isArray(stats.value.floodedList) ? stats.value.floodedList : [];
  return list.slice(0, 3).map((b) => ({
    name: b?.name || '未命名建筑',
    depth: Math.max(0, Number(b?.depth) || 0),
  }));
});
const topDepthMax = computed(
  () => top3.value.reduce((m, b) => Math.max(m, b.depth), 0) || 1
);
const depthPct = (d) => `${Math.max(6, Math.min(100, (d / topDepthMax.value) * 100))}%`;

/* ---------- 直方图 SVG 几何 ---------- */
const CHART = { w: 328, h: 94, padX: 12, top: 12, base: 70 };

const histogram = computed(() => {
  const raw = Array.isArray(stats.value.histogram) ? stats.value.histogram : [];
  if (raw.length >= 2) {
    return raw
      .map((d) => ({
        level: Number(d?.level) || 0,
        flooded: Math.max(0, Number(d?.flooded) || 0),
      }))
      .sort((a, b) => a.level - b.level);
  }
  // 兜底：16 个等距空柱，保证图表结构稳定
  return Array.from({ length: 16 }, (_, i) => ({ level: i * 2, flooded: 0 }));
});

const maxFlooded = computed(
  () => Math.max(1, ...histogram.value.map((d) => d.flooded))
);

const xFor = (level) =>
  CHART.padX + (level / WATER_MAX) * (CHART.w - CHART.padX * 2);

const bars = computed(() => {
  const slot = (CHART.w - CHART.padX * 2) / Math.max(1, histogram.value.length);
  const barW = Math.max(3, Math.min(13, slot * 0.56));
  return histogram.value.map((d) => {
    const x = xFor(d.level);
    const ratio = d.flooded / maxFlooded.value;
    const h = Math.max(d.flooded > 0 ? 2 : 1, ratio * (CHART.base - CHART.top));
    return {
      key: `${d.level}`,
      level: d.level,
      flooded: d.flooded,
      x: x - barW / 2,
      y: CHART.base - h,
      w: barW,
      h,
      // 当前水位左侧（已发生的淹没）高亮
      past: d.level <= waterLevel.value + 0.01,
    };
  });
});

const levelX = computed(() => xFor(waterLevel.value));
const markX = (m) => xFor(m);
const axisX = { start: CHART.padX, mid: xFor(15), end: CHART.w - CHART.padX };
</script>

<template>
  <aside class="stats-panel glass" aria-label="淹没分析统计">
    <header class="panel-head stats-head">
      <div class="panel-heading">
        <span class="overline">FLOOD ANALYSIS</span>
        <h2 class="panel-title">淹没分析</h2>
      </div>
      <span class="live-tag">
        <span class="live-dot" aria-hidden="true"></span>
        {{ hasLiveStats ? '实时' : '示例' }}
      </span>
    </header>

    <div class="stats-hero">
      <div class="hero-main">
        <span class="hero-num">{{ flooded }}</span>
        <span class="hero-total">/ {{ total }}</span>
        <span class="hero-label">被淹建筑</span>
      </div>
      <div class="hero-ratio">
        <span class="ratio-text">淹没占比 {{ ratioPct }}%</span>
        <span class="ratio-bar"><i :style="{ transform: `scaleX(${ratioPct / 100})` }"></i></span>
      </div>
    </div>

    <dl class="stats-grid">
      <div class="stat-cell">
        <dt>危险建筑</dt>
        <dd class="is-warn">{{ danger }}<i>栋</i></dd>
      </div>
      <div class="stat-cell">
        <dt>淹没面积</dt>
        <dd>{{ areaKm2 }}<i>km²</i></dd>
      </div>
      <div class="stat-cell">
        <dt>最大水深</dt>
        <dd>{{ maxDepth }}<i>m</i></dd>
      </div>
      <div class="stat-cell">
        <dt>平均水深</dt>
        <dd>{{ meanDepth }}<i>m</i></dd>
      </div>
    </dl>

    <section class="chart-block">
      <div class="block-head">
        <span class="block-title">水位 — 淹没关系</span>
        <span class="block-meta">当前 {{ waterLevel.toFixed(1) }} m</span>
      </div>
      <svg
        class="histogram"
        :viewBox="`0 0 ${CHART.w} ${CHART.h}`"
        role="img"
        aria-label="水位与累计被淹建筑数量的关系图"
      >
        <defs>
          <linearGradient id="histBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#2b93a6" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#81f0ff" stop-opacity="0.95" />
          </linearGradient>
        </defs>

        <line
          :x1="CHART.padX"
          :x2="CHART.w - CHART.padX"
          :y1="CHART.base"
          :y2="CHART.base"
          class="hist-axis"
        />

        <g class="hist-bars">
          <rect
            v-for="b in bars"
            :key="b.key"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            rx="1.6"
            :class="b.past ? 'is-past' : 'is-future'"
            :fill="b.past ? 'url(#histBar)' : 'rgba(143, 167, 178, 0.16)'"
          >
            <title>水位 {{ b.level }} m · 累计被淹 {{ b.flooded }} 栋</title>
          </rect>
        </g>

        <line
          :x1="markX(15)"
          :x2="markX(15)"
          :y1="CHART.top - 4"
          :y2="CHART.base"
          class="hist-mark is-danger"
        />
        <text :x="markX(15) + 5" :y="CHART.top + 1" class="hist-mark-text">
          危险线 15m
        </text>

        <line
          :x1="levelX"
          :x2="levelX"
          :y1="CHART.top - 6"
          :y2="CHART.base + 3"
          class="hist-level-line"
        />
        <circle :cx="levelX" :cy="CHART.top - 6" r="2.6" class="hist-level-dot" />

        <text :x="axisX.start" :y="CHART.h - 3" class="hist-axis-text">0m</text>
        <text :x="axisX.mid" :y="CHART.h - 3" class="hist-axis-text" text-anchor="middle">15m</text>
        <text :x="axisX.end" :y="CHART.h - 3" class="hist-axis-text" text-anchor="end">30m</text>
      </svg>
    </section>

    <section class="top3-block">
      <div class="block-head">
        <span class="block-title">淹没最严重</span>
        <span class="block-meta">TOP 3 · 水深</span>
      </div>
      <ul v-if="top3.length" class="top3-list">
        <li v-for="(b, i) in top3" :key="b.name + i" class="top3-item">
          <span class="top3-rank">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="top3-name">{{ b.name }}</span>
          <span class="top3-bar" aria-hidden="true"><i :style="{ transform: `scaleX(${depthPct(b.depth)})` }"></i></span>
          <span class="top3-depth">{{ b.depth.toFixed(1) }}<i>m</i></span>
        </li>
      </ul>
      <p v-else class="top3-empty">当前水位下暂无建筑被淹</p>
    </section>
  </aside>
</template>
