/**
 * pipeline.js —— 「管道」页签
 *
 * 结构：
 *   ① 顶部六节点流程图：5 个检索阶段（来自 SSE retrieval.steps）+ 生成阶段；
 *   ② 左下「检索详解」：query / 模式 / 耗时 / 候选数 / 检索词 / 向量预览 / prompt token；
 *   ③ 右下「召回列表」：Top-K 紧凑行，点击联动到召回卡片。
 *
 * 状态驱动：retrieval 到达时按顺序逐段点亮前 5 段，prompt 到达点亮生成段，
 * done 到达标记生成完成；全程只依赖事件，不主动轮询。
 */
import { h, clear, icon, emptyState, fmtMs, fmtNum, fmtScore, colorWithAlpha } from './util.js';
import { on, emit, state } from './state.js';

/* 阶段图标与配色：真实数据里 key 固定为 analyze/embed/vector/keyword/fuse */
const ICON_BY_KEY = {
  analyze: 'spark',
  embed: 'layers',
  vector: 'scatter',
  keyword: 'recall',
  fuse: 'pipeline',
  generate: 'bot',
};
const COLOR_BY_KEY = {
  analyze: '#22d3ee',
  embed: '#60a5fa',
  vector: '#a78bfa',
  keyword: '#fbbf24',
  fuse: '#34d399',
  generate: '#f472b6',
};

/** 向量化阶段的占位文案：维度 / 模式一律来自 API（health 或 kb），绝不写死 */
function embeddingHint() {
  const fromKb = state.kb?.embedding;
  const fromHealth = state.backend.health?.embedding;
  const embed = fromKb?.dim != null ? fromKb : fromHealth || {};
  const mode = embed?.mode;
  const dim = embed?.dim;
  if (mode && dim) return `${mode}-embedding · dim=${dim}`;
  if (dim) return `dim=${dim}`;
  if (mode) return `${mode}-embedding`;
  return '等待知识库加载…';
}

/** 默认骨架（尚未拿到 retrieval 时展示，字段名与契约一致） */
function defaultStages() {
  return [
    { key: 'analyze', name: '查询理解', detail: '去停用词 / 提取检索词' },
    { key: 'embed', name: '向量化', detail: embeddingHint() },
    { key: 'vector', name: '向量召回', detail: '余弦相似度 Top-K' },
    { key: 'keyword', name: '关键词召回', detail: 'BM25 文本匹配' },
    { key: 'fuse', name: '融合重排', detail: 'RRF 融合 → Top-K' },
  ];
}

const GENERATION_NODE = {
  key: 'generate',
  name: '生成回答',
  detail: '等待检索结果',
  icon: 'bot',
  color: COLOR_BY_KEY.generate,
};

const els = {
  flow: null,
  detail: null,
  hits: null,
  query: null,
  mode: null,
  stats: null,
  detailSub: null,
  hitsSub: null,
};

/** 当前步骤节点（不含生成节点） */
let stepNodes = [];
let generationNode = null;
let timers = [];

/* ==========================================================================
   渲染工具
   ========================================================================== */
function accentVars(color) {
  return {
    '--fn-accent': color,
    '--fn-accent-soft': colorWithAlpha(color, 0.1),
    '--fn-accent-border': colorWithAlpha(color, 0.32),
    '--fn-accent-glow': colorWithAlpha(color, 0.18),
  };
}

function createNode(definition) {
  const color = definition.color || COLOR_BY_KEY[definition.key] || '#22d3ee';
  const node = h(
    'article',
    {
      class: 'flow-node',
      dataset: { state: 'idle', key: definition.key },
      style: accentVars(color),
      'aria-label': `${definition.name} 阶段`,
    },
    h(
      'div',
      { class: 'fn-top' },
      h('span', { class: 'fn-icon' }, icon(definition.icon || ICON_BY_KEY[definition.key] || 'pipeline')),
      h('span', { class: 'fn-name', text: definition.name }),
    ),
    h(
      'div',
      { class: 'fn-bar-row' },
      h('div', { class: 'fn-bar' }, h('i')),
      h('span', { class: 'fn-ms', text: '—' }),
    ),
    h('div', { class: 'fn-detail', text: definition.detail || '等待中' }),
  );
  return node;
}

