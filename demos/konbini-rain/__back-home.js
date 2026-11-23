/**
 * __back-home.js —— 注入到每个 demo 页面里的「返回合集」悬浮按钮。
 *
 * 由 scripts/build-all.mjs 在拼接站点时自动注入，demo 源码不需要引用它。
 * 因此每个 demo 保持独立可跑，同时上线后又能一键回到作品集首页。
 */
(function () {
  if (window.__demoBackHomeInstalled) return;
  window.__demoBackHomeInstalled = true;

  var HOME = '../../index.html';

  var css =
    '.__back-home{' +
    'position:fixed;right:14px;bottom:14px;z-index:2147483647;' +
    'display:inline-flex;align-items:center;gap:6px;' +
    'padding:6px 11px;border-radius:8px;' +
    'background:rgba(255,255,255,.88);color:#111111;' +
    'border:1px solid rgba(17,17,17,.12);' +
    'font:500 11.5px/1.1 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;' +
    'letter-spacing:.01em;text-decoration:none;cursor:pointer;' +
    '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
    'box-shadow:0 10px 28px -16px rgba(17,17,17,.3);' +
    'opacity:.72;transition:opacity .18s ease,transform .18s ease,border-color .18s ease;' +
    '}' +
    '.__back-home:hover,.__back-home:focus-visible{' +
    'opacity:1;transform:translateY(-1px);border-color:#111111;outline:none;' +
    '}' +
    '.__back-home .__bh-arrow{font-size:11px;line-height:1;color:#c2410c;}' +
    '.__back-home .__bh-sub{display:none;}' +
    '@media (max-width:640px){.__back-home{right:10px;bottom:10px;padding:5px 9px;font-size:11px;}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var link = document.createElement('a');
  link.className = '__back-home';
  link.href = HOME;
  link.title = '返回 DEMO 作品集首页';
  link.setAttribute('aria-label', '返回 DEMO 作品集首页');

  var arrow = document.createElement('span');
  arrow.className = '__bh-arrow';
  arrow.textContent = '◂';

  var label = document.createElement('span');
  label.textContent = '作品集';

  var sub = document.createElement('span');
  sub.className = '__bh-sub';
  sub.textContent = 'DEMO LAB';

  link.appendChild(arrow);
  link.appendChild(label);
  link.appendChild(sub);

  function mount() {
    if (!document.body) return;
    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
