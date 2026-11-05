#!/usr/bin/env node
/**
 * 代码地图生成器（零运行时依赖，仅用 devDependency 里的 TypeScript 做 AST 解析）。
 *
 * 为什么写这个脚本？
 * 项目已经 6000+ 行，靠肉眼看“到底有多少函数、都在哪、谁调用谁”很容易漏。
 * 用 TypeScript 编译器 API 把 AST 走一遍，自动导出：
 *   - 文件 / 行数 / 顶层函数 / 类方法 / 类 / 接口 / 类型 统计
 *   - 每个函数的签名、导出状态、行号、行数、注释首句
 *   - 模块之间的相对 import 关系
 *
 * 跑法：npm run code-map
 * 产物：docs/代码地图-函数清单.md
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const OUT_FILE = path.join(ROOT, "docs", "代码地图-函数清单.md");

// ---------------------------------------------------------------------------
// 1. 收集文件
// ---------------------------------------------------------------------------
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const files = walk(SRC_DIR).sort();

// ---------------------------------------------------------------------------
// 2. AST 工具
// ---------------------------------------------------------------------------
function hasExport(node) {
  return Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

function hasAsync(node) {
  return Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));
}

function isGenerator(node) {
  return Boolean(node.asteriskToken);
}

function truncate(text, max) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function paramsOf(node, max = 110) {
  const params = node.parameters?.map((p) => p.getText()) ?? [];
  return truncate(params.join(", "), max);
}

function returnTypeOf(node) {
  return node.type ? truncate(node.type.getText(), 34) : "";
}

/** 取节点前面最近的 JSDoc / 行注释的第一句，当作“一句话说明”。 */
function commentOf(node, sourceText) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
  const last = ranges[ranges.length - 1];
  if (!last) return "";
  const raw = sourceText.slice(last.pos, last.end);
  const block = raw.match(/\/\*\*([\s\S]*?)\*\//);
  const body = block ? block[1] : raw;
  const line = body
    .split("\n")
    .map((l) => l.replace(/^\s*\/?\*+\s?/, "").trim())
    .find(
      (l) =>
        l.length > 0 &&
        !l.startsWith("@") &&
        // 跳过 `// ---- 事件流 ----` 这种纯分隔线注释
        !/^[-=_*\s/]+$/.test(l),
    );
  return line ? truncate(line, 86) : "";
}

const KINDS = new Map();
function kindOf(node) {
  const flags = [];
  if (hasExport(node)) flags.push("export");
  if (hasAsync(node)) flags.push("async");
  if (isGenerator(node)) flags.push("generator");
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) flags.push("static");
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) flags.push("private");
  return flags.join(" ");
}

const fileRow = (node) => {
  const { line: start } = sf.getLineAndCharacterOfPosition(node.getStart());
  const { line: end } = sf.getLineAndCharacterOfPosition(node.getEnd());
  return { line: start + 1, lines: end - start + 1 };
};

let sf; // 当前文件（简化闭包传参）

