/**
 * ============================================================================
 * bash 工具：让 Agent 能执行 shell 命令。
 * ============================================================================
 *
 * 这是**能力最强、也最危险**的工具。
 * 一旦模型能跑命令，它就能 npm install、git commit、curl 上传数据……
 * 所以真实 opencode 把 bash 默认设为 ask（要用户批准），并明确承认
 * “bash 不是沙箱”——它就是以你的用户权限在跑。
 *
 * 这个文件里有三个工程细节值得学：
 *  1. 超时：命令可能永远不退出，必须能杀
 *  2. 进程组：bash 会再 fork 子进程，只杀 bash 不够，要杀整个进程组
 *  3. 环境变量清洗：别把 API key 泄漏给“模型能跑的命令”
 */
import { spawn } from "node:child_process";
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";
import { formatDuration, truncateMiddle } from "../util.ts";

/** 默认超时：2 分钟。 */
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
/** 内存里最多保留多少字符的输出，防止一个 yes 命令把内存吃爆。 */
const MAX_CAPTURE = 300_000;

/**
 * 清洗环境变量：把疑似密钥的变量删掉再传给子进程。
 *
 * 为什么？Agent 执行的命令来自模型生成的文本。
 * 如果模型被提示注入攻击，它可能执行 `env | curl -X POST ...` 把密钥发走。
 * 删掉这些变量能显著缩小攻击面。
 *
 * 注意：这是“减少泄漏”不是“防住”，真正的隔离要靠容器/沙箱。
 */
export function scrubEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/(_KEY|_TOKEN|_SECRET|PASSWORD|APIKEY|_AUTH)$/i.test(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * 粗筛危险命令。
 *
 * 这不是安全防线（模型总能绕过），而是“提高作恶成本”的提示层：
 * 命中时权限系统会强制要求用户确认，即使用户开了自动放行。
 * 真实产品的沙箱/审批策略比这复杂得多。
 */
export function looksDangerous(command: string): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/(^|\s)sudo(\s|$)/, "使用 sudo 提权"],
    [/rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+(\/|~|\$HOME)/, "递归删除根目录或家目录"],
    [/mkfs(\.|\s)/, "格式化磁盘"],
    [/>\s*\/dev\/(sd|disk|nvme)/, "直接写磁盘设备"],
    [/(curl|wget)[^|;]*\|\s*(bash|sh|zsh)\b/, "把网络内容直接管道给 shell 执行"],
    [/:\s*\(\s*\)\s*\{.*\};?\s*:/, "fork 炸弹"],
    [/chmod\s+-R\s+777\s+\/(\s|$)/, "把根目录权限改成 777"],
    [/\bshutdown\b|\breboot\b/, "关机/重启系统"],
  ];
  for (const [pattern, reason] of patterns) {
    if (pattern.test(command)) return reason;
  }
  return null;
}

/**
 * bash 工具定义。
 *
 * 注意 execute 返回的 output 结构：命令本身 + 退出码 + stdout + stderr。
 * 为什么要带退出码？因为模型需要知道“命令是否成功”，
 * 失败时它才会去读 stderr 并修正命令，而不是傻乎乎继续下一步。
 */
