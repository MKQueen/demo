<script setup>
/**
 * App.vue —— 潮线 TIDELINE · 3D 动态水淹模拟分析
 *
 * 布局：全屏 Cesium 画布 + 绝对定位的玻璃拟态控制层。
 * 场景由 Lead 提供的 src/cesium/floodApp.js 创建；若模块尚未就绪（或初始化失败），
 * 本组件降级为深色渐变占位场景，保证 UI 可独立预览，不阻塞任何面板交互。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { store } from './store.js';
import TopBar from './components/TopBar.vue';
import ControlPanel from './components/ControlPanel.vue';
import StatsPanel from './components/StatsPanel.vue';
import BuildingCard from './components/BuildingCard.vue';
import ZonePanel from './components/ZonePanel.vue';
import CameraDock from './components/CameraDock.vue';
import ViewPad from './components/ViewPad.vue';
import LegendBar from './components/LegendBar.vue';
import InteractionHint from './components/InteractionHint.vue';
import InfoModal from './components/InfoModal.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';
import FpsBadge from './components/FpsBadge.vue';

const canvasRef = ref(null);
const drawerRef = ref(null);
/** booting | ready | missing | failed */
const sceneStatus = ref('booting');
const drawerOpen = ref(false);
/** 蓄水区存在时，左侧卡片栈让位：隐藏建筑详情、优先展示蓄水分析 */
const hasZone = computed(() => !!store.zone);
/** 仅开发期：?preview=1 强制使用占位场景，便于独立评审 UI（不影响正式构建） */
const previewOnly =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('preview');

// 开发期调试入口：控制台里可 __floodStore.selectedBuilding = {...} 预览建筑详情卡
if (import.meta.env.DEV) {
  window.__floodStore = store;
}

let floodApp = null;
let disposed = false;
let fallbackTimer = 0;

/* ---------------- 操作提示（首次进入自动展示，可经帮助按钮重现） ---------------- */
const HINT_DURATION = 9000;
const hintOpen = ref(false);
let hintTimer = 0;
let hintBootTimer = 0;

function showHint() {
  hintOpen.value = true;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    hintOpen.value = false;
    hintTimer = 0;
  }, HINT_DURATION);
}

function closeHint() {
  hintOpen.value = false;
  window.clearTimeout(hintTimer);
  hintTimer = 0;
}

/** InfoModal 内的「重新显示操作提示」 */
function onModalShowHint() {
  store.showInfo = false;
  showHint();
}

/**
 * 用 glob 而非静态 import：floodApp 未就绪时返回空对象，
 * 避免 Vite 在预览阶段抛 404 / 构建失败；floodApp 就绪后即为普通动态 import。
 */
const floodAppModules = import.meta.glob('./cesium/floodApp.js');

/* ---------------- 场景启动 ---------------- */

async function bootScene() {
  const load = floodAppModules['./cesium/floodApp.js'];
  if (!load) {
    enterPlaceholder('missing');
    return;
  }

  try {
    const mod = await load();
    const createFloodApp = mod?.createFloodApp;
    if (typeof createFloodApp !== 'function') {
      enterPlaceholder('missing');
      return;
    }

    floodApp = await createFloodApp({ container: canvasRef.value, store });

    if (disposed) {
      floodApp?.dispose?.();
      floodApp = null;
      return;
    }
    sceneStatus.value = 'ready';
    stopFallbackSim();
    // 场景就绪后再给首次操作提示一点出现延迟，避免与 loading 淡出叠加
    hintBootTimer = window.setTimeout(() => {
      if (!disposed) showHint();
    }, 1800);
  } catch (err) {
    // 渲染失败不白屏：保留占位场景与全部 UI，只提示预览模式
    enterPlaceholder('failed');
    // eslint-disable-next-line no-console
    console.warn('[TIDELINE] 3D 场景初始化失败，已降级为界面预览：', err?.message || err);
  }
}

function enterPlaceholder(reason) {
  sceneStatus.value = reason;
  if (store.loading) store.loading.visible = false;
  startFallbackSim();
}

/* ---------------- 占位场景的水位模拟（仅 floodApp 缺失时启用） ---------------- */

function startFallbackSim() {
  if (fallbackTimer || disposed) return;
  let last = performance.now();
  fallbackTimer = window.setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (store.autoRise) {
      store.targetLevel = Math.min(30, Number(store.targetLevel || 0) + Number(store.riseSpeed || 0) * dt);
    }
    const target = Number(store.targetLevel) || 0;
    const current = Number(store.waterLevel) || 0;
    const diff = target - current;
    if (Math.abs(diff) < 0.005) {
      store.waterLevel = target;
    } else {
      store.waterLevel = current + diff * Math.min(1, dt * 6);
    }
  }, 80);
}

function stopFallbackSim() {
  if (fallbackTimer) {
    window.clearInterval(fallbackTimer);
    fallbackTimer = 0;
  }
}

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
  if (previewOnly) {
    enterPlaceholder('missing');
    return;
  }
  bootScene();
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('keydown', onGlobalKeydown);
  window.clearTimeout(hintTimer);
  window.clearTimeout(hintBootTimer);
  stopFallbackSim();
  try {
    floodApp?.dispose?.();
  } catch (err) {
    // 卸载阶段的清理异常不再冒泡
    console.warn('[TIDELINE] dispose 失败：', err?.message || err);
  }
  floodApp = null;
});

