/**
 * app.js —— 应用入口
 *
 * 职责：
 *  - 引导各页签模块初始化；
 *  - 顶栏：真实模型连接状态 / 模型 / 向量维度 / 块数 / topK / 清空 / 运行评测；
 *  - 页签切换、跨面板联动（focusChunk / requestTab / requestHealth）；
 *  - 真实模型未连接时的全局提示条、启动提示与重连。
 */
import { $, $$, initGlobalTooltip, toast } from './util.js';
import {
  state,
  subscribe,
  on,
  emit,
  setBackend,
  setBackendError,
  setKb,
  setActiveTab,
} from './state.js';
import { getHealth, getKb, isBrowserMode } from './api.js';
import { initChat, clearConversation } from './chat.js';
import { initPipeline } from './pipeline.js';
import { initScatter } from './scatter.js';
import { initCitations, focusRecallCard } from './citations.js';
import { initPrompt } from './prompt.js';
import { initKb, refreshKb } from './kb.js';
import { initEval, runEval } from './eval.js';

/* ==========================================================================
   DOM 引用
   ========================================================================== */
const dom = {
  banner: null,
  bannerTitle: null,
  bannerDetail: null,
  reconnect: null,
  pillLlm: null,
  pillLlmText: null,
  pillModel: null,
  pillModelValue: null,
  pillDim: null,
  pillDimValue: null,
  pillChunks: null,
  pillChunksValue: null,
  pillVersion: null,
  topK: null,
  clearBtn: null,
  evalBtn: null,
  tabsStatus: null,
};

let tabButtons = [];
let tabPanels = [];
let healthLoading = false;

/* ==========================================================================
   页签
   ========================================================================== */
function initTabs() {
  tabButtons = $$('.tab[data-tab]');
  tabPanels = $$('.panel[data-panel]');
  for (const button of tabButtons) {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  }
}

function switchTab(tab) {
  if (!tab) return;
  for (const button of tabButtons) {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of tabPanels) {
    panel.classList.toggle('is-active', panel.dataset.panel === tab);
  }
  setActiveTab(tab);
}

/* ==========================================================================
   顶栏健康状态
   ========================================================================== */
function setTabsStatus(text, stateName = '') {
  if (!dom.tabsStatus) return;
  dom.tabsStatus.textContent = text;
  if (stateName) dom.tabsStatus.dataset.state = stateName;
  else delete dom.tabsStatus.dataset.state;
}

function renderHealth() {
  const { status, health, error } = state.backend;
  if (!dom.pillLlm) return;

  dom.pillLlm.classList.remove('pill--waiting', 'pill--ok', 'pill--off');
  for (const pill of [dom.pillModel, dom.pillDim, dom.pillChunks, dom.pillVersion]) {
    if (pill) pill.hidden = true;
  }

  if (status === 'online' && health) {
    const llm = health.llm || {};
    const isLlm = llm.mode === 'llm';
    dom.pillLlm.classList.add(isLlm ? 'pill--ok' : 'pill--off');
    dom.pillLlmText.textContent = isLlm ? '真实模型' : '未连接';
    dom.pillLlm.title = [llm.note, llm.configured ? 'API Key 已配置' : 'API Key 未配置']
      .filter(Boolean)
      .join(' · ');

    if (llm.model) {
      dom.pillModel.hidden = false;
      dom.pillModelValue.textContent = llm.model;
    }
    const dim = health.embedding?.dim;
    if (dim != null) {
      dom.pillDim.hidden = false;
      dom.pillDimValue.textContent = String(dim);
    }
    const chunks = health.kb?.chunks;
    if (chunks != null) {
      dom.pillChunks.hidden = false;
      dom.pillChunksValue.textContent = String(chunks);
    }
    if (health.version) {
      dom.pillVersion.hidden = false;
      dom.pillVersion.textContent = `v${health.version}`;
    }
    if (isLlm) {
      hideBanner();
    } else {
      showBanner('真实模型未连接', llm.note || '请在项目根目录运行 npm run serve，然后点「重新连接」。');
    }
  } else if (status === 'offline') {
    dom.pillLlm.classList.add('pill--off');
    dom.pillLlmText.textContent = '未连接';
    dom.pillLlm.title = error?.message || '服务未连接';
    showBanner(
      '服务未连接',
      error?.message || '请启动本地服务（项目根目录 npm run serve），然后点「重新连接」。',
    );
  } else {
    dom.pillLlm.classList.add('pill--waiting');
    dom.pillLlmText.textContent = '连接中…';
  }
}

function showBanner(title, message) {
  if (!dom.banner) return;
  dom.banner.hidden = false;
  if (dom.bannerTitle && title) dom.bannerTitle.textContent = title;
  if (dom.bannerDetail && message) dom.bannerDetail.textContent = message;
}

function hideBanner() {
  if (!dom.banner) return;
  dom.banner.hidden = true;
}

/* ==========================================================================
   数据加载
   ========================================================================== */
async function loadHealth(options = {}) {
  if (healthLoading) return;
  healthLoading = true;
  try {
    const health = await getHealth();
    setBackend(health);
  } catch (error) {
    setBackendError(error);
    if (!options.silent) {
      toast(error.message || '无法连接后端', 'error', 5000);
    }
  } finally {
    healthLoading = false;
    renderHealth();
  }
}

