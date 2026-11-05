/**
 * embedder.js —— 本地确定性哈希向量（默认 8192 维，可用 dim 覆盖）。
 *
 * 做法（和教学 PPT 里的公式一一对应）：
 *   1. 分词：中文相邻两字 bigram + 英文/数字单词（tokenize）；
 *   2. 特征哈希：FNV-1a 把 token 映射到某个维度，哈希最高位决定 +1 / -1（signed hashing），
 *      —— 带符号是为了让不同 token 的贡献可以相互抵消，减少哈希冲突带来的虚假相似；
 *   3. 词频用 sublinear TF：weight = 1 + log(tf)，避免一个词重复 10 次就压过其他词；
 *   4. L2 归一化后，向量点积就是余弦相似度。
 *
 * 全程没有随机数、不依赖模型服务：同样的文本永远得到同样的向量（散点图可复现的前提）。
 * 若以后要接 OpenAI 兼容的 /embeddings，只要保持 embed 接口不变即可替换。
 */
import { hashToken, tokenize } from './util.js';

export const DEFAULT_DIM = 8192;
export const EMBEDDING_MODE = 'hash';
export const EMBEDDING_NOTE = '本地哈希向量（字符 bigram + 签名哈希 + 句子级 max-pool）';

/**
 * @param {{dim?: number}} [options]
 * @returns {{dim, mode, note, embed(text): Float64Array}}
 */
export function createEmbedder({ dim = DEFAULT_DIM } = {}) {
  // 8192 维足够让「字符 bigram 特征哈希」的碰撞噪声低于真实信号；
  // 维度太低（如 256）时长块里上百个 bigram 会在少数桶里正负抵消，余弦基本是噪声。
  const safeDim = Math.max(64, Math.min(16384, Math.floor(Number(dim) || DEFAULT_DIM)));

  function embed(text) {
    const vector = new Float64Array(safeDim);

    // 先统计词频，再统一累加：同一个 token 只做一次哈希
    const tf = new Map();
    for (const term of tokenize(text)) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }

    for (const [term, count] of tf) {
      const { index, sign } = hashToken(term, safeDim);
      vector[index] += sign * (1 + Math.log(count)); // sublinear TF
    }

    let norm = 0;
    for (let i = 0; i < safeDim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < safeDim; i++) vector[i] /= norm;
    }
    return vector;
  }

  return {
    dim: safeDim,
    mode: EMBEDDING_MODE,
    note: EMBEDDING_NOTE,
    embed,
  };
}

/** 两个已归一化向量的余弦相似度；零向量返回 0 */
export function cosineSimilarity(a, b) {
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
