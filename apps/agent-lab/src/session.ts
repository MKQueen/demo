/**
 * ============================================================================
 * 会话持久化：为什么用 JSONL？
 * ============================================================================
 *
 * Agent 跑一次可能几十轮、几十万 token，中间你可能会：
 *   - 关掉终端，第二天继续
 *   - 想看它到底做了什么
 *   - 程序崩了，不想丢历史
 *
 * 所以每个会话都落盘成一个 `.jsonl` 文件（JSON Lines）：
 *   每行一个 JSON 对象，追加写入。
 *
 * 为什么是 JSONL 而不是一个大的 JSON 数组？
 *   - 追加写：不用每次重写整个文件（大文件很慢）
 *   - 抗损坏：某一行坏了，其他行还能读
 *   - 可流式处理：一行一行读，内存占用小
 *
 * 真实 opencode 用 SQLite 存会话（能查询、能并发、能事件溯源），
 * 但 JSONL 是理解“事件日志”最直观的起点。
 *
 * 文件结构（每行一个对象）：
 *   {"type":"meta","meta":{...}}        ← 第一行：会话元信息
 *   {"type":"message","message":{...}}  ← 一条对话消息（user/assistant/tool）
 *   {"type":"tool","name":"bash",...}   ← 工具执行事件（只用于审计，重建历史不靠它）
 *   {"type":"compaction",...}           ← 上下文压缩事件
 *   {"type":"archive"} / {"type":"unarchive"} ← 归档状态事件（只影响列表是否显示）
 *   {"type":"snapshot","messages":[...]} ← 历史快照（压缩后用一条新快照“逻辑覆盖”旧消息）
 *
 * 恢复会话时只读 message 行 —— 因为 tool 事件不是消息，不能直接喂给模型。
 */
import fs from "node:fs";
import path from "node:path";
import type { ChatMessage } from "./llm/types.ts";
import { contentSummary } from "./llm/content.ts";
import { nowIso, oneLine, shortId } from "./util.ts";

export interface SessionMeta {
  id: string;
  createdAt: string;
  cwd: string;
  model: string;
}

/** 会话列表里的一项。 */
export interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  /** 是否已归档。归档只是“从默认列表里藏起来”，文件还在，随时能恢复。 */
  archived: boolean;
}

/** 会话目录：项目内 `.mini-opencode/sessions/`，方便你直接打开看。 */
export function sessionsDir(cwd: string): string {
  return path.join(cwd, ".mini-opencode", "sessions");
}

/**
 * 清理「空会话」文件：只写了 meta、没有任何对话内容的会话。
 *
 * 为什么需要它？
 *   每次启动 Web 服务都会先创建一个新会话（这是“当前会话”），但用户可能
 *   还没发消息就关掉了。日积月累，会话列表里会堆满「(空会话)」，既不好看
 *   也不方便找历史。启动时顺手清掉这些空壳即可（当前会话保留）。
 *
 * 保守策略：只删「解析后一条 message / snapshot 都没有」的文件；
 *   遇到坏行（JSON 解析失败）直接跳过不删，避免误伤写了一半的会话。
 *
 * @returns 删除的文件数
 */
export function pruneEmptySessions(cwd: string, keepId?: string): number {
  const dir = sessionsDir(cwd);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0; // 目录不存在 = 没有可清理的
  }

  const keepFile = keepId ? `${keepId}.jsonl` : null;
  let removed = 0;

  for (const name of names) {
    if (!name.endsWith(".jsonl") || name === keepFile) continue;
    const file = path.join(dir, name);
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    let hasConversation = false;
    let broken = false;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as { type?: string };
        if (event && (event.type === "message" || event.type === "snapshot")) {
          hasConversation = true;
          break;
        }
      } catch {
        broken = true; // 坏行：宁可留着，也不要删掉可能有内容的文件
        break;
      }
    }

    if (hasConversation || broken) continue;
    try {
      fs.unlinkSync(file);
      removed++;
    } catch {
      /* 删不掉就算了（权限/占用），不影响启动 */
    }
  }

  return removed;
}

/** 会话 id 只允许安全字符，防止 `--session ../../x` 读到目录外的文件。 */
function assertSafeSessionId(id: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`非法会话 id：${JSON.stringify(id)}（只允许字母、数字、- 和 _）`);
  }
}

export class Session {
  readonly meta: SessionMeta;
  /** 对话历史（恢复会话后会被填满）。 */
  readonly messages: ChatMessage[] = [];
  /** 会话级工具状态（比如 todo 清单），不落盘。 */
  readonly toolState: Record<string, unknown> = {};
  private readonly file: string;

