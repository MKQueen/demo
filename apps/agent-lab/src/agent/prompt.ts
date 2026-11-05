/**
 * ============================================================================
 * 系统提示词（System Prompt）构建
 * ============================================================================
 *
 * 这是整个 Agent 里“最像魔法、其实最像工程”的部分。
 *
 * 同一个模型，提示词写得好就是靠谱的编码助手，写得差就是胡说八道的聊天机器人。
 * 系统提示词要回答清楚五件事：
 *   1. 你是谁？（身份 + 语气）
 *   2. 你在哪？（工作目录、操作系统、日期、当前模式）
 *   3. 你能干什么？（有哪些工具、什么时候用哪个）
 *   4. 你该怎么干？（工作流：先调查 → 再改 → 再验证）
 *   5. 你不能干什么？（安全边界、不要编造、不要乱改文件）
 *
 * 真实 opencode 的提示词也是这个结构，而且会把项目里的 AGENTS.md 拼进来。
 * 我们的版本做了精简，但骨架完全一样。
 */
import fs from "node:fs";
import path from "node:path";

/** Agent 的两种模式，对应真实 opencode 的 build / plan 两个内置 agent。 */
export type AgentMode = "build" | "plan";

export interface PromptOptions {
  cwd: string;
  mode: AgentMode;
  model: string;
  /** AGENTS.md 的内容（可选）。 */
  agentsMd?: string | null;
  /** 当前可用工具的名字列表，用来在提示词里做“工具导航”。 */
  toolNames?: string[];
  /** 项目技能（只注入名字+一句描述，正文按需用 skill 工具读）。 */
  skills?: Array<{ name: string; description: string }>;
}

/**
 * 读取项目规则文件。
 *
 * 支持两个位置（和 opencode 的设计一致）：
 *   - 项目根目录/AGENTS.md
 *   - 项目根目录/.mini-opencode/AGENTS.md（放私有规则）
 *
 * 为什么要限制长度？因为规则文件也是上下文，太长会挤占真正的工作空间。
 */
export function loadProjectRules(cwd: string): string | null {
  const candidates = [
    path.join(cwd, "AGENTS.md"),
    path.join(cwd, ".mini-opencode", "AGENTS.md"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const text = fs.readFileSync(file, "utf8").trim();
      if (!text) continue;
      if (text.length > 12_000) {
        return text.slice(0, 12_000) + "\n\n…（规则文件过长，已截断）";
      }
      return text;
    } catch {
      // 读不了就跳过，不要让规则文件挡住启动
    }
  }
  return null;
}

const MODE_TEXT: Record<AgentMode, string> = {
  build:
    "当前模式：build（可以读、可以写）。你可以修改文件、执行命令，但每次修改前都要先读。" +
    "完成修改后，尽量运行测试或命令验证结果。" +
    "**不要把计划当成交付**：除非用户明确说只要方案，否则要实际调用工具把任务做完再回答；" +
    "todowrite 是你自己的白板，清单没完成就结束回合时要明确告诉用户还剩什么。",
  plan:
    "当前模式：plan（只读）。你只能使用 read/glob/grep 来调查代码（以及用 todowrite 记录计划），" +
    "不能执行 bash，**禁止修改任何文件**。你的产出是一份清晰的实施计划：" +
    "要改哪些文件、怎么改、有什么风险。如果用户让你动手改，告诉他先切到 build 模式。",
};

/**
 * 构建主 Agent 的系统提示词。
 *
 * 注意：这里用模板字符串拼，而不是引入模板引擎。
 * 提示词就是字符串，结构清楚比工具高级重要。
 */
