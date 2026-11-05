/**
 * util.js —— 纯工具层（不依赖任何业务状态）
 *
 * 提供：
 *  - DOM 构造器 h() / SVG 图标 icon()
 *  - 数字与时间格式化
 *  - Markdown 子集渲染（**粗体**、行内 code、列表、引用、[n] 引用角标）
 *  - 命中词高亮
 *  - 空状态插画 / 全局 tooltip / toast
 *
 * 安全约定：凡是来自 API 的文本一律走 textContent（或 h({text})），
 * 唯一的 innerHTML 通道 staticMarkup() 只用于本文件内写死的静态 SVG 插画。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ==========================================================================
   DOM 构造
   ========================================================================== */

/**
 * 轻量 DOM 构造器。
 * @param {string} tag 标签名
 * @param {object} props class/text/dataset/style/on* / 其余作为 attribute
 * @param {...(Node|string|Array|null|false|undefined)} children
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
}

/** 兼容字符串 / 节点 / 数组 / 空值的 appendChildren */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** 清空子节点并返回 parent，方便 render 时复用 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 内联 SVG sprite 图标（symbol 定义在 index.html） */
export function icon(name, className = 'ic') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

/**
 * 仅用于本文件内写死的静态 SVG 插画的字符串 → DOM。
 * 严禁把 API / 模型返回的文本传进来（那样会有 XSS 风险）。
 */
function staticMarkup(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstChild;
}

/* ==========================================================================
   格式化
   ========================================================================== */
export function fmtMs(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const ms = Number(value);
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 100) return `${ms.toFixed(0)} ms`;
  return `${ms.toFixed(digits)} ms`;
}

export function fmtNum(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('zh-CN');
}

export function fmtPct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function fmtScore(value, digits = 3) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

export function fmtChars(value) {
  if (value == null) return '—';
  return `${fmtNum(value)} 字符`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatClock(timestamp) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
  } catch {
    return '';
  }
}

/** 估算文本字符数（用于消息 meta 展示） */
export function charLength(text) {
  return Array.from(String(text ?? '')).length;
}

/* ==========================================================================
   配色
   ========================================================================== */
const DOC_PALETTE = [
  '#22d3ee', // 青
  '#a78bfa', // 紫
  '#34d399', // 绿
  '#fbbf24', // 橙
  '#f472b6', // 粉
  '#60a5fa', // 蓝
  '#fb923c', // 橘
  '#a3e635', // 柠檬
];

/** 根据文档在知识库中的顺序取色，保证散点 / 图例 / 卡片一致 */
export function docColorAt(index) {
  if (!Number.isFinite(index) || index < 0) return DOC_PALETTE[0];
  return DOC_PALETTE[index % DOC_PALETTE.length];
}

