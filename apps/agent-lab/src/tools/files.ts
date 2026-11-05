/**
 * ============================================================================
 * 文件工具组：read / write / edit / glob / grep
 * ============================================================================
 *
 * 为什么编码 Agent 一定要有“文件工具”，而不是只给它 bash？
 *
 * 因为 bash 的输入输出是“给人看的”，对模型很不友好：
 *  - `cat` 不会告诉你文件有多少行、该从哪里续读
 *  - `sed -i` 改文件，模型看不到 diff，改错了也不知道
 *  - `find`/`grep` 的输出格式五花八门，还容易被 shell 引号坑
 *  - 最要命：模型没法可靠地“按行精确读取”
 *
 * 专门的文件工具做了三件事：
 *  1. 输出结构化（带行号、截断提示、错误原因）
 *  2. 边界安全（只能操作工作目录内的文件）
 *  3. 行为可预测（edit 用“精确字符串替换”，而不是行号漂移的 patch）
 *
 * 真实 opencode 的工具设计几乎一模一样：
 * read 带 offset/limit、edit 用 oldString/newString、grep/glob 返回结构化结果。
 */
import fs from "node:fs";
import path from "node:path";
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";
import { saveCheckpoint } from "./checkpoint.ts";
import { truncateMiddle } from "../util.ts";

/** 这些目录不参与 glob/grep，避免把 node_modules 翻个底朝天。 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".mini-opencode",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
  ".venv",
  "__pycache__",
]);

const MAX_READ_BYTES = 512 * 1024;
const MAX_READ_LINES = 2000;
const MAX_WALK_FILES = 8000;
const MAX_GLOB_RESULTS = 200;
const MAX_GREP_MATCHES = 100;
const MAX_GREP_FILE_BYTES = 2 * 1024 * 1024;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 把路径转成相对 cwd 的、用 / 分隔的展示形式。
 *
 * 注意这里对 cwd 也做了 realpath：
 * macOS 的 /var 其实是指向 /private/var 的符号链接，如果一边用 realpath
 * 一边用原始路径，path.relative 会算出一堆 ../..，glob 就匹配不上了。
 * （这个坑我们写测试时真的踩过。）
 */
function toRel(cwd: string, file: string): string {
  const root = fs.existsSync(cwd) ? fs.realpathSync(cwd) : cwd;
  const rel = path.relative(root, file);
  return (rel || ".").split(path.sep).join("/");
}

/**
 * 尽量把路径规范化成真实路径（realpath），但对“尾部还不存在”的路径宽容：
 * 从目标往上找到第一个存在的祖先，realpath 它，再把不存在的尾部拼回去。
 *
 * 为什么需要？
 * macOS 上 `/tmp` 是 `/private/tmp` 的别名。用户若用 `/tmp/xxx/file` 写链接目标，
 * 字面路径和 realpath 一比就成了“越界”（安全方向无害，但会误拒合法写入）。
 * 先规范化再比较，才能既安全又不误伤。
 */
function canonicalizeTolerant(target: string): string {
  const tail: string[] = [];
  let probe = target;
  for (;;) {
    try {
      const real = fs.realpathSync(probe);
      return tail.length === 0 ? real : path.join(real, ...tail.reverse());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") return target;
      const parent = path.dirname(probe);
      if (parent === probe) return target;
      tail.push(path.basename(probe));
      probe = parent;
    }
  }
}

/**
 * 逐段检查路径中的符号链接，防止“悬空链接”逃逸。
 *
 * 为什么单独要这一步？
 * `fs.existsSync` / `realpathSync` 都会**跟随**符号链接。如果链接目标不存在
 * （悬空链接，比如 `ln -s /外部/owned.txt steal` 而 /外部/owned.txt 不存在），
 * existsSync 返回 false，祖先回溯就完全看不到这个链接；
 * 但 writeFileSync 写 `steal` 时会顺着链接把文件创建到工作目录外。
 *
 * 所以必须用 `lstat`（不跟随）逐段检查，遇到链接就展开它的目标并重新校验
 * “目标是否仍在 root 内”，然后递归检查链接目标之后的剩余路径。
 */