async function loadKb() {
  state.kbStatus = 'loading';
  state.kbError = null;
  refreshKb();
  try {
    const kb = await getKb();
    if (!kb || !Array.isArray(kb.docs) || !Array.isArray(kb.chunks)) {
      throw new Error(
        isBrowserMode()
          ? 'kb-data.json 返回结构不符合契约（docs / chunks 缺失）'
          : 'GET /api/kb 返回结构不符合契约（docs / chunks 缺失）',
      );
    }
    setKb(kb);
    refreshKb();
  } catch (error) {
    state.kbStatus = 'error';
    state.kbError = error?.message || String(error);
    refreshKb();
    if (state.backend.status === 'online') {
      toast(`知识库加载失败：${state.kbError}`, 'error', 5000);
    }
  }
}

async function reconnect() {
  if (dom.reconnect) {
    dom.reconnect.disabled = true;
    dom.reconnect.classList.add('is-busy');
    const label = dom.reconnect.querySelector('span');
    if (label) label.textContent = '连接中…';
  }
  await loadHealth({ silent: true });
  if (state.backend.status === 'online') {
    await loadKb();
  }
  if (dom.reconnect) {
    dom.reconnect.disabled = false;
    dom.reconnect.classList.remove('is-busy');
    const label = dom.reconnect.querySelector('span');
    if (label) label.textContent = '重新连接';
  }
  if (state.backend.status !== 'online') {
    toast(state.backend.error?.message || '仍然无法连接本地服务', 'error', 4200);
  } else if (state.backend.health?.llm?.mode === 'llm') {
    toast('已连接真实模型', 'ok', 2200);
  } else {
    toast(
      state.backend.health?.llm?.note ||
        '仍未连接真实模型：请在项目根目录运行 npm run serve，然后点「重新连接」。',
      'error',
      5200,
    );
  }
}

/* ==========================================================================
   顶栏交互
   ========================================================================== */
function initTopbar() {
  dom.banner = $('#conn-banner');
  dom.bannerTitle = $('#conn-banner-title');
  dom.bannerDetail = dom.banner?.querySelector('.conn-banner-text span');
  dom.reconnect = $('#btn-reconnect');
  dom.pillLlm = $('#pill-llm');
  dom.pillLlmText = $('#pill-llm-text');
  dom.pillModel = $('#pill-model');
  dom.pillModelValue = $('#pill-model-v');
  dom.pillDim = $('#pill-dim');
  dom.pillDimValue = $('#pill-dim-v');
  dom.pillChunks = $('#pill-chunks');
  dom.pillChunksValue = $('#pill-chunks-v');
  dom.pillVersion = $('#pill-version');
  dom.topK = $('#topk-select');
  dom.clearBtn = $('#btn-clear');
  dom.evalBtn = $('#btn-eval');
  dom.tabsStatus = $('#tabs-status');

  dom.reconnect?.addEventListener('click', reconnect);

  // topK 选择
  if (dom.topK) {
    dom.topK.value = String(state.settings.topK);
    dom.topK.addEventListener('change', () => {
      const value = Number(dom.topK.value) || 5;
      state.settings.topK = value;
      emit('settings:change', state.settings);
      toast(`topK 已切换为 ${value}（下一步提问与评测生效）`, 'info', 2000);
    });
  }

  dom.clearBtn?.addEventListener('click', () => {
    clearConversation();
    toast('对话已清空', 'info', 1600);
  });

  // 顶栏「运行评测」：跳到评测页签并按需触发
  dom.evalBtn?.addEventListener('click', () => {
    switchTab('eval');
    runEval();
  });
}

/* ==========================================================================
   跨模块联动
   ========================================================================== */
function initEvents() {
  // 发送消息后自动切到「管道」页签
  on('requestTab', (tab) => switchTab(tab));

  // 引用角标 / 管道召回行 / 散点图点击 → 定位召回卡片
  on('focusChunk', (chunkId) => {
    if (!chunkId) return;
    switchTab('recall');
    window.requestAnimationFrame(() => {
      const found = focusRecallCard(chunkId);
      if (!found) toast('该片段不在本轮召回结果中', 'info', 2200);
    });
  });

  // 对话结束后静默刷新健康状态（LLM 降级可能改变 mode）
  on('requestHealth', () => {
    loadHealth({ silent: true });
  });

  // 页签状态文案
  on('chat:start', () => setTabsStatus('检索中…', 'live'));
  on('retrieval', () => setTabsStatus('召回完成', 'live'));
  on('prompt', () => setTabsStatus('生成中…', 'live'));
  on('chat:done', ({ error, aborted }) => {
    if (error) setTabsStatus('本轮失败', 'error');
    else if (aborted) setTabsStatus('已停止', '');
    else setTabsStatus('本轮完成', 'done');
  });
  on('session:reset', () => setTabsStatus('等待提问', ''));

  // 状态变化时刷新顶栏
  subscribe(() => {
    renderHealth();
  });
}

/* ==========================================================================
   启动
   ========================================================================== */
function boot() {
  initGlobalTooltip();
  initTopbar();
  initTabs();

  // 页签模块按顺序初始化（内部自己注册领域事件）
  initPipeline();
  initScatter();
  initCitations();
  initPrompt();
  initKb();
  initEval();
  initChat();

  initEvents();
  renderHealth();
  setTabsStatus('等待提问', '');

  // 并行拉取健康状态与知识库；任何失败都只影响对应区域，不白屏
  loadHealth({ silent: true });
  loadKb();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// 暴露少量调试入口，方便在控制台排查（不参与业务）
window.__RAG_DEMO__ = {
  state,
  switchTab,
  refresh: () => Promise.allSettled([loadHealth({ silent: true }), loadKb()]),
};
