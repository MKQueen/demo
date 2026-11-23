/**
 * chat.js —— 左栏客服对话
 *
 * 职责：
 *  - 组装多轮 messages，调用 §4 SSE 对话（浏览器模式经 browser-api 走同源 /api/llm/*，服务器模式走 /api/chat）；
 *  - 按事件顺序消费 meta → retrieval → prompt → reasoning → delta → done；
 *  - 流式渲染 Markdown 子集 + 打字机光标 + [n] 引用角标；
 *  - 停止生成（AbortController）、清空对话、失败重试、推荐问题；
 *  - 把 retrieval / prompt / done 写入全局 state 并广播，驱动右侧可视化面板。
 */
import { renderMarkdown, h, clear, icon, charLength, fmtMs, fmtNum, isNearBottom, scrollToBottom, rafThrottle, toast } from './util.js';
import { state, on, emit, beginSession, endSession, resetSession } from './state.js';
import { streamChat } from './api.js';
import { resolveCitation, describeCitation } from './citations.js';

const els = {
  scroll: null,
  welcome: null,
  messages: null,
  form: null,
  input: null,
  sendBtn: null,
  stopBtn: null,
  count: null,
  turn: null,
  live: null,
  suggestions: null,
};

/** message 对象 -> DOM 引用（WeakMap 避免污染状态对象） */
const refs = new WeakMap();

let turnSeq = 0;
let idSeq = 0;

/* ==========================================================================
   小工具
   ========================================================================== */
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

const DEFAULT_PLACEHOLDER = '输入你的问题，例如：耳机有杂音能退吗？';

/** 生成模式的展示文案：回答只有真实模型这一种来源 */
function modeLabel(mode) {
  return mode === 'llm' ? '真实模型' : '生成';
}

/**
 * 真实模型状态：
 *   ready        —— 服务在线且 health.llm.mode === 'llm'，可以生成；
 *   disconnected —— 服务在线但没有可用的真实模型；
 *   unknown      —— 健康检查尚未返回 / 服务未连接。
 */
function llmStatus() {
  const backend = state.backend;
  if (!backend || backend.status !== 'online') return 'unknown';
  return backend.health?.llm?.mode === 'llm' ? 'ready' : 'disconnected';
}

function isLlmReady() {
  return llmStatus() === 'ready';
}

/** 未连接时给用户的可操作提示（优先用健康检查返回的 note） */
function llmHint() {
  if (llmStatus() === 'unknown') return '正在连接真实模型，请稍候再发送。';
  return (
    state.backend.health?.llm?.note ||
    '真实模型未连接：请在项目根目录运行 npm run serve，然后点「重新连接」。'
  );
}

/** 发送前校验：没有真实模型就只提示并中止，绝不发起假回答 */
function ensureLlmReady() {
  if (isLlmReady()) return true;
  toast(llmHint(), llmStatus() === 'unknown' ? 'info' : 'error', llmStatus() === 'unknown' ? 2600 : 5200);
  if (llmStatus() === 'disconnected') emit('requestHealth');
  return false;
}

function updateCitationTips(container) {
  const cites = container.querySelectorAll('.cite');
  for (const cite of cites) {
    cite.dataset.tip = describeCitation(cite.dataset.marker);
  }
}

/* ==========================================================================
   DOM 渲染
   ========================================================================== */
function renderUserMessage(message) {
  return h(
    'div',
    { class: 'msg msg--user', dataset: { id: message.id } },
    h('div', { class: 'msg-user-bubble', text: message.content }),
  );
}

function createAssistantShell(message) {
  const reasoningSlot = h('div', { class: 'msg-reasoning-slot', hidden: true });
  const body = h('div', { class: 'msg-body' });
  const errorSlot = h('div', { class: 'msg-error-slot', hidden: true });
  const meta = h('div', { class: 'msg-meta' });
  const main = h('div', { class: 'msg-main' }, reasoningSlot, body, errorSlot, meta);
  const root = h(
    'div',
    { class: 'msg msg--assistant', dataset: { id: message.id } },
    h('span', { class: 'msg-avatar' }, icon('bot')),
    main,
  );
  refs.set(message, { root, reasoningSlot, body, errorSlot, meta, reasoningEl: null });
  return root;
}

function renderTypingIndicator() {
  return h(
    'span',
    { class: 'typing', 'aria-label': '正在生成' },
    h('i'),
    h('i'),
    h('i'),
  );
}

