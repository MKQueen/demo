/**
 * prompt.js —— 把检索结果拼成「可解释」的 prompt，并给出 token 估算。
 *
 * 三块预算：
 *   system  —— 角色与规则（固定文案，便于前端展示「为什么这么回答」）；
 *   context —— top-k 知识库片段，带 [1] [2] 标记和《文档标题》· 小节；
 *   history —— 最近若干轮对话，按 token 预算从后往前保留。
 * token 计数用 util.estimateTokens 的可解释规则（中文 1 token / 1.5 字，英文 1 token / 4 字符），
 * 不引入 tokenizer 依赖；这是教学 Demo，口径一致比绝对精确更重要。
 */
import { estimateTokens } from './util.js';

/** 只依据知识库回答——这是客服场景最关键的约束，必须写死在 system 里 */
export const SYSTEM_PROMPT = [
  '你是「云岭商城」的在线客服助手，负责依据知识库回答用户的售前与售后问题。',
  '',
  '回答规则：',
  '1. 只依据下方【知识库片段】中的内容回答，不要使用片段以外的常识，也不要编造政策、时效、金额或条件。',
  '2. 如果片段里没有能回答问题的内容，直接说明暂时查不到相关信息，并建议用户转人工客服，不要猜测。',
  '3. 引用片段中的信息时，在句末用 [n] 标注来源编号，例如「7 天无理由退货 [1]」。',
  '4. 回答先给结论，再给操作步骤；简洁、分点，不要复述用户的问题。',
  '5. 不要向用户提及「片段」「知识库」等内部概念（[n] 引用标记除外）。',
  '6. 直接从给用户的答复正文开始写，不要输出任何分析过程、草稿、标题或「用户问：」之类的字样。',
  '7. 不要用 Markdown 标题和代码块，用短句与分点即可；结尾可以补一句「如需帮助可转人工客服」。',
].join('\n');

export const HISTORY_MAX_MESSAGES = 8;
export const HISTORY_TOKEN_BUDGET = 800;

/**
 * @param {{hits?: Array, history?: Array<{role,content}>, question?: string}} options
 * @returns {{messages, contextBlocks, tokens}}
 */
export function buildPrompt({ hits = [], history = [], question = '' } = {}) {
  const contextBlocks = (hits || []).map((hit, index) => ({
    chunkId: hit.chunkId,
    docTitle: hit.docTitle,
    section: hit.section,
    text: hit.text,
    tokens: estimateTokens(hit.text),
    marker: `[${index + 1}]`,
  }));

  const system = SYSTEM_PROMPT;
  const keptHistory = truncateHistory(history, question);

  const messages = [
    { role: 'system', content: system },
    ...keptHistory,
    { role: 'user', content: buildUserContent(contextBlocks, question) },
  ];

  const tokens = {
    system: estimateTokens(system),
    context: contextBlocks.reduce((sum, block) => sum + block.tokens, 0),
    history: keptHistory.reduce((sum, message) => sum + estimateTokens(message.content), 0),
    total: 0,
  };
  tokens.total = tokens.system + tokens.context + tokens.history;

  return { messages, contextBlocks, tokens };
}

/** 上下文块格式：`[n] 《文档标题》· 小节` + 正文，模型看到的是带编号的证据 */
export function buildUserContent(contextBlocks, question) {
  const contextText = contextBlocks.length
    ? contextBlocks
        .map((block) => `${block.marker} 《${block.docTitle}》· ${block.section}\n${block.text}`)
        .join('\n\n')
    : '（本次没有检索到可用的知识库片段）';
  return `【知识库片段】\n${contextText}\n\n【用户问题】\n${String(question ?? '').trim()}`;
}

/**
 * 历史截断：去掉末尾那条与 question 重复的 user 消息（server 传入的 messages 含当前提问），
 * 再从最近往前累加，受「最多 8 条 / 800 token」双重限制。
 */
export function truncateHistory(history = [], question = '') {
  const items = (Array.isArray(history) ? history : [])
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user', content: message.content }));

  const normalizedQuestion = String(question ?? '').trim();
  while (items.length) {
    const last = items[items.length - 1];
    if (last.role === 'user' && (!normalizedQuestion || last.content.trim() === normalizedQuestion)) {
      items.pop(); // 当前问题会单独拼在 prompt 末尾，避免重复
      continue;
    }
    break;
  }

  const kept = [];
  let usedTokens = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (kept.length >= HISTORY_MAX_MESSAGES) break;
    const message = items[i];
    const messageTokens = estimateTokens(message.content);
    if (kept.length > 0 && usedTokens + messageTokens > HISTORY_TOKEN_BUDGET) break;
    kept.push(message);
    usedTokens += messageTokens;
  }
  kept.reverse();
  return kept;
}
