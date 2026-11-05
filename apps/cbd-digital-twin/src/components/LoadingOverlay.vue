<script setup lang="ts">
const reload = () => window.location.reload();

defineProps<{
  visible: boolean;
  percent: number;
  label: string;
  error: string;
  steps: string[];
}>();
</script>

<template>
  <transition name="loading-fade">
    <div v-if="visible" class="loading-overlay" :class="{ 'has-error': !!error }">
      <div class="loading-grid" aria-hidden="true"></div>
      <div class="loading-core">
        <div class="loading-mark" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none">
            <path d="M60 8 103 32v50L60 106 17 82V32L60 8Z" stroke="currentColor" stroke-width="1.1" opacity=".42" />
            <path d="M60 22 91 40v34L60 92 29 74V40L60 22Z" stroke="currentColor" stroke-width="1.1" opacity=".2" />
            <path d="M38 76V54l11-7v29M49 76V44l12-7v39M61 76V38l12 7v31M73 76V51l9 6v19" stroke="currentColor" stroke-width="1.6" />
            <path d="M32 82h56" stroke="currentColor" stroke-width="1.2" opacity=".65" />
            <circle cx="60" cy="17" r="2.3" fill="#ffc46b" />
          </svg>
          <span class="loading-scan"></span>
        </div>

        <p class="loading-kicker">BEIJING <span>·</span> DIGITAL TWIN</p>
        <h2>正在构建北京数字孪生<span class="ellipsis"><i>.</i><i>.</i><i>.</i></span></h2>

        <div v-if="!error" class="loading-progress">
          <div class="loading-progress-head">
            <span>{{ label }}</span>
            <b>{{ String(percent).padStart(2, '0') }}<i>%</i></b>
          </div>
          <div class="loading-track"><i :style="{ width: `${percent}%` }"></i></div>
          <div class="loading-steps">
            <span
              v-for="(step, index) in steps"
              :key="step"
              :class="{ 'is-done': percent >= ((index + 1) / steps.length) * 100, 'is-current': label === step }"
            >
              {{ step }}
            </span>
          </div>
        </div>

        <div v-else class="loading-error">
          <p>场景初始化失败</p>
          <span>{{ error }}</span>
          <button type="button" @click="reload">重新加载</button>
        </div>

        <div class="loading-sources">
          <span><i></i>CESIUM 1.147</span>
          <span><i></i>OSM + S2</span>
          <span><i></i>3D TILES 1.1</span>
          <span><i></i>NO API KEY</span>
        </div>
      </div>
      <p class="loading-foot">BEIJING MUNICIPALITY · 2026</p>
    </div>
  </transition>
</template>