function assertNoSymlinkEscape(root: string, target: string, original: string, depth = 0): void {
  if (depth > 20) {
    throw new Error(`路径中的符号链接层级过深（可能是循环链接）：${original}`);
  }

  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    assertInside(root, target, original); // 会抛出越界错误
  }
  const parts = rel.split(path.sep).filter(Boolean);

  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);

    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // 从这里开始后面都不存在，不可能再藏链接（父级已经检查过）
        return;
      }
      throw err;
    }

    if (!stat.isSymbolicLink()) continue;

    const linkTarget = canonicalizeTolerant(
      path.resolve(path.dirname(current), fs.readlinkSync(current)),
    );
    // 链接目标本身必须在 root 内（这一步就能拦住悬空链接指向外部的情况）
    assertInside(root, linkTarget, original);

    // 链接目标可能又是链接、也可能后面还有剩余路径：递归检查
    const rest = parts.slice(index + 1).join(path.sep);
    const next = rest ? path.join(linkTarget, rest) : linkTarget;
    assertNoSymlinkEscape(root, next, original, depth + 1);
    return;
  }
}

/**
 * 把“模型给的相对路径”解析成绝对路径，并确保它没跑出工作目录。
 *
 * 这是 Agent 安全里最基础的一层（真实 opencode 叫 path containment）：
 * 如果模型写的 path 是 ../../../../etc/passwd，必须拒绝。
 *
 * 还要防符号链接逃逸：项目里可能有个 link -> /etc，
 * 所以必须沿着路径向上找到**第一个真实存在的祖先**，对它做 realpath 检查。
 *
 * 为什么不能只检查目标本身？
 * 因为 write 的目标文件可能还不存在（比如 link/new.txt），
 * 这时 fs.existsSync 为 false，如果就跳过检查，就会通过符号链接
 * 把文件写到工作目录外面去。（这个漏洞是写文档的同事实测发现的。）
 */
export function resolveInside(cwd: string, input: string): string {
  const root = fs.realpathSync(cwd);
  if (!input) throw new Error("path 不能为空");

  const resolved = path.resolve(root, input);
  assertInside(root, resolved, input);

  // 从目标往上找，直到找到一个已存在的路径（文件或目录），
  // 取它的真实路径再检查一次是否仍在 root 内。
  let probe = resolved;
  for (;;) {
    if (fs.existsSync(probe)) {
      assertInside(root, fs.realpathSync(probe), input);
      break;
    }
    const parent = path.dirname(probe);
    if (parent === probe) break; // 已经到文件系统根了，理论上到不了这里
    probe = parent;
  }

  // 最后逐段检查符号链接（含悬空链接）：existsSync 会漏掉它们，lstat 不会。
  assertNoSymlinkEscape(root, resolved, input);
  return resolved;
}

function assertInside(root: string, target: string, original: string): void {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `路径越界："${original}" 解析后跑到了工作目录之外（${target}）。` +
        `Agent 只能操作 ${root} 里的文件。`,
    );
  }
}

/** 这些文件默认禁止读取/搜索，避免把密钥喂给模型。 */
export function isSensitiveFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base === ".npmrc" ||
    base === ".netrc" ||
    base === "id_rsa" ||
    base === "id_ed25519" ||
    base.endsWith(".pem") ||
    base.endsWith(".key")
  );
}