// ---------------------------------------------------------------------------
// 3. 遍历一个文件
// ---------------------------------------------------------------------------
function extractFile(file) {
  const code = fs.readFileSync(file, "utf8");
  sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const result = {
    file: rel,
    totalLines: code.split("\n").length,
    functions: [], // 顶层函数（含 const 箭头函数）
    methods: [], // 类方法
    classes: [],
    interfaces: [],
    types: [],
    imports: [],
  };

  function visit(node) {
    // import 关系
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith(".")) result.imports.push(spec);
    }

    // 顶层函数声明
    if (ts.isFunctionDeclaration(node) && node.name) {
      result.functions.push({
        name: node.name.text,
        kind: kindOf(node),
        params: paramsOf(node),
        returns: returnTypeOf(node),
        ...fileRow(node),
        comment: commentOf(node, code),
      });
    }

    // const foo = async (...) => {} / const foo = function () {}
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const init = decl.initializer;
        if (!init) continue;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          result.functions.push({
            name: decl.name.text,
            kind: kindOf(init),
            params: paramsOf(init),
            returns: returnTypeOf(init),
            ...fileRow(decl),
            comment: commentOf(node, code),
          });
        }
        // 对象字面量里的方法，例如 `const bashTool = { execute(args, ctx) {...} }`。
        // 工具的 execute 就是这种写法，必须单独收集，否则统计会漏掉所有工具实现。
        if (ts.isObjectLiteralExpression(init)) {
          for (const prop of init.properties) {
            if (ts.isMethodDeclaration(prop) && prop.name) {
              const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
                ? prop.name.text
                : prop.name.getText();
              result.methods.push({
                name: `${decl.name.text}.${name}`,
                kind: kindOf(prop),
                params: paramsOf(prop),
                returns: returnTypeOf(prop),
                ...fileRow(prop),
                comment: commentOf(prop, code),
              });
            }
            if (ts.isPropertyAssignment(prop) && prop.name && ts.isIdentifier(prop.name)) {
              const value = prop.initializer;
              if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
                result.methods.push({
                  name: `${decl.name.text}.${prop.name.text}`,
                  kind: kindOf(value),
                  params: paramsOf(value),
                  returns: returnTypeOf(value),
                  ...fileRow(prop),
                  comment: commentOf(prop, code),
                });
              }
            }
          }
        }
      }
    }

    // 类 + 类方法
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const { line, lines } = fileRow(node);
      const methodList = [];
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          const name = ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
            ? member.name.text
            : member.name.getText();
          const info = {
            name: `${className}.${name}`,
            kind: kindOf(member),
            params: paramsOf(member),
            returns: returnTypeOf(member),
            ...fileRow(member),
            comment: commentOf(member, code),
          };
          methodList.push(info);
        }
        if (ts.isConstructorDeclaration(member)) {
          methodList.push({
            name: `${className}.constructor`,
            kind: kindOf(member),
            params: paramsOf(member),
            returns: "",
            ...fileRow(member),
            comment: commentOf(member, code),
          });
        }
        if (ts.isGetAccessor(member) && member.name) {
          const name = ts.isIdentifier(member.name) ? member.name.text : member.name.getText();
          methodList.push({
            name: `${className}.get ${name}`,
            kind: kindOf(member),
            params: "",
            returns: returnTypeOf(member),
            ...fileRow(member),
            comment: commentOf(member, code),
          });
        }
      }
      result.classes.push({ name: className, line, lines });
      result.methods.push(...methodList);
    }

    if (ts.isInterfaceDeclaration(node) && node.name) {
      result.interfaces.push(node.name.text);
    }
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      result.types.push(node.name.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return result;
}

// ---------------------------------------------------------------------------
// 4. 汇总 + 生成 Markdown
// ---------------------------------------------------------------------------
const extracted = files.map(extractFile);

const totals = {
  files: extracted.length,
  lines: extracted.reduce((sum, f) => sum + f.totalLines, 0),
  functions: extracted.reduce((sum, f) => sum + f.functions.length, 0),
  methods: extracted.reduce((sum, f) => sum + f.methods.length, 0),
  classes: extracted.reduce((sum, f) => sum + f.classes.length, 0),
  interfaces: extracted.reduce((sum, f) => sum + f.interfaces.length, 0),
  types: extracted.reduce((sum, f) => sum + f.types.length, 0),
  exported: 0,
  async: 0,
  generators: 0,
};

for (const file of extracted) {
  for (const fn of [...file.functions, ...file.methods]) {
    if (fn.kind.includes("export")) totals.exported++;
    if (fn.kind.includes("async")) totals.async++;
    if (fn.kind.includes("generator")) totals.generators++;
  }
}

const moduleOf = (file) => {
  const parts = file.split("/");
  return parts.length >= 3 ? `${parts[1]}/` : "(根目录)";
};

const modules = new Map();
for (const file of extracted) {
  const mod = moduleOf(file.file);
  if (!modules.has(mod)) modules.set(mod, { files: 0, lines: 0, functions: 0, methods: 0 });
  const item = modules.get(mod);
  item.files++;
  item.lines += file.totalLines;
  item.functions += file.functions.length;
  item.methods += file.methods.length;
}