function setNodeState(node, nextState) {
  if (!node) return;
  node.dataset.state = nextState;
  node.classList.toggle('is-done', nextState === 'done');
}

function setNodeMeta(node, { ms, barPercent, detail }) {
  if (!node) return;
  const msEl = node.querySelector('.fn-ms');
  const barEl = node.querySelector('.fn-bar i');
  const detailEl = node.querySelector('.fn-detail');
  if (msEl && ms != null) msEl.textContent = fmtMs(ms);
  if (barEl && barPercent != null) barEl.style.width = `${Math.max(4, Math.min(100, barPercent))}%`;
  if (detailEl && detail != null) detailEl.textContent = detail;
}

function clearTimers() {
  for (const timer of timers) window.clearTimeout(timer);
  timers = [];
}

/** 渲染六节点骨架（steps 为 null 时用默认五段） */
function renderFlow(steps) {
  const container = els.flow;
  if (!container) return;
  clear(container);
  stepNodes = [];
  generationNode = null;

  const stageList = Array.isArray(steps) && steps.length
    ? steps.map((step) => ({
        key: step.key,
        name: step.name,
        detail: step.detail,
        icon: ICON_BY_KEY[step.key],
        color: COLOR_BY_KEY[step.key],
      }))
    : defaultStages();

  for (const stage of stageList) {
    const node = createNode(stage);
    node.dataset.gen = 'false';
    stepNodes.push(node);
    container.appendChild(node);
  }
  generationNode = createNode({ ...GENERATION_NODE });
  generationNode.dataset.gen = 'true';
  container.appendChild(generationNode);
}

function renderStat(label, value, tone = '') {
  return h(
    'span',
    { class: 'stat-inline' },
    `${label} `,
    h('b', { class: tone ? `c-${tone}` : '', text: value }),
  );
}

function renderIdleStats() {
  if (!els.stats) return;
  clear(els.stats);
  const kb = state.kb;
  if (kb?.stats) {
    els.stats.appendChild(renderStat('文档', fmtNum(kb.stats.docs)));
    els.stats.appendChild(renderStat('块', fmtNum(kb.stats.chunks)));
    els.stats.appendChild(renderStat('dim', fmtNum(kb.stats.dim ?? kb.embedding?.dim)));
  }
}

/* ==========================================================================
   检索详解
   ========================================================================== */
function detailSection(title, ...children) {
  return h('div', { class: 'detail-block' }, h('div', { class: 'detail-h', text: title }), ...children);
}

function kv(key, value, tone = '') {
  return h(
    'div',
    { class: 'kv' },
    h('span', { class: 'kv-k', text: key }),
    h('span', { class: `kv-v ${tone}`.trim(), text: value }),
  );
}

function renderEmbeddingPreview(embedding) {
  const preview = Array.isArray(embedding?.preview) ? embedding.preview : [];
  const maxAbs = Math.max(0.0001, ...preview.map((value) => Math.abs(Number(value) || 0)));
  const container = h('div', { class: 'ep' });
  for (const value of preview) {
    const number = Number(value) || 0;
    const percent = Math.max(8, (Math.abs(number) / maxAbs) * 100);
    container.appendChild(
      h('i', {
        class: number >= 0 ? 'pos' : 'neg',
        style: { height: `${percent}%` },
        title: String(number),
      }),
    );
  }
  return h(
    'div',
    { class: 'detail-block' },
    h('div', { class: 'detail-h', text: 'query embedding' }),
    container,
    h('div', {
      class: 'ep-note',
      text: `dim=${fmtNum(embedding?.dim)} · nonzero=${fmtNum(embedding?.nonzero)} · 展示前 ${preview.length} 维`,
    }),
  );
}

