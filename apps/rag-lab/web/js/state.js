/**
 * state.js —— 全局状态 + 轻量事件总线
 *
 * 约定：
 *  - 所有「跨模块共享」的数据（健康状态、知识库快照、当前会话、最近一次 retrieval/prompt/done）
 *    都放在 state 里，面板只读不写；
 *  - 数据变化通过 emit() 广播领域事件，各面板自行决定怎么刷新；
 *  - 不引第三方状态库，保持零依赖。
 */
import { docColorAt } from './util.js';

/** 全局状态（可变对象；更新请走 patch / 专用 setter，以便触发订阅） */
export const state = {
  /** 服务健康状态：status = unknown | online | offline（online 时再看 health.llm.mode 判断真实模型是否可用） */
  backend: { status: 'unknown', health: null, error: null },
  /** 知识库快照（GET /api/kb 原样保存） */
  kb: null,
  kbStatus: 'idle', // idle | loading | ready | error
  kbError: null,
  /** docId -> 颜色（散点图 / 图例 / 卡片统一用色） */
  docColors: new Map(),

  /** 顶部控制项 */
  settings: {
    topK: 5,
    temperature: 0.3,
    mode: 'hybrid',
  },

  /** 当前会话：messages 里同时存放渲染信息与 API 需要的 role/content */
  session: {
    messages: [],
    streaming: false,
    controller: null,
    startedAt: 0,
    meta: null,
  },

  /** 最近一次请求的可视化数据 */
  retrieval: null,
  prompt: null,
  done: null,
  lastError: null,

  /** 当前页签 */
  activeTab: 'pipeline',

  /** 评测（按需加载） */
  eval: { status: 'idle', data: null, error: null },
};

/* ==========================================================================
   订阅（用于顶栏等轻量 UI）
   ========================================================================== */
const listeners = new Set();

/** 注册状态变更监听，返回取消函数 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[state] listener error', error);
    }
  }
}

/** 浅合并顶层字段并广播 */
export function patch(partial) {
  Object.assign(state, partial);
  notify();
}

/* ==========================================================================
   事件总线
   ========================================================================== */
const handlers = new Map();

/** 订阅领域事件，返回取消函数 */
export function on(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  const set = handlers.get(event);
  if (set) set.delete(handler);
}

/** 广播领域事件；单个 handler 出错不影响其他面板 */
export function emit(event, payload) {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[state] handler error: ${event}`, error);
    }
  }
}

/* ==========================================================================
   领域 setter
   ========================================================================== */

/** 写入健康检查结果 */
export function setBackend(health) {
  state.backend = { status: 'online', health, error: null };
  emit('health:change', health);
  notify();
}

/** 写入后端连接错误 */
export function setBackendError(error) {
  state.backend = { status: 'offline', health: null, error };
  emit('health:change', null);
  notify();
}

/** 写入知识库快照，并按文档顺序分配颜色 */
export function setKb(kb) {
  state.kb = kb;
  state.kbStatus = 'ready';
  state.kbError = null;

  const colors = new Map();
  const docs = Array.isArray(kb?.docs) ? [...kb.docs] : [];
  docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  docs.forEach((doc, index) => colors.set(doc.id, docColorAt(index)));
  // docs 缺失时按 chunks 里出现的 docId 兜底
  for (const chunk of Array.isArray(kb?.chunks) ? kb.chunks : []) {
    if (chunk?.docId && !colors.has(chunk.docId)) {
      colors.set(chunk.docId, docColorAt(colors.size));
    }
  }
  state.docColors = colors;

  emit('kb:change', kb);
  notify();
}

/** 文档颜色（散点图 / 图例 / 召回卡片使用） */
export function colorOfDoc(docId) {
  return state.docColors.get(docId) || '#8b98a9';
}

/** 记录一次对话开始 */
export function beginSession(controller, meta = null) {
  state.session.streaming = true;
  state.session.controller = controller;
  state.session.startedAt = performance.now();
  state.session.meta = meta;
  state.retrieval = null;
  state.prompt = null;
  state.done = null;
  state.lastError = null;
  emit('chat:start');
  notify();
}

/** 记录一次对话结束（正常 / 停止 / 出错都走这里） */
export function endSession(done = null, options = {}) {
  state.session.streaming = false;
  state.session.controller = null;
  if (done) state.done = done;
  emit('chat:done', { done, aborted: Boolean(options.aborted), error: options.error || null });
  notify();
}

/** 清空会话 + 可视化数据 */
export function resetSession() {
  state.session.streaming = false;
  state.session.controller = null;
  state.session.messages = [];
  state.session.meta = null;
  state.session.startedAt = 0;
  state.retrieval = null;
  state.prompt = null;
  state.done = null;
  state.lastError = null;
  emit('session:reset');
  notify();
}

/** 切换到某个页签（同时广播，用于通知面板做尺寸/重绘） */
export function setActiveTab(tab) {
  state.activeTab = tab;
  emit('tab:change', tab);
  notify();
}