  private constructor(meta: SessionMeta, file: string) {
    this.meta = meta;
    this.file = file;
  }

  /** 新建会话：立刻写第一行 meta。 */
  static create(options: { cwd: string; model: string }): Session {
    const dir = sessionsDir(options.cwd);
    fs.mkdirSync(dir, { recursive: true });

    const meta: SessionMeta = {
      id: shortId(),
      createdAt: nowIso(),
      cwd: options.cwd,
      model: options.model,
    };
    const file = path.join(dir, `${meta.id}.jsonl`);
    const session = new Session(meta, file);
    session.writeLine({ type: "meta", meta });
    return session;
  }

  /** 从磁盘恢复会话。 */
  static load(cwd: string, id: string): Session {
    // 安全：id 来自用户输入（--session / /session），必须防路径穿越。
    // 例如 id = "../../evil" 会读出 sessions 目录外的文件。
    assertSafeSessionId(id);

    const file = path.join(sessionsDir(cwd), `${id}.jsonl`);
    if (!fs.existsSync(file)) {
      throw new Error(`会话不存在：${id}（在 ${sessionsDir(cwd)} 里找不到）`);
    }

    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    let meta: SessionMeta | null = null;
    const messages: ChatMessage[] = [];
    /** 最后一次 todos 事件里的清单（没有就是空数组）。 */
    let todos: unknown[] = [];

    for (const line of lines) {
      let parsed: {
        type?: string;
        meta?: SessionMeta;
        message?: ChatMessage;
        messages?: ChatMessage[];
        todos?: unknown;
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // 坏行跳过，不影响其他内容
      }
      if (parsed.type === "meta" && parsed.meta) {
        meta = parsed.meta;
      } else if (parsed.type === "todos") {
        // todo 清单也是事件：后写的整份覆盖先写的（todowrite 语义就是“整表替换”）。
        // 这样恢复会话时能看到“上次做到哪一步了”，而不是一片空白。
        todos = Array.isArray(parsed.todos) ? parsed.todos : [];
      } else if (parsed.type === "snapshot" && Array.isArray(parsed.messages)) {
        // 快照 = “从这里开始，历史以我为准”。压缩后恢复靠它。
        messages.length = 0;
        messages.push(...parsed.messages);
      } else if (parsed.type === "message" && parsed.message) {
        messages.push(parsed.message);
      }
    }

    if (!meta) {
      throw new Error(`会话文件损坏（没有 meta 行）：${file}`);
    }

    const session = new Session(meta, file);
    session.messages.push(...messages);
    if (todos.length) session.toolState.todos = todos;
    return session;
  }

