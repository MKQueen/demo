/**
 * Web 服务集成测试。
 *
 * 不连真模型：用 mock provider + 临时工作目录，把“浏览器会做的事”用 fetch 重放一遍：
 *   发任务 → 收到权限审批请求 → 批准 → Agent 跑完 → 文件真的被创建 → 会话可导出
 *
 * 这类测试很有价值：Web 层最容易“看起来能跑、实际协议接错”，
 * 用真实 HTTP 请求打一遍，比手动点页面可靠。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { startWebServer } from "../src/web/server.ts";
import type { WebServerHandle } from "../src/web/server.ts";
import type { AppConfig } from "../src/config.ts";
import { resolveConfig } from "../src/config.ts";

const MOCK_CONFIG: AppConfig = {
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "mock-model",
  maxSteps: 0,
  maxToolCalls: 0,
  repeatGuard: true,
  contextBudget: 24_000,
  temperature: 0.2,
  reasoningEffort: "default",
  llmIdleTimeoutMs: 120_000,
  mock: true,
};

interface ContentPartShape {
  type: string;
  text?: string;
  image_url?: { url: string; detail?: string };
}

interface StateShape {
  busy: boolean;
  /** 当前工作区（切换工作区后会变）。 */
  cwd: string;
  workspace: { path: string };
  permissionLevel: "ask" | "accept-edits" | "auto";
  yolo: boolean;
  session: { id: string; title: string };
  messages: Array<{ role: string; content: string | ContentPartShape[] | null }>;
  events: Array<Record<string, unknown>>;
  tools: Array<{ name: string; category: string; defaultDecision: string }>;
  features: Array<{ title: string }>;
  sessions: Array<{ id: string; archived?: boolean }>;
  pendingApprovals: Array<{ id: string; toolName: string }>;
  acceptEdits: boolean;
  /** Agent 的工作记忆（todowrite 写入），属于会话，会落盘。 */
  todos: Array<{ content: string; status: string }>;
  config: { mock: boolean; hasApiKey: boolean; reasoningEffort?: string };
}

interface WorkspaceShape {
  workspace: string;
  path: string;
  parent: string | null;
  home: string;
  entries: Array<{ name: string; path: string; isDir: boolean }>;
  roots?: Array<{ name: string; path: string }>;
}

/** 1×1 透明 PNG 的 data URL。服务端只校验格式和大小，不解析像素。 */
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function tempCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-web-"));
}