/** 渲染/更新正文（流式期间每帧调用） */
function renderAssistantBody(message) {
  const ref = refs.get(message);
  if (!ref) return;
  const { body } = ref;
  clear(body);

  if (message.content) {
    body.appendChild(renderMarkdown(message.content));
    if (message.status === 'streaming' || message.status === 'pending') {
      body.appendChild(h('span', { class: 'stream-cursor', 'aria-hidden': 'true' }));
    }
    updateCitationTips(body);
  } else if (message.status === 'pending' || message.status === 'streaming') {
    body.appendChild(renderTypingIndicator());
  }
}

function renderReasoning(message) {
  const ref = refs.get(message);
  if (!ref) return;
  const text = String(message.reasoning || '');
  if (!text) {
    ref.reasoningSlot.hidden = true;
    return;
  }
  ref.reasoningSlot.hidden = false;
  if (!ref.reasoningEl) {
    const summaryText = h('span');
    const body = h('div', { class: 'reasoning-body' });
    const details = h(
      'details',
      { class: 'reasoning' },
      h('summary', {}, icon('chevron'), summaryText),
      body,
    );
    ref.reasoningSlot.appendChild(details);
    ref.reasoningEl = { details, summaryText, body };
  }
  ref.reasoningEl.summaryText.textContent = `思考过程 · ${charLength(text)} 字（点击展开/收起）`;
  ref.reasoningEl.body.textContent = text;
}

function renderAssistantError(message) {
  const ref = refs.get(message);
  if (!ref) return;
  const { errorSlot } = ref;
  clear(errorSlot);
  const error = message.error;
  if (!error) {
    errorSlot.hidden = true;
    return;
  }
  errorSlot.hidden = false;

  // 行内错误：已生成的部分继续留在正文里，只在这里追加错误原因与「重试」
  const retryButton = h(
    'button',
    { type: 'button', class: 'btn btn--sm', onClick: () => retryTurn(message) },
    icon('reset'),
    h('span', { text: '重试' }),
  );
  errorSlot.appendChild(
    h(
      'div',
      { class: 'notice notice--error' },
      icon('alert'),
      h('div', {}, h('strong', { text: '生成失败：' }), h('span', { text: error }), retryButton),
    ),
  );
}

function renderAssistantMeta(message) {
  const ref = refs.get(message);
  if (!ref) return;
  const { meta } = ref;
  clear(meta);
  if (message.status === 'pending' || message.status === 'streaming') return;

  const done = message.done;
  const mode = message.meta?.mode || done?.mode;
  const model = message.meta?.model || '';
  if (mode === 'llm') {
    // 真实模型 chip 直接显示模型名，方便确认这次回答是哪个模型生成的
    meta.appendChild(
      h('span', { class: 'chip chip--live', text: model ? `真实模型 · ${model}` : '真实模型' }),
    );
  } else if (mode) {
    meta.appendChild(h('span', { class: 'chip', text: modeLabel(mode) }));
  }
  if (done?.latencyMs != null) {
    meta.appendChild(h('span', { class: 'chip', text: `耗时 ${fmtMs(done.latencyMs)}` }));
  }
  if (done?.usage?.total_tokens != null) {
    meta.appendChild(
      h('span', { class: 'chip', text: `${fmtNum(done.usage.total_tokens)} tokens` }),
    );
  }
  if (done?.citations?.length) {
    meta.appendChild(h('span', { class: 'chip', text: `引用 ${done.citations.length} 处` }));
  }
  if (message.status === 'stopped') {
    meta.appendChild(h('span', { class: 'chip chip--warn', text: '已停止生成' }));
  }
  if (message.error || done?.failed) {
    meta.appendChild(h('span', { class: 'chip chip--err', text: '生成失败' }));
  }
}

/** 完整刷新一条助手消息（结构化部分） */
function renderAssistant(message) {
  renderReasoning(message);
  renderAssistantBody(message);
  renderAssistantError(message);
  renderAssistantMeta(message);
}

function renderAll() {
  clear(els.messages);
  for (const message of state.session.messages) {
    if (message.role === 'user') {
      els.messages.appendChild(renderUserMessage(message));
    } else {
      const root = createAssistantShell(message);
      els.messages.appendChild(root);
      renderAssistant(message);
    }
  }
  updateWelcome();
}

/* ==========================================================================
   页面 chrome（欢迎区 / 输入区 / 状态）
   ========================================================================== */
function updateWelcome() {
  const hasMessages = state.session.messages.length > 0;
  if (els.welcome) els.welcome.hidden = hasMessages;
}

