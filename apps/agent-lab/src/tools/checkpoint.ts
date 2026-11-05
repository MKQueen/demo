/** 文件 checkpoint / rewind：写文件前备份，出错可回退（CC 的 rewind 简化版）。 */
import fs from "node:fs";
import path from "node:path";
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";

const ROOT = ".mini-opencode/checkpoints";

export interface CheckpointEntry { stamp: string; path: string; at: string; action: "backup" | "create" }

function stampNow(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }

/** 写文件前调用：备份旧内容；新文件记一条 create（回退时删除）。 */
export function saveCheckpoint(cwd: string, relPath: string): CheckpointEntry | null {
  const abs = path.resolve(cwd, relPath);
  const stamp = stampNow();
  const base = path.join(cwd, ROOT, stamp);
  try {
    if (fs.existsSync(abs)) {
      const target = path.join(base, "files", relPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(abs, target);
      const entry: CheckpointEntry = { stamp, path: relPath, at: new Date().toISOString(), action: "backup" };
      fs.mkdirSync(base, { recursive: true });
      fs.appendFileSync(path.join(base, "index.jsonl"), JSON.stringify(entry) + "\n");
      return entry;
    }
    const entry: CheckpointEntry = { stamp, path: relPath, at: new Date().toISOString(), action: "create" };
    fs.mkdirSync(base, { recursive: true });
    fs.appendFileSync(path.join(base, "index.jsonl"), JSON.stringify(entry) + "\n");
    return entry;
  } catch {
    return null;
  }
}

export function latestCheckpoint(cwd: string): { stamp: string; entries: CheckpointEntry[] } | null {
  const root = path.join(cwd, ROOT);
  try {
    const stamps = fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory()).sort();
    for (let i = stamps.length - 1; i >= 0; i--) {
      const stamp = stamps[i]!;
      const index = path.join(root, stamp, "index.jsonl");
      if (!fs.existsSync(index)) continue;
      const entries = fs.readFileSync(index, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as CheckpointEntry);
      if (entries.length) return { stamp, entries };
    }
  } catch { /* 没有 checkpoint */ }
  return null;
}

function rewindOne(cwd: string, entry: CheckpointEntry): string {
  const abs = path.resolve(cwd, entry.path);
  const backup = path.join(cwd, ROOT, entry.stamp, "files", entry.path);
  if (entry.action === "create") {
    if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    return entry.path;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(backup)) fs.copyFileSync(backup, abs);
  return entry.path;
}

export function rewindCheckpoint(cwd: string, targetPath?: string): { stamp: string; restored: string[] } | null {
  const latest = latestCheckpoint(cwd);
  if (!latest) return null;
  let entries = latest.entries;
  if (targetPath) {
    const wanted = targetPath.replace(/\\/g, "/");
    entries = entries.filter((entry) => entry.path.replace(/\\/g, "/") === wanted);
  }
  const restored = entries.map((entry) => rewindOne(cwd, entry));
  return { stamp: latest.stamp, restored };
}

export const rewindTool: Tool = {
  name: "rewind",
  description: "回退最近一次 checkpoint：恢复被 write/edit 改过的文件（新文件会被删除）。可选 path 只回退某个文件。",
  category: "write",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "只回退这个相对路径（可选）" } },
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const target = typeof args.path === "string" && args.path.trim() ? args.path.trim() : undefined;
    const result = rewindCheckpoint(ctx.cwd, target);
    if (!result) return errorResult("rewind", "没有可回退的 checkpoint");
    if (!result.restored.length) return errorResult("rewind", `最近 checkpoint 里没有 ${target}`);
    return { title: `rewind ${result.stamp}`, output: `已回退 ${result.restored.length} 个文件：\n${result.restored.join("\n")}` };
  },
};