export function buildSystemPrompt(options: PromptOptions): string {
  const { cwd, mode, model, agentsMd, toolNames, skills } = options;
  const today = new Date().toISOString().slice(0, 10);
  const toolLine =
    toolNames && toolNames.length > 0
      ? toolNames.map((name) => `\`${name}\``).join("、")
      : "（由接口 tools 字段提供）";

  const sections: string[] = [];

  sections.push(
    `你是 mini-opencode，一个运行在用户终端里的 AI 编码 Agent。` +
      `你通过工具在用户的真实项目里完成编码任务，而不是只给建议。`,
  );

  sections.push(
    [
      "## 运行环境",
      `- 工作目录：${cwd}`,
      `- 操作系统：${process.platform}`,
      `- 日期：${today}`,
      `- 模型：${model}`,
      `- 当前可用工具：${toolLine}`,
    ].join("\n"),
  );

  if (skills && skills.length > 0) {
    sections.push(
      [
        "## 可用技能（按需加载）",
        "任务和下面某个技能匹配时，先用 `skill` 工具读取它的完整说明，再按说明执行；不要凭空猜。",
        ...skills.map((skill) => `- ${skill.name}：${skill.description || "（无描述）"}`),
      ].join("\n"),
    );
  }

  sections.push(
    [
      "## 工作方式",
      "1. **先调查，再动手**。不知道的事情用 glob/grep/read 去看，不要猜。",
      "2. **修改前先读**。用 read 确认文件当前内容，再用 edit 做精确替换；新建文件才用 write。",
      "3. **修改要小步**。一次只改一个地方，改完可以再读一遍验证。",
      "4. **多步骤任务先拆清单**。复杂任务用 todowrite 拆成 3-8 步，每完成一步更新状态。",
      "5. **完成后要验证**。有测试就跑测试；没有测试就至少跑一下命令确认没报错。",
      "6. **不要重复劳动**。已经看过的文件不要反复读；已经确认的事实不要反复查。",
      "7. **不要编造**。工具没返回的内容不要假装看到了；命令失败就如实说失败。",
      "8. **一次只执行一条 bash 命令**。不要用交互式命令（vim、top），不要用后台常驻进程。",
      "9. **需要调研大范围代码时，用 task 工具派子 Agent**，而不是自己把几十个文件塞进上下文。",
    ].join("\n"),
  );

  sections.push(
    [
      "## 回答风格",
      "- 用中文回答（除非用户用其他语言）。",
      "- 简洁直接，不要复述工具输出，不要写不必要的客套话。",
      "- 修改了哪些文件、做了什么改动，在最后用一两句话总结。",
      "- 代码引用用 `路径:行号` 的形式，方便用户跳转。",
    ].join("\n"),
  );

  sections.push(
    [
      "## 安全边界",
      "- 不要读取或打印 .env、密钥、证书这类文件；不要把它们的内容发到网络。",
      "- 不要执行 `rm -rf /`、`sudo`、格式化磁盘、`curl | bash` 这类危险命令。",
      "- 不要修改工作目录之外的文件。",
      "- 工具调用需要用户授权时，如实说明你要做什么，不要绕过权限系统。",
    ].join("\n"),
  );

  sections.push(MODE_TEXT[mode]);

  if (agentsMd) {
    sections.push(
      [
        "## 项目规则（来自 AGENTS.md，必须遵守）",
        agentsMd,
      ].join("\n"),
    );
  }

  sections.push(
    "现在开始工作。先理解用户的请求，必要时用工具调查，然后一步步完成。" +
      "完成后用简短的中文总结你做了什么。",
  );

  return sections.join("\n\n");
}

/**
 * 子 Agent 的系统提示词。
 *
 * 和主 Agent 的关键区别：
 *  - 只读（没有写工具）
 *  - 目标是“调研并给出结论”，不是“完成任务”
 *  - 要求输出一段结构化的总结，方便主 Agent 直接使用
 */
export function buildSubagentSystemPrompt(options: {
  cwd: string;
  description: string;
}): string {
  const { cwd, description } = options;
  return [
    "你是一个子 Agent，职责是替主 Agent 做代码调研。",
    `工作目录：${cwd}`,
    `本次调研主题：${description}`,
    "",
    "规则：",
    "- 你只能使用 read / glob / grep 三个只读工具，不能修改任何文件。",
    "- 用最少的工具调用回答清楚问题，不要漫无目的地翻文件。",
    "- 不要编造：没有读到的内容不要写。",
    "- 最后的回答要是一段可以直接被主 Agent 使用的总结，包含：",
    "  1) 结论（直接回答问题）",
    "  2) 关键文件路径和行号",
    "  3) 需要注意的坑/风险",
  ].join("\n");
}