async function start(options: {
  cwd: string;
  yolo?: boolean;
  workspace?: string;
  permissionLevel?: "ask" | "accept-edits" | "auto";
}): Promise<WebServerHandle> {
  return startWebServer({
    cwd: options.cwd,
    config: MOCK_CONFIG,
    host: "127.0.0.1",
    port: 0, // 让系统分配空闲端口，测试之间不冲突
    mode: "build",
    yolo: options.yolo ?? false,
    workspace: options.workspace,
    permissionLevel: options.permissionLevel,
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  assert.ok(res.ok, `GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getState(url: string): Promise<StateShape> {
  const { state } = await getJson<{ state: StateShape }>(`${url}/api/state`);
  return state;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 不断批准挂起的审批，直到回合结束。 */
async function driveUntilIdle(url: string, timeoutMs = 8000): Promise<StateShape> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await getState(url);
    for (const pending of state.pendingApprovals) {
      const res = await postJson(`${url}/api/approval`, {
        id: pending.id,
        decision: "always",
      });
      assert.ok(res.ok, `approval → ${res.status}`);
    }
    if (!state.busy && state.pendingApprovals.length === 0) return state;
    if (Date.now() > deadline) throw new Error("等待 Agent 回合结束超时");
    await sleep(40);
  }
}

test("Web: /api/state 返回工具、功能与初始会话", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const state = await getState(server.url);
    const names = state.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["bash", "edit", "glob", "grep", "read", "rewind", "skill", "task", "todowrite", "webfetch", "write"]);
    assert.ok(state.features.length >= 10, "功能清单应该足够丰富");
    assert.ok(state.session.id.length > 0);
    assert.equal(state.busy, false);
    assert.equal(state.config.mock, true);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 发送任务 → 流式跑完 → 文件真的被创建、事件被记录", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const res = await postJson(`${server.url}/api/message`, {
      text: "帮我创建一个 hello.txt",
    });
    assert.equal(res.status, 202);

    const state = await driveUntilIdle(server.url);

    // 1) 文件真的写出来了（说明工具链路是通的，不只是“看起来像”）
    assert.ok(fs.existsSync(path.join(cwd, "hello.txt")), "hello.txt 应该被创建");
    assert.match(fs.readFileSync(path.join(cwd, "hello.txt"), "utf8"), /Agent/);

    // 2) 会话里留下了完整记录
    assert.ok(state.messages.length >= 6);
    const eventTypes = state.events.map((event) => String(event.type));
    assert.ok(eventTypes.includes("step_start"));
    assert.ok(eventTypes.includes("tool"));
    assert.ok(eventTypes.includes("turn_end"));
    assert.ok(eventTypes.includes("message"));

    // 3) 历史会话列表里能看到它
    const sessions = await getJson<{ sessions: Array<{ id: string; messageCount: number }> }>(
      `${server.url}/api/sessions`,
    );
    assert.ok(sessions.sessions.some((item) => item.id === state.session.id));
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 权限审批真的会拦下工具，浏览器点“允许”后才执行", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    await postJson(`${server.url}/api/message`, { text: "帮我创建一个 approval.txt" });

    // 应该卡在第一个 bash 的审批上
    let pending: StateShape["pendingApprovals"] = [];
    const deadline = Date.now() + 4000;
    while (pending.length === 0 && Date.now() < deadline) {
      pending = (await getState(server.url)).pendingApprovals;
      if (pending.length === 0) await sleep(30);
    }
    assert.ok(pending.length > 0, "应该有挂起的权限审批");
    assert.equal(pending[0]!.toolName, "bash");

    // 此时文件不应该存在（bash 都还没执行，更不可能写文件）
    assert.equal(fs.existsSync(path.join(cwd, "approval.txt")), false);

    const state = await driveUntilIdle(server.url);
    assert.ok(fs.existsSync(path.join(cwd, "hello.txt")), "批准后 mock 剧本会创建 hello.txt");
    assert.equal(state.pendingApprovals.length, 0);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 会话可导出 Markdown / JSONL，也可载入历史会话", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    await postJson(`${server.url}/api/message`, { text: "你好" });
    const state = await driveUntilIdle(server.url);
    const id = state.session.id;

    const md = await fetch(`${server.url}/api/session/${id}/export?format=md`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get("content-type") ?? "", /markdown/);
    const markdown = await md.text();
    assert.match(markdown, new RegExp(`会话 ${id}`));
    assert.match(markdown, /## 用户/);

    const jsonl = await fetch(`${server.url}/api/session/${id}/export?format=jsonl`);
    const lines = (await jsonl.text()).trim().split("\n");
    assert.ok(lines.length >= 3);
    assert.ok(lines.every((line) => line.startsWith("{")));

    const loaded = await getJson<{ session: { id: string }; messages: unknown[] }>(
      `${server.url}/api/session/${id}`,
    );
    assert.equal(loaded.session.id, id);
    assert.ok(loaded.messages.length >= 2);

    // 新建会话后，旧会话仍然能载入
    const switched = await postJson(`${server.url}/api/session`, { id: null });
    assert.equal(switched.status, 200);
    const fresh = await getState(server.url);
    assert.notEqual(fresh.session.id, id);
    assert.ok(fresh.sessions.some((item) => item.id === id));
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 会话可归档 / 恢复 / 删除，当前会话拒绝删除", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const initial = await getState(server.url);
    const homeId = initial.session.id;

    // 先给当前会话写点内容：空会话时后端会复用当前会话（见“新建会话复用”用例），
    // 这里需要的是一条真正的新会话 B。
    assert.equal((await postJson(`${server.url}/api/message`, { text: "你好" })).status, 202);
    await driveUntilIdle(server.url);

    // 新建一个会话 B，再切回 A —— 现在 B 是非当前会话，可以安全归档/删除
    assert.equal((await postJson(`${server.url}/api/session`, { id: null })).status, 200);
    const cleanupId = (await getState(server.url)).session.id;
    assert.notEqual(cleanupId, homeId);
    assert.equal((await postJson(`${server.url}/api/session`, { id: homeId })).status, 200);

    // 归档：JSONL 追加 archive 事件，列表里标记 archived
    const archived = await postJson(`${server.url}/api/session/${cleanupId}/archive`, {});
    assert.equal(archived.status, 200);
    const archivedBody = (await archived.json()) as { archived: boolean; sessions: Array<{ id: string; archived: boolean }> };
    assert.equal(archivedBody.archived, true);
    assert.equal(archivedBody.sessions.find((item) => item.id === cleanupId)?.archived, true);

    // 快照里仍在（带 archived 标志），但 /api/sessions 默认不返回
    const snapshot = await getState(server.url);
    assert.equal(snapshot.sessions.find((item) => item.id === cleanupId)?.archived, true);
    const activeList = await getJson<{ sessions: Array<{ id: string }> }>(`${server.url}/api/sessions`);
    assert.ok(!activeList.sessions.some((item) => item.id === cleanupId));
    const allList = await getJson<{ sessions: Array<{ id: string }> }>(
      `${server.url}/api/sessions?archived=1`,
    );
    assert.ok(allList.sessions.some((item) => item.id === cleanupId));

    // 归档只隐藏列表，文件仍可载入、导出
    const loaded = await getJson<{ session: { id: string } }>(`${server.url}/api/session/${cleanupId}`);
    assert.equal(loaded.session.id, cleanupId);
    assert.equal((await fetch(`${server.url}/api/session/${cleanupId}/export?format=md`)).status, 200);

    // 恢复
    const restored = await postJson(`${server.url}/api/session/${cleanupId}/unarchive`, {});
    assert.equal(restored.status, 200);
    const restoredBody = (await restored.json()) as { sessions: Array<{ id: string; archived: boolean }> };
    assert.equal(restoredBody.sessions.find((item) => item.id === cleanupId)?.archived, false);

    // 再归档一次：用户归档完就是想直接删，不必先“恢复”再删
    assert.equal((await postJson(`${server.url}/api/session/${cleanupId}/archive`, {})).status, 200);

    // 删除：文件真的没了（归档项同样能删）
    const removed = await fetch(`${server.url}/api/session/${cleanupId}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.equal((await getState(server.url)).sessions.some((item) => item.id === cleanupId), false);
    assert.equal((await fetch(`${server.url}/api/session/${cleanupId}`)).status, 404);

    // 当前会话不能删：内存里的 Session 还指着那个文件
    const denied = await fetch(`${server.url}/api/session/${homeId}`, { method: "DELETE" });
    assert.equal(denied.status, 409);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 审批挂起时 Stop 能中断回合（不会卡到超时）", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    await postJson(`${server.url}/api/message`, { text: "帮我创建一个 hello.txt" });

    // 等到第一个 bash 审批挂起
    let pending: StateShape["pendingApprovals"] = [];
    const deadline = Date.now() + 4000;
    while (pending.length === 0 && Date.now() < deadline) {
      pending = (await getState(server.url)).pendingApprovals;
      if (pending.length === 0) await sleep(30);
    }
    assert.ok(pending.length > 0, "应该有一个挂起的审批");

    // 非法 decision 应该 400，而不是默默当拒绝
    const bad = await postJson(`${server.url}/api/approval`, {
      id: pending[0]!.id,
      decision: "maybe",
    });
    assert.equal(bad.status, 400);

    // 此时点 Stop：必须解开挂起的审批，让回合真正结束
    const abort = await postJson(`${server.url}/api/abort`, {});
    assert.equal(abort.status, 200);

    let state = await getState(server.url);
    const idleDeadline = Date.now() + 4000;
    while (state.busy && Date.now() < idleDeadline) {
      await sleep(40);
      state = await getState(server.url);
    }
    assert.equal(state.busy, false, "Stop 后回合应该结束");
    assert.equal(state.pendingApprovals.length, 0, "挂起的审批应该被清空");
    const turnEnd = state.events.find((event) => event.type === "turn_end");
    assert.ok(turnEnd, "应该写入 turn_end 事件");
    assert.equal(turnEnd.aborted, true);
    // 审批没通过，工具不该执行，文件不该出现
    assert.equal(fs.existsSync(path.join(cwd, "hello.txt")), false);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 非法会话 id / 非法导出 id 返回 404 而不是 500", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const badSession = await postJson(`${server.url}/api/session`, { id: "../../evil" });
    assert.equal(badSession.status, 404);

    const encoded = encodeURIComponent("../../evil");
    const badExport = await fetch(`${server.url}/api/session/${encoded}/export?format=md`);
    assert.equal(badExport.status, 404);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: todo 属于会话——切走再切回能恢复，不会串到别的会话", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    // mock 剧本：消息里带“任务拆解”就会触发 todowrite
    assert.equal((await postJson(`${server.url}/api/message`, { text: "帮我把任务拆一下" })).status, 202);
    const first = await driveUntilIdle(server.url);
    const sessionA = first.session.id;
    assert.ok(first.todos.length > 0, "跑完应该有 todo");

    // 新建会话：新会话是干净的
    const fresh = (await (await postJson(`${server.url}/api/session`, { id: null })).json()) as {
      state: { todos: Array<{ content: string }>; session: { id: string } };
    };
    assert.equal(fresh.state.todos.length, 0, "新会话不该继承上一个会话的 todo");
    assert.notEqual(fresh.state.session.id, sessionA);

    // 切回 A：todo 从 JSONL 恢复（这条以前是断的，切回来就空了）
    const back = (await (await postJson(`${server.url}/api/session`, { id: sessionA })).json()) as {
      state: { todos: Array<{ content: string }> };
    };
    assert.equal(back.state.todos.length, first.todos.length, "切回旧会话应恢复它的 todo");
    assert.deepEqual(
      back.state.todos.map((todo) => todo.content),
      first.todos.map((todo) => todo.content),
    );

    // 真的写进会话文件了：一行 type=todos
    const file = path.join(cwd, ".mini-opencode", "sessions", `${sessionA}.jsonl`);
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    assert.ok(lines.some((line) => line.type === "todos"), "todo 应该作为事件落盘");
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: reasoningEffort 可配置且校验取值（default/low/medium/high/max）", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const ok = await postJson(`${server.url}/api/config`, { reasoningEffort: "high" });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { config: { reasoningEffort: string } }).config.reasoningEffort, "high");

    // 快照里也要带上，前端顶栏的下拉靠它回显
    const state = await getState(server.url);
    assert.equal((state as unknown as { config: { reasoningEffort: string } }).config.reasoningEffort, "high");

    const back = await postJson(`${server.url}/api/config`, { reasoningEffort: "default" });
    assert.equal(back.status, 200);
    assert.equal(
      ((await back.json()) as { config: { reasoningEffort: string } }).config.reasoningEffort,
      "default",
    );

    const bad = await postJson(`${server.url}/api/config`, { reasoningEffort: "ultra" });
    assert.equal(bad.status, 400);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 模型配置支持 temperature（0 合法，越界 400）", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const ok = await postJson(`${server.url}/api/config`, { temperature: 1.1 });
    assert.equal(ok.status, 200);
    const payload = (await ok.json()) as { config: { temperature: number } };
    assert.equal(payload.config.temperature, 1.1);

    const zero = await postJson(`${server.url}/api/config`, { temperature: 0 });
    assert.equal(zero.status, 200);
    assert.equal(((await zero.json()) as { config: { temperature: number } }).config.temperature, 0);

    const bad = await postJson(`${server.url}/api/config`, { temperature: 5 });
    assert.equal(bad.status, 400);

    // 上下文预算也可以从网页改：合法值生效，非法值 400
    const budget = await postJson(`${server.url}/api/config`, { contextBudget: 64_000 });
    assert.equal(budget.status, 200);
    assert.equal(
      ((await budget.json()) as { config: { contextBudget: number } }).config.contextBudget,
      64_000,
    );
    const badBudget = await postJson(`${server.url}/api/config`, { contextBudget: 100 });
    assert.equal(badBudget.status, 400);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: acceptEdits 开关与 maxSteps/maxToolCalls 配置", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    const on = await postJson(`${server.url}/api/accept-edits`, { value: true });
    assert.equal(on.status, 200);
    assert.equal(((await on.json()) as { acceptEdits: boolean }).acceptEdits, true);
    assert.equal((await getState(server.url)).acceptEdits, true);

    const off = await postJson(`${server.url}/api/accept-edits`, { value: false });
    assert.equal(((await off.json()) as { acceptEdits: boolean }).acceptEdits, false);

    const limits = await postJson(`${server.url}/api/config`, { maxSteps: 0, maxToolCalls: 200 });
    assert.equal(limits.status, 200);
    const payload = (await limits.json()) as {
      config: { maxSteps: number; maxToolCalls: number };
    };
    assert.equal(payload.config.maxSteps, 0);
    assert.equal(payload.config.maxToolCalls, 200);
    assert.equal((await postJson(`${server.url}/api/config`, { maxSteps: 10001 })).status, 400);

    // 0 = 不限：默认配置就是 0，必须允许「什么都不改直接保存」
    const zeroCalls = await postJson(`${server.url}/api/config`, { maxToolCalls: 0 });
    assert.equal(zeroCalls.status, 200);
    assert.equal(((await zeroCalls.json()) as { config: { maxToolCalls: number } }).config.maxToolCalls, 0);
    assert.equal((await postJson(`${server.url}/api/config`, { maxToolCalls: -1 })).status, 400);
    assert.equal((await postJson(`${server.url}/api/config`, { maxToolCalls: 10001 })).status, 400);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: app.js 全程不拼 innerHTML（模型输出的 XSS 守门）", () => {
  // 这条是“安全规矩”的守门测试：AGENTS.md 要求前端所有模型输出用
  // textContent 渲染（防 XSS）。规矩写在文档里容易被忘，写成测试才拦得住。
  // Markdown 渲染（app.js §5.1）就是按这条实现的：全程 createElement + textContent。
  const root = path.dirname(import.meta.dirname);
  const js = fs.readFileSync(path.join(root, "src/web/public/app.js"), "utf8");
  const offenders = js
    .split("\n")
    .filter((line) => line.includes("innerHTML"))
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    });
  assert.deepEqual(offenders, [], "app.js 里不允许出现 innerHTML 赋值/读取（注释除外）");
});

