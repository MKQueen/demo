/**
 * engine/index.js —— 浏览器版 RAG 门面（浏览器模式的核心）
 *
 * 与 rag/index.js 的差别只有两处（其余算法逐字复用 rag/ 的实现）：
 *   1. 没有 loader：知识库在构建时由 scripts/build-static.mjs 用 rag/loader.js 解析成
 *      kb-data.json，这里 fetch 回来即可（不读文件系统）；
 *   2. 没有 llm：本文件只负责浏览器内的切块 / 索引 / 检索 / Prompt 拼装，
 *      生成统一由 browser-api.js 走同源模型转发层（/api/llm/*）真实调用大模型。
 *
 * 切块（chunker）→ 哈希向量（embedder）→ BM25/向量/RRF/PCA（store）→ Prompt 拼装（prompt）
 * 全部在浏览器里跑，所以 retrieve()/snapshot() 的字段与服务端 /api/* 完全一致。
 *
 * 注意：engine/ 下的 chunker / embedder / store / prompt / util 是由
 * scripts/build-static.mjs 从 rag/ 同步过来的副本，请不要直接改这里，改 rag/ 后重新构建。
 */
import { chunkDocuments } from './chunker.js';
import { EMBEDDING_MODE, EMBEDDING_NOTE, DEFAULT_DIM, createEmbedder } from './embedder.js';
import { buildPrompt } from './prompt.js';
import { createStore, RRF_K } from './store.js';
import { now, round, roundMs } from './util.js';

/** 相对 document.baseURI 解析，保证 /demos/rag-lab/ 这种子路径部署也能取到数据 */
export function resolveAssetUrl(relative) {
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL(relative, document.baseURI).href;
  }
  return relative;
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (error) {
    throw new Error(`无法加载知识库数据：${url}（${error?.message || '网络错误'}）`);
  }
  if (!response.ok) {
    throw new Error(`无法加载知识库数据：${url}（HTTP ${response.status}）`);
  }
  return response.json();
}

/**
 * 创建浏览器版 RAG 实例。
 *
 * @param {{kbUrl?: string, dim?: number, topK?: number}} [options]
 * @returns {Promise<object>} 与 rag/index.js 的 Rag 同构（除了没有 llm）
 */
export async function createStaticRag(options = {}) {
  const kbUrl = options.kbUrl || resolveAssetUrl('kb-data.json');
  const data = await fetchJson(kbUrl);

  // 兼容两种数据形态：documents（loader 解析后的文档，需浏览器切块）
  // 或 chunks（构建时已切好的块，直接建索引）。当前构建脚本输出前者。
  const documents = Array.isArray(data.documents) ? data.documents : Array.isArray(data.docs) ? data.docs : [];
  const preChunked = Array.isArray(data.chunks) ? data.chunks : null;

  const defaultTopK = normalizeTopK(options.topK ?? data.topK, 6);
  const dim = normalizeDim(options.dim ?? data.embedding?.dim);
  const embedder = createEmbedder({ dim });

  let docs = [];
  let chunks = [];
  let store = createStore({ chunks: [], embedder });

  function embeddingInfo() {
    return { mode: EMBEDDING_MODE, dim: embedder.dim, note: EMBEDDING_NOTE };
  }

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

  function rebuild() {
    const chunkList = preChunked || chunkDocuments(documents);
    const chunkCounts = new Map();
    for (const chunk of chunkList) {
      chunkCounts.set(chunk.docId, (chunkCounts.get(chunk.docId) ?? 0) + 1);
    }
    docs = (preChunked ? Array.isArray(data.docs) ? data.docs : [] : documents).map((doc) => ({
      id: doc.id,
      title: doc.title,
      file: doc.file,
      order: doc.order,
      summary: doc.summary,
      chunkCount: chunkCounts.get(doc.id) ?? 0,
    }));
    chunks = chunkList;
    store = createStore({ chunks: chunkList, embedder });
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

  /** 仅检索：结构与 POST /api/retrieve 一致（逐行对齐 rag/index.js） */
  async function retrieve(query, opts = {}) {
    const started = now();
    const text = String(query ?? '').trim();
    const topK = normalizeTopK(opts.topK, defaultTopK);
    const mode = ['hybrid', 'vector', 'keyword'].includes(opts.mode) ? opts.mode : 'hybrid';
    const steps = [];

    let stageStart = now();
    const analysis = store.analyze(text);
    steps.push({
      key: 'analyze',
      name: '查询理解',
      ms: roundMs(now() - stageStart),
      detail: `去停用词后得到 ${analysis.tokens.length} 个检索词`,
    });

    stageStart = now();
    const queryVector = embedder.embed(analysis.tokens.map((token) => token.term).join(' '));
    steps.push({
      key: 'embed',
      name: '向量化',
      ms: roundMs(now() - stageStart),
      detail: `hash-embedding · dim=${embedder.dim}`,
    });

    stageStart = now();
    const vectorRank = store.vectorRank(queryVector);
    steps.push({
      key: 'vector',
      name: '向量召回',
      ms: roundMs(now() - stageStart),
      detail: `余弦相似度 · ${store.size} 个块`,
    });

    stageStart = now();
    const keywordRank = store.keywordRank(analysis.tokens);
    steps.push({
      key: 'keyword',
      name: '关键词召回',
      ms: roundMs(now() - stageStart),
      detail: `BM25 · ${store.size} 个块`,
    });

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

  rebuild();

  return {
    stats,
    snapshot,
    retrieve,
    buildPrompt,
    embedding: embeddingInfo(),
    embedder: { ...embeddingInfo(), embed: embedder.embed },
    /** 构建元信息（浏览器模式调试/展示用） */
    info: {
      version: data.version || '0.1.0',
      generatedAt: data.generatedAt || null,
      source: data.source || 'kb/*.md',
      kbUrl,
    },
    defaultTopK,
    dim: embedder.dim,
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