/** 把 #rrggbb 转成 rgba()，用于 canvas 透明度 */
export function colorWithAlpha(hex, alpha) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return `rgba(34,211,238,${alpha})`;
  const num = parseInt(match[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ==========================================================================
   Markdown 子集渲染
   ========================================================================== */

/** 行内：**粗体** / `code` / [n] 引用角标；其余按纯文本处理 */
function renderInline(parent, text) {
  const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d{1,2}\])/g;
  const source = String(text ?? '');
  const segments = source.split(INLINE_RE);
  for (const segment of segments) {
    if (!segment) continue;
    if (/^\*\*[^*\n]+\*\*$/.test(segment) && segment.length > 4) {
      parent.appendChild(h('strong', { text: segment.slice(2, -2) }));
    } else if (/^`[^`\n]+`$/.test(segment) && segment.length > 2) {
      parent.appendChild(h('code', { text: segment.slice(1, -1) }));
    } else if (/^\[\d{1,2}\]$/.test(segment)) {
      const marker = segment.slice(1, -1);
      parent.appendChild(
        h('button', {
          type: 'button',
          class: 'cite',
          dataset: { marker },
          title: `引用 ${segment}`,
          text: segment,
        }),
      );
    } else {
      parent.appendChild(document.createTextNode(segment));
    }
  }
}

/**
 * 渲染模型输出的 Markdown 子集，返回 DocumentFragment。
 * 支持：段落、换行、无序/有序列表、引用、### 小标题、**粗体**、`code`、[n]。
 * 不解析 HTML，所有文本都进 textNode —— 天然免疫 XSS。
 */
export function renderMarkdown(text) {
  const fragment = document.createDocumentFragment();
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const isListLine = (line) => /^\s*([-*•]|\d{1,2}[.)])\s+/.test(line);
  const isBlockLine = (line) => isListLine(line) || /^#{1,4}\s+/.test(line) || /^\s*>\s?/.test(line);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    // 小标题（模型偶尔会输出）
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      const node = h('h4');
      renderInline(node, heading[1]);
      fragment.appendChild(node);
      index += 1;
      continue;
    }

    // 无序列表
    if (/^\s*[-*•]\s+/.test(line)) {
      const list = h('ul');
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*•]\s+(.+)$/);
        if (!item) break;
        const li = h('li');
        renderInline(li, item[1]);
        list.appendChild(li);
        index += 1;
      }
      // 只有 "- " 这种「空条目标记」的行：上面匹配不到内容、index 没动，
      // 直接 continue 会永远停在原地（流式输出时经常出现半截的 "1. "）。这里兜底按段落吃掉。
      if (!list.children.length) {
        const paragraph = h('p');
        renderInline(paragraph, line);
        fragment.appendChild(paragraph);
        index += 1;
        continue;
      }
      fragment.appendChild(list);
      continue;
    }

    // 有序列表
    if (/^\s*\d{1,2}[.)]\s+/.test(line)) {
      const list = h('ol');
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d{1,2}[.)]\s+(.+)$/);
        if (!item) break;
        const li = h('li');
        renderInline(li, item[1]);
        list.appendChild(li);
        index += 1;
      }
      // 同上："2. " 这种标记后还没有内容的半截行，必须推进 index
      if (!list.children.length) {
        const paragraph = h('p');
        renderInline(paragraph, line);
        fragment.appendChild(paragraph);
        index += 1;
        continue;
      }
      fragment.appendChild(list);
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const quote = h('blockquote');
      renderInline(quote, line.replace(/^\s*>\s?/, ''));
      fragment.appendChild(quote);
      index += 1;
      continue;
    }

    // 普通段落：连续非空、非块级行合并，保留软换行
    const paragraphLines = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim() || isBlockLine(current)) break;
      paragraphLines.push(current);
      index += 1;
    }
    // 兜底：极端情况下（例如行被前面的分支漏掉）也要保证 index 前进，避免渲染死循环
    if (!paragraphLines.length) {
      const paragraph = h('p');
      renderInline(paragraph, line);
      fragment.appendChild(paragraph);
      index += 1;
      continue;
    }
    const paragraph = h('p');
    paragraphLines.forEach((paragraphLine, lineIndex) => {
      if (lineIndex > 0) paragraph.appendChild(h('br'));
      renderInline(paragraph, paragraphLine);
    });
    fragment.appendChild(paragraph);
  }

  return fragment;
}

/* ==========================================================================
   命中词高亮
   ========================================================================== */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 把 text 拆成「普通文本 / <mark class="hl">命中词</mark>」的 DocumentFragment。
 * @param {string} text
 * @param {string[]} terms 命中词列表（按长度降序匹配，避免短词抢先）
 */
export function highlightTerms(text, terms) {
  const fragment = document.createDocumentFragment();
  const source = String(text ?? '');
  const list = Array.from(new Set((terms || []).filter((term) => term && String(term).length > 0)))
    .map(String)
    .sort((a, b) => b.length - a.length);
  if (!list.length) {
    fragment.appendChild(document.createTextNode(source));
    return fragment;
  }
  const pattern = new RegExp(`(${list.map(escapeRegExp).join('|')})`, 'gi');
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }
    fragment.appendChild(h('mark', { class: 'hl', text: match[0] }));
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  if (lastIndex < source.length) {
    fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
  }
  return fragment;
}

/* ==========================================================================
   空状态 / 插画
   ========================================================================== */
const ILLUSTRATIONS = {
  pipeline: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <circle cx="70" cy="48" r="35" stroke="rgba(255,255,255,.06)"/>
      <circle cx="70" cy="48" r="22" stroke="rgba(34,211,238,.16)" stroke-dasharray="3 4"/>
      <path d="M29 32 52 42M52 42l6 21M58 63l24-1M82 62l22-17M104 45l-10-9"
        stroke="rgba(255,255,255,.12)" stroke-dasharray="2 4"/>
      <circle cx="29" cy="32" r="5" fill="#22d3ee" fill-opacity=".75"/>
      <circle cx="52" cy="42" r="4" fill="#60a5fa" fill-opacity=".7"/>
      <circle cx="58" cy="63" r="4" fill="#a78bfa" fill-opacity=".7"/>
      <circle cx="82" cy="62" r="4" fill="#fbbf24" fill-opacity=".7"/>
      <circle cx="104" cy="45" r="5" fill="#34d399" fill-opacity=".75"/>
      <circle cx="70" cy="48" r="2.4" fill="#22d3ee"/>
    </svg>`,
  scatter: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <path d="M22 76V22M22 76h100" stroke="rgba(255,255,255,.08)"/>
      <path d="M22 49h100M50 22v54M78 22v54M106 22v54" stroke="rgba(255,255,255,.045)"/>
      <circle cx="44" cy="35" r="4" fill="#22d3ee" fill-opacity=".65"/>
      <circle cx="56" cy="62" r="3.5" fill="#22d3ee" fill-opacity=".5"/>
      <circle cx="70" cy="44" r="4.5" fill="#a78bfa" fill-opacity=".65"/>
      <circle cx="92" cy="30" r="3.5" fill="#34d399" fill-opacity=".6"/>
      <circle cx="102" cy="58" r="4.5" fill="#fbbf24" fill-opacity=".6"/>
      <path d="M111 41l1.6 4.6 4.6 1.6-4.6 1.6-1.6 4.6-1.6-4.6-4.6-1.6 4.6-1.6L111 41Z" fill="#22d3ee"/>
      <path d="M111 51 92 30M111 51l-9 7M111 51l-41 11M111 51l-55-16"
        stroke="rgba(34,211,238,.28)" stroke-dasharray="2 3"/>
    </svg>`,
  recall: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <rect x="30" y="20" width="80" height="14" rx="4" stroke="rgba(255,255,255,.14)" fill="rgba(255,255,255,.02)"/>
      <rect x="30" y="40" width="80" height="14" rx="4" stroke="rgba(34,211,238,.32)" fill="rgba(34,211,238,.06)"/>
      <rect x="30" y="60" width="80" height="14" rx="4" stroke="rgba(255,255,255,.1)" fill="rgba(255,255,255,.02)"/>
      <path d="M37 27h26M37 47h34M37 67h20" stroke="rgba(255,255,255,.2)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="103" cy="27" r="2.4" fill="#22d3ee" fill-opacity=".8"/>
      <circle cx="103" cy="47" r="2.4" fill="#22d3ee"/>
      <circle cx="103" cy="67" r="2.4" fill="#22d3ee" fill-opacity=".6"/>
    </svg>`,
  prompt: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <rect x="24" y="18" width="92" height="60" rx="8" stroke="rgba(255,255,255,.12)" fill="rgba(255,255,255,.015)"/>
      <path d="M24 32h92" stroke="rgba(255,255,255,.1)"/>
      <circle cx="33" cy="25" r="2" fill="#f87171" fill-opacity=".7"/>
      <circle cx="40" cy="25" r="2" fill="#fbbf24" fill-opacity=".7"/>
      <circle cx="47" cy="25" r="2" fill="#34d399" fill-opacity=".7"/>
      <path d="M35 44h20M35 53h34M35 62h26" stroke="rgba(34,211,238,.45)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M82 44h16M82 53h10M82 62h14" stroke="rgba(167,139,250,.45)" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,
  kb: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <rect x="42" y="16" width="56" height="66" rx="6" stroke="rgba(255,255,255,.1)" fill="rgba(255,255,255,.015)"/>
      <rect x="34" y="24" width="56" height="66" rx="6" stroke="rgba(34,211,238,.25)" fill="#0d131c"/>
      <rect x="26" y="32" width="56" height="56" rx="6" stroke="rgba(255,255,255,.14)" fill="#0d131c"/>
      <path d="M36 46h36M36 55h26M36 64h32M36 73h18" stroke="rgba(255,255,255,.18)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M36 46h20" stroke="rgba(34,211,238,.6)" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,
  eval: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <path d="M26 76h88M26 76V24" stroke="rgba(255,255,255,.09)"/>
      <rect x="38" y="54" width="12" height="22" rx="3" fill="rgba(34,211,238,.22)" stroke="rgba(34,211,238,.4)"/>
      <rect x="58" y="42" width="12" height="34" rx="3" fill="rgba(167,139,250,.2)" stroke="rgba(167,139,250,.4)"/>
      <rect x="78" y="30" width="12" height="46" rx="3" fill="rgba(52,211,153,.2)" stroke="rgba(52,211,153,.4)"/>
      <rect x="98" y="48" width="12" height="28" rx="3" fill="rgba(251,191,36,.18)" stroke="rgba(251,191,36,.4)"/>
      <circle cx="104" cy="30" r="11" fill="rgba(52,211,153,.12)" stroke="rgba(52,211,153,.5)"/>
      <path d="m99 30 3.4 3.4L110 26" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  error: `
    <svg class="empty-art" viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <circle cx="70" cy="48" r="30" stroke="rgba(248,113,113,.28)" fill="rgba(248,113,113,.05)"/>
      <path d="M70 32v20" stroke="#f87171" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="70" cy="62" r="2.4" fill="#f87171"/>
      <path d="M22 48h18M100 48h18" stroke="rgba(255,255,255,.1)" stroke-dasharray="2 4"/>
    </svg>`,
};

/**
 * 生成带内联插画的空状态节点。
 * @param {object} opts { art, title, desc, action: { label, icon, onClick } }
 */
export function emptyState({ art = 'scatter', title = '暂无数据', desc = '', action = null } = {}) {
  const wrapper = h('div', { class: 'empty-state' });
  const markup = ILLUSTRATIONS[art] || ILLUSTRATIONS.scatter;
  wrapper.appendChild(staticMarkup(markup));
  wrapper.appendChild(h('h4', { text: title }));
  if (desc) wrapper.appendChild(h('p', { text: desc }));
  if (action) {
    wrapper.appendChild(
      h(
        'button',
        { type: 'button', class: 'btn btn--sm', onClick: action.onClick },
        action.icon ? icon(action.icon) : null,
        h('span', { text: action.label }),
      ),
    );
  }
  return wrapper;
}

/* ==========================================================================
   全局 tooltip（data-tip 属性驱动）
   ========================================================================== */
let tipEl = null;
let tipTarget = null;

function ensureTip() {
  if (!tipEl) tipEl = document.getElementById('global-tip');
  return tipEl;
}

function positionTip(target) {
  const tip = ensureTip();
  if (!tip) return;
  const rect = target.getBoundingClientRect();
  const gap = 8;
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.top - height - gap;
  left = clamp(left, 8, window.innerWidth - width - 8);
  if (top < 8) top = rect.bottom + gap;
  if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

export function showTip(content, target) {
  const tip = ensureTip();
  if (!tip) return;
  tip.textContent = content;
  tip.hidden = false;
  tipTarget = target;
  if (target) positionTip(target);
}

export function hideTip() {
  const tip = ensureTip();
  if (!tip) return;
  tip.hidden = true;
  tipTarget = null;
}

/** 事件委托：任何带 data-tip 的元素 hover 时显示全局 tooltip */
export function initGlobalTooltip() {
  document.addEventListener(
    'pointerover',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
      if (!target) return;
      const content = target.getAttribute('data-tip');
      if (!content) return;
      showTip(content, target);
    },
    true,
  );
  document.addEventListener(
    'pointerout',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      hideTip();
    },
    true,
  );
  document.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
  window.addEventListener('blur', hideTip);
  // 点击后立刻收起，避免 tooltip 悬在弹层上
  document.addEventListener('pointerdown', hideTip, true);
  // 键盘可访问：focus 也显示
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
      if (!target) return;
      showTip(target.getAttribute('data-tip') || '', target);
    },
    true,
  );
  document.addEventListener('focusout', hideTip, true);

  // 目标滚动离开视口时也收起
  window.addEventListener(
    'scroll',
    () => {
      if (tipTarget && !tipTarget.isConnected) hideTip();
    },
    true,
  );
}

