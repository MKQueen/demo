/**
 * util.js —— RAG 内核的公共小工具：文本归一化、分词、哈希、token 估算。
 *
 * 为什么不用第三方分词器？
 * 这是零依赖教学 Demo，中文用「字符 bigram（相邻两个字）」当检索词：
 *   - 不需要词典，用户口语化提问也能命中（"怎么退" 会切成 怎么/么退/退…）；
 *   - 完全确定性，同一段文本永远得到同一组 token，向量可复现。
 * 副作用是会切出 "天无" 这种跨词边界的 bigram，所以查询侧再去掉含虚词的 bigram。
 */

/** 中文虚词：查询分析时，含这些字的 bigram 基本是噪声（怎么/可以/了吗…），直接丢弃 */
const CJK_STOP_CHARS = new Set(
  '的了吗呢吧啊呀哦嗯么什怎如何哪谁几多少我你他她它们是有能可以会要想需请帮问说这那个把被让给对从向在就都也还又很太'.split(
    '',
  ),
);

/** 英文停用词：只在查询侧过滤，文档侧保留原样（BM25 需要真实词频） */
const ASCII_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'be', 'of', 'to', 'in', 'on', 'for',
  'and', 'or', 'with', 'how', 'what', 'can', 'could', 'should', 'do', 'does',
  'did', 'i', 'my', 'me', 'we', 'you', 'your', 'it', 'this', 'that', 'please',
  'about', 'from',
]);

const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const ASCII_WORD_CHAR_RE = /[a-z0-9]/;

/** 是否 CJK 汉字（覆盖常用扩展区，足够客服知识库使用） */
export function isCjkChar(ch) {
  return typeof ch === 'string' && ch.length === 1 && CJK_CHAR_RE.test(ch);
}

/**
 * 文本归一化：NFKC（全角转半角）+ 小写 + 压缩空白。
 * 归一化只用于「检索」，展示给用户的原文不会被改动。
 */
export function normalizeText(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 分词：CJK 连续段切相邻两字 bigram，ASCII 字母数字段切成单词。
 * 位置信息（start/end）用于在查询里拼出连续的命中片段（matchedTerms）。
 *
 * @returns {{ term: string, start: number, end: number }[]}
 */
export function tokenizeWithPositions(text) {
  const normalized = normalizeText(text);
  const out = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (isCjkChar(ch)) {
      let j = i;
      while (j < normalized.length && isCjkChar(normalized[j])) j++;
      const run = normalized.slice(i, j);
      if (run.length === 1) {
        // 单独一个字（前后是标点/空格）没法组成 bigram，保底留一个单字 token
        out.push({ term: run, start: i, end: i + 1 });
      }
      for (let k = 0; k + 1 < run.length; k++) {
        out.push({ term: run.slice(k, k + 2), start: i + k, end: i + k + 2 });
      }
      i = j;
    } else if (ASCII_WORD_CHAR_RE.test(ch)) {
      let j = i;
      while (j < normalized.length && ASCII_WORD_CHAR_RE.test(normalized[j])) j++;
      out.push({ term: normalized.slice(i, j), start: i, end: j });
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** 只要 token 文本（embedder / BM25 文档侧使用） */
export function tokenize(text) {
  return tokenizeWithPositions(text).map((item) => item.term);
}

/** 查询侧停用词判断：CJK bigram 含虚词、英文停用词都算噪声 */
export function isStopToken(term) {
  if (!term) return true;
  if (/^[a-z0-9]+$/.test(term)) return ASCII_STOPWORDS.has(term);
  for (const ch of term) {
    if (CJK_STOP_CHARS.has(ch)) return true;
  }
  return false;
}

/** 按出现顺序去重 */
function uniqueTerms(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.term)) continue;
    seen.add(item.term);
    out.push(item.term);
  }
  return out;
}

/**
 * 查询理解：得到检索 token（去停用词）与给前端展示的 keywordTerms。
 * 若整句都是 "怎么办" 这类虚词，则退回未过滤的原始 token，避免检索词为空。
 */
export function analyzeQuery(query) {
  const normalized = normalizeText(query);
  const rawTokens = tokenizeWithPositions(normalized);
  const kept = rawTokens.filter((item) => !isStopToken(item.term));
  const tokens = kept.length ? kept : rawTokens;
  return {
    normalized,
    rawTokens,
    tokens,
    keywordTerms: uniqueTerms(tokens).slice(0, 8),
  };
}

/**
 * token 估算（不引入 tiktoken，教学 Demo 追求可解释）：
 * 中文约 1 token / 1.5 字，英文约 1 token / 4 字符，空白不计。
 */
export function estimateTokens(text) {
  const value = String(text ?? '');
  if (!value) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of value) {
    if (isCjkChar(ch)) cjk += 1;
    else if (!/\s/.test(ch)) other += 1;
  }
  return Math.max(1, Math.round(cjk / 1.5 + other / 4));
}

/** FNV-1a 32 位哈希：快、零依赖、实现可读，做特征哈希足够用 */
export function fnv1a(input, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 把 token 映射到 [0, dim) 的桶，并取哈希最高位决定符号（signed hashing） */
export function hashToken(term, dim) {
  const hash = fnv1a(term);
  return {
    index: hash % dim,
    sign: (hash >>> 31) === 0 ? 1 : -1,
  };
}

/** 保留 digits 位小数（展示用，避免浮点长尾） */
export function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 毫秒耗时保留 1 位小数 */
export function roundMs(value) {
  return Math.round(value * 10) / 10;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 统一的高精度计时入口（Node 有 performance，兜底 Date.now） */
export function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/** 按字符（码点）计数，中文 1 个字算 1 */
export function countChars(text) {
  return [...String(text ?? '')].length;
}