export const bashTool: Tool = {
  name: "bash",
  description:
    "在工作目录中执行一条 shell 命令并返回 stdout/stderr。用于运行测试、git、npm、查看目录等。" +
    "每次调用只执行一个命令，不要用交互式命令（如 vim、top）。" +
    "命令失败时会返回非零退出码，请根据 stderr 修正后重试。",
  category: "exec",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的 shell 命令，例如 `npm test` 或 `ls -la src`",
        minLength: 1,
      },
      timeout_ms: {
        type: "number",
        description: "超时时间（毫秒），默认 120000，最大 600000",
        minimum: 1000,
        maximum: MAX_TIMEOUT_MS,
      },
      description: {
        type: "string",
        description: "用一句话说明这条命令要干什么（给人看的，会显示在 UI 上）",
      },
    },
    required: ["command"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const command = String(args.command ?? "").trim();
    if (!command) return errorResult("bash", "command 不能为空");

    const requestedTimeout = Number(args.timeout_ms ?? DEFAULT_TIMEOUT_MS);
    const timeoutMs = Math.min(
      Number.isFinite(requestedTimeout) ? requestedTimeout : DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );

    return await new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let finished = false;
      let timedOut = false;
      let truncated = false;
      // 命令本身是否已经退出（区别于 stdio 管道是否关闭）
      let exited = false;
      let exitCode: number | null = null;
      let exitSignal: NodeJS.Signals | null = null;
      let finishTimer: NodeJS.Timeout | null = null;

      // detached: true 让子进程成为新进程组的组长，
      // 这样后面可以 kill(-pid) 一次性杀掉它 fork 出来的所有子孙进程。
      const child = spawn("bash", ["-lc", command], {
        cwd: ctx.cwd,
        env: scrubEnv(process.env),
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const killTree = (signal: NodeJS.Signals) => {
        if (!child.pid) return;
        try {
          process.kill(-child.pid, signal); // 负号 = 杀整个进程组
        } catch {
          try {
            child.kill(signal);
          } catch {
            /* 进程可能已经退出 */
          }
        }
      };

      const timer = setTimeout(() => {
        if (finished) return;
        // 命令已经退出、只是管道还被后台子进程占着：
        // 这不是超时，直接按正常结束收尾，避免误报。
        if (exited) {
          finish(exitCode, exitSignal);
          return;
        }
        timedOut = true;
        killTree("SIGKILL");
      }, timeoutMs);

      const onAbort = () => killTree("SIGTERM");
      ctx.signal.addEventListener("abort", onAbort, { once: true });

      const append = (target: "stdout" | "stderr", chunk: Buffer) => {
        if (target === "stdout") {
          if (stdout.length >= MAX_CAPTURE) {
            truncated = true;
            return;
          }
          stdout += chunk.toString("utf8");
        } else {
          if (stderr.length >= MAX_CAPTURE) {
            truncated = true;
            return;
          }
          stderr += chunk.toString("utf8");
        }
      };

      child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));

      const finish = (codeRaw: number | null, signal: NodeJS.Signals | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (finishTimer) clearTimeout(finishTimer);
        ctx.signal.removeEventListener("abort", onAbort);

        // 清理命令留下的后台进程：它们继承了 stdout/stderr 管道，
        // 不杀就会变成孤儿，还可能让上层一直等 pipe 关闭。
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          /* 进程组已经不存在 */
        }

        const code = codeRaw ?? -1;
        const parts: string[] = [`$ ${command}`];
        const status = timedOut
          ? `exit code: ${code}（超时 ${formatDuration(timeoutMs)} 被强制杀掉）`
          : signal
            ? `exit code: ${code}（被信号 ${signal} 终止）`
            : `exit code: ${code}`;
        parts.push(status);

        if (stdout.trim()) {
          parts.push("--- stdout ---", truncateMiddle(stdout, 30_000));
        }
        if (stderr.trim()) {
          parts.push("--- stderr ---", truncateMiddle(stderr, 20_000));
        }
        if (!stdout.trim() && !stderr.trim()) {
          parts.push("(命令没有输出)");
        }
        if (truncated) {
          parts.push(`(输出超过 ${MAX_CAPTURE} 字符，已截断)`);
        }

        resolve({
          title: `bash · ${command.length > 60 ? command.slice(0, 60) + "…" : command}`,
          output: parts.join("\n"),
          // 退出码非 0 视为“工具失败”，模型会看到 isError 并尝试修正
          isError: code !== 0,
        });
      };

      // ⚠️ 用 exit 而不是 close 收尾。
      // close 要等所有 stdio 关闭，而后台进程（`sleep 5 &`）会继承管道，
      // 导致命令早就结束了、工具却一直卡着，最后还被误判成"超时"。
      child.on("exit", (code, signal) => {
        exited = true;
        exitCode = code;
        exitSignal = signal;
        // 再等 60ms，让 stdio 把最后一点数据刷出来再收尾
        if (!finishTimer) {
          finishTimer = setTimeout(() => finish(code, signal), 60);
        }
      });

      child.on("error", (err) => {
        stderr += `\n启动进程失败：${err.message}`;
        finish(-1, null);
      });
      child.on("close", (code, signal) => finish(code, signal));
    });
  },
};
