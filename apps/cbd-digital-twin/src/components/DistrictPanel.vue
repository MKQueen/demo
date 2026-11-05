<script setup lang="ts">
import { DISTRICTS } from '../data/districts';

defineProps<{
  open: boolean;
  activeDistrict: string | null;
}>();

const emit = defineEmits<{
  (event: 'select', name: string): void;
  (event: 'reset'): void;
  (event: 'close'): void;
}>();

function onBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close');
}
</script>

<template>
  <transition name="dialog-fade">
    <div v-if="open" class="district-backdrop" role="presentation" @click="onBackdrop">
      <section class="district-dialog" role="dialog" aria-modal="true" aria-labelledby="district-title">
        <header class="district-head">
          <div>
            <p class="panel-kicker">BEIJING DISTRICTS <span>/ 行政区导航</span></p>
            <h2 id="district-title">一次看一个区</h2>
            <p class="district-sub">选择行政区，相机自动飞入该区；侧栏只保留该区地标与点位。</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭行政区选择" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="district-grid">
          <button
            v-for="(district, index) in DISTRICTS"
            :key="district.name"
            class="district-card"
            :class="{ 'is-active': activeDistrict === district.name }"
            type="button"
            @click="emit('select', district.name)"
          >
            <span class="district-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="district-card-head">
              <b>{{ district.name }}</b>
              <em>{{ district.en }}</em>
            </span>
            <span class="district-desc">{{ district.description }}</span>
            <span class="district-landmarks">{{ district.highlights.join(' · ') }}</span>
            <span class="district-area">{{ district.areaKm2.toFixed(1) }} km²</span>
          </button>
        </div>

        <footer class="district-foot">
          <span>共 16 个行政区 · 数据为演示级近似边界</span>
          <div>
            <button class="district-action subtle" type="button" @click="emit('reset')">北京全境</button>
            <button class="district-action" type="button" @click="emit('close')">返回当前区</button>
          </div>
        </footer>
      </section>
    </div>
  </transition>
</template>