  /**
   * 列出会话（按更新时间倒序）。
   *
   * 默认只返回“未归档”的会话；传 `includeArchived: true` 则连归档的一起返回
   * （网页端需要拿到全部数据，才能切换“显示归档”并恢复）。
   */
  static list(cwd: string, options: { includeArchived?: boolean } = {}): SessionSummary[] {
    const dir = sessionsDir(cwd);
    if (!fs.existsSync(dir)) return [];

    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        const id = name.replace(/\.jsonl$/, "");
        let title = "(空会话)";
        let messageCount = 0;
        let archived = false;
        // 多模态消息的 content 可能是数组：用 contentSummary 提取文字/图片数
        const rememberTitle = (content: ChatMessage["content"]) => {
          const summary = contentSummary(content).trim();
          if (title === "(空会话)" && summary) title = oneLine(summary, 48);
        };
        let lines: string[] = [];
        try {
          lines = fs.readFileSync(full, "utf8").split("\n");
        } catch {
          // 文件读不了也不影响列表
        }
        for (const line of lines) {
          if (!line) continue;
          let parsed: { type?: string; message?: ChatMessage; messages?: ChatMessage[] };
          try {
            parsed = JSON.parse(line);
          } catch {
            continue; // 坏行跳过，后面的行照常统计（注释承诺的“抗损坏”）
          }
          // 归档状态也是事件：后写的覆盖先写的，所以“最后一条 archive/unarchive 生效”。
          // 这样既不用重写 JSONL，也不会丢掉审计痕迹。
          if (parsed.type === "archive") {
            archived = true;
            continue;
          }
          if (parsed.type === "unarchive") {
            archived = false;
            continue;
          }
          if (parsed.type === "snapshot" && Array.isArray(parsed.messages)) {
            messageCount = parsed.messages.length;
            title = "(空会话)";
            for (const message of parsed.messages) {
              if (message.role === "user") rememberTitle(message.content);
            }
            continue;
          }
          if (parsed.type !== "message" || !parsed.message) continue;
          messageCount++;
          if (parsed.message.role === "user") {
            rememberTitle(parsed.message.content);
          }
        }
        return {
          id,
          title,
          messageCount,
          updatedAt: stat.mtime.toISOString(),
          archived,
        };
      })
      .filter((item) => options.includeArchived || !item.archived)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  /**
   * 归档 / 取消归档。
   *
   * 为什么是“追加事件”而不是把文件挪到别的目录？
   *   - 会话日志本来就是 append-only 的事件流，追加一行最自然；
   *   - 挪文件会让“当前会话”的路径失效，而且没有恢复入口；
   *   - 追加一行 archive/unarchive 后，`Session.list` 按“最后一条状态事件”判断，
   *     文件仍然留在原处，`load` / 导出 / 恢复全都不受影响。
   */
  static setArchived(cwd: string, id: string, archived: boolean): void {
    const session = Session.load(cwd, id);
    session.appendEvent({ type: archived ? "archive" : "unarchive" });
  }

  /**
   * 永久删除会话文件。
   *
   * 和“归档”不同，这个操作不可撤销，所以网页端会二次确认，
   * 服务端也拒绝删除“当前正在使用的会话”（否则内存里的 Session 会指向一个不存在的文件）。
   */
  static remove(cwd: string, id: string): void {
    assertSafeSessionId(id);
    const file = path.join(sessionsDir(cwd), `${id}.jsonl`);
    if (!fs.existsSync(file)) {
      throw new Error(`会话不存在：${id}（在 ${sessionsDir(cwd)} 里找不到）`);
    }
    fs.unlinkSync(file);
  }

  /** 追加一条消息（更新内存 + 落盘）。给 main 这种“不经过 loop”的场景用。 */
  appendMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.persistMessage(message);
  }

  /**
   * 只落盘、不改内存。
   *
   * 为什么需要这个？
   * Agent 主循环（agent/loop.ts）自己负责把消息 push 进 history，
   * 如果这里再 push 一次，历史里就会出现重复消息 —— 模型会看到两份相同的对话，
   * token 翻倍、行为错乱（这个问题我们真的踩过）。
   *
   * 所以约定：**历史数组的所有权归主循环**，Session 只是“记录员”。
   */
  persistMessage(message: ChatMessage): void {
    this.writeLine({ type: "message", message, at: nowIso() });
  }

  /**
   * 把 todo 清单写进会话文件。
   *
   * 为什么 todo 也要落盘？
   * 它是“这个会话做到哪一步了”，属于会话的一部分。只放内存会有两个毛病：
   *   1. 切到别的会话再切回来，清单就空了（用户以为 Agent 忘了自己在干嘛）
   *   2. 服务重启/刷新页面，进度全丢
   * 而如果反过来做成“全局状态”，又会串到别的会话去 —— 两头都是错的。
   * 所以正确做法是：**状态属于会话，跟着会话的 JSONL 走**。
   *
   * 写一整份清单而不是做增量：todowrite 的语义本来就是“整表替换”，
   * 读的时候“最后一条生效”即可，不需要重放 diff。
   */
  persistTodos(todos: unknown[]): void {
    this.writeLine({ type: "todos", todos, at: nowIso() });
  }

  /** 追加一个事件（工具执行、压缩等，仅用于审计/调试）。 */
  appendEvent(event: Record<string, unknown>): void {
    this.writeLine({ ...event, at: event.at ?? nowIso() });
  }

  /**
   * 写一条历史快照。
   *
   * JSONL 是追加写、不能删旧行。上下文压缩后，旧消息还在文件里，
   * 如果恢复时照单全收，压缩就白做了。
   * 快照行表达“从这里开始，历史以这份为准”——既保留审计痕迹，又保证恢复正确。
   */
  appendSnapshot(messages: ChatMessage[]): void {
    this.writeLine({ type: "snapshot", messages, at: nowIso() });
  }

  get path(): string {
    return this.file;
  }

  get title(): string {
    const firstUser = this.messages.find(
      (message) => message.role === "user" && contentSummary(message.content).trim(),
    );
    return firstUser ? oneLine(contentSummary(firstUser.content), 48) : "(空会话)";
  }

  private writeLine(line: Record<string, unknown>): void {
    fs.appendFileSync(this.file, JSON.stringify(line) + "\n", "utf8");
  }
}
