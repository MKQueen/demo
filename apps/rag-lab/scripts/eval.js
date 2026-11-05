#!/usr/bin/env node
/**
 * scripts/eval.js —— 检索质量命令行评测（不启动 HTTP 服务）
 *
 *   node scripts/eval.js              # 用 kb/eval.json 跑一遍，打印命中排名表
 *   node scripts/eval.js --topK 8
 *   node scripts/eval.js --json       # 输出 JSON（便于 CI）
 *
 * 退出码：全部用例 hit@k 命中则 0，否则 1。方便挂到 CI 当回归。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, parseArgs } from '../config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs();
const config = loadConfig();
const topK = Math.max(1, Math.min(20, Number(args.topK || args.topk || 5)));

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
const color = (code, text) => `${code}${text}${C.reset}`;
const pad = (text, width) => {
  const visible = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  const fill = Math.max(0, width - visible.length);
  return String(text) + ' '.repeat(fill);
};

async function main() {
  const { createRag } = await import('../rag/index.js');
  const rag = await createRag({
    kbDir: config.kbDir,
    topK: config.topK,
    // 评测只用到检索：不传 llmConfig，永远不涉及模型调用
    llmConfig: null,
  });
  const stats = rag.stats();
  console.log(
    `\n${C.bold}RAG 检索评测${C.reset} ${C.gray}· 知识库 ${stats.docs} 篇 / ${stats.chunks} 块 · 向量维度 ${stats.dim} · topK=${topK}${C.reset}\n`,
  );

  const raw = await fs.readFile(config.evalPath, 'utf8');
  const cases = JSON.parse(raw);
  const results = [];
  let latencySum = 0;

  for (const item of cases) {
    const result = await rag.retrieve(item.query, { topK: Math.max(topK, 5), mode: 'hybrid' });
    latencySum += result.latencyMs;
    const rankIndex = result.hits.findIndex(
      (hit) => hit.docId === item.expectDoc || hit.docTitle === item.expectDoc,
    );
    results.push({
      query: item.query,
      expectDoc: item.expectDoc,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      hit: rankIndex >= 0 && rankIndex + 1 <= topK,
      top3: result.hits.slice(0, 3).map((hit) => hit.docTitle),
      topHit: result.hits[0],
      latencyMs: result.latencyMs,
    });
  }

  if (args.json) {
    const total = results.length || 1;
    console.log(
      JSON.stringify(
        {
          total: results.length,
          hitAt1: results.filter((r) => r.rank === 1).length / total,
          hitAtK: results.filter((r) => r.hit).length / total,
          avgLatencyMs: latencySum / total,
          results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(color(C.gray, `${pad('#', 3)}${pad('问题', 40)}${pad('期望文档', 18)}${pad('命中', 8)}排名`));
    console.log(color(C.gray, '─'.repeat(88)));
    results.forEach((row, index) => {
      const hitMark = row.hit ? color(C.green, '✓') : color(C.red, '✗');
      const rankText =
        row.rank === null ? color(C.gray, `未进 top${topK}`) : row.rank === 1 ? color(C.green, '1') : color(C.yellow, String(row.rank));
      console.log(
        `${pad(index + 1, 3)}${pad(row.query, 40)}${pad(row.expectDoc, 18)}${pad(hitMark, 8)}${rankText}`,
      );
    });
    console.log(color(C.gray, '─'.repeat(88)));

    const total = results.length || 1;
    const hitAt1 = results.filter((r) => r.rank === 1).length / total;
    const hitAt3 = results.filter((r) => r.rank !== null && r.rank <= 3).length / total;
    const hitAtK = results.filter((r) => r.hit).length / total;
    const mrr = results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / total;
    const fmt = (v) => `${(v * 100).toFixed(1)}%`;
    console.log(
      `\n${color(C.bold, '汇总')}  hit@1 ${color(C.cyan, fmt(hitAt1))}   hit@3 ${color(C.cyan, fmt(hitAt3))}   hit@${topK} ${color(C.cyan, fmt(hitAtK))}   MRR ${color(C.cyan, mrr.toFixed(3))}   平均耗时 ${color(C.cyan, (latencySum / total).toFixed(2) + 'ms')}\n`,
    );

    const failed = results.filter((r) => !r.hit);
    if (failed.length) {
      console.log(color(C.yellow, `未命中用例（实际 top-3：）`));
      for (const row of failed) {
        console.log(`  · ${row.query}\n    ${color(C.gray, '期望')} ${row.expectDoc} ${color(C.gray, '实际')} ${row.top3.join(' / ')}`);
      }
      console.log('');
    }
    process.exitCode = failed.length ? 1 : 0;
  }
}

main().catch((error) => {
  console.error('评测失败：', error?.stack || error);
  process.exit(1);
});