/** 粗略判断二进制文件：前 8000 字节里出现 0x00 就认为是二进制。 */
export function isBinary(buffer: Buffer): boolean {
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * 递归列出目录下所有文件（跳过忽略目录和符号链接）。
 *
 * 教学项目用同步 API 是为了代码短；真实 Agent 会用异步 + 流式遍历，
 * 避免大仓库把事件循环卡住。
 */
export function walkFiles(root: string, maxFiles = MAX_WALK_FILES): string[] {
  const files: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0 && files.length < maxFiles) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // 没权限的目录直接跳过
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        // 符号链接的 isFile() 是 false，天然被跳过，避免遍历到项目外
        files.push(full);
      }
    }
  }
  return files;
}

/**
 * 简化的 glob → 正则转换。
 *
 * 支持：*（同层任意字符）、**（任意层目录）、?（单个字符）。
 * 真实实现会用 picomatch 之类的库，但原理就是这个。
 */
export function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/");
  let out = "^";
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i]!;
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        i += 2;
        if (normalized[i] === "/") {
          out += "(?:.*/)?"; // **/ 可以匹配 0 层或多层目录
          i++;
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      out += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
      i++;
    } else {
      out += ch;
      i++;
    }
  }

  out += "$";
  return new RegExp(out);
}

/** 把可用行号范围收进合法区间。 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

// ============================================================================
// read —— 读文件（带行号 + 分段）
// ============================================================================
export const readTool: Tool = {
  name: "read",
  description:
    "读取一个文本文件，返回带行号的内容。大文件请用 offset/limit 分段读取。" +
    "改文件前一定要先 read，否则你可能基于过时内容做修改。",
  category: "read",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径（相对工作目录或绝对路径）" },
      offset: {
        type: "integer",
        description: "从第几行开始读（1 开始），默认 1",
        minimum: 1,
      },
      limit: {
        type: "integer",
        description: "最多读多少行，默认 2000",
        minimum: 1,
        maximum: MAX_READ_LINES,
      },
    },
    required: ["path"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const inputPath = String(args.path ?? "");
    let target: string;
    try {
      target = resolveInside(ctx.cwd, inputPath);
    } catch (err) {
      return errorResult(`read ${inputPath}`, messageOf(err));
    }
    const rel = toRel(ctx.cwd, target);

    if (isSensitiveFile(target)) {
      return errorResult(
        `read ${rel}`,
        "出于安全考虑，read 工具默认禁止读取可能包含密钥的文件（.env/.npmrc/*.pem 等）。" +
          "如果确实需要，请让用户自己操作。",
      );
    }
    if (!fs.existsSync(target)) {
      return errorResult(
        `read ${rel}`,
        `文件不存在：${rel}。可以用 glob 工具按模式查找文件，注意路径要相对工作目录。`,
      );
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      return errorResult(
        `read ${rel}`,
        `${rel} 是一个目录，不是文件。用 glob（例如 pattern="src/**/*.ts"）列出文件，或 bash 的 ls。`,
      );
    }

    let buffer: Buffer;
    let note = "";
    let truncatedBySize = false;
    if (stat.size > MAX_READ_BYTES) {
      // 超大文件只加载开头一段。注意：这样 offset 也只能在前部翻页，
      // 提示语必须说清楚，否则模型会一直加 offset 却永远读不到后面的行。
      truncatedBySize = true;
      const fd = fs.openSync(target, "r");
      buffer = Buffer.alloc(MAX_READ_BYTES);
      const bytesRead = fs.readSync(fd, buffer, 0, MAX_READ_BYTES, 0);
      fs.closeSync(fd);
      buffer = buffer.subarray(0, bytesRead);
      note =
        `\n（文件有 ${stat.size} 字节，超过 ${MAX_READ_BYTES} 字节上限，只加载了前面的内容；` +
        `后面的行用 offset 也读不到。要查后面的内容，请先用 grep 定位，再用 bash 的 sed -n '起,止p' 查看。）`;
    } else {
      buffer = fs.readFileSync(target);
    }

    if (isBinary(buffer)) {
      return errorResult(`read ${rel}`, `${rel} 看起来是二进制文件，read 只能读文本。`);
    }

    const allLines = buffer.toString("utf8").split("\n");
    if (allLines[allLines.length - 1] === "") allLines.pop(); // 去掉结尾空行
    const totalLines = allLines.length;

    if (totalLines === 0) {
      return { title: `read ${rel}`, output: `（空文件）${note}` };
    }

    const requestedOffset = Number(args.offset ?? 1);
    const offset = Number.isFinite(requestedOffset) ? Math.trunc(requestedOffset) : 1;

    // offset 超出可读范围时明确报错，而不是悄悄 clamp 到最后一行
    if (offset > totalLines) {
      const range = truncatedBySize
        ? `文件超过 ${MAX_READ_BYTES} 字节上限，只加载了前 ${totalLines} 行`
        : `文件只有 ${totalLines} 行`;
      return errorResult(
        `read ${rel}`,
        `offset=${offset} 超出可读范围（${range}）。` +
          (truncatedBySize
            ? "大文件请先用 grep 定位，再用 bash 的 sed -n '起,止p' 查看指定行。"
            : `有效范围是 1-${totalLines}。`),
      );
    }

    const safeOffset = Math.max(1, offset);
    const limit = clamp(Number(args.limit ?? MAX_READ_LINES), 1, MAX_READ_LINES);
    const slice = allLines.slice(safeOffset - 1, safeOffset - 1 + limit);
    const width = String(totalLines).length;

    const numbered = slice
      .map((line, index) => {
        const lineNo = String(safeOffset + index).padStart(width, " ");
        return `${lineNo}| ${line}`;
      })
      .join("\n");

    const end = safeOffset - 1 + slice.length;
    const more =
      end < totalLines
        ? `\n\n（文件共 ${totalLines} 行，这里显示 ${safeOffset}-${end} 行。继续读：offset=${end + 1}）`
        : "";

    return { title: `read ${rel}`, output: numbered + more + note };
  },
};

