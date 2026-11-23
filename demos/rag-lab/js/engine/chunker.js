/**
 * chunker.js —— 标题感知切块。
 *
 * 为什么要标题感知？
 * 客服知识库每个 `##` 小节是一个独立主题（七天无理由 / 发票重开…），
 * 按小节切出来的块语义聚焦，检索时命中率明显高于机械按长度切。
 *
 * 参数目标（中文按字数）：
 *   - 每块 180~450 字：太短噪声多，太长会稀释向量、也浪费 prompt token；
 *   - 同小节相邻块保留 60~100 字重叠：避免答案刚好被切在边界时检索不到；
 *   - chunk.id 严格是 `${docId}#${序号}`，序号从 0 开始、按文档内顺序递增，
 *     重叠只是文本前缀，不影响 id 生成，所以 id 不会乱。
 */
import { countChars, estimateTokens } from './util.js';

export const CHUNK_MAX_CHARS = 450;
export const CHUNK_MIN_CHARS = 180;
export const CHUNK_OVERLAP_CHARS = 80;
const OVERLAP_MAX_SEARCH = 20; // 在 80~100 字窗口里找句号，保证重叠长度落在 60~100

/**
 * @param {Array} docs loader 产出的文档（含 sections）
 * @returns {Array<{id,docId,docTitle,section,text,tokens,chars,order}>}
 */
export function chunkDocuments(docs = []) {
  const chunks = [];
  for (const doc of docs) {
    const docChunks = [];
    for (const section of doc.sections || []) {
      const bodies = chunkSection(section.text);
      let previous = '';
      for (const body of bodies) {
        // 同小节内：给后续块加前一块的句尾作为重叠，跨小节不加（section 语义已变）
        const overlap = previous ? takeOverlap(previous) : '';
        const text = overlap ? `${overlap}${body}` : body;
        const order = docChunks.length;
        docChunks.push({
          id: `${doc.id}#${order}`,
          docId: doc.id,
          docTitle: doc.title,
          section: section.heading,
          text,
          tokens: estimateTokens(text),
          chars: countChars(text),
          order,
        });
        previous = body;
      }
    }
    chunks.push(...docChunks);
  }
  return chunks;
}

/** 把一个小节切成若干块（返回纯正文，重叠在 chunkDocuments 里统一加） */
export function chunkSection(text) {
  const blocks = splitBlocks(text);
  if (!blocks.length) return [];

  // 先把超长段落按句子拆开，保证打包最小单元能被预算装下
  const units = [];
  for (const block of blocks) {
    if (countChars(block) <= CHUNK_MAX_CHARS) {
      units.push(block);
      continue;
    }
    for (const sentence of splitSentences(block)) {
      if (countChars(sentence) <= CHUNK_MAX_CHARS) {
        units.push(sentence);
      } else {
        // 极端情况：一句话超过一块长度，硬切
        let rest = sentence;
        while (countChars(rest) > CHUNK_MAX_CHARS) {
          const [head, tail] = hardSplit(rest, CHUNK_MAX_CHARS);
          units.push(head);
          rest = tail;
        }
        if (rest) units.push(rest);
      }
    }
  }

  const bodies = [];
  let buffer = [];
  let bufferLen = 0;
  let isFirst = true;

  // 非首块要额外腾出重叠长度的预算，保证「正文 + 重叠」仍然 <= 450
  const budget = () =>
    isFirst ? CHUNK_MAX_CHARS : CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS - OVERLAP_MAX_SEARCH;

  const flush = () => {
    if (!buffer.length) return;
    bodies.push(buffer.join('\n\n'));
    buffer = [];
    bufferLen = 0;
    isFirst = false;
  };

  for (const unit of units) {
    let rest = unit;
    while (rest) {
      const limit = budget();
      const need = bufferLen > 0 ? bufferLen + 2 + countChars(rest) : countChars(rest);
      if (need > limit && bufferLen > 0) {
        flush(); // 装不下：先收掉当前块，剩余部分在更小的新预算里重新尝试
        continue;
      }
      if (countChars(rest) > limit) {
        const [head, tail] = hardSplit(rest, limit);
        buffer.push(head);
        bufferLen += (bufferLen > 0 ? 2 : 0) + countChars(head);
        flush();
        rest = tail;
        continue;
      }
      buffer.push(rest);
      bufferLen += (bufferLen > 0 ? 2 : 0) + countChars(rest);
      rest = '';
    }
  }
  flush();
  return bodies;
}

/**
 * 取上一块句尾作为重叠文本。
 * 从结尾往前 100 字的窗口里找句号/换行，尽量从句子边界开始，读起来不突兀。
 * 兜底固定取最后 80 字，保证重叠长度稳定落在 60~100。
 */
export function takeOverlap(previousText) {
  const chars = [...String(previousText ?? '')];
  const length = chars.length;
  if (!length) return '';
  const maxStart = Math.max(0, length - CHUNK_OVERLAP_CHARS); // 最后 80 字的起点
  const minStart = Math.max(0, length - CHUNK_OVERLAP_CHARS - OVERLAP_MAX_SEARCH);
  for (let i = maxStart; i >= minStart; i--) {
    if ('。！？；!?;\n'.includes(chars[i])) {
      const overlap = chars.slice(i + 1).join('').replace(/^\s+/, '');
      if (overlap.length >= 60 && overlap.length <= 100) return overlap;
      break;
    }
  }
  return chars.slice(Math.max(0, length - CHUNK_OVERLAP_CHARS)).join('');
}

/** 按空行拆段落；列表的每一行会被当作独立行保留在段落里 */
export function splitBlocks(text) {
  const blocks = [];
  let buffer = [];
  const flush = () => {
    const block = buffer.join('\n').trim();
    if (block) blocks.push(block);
    buffer = [];
  };
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (line.trim()) buffer.push(line.replace(/\s+$/, ''));
    else flush();
  }
  flush();
  return blocks;
}

/** 按中文/英文句末标点与换行拆句（保留标点） */
export function splitSentences(text) {
  const sentences = [];
  let buffer = '';
  for (const ch of String(text ?? '')) {
    buffer += ch;
    if ('。！？；!?;\n'.includes(ch)) {
      const sentence = buffer.trim();
      if (sentence) sentences.push(sentence);
      buffer = '';
    }
  }
  const tail = buffer.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** 超长句子硬切：优先在切点附近 60 字内的标点处断开 */
function hardSplit(text, maxChars) {
  const chars = [...text];
  if (chars.length <= maxChars) return [text, ''];
  let cut = maxChars;
  for (let i = maxChars - 1; i >= Math.max(0, maxChars - 60); i--) {
    if ('。！？；!?;'.includes(chars[i])) {
      cut = i + 1;
      break;
    }
  }
  return [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
}
