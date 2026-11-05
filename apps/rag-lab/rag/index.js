/**
 * index.js —— RAG 门面：把 loader/chunker/embedder/store/prompt/llm 组装起来。
 *
 * server.js 只依赖这里导出的 createRag(options)，签名与 docs/API.md §8 一致。
 * 设计原则：
 *   - snapshot() 的字段与 GET /api/kb 完全对应；
 *   - retrieve() 的字段与 POST /api/retrieve 完全对应（含 5 个阶段的耗时 steps）；
 *   - kbDir 不存在/为空时返回空知识库，不抛错（server 照常启动，前端显示 0 块）；
 *   - 回答只由 llm 真实生成，这里不再提供任何离线抽取式答案。
 */
import { chunkDocuments } from './chunker.js';
import { createEmbedder, DEFAULT_DIM, EMBEDDING_MODE, EMBEDDING_NOTE } from './embedder.js';
import { createLlm } from './llm.js';
import { loadDocuments } from './loader.js';
import { buildPrompt } from './prompt.js';
import { createStore, RRF_K } from './store.js';
import { now, round, roundMs } from './util.js';

/**
 * @param {{kbDir?: string, topK?: number, llmConfig?: object|null, dim?: number}} [options]
 */
export async function createRag(options = {}) {
  const kbDir = options.kbDir ? String(options.kbDir) : '';
  const defaultTopK = normalizeTopK(options.topK, 6);
  const dim = normalizeDim(options.dim ?? options.embedding?.dim ?? DEFAULT_DIM);
  const embedder = createEmbedder({ dim });
  const llm = createLlm(options.llmConfig ?? null);

  let docs = [];
  let chunks = [];
  let store = createStore({ chunks: [], embedder });

  function embeddingInfo() {
    return { mode: EMBEDDING_MODE, dim: embedder.dim, note: EMBEDDING_NOTE };
  }

  /** 统计信息：GET /api/health 与 snapshot().stats 共用 */
  function stats() {
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
    return {
      docs: docs.length,
      chunks: chunks.length,
      dim: embedder.dim,
      totalTokens,
      avgTokens: chunks.length ? round(totalTokens / chunks.length, 1) : 0,
    };
  }

  /** 知识库全量快照：结构与 GET /api/kb 一致 */
  async function snapshot() {
    return {
      docs: docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        file: doc.file,
        order: doc.order,
        summary: doc.summary,
        chunkCount: doc.chunkCount,
      })),
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        docId: chunk.docId,
        docTitle: chunk.docTitle,
        section: chunk.section,
        text: chunk.text,
        tokens: chunk.tokens,
        chars: chunk.chars,
        order: chunk.order,
      })),
      embedding: embeddingInfo(),
      projection: store.projectionPoints(),
      stats: stats(),
    };
  }

  /** 仅检索：结构与 POST /api/retrieve 一致 */
  async function retrieve(query, opts = {}) {
    const started = now();
    const text = String(query ?? '').trim();
    const topK = normalizeTopK(opts.topK, defaultTopK);
    const mode = ['hybrid', 'vector', 'keyword'].includes(opts.mode) ? opts.mode : 'hybrid';
    const steps = [];

    // 阶段 1：查询理解（分词 + 去停用词）
    let stageStart = now();
    const analysis = store.analyze(text);
    steps.push({
      key: 'analyze',
      name: '查询理解',
      ms: roundMs(now() - stageStart),
      detail: `去停用词后得到 ${analysis.tokens.length} 个检索词`,
    });

    // 阶段 2：向量化。查询侧先去掉停用词造成的跨词 bigram（"机有/有杂/音能/能退"），
    // 否则这些噪声特征会把真正命中的 bigram 稀释掉。
    stageStart = now();
    const queryVector = embedder.embed(analysis.tokens.map((token) => token.term).join(' '));
    steps.push({
      key: 'embed',
      name: '向量化',
      ms: roundMs(now() - stageStart),
      detail: `hash-embedding · dim=${embedder.dim}`,
    });

    // 阶段 3：向量召回
    stageStart = now();
    const vectorRank = store.vectorRank(queryVector);
    steps.push({
      key: 'vector',
      name: '向量召回',
      ms: roundMs(now() - stageStart),
      detail: `余弦相似度 · ${store.size} 个块`,
    });

    // 阶段 4：关键词召回
    stageStart = now();
    const keywordRank = store.keywordRank(analysis.tokens);
    steps.push({
      key: 'keyword',
      name: '关键词召回',
      ms: roundMs(now() - stageStart),
      detail: `BM25 · ${store.size} 个块`,
    });

    // 阶段 5：融合重排（hybrid 用 RRF）
    stageStart = now();
    const hits = store.fuse({ queryInfo: analysis, vectorRank, keywordRank, mode, topK });
    const fuseDetail =
      mode === 'keyword'
        ? `BM25 → top ${topK}`
        : mode === 'vector'
          ? `余弦相似度 → top ${topK}`
          : `RRF(k=${RRF_K}) → top ${topK}`;
    steps.push({
      key: 'fuse',
      name: '融合重排',
      ms: roundMs(now() - stageStart),
      detail: fuseDetail,
    });

    // 查询向量预览：取前 5 个非零分量，足够让前端展示「向量长什么样」
    let nonzero = 0;
    const preview = [];
    for (let i = 0; i < queryVector.length; i++) {
      if (queryVector[i] === 0) continue;
      nonzero += 1;
      if (preview.length < 5) preview.push(round(queryVector[i], 3));
    }

    return {
      query: text,
      mode,
      topK,
      latencyMs: roundMs(now() - started),
      candidates: store.size,
      steps,
      hits,
      queryEmbedding: { dim: embedder.dim, nonzero, preview },
      queryPoint: store.project(queryVector),
      keywordTerms: analysis.keywordTerms,
    };
  }

  /** 重新读盘：改完 kb/*.md 不重启进程也能生效 */
  async function reload() {
    const loaded = await loadDocuments(kbDir);
    const chunkList = chunkDocuments(loaded);

    const chunkCounts = new Map();
    for (const chunk of chunkList) {
      chunkCounts.set(chunk.docId, (chunkCounts.get(chunk.docId) ?? 0) + 1);
    }
    docs = loaded.map((doc) => ({ ...doc, chunkCount: chunkCounts.get(doc.id) ?? 0 }));
    chunks = chunkList;
    store = createStore({ chunks: chunkList, embedder });
  }

  await reload();

  return {
    stats,
    snapshot,
    retrieve,
    buildPrompt,
    llm,
    reload,
    embedding: embeddingInfo(),
    // server 的健康检查会读 rag.embedder.dim 展示「向量维度」（契约外的便利字段）
    embedder: { ...embeddingInfo(), embed: embedder.embed },
  };
}

function normalizeTopK(value, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.min(20, number));
}

function normalizeDim(value) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 64) return DEFAULT_DIM;
  return Math.min(16384, number);
}
