/**
 * ============================================================================
 * MCP 配置加载：读 mcp.json，把“用户想接哪些 server”翻译成结构化配置
 * ============================================================================
 *
 * 配置长这样（项目根 mcp.json，官方生态里几乎都用 mcpServers 这个字段名）：
 *
 *   {
 *     "mcpServers": {
 *       "demo": { "command": "node", "args": ["./test/fixtures/mcp-echo-server.mjs"] }
 *     }
 *   }
 *
 * 这里有两个设计原则，都是被真实使用场景逼出来的：
 *
 * 1）**坏配置不能崩程序**。
 *    Agent 是用户天天要用的东西，不能因为 mcp.json 少个逗号就启动不了。
 *    所以解析失败不 throw，而是返回 errors 数组，由上层打日志并跳过 MCP。
 *
 * 2）**配置可以没有**。
 *    绝大多数用户根本不用 MCP，没有 mcp.json 是正常状态，不能报错。
 *
 * 配置文件查找顺序：
 *   - 环境变量 MINI_MCP_CONFIG 指定的路径（相对路径按当前工作目录解析）
 *   - 否则 <cwd>/mcp.json
 *
 * 注意 cwd 在 CLI 下就是项目根；Web 版切换工作区后会变成新的工作区目录，
 * 也就是“每个工作区可以有自己的 mcp.json”。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/** 默认配置文件名叫 mcp.json（与社区惯例一致）。 */
export const MCP_CONFIG_FILE_NAME = "mcp.json";

/** 单个 MCP server 的启动配置（已经校验过、可以直接拿来 spawn）。 */
export interface McpServerEntry {
  /** 配置里的 key，同时也是工具名前缀，例如 demo。 */
  name: string;
  /** 要启动的可执行文件，例如 "node" / "npx" / "python"。 */
  command: string;
  /** 传给命令的参数。 */
  args: string[];
  /** 额外环境变量（会覆盖进程环境里同名的变量）。 */
  env: Record<string, string>;
  /** 子进程工作目录；缺省用当前工作区。 */
  cwd?: string;
  /** 单次请求超时毫秒数；缺省 30000（30 秒）。 */
  timeoutMs?: number;
}

/** 一次配置加载的完整结果。 */
export interface McpConfig {
  /** 实际去读的配置文件绝对路径（即使文件不存在也给出路径，方便排错）。 */
  configPath: string;
  /** 文件是否存在。false = 没有 MCP，属于正常情况。 */
  found: boolean;
  /**
   * 配置指纹：路径 + 文件原文。
   * 上层用它判断“配置有没有变”，变了才重连 server（否则每回合重启子进程太浪费）。
   */
  fingerprint: string;
  servers: McpServerEntry[];
  /** 配置层面的问题（JSON 语法错、字段类型错、单个 server 配置坏）。 */
  errors: string[];
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 计算要读的配置文件路径。环境变量优先，相对路径按 cwd 解析。 */
export function resolveMcpConfigPath(cwd: string): string {
  const override = process.env.MINI_MCP_CONFIG?.trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(cwd, override);
  }
  return path.join(cwd, MCP_CONFIG_FILE_NAME);
}

/**
 * 解析配置文本（纯函数，方便单测）。
 *
 * 校验策略：**尽量宽容**。一个 server 配置坏了只跳过它，不连累别的 server；
 * 所有问题都塞进 errors 返回，由调用方决定怎么提示。
 */
