/**
 * 会话持久化测试。
 *
 * 这类测试的价值：会话文件是“未来能不能接着聊”的保证，
 * 而且它是**跨进程**的（这次写、下次读），最容易被改坏却不容易被发现。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Session, pruneEmptySessions, sessionsDir } from "../src/session.ts";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-session-"));
}

test("Session: 创建、追加、恢复", () => {
  const cwd = tempDir();
  try {
    const session = Session.create({ cwd, model: "mock-model" });
    session.appendMessage({ role: "user", content: "你好" });
    session.appendMessage({ role: "assistant", content: "你好呀" });

    const loaded = Session.load(cwd, session.meta.id);
    assert.equal(loaded.messages.length, 2);
    assert.equal(loaded.messages[0]!.content, "你好");
    assert.equal(loaded.meta.id, session.meta.id);
    assert.equal(loaded.title, "你好");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Session: list 跳过坏行继续统计（抗损坏）", () => {
  const cwd = tempDir();
  try {
    const dir = sessionsDir(cwd);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "20260101-000000-abcd.jsonl");
    const lines = [
      JSON.stringify({
        type: "meta",
        meta: { id: "20260101-000000-abcd", createdAt: new Date().toISOString(), cwd, model: "mock" },
      }),
      JSON.stringify({ type: "message", message: { role: "user", content: "第一句" } }),
      "BAD LINE {{{",
      JSON.stringify({ type: "message", message: { role: "assistant", content: "回答" } }),
    ];
    fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");

    const list = Session.list(cwd);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.messageCount, 2); // 坏行后面的消息也要算进去
    assert.equal(list[0]!.title, "第一句");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Session: snapshot 会覆盖之前的历史（压缩后的恢复）", () => {
  const cwd = tempDir();
  try {
    const session = Session.create({ cwd, model: "mock-model" });
    session.appendMessage({ role: "user", content: "很早以前的问题" });
    session.appendMessage({ role: "assistant", content: "很早以前的回答" });

    // 模拟上下文压缩：历史变成“摘要 + 最近一条”
    const compacted = [
      { role: "assistant" as const, content: "[早前对话摘要]\n用户想改代码" },
      { role: "user" as const, content: "现在继续" },
    ];
    session.messages.splice(0, session.messages.length, ...compacted);
    session.appendSnapshot(session.messages);
    session.appendMessage({ role: "assistant", content: "好的" });

    const loaded = Session.load(cwd, session.meta.id);
    assert.equal(loaded.messages.length, 3);
    assert.match(String(loaded.messages[0]!.content), /早前对话摘要/);
    assert.equal(loaded.messages[1]!.content, "现在继续");
    assert.equal(loaded.messages[2]!.content, "好的");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Session: 归档只追加事件、默认列表隐藏，可恢复", () => {
  const cwd = tempDir();
  try {
    const keep = Session.create({ cwd, model: "mock-model" });
    keep.appendMessage({ role: "user", content: "要保留的会话" });
    const hidden = Session.create({ cwd, model: "mock-model" });
    hidden.appendMessage({ role: "user", content: "准备归档的会话" });

    Session.setArchived(cwd, hidden.meta.id, true);

    // 文件还在：归档不是删除
    assert.ok(fs.existsSync(path.join(sessionsDir(cwd), `${hidden.meta.id}.jsonl`)));
    assert.equal(Session.load(cwd, hidden.meta.id).messages.length, 1);

    // 默认列表不含归档项；includeArchived 能拿到并带 archived 标志
    const active = Session.list(cwd);
    assert.deepEqual(active.map((item) => item.id), [keep.meta.id]);
    const all = Session.list(cwd, { includeArchived: true });
    assert.equal(all.find((item) => item.id === hidden.meta.id)?.archived, true);
    assert.equal(all.find((item) => item.id === keep.meta.id)?.archived, false);

    // 取消归档后重新出现在默认列表
    Session.setArchived(cwd, hidden.meta.id, false);
    assert.ok(Session.list(cwd).some((item) => item.id === hidden.meta.id));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Session: remove 删除文件，非法 id 被拒绝", () => {
  const cwd = tempDir();
  try {
    const session = Session.create({ cwd, model: "mock-model" });
    Session.remove(cwd, session.meta.id);
    assert.equal(fs.existsSync(path.join(sessionsDir(cwd), `${session.meta.id}.jsonl`)), false);
    assert.throws(() => Session.remove(cwd, session.meta.id), /会话不存在/);
    assert.throws(() => Session.remove(cwd, "../evil"), /非法会话 id/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Session: 非法 id 拒绝路径穿越", () => {
  const cwd = tempDir();
  try {
    // 在 sessions 目录外放一个"恶意"会话文件，验证 id 校验会挡住
    fs.writeFileSync(
      path.join(cwd, "evil.jsonl"),
      JSON.stringify({ type: "meta", meta: { id: "evil", createdAt: "x", cwd, model: "mock" } }) + "\n",
      "utf8",
    );
    assert.throws(() => Session.load(cwd, "../../evil"), /非法会话 id/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 空会话清理：启动时不该让「(空会话)」越堆越多
// ---------------------------------------------------------------------------
test("pruneEmptySessions: 只删空壳，不动有消息/有快照/坏行的文件", () => {
  const cwd = tempDir();
  try {
    const empty = Session.create({ cwd, model: "mock-model" });
    const keep = Session.create({ cwd, model: "mock-model" });
    const withMessage = Session.create({ cwd, model: "mock-model" });
    withMessage.appendMessage({ role: "user", content: "有内容" });

    const snapshotOnly = Session.create({ cwd, model: "mock-model" });
    snapshotOnly.appendSnapshot([{ role: "user", content: "压缩后的快照" }]);

    const broken = Session.create({ cwd, model: "mock-model" });
    fs.appendFileSync(path.join(sessionsDir(cwd), `${broken.meta.id}.jsonl`), "{ 这不是合法 JSON\n");

    const removed = pruneEmptySessions(cwd, keep.meta.id);
    assert.equal(removed, 1, "只应删除那个空壳会话");

    const files = fs.readdirSync(sessionsDir(cwd)).filter((name) => name.endsWith(".jsonl"));
    assert.ok(files.includes(`${keep.meta.id}.jsonl`), "keepId 指定的会话必须保留");
    assert.ok(files.includes(`${withMessage.meta.id}.jsonl`), "有消息的会话必须保留");
    assert.ok(files.includes(`${snapshotOnly.meta.id}.jsonl`), "只有快照（压缩后）的会话也必须保留");
    assert.ok(files.includes(`${broken.meta.id}.jsonl`), "坏行文件应保守保留");
    assert.ok(!files.includes(`${empty.meta.id}.jsonl`), "空壳会话应被删除");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
