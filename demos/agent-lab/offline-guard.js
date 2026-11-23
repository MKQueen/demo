/* ============================================================================
 * offline-guard.js —— 真实 Agent 模式下的「后端未连接」诚实提示
 * ============================================================================
 *
 * 这个 demo 不是回放：页面上的每个回答、每次文件读写、每条命令，都由本机的
 * mini-opencode 后端真实执行。纯静态托管只能把页面发下来，没法在浏览器里跑
 * 一个 Node Agent —— 所以后端不在线时，页面必须**如实说明**，而不是假装有数据。
 *
 * 做法：页面加载后探一下 /api/meta（真实后端的路由）。
 *   - 通了：什么都不做，交给 app.js 正常工作；
 *   - 没通：底部浮出一张提示卡，告诉用户怎么把后端跑起来，并提供「重试连接」。
 *
 * 注意：只用 createElement + textContent 拼 DOM（项目规则：禁止 innerHTML）。
 * ========================================================================== */
(function () {
  'use strict';

  var BANNER_ID = 'agent-offline-banner';
  var retries = 0;
  var MAX_AUTO_RETRIES = 6;
  var timer = null;

  function removeBanner() {
    var old = document.getElementById(BANNER_ID);
    if (old) old.remove();
  }

  function addLine(parent, text, tag, styles) {
    var node = document.createElement(tag || 'div');
    node.textContent = text;
    if (styles) node.setAttribute('style', styles);
    parent.appendChild(node);
    return node;
  }

  function showBanner(detail) {
    if (document.getElementById(BANNER_ID)) return;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.setAttribute(
      'style',
      [
        'position:fixed',
        'top:64px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483000',
        'max-width:min(560px,calc(100vw - 32px))',
        'box-sizing:border-box',
        'padding:14px 16px',
        'border-radius:14px',
        'border:1px solid #e5e5e5',
        'background:#ffffff',
        'color:#111111',
        'font:13px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB",sans-serif',
        'box-shadow:0 18px 48px -20px rgba(17,17,17,.28)',
      ].join(';'),
    );

    addLine(
      banner,
      '未连接到真实 Agent 后端',
      'div',
      'font-weight:600;font-size:13.5px;margin-bottom:6px;color:#111111',
    );
    addLine(
      banner,
      'mini-opencode 面板跑的是真 Agent：真模型、真文件读写、真命令执行，需要本机的 Node 后端。',
    );
    addLine(
      banner,
      '启动方法：在项目根目录执行 npm run serve（会自动同时启动站点和后端，然后刷新本页）。',
      'div',
      'margin-top:8px',
    );
    addLine(
      banner,
      '单独部署到静态托管时工具无法执行——这是 Agent 的物理边界，不是页面坏了。',
      'div',
      'margin-top:6px;color:#8a8a8a',
    );
    if (detail) {
      addLine(banner, '错误：' + detail, 'div', 'margin-top:6px;color:#8a8a8a;word-break:break-all');
    }

    var row = document.createElement('div');
    row.setAttribute('style', 'margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap');

    var retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试连接';
    retry.setAttribute(
      'style',
      [
        'appearance:none',
        'border:1px solid #111111',
        'background:#111111',
        'color:#ffffff',
        'border-radius:8px',
        'padding:6px 12px',
        'font:inherit',
        'cursor:pointer',
      ].join(';'),
    );
    retry.addEventListener('click', function () {
      retry.disabled = true;
      retry.textContent = '检测中…';
      check(true);
    });
    row.appendChild(retry);

    var hint = document.createElement('span');
    hint.textContent = '或直接运行 apps/agent-lab 的 npm run web';
    hint.setAttribute('style', 'color:#8a8a8a;font-size:11.5px');
    row.appendChild(hint);

    banner.appendChild(row);
    document.body.appendChild(banner);
  }

  function scheduleRetry() {
    if (timer || retries >= MAX_AUTO_RETRIES) return;
    timer = setTimeout(function () {
      timer = null;
      check(false);
    }, 3000);
  }

  function check(isManual) {
    if (isManual) retries = 0;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller
      ? setTimeout(function () {
          controller.abort();
        }, 4000)
      : null;

    fetch('/api/meta', {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.version) throw new Error('返回内容不是 Agent 后端');
        // 后端在线：撤掉提示，交给真正的面板
        removeBanner();
        retries = MAX_AUTO_RETRIES;
        document.documentElement.setAttribute('data-agent-backend', 'online');
      })
      .catch(function (error) {
        retries += 1;
        var detail = error && error.message ? error.message : String(error);
        showBanner(detail === 'HTTP 404' ? '' : detail);
        scheduleRetry();
        document.documentElement.setAttribute('data-agent-backend', 'offline');
      })
      .finally(function () {
        if (timeout) clearTimeout(timeout);
      });
  }

  // 面板自己连上 SSE 时也会广播这个事件（见 app.js handleSseEvent hello）：
  // 兜住「后端启动慢、提示条自动重试用完」的情况，别让过期提示一直挂着。
  window.addEventListener("agent-backend-online", function () {
    removeBanner();
    retries = MAX_AUTO_RETRIES;
    document.documentElement.setAttribute("data-agent-backend", "online");
  });

  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', function () {
      check(false);
    });
  } else {
    check(false);
  }
})();