const lines = [];
lines.push("# 代码地图：函数清单与模块依赖");
lines.push("");
lines.push("> ⚙️ 本文件由 `npm run code-map` 自动生成（TypeScript AST 解析 `src/`），**不要手改**。");
lines.push("> 生成的目的一句话：让你在 6000+ 行代码里随时知道“这个函数存在吗、在哪、有多大、干什么的”。");
lines.push(">");
lines.push("> **统计口径**：函数声明 + const 箭头函数（含嵌套闭包）+ 类方法 + 工具对象方法；");
lines.push("> 不统计 forEach/map 里的匿名回调。第三方依赖（node: 内置模块）不算在内。");
lines.push("");
lines.push("## 总览");
lines.push("");
lines.push("| 指标 | 数量 |");
lines.push("| --- | --- |");
lines.push(`| TypeScript 文件 | ${totals.files} |`);
lines.push(`| 代码总行数 | ${totals.lines.toLocaleString("en-US")} |`);
lines.push(`| 函数（含嵌套函数与 const 箭头函数） | ${totals.functions} |`);
lines.push(`| 方法（类方法 + 工具对象方法，含构造器/getter） | ${totals.methods} |`);
lines.push(`| 函数合计 | **${totals.functions + totals.methods}** |`);
lines.push(`| 类 | ${totals.classes} |`);
lines.push(`| interface | ${totals.interfaces} |`);
lines.push(`| type 别名 | ${totals.types} |`);
lines.push(`| export 函数/方法 | ${totals.exported} |`);
lines.push(`| async 函数/方法 | ${totals.async} |`);
lines.push(`| generator 函数/方法（async function*） | ${totals.generators} |`);
lines.push("");
lines.push("## 按模块统计");
lines.push("");
lines.push("| 模块 | 文件 | 行数 | 函数 | 方法 |");
lines.push("| --- | ---: | ---: | ---: | ---: |");
for (const [mod, item] of [...modules.entries()].sort()) {
  lines.push(`| ${mod} | ${item.files} | ${item.lines} | ${item.functions} | ${item.methods} |`);
}
lines.push("");

// 模块依赖
lines.push("## 模块依赖（相对 import 关系）");
lines.push("");
for (const file of extracted) {
  const deps = [...new Set(file.imports)].sort();
  if (deps.length === 0) continue;
  lines.push(`- \`${file.file}\` → ${deps.map((d) => `\`${d}\``).join("、")}`);
}
lines.push("");

// 每文件明细
lines.push("## 逐文件函数清单");
lines.push("");
for (const file of extracted) {
  lines.push(`### ${file.file}（${file.totalLines} 行）`);
  lines.push("");
  if (file.classes.length > 0) {
    lines.push(`类：${file.classes.map((c) => `\`${c.name}\`(L${c.line})`).join("、")}`);
    lines.push("");
  }
  if (file.interfaces.length + file.types.length > 0) {
    lines.push(
      `接口/类型：${[...file.interfaces, ...file.types].map((t) => `\`${t}\``).join("、")}`,
    );
    lines.push("");
  }
  const all = [...file.functions, ...file.methods];
  if (all.length === 0) {
    lines.push("（本文件只有类型/常量，没有函数）");
    lines.push("");
    continue;
  }
  lines.push("| 函数 | 标记 | 签名 | 行 | 行数 | 说明（注释首句） |");
  lines.push("| --- | --- | --- | ---: | ---: | --- |");
  for (const fn of all) {
    const sig = `${fn.name}(${fn.params})${fn.returns ? `: ${fn.returns}` : ""}`;
    lines.push(
      `| \`${fn.name}\` | ${fn.kind || "—"} | ${sig.replace(/\|/g, "\\|")} | L${fn.line} | ${fn.lines} | ${(fn.comment || "—").replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push("");
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");

// 控制台摘要，方便 CI / 终端直接看
console.log(`代码地图已生成：${path.relative(ROOT, OUT_FILE)}`);
console.log(
  `文件 ${totals.files} · 行 ${totals.lines} · 顶层函数 ${totals.functions} · 类方法 ${totals.methods} · ` +
    `类 ${totals.classes} · interface ${totals.interfaces} · type ${totals.types}`,
);
console.log(`其中 export ${totals.exported} · async ${totals.async} · generator ${totals.generators}`);