/* ==========================================================================
   Toast 轻提示
   ========================================================================== */
const TOAST_ICONS = { error: 'alert', ok: 'check', info: 'info' };

export function toast(message, kind = 'info', timeout = 3600) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const node = h(
    'div',
    { class: `toast toast--${kind}` },
    icon(TOAST_ICONS[kind] || 'info'),
    h('span', { text: message }),
  );
  host.appendChild(node);
  while (host.children.length > 3) host.removeChild(host.firstChild);
  window.setTimeout(() => {
    node.classList.add('is-out');
    window.setTimeout(() => node.remove(), 220);
  }, timeout);
}

/* ==========================================================================
   其他
   ========================================================================== */
export function debounce(fn, wait = 120) {
  let timer = null;
  return function debounced(...args) {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

/** 简单的 requestAnimationFrame 节流，用于流式渲染 */
export function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs = null;
  const run = () => {
    scheduled = false;
    fn(...(lastArgs || []));
    lastArgs = null;
  };
  return function throttled(...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(run);
  };
}

/** 判断滚动容器是否已经接近底部（流式时决定是否自动跟随） */
export function isNearBottom(node, threshold = 80) {
  if (!node) return true;
  return node.scrollHeight - node.scrollTop - node.clientHeight <= threshold;
}

export function scrollToBottom(node) {
  if (node) node.scrollTop = node.scrollHeight;
}
