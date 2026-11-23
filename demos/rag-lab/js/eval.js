/**
 * eval.js —— 「评测」页签
 *
 * 按需调用 POST /api/eval（页面加载时绝不请求）：
 *  - 顶部 6 张指标卡：hit@1 / hit@3 / hit@k / MRR / 平均耗时 / 用例数；
 *  - 下方用例表格：query、期望文档、实际 rank、命中标记、topHit 小节、耗时；
 *  - 失败用例整行红色高亮；loading / error / 评测集缺失 都有明确状态。
 */
import { h, clear, icon, emptyState, fmtNum, fmtPct, fmtMs } from './util.js';
import { on, state } from './state.js';
import { postEval } from './api.js';

const els = {
  body: null,
  stats: null,
  sub: null,
  runBtn: null,
  topbarBtn: null,
};

/* ==========================================================================
   指标卡
   ========================================================================== */
function metricCard({ label, value, unit, foot, tone = 'cyan', bar = null }) {
  const card = h(
    'div',
    { class: 'metric-card', dataset: { tone } },
    h('div', { class: 'metric-label' }, h('span', { text: label })),
    h('div', { class: 'metric-val' }, h('span', { text: value }), unit ? h('small', { text: unit }) : null),
    foot ? h('div', { class: 'metric-foot', text: foot }) : null,
  );
  if (bar != null) {
    card.appendChild(
      h('div', { class: 'metric-bar' }, h('i', { style: { width: `${Math.max(0, Math.min(100, bar))}%` } })),
    );
  }
  return card;
}

function renderMetrics(data) {
  const grid = h('div', { class: 'metric-grid', 'aria-label': '评测汇总指标' });
  const total = Number(data.total) || (Array.isArray(data.cases) ? data.cases.length : 0);
  const topK = data.topK ?? 5;

  grid.appendChild(
    metricCard({
      label: 'hit@1',
      value: fmtPct(data.hitAt1),
      foot: '期望文档排第 1',
      tone: 'cyan',
      bar: (Number(data.hitAt1) || 0) * 100,
    }),
  );
  grid.appendChild(
    metricCard({
      label: 'hit@3',
      value: fmtPct(data.hitAt3),
      foot: '期望文档进入前 3',
      tone: 'purple',
      bar: (Number(data.hitAt3) || 0) * 100,
    }),
  );
  grid.appendChild(
    metricCard({
      label: `hit@${topK}`,
      value: fmtPct(data.hitAtK),
      foot: `命中率（topK=${topK}）`,
      tone: 'green',
      bar: (Number(data.hitAtK) || 0) * 100,
    }),
  );
  grid.appendChild(
    metricCard({
      label: 'MRR',
      value: Number(data.mrr).toFixed(3),
      foot: '平均倒数排名',
      tone: 'amber',
      bar: Math.min(100, (Number(data.mrr) || 0) * 100),
    }),
  );
  grid.appendChild(
    metricCard({
      label: '平均耗时',
      value: fmtMs(data.avgLatencyMs, 2).replace(' ms', ''),
      unit: 'ms',
      foot: '单条 query 平均检索耗时',
      tone: 'cyan',
    }),
  );
  grid.appendChild(
    metricCard({
      label: '用例数',
      value: fmtNum(total),
      unit: '条',
      foot: `topK=${topK} · 内置评测集`,
      tone: 'dim',
    }),
  );
  return grid;
}

/* ==========================================================================
   用例表格
   ========================================================================== */
