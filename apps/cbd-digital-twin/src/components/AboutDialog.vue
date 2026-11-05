<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { BeijingMeta, DataMeta, DistrictMeta } from '../data/types';

const props = defineProps<{
  open: boolean;
  meta: DataMeta | null;
  districtMeta: DistrictMeta | null;
  beijingMeta: BeijingMeta | null;
}>();

const dialogRef = ref<HTMLElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    dialogRef.value?.focus();
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
}>();

function onBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close');
}
</script>

<template>
  <transition name="dialog-fade">
    <div v-if="open" class="dialog-backdrop" role="presentation" @click="onBackdrop">
      <section
        ref="dialogRef"
        class="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabindex="-1"
        @keydown.esc.stop.prevent="emit('close')"
      >
        <header class="about-head">
          <div>
            <p class="panel-kicker">DATA &amp; PRECISION <span>/ 数据与精度</span></p>
            <h2 id="about-title">关于这座数字孪生城市</h2>
          </div>
          <button class="icon-button" type="button" aria-label="关闭数据说明" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="about-body">
          <section class="about-block">
            <h3><span>01</span>这是什么</h3>
            <p>
              一个完全运行在浏览器里的北京市数字孪生 Demo：初始总览覆盖北京全市约 16,410 km² 的
              行政区界、卫星底图与中心城区低模体块；默认进入朝阳区；通过「行政区」可在北京 16 区中逐区切换，每区有独立边界、相机与地标/POI 列表。
              也可切换朝阳区并飞入国贸 CBD 查看 4,320 栋精细白模。CesiumJS 负责三维地球与 3D Tiles，Vue 3 负责侧栏、图层与
              POI 信息窗，OpenStreetMap / Sentinel-2 提供数据底板。没有后端，构建后可直接静态部署。
            </p>
          </section>

          <section class="about-block">
            <h3><span>02</span>数据从哪里来</h3>
            <ul class="about-list">
              <li>
                <b>北京市 / 区界</b>
                <span>DataV 行政区划（GCJ-02，已转 WGS84）；16 区边界用于区界与区名。</span>
              </li>
              <li>
                <b>北京中心城区体块 / 道路</b>
                <span>OpenStreetMap BBBike Beijing extract（中央城区 bbox），ODbL 1.0；体块为 footprint OBB box 实例化。</span>
              </li>
              <li>
                <b>北京卫星底图</b>
                <span>Sentinel-2 cloudless by EOX IT Services GmbH，CC BY 4.0；本地拼贴缓存，不请求在线瓦片。</span>
              </li>
              <li>
                <b>朝阳全域体块</b>
                <span>边界内、CBD 外的建筑用 footprint 低模 box + EXT_mesh_gpu_instancing 组织，单 tileset 加载。</span>
              </li>
              <li>
                <b>CBD 精细白模</b>
                <span>由 OSM building footprint + height/levels 估算拉伸生成 glTF，并以 3D Tiles 1.1 单 mesh 加载。</span>
              </li>
              <li>
                <b>地标模型</b>
                <span>国贸三期 A/B 为程序化示意；中国尊、央视总部、故宫、天坛、鸟巢、天安门使用 3D Warehouse 免费模型（GML 许可，作者见 POI 信息窗与 docs/landmark-models.md）。</span>
              </li>
              <li>
                <b>朝阳 / CBD 底图</b>
                <span>由 OSM 数据离线渲染的暗色栅格底图；与北京卫星底图叠加使用。</span>
              </li>
            </ul>
          </section>

          <section class="about-block">
            <h3><span>03</span>精度边界</h3>
            <p>
              白模高度优先取 OSM <code>height</code>，其次 <code>building:levels × 3.2 + 1.2</code>，
              缺失时按建筑类型估算；全域体块为了性能使用 box 近似，<strong>不可用于测绘、规划审批、日照或工程量计算</strong>。
              地标模型只表达公开体量关系，立面细节为示意。POI 高度与层数来自公开资料，仅用于演示。
            </p>
          </section>

          <section class="about-block">
            <h3><span>04</span>生产环境如何升级</h3>
            <p>
              用有授权的倾斜摄影 / BIM 或 Cesium ion 自建 3D Tiles 替换
              <code>public/data/tiles/white-models/</code> 与 <code>public/data/beijing/tiles/massing/</code>；
              用官方 glTF 或点云重建替换 <code>public/models/*.glb</code>。代码中的
              <code>CbdScene.buildBeijingMassing()</code> / <code>buildWhiteModels()</code> /
              <code>buildLandmarks()</code> 不需要改动，只需保持 tileset / glTF 的坐标与原点一致。
            </p>
          </section>

          <section class="about-block about-meta">
            <h3><span>05</span>技术栈与署名</h3>
            <div class="about-meta-grid">
              <span>CesiumJS <b>1.147</b></span>
              <span>Vue <b>3.5</b></span>
              <span>TypeScript <b>5.9</b></span>
              <span>3D Tiles <b>1.1</b></span>
              <span>OSM 数据 <b>ODbL</b></span>
              <span>无在线 Key <b>OFFLINE</b></span>
            </div>
            <p class="about-credit">
              地图数据 © OpenStreetMap contributors（ODbL 1.0）· 卫星影像 Sentinel-2 cloudless by EOX IT Services GmbH（CC BY 4.0）·
              行政区划 DataV · CesiumJS © Cesium GS, Inc.（Apache-2.0）· 免费地标模型作者见 POI 信息窗，许可为
              <a href="https://3dwarehouse.sketchup.com/tou#license" target="_blank" rel="noreferrer">3D Warehouse General Model License</a>。
              该许可对 mapping/geographic application 与公开分发有额外限制：本 Demo 仅作本地/内部演示，公开部署前请替换为 CC0/CC-BY 资产或取得 Trimble 书面许可。
            </p>
            <p v-if="beijingMeta?.generatedAt || districtMeta?.generatedAt || meta?.generatedAt" class="about-generated">
              数据生成时间：{{ beijingMeta?.generatedAt || districtMeta?.generatedAt || meta?.generatedAt }}
            </p>
          </section>
        </div>

        <footer class="about-foot">
          <span><i></i>ALL SYSTEMS NOMINAL</span>
          <button type="button" @click="emit('close')">返回场景</button>
        </footer>
      </section>
    </div>
  </transition>
</template>
