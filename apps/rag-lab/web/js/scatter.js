/**
 * scatter.js —— 「向量空间」页签（Canvas 散点图）
 *
 * 绘制内容：
 *  - 知识库全部 chunk 的 PCA 二维投影点（按文档着色，图例可点击筛选）；
 *  - 查询点：脉冲星标；
 *  - 查询点 → Top-K 命中块的连线 + 排名徽标；
 *  - 悬停 tooltip（文档 / 小节 / 融合分数），点击命中点联动到召回卡片。
 *
 * 交互：滚轮以光标为中心缩放、拖拽平移、双击/按钮重置、只看 Top-K 高亮。
 * 只在页签可见且有查询点时才跑 rAF 动画，其余时间按需绘制。
 */
import { h, clear, emptyState, fmtScore, colorWithAlpha, clamp } from './util.js';
import { on, emit, state, colorOfDoc } from './state.js';

const els = {
  canvas: null,
  stage: null,
  legend: null,
  empty: null,
  tip: null,
  footText: null,
  zoom: null,
  dim: null,
  onlyTopBtn: null,
  resetBtn: null,
};

let ctx = null;
let width = 0;
let height = 0;
const view = { zoom: 1, panX: 0, panY: 0 };
const domain = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
let domainDirty = true;

let hiddenDocs = new Set();
let onlyTop = false;
let hoveredPoint = null;
let selectedChunkId = null;
let screenPoints = [];
let rafId = 0;

/** 拖拽状态 */
const drag = { active: false, moved: false, startX: 0, startY: 0, lastX: 0, lastY: 0, pointerId: null };

/* ==========================================================================
   数据辅助
   ========================================================================== */
function chunkIndex() {
  const map = new Map();
  for (const chunk of state.kb?.chunks || []) {
    if (chunk?.id) map.set(chunk.id, chunk);
  }
  return map;
}

function hitIndex() {
  const map = new Map();
  for (const hit of state.retrieval?.hits || []) {
    if (hit?.chunkId) map.set(hit.chunkId, hit);
  }
  return map;
}

function queryPoint() {
  const point = state.retrieval?.queryPoint;
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return { x: Number(point.x), y: Number(point.y) };
}

/* ==========================================================================
   坐标变换
   ========================================================================== */
function plotHeight() {
  return Math.max(140, height - 30);
}

