/**
 * store.js —— 向量存储与检索：余弦 top-k、BM25、RRF 融合、PCA 二维投影。
 *
 * 为什么不把向量与倒排索引写进两个类？
 * 教学 Demo 的数据量（几十上百块）用「数组 + Map」足够，保持一个文件能读完整个召回链路：
 *   向量召回 = 余弦相似度排序；
 *   关键词召回 = BM25 排序；
 *   融合重排 = RRF（Reciprocal Rank Fusion，k=60）把两份排名合并——
 *   只依赖名次、不依赖原始分数量纲，是最容易解释的融合方式。
 * PCA 用幂迭代从所有 chunk 向量算前两个主成分，全程无随机数，保证投影可复现。
 */
import { splitSentences } from './chunker.js';
import { analyzeQuery, clamp, countChars, normalizeText, round, tokenize } from './util.js';

export const RRF_K = 60;
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

/** RRF：score = Σ 1/(k + rank)，rank 从 1 开始；入参是若干条「按相关度降序」的下标数组 */
export function rrfFuse(rankedLists, k = RRF_K) {
  const fused = new Map();
  for (const list of rankedLists) {
    for (let i = 0; i < list.length; i++) {
      const key = list[i];
      fused.set(key, (fused.get(key) ?? 0) + 1 / (k + i + 1));
    }
  }
  return fused;
}

/** 两个向量的余弦相似度（embeddings 已 L2 归一化，但仍做通用实现兜底） */
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

/**
 * @param {{chunks: Array, embedder: {dim:number, embed:(text:string)=>Float64Array}}} options
 */
