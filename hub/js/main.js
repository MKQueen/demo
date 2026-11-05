/**
 * DEMO LAB · 合集首页
 * 纯原生 JS：从 demos.json 读取作品元数据并渲染，无框架、无构建依赖。
 */

const docEl = document.documentElement;
docEl.classList.add('js');

const $ = (sel, root = document) => root.querySelector(sel);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* --------------------------------------------------------------------------
   工具
   -------------------------------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/* --------------------------------------------------------------------------
   静态内容
   -------------------------------------------------------------------------- */

const STACK = [
  {
    cat: 'RENDERING',
    accent: '#8bd4ff',
    items: ['Three.js', 'WebGL / GLSL', 'GLB / glTF', 'Rapier3D', 'MediaPipe'],
    note: '浏览器内的实时三维渲染、物理与体感推理。',
  },
  {
    cat: 'RETRIEVAL',
    accent: '#22d3ee',
    items: ['本地向量', 'BM25', 'RRF 融合', 'PCA 投影', 'SSE 流式'],
    note: '检索链路的每一段分数与耗时都可以摊开看。',
  },
  {
    cat: 'AGENT',
    accent: '#a78bfa',
    items: ['Agent Loop', 'Tool Calling', '权限审批', '上下文压缩', '真实工具执行'],
    note: '把模型行为拆成一条可观测、可复盘的事件流；本地后端真实执行。',
  },
  {
    cat: 'GEOSPATIAL',
    accent: '#6ce5ff',
    items: ['CesiumJS', '3D Tiles 1.1', 'OSM / ODbL', 'glTF 2.0', 'ENU / WGS84'],
    note: '浏览器里的城市级数字孪生：白模、路网、相机与 HTML 信息窗。',
  },
  {
    cat: 'BUILD',
    accent: '#f4b35b',
    items: ['Vite', 'Node 24', '原生 JS', 'Playwright', '静态拼装 + 本地模型转发'],
    note: '每个 Demo 独立构建；静态站照常拼装，RAG 真模型回答与真 Agent 由本地 serve 拉起。',
  },
];

const TICKER_WORDS = [
  '3D 实时渲染',
  'CBD 数字孪生',
  'Cesium 3D Tiles',
  '楼层分层档案',
  'RAG 全链路可视化',
  'Agent 真机执行',
  'MediaPipe 体感',
  '本地 Node 后端',
  '纯静态构建 + 本地真模型',
  '相对路径 · 任意子目录托管',
];

/* --------------------------------------------------------------------------
   渲染
   -------------------------------------------------------------------------- */

function renderHeroStats(stats = []) {
  const host = $('#hero-stats');
  host.replaceChildren();
  stats
    .filter(Boolean)
    .slice(0, 4)
    .forEach((item) => {
      const li = el('li');
      li.appendChild(el('b', null, item.value));
      li.appendChild(el('span', null, item.label));
      host.appendChild(li);
    });
}

function renderDeck(demos) {
  const host = $('#deck-list');
  host.replaceChildren();

  demos.forEach((demo, index) => {
    const li = el('li', 'deck-item');
    const a = el('a');
    a.href = demo.href;
    a.style.setProperty('--item-accent', demo.accent || 'var(--accent)');
    a.setAttribute('aria-label', `进入 ${demo.name} 演示`);

    a.appendChild(el('span', 'deck-num', pad2(index + 1)));
    a.appendChild(el('span', 'deck-name', demo.name));
    a.appendChild(el('span', 'deck-kicker', demo.kicker || ''));
    a.appendChild(el('span', 'deck-arrow', '↗'));
    li.appendChild(a);
    host.appendChild(li);
  });
}

function renderTicker() {
  const track = $('#ticker-track');
  track.replaceChildren();

  const makeGroup = () => {
    const group = el('div', 'ticker-group');
    // 一组内容重复两遍，再复制整组 → 平移一半即可无缝循环
    for (let round = 0; round < 2; round += 1) {
      TICKER_WORDS.forEach((word) => group.appendChild(el('span', null, word)));
    }
    return group;
  };

  track.appendChild(makeGroup());
  track.appendChild(makeGroup());
}

function coverFallbackText(demo) {
  const en = String(demo.en || demo.id || 'DEMO').trim();
  const first = en.split(/\s+/)[0] || 'DEMO';
  return first.slice(0, 6).toUpperCase();
}

