<script setup>
/**
 * InfoModal —— 项目说明弹窗（store.showInfo 控制显隐）。
 * 内容：技术栈、数据来源、操作提示、Shader 署名。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { store } from '../store.js';

const closeBtn = ref(null);

const emit = defineEmits(['show-hint']);

const close = () => {
  store.showInfo = false;
};

/** 关闭弹窗并让 App 重新展示场景内操作提示 */
const replayHint = () => {
  store.showInfo = false;
  emit('show-hint');
};

const onKeydown = (event) => {
  if (event.key === 'Escape' && store.showInfo) close();
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

// 弹窗打开时锁定背景并把焦点交给关闭按钮；关闭时清理 body 状态
watch(
  () => store.showInfo,
  (open) => {
    document.body.classList.toggle('is-modal-open', !!open);
    if (open) nextTick(() => closeBtn.value?.focus());
  }
);

onBeforeUnmount(() => document.body.classList.remove('is-modal-open'));

const hints = [
  { k: '鼠标', v: '左键拖拽旋转 · 右键拖拽倾斜 · 滚轮缩放' },
  { k: '键盘', v: '← → ↑ ↓ 旋转 · ＋ / － 缩放 · R 重置 · 1~5 切换机位' },
  { k: '视角', v: '点击底部「视角」按钮微调，或点「机位」切换预设' },
  { k: '水位', v: '拖动滑块设定目标水位，渲染循环平滑跟随' },
  { k: '上涨', v: '开启自动上涨，以 0.1–3 m/s 持续抬升' },
  { k: '建筑', v: '点击村庄建筑查看高度、地基海拔与淹没深度' },
];
</script>

<template>
  <Transition name="modal">
    <div v-if="store.showInfo" class="modal-scrim" @click.self="close">
      <section
        class="info-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
      >
        <header class="modal-head">
          <div>
            <span class="overline">ABOUT THIS DEMO</span>
            <h2 id="info-title" class="modal-title">潮线 <span>TIDELINE</span></h2>
          </div>
          <button ref="closeBtn" class="modal-close" type="button" aria-label="关闭信息弹窗" @click="close">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="m4 4 8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <p class="modal-lede">
          以闽东海岸「澜屿湾」为原型构建的 3D 动态水淹模拟：程序化地形、
          村庄 3D Tiles 与实时水面着色器组成一条完整的可视化分析链路。
        </p>

        <dl class="info-list">
          <div class="info-row">
            <dt>技术栈</dt>
            <dd>CesiumJS 1.147 · Vue 3.5 · Vite 6</dd>
          </div>
          <div class="info-row">
            <dt>水面渲染</dt>
            <dd>
              ShaderToy「Seascape」（Ms2SD1）移植为 Cesium 屏幕空间后处理，
              叠加折射、焦散、岸边泡沫
            </dd>
          </div>
          <div class="info-row">
            <dt>场景数据</dt>
            <dd>
              澜屿湾 14 × 12 km 程序化地形、村庄建筑清单与 3D Tiles 均由本地脚本生成
            </dd>
          </div>
          <div class="info-row">
            <dt>淹没分析</dt>
            <dd>地形网格采样 + 建筑地基高程判定，实时输出淹没面积、水深直方图与危险建筑</dd>
          </div>
          <div class="info-row">
            <dt>数据说明</dt>
            <dd>无 Cesium Ion Token、无在线底图，运行期不发起任何网络请求</dd>
          </div>
        </dl>

        <div class="hint-block">
          <span class="block-title">操作提示</span>
          <ul class="hint-list">
            <li v-for="h in hints" :key="h.k">
              <span class="hint-k">{{ h.k }}</span>
              <span class="hint-v">{{ h.v }}</span>
            </li>
          </ul>
          <button class="hint-replay" type="button" @click="replayHint">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <rect x="4.9" y="1.4" width="6.2" height="13.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M8 4.1v2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            重新显示操作提示
          </button>
        </div>

        <footer class="modal-foot">
          <span>Seascape © TDM · CC BY-NC-SA 3.0</span>
          <span>潮线 TIDELINE · Demo Lab</span>
        </footer>
      </section>
    </div>
  </Transition>
</template>