function updateChrome() {
  const streaming = state.session.streaming;
  const ready = isLlmReady();
  const status = llmStatus();
  const userCount = state.session.messages.filter((message) => message.role === 'user').length;
  if (els.turn) els.turn.textContent = `${userCount} 轮`;
  if (els.live) els.live.hidden = !streaming;
  if (els.sendBtn) {
    els.sendBtn.hidden = streaming;
    els.sendBtn.disabled = streaming || !ready || !els.input?.value.trim();
    els.sendBtn.title = ready ? '发送' : llmHint();
  }
  if (els.stopBtn) els.stopBtn.hidden = !streaming;
  // 没有真实模型时禁用输入：页签、知识库、检索与评测照常可用，只有「生成」这一步被挡住
  if (els.input) {
    els.input.disabled = !ready;
    els.input.placeholder =
      status === 'ready'
        ? DEFAULT_PLACEHOLDER
        : status === 'unknown'
          ? '正在连接真实模型…'
          : '真实模型未连接：配置后点「重新连接」';
    els.input.setAttribute('aria-busy', streaming ? 'true' : 'false');
  }
  for (const button of els.suggestions?.querySelectorAll('.suggest') || []) {
    button.disabled = streaming || !ready;
  }
}

function updateComposerCount() {
  if (!els.count) return;
  const length = charLength(els.input?.value || '');
  els.count.textContent = String(length);
  els.count.classList.toggle('is-near', length > 300);
}

