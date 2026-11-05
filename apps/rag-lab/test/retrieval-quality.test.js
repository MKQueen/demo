/**
 * 检索质量回归测试
 *
 * 用 kb/eval.json 里 15 条「真实用户问法」检验 rag 内核能否把正确文档召回进 topK。
 * 只度量检索（不度量生成）：hit@1 / hit@3 按「文档级」命中计算，即 topK 结果中
 * 是否存在 docId 等于 expectDoc 的块，rank 取该文档第一次出现的名次。
 *
 * 运行：node --test test/retrieval-quality.test.js
 * 依赖：rag/index.js（由队友并行实现，接口见 docs/API.md §8）
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRag } from '../rag/index.js';

const KB_DIR = fileURLToPath(new URL('../kb/', import.meta.url));
const EVAL_FILE = path.join(KB_DIR, 'eval.json');

const HIT_AT_3_MIN = 0.9;
const HIT_AT_1_MIN = 0.6;
const AVG_LATENCY_MAX_MS = 50;
const TOP_K = 3;

function loadCases() {
  return JSON.parse(fs.readFileSync(EVAL_FILE, 'utf8'));
}

test('检索质量：15 条真实问法 hit@3 ≥ 0.9、hit@1 ≥ 0.6、平均耗时 < 50ms', async () => {
  const cases = loadCases();
  assert.equal(cases.length, 15, `kb/eval.json 应为 15 条用例，实际 ${cases.length}`);

  const rag = await createRag({ kbDir: KB_DIR, topK: 8, llmConfig: null });
  const stats = rag.stats();
  assert.equal(stats.docs, 8, `知识库应加载 8 篇文档，实际 ${stats.docs}`);

  // 预热一次，避免首次调用时模块初始化 / 缓存未热影响耗时统计
  await rag.retrieve('七天无理由退货', { topK: TOP_K });

  const rows = [];
  for (const item of cases) {
    const { query, expectDoc, expectKeywords = [] } = item;
    const startedAt = performance.now();
    const result = await rag.retrieve(query, { topK: TOP_K });
    const latency = performance.now() - startedAt;
    const hits = result?.hits ?? [];
    const firstHitIndex = hits.findIndex((hit) => hit.docId === expectDoc);
    // rank：1~3 为命中名次，0 表示没进 top3
    rows.push({ query, expectDoc, expectKeywords, rank: firstHitIndex + 1, latency, hits });
  }

  const total = rows.length;
  const hitAt1 = rows.filter((row) => row.rank === 1).length / total;
  const hitAt3 = rows.filter((row) => row.rank >= 1 && row.rank <= 3).length / total;
  const avgLatency = rows.reduce((sum, row) => sum + row.latency, 0) / total;

  // 排名表：失败用例额外打印实际返回的 top3，方便定位是切块、词表还是 query 表述问题
  const lines = [
    '',
    `=== 检索质量明细（mode=hybrid, topK=${TOP_K}）===`,
  ];
  rows.forEach((row, index) => {
    const status = row.rank >= 1 ? `hit@${row.rank}` : 'MISS ';
    lines.push(
      `${String(index + 1).padStart(2, '0')}. [${status}] "${row.query}" → expect ${row.expectDoc}（${row.latency.toFixed(2)}ms）`,
    );
    if (row.rank === 0) {
      lines.push(`    关键词：${JSON.stringify(row.expectKeywords)}`);
      row.hits.forEach((hit, hitIndex) => {
        lines.push(`    top${hitIndex + 1}: [${hit.docTitle}] ${hit.section}`);
      });
    }
  });
  lines.push(
    `汇总：hit@1=${(hitAt1 * 100).toFixed(1)}%  hit@3=${(hitAt3 * 100).toFixed(1)}%  平均检索耗时=${avgLatency.toFixed(2)}ms`,
    '',
  );
  console.log(lines.join('\n'));

  assert.ok(
    hitAt3 >= HIT_AT_3_MIN,
    `hit@3 为 ${(hitAt3 * 100).toFixed(1)}%，低于阈值 ${(HIT_AT_3_MIN * 100).toFixed(0)}%`,
  );
  assert.ok(
    hitAt1 >= HIT_AT_1_MIN,
    `hit@1 为 ${(hitAt1 * 100).toFixed(1)}%，低于阈值 ${(HIT_AT_1_MIN * 100).toFixed(0)}%`,
  );
  assert.ok(
    avgLatency < AVG_LATENCY_MAX_MS,
    `平均检索耗时 ${avgLatency.toFixed(2)}ms，超过阈值 ${AVG_LATENCY_MAX_MS}ms`,
  );
});

test('评测集自检：8 篇文档全覆盖，expectDoc 与标题一致，关键词真实存在', () => {
  const cases = loadCases();

  // 收集 kb/ 下 8 篇 Markdown 的真实标题与正文
  const docTexts = new Map();
  for (const file of fs
    .readdirSync(KB_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()) {
    const raw = fs.readFileSync(path.join(KB_DIR, file), 'utf8');
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
    assert.ok(title, `${file} 缺少一级标题`);
    docTexts.set(title, raw);
  }
  assert.equal(docTexts.size, 8, `kb/ 下应有 8 篇 Markdown，实际 ${docTexts.size}`);

  const covered = new Set(cases.map((item) => item.expectDoc));
  for (const title of docTexts.keys()) {
    assert.ok(covered.has(title), `评测集未覆盖文档「${title}」`);
  }

  for (const { query, expectDoc, expectKeywords } of cases) {
    const raw = docTexts.get(expectDoc);
    assert.ok(raw, `用例「${query}」的 expectDoc「${expectDoc}」没有同名 md 文件`);
    assert.ok(Array.isArray(expectKeywords), `用例「${query}」缺少 expectKeywords`);
    assert.ok(
      expectKeywords.length >= 1 && expectKeywords.length <= 3,
      `用例「${query}」的 expectKeywords 应为 1~3 个`,
    );
    for (const keyword of expectKeywords) {
      assert.ok(raw.includes(keyword), `用例「${query}」的关键词「${keyword}」不在「${expectDoc}」中`);
    }
  }
});