function renderDetail() {
  const body = els.detail;
  if (!body) return;
  const retrieval = state.retrieval;
  clear(body);

  if (!retrieval) {
    const kb = state.kb;
    const summary = kb?.stats
      ? `当前知识库 ${fmtNum(kb.stats.docs)} 篇文档 / ${fmtNum(kb.stats.chunks)} 个块 / ${fmtNum(kb.stats.dim ?? kb.embedding?.dim)} 维向量。发送问题后这里会展示检索细节。`
      : '发送一条消息后，这里会展示查询理解、向量化与召回细节。';
    body.appendChild(
      emptyState({ art: 'pipeline', title: '等待检索', desc: summary }),
    );
    return;
  }

  body.appendChild(
    detailSection(
      'retrieval',
      kv('原始查询', retrieval.query || '—'),
      kv('检索模式', retrieval.mode || 'hybrid', 'c-cyan'),
      kv('topK', String(retrieval.topK ?? '—')),
      kv('候选块', fmtNum(retrieval.candidates)),
      kv('检索耗时', fmtMs(retrieval.latencyMs), 'c-green'),
    ),
  );

  const terms = Array.isArray(retrieval.keywordTerms) ? retrieval.keywordTerms : [];
  body.appendChild(
    detailSection(
      'keyword terms',
      h(
        'div',
        { class: 'term-chips' },
        terms.length
          ? terms.map((term) => h('span', { class: 'term', text: term }))
          : h('span', { class: 'term term--empty', text: '无关键词命中' }),
      ),
    ),
  );

  if (retrieval.queryEmbedding) body.appendChild(renderEmbeddingPreview(retrieval.queryEmbedding));

  // prompt 到达后，补充 token 分配（同一卡片内继续追加）
  if (state.prompt?.tokens) {
    const tokens = state.prompt.tokens;
    const done = state.done;
    const blocks = [
      kv('system', fmtNum(tokens.system)),
      kv('context', fmtNum(tokens.context), 'c-purple'),
      kv('history', fmtNum(tokens.history), 'c-amber'),
      kv('total', fmtNum(tokens.total), 'c-cyan'),
      kv('上下文块', `${state.prompt.contextBlocks?.length ?? 0} 个`),
    ];
    if (done?.usage) {
      blocks.push(kv('实际 usage', `${fmtNum(done.usage.total_tokens)} tokens`));
    }
    body.appendChild(detailSection('prompt tokens', ...blocks));
  } else if (retrieval) {
    body.appendChild(
      detailSection(
        'prompt tokens',
        h('div', { class: 'ep-note', text: '等待 prompt 事件…' }),
      ),
    );
  }
}

/* ==========================================================================
   召回列表
   ========================================================================== */
function focusChunk(chunkId) {
  emit('focusChunk', chunkId);
}

function renderHits() {
  const body = els.hits;
  if (!body) return;
  const retrieval = state.retrieval;
  clear(body);

  if (!retrieval) {
    body.appendChild(
      emptyState({ art: 'recall', title: '暂无召回结果', desc: '检索完成后，Top-K 片段会按融合分数排序显示在这里。' }),
    );
    return;
  }

  const hits = Array.isArray(retrieval.hits) ? retrieval.hits : [];
  if (!hits.length) {
    body.appendChild(
      emptyState({ art: 'recall', title: '没有命中片段', desc: '换个问法，或检查知识库是否已加载。' }),
    );
    return;
  }

  const maxFused = Math.max(...hits.map((hit) => Number(hit?.scores?.fused) || 0), 0.0001);
  for (const hit of hits) {
    const fused = Number(hit?.scores?.fused) || 0;
    const row = h(
      'div',
      {
        class: 'hit-row',
        dataset: { rank: String(hit.rank), chunkId: hit.chunkId },
        role: 'button',
        tabindex: '0',
        title: `${hit.docTitle} · ${hit.section}（点击定位召回卡片）`,
        onClick: () => focusChunk(hit.chunkId),
        onKeydown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusChunk(hit.chunkId);
          }
        },
      },
      h('span', { class: 'hit-rank', text: String(hit.rank) }),
      h(
        'span',
        { class: 'hit-main' },
        h(
          'span',
          { class: 'hit-title' },
          h('span', { class: 'hit-doc', text: hit.docTitle || hit.docId || '—' }),
          h('span', { class: 'hit-sec', text: hit.section || '' }),
        ),
        h(
          'span',
          { class: 'hit-score' },
          h('span', { class: 'mini-bar' }, h('i', { style: { width: `${Math.max(4, (fused / maxFused) * 100)}%` } })),
          h('span', { class: 'score-val', text: fmtScore(fused) }),
        ),
      ),
    );
    body.appendChild(row);
  }
}

