// 开场（标题 + BEGIN）与 LOADING 屏
// ---------------------------------------------------------------------------
// createIntro({ title, latin, ... }) → { el, loadingEl, show, hide, showLoading,
//   hideLoading, setBeginEnabled, onBegin }
// 标题用 SVG 叠字做「手绘方块 3D 字」：奶油色正面 + 灰绿侧面 + 深色描边，
// 贴近原站 MESSENGER 的方块字，只是换成了中文「京城来信」。
// ---------------------------------------------------------------------------

import { stickerEnvelope, postmark, envelope } from './icons.js';

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
}

// 侧面颜色：从最远（深）到最近（浅）——
// 原站方块字的顶面是浅米灰，越往深里越暗，最后用深色描边勾住整个轮廓。
const DEPTH_COLORS = ['#97998c', '#a4a696', '#b1b3a1', '#bec0ab', '#c9cbb4', '#d4d3b3'];

// 每个字的摆放：位置 / 字号 / 轻微旋转（手工摆歪一点）
const TITLE_LAYOUT = [
  { x: 208, y: 300, rotate: -3.2 },
  { x: 560, y: 286, rotate: 2.1 },
  { x: 196, y: 618, rotate: 1.6 },
  { x: 566, y: 606, rotate: -2.4 },
];

function buildTitleSvg(title) {
  const chars = [...title];
  const fontSize = 236;
  const step = 4.2; // 每层错开多少 px，6 层 ≈ 25px 厚度
  const layers = DEPTH_COLORS.length;
  const parts = [];

  chars.slice(0, 4).forEach((char, index) => {
    const spot = TITLE_LAYOUT[index] || TITLE_LAYOUT[TITLE_LAYOUT.length - 1];
    parts.push(`<g transform="rotate(${spot.rotate} ${spot.x} ${spot.y})">`);
    for (let i = layers; i >= 1; i -= 1) {
      // 手绘抖动：确定性的小偏移，不依赖随机数，每次渲染都一样
      const jx = Math.sin(index * 7.3 + i * 1.7) * 1.15;
      const jy = Math.cos(index * 5.1 + i * 2.3) * 1.15;
      const x = (spot.x + i * step + jx).toFixed(2);
      const y = (spot.y - i * step + jy).toFixed(2);
      parts.push(
        `<text x="${x}" y="${y}" fill="${DEPTH_COLORS[i - 1]}" stroke-width="3.2">${escapeXml(char)}</text>`
      );
    }
    parts.push(
      `<text x="${spot.x}" y="${spot.y}" fill="#EDF2E4" stroke-width="4.6">${escapeXml(char)}</text>`
    );
    parts.push('</g>');
  });

  return `
  <svg viewBox="0 0 760 700" role="img" aria-label="${escapeXml(title)}">
    <g font-family="'ZCOOL KuaiLe','Ma Shan Zheng','Kaiti SC',serif" font-size="${fontSize}"
       text-anchor="middle" stroke="#253037" paint-order="stroke"
       stroke-linejoin="round" stroke-linecap="round" letter-spacing="0">
      ${parts.join('\n      ')}
    </g>
  </svg>`;
}

function buildPostmarkHtml() {
  return `<div class="bc-corner bc-corner--postmark" aria-hidden="true">${postmark}</div>`;
}

export function createIntro(options = {}) {
  const {
    root,
    title = '京城来信',
    latin = 'BEIJING COURIER',
    eyebrow = '一颗小行星 · 五封没有地址的信',
    cnLine = '把想念折好，放进邮包。',
    note = '风从东边来，<br>信从手里走。',
    edition = { top: 'BEIJING, A SMALL PLANET', bottom: 'VOL. 001 · 五封手写信' },
    beginLabel = 'BEGIN',
    beginSub = '开始送信',
    onBegin,
    onMuteClick,
  } = options;

  const el = document.createElement('section');
  el.className = 'bc-intro';
  el.setAttribute('aria-label', '京城来信 · 开场');
  el.innerHTML = `
    <div class="bc-intro__veil" aria-hidden="true"></div>
    ${buildPostmarkHtml()}
    <div class="bc-corner bc-corner--stamp" aria-hidden="true">${stickerEnvelope}</div>
    <div class="bc-float-mail bc-float-mail--a" aria-hidden="true">${stickerEnvelope}</div>
    <div class="bc-float-mail bc-float-mail--b" aria-hidden="true">${stickerEnvelope}</div>
    <p class="bc-intro__eyebrow">${eyebrow}</p>
    <div class="bc-title" aria-hidden="false">${buildTitleSvg(title)}</div>
    <p class="bc-intro__latin">${latin}</p>
    <p class="bc-intro__cn">${cnLine}</p>
    <button class="bc-begin" type="button">
      <span class="bc-begin__en">${beginLabel}</span>
      <span class="bc-begin__cn">${beginSub}</span>
    </button>
    <p class="bc-corner bc-corner--note" aria-hidden="true">${note}</p>
    <p class="bc-corner bc-corner--colon" aria-hidden="true">
      <span>${edition.top}</span>
      <b>京城来信</b>
      <span>${edition.bottom}</span>
    </p>
  `;

  // 左上角再加一枚小邮戳（用同一个 SVG，换 class 定位）
  const beginButton = el.querySelector('.bc-begin');

  beginButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (beginButton.disabled) return;
    onBegin?.();
  });

  // 预留静音按钮位置：右上角小邮票本身就是静音开关（可选）
  const stamp = el.querySelector('.bc-corner--stamp');
  if (onMuteClick && stamp) {
    stamp.style.pointerEvents = 'auto';
    stamp.style.cursor = 'pointer';
    stamp.setAttribute('role', 'button');
    stamp.setAttribute('tabindex', '0');
    stamp.setAttribute('title', '静音 / 取消静音');
    stamp.addEventListener('click', () => onMuteClick());
    stamp.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onMuteClick();
      }
    });
  }

  // ---- LOADING 屏 ---------------------------------------------------------
  const loadingEl = document.createElement('div');
  loadingEl.className = 'bc-loading';
  loadingEl.setAttribute('aria-label', '正在加载');
  loadingEl.innerHTML = `
    <div class="bc-loading__inner">
      <div class="bc-loading__envelope">${envelope('#1d1d1b', 2)}</div>
      <div class="bc-loading__word" aria-label="LOADING">
        ${[...'LOADING'].map((ch) => `<span>${ch}</span>`).join('')}
      </div>
      <div class="bc-loading__cn">正在拆开今天的信…</div>
    </div>
  `;

  root.append(el, loadingEl);

  let introVisible = true;

  return {
    el,
    loadingEl,
    beginButton,
    show() {
      introVisible = true;
      el.classList.remove('is-hidden');
      el.style.display = '';
    },
    hide() {
      introVisible = false;
      el.classList.add('is-hidden');
    },
    showLoading() {
      loadingEl.classList.add('is-on');
    },
    hideLoading() {
      loadingEl.classList.remove('is-on');
    },
    setBeginEnabled(enabled) {
      beginButton.disabled = !enabled;
      beginButton.style.opacity = enabled ? '' : '0.55';
      beginButton.style.cursor = enabled ? '' : 'wait';
    },
    setBeginLabel(text) {
      const span = beginButton.querySelector('.bc-begin__en');
      if (span) span.textContent = text;
    },
    setLoadingVisible(visible) {
      loadingEl.classList.toggle('is-on', !!visible);
    },
    get visible() {
      return introVisible;
    },
    destroy() {
      el.remove();
      loadingEl.remove();
    },
  };
}

export default createIntro;
