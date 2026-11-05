/**
 * ============================================================================
 * 网页版可观测面板 —— HTTP 服务端
 * ============================================================================
 *
 * 它做的事：
 *   1. 用 Node 内置 http 起一个本地服务（零依赖）
 *   2. 前端用 EventSource 订阅 /api/events（SSE），实时看 Agent 每一步
 *   3. 前端 POST /api/message 发任务，Agent 在服务端跑，事件流回浏览器
 *   4. 权限审批走 HTTP：浏览器弹窗 → POST /api/approval → 服务端 resolve Promise
 *   5. 会话存在 .mini-opencode/sessions/*.jsonl，可回放、可导出 JSONL / Markdown
 *
 * 为什么用 SSE 而不是 WebSocket？
 *  Agent 的事件是“服务端单向推送”，SSE 正好、协议更简单（纯文本流），
 *  浏览器原生 EventSource 自带重连；WebSocket 是双向的，这里用不上。
 *
 * 安全提醒：
 *  - 默认只监听 127.0.0.1（本机）。不要把它暴露到公网——没有登录鉴权。
 *  - API key 默认只存在进程内存；网页里勾选“保存到 .env”后可持久化（0600，.env 已 gitignore）。
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

import type { AppConfig } from "../config.ts";
import { createModel } from "../llm/factory.ts";
import { explainLLMError } from "../llm/errors.ts";
import { buildUserContent, contentToText } from "../llm/content.ts";
import type { IncomingImage } from "../llm/content.ts";
import type { ChatMessage, LLMProvider, MessageContent } from "../llm/types.ts";
import { buildRegistry, TOOL_SUMMARY } from "../tools/builtin.ts";
import type { AgentMode } from "../tools/builtin.ts";
import { DEFAULT_PERMISSIONS, Permissions } from "../permission.ts";
import type { ConfirmAnswer, ConfirmRequest } from "../permission.ts";
import { buildSystemPrompt, loadProjectRules } from "../agent/prompt.ts";
import { loadSkills } from "../tools/skills.ts";
import { runAgent } from "../agent/loop.ts";
import type { TraceEvent } from "../agent/loop.ts";
import { spawnSubagent } from "../agent/subagent.ts";
import { compactHistory, estimateMessagesTokens } from "../agent/context.ts";
import { estimateTokens } from "../util.ts";
import { Session, pruneEmptySessions } from "../session.ts";
import { getTodos } from "../tools/todo.ts";
import type { SubagentRequest } from "../tools/types.ts";
import { WebBridge } from "./bridge.ts";

const VERSION = "0.2.0";
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

/** 契约：单条消息最多带 4 张图片。 */
const MAX_IMAGES_PER_MESSAGE = 4;
/** 契约：单张图片“解码后”最多 4MB。 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/**
 * /api/message 的请求体上限。
 * 4 张 4MB 的图片转成 base64 约 22MB，再给 JSON 包装留点余量——所以不能沿用 2MB 默认值。
 */
const MAX_MESSAGE_BODY_BYTES = 32 * 1024 * 1024;
/** 只接受这四种图片的 data URL（浏览器 FileReader 输出的格式就是小写）。 */
const IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/**
 * 三级权限档（对应前端 composer 上的“询问 / 自动改文件 / 全自动”）：
 *   ask          —— 按工具类别默认：读放行，写文件和 bash 都要问
 *   accept-edits —— 自动允许改文件（write/edit），bash 仍要问
 *   auto         —— 全自动，等价于旧的 --yolo
 */
export type PermissionLevel = "ask" | "accept-edits" | "auto";

/**
 * MCP 生命周期钩子（可选）。
 *
 * Web 服务自己不认识 MCP——它只负责在对的时机喊一嗓子：
 *   - 每个回合开始前：ensure(cwd)，让 MCP 工具按当前工作区准备好
 *   - 切换工作区之后：ensure(cwd)，MCP 的 cwd 默认跟随工作区
 *   - 服务关闭时：shutdown()，别把子进程留在后台
 *
 * 由 main.ts 把 mcp-dev 导出的 ensureMcp / shutdownMcp 传进来；不传就全部跳过。
 * 这样 server.ts 不 import src/mcp/**，两边可以独立开发、独立做类型检查。
 */
export interface WebMcpHooks {
  ensure?: (cwd: string) => Promise<void> | void;
  shutdown?: () => Promise<void> | void;
}

export interface WebServerOptions {
  cwd: string;
  config: AppConfig;
  host: string;
  port: number;
  mode: AgentMode;
  yolo: boolean;
  acceptEdits?: boolean;
  sessionId?: string;
  /** 初始三级权限档。不传则由 yolo / acceptEdits 推导（保持旧调用方向后兼容）。 */
  permissionLevel?: PermissionLevel;
  /** 初始工作区（默认就是 cwd）。传了就 realpath + 校验必须是目录。 */
  workspace?: string;
  /** 可选的 MCP 生命周期钩子（见 WebMcpHooks）。 */
  mcp?: WebMcpHooks;
}

export interface WebServerHandle {
  url: string;
  port: number;
  host: string;
  close(): Promise<void>;
}

interface PendingApproval {
  id: string;
  request: ConfirmRequest;
  resolve: (answer: ConfirmAnswer) => void;
  timer: NodeJS.Timeout;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 面板上展示的“项目能力清单”。
 * 和 docs/ 的章节对应，方便学习者知道“这个功能背后是哪一章”。
 */
const FEATURES = [
  { title: "流式对话", detail: "模型逐字输出，前端实时渲染；支持中断（Stop）。", chapter: "第 1、9 章" },
  { title: "工具调用协议", detail: "模型只生成 tool_calls JSON，由服务端校验参数后真正执行。", chapter: "第 2 章" },
  { title: "Agent 循环", detail: "模型→工具→结果回填→再推理，带步数上限与错误自愈。", chapter: "第 3 章" },
  { title: "文件工具 read/write/edit", detail: "带行号读取、精确字符串替换、路径边界与符号链接防护。", chapter: "第 4 章" },
  { title: "搜索工具 glob/grep", detail: "按文件名模式找文件、按正则搜内容，结果有上限。", chapter: "第 4 章" },
  { title: "bash 执行", detail: "命令超时、杀进程组、输出截断、环境变量清洗。", chapter: "第 5 章" },
  { title: "权限审批", detail: "allow/ask/deny 三档；浏览器里点允许/拒绝/始终允许；危险命令单独提示。", chapter: "第 5 章" },
  { title: "上下文管理", detail: "token 估算、工具输出截断、整轮裁剪、LLM 摘要压缩，压缩后写快照。", chapter: "第 6 章" },
  { title: "会话持久化", detail: "每一步、每次工具调用都写 JSONL；支持恢复、回放、导出。", chapter: "第 7 章" },
  { title: "系统提示词 + AGENTS.md", detail: "项目规则自动注入；build / plan 两种模式双保险。", chapter: "第 8 章" },
  { title: "实时事件流", detail: "trace 事件按步记录上下文大小、工具、耗时，可当“黑匣子”排查。", chapter: "第 9 章" },
  { title: "todo 清单", detail: "Agent 用 todowrite 维护待办，界面上实时同步。", chapter: "第 10 章" },
  { title: "子 Agent（task）", detail: "隔离上下文做只读调研，只把结论带回主 Agent。", chapter: "第 10 章" },
  { title: "模型配置", detail: "支持 DeepSeek / 任意 OpenAI 兼容接口，也可用 mock 离线演示。", chapter: "第 1 章" },
];

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function text(
  res: http.ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

async function readJsonBody(
  req: http.IncomingMessage,
  maxBytes = 2 * 1024 * 1024,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxBytes) throw new HttpError(413, "请求体太大");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("必须是 JSON 对象");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw new HttpError(400, `请求体不是合法 JSON：${messageOf(err)}`);
  }
}