export function createStore({ chunks = [], embedder }) {
  const dim = embedder.dim;
  const prepared = prepareChunks(chunks, embedder);
  const total = prepared.length;

  // BM25 需要文档频率与平均长度
  const docFreq = new Map();
  let totalLength = 0;
  for (const chunk of prepared) {
    totalLength += chunk.tokenCount;
    for (const term of chunk.tf.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }
  const avgLength = total > 0 ? totalLength / total : 0;

  // 全量向量做一次 PCA，之后查询点复用同一套主成分
  const projection = computeProjection(prepared.map((chunk) => chunk.embedding), dim);

  function analyze(query) {
    return analyzeQuery(query);
  }

  /**
   * 向量召回：余弦分降序，返回全部块（后续按模式截断）。
   * 打分 = 0.5 × 整块余弦 + 0.5 × 最相关句子的余弦：
   * 短 query 匹配 300~450 字的长块时，整块向量会被大量无关 token 稀释，
   * 句子级 max-pool 能把「块里正好有一句高度相关」这种情况救回来。
   */
  function vectorRank(queryVector) {
    let norm = 0;
    for (let i = 0; i < queryVector.length; i++) norm += queryVector[i] * queryVector[i];
    if (norm === 0) return []; // 空查询没有方向
    return prepared
      .map((chunk, index) => ({ index, score: chunkVectorScore(queryVector, chunk) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }

  /** 关键词召回：BM25(k1=1.5, b=0.75) 原始分降序 */
  function keywordRank(tokens) {
    const terms = [];
    const seen = new Set();
    for (const token of tokens || []) {
      const term = typeof token === 'string' ? token : token?.term;
      if (!term || seen.has(term)) continue;
      seen.add(term);
      terms.push(term);
    }
    if (!terms.length || total === 0) return [];

    const idfCache = new Map();
    return prepared
      .map((chunk, index) => {
        let score = 0;
        for (const term of terms) {
          const tf = chunk.tf.get(term);
          if (!tf) continue;
          let idf = idfCache.get(term);
          if (idf === undefined) {
            const df = docFreq.get(term) ?? 0;
            idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
            idfCache.set(term, idf);
          }
          const norm = BM25_K1 * (1 - BM25_B + (BM25_B * chunk.tokenCount) / (avgLength || 1));
          score += (idf * tf * (BM25_K1 + 1)) / (tf + norm);
        }
        return { index, score };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }

  /**
   * 组装命中结果：把三路分数都归一化到 0~1 给前端画分数条。
   * - scores.vector：余弦分（带符号哈希可能算出负余弦，展示时截到 0）
   * - scores.keyword：BM25 除以本次查询最大值，归一化到 0~1
   * - scores.fused：当前模式的排序分（hybrid 用 RRF 再除以最大值）
   */
  function fuse({ queryInfo, vectorRank: vectorRanked, keywordRank: keywordRanked, mode = 'hybrid', topK = 6 }) {
    const limit = Math.max(1, Math.floor(Number(topK) || 6));
    if (total === 0) return [];

    const vectorRaw = new Map();
    for (const item of vectorRanked) vectorRaw.set(item.index, item.score);
    const keywordRaw = new Map();
    let maxKeyword = 0;
    for (const item of keywordRanked) {
      keywordRaw.set(item.index, item.score);
      if (item.score > maxKeyword) maxKeyword = item.score;
    }

    const vectorNorm = (index) => clamp(vectorRaw.get(index) ?? 0, 0, 1);
    const keywordNorm = (index) => (maxKeyword > 0 ? clamp((keywordRaw.get(index) ?? 0) / maxKeyword, 0, 1) : 0);

    let ranked;
    if (mode === 'keyword') {
      ranked = keywordRanked
        .filter((item) => item.score > 0)
        .slice(0, limit)
        .map((item) => ({ index: item.index, fused: keywordNorm(item.index) }));
    } else if (mode === 'vector') {
      ranked = vectorRanked
        .filter((item) => item.score > 1e-9)
        .slice(0, limit)
        .map((item) => ({ index: item.index, fused: vectorNorm(item.index) }));
    } else {
      // hybrid：两条召回列表做 RRF，再按融合分归一化。
      // 向量列表保留全量排名（RRF 只看名次，负余弦≈最不相关也会排在最后），
      // 关键词列表只保留 BM25>0 的块（没命中词不应该白拿名次分）。
      const lists = [
        vectorRanked.map((item) => item.index),
        keywordRanked.filter((item) => item.score > 0).map((item) => item.index),
      ];
      const fusedRaw = rrfFuse(lists);
      const candidates = [];
      for (let index = 0; index < total; index++) {
        const raw = fusedRaw.get(index);
        if (!raw) continue;
        candidates.push({ index, raw, vector: vectorRaw.get(index) ?? 0, keyword: keywordRaw.get(index) ?? 0 });
      }
      candidates.sort(
        (a, b) => b.raw - a.raw || b.vector - a.vector || b.keyword - a.keyword || a.index - b.index,
      );
      ranked = candidates.slice(0, limit);
      const maxFused = candidates[0]?.raw ?? 0;
      for (const item of ranked) item.fused = maxFused > 0 ? item.raw / maxFused : 0;
    }

    return ranked.map((item, position) => {
      const chunk = prepared[item.index];
      return {
        chunkId: chunk.id,
        docId: chunk.docId,
        docTitle: chunk.docTitle,
        section: chunk.section,
        text: chunk.text,
        rank: position + 1,
        scores: {
          vector: round(vectorNorm(item.index), 3),
          keyword: round(keywordNorm(item.index), 3),
          fused: round(clamp(item.fused, 0, 1), 3),
        },
        matchedTerms: matchedTerms(chunk, queryInfo),
      };
    });
  }

  /** 查询向量投到同一 PCA 空间（范围截到 [-1,1]，方便 canvas 直接画） */
  function project(queryVector) {
    return projection.project(queryVector);
  }

  /** 散点图数据：每个 chunk 一条 {chunkId, docId, x, y} */
  function projectionPoints() {
    return prepared.map((chunk, index) => ({
      chunkId: chunk.id,
      docId: chunk.docId,
      ...projection.points[index],
    }));
  }

  /** 某个词在多少块里出现过（matchedTerms 的重要性排序用） */
  function chunkFrequency(term) {
    let count = 0;
    for (const chunk of prepared) if (chunk.haystack.includes(term)) count++;
    return count;
  }

  /**
   * 命中词：取查询 token 中「真实出现在该块正文里」的部分，
   * 再把相邻/重叠的 token 合并成连续片段（例如 无理+理由+由退+退货 -> 无理由退货），
   * 按「片段长度 × IDF」排重要性，最多 6 个。
   * 只对照 chunk.text，保证前端拿到的高亮词一定能在卡片正文里找到。
   */
  function matchedTerms(chunk, queryInfo) {
    const rawTokens = queryInfo?.rawTokens ?? [];
    const query = queryInfo?.normalized ?? '';
    const text = normalizeText(chunk.text);
    if (!rawTokens.length || !text) return [];

    const matched = rawTokens.filter((token) => text.includes(token.term));
    if (!matched.length) return [];

    const spans = [];
    for (const token of matched) {
      const last = spans[spans.length - 1];
      if (last && token.start <= last.end) {
        const candidate = query.slice(last.start, token.end);
        if (text.includes(candidate)) {
          last.end = token.end;
          continue;
        }
      }
      spans.push({ start: token.start, end: token.end });
    }

    const seen = new Set();
    const scored = [];
    for (const span of spans) {
      const term = query.slice(span.start, span.end);
      if (!term || countChars(term) < 2 || seen.has(term)) continue;
      seen.add(term);
      const df = chunkFrequency(term);
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      scored.push({ term, start: span.start, importance: countChars(term) * (1 + idf) });
    }
    scored.sort((a, b) => b.importance - a.importance || a.start - b.start);
    return scored.slice(0, 6).map((item) => item.term);
  }

  return {
    dim,
    chunks: prepared,
    size: total,
    analyze,
    vectorRank,
    keywordRank,
    fuse,
    project,
    projectionPoints,
  };
}

/** 句子太短（如 "注意："）当不了检索锚点，不参与 max-pool */
const MIN_SENTENCE_CHARS = 4;

/** 单位向量点积即余弦；用点积省掉每次重复算模长 */
function chunkVectorScore(queryVector, chunk) {
  const whole = dot(queryVector, chunk.embedding);
  let maxSentence = -Infinity;
  for (const sentenceVector of chunk.sentenceVectors) {
    const similarity = dot(queryVector, sentenceVector);
    if (similarity > maxSentence) maxSentence = similarity;
  }
  return chunk.sentenceVectors.length ? 0.5 * whole + 0.5 * maxSentence : whole;
}

function prepareChunks(chunks, embedder) {
  return chunks.map((chunk) => {
    // BM25 用「小节标题 + 正文」；向量额外把小节标题重复一次（权重 ×2）：
    // 小节标题往往就是用户 query 里的词（"七天无理由退货"），值得放大。
    const searchText = `${chunk.section}\n${chunk.text}`;
    const embeddingText = `${chunk.section}\n${chunk.section}\n${chunk.text}`;
    const haystack = normalizeText(searchText);
    const tf = new Map();
    let tokenCount = 0;
    for (const term of tokenize(searchText)) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
      tokenCount++;
    }

    // 句子级向量：短 query 匹配长块时整块向量会被稀释，逐句算相似度再取 max
    const sentenceVectors = [];
    for (const sentence of splitSentences(chunk.text)) {
      const text = sentence.trim();
      if (countChars(text) >= MIN_SENTENCE_CHARS) sentenceVectors.push(embedder.embed(text));
    }

    return {
      ...chunk,
      searchText,
      haystack,
      tf,
      tokenCount,
      embedding: embedder.embed(embeddingText),
      sentenceVectors,
    };
  });
}

/**
 * PCA：用幂迭代从所有 chunk 向量求前 2 个主成分，投影到二维。
 * 为了在维度较高时也够快，不显式构造 d×d 协方差矩阵，而是用 Gram 技巧：
 *   C·v = Σ x_i (x_i · v)
 * 即可在 O(n·d) 内完成一次幂迭代；第二主成分每轮再对第一主成分正交化。
 * 初始向量是确定性序列（不用随机数），收敛后统一符号，保证同样输入永远同样输出。
 */
export function computeProjection(vectors, dim) {
  const n = vectors.length;
  const zero = { points: [], project: () => ({ x: 0, y: 0 }) };
  if (!n || !dim) return zero;

  // 中心化：PCA 的均值应来自数据本身
  const mean = new Float64Array(dim);
  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += vector[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= n;
  const centered = vectors.map((vector) => {
    const result = new Float64Array(dim);
    for (let i = 0; i < dim; i++) result[i] = vector[i] - mean[i];
    return result;
  });

  const pc1 = dominantComponent(centered, dim, null, 0);
  const pc2 = pc1 ? dominantComponent(centered, dim, pc1.vector, 1) : null;
  if (!pc1) {
    return {
      points: vectors.map(() => ({ x: 0, y: 0 })),
      project: () => ({ x: 0, y: 0 }),
    };
  }

  const raw = centered.map((vector) => ({
    x: dot(vector, pc1.vector),
    y: pc2 ? dot(vector, pc2.vector) : 0,
  }));
  const scaleX = scaleFor(raw.map((point) => point.x));
  const scaleY = pc2 ? scaleFor(raw.map((point) => point.y)) : 0;

  return {
    points: raw.map((point) => ({
      x: round(point.x * scaleX, 3),
      y: round(point.y * scaleY, 3),
    })),
    project(queryVector) {
      if (!queryVector) return { x: 0, y: 0 };
      let norm = 0;
      for (let i = 0; i < dim; i++) norm += queryVector[i] * queryVector[i];
      if (norm === 0) return { x: 0, y: 0 }; // 空查询没有方向，落在原点
      const centeredQuery = new Float64Array(dim);
      for (let i = 0; i < dim; i++) centeredQuery[i] = queryVector[i] - mean[i];
      const x = dot(centeredQuery, pc1.vector) * scaleX;
      const y = (pc2 ? dot(centeredQuery, pc2.vector) : 0) * scaleY;
      return { x: round(clamp(x, -1, 1), 3), y: round(clamp(y, -1, 1), 3) };
    },
  };
}

/** 找绝对值最大值并缩放，使整体落在约 [-1,1]（数据完全退化时返回 0，避免放大浮点噪声） */
function scaleFor(values) {
  let maxAbs = 0;
  for (const value of values) {
    const abs = Math.abs(value);
    if (abs > maxAbs) maxAbs = abs;
  }
  return maxAbs > 1e-9 ? 1 / maxAbs : 0;
}

function dominantComponent(vectors, dim, orthogonalTo, seed) {
  const vector = new Float64Array(dim);
  // 确定性的「不规则」初始向量：避免所有分量相同导致某些对称数据迭代停滞
  for (let i = 0; i < dim; i++) {
    vector[i] = 1 + ((i * 37 + seed * 101) % 17) / 17;
  }
  if (!normalizeInPlace(vector)) return null;

  const next = new Float64Array(dim);
  for (let iter = 0; iter < 80; iter++) {
    next.fill(0);
    // C·v = Σ x_i (x_i·v)
    for (const vectorX of vectors) {
      let projection = 0;
      for (let i = 0; i < dim; i++) projection += vectorX[i] * vector[i];
      for (let i = 0; i < dim; i++) next[i] += vectorX[i] * projection;
    }
    if (orthogonalTo) {
      const overlap = dot(next, orthogonalTo);
      for (let i = 0; i < dim; i++) next[i] -= overlap * orthogonalTo[i];
    }
    if (!normalizeInPlace(next)) return null;
    vector.set(next);
  }

  // 统一符号：最大绝对值分量取正，保证主成分方向唯一
  let pivot = 0;
  for (let i = 1; i < dim; i++) {
    if (Math.abs(vector[i]) > Math.abs(vector[pivot])) pivot = i;
  }
  if (vector[pivot] < 0) {
    for (let i = 0; i < dim; i++) vector[i] = -vector[i];
  }

  let eigenvalue = 0;
  for (const vectorX of vectors) {
    const projection = dot(vectorX, vector);
    eigenvalue += projection * projection;
  }
  return { vector, eigenvalue };
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function normalizeInPlace(vector) {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm < 1e-12) return false;
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  return true;
}