/* ==========================================================================
   状态切换
   ========================================================================== */
function renderStats() {
  if (!els.stats) return;
  const retrieval = state.retrieval;
  clear(els.stats);
  if (!retrieval) {
    renderIdleStats();
    return;
  }
  els.stats.appendChild(renderStat('延迟', fmtMs(retrieval.latencyMs), 'green'));
  els.stats.appendChild(renderStat('候选', fmtNum(retrieval.candidates)));
  els.stats.appendChild(renderStat('topK', fmtNum(retrieval.topK)));
  if (state.prompt?.tokens) {
    els.stats.appendChild(renderStat('prompt', `${fmtNum(state.prompt.tokens.total)} tok`, 'cyan'));
  }
  if (state.done) {
    els.stats.appendChild(renderStat('生成', fmtMs(state.done.latencyMs), 'purple'));
  }
}

function updateHeaders() {
  const retrieval = state.retrieval;
  if (els.mode) {
    els.mode.textContent = retrieval?.mode || 'hybrid';
  }
  if (els.query) {
    if (retrieval) {
      const terms = Array.isArray(retrieval.keywordTerms) ? retrieval.keywordTerms.slice(0, 3).join(' / ') : '';
      els.query.textContent = `「${retrieval.query}」 · ${retrieval.topK} 个召回${terms ? ` · 检索词 ${terms}` : ''}`;
    } else {
      els.query.textContent = '发送一条消息，观察五阶段检索与生成如何逐段点亮';
    }
  }
  if (els.detailSub) {
    els.detailSub.textContent = state.done
      ? `生成 ${fmtMs(state.done.latencyMs)} · tokens ${fmtNum(state.done.usage?.total_tokens)}`
      : retrieval
        ? `检索 ${fmtMs(retrieval.latencyMs)} · ${fmtNum(retrieval.candidates)} 候选`
        : '等待首次检索';
  }
  if (els.hitsSub) {
    els.hitsSub.textContent = retrieval
      ? `top ${retrieval.hits?.length ?? 0} · 融合分数 RRF`
      : '等待首次检索';
  }
}

/** 重置为骨架 / 空状态 */
export function resetPipeline() {
  clearTimers();
  renderFlow(null);
  renderStats();
  updateHeaders();
  renderDetail();
  renderHits();
}

/* ==========================================================================
   对外事件处理
   ========================================================================== */
function handleChatStart() {
  clearTimers();
  renderFlow(null);
  renderStats();
  updateHeaders();
  renderDetail();
  renderHits();
  // 查询文本先显示在头部，已有 retrieval 会在稍后覆盖
  if (els.query) {
    const lastUser = [...state.session.messages].reverse().find((message) => message.role === 'user');
    if (lastUser) els.query.textContent = `「${lastUser.content}」 · 正在检索…`;
  }
}