/**
 * 校验前端上传的图片数组，返回“规整后”的图片列表。
 *
 * 契约：最多 4 张；每张 dataUrl 必须是 png/jpeg/gif/webp 的 base64 data URL；
 * 单张**解码后**不超过 4MB。任何一条不满足都抛 400（带上第几张，方便前端提示）。
 *
 * 为什么要校验大小？图片是 base64 塞进 JSON 的，一张 4MB 的图在请求体里约 5.6MB。
 * 不设上限的话，随手拖一张几十 MB 的照片就能把服务端内存撑爆。
 */
function parseImages(raw: unknown): IncomingImage[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "images 必须是数组");

  if (raw.length > MAX_IMAGES_PER_MESSAGE) {
    throw new HttpError(400, `最多只能上传 ${MAX_IMAGES_PER_MESSAGE} 张图片（这次收到 ${raw.length} 张）`);
  }

  return raw.map((item, index) => {
    const position = index + 1;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `第 ${position} 张图片的格式不对（需要 {name?, dataUrl}）`);
    }
    const record = item as Record<string, unknown>;
    const dataUrl = record.dataUrl;
    if (typeof dataUrl !== "string" || !IMAGE_DATA_URL_RE.test(dataUrl)) {
      throw new HttpError(
        400,
        `第 ${position} 张图片的 dataUrl 不合法（只支持 png/jpeg/gif/webp 的 base64 data URL）`,
      );
    }

    // “解码后大小”直接从 base64 真实解码算，避免把非法 base64 也放过
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = Buffer.from(base64, "base64").length;
    if (bytes === 0) throw new HttpError(400, `第 ${position} 张图片的内容为空`);
    if (bytes > MAX_IMAGE_BYTES) {
      throw new HttpError(
        400,
        `第 ${position} 张图片太大（${(bytes / (1024 * 1024)).toFixed(1)}MB），单张上限 4MB`,
      );
    }

    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim().slice(0, 200)
        : `image-${position}`;
    return { name, dataUrl };
  });
}

/**
 * 把用户传来的路径解析成“真实目录”。
 *
 * 三道校验：必须是非空字符串、必须是绝对路径、必须存在且是目录。
 * 最后用 realpath 解析，避免 `/tmp/../etc` 或符号链接造成的路径歧义——
 * 因为切换后所有工具都以这个 cwd 为边界，必须是一个确定的真实路径。
 */
function resolveExistingDirectory(raw: unknown, field = "path"): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new HttpError(400, `${field} 必须是非空字符串`);
  }
  if (!path.isAbsolute(raw)) throw new HttpError(400, `${field} 必须是绝对路径：${raw}`);

  let real: string;
  try {
    real = fs.realpathSync(raw);
  } catch (err) {
    throw new HttpError(400, `路径不存在或不可访问：${raw}（${messageOf(err)}）`);
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(real);
  } catch (err) {
    throw new HttpError(400, `路径不可访问：${raw}（${messageOf(err)}）`);
  }
  if (!stat.isDirectory()) throw new HttpError(400, `不是目录：${real}`);
  return real;
}

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === "ask" || value === "accept-edits" || value === "auto";
}