function renderCards(demos) {
  const host = $('#demo-list');
  host.replaceChildren();

  demos.forEach((demo, index) => {
    const card = el('article', 'demo-card');
    card.style.setProperty('--accent', demo.accent || 'var(--accent)');
    card.style.setProperty('--delay', `${(index % 2) * 0.06}s`);
    card.dataset.index = `${pad2(index + 1)} / ${pad2(demos.length)}`;

    /* -------- 封面 -------- */
    const cover = el('a', 'demo-cover');
    cover.href = demo.href;
    cover.setAttribute('aria-label', `打开 ${demo.name} 演示`);

    const img = el('img');
    img.src = demo.cover;
    img.alt = `${demo.name} — ${demo.tagline || demo.kicker || '演示封面'}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      cover.classList.add('no-image');
      img.remove();
    });

    const fallback = el('span', 'cover-fallback');
    fallback.appendChild(el('b', null, coverFallbackText(demo)));

    const tag = el('span', 'cover-tag');
    tag.appendChild(el('i'));
    tag.appendChild(document.createTextNode(`DEMO ${pad2(index + 1)}`));

    const cta = el('span', 'cover-cta');
    cta.appendChild(document.createTextNode(demo.cta || '进入演示'));
    const ctaDot = el('b', null, '→');
    cta.appendChild(ctaDot);

    cover.append(img, fallback, tag, cta);

    /* -------- 文案 -------- */
    const body = el('div', 'demo-body');

    const meta = el('p', 'demo-meta');
    meta.appendChild(el('span', 'demo-kicker', demo.kicker || ''));
    if (demo.meta) {
      meta.appendChild(el('i', 'demo-meta-dot'));
      meta.appendChild(el('span', null, demo.meta));
    }

    const title = el('div', 'demo-title');
    title.appendChild(el('h3', null, demo.name));
    title.appendChild(el('span', 'demo-en', demo.en || ''));

    const tagline = el('p', 'demo-tagline', demo.tagline || '');
    const desc = el('p', 'demo-desc', demo.description || '');

    const highlights = el('ul', 'demo-highlights');
    (demo.highlights || []).forEach((item) => highlights.appendChild(el('li', null, item)));

    const tags = el('div', 'demo-tags');
    (demo.tags || []).forEach((item) => tags.appendChild(el('span', null, item)));

    const link = el('a', 'demo-link');
    link.href = demo.href;
    link.appendChild(document.createTextNode(demo.cta ? `进入演示` : '进入演示'));
    link.appendChild(el('span', null, '↗'));

    body.append(meta, title, tagline, desc, highlights, tags, link);
    card.append(cover, body);
    host.appendChild(card);
  });
}

function renderStack() {
  const host = $('#stack-grid');
  host.replaceChildren();

  STACK.forEach((group) => {
    const card = el('article', 'stack-card');
    card.style.setProperty('--stack-accent', group.accent);

    const cat = el('div', 'stack-cat');
    cat.appendChild(el('span', null, group.cat));
    cat.appendChild(el('b', null, `${pad2(group.items.length)}`));

    const items = el('div', 'stack-items');
    group.items.forEach((item) => items.appendChild(el('span', null, item)));

    card.append(cat, items, el('p', null, group.note));
    host.appendChild(card);
  });
}

/* --------------------------------------------------------------------------
   交互
   -------------------------------------------------------------------------- */

function initNavScroll() {
  const nav = $('#nav');
  const bar = $('#scroll-bar');
  const onScroll = () => {
    const y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-scrolled', y > 12);
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    bar.style.width = max > 0 ? `${Math.min(100, (y / max) * 100)}%` : '0%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const targets = [...document.querySelectorAll('.reveal, .demo-card, .stack-card')];
  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    targets.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  targets.forEach((node) => observer.observe(node));
}

function initCoverTilt() {
  if (!finePointer || prefersReducedMotion) return;
  const covers = document.querySelectorAll('.demo-cover');

  covers.forEach((cover) => {
    const max = 2.6;
    cover.style.transformStyle = 'preserve-3d';
    cover.addEventListener('pointermove', (event) => {
      const rect = cover.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      cover.style.setProperty('--ry', `${(px * max * 2).toFixed(2)}deg`);
      cover.style.setProperty('--rx', `${(-py * max * 2).toFixed(2)}deg`);
    });
    cover.addEventListener('pointerleave', () => {
      cover.style.setProperty('--ry', '0deg');
      cover.style.setProperty('--rx', '0deg');
    });
  });
}

function initMisc(data) {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  const note = $('#footer-note');
  if (note && data.site && data.site.footer) note.textContent = data.site.footer;

  const top = document.querySelector('.to-top');
  if (top) {
    top.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  }
}

/* --------------------------------------------------------------------------
   启动
   -------------------------------------------------------------------------- */

async function boot() {
  renderTicker();
  renderStack();
  initNavScroll();
  initMisc({});

  let data;
  try {
    const response = await fetch('./demos.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`demos.json HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.error('[demo-lab] 读取 demos.json 失败：', error);
    const host = $('#demo-list');
    host.replaceChildren();
    const tip = el('p', 'load-error');
    tip.textContent = '作品列表加载失败：请通过本地服务器打开（npm run serve），而不是直接双击 index.html。';
    tip.style.cssText =
      'padding:24px;border:1px solid var(--line);border-radius:14px;color:var(--text-dim);font-size:14px;line-height:1.8';
    host.appendChild(tip);
    initReveal();
    return;
  }

  const demos = Array.isArray(data.demos) ? data.demos : [];
  if (data.site && Array.isArray(data.site.stats)) renderHeroStats(data.site.stats);
  renderDeck(demos);
  renderCards(demos);
  initMisc(data);

  // 等渲染完成后再启动进场观察
  requestAnimationFrame(() => {
    initReveal();
    initCoverTilt();
  });

  if (data.site && data.site.name) {
    document.title = `${data.site.name} · 交互实验室 — 交互作品集`;
  }
}

boot();