// ============================================================================
// write —— 写文件（整文件覆盖）
// ============================================================================
export const writeTool: Tool = {
  name: "write",
  description:
    "把完整内容写入一个文件（覆盖已有文件，自动创建目录）。" +
    "修改已有文件请优先用 edit，避免把没读过的内容覆盖掉。",
  category: "write",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径（相对工作目录）" },
      content: { type: "string", description: "要写入的完整文本内容" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const inputPath = String(args.path ?? "");
    const content = String(args.content ?? "");
    let target: string;
    try {
      target = resolveInside(ctx.cwd, inputPath);
    } catch (err) {
      return errorResult(`write ${inputPath}`, messageOf(err));
    }
    const rel = toRel(ctx.cwd, target);
    const existed = fs.existsSync(target);
    if (existed && fs.statSync(target).isDirectory()) {
      return errorResult(`write ${rel}`, `${rel} 是一个目录，不能写入。`);
    }

    try {
      saveCheckpoint(ctx.cwd, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, "utf8");
    } catch (err) {
      return errorResult(`write ${rel}`, `写入失败：${messageOf(err)}`);
    }

    const lines = content === "" ? 0 : content.split("\n").length;
    const bytes = Buffer.byteLength(content, "utf8");
    return {
      title: `write ${rel}`,
      output: `${existed ? "已覆盖" : "已创建"} ${rel}（${lines} 行，${bytes} 字节）`,
    };
  },
};

