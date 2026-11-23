/**
 * prompt.js —— 「提示词」页签
 *
 * 展示 SSE prompt 事件里的：
 *  - token 分配（system / context / history / total 堆叠条）；
 *  - 最终发给模型的消息全文（可折叠、保留换行）；
 *  - 检索上下文块（[n] 标记 + 文档/小节 + token 估算）；
 *  - 生成完成后的真实 usage（若后端返回）。
 */
import { h, clear, icon, emptyState, fmtNum, fmtChars, fmtMs } from './util.js';
import { on, state } from './state.js';

const els = {
  body: null,
  sub: null,
  stats: null,
};

const ROLE_LABEL = { system: 'system 消息', user: 'user 消息', assistant: 'assistant 消息' };

function renderStat(label, value, tone = '') {
  return h(
    'span',
    { class: 'stat-inline' },
    `${label} `,
    h('b', { class: tone ? `c-${tone}` : '', text: value }),
  );
}

/* ==========================================================================
   token 堆叠条
   ========================================================================== */
function renderTokenCard(tokens, usage) {
  const total = Math.max(1, Number(tokens?.total) || 0);
  const system = Math.max(0, Number(tokens?.system) || 0);
  const context = Math.max(0, Number(tokens?.context) || 0);
  const history = Math.max(0, Number(tokens?.history) || 0);
  const percent = (value) => `${((value / total) * 100).toFixed(2)}%`;

  const bar = h('div', { class: 'token-bar', role: 'img', 'aria-label': `token 分配：system ${system}，context ${context}，history ${history}，total ${tokens?.total ?? 0}` });
  const segments = [
    { key: 'system', label: 'system', value: system },
    { key: 'context', label: 'context', value: context },
    { key: 'history', label: 'history', value: history },
  ];
  for (const segment of segments) {
    if (!segment.value) continue;
    bar.appendChild(
      h('div', {
        class: `token-seg token-seg--${segment.key}`,
        style: { width: percent(segment.value) },
        title: `${segment.label} · ${fmtNum(segment.value)} tokens`,
      }),
    );
  }

  const legend = h('div', { class: 'token-legend' });
  for (const segment of segments) {
    legend.appendChild(
      h(
        'span',
        { class: 't-li' },
        h('i', { class: `t-dot t-dot--${segment.key}` }),
        h('span', { text: segment.label }),
        h('b', { text: fmtNum(segment.value) }),
        h('span', { class: 't-pct', text: percent(segment.value) }),
      ),
    );
  }

  const card = h(
    'section',
    { class: 'token-card', 'aria-label': 'token 统计' },
    h(
      'div',
      { class: 'token-summary' },
      h('span', { class: 'token-summary-label', text: 'TOTAL TOKENS · system + context + history' }),
      h(
        'span',
        { class: 'token-total' },
        h('b', { text: fmtNum(tokens?.total) }),
        h('span', { text: 'tokens' }),
      ),
    ),
    bar,
    legend,
  );

  if (usage) {
    card.appendChild(
      h(
        'div',
        { class: 'token-usage' },
        h('span', {}, '实际 usage ', h('b', { text: fmtNum(usage.prompt_tokens) }), ' prompt'),
        h('span', {}, h('b', { text: fmtNum(usage.completion_tokens) }), ' completion'),
        h('span', {}, h('b', { text: fmtNum(usage.total_tokens) }), ' total'),
      ),
    );
  }
  return card;
}

/* ==========================================================================
   消息卡片（可折叠）
   ========================================================================== */
function renderMessage(message, index, totalMessages) {
  const role = String(message?.role || 'user');
  const content = String(message?.content ?? '');
  // 默认展开：system 与最后一条消息；历史消息默认收起，避免页面过长
  const open = role === 'system' || index === totalMessages - 1;

  const details = h('details', { class: 'prompt-msg prompt-fold', open: open || undefined });
  details.appendChild(
    h(
      'summary',
      { class: 'pm-head' },
      h('span', { class: `role-badge role-badge--${role}`, text: role }),
      h('span', { class: 'pm-role', text: ROLE_LABEL[role] || `${role} 消息` }),
      h(
        'span',
        { class: 'pm-meta' },
        h('span', { text: fmtChars(Array.from(content).length) }),
        h('span', { text: `${content.split('\n').length} 行` }),
      ),
      icon('chevron', 'ic pm-chev'),
    ),
  );
  details.appendChild(h('div', { class: 'pm-body', text: content }));
  return details;
}

