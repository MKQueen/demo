/**
 * citations.js —— 「召回」页签 + 引用角标联动
 *
 * 召回卡片是 RAG 的可解释性核心：排名、来源、正文（命中词高亮）、三路分数。
 * 同时对外提供引用角标 [n] 的解析与「滚动到对应卡片并高亮」能力。
 */
import { h, clear, emptyState, fmtMs, fmtNum, fmtScore, highlightTerms } from './util.js';
import { on, state, colorOfDoc } from './state.js';

const els = {
  list: null,
  count: null,
  sub: null,
  stats: null,
  tabCount: null,
};

/** 三个分数条的说明文案（tooltip） */
const SCORE_TIPS = {
  vector: '向量分数：查询向量与文本块向量的余弦相似度（0~1，越高越相关）',
  keyword: '关键词分数：BM25 文本匹配分归一化到 0~1',
  fused: '融合分数：向量召回 + 关键词召回经 RRF 融合并归一化（0~1），决定最终排名',
};

/** 通过 marker（"1"…"n"）取出对应的召回命中项 */
export function resolveCitation(marker) {
  const hits = state.retrieval?.hits;
  if (!Array.isArray(hits)) return null;
  const index = Number(marker) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= hits.length) return null;
  return hits[index];
}

/** 引用角标 hover 时展示的来源说明 */
export function describeCitation(marker) {
  const hit = resolveCitation(marker);
  if (!hit) return `引用 [${marker}]：本次检索没有对应片段`;
  return `[${marker}] ${hit.docTitle} · ${hit.section}\n融合分数 ${fmtScore(hit.scores?.fused)} · ${hit.chunkId}`;
}

/* ==========================================================================
   渲染
   ========================================================================== */
function renderStat(label, value, tone = '') {
  return h(
    'span',
    { class: 'stat-inline' },
    `${label} `,
    h('b', { class: tone ? `c-${tone}` : '', text: value }),
  );
}

function scoreRow(label, type, value) {
  const number = Number(value) || 0;
  return h(
    'div',
    {
      class: `score score--${type}`,
      'data-tip': `${SCORE_TIPS[type] || ''}\n当前值：${fmtScore(number)}`,
    },
    h(
      'div',
      { class: 'score-top' },
      h('span', { class: 'score-label', text: label }),
      h('span', { class: 'score-val', text: fmtScore(number) }),
    ),
    h('div', { class: 'score-track' }, h('div', { class: 'score-fill', style: { width: `${Math.max(0, Math.min(100, number * 100))}%` } })),
  );
}

function renderCard(hit) {
  const color = colorOfDoc(hit.docId);
  const textMark = h('div', { class: 'recall-text' });
  textMark.appendChild(highlightTerms(hit.text || '', hit.matchedTerms || []));

  const card = h(
    'article',
    {
      class: 'recall-card',
      dataset: { rank: String(hit.rank), chunkId: hit.chunkId },
      id: `recall-card-${hit.rank}`,
      'aria-label': `排名 ${hit.rank}：${hit.docTitle} ${hit.section}`,
    },
    h(
      'div',
      { class: 'recall-head' },
      h('span', { class: 'recall-rank', text: `#${hit.rank}` }),
      h(
        'span',
        { class: 'recall-doc' },
        h('i', { class: 'doc-dot', style: { '--doc-color': color } }),
        h('span', { text: hit.docTitle || hit.docId || '—' }),
      ),
      h('span', { class: 'recall-section', text: hit.section || '' }),
      h('span', { class: 'recall-chunk', text: hit.chunkId || '' }),
    ),
    textMark,
    h(
      'div',
      { class: 'recall-scores' },
      scoreRow('vector 向量', 'vector', hit.scores?.vector),
      scoreRow('keyword 关键词', 'keyword', hit.scores?.keyword),
      scoreRow('fused 融合', 'fused', hit.scores?.fused),
    ),
  );
  return card;
}

/** 渲染召回列表 */
export function renderRecall() {
  if (!els.list) return;
  const retrieval = state.retrieval;
  clear(els.list);

  if (els.count) els.count.textContent = `${retrieval?.hits?.length ?? 0} 条`;
  if (els.tabCount) {
    const length = retrieval?.hits?.length ?? 0;
    els.tabCount.textContent = String(length);
    els.tabCount.hidden = length === 0;
  }
  if (els.sub) {
    els.sub.textContent = retrieval
      ? `查询「${retrieval.query}」· ${retrieval.mode} 模式 · 候选 ${fmtNum(retrieval.candidates)} 块`
      : '向量 + BM25 融合重排后的 Top-K 片段';
  }
  if (els.stats) {
    clear(els.stats);
    if (retrieval) {
      els.stats.appendChild(renderStat('检索耗时', fmtMs(retrieval.latencyMs), 'green'));
      els.stats.appendChild(renderStat('候选', fmtNum(retrieval.candidates)));
      els.stats.appendChild(renderStat('模式', retrieval.mode || 'hybrid', 'cyan'));
    }
  }

  if (!retrieval) {
    els.list.appendChild(
      emptyState({
        art: 'recall',
        title: '还没有召回结果',
        desc: '发送一个问题后，Top-K 片段会按融合分数排序显示在这里；悬停分数条可以查看指标含义。',
      }),
    );
    return;
  }

  const hits = Array.isArray(retrieval.hits) ? retrieval.hits : [];
  if (!hits.length) {
    els.list.appendChild(
      emptyState({
        art: 'recall',
        title: '这次没有命中任何片段',
        desc: '换个更具体的问法，或检查知识库内容是否覆盖该主题。',
      }),
    );
    return;
  }

  for (const hit of hits) els.list.appendChild(renderCard(hit));
}

/* ==========================================================================
   联动：滚动到某张召回卡片并高亮
   ========================================================================== */
export function focusRecallCard(chunkId) {
  if (!els.list) return false;
  const card = Array.from(els.list.querySelectorAll('.recall-card')).find(
    (node) => node.dataset.chunkId === chunkId,
  );
  if (!card) return false;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('is-flash');
  // 强制 reflow 以便连续点击时动画能重新播放
  void card.offsetWidth;
  card.classList.add('is-flash');
  window.setTimeout(() => card.classList.remove('is-flash'), 1600);
  return true;
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initCitations() {
  els.list = document.getElementById('recall-list');
  els.count = document.getElementById('recall-count');
  els.sub = document.getElementById('recall-sub');
  els.stats = document.getElementById('recall-stats');
  els.tabCount = document.getElementById('tab-count-recall');

  renderRecall();

  on('retrieval', renderRecall);
  // 新问题开始时 state.retrieval 已被 beginSession 清空，这里重绘为空状态
  on('chat:start', renderRecall);
  on('session:reset', renderRecall);
  on('kb:change', () => {
    if (state.retrieval) renderRecall();
  });
}
