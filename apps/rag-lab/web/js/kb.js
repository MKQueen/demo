/**
 * kb.js —— 「知识库」页签
 *
 * 左侧文档列表（块数 / tokens / 摘要），右侧当前文档的文本块列表；
 * 顶部关键词过滤同时作用于「文档（标题/摘要/正文命中）」与「块正文」，命中词高亮。
 */
import { h, clear, debounce, emptyState, fmtNum, highlightTerms } from './util.js';
import { on, state } from './state.js';

const els = {
  stats: null,
  docList: null,
  chunkList: null,
  search: null,
  badge: null,
  sub: null,
  docsSub: null,
  chunksSub: null,
  chunkTitle: null,
  tabCount: null,
};

let selectedDocId = null;

/* ==========================================================================
   数据辅助
   ========================================================================== */
function allChunks() {
  return Array.isArray(state.kb?.chunks) ? state.kb.chunks : [];
}

function allDocs() {
  const docs = Array.isArray(state.kb?.docs) ? state.kb.docs : [];
  return [...docs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function docChunks(docId) {
  return allChunks()
    .filter((chunk) => chunk.docId === docId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function tokensOf(docId) {
  return docChunks(docId).reduce((sum, chunk) => sum + (Number(chunk.tokens) || 0), 0);
}

function searchTerms(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];
  const bySpace = trimmed.split(/\s+/).filter(Boolean);
  return bySpace.length > 1 ? bySpace : [trimmed];
}

function matchesQuery(text, terms) {
  if (!terms.length) return true;
  const lower = String(text || '').toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

/* ==========================================================================
   头部 / 统计
   ========================================================================== */
function renderStats() {
  if (!els.stats) return;
  clear(els.stats);
  const kb = state.kb;
  if (!kb) return;
  const stats = kb.stats || {};
  const embed = kb.embedding || {};
  const items = [
    ['文档', fmtNum(stats.docs ?? allDocs().length), 'c-cyan', ''],
    ['文本块', fmtNum(stats.chunks ?? allChunks().length), '', ''],
    ['tokens', fmtNum(stats.totalTokens ?? allChunks().reduce((sum, chunk) => sum + (Number(chunk.tokens) || 0), 0)), '', ''],
    ['平均块 token', fmtNum(stats.avgTokens), '', ''],
    ['dim', fmtNum(stats.dim ?? embed.dim), 'c-purple', ''],
    ['embedding', embed.mode || '—', '', embed.note || ''], // note 文案来自 /api/kb
  ];
  for (const [label, value, tone, tip] of items) {
    els.stats.appendChild(
      h(
        'span',
        { class: 'kb-stat', title: tip || undefined },
        label,
        h('b', { class: tone, text: value }),
      ),
    );
  }
}

/** 知识库快照来源：浏览器模式读构建产物 kb-data.json，服务器模式读 /api/kb */
const KB_SOURCE = globalThis.__RAG_BROWSER_MODE__
  ? '构建时生成的 kb-data.json · 浏览器内切块 / 索引'
  : '/api/kb';

function updateHeaders(visibleDocs, visibleChunkCount) {
  const kb = state.kb;
  const totalChunks = allChunks().length;
  const docs = allDocs();
  if (els.badge) els.badge.textContent = totalChunks ? `${totalChunks} 块` : '—';
  if (els.sub) {
    els.sub.textContent = kb
      ? `来自 ${KB_SOURCE} 的全量快照 · ${fmtNum(kb.stats?.docs ?? docs.length)} 篇文档 · ${fmtNum(kb.stats?.totalTokens)} tokens`
      : `来自 ${KB_SOURCE} 的全量快照`;
  }
  if (els.docsSub) {
    els.docsSub.textContent = kb ? `${visibleDocs.length}/${docs.length} 篇` : '—';
  }
  if (els.chunksSub) {
    els.chunksSub.textContent = selectedDocId ? `${visibleChunkCount} 块` : '—';
  }
  if (els.tabCount) {
    els.tabCount.textContent = String(totalChunks);
    els.tabCount.hidden = totalChunks === 0;
  }
}

/* ==========================================================================
   文档列表
   ========================================================================== */
function renderDocs(visibleDocs, terms) {
  if (!els.docList) return;
  clear(els.docList);

  if (!state.kb) {
    els.docList.appendChild(
      emptyState({
        art: 'kb',
        title: state.kbStatus === 'error' ? '知识库加载失败' : '知识库尚未加载',
        desc: state.kbError || `等待 ${KB_SOURCE} 返回文档快照。`,
      }),
    );
    return;
  }

  if (!visibleDocs.length) {
    els.docList.appendChild(
      h('div', { class: 'kb-empty-filter', text: `没有匹配「${els.search?.value.trim() || ''}」的文档或小节` }),
    );
    return;
  }

  for (const doc of visibleDocs) {
    const chunks = docChunks(doc.id);
    const active = doc.id === selectedDocId;
    const item = h(
      'button',
      {
        type: 'button',
        class: `kb-doc-item${active ? ' is-active' : ''}`,
        'aria-pressed': active ? 'true' : 'false',
        onClick: () => {
          selectedDocId = doc.id;
          render();
        },
      },
      h(
        'span',
        { class: 'kb-doc-top' },
        h('i', { class: 'doc-dot', style: { '--doc-color': docColorOf(doc.id) } }),
        h('span', { class: 'kb-doc-name', text: doc.title || doc.id }),
        h('span', { class: 'kb-doc-count', text: `${chunks.length} 块 · ${fmtNum(tokensOf(doc.id))} tok` }),
      ),
      h('span', { class: 'kb-doc-summary', text: doc.summary || doc.file || '' }),
    );
    // 搜索时把文档标题里命中的部分高亮
    if (terms.length) {
      const nameEl = item.querySelector('.kb-doc-name');
      if (nameEl && matchesQuery(doc.title || doc.id, terms)) {
        clear(nameEl);
        nameEl.appendChild(highlightTerms(doc.title || doc.id, terms));
      }
    }
    els.docList.appendChild(item);
  }
}

/** 避免两次 import 循环，直接读 state 里的颜色表 */
function docColorOf(docId) {
  return state.docColors?.get?.(docId) || '#8b98a9';
}

/* ==========================================================================
   文本块列表
   ========================================================================== */
function renderChunks(terms) {
  if (!els.chunkList) return 0;
  clear(els.chunkList);

  if (!state.kb) {
    els.chunkList.appendChild(
      emptyState({
        art: 'kb',
        title: '暂无文本块',
        desc: '知识库加载后，这里会按章节展示当前文档的全部文本块。',
      }),
    );
    return 0;
  }

  const chunks = selectedDocId ? docChunks(selectedDocId) : [];
  const filtered = terms.length
    ? chunks.filter((chunk) => matchesQuery(`${chunk.section || ''} ${chunk.text || ''}`, terms))
    : chunks;

  if (!filtered.length) {
    els.chunkList.appendChild(
      h('div', {
        class: 'kb-empty-filter',
        text: terms.length ? `当前文档内没有命中「${els.search?.value.trim() || ''}」的文本块` : '该文档暂无文本块',
      }),
    );
    return 0;
  }

  for (const chunk of filtered) {
    const textEl = h('div', { class: 'kb-chunk-text' });
    textEl.appendChild(highlightTerms(chunk.text || '', terms));
    const sectionEl = h('div', { class: 'kb-chunk-sec' });
    sectionEl.appendChild(highlightTerms(chunk.section || '—', terms));

    els.chunkList.appendChild(
      h(
        'article',
        { class: 'kb-chunk' },
        h(
          'div',
          { class: 'kb-chunk-head' },
          sectionEl,
          h('span', { class: 'kb-chunk-id', text: chunk.id || '' }),
        ),
        textEl,
        h(
          'div',
          { class: 'kb-chunk-foot' },
          h('span', { class: 'tok', text: `${fmtNum(chunk.tokens)} tokens` }),
          h('span', { text: `${fmtNum(chunk.chars)} 字符` }),
          h('span', { text: `order ${fmtNum(chunk.order)}` }),
        ),
      ),
    );
  }
  return filtered.length;
}

/* ==========================================================================
   总渲染
   ========================================================================== */
function render() {
  if (!els.docList) return;
  const rawQuery = els.search?.value || '';
  const terms = searchTerms(rawQuery);
  const docs = allDocs();
  const chunks = allChunks();

  // 过滤命中的文档：标题/摘要/文件命中，或正文块命中
  const visibleDocs = !terms.length
    ? docs
    : docs.filter((doc) => {
        const metaMatch = matchesQuery(`${doc.title || ''} ${doc.summary || ''} ${doc.file || ''} ${doc.id || ''}`, terms);
        const chunkMatch = chunks.some(
          (chunk) => chunk.docId === doc.id && matchesQuery(`${chunk.section || ''} ${chunk.text || ''}`, terms),
        );
        return metaMatch || chunkMatch;
      });

  // 保证选中项在可见列表里
  if (!visibleDocs.some((doc) => doc.id === selectedDocId)) {
    selectedDocId = visibleDocs[0]?.id || null;
  }

  renderStats();
  renderDocs(visibleDocs, terms);
  const chunkCount = renderChunks(terms);
  updateHeaders(visibleDocs, chunkCount);

  if (els.chunkTitle) {
    const doc = docs.find((item) => item.id === selectedDocId);
    els.chunkTitle.textContent = doc ? doc.title || doc.id : '文本块';
  }
  if (els.sub && !state.kb) {
    els.sub.textContent = state.kbStatus === 'error' ? state.kbError || '知识库加载失败' : '正在加载知识库…';
  }
}

/** 供 app.js 在 kb 加载 / 报错后主动刷新 */
export function refreshKb() {
  render();
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initKb() {
  els.stats = document.getElementById('kb-stats');
  els.docList = document.getElementById('kb-doc-list');
  els.chunkList = document.getElementById('kb-chunk-list');
  els.search = document.getElementById('kb-search');
  els.badge = document.getElementById('kb-badge');
  els.sub = document.getElementById('kb-sub');
  els.docsSub = document.getElementById('kb-docs-sub');
  els.chunksSub = document.getElementById('kb-chunks-sub');
  els.chunkTitle = document.getElementById('kb-chunk-title');
  els.tabCount = document.getElementById('tab-count-kb');

  render();

  els.search?.addEventListener(
    'input',
    debounce(() => {
      render();
    }, 120),
  );

  on('kb:change', () => {
    selectedDocId = null;
    render();
  });
  on('session:reset', () => {
    // 对话重置不影响知识库浏览，只是重绘一次保持一致
    render();
  });
}