/* ==========================================================================
   上下文块
   ========================================================================== */
function renderContextBlock(block, index) {
  return h(
    'article',
    { class: 'ctx-block' },
    h(
      'div',
      { class: 'ctx-head' },
      h('span', { class: 'ctx-marker', text: block.marker || `[${index + 1}]` }),
      h('span', { class: 'ctx-doc', text: block.docTitle || '—' }),
      h('span', { class: 'ctx-sec', text: block.section || '' }),
      h('span', { class: 'ctx-tokens', text: `${fmtNum(block.tokens)} tok` }),
    ),
    h('div', { class: 'ctx-text', text: String(block.text ?? '') }),
  );
}

/* ==========================================================================
   主渲染
   ========================================================================== */
function renderEmpty() {
  clear(els.body);
  els.body.appendChild(
    emptyState({
      art: 'prompt',
      title: '提示词待生成',
      desc: '发送一个问题后，这里会展示实际发给模型的 system / user 消息、上下文块与 token 分配。',
    }),
  );
  if (els.stats) clear(els.stats);
  if (els.sub) els.sub.textContent = 'system / context / history / total 的 token 分配';
}

function renderPrompt() {
  const prompt = state.prompt;
  const done = state.done;
  if (!els.body) return;

  if (!prompt) {
    renderEmpty();
    return;
  }

  clear(els.body);
  els.body.appendChild(renderTokenCard(prompt.tokens, done?.usage || null));

  const messages = Array.isArray(prompt.messages) ? prompt.messages : [];
  const blocks = Array.isArray(prompt.contextBlocks) ? prompt.contextBlocks : [];

  const messageSection = h('section', { class: 'prompt-section' });
  messageSection.appendChild(
    h(
      'div',
      { class: 'sec-title' },
      h('span', { text: '发送给模型的消息' }),
      h('span', { class: 'sec-count', text: `${messages.length} 条 · 可折叠` }),
    ),
  );
  const messageList = h('div');
  messages.forEach((message, index) => {
    messageList.appendChild(renderMessage(message, index, messages.length));
  });
  messageSection.appendChild(messageList);
  if (!messages.length) {
    messageSection.appendChild(h('div', { class: 'notice', text: 'prompt.messages 为空。' }));
  }
  els.body.appendChild(messageSection);

  const blockSection = h('section', { class: 'prompt-section' });
  blockSection.appendChild(
    h(
      'div',
      { class: 'sec-title' },
      h('span', { text: '检索上下文块' }),
      h('span', { class: 'sec-count', text: `${blocks.length} 个 · 带 [n] 标记` }),
    ),
  );
  if (blocks.length) {
    const list = h('div', { class: 'ctx-list' });
    blocks.forEach((block, index) => list.appendChild(renderContextBlock(block, index)));
    blockSection.appendChild(list);
  } else {
    blockSection.appendChild(
      h('div', { class: 'notice notice--info' }, icon('info'), h('span', { text: '本次没有上下文块（可能是知识库为空）。' })),
    );
  }
  els.body.appendChild(blockSection);

  // 头部统计
  if (els.stats) {
    clear(els.stats);
    els.stats.appendChild(renderStat('消息', `${messages.length} 条`));
    els.stats.appendChild(renderStat('上下文', `${blocks.length} 块`));
    els.stats.appendChild(renderStat('token', fmtNum(prompt.tokens?.total), 'cyan'));
    if (done?.latencyMs != null) {
      els.stats.appendChild(renderStat('生成', fmtMs(done.latencyMs), 'purple'));
    }
  }
  if (els.sub) {
    const query = state.retrieval?.query;
    els.sub.textContent = query
      ? `查询「${query}」· 实际发给模型的完整提示词`
      : 'system / context / history / total 的 token 分配';
  }
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initPrompt() {
  els.body = document.getElementById('prompt-body');
  els.sub = document.getElementById('prompt-sub');
  els.stats = document.getElementById('prompt-stats');

  renderPrompt();

  on('prompt', renderPrompt);
  on('chat:start', renderPrompt);
  on('session:reset', renderPrompt);
  on('chat:done', renderPrompt);
  on('retrieval', () => {
    // retrieval 先到、prompt 后到；这里只在已有 prompt 时刷新头部查询文案
    if (state.prompt) renderPrompt();
  });
}