function computeDomain() {
  const points = [];
  for (const point of state.kb?.projection || []) {
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
  }
  const query = queryPoint();
  if (query) points.push(query);
  if (!points.length) {
    Object.assign(domain, { minX: -1, maxX: 1, minY: -1, maxY: 1 });
    domainDirty = false;
    return;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  let spanX = maxX - minX;
  let spanY = maxY - minY;
  if (spanX < 0.12) spanX = 0.12;
  if (spanY < 0.12) spanY = 0.12;
  const padX = spanX * 0.14;
  const padY = spanY * 0.14;
  Object.assign(domain, {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  });
  domainDirty = false;
}

function transformInfo() {
  const spanX = Math.max(domain.maxX - domain.minX, 1e-6);
  const spanY = Math.max(domain.maxY - domain.minY, 1e-6);
  const usableW = Math.max(80, width - 40);
  const usableH = Math.max(80, plotHeight() - 24);
  const fit = Math.min(usableW / spanX, usableH / spanY) * view.zoom;
  return {
    midX: (domain.minX + domain.maxX) / 2,
    midY: (domain.minY + domain.maxY) / 2,
    fit,
    scale: fit,
    cx: width / 2 + view.panX,
    cy: plotHeight() / 2 + view.panY,
  };
}

function projectPoint(x, y) {
  const info = transformInfo();
  return {
    x: info.cx + (x - info.midX) * info.scale,
    y: info.cy - (y - info.midY) * info.scale,
  };
}

function screenToData(sx, sy) {
  const info = transformInfo();
  return {
    x: info.midX + (sx - info.cx) / info.scale,
    y: info.midY - (sy - info.cy) / info.scale,
  };
}

/* ==========================================================================
   绘制
   ========================================================================== */
function niceStep(raw) {
  const safe = raw > 0 ? raw : 1;
  const pow = Math.pow(10, Math.floor(Math.log10(safe)));
  const norm = safe / pow;
  const factor = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return factor * pow;
}

function drawGrid() {
  const info = transformInfo();
  ctx.save();
  ctx.lineWidth = 1;

  // 竖线（x 轴刻度）
  const spanX = domain.maxX - domain.minX;
  const stepX = niceStep(spanX / 6);
  const startX = Math.ceil(domain.minX / stepX) * stepX;
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const bottom = plotHeight() - 3;
  for (let x = startX; x <= domain.maxX + stepX * 0.01; x += stepX) {
    const screen = info.cx + (x - info.midX) * info.scale;
    if (screen < -20 || screen > width + 20) continue;
    ctx.strokeStyle = Math.abs(x) < stepX / 1000 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.035)';
    ctx.beginPath();
    ctx.moveTo(screen, 0);
    ctx.lineTo(screen, plotHeight());
    ctx.stroke();
    ctx.fillStyle = 'rgba(139,152,169,.45)';
    ctx.fillText(`${x.toFixed(stepX < 0.1 ? 2 : 1)}`, screen, bottom);
  }

  // 横线（y 轴刻度）
  const spanY = domain.maxY - domain.minY;
  const stepY = niceStep(spanY / 5);
  const startY = Math.ceil(domain.minY / stepY) * stepY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = startY; y <= domain.maxY + stepY * 0.01; y += stepY) {
    const screen = info.cy - (y - info.midY) * info.scale;
    if (screen < -20 || screen > plotHeight() + 20) continue;
    ctx.strokeStyle = Math.abs(y) < stepY / 1000 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.035)';
    ctx.beginPath();
    ctx.moveTo(0, screen);
    ctx.lineTo(width, screen);
    ctx.stroke();
    ctx.fillStyle = 'rgba(139,152,169,.4)';
    ctx.fillText(`${y.toFixed(stepY < 0.1 ? 2 : 1)}`, 6, screen - 6);
  }

  // 轴标记
  ctx.fillStyle = 'rgba(139,152,169,.32)';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('PC1 →', width - 8, plotHeight() - 4);
  ctx.textAlign = 'left';
  ctx.fillText('↑ PC2', 6, 12);
  ctx.restore();
}

function drawHitLines(queryScreen, hits, projections) {
  ctx.save();
  for (const hit of hits) {
    const projection = projections.get(hit.chunkId);
    if (!projection) continue;
    if (hiddenDocs.has(hit.docId)) continue;
    const end = projectPoint(projection.x, projection.y);
    const color = colorOfDoc(hit.docId);

    ctx.strokeStyle = colorWithAlpha(color, 0.32);
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(queryScreen.x, queryScreen.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 排名徽标放在连线的 58% 处
    const t = 0.58;
    const badgeX = queryScreen.x + (end.x - queryScreen.x) * t;
    const badgeY = queryScreen.y + (end.y - queryScreen.y) * t;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,20,.92)';
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(color, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(hit.rank), badgeX, badgeY + 0.5);
  }
  ctx.restore();
}