function renderCaseRow(item, index) {
  const hit = Boolean(item.hit);
  const rankText = item.rank == null ? '—' : String(item.rank);
  const row = h('tr', { class: hit ? '' : 'is-fail' });

  row.appendChild(h('td', { class: 'rank-cell' }, h('span', { text: String(index + 1).padStart(2, '0') })));
  row.appendChild(h('td', { class: 'td-query', title: item.query }, h('span', { class: 'qid' }), h('span', { text: item.query || '—' })));

  row.appendChild(
    h(
      'td',
      {},
      h(
        'span',
        { class: 'doc-chip', title: item.expectDoc },
        icon('kb'),
        h('span', { text: item.expectDoc || '—' }),
      ),
    ),
  );
  row.appendChild(h('td', { class: `rank-cell${item.rank ? '' : ' is-miss'}` }, h('span', { text: rankText })));

  const badge = h(
    'span',
    { class: `hit-badge ${hit ? 'is-hit' : 'is-miss'}` },
    icon(hit ? 'check' : 'x'),
    h('span', { text: hit ? '命中' : '未命中' }),
  );
  row.appendChild(h('td', {}, badge));

  const topHit = item.topHit;
  row.appendChild(
    h(
      'td',
      {},
      topHit
        ? h(
            'div',
            { class: 'top-hit' },
            h('div', { class: 'th-sec', text: topHit.section || '—', title: topHit.text || '' }),
            h('div', { class: 'th-doc', text: `${topHit.docTitle || ''} · ${topHit.chunkId || ''}` }),
          )
        : h('span', { class: 'dim', text: '—' }),
    ),
  );
  row.appendChild(h('td', { class: 'lat' }, h('span', { text: item.latencyMs == null ? '—' : fmtMs(item.latencyMs, 2) })));

  return row;
}

function renderTable(data) {
  const cases = Array.isArray(data.cases) ? data.cases : [];
  const wrap = h('div', { class: 'eval-table-wrap' });
  const table = h('table', { class: 'eval-table' });
  table.appendChild(
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { text: '#' }),
        h('th', { text: 'query' }),
        h('th', { text: '期望文档' }),
        h('th', { text: '实际 rank' }),
        h('th', { text: '命中' }),
        h('th', { text: 'topHit 小节' }),
        h('th', { text: '耗时' }),
      ),
    ),
  );
  const tbody = h('tbody');
  cases.forEach((item, index) => tbody.appendChild(renderCaseRow(item, index)));
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ==========================================================================
   各状态渲染
   ========================================================================== */
function renderIdle() {
  clear(els.body);
  els.body.appendChild(
    emptyState({
      art: 'eval',
      title: '尚未运行评测',
      desc: '点击「运行评测」对内置评测集跑一遍检索命中率；这一请求只在你主动点击时触发，不会在页面加载时自动发送。',
      action: { label: '运行评测', icon: 'play', onClick: runEval },
    }),
  );
  if (els.stats) clear(els.stats);
  if (els.sub) els.sub.textContent = '对内置评测集跑一遍检索命中率（按需触发，不在加载时请求）';
}

function renderLoading() {
  clear(els.body);
  els.body.appendChild(
    h(
      'div',
      { class: 'eval-run-state' },
      h(
        'div',
        { class: 'loading-state' },
        h('span', { class: 'spinner' }),
        h('span', { text: '正在跑评测集，请稍候…' }),
      ),
    ),
  );
  if (els.stats) {
    clear(els.stats);
    els.stats.appendChild(
      h('span', { class: 'stat-inline' }, h('span', { class: 'spinner spinner--sm' }), 'running'),
    );
  }
}

function renderError(message) {
  clear(els.body);
  els.body.appendChild(
    h(
      'div',
      { class: 'error-state' },
      icon('alert'),
      h('h4', { text: '评测运行失败' }),
      h('p', { text: message || '未知错误' }),
      h(
        'button',
        { type: 'button', class: 'btn btn--sm', onClick: runEval },
        icon('reset'),
        h('span', { text: '重试' }),
      ),
    ),
  );
  if (els.stats) {
    clear(els.stats);
    els.stats.appendChild(h('span', { class: 'chip chip--err', text: '请求失败' }));
  }
}

