/* ============================================================================
 * shell.js —— Codex 风格外壳的交互胶水
 * ============================================================================
 *
 * app.js 是真正的 Agent 面板逻辑（真实后端、SSE、工具、审批……），一行不改。
 * 这个文件只做「外壳」层的三件小事：
 *
 *   1. 新加/迁移的 UI 元素（图标栏、空状态、权限胶囊、搜索框）和行为绑定；
 *   2. 把 app.js 渲染出来的真实状态「镜像」到新外观上（会话标题、工作区名、
 *      模型来源、权限档位、聊天区是否有内容）；
 *   3. 输入框/按钮这些原有元素的快捷入口（比如点空状态建议 = 填进输入框）。
 *
 * 原则：只观察和转发，不持有业务状态——真相永远在 app.js 和 /api 快照里，
 * 避免出现“外壳以为权限是 A、后端已经是 B”的双真相。
 * ========================================================================== */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  var PERMISSION_LEVELS = ["ask", "accept-edits", "auto"];
  var PERMISSION_LABEL = { ask: "询问", "accept-edits": "自动改文件", auto: "完全访问" };

  // -------------------------------------------------------------------------
  // 空状态：聊天区有没有内容
  // -------------------------------------------------------------------------
  function syncEmptyState() {
    var chatLog = $("chat-log");
    var hasTurns = Boolean(chatLog && chatLog.querySelector(".turn"));
    document.body.classList.toggle("app-empty", !hasTurns);
    document.body.classList.toggle("app-chatting", hasTurns);
  }

  function watchChatLog() {
    var chatLog = $("chat-log");
    if (!chatLog) return;
    var observer = new MutationObserver(syncEmptyState);
    observer.observe(chatLog, { childList: true, subtree: false });
    syncEmptyState();
  }

  // -------------------------------------------------------------------------
  // 会话标题 / 工作区名：从真实渲染结果镜像到外壳
  // -------------------------------------------------------------------------
  function sessionTitle() {
    var titleNode = document.querySelector("#current-session .cs-title");
    var raw = titleNode ? titleNode.textContent.trim() : "";
    if (!raw || raw === "(空会话)") return "新对话";
    return raw;
  }

  function syncSessionTitle() {
    var target = $("chat-title");
    if (!target) return;
    var next = sessionTitle();
    if (target.textContent !== next) target.textContent = next;
  }

  function watchSessionTitle() {
    var current = $("current-session");
    if (!current) return;
    var observer = new MutationObserver(function () {
      syncSessionTitle();
      applySessionFilter();
    });
    observer.observe(current, { childList: true, subtree: true, characterData: true });
    syncSessionTitle();
  }

  function syncWorkspaceName() {
    var label = $("workspace-label");
    var target = $("side-workspace-name");
    if (!label || !target) return;
    var next = label.textContent.trim() || "工作区";
    if (target.textContent !== next) target.textContent = next;
    target.title = label.title || next;
  }

  function watchWorkspaceName() {
    var label = $("workspace-label");
    if (!label) return;
    var observer = new MutationObserver(syncWorkspaceName);
    observer.observe(label, { childList: true, characterData: true, subtree: true, attributes: true });
    syncWorkspaceName();
  }

  // -------------------------------------------------------------------------
  // 权限胶囊：显示真实档位，点击循环切换（真正的按钮在 .perm-seg-source 里）
  // -------------------------------------------------------------------------
  function currentPermissionLevel() {
    var buttons = document.querySelectorAll(".perm-seg-source .seg-btn");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("aria-pressed") === "true") {
        return buttons[i].dataset.level || "ask";
      }
    }
    return "ask";
  }

  function syncPermissionChip() {
    var chip = $("perm-chip");
    var label = $("perm-chip-label");
    if (!chip || !label) return;
    var level = currentPermissionLevel();
    chip.dataset.level = level;
    label.textContent = PERMISSION_LABEL[level] || level;
    chip.title =
      level === "ask"
        ? "权限：询问（点一下切到「自动改文件」）"
        : level === "accept-edits"
          ? "权限：自动改文件（点一下切到「完全访问」）"
          : "权限：完全访问（写文件 / 执行命令不再询问；点一下回到「询问」）";
    var source = document.querySelector(".perm-seg-source .seg-btn");
    var locked = false;
    if (source) {
      var buttons = document.querySelectorAll(".perm-seg-source .seg-btn");
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].disabled) locked = true;
      }
    }
    chip.disabled = locked;
  }

  function watchPermissionChip() {
    var source = document.querySelector(".perm-seg-source");
    if (!source) return;
    var observer = new MutationObserver(syncPermissionChip);
    observer.observe(source, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "disabled", "class"],
    });
    syncPermissionChip();
  }

  function cyclePermission() {
    var level = currentPermissionLevel();
    var index = PERMISSION_LEVELS.indexOf(level);
    var next = PERMISSION_LEVELS[(index + 1) % PERMISSION_LEVELS.length];
    var button = document.querySelector('.perm-seg-source .seg-btn[data-level="' + next + '"]');
    if (button) button.click();
  }

  // -------------------------------------------------------------------------
  // 模型胶囊：显示真实模型；点开「模型配置」
  // -------------------------------------------------------------------------
  function syncModelChip() {
    var model = $("badge-model");
    var kind = $("badge-kind");
    if (!model) return;
    var text = (kind && kind.textContent) || "";
    var isMock = /mock/i.test(text);
    var isError = /不可用/.test(text) || (kind && kind.classList.contains("bad"));
    model.dataset.kind = isError ? "error" : isMock ? "mock" : "real";
    model.title =
      (model.textContent || "模型") +
      (isMock ? " · mock 假模型（离线）" : isError ? " · 模型不可用" : " · 真实模型") +
      "\n点击打开模型配置";
  }

  function watchModelChip() {
    var kind = $("badge-kind");
    var model = $("badge-model");
    if (kind) {
      new MutationObserver(syncModelChip).observe(kind, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    }
    if (model) {
      new MutationObserver(syncModelChip).observe(model, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    syncModelChip();
  }

  // -------------------------------------------------------------------------
  // 调试抽屉：用已有的隐藏 #debug-toggle 驱动，不改 app.js
  // -------------------------------------------------------------------------
  function debugOpen() {
    return document.body.classList.contains("debug-on");
  }

  function ensureDebugTab() {
    if (!debugOpen()) return;
    var active = document.querySelector(".tabs .tab.active");
    if (!active || active.dataset.tab === "chat") {
      var eventsTab = document.querySelector('.tab[data-tab="events"]');
      if (eventsTab) eventsTab.click();
    }
  }

  function watchDebugState() {
    new MutationObserver(function () {
      if (debugOpen()) ensureDebugTab();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  function toggleDebug(force) {
    var toggle = $("debug-toggle");
    if (!toggle) return;
    var next = typeof force === "boolean" ? force : !debugOpen();
    if (next !== debugOpen()) toggle.click();
  }

  function openHistory() {
    var sessionsTab = document.querySelector('.tab[data-tab="sessions"]');
    if (sessionsTab) sessionsTab.click();
    toggleDebug(true);
  }

  function switchToChat() {
    if (debugOpen()) toggleDebug(false);
    var chatTab = document.querySelector('.tab[data-tab="chat"]');
    if (chatTab) chatTab.click();
  }

  // -------------------------------------------------------------------------
  // 会话搜索：只过滤 DOM，不动业务数据
  // -------------------------------------------------------------------------
  function applySessionFilter() {
    var input = $("session-search");
    var list = $("session-list");
    if (!input || !list) return;
    var keyword = input.value.trim().toLowerCase();
    var items = list.querySelectorAll(".session-item");
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var title = item.querySelector(".session-title");
      var raw = title ? title.textContent.trim() : "";
      var haystack = raw.toLowerCase();
      // 空会话（刚点“新聊天”/后端启动时自动创建）不占“最近”列表的位置
      var hiddenByEmpty = raw === "(空会话)" || raw === "空会话";
      item.style.display = !hiddenByEmpty && (!keyword || haystack.indexOf(keyword) !== -1) ? "" : "none";
    }
  }

  function watchSessionFilter() {
    var list = $("session-list");
    if (!list) return;
    new MutationObserver(applySessionFilter).observe(list, { childList: true });
  }

  // -------------------------------------------------------------------------
  // 建议任务：填进输入框（真实执行仍然走 app.js 的发送逻辑）
  // -------------------------------------------------------------------------
  function useSuggestion(text) {
    var input = $("input");
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    try {
      input.setSelectionRange(text.length, text.length);
    } catch (error) {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // 绑定
  // -------------------------------------------------------------------------
  function bindShell() {
    var railHome = $("rail-home");
    if (railHome) railHome.addEventListener("click", switchToChat);

    var railHistory = $("rail-history");
    if (railHistory) railHistory.addEventListener("click", openHistory);

    var chatNew = $("chat-new");
    if (chatNew) {
      chatNew.addEventListener("click", function () {
        var button = $("new-session-btn");
        if (button) button.click();
        switchToChat();
      });
    }

    var chatDebug = $("chat-debug");
    if (chatDebug) chatDebug.addEventListener("click", function () { toggleDebug(true); });

    var drawerClose = $("drawer-close");
    if (drawerClose) drawerClose.addEventListener("click", function () { toggleDebug(false); });

    var permChip = $("perm-chip");
    if (permChip) permChip.addEventListener("click", cyclePermission);

    var modelChip = $("badge-model");
    if (modelChip) {
      modelChip.addEventListener("click", function () {
        var config = $("config-btn");
        if (config) config.click();
      });
    }

    var choose = $("choose-workspace-btn");
    if (choose) {
      choose.addEventListener("click", function () {
        var workspace = $("workspace-btn");
        if (workspace && !workspace.disabled) workspace.click();
      });
    }
    var sideProject = $("side-project");
    if (sideProject) {
      sideProject.addEventListener("click", function () {
        var workspace = $("workspace-btn");
        if (workspace && !workspace.disabled) workspace.click();
      });
    }

    var search = $("session-search");
    if (search) {
      search.addEventListener("input", applySessionFilter);
      search.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          search.value = "";
          applySessionFilter();
          search.blur();
        }
      });
    }

    var chips = $("chat-empty-chips");
    if (chips) {
      chips.addEventListener("click", function (event) {
        var button = event.target && event.target.closest("button[data-prompt]");
        if (!button) return;
        useSuggestion(button.getAttribute("data-prompt") || "");
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      // 弹窗/侧栏的 Escape 由 app.js 处理；这里只兜底关闭调试抽屉
      if (debugOpen() && !document.querySelector("#modal-root .modal")) {
        toggleDebug(false);
      }
    });

    // 点击调试抽屉外部时关闭（桌面端）；避免误触，只在点击主区域空白时关闭
    document.addEventListener("mousedown", function (event) {
      if (!debugOpen()) return;
      var drawer = $("debug-drawer");
      if (!drawer) return;
      if (drawer.contains(event.target)) return;
      if (event.target.closest && event.target.closest("#debug-toggle")) return;
      toggleDebug(false);
    });
  }

  // -------------------------------------------------------------------------
  // 启动
  // -------------------------------------------------------------------------
  function init() {
    bindShell();
    watchChatLog();
    watchSessionTitle();
    watchWorkspaceName();
    watchPermissionChip();
    watchModelChip();
    watchSessionFilter();
    watchDebugState();
    // app.js 的渲染是异步的（SSE hello / /api/state），补几次同步
    setTimeout(syncEmptyState, 300);
    setTimeout(syncSessionTitle, 500);
    setTimeout(syncWorkspaceName, 500);
    setTimeout(syncPermissionChip, 500);
    setTimeout(syncModelChip, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