// ============================================================================
// edit —— 精确字符串替换（Agent 改代码的主力工具）
// ============================================================================
export const editTool: Tool = {
  name: "edit",
  description:
    "在文件中做精确字符串替换：把 oldString 替换成 newString。" +
    "oldString 必须与文件内容逐字符一致（包括空格/缩进/换行），" +
    "且必须唯一匹配（除非 replaceAll=true）。修改前请先 read 确认内容。",
  category: "write",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径（相对工作目录）" },
      oldString: {
        type: "string",
        description: "要被替换的原文，必须和文件里的内容完全一致",
        minLength: 1,
      },
      newString: { type: "string", description: "替换后的新文本，可以为空字符串（表示删除）" },
      replaceAll: {
        type: "boolean",
        description: "是否替换所有匹配项，默认 false（只允许唯一匹配）",
      },
    },
    required: ["path", "oldString", "newString"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const inputPath = String(args.path ?? "");
    const oldString = String(args.oldString ?? "");
    const newString = String(args.newString ?? "");
    const replaceAll = Boolean(args.replaceAll);

    let target: string;
    try {
      target = resolveInside(ctx.cwd, inputPath);
    } catch (err) {
      return errorResult(`edit ${inputPath}`, messageOf(err));
    }
    const rel = toRel(ctx.cwd, target);

    if (!fs.existsSync(target)) {
      return errorResult(`edit ${rel}`, `文件不存在：${rel}。新建文件请用 write 工具。`);
    }
    if (fs.statSync(target).isDirectory()) {
      return errorResult(`edit ${rel}`, `${rel} 是目录，不能编辑。`);
    }
    if (oldString === newString) {
      return errorResult(`edit ${rel}`, "oldString 和 newString 完全一样，没有意义。");
    }

    const before = fs.readFileSync(target, "utf8");
    const occurrences = before.split(oldString).length - 1;

    if (occurrences === 0) {
      return errorResult(
        `edit ${rel}`,
        `在 ${rel} 里找不到要替换的原文。\n` +
          "常见原因：\n" +
          "  1. 缩进/空格不一致（务必逐字符复制）\n" +
          "  2. 文件已经被改过，内容变了\n" +
          "解决：先用 read 工具重新读一遍文件，确认原文后再 edit。",
      );
    }
    if (occurrences > 1 && !replaceAll) {
      return errorResult(
        `edit ${rel}`,
        `oldString 在 ${rel} 里匹配到 ${occurrences} 处，不唯一。\n` +
          "解决：提供更长的上下文让匹配唯一，或者设置 replaceAll=true。",
      );
    }

    const after = replaceAll
      ? before.split(oldString).join(newString)
      : before.replace(oldString, newString);

    try {
      saveCheckpoint(ctx.cwd, rel);
      fs.writeFileSync(target, after, "utf8");
    } catch (err) {
      return errorResult(`edit ${rel}`, `写入失败：${messageOf(err)}`);
    }

    const delta = newString.split("\n").length - oldString.split("\n").length;
    const sign = delta > 0 ? `+${delta}` : String(delta);
    return {
      title: `edit ${rel}`,
      output: `已修改 ${rel}（替换 ${occurrences} 处，行数变化 ${sign}）`,
    };
  },
};

// ============================================================================
// glob —— 按模式找文件
// ============================================================================
export const globTool: Tool = {
  name: "glob",
  description:
    "按 glob 模式查找文件，例如 `src/**/*.ts`、`*.md`、`**/test*.ts`。" +
    "返回相对工作目录的路径列表。找文件优先用它，比 bash find 更快更结构化。",
  category: "read",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "glob 模式，例如 src/**/*.ts" },
      path: {
        type: "string",
        description: "在哪个目录下找（默认工作目录），例如 src",
      },
    },
    required: ["pattern"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const pattern = String(args.pattern ?? "");
    if (!pattern) return errorResult("glob", "pattern 不能为空");

    let base: string;
    try {
      base = resolveInside(ctx.cwd, String(args.path ?? "."));
    } catch (err) {
      return errorResult(`glob ${pattern}`, messageOf(err));
    }
    if (!fs.existsSync(base)) {
      return errorResult(`glob ${pattern}`, `目录不存在：${args.path}`);
    }

    const regex = globToRegExp(pattern);
    const files = fs.statSync(base).isDirectory() ? walkFiles(base) : [base];
    const withSlash = pattern.includes("/");

    const matched = files
      .filter((file) => {
        const rel = toRel(ctx.cwd, file);
        if (regex.test(rel)) return true;
        // 模式里没有 / 时（如 "*.ts"），额外用文件名匹配，符合大多数人的直觉
        return !withSlash && regex.test(path.basename(file));
      })
      .map((file) => toRel(ctx.cwd, file))
      .sort();

    if (matched.length === 0) {
      return {
        title: `glob ${pattern}`,
        output: `没有找到匹配 "${pattern}" 的文件。可以换个模式，例如先用 "**/*" 看看项目结构。`,
      };
    }

    const shown = matched.slice(0, MAX_GLOB_RESULTS);
    const more =
      matched.length > shown.length
        ? `\n\n（共 ${matched.length} 个，只显示前 ${MAX_GLOB_RESULTS} 个）`
        : "";
    return { title: `glob ${pattern}`, output: shown.join("\n") + more };
  },
};