/* ---------------- UI 事件 ---------------- */

const openInfo = () => {
  store.showInfo = true;
};

const onGlobalKeydown = (event) => {
  if (event.key !== 'Escape') return;
  if (hintOpen.value) {
    closeHint();
    return;
  }
  if (drawerOpen.value) drawerOpen.value = false;
};

/* ---------------- 移动端抽屉：下拉关闭手势（仅把手区域） ---------------- */
let drawerDrag = null;

const onDrawerPointerDown = (event) => {
  if (window.innerWidth >= 900) return;
  if (!event.target.closest('.drawer-handle')) return;
  const el = drawerRef.value;
  if (!el) return;
  drawerDrag = { startY: event.clientY, pointerId: event.pointerId };
  el.style.transition = 'none';
  try {
    el.setPointerCapture(event.pointerId);
  } catch {}
};

const onDrawerPointerMove = (event) => {
  if (!drawerDrag) return;
  const dy = Math.max(0, event.clientY - drawerDrag.startY);
  const el = drawerRef.value;
  if (el) el.style.transform = `translateY(${dy}px)`;
};

const endDrawerDrag = (event) => {
  if (!drawerDrag) return;
  const el = drawerRef.value;
  const dy = Math.max(0, event.clientY - drawerDrag.startY);
  const pointerId = drawerDrag.pointerId;
  drawerDrag = null;
  try {
    el?.releasePointerCapture(pointerId);
  } catch {}

  if (!el) return;
  if (dy > 72) {
    // 先关状态，再清内联 transform，让抽屉从拖拽位置平滑滑下
    drawerOpen.value = false;
    requestAnimationFrame(() => {
      el.style.transition = '';
      el.style.transform = '';
    });
  } else {
    el.style.transition = '';
    el.style.transform = '';
  }
};
</script>

<template>
  <div class="app-shell">
    <!-- 3D 场景容器：由 createFloodApp 注入 Cesium Viewer -->
    <div ref="canvasRef" class="scene-canvas"></div>

    <!-- 降级占位场景（floodApp 未就绪 / 初始化失败时显示） -->
    <div v-if="sceneStatus !== 'ready'" class="scene-fallback" aria-hidden="true">
      <div class="fallback-sky"></div>
      <div class="fallback-sun"></div>
      <div class="fallback-ridge is-far"></div>
      <div class="fallback-ridge is-near"></div>
      <div class="fallback-water"></div>
      <div class="fallback-shimmer"></div>
    </div>

    <!-- 氛围层：暗角 + 细颗粒，让叠加信息更易读 -->
    <div class="atmosphere" aria-hidden="true"></div>

    <!-- 叠加 UI -->
    <div class="ui-layer">
      <div class="ui-top-left">
        <TopBar />
      </div>

      <div class="ui-top-right">
        <FpsBadge :scene-status="sceneStatus" />
        <button
          class="info-btn help-btn"
          type="button"
          title="操作提示（鼠标 / 键盘）"
          aria-label="操作提示：鼠标与键盘操作方式"
          @click="showHint"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <rect x="4.9" y="1.4" width="6.2" height="13.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M8 4.1v2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>
        <button class="info-btn" type="button" aria-label="查看项目信息" @click="openInfo">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.55" />
            <path
              d="M8 7.2v3.6M8 4.9v.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <div class="ui-bottom-left" :class="{ 'has-zone': hasZone }">
        <StatsPanel />
        <BuildingCard v-if="!hasZone" />
        <ZonePanel />
      </div>

      <div class="ui-bottom-center">
        <LegendBar />
        <ViewPad />
        <CameraDock />
      </div>
    </div>

    <InteractionHint :open="hintOpen" @close="closeHint" />

    <!-- 右侧控制台（<900px 时变为底部抽屉） -->
    <aside
      id="control-drawer"
      ref="drawerRef"
      class="ui-right"
      :class="{ 'is-open': drawerOpen }"
      aria-label="控制台"
      @pointerdown="onDrawerPointerDown"
      @pointermove="onDrawerPointerMove"
      @pointerup="endDrawerDrag"
      @pointercancel="endDrawerDrag"
    >
      <ControlPanel @close="drawerOpen = false" />
    </aside>

    <div v-if="drawerOpen" class="drawer-scrim" @click="drawerOpen = false"></div>

    <button
      class="drawer-toggle"
      :class="{ 'is-open': drawerOpen }"
      type="button"
      :aria-expanded="drawerOpen"
      aria-controls="control-drawer"
      @click="drawerOpen = !drawerOpen"
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path
          d="M3 5h10M3 8h10M3 11h10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <circle cx="6.2" cy="5" r="1.4" fill="currentColor" />
        <circle cx="10" cy="8" r="1.4" fill="currentColor" />
        <circle cx="7.4" cy="11" r="1.4" fill="currentColor" />
      </svg>
      <span>{{ drawerOpen ? '收起控制台' : '控制台' }}</span>
    </button>

    <InfoModal @show-hint="onModalShowHint" />
    <LoadingOverlay />
  </div>
</template>
