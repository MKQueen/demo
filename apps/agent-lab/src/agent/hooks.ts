/** Hooks：在工具执行前后运行项目配置的确定性脚本（类似 CC hooks / git hooks）。 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface HookConfig { matcher?: string; command: string; timeoutMs?: number }
interface HooksFile { preToolUse?: HookConfig[]; postToolUse?: HookConfig[] }

function loadHooks(cwd: string): HooksFile {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, ".mini-opencode/hooks.json"), "utf8")) as HooksFile;
  } catch {
    return {};
  }
}

function matches(config: HookConfig, toolName: string): boolean {
  if (!config.matcher || config.matcher === "*") return true;
  try { return new RegExp(config.matcher).test(toolName); } catch { return config.matcher === toolName; }
}

function runCommand(command: string, toolName: string, argsJson: string, cwd: string, timeoutMs: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", command], {
      cwd,
      env: { ...process.env, HOOK_TOOL: toolName, HOOK_ARGS: argsJson, HOOK_CWD: cwd },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", (err) => { clearTimeout(timer); resolve({ code: 1, output: `hook 启动失败：${err.message}` }); });
    child.on("exit", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, output: output.slice(0, 4000) }); });
  });
}

/** 运行 preToolUse；返回 blocked=true 时调用方不应执行工具。 */
export async function runPreToolHook(toolName: string, argsJson: string, cwd: string): Promise<{ blocked: boolean; output: string }> {
  const hooks = (loadHooks(cwd).preToolUse ?? []).filter((hook) => matches(hook, toolName));
  for (const hook of hooks) {
    const result = await runCommand(hook.command, toolName, argsJson, cwd, hook.timeoutMs ?? 10_000);
    if (result.code !== 0) return { blocked: true, output: `[hook 阻止了 ${toolName}]\n${result.output}`.trim() };
  }
  return { blocked: false, output: "" };
}

/** 运行 postToolUse；失败不改变工具结果，只把输出附在 UI notice 里。 */
export async function runPostToolHook(toolName: string, argsJson: string, cwd: string): Promise<string> {
  const hooks = (loadHooks(cwd).postToolUse ?? []).filter((hook) => matches(hook, toolName));
  let output = "";
  for (const hook of hooks) {
    const result = await runCommand(hook.command, toolName, argsJson, cwd, hook.timeoutMs ?? 10_000);
    if (result.code !== 0) output += `[post hook ${toolName} 失败]\n${result.output}\n`;
  }
  return output.trim();
}