function drawPoints(projectionsChunks, hitMap) {
  screenPoints = [];
  const onlyTopActive = onlyTop;

  for (const entry of projectionsChunks) {
    const { point, chunk } = entry;
    if (hiddenDocs.has(point.docId)) continue;
    const hit = hitMap.get(point.chunkId) || null;
    const color = colorOfDoc(point.docId);
    const screen = projectPoint(point.x, point.y);
    if (screen.x < -30 || screen.x > width + 30 || screen.y < -30 || screen.y > plotHeight() + 30) {
      screenPoints.push({ ...entry, screen, hit, color, visible: false });
      continue;
    }

    let radius = hit ? 5.2 : 3.6;
    let alpha = 0.72;
    if (onlyTopActive && !hit) {
      radius = 2.3;
      alpha = 0.22;
    }
    if (hoveredPoint && hoveredPoint.chunkId === point.chunkId) radius += 2.2;

    ctx.save();
    if (hit) {
      ctx.shadowColor = colorWithAlpha(color, 0.7);
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colorWithAlpha(color, onlyTopActive && !hit ? 0.25 : 0.88);
    ctx.fill();
    ctx.restore();

    if (hit) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    if (selectedChunkId && selectedChunkId === point.chunkId) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34,211,238,.9)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    screenPoints.push({ ...entry, screen, hit, color, visible: true });
  }
}