/** 读取会话 JSONL 的所有事件（回放用）。坏行跳过。 */
function readSessionEvents(file: string): Array<Record<string, unknown>> {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((item): item is Record<string, unknown> => item !== null);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 核心：WebApp（状态 + 路由 + 事件流）
// ---------------------------------------------------------------------------
class WebApp {
  /** 当前工作区：所有工具 cwd 的边界。切换工作区时会被替换。 */
  cwd: string;
  config: AppConfig;
  mode: AgentMode;

  private session: Session;
  private provider: LLMProvider | null = null;
  private providerError: string | null = null;
  private readonly permissions: Permissions;
  private readonly mcp: WebMcpHooks;

  private busy = false;
  private controller: AbortController | null = null;
  /** 启动目录：可选的 .env 持久化写到这里（不随工作区切换而变）。 */
  private readonly initialCwd: string;

  private seq = 0;
  private readonly listeners = new Set<http.ServerResponse>();
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly startedAt = Date.now();

  constructor(options: WebServerOptions) {
    this.initialCwd = options.cwd;
    // 初始工作区：优先 options.workspace（realpath + 目录校验），否则沿用 options.cwd
    this.cwd = options.workspace
      ? resolveExistingDirectory(options.workspace, "workspace")
      : options.cwd;
    this.config = { ...options.config };
    this.mode = options.mode;

    this.session = options.sessionId
      ? Session.load(this.cwd, options.sessionId)
      : Session.create({ cwd: this.cwd, model: options.config.model });

    // 启动时清掉历史遗留的「空会话」文件（只有 meta、没发过消息的那种）：
    // 每次启动都会创建一个当前会话，以前那些没用的空壳不该一直占着会话列表。
    try {
      pruneEmptySessions(this.cwd, this.session.meta.id);
    } catch {
      /* 清理失败不影响服务启动 */
    }

    // 交互式权限：ask 时通过 SSE 问浏览器。
    // 三级档位统一由 permissionLevel 推导；yolo / acceptEdits 两个旧参数仍然兼容。
    const level: PermissionLevel =
      options.permissionLevel ??
      (options.yolo ? "auto" : options.acceptEdits ? "accept-edits" : "ask");
    this.permissions = new Permissions({
      yolo: level === "auto",
      acceptEdits: level === "accept-edits",
      interactive: true,
      confirm: (request) => this.askApproval(request),
    });
    this.mcp = options.mcp ?? {};

    this.refreshProvider();
  }

  // ---- 模型 ----

  private refreshProvider(): void {
    try {
      this.provider = createModel(this.config, this.config.model);
      this.providerError = null;
    } catch (err) {
      this.provider = null;
      this.providerError = messageOf(err);
    }
  }

  private ensureProvider(): LLMProvider {
    if (!this.provider) {
      throw new HttpError(
        400,
        this.providerError ??
          "模型不可用。请在右上角「模型配置」里填 API key，或勾选 mock 模式。",
      );
    }
    return this.provider;
  }

  private publicConfig(): Record<string, unknown> {
    const hasKey = Boolean(this.config.apiKey);
    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      mock: this.config.mock,
      maxSteps: this.config.maxSteps,
      maxToolCalls: this.config.maxToolCalls,
      contextBudget: this.config.contextBudget,
      temperature: this.config.temperature,
      reasoningEffort: this.config.reasoningEffort,
      hasApiKey: hasKey,
      apiKeyMasked: hasKey
        ? `${this.config.apiKey.slice(0, 3)}***${this.config.apiKey.slice(-4)}`
        : "",
      providerError: this.providerError,
    };
  }

  // ---- 快照（前端首屏 / 重连时重建状态） ----

  private snapshot(): Record<string, unknown> {
    const registry = buildRegistry(this.mode);

    // DSH 风格的上下文分项：系统提示词 / 工具定义 / 对话消息。
    // 注意：loop 的预算目前只统计 system + history，tools 定义是额外开销；
    // 这里分开列出来，方便用户看到"为什么上下文比我想的占得多"。
    const systemText = buildSystemPrompt({
      cwd: this.cwd,
      mode: this.mode,
      model: this.config.model,
      agentsMd: loadProjectRules(this.cwd),
      toolNames: registry.names,
      skills: loadSkills(this.cwd),
    });
    const systemTokens = estimateTokens(systemText) + 4;
    const toolTokens = registry
      .toDefinitions()
      .reduce((sum, definition) => sum + estimateTokens(JSON.stringify(definition)), 0);
    const messageTokens = estimateMessagesTokens(this.session.messages);
    const contextUsage = {
      system: systemTokens,
      tools: toolTokens,
      messages: messageTokens,
      total: systemTokens + toolTokens + messageTokens,
      budget: this.config.contextBudget,
    };

    return {
      version: VERSION,
      cwd: this.cwd,
      // 契约新增：workspace 让前端 composer 的“工作区按钮”知道当前在哪
      workspace: { path: this.cwd },
      startedAt: this.startedAt,
      config: this.publicConfig(),
      mode: this.mode,
      // 契约新增：三级权限档；yolo / acceptEdits 两个旧字段保留，兼容旧前端与测试
      permissionLevel: this.permissionLevel,
      yolo: this.permissions.isYolo,
      acceptEdits: this.permissions.isAcceptEdits,
      busy: this.busy,
      session: {
        id: this.session.meta.id,
        title: this.session.title,
        createdAt: this.session.meta.createdAt,
        file: path.relative(this.cwd, this.session.path),
      },
      messages: this.session.messages,
      events: readSessionEvents(this.session.path),
      sessions: Session.list(this.cwd, { includeArchived: true }),
      tools: registry.all().map((tool) => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        summary: TOOL_SUMMARY[tool.name] ?? "",
        defaultDecision: DEFAULT_PERMISSIONS[tool.category],
        parameters: tool.parameters,
      })),
      features: FEATURES,
      docs: this.listDocs(),
      pendingApprovals: [...this.pendingApprovals.values()].map((item) => ({
        id: item.id,
        ...item.request,
      })),
      todos: getTodos(this.session.toolState),
      contextUsage,
    };
  }

  private listDocs(): Array<{ title: string; file: string }> {
    const dir = path.join(this.cwd, "docs");
    try {
      return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => ({ title: name.replace(/\.md$/, ""), file: `docs/${name}` }));
    } catch {
      return [];
    }
  }

  // ---- 事件流 ----

  private emit(type: string, data: Record<string, unknown> = {}): void {
    const event = { seq: ++this.seq, ts: Date.now(), type, data };
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const listener of this.listeners) {
      try {
        listener.write(line);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }

  private handleEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write("retry: 2000\n\n");
    res.write(
      `data: ${JSON.stringify({ seq: ++this.seq, ts: Date.now(), type: "hello", data: { state: this.snapshot() } })}\n\n`,
    );
    this.listeners.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* 连接已断开 */
      }
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.listeners.delete(res);
    };
    req.on("close", cleanup);
    req.on("error", cleanup);
  }

  // ---- 权限审批 ----

  private askApproval(request: ConfirmRequest): Promise<ConfirmAnswer> {
    const id = randomUUID();
    this.emit("permission_request", { id, ...request });

    return new Promise<ConfirmAnswer>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(id);
        this.emit("permission_resolved", {
          id,
          allowed: false,
          reason: "等待用户确认超时（10 分钟），已自动拒绝",
        });
        resolve("no");
      }, 10 * 60_000);

      this.pendingApprovals.set(id, {
        id,
        request,
        timer,
        resolve: (answer) => {
          clearTimeout(timer);
          this.pendingApprovals.delete(id);
          resolve(answer);
        },
      });
    });
  }

  private resolveApproval(id: string, decision: unknown): void {
    const pending = this.pendingApprovals.get(id);
    if (!pending) throw new HttpError(404, "这个审批已经过期或不存在");
    if (decision !== "yes" && decision !== "no" && decision !== "always") {
      throw new HttpError(400, 'decision 只能是 "yes" / "no" / "always"');
    }
    const answer: ConfirmAnswer = decision;
    pending.resolve(answer);
    // 真正的 allowed 由 Permissions.check 决定（危险命令的 always 不记忆等规则在那里）
    this.emit("permission_resolved", {
      id,
      allowed: answer !== "no",
      reason: answer === "no" ? "用户拒绝" : "用户允许",
    });
  }

  // ---- MCP 生命周期（可选） ----

  /**
   * 让外部（mcp-dev 的 ensureMcp）按当前工作区准备好 MCP 工具。
   *
   * 为什么放在 server.ts？因为“什么时候加载”只有服务端知道：
   * 每个回合开始前、切换工作区之后。MCP 自己的实现不关心 HTTP 的时序。
   * 钩子是可选参数：不传（或抛错）都不影响对话，只是没有 MCP 工具而已。
   */
  private async ensureMcp(): Promise<void> {
    const ensure = this.mcp.ensure;
    if (!ensure) return;
    try {
      await ensure(this.cwd);
    } catch (err) {
      console.error("[web] 加载 MCP 失败（不影响对话）：", err);
    }
  }

  // ---- 运行一个回合 ----

  /**
   * 检查 + 启动一个回合。
   *
   * content 是“多模态消息内容”：纯文字时是 string，带图片时是 ContentPart[]，
   * 由 /api/message 里的 buildUserContent(text, images) 生成。
   * images 只用于 SSE 即时展示（原样 dataUrl），模型请求只认 content。
   *
   * 注意 async：MCP 加载要 await，所以 HTTP 路由也要 await 本方法再回 202。
   */
  async startRun(content: MessageContent, images: IncomingImage[] = []): Promise<void> {
    if (this.busy) throw new HttpError(409, "上一轮还在运行，请等它结束或点 Stop。");
    const text = contentToText(content);
    if (!text.trim() && images.length === 0) {
      throw new HttpError(400, "内容不能为空（文字和图片至少要有一样）");
    }
    const provider = this.ensureProvider();

    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;

    this.emit("run_state", { busy: true });

    // 上一个任务的 todo 如果已经全部完成，新任务开始时清空，避免旧任务列表一直挂在侧栏。
    // 注意：清空也要落盘 —— todo 现在是会话状态，只清内存的话
    // 切走再切回来（或重启服务）那份“已完成”的旧清单会从 JSONL 里复活。
    const previousTodos = getTodos(this.session.toolState);
    if (previousTodos.length > 0 && previousTodos.every((todo) => todo.status === "completed")) {
      this.session.toolState.todos = [];
      this.session.persistTodos([]);
      this.emit("todos", { todos: [] });
    }

    // 每回合开始前确保 MCP 已按当前工作区加载（可选钩子；失败只记日志）
    await this.ensureMcp();

    this.session.appendMessage({ role: "user", content });
    // 契约：text 是提取后的文字，images 原样 dataUrl 给前端即时显示。
    // content 是给旧前端的兼容别名（新版前端用 text + images）。
    this.emit("user_message", { text, images, content: text });

    void this.executeRun(provider, controller.signal);
  }

  private async executeRun(provider: LLMProvider, signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    const registry = buildRegistry(this.mode);
    const system = buildSystemPrompt({
      cwd: this.cwd,
      mode: this.mode,
      model: provider.model,
      agentsMd: loadProjectRules(this.cwd),
      toolNames: registry.names,
      skills: loadSkills(this.cwd),
    });
    const bridge = new WebBridge((type, data) => this.emit(type, data));

    const trace = (event: TraceEvent): void => {
      // trace 也进会话文件：这样“记录”包含每一步的上下文大小/压缩等结构信息
      this.session.appendEvent(event as unknown as Record<string, unknown>);
      this.emit("trace", event as unknown as Record<string, unknown>);
    };

    try {
      this.emit("run_start", {
        model: provider.model,
        mode: this.mode,
        mock: this.config.mock,
      });

      const result = await runAgent({
        provider,
        registry,
        system,
        history: this.session.messages,
        cwd: this.cwd,
        maxSteps: this.config.maxSteps,
        maxToolCalls: this.config.maxToolCalls,
        contextBudget: this.config.contextBudget,
        reasoningEffort: this.config.reasoningEffort,
        permissions: this.permissions,
        ui: bridge,
        signal,
        session: this.session,
        toolState: this.session.toolState,
        // todo 等会话状态落盘：工具改完立刻写一行，切会话/重启都能恢复。
        onToolStateChange: (state: Record<string, unknown>) => {
          const todos = state.todos;
          if (Array.isArray(todos)) this.session.persistTodos(todos);
        },
        spawnSubagent: (request: SubagentRequest) => this.runSubagent(request, registry, signal),
        trace,
      });

      const turnEnd = {
        steps: result.steps,
        usage: result.usage,
        aborted: result.aborted,
        hitStepLimit: result.hitStepLimit,
        toolDenials: result.toolDenials,
        durationMs: Date.now() - startedAt,
      };
      this.session.appendEvent({ type: "turn_end", ...turnEnd });
      this.emit("turn_end", turnEnd);
      this.emit("usage", {
        promptTokens: result.usage.prompt_tokens ?? 0,
        completionTokens: result.usage.completion_tokens ?? 0,
        cacheHitTokens: result.usage.prompt_cache_hit_tokens ?? 0,
        cacheMissTokens: result.usage.prompt_cache_miss_tokens ?? 0,
        steps: result.steps,
        durationMs: turnEnd.durationMs,
      });
    } catch (err) {
      const message = this.explainError(err);
      this.session.appendEvent({ type: "error", message });
      this.emit("error", { message });
      this.emit("turn_end", {
        steps: 0,
        aborted: false,
        hitStepLimit: false,
        toolDenials: 0,
        durationMs: Date.now() - startedAt,
        error: message,
      });
    } finally {
      this.busy = false;
      this.controller = null;
      this.emit("run_state", { busy: false });
      this.emit("sessions", { sessions: Session.list(this.cwd, { includeArchived: true }) });
      this.emit("todos", { todos: getTodos(this.session.toolState) });
      // 让前端在回合结束后拉一次完整快照，保证状态绝对一致
      this.emit("turn_complete", { sessionId: this.session.meta.id });
    }
  }

  private async runSubagent(
    request: SubagentRequest,
    registry: ReturnType<typeof buildRegistry>,
    signal: AbortSignal,
  ): Promise<string> {
    this.emit("info", { message: `派子 Agent 调研：${request.description}` });
    const result = await spawnSubagent({
      provider: this.ensureProvider(),
      parentRegistry: registry,
      cwd: this.cwd,
      contextBudget: this.config.contextBudget,
      permissions: this.permissions,
      signal,
      description: request.description,
      prompt: request.prompt,
    });
    this.emit("info", { message: `子 Agent 返回 ${result.length} 字符结论` });
    return result;
  }

  private explainError(err: unknown): string {
    return explainLLMError(err);
  }

  // ---- 操作 ----

  abortRun(): void {
    if (!this.busy || !this.controller) throw new HttpError(400, "当前没有正在运行的任务");
    this.emit("notice", { message: "已请求中断当前回合…" });

    // 关键：如果 Agent 正卡在“等待用户审批”上，只 abort signal 是没用的——
    // 主循环在 await Permissions.check() 的 Promise。必须把所有挂起的审批
    // 直接 resolve 成拒绝，循环才能继续走到 abort 检查点。
    for (const pending of [...this.pendingApprovals.values()]) {
      this.emit("permission_resolved", {
        id: pending.id,
        allowed: false,
        reason: "用户中断了回合，审批自动拒绝",
      });
      pending.resolve("no");
    }

    this.controller.abort();
  }

  /**
   * 可选：把网页里填的配置写进项目根 .env（0600），这样重启 web 后不用重填 key。
   * 默认不写；只有前端勾选"保存到 .env"并传 persist=true 才写。
   */
  private persistEnv(): void {
    const target = path.join(this.initialCwd, ".env");
    const values: Record<string, string> = {
      OPENAI_BASE_URL: this.config.baseUrl,
      MINI_MODEL: this.config.model,
      MINI_TEMPERATURE: String(this.config.temperature),
      MINI_CONTEXT_BUDGET: String(this.config.contextBudget),
      MINI_MAX_STEPS: String(this.config.maxSteps),
      MINI_MAX_TOOL_CALLS: String(this.config.maxToolCalls),
      MINI_REPEAT_GUARD: this.config.repeatGuard ? "1" : "0",
      MINI_MOCK: this.config.mock ? "1" : "0",
    };
    // 变量名必须是 MINI_API_KEY：config.ts 的读取顺序是
    // MINI_API_KEY > DEEPSEEK_API_KEY > OPENAI_API_KEY，写 DEEPSEEK_API_KEY
    // 会在 .env 里已有 MINI_API_KEY 时被旧值盖住（“保存了但重启不生效”）。
    //
    // 另外：key 为空时干脆不写。否则用户只是改了个 model 却把
    // MINI_API_KEY= 空值写进 .env，重启后反而把原来能用的 key 覆盖掉。
    if (this.config.apiKey) values.MINI_API_KEY = this.config.apiKey;
    let lines: string[] = [];
    try {
      lines = fs.readFileSync(target, "utf8").split("\n");
    } catch {
      lines = [];
    }
    const keys = new Set(Object.keys(values));
    const output: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match && keys.has(match[1]!)) {
        const key = match[1]!;
        if (!seen.has(key)) {
          output.push(`${key}=${values[key]}`);
          seen.add(key);
        }
        continue;
      }
      output.push(line);
    }
    for (const [key, value] of Object.entries(values)) {
      if (!seen.has(key)) output.push(`${key}=${value}`);
    }
    while (output.length > 0 && output[output.length - 1] === "") output.pop();
    fs.writeFileSync(target, output.join("\n") + "\n", { mode: 0o600 });
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      /* 某些文件系统不支持 chmod，忽略 */
    }
  }

  updateConfig(body: Record<string, unknown>): Record<string, unknown> {
    if (this.busy) throw new HttpError(409, "运行中不能改模型配置");
    if (typeof body.apiKey === "string") this.config.apiKey = body.apiKey.trim();
    if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
      this.config.baseUrl = body.baseUrl.trim();
    }
    if (typeof body.model === "string" && body.model.trim()) {
      this.config.model = body.model.trim();
    }
    if (typeof body.mock === "boolean") this.config.mock = body.mock;
    if (body.temperature !== undefined) {
      const value = Number(body.temperature);
      if (!Number.isFinite(value) || value < 0 || value > 2) {
        throw new HttpError(400, "temperature 需要 0~2 之间的数字");
      }
      this.config.temperature = value;
    }
    if (body.maxSteps !== undefined) {
      const value = Number(body.maxSteps);
      if (!Number.isInteger(value) || value < 0 || value > 10_000) {
        throw new HttpError(400, "maxSteps 需要 0~10000 的整数（0=不限）");
      }
      this.config.maxSteps = value;
    }
    if (body.maxToolCalls !== undefined) {
      const value = Number(body.maxToolCalls);
      // 0 = 不限（与 maxSteps 语义保持一致）。默认配置就是 0，
      // 如果这里只接受 ≥1，用户「什么都不改直接保存」会被卡死。
      if (!Number.isInteger(value) || value < 0 || value > 10_000) {
        throw new HttpError(400, "maxToolCalls 需要 0~10000 的整数（0=不限）");
      }
      this.config.maxToolCalls = value;
    }
    if (body.reasoningEffort !== undefined) {
      const value = String(body.reasoningEffort);
      if (!["default", "low", "medium", "high", "max"].includes(value)) {
        throw new HttpError(400, "reasoningEffort 只能是 default/low/medium/high/max");
      }
      this.config.reasoningEffort = value as typeof this.config.reasoningEffort;
    }
    if (body.contextBudget !== undefined) {
      const value = Number(body.contextBudget);
      if (!Number.isInteger(value) || value < 1000 || value > 2_000_000) {
        throw new HttpError(400, "contextBudget 需要 1000~2000000 之间的整数");
      }
      this.config.contextBudget = value;
    }
    if (body.persist === true) this.persistEnv();
    this.refreshProvider();
    this.emit("config", this.publicConfig());
    return this.publicConfig();
  }

  setMode(next: unknown): void {
    if (next !== "build" && next !== "plan") throw new HttpError(400, "mode 只能是 build / plan");
    if (this.busy) throw new HttpError(409, "运行中不能切模式");
    this.mode = next;
    this.emit("mode", { mode: this.mode });
  }

  // ---- 三级权限 ----

  /** 当前三级权限档：yolo 优先级最高，其次是 acceptEdits（兼容这两个旧字段的任意组合）。 */
  private get permissionLevel(): PermissionLevel {
    if (this.permissions.isYolo) return "auto";
    if (this.permissions.isAcceptEdits) return "accept-edits";
    return "ask";
  }

  /**
   * 设置三级权限档（契约的核心映射）：
   *   ask          → yolo=false, acceptEdits=false（改文件、跑命令都要问）
   *   accept-edits → yolo=false, acceptEdits=true （自动改文件，bash 仍然要问）
   *   auto         → yolo=true,  acceptEdits=false（全自动，等价旧的 --yolo）
   */
  setPermissionLevel(value: unknown): PermissionLevel {
    if (!isPermissionLevel(value)) {
      throw new HttpError(400, 'level 只能是 "ask" / "accept-edits" / "auto"');
    }
    if (this.busy) throw new HttpError(409, "运行中不能切换权限档位");
    this.applyPermissionLevel(value);
    this.emit("permission", { level: value });
    return value;
  }

  private applyPermissionLevel(level: PermissionLevel): void {
    this.permissions.setYolo(level === "auto");
    this.permissions.setAcceptEdits(level === "accept-edits");
  }

  /** 旧接口：只开关 yolo（内部仍然统一到同一套权限状态）。 */
  setYolo(value: unknown): void {
    if (typeof value !== "boolean") throw new HttpError(400, "value 必须是 boolean");
    this.permissions.setYolo(value);
    this.emit("yolo", { value });
    // 旧接口也同步新的三级事件：前端只监听一个来源就能对齐状态
    this.emit("permission", { level: this.permissionLevel });
  }

  /** 旧接口：只开关 acceptEdits。 */
  setAcceptEdits(value: unknown): void {
    if (typeof value !== "boolean") throw new HttpError(400, "value 必须是 boolean");
    this.permissions.setAcceptEdits(value);
    this.emit("accept_edits", { value });
    this.emit("permission", { level: this.permissionLevel });
  }

  // ---- 工作区 ----

  /**
   * 列出一个目录下的子目录（契约：只列目录、不递归、按名称排序）。
   *
   * 指向目录的符号链接也算目录（用软链接组织项目很常见）；
   * 判断失败（悬空链接等）就当它不是目录跳过，不影响整个列表。
   */
  private listWorkspaceEntries(dir: string): Array<{ name: string; path: string; isDir: boolean }> {
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      throw new HttpError(400, `无法读取目录：${dir}（${messageOf(err)}）`);
    }

    const entries: Array<{ name: string; path: string; isDir: boolean }> = [];
    for (const dirent of dirents) {
      const full = path.join(dir, dirent.name);
      let isDir = dirent.isDirectory();
      if (!isDir && dirent.isSymbolicLink()) {
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {
          isDir = false;
        }
      }
      if (isDir) entries.push({ name: dirent.name, path: full, isDir: true });
    }
    // 故意不用 localeCompare：不同系统/locale 的排序规则可能不同，
    // 用码点比较才能保证“同一份目录列表，在任何机器上顺序都一样”。
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return entries;
  }

  /** GET /api/workspace：浏览目录（不带 path 就是当前工作区）。 */
  workspaceInfo(rawPath: string | null): Record<string, unknown> {
    const target = rawPath && rawPath.trim() ? resolveExistingDirectory(rawPath, "path") : this.cwd;
    const parent = path.dirname(target);
    return {
      workspace: this.cwd,
      path: target,
      parent: parent === target ? null : parent,
      home: os.homedir(),
      entries: this.listWorkspaceEntries(target),
      roots: [
        { name: "Home", path: os.homedir() },
        { name: "根目录", path: path.parse(target).root },
      ],
    };
  }

  /**
   * POST /api/workspace：切换工作区。
   *
   * 语义是“换项目”而不是“换个文件夹看看”：
   *   - cwd 换成 realpath 后的新目录（后续所有工具都以它为边界）
   *   - 会话级“始终允许”清空（新目录不能继承旧目录的放行记忆）
   *   - 新建一个 Session；旧会话还留在旧 cwd 的 .mini-opencode/sessions 里，可随时载入
   *   - MCP 按新 cwd 重新准备（可选钩子；下次 run 也会再 ensure 一次）
   */
  async changeWorkspace(rawPath: unknown): Promise<Record<string, unknown>> {
    if (this.busy) throw new HttpError(409, "运行中不能切换工作区，请等回合结束或点 Stop。");
    const target = resolveExistingDirectory(rawPath, "path");

    this.cwd = target;
    this.permissions.clearSessionAllowed();
    this.session = Session.create({ cwd: this.cwd, model: this.config.model });
    await this.ensureMcp();

    // 契约要求：先 workspace 事件（前端换目录显示），再推一次完整快照
    this.emit("workspace", { path: this.cwd });
    const state = this.snapshot();
    this.emit("state", { state });
    return state;
  }

  switchSession(id: unknown): void {
    if (this.busy) throw new HttpError(409, "运行中不能切会话");
    // “本会话始终允许”是会话级记忆，切会话/新建会话必须清空
    this.permissions.clearSessionAllowed();

    if (id === null || id === undefined || id === "") {
      // 当前会话还没有任何消息：复用，不再落一个空文件。
      // （连点「新聊天」/ 后端启动自动创建的当前会话都走这条路径）
      if (this.session.messages.length === 0) {
        this.emit("state", { state: this.snapshot() });
        return;
      }
      this.session = Session.create({ cwd: this.cwd, model: this.config.model });
    } else if (typeof id === "string") {
      try {
        this.session = Session.load(this.cwd, id);
      } catch (err) {
        throw new HttpError(404, messageOf(err));
      }
    } else {
      throw new HttpError(400, "id 必须是字符串或 null");
    }
    this.emit("state", { state: this.snapshot() });
  }

  async compact(): Promise<{ ok: boolean; before?: number; after?: number; error?: string }> {
    if (this.busy) throw new HttpError(409, "运行中不能压缩上下文");
    const provider = this.ensureProvider();
    try {
      const result = await compactHistory({
        messages: this.session.messages,
        provider,
        keepRecent: 4,
      });
      this.session.messages.splice(0, this.session.messages.length, ...result.messages);
      this.session.appendSnapshot(this.session.messages);
      this.session.appendEvent({
        type: "compaction",
        manual: true,
        before: result.before,
        after: result.after,
        summary: result.summary,
      });
      this.emit("notice", {
        message: `已压缩上下文：约 ${result.before} → ${result.after} tokens`,
      });
      this.emit("state", { state: this.snapshot() });
      return { ok: true, before: result.before, after: result.after };
    } catch (err) {
      // 失败必须作为响应的主体返回：notice 事件在普通模式（非调试抽屉）里不展示，
      // 只发 notice 等于把失败吞掉，用户只看到一句“已请求压缩”然后就没了。
      const message = messageOf(err);
      this.emit("notice", { message: `压缩失败：${message}` });
      return { ok: false, error: message };
    }
  }

  // ---- 导出 ----

  exportSession(id: string, format: string): { body: string; filename: string; type: string } {
    const session = Session.load(this.cwd, id);
    if (format === "md" || format === "markdown") {
      return {
        body: this.buildMarkdown(session),
        filename: `mini-opencode-${id}.md`,
        type: "text/markdown; charset=utf-8",
      };
    }
    if (format === "jsonl") {
      return {
        body: fs.readFileSync(session.path, "utf8"),
        filename: `mini-opencode-${id}.jsonl`,
        type: "application/x-ndjson; charset=utf-8",
      };
    }
    // 未知格式不静默回退：调用方要什么就该得到什么，或者得到一个明确的 400
    throw new HttpError(400, `不支持的导出格式：${format}（支持 jsonl / md）`);
  }

  private buildMarkdown(session: Session): string {
    const lines: string[] = [
      `# mini-opencode 会话 ${session.meta.id}`,
      "",
      `- 创建时间：${session.meta.createdAt}`,
      `- 模型：${session.meta.model}`,
      `- 工作目录：${session.meta.cwd}`,
      "",
      "---",
      "",
    ];

    for (const event of readSessionEvents(session.path)) {
      const type = String(event.type ?? "");
      if (type === "message") {
        const message = event.message as ChatMessage | undefined;
        if (!message) continue;
        if (message.role === "user") lines.push(`## 用户`, "", contentToText(message.content), "");
        else if (message.role === "assistant") {
          lines.push(`## Agent`, "", contentToText(message.content) || "（无文本，仅调用工具）", "");
          for (const call of message.tool_calls ?? []) {
            lines.push(`> 请求调用 \`${call.function.name}\``, "", "```json", call.function.arguments, "```", "");
          }
        } else if (message.role === "tool") {
          lines.push(`### 工具结果 \`${message.name ?? ""}\``, "", "```text", contentToText(message.content), "```", "");
        }
      } else if (type === "tool") {
        lines.push(
          `> 执行工具 \`${String(event.name ?? "")}\`${event.isError ? "（失败）" : ""} ` +
            `（${String(event.durationMs ?? 0)}ms）`,
          "",
          "```json",
          String(event.arguments ?? ""),
          "```",
          "",
        );
      } else if (type === "step_start") {
        lines.push(
          `---`,
          "",
          `**第 ${String(event.step ?? "?")} 步** · 上下文约 ${String(event.contextTokens ?? "?")} tokens ` +
            `· 历史 ${String(event.historyMessages ?? "?")} 条`,
          "",
        );
      } else if (type === "compaction") {
        lines.push(`> 上下文压缩：${String(event.before)} → ${String(event.after)} tokens`, "");
      } else if (type === "turn_end") {
        lines.push(
          `> 回合结束：${String(event.steps ?? 0)} 步 · ` +
            `prompt ${String((event.usage as { prompt_tokens?: number } | undefined)?.prompt_tokens ?? 0)} / ` +
            `completion ${String((event.usage as { completion_tokens?: number } | undefined)?.completion_tokens ?? 0)} tokens`,
          "",
        );
      }
    }
    return lines.join("\n");
  }

  // ---- 路由 ----

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    try {
      // SSE
      if (pathname === "/api/events" && method === "GET") {
        this.handleEvents(req, res);
        return;
      }

      // 状态 / 元信息
      if (pathname === "/api/state" && method === "GET") {
        json(res, 200, { state: this.snapshot() });
        return;
      }
      if (pathname === "/api/meta" && method === "GET") {
        const snap = this.snapshot();
        json(res, 200, {
          version: snap.version,
          tools: snap.tools,
          features: snap.features,
          docs: snap.docs,
        });
        return;
      }

      // 工作区：浏览目录 / 切换当前工作区
      if (pathname === "/api/workspace" && method === "GET") {
        json(res, 200, this.workspaceInfo(url.searchParams.get("path")));
        return;
      }
      if (pathname === "/api/workspace" && method === "POST") {
        const body = await readJsonBody(req);
        const state = await this.changeWorkspace(body.path);
        json(res, 200, { ok: true, state });
        return;
      }

      // 模型配置
      if (pathname === "/api/config" && method === "GET") {
        json(res, 200, { config: this.publicConfig() });
        return;
      }
      if (pathname === "/api/config" && method === "POST") {
        const body = await readJsonBody(req);
        json(res, 200, { config: this.updateConfig(body) });
        return;
      }

      // 模式 / yolo
      if (pathname === "/api/mode" && method === "POST") {
        const body = await readJsonBody(req);
        this.setMode(body.mode);
        json(res, 200, { ok: true, mode: this.mode });
        return;
      }
      if (pathname === "/api/yolo" && method === "POST") {
        const body = await readJsonBody(req);
        this.setYolo(body.value);
        json(res, 200, { ok: true, yolo: this.permissions.isYolo });
        return;
      }
      if (pathname === "/api/accept-edits" && method === "POST") {
        const body = await readJsonBody(req);
        this.setAcceptEdits(body.value);
        json(res, 200, { ok: true, acceptEdits: this.permissions.isAcceptEdits });
        return;
      }

      // 三级权限：ask / accept-edits / auto
      if (pathname === "/api/permission" && method === "POST") {
        const body = await readJsonBody(req);
        const level = this.setPermissionLevel(body.level);
        json(res, 200, { ok: true, level });
        return;
      }

      // 对话
      if (pathname === "/api/message" && method === "POST") {
        // 图片是 base64 塞在 JSON 里的：4 张 4MB 的图约 22MB，所以这个接口单独放宽请求体上限
        const body = await readJsonBody(req, MAX_MESSAGE_BODY_BYTES);
        const images = parseImages(body.images);
        const text = typeof body.text === "string" ? body.text : "";
        // buildUserContent：纯文字仍返回 string（历史文件可读、兼容旧逻辑），
        // 带图片才变成 [{type:"text"},{type:"image_url"}] 数组。
        const content = buildUserContent(text, images);
        await this.startRun(content, images);
        json(res, 202, { ok: true });
        return;
      }
      if (pathname === "/api/abort" && method === "POST") {
        this.abortRun();
        json(res, 200, { ok: true });
        return;
      }
      if (pathname === "/api/approval" && method === "POST") {
        const body = await readJsonBody(req);
        this.resolveApproval(String(body.id ?? ""), body.decision);
        json(res, 200, { ok: true });
        return;
      }
      if (pathname === "/api/compact" && method === "POST") {
        json(res, 200, await this.compact());
        return;
      }

      // 会话
      if (pathname === "/api/sessions" && method === "GET") {
        const includeArchived = url.searchParams.get("archived") === "1";
        json(res, 200, { sessions: Session.list(this.cwd, { includeArchived }) });
        return;
      }
      if (pathname === "/api/session" && method === "POST") {
        const body = await readJsonBody(req);
        this.switchSession(body.id ?? null);
        json(res, 200, { state: this.snapshot() });
        return;
      }
      if (pathname.startsWith("/api/session/")) {
        if (method === "DELETE") return this.handleSessionDelete(url, res);
        if (method === "POST") return this.handleSessionAction(url, res);
        return this.handleSessionRead(url, res);
      }

      // 静态资源
      return this.serveStatic(pathname, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!(err instanceof HttpError)) {
        console.error("[web] 请求处理失败：", err);
      }
      json(res, status, { error: messageOf(err) });
    }
  }

  private handleSessionRead(url: URL, res: http.ServerResponse): void {
    // /api/session/<id> 或 /api/session/<id>/export?format=md
    const rest = url.pathname.slice("/api/session/".length).split("/");
    const id = decodeURIComponent(rest[0] ?? "");
    const isExport = rest[1] === "export";
    if (!id) throw new HttpError(400, "缺少会话 id");

    if (isExport) {
      const format = url.searchParams.get("format") ?? "jsonl";
      let exported: { body: string; filename: string; type: string };
      try {
        exported = this.exportSession(id, format);
      } catch (err) {
        // 未知导出格式是 400（参数错），只有会话不存在才是 404
        if (err instanceof HttpError) throw err;
        throw new HttpError(404, messageOf(err));
      }
      res.writeHead(200, {
        "content-type": exported.type,
        "content-disposition": `attachment; filename="${exported.filename}"`,
        "cache-control": "no-store",
      });
      res.end(exported.body);
      return;
    }

    try {
      const session = Session.load(this.cwd, id);
      json(res, 200, {
        session: {
          id: session.meta.id,
          title: session.title,
          createdAt: session.meta.createdAt,
          model: session.meta.model,
        },
        messages: session.messages,
        events: readSessionEvents(session.path),
      });
    } catch (err) {
      throw new HttpError(404, messageOf(err));
    }
  }

  /**
   * POST /api/session/<id>/archive 或 /unarchive
   *
   * 归档不会删除文件，只是往 JSONL 追加一条状态事件；因此这里返回最新列表，
   * 前端可以立即重绘，不必等 SSE。
   */
  private handleSessionAction(url: URL, res: http.ServerResponse): void {
    const rest = url.pathname.slice("/api/session/".length).split("/");
    const id = decodeURIComponent(rest[0] ?? "");
    const action = rest[1] ?? "";
    if (!id) throw new HttpError(400, "缺少会话 id");
    if (action !== "archive" && action !== "unarchive") {
      throw new HttpError(404, "未知的会话操作（只支持 archive / unarchive）");
    }

    const archived = action === "archive";
    try {
      Session.setArchived(this.cwd, id, archived);
    } catch (err) {
      throw new HttpError(404, messageOf(err));
    }

    const sessions = Session.list(this.cwd, { includeArchived: true });
    this.emit("sessions", { sessions });
    json(res, 200, { ok: true, archived, sessions });
  }

  /**
   * DELETE /api/session/<id>
   *
   * 删除当前会话会被拒绝：内存里的 `this.session` 还指着那个文件，
   * 下一次写消息会“凭空重建”一个只有新消息、没有 meta 的坏文件。
   * 先切到别的会话（或新建）再删，语义也更清楚。
   */
  private handleSessionDelete(url: URL, res: http.ServerResponse): void {
    const rest = url.pathname.slice("/api/session/".length).split("/");
    const id = decodeURIComponent(rest[0] ?? "");
    if (!id) throw new HttpError(400, "缺少会话 id");
    if (rest.length > 1) throw new HttpError(404, "删除接口不接受子路径");
    if (id === this.session.meta.id) {
      throw new HttpError(409, "不能删除当前正在使用的会话，先切换或新建一个会话再删");
    }

    try {
      Session.remove(this.cwd, id);
    } catch (err) {
      throw new HttpError(404, messageOf(err));
    }

    const sessions = Session.list(this.cwd, { includeArchived: true });
    this.emit("sessions", { sessions });
    json(res, 200, { ok: true, sessions });
  }

  private serveStatic(pathname: string, res: http.ServerResponse): void {
    const files: Record<string, { name: string; type: string }> = {
      "/": { name: "index.html", type: "text/html; charset=utf-8" },
      "/index.html": { name: "index.html", type: "text/html; charset=utf-8" },
      "/app.js": { name: "app.js", type: "text/javascript; charset=utf-8" },
      "/style.css": { name: "style.css", type: "text/css; charset=utf-8" },
    };
    const hit = files[pathname];
    if (!hit) {
      json(res, 404, { error: "not found" });
      return;
    }
    const full = path.join(PUBLIC_DIR, hit.name);
    try {
      const body = fs.readFileSync(full);
      res.writeHead(200, { "content-type": hit.type, "cache-control": "no-store" });
      res.end(body);
    } catch {
      text(res, 500, `Web UI 文件缺失：${full}`);
    }
  }

  dispose(): void {
    for (const pending of this.pendingApprovals.values()) {
      clearTimeout(pending.timer);
      pending.resolve("no");
    }
    this.pendingApprovals.clear();
    for (const listener of this.listeners) {
      try {
        listener.end();
      } catch {
        /* ignore */
      }
    }
    this.listeners.clear();
  }

  /**
   * 服务关闭时的收尾。
   *
   * MCP 子进程是“被服务启动的”，服务退出时必须一起带走；
   * shutdown 是可选钩子——没接 MCP 的服务不用关心，接了也要容忍它抛错。
   */
  async shutdown(): Promise<void> {
    this.dispose();
    const shutdownMcp = this.mcp.shutdown;
    if (!shutdownMcp) return;
    try {
      await shutdownMcp();
    } catch (err) {
      console.error("[web] 关闭 MCP 失败：", err);
    }
  }
}