function handleRetrieval(retrieval) {
  clearTimers();
  renderFlow(retrieval.steps);
  renderStats();
  updateHeaders();
  renderDetail();
  renderHits();

  const steps = Array.isArray(retrieval.steps) ? retrieval.steps : [];
  const maxMs = Math.max(...steps.map((step) => Number(step.ms) || 0), 0.2);
  steps.forEach((step, index) => {
    const node = stepNodes[index];
    if (!node) return;
    setNodeMeta(node, {
      ms: step.ms,
      barPercent: (Number(step.ms) / maxMs) * 100,
      detail: step.detail,
    });
  });

  if (generationNode) {
    setNodeMeta(generationNode, { ms: null, barPercent: 0, detail: '等待 prompt 拼装…' });
  }

  // 逐段点亮：每段先高亮为 active，再落定为 done
  steps.forEach((step, index) => {
    const node = stepNodes[index];
    if (!node) return;
    timers.push(
      window.setTimeout(() => setNodeState(node, 'active'), index * 85),
    );
    timers.push(
      window.setTimeout(() => setNodeState(node, 'done'), index * 85 + 190),
    );
  });
}

function handlePrompt(prompt) {
  if (generationNode) {
    setNodeState(generationNode, 'active');
    setNodeMeta(generationNode, {
      ms: null,
      barPercent: 15,
      detail: `Prompt 已拼装 · ${fmtNum(prompt?.tokens?.total)} tokens`,
    });
  }
  renderStats();
  updateHeaders();
  renderDetail();
}

function handleDelta() {
  if (!generationNode) return;
  if (generationNode.dataset.state === 'active') {
    const detailEl = generationNode.querySelector('.fn-detail');
    if (detailEl) detailEl.textContent = '流式输出中…';
    const bar = generationNode.querySelector('.fn-bar i');
    if (bar) bar.style.width = '55%';
  }
}

function handleDone(done) {
  if (!generationNode) return;
  setNodeState(generationNode, 'done');
  const modeLabel = done?.failed ? '生成失败' : '真实模型生成';
  setNodeMeta(generationNode, {
    ms: done?.latencyMs,
    barPercent: 100,
    detail: `${modeLabel} · ${fmtNum(done?.usage?.total_tokens)} tokens`,
  });
  renderStats();
  updateHeaders();
  renderDetail();
}

function handleError(message) {
  if (!generationNode) return;
  setNodeState(generationNode, 'error');
  const detailEl = generationNode.querySelector('.fn-detail');
  if (detailEl) detailEl.textContent = message || '生成失败';
  renderStats();
}

/** 生成阶段被用户中止 */
function handleAborted() {
  if (!generationNode) return;
  setNodeState(generationNode, 'idle');
  const detailEl = generationNode.querySelector('.fn-detail');
  if (detailEl) detailEl.textContent = '已停止生成';
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initPipeline() {
  els.flow = document.getElementById('pipeline-flow');
  els.detail = document.getElementById('pipeline-detail');
  els.hits = document.getElementById('pipeline-hits');
  els.query = document.getElementById('pipeline-query');
  els.mode = document.getElementById('pipeline-mode');
  els.stats = document.getElementById('pipeline-stats');
  els.detailSub = document.getElementById('pipeline-detail-sub');
  els.hitsSub = document.getElementById('pipeline-hits-sub');

  resetPipeline();

  on('chat:start', handleChatStart);
  on('retrieval', handleRetrieval);
  on('prompt', handlePrompt);
  on('chat:delta', handleDelta);
  on('chat:done', ({ done, aborted, error }) => {
    if (error) handleError(error);
    else if (aborted) handleAborted();
    else handleDone(done);
  });
  on('chat:error', (message) => handleError(message));
  on('session:reset', resetPipeline);
  on('kb:change', () => {
    if (!state.retrieval) {
      clearTimers();
      renderFlow(null); // 维度/模式可能刚由 API 返回，重绘默认骨架
      renderStats();
      renderDetail();
    }
  });
  on('health:change', () => {
    if (!state.retrieval) {
      clearTimers();
      renderFlow(null);
    }
  });
}
