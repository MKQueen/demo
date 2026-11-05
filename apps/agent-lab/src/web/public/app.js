/**
 * ============================================================================
 * mini-opencode · 网页版 Agent 可观测面板（前端）
 * ============================================================================
 *
 * 纯原生 JS：无框架、无构建、无外部 CDN。
 *
 * 数据从哪来：
 *   1. GET  /api/state            首屏 / 回合结束后的完整快照（含历史 events）
 *   2. SSE  /api/events           实时事件流（模型 token、工具、审批、trace…）
 *   3. 各种 POST                  发消息、审批、配置、切会话、压缩…
 *
 * 渲染策略：
 *   - 历史回合：用 state.events（服务端 JSONL 记录）重建
 *   - 进行中的回合：用 SSE 增量渲染（流式文本直接往一个 span 里追加）
 *   - turn_complete 后重新 GET /api/state 全量重绘，保证最终一致
 *
 * 安全约定：
 *   模型输出、工具输出、会话标题、审批 detail 都是不可信文本，
 *   一律用 textContent / createTextNode 插入，绝不拼 innerHTML。
 */

"use strict";

(function () {
  // -------------------------------------------------------------------------
  // 0. 小工具
  // -------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  /** 记录到 state 的“事件”类型，和 JSONL 的 type 对齐。 */
  const MAX_EVENT_ROWS = 6000;

  function el(tag, options, children) {
    const node = document.createElement(tag);
    if (options) {
      if (options.className) node.className = options.className;
      if (options.text !== undefined && options.text !== null) node.textContent = String(options.text);
      if (options.title !== undefined && options.title !== null) node.title = String(options.title);
      if (options.attrs) {
        for (const key of Object.keys(options.attrs)) {
          const value = options.attrs[key];
          if (value === true) node.setAttribute(key, "");
          else if (value !== false && value !== null && value !== undefined) {
            node.setAttribute(key, String(value));
          }
        }
      }
      if (options.style) {
        for (const key of Object.keys(options.style)) node.style.setProperty(key, options.style[key]);
      }
      if (options.dataset) {
        for (const key of Object.keys(options.dataset)) node.dataset[key] = String(options.dataset[key]);
      }
      if (options.on) {
        for (const key of Object.keys(options.on)) node.addEventListener(key, options.on[key]);
      }
    }
    if (children) {
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
    }
    return node;
  }

  const numberFormat = new Intl.NumberFormat("zh-CN");

  function fmtInt(value) {
    return numberFormat.format(Number(value) || 0);
  }

  function fmtDuration(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0) return "—";
    if (value < 1000) return Math.round(value) + "ms";
    if (value < 60_000) return (value / 1000).toFixed(1) + "s";
    const minutes = Math.floor(value / 60_000);
    const seconds = Math.round((value % 60_000) / 1000);
    return minutes + "m" + seconds + "s";
  }

  function fmtClock(ts) {
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  }

  function fmtAgo(iso) {
    const time = new Date(String(iso || "")).getTime();
    if (!Number.isFinite(time)) return "—";
    const diff = Date.now() - time;
    if (diff < 45_000) return "刚刚";
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + " 分钟前";
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + " 小时前";
    return Math.floor(diff / 86_400_000) + " 天前";
  }

  function fmtRel(ts, baseTs) {
    if (!Number.isFinite(ts) || !Number.isFinite(baseTs)) return "—";
    const diff = (ts - baseTs) / 1000;
    return (diff >= 0 ? "+" : "") + diff.toFixed(1) + "s";
  }

  function oneLine(value, max) {
    const text = String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
    const limit = max || 160;
    return text.length > limit ? text.slice(0, limit) + "…" : text;
  }

  function safeJson(value, maxChars) {
    let text;
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
    if (text === undefined) text = "undefined";
    const limit = maxChars || 0;
    if (limit && text.length > limit) {
      return text.slice(0, limit) + "\n…（已截断 " + (text.length - limit) + " 字符，完整内容见「下载 JSON」）";
    }
    return text;
  }

  function formatArgs(raw) {
    const text = String(raw === null || raw === undefined ? "" : raw);
    if (!text.trim()) return "（无参数）";
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  function isNearBottom(node, threshold) {
    if (!node) return true;
    return node.scrollHeight - node.scrollTop - node.clientHeight < (threshold || 140);
  }

  function scrollToBottom(node, force) {
    if (!node) return;
    if (force || isNearBottom(node)) node.scrollTop = node.scrollHeight;
  }

  async function apiGet(path) {
    const res = await fetch(path, { cache: "no-store" });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) throw new Error((payload && payload.error) || "HTTP " + res.status);
    return payload;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) throw new Error((payload && payload.error) || "HTTP " + res.status);
    return payload;
  }

  /** DELETE 和 apiPost 结构一样，单独写一个让调用处语义清楚。 */
  async function apiDelete(path) {
    const res = await fetch(path, { method: "DELETE" });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) throw new Error((payload && payload.error) || "HTTP " + res.status);
    return payload;
  }

  // -------------------------------------------------------------------------
  // 1. DOM 引用 & 全局状态
  // -------------------------------------------------------------------------

  const dom = {
    sidebarToggle: $("sidebar-toggle"),
    sidebarClose: $("sidebar-close"),
    sidebarBackdrop: $("sidebar-backdrop"),
    debugToggle: $("debug-toggle"),
    conn: $("conn"),
    connText: $("conn-text"),
    version: $("badge-version"),
    model: $("badge-model"),
    kind: $("badge-kind"),
    modeBuild: $("mode-build"),
    modePlan: $("mode-plan"),
    effortSelect: $("effort-select"),
    configBtn: $("config-btn"),
    stopBtn: $("stop-btn"),

    workspaceBtn: $("workspace-btn"),
    workspaceLabel: $("workspace-label"),
    permButtons: Array.from(document.querySelectorAll(".perm-seg .seg-btn")),
    attachBtn: $("attach-btn"),
    imageInput: $("image-input"),
    attachments: $("attachments"),

    newSessionBtn: $("new-session-btn"),
    currentSession: $("current-session"),
    sessionsCount: $("sessions-count"),
    toggleArchived: $("toggle-archived"),
    sessionList: $("session-list"),
    stats: $("stats"),
    compactBtn: $("compact-btn"),
    refreshBtn: $("refresh-btn"),
    todos: $("todos"),
    todosCount: $("todos-count"),

    tabs: Array.from(document.querySelectorAll(".tab")),
    panels: {
      chat: $("panel-chat"),
      events: $("panel-events"),
      tools: $("panel-tools"),
      sessions: $("panel-sessions"),
    },

    chatMeta: $("chat-meta"),
    chatStatus: $("chat-status"),
    statusSession: $("status-session"),
    statusTokens: $("status-tokens"),
    statusContext: $("status-context"),
    chatLog: $("chat-log"),
    expandToolsBtn: $("expand-tools-btn"),
    collapseToolsBtn: $("collapse-tools-btn"),
    scrollBottomBtn: $("scroll-bottom-btn"),
    composerNote: $("composer-note"),
    input: $("input"),
    sendBtn: $("send-btn"),
    composerHint: $("composer-hint"),
    composerExtra: $("composer-extra"),

    eventsTabCount: $("events-tab-count"),
    toolsTabCount: $("tools-tab-count"),
    sessionsTabCount: $("sessions-tab-count"),
    eventsSummary: $("events-summary"),
    eventsPause: $("events-pause"),
    eventsClear: $("events-clear"),
    eventsDownload: $("events-download"),
    eventsScroll: $("events-scroll"),
    eventsBody: $("events-body"),
    eventsEmpty: $("events-empty"),

    toolsTabInline: $("tools-tab-inline"),
    flow: $("flow"),
    toolsGrid: $("tools-grid"),
    features: $("features"),
    docs: $("docs"),

    sessionsPanel: $("sessions-panel"),
    modalRoot: $("modal-root"),
    toastRoot: $("toast-root"),
  };

  const state = {
    snapshot: null,
    /** 历史会话是否显示已归档项（只影响前端过滤，不改变磁盘数据）。 */
    showArchived: false,
    conn: "connecting", // connecting | open | reconnecting | offline
    hadConnected: false,
    tab: "chat",
    busy: false,
    sending: false,
    stopping: false,
    pending: new Map(), // id -> {id, toolName, detail, danger}
    approvalCards: new Map(), // id -> {root, setStatus}
    approvalsBySession: new Map(), // sessionId -> [{id, approval, status, reason, turnIndex}]
    approvalPending: false, // 审批 POST 是否正在提交（防连点）
    liveEvents: [],
    eventLog: [], // {seq, ts, type, data, live}
    telemetry: { runStartedAt: null, firstTokenAt: null, lastTtftMs: null, liveContext: null },
    eventBaseTs: null,
    eventsCleared: false,
    stream: { active: false, text: "", thinking: "" },
    live: {
      turnEl: null,
      stepEl: null,
      stepItemsEl: null,
      stepNo: 0,
      assistantEl: null,
      streamTextEl: null,
      cursorEl: null,
      thinkingEl: null,
      pendingTools: [],
    },
    stats: {
      step: 0,
      contextTokens: 0,
      historyMessages: 0,
      // 首屏渲染时还没有快照，先用 DeepSeek 的默认预算占位；拿到 snapshot 后以服务端为准。
      budget: 224_000,
      promptTokens: 0,
      completionTokens: 0,
      durationMs: 0,
      steps: 0,
      messageCount: 0,
      toolCalls: 0,
      aborted: false,
      hitStepLimit: false,
      toolDenials: 0,
    },
    // 工作区（Agent 的 cwd）：来自 snapshot.workspace / cwd 或 SSE workspace 事件
    workspacePath: "",
    // 三级权限：ask / accept-edits / auto（来自 snapshot.permissionLevel，旧字段兜底）
    permissionLevel: "ask",
    // 待发送的图片附件：{id, name, size, dataUrl}
    attachments: [],
    attachmentSeq: 0,
  };

  const modal = { el: null, kind: null, id: null, dismissible: false };

  // -------------------------------------------------------------------------
  // 2. 顶栏 / 连接状态 / 输入区
  // -------------------------------------------------------------------------

  function setConn(next) {
    state.conn = next;
    renderConn();
    updateComposer();
  }

  function renderConn() {
    const labels = { open: "已连接", connecting: "连接中…", reconnecting: "重连中…", offline: "已断开" };
    dom.conn.dataset.state = state.conn;
    dom.connText.textContent = labels[state.conn] || state.conn;
    dom.conn.title = "SSE /api/events · " + (labels[state.conn] || state.conn);
  }

  function isConnected() {
    return state.conn === "open";
  }

  function renderHeader() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const config = snapshot.config || {};
    dom.version.textContent = "v" + (snapshot.version || "—");
    dom.model.textContent = config.model || "—";
    dom.model.title =
      "baseUrl: " + (config.baseUrl || "—") +
      (config.hasApiKey ? " · key " + config.apiKeyMasked : " · 未配置 API key");
    const isMock = Boolean(config.mock);
    if (config.providerError) {
      dom.kind.textContent = "模型不可用";
      dom.kind.className = "badge bad";
      dom.kind.title = "模型初始化失败：" + config.providerError;
    } else {
      dom.kind.textContent = isMock ? "mock" : "真实模型";
      dom.kind.className = "badge " + (isMock ? "warn" : "ok");
      dom.kind.title = isMock
        ? "内置 mock 假模型：不联网、不花钱，但 Agent 循环 / 工具 / 权限 / 会话都是真的"
        : config.hasApiKey
          ? "已配置 API key：" + config.apiKeyMasked
          : "未配置 API key，可在「模型配置」里填";
    }

    const mode = snapshot.mode === "plan" ? "plan" : "build";
    dom.modeBuild.classList.toggle("active", mode === "build");
    dom.modePlan.classList.toggle("active", mode === "plan");
    dom.modeBuild.setAttribute("aria-pressed", mode === "build" ? "true" : "false");
    dom.modePlan.setAttribute("aria-pressed", mode === "plan" ? "true" : "false");
    dom.modeBuild.disabled = state.busy;
    dom.modePlan.disabled = state.busy;

    // 推理强度：服务端是唯一真相，这里只负责把 select 摆到当前值。
    // 注意“运行中禁用”——中途换强度会让同一个回合的不同步用不同参数，很混乱。
    if (dom.effortSelect) {
      const effort = String((snapshot.config && snapshot.config.reasoningEffort) || "default");
      dom.effortSelect.value = effort;
      dom.effortSelect.disabled = state.busy;
    }

    // 权限档位与工作区都在输入区工具栏里渲染；这里统一刷新一次，
    // 保证 SSE / 快照 / 本地切换三条路径最终长得一样。
    renderComposerBar();

    dom.configBtn.disabled = state.busy;
    dom.stopBtn.disabled = !state.busy || state.stopping;
    dom.stopBtn.textContent = state.stopping ? "中断中…" : "停止";
    dom.stopBtn.classList.toggle("is-stopping", state.stopping);

    dom.composerExtra.textContent =
      (isMock ? "mock" : "真实模型") +
      " · " +
      mode +
      " · " +
      PERMISSION_LABEL[currentPermissionLevel()];
  }

  // -------------------------------------------------------------------------
  // 2.1 输入区工具栏：工作区目录 / 三级权限 / 图片附件
  // -------------------------------------------------------------------------

  /** 三级权限的文案。key 与服务端 /api/permission 的 level 一一对应。 */
  const PERMISSION_LEVELS = ["ask", "accept-edits", "auto"];
  const PERMISSION_LABEL = { ask: "询问", "accept-edits": "自动改文件", auto: "全自动" };
  const PERMISSION_DESC = {
    ask: "每次写文件 / 执行命令都需要你确认",
    "accept-edits": "write/edit 自动放行，bash 等命令仍会询问",
    auto: "跳过所有权限询问（危险，仅适合本机演示）",
  };

  const MAX_IMAGES = 4;
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  // 只接受服务端能处理的图片类型：后端校验 dataUrl 必须是 png/jpeg/gif/webp 的 base64，
  // 前端提前拦掉 svg/bmp 之类，避免用户选完图、发出去才吃 400。
  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  const ALLOWED_IMAGE_LABEL = "PNG / JPEG / GIF / WebP";

  /**
   * 从快照里解析三级权限。
   *
   * 新后端直接给 permissionLevel；旧后端只有 yolo / acceptEdits 两个布尔，
   * 这里做一次降级映射，保证前后端不同步时页面也不炸。
   */
  function normalizePermissionLevel(snapshot) {
    const raw = snapshot && typeof snapshot === "object" ? snapshot.permissionLevel : null;
    if (PERMISSION_LEVELS.indexOf(raw) >= 0) return raw;
    return permissionLevelFromLegacy(snapshot);
  }

  /** 只用旧的 yolo / acceptEdits 两个布尔推三级权限（收到旧 SSE 事件时用）。 */
  function permissionLevelFromLegacy(snapshot) {
    if (snapshot && snapshot.yolo) return "auto";
    if (snapshot && snapshot.acceptEdits) return "accept-edits";
    return "ask";
  }

  function currentPermissionLevel() {
    if (PERMISSION_LEVELS.indexOf(state.permissionLevel) >= 0) return state.permissionLevel;
    return normalizePermissionLevel(state.snapshot);
  }

  /** 把快照上的权限状态同步到 state（并补上旧字段，供别处兼容读取）。 */
  function syncPermissionState() {
    const level = normalizePermissionLevel(state.snapshot);
    state.permissionLevel = level;
    if (state.snapshot) {
      state.snapshot.yolo = level === "auto";
      state.snapshot.acceptEdits = level === "accept-edits";
    }
    return level;
  }

  function workspacePath() {
    if (state.workspacePath) return state.workspacePath;
    const snapshot = state.snapshot || {};
    if (snapshot.workspace && snapshot.workspace.path) return String(snapshot.workspace.path);
    if (snapshot.cwd) return String(snapshot.cwd);
    return "";
  }

  function baseName(path) {
    const parts = String(path || "").split("/").filter((part) => part !== "");
    return parts.length ? parts[parts.length - 1] : String(path || "");
  }

  /** 渲染工作区按钮 + 权限 segmented + 附件按钮的文案与禁用态。 */
  function renderComposerBar() {
    if (!dom.workspaceBtn || !dom.workspaceLabel) return;
    const path = workspacePath();
    dom.workspaceLabel.textContent = path ? baseName(path) : "工作区";
    dom.workspaceLabel.title = path || "";
    dom.workspaceBtn.classList.toggle("is-root", !path);
    dom.workspaceBtn.title = path
      ? "工作区：" + path + "\n点击切换目录（Agent 只在这个文件夹内读写）"
      : "选择工作目录（Agent 只在这个文件夹内读写）";

    const level = syncPermissionState();
    for (const button of dom.permButtons) {
      const active = button.dataset.level === level;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    updateComposerBarDisabled();
  }

  /** 运行中 / 待审批 / 发送中时锁住工具栏，防止状态漂移。 */
  function updateComposerBarDisabled() {
    const lock = state.busy || state.pending.size > 0 || state.sending;
    if (dom.workspaceBtn) dom.workspaceBtn.disabled = lock;
    if (dom.attachBtn) {
      dom.attachBtn.disabled = lock || state.attachments.length >= MAX_IMAGES;
      dom.attachBtn.title =
        state.attachments.length >= MAX_IMAGES
          ? "最多 " + MAX_IMAGES + " 张图片，先移除一张再添加"
          : "上传图片：最多 " + MAX_IMAGES + " 张，每张 ≤ 4MB；也可以直接粘贴图片";
    }
    if (dom.imageInput) dom.imageInput.disabled = lock;
    for (const button of dom.permButtons) button.disabled = lock;
  }

  async function setPermissionLevel(level) {
    if (PERMISSION_LEVELS.indexOf(level) < 0) return;
    if (state.busy) {
      toast("运行中不能切换权限，等回合结束再试", "warn");
      return;
    }
    if (level === currentPermissionLevel()) return;
    for (const button of dom.permButtons) button.disabled = true;
    try {
      const payload = await apiPost("/api/permission", { level });
      const next = payload && PERMISSION_LEVELS.indexOf(payload.level) >= 0 ? payload.level : level;
      if (state.snapshot) state.snapshot.permissionLevel = next;
      state.permissionLevel = next;
      renderHeader();
      updateComposer();
      toast(
        "权限已切换为「" + PERMISSION_LABEL[next] + "」：" + PERMISSION_DESC[next],
        next === "auto" ? "warn" : "success",
      );
    } catch (err) {
      renderComposerBar();
      toast("切换权限失败：" + err.message, "error");
    }
  }

  // ---- 工作区选择模态框 ----

  const wsModal = { path: null, data: null, loading: false, els: null };

  function openWorkspaceModal() {
    if (state.busy) {
      toast("运行中不能切换工作区，等回合结束再试", "warn");
      return;
    }
    const crumbs = el("div", { className: "ws-crumbs" });
    const status = el("div", { className: "ws-status" });
    const list = el("div", { className: "ws-list" });
    const note = el("div", {
      className: "modal-note",
      text: "Agent 只在这个文件夹内读写（工具边界由服务端 cwd 保证）。切换后会以新目录为工作区新建会话，旧会话仍保留在原目录。",
    });
    const body = [crumbs, status, list, note];

    const parentBtn = el("button", { className: "btn", attrs: { type: "button" }, text: "上一级" });
    parentBtn.addEventListener("click", () => {
      if (wsModal.data && wsModal.data.parent) void loadWorkspaceDir(String(wsModal.data.parent));
    });
    const homeBtn = el("button", { className: "btn", attrs: { type: "button" }, text: "Home" });
    homeBtn.addEventListener("click", () => {
      if (wsModal.data && wsModal.data.home) void loadWorkspaceDir(String(wsModal.data.home));
    });
    const cancelBtn = el("button", { className: "btn", attrs: { type: "button" }, text: "取消" });
    cancelBtn.addEventListener("click", () => closeModal());
    const selectBtn = el("button", { className: "btn primary", attrs: { type: "button" }, text: "选择此文件夹" });
    selectBtn.addEventListener("click", () => void confirmWorkspace());

    wsModal.els = { crumbs, status, list, parentBtn, homeBtn, selectBtn };
    wsModal.data = null;
    wsModal.loading = true;
    wsModal.path = workspacePath() || null;
    openModal("workspace", null, "选择工作目录", body, [parentBtn, homeBtn, cancelBtn, selectBtn], true);
    renderWorkspaceModal();
    void loadWorkspaceDir(wsModal.path);
  }

  async function loadWorkspaceDir(path) {
    wsModal.loading = true;
    wsModal.path = path || null;
    if (modal.kind === "workspace") renderWorkspaceModal();
    try {
      const payload = await apiGet("/api/workspace" + (path ? "?path=" + encodeURIComponent(path) : ""));
      if (modal.kind !== "workspace") return;
      wsModal.data = payload && typeof payload === "object" ? payload : null;
      wsModal.path = wsModal.data && wsModal.data.path ? String(wsModal.data.path) : path || "";
      wsModal.loading = false;
      renderWorkspaceModal();
    } catch (err) {
      if (modal.kind !== "workspace") return;
      wsModal.loading = false;
      wsModal.data = null;
      renderWorkspaceModal();
      toast("读取目录失败：" + err.message, "error");
    }
  }

  function renderWorkspaceModal() {
    if (!wsModal.els || modal.kind !== "workspace") return;
    const { crumbs, status, list, parentBtn, homeBtn, selectBtn } = wsModal.els;
    const data = wsModal.data;
    const currentPath = wsModal.path || (data && data.path) || "";
    const loading = wsModal.loading;

    // 面包屑：/Users/one/Web → 每一段都能点回去
    crumbs.textContent = "";
    const rootBtn = el("button", { className: "ws-crumb", attrs: { type: "button" }, text: "/", title: "根目录" });
    rootBtn.addEventListener("click", () => void loadWorkspaceDir("/"));
    crumbs.appendChild(rootBtn);
    let accumulated = "";
    for (const segment of String(currentPath).split("/")) {
      if (!segment) continue;
      accumulated += "/" + segment;
      const target = accumulated;
      crumbs.appendChild(el("span", { className: "ws-crumb-sep", text: "/" }));
      const button = el("button", { className: "ws-crumb", attrs: { type: "button" }, text: segment, title: target });
      button.addEventListener("click", () => void loadWorkspaceDir(target));
      crumbs.appendChild(button);
    }

    // 当前路径 + 条目数
    status.textContent = "";
    status.appendChild(el("span", { className: "ws-status-label", text: "当前目录" }));
    status.appendChild(el("span", { className: "ws-status-path mono", text: currentPath || "（未选择）", title: currentPath }));

    // 目录列表
    list.textContent = "";
    if (loading) {
      list.appendChild(el("div", { className: "ws-empty", text: "正在读取目录…" }));
    } else if (!data) {
      list.appendChild(el("div", { className: "ws-empty", text: "目录读取失败，可以点「上一级」或「Home」重试" }));
    } else {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const dirs = entries.filter((entry) => entry && (entry.isDir === undefined || entry.isDir));
      if (!dirs.length) {
        list.appendChild(el("div", { className: "ws-empty", text: "这个目录下没有子文件夹，可以直接选择此文件夹" }));
      }
      for (const entry of dirs) {
        const entryPath = String(entry.path || "");
        const button = el("button", {
          className: "ws-entry",
          attrs: { type: "button", title: entryPath || String(entry.name || "") },
        });
        button.appendChild(el("span", { className: "ws-entry-icon", text: "📁" }));
        const label = el("span", { className: "ws-entry-name", text: String(entry.name || entryPath || "?") });
        button.appendChild(label);
        if (entryPath === currentPath) label.textContent = label.textContent + "（当前）";
        button.addEventListener("click", () => void loadWorkspaceDir(entryPath));
        list.appendChild(button);
      }
    }

    parentBtn.disabled = loading || !(data && data.parent);
    homeBtn.disabled = loading || !(data && data.home);
    // 已经在当前工作区时禁用「选择」：避免误点后白白新建一个会话。
    const isCurrentWorkspace = Boolean(currentPath) && currentPath === workspacePath();
    selectBtn.disabled = loading || !data || !currentPath || isCurrentWorkspace;
    selectBtn.textContent = isCurrentWorkspace ? "当前工作区" : "选择此文件夹";
    selectBtn.title = isCurrentWorkspace ? "这已经是当前工作区" : "把 Agent 的工作目录切换到 " + (currentPath || "该目录");
  }

  async function confirmWorkspace() {
    const path = wsModal.path || (wsModal.data && wsModal.data.path) || "";
    if (!path) return;
    const els = wsModal.els;
    if (els) {
      els.selectBtn.disabled = true;
      els.selectBtn.textContent = "切换中…";
    }
    try {
      const payload = await apiPost("/api/workspace", { path });
      closeModal();
      if (payload && payload.state) {
        adoptSnapshot(payload.state, { reseedEvents: true, resetLive: true, preserveStream: false });
      } else {
        await refreshState({ reseedEvents: true });
      }
      renderHeader();
      renderChatMeta();
      toast("工作区已切换到 " + path + "（Agent 只在这个文件夹内读写）", "success");
    } catch (err) {
      if (els) {
        els.selectBtn.disabled = false;
        els.selectBtn.textContent = "选择此文件夹";
      }
      toast("切换工作区失败：" + err.message, "error");
    }
  }

  // ---- 图片附件 ----

  function fmtBytes(size) {
    const value = Number(size) || 0;
    if (value < 1024) return value + " B";
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
    return (value / (1024 * 1024)).toFixed(1) + " MB";
  }

  function renderAttachments() {
    if (!dom.attachments) return;
    const items = state.attachments;
    dom.attachments.textContent = "";
    dom.attachments.hidden = items.length === 0;
    if (!items.length) {
      updateComposerBarDisabled();
      return;
    }
    for (const item of items) {
      const card = el("div", { className: "attachment" });
      const img = el("img", { className: "attachment-thumb", attrs: { alt: item.name, title: "点击查看大图" } });
      img.src = item.dataUrl;
      img.addEventListener("click", () => openImageInNewWindow(item));
      card.appendChild(img);
      const meta = el("div", { className: "attachment-meta" });
      meta.appendChild(el("span", { className: "attachment-name", text: item.name, title: item.name }));
      meta.appendChild(el("span", { className: "attachment-size mono", text: fmtBytes(item.size) }));
      card.appendChild(meta);
      const remove = el("button", {
        className: "attachment-remove",
        attrs: { type: "button", title: "移除这张图片", "aria-label": "移除图片 " + item.name },
        text: "✕",
      });
      remove.addEventListener("click", () => {
        state.attachments = state.attachments.filter((entry) => entry.id !== item.id);
        renderAttachments();
        updateComposer();
      });
      card.appendChild(remove);
      dom.attachments.appendChild(card);
    }
    dom.attachments.appendChild(
      el("div", { className: "attachments-count mono", text: String(items.length) + "/" + String(MAX_IMAGES) }),
    );
    updateComposerBarDisabled();
  }

  function clearAttachments() {
    state.attachments = [];
    renderAttachments();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("FileReader 读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function addImageFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (state.busy || state.sending) {
      toast("运行中不能添加附件", "warn");
      return;
    }
    for (const file of files) {
      if (!file.type || file.type.indexOf("image/") !== 0) {
        toast("「" + (file.name || "文件") + "」不是图片，已跳过", "warn");
        continue;
      }
      if (ALLOWED_IMAGE_TYPES.indexOf(String(file.type).toLowerCase()) < 0) {
        toast("「" + (file.name || "图片") + "」格式不支持，只支持 " + ALLOWED_IMAGE_LABEL, "warn");
        continue;
      }
      if (state.attachments.length >= MAX_IMAGES) {
        toast("最多 " + MAX_IMAGES + " 张图片，请先移除一张", "warn");
        break;
      }
      if (Number(file.size) > MAX_IMAGE_BYTES) {
        toast("「" + (file.name || "图片") + "」超过 4MB，已跳过", "warn");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        state.attachments.push({
          id: ++state.attachmentSeq,
          name: file.name || "image-" + Date.now() + ".png",
          size: Number(file.size) || 0,
          dataUrl,
        });
      } catch (err) {
        toast("读取图片失败：" + (err && err.message ? err.message : err), "error");
      }
    }
    renderAttachments();
    updateComposer();
  }

  /** textarea 粘贴图片：clipboardData 里找 kind=file 且 type=image/* 的项。 */
  function onInputPaste(event) {
    if (state.busy || state.sending) return;
    const clipboard = event.clipboardData || (typeof window !== "undefined" ? window.clipboardData : null);
    if (!clipboard) return;
    const files = [];
    if (clipboard.items) {
      for (const item of Array.from(clipboard.items)) {
        if (!item || item.kind !== "file") continue;
        if (!item.type || item.type.indexOf("image/") !== 0) continue;
        const file = item.getAsFile ? item.getAsFile() : null;
        if (file) files.push(file);
      }
    }
    if (!files.length && clipboard.files) {
      for (const file of Array.from(clipboard.files)) {
        if (file && file.type && file.type.indexOf("image/") === 0) files.push(file);
      }
    }
    if (!files.length) return;
    // 只有确认剪贴板里是图片时才拦截默认行为，避免把要粘贴的文字也吞掉。
    event.preventDefault();
    void addImageFiles(files);
  }

  /**
   * 用户消息的 content 可能是字符串，也可能是 ContentPart[]（多模态）；
   * 内部渲染时还会传 {text, images} 这种已归一化的对象。
   * 这里统一成 {text, images:[{name,dataUrl}]}，渲染/事件摘要都复用。
   */
  function normalizeUserContent(content) {
    if (typeof content === "string") return { text: content, images: [] };
    if (Array.isArray(content)) {
      const texts = [];
      const images = [];
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        if (part.type === "text" && typeof part.text === "string") {
          texts.push(part.text);
        } else if (part.type === "image_url" && part.image_url && typeof part.image_url.url === "string") {
          images.push({ name: "", dataUrl: part.image_url.url });
        }
      }
      return { text: texts.join("\n"), images };
    }
    if (content && typeof content === "object") {
      const text = typeof content.text === "string" ? content.text : "";
      const images = [];
      if (Array.isArray(content.images)) {
        for (const image of content.images) {
          if (!image) continue;
          if (typeof image === "string") images.push({ name: "", dataUrl: image });
          else if (typeof image.dataUrl === "string") images.push({ name: String(image.name || ""), dataUrl: image.dataUrl });
        }
      }
      return { text, images };
    }
    return { text: "", images: [] };
  }

  /** SSE user_message 的几种历史/新格式都兼容：{text,images} / {content}。 */
  function parseUserMessageEvent(data) {
    const source = data && typeof data === "object" ? data : {};
    let text = "";
    let images = [];
    if (Array.isArray(source.images)) {
      for (const image of source.images) {
        if (!image) continue;
        if (typeof image === "string") images.push({ name: "", dataUrl: image });
        else if (typeof image.dataUrl === "string") images.push({ name: String(image.name || ""), dataUrl: image.dataUrl });
      }
    }
    if (typeof source.text === "string") {
      text = source.text;
    } else if (source.content !== undefined) {
      const normalized = normalizeUserContent(source.content);
      text = normalized.text;
      if (!images.length) images = normalized.images;
    }
    return { text, images };
  }

  function contentSummaryText(content) {
    const normalized = normalizeUserContent(content);
    const text = oneLine(normalized.text, 120);
    if (normalized.images.length) {
      return (text ? text + " · " : "") + "附 " + normalized.images.length + " 张图片";
    }
    return text;
  }

  /** 在新窗口打开图片（dataURL 直接作为顶层地址会被浏览器拦，所以写进空白页）。 */
  function openImageInNewWindow(image) {
    const dataUrl = image && typeof image.dataUrl === "string" ? image.dataUrl : "";
    if (dataUrl.indexOf("data:image/") !== 0) return;
    const win = window.open("", "_blank");
    if (!win || !win.document) {
      toast("浏览器拦截了弹窗，可以右键图片另存查看", "warn");
      return;
    }
    win.document.title = String(image.name || "图片预览");
    win.document.body.style.margin = "0";
    win.document.body.style.background = "#111";
    win.document.body.style.display = "flex";
    win.document.body.style.alignItems = "center";
    win.document.body.style.justifyContent = "center";
    win.document.body.style.minHeight = "100vh";
    const img = win.document.createElement("img");
    img.src = dataUrl;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100vh";
    img.style.display = "block";
    win.document.body.appendChild(img);
  }

  function updateComposer() {
    const hasPending = state.pending.size > 0;
    const inputDisabled = state.busy || hasPending || state.sending;
    dom.input.disabled = inputDisabled;
    dom.sendBtn.disabled = inputDisabled || !isConnected();
    dom.sendBtn.textContent = state.sending ? "发送中…" : "发送";

    // 工具栏（工作区 / 权限 / 附件）跟随同样的锁：运行中、待审批、发送中都不能动，
    // 否则用户改了状态而服务端正在跑旧配置，两边会对不上。
    updateComposerBarDisabled();

    let note = "";
    let noteKind = "";
    if (hasPending) {
      note = "⚠ 有 " + state.pending.size + " 个权限审批等待处理，处理后才能继续发送。";
      noteKind = "warn";
    } else if (state.busy) {
      note = "Agent 正在运行… 可以点输入框右下角的「停止」中断；输入暂时禁用。";
      noteKind = "busy";
    } else if (state.snapshot && state.snapshot.mode === "plan") {
      note = "plan 模式是只读的：不会改文件、不会跑命令。要执行任务，请切到 build。";
      noteKind = "warn";
    } else if (!isConnected()) {
      note = "⇄ 事件流未连接，正在重连…（页面会自动重试）";
      noteKind = "warn";
    }
    dom.composerNote.textContent = note;
    dom.composerNote.className = "composer-note" + (noteKind ? " " + noteKind : "");

    const attachCount = state.attachments.length;
    dom.composerHint.textContent = state.busy
      ? "运行中禁止输入 · 可点「停止」中断"
      : "Enter 发送 · Shift+Enter 换行 · 可粘贴图片" + (attachCount ? " · 已附 " + attachCount + " 张" : "");

    if (state.snapshot) {
      dom.newSessionBtn.disabled = state.busy;
      dom.compactBtn.disabled = state.busy || !isConnected();
      dom.refreshBtn.disabled = false;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Toast
  // -------------------------------------------------------------------------

  function toast(message, kind, ttl) {
    const node = el("div", { className: "toast " + (kind || "info") });
    node.appendChild(el("span", { className: "toast-dot" }));
    node.appendChild(el("span", { className: "toast-text", text: message }));
    dom.toastRoot.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    const life = typeof ttl === "number" ? ttl : kind === "error" ? 6500 : 4200;
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 250);
    }, life);
    while (dom.toastRoot.children.length > 5) {
      const first = dom.toastRoot.firstElementChild;
      if (first) first.remove();
      else break;
    }
  }

  // -------------------------------------------------------------------------
  // 4. 会话侧栏 / 统计 / 待办
  // -------------------------------------------------------------------------

  function kvRow(label, value, mono) {
    const row = el("div", { className: "kv" });
    row.appendChild(el("span", { className: "kv-label", text: label }));
    row.appendChild(el("span", { className: "kv-value" + (mono ? " mono" : ""), text: value, title: value }));
    return row;
  }

  function renderCurrentSession() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const session = snapshot.session || {};
    dom.currentSession.textContent = "";
    dom.currentSession.appendChild(el("div", { className: "cs-title", text: session.title || "(空会话)", title: session.title || "" }));
    dom.currentSession.appendChild(kvRow("id", session.id || "—", true));
    dom.currentSession.appendChild(kvRow("创建", fmtClock(new Date(session.createdAt || Date.now()).getTime()), false));
    dom.currentSession.appendChild(kvRow("消息", String(state.stats.messageCount) + " 条", false));
    dom.currentSession.appendChild(kvRow("文件", String(session.file || "—"), true));
    const actions = el("div", { className: "cs-actions" });
    const exportJsonl = el("button", { className: "link-btn", text: "导出 JSONL", attrs: { type: "button" } });
    exportJsonl.addEventListener("click", () => downloadSessionExport(session.id, "jsonl"));
    const exportMd = el("button", { className: "link-btn", text: "导出 MD", attrs: { type: "button" } });
    exportMd.addEventListener("click", () => downloadSessionExport(session.id, "md"));
    actions.appendChild(exportJsonl);
    actions.appendChild(exportMd);
    dom.currentSession.appendChild(actions);
  }

  /** snapshot.sessions 里同时包含归档项；是否需要显示由 state.showArchived 决定。 */
  function allSessions() {
    return state.snapshot && Array.isArray(state.snapshot.sessions) ? state.snapshot.sessions : [];
  }

  function visibleSessions() {
    const all = allSessions();
    return state.showArchived ? all : all.filter((session) => !session.archived);
  }

  function archivedCount() {
    return allSessions().filter((session) => session.archived).length;
  }

  function renderArchiveToggle() {
    if (!dom.toggleArchived) return;
    const count = archivedCount();
    dom.toggleArchived.textContent = (state.showArchived ? "隐藏归档" : "归档") + " " + count;
    dom.toggleArchived.classList.toggle("active", state.showArchived);
    dom.toggleArchived.title = state.showArchived
      ? "隐藏已归档会话"
      : "显示已归档会话（共 " + count + " 个）";
  }

  function toggleArchived() {
    state.showArchived = !state.showArchived;
    renderSessionList();
    renderSessionsTab();
  }

  async function setSessionArchived(id, archived) {
    if (!id) return;
    try {
      await apiPost("/api/session/" + encodeURIComponent(String(id)) + (archived ? "/archive" : "/unarchive"), {});
      // 归档事件已经写进 JSONL，重新拉快照让列表和当前会话状态一致。
      await refreshState({ preserveStream: true });
      toast((archived ? "已归档：" : "已取消归档：") + id, archived ? "success" : "info");
    } catch (err) {
      toast("归档失败：" + err.message, "error");
    }
  }

  async function deleteSession(id, title) {
    if (!id) return;
    const label = title || id;
    // 删除不可撤销，必须二次确认；这里用原生 confirm，避免为一次确认再写一套弹窗。
    if (!window.confirm("确定永久删除会话“" + label + "”吗？\n\nJSONL 文件会被直接删掉，无法恢复。")) {
      return;
    }
    try {
      await apiDelete("/api/session/" + encodeURIComponent(String(id)));
      await refreshState({ preserveStream: true });
      toast("已删除会话：" + id, "success");
    } catch (err) {
      toast("删除失败：" + err.message, "error");
    }
  }

  function renderSessionList() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const sessions = visibleSessions();
    const currentId = snapshot.session ? snapshot.session.id : null;
    dom.sessionsCount.textContent = String(sessions.length);
    renderArchiveToggle();
    dom.sessionList.textContent = "";
    if (!sessions.length) {
      dom.sessionList.appendChild(
        el("div", {
          className: "empty-hint small",
          text: archivedCount() ? "没有未归档会话（点上面的“归档”可查看）" : "还没有历史会话",
        }),
      );
      return;
    }
    for (const session of sessions) {
      const active = session.id === currentId;
      const item = el(
        "div",
        { className: "session-item" + (active ? " active" : "") + (session.archived ? " archived" : "") },
      );
      const main = el("button", { className: "session-main", attrs: { type: "button" }, title: "载入会话 " + session.id });
      main.appendChild(el("span", { className: "session-title", text: session.title || "(空会话)" }));
      main.appendChild(
        el("span", {
          className: "session-meta",
          text:
            (active ? "当前 · " : "") +
            (session.archived ? "已归档 · " : "") +
            (session.messageCount || 0) +
            " 条 · " +
            fmtAgo(session.updatedAt),
        }),
      );
      main.addEventListener("click", () => loadSession(String(session.id)));
      item.appendChild(main);
      const downloads = el("div", { className: "session-dl" });
      const archive = el("button", {
        className: "link-btn",
        text: session.archived ? "恢复" : "归档",
        title: session.archived ? "取消归档，重新放进历史列表" : "从历史列表隐藏，文件保留",
        attrs: { type: "button" },
      });
      archive.addEventListener("click", () => setSessionArchived(session.id, !session.archived));
      const jsonl = el("button", { className: "link-btn", text: "导出 JSONL", title: "下载 JSONL 原始事件流", attrs: { type: "button" } });
      jsonl.addEventListener("click", () => downloadSessionExport(String(session.id), "jsonl"));
      const md = el("button", { className: "link-btn", text: "导出 MD", title: "下载 Markdown 阅读版", attrs: { type: "button" } });
      md.addEventListener("click", () => downloadSessionExport(String(session.id), "md"));
      downloads.appendChild(archive);
      downloads.appendChild(jsonl);
      downloads.appendChild(md);
      // 归档只是把会话从列表藏起来，文件还在；想彻底清掉必须走删除。
      // 所以归档项在“显示归档”下同样要有删除入口，否则用户只能先恢复再删。
      // 当前会话不能删：服务端会返回 409（内存里的 Session 还指着那个文件），
      // 那就不展示按钮，避免点了必然失败。
      if (!active) {
        const remove = el("button", {
          className: "link-btn danger",
          text: "删除",
          title: "永久删除会话文件（不可恢复）",
          attrs: { type: "button" },
        });
        remove.addEventListener("click", () => deleteSession(String(session.id), String(session.title || "")));
        downloads.appendChild(remove);
      }
      item.appendChild(downloads);
      dom.sessionList.appendChild(item);
    }
  }

  function applyTurnEndStats(end) {
    const usage = end.usage || {};
    state.stats.steps = Number(end.steps) || 0;
    state.stats.promptTokens = Number(usage.prompt_tokens) || 0;
    state.stats.completionTokens = Number(usage.completion_tokens) || 0;
    state.stats.durationMs = Number(end.durationMs) || 0;
    state.stats.aborted = Boolean(end.aborted);
    state.stats.hitStepLimit = Boolean(end.hitStepLimit);
    state.stats.toolDenials = Number(end.toolDenials) || 0;
  }

  /** 从 state.events（JSONL 历史）重新计算侧栏统计。 */
  function recomputeStatsFromSnapshot() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const events = Array.isArray(snapshot.events) ? snapshot.events : [];
    // 兜底值只在快照没带 config 时用；正常情况以后端下发的预算为准。
    state.stats.budget = Number((snapshot.config && snapshot.config.contextBudget) || 0) || 224_000;
    state.stats.messageCount = Array.isArray(snapshot.messages) ? snapshot.messages.length : 0;
    state.stats.toolCalls = 0;
    state.stats.step = 0;
    state.stats.contextTokens = 0;
    state.stats.historyMessages = 0;
    state.stats.promptTokens = 0;
    state.stats.completionTokens = 0;
    state.stats.durationMs = 0;
    state.stats.steps = 0;
    state.stats.aborted = false;
    state.stats.hitStepLimit = false;
    state.stats.toolDenials = 0;
    let lastTurnEnd = null;
    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const type = String(event.type || "");
      if (type === "step_start") {
        state.stats.step = Number(event.step) || 0;
        state.stats.contextTokens = Number(event.contextTokens) || 0;
        state.stats.historyMessages = Number(event.historyMessages) || 0;
        if (Number(event.budget)) state.stats.budget = Number(event.budget);
      } else if (type === "tool") {
        state.stats.toolCalls += 1;
      } else if (type === "turn_end") {
        lastTurnEnd = event;
      }
    }
    if (lastTurnEnd) applyTurnEndStats(lastTurnEnd);
    if (state.live.pendingTools) {
      // 实时运行中的工具也算进“本回合工具调用”
      state.stats.toolCalls += 0;
    }
  }

  function refreshLiveTrace(turnEl) {
    if (!turnEl || !turnEl.isConnected) return;
    const steps = turnEl.querySelectorAll(".step").length;
    const tools = turnEl.querySelectorAll(".tool-card").length;
    if (steps === 0) {
      const stale = turnEl.querySelector(".turn-trace");
      if (stale) stale.remove();
      return;
    }
    let bar = turnEl.querySelector(".turn-trace");
    if (!bar) {
      bar = el("button", { className: "turn-trace", attrs: { type: "button" } });
      bar.appendChild(el("span", { className: "turn-trace-icon", text: "⚙" }));
      const label = el("span", { className: "turn-trace-text" });
      const hint = el("span", { className: "turn-trace-hint", text: "展开" });
      bar.appendChild(label);
      bar.appendChild(hint);
      bar.addEventListener("click", () => {
        turnEl.classList.toggle("show-steps");
        refreshLiveTrace(turnEl);
      });
      // 插在过程容器之前，折叠后按钮不会掉到答案下面
      const process = turnEl.querySelector(".turn-process");
      if (process) turnEl.insertBefore(bar, process);
      else turnEl.appendChild(bar);
    }
    const open = turnEl.classList.contains("show-steps");
    const label = bar.querySelector(".turn-trace-text");
    const hint = bar.querySelector(".turn-trace-hint");
    if (label) label.textContent = "执行过程 · " + steps + " 步" + (tools > 0 ? " · " + tools + " 个工具" : "");
    if (hint) hint.textContent = open ? "收起" : "展开";
    bar.classList.toggle("open", open);
    bar.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderStats() {
    renderChatStatus();
    if (state.live.turnEl) refreshLiveTrace(state.live.turnEl);
    if (!dom.stats) return;
    const stats = state.stats;
    dom.stats.textContent = "";
    const budget = stats.budget || 1;
    const percent = Math.max(0, Math.min(100, Math.round((stats.contextTokens / budget) * 100)));
    const level = percent >= 85 ? "danger" : percent >= 60 ? "warn" : "ok";

    const head = el("div", { className: "stat-head" });
    head.appendChild(el("span", { className: "stat-label", text: "上下文" }));
    head.appendChild(el("span", { className: "stat-value mono", text: fmtInt(stats.contextTokens) + " / " + fmtInt(stats.budget) + " tokens" }));
    dom.stats.appendChild(head);
    const bar = el("div", { className: "bar " + level });
    const fill = el("i");
    fill.style.width = percent + "%";
    bar.appendChild(fill);
    dom.stats.appendChild(bar);
    dom.stats.appendChild(el("div", { className: "stat-sub mono", text: percent + "% · 历史 " + stats.historyMessages + " 条 · 第 " + (stats.step || 0) + " 步" }));

    const grid = el("div", { className: "stat-grid" });
    grid.appendChild(statCell("步数", String(stats.steps || stats.step || 0)));
    grid.appendChild(statCell("工具调用", String(stats.toolCalls)));
    grid.appendChild(statCell("prompt", fmtInt(stats.promptTokens)));
    grid.appendChild(statCell("completion", fmtInt(stats.completionTokens)));
    grid.appendChild(statCell("耗时", fmtDuration(stats.durationMs)));
    grid.appendChild(statCell("消息", String(stats.messageCount)));
    dom.stats.appendChild(grid);

    const flags = [];
    if (stats.aborted) flags.push("已中断");
    if (stats.hitStepLimit) flags.push("达到步数上限");
    if (stats.toolDenials) flags.push("拒绝 " + stats.toolDenials + " 次");
    if (flags.length) dom.stats.appendChild(el("div", { className: "stat-flags", text: flags.join(" · ") }));
  }

  function statCell(label, value) {
    const cell = el("div", { className: "stat-cell" });
    cell.appendChild(el("span", { className: "stat-cell-label", text: label }));
    cell.appendChild(el("span", { className: "stat-cell-value mono", text: value }));
    return cell;
  }

  const TODO_MARK = { completed: "✓", in_progress: "◐", pending: "○" };

  function renderTodos() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const todos = Array.isArray(snapshot.todos) ? snapshot.todos : [];
    const active = todos.filter((todo) => todo.status !== "completed");
    const completed = todos.length - active.length;
    dom.todosCount.textContent = String(active.length);
    dom.todos.textContent = "";
    if (active.length === 0) {
      dom.todos.appendChild(
        el("div", {
          className: "empty-hint small",
          text: completed > 0 ? "已完成 " + completed + " 项；发新消息会清空" : "暂无待办（Agent 用 todowrite 维护）",
        }),
      );
      return;
    }
    for (const todo of active) {
      const status = TODO_MARK[todo.status] ? todo.status : "pending";
      const row = el("div", { className: "todo " + status });
      row.appendChild(el("span", { className: "todo-mark", text: TODO_MARK[status] }));
      row.appendChild(el("span", { className: "todo-text", text: String(todo.content || "") }));
      dom.todos.appendChild(row);
    }
  }

  // ---- DSH 风格底部统计：会话 / token / 上下文 ----

  /** 把 eventLog 里的原始事件统一成 payload（兼容 SSE 包装和会话 JSONL 原始事件）。 */
  function eventPayload(entry) {
    const raw = entry && entry.data ? entry.data : {};
    return raw && typeof raw === "object" && raw.data && typeof raw.data === "object" ? raw.data : raw;
  }

  function collectSessionStats() {
    let turns = 0;
    let steps = 0;
    let prompt = 0;
    let completion = 0;
    let cacheHit = 0;
    let cacheMiss = 0;
    let toolMs = 0;
    let totalMs = 0;
    for (const entry of state.eventLog) {
      const payload = eventPayload(entry);
      if (!payload || typeof payload !== "object") continue;
      if (entry.type === "turn_end") {
        turns += 1;
        steps += Number(payload.steps) || 0;
        totalMs += Number(payload.durationMs) || 0;
        const usage = payload.usage && typeof payload.usage === "object" ? payload.usage : {};
        prompt += Number(usage.prompt_tokens) || 0;
        completion += Number(usage.completion_tokens) || 0;
        cacheHit += Number(usage.prompt_cache_hit_tokens) || 0;
        cacheMiss += Number(usage.prompt_cache_miss_tokens) || 0;
      } else if (entry.type === "tool" || entry.type === "tool_end") {
        toolMs += Number(payload.durationMs) || 0;
      }
    }
    const modelMs = Math.max(0, totalMs - toolMs);
    const cacheTotal = cacheHit + cacheMiss;
    return {
      turns,
      steps,
      prompt,
      completion,
      cacheHit,
      cacheMiss,
      cacheRate: cacheTotal > 0 ? (cacheHit / cacheTotal) * 100 : null,
      totalMs,
      toolMs,
      modelMs,
      tps: modelMs > 0 ? completion / (modelMs / 1000) : null,
      ttftMs: state.telemetry.lastTtftMs,
    };
  }

  function contextUsageNow() {
    const snapshot = state.snapshot || {};
    const usage = snapshot.contextUsage && typeof snapshot.contextUsage === "object" ? snapshot.contextUsage : null;
    const live = state.telemetry.liveContext;
    if (usage) {
      const budget = Number(usage.budget) || state.stats.budget || 1;
      let total = Number(usage.total) || 0;
      if (live && Number(live.tokens) > 0) {
        // 运行中：用最新的 context trace 覆盖总占用，消息部分按差值估算
        total = Math.max(total, Number(live.tokens) || 0);
      }
      const percent = Math.max(0, Math.min(100, Math.round((total / budget) * 100)));
      return {
        system: Number(usage.system) || 0,
        tools: Number(usage.tools) || 0,
        messages: Math.max(0, total - (Number(usage.system) || 0) - (Number(usage.tools) || 0)),
        total,
        budget,
        percent,
      };
    }
    const budget = state.stats.budget || 1;
    const total = state.stats.contextTokens || 0;
    return {
      system: 0,
      tools: 0,
      messages: total,
      total,
      budget,
      percent: Math.max(0, Math.min(100, Math.round((total / budget) * 100))),
    };
  }

  function fmtSpeed(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return value >= 100 ? Math.round(value) + " tok/s" : value.toFixed(1) + " tok/s";
  }

  function renderChatStatus() {
    if (!dom.statusSession) return;
    const stats = collectSessionStats();
    const ctx = contextUsageNow();
    dom.statusSession.textContent = stats.turns + " 轮 · " + stats.steps + " 步 · " + fmtSpeed(stats.tps);
    dom.statusSession.title = "会话统计：轮数 / 步数 / 输出速度（点开看明细）";
    const tokenTotal = stats.prompt + stats.completion;
    dom.statusTokens.textContent =
      fmtInt(tokenTotal) + " tokens" +
      (stats.cacheRate === null ? " · 缓存 —" : " · 缓存 " + stats.cacheRate.toFixed(0) + "%");
    dom.statusTokens.title = "Token 用量：输入 / 输出 / 缓存命中（点开看明细）";
    dom.statusContext.textContent = "上下文 " + ctx.percent + "%";
    dom.statusContext.title = "上下文已用 " + fmtInt(ctx.total) + " / " + fmtInt(ctx.budget) + " tokens（点开看分项）";
  }

  function statsSection(title, rows) {
    const wrap = el("div", { className: "stats-section" });
    wrap.appendChild(el("div", { className: "stats-section-title", text: title }));
    for (const row of rows) {
      const line = el("div", { className: "stats-row" });
      line.appendChild(el("span", { className: "stats-row-label", text: row[0] }));
      line.appendChild(el("span", { className: "stats-row-value mono", text: row[1] }));
      wrap.appendChild(line);
    }
    return wrap;
  }

  function openStatsModal(kind) {
    const stats = collectSessionStats();
    const ctx = contextUsageNow();
    const body = [];
    if (kind === "context") {
      const head = el("div", { className: "stats-context-head" });
      head.appendChild(el("span", { className: "stats-context-percent", text: "上下文已用 " + ctx.percent + "%" }));
      head.appendChild(
        el("span", {
          className: "stats-context-size mono",
          text: "~" + fmtInt(ctx.total) + " / " + fmtInt(ctx.budget),
        }),
      );
      body.push(head);
      const bar = el("div", { className: "bar " + (ctx.percent >= 85 ? "danger" : ctx.percent >= 60 ? "warn" : "ok") });
      const fill = el("i");
      fill.style.width = ctx.percent + "%";
      bar.appendChild(fill);
      body.push(bar);
      body.push(
        statsSection("分项", [
          ["系统提示词", "~" + fmtInt(ctx.system)],
          ["工具定义", "~" + fmtInt(ctx.tools)],
          ["对话消息", "~" + fmtInt(ctx.messages)],
        ]),
      );
      body.push(el("div", { className: "modal-note", text: "估算值：系统提示词 + 工具定义 + 对话历史。工具定义目前不计入 loop 的预算，所以总量可能略高于预算百分比口径。" }));
    } else if (kind === "tokens") {
      body.push(
        statsSection("Token 用量", [
          ["总用量", fmtInt(stats.prompt + stats.completion) + " tok"],
          ["输入（prompt）", fmtInt(stats.prompt) + " tok"],
          ["输出（completion）", fmtInt(stats.completion) + " tok"],
          ["缓存命中", stats.cacheRate === null ? "—（接口未返回）" : stats.cacheRate.toFixed(1) + "%"],
          ["缓存命中 / 未命中", fmtInt(stats.cacheHit) + " / " + fmtInt(stats.cacheMiss)],
        ]),
      );
      body.push(el("div", { className: "modal-note", text: "缓存数据来自 provider 返回的 usage；mock 模型不返回缓存字段。" }));
    } else {
      body.push(
        statsSection("会话统计", [
          ["轮数", String(stats.turns) + " 轮"],
          ["步数", String(stats.steps) + " 步"],
          ["模型用时", fmtDuration(stats.modelMs)],
          ["工具调用用时", fmtDuration(stats.toolMs)],
          ["首 token 平均（TTFT）", stats.ttftMs === null ? "—（仅实时回合）" : fmtDuration(stats.ttftMs)],
          ["输出速度（TPS）", fmtSpeed(stats.tps)],
        ]),
      );
    }
    const close = el("button", { className: "btn", attrs: { type: "button" }, text: "关闭" });
    close.addEventListener("click", () => closeModal());
    openModal("stats", kind, kind === "context" ? "上下文用量" : kind === "tokens" ? "Token 用量" : "会话统计", body, [close], true);
  }

  function renderChatMeta() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const turns = dom.chatLog.querySelectorAll(".turn").length;
    const messages = state.stats.messageCount;
    const events = state.eventLog.length;
    const sessionId = snapshot.session ? snapshot.session.id : "—";
    const prefix = state.busy ? "● 运行中 · " : "";
    const path = workspacePath();
    const workspaceLabel = path ? " · 📁 " + baseName(path) : "";
    dom.chatMeta.textContent =
      prefix + turns + " 回合 · " + messages + " 条消息 · " + events + " 条事件 · 会话 " + sessionId + workspaceLabel;
  }

  // -------------------------------------------------------------------------
  // 5. 对话渲染：历史回合（从 state.events 重建）
  // -------------------------------------------------------------------------

  /**
   * 把服务端 JSONL 事件（state.events）转换成“回合”模型。
   *
   * 事件顺序（agent/loop.ts 与 session.ts 决定）：
   *   message(user)
   *   step_start
   *   message(assistant) ←──┐ 成对出现，assistant_message trace 是给机器看的版本
   *   assistant_message   ──┘
   *   message(tool)       ←──┐ 成对出现
   *   tool                ──┘
   *   turn_end
   *
   * tool 事件本身不带 output（只有 name/arguments/isError/durationMs），
   * output 在前一条 message(role=tool) 里，所以这里用队列配对。
   */
  function buildTurns(rawEvents) {
    const turns = [];
    let turn = null;
    let step = null;
    const toolMessageQueue = [];
    const assistantMessageQueue = [];

    function ensureTurn() {
      if (!turn) {
        turn = { user: null, steps: [], notices: [], end: null, error: null };
        turns.push(turn);
      }
      return turn;
    }

    function ensureStep() {
      ensureTurn();
      if (!step) {
        step = { step: null, contextTokens: null, budget: null, historyMessages: null, tools: [], items: [] };
        turn.steps.push(step);
      }
      return step;
    }

    function flushUnclaimedAssistant() {
      while (assistantMessageQueue.length) {
        const message = assistantMessageQueue.shift();
        const content = typeof message.content === "string" ? message.content : "";
        if (!content.trim()) continue;
        const target = step ? step.items : ensureTurn().notices;
        target.push({ kind: "text", content });
      }
    }

    for (const raw of rawEvents) {
      if (!raw || typeof raw !== "object") continue;
      const type = String(raw.type || "");

      if (type === "message") {
        const message = raw.message || {};
        const role = String(message.role || "");
        if (role === "user") {
          flushUnclaimedAssistant();
          // 多模态消息的 content 是 ContentPart[]；统一成 {text, images} 再渲染。
          turn = {
            user: normalizeUserContent(message.content),
            steps: [],
            notices: [],
            end: null,
            error: null,
          };
          turns.push(turn);
          step = null;
        } else if (role === "assistant") {
          assistantMessageQueue.push(message);
        } else if (role === "tool") {
          toolMessageQueue.push(message);
        }
        continue;
      }

      if (type === "assistant_message") {
        const target = ensureStep();
        assistantMessageQueue.shift();
        const content = typeof raw.content === "string" ? raw.content : "";
        if (content.trim()) target.items.push({ kind: "text", content });
        continue;
      }

      if (type === "step_start") {
        ensureTurn();
        step = {
          step: Number(raw.step) || null,
          contextTokens: Number(raw.contextTokens) || 0,
          budget: Number(raw.budget) || null,
          historyMessages: Number(raw.historyMessages) || 0,
          tools: Array.isArray(raw.tools) ? raw.tools.map((item) => String(item)) : [],
          items: [],
        };
        turn.steps.push(step);
        continue;
      }

      if (type === "tool") {
        const target = ensureStep();
        const toolMessage = toolMessageQueue.shift();
        target.items.push({
          kind: "tool",
          name: String(raw.name || (toolMessage && toolMessage.name) || "?"),
          arguments: typeof raw.arguments === "string" ? raw.arguments : "",
          argsPreview: "",
          output: toolMessage && typeof toolMessage.content === "string" ? toolMessage.content : "",
          isError: Boolean(raw.isError),
          interrupted: Boolean(raw.interrupted),
          durationMs: Number(raw.durationMs) || 0,
          running: false,
          live: false,
        });
        continue;
      }

      if (type === "context") {
        ensureTurn();
        const target = step ? step.items : turn.notices;
        target.push({
          kind: "notice",
          tone: "context",
          text:
            "上下文裁剪：移除 " + (Number(raw.removed) || 0) + " 条最早消息，" +
            "截断 " + (Number(raw.truncatedToolOutputs) || 0) + " 条过长工具输出 · " +
            "现在约 " + fmtInt(raw.tokens) + " / " + fmtInt(raw.budget) + " tokens",
        });
        continue;
      }

      if (type === "compaction") {
        ensureTurn();
        const target = step ? step.items : turn.notices;
        target.push({
          kind: "notice",
          tone: "compaction",
          text: "上下文压缩：约 " + fmtInt(raw.before) + " → " + fmtInt(raw.after) + " tokens",
          detail: typeof raw.summary === "string" ? raw.summary : "",
        });
        continue;
      }

      if (type === "error") {
        ensureTurn().error = String(raw.message || "未知错误");
        continue;
      }

      if (type === "turn_end") {
        ensureTurn().end = raw;
        flushUnclaimedAssistant();
        continue;
      }

      // meta / snapshot 等：回放时不需要展示
    }

    flushUnclaimedAssistant();
    return turns;
  }

  function renderTurns(turns) {
    const fragment = document.createDocumentFragment();
    for (const turn of turns) {
      fragment.appendChild(renderTurn(turn));
    }
    return fragment;
  }

  /**
   * 回合 DOM 的分层（对齐 Codex / Claude Code / DSH 的信息层级）：
   *
   *   .turn
   *   ├── 用户气泡
   *   ├── .turn-trace      ← 折叠状态条：执行过程 · 30 步 · 29 个工具 · 1m30s
   *   ├── .turn-process    ← 过程（步骤 + 工具卡片），折叠时整块 display:none
   *   ├── .turn-answer     ← 最终回答，永远可见
   *   ├── .notice / 错误 / 权限审批卡（永远可见）
   *   └── .turn-end        ← 回合统计
   *
   * 为什么要专门分出 .turn-answer？
   * 以前回答文字是塞在“最后一个 step 的 step-items 里”的，
   * 结果“折叠过程”和“保留答案”变成了同一件事，只能靠
   * “这一步里还有没有 .msg”这种判断去猜，折叠逻辑必然和 DOM 结构打架。
   * 现在把最后一句话提到回合级别，过程容器就可以无条件整块隐藏——
   * 不管里面有几个 step、每个 step 占多少 padding，折叠后一律零占位。
   */
  function renderTurn(turn) {
    const root = el("div", { className: "turn" });
    if (turn.user) root.appendChild(createUserBubble(turn.user));
    appendTraceToggle(root, turn);

    // 注意顺序：必须先把答案从 step.items 里摘走，再构建过程 DOM。
    // 反过来写的话，createStepEl 已经把那条文字渲染进 DOM 了，
    // 后面再 splice 只是改了数据，节点还留在页面上 —— 答案会出现两遍。
    const answer = el("div", { className: "turn-answer" });
    const finalText = takeFinalAnswerText(turn);
    if (finalText) answer.appendChild(createAgentText(finalText));

    const process = el("div", { className: "turn-process" });
    for (const step of turn.steps) process.appendChild(createStepEl(step).root);
    root.appendChild(process);
    root.appendChild(answer);

    for (const notice of turn.notices) root.appendChild(createNoticeEl(notice));
    if (turn.error) root.appendChild(createErrorEl(turn.error));
    if (turn.end) root.appendChild(createTurnEndEl(turn.end));
    return root;
  }

  /**
   * 从回合里“摘走”最后一段 Agent 文字，作为始终可见的答案。
   *
   * 为什么是最后一段？事件顺序是 工具 → 工具 → … → 最终回答，
   * 所以回合里最后一个 text item 就是最终回答；它前面的那些
   * “我先看看文件”属于过程，展开时才看。
   * 摘走而不是复制：否则展开时答案会出现两遍。
   */
  function takeFinalAnswerText(turn) {
    const steps = Array.isArray(turn.steps) ? turn.steps : [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const items = steps[i].items || [];
      for (let j = items.length - 1; j >= 0; j--) {
        if (items[j] && items[j].kind === "text") {
          const content = items[j].content;
          items.splice(j, 1);
          return content;
        }
      }
    }
    return "";
  }

  /** 用户消息气泡：文字 + 图片缩略图（content 可能是字符串或 ContentPart[]）。 */
  function createUserBubble(content) {
    const normalized = normalizeUserContent(content);
    const wrap = el("div", { className: "msg user" });
    wrap.appendChild(el("div", { className: "msg-role", text: "用户" }));
    if (normalized.text.trim()) wrap.appendChild(el("div", { className: "msg-text", text: normalized.text }));
    if (normalized.images.length) wrap.appendChild(createMessageThumbs(normalized.images));
    if (!normalized.text.trim() && !normalized.images.length) {
      wrap.appendChild(el("div", { className: "msg-text", text: "（空消息）" }));
    }
    return wrap;
  }

  function createMessageThumbs(images) {
    const grid = el("div", { className: "msg-thumbs" });
    for (const image of images) {
      const dataUrl = image && typeof image.dataUrl === "string" ? image.dataUrl : "";
      if (dataUrl.indexOf("data:image/") !== 0) continue;
      const img = el("img", { className: "msg-thumb", attrs: { alt: image.name || "图片", title: "点击查看大图" } });
      img.src = dataUrl;
      img.addEventListener("click", () => openImageInNewWindow(image));
      grid.appendChild(img);
    }
    return grid;
  }

  // -------------------------------------------------------------------------
  // 5.1 极简 Markdown 渲染（模型输出天然是 Markdown，不能当纯文本显示）
  // -------------------------------------------------------------------------
  //
  // 为什么需要它？
  // 模型输出天然是 Markdown：`**加粗**`、反引号包的行内代码、``` 代码块、`- ` 列表、
  // `##` 标题。以前我们把它当纯文本塞进 textContent，用户看到的就是一堆
  // 裸露的星号和反引号 —— 不是“丑”，是**格式没被渲染**。
  //
  // 为什么不用 marked / markdown-it？
  //   1. 项目规矩：零运行时依赖，前端纯原生、无 CDN、无构建。
  //   2. 安全：第三方渲染器默认允许 HTML，我们不想为了一段说明文引入 XSS 面。
  //   3. 需求其实很小：对话里的 Markdown 就那几种块级/行内语法。
  //
  // 安全铁律（和文件头注释一致）：**全程 createElement + textContent，绝不 innerHTML**。
  // 这样即使模型输出 `<img src=x onerror=alert(1)>`，也只会被当成字面文字显示出来。
  // 链接额外做协议白名单，防止 `[点我](javascript:...)`。

  /** 行内语法：`code`、**粗体**、*斜体*、~~删除线~~、[文字](链接)。 */
  const MD_INLINE = [
    // 行内代码优先：它里面的星号不该被当成加粗
    { re: /`([^`\n]+)`/g, build: (text) => el("code", { className: "md-code", text }) },
    { re: /\*\*([^\n]+?)\*\*/g, build: (text) => el("strong", { text }) },
    // 斜体故意不用后行断言（lookbehind，Safari 16.4 才支持）：
    // `**粗**` 里的 `*` 后面紧跟 `*`，这条正则天然匹配不上，
    // 而加粗那条会在更靠前的下标命中，靠“谁先出现谁先切”就能保证优先级。
    // 开标记后面必须紧跟非空白（CommonMark 的 left-flanking 规则）：
    // 否则 `2 * 3 * 4` 这种乘法会被误认成斜体，把数字吃掉。
    { re: /\*([^\s*][^*\n]*?)\*/g, build: (text) => el("em", { text }) },
    { re: /~~([^\n]+?)~~/g, build: (text) => el("del", { text }) },
  ];

  /** 只允许这几种协议，其余（javascript: / data: 等）原样当文字显示。 */
  const SAFE_LINK = /^(https?:|mailto:)/i;

  /**
   * 把一行文字里的行内标记拆成 DOM 节点，追加到 parent。
   *
   * 实现思路是“谁先出现谁先切”：每次在所有模式里找最早的匹配，
   * 前面的普通文字直接落成 textNode（天然转义），命中的那一段建成元素，
   * 然后从匹配之后继续。这样不需要完整语法树，也绝不会拼字符串 HTML。
   */
  function appendInline(parent, text) {
    let rest = String(text || "");
    // 兜底防死循环：万一某个正则零宽匹配，跑满 200 段就整体当文字收掉
    for (let guard = 0; guard < 200 && rest; guard++) {
      let best = null;
      for (const rule of MD_INLINE) {
        rule.re.lastIndex = 0;
        const match = rule.re.exec(rest);
        if (match && (!best || match.index < best.match.index)) {
          best = { rule, match };
        }
      }
      // 链接单独处理：它要读 capture 组里的 href，不能走统一的 build(text)
      const linkMatch = /\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
      if (linkMatch && (!best || linkMatch.index < best.match.index)) {
        best = { rule: { build: null }, match: linkMatch, link: true };
      }

      if (!best) {
        parent.appendChild(document.createTextNode(rest));
        return;
      }

      const { match } = best;
      if (match.index > 0) {
        parent.appendChild(document.createTextNode(rest.slice(0, match.index)));
      }
      if (best.link) {
        const label = match[1];
        const href = match[2];
        if (SAFE_LINK.test(href)) {
          const a = el("a", { className: "md-link", text: label, attrs: { href, target: "_blank", rel: "noopener noreferrer" } });
          parent.appendChild(a);
        } else {
          // 不安全的链接：保留可读文字，但不给 href，点了不会执行脚本
          parent.appendChild(document.createTextNode(label));
        }
      } else {
        parent.appendChild(best.rule.build(match[1]));
      }
      rest = rest.slice(match.index + match[0].length);
    }
  }

  /** 表格分隔行：`| --- | :--: |` 这种（至少一列，允许省略两端的竖线）。 */
  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
  }

  /** 拆一行表格：去掉首尾竖线和每格两端空白。 */
  function splitTableRow(line) {
    let text = line.trim();
    if (text.startsWith("|")) text = text.slice(1);
    if (text.endsWith("|")) text = text.slice(0, -1);
    return text.split("|").map((cell) => cell.trim());
  }

  /** 一整行没有块级语义的文字（标题内容、列表项内容、段落）。 */
  function inlineNodes(text) {
    const holder = document.createDocumentFragment();
    appendInline(holder, text);
    return holder;
  }

  /**
   * 渲染 Markdown 文本到 container。
   *
   * 支持的块级语法（够用就好，故意不支持 HTML / 表格 / 脚注）：
   *   ```代码块```、# 标题、- * + 无序列表、1. 有序列表、> 引用、--- 分割线、普通段落
   */
  function renderMarkdown(container, source) {
    const text = String(source || "").replace(/\r\n?/g, "\n");
    const lines = text.split("\n");
    container.textContent = "";
    container.classList.add("md");

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // 1) 代码块：``` 开头到下一行 ``` 结束（末尾没闭合也照样渲染，流式时常见）
      const fence = /^\s*```(.*)$/.exec(line);
      if (fence) {
        const lang = fence[1].trim();
        i++;
        const body = [];
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          body.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // 跳过收尾的 ```
        const pre = el("pre", { className: "md-pre" });
        const code = el("code", { text: body.join("\n") });
        if (lang) code.className = "language-" + lang;
        pre.appendChild(code);
        container.appendChild(pre);
        continue;
      }

      // 2) 空行：只当段落分隔，不产生元素（否则会有一堆空 div 撑高度）
      if (!line.trim()) {
        i++;
        continue;
      }

      // 3) 分割线
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
        container.appendChild(el("hr", { className: "md-hr" }));
        i++;
        continue;
      }

      // 4) 标题
      const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const level = Math.min(heading[1].length + 2, 6); // # → h3：别盖过页面自己的层级
        const node = el("h" + level, { className: "md-h" });
        node.appendChild(inlineNodes(heading[2]));
        container.appendChild(node);
        i++;
        continue;
      }

      // 5) 引用：连续的 > 行合成一个 blockquote
      if (/^\s*>\s?/.test(line)) {
        const quote = el("blockquote", { className: "md-quote" });
        const body = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          body.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        quote.appendChild(inlineNodes(body.join("\n")));
        // 保留引用内部的换行
        quote.style.whiteSpace = "pre-wrap";
        container.appendChild(quote);
        continue;
      }

      // 6) 表格：必须“表头行 + 分隔行”成对出现，否则按普通段落处理
      //    （模型输出表格很常见，不渲染的话用户看到的就是一排竖线）
      if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const table = el("table", { className: "md-table" });
        const thead = el("thead");
        const headRow = el("tr");
        for (const cell of splitTableRow(line)) {
          const th = el("th");
          th.appendChild(inlineNodes(cell));
          headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
        i += 2; // 跳过表头行和分隔行
        const tbody = el("tbody");
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          const row = el("tr");
          for (const cell of splitTableRow(lines[i])) {
            const td = el("td");
            td.appendChild(inlineNodes(cell));
            row.appendChild(td);
          }
          tbody.appendChild(row);
          i++;
        }
        table.appendChild(tbody);
        container.appendChild(table);
        continue;
      }

      // 7) 列表：连续的同类条目合成一个 ol/ul，按缩进嵌套
      const bullet = /^(\s*)[-*+]\s+(.*)$/;
      const ordered = /^(\s*)(\d+)[.)]\s+(.*)$/;
      if (bullet.test(line) || ordered.test(line)) {
        const isOrdered = ordered.test(line);
        const tag = isOrdered ? "ol" : "ul";
        const list = el(tag, { className: "md-list" });
        container.appendChild(list);
        // 栈里保存“当前层级”：缩进变深就往下钻一层，变浅就弹回去。
        // 只支持“父项 → 子列表”这一级一级的嵌套（模型实际也只会这么写）。
        const stack = [{ indent: null, list }];
        while (i < lines.length) {
          const m = isOrdered ? ordered.exec(lines[i]) : bullet.exec(lines[i]);
          if (!m) break;
          const indent = m[1].length;
          const content = isOrdered ? m[3] : m[2];
          let top = stack[stack.length - 1];
          if (top.indent === null) top.indent = indent;
          while (stack.length > 1 && indent < top.indent) {
            stack.pop();
            top = stack[stack.length - 1];
          }
          if (indent > top.indent) {
            const parentLi = top.list.lastElementChild;
            if (parentLi) {
              const nested = el(tag, { className: "md-list md-list-nested" });
              parentLi.appendChild(nested);
              stack.push({ indent, list: nested });
              top = stack[stack.length - 1];
            }
            // 没有父项可挂（比如第一行就缩进）就当同级处理，不至于丢内容
          }
          const item = el("li", { className: "md-li" });
          item.appendChild(inlineNodes(content));
          top.list.appendChild(item);
          i++;
        }
        // 列表已经挂进 container 了，这里只需 continue
        continue;
      }

      // 8) 普通段落：连续非空、非块级起始的行合成一段
      const para = [];
      while (i < lines.length) {
        const current = lines[i];
        if (!current.trim()) break;
        if (/^\s*```/.test(current)) break;
        if (/^\s*#{1,6}\s+/.test(current)) break;
        if (/^\s*>\s?/.test(current)) break;
        if (bullet.test(current) || ordered.test(current)) break;
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(current)) break;
        if (current.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;
        para.push(current);
        i++;
      }
      // 段落内部原本允许多行，按软换行合成一段（Markdown 的常规行为）
      const p = el("p", { className: "md-p" });
      p.appendChild(inlineNodes(para.join(" ")));
      container.appendChild(p);
    }
  }

  /** 把元素内容替换成渲染后的 Markdown（流式增量也走这里）。 */
  function setMarkdown(target, text) {
    if (!target) return;
    renderMarkdown(target, text);
  }

  function createAgentText(content) {
    const wrap = el("div", { className: "msg agent" });
    wrap.appendChild(el("div", { className: "msg-role", text: "Agent" }));
    const body = el("div", { className: "msg-text" });
    setMarkdown(body, content);
    wrap.appendChild(body);
    return wrap;
  }

  /**
   * 默认把整个回合的“第 1/2/3/4 步 + 工具卡片”收成一行：
   *   ⚙ 执行过程 · 4 步 · 8 个工具 · 11.2s   [展开]
   * 点一下才显示每个 step 的标题和工具卡片；不点就只看 Agent 的文字输出。
   * 学习 DSH 的思路：过程信息默认收起，答案/结论优先。
   */
  function appendTraceToggle(root, turn) {
    const steps = Array.isArray(turn.steps) ? turn.steps : [];
    if (!steps.length) return null;
    const tools = steps.reduce(
      (sum, step) => sum + (step.items || []).filter((item) => item.kind === "tool").length,
      0,
    );
    const button = el("button", { className: "turn-trace", attrs: { type: "button" } });
    const label = el("span", { className: "turn-trace-text" });
    const hint = el("span", { className: "turn-trace-hint" });
    button.appendChild(el("span", { className: "turn-trace-icon", text: "⚙" }));
    button.appendChild(label);
    button.appendChild(hint);

    const update = () => {
      const open = root.classList.contains("show-steps");
      let text = "执行过程 · " + steps.length + " 步";
      if (tools > 0) text += " · " + tools + " 个工具";
      if (turn.end && Number(turn.end.durationMs) > 0) text += " · " + fmtDuration(Number(turn.end.durationMs));
      label.textContent = text;
      hint.textContent = open ? "收起" : "展开";
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.classList.toggle("open", open);
    };
    button.addEventListener("click", () => {
      root.classList.toggle("show-steps");
      update();
    });
    update();
    // 注意：按钮要插在“过程容器之前”，而不是简单 append。
    // 否则一旦 process 折叠隐藏，按钮就会跑到答案下面去。
    const process = root.querySelector(".turn-process");
    if (process) root.insertBefore(button, process);
    else root.appendChild(button);
    return button;
  }

  function createStepEl(step) {
    const root = el("div", { className: "step" });
    if (step.step !== null && step.step !== undefined) root.dataset.step = String(step.step);
    const head = el("div", { className: "step-head" });
    head.appendChild(el("span", { className: "step-n", text: step.step ? "第 " + step.step + " 步" : "步骤" }));

    if (step.budget && step.contextTokens !== null && step.contextTokens !== undefined) {
      const percent = Math.max(0, Math.min(100, Math.round((step.contextTokens / step.budget) * 100)));
      const level = percent >= 85 ? "danger" : percent >= 60 ? "warn" : "ok";
      head.appendChild(
        el("span", {
          className: "step-meta mono",
          text:
            "上下文 " + fmtInt(step.contextTokens) + " / " + fmtInt(step.budget) + " tokens" +
            (step.historyMessages ? " · 历史 " + step.historyMessages + " 条" : ""),
        }),
      );
      const bar = el("span", { className: "mini-bar " + level });
      const fill = el("i");
      fill.style.width = percent + "%";
      bar.appendChild(fill);
      head.appendChild(bar);
    } else {
      head.appendChild(el("span", { className: "step-meta mono", text: "第 " + (step.step || "?") + " 步 · 收集上下文…" }));
    }

    if (step.tools && step.tools.length) {
      head.appendChild(
        el("span", {
          className: "step-tools",
          text: "工具 " + step.tools.length + " 个",
          title: step.tools.join(" · "),
        }),
      );
    }

    root.appendChild(head);
    const items = el("div", { className: "step-items" });
    for (const item of step.items || []) appendDisplayItem(items, item);
    root.appendChild(items);
    return { root, items };
  }

  function appendDisplayItem(container, item) {
    if (!item) return;
    if (item.kind === "text") {
      if (item.content && item.content.trim()) container.appendChild(createAgentText(item.content));
      return;
    }
    if (item.kind === "tool") {
      container.appendChild(buildToolCard(item).root);
      return;
    }
    if (item.kind === "notice") {
      container.appendChild(createNoticeEl(item));
      return;
    }
    if (item.kind === "approval") {
      const card = buildApprovalCard(item);
      container.appendChild(card.root);
      state.approvalCards.set(item.id, card);
    }
  }

  function createNoticeEl(notice) {
    const tone = notice.tone === "compaction" ? "compaction" : notice.tone === "info" ? "info" : "context";
    const wrap = el("div", { className: "notice " + tone });
    wrap.appendChild(el("span", { className: "notice-icon", text: tone === "compaction" ? "⇣" : tone === "info" ? "ℹ" : "✂" }));
    wrap.appendChild(el("span", { className: "notice-text", text: notice.text }));
    if (notice.detail) {
      const details = el("details", { className: "notice-detail" });
      details.appendChild(el("summary", { text: "查看压缩摘要" }));
      const pre = el("pre", { className: "code" });
      pre.textContent = notice.detail;
      details.appendChild(pre);
      wrap.appendChild(details);
    }
    return wrap;
  }

  function createErrorEl(message) {
    const wrap = el("div", { className: "notice error" });
    wrap.appendChild(el("span", { className: "notice-icon", text: "✕" }));
    wrap.appendChild(el("span", { className: "notice-text", text: "错误：" + message }));
    return wrap;
  }

  // -------------------------------------------------------------------------
  // 6. 工具卡片 / 审批卡片 / 回合结束卡片
  // -------------------------------------------------------------------------

  const CATEGORY_CLASS = { read: "cat-read", write: "cat-write", exec: "cat-exec" };
  const DECISION_CLASS = { allow: "dec-allow", ask: "dec-ask", deny: "dec-deny" };

  function toolInfo(name) {
    const tools = (state.snapshot && state.snapshot.tools) || [];
    for (const tool of tools) {
      if (tool.name === name) return tool;
    }
    return null;
  }

  function toolCategory(name) {
    const info = toolInfo(name);
    if (info && info.category) return String(info.category);
    if (name === "bash") return "exec";
    if (name === "write" || name === "edit") return "write";
    return "read";
  }

  function categoryClass(category) {
    return CATEGORY_CLASS[category] || "cat-other";
  }

  function decisionClass(decision) {
    return DECISION_CLASS[decision] || "dec-ask";
  }

  /** DSH 风格的一行工具描述：图标 + 动作中文名。 */
  const TOOL_ACTION = {
    bash: "运行命令",
    read: "读取文件",
    write: "写入文件",
    edit: "修改文件",
    glob: "查找文件",
    grep: "搜索内容",
    task: "子任务",
    todowrite: "更新待办",
  };
  // 工具类别用「一个小圆点」表示（颜色由 CSS 按 read/write/exec 区分），
  // 比塞一堆 ⌘▤✎⌕ 之类的符号干净得多。
  const TOOL_ICON_CLASS = {
    read: "cat-read",
    write: "cat-write",
    exec: "cat-exec",
  };

  /** 工具输出超过这么多行时，先截断，点「展开全部」再看完整内容。 */
  const TOOL_OUTPUT_MAX_LINES = 30;

  /**
   * 工具卡片：summary 常显（名字/类别/参数预览/状态/耗时），
   * body 里是完整参数与输出。
   *
   * 默认折叠（减少信息噪音）：
   *   - 历史回放：一律收起；
   *   - 实时运行中：展开，方便看参数和流式结果；结束后自动收起。
   */
  function buildToolCard(tool) {
    const category = toolCategory(tool.name);
    const running = Boolean(tool.running);
    const isError = Boolean(tool.isError);
    const details = el("details", { className: "tool-card" + (isError ? " is-error" : "") + (running ? " is-running" : "") });
    // 运行中的卡片先展开；历史/回放一律折叠。
    if (running) details.open = true;

    const summary = el("summary", { className: "tool-head", title: String(tool.name || "?") });
    const action = TOOL_ACTION[tool.name] || (String(tool.name || "").startsWith("mcp__") ? "MCP 工具" : "工具");
    const iconClass = TOOL_ICON_CLASS[category] || "cat-other";
    summary.appendChild(el("span", { className: "tool-icon " + iconClass, text: "" }));
    summary.appendChild(el("span", { className: "tool-action", text: action }));
    const argLine = tool.argsPreview || tool.arguments || "";
    summary.appendChild(el("span", { className: "tool-argline mono", text: oneLine(argLine, 90), title: argLine }));
    const status = el("span", {
      className: "tool-status " + (running ? "running" : isError ? "bad" : "good"),
      text: running ? "运行中…" : isError ? "失败" : "成功",
    });
    summary.appendChild(status);
    const duration = el("span", { className: "tool-dur mono", text: running ? "" : fmtDuration(tool.durationMs) });
    summary.appendChild(duration);
    details.appendChild(summary);

    const body = el("div", { className: "tool-body" });

    const argsLabel = el("div", { className: "tool-label", text: tool.live ? "参数（流式预览；回合结束后从会话记录载入完整参数）" : "参数" });
    body.appendChild(argsLabel);
    const argsPre = el("pre", { className: "code tool-args" });
    argsPre.textContent = formatArgs(tool.arguments || tool.argsPreview || "");
    body.appendChild(argsPre);

    const outputLabel = el("div", { className: "tool-label" });
    outputLabel.appendChild(el("span", { text: "结果" }));
    const moreBtn = el("button", { className: "btn tiny", attrs: { type: "button" }, text: "展开全部" });
    moreBtn.hidden = true;
    outputLabel.appendChild(moreBtn);
    const outputPre = el("pre", { className: "code tool-output" + (isError ? " is-error" : "") });
    body.appendChild(outputLabel);
    body.appendChild(outputPre);

    let fullOutput = running ? "（等待工具结果…）" : tool.output || "（没有记录到输出）";
    let expanded = false;
    let isRunning = running;

    function paintOutput() {
      const lines = String(fullOutput).split("\n");
      const canTruncate = !isRunning && lines.length > TOOL_OUTPUT_MAX_LINES;
      if (canTruncate && !expanded) {
        outputPre.textContent =
          lines.slice(0, TOOL_OUTPUT_MAX_LINES).join("\n") +
          "\n…（还有 " + fmtInt(lines.length - TOOL_OUTPUT_MAX_LINES) + " 行，点「展开全部」查看）";
      } else {
        outputPre.textContent = fullOutput;
      }
      moreBtn.hidden = !canTruncate;
      moreBtn.textContent = expanded ? "收起" : "展开全部（共 " + fmtInt(lines.length) + " 行）";
    }

    moreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      expanded = !expanded;
      paintOutput();
    });

    paintOutput();

    if (tool.interrupted) body.appendChild(el("div", { className: "tool-note", text: "（这个工具调用被用户中断，没有执行）" }));
    details.appendChild(body);

    /** 工具结束后回填结果：先按行截断，再允许「展开全部」。 */
    function setOutput(output, error) {
      isRunning = false;
      fullOutput = String(output || "（没有记录到输出）");
      expanded = false;
      outputPre.classList.toggle("is-error", Boolean(error));
      paintOutput();
    }

    return { root: details, summary, status, duration, argsPre, argsLabel, outputPre, outputLabel, body, setOutput };
  }

  function buildApprovalCard(approval) {
    const wrap = el("div", { className: "approval-card pending" });
    const icon = el("span", { className: "approval-icon", text: "" });
    wrap.appendChild(icon);
    const title = el("span", { className: "approval-title", text: "需要权限审批" });
    wrap.appendChild(title);
    const category = toolCategory(approval.toolName);
    wrap.appendChild(el("span", { className: "badge tool-cat " + categoryClass(category), text: category }));
    wrap.appendChild(el("span", { className: "approval-tool mono", text: approval.toolName }));
    const status = el("span", { className: "approval-status", text: "等待处理…" });
    wrap.appendChild(status);
    if (approval.danger) wrap.appendChild(el("span", { className: "approval-danger", text: "⚠ " + approval.danger }));
    const details = el("details", { className: "approval-detail" });
    details.appendChild(el("summary", { text: "参数 JSON" }));
    const pre = el("pre", { className: "code" });
    pre.textContent = String(approval.detail || "（无参数）");
    details.appendChild(pre);
    wrap.appendChild(details);

    function setStatus(kind, reason) {
      wrap.classList.remove("pending", "allowed", "denied");
      if (kind === "allowed") {
        wrap.classList.add("allowed");
        icon.textContent = "✓";
        title.textContent = "权限已允许";
        status.textContent = "已允许" + (reason ? " · " + reason : "");
      } else if (kind === "denied") {
        wrap.classList.add("denied");
        icon.textContent = "✕";
        title.textContent = "权限被拒绝";
        status.textContent = "已拒绝" + (reason ? " · " + reason : "");
      } else {
        wrap.classList.add("pending");
        icon.textContent = "";
        title.textContent = "需要权限审批";
        status.textContent = "等待处理…";
      }
    }

    return { root: wrap, setStatus };
  }

  function createTurnEndEl(end) {
    const wrap = el("div", { className: "turn-end" });
    if (end.error) {
      wrap.classList.add("has-error");
      wrap.appendChild(el("span", { className: "badge bad", text: "回合出错" }));
    } else if (end.aborted) {
      wrap.appendChild(el("span", { className: "badge warn", text: "回合中断" }));
    } else {
      wrap.appendChild(el("span", { className: "badge ok", text: "回合结束" }));
    }
    if (end.hitStepLimit) wrap.appendChild(el("span", { className: "badge warn", text: "达到步数上限" }));
    if (Number(end.toolDenials) > 0) wrap.appendChild(el("span", { className: "badge bad", text: "工具被拒 " + end.toolDenials + " 次" }));

    const usage = end.usage || {};
    const parts = [
      "步数 " + (Number(end.steps) || 0),
      "prompt " + fmtInt(usage.prompt_tokens) + " tokens",
      "completion " + fmtInt(usage.completion_tokens) + " tokens",
      "耗时 " + fmtDuration(end.durationMs),
    ];
    wrap.appendChild(el("span", { className: "turn-end-stats mono", text: parts.join(" · ") }));
    if (end.error) wrap.appendChild(el("span", { className: "turn-end-error", text: String(end.error) }));
    return wrap;
  }

  // -------------------------------------------------------------------------
  // 7. 对话：全量重建 / 流式增量
  // -------------------------------------------------------------------------

  function resetStream() {
    state.stream = { active: false, text: "", thinking: "" };
  }

  function resetLiveDom() {
    state.live.turnEl = null;
    state.live.stepEl = null;
    state.live.stepItemsEl = null;
    state.live.stepNo = 0;
    state.live.assistantEl = null;
    state.live.streamTextEl = null;
    state.live.cursorEl = null;
    state.live.thinkingEl = null;
    state.live.pendingTools = [];
    if (state.live.timerId) {
      clearInterval(state.live.timerId);
      state.live.timerId = null;
    }
    state.live.statusEl = null;
    state.live.lastThought = "";
    state.live.startedAt = 0;
  }

  function resetLiveTurn() {
    resetStream();
    resetLiveDom();
  }

  function rebuildConversation() {
    const snapshot = state.snapshot;
    const rawEvents = snapshot && Array.isArray(snapshot.events) ? snapshot.events : [];
    const wasAtBottom = isNearBottom(dom.chatLog, 200);
    const turns = buildTurns(rawEvents);
    dom.chatLog.textContent = "";
    if (turns.length > 0) {
      dom.chatLog.appendChild(renderTurns(turns));
    }

    // 让后续实时事件能接着往最后一个 step 里画（断线重连场景）
    resetLiveDom();
    const lastTurn = dom.chatLog.querySelector(".turn:last-child");
    state.live.turnEl = lastTurn;
    state.live.stepEl = lastTurn ? lastTurn.querySelector(".step:last-child") : null;
    state.live.stepItemsEl = state.live.stepEl ? state.live.stepEl.querySelector(".step-items") : null;
    if (state.live.stepEl && state.live.stepEl.dataset.step) {
      state.live.stepNo = Number(state.live.stepEl.dataset.step) || 0;
    }
    state.approvalCards.clear();
    renderApprovalRecords();

    // 断线重连时，把断线前已流的文本接回去（thinking 只在当前页面内存里）
    if (state.stream.active) {
      attachStreamPlaceholder();
    }
    renderChatMeta();
    renderStats();
    if (wasAtBottom) scrollToBottom(dom.chatLog, true);
  }

  /** 当前会话 id（用于把审批卡片按会话隔离）。 */
  function currentSessionId() {
    return state.snapshot && state.snapshot.session ? String(state.snapshot.session.id || "") : "";
  }

  function approvalRecords(sessionId, create) {
    let records = state.approvalsBySession.get(sessionId);
    if (!records && create) {
      records = [];
      state.approvalsBySession.set(sessionId, records);
    }
    return records || [];
  }

  /**
   * 把本页面见过的审批卡片放回对话里。
   *
   * 为什么需要它？permission_request 不会写进会话 JSONL（它不是消息），
   * 所以 turn_complete 后从 state.events 全量重绘时，审批卡片本来会消失。
   * 这里按“审批发生时是第几个回合”记下位置，重绘后插回对应回合的末尾。
   */
  function renderApprovalRecords() {
    const records = approvalRecords(currentSessionId(), false);
    if (!records.length) return;
    const turnEls = Array.from(dom.chatLog.querySelectorAll(".turn"));
    if (!turnEls.length) return;
    for (const record of records) {
      const index = Math.min(Math.max((Number(record.turnIndex) || 1) - 1, 0), turnEls.length - 1);
      const turnEl = turnEls[index];
      if (!turnEl) continue;
      const card = buildApprovalCard(record.approval);
      card.setStatus(record.status || "pending", record.reason || "");
      const end = turnEl.querySelector(".turn-end");
      if (end) turnEl.insertBefore(card.root, end);
      else turnEl.appendChild(card.root);
      state.approvalCards.set(record.id, card);
    }
  }

  function formatElapsed(ms) {
    const seconds = Math.max(0, Math.round(Number(ms) / 1000));
    if (seconds < 60) return seconds + " 秒";
    return Math.floor(seconds / 60) + " 分 " + (seconds % 60) + " 秒";
  }

  /** DSH 风格实时状态条：正在分析请求 · <思考摘要> / ✈ 深度求索中，用时 N 秒… */
  function ensureLiveStatus(turnEl) {
    if (!turnEl) return null;
    let block = turnEl.querySelector(":scope > .live-status");
    if (!block) {
      block = el("div", { className: "live-status" });
      const head = el("button", {
        className: "live-status-head",
        attrs: { type: "button", "aria-expanded": "false" },
      });
      const caret = el("span", { className: "live-status-caret", text: "▾" });
      const title = el("span", { className: "live-status-title", text: "正在分析请求" });
      const snippet = el("span", { className: "live-status-snippet", text: "" });
      head.appendChild(caret);
      head.appendChild(title);
      head.appendChild(snippet);
      head.addEventListener("click", () => {
        turnEl.classList.toggle("show-steps");
        updateLiveStatus(turnEl);
      });
      const meta = el("div", { className: "live-status-meta" });
      meta.appendChild(el("span", { className: "live-status-plane", text: "" }));
      meta.appendChild(el("span", { className: "live-status-meta-text", text: "深度求索中，用时 0 秒…" }));
      block.appendChild(head);
      block.appendChild(meta);
      const process = turnEl.querySelector(":scope > .turn-process");
      turnEl.insertBefore(block, process || null);
    }
    state.live.statusEl = block;
    return block;
  }

  function updateLiveStatus(turnEl) {
    if (!turnEl) turnEl = state.live.turnEl;
    const block = turnEl && turnEl.querySelector(":scope > .live-status");
    if (!block) return;
    const open = turnEl.classList.contains("show-steps");
    const caret = block.querySelector(".live-status-caret");
    const head = block.querySelector(".live-status-head");
    const snippet = block.querySelector(".live-status-snippet");
    const metaText = block.querySelector(".live-status-meta-text");
    if (caret) caret.textContent = open ? "▾" : "▸";
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
    if (snippet) snippet.textContent = state.live.lastThought ? " · " + state.live.lastThought : "";
    if (metaText && state.live.startedAt) {
      metaText.textContent = "深度求索中，用时 " + formatElapsed(Date.now() - state.live.startedAt) + "…";
    }
  }

  function startLiveStatusTimer(turnEl) {
    if (state.live.timerId) clearInterval(state.live.timerId);
    state.live.startedAt = Date.now();
    updateLiveStatus(turnEl);
    state.live.timerId = setInterval(() => {
      if (!turnEl || !turnEl.isConnected || !turnEl.classList.contains("live")) {
        if (state.live.timerId) clearInterval(state.live.timerId);
        state.live.timerId = null;
        return;
      }
      updateLiveStatus(turnEl);
    }, 1000);
  }

  function ensureLiveTurn() {
    if (!state.live.turnEl || !state.live.turnEl.isConnected) {
      state.live.turnEl = el("div", { className: "turn live" });
      // 与 renderTurn 保持同一套分层，见 renderTurn 上方注释
      state.live.turnEl.appendChild(el("div", { className: "turn-process" }));
      state.live.turnEl.appendChild(el("div", { className: "turn-answer" }));
      dom.chatLog.appendChild(state.live.turnEl);
      state.live.stepEl = null;
      state.live.stepItemsEl = null;
      refreshLiveTrace(state.live.turnEl);
    }
    return state.live.turnEl;
  }

  /** 过程容器：所有 step / 工具卡片都放这里，折叠时整块隐藏。 */
  function liveProcessEl(turnEl) {
    let process = turnEl.querySelector(":scope > .turn-process");
    if (!process) {
      process = el("div", { className: "turn-process" });
      turnEl.appendChild(process);
    }
    return process;
  }

  /** 答案容器：流式回答永远可见，不随“过程”一起折叠。 */
  function liveAnswerEl(turnEl) {
    let answer = turnEl.querySelector(":scope > .turn-answer");
    if (!answer) {
      answer = el("div", { className: "turn-answer" });
      turnEl.appendChild(answer);
    }
    return answer;
  }

  function ensureLiveStep() {
    ensureLiveTurn();
    if (!state.live.stepEl || !state.live.stepEl.isConnected) {
      const process = liveProcessEl(state.live.turnEl);
      const existing = process.querySelector(".step:last-child");
      if (existing) {
        state.live.stepEl = existing;
        state.live.stepItemsEl = existing.querySelector(".step-items");
      } else {
        const stepData = {
          step: state.live.stepNo || state.stats.step || 1,
          contextTokens: null,
          budget: null,
          historyMessages: null,
          tools: [],
        };
        const built = createStepEl(stepData);
        process.appendChild(built.root);
        state.live.stepEl = built.root;
        state.live.stepItemsEl = built.items;
      }
    }
    return state.live.stepItemsEl || liveProcessEl(state.live.turnEl);
  }

  function ensureLiveAssistant() {
    ensureLiveTurn();
    if (!state.live.assistantEl || !state.live.assistantEl.isConnected) {
      const wrap = el("div", { className: "msg agent live" });
      wrap.appendChild(el("div", { className: "msg-role", text: "Agent" }));
      const textWrap = el("div", { className: "msg-text" });
      // 用 div 而不是 span：Markdown 渲染出来的 <p>/<pre>/<ul> 都是块级元素，
      // 塞进 span 属于非法嵌套，浏览器会做意外的“修复”，布局会乱。
      const streamText = el("div", { className: "stream-text" });
      const cursor = el("span", { className: "cursor", text: "▍" });
      textWrap.appendChild(streamText);
      textWrap.appendChild(cursor);
      wrap.appendChild(textWrap);
      const host = liveAnswerEl(state.live.turnEl);
      host.appendChild(wrap);
      state.live.assistantEl = wrap;
      state.live.streamTextEl = streamText;
      state.live.cursorEl = cursor;
      state.live.thinkingEl = null;
    }
    return state.live.assistantEl;
  }

  function ensureLiveThinking() {
    ensureLiveAssistant();
    if (!state.live.thinkingEl || !state.live.thinkingEl.root.isConnected) {
      const details = el("details", { className: "thinking" });
      const summary = el("summary", { className: "thinking-head", title: "思考过程默认折叠，点击展开 / 收起" });
      const label = el("span", { className: "thinking-label", text: "思考 · 正在思考…" });
      summary.appendChild(label);
      const pre = el("pre", { className: "thinking-body" });
      details.appendChild(summary);
      details.appendChild(pre);
      const assistant = state.live.assistantEl;
      const textWrap = assistant.children[1];
      if (textWrap) assistant.insertBefore(details, textWrap);
      else assistant.appendChild(details);
      state.live.thinkingEl = { root: details, label, pre, chars: 0 };
    }
    return state.live.thinkingEl;
  }

  function attachStreamPlaceholder() {
    ensureLiveAssistant();
    if (state.stream.text) setMarkdown(state.live.streamTextEl, state.stream.text);
    if (state.stream.active && state.live.cursorEl) {
      if (!state.live.cursorEl.isConnected) state.live.streamTextEl.after(state.live.cursorEl);
    }
    if (state.stream.thinking) {
      const thinking = ensureLiveThinking();
      thinking.pre.textContent = state.stream.thinking;
      thinking.chars = state.stream.thinking.length;
      thinking.label.textContent = "思考 · " + oneLine(state.stream.thinking, 120);
      thinking.label.title = "思考过程共 " + thinking.chars + " 字（点击展开/收起）";
    }
  }

  // ---- 实时事件处理（对话区） ----

  function onUserMessage(data) {
    resetStream();
    resetLiveDom();
    // 新后端发 {text, images}，旧后端发 {content}；两者都兼容。
    const user = parseUserMessageEvent(data);
    const turnEl = el("div", { className: "turn live" });
    turnEl.appendChild(createUserBubble({ text: user.text, images: user.images }));
    // 与 ensureLiveTurn 同样先铺好“过程 / 答案”两层
    turnEl.appendChild(el("div", { className: "turn-process" }));
    turnEl.appendChild(el("div", { className: "turn-answer" }));
    dom.chatLog.appendChild(turnEl);
    ensureLiveStatus(turnEl);
    startLiveStatusTimer(turnEl);
    state.live.turnEl = turnEl;
    state.live.stepEl = null;
    state.live.stepItemsEl = null;
    state.live.stepNo = 0;
    state.stats.messageCount += 1;
    renderStats();
    renderChatMeta();
    scrollToBottom(dom.chatLog, true);
  }

  function onStepStart(data) {
    ensureLiveTurn();
    state.live.stepNo = Number(data.step) || state.live.stepNo + 1;
    const stepData = {
      step: state.live.stepNo,
      contextTokens: Number(data.contextTokens) || 0,
      budget: Number(data.budget) || state.stats.budget,
      historyMessages: Number(data.historyMessages) || 0,
      tools: Array.isArray(data.tools) ? data.tools.map((item) => String(item)) : [],
    };
    const built = createStepEl(stepData);
    liveProcessEl(state.live.turnEl).appendChild(built.root);
    state.live.stepEl = built.root;
    state.live.stepItemsEl = built.items;
    state.live.assistantEl = null;
    state.stats.step = stepData.step;
    state.stats.contextTokens = stepData.contextTokens;
    state.stats.budget = stepData.budget;
    state.stats.historyMessages = stepData.historyMessages;
    renderStats();
    renderChatMeta();
    scrollToBottom(dom.chatLog);
  }

  function onAssistantStart() {
    resetStream();
    state.stream.active = true;
    state.live.assistantEl = null;
    ensureLiveAssistant();
    state.stats.messageCount += 1; // 本步的 assistant 消息（回合结束后以快照为准）
    renderStats();
    scrollToBottom(dom.chatLog);
  }

  function onAssistantDelta(text) {
    if (!state.stream.active) {
      state.stream.active = true;
    }
    if (!text) return;
    state.stream.text += text;
    ensureLiveAssistant();
    scheduleStreamMarkdown();
    scrollToBottom(dom.chatLog);
  }

  /**
   * 流式输出时“节流”地重渲染 Markdown。
   *
   * 为什么不每个 token 都重渲染？模型一秒能吐几十个增量，
   * 每次都重新解析整段文本是 O(n²)：长回答会把主线程占满，滚动都会卡。
   * 也不完全放弃渲染——那样又变成“跑完才变好看”，中途还是裸文本。
   * 折中：最多 80ms 渲染一次（约 12fps），结束时立刻补一次终稿。
   */
  let streamMarkdownTimer = null;
  function scheduleStreamMarkdown() {
    if (streamMarkdownTimer !== null) return;
    streamMarkdownTimer = setTimeout(() => {
      streamMarkdownTimer = null;
      const target = state.live.streamTextEl;
      if (target && target.isConnected) setMarkdown(target, state.stream.text);
    }, 80);
  }

  /** 立即把已累积的文本渲染成 Markdown（回合结束 / 快照接管前调用）。 */
  function flushStreamMarkdown() {
    if (streamMarkdownTimer !== null) {
      clearTimeout(streamMarkdownTimer);
      streamMarkdownTimer = null;
    }
    const target = state.live.streamTextEl;
    if (target && target.isConnected) setMarkdown(target, state.stream.text);
  }

  function onThinkingDelta(text) {
    if (!state.stream.active) state.stream.active = true;
    if (!text) return;
    state.stream.thinking += text;
    const thinking = ensureLiveThinking();
    thinking.chars = state.stream.thinking.length;
    thinking.pre.textContent = state.stream.thinking;
    thinking.label.textContent = "思考 · " + oneLine(state.stream.thinking, 120);
    thinking.label.title = "思考过程共 " + thinking.chars + " 字（点击展开/收起）";
    state.live.lastThought = oneLine(state.stream.thinking, 120);
    updateLiveStatus(state.live.turnEl);
    scrollToBottom(dom.chatLog);
  }

  function onAssistantEnd() {
    state.stream.active = false;
    // 先补一次终稿渲染：节流窗口里最后几十毫秒的增量还没画出来
    flushStreamMarkdown();
    if (state.live.cursorEl) {
      state.live.cursorEl.remove();
      state.live.cursorEl = null;
    }
    if (state.live.thinkingEl) {
      const full = state.stream.thinking || "";
      state.live.thinkingEl.label.textContent = "思考 · " + (oneLine(full, 120) || "已完成");
      state.live.thinkingEl.label.title = "思考过程共 " + state.live.thinkingEl.chars + " 字（点击展开/收起）";
    }
    // 模型这一步如果只思考/只调工具、没有正文，live 里会留下一个空气泡（截图里的小圆角块）。
    // 收尾时把没有正文的气泡删掉，历史回放里也不会显示。
    const bubble = state.live.assistantEl;
    if (bubble) {
      const text = state.stream.text || "";
      if (!text.trim()) bubble.remove();
    }
    state.live.assistantEl = null;
    state.live.streamTextEl = null;
    state.live.cursorEl = null;
    state.live.thinkingEl = null;
  }

  function onToolStart(data) {
    ensureLiveStep();
    const name = String(data.name || "?");
    const card = buildToolCard({
      name,
      arguments: "",
      argsPreview: String(data.argsPreview || ""),
      output: "",
      isError: false,
      interrupted: false,
      durationMs: 0,
      running: true,
      live: true,
    });
    (state.live.stepItemsEl || state.live.turnEl).appendChild(card.root);
    state.live.pendingTools.push({ name, card });
    state.stats.toolCalls += 1;
    renderStats();
    scrollToBottom(dom.chatLog);
  }

  function onToolEnd(data) {
    const name = String(data.name || "?");
    let pending = null;
    for (let i = state.live.pendingTools.length - 1; i >= 0; i--) {
      if (state.live.pendingTools[i].name === name) {
        pending = state.live.pendingTools[i];
        state.live.pendingTools.splice(i, 1);
        break;
      }
    }
    if (!pending && state.live.pendingTools.length) {
      pending = state.live.pendingTools.pop();
    }
    if (!pending) {
      // 没看到 tool_start（比如重连后）：补一张完整卡片
      ensureLiveStep();
      const card = buildToolCard({
        name,
        arguments: "",
        argsPreview: "",
        output: String(data.output || ""),
        isError: Boolean(data.isError),
        interrupted: Boolean(data.interrupted),
        durationMs: Number(data.durationMs) || 0,
        running: false,
        live: true,
      });
      (state.live.stepItemsEl || state.live.turnEl).appendChild(card.root);
      state.stats.messageCount += 1; // role=tool 消息
      renderStats();
      scrollToBottom(dom.chatLog);
      return;
    }

    const isError = Boolean(data.isError);
    const card = pending.card;
    card.root.classList.remove("is-running");
    card.root.classList.toggle("is-error", isError);
    card.status.className = "tool-status " + (isError ? "bad" : "good");
    card.status.textContent = isError ? "失败" : "成功";
    card.duration.textContent = fmtDuration(data.durationMs);
    card.summary.title = String(data.title || name) + "\n" + String(data.output || "");
    card.setOutput(String(data.output || ""), isError);
    // 工具结束就收起，回到“summary 一行”的默认折叠状态。
    card.root.open = false;
    state.stats.messageCount += 1; // role=tool 消息
    renderStats();
    scrollToBottom(dom.chatLog);
  }

  function onPermissionRequest(data) {
    const approval = {
      id: String(data.id || ""),
      toolName: String(data.toolName || "?"),
      detail: String(data.detail || ""),
      danger: data.danger ? String(data.danger) : null,
    };
    state.pending.set(approval.id, approval);
    const records = approvalRecords(currentSessionId(), true);
    records.push({
      id: approval.id,
      approval,
      status: "pending",
      reason: "",
      turnIndex: Math.max(1, dom.chatLog.querySelectorAll(".turn").length),
    });
    if (records.length > 100) records.splice(0, records.length - 100);
    ensureLiveStep();
    const card = buildApprovalCard(approval);
    state.approvalCards.set(approval.id, card);
    (state.live.stepItemsEl || state.live.turnEl).appendChild(card.root);
    showApprovalModal(approval);
    updateComposer();
    renderChatMeta();
  }

  function onPermissionResolved(data) {
    const id = String(data.id || "");
    const allowed = Boolean(data.allowed);
    const reason = data.reason ? String(data.reason) : "";
    const records = approvalRecords(currentSessionId(), false);
    for (const record of records) {
      if (record.id === id) {
        record.status = allowed ? "allowed" : "denied";
        record.reason = reason;
      }
    }
    const card = state.approvalCards.get(id);
    if (card) card.setStatus(allowed ? "allowed" : "denied", reason);
    state.pending.delete(id);
    state.approvalCards.delete(id);
    if (modal.kind === "approval" && modal.id === id) {
      closeModal();
      openNextApproval();
    }
    updateComposer();
    if (!allowed && reason) toast("权限 " + id.slice(0, 8) + "：已拒绝 · " + reason, "warn");
  }

  function onNotice(message, tone) {
    // 清爽模式：上下文裁剪/压缩这类过程提示只进事件流，不往对话里堆。
    if (!document.body.classList.contains("debug-on") && (!tone || tone === "info")) return;
    ensureLiveStep();
    const node = createNoticeEl({ tone: tone || "info", text: message });
    (state.live.stepItemsEl || state.live.turnEl).appendChild(node);
    scrollToBottom(dom.chatLog);
  }

  function onError(message) {
    ensureLiveStep();
    (state.live.stepItemsEl || state.live.turnEl).appendChild(createErrorEl(message));
    toast(message, "error");
    scrollToBottom(dom.chatLog);
  }

  function onTurnEnd(data) {
    onAssistantEnd();
    ensureLiveTurn();
    const turnEl = state.live.turnEl;
    if (state.live.timerId) {
      clearInterval(state.live.timerId);
      state.live.timerId = null;
    }
    turnEl.classList.remove("live");
    const liveStatus = turnEl.querySelector(":scope > .live-status");
    if (liveStatus) liveStatus.remove();
    // 跑完自动收起过程：运行中看得到每一步，结束只留“执行过程 · N 步”一行 + 答案。
    turnEl.classList.remove("show-steps");
    turnEl.appendChild(createTurnEndEl(data));
    refreshLiveTrace(turnEl);
    applyTurnEndStats(data);
    renderStats();
    setBusy(false);
    scrollToBottom(dom.chatLog);
    renderChatMeta();
  }

  // -------------------------------------------------------------------------
  // 8. 事件流 Tab
  // -------------------------------------------------------------------------

  function tsFromRawEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    const ts = Number(raw.ts);
    if (Number.isFinite(ts) && ts > 0) return ts;
    if (typeof raw.at === "string") {
      const parsed = new Date(raw.at).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }
    if (raw.type === "meta" && raw.meta && typeof raw.meta.createdAt === "string") {
      const parsed = new Date(raw.meta.createdAt).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function makeEventEntry(raw, live) {
    const ts = tsFromRawEvent(raw);
    const seqValue = Number(raw && raw.seq);
    return {
      seq: Number.isFinite(seqValue) && seqValue > 0 ? seqValue : null,
      ts,
      type: String((raw && raw.type) || "unknown"),
      data: raw,
      live: Boolean(live),
    };
  }

  function computeEventBaseTs() {
    let base = null;
    for (const entry of state.eventLog) {
      if (entry.ts !== null && entry.ts !== undefined) {
        if (base === null || entry.ts < base) base = entry.ts;
      }
    }
    state.eventBaseTs = base;
  }

  function seedEventLog(rawEvents) {
    state.eventLog = [];
    const list = Array.isArray(rawEvents) ? rawEvents : [];
    for (const raw of list) {
      state.eventLog.push(makeEventEntry(raw, false));
    }
    computeEventBaseTs();
    state.eventsCleared = false;
    renderEventTable();
    updateEventSummary();
  }

  function ingestLiveEvent(raw) {
    const entry = makeEventEntry(raw, true);
    state.eventLog.push(entry);
    if (state.eventLog.length > MAX_EVENT_ROWS) {
      state.eventLog.splice(0, 500);
      renderEventTable();
    } else {
      appendEventRow(entry);
    }
    if (entry.ts !== null && (state.eventBaseTs === null || entry.ts < state.eventBaseTs)) {
      state.eventBaseTs = entry.ts;
      renderEventTable();
    }
    updateEventSummary();
    if (state.tab === "events" && !dom.eventsPause.checked) {
      dom.eventsScroll.scrollTop = dom.eventsScroll.scrollHeight;
    }
  }

  function eventTypeClass(type) {
    if (type === "trace") return "ev-trace";
    if (type === "user_message" || type === "message") return "ev-user";
    if (type.startsWith("assistant") || type.startsWith("thinking")) return "ev-assistant";
    if (type.startsWith("tool")) return "ev-tool";
    if (type.startsWith("permission")) return "ev-perm";
    if (type === "workspace") return "ev-run";
    if (type.startsWith("run") || type === "usage" || type === "busy") return "ev-run";
    if (type.startsWith("turn")) return "ev-turn";
    if (type === "error") return "ev-error";
    if (type === "notice" || type === "info") return "ev-notice";
    return "ev-other";
  }

  function summarizeTrace(data) {
    const inner = String(data.type || "");
    if (inner === "step_start") {
      return (
        "第 " + (data.step === undefined ? "?" : data.step) + " 步 · 上下文 " +
        fmtInt(data.contextTokens) + " / " + fmtInt(data.budget) + " tokens · 历史 " +
        (data.historyMessages === undefined ? "?" : data.historyMessages) + " 条"
      );
    }
    if (inner === "context") {
      return "裁剪：移除 " + (Number(data.removed) || 0) + " 条 · 截断工具输出 " + (Number(data.truncatedToolOutputs) || 0) + " 条 · " + fmtInt(data.tokens) + " tokens";
    }
    if (inner === "compaction") {
      return "压缩：" + fmtInt(data.before) + " → " + fmtInt(data.after) + " tokens";
    }
    if (inner === "assistant_message") {
      const textLength = typeof data.content === "string" ? data.content.length : 0;
      const calls = Array.isArray(data.toolCalls) ? data.toolCalls.length : 0;
      return "文本 " + textLength + " 字 · tool_calls " + calls + " 个";
    }
    return oneLine(safeJson(data), 140);
  }

  function summarizeEvent(entry) {
    const type = entry.type;
    const raw = entry.data || {};
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    switch (type) {
      case "hello":
        return "SSE 首帧 hello · 完整状态快照";
      case "state":
        return "完整状态快照";
      case "user_message": {
        // 新格式 {text, images}，旧格式 {content}
        const user = parseUserMessageEvent(data);
        const imageCount = user.images.length;
        return (
          "用户：" +
          (oneLine(user.text, 120) || "（空消息）") +
          (imageCount ? " · 附 " + imageCount + " 张图片" : "")
        );
      }
      case "assistant_delta":
        return "文本 +" + String(data.text || "").length + " 字符：" + oneLine(data.text, 100);
      case "thinking_delta":
        return "思考 +" + String(data.text || "").length + " 字符：" + oneLine(data.text, 100);
      case "assistant_start":
        return "开始生成";
      case "assistant_end":
        return "生成结束";
      case "tool_start":
        return String(data.name || "?") + " " + oneLine(data.argsPreview, 110);
      case "tool_end":
        return String(data.name || "?") + " · " + (data.isError ? "失败" : "成功") + " · " + fmtDuration(data.durationMs);
      case "permission_request":
        return String(data.toolName || "?") + (data.danger ? " · ⚠ " + data.danger : " · 等待审批");
      case "permission_resolved":
        return (data.allowed ? "允许" : "拒绝") + (data.reason ? " · " + data.reason : "");
      case "notice":
      case "info":
      case "error":
        return String(data.message || "");
      case "trace":
        return "trace · " + summarizeTrace(data);
      case "turn_end":
        return (
          "回合结束 · 步数 " + (data.steps === undefined ? "?" : data.steps) +
          " · prompt " + fmtInt((data.usage && data.usage.prompt_tokens) || 0) +
          " / completion " + fmtInt((data.usage && data.usage.completion_tokens) || 0) +
          " · 耗时 " + fmtDuration(data.durationMs) +
          (data.aborted ? " · 已中断" : "") +
          (data.hitStepLimit ? " · 达到步数上限" : "")
        );
      case "usage":
        return "prompt " + fmtInt(data.promptTokens) + " · completion " + fmtInt(data.completionTokens) + " · 步数 " + (data.steps === undefined ? "?" : data.steps);
      case "run_state":
        return data.busy ? "运行中…" : "空闲";
      case "run_start":
        return "开始回合 · 模型 " + String(data.model || "?") + " · 模式 " + String(data.mode || "?") + (data.mock ? " · mock" : "");
      case "turn_complete":
        return "回合完成 · 会话 " + String(data.sessionId || "");
      case "sessions":
        return "会话列表更新 · " + ((data.sessions && data.sessions.length) || 0) + " 个";
      case "todos":
        return "待办更新 · " + ((data.todos && data.todos.length) || 0) + " 条";
      case "config":
        return "配置更新 · " + String(data.model || "") + (data.mock ? " · mock" : "");
      case "mode":
        return "模式切换 · " + String(data.mode || "");
      case "yolo":
        return "yolo · " + (data.value ? "开" : "关");
      case "permission":
        return "权限档位 · " + String(data.level || "");
      case "workspace":
        return "工作区切换 · " + String(data.path || "");
      case "message": {
        const message = data.message || {};
        const role = String(message.role || "?");
        if (role === "user") return "user：" + contentSummaryText(message.content);
        if (role === "assistant") {
          const calls = Array.isArray(message.tool_calls) ? message.tool_calls.length : 0;
          return "assistant：" + (message.content ? oneLine(message.content, 90) : "（仅工具调用）") + " · tool_calls " + calls;
        }
        if (role === "tool") return "tool[" + String(message.name || "") + "]：" + oneLine(message.content, 110);
        return role;
      }
      case "assistant_message": {
        const calls = Array.isArray(data.toolCalls) ? data.toolCalls.length : 0;
        return "assistant：" + (data.content ? oneLine(data.content, 90) : "（仅工具调用）") + " · tool_calls " + calls;
      }
      case "tool":
        return (
          String(data.name || "?") + " · " + (data.isError ? "失败" : "成功") +
          (data.durationMs ? " · " + fmtDuration(data.durationMs) : "") +
          (data.interrupted ? " · 被中断" : "")
        );
      case "step_start":
        return (
          "第 " + (data.step === undefined ? "?" : data.step) + " 步 · 上下文 " + fmtInt(data.contextTokens) +
          " / " + fmtInt(data.budget) + " tokens · 历史 " + (data.historyMessages === undefined ? "?" : data.historyMessages) + " 条"
        );
      case "context":
        return "裁剪 · 移除 " + (Number(data.removed) || 0) + " 条 · 截断工具输出 " + (Number(data.truncatedToolOutputs) || 0) + " 条 · " + fmtInt(data.tokens) + " tokens";
      case "compaction":
        return "压缩 · " + fmtInt(data.before) + " → " + fmtInt(data.after) + " tokens";
      case "meta":
        return "会话元信息 · " + String((data.meta && data.meta.id) || "");
      case "snapshot":
        return "历史快照 · " + ((Array.isArray(data.messages) && data.messages.length) || 0) + " 条消息";
      default:
        return oneLine(safeJson(data), 140);
    }
  }

  function createEventJsonDetails(entry) {
    const details = el("details", { className: "ev-json" });
    details.appendChild(el("summary", { className: "ev-json-summary", text: "展开 JSON" }));
    let built = false;
    details.addEventListener("toggle", () => {
      if (!details.open || built) return;
      built = true;
      const pre = el("pre", { className: "code ev-pre" });
      pre.textContent = safeJson(entry.data, 20_000);
      details.appendChild(pre);
    });
    return details;
  }

  function createEventRow(entry) {
    const row = el("tr", { className: "ev-row" });
    row.appendChild(el("td", { className: "ev-seq mono", text: entry.seq === null ? "—" : String(entry.seq) }));
    const typeCell = el("td", { className: "ev-type-cell" });
    typeCell.appendChild(el("span", { className: "ev-type " + eventTypeClass(entry.type), text: entry.type }));
    row.appendChild(typeCell);
    const timeCell = el("td", { className: "ev-time mono" });
    timeCell.textContent = entry.ts === null ? "—" : fmtRel(entry.ts, state.eventBaseTs);
    if (entry.ts !== null) timeCell.title = fmtClock(entry.ts) + (entry.live ? "（实时 SSE）" : "（会话记录）");
    row.appendChild(timeCell);
    const dataCell = el("td", { className: "ev-data" });
    dataCell.appendChild(el("div", { className: "ev-summary", text: summarizeEvent(entry) }));
    dataCell.appendChild(createEventJsonDetails(entry));
    row.appendChild(dataCell);
    return row;
  }

  function appendEventRow(entry) {
    dom.eventsBody.appendChild(createEventRow(entry));
    if (dom.eventsEmpty) dom.eventsEmpty.classList.toggle("hidden", dom.eventsBody.children.length > 0);
  }

  function renderEventTable() {
    dom.eventsBody.textContent = "";
    const fragment = document.createDocumentFragment();
    for (const entry of state.eventLog) fragment.appendChild(createEventRow(entry));
    dom.eventsBody.appendChild(fragment);
    if (dom.eventsEmpty) dom.eventsEmpty.classList.toggle("hidden", state.eventLog.length > 0);
    if (state.tab === "events" && !dom.eventsPause.checked) {
      dom.eventsScroll.scrollTop = dom.eventsScroll.scrollHeight;
    }
  }

  function updateEventSummary() {
    const count = state.eventLog.length;
    let lastSeq = 0;
    for (const entry of state.eventLog) {
      if (entry.seq !== null && entry.seq > lastSeq) lastSeq = entry.seq;
    }
    dom.eventsTabCount.textContent = String(count);
    dom.eventsSummary.textContent =
      count === 0
        ? "还没有事件"
        : "共 " + count + " 条事件" + (lastSeq ? " · 最新 seq " + lastSeq : "") + " · " + (isConnected() ? "SSE 已连接" : "SSE 未连接");
    dom.eventsEmpty.classList.toggle("hidden", count > 0);
  }

  function downloadEventLog() {
    const payload = {
      sessionId: state.snapshot && state.snapshot.session ? state.snapshot.session.id : null,
      exportedAt: new Date().toISOString(),
      note: "历史会话事件（state.events）+ 浏览器收到的实时 SSE 事件",
      events: state.eventLog.map((entry) => ({ seq: entry.seq, ts: entry.ts, type: entry.type, data: entry.data })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = el("a", { attrs: { href: url, download: "mini-opencode-events-" + (payload.sessionId || "session") + ".json" } });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("事件 JSON 已下载（" + state.eventLog.length + " 条）", "success");
  }

  // -------------------------------------------------------------------------
  // 9. 工具与能力 Tab
  // -------------------------------------------------------------------------

  const FLOW_STEPS = [
    {
      title: "模型调用",
      where: "agent/loop.ts · provider.stream()",
      desc:
        "先按 token 预算准备上下文（系统提示词 + 裁剪后的历史），再带上工具定义请求模型。" +
        "模型能做的只有两件事：流式输出文本，或生成 tool_calls JSON。",
      signals: ["trace.step_start", "assistant_start / assistant_delta", "thinking_delta"],
    },
    {
      title: "工具调用",
      where: "agent/loop.ts · executeToolCall() · permission.ts",
      desc:
        "拿到 tool_calls 后解析 JSON 参数 → 用 JSON Schema 校验 → 过权限三档（allow 直接放行 / ask 弹窗 / deny 拒绝），" +
        "危险 bash 命令会被强制升到 ask。校验或执行失败也会变成一条模型能看懂的 tool 结果，而不是让程序崩掉。",
      signals: ["tool_start", "permission_request", "permission_resolved"],
    },
    {
      title: "结果回填",
      where: "agent/loop.ts · role=tool 消息",
      desc:
        "每个 tool_call 都必须有一条 role=tool 的消息回应（用 tool_call_id 配对），结果才能喂回模型。" +
        "这是 OpenAI 兼容协议里最容易踩坑的地方：漏一条，下一次请求就 400。",
      signals: ["tool_end", "message(role=tool)", "下一次 trace.step_start"],
    },
    {
      title: "循环 / 终止",
      where: "agent/loop.ts · for (step = 1; step <= maxSteps; step++)",
      desc:
        "模型不再请求工具 → 认为任务完成，回合结束；还有 tool_calls → 进入下一步。默认 maxSteps=64（可改，0=不限），另有工具调用上限（默认 120）和重复调用熔断。" +
        "用户中断时，未执行的调用会补一条「被中断」的结果，保证历史永远可继续使用。",
      signals: ["trace.assistant_message", "turn_end", "turn_complete"],
    },
    {
      title: "压缩与持久化",
      where: "agent/context.ts · session.ts",
      desc:
        "每步前估算 token：超预算先让模型做摘要压缩（写一条 snapshot），再退化为裁剪工具输出。" +
        "每一步的消息、工具执行、turn_end 都追加写进 .mini-opencode/sessions/*.jsonl，可回放、可恢复、可导出。",
      signals: ["trace.context", "trace.compaction", "state.events（JSONL）"],
    },
  ];

  function renderFlow() {
    if (!dom.flow) return;
    dom.flow.textContent = "";
    FLOW_STEPS.forEach((step, index) => {
      const row = el("div", { className: "flow-step" });
      const indexEl = el("div", { className: "flow-index" });
      indexEl.appendChild(el("span", { text: String(index + 1) }));
      row.appendChild(indexEl);
      const body = el("div", { className: "flow-body" });
      const titleRow = el("div", { className: "flow-title-row" });
      titleRow.appendChild(el("h3", { className: "flow-title", text: step.title }));
      titleRow.appendChild(el("span", { className: "flow-where mono", text: step.where }));
      body.appendChild(titleRow);
      body.appendChild(el("p", { className: "flow-desc", text: step.desc }));
      const signals = el("div", { className: "flow-signals" });
      signals.appendChild(el("span", { className: "flow-signals-label", text: "界面上看：" }));
      for (const signal of step.signals) {
        signals.appendChild(el("code", { className: "signal-chip", text: signal }));
      }
      body.appendChild(signals);
      row.appendChild(body);
      dom.flow.appendChild(row);
    });
  }

  function renderToolsTab() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const tools = Array.isArray(snapshot.tools) ? snapshot.tools : [];
    dom.toolsTabCount.textContent = String(tools.length);
    dom.toolsTabInline.textContent = String(tools.length);

    dom.toolsGrid.textContent = "";
    if (!tools.length) {
      dom.toolsGrid.appendChild(el("div", { className: "empty-hint", text: "当前模式没有可用工具" }));
    }
    for (const tool of tools) {
      const card = el("article", { className: "tool-info" });
      const head = el("div", { className: "tool-info-head" });
      const category = String(tool.category || "read");
      head.appendChild(el("span", { className: "badge tool-cat " + categoryClass(category), text: category }));
      head.appendChild(el("span", { className: "tool-info-name mono", text: String(tool.name || "?") }));
      const decision = String(tool.defaultDecision || "ask");
      const decisionBadge = el("span", {
        className: "badge " + decisionClass(decision),
        text: "默认 " + decision,
        title: "该类别工具的默认权限决策（可在 permission.ts 里改）",
      });
      head.appendChild(decisionBadge);
      card.appendChild(head);
      if (tool.summary) card.appendChild(el("p", { className: "tool-info-summary", text: String(tool.summary) }));
      if (tool.description) card.appendChild(el("p", { className: "tool-info-desc", text: String(tool.description) }));
      const details = el("details", { className: "tool-schema" });
      details.appendChild(el("summary", { text: "JSON Schema（模型看到的参数定义）" }));
      const pre = el("pre", { className: "code" });
      pre.textContent = safeJson(tool.parameters, 8000);
      details.appendChild(pre);
      card.appendChild(details);
      dom.toolsGrid.appendChild(card);
    }

    const features = Array.isArray(snapshot.features) ? snapshot.features : [];
    dom.features.textContent = "";
    features.forEach((feature, index) => {
      const row = el("div", { className: "feature" });
      row.appendChild(el("span", { className: "feature-index mono", text: String(index + 1).padStart(2, "0") }));
      const body = el("div", { className: "feature-body" });
      const titleRow = el("div", { className: "feature-title" });
      titleRow.appendChild(el("span", { text: String(feature.title || "") }));
      if (feature.chapter) titleRow.appendChild(el("span", { className: "feature-chapter", text: String(feature.chapter) }));
      body.appendChild(titleRow);
      body.appendChild(el("div", { className: "feature-detail", text: String(feature.detail || "") }));
      row.appendChild(body);
      dom.features.appendChild(row);
    });

    const docs = Array.isArray(snapshot.docs) ? snapshot.docs : [];
    dom.docs.textContent = "";
    for (const doc of docs) {
      dom.docs.appendChild(el("span", { className: "doc-chip mono", text: String(doc.file || doc.title || ""), title: String(doc.title || "") }));
    }
  }

  // -------------------------------------------------------------------------
  // 10. 会话记录 Tab
  // -------------------------------------------------------------------------

  function downloadSessionExport(id, format) {
    if (!id) {
      toast("会话 id 为空", "error");
      return;
    }
    const href = "/api/session/" + encodeURIComponent(id) + "/export?format=" + encodeURIComponent(format);
    const anchor = el("a", { attrs: { href } });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast("开始下载 " + (format === "md" ? "Markdown" : "JSONL") + " · " + id, "info");
  }

  function renderSessionsTab() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const current = snapshot.session || {};
    const sessions = visibleSessions();
    const currentSummary = allSessions().find((session) => session.id === current.id);
    const currentArchived = Boolean(currentSummary && currentSummary.archived);
    dom.sessionsTabCount.textContent = String(sessions.length);
    dom.sessionsPanel.textContent = "";

    const currentBlock = el("section", { className: "block" });
    currentBlock.appendChild(el("h2", { className: "block-title", text: "当前会话" }));
    const detail = el("div", { className: "session-detail" });
    detail.appendChild(kvRow("会话 id", String(current.id || "—"), true));
    detail.appendChild(kvRow("标题", String(current.title || "(空会话)"), false));
    detail.appendChild(kvRow("创建时间", String(current.createdAt || "—"), true));
    detail.appendChild(kvRow("文件", String(current.file || "—"), true));
    detail.appendChild(kvRow("消息数", String(state.stats.messageCount), false));
    if (currentArchived) detail.appendChild(kvRow("状态", "已归档（文件保留，可恢复）", false));
    const actions = el("div", { className: "session-detail-actions" });
    const loadCurrent = el("button", { className: "btn small", attrs: { type: "button" }, text: "重新载入" });
    loadCurrent.addEventListener("click", () => loadSession(String(current.id)));
    const jsonl = el("button", { className: "btn small", attrs: { type: "button" }, text: "导出 JSONL" });
    jsonl.addEventListener("click", () => downloadSessionExport(String(current.id), "jsonl"));
    const md = el("button", { className: "btn small", attrs: { type: "button" }, text: "导出 MD" });
    md.addEventListener("click", () => downloadSessionExport(String(current.id), "md"));
    const archiveCurrent = el("button", {
      className: "btn small",
      attrs: { type: "button" },
      text: currentArchived ? "取消归档" : "归档",
      title: currentArchived ? "把当前会话放回历史列表" : "从历史列表隐藏当前会话（文件保留）",
    });
    archiveCurrent.addEventListener("click", () => setSessionArchived(current.id, !currentArchived));
    actions.appendChild(loadCurrent);
    actions.appendChild(jsonl);
    actions.appendChild(md);
    actions.appendChild(archiveCurrent);
    detail.appendChild(actions);
    currentBlock.appendChild(detail);
    dom.sessionsPanel.appendChild(currentBlock);

    const listBlock = el("section", { className: "block" });
    const listTitle = el("h2", { className: "block-title", text: "历史会话（" + sessions.length + "）" });
    const toggle = el("button", {
      className: "link-btn",
      attrs: { type: "button" },
      text: (state.showArchived ? "隐藏归档" : "显示归档") + " (" + archivedCount() + ")",
      title: "已归档的会话不会删除，随时可以恢复",
    });
    toggle.addEventListener("click", toggleArchived);
    listTitle.appendChild(toggle);
    listBlock.appendChild(listTitle);
    listBlock.appendChild(
      el("p", {
        className: "block-desc",
        text: "每个会话对应 .mini-opencode/sessions/<id>.jsonl，一行一个事件；归档只是从列表隐藏，删除才会真正移除文件。JSONL 适合回放/程序处理，Markdown 适合阅读和分享。",
      }),
    );
    if (!sessions.length) {
      listBlock.appendChild(
        el("div", {
          className: "empty-hint",
          text: archivedCount() ? "没有未归档会话（点“显示归档”查看已归档项）" : "还没有历史会话",
        }),
      );
    } else {
      const table = el("div", { className: "session-table" });
      const header = el("div", { className: "session-table-row header" });
      header.appendChild(el("span", { text: "会话" }));
      header.appendChild(el("span", { text: "消息" }));
      header.appendChild(el("span", { text: "更新时间" }));
      header.appendChild(el("span", { text: "操作" }));
      table.appendChild(header);
      for (const session of sessions) {
        const active = session.id === current.id;
        const row = el(
          "div",
          { className: "session-table-row" + (active ? " active" : "") + (session.archived ? " archived" : "") },
        );
        const info = el("div", { className: "session-table-info" });
        info.appendChild(el("span", { className: "session-table-title", text: String(session.title || "(空会话)") }));
        info.appendChild(el("span", { className: "session-table-id mono", text: String(session.id || "") }));
        if (session.archived) {
          info.appendChild(el("span", { className: "session-table-flag", text: "已归档" }));
        }
        row.appendChild(info);
        row.appendChild(el("span", { className: "session-table-count mono", text: String(session.messageCount || 0) }));
        row.appendChild(el("span", { className: "session-table-time mono", text: fmtAgo(session.updatedAt), title: String(session.updatedAt || "") }));
        const ops = el("div", { className: "session-table-ops" });
        const load = el("button", { className: "btn tiny" + (active ? " active" : ""), attrs: { type: "button" }, text: active ? "当前" : "载入" });
        load.addEventListener("click", () => loadSession(String(session.id)));
        const archive = el("button", {
          className: "btn tiny",
          attrs: { type: "button" },
          text: session.archived ? "恢复" : "归档",
          title: session.archived ? "取消归档" : "从列表隐藏，文件保留",
        });
        archive.addEventListener("click", () => setSessionArchived(session.id, !session.archived));
        const dlJsonl = el("button", { className: "btn tiny", attrs: { type: "button" }, text: "导出 JSONL", title: "下载原始事件流" });
        dlJsonl.addEventListener("click", () => downloadSessionExport(String(session.id), "jsonl"));
        const dlMd = el("button", { className: "btn tiny", attrs: { type: "button" }, text: "导出 MD", title: "下载 Markdown 阅读版" });
        dlMd.addEventListener("click", () => downloadSessionExport(String(session.id), "md"));
        ops.appendChild(load);
        ops.appendChild(archive);
        ops.appendChild(dlJsonl);
        ops.appendChild(dlMd);
        if (!active) {
          const remove = el("button", {
            className: "btn tiny danger",
            attrs: { type: "button" },
            text: "删除",
            title: "永久删除会话文件（不可恢复）",
          });
          remove.addEventListener("click", () => deleteSession(String(session.id), String(session.title || "")));
          ops.appendChild(remove);
        }
        row.appendChild(ops);
        table.appendChild(row);
      }
      listBlock.appendChild(table);
    }
    dom.sessionsPanel.appendChild(listBlock);
  }

  // -------------------------------------------------------------------------
  // 11. 快照接入（hello / state / 轮询刷新）
  // -------------------------------------------------------------------------

  function adoptSnapshot(snapshot, options) {
    if (!snapshot || typeof snapshot !== "object") return;
    const opts = Object.assign(
      { reseedEvents: true, resetLive: true, preserveStream: false },
      options || {},
    );

    state.snapshot = snapshot;
    state.busy = Boolean(snapshot.busy);
    state.stopping = false;
    state.stats.budget = Number((snapshot.config && snapshot.config.contextBudget) || 0) || 224_000;

    // 工作区 / 三级权限：新字段优先，旧字段（cwd、yolo、acceptEdits）兜底。
    const workspace = snapshot.workspace && typeof snapshot.workspace === "object" ? snapshot.workspace : null;
    state.workspacePath = String((workspace && workspace.path) || snapshot.cwd || "");
    state.permissionLevel = normalizePermissionLevel(snapshot);

    if (opts.reseedEvents) seedEventLog(snapshot.events || []);
    if (opts.resetLive) resetLiveDom();
    if (!opts.preserveStream) resetStream();

    seedPendingApprovals(Array.isArray(snapshot.pendingApprovals) ? snapshot.pendingApprovals : []);
    recomputeStatsFromSnapshot();
    rebuildConversation();
    renderHeader();
    renderCurrentSession();
    renderSessionList();
    renderStats();
    renderTodos();
    renderToolsTab();
    renderSessionsTab();
    updateComposer();
    updateEventSummary();
    renderChatMeta();
    renderChatStatus();
  }

  async function refreshState(options) {
    const opts = Object.assign({ reseedEvents: false, preserveStream: false }, options || {});
    try {
      const payload = await apiGet("/api/state");
      adoptSnapshot(payload.state, opts);
      return payload.state;
    } catch (err) {
      toast("拉取 /api/state 失败：" + err.message, "error");
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 12. 权限审批
  // -------------------------------------------------------------------------

  function seedPendingApprovals(list) {
    const map = new Map();
    for (const item of list) {
      if (!item || !item.id) continue;
      map.set(String(item.id), {
        id: String(item.id),
        toolName: String(item.toolName || "?"),
        detail: String(item.detail || ""),
        danger: item.danger ? String(item.danger) : null,
      });
    }
    state.pending = map;
    if (map.size > 0) {
      const first = Array.from(map.values())[0];
      openApprovalModal(first);
    } else if (modal.kind === "approval") {
      closeModal();
    }
    updateComposer();
  }

  function showApprovalModal(approval) {
    if (modal.kind === "approval") {
      if (modal.id === approval.id) return;
      // 已有审批弹窗时不覆盖，等前一个处理完再显示下一个
      return;
    }
    openApprovalModal(approval);
  }

  function openNextApproval() {
    if (state.pending.size === 0) return;
    const next = Array.from(state.pending.values())[0];
    openApprovalModal(next);
  }

  function openApprovalModal(approval) {
    if (modal.el) closeModal();
    const category = toolCategory(approval.toolName);
    const body = [];
    const headRow = el("div", { className: "approval-modal-head" });
    headRow.appendChild(el("span", { className: "badge tool-cat " + categoryClass(category), text: category }));
    headRow.appendChild(el("span", { className: "approval-modal-tool mono", text: approval.toolName }));
    headRow.appendChild(el("span", { className: "approval-modal-queue", text: "待处理 " + state.pending.size + " 个" }));
    body.push(headRow);

    if (approval.danger) {
      const danger = el("div", { className: "danger-box" });
      danger.appendChild(el("span", { className: "danger-icon", text: "⚠" }));
      danger.appendChild(el("span", { text: "危险命令：" + approval.danger }));
      body.push(danger);
    }

    body.push(el("div", { className: "modal-label", text: "工具参数（JSON）" }));
    const pre = el("pre", { className: "code approval-json" });
    pre.textContent = approval.detail || "（无参数）";
    body.push(pre);
    body.push(
      el("div", {
        className: "modal-note",
        text: "Agent 正在等待你的决定：允许后执行；拒绝会把「用户拒绝」作为工具结果喂回模型；10 分钟不处理会自动拒绝。「始终允许」只对非危险工具生效，危险命令仍会逐次询问。",
      }),
    );

    const actions = [];
    // 审批弹窗是全屏模态（背板会盖住顶栏的「停止」按钮），
    // 所以这里必须提供一个中断入口：服务端 abortRun() 会把挂起审批按“拒绝”解开。
    const abortTurn = el("button", {
      className: "btn",
      attrs: { type: "button" },
      text: "中断回合",
      title: "中断当前回合（挂起的审批会按“拒绝”处理）",
    });
    abortTurn.addEventListener("click", () => void stopRun());
    actions.push(abortTurn);
    const reject = el("button", { className: "btn", attrs: { type: "button" }, text: "拒绝" });
    reject.addEventListener("click", () => submitApproval(approval.id, "no", [reject, always, allow]));
    const always = el("button", {
      className: "btn",
      attrs: { type: "button" },
      text: "始终允许",
      title: "本会话内该工具不再询问（危险命令除外）",
    });
    always.addEventListener("click", () => submitApproval(approval.id, "always", [reject, always, allow]));
    const allow = el("button", { className: "btn primary", attrs: { type: "button" }, text: "允许" });
    allow.addEventListener("click", () => submitApproval(approval.id, "yes", [reject, always, allow]));
    actions.push(reject, always, allow);

    openModal("approval", approval.id, "权限审批", body, actions, false);
    setTimeout(() => allow.focus(), 30);
  }

  async function submitApproval(id, decision, buttons) {
    if (state.approvalPending) return;
    state.approvalPending = true;
    for (const button of buttons) button.disabled = true;
    try {
      await apiPost("/api/approval", { id, decision });
      state.pending.delete(id);
      if (modal.kind === "approval" && modal.id === id) {
        closeModal();
        openNextApproval();
      }
      updateComposer();
    } catch (err) {
      toast("提交审批失败：" + err.message, "error");
      for (const button of buttons) button.disabled = false;
    } finally {
      state.approvalPending = false;
    }
  }

  // -------------------------------------------------------------------------
  // 13. 模态框（配置 / 审批通用）
  // -------------------------------------------------------------------------

  const MODAL_KIND_LABEL = { approval: "PERMISSION", workspace: "WORKSPACE", config: "CONFIG", stats: "STATS" };

  function openModal(kind, id, title, bodyNodes, actionNodes, dismissible) {
    if (modal.el) closeModal();
    const backdrop = el("div", { className: "modal-backdrop" });
    const card = el("div", { className: "modal modal-" + kind });
    const head = el("div", { className: "modal-head" });
    head.appendChild(el("span", { className: "modal-kind", text: MODAL_KIND_LABEL[kind] || "CONFIG" }));
    head.appendChild(el("h3", { className: "modal-title", text: title }));
    if (dismissible) {
      const close = el("button", { className: "modal-close", attrs: { type: "button", "aria-label": "关闭" }, text: "✕" });
      close.addEventListener("click", () => closeModal());
      head.appendChild(close);
    }
    card.appendChild(head);
    const body = el("div", { className: "modal-body" });
    for (const node of bodyNodes) if (node) body.appendChild(node);
    card.appendChild(body);
    const foot = el("div", { className: "modal-foot" });
    for (const node of actionNodes) if (node) foot.appendChild(node);
    card.appendChild(foot);
    backdrop.appendChild(card);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && dismissible) closeModal();
    });
    dom.modalRoot.appendChild(backdrop);
    modal.el = backdrop;
    modal.kind = kind;
    modal.id = id;
    modal.dismissible = Boolean(dismissible);
  }

  function closeModal() {
    if (modal.el) modal.el.remove();
    modal.el = null;
    modal.kind = null;
    modal.id = null;
    modal.dismissible = false;
  }

  function buildConfigBody() {
    const snapshot = state.snapshot || {};
    const config = snapshot.config || {};
    const nodes = [];
    if (config.providerError) {
      const box = el("div", { className: "danger-box" });
      box.appendChild(el("span", { className: "danger-icon", text: "⚠" }));
      box.appendChild(el("span", { text: "模型当前不可用：" + config.providerError }));
      nodes.push(box);
    }
    const status = el("div", { className: "config-status" });
    status.appendChild(el("span", { className: "kv-label", text: "API key" }));
    status.appendChild(
      el("span", {
        className: "kv-value mono",
        text: config.hasApiKey ? "已配置 · " + (config.apiKeyMasked || "***") : "未配置",
      }),
    );
    nodes.push(status);

    const keyField = el("label", { className: "field" });
    keyField.appendChild(el("span", { className: "field-label", text: "API key（留空表示不修改）" }));
    const keyInput = el("input", {
      className: "input mono",
      attrs: {
        type: "password",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: config.hasApiKey ? "留空保持现有 key（" + (config.apiKeyMasked || "***") + "）" : "sk-…（没有 key 时请勾选 mock）",
      },
    });
    keyField.appendChild(keyInput);
    nodes.push(keyField);

    const baseUrlField = el("label", { className: "field" });
    baseUrlField.appendChild(el("span", { className: "field-label", text: "baseUrl（OpenAI 兼容接口地址）" }));
    const baseUrlInput = el("input", { className: "input mono", attrs: { type: "text", spellcheck: "false" } });
    baseUrlInput.value = String(config.baseUrl || "");
    baseUrlField.appendChild(baseUrlInput);
    nodes.push(baseUrlField);

    const modelField = el("label", { className: "field" });
    modelField.appendChild(el("span", { className: "field-label", text: "model" }));
    const modelInput = el("input", { className: "input mono", attrs: { type: "text", spellcheck: "false" } });
    modelInput.value = String(config.model || "");
    modelField.appendChild(modelInput);
    nodes.push(modelField);

    const temperatureField = el("label", { className: "field" });
    temperatureField.appendChild(
      el("span", {
        className: "field-label",
        text: "temperature（0~2；Agent 建议 0~0.3，越大越发散；推理模型可能忽略）",
      }),
    );
    const temperatureInput = el("input", {
      className: "input mono",
      attrs: { type: "number", min: "0", max: "2", step: "0.1", spellcheck: "false" },
    });
    temperatureInput.value = String(config.temperature ?? 0.2);
    temperatureField.appendChild(temperatureInput);
    nodes.push(temperatureField);

    const budgetField = el("label", { className: "field" });
    budgetField.appendChild(
      el("span", {
        className: "field-label",
        text: "contextBudget（上下文预算 tokens；超过才触发摘要压缩/裁剪）",
      }),
    );
    const budgetInput = el("input", {
      className: "input mono",
      attrs: { type: "number", min: "1000", max: "2000000", step: "1000", spellcheck: "false" },
    });
    budgetInput.value = String(config.contextBudget ?? 224000);
    budgetField.appendChild(budgetInput);
    nodes.push(budgetField);

    const effortField = el("label", { className: "field" });
    effortField.appendChild(
      el("span", {
        className: "field-label",
        text: "reasoningEffort（推理强度；仅部分模型/网关支持，default 表示不发送）",
      }),
    );
    const effortSelect = el("select", { className: "input mono" });
    for (const [value, label] of [
      ["default", "default（默认）"],
      ["low", "low（低）"],
      ["medium", "medium（中）"],
      ["high", "high（高）"],
      ["max", "max（最高）"],
    ]) {
      const option = el("option", { text: label });
      option.value = value;
      effortSelect.appendChild(option);
    }
    effortSelect.value = String(config.reasoningEffort || "default");
    effortField.appendChild(effortSelect);
    nodes.push(effortField);

    const mockField = el("label", { className: "check field-check" });
    const mockInput = el("input", { attrs: { type: "checkbox" } });
    mockInput.checked = Boolean(config.mock);
    mockField.appendChild(mockInput);
    mockField.appendChild(el("span", { text: "mock 模式（离线演示：不联网、不花钱，但 Agent 全链路是真的）" }));
    nodes.push(mockField);

    const persistField = el("label", { className: "check field-check" });
    const persistInput = el("input", { attrs: { type: "checkbox" } });
    persistInput.checked = true;
    persistField.appendChild(persistInput);
    persistField.appendChild(
      el("span", { text: "保存到 .env（重启后不用重填 key；.env 已在 .gitignore，权限 0600）" }),
    );
    nodes.push(persistField);

    const maxStepsField = el("label", { className: "field" });
    maxStepsField.appendChild(
      el("span", {
        className: "field-label",
        text: "maxSteps（单回合模型步数；0 = 不限，靠工具上限/熔断/停止 兜底）",
      }),
    );
    const maxStepsInput = el("input", {
      className: "input mono",
      attrs: { type: "number", min: "0", max: "10000", step: "1", spellcheck: "false" },
    });
    maxStepsInput.value = String(config.maxSteps ?? 64);
    maxStepsField.appendChild(maxStepsInput);
    nodes.push(maxStepsField);

    const maxToolCallsField = el("label", { className: "field" });
    maxToolCallsField.appendChild(
      el("span", {
        className: "field-label",
        text: "maxToolCalls（单回合工具调用上限；0 = 不限，到线暂停并让模型收尾）",
      }),
    );
    const maxToolCallsInput = el("input", {
      className: "input mono",
      attrs: { type: "number", min: "0", max: "10000", step: "1", spellcheck: "false" },
    });
    maxToolCallsInput.value = String(config.maxToolCalls ?? 0);
    maxToolCallsField.appendChild(maxToolCallsInput);
    nodes.push(maxToolCallsField);

    // 安全提示必须跟着「保存到 .env」的勾选状态走：
    // 这个弹窗默认勾选保存，如果文案还写死“不落盘”，就是在骗用户。
    const safetyNote = el("div", { className: "modal-note" });
    const updateSafetyNote = () => {
      safetyNote.textContent = persistInput.checked
        ? "安全提示：勾选「保存到 .env」后，API key 会以 0600 权限写入项目根目录 .env（已在 .gitignore，不会提交），服务重启后继续可用；页面不回显完整 key。本页面默认只监听 127.0.0.1。"
        : "安全提示：未勾选保存时，API key 只保存在服务进程内存里，不落盘、不回显完整值，服务重启后需要重新填写。本页面默认只监听 127.0.0.1。";
    };
    persistInput.addEventListener("change", updateSafetyNote);
    updateSafetyNote();
    nodes.push(safetyNote);

    return {
      nodes,
      keyInput,
      baseUrlInput,
      modelInput,
      mockInput,
      persistInput,
      effortSelect,
      temperatureInput,
      budgetInput,
      maxStepsInput,
      maxToolCallsInput,
    };
  }

  function openConfigModal() {
    if (state.busy) {
      toast("运行中不能改模型配置，等回合结束再试", "warn");
      return;
    }
    const form = buildConfigBody();
    const actions = [];
    const cancel = el("button", { className: "btn", attrs: { type: "button" }, text: "取消" });
    cancel.addEventListener("click", () => closeModal());
    const save = el("button", { className: "btn primary", attrs: { type: "button" }, text: "保存配置" });
    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "保存中…";
      const body = {
        mock: form.mockInput.checked,
        persist: form.persistInput.checked,
        reasoningEffort: form.effortSelect.value,
      };
      const key = form.keyInput.value.trim();
      if (key) body.apiKey = key;
      const baseUrl = form.baseUrlInput.value.trim();
      if (baseUrl) body.baseUrl = baseUrl;
      const model = form.modelInput.value.trim();
      if (model) body.model = model;
      const temperatureRaw = form.temperatureInput.value.trim();
      if (temperatureRaw !== "") {
        const temperature = Number(temperatureRaw);
        if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
          toast("temperature 需要 0~2 之间的数字（0 也合法）", "warn");
          save.disabled = false;
          save.textContent = "保存配置";
          return;
        }
        body.temperature = temperature;
      }
      const budgetRaw = form.budgetInput.value.trim();
      if (budgetRaw !== "") {
        const contextBudget = Number(budgetRaw);
        if (!Number.isInteger(contextBudget) || contextBudget < 1000 || contextBudget > 2_000_000) {
          toast("contextBudget 需要 1000~2000000 之间的整数", "warn");
          save.disabled = false;
          save.textContent = "保存配置";
          return;
        }
        body.contextBudget = contextBudget;
      }
      const maxStepsRaw = form.maxStepsInput.value.trim();
      if (maxStepsRaw !== "") {
        const maxSteps = Number(maxStepsRaw);
        if (!Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 10000) {
          toast("maxSteps 需要 0~10000 的整数（0=不限）", "warn");
          save.disabled = false;
          save.textContent = "保存配置";
          return;
        }
        body.maxSteps = maxSteps;
      }
      const maxToolCallsRaw = form.maxToolCallsInput.value.trim();
      if (maxToolCallsRaw !== "") {
        const maxToolCalls = Number(maxToolCallsRaw);
        if (!Number.isInteger(maxToolCalls) || maxToolCalls < 0 || maxToolCalls > 10000) {
          toast("maxToolCalls 需要 0~10000 的整数（0=不限）", "warn");
          save.disabled = false;
          save.textContent = "保存配置";
          return;
        }
        body.maxToolCalls = maxToolCalls;
      }
      try {
        const payload = await apiPost("/api/config", body);
        if (state.snapshot) state.snapshot.config = payload.config || state.snapshot.config;
        closeModal();
        renderHeader();
        updateComposer();
        toast(
          form.persistInput.checked
            ? "配置已更新，并保存到 .env（重启后仍可用）"
            : "配置已更新（key 只保存在进程内存，重启会丢）",
          "success",
        );
      } catch (err) {
        toast("保存配置失败：" + err.message, "error");
        save.disabled = false;
        save.textContent = "保存配置";
      }
    });
    actions.push(cancel, save);
    openModal("config", null, "模型配置", form.nodes, actions, true);
    setTimeout(() => form.keyInput.focus(), 30);
  }

  // -------------------------------------------------------------------------
  // 14. SSE
  // -------------------------------------------------------------------------

  let eventSource = null;
  /** 后端重启后 EventSource 会进入 CLOSED（浏览器规范：不再自动重连），这里自己指数退避重建。 */
  let sseRetryTimer = null;
  let sseRetryDelay = 1000;
  const SSE_RETRY_MAX_DELAY = 10000;

  function scheduleSseReconnect() {
    if (sseRetryTimer) return;
    const delay = sseRetryDelay;
    sseRetryDelay = Math.min(sseRetryDelay * 2, SSE_RETRY_MAX_DELAY);
    sseRetryTimer = setTimeout(() => {
      sseRetryTimer = null;
      connectSSE();
    }, delay);
  }

  function clearSseReconnect() {
    if (sseRetryTimer) {
      clearTimeout(sseRetryTimer);
      sseRetryTimer = null;
    }
  }

  function connectSSE() {
    clearSseReconnect();
    if (eventSource) {
      try {
        eventSource.close();
      } catch {
        /* ignore */
      }
    }
    setConn("connecting");
    try {
      eventSource = new EventSource("/api/events");
    } catch (err) {
      setConn("offline");
      toast("无法创建 EventSource：" + (err && err.message ? err.message : err), "error");
      return;
    }
    eventSource.onopen = () => {
      sseRetryDelay = 1000; // 连上了就把退避重置，下次断线从 1s 开始
      setConn("open");
    };
    eventSource.onerror = () => {
      if (!eventSource) return;
      if (eventSource.readyState === EventSource.CLOSED) {
        // 502/代理断开会让 EventSource 永久关闭；不清空引用的话
        // 面板会一直显示“已断开”，点重试也没用，只能刷新页面。
        setConn("offline");
        try {
          eventSource.close();
        } catch {
          /* ignore */
        }
        eventSource = null;
        scheduleSseReconnect();
      } else {
        setConn("reconnecting");
      }
    };
    eventSource.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") return;
      const type = String(payload.type || "");
      const data = payload.data && typeof payload.data === "object" ? payload.data : {};
      try {
        handleSseEvent(type, data, payload);
      } catch (err) {
        console.error("处理 SSE 事件失败:", type, err);
      }
    };
  }

  function handleSseEvent(type, data, raw) {
    if (type === "hello") {
      const wasReconnect = state.hadConnected && state.conn !== "open";
      setConn("open");
      // 通知外壳（offline-guard.js）：后端已恢复，可以把"未连接"提示条撤掉。
      // 提示条自己的重试是有限次的，如果后端启动较慢，光靠它可能一直挂着过期提示。
      try {
        window.dispatchEvent(new CustomEvent("agent-backend-online"));
      } catch {
        /* ignore */
      }
      state.hadConnected = true;
      adoptSnapshot(data.state, {
        reseedEvents: true,
        resetLive: true,
        preserveStream: Boolean(data.state && data.state.busy && state.stream.active),
      });
      ingestLiveEvent(raw);
      if (wasReconnect) toast("已重新连接，已用最新快照对齐状态", "success");
      return;
    }

    if (type === "state") {
      adoptSnapshot(data.state, { reseedEvents: true, resetLive: true, preserveStream: false });
      ingestLiveEvent(raw);
      return;
    }

    ingestLiveEvent(raw);

    switch (type) {
      case "user_message":
        setBusy(true);
        onUserMessage(data);
        break;
      case "run_state":
        setBusy(Boolean(data.busy));
        break;
      case "run_start":
        // 新回合开始：重置“本回合”统计（消息数是累计的，不重置）
        state.telemetry.runStartedAt = Date.now();
        state.telemetry.firstTokenAt = null;
        state.telemetry.liveContext = null;
        state.stats.steps = 0;
        state.stats.step = 0;
        state.stats.promptTokens = 0;
        state.stats.completionTokens = 0;
        state.stats.durationMs = 0;
        state.stats.toolCalls = 0;
        state.stats.aborted = false;
        state.stats.hitStepLimit = false;
        state.stats.toolDenials = 0;
        renderStats();
        renderChatMeta();
        break;
      case "assistant_start":
        onAssistantStart();
        break;
      case "assistant_delta":
        if (!state.telemetry.firstTokenAt) state.telemetry.firstTokenAt = Date.now();
        onAssistantDelta(String(data.text || ""));
        break;
      case "thinking_delta":
        if (!state.telemetry.firstTokenAt) state.telemetry.firstTokenAt = Date.now();
        onThinkingDelta(String(data.text || ""));
        break;
      case "assistant_end":
        onAssistantEnd();
        break;
      case "tool_start":
        onToolStart(data);
        break;
      case "tool_end":
        onToolEnd(data);
        break;
      case "permission_request":
        onPermissionRequest(data);
        break;
      case "permission_resolved":
        onPermissionResolved(data);
        break;
      case "notice":
        onNotice(String(data.message || ""), "info");
        break;
      case "info":
        onNotice(String(data.message || ""), "info");
        break;
      case "error":
        onError(String(data.message || "未知错误"));
        break;
      case "trace":
        onTrace(data);
        break;
      case "turn_end":
        if (state.telemetry.runStartedAt && state.telemetry.firstTokenAt) {
          state.telemetry.lastTtftMs = state.telemetry.firstTokenAt - state.telemetry.runStartedAt;
        }
        onTurnEnd(data);
        renderChatStatus();
        break;
      case "usage":
        onUsage(data);
        break;
      case "sessions":
        if (state.snapshot) {
          state.snapshot.sessions = Array.isArray(data.sessions) ? data.sessions : [];
          renderSessionList();
          renderSessionsTab();
        }
        break;
      case "todos":
        if (state.snapshot) {
          state.snapshot.todos = Array.isArray(data.todos) ? data.todos : [];
          renderTodos();
        }
        break;
      case "config":
        if (state.snapshot) {
          state.snapshot.config = data;
          renderHeader();
          renderStats();
        }
        break;
      case "mode":
        if (state.snapshot) {
          state.snapshot.mode = data.mode === "plan" ? "plan" : "build";
          renderHeader();
        }
        break;
      case "yolo":
        if (state.snapshot) {
          state.snapshot.yolo = Boolean(data.value);
          // 旧事件也要同步三级权限：yolo 开 = 全自动；
          // 注意不能直接 normalize（它会优先读旧的 permissionLevel），要从两个旧布尔重新推。
          state.snapshot.permissionLevel = permissionLevelFromLegacy(state.snapshot);
          state.permissionLevel = state.snapshot.permissionLevel;
          renderHeader();
        }
        break;
      case "accept_edits":
        if (state.snapshot) {
          state.snapshot.acceptEdits = Boolean(data.value);
          state.snapshot.permissionLevel = permissionLevelFromLegacy(state.snapshot);
          state.permissionLevel = state.snapshot.permissionLevel;
          renderHeader();
        }
        break;
      case "permission":
        // 三级权限变化：新事件带 {level}
        if (state.snapshot) {
          if (data && PERMISSION_LEVELS.indexOf(data.level) >= 0) {
            state.snapshot.permissionLevel = data.level;
          }
          state.permissionLevel = normalizePermissionLevel(state.snapshot);
          renderHeader();
        }
        break;
      case "workspace":
        // 工作区切换：{path}
        if (data && typeof data.path === "string") {
          state.workspacePath = data.path;
          if (state.snapshot) state.snapshot.workspace = { path: data.path };
          renderComposerBar();
          renderChatMeta();
        }
        break;
      case "turn_complete":
        void onTurnComplete(data);
        break;
      default:
        break;
    }
  }

  function onTrace(data) {
    const inner = String(data.type || "");
    if (inner === "step_start") {
      onStepStart(data);
    } else if (inner === "context") {
      state.stats.contextTokens = Number(data.tokens) || state.stats.contextTokens;
      state.stats.budget = Number(data.budget) || state.stats.budget;
      state.telemetry.liveContext = {
        tokens: Number(data.tokens) || state.stats.contextTokens,
        budget: Number(data.budget) || state.stats.budget,
      };
      renderStats();
    } else if (inner === "compaction") {
      renderStats();
    }
  }

  function onUsage(data) {
    state.stats.promptTokens = Number(data.promptTokens) || 0;
    state.stats.completionTokens = Number(data.completionTokens) || 0;
    state.stats.steps = Number(data.steps) || state.stats.steps;
    state.stats.durationMs = Number(data.durationMs) || state.stats.durationMs;
    renderStats();
  }

  async function onTurnComplete() {
    setBusy(false);
    await refreshState({ reseedEvents: false, preserveStream: false });
    renderChatMeta();
    renderStats();
  }

  function setBusy(value) {
    const next = Boolean(value);
    if (next === state.busy) {
      updateComposer();
      return;
    }
    state.busy = next;
    if (state.busy) {
      state.stopping = false;
    }
    renderHeader();
    updateComposer();
    renderChatMeta();
  }

  // -------------------------------------------------------------------------
  // 15. 操作：发送 / 中断 / 配置 / 模式 / yolo / 会话 / 压缩
  // -------------------------------------------------------------------------

  async function sendMessage() {
    const text = dom.input.value.trim();
    const images = state.attachments.map((item) => ({ name: item.name, dataUrl: item.dataUrl }));
    // 允许“只发图片、不写字”，但不允许完全空发送。
    if (!text && !images.length) {
      toast("先输入一句话，或者添加一张图片再发送", "warn");
      dom.input.focus();
      return;
    }
    if (state.busy) {
      toast("上一回合还在运行，等它结束或点「停止」中断", "warn");
      return;
    }
    if (state.pending.size > 0) {
      toast("有权限审批待处理，请先在弹窗里做决定", "warn");
      return;
    }
    if (!isConnected()) {
      toast("事件流还没连接上，稍等重连（页面会自动重试）", "warn");
      return;
    }
    state.sending = true;
    updateComposer();
    try {
      const body = { text };
      if (images.length) body.images = images;
      await apiPost("/api/message", body);
      dom.input.value = "";
      autoGrowInput();
      clearAttachments();
      state.busy = true;
      renderHeader();
      updateComposer();
      scrollToBottom(dom.chatLog, true);
    } catch (err) {
      toast("发送失败：" + err.message, "error");
    } finally {
      state.sending = false;
      updateComposer();
    }
  }

  async function stopRun() {
    if (!state.busy || state.stopping) return;
    state.stopping = true;
    renderHeader();
    try {
      await apiPost("/api/abort", {});
      toast("已请求中断，等待当前工具结束…", "info");
    } catch (err) {
      state.stopping = false;
      renderHeader();
      toast("中断失败：" + err.message, "error");
    }
  }

  async function switchMode(mode) {
    if (state.busy) {
      toast("运行中不能切换模式", "warn");
      return;
    }
    if (state.snapshot && state.snapshot.mode === mode) return;
    try {
      await apiPost("/api/mode", { mode });
      if (state.snapshot) state.snapshot.mode = mode;
      renderHeader();
      toast("已切到 " + mode + " 模式" + (mode === "plan" ? "（只读：没有 write/edit/bash）" : ""), "info");
      await refreshState({ reseedEvents: false });
    } catch (err) {
      toast("切换模式失败：" + err.message, "error");
    }
  }

  /**
   * 切换推理强度。
   *
   * 为什么要有这个函数而不复用配置弹窗？
   * 弹窗要“打开 → 找到字段 → 保存”三步，而推理强度是**对话中会随手调**的东西
   * （任务难就调高，闲聊调低省钱），所以放进顶栏一步到位。
   *
   * 值直接透传给 API 的 `reasoning_effort`；选“默认”则不发送该字段，
   * 让各家 provider 用自己的默认行为（有些网关只认 low/medium/high，发 "default" 会 400）。
   */
  async function setReasoningEffort(effort) {
    if (state.busy) {
      toast("运行中不能改推理强度", "warn");
      renderHeader();
      return;
    }
    const allowed = ["default", "low", "medium", "high", "max"];
    if (!allowed.includes(String(effort))) {
      toast("推理强度只能是 " + allowed.join(" / "), "warn");
      return;
    }
    try {
      const payload = await apiPost("/api/config", { reasoningEffort: effort });
      const cfg = payload && payload.config ? payload.config : null;
      if (cfg && state.snapshot) state.snapshot.config = cfg;
      renderHeader();
      toast(effort === "default" ? "推理强度：默认（不发送 reasoning_effort）" : "推理强度：" + effort, "info");
    } catch (err) {
      toast("改推理强度失败：" + err.message, "error");
      renderHeader();
    }
  }

  async function newSession() {
    if (state.busy) {
      toast("运行中不能新建会话", "warn");
      return;
    }
    try {
      const beforeId = state.snapshot && state.snapshot.session ? state.snapshot.session.id : null;
      const payload = await apiPost("/api/session", { id: null });
      const afterId = payload.state && payload.state.session ? payload.state.session.id : null;
      adoptSnapshot(payload.state, { reseedEvents: true, resetLive: true, preserveStream: false });
      renderChatMeta();
      toast(beforeId && afterId === beforeId ? "当前会话还是空的，已继续使用" : "已新建会话", "info");
    } catch (err) {
      toast("新建会话失败：" + err.message, "error");
    }
  }

  async function loadSession(id) {
    if (!id) return;
    if (state.busy) {
      toast("运行中不能切换会话，先点「停止」或等回合结束", "warn");
      return;
    }
    try {
      const payload = await apiPost("/api/session", { id });
      adoptSnapshot(payload.state, { reseedEvents: true, resetLive: true, preserveStream: false });
      renderChatMeta();
      toast("已载入会话 " + id, "success");
    } catch (err) {
      toast("载入会话失败：" + err.message, "error");
    }
  }

  async function compactContext() {
    if (state.busy) {
      toast("运行中不能压缩上下文", "warn");
      return;
    }
    dom.compactBtn.disabled = true;
    const original = dom.compactBtn.textContent;
    dom.compactBtn.textContent = "压缩中…";
    try {
      const payload = await apiPost("/api/compact", {});
      if (payload && payload.ok === false) {
        toast("压缩失败：" + (payload.error || "未知原因"), "error");
      } else if (payload && payload.ok) {
        toast(
          "已压缩上下文：约 " + String(payload.before ?? "?") + " → " + String(payload.after ?? "?") + " tokens",
          "success",
        );
      } else {
        toast("已请求压缩", "info");
      }
    } catch (err) {
      toast("压缩失败：" + err.message, "error");
    } finally {
      dom.compactBtn.textContent = original;
      updateComposer();
    }
  }

  // -------------------------------------------------------------------------
  // 16. Tab / 输入框
  // -------------------------------------------------------------------------

  // ---- 简洁模式：默认只显示聊天；侧栏/调试面板按需打开 ----
  function setSidebarOpen(open) {
    document.body.classList.toggle("sidebar-open", Boolean(open));
    if (dom.sidebarBackdrop) dom.sidebarBackdrop.hidden = !open;
    if (dom.sidebarToggle) dom.sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setDebugOpen(open) {
    document.body.classList.toggle("debug-on", Boolean(open));
    if (dom.debugToggle) {
      dom.debugToggle.classList.toggle("active", Boolean(open));
      dom.debugToggle.setAttribute("aria-pressed", open ? "true" : "false");
    }
    if (!open) switchTab("chat");
  }

  function switchTab(name) {
    state.tab = name;
    for (const button of dom.tabs) {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    }
    for (const key of Object.keys(dom.panels)) {
      dom.panels[key].classList.toggle("active", key === name);
    }
    if (name === "events" && !dom.eventsPause.checked) {
      dom.eventsScroll.scrollTop = dom.eventsScroll.scrollHeight;
    }
    if (name === "tools") renderToolsTab();
    if (name === "sessions") renderSessionsTab();
    if (name === "chat") {
      if (isNearBottom(dom.chatLog, 200)) scrollToBottom(dom.chatLog, true);
    }
  }

  /** 展开 / 收起聊天区所有 <details>（思考过程 + 工具卡片 + 压缩摘要）。 */
  function setAllDetailsOpen(open) {
    dom.chatLog.querySelectorAll("details").forEach((node) => {
      node.open = Boolean(open);
    });
    if (open) scrollToBottom(dom.chatLog);
  }

  function autoGrowInput() {
    dom.input.style.height = "auto";
    const height = Math.min(dom.input.scrollHeight, 168);
    dom.input.style.height = Math.max(40, height) + "px";
  }

  function setInput(text) {
    dom.input.value = text;
    autoGrowInput();
    dom.input.focus();
  }

  // -------------------------------------------------------------------------
  // 17. 事件绑定 & 初始化
  // -------------------------------------------------------------------------

  function bindEvents() {
    dom.tabs.forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    if (dom.sidebarToggle) dom.sidebarToggle.addEventListener("click", () => setSidebarOpen(!document.body.classList.contains("sidebar-open")));
    if (dom.sidebarClose) dom.sidebarClose.addEventListener("click", () => setSidebarOpen(false));
    if (dom.sidebarBackdrop) dom.sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
    if (dom.debugToggle) dom.debugToggle.addEventListener("click", () => setDebugOpen(!document.body.classList.contains("debug-on")));
    if (dom.statusSession) dom.statusSession.addEventListener("click", () => openStatsModal("session"));
    if (dom.statusTokens) dom.statusTokens.addEventListener("click", () => openStatsModal("tokens"));
    if (dom.statusContext) dom.statusContext.addEventListener("click", () => openStatsModal("context"));
    dom.sendBtn.addEventListener("click", () => void sendMessage());
    dom.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        void sendMessage();
      }
    });
    dom.input.addEventListener("input", autoGrowInput);

    dom.stopBtn.addEventListener("click", () => void stopRun());
    dom.modeBuild.addEventListener("click", () => void switchMode("build"));
    dom.modePlan.addEventListener("click", () => void switchMode("plan"));
    if (dom.effortSelect) {
      dom.effortSelect.addEventListener("change", () => void setReasoningEffort(dom.effortSelect.value));
    }
    dom.configBtn.addEventListener("click", openConfigModal);
    dom.newSessionBtn.addEventListener("click", () => void newSession());
    if (dom.toggleArchived) dom.toggleArchived.addEventListener("click", toggleArchived);
    dom.compactBtn.addEventListener("click", () => void compactContext());
    dom.refreshBtn.addEventListener("click", () => {
      void refreshState({ reseedEvents: false }).then(() => toast("状态已刷新", "success"));
    });

    // ---- 输入区工具栏：工作区 / 权限 / 图片附件 ----
    dom.workspaceBtn.addEventListener("click", openWorkspaceModal);
    for (const button of dom.permButtons) {
      button.addEventListener("click", () => void setPermissionLevel(String(button.dataset.level || "ask")));
    }
    dom.attachBtn.addEventListener("click", () => {
      if (state.busy || state.sending) return;
      dom.imageInput.click();
    });
    dom.imageInput.addEventListener("change", () => {
      const files = Array.from(dom.imageInput.files || []);
      // 清空 value，允许连续选同一张图
      dom.imageInput.value = "";
      void addImageFiles(files);
    });
    dom.input.addEventListener("paste", onInputPaste);

    // 展开/收起：现在控制聊天区所有 <details>（思考过程 + 工具卡片），
    // 不只是工具卡片，语义更符合按钮上的“工具”二字。
    dom.expandToolsBtn.addEventListener("click", () => setAllDetailsOpen(true));
    dom.collapseToolsBtn.addEventListener("click", () => setAllDetailsOpen(false));
    dom.scrollBottomBtn.addEventListener("click", () => scrollToBottom(dom.chatLog, true));

    dom.eventsClear.addEventListener("click", () => {
      state.eventLog = [];
      state.eventsCleared = true;
      renderEventTable();
      updateEventSummary();
      toast("事件表格已清空（历史仍保存在服务端会话文件里）", "info");
    });
    dom.eventsDownload.addEventListener("click", downloadEventLog);
    dom.eventsPause.addEventListener("change", () => {
      if (!dom.eventsPause.checked) dom.eventsScroll.scrollTop = dom.eventsScroll.scrollHeight;
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.body.classList.contains("sidebar-open")) {
        setSidebarOpen(false);
        return;
      }
      if (modal.el) {
        if (modal.dismissible) closeModal();
        else if (modal.kind === "approval") toast("权限审批需要先做出决定", "warn");
      }
    });

    window.addEventListener("offline", () => setConn("offline"));
    window.addEventListener("online", () => {
      if (eventSource && eventSource.readyState !== EventSource.OPEN) setConn("reconnecting");
    });
  }

  function init() {
    setSidebarOpen(false);
    setDebugOpen(false);
    renderFlow();
    bindEvents();
    renderConn();
    updateComposer();
    connectSSE();
    // 保险：如果 SSE 的 hello 迟迟没来（比如代理缓冲），先直接拉一次快照
    setTimeout(() => {
      if (!state.snapshot) {
        void refreshState({ reseedEvents: true, preserveStream: false });
      }
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