function resizeComposer() {
  if (!els.input) return;
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(112, els.input.scrollHeight)}px`;
}

/* ==========================================================================
   发送 / 停止 / 清空 / 重试
   ========================================================================== */
function apiMessages() {
  const list = [];
  for (const message of state.session.messages) {
    if (message.role === 'user') {
      list.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant' && message.content.trim() && message.status === 'done') {
      // 只有完整结束的回答才进入历史；被停止/失败的半截回答不污染后续上下文
      list.push({ role: 'assistant', content: message.content });
    }
  }
  return list;
}

function newAssistantMessage() {
  return {
    id: nextId('a'),
    role: 'assistant',
    content: '',
    reasoning: '',
    meta: null,
    done: null,
    error: null,
    status: 'pending',
    createdAt: Date.now(),
  };
}

async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if (!text || state.session.streaming) return;
  if (!ensureLlmReady()) return;

  const userMessage = { id: nextId('u'), role: 'user', content: text, createdAt: Date.now() };
  const assistantMessage = newAssistantMessage();
  state.session.messages.push(userMessage, assistantMessage);

  els.messages.appendChild(renderUserMessage(userMessage));
  els.messages.appendChild(createAssistantShell(assistantMessage));
  renderAssistant(assistantMessage);
  updateWelcome();
  updateChrome();
  scrollToBottom(els.scroll);

  // 每次提问自动切到「管道」页签，观察检索链路
  emit('requestTab', 'pipeline');

  await runTurn(assistantMessage, text);
}

async function runTurn(assistantMessage, question) {
  const turn = ++turnSeq;
  const isCurrent = () => turn === turnSeq;
  const controller = new AbortController();

  beginSession(controller);
  assistantMessage.status = 'pending';
  renderAssistant(assistantMessage);
  updateChrome();

  let aborted = false;
  let firstDelta = false;

  const scheduleBody = rafThrottle(() => {
    if (!isCurrent()) return;
    const stick = isNearBottom(els.scroll, 120);
    renderAssistantBody(assistantMessage);
    if (stick) scrollToBottom(els.scroll);
  });

  try {
    await streamChat({
      messages: apiMessages(),
      topK: state.settings.topK,
      mode: state.settings.mode,
      temperature: state.settings.temperature,
      signal: controller.signal,
      onEvent: (event, data) => {
        if (!isCurrent()) return;
        switch (event) {
          case 'meta': {
            assistantMessage.meta = data;
            state.session.meta = data;
            break;
          }
          case 'retrieval': {
            state.retrieval = data;
            emit('retrieval', data);
            break;
          }
          case 'prompt': {
            state.prompt = data;
            emit('prompt', data);
            break;
          }
          case 'reasoning': {
            assistantMessage.reasoning += String(data?.text || '');
            renderReasoning(assistantMessage);
            break;
          }
          case 'delta': {
            if (!firstDelta) {
              firstDelta = true;
              assistantMessage.status = 'streaming';
            }
            assistantMessage.content += String(data?.text || '');
            scheduleBody();
            emit('chat:delta', data);
            break;
          }
          case 'error': {
            // 只上报错误：已生成的部分保留在正文里，不切换任何兜底答案
            assistantMessage.error = `模型调用失败（${data?.code || 'error'}）：${data?.message || '未知错误'}`;
            renderAssistantError(assistantMessage);
            emit('chat:error', data?.message || '模型调用失败');
            break;
          }
          case 'done': {
            assistantMessage.done = data;
            state.done = data;
            break;
          }
          default:
            break;
        }
      },
    });
  } catch (error) {
    if (!isCurrent()) return;
    aborted = error?.name === 'AbortError' || Boolean(controller.signal.aborted);
    // 若 done 事件已经在中断前到达，视为正常完成而不是被停止
    if (aborted && assistantMessage.done) {
      aborted = false;
      assistantMessage.status = 'done';
    } else if (aborted) {
      assistantMessage.status = 'stopped';
    } else {
      assistantMessage.status = 'error';
      assistantMessage.error = error?.message || String(error);
      emit('chat:error', assistantMessage.error);
      toast(assistantMessage.error, 'error', 5200);
    }
  } finally {
    if (!isCurrent()) return;
    if (!aborted && (assistantMessage.status === 'pending' || assistantMessage.status === 'streaming')) {
      assistantMessage.status = 'done';
    }
    renderAssistant(assistantMessage);
    updateChrome();
    updateWelcome();
    endSession(assistantMessage.done, { aborted, error: assistantMessage.error });
    emit('requestHealth');
  }
}

function stopGeneration() {
  const controller = state.session.controller;
  if (!controller) return;
  try {
    controller.abort();
  } catch {
    /* ignore */
  }
}

function clearChat() {
  turnSeq += 1; // 让仍在进行的 runTurn 失效
  const controller = state.session.controller;
  if (controller) {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  }
  resetSession();
  clear(els.messages);
  updateWelcome();
  updateChrome();
  updateComposerCount();
  if (els.input) {
    els.input.value = '';
    resizeComposer();
    els.input.focus();
  }
}

function retryTurn(failedMessage) {
  if (state.session.streaming) return;
  if (!ensureLlmReady()) return;
  const index = state.session.messages.indexOf(failedMessage);
  if (index < 0) return;
  // 找到上一条 user 消息
  let userMessage = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (state.session.messages[i].role === 'user') {
      userMessage = state.session.messages[i];
      break;
    }
  }
  if (!userMessage) return;

  const ref = refs.get(failedMessage);
  ref?.root.remove();
  state.session.messages.splice(index, 1);

  const assistantMessage = newAssistantMessage();
  state.session.messages.push(assistantMessage);
  els.messages.appendChild(createAssistantShell(assistantMessage));
  renderAssistant(assistantMessage);
  updateChrome();
  scrollToBottom(els.scroll);
  emit('requestTab', 'pipeline');
  runTurn(assistantMessage, userMessage.content);
}

/* ==========================================================================
   引用角标交互
   ========================================================================== */
function handleMessageClick(event) {
  const cite = event.target instanceof Element ? event.target.closest('.cite') : null;
  if (!cite) return;
  const marker = cite.dataset.marker;
  const hit = resolveCitation(marker);
  if (!hit) {
    toast(`引用 [${marker}] 没有对应的召回片段`, 'info');
    return;
  }
  emit('focusChunk', hit.chunkId);
}

/* ==========================================================================
   输入区事件
   ========================================================================== */
function bindComposer() {
  if (!els.form) return;

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = els.input?.value || '';
    if (!text.trim() || state.session.streaming) return;
    els.input.value = '';
    resizeComposer();
    updateComposerCount();
    updateChrome();
    sendMessage(text);
  });

  els.input?.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      els.form.requestSubmit();
    }
  });

  els.input?.addEventListener('input', () => {
    resizeComposer();
    updateComposerCount();
    updateChrome();
  });

  els.stopBtn?.addEventListener('click', stopGeneration);

  els.suggestions?.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.suggest') : null;
    if (!button || button.disabled) return;
    const question = button.dataset.q || button.textContent || '';
    if (!question.trim()) return;
    sendMessage(question);
  });
}

/** 供 app.js 绑定顶栏「清空对话」 */
export function clearConversation() {
  clearChat();
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initChat() {
  els.scroll = document.getElementById('chat-scroll');
  els.welcome = document.getElementById('chat-welcome');
  els.messages = document.getElementById('messages');
  els.form = document.getElementById('composer');
  els.input = document.getElementById('composer-input');
  els.sendBtn = document.getElementById('send-btn');
  els.stopBtn = document.getElementById('stop-btn');
  els.count = document.getElementById('composer-count');
  els.turn = document.getElementById('chat-turn');
  els.live = document.getElementById('chat-live');
  els.suggestions = document.getElementById('suggestions');

  if (!els.form || !els.messages) return;

  els.messages.addEventListener('click', handleMessageClick);
  bindComposer();
  renderAll();
  updateChrome();
  updateComposerCount();
  resizeComposer();

  on('health:change', () => updateChrome());
  on('settings:change', () => updateChrome());
  on('session:reset', () => {
    renderAll();
    updateChrome();
  });
}
