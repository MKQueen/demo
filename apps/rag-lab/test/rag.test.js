/**
 * test/rag.test.js —— RAG 内核单测（node --test，零依赖）。
 *
 * 覆盖：loader 解析、chunker id/顺序/重叠、embedding 确定性、余弦检索命中、
 * BM25 / RRF 融合、PCA 确定性、prompt token 统计、无知识库兜底、LLM 流解析。
 * 用 test/fixtures/*.md 作为独立样例，不依赖 kb/（kb/ 由内容同学并行维护）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { chunkDocuments } from '../rag/chunker.js';
import { createEmbedder, DEFAULT_DIM } from '../rag/embedder.js';
import { createRag } from '../rag/index.js';
import { createLlm } from '../rag/llm.js';
import { loadDocuments } from '../rag/loader.js';
import { buildPrompt } from '../rag/prompt.js';
import { computeProjection, cosine, createStore, rrfFuse } from '../rag/store.js';
import { analyzeQuery, estimateTokens, tokenize } from '../rag/util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(HERE, 'fixtures');
const MISSING_KB_DIR = path.join(FIXTURE_DIR, '__no_such_kb__');
const KB_DIR = path.join(HERE, '..', 'kb');

let cachedRag = null;
async function fixtureRag() {
  if (!cachedRag) cachedRag = await createRag({ kbDir: FIXTURE_DIR, topK: 6 });
  return cachedRag;
}

/** 真实知识库（kb/）由内容同学维护；缺失时相关用例 skip，而不是让测试莫名失败 */
let kbRagCache = null;
async function kbRag(t) {
  if (!kbRagCache) {
    try {
      const rag = await createRag({ kbDir: KB_DIR, topK: 6 });
      const stats = rag.stats();
      kbRagCache = stats.docs > 0 ? rag : null;
    } catch {
      kbRagCache = null;
    }
  }
  if (!kbRagCache) {
    t.skip('kb/ 暂未就绪，跳过真实数据回归');
    return null;
  }
  return kbRagCache;
}

/** 去掉耗时字段，用于比较两次检索的「非时间」结果是否完全一致 */
function stableResult(result) {
  return {
    ...result,
    latencyMs: 0,
    steps: result.steps.map((step) => ({ ...step, ms: 0 })),
  };
}

async function collect(asyncIterable) {
  const items = [];
  for await (const item of asyncIterable) items.push(item);
  return items;
}