test("Web: SSE 首帧带完整快照，参数错误返回 400", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const controller = new AbortController();
    const response = await fetch(`${server.url}/api/events`, { signal: controller.signal });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    assert.match(chunk, /"type":"hello"/);
    assert.match(chunk, /"tools"/);
    // 契约新增字段：SSE 首帧快照里也要有 workspace / permissionLevel
    assert.match(chunk, /"workspace":\{"path":"/);
    assert.match(chunk, /"permissionLevel":"auto"/);
    controller.abort();
    await reader.cancel().catch(() => {});

    assert.equal((await postJson(`${server.url}/api/message`, { text: "" })).status, 400);
    assert.equal((await postJson(`${server.url}/api/mode`, { mode: "nope" })).status, 400);
    assert.equal((await fetch(`${server.url}/api/session/not-a-session`)).status, 404);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// v2 契约新增：工作区 / 三级权限 / 图片多模态
// ---------------------------------------------------------------------------

test("Web: GET/POST /api/workspace 浏览目录并切换工作区", async () => {
  const cwd = tempCwd();
  const cwdReal = fs.realpathSync(cwd);
  fs.mkdirSync(path.join(cwd, "alpha"));
  fs.mkdirSync(path.join(cwd, "beta"));
  fs.mkdirSync(path.join(cwd, "alpha", "nested"));
  fs.writeFileSync(path.join(cwd, "note.txt"), "这不是目录，不应该出现在列表里");
  const server = await start({ cwd, yolo: true });
  try {
    const initial = await getState(server.url);

    // 1) 不带 path：返回当前工作区 + 父目录 + 只列目录、按名称排序
    const list = await getJson<WorkspaceShape>(`${server.url}/api/workspace`);
    assert.equal(list.workspace, initial.cwd);
    assert.equal(list.path, initial.cwd);
    assert.equal(list.parent, path.dirname(initial.cwd));
    assert.equal(list.home, os.homedir());
    assert.deepEqual(
      list.entries.map((entry) => entry.name),
      [".mini-opencode", "alpha", "beta"],
      "只列目录（note.txt 不算）且按名称排序",
    );
    for (const entry of list.entries) {
      assert.equal(entry.isDir, true);
      assert.ok(path.isAbsolute(entry.path));
      assert.equal(entry.path, path.join(list.path, entry.name));
    }

    // 2) 带 path：浏览指定目录（返回的是 realpath）
    const viewed = await getJson<WorkspaceShape>(
      `${server.url}/api/workspace?path=${encodeURIComponent(path.join(cwd, "alpha"))}`,
    );
    assert.equal(viewed.path, fs.realpathSync(path.join(cwd, "alpha")));
    assert.equal(viewed.workspace, initial.cwd);
    assert.equal(viewed.parent, cwdReal);
    assert.deepEqual(viewed.entries.map((entry) => entry.name), ["nested"]);

    // 3) 非法浏览参数：相对路径 / 不存在 / 不是目录 → 400
    assert.equal((await fetch(`${server.url}/api/workspace?path=relative`)).status, 400);
    assert.equal(
      (await fetch(`${server.url}/api/workspace?path=${encodeURIComponent(path.join(cwd, "missing"))}`))
        .status,
      400,
    );
    assert.equal(
      (await fetch(`${server.url}/api/workspace?path=${encodeURIComponent(path.join(cwd, "note.txt"))}`))
        .status,
      400,
    );

    // 4) 切换工作区：cwd 变成 realpath、新开 Session、旧会话留在旧目录
    const oldSessionId = initial.session.id;
    const switched = await postJson(`${server.url}/api/workspace`, {
      path: path.join(cwd, "alpha"),
    });
    assert.equal(switched.status, 200);
    const payload = (await switched.json()) as { ok: boolean; state: StateShape };
    const alphaReal = fs.realpathSync(path.join(cwd, "alpha"));
    assert.equal(payload.ok, true);
    assert.equal(payload.state.cwd, alphaReal);
    assert.equal(payload.state.workspace.path, alphaReal);
    assert.notEqual(payload.state.session.id, oldSessionId);
    assert.ok(
      fs.existsSync(
        path.join(alphaReal, ".mini-opencode", "sessions", `${payload.state.session.id}.jsonl`),
      ),
      "新会话应该落在新工作区的 .mini-opencode/sessions",
    );
    assert.ok(
      fs.existsSync(path.join(cwd, ".mini-opencode", "sessions", `${oldSessionId}.jsonl`)),
      "旧会话应该留在旧工作区的 .mini-opencode/sessions",
    );

    // 5) 切换后 /api/state 与 GET /api/workspace 都以新工作区为准
    const after = await getState(server.url);
    assert.equal(after.cwd, alphaReal);
    assert.equal(after.workspace.path, alphaReal);
    assert.ok(after.sessions.some((item) => item.id === payload.state.session.id));
    const listAfter = await getJson<WorkspaceShape>(`${server.url}/api/workspace`);
    assert.equal(listAfter.path, alphaReal);
    assert.equal(listAfter.workspace, alphaReal);
    assert.deepEqual(listAfter.entries.map((entry) => entry.name), [".mini-opencode", "nested"]);

    // 6) 非法切换：缺 path / 相对路径 / 文件 / 不存在 / 非字符串 → 400
    assert.equal((await postJson(`${server.url}/api/workspace`, {})).status, 400);
    assert.equal((await postJson(`${server.url}/api/workspace`, { path: "relative" })).status, 400);
    assert.equal(
      (await postJson(`${server.url}/api/workspace`, { path: path.join(cwd, "note.txt") })).status,
      400,
    );
    assert.equal(
      (await postJson(`${server.url}/api/workspace`, { path: path.join(cwd, "missing") })).status,
      400,
    );
    assert.equal((await postJson(`${server.url}/api/workspace`, { path: 42 })).status, 400);

    // 7) 语义验证：切换后 Agent 的工具边界就在新工作区（yolo，不需要审批）
    assert.equal(
      (await postJson(`${server.url}/api/message`, { text: "帮我创建一个 hello.txt" })).status,
      202,
    );
    await driveUntilIdle(server.url);
    assert.ok(
      fs.existsSync(path.join(alphaReal, "hello.txt")),
      "切换工作区后文件应该创建在新工作区里",
    );
    assert.equal(
      fs.existsSync(path.join(cwd, "hello.txt")),
      false,
      "旧工作区不应该被写入",
    );
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 三级权限 ask / accept-edits / auto 映射与旧接口兼容", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    // 初始：ask（旧字段都是 false）
    let state = await getState(server.url);
    assert.equal(state.permissionLevel, "ask");
    assert.equal(state.yolo, false);
    assert.equal(state.acceptEdits, false);

    // accept-edits：自动改文件，但 yolo 仍关着
    const edits = await postJson(`${server.url}/api/permission`, { level: "accept-edits" });
    assert.equal(edits.status, 200);
    assert.deepEqual(await edits.json(), { ok: true, level: "accept-edits" });
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "accept-edits");
    assert.equal(state.acceptEdits, true);
    assert.equal(state.yolo, false);

    // auto：等价 old --yolo
    const auto = await postJson(`${server.url}/api/permission`, { level: "auto" });
    assert.equal(auto.status, 200);
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "auto");
    assert.equal(state.yolo, true);
    assert.equal(state.acceptEdits, false);

    // 旧接口仍然可用，并且映射回同一套三级状态
    assert.equal((await postJson(`${server.url}/api/yolo`, { value: false })).status, 200);
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "ask");
    assert.equal(state.yolo, false);

    assert.equal((await postJson(`${server.url}/api/accept-edits`, { value: true })).status, 200);
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "accept-edits");
    assert.equal(state.acceptEdits, true);

    assert.equal((await postJson(`${server.url}/api/yolo`, { value: true })).status, 200);
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "auto");
    assert.equal(state.yolo, true);

    // 回到询问档：两个旧字段一起关掉
    assert.equal((await postJson(`${server.url}/api/permission`, { level: "ask" })).status, 200);
    state = await getState(server.url);
    assert.equal(state.permissionLevel, "ask");
    assert.equal(state.yolo, false);
    assert.equal(state.acceptEdits, false);

    // 非法档位 → 400
    assert.equal((await postJson(`${server.url}/api/permission`, { level: "nope" })).status, 400);
    assert.equal((await postJson(`${server.url}/api/permission`, {})).status, 400);
    assert.equal((await postJson(`${server.url}/api/permission`, { level: true })).status, 400);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: WebServerOptions 的 workspace / permissionLevel 初始值生效", async () => {
  const cwd = tempCwd();
  const workspace = tempCwd();
  const workspaceReal = fs.realpathSync(workspace);
  const server = await start({ cwd, workspace, permissionLevel: "accept-edits" });
  try {
    const state = await getState(server.url);
    assert.equal(state.cwd, workspaceReal, "workspace 选项优先于 cwd，且会 realpath");
    assert.equal(state.workspace.path, workspaceReal);
    assert.equal(state.permissionLevel, "accept-edits");
    assert.equal(state.acceptEdits, true);
    assert.equal(state.yolo, false);
    assert.ok(fs.existsSync(path.join(workspaceReal, ".mini-opencode", "sessions")));
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Web: accept-edits 档自动放行改文件，但 bash 仍要审批", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, permissionLevel: "accept-edits" });
  try {
    assert.equal(
      (await postJson(`${server.url}/api/message`, { text: "帮我创建一个 hello.txt" })).status,
      202,
    );

    // 记录回合期间所有“弹过审批”的工具；accept-edits 下 write/edit 不应该被问
    const asked = new Map<string, string>();
    const deadline = Date.now() + 8000;
    for (;;) {
      const state = await getState(server.url);
      for (const pending of state.pendingApprovals) {
        asked.set(pending.id, pending.toolName);
        assert.equal(
          (await postJson(`${server.url}/api/approval`, { id: pending.id, decision: "yes" })).status,
          200,
        );
      }
      if (!state.busy && state.pendingApprovals.length === 0) break;
      if (Date.now() > deadline) throw new Error("等待 Agent 回合结束超时");
      await sleep(40);
    }

    assert.deepEqual([...asked.values()], ["bash"], "只有 bash 需要审批，write 被 accept-edits 自动放行");
    assert.ok(fs.existsSync(path.join(cwd, "hello.txt")), "write 应该真的执行了");
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 运行中切换工作区 / 权限 / 再发消息都返回 409", async () => {
  const cwd = tempCwd();
  const other = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    assert.equal(
      (await postJson(`${server.url}/api/message`, { text: "帮我创建一个 hello.txt" })).status,
      202,
    );

    // 等到第一个 bash 审批挂起，说明回合确实在运行中
    let pending: StateShape["pendingApprovals"] = [];
    const deadline = Date.now() + 4000;
    while (pending.length === 0 && Date.now() < deadline) {
      pending = (await getState(server.url)).pendingApprovals;
      if (pending.length === 0) await sleep(30);
    }
    assert.ok(pending.length > 0, "应该有一个挂起的审批");

    assert.equal((await postJson(`${server.url}/api/workspace`, { path: other })).status, 409);
    assert.equal((await postJson(`${server.url}/api/permission`, { level: "auto" })).status, 409);
    assert.equal((await postJson(`${server.url}/api/message`, { text: "再发一条" })).status, 409);

    // 收尾：中断挂起的回合，确认状态没有被偷偷改掉
    assert.equal((await postJson(`${server.url}/api/abort`, {})).status, 200);
    let state = await getState(server.url);
    const idleDeadline = Date.now() + 4000;
    while (state.busy && Date.now() < idleDeadline) {
      await sleep(40);
      state = await getState(server.url);
    }
    assert.equal(state.busy, false);
    assert.equal(state.cwd, cwd);
    assert.equal(state.permissionLevel, "ask");
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});

test("Web: 图片消息生成多模态 content、持久化，纯图片也能发送", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    // 1) 文字 + 1 张图 → content 是 [text, image_url] 数组
    const withText = await postJson(`${server.url}/api/message`, {
      text: "你好",
      images: [{ name: "a.png", dataUrl: PNG_1PX }],
    });
    assert.equal(withText.status, 202);
    let state = await driveUntilIdle(server.url);

    const firstUsers = state.messages.filter((message) => message.role === "user");
    assert.equal(firstUsers.length, 1);
    assert.deepEqual(firstUsers[0]!.content, [
      { type: "text", text: "你好" },
      { type: "image_url", image_url: { url: PNG_1PX, detail: "auto" } },
    ]);

    // 会话 JSONL 里真的落盘了图片内容，恢复会话时图片还在
    const jsonl = await fetch(`${server.url}/api/session/${state.session.id}/export?format=jsonl`);
    assert.equal(jsonl.status, 200);
    assert.match(await jsonl.text(), /"type":"image_url"/);

    // 2) 纯图片（text 为空）也可以发送
    const imageOnly = await postJson(`${server.url}/api/message`, {
      images: [{ name: "only.png", dataUrl: PNG_1PX }],
    });
    assert.equal(imageOnly.status, 202);
    state = await driveUntilIdle(server.url);
    const afterImageOnly = state.messages.filter((message) => message.role === "user").at(-1)!;
    assert.deepEqual(afterImageOnly.content, [
      { type: "image_url", image_url: { url: PNG_1PX, detail: "auto" } },
    ]);

    // 3) 4 张是合法上限（1 段文字 + 4 张图）
    const four = await postJson(`${server.url}/api/message`, {
      text: "四张图",
      images: [1, 2, 3, 4].map((index) => ({
        name: `${index}.png`,
        dataUrl: PNG_1PX,
      })),
    });
    assert.equal(four.status, 202);
    state = await driveUntilIdle(server.url);
    const lastUser = state.messages.filter((message) => message.role === "user").at(-1)!;
    assert.ok(Array.isArray(lastUser.content));
    assert.equal(lastUser.content.length, 5);
    assert.equal(lastUser.content.filter((part) => part.type === "image_url").length, 4);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 非法图片（格式 / 数量 / 大小 / 空内容）返回 400", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    // 非 png/jpeg/gif/webp
    assert.equal(
      (
        await postJson(`${server.url}/api/message`, {
          text: "x",
          images: [{ name: "a.svg", dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await postJson(`${server.url}/api/message`, {
          text: "x",
          images: [{ name: "a.txt", dataUrl: "data:text/plain;base64,aGVsbG8=" }],
        })
      ).status,
      400,
    );
    // 缺 dataUrl / 空 base64
    assert.equal(
      (await postJson(`${server.url}/api/message`, { text: "x", images: [{ name: "a.png" }] }))
        .status,
      400,
    );
    assert.equal(
      (
        await postJson(`${server.url}/api/message`, {
          text: "x",
          images: [{ dataUrl: "data:image/png;base64," }],
        })
      ).status,
      400,
    );
    // images 不是数组
    assert.equal(
      (await postJson(`${server.url}/api/message`, { text: "x", images: { dataUrl: PNG_1PX } }))
        .status,
      400,
    );
    // 超过 4 张
    assert.equal(
      (
        await postJson(`${server.url}/api/message`, {
          text: "x",
          images: [1, 2, 3, 4, 5].map(() => ({ dataUrl: PNG_1PX })),
        })
      ).status,
      400,
    );
    // 单张解码后超过 4MB
    const tooBig = `data:image/png;base64,${Buffer.alloc(4 * 1024 * 1024 + 1).toString("base64")}`;
    assert.equal(
      (
        await postJson(`${server.url}/api/message`, {
          text: "x",
          images: [{ name: "big.png", dataUrl: tooBig }],
        })
      ).status,
      400,
    );

    // 所有非法请求都不应该启动回合，也不应该写进消息
    const state = await getState(server.url);
    assert.equal(state.busy, false);
    assert.equal(state.messages.length, 0);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 勾选 persist 时配置写入 .env（重启不丢 key）", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: false });
  try {
    const response = await postJson(`${server.url}/api/config`, {
      apiKey: "sk-test-persist",
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      mock: true,
      persist: true,
    });
    assert.equal(response.status, 200);
    const envPath = path.join(cwd, ".env");
    assert.ok(fs.existsSync(envPath), ".env 应被创建");
    const text = fs.readFileSync(envPath, "utf8");
    // 必须写 MINI_API_KEY：config.ts 的优先级是 MINI_API_KEY > DEEPSEEK_API_KEY，
    // 如果写 DEEPSEEK_API_KEY，用户 .env 里原来的 MINI_API_KEY 会永远盖住新值。
    assert.match(text, /MINI_API_KEY=sk-test-persist/);
    assert.doesNotMatch(text, /DEEPSEEK_API_KEY=/, "不应再写优先级更低的 DEEPSEEK_API_KEY");
    assert.match(text, /MINI_MODEL=test-model/);
    assert.match(text, /MINI_MOCK=1/);
    if (process.platform !== "win32") {
      const mode = fs.statSync(envPath).mode & 0o777;
      assert.equal(mode, 0o600, ".env 权限应为 600");
    }

    // 模拟“重启”：重新从 .env 解析配置，新 key 必须生效。
    // 先清掉可能从别处泄漏进来的同名环境变量，保证读到的是 .env。
    const envKeys = [
      "MINI_API_KEY", "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL",
      "MINI_MODEL", "MINI_MOCK", "MINI_TEMPERATURE", "MINI_CONTEXT_BUDGET",
      "MINI_MAX_STEPS", "MINI_MAX_TOOL_CALLS", "MINI_REPEAT_GUARD",
    ];
    const saved = new Map(envKeys.map((key) => [key, process.env[key]]));
    try {
      for (const key of envKeys) delete process.env[key];
      const reloaded = resolveConfig(cwd);
      assert.equal(reloaded.apiKey, "sk-test-persist", "重启后应使用 .env 里保存的新 key");
      assert.equal(reloaded.model, "test-model");
      assert.equal(reloaded.mock, true);
    } finally {
      for (const key of envKeys) {
        if (saved.get(key) === undefined) delete process.env[key];
        else process.env[key] = saved.get(key);
      }
    }
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 回归：空会话复用 / 压缩失败可见 / 导出格式白名单
// ---------------------------------------------------------------------------
test("Web: 当前会话为空时「新建会话」复用当前会话，不落空文件", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const initial = await getState(server.url);
    const firstId = initial.session.id;

    // 连续两次“新建”：当前会话还是空的，应该复用同一个 id
    const second = await postJson(`${server.url}/api/session`, { id: null });
    assert.equal(second.status, 200);
    const state2 = await getState(server.url);
    assert.equal(state2.session.id, firstId, "空会话应复用，而不是每次新建一个空 jsonl");

    // 目录里只应该有一个会话文件
    const dir = path.join(cwd, ".mini-opencode", "sessions");
    assert.equal(
      fs.readdirSync(dir).filter((name) => name.endsWith(".jsonl")).length,
      1,
      "不应该凭空多出空会话文件",
    );

    // 一旦有消息，再新建就应该真的换一个会话
    assert.equal((await postJson(`${server.url}/api/message`, { text: "你好" })).status, 202);
    await driveUntilIdle(server.url);
    assert.equal((await postJson(`${server.url}/api/session`, { id: null })).status, 200);
    assert.notEqual((await getState(server.url)).session.id, firstId);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 压缩历史太短时返回 ok:false + 可读错误（不再静默成功）", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    const res = await postJson(`${server.url}/api/compact`, {});
    assert.equal(res.status, 200);
    const payload = (await res.json()) as { ok: boolean; error?: string };
    assert.equal(payload.ok, false, "历史太短应明确失败");
    assert.match(payload.error ?? "", /太短|不需要压缩/);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Web: 导出 format 白名单——未知格式返回 400，md/jsonl 正常", async () => {
  const cwd = tempCwd();
  const server = await start({ cwd, yolo: true });
  try {
    await postJson(`${server.url}/api/message`, { text: "你好" });
    const state = await driveUntilIdle(server.url);
    const id = state.session.id;

    const bad = await fetch(`${server.url}/api/session/${id}/export?format=csv`);
    assert.equal(bad.status, 400);
    assert.match(await bad.text(), /不支持的导出格式/);

    assert.equal((await fetch(`${server.url}/api/session/${id}/export?format=jsonl`)).status, 200);
    assert.equal((await fetch(`${server.url}/api/session/${id}/export?format=md`)).status, 200);
  } finally {
    await server.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