function drawQueryStar(now) {
  const query = queryPoint();
  if (!query) return;
  const screen = projectPoint(query.x, query.y);

  // 脉冲圈
  for (let ring = 0; ring < 2; ring += 1) {
    const progress = ((now / 1600 + ring * 0.5) % 1 + 1) % 1;
    const radius = 11 + progress * 24;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha('#22d3ee', (1 - progress) * 0.38);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // 五角星
  const outer = 10;
  const inner = 4.2;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = screen.x + Math.cos(angle) * radius;
    const py = screen.y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = 'rgba(34,211,238,.85)';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(240,253,255,.95)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // “查询”小标签
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(165,243,252,.9)';
  ctx.fillText('query', screen.x + 15, screen.y - 10);
}

function draw(now = performance.now()) {
  if (!ctx || width < 2 || height < 2) return;
  if (domainDirty) computeDomain();

  ctx.clearRect(0, 0, width, height);
  drawGrid();

  const hitMap = hitIndex();
  const projections = new Map();
  for (const point of state.kb?.projection || []) {
    if (point?.chunkId) projections.set(point.chunkId, point);
  }
  const chunks = chunkIndex();
  const entries = [];
  for (const point of state.kb?.projection || []) {
    if (!point?.chunkId) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    entries.push({ point, chunk: chunks.get(point.chunkId) || null });
  }

  const query = queryPoint();
  const hits = Array.isArray(state.retrieval?.hits) ? state.retrieval.hits : [];
  const queryScreen = query ? projectPoint(query.x, query.y) : null;
  if (queryScreen && hits.length) {
    drawHitLines(queryScreen, hits, projections);
  }

  drawPoints(entries, hitMap);
  if (queryScreen) drawQueryStar(now);

  // 悬停点最后再包一层焦点环，避免被其他点盖住
  if (hoveredPoint) {
    const entry = screenPoints.find((item) => item.visible && item.point.chunkId === hoveredPoint.chunkId);
    if (entry) {
      ctx.beginPath();
      ctx.arc(entry.screen.x, entry.screen.y, (entry.hit ? 5.2 : 3.6) + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(230,237,243,.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawNow() {
  draw(performance.now());
}

/** 是否值得跑动画（页签可见 + 有查询点） */
function shouldAnimate() {
  return (
    state.activeTab === 'scatter' &&
    Boolean(queryPoint()) &&
    els.stage &&
    els.stage.clientWidth > 0 &&
    !document.hidden
  );
}

function loop(now) {
  rafId = 0;
  draw(now);
  if (shouldAnimate()) rafId = window.requestAnimationFrame(loop);
}

function ensureLoop() {
  if (!rafId && shouldAnimate()) rafId = window.requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/* ==========================================================================
   Canvas 尺寸
   ========================================================================== */
function resizeCanvas() {
  if (!els.canvas || !els.stage) return;
  const rect = els.stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(0, Math.floor(rect.width));
  height = Math.max(0, Math.floor(rect.height));
  if (!width || !height) return;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  if (els.canvas.width !== pixelWidth || els.canvas.height !== pixelHeight) {
    els.canvas.width = pixelWidth;
    els.canvas.height = pixelHeight;
  }
  ctx = els.canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ==========================================================================
   图例 / 元信息 / 空状态
   ========================================================================== */
function docEntries() {
  const counts = new Map();
  for (const point of state.kb?.projection || []) {
    if (!point?.docId) continue;
    counts.set(point.docId, (counts.get(point.docId) || 0) + 1);
  }
  const entries = [];
  const seen = new Set();
  const docs = Array.isArray(state.kb?.docs) ? state.kb.docs : [];
  for (const doc of docs) {
    if (!doc?.id || seen.has(doc.id)) continue;
    seen.add(doc.id);
    entries.push({ id: doc.id, title: doc.title || doc.id, count: counts.get(doc.id) || 0 });
  }
  for (const [id, count] of counts) {
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, title: id, count });
  }
  return entries;
}

function renderLegend() {
  if (!els.legend) return;
  clear(els.legend);
  for (const doc of docEntries()) {
    const active = !hiddenDocs.has(doc.id);
    const item = h(
      'button',
      {
        type: 'button',
        class: `legend-item${active ? '' : ' is-off'}`,
        style: { '--doc-color': colorOfDoc(doc.id) },
        'aria-pressed': active ? 'true' : 'false',
        title: `${doc.title} · ${doc.count} 块（点击${active ? '隐藏' : '显示'}）`,
        onClick: () => {
          if (hiddenDocs.has(doc.id)) hiddenDocs.delete(doc.id);
          else hiddenDocs.add(doc.id);
          renderLegend();
          drawNow();
        },
      },
      h('i', { class: 'legend-dot' }),
      h('span', { text: doc.title }),
      h('span', { class: 'legend-count', text: String(doc.count) }),
    );
    els.legend.appendChild(item);
  }
}

function updateMeta() {
  const kb = state.kb;
  const dim = kb?.embedding?.dim ?? kb?.stats?.dim;
  if (els.dim) els.dim.textContent = dim ? `dim ${dim}` : 'dim —';

  const hits = Array.isArray(state.retrieval?.hits) ? state.retrieval.hits : [];
  const query = queryPoint();
  if (els.footText) {
    if (!kb?.projection?.length) {
      els.footText.textContent = '知识库尚未加载';
    } else if (query && hits.length) {
      els.footText.textContent = `查询点 · 到 Top-${hits.length} 的连线 · 悬停查看详情 · 点击定位召回卡片`;
    } else {
      els.footText.textContent = '滚轮缩放 · 拖拽平移 · 悬停查看详情 · 点击定位召回卡片';
    }
  }
  if (els.zoom) els.zoom.textContent = `${Math.round(view.zoom * 100)}%`;
  if (els.onlyTopBtn) els.onlyTopBtn.classList.toggle('btn--primary', onlyTop);
}

function updateEmpty() {
  if (!els.empty) return;
  const hasPoints = Boolean(state.kb?.projection?.length);
  els.empty.classList.toggle('is-on', !hasPoints);
  if (hasPoints) {
    clear(els.empty);
    return;
  }
  let title = '向量空间待加载';
  let desc = globalThis.__RAG_BROWSER_MODE__
    ? '等待浏览器内引擎完成向量化与 PCA 投影；加载完成后这里会显示全部文本块的二维投影。'
    : '等待 GET /api/kb 返回投影坐标；加载完成后这里会显示全部文本块的 PCA 二维投影。';
  if (state.kbStatus === 'error') {
    title = '知识库加载失败';
    desc =
      state.kbError ||
      (globalThis.__RAG_BROWSER_MODE__
        ? '请确认 kb-data.json 与页面资源已正确部署。'
        : '请确认后端已启动并重新连接。');
  } else if (state.kbStatus === 'loading') {
    title = '正在加载知识库…';
    desc = '正在读取文档、文本块与二维投影坐标。';
  }
  clear(els.empty);
  els.empty.appendChild(
    emptyState({ art: 'scatter', title, desc }),
  );
}

/* ==========================================================================
   悬停 / tooltip
   ========================================================================== */
function findPointAt(sx, sy) {
  let nearest = null;
  let nearestDistance = 13;
  for (const entry of screenPoints) {
    if (!entry.visible) continue;
    const distance = Math.hypot(entry.screen.x - sx, entry.screen.y - sy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = entry;
    }
  }
  return nearest;
}

function showTooltip(entry, sx, sy) {
  if (!els.tip || !entry) return;
  clear(els.tip);
  const chunk = entry.chunk;
  const docTitle = chunk?.docTitle || entry.point.docId || '—';
  const section = chunk?.section || '';
  els.tip.appendChild(
    h(
      'div',
      { class: 'tip-title' },
      h('i', { class: 'tip-docdot', style: { '--doc-color': entry.color } }),
      h('span', { text: docTitle }),
    ),
  );
  if (section) els.tip.appendChild(h('div', { class: 'tip-sec', text: section }));
  if (entry.hit) {
    els.tip.appendChild(
      h('div', {
        class: 'tip-score',
        text: `fused ${fmtScore(entry.hit.scores?.fused)} · 排名 #${entry.hit.rank}`,
      }),
    );
    els.tip.appendChild(h('div', { class: 'tip-hint', text: '点击定位到召回卡片' }));
  } else {
    els.tip.appendChild(h('div', { class: 'tip-score dim', text: '本次未进入 Top-K' }));
    els.tip.appendChild(h('div', { class: 'tip-hint', text: '该块不在本轮召回结果中' }));
  }
  els.tip.hidden = false;

  const stageRect = els.stage.getBoundingClientRect();
  const tipWidth = els.tip.offsetWidth;
  const tipHeight = els.tip.offsetHeight;
  let left = sx + 14;
  let top = sy - tipHeight - 12;
  if (left + tipWidth > stageRect.width - 8) left = sx - tipWidth - 14;
  left = clamp(left, 8, Math.max(8, stageRect.width - tipWidth - 8));
  if (top < 8) top = sy + 16;
  top = clamp(top, 8, Math.max(8, stageRect.height - tipHeight - 8));
  els.tip.style.left = `${Math.round(left)}px`;
  els.tip.style.top = `${Math.round(top)}px`;
}

function hideTooltip() {
  if (els.tip) els.tip.hidden = true;
}

/* ==========================================================================
   交互
   ========================================================================== */
function handlePointerMove(event) {
  if (!els.canvas) return;
  const rect = els.canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  if (drag.active) {
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true;
    view.panX += dx;
    view.panY += dy;
    hideTooltip();
    drawNow();
    return;
  }

  const point = findPointAt(sx, sy);
  const changed = (point?.point.chunkId || null) !== (hoveredPoint?.point.chunkId || null);
  hoveredPoint = point;
  els.canvas.classList.toggle('is-hover', Boolean(point));
  if (point) {
    showTooltip(point, sx, sy);
  } else {
    hideTooltip();
  }
  if (changed) drawNow();
}

function handlePointerDown(event) {
  if (event.button !== 0) return;
  drag.active = true;
  drag.moved = false;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  drag.pointerId = event.pointerId;
  els.canvas.classList.add('is-panning');
  try {
    els.canvas.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
}

function handlePointerUp(event) {
  if (!drag.active) return;
  const wasClick = !drag.moved;
  drag.active = false;
  drag.pointerId = null;
  els.canvas.classList.remove('is-panning');
  try {
    els.canvas.releasePointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
  if (wasClick && hoveredPoint) {
    const hit = hoveredPoint.hit;
    selectedChunkId = hoveredPoint.point.chunkId;
    drawNow();
    if (hit) {
      emit('focusChunk', hit.chunkId);
    }
  }
}

function handleWheel(event) {
  event.preventDefault();
  if (!els.canvas) return;
  const rect = els.canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const before = screenToData(sx, sy);
  const factor = Math.exp(-event.deltaY * 0.0015);
  const nextZoom = clamp(view.zoom * factor, 0.5, 12);
  if (nextZoom === view.zoom) return;
  view.zoom = nextZoom;
  const info = transformInfo();
  // 让光标下的数据点保持不动：反解 pan
  view.panX = sx - width / 2 - (before.x - info.midX) * info.scale;
  view.panY = sy - plotHeight() / 2 + (before.y - info.midY) * info.scale;
  updateMeta();
  hideTooltip();
  drawNow();
}

function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  updateMeta();
  hideTooltip();
  drawNow();
}

/* ==========================================================================
   事件绑定 / 初始化
   ========================================================================== */
function bindEvents() {
  els.canvas.addEventListener('pointerdown', handlePointerDown);
  els.canvas.addEventListener('pointermove', handlePointerMove);
  els.canvas.addEventListener('pointerup', handlePointerUp);
  els.canvas.addEventListener('pointercancel', () => {
    drag.active = false;
    els.canvas.classList.remove('is-panning');
  });
  els.canvas.addEventListener('pointerleave', () => {
    if (drag.active) return;
    hoveredPoint = null;
    hideTooltip();
    els.canvas.classList.remove('is-hover');
    drawNow();
  });
  els.canvas.addEventListener('wheel', handleWheel, { passive: false });
  els.canvas.addEventListener('dblclick', resetView);

  els.onlyTopBtn?.addEventListener('click', () => {
    onlyTop = !onlyTop;
    els.onlyTopBtn.setAttribute('aria-pressed', onlyTop ? 'true' : 'false');
    updateMeta();
    hideTooltip();
    drawNow();
  });
  els.resetBtn?.addEventListener('click', resetView);

  const observer = new ResizeObserver(() => {
    resizeCanvas();
    drawNow();
    ensureLoop();
  });
  if (els.stage) observer.observe(els.stage);
}

/** 数据变化后统一刷新 */
function refreshAll() {
  domainDirty = true;
  renderLegend();
  updateMeta();
  updateEmpty();
  resizeCanvas();
  drawNow();
  ensureLoop();
}

export function initScatter() {
  els.canvas = document.getElementById('scatter-canvas');
  els.stage = document.getElementById('scatter-stage');
  els.legend = document.getElementById('scatter-legend');
  els.empty = document.getElementById('scatter-empty');
  els.tip = document.getElementById('scatter-tip');
  els.footText = document.getElementById('scatter-foot-text');
  els.zoom = document.getElementById('scatter-zoom');
  els.dim = document.getElementById('scatter-dim');
  els.onlyTopBtn = document.getElementById('btn-only-top');
  els.resetBtn = document.getElementById('btn-scatter-reset');

  if (!els.canvas || !els.stage) return;
  ctx = els.canvas.getContext('2d');
  bindEvents();
  refreshAll();

  on('kb:change', refreshAll);
  on('retrieval', () => {
    domainDirty = true;
    updateMeta();
    updateEmpty();
    drawNow();
    ensureLoop();
  });
  on('chat:start', () => {
    hoveredPoint = null;
    selectedChunkId = null;
    hideTooltip();
    updateMeta();
    drawNow();
  });
  on('session:reset', () => {
    hoveredPoint = null;
    selectedChunkId = null;
    hideTooltip();
    refreshAll();
  });
  on('tab:change', (tab) => {
    if (tab === 'scatter') {
      window.requestAnimationFrame(() => {
        resizeCanvas();
        drawNow();
        ensureLoop();
      });
    } else {
      stopLoop();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else ensureLoop();
  });
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawNow();
  });
}