// ---------------------------------------------------------------------------
// 启动服务器
// ---------------------------------------------------------------------------
export async function startWebServer(options: WebServerOptions): Promise<WebServerHandle> {
  const app = new WebApp(options);
  const server = http.createServer((req, res) => {
    void app.handle(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });

  const address = server.address() as AddressInfo | null;
  const port = address?.port ?? options.port;
  const url = `http://${options.host}:${port}`;

  const modelLine = options.config.mock
    ? "mock 假模型（离线演示）"
    : options.config.apiKey
      ? `${options.config.model}（真实模型）`
      : "未配置 API key（可在网页里填，或先勾选 mock）";

  console.log("");
  console.log("  ┌ mini-opencode web");
  console.log(`  │ 打开：${url}`);
  console.log(`  │ 模型：${modelLine}`);
  console.log("  │ 提示：默认只监听本机；按 Ctrl+C 停止");
  console.log("  └");

  const onSignal = () => {
    void handle.close().finally(() => process.exit(0));
  };

  const handle: WebServerHandle = {
    url,
    port,
    host: options.host,
    close: async () => {
      // 测试里会反复 start/close，信号监听必须摘掉，避免越积越多
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      // 先解挂审批/SSE，再兜底关闭 MCP 子进程，最后关 HTTP 服务
      await app.shutdown();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  return handle;
}