// ============================================================================
// grep —— 按内容搜索
// ============================================================================
export const grepTool: Tool = {
  name: "grep",
  description:
    "在文件内容里用正则搜索，返回 `文件:行号: 内容`。" +
    "适合找函数定义、变量名、TODO、报错信息。优先于 bash 的 grep/rg。",
  category: "read",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "正则表达式，例如 `function\\s+main` 或 `TODO`",
        minLength: 1,
      },
      path: {
        type: "string",
        description: "在哪个目录/文件里搜（默认工作目录）",
      },
      include: {
        type: "string",
        description: "只搜匹配这个 glob 的文件，例如 `*.ts` 或 `src/**/*.ts`",
      },
    },
    required: ["pattern"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const pattern = String(args.pattern ?? "");
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (err) {
      return errorResult(`grep ${pattern}`, `正则表达式不合法：${messageOf(err)}`);
    }

    let base: string;
    try {
      base = resolveInside(ctx.cwd, String(args.path ?? "."));
    } catch (err) {
      return errorResult(`grep ${pattern}`, messageOf(err));
    }
    if (!fs.existsSync(base)) {
      return errorResult(`grep ${pattern}`, `路径不存在：${args.path}`);
    }

    const includeGlob = args.include ? String(args.include) : null;
    const includeRegex = includeGlob ? globToRegExp(includeGlob) : null;
    const files = fs.statSync(base).isDirectory() ? walkFiles(base) : [base];

    const matches: string[] = [];
    let truncated = false;

    for (const file of files) {
      if (matches.length >= MAX_GREP_MATCHES) {
        truncated = true;
        break;
      }
      if (isSensitiveFile(file)) continue;

      const rel = toRel(ctx.cwd, file);
      if (includeRegex) {
        const includeWithSlash = includeGlob!.includes("/");
        if (!includeRegex.test(rel) && !(!includeWithSlash && includeRegex.test(path.basename(file)))) {
          continue;
        }
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (stat.size > MAX_GREP_FILE_BYTES) continue;

      let buffer: Buffer;
      try {
        buffer = fs.readFileSync(file);
      } catch {
        continue;
      }
      if (isBinary(buffer)) continue;

      const lines = buffer.toString("utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!regex.test(line)) continue;
        matches.push(`${rel}:${i + 1}: ${truncateMiddle(line.trim(), 240)}`);
        if (matches.length >= MAX_GREP_MATCHES) {
          truncated = true;
          break;
        }
      }
    }

    if (matches.length === 0) {
      return {
        title: `grep ${pattern}`,
        output: `没有找到匹配 /${pattern}/ 的内容。\n提示：注意大小写和转义；也可以缩小 path 或加 include 过滤。`,
      };
    }

    const more = truncated ? `\n\n（匹配太多，只显示前 ${MAX_GREP_MATCHES} 处）` : "";
    return {
      title: `grep ${pattern}`,
      output: matches.join("\n") + more,
    };
  },
};
