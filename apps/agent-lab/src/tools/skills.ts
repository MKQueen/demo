/** Skills：把 .mini-opencode/skills/*.md 作为按需加载的知识（CC / DSH 的渐进披露）。 */
import fs from "node:fs";
import path from "node:path";
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";

export interface SkillInfo { name: string; description: string; body: string; file: string }

function parseFrontmatter(text: string, fallbackName: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { name: fallbackName, description: text.split("\n")[0]?.slice(0, 120) ?? "" };
  const name = /^name:\s*(.+)$/m.exec(match[1]!)?.[1]?.trim() || fallbackName;
  const description = /^description:\s*(.+)$/m.exec(match[1]!)?.[1]?.trim() || "";
  return { name, description };
}

export function loadSkills(cwd: string): SkillInfo[] {
  const dir = path.join(cwd, ".mini-opencode/skills");
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort().map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const meta = parseFrontmatter(raw, file.replace(/\.md$/, ""));
      return { name: meta.name, description: meta.description, body: raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""), file };
    });
  } catch {
    return [];
  }
}

export const skillTool: Tool = {
  name: "skill",
  description: "读取一个项目技能的完整说明（skills 列在系统提示词里；任务匹配时再读取，省上下文）。",
  category: "read",
  parameters: {
    type: "object",
    properties: { name: { type: "string", description: "技能名" } },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const name = String(args.name ?? "").trim();
    const skill = loadSkills(ctx.cwd).find((item) => item.name === name);
    if (!skill) return errorResult("skill", `没有名为 ${name} 的技能`);
    return { title: `skill ${skill.name}`, output: `# ${skill.name}\n\n${skill.body}` };
  },
};