export function parseMcpConfig(raw: string): {
  servers: McpServerEntry[];
  errors: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { servers: [], errors: [`JSON 解析失败：${messageOf(err)}`] };
  }

  if (!isPlainObject(parsed)) {
    return { servers: [], errors: ["配置顶层必须是一个 JSON 对象"] };
  }

  const table = parsed.mcpServers;
  if (table === undefined) {
    return { servers: [], errors: ['配置缺少 "mcpServers" 字段'] };
  }
  if (!isPlainObject(table)) {
    return { servers: [], errors: ['"mcpServers" 必须是一个对象（server 名 → 启动配置）'] };
  }

  const servers: McpServerEntry[] = [];
  const errors: string[] = [];

  for (const [name, value] of Object.entries(table)) {
    if (!isPlainObject(value)) {
      errors.push(`server "${name}"：配置必须是一个对象`);
      continue;
    }

    // 支持 disabled 开关：临时关掉某个 server 不用删配置。
    if (value.disabled === true) continue;

    const command = value.command;
    if (typeof command !== "string" || command.trim() === "") {
      errors.push(`server "${name}"：缺少 command（要启动的命令，例如 "node"）`);
      continue;
    }

    let args: string[] = [];
    if (value.args !== undefined) {
      if (!Array.isArray(value.args) || !value.args.every((a) => typeof a === "string")) {
        errors.push(`server "${name}"：args 必须是字符串数组`);
        continue;
      }
      args = value.args as string[];
    }

    const env: Record<string, string> = {};
    if (value.env !== undefined) {
      if (!isPlainObject(value.env)) {
        errors.push(`server "${name}"：env 必须是一个对象`);
        continue;
      }
      let envOk = true;
      for (const [key, envValue] of Object.entries(value.env)) {
        if (typeof envValue !== "string") {
          errors.push(`server "${name}"：环境变量 ${key} 的值必须是字符串`);
          envOk = false;
          break;
        }
        env[key] = envValue;
      }
      if (!envOk) continue;
    }

    let cwd: string | undefined;
    if (value.cwd !== undefined) {
      if (typeof value.cwd !== "string" || value.cwd.trim() === "") {
        errors.push(`server "${name}"：cwd 必须是非空字符串`);
        continue;
      }
      cwd = value.cwd;
    }

    let timeoutMs: number | undefined;
    if (value.timeoutMs !== undefined) {
      if (
        typeof value.timeoutMs !== "number" ||
        !Number.isFinite(value.timeoutMs) ||
        value.timeoutMs <= 0
      ) {
        errors.push(`server "${name}"：timeoutMs 必须是正数（毫秒）`);
        continue;
      }
      timeoutMs = value.timeoutMs;
    }

    servers.push({ name, command: command.trim(), args, env, cwd, timeoutMs });
  }

  return { servers, errors };
}

/**
 * 读取并解析 MCP 配置。
 *
 * 注意：**任何情况下都不抛异常**。没有配置文件返回 { found:false, servers:[] }；
 * 文件读不了 / 解析失败返回 errors，由上层决定打日志然后继续跑。
 */
export function loadMcpConfig(cwd: string): McpConfig {
  const configPath = resolveMcpConfigPath(cwd);

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // “没配 MCP”是正常状态，不产生任何错误噪音。
      return {
        configPath,
        found: false,
        fingerprint: `missing:${configPath}`,
        servers: [],
        errors: [],
      };
    }
    return {
      configPath,
      found: false,
      fingerprint: `unreadable:${configPath}`,
      servers: [],
      errors: [`读取 MCP 配置失败（${configPath}）：${messageOf(err)}`],
    };
  }

  const parsed = parseMcpConfig(raw);

  // 相对路径参数（./xxx、../xxx）按“配置文件所在目录”解析，而不是按当前工作区。
  // 原因：Web 版切换工作区后 cwd 会变，但 mcp.json 里的脚本路径不该跟着变
  // （例如 ./test/fixtures/mcp-echo-server.mjs 属于项目，不属于用户新选的工作区）。
  // 只解析“解析后确实存在”的路径，其余原样交给 server（比如 filesystem 的 "." 仍按工作区）。
  const configDir = path.dirname(configPath);
  const resolveArg = (arg: string): string => {
    if (!arg.startsWith("./") && !arg.startsWith("../")) return arg;
    const absolute = path.resolve(configDir, arg);
    return fs.existsSync(absolute) ? absolute : arg;
  };
  const servers = parsed.servers.map((server) => ({
    ...server,
    args: server.args.map(resolveArg),
    cwd: server.cwd ? path.resolve(configDir, server.cwd) : server.cwd,
  }));

  return {
    configPath,
    found: true,
    // 用完整原文当指纹：内容变了才重载，没变就复用已有子进程。
    fingerprint: `${configPath}\n${raw}`,
    servers,
    errors: parsed.errors,
  };
}