/** 最长公共重叠：prev 的后缀与 next 的前缀（限制 120 字内，够测 60~100 的重叠） */
function overlapLength(prevText, nextText) {
  const prev = [...prevText];
  const next = [...nextText];
  const max = Math.min(prev.length, next.length, 120);
  for (let len = max; len >= 1; len--) {
    if (prev.slice(prev.length - len).join('') === next.slice(0, len).join('')) return len;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// util / loader / chunker
// ---------------------------------------------------------------------------

test('util：CJK bigram + ASCII 分词，查询侧去停用词', () => {
  assert.deepEqual(tokenize('七天无理由退货'), [
    '七天', '天无', '无理', '理由', '由退', '退货',
  ]);
  assert.deepEqual(tokenize('HUAWEI FreeBuds 4'), ['huawei', 'freebuds', '4']);

  const analysis = analyzeQuery('耳机有杂音能退吗');
  assert.equal(analysis.normalized, '耳机有杂音能退吗');
  // 含虚词的 bigram（机有/有杂/音能/能退/退吗）被丢掉，只留下核心检索词
  assert.deepEqual(analysis.tokens.map((item) => item.term), ['耳机', '杂音']);
  assert.deepEqual(analysis.keywordTerms, ['耳机', '杂音']);

  // 全是虚词时不至于把检索词清空
  assert.ok(analyzeQuery('怎么办').tokens.length > 0);
});

test('util：estimateTokens 中文 1/1.5 字、英文 1/4 字符，且单调递增', () => {
  const zero = estimateTokens('');
  const short = estimateTokens('七天无理由退货');
  const long = estimateTokens('七天无理由退货'.repeat(10));
  assert.equal(zero, 0);
  assert.ok(short > 0);
  assert.ok(long > short);
  assert.equal(estimateTokens('abcd'), 1); // 4 个字符 ≈ 1 token
  assert.equal(estimateTokens('你好'), 1); // 2 个汉字 / 1.5 ≈ 1.33 → 1
});

test('loader：解析文件名序号、# 标题、## 小节与 front-matter 摘要', async () => {
  const docs = await loadDocuments(FIXTURE_DIR);
  assert.equal(docs.length, 3);
  assert.deepEqual(docs.map((doc) => doc.id), ['退换货政策', '物流配送', '支付与发票']);
  assert.deepEqual(docs.map((doc) => doc.order), [1, 2, 3]);
  assert.deepEqual(docs.map((doc) => doc.title), ['退换货政策', '物流配送', '支付与发票']);
  assert.deepEqual(docs.map((doc) => doc.file), [
    '01-退换货政策.md',
    '02-物流配送.md',
    '03-支付与发票.md',
  ]);
  assert.ok(docs[0].summary.includes('七天无理由退货'));
  assert.deepEqual(docs[0].sections.map((section) => section.heading), [
    '一、七天无理由退货',
    '二、质量问题退换',
    '三、退款到账时间',
  ]);
});

test('chunker：chunk.id 严格是 docId#序号，序号按文档内顺序从 0 递增', async () => {
  const docs = await loadDocuments(FIXTURE_DIR);
  const chunks = chunkDocuments(docs);
  assert.ok(chunks.length > 3);

  const byDoc = new Map();
  for (const chunk of chunks) {
    assert.match(chunk.id, /^[^#]+#\d+$/);
    const [docId, orderText] = chunk.id.split('#');
    assert.equal(docId, chunk.docId);
    assert.equal(Number(orderText), chunk.order);
    assert.equal(chunk.docTitle, docs.find((doc) => doc.id === docId).title);
    if (!byDoc.has(docId)) byDoc.set(docId, []);
    byDoc.get(docId).push(chunk);
  }
  for (const [docId, docChunks] of byDoc) {
    assert.deepEqual(docChunks.map((chunk) => chunk.id), docChunks.map((_, index) => `${docId}#${index}`));
    assert.deepEqual(docChunks.map((chunk) => chunk.order), docChunks.map((_, index) => index));
  }
});

test('chunker：标题感知切块，块长 <=450 字，长小节产生 60~100 字重叠', async () => {
  const docs = await loadDocuments(FIXTURE_DIR);
  const chunks = chunkDocuments(docs);
  const policyChunks = chunks.filter((chunk) => chunk.docId === '退换货政策');
  const firstSection = policyChunks.filter((chunk) => chunk.section === '一、七天无理由退货');

  assert.ok(firstSection.length >= 2, '长小节应被切成多块');
  for (const chunk of chunks) {
    assert.ok(chunk.chars <= 450, `${chunk.id} 超过 450 字`);
    assert.ok(chunk.chars > 0);
    assert.ok(chunk.tokens > 0);
    assert.equal(chunk.text, chunks.find((item) => item.id === chunk.id).text);
  }
  // 只有首块能被允许短于 180 字（后续块都带重叠前缀）
  for (const chunk of firstSection) {
    assert.ok(chunk.chars <= 450);
  }

  const overlap = overlapLength(firstSection[0].text, firstSection[1].text);
  assert.ok(overlap >= 60 && overlap <= 100, `重叠长度应在 60~100，实际 ${overlap}`);
  // 重叠不能影响 id：后一块仍然是 #1，且 section 保持一致
  assert.equal(firstSection[1].id, '退换货政策#1');
  assert.equal(firstSection[1].section, firstSection[0].section);
});

// ---------------------------------------------------------------------------
// embedder
// ---------------------------------------------------------------------------

test('embedder：同一文本永远得到同一个单位向量（默认 8192 维）', () => {
  const embedder = createEmbedder();
  assert.equal(DEFAULT_DIM, 8192);
  assert.equal(embedder.dim, DEFAULT_DIM);
  assert.equal(embedder.mode, 'hash');

  const a = embedder.embed('七天无理由退货怎么操作');
  const b = createEmbedder().embed('七天无理由退货怎么操作');
  assert.deepEqual(Array.from(a), Array.from(b));

  let norm = 0;
  for (const value of a) norm += value * value;
  assert.ok(Math.abs(Math.sqrt(norm) - 1) < 1e-9);
  assert.ok(a.some((value) => value !== 0));
});

test('embedder：不同文本余弦明显小于 1（非零距离）', async () => {
  const rag = await fixtureRag();
  const embedder = createEmbedder();
  const similar = cosine(embedder.embed('七天无理由退货'), embedder.embed('七天无理由退货的条件'));
  const different = cosine(embedder.embed('七天无理由退货'), embedder.embed('物流配送运费多少钱'));
  assert.ok(similar > different);
  assert.ok(different < 0.99);
  assert.ok(rag.stats().dim === DEFAULT_DIM);
});

// ---------------------------------------------------------------------------
// 检索 / BM25 / RRF / PCA
// ---------------------------------------------------------------------------

test('retrieve：三条基准问句 top-1 落在正确文档', async () => {
  const rag = await fixtureRag();
  const cases = [
    ['七天无理由退货怎么操作', '退换货政策'],
    ['发票开错了能重开吗', '支付与发票'],
    ['耳机有杂音能退吗', '退换货政策'],
  ];
  for (const [query, expectDoc] of cases) {
    const result = await rag.retrieve(query);
    assert.equal(result.hits[0]?.docId, expectDoc, `query=${query} 的 top-1 文档不对`);
    assert.equal(result.hits[0].rank, 1);
    assert.ok(result.hits[0].text.length > 0);
  }
});

test('retrieve：响应结构与 API.md §3 一致（steps / candidates / 分数 / 查询点）', async () => {
  const rag = await fixtureRag();
  const result = await rag.retrieve('七天无理由退货怎么操作', { topK: 3, mode: 'hybrid' });

  assert.deepEqual(Object.keys(result), [
    'query', 'mode', 'topK', 'latencyMs', 'candidates', 'steps',
    'hits', 'queryEmbedding', 'queryPoint', 'keywordTerms',
  ]);
  assert.equal(result.query, '七天无理由退货怎么操作');
  assert.equal(result.mode, 'hybrid');
  assert.equal(result.topK, 3);
  assert.equal(result.candidates, rag.stats().chunks);
  assert.ok(result.latencyMs >= 0);
  assert.deepEqual(result.steps.map((step) => step.key), ['analyze', 'embed', 'vector', 'keyword', 'fuse']);
  for (const step of result.steps) {
    assert.equal(typeof step.name, 'string');
    assert.equal(typeof step.ms, 'number');
    assert.equal(typeof step.detail, 'string');
  }
  assert.equal(result.steps[4].detail, 'RRF(k=60) → top 3');
  assert.ok(result.hits.length <= 3);
  assert.equal(result.queryEmbedding.dim, DEFAULT_DIM);
  assert.ok(result.queryEmbedding.nonzero > 0);
  assert.ok(Array.isArray(result.queryEmbedding.preview));
  assert.ok(result.keywordTerms.length > 0);
  assert.ok(Number.isFinite(result.queryPoint.x));
  assert.ok(Number.isFinite(result.queryPoint.y));

  for (let index = 0; index < result.hits.length; index++) {
    const hit = result.hits[index];
    assert.equal(hit.rank, index + 1);
    for (const key of ['chunkId', 'docId', 'docTitle', 'section', 'text']) {
      assert.equal(typeof hit[key], 'string');
    }
    for (const key of ['vector', 'keyword', 'fused']) {
      assert.ok(hit.scores[key] >= 0 && hit.scores[key] <= 1, `scores.${key} 越界`);
    }
    if (index > 0) assert.ok(hit.scores.fused <= result.hits[index - 1].scores.fused);
    assert.ok(hit.matchedTerms.length <= 6);
    for (const term of hit.matchedTerms) {
      assert.ok(hit.text.toLowerCase().includes(term.toLowerCase()), `matchedTerm ${term} 不在正文中`);
    }
  }
});

test('retrieve：matchTerms 会把相邻 bigram 合并成连续命中片段', async () => {
  const rag = await fixtureRag();
  const result = await rag.retrieve('七天无理由退货怎么操作');
  assert.ok(result.hits[0].matchedTerms.includes('七天无理由退货'));
});

test('retrieve：keyword 模式只看 BM25，vector 模式只看余弦', async () => {
  const rag = await fixtureRag();
  const keyword = await rag.retrieve('新疆 运费', { mode: 'keyword', topK: 5 });
  assert.equal(keyword.mode, 'keyword');
  assert.equal(keyword.steps[4].detail, 'BM25 → top 5');
  assert.equal(keyword.hits[0]?.docId, '物流配送');
  assert.equal(keyword.hits[0]?.scores.keyword, 1);
  assert.ok(keyword.hits.every((hit) => hit.scores.keyword > 0));

  const vector = await rag.retrieve('七天无理由退货怎么操作', { mode: 'vector', topK: 5 });
  assert.equal(vector.steps[4].detail, '余弦相似度 → top 5');
  assert.ok(vector.hits.every((hit) => hit.scores.vector > 0));
});

test('RRF：按名次融合，两个列表都靠前的块胜出', () => {
  const fused = rrfFuse([
    ['a', 'b', 'c'],
    ['c', 'a'],
  ]);
  const scoreA = 1 / 61 + 1 / 62;
  const scoreB = 1 / 62;
  const scoreC = 1 / 63 + 1 / 61;
  assert.ok(Math.abs(fused.get('a') - scoreA) < 1e-12);
  assert.ok(Math.abs(fused.get('b') - scoreB) < 1e-12);
  assert.ok(Math.abs(fused.get('c') - scoreC) < 1e-12);
  assert.ok(fused.get('a') > fused.get('c'));
  assert.ok(fused.get('c') > fused.get('b'));
});

test('store.fuse：hybrid 融合分归一化到 0~1，top-1 为 1 并降序', async () => {
  const docs = await loadDocuments(FIXTURE_DIR);
  const chunks = chunkDocuments(docs);
  const embedder = createEmbedder();
  const store = createStore({ chunks, embedder });

  const analysis = store.analyze('发票开错了能重开吗');
  const vector = embedder.embed('发票开错了能重开吗');
  const hits = store.fuse({
    queryInfo: analysis,
    vectorRank: store.vectorRank(vector),
    keywordRank: store.keywordRank(analysis.tokens),
    mode: 'hybrid',
    topK: 4,
  });

  assert.equal(hits.length, 4);
  assert.equal(hits[0].scores.fused, 1);
  for (let index = 1; index < hits.length; index++) {
    assert.ok(hits[index].scores.fused <= hits[index - 1].scores.fused);
  }
  assert.equal(hits[0].docId, '支付与发票');
});

test('PCA：同样输入两次投影完全一致，坐标落在 [-1,1]，查询点同空间', async () => {
  const ragA = await createRag({ kbDir: FIXTURE_DIR });
  const ragB = await createRag({ kbDir: FIXTURE_DIR });
  const snapshotA = await ragA.snapshot();
  const snapshotB = await ragB.snapshot();

  assert.deepEqual(snapshotA.projection, snapshotB.projection);
  assert.equal(snapshotA.projection.length, snapshotA.chunks.length);
  for (const point of snapshotA.projection) {
    assert.ok(point.x >= -1 && point.x <= 1);
    assert.ok(point.y >= -1 && point.y <= 1);
    assert.ok(snapshotA.chunks.some((chunk) => chunk.id === point.chunkId));
  }

  const resultA = await ragA.retrieve('七天无理由退货怎么操作');
  const resultB = await ragB.retrieve('七天无理由退货怎么操作');
  assert.deepEqual(resultA.queryPoint, resultB.queryPoint);
  assert.ok(resultA.queryPoint.x >= -1 && resultA.queryPoint.x <= 1);
  assert.ok(resultA.queryPoint.y >= -1 && resultA.queryPoint.y <= 1);
});

test('PCA：直接对退化数据（全同向量）也不产生 NaN', () => {
  const dim = 8;
  const vector = new Float64Array(dim);
  vector[0] = 1;
  const projection = computeProjection([vector, vector], dim);
  assert.equal(projection.points.length, 2);
  for (const point of projection.points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
  assert.deepEqual(projection.project(vector), { x: 0, y: 0 });
});

// ---------------------------------------------------------------------------
// snapshot / stats / createRag 暴露面
// ---------------------------------------------------------------------------

test('snapshot：结构与 GET /api/kb 一致（docs / chunks / embedding / projection / stats）', async () => {
  const rag = await fixtureRag();
  const snapshot = await rag.snapshot();

  assert.deepEqual(Object.keys(snapshot), ['docs', 'chunks', 'embedding', 'projection', 'stats']);
  assert.equal(snapshot.docs.length, 3);
  for (const doc of snapshot.docs) {
    for (const key of ['id', 'title', 'file', 'order', 'summary', 'chunkCount']) {
      assert.ok(doc[key] !== undefined, `doc.${key} 缺失`);
    }
  }
  for (const chunk of snapshot.chunks) {
    for (const key of ['id', 'docId', 'docTitle', 'section', 'text', 'tokens', 'chars', 'order']) {
      assert.ok(chunk[key] !== undefined, `chunk.${key} 缺失`);
    }
  }
  assert.equal(snapshot.embedding.mode, 'hash');
  assert.equal(snapshot.embedding.dim, DEFAULT_DIM);
  assert.match(snapshot.embedding.note, /bigram/);
  assert.equal(snapshot.projection.length, snapshot.chunks.length);
  assert.equal(snapshot.stats.docs, 3);
  assert.equal(snapshot.stats.chunks, snapshot.chunks.length);
  assert.equal(snapshot.stats.dim, DEFAULT_DIM);
  assert.equal(
    snapshot.docs.reduce((sum, doc) => sum + doc.chunkCount, 0),
    snapshot.chunks.length,
  );

  const stats = rag.stats();
  assert.equal(stats.docs, snapshot.stats.docs);
  assert.equal(stats.chunks, snapshot.stats.chunks);
  assert.equal(stats.totalTokens, snapshot.stats.totalTokens);
  assert.equal(stats.dim, DEFAULT_DIM);
});

test('buildPrompt：system 约束、[n] 上下文、history 截断与 token 统计', async () => {
  const rag = await fixtureRag();
  const result = await rag.retrieve('七天无理由退货怎么操作', { topK: 3 });
  const question = '七天无理由退货怎么操作';
  const prompt = buildPrompt({
    hits: result.hits,
    question,
    history: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '您好，我是云岭商城客服。' },
      { role: 'user', content: question },
    ],
  });

  assert.equal(prompt.messages[0].role, 'system');
  assert.match(prompt.messages[0].content, /只依据/);
  assert.match(prompt.messages[0].content, /\[n\]/);
  assert.match(prompt.messages[0].content, /转人工/);
  assert.equal(prompt.contextBlocks.length, result.hits.length);
  assert.equal(prompt.contextBlocks[0].marker, '[1]');
  assert.equal(prompt.contextBlocks[1].marker, '[2]');
  assert.equal(prompt.contextBlocks.length, 3);
  for (const block of prompt.contextBlocks) {
    assert.equal(block.tokens, estimateTokens(block.text));
  }

  // 传入的 messages 末尾就是当前问题，不应重复进入 history
  assert.equal(prompt.messages.length, 1 + 2 + 1);
  assert.equal(prompt.messages[1].content, '你好');
  assert.equal(prompt.messages[2].content, '您好，我是云岭商城客服。');
  assert.equal(prompt.messages.at(-1).role, 'user');
  assert.ok(prompt.messages.at(-1).content.includes(question));
  assert.ok(prompt.messages.at(-1).content.includes('【知识库片段】'));
  assert.ok(prompt.messages.at(-1).content.includes('[1] 《退换货政策》'));

  assert.equal(
    prompt.tokens.total,
    prompt.tokens.system + prompt.tokens.context + prompt.tokens.history,
  );
  assert.ok(prompt.tokens.system > 0);
  assert.ok(prompt.tokens.context > 0);
  assert.ok(prompt.tokens.history > 0);

  // 长历史会被截断到 8 条 / 800 token 以内
  const longHistory = [];
  for (let index = 0; index < 30; index++) {
    longHistory.push({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: '这是一段比较长的历史对话内容，用来测试 token 预算截断。'.repeat(3),
    });
  }
  longHistory.push({ role: 'user', content: question });
  const truncated = buildPrompt({ hits: result.hits, question, history: longHistory });
  const keptHistory = truncated.messages.slice(1, -1);
  assert.ok(keptHistory.length <= 8);
  assert.ok(truncated.tokens.history <= 800);
});

test('createRag：不再暴露 mockAnswer，llm 未配置时如实为 disconnected', async () => {
  const rag = await fixtureRag();
  // 离线抽取式答案模块已删除：门面对象上不能还有 mockAnswer
  assert.equal(rag.mockAnswer, undefined, 'rag 门面不应再暴露 mockAnswer');
  assert.equal(typeof rag.llm.stream, 'function');
  assert.equal(rag.llm.available, false);
  assert.equal(rag.llm.mode, 'disconnected');
});

test('无知识库：kbDir 不存在时 stats/snapshot/retrieve 都不崩，返回空知识库', async () => {
  const rag = await createRag({ kbDir: MISSING_KB_DIR, topK: 3 });
  assert.deepEqual(rag.stats(), {
    docs: 0,
    chunks: 0,
    dim: DEFAULT_DIM,
    totalTokens: 0,
    avgTokens: 0,
  });

  const snapshot = await rag.snapshot();
  assert.deepEqual(snapshot.docs, []);
  assert.deepEqual(snapshot.chunks, []);
  assert.deepEqual(snapshot.projection, []);
  assert.equal(snapshot.embedding.dim, DEFAULT_DIM);

  const result = await rag.retrieve('七天无理由退货怎么操作');
  assert.deepEqual(result.hits, []);
  assert.equal(result.candidates, 0);
  assert.equal(result.steps.length, 5);
  assert.deepEqual(result.queryPoint, { x: 0, y: 0 });
  assert.ok(Array.isArray(result.keywordTerms));

  await rag.reload(); // 没目录也能安全重载
  assert.equal(rag.stats().chunks, 0);
});

test('确定性：同一查询两次检索结果完全一致（去掉耗时字段）', async () => {
  const rag = await fixtureRag();
  const first = await rag.retrieve('七天无理由退货怎么操作');
  const second = await rag.retrieve('七天无理由退货怎么操作');
  assert.deepEqual(stableResult(second), stableResult(first));

  // 不同实例、不同进程内重建也要一致（hash + PCA 都用确定性算法）
  const other = await createRag({ kbDir: FIXTURE_DIR });
  const third = await other.retrieve('七天无理由退货怎么操作');
  assert.deepEqual(stableResult(third), stableResult(first));
});

test('kb 真实数据：vector-only 六条 probe 的 top-1 文档正确，scores.vector 在 0~1', async (t) => {
  const rag = await kbRag(t);
  if (!rag) return;

  const probes = [
    ['耳机有杂音能退吗', '退换货政策', '质量问题'],
    ['往新疆发货要加多少运费', '物流配送', '配送范围与运费'],
    ['会员积分年底会不会清零', '会员与积分', '积分'],
    ['发票开错了能重开吗', '支付与发票', '发票'],
    ['手机保修期多长', '保修与售后维修', '保修期'],
    ['七天无理由退货怎么操作', '退换货政策', '七天无理由退货'],
  ];
  for (const [query, expectDoc, sectionHint] of probes) {
    const result = await rag.retrieve(query, { mode: 'vector', topK: 3 });
    assert.equal(result.mode, 'vector');
    assert.equal(result.hits[0]?.docId, expectDoc, `vector top-1 文档错误: ${query}`);
    assert.ok(
      result.hits.some((hit) => hit.section.includes(sectionHint)),
      `top3 里应包含期望小节「${sectionHint}」: ${query}`,
    );
    for (const hit of result.hits) {
      assert.ok(hit.scores.vector >= 0 && hit.scores.vector <= 1, `scores.vector 越界: ${hit.scores.vector}`);
    }
    // 余弦分要能和噪声拉开：top-1 至少 0.1（8192 维哈希 + 句子 max-pool 后正常在 0.1~0.5）
    assert.ok(result.hits[0].scores.vector >= 0.1, `top-1 余弦过低: ${query}`);
  }
});

test('kb 真实数据：hybrid 在 eval.json 上 hit@1 ≥ 0.9、hit@3 = 100%', async (t) => {
  const rag = await kbRag(t);
  if (!rag) return;
  const cases = JSON.parse(await fs.readFile(path.join(KB_DIR, 'eval.json'), 'utf8'));
  assert.ok(Array.isArray(cases) && cases.length >= 10);

  let hitAt1 = 0;
  let hitAt3 = 0;
  for (const item of cases) {
    const result = await rag.retrieve(item.query, { topK: 5, mode: 'hybrid' });
    const rank =
      result.hits.findIndex(
        (hit) => hit.docId === item.expectDoc || hit.docTitle === item.expectDoc,
      ) + 1;
    if (rank === 1) hitAt1 += 1;
    if (rank >= 1 && rank <= 3) hitAt3 += 1;
    for (const hit of result.hits) {
      assert.ok(hit.scores.vector >= 0 && hit.scores.vector <= 1);
      assert.ok(hit.scores.keyword >= 0 && hit.scores.keyword <= 1);
      assert.ok(hit.scores.fused >= 0 && hit.scores.fused <= 1);
    }
  }
  const total = cases.length;
  assert.ok(hitAt1 / total >= 0.9, `hybrid hit@1 ${hitAt1}/${total} 低于 90%`);
  assert.equal(hitAt3, total, `hybrid hit@3 应 100%，实际 ${hitAt3}/${total}`);
});

// ---------------------------------------------------------------------------
// llm
// ---------------------------------------------------------------------------

test('llm：没有可用 Key 时 available=false / mode=disconnected / stream 抛错', async () => {
  const llm = createLlm(null);
  assert.equal(llm.available, false);
  assert.equal(llm.mode, 'disconnected');
  assert.equal(llm.model, 'deepseek-flash');
  await assert.rejects(
    () => collect(llm.stream([{ role: 'user', content: 'hi' }])),
    /API Key/,
  );

  // .env.example 里的占位符 key 不算「可用」，避免发一次必失败的请求
  const placeholder = createLlm({ apiKey: 'sk-在这里填你的key', model: 'x' });
  assert.equal(placeholder.available, false);
  assert.equal(placeholder.mode, 'disconnected');
});

test('llm：available 只看 Key（旧的 mock 选项已移除，传了也不生效）', () => {
  const llm = createLlm({ apiKey: 'sk-test', mock: true });
  assert.equal(llm.available, true);
  assert.equal(llm.mode, 'llm');
  assert.equal(llm.baseUrl, 'https://api.deepseek.com');
});

test('llm：SSE 解析 reasoning_content / content / usage，并带正确的请求体', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"先想一下"}}]}',
      '',
      'data: {"choices":[{"delta":{"reasoning_content":"再想一下"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"您好"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"，我是客服"}}]}',
      '',
      'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    return new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    });
  };
  try {
    const llm = createLlm({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1/',
      model: 'test-model',
    });
    assert.equal(llm.available, true);
    assert.equal(llm.mode, 'llm');
    assert.equal(llm.baseUrl, 'https://api.example.com/v1');

    const events = await collect(
      llm.stream([{ role: 'user', content: '你好' }], { temperature: 0.2, maxTokens: 32 }),
    );
    assert.deepEqual(events, [
      { type: 'reasoning', text: '先想一下' },
      { type: 'reasoning', text: '再想一下' },
      { type: 'delta', text: '您好' },
      { type: 'delta', text: '，我是客服' },
      { type: 'usage', usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 } },
    ]);

    assert.equal(captured.url, 'https://api.example.com/v1/chat/completions');
    assert.equal(captured.body.model, 'test-model');
    assert.equal(captured.body.stream, true);
    // 请求上游时要求返回 usage，server 的 done.usage 才能用真实值
    assert.deepEqual(captured.body.stream_options, { include_usage: true });
    assert.equal(captured.body.temperature, 0.2);
    assert.equal(captured.body.max_tokens, 32);
    assert.deepEqual(captured.body.messages, [{ role: 'user', content: '你好' }]);
    assert.equal(captured.init.headers.Authorization, 'Bearer sk-test');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('llm：HTTP 错误会带上状态码与服务端错误信息', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  try {
    const llm = createLlm({ apiKey: 'sk-bad', baseUrl: 'https://api.example.com' });
    await assert.rejects(
      () => collect(llm.stream([{ role: 'user', content: 'hi' }])),
      (error) => {
        assert.equal(error.code, 'llm_error');
        assert.equal(error.status, 401);
        assert.match(error.message, /401/);
        assert.match(error.message, /invalid api key/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('llm：超时（默认 60s，可配置）会中止请求并报超时错误', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason ?? new Error('aborted')));
    });
  try {
    const llm = createLlm({ apiKey: 'sk-test', baseUrl: 'https://api.example.com', timeoutMs: 40 });
    await assert.rejects(
      () => collect(llm.stream([{ role: 'user', content: 'hi' }])),
      /超时/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