function renderResult(data) {
  clear(els.body);

  if (!data || data.ok === false) {
    const reason = data?.reason || '评测集不可用';
    els.body.appendChild(
      emptyState({
        art: 'eval',
        title: '评测集不可用',
        desc: `${reason}。请确认 kb/eval.json 已存在（格式见 docs/API.md §5）。`,
        action: { label: '重试', icon: 'reset', onClick: runEval },
      }),
    );
    if (els.stats) {
      clear(els.stats);
      els.stats.appendChild(h('span', { class: 'chip chip--warn', text: '无评测数据' }));
    }
    if (els.sub) els.sub.textContent = reason;
    return;
  }

  els.body.appendChild(renderMetrics(data));

  const cases = Array.isArray(data.cases) ? data.cases : [];
  const failures = cases.filter((item) => !item.hit).length;
  els.body.appendChild(
    h(
      'div',
      { class: 'eval-meta' },
      h(
        'span',
        {},
        'topK ',
        h('span', { class: 'mono', text: String(data.topK ?? 5) }),
        ' · ',
        h('span', { class: 'mono', text: String(data.total ?? cases.length) }),
        ' 条用例 · 失败 ',
        h('span', { class: 'mono', text: String(failures) }),
        ' 条',
      ),
      h('span', { text: '失败用例整行红色高亮 · 期望文档未进 topK 记为未命中' }),
    ),
  );
  els.body.appendChild(renderTable(data));

  if (els.stats) {
    clear(els.stats);
    els.stats.appendChild(h('span', { class: 'stat-inline' }, 'MRR ', h('b', { text: Number(data.mrr).toFixed(3) })));
    els.stats.appendChild(h('span', { class: 'stat-inline' }, '用例 ', h('b', { text: fmtNum(data.total) })));
    els.stats.appendChild(h('span', { class: 'stat-inline' }, '耗时 ', h('b', { class: 'c-green', text: fmtMs(data.avgLatencyMs, 2) })));
  }
  if (els.sub) {
    els.sub.textContent = `内置评测集 · topK=${data.topK ?? 5} · ${fmtNum(data.total)} 条用例`;
  }
}

/* ==========================================================================
   运行
   ========================================================================== */
function setRunning(running) {
  const buttons = [els.runBtn, els.topbarBtn].filter(Boolean);
  for (const button of buttons) {
    button.disabled = running;
    button.classList.toggle('is-busy', running);
  }
  if (els.runBtn) {
    const label = els.runBtn.querySelector('span');
    if (label) label.textContent = running ? '运行中…' : '运行评测';
  }
}

/** 按需触发评测（顶栏按钮也会调用） */
export async function runEval() {
  if (state.eval.status === 'loading') return;
  state.eval = { status: 'loading', data: state.eval.data, error: null };
  setRunning(true);
  renderLoading();

  try {
    const data = await postEval(state.settings.topK);
    state.eval = { status: 'ready', data, error: null };
    renderResult(data);
  } catch (error) {
    state.eval = { status: 'error', data: null, error: error?.message || String(error) };
    renderError(error?.message || String(error));
  } finally {
    setRunning(false);
  }
}

/* ==========================================================================
   初始化
   ========================================================================== */
export function initEval() {
  els.body = document.getElementById('eval-body');
  els.stats = document.getElementById('eval-stats');
  els.sub = document.getElementById('eval-sub');
  els.runBtn = document.getElementById('btn-run-eval');
  els.topbarBtn = document.getElementById('btn-eval');

  els.runBtn?.addEventListener('click', runEval);
  renderIdle();

  // 首次进入评测页签时自动跑一次（不是页面加载时跑）；结果缓存在 state.eval 里，
  // 再次切回页签直接展示缓存；顶栏/页签按钮始终可以强制重跑。
  on('tab:change', (tab) => {
    if (tab === 'eval' && state.eval.status === 'idle') runEval();
  });

  on('session:reset', () => {
    // 清空对话不重置评测结果（评测是全局能力），保持数据可查看
    if (state.eval.status === 'idle') renderIdle();
  });
}
