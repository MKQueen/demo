/**
 * loader.js —— 读取 kb/*.md，解析成结构化文档（标题 / 小节 / 摘要）。
 *
 * 文件约定：`01-退换货政策.md`，序号决定展示顺序。
 * doc.id 用「文件名去掉序号和扩展名」，这样前端可以直接用 `退换货政策#3` 这种块 id。
 * kbDir 不存在或为空时返回空数组——必须允许 server 在知识库还没准备好时照常启动。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const MD_RE = /\.md$/i;
const NUMBER_PREFIX_RE = /^\d+\s*[-_.、]?\s*/;

/**
 * @param {string} kbDir 知识库目录
 * @returns {Promise<Array<{id,title,file,order,summary,sections}>>}
 */
export async function loadDocuments(kbDir) {
  if (!kbDir) return [];
  let entries;
  try {
    entries = await fs.readdir(kbDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return []; // kb 目录还没建：空知识库，不报错
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && MD_RE.test(entry.name) && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort(compareKbFiles);

  const docs = [];
  for (const file of files) {
    let raw;
    try {
      raw = await fs.readFile(path.join(kbDir, file), 'utf8');
    } catch {
      continue; // 单个文件读失败不影响整个知识库
    }
    const doc = parseMarkdown(raw, file, docs.length + 1);
    if (doc) docs.push(doc);
  }
  return docs;
}

/** 先按文件名里的序号排，再按文件名兜底（不依赖 locale，保证跨环境一致） */
function compareKbFiles(a, b) {
  const orderA = leadingOrder(a);
  const orderB = leadingOrder(b);
  if (orderA !== orderB) return orderA - orderB;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function leadingOrder(file) {
  const match = /^(\d+)/.exec(file);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/** 文件名去掉扩展名与序号：`01-退换货政策.md` -> `退换货政策` */
export function filenameTitle(file) {
  const base = path.basename(String(file ?? '')).replace(MD_RE, '');
  const stripped = base.replace(NUMBER_PREFIX_RE, '').trim();
  return stripped || base;
}

/**
 * 解析一篇 markdown：
 * - 可选 front-matter（--- 包起来的 title / summary / order）；
 * - `#` 是文档标题，只用于 doc.title；
 * - `##` 是小节标题，切块时作为 chunk.section。
 */
export function parseMarkdown(raw, file, fallbackOrder = 1) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '');
  const { attrs, body } = splitFrontMatter(text);
  const { h1, sections } = parseBody(body);
  const fileTitle = filenameTitle(file);
  const order = Number(attrs.order) || leadingOrder(file) || fallbackOrder;

  return {
    id: fileTitle,
    title: cleanInline(attrs.title) || h1 || fileTitle,
    file: path.basename(String(file ?? '')),
    order: Number.isFinite(order) ? order : fallbackOrder,
    summary: cleanInline(attrs.summary) || deriveSummary(sections),
    sections,
  };
}

function splitFrontMatter(text) {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { attrs: {}, body: text };
  const attrs = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) attrs[key] = value;
  }
  return { attrs, body: text.slice(match[0].length) };
}

function parseBody(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const rawSections = [];
  let current = { heading: '', lines: [] };
  let h1 = '';
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      current.lines.push(line);
      continue;
    }
    if (inFence) {
      current.lines.push(line);
      continue;
    }
    const h2 = /^##[ \t]+(.+?)[ \t]*#*$/.exec(trimmed);
    if (h2) {
      rawSections.push(current);
      current = { heading: h2[1].trim(), lines: [] };
      continue;
    }
    const h1Match = /^#[ \t]+(.+?)[ \t]*#*$/.exec(trimmed);
    if (h1Match) {
      if (!h1) h1 = h1Match[1].trim(); // 文档级标题不进正文（避免和 section 重复）
      continue;
    }
    current.lines.push(line);
  }
  rawSections.push(current);

  const hasHeadings = rawSections.length > 1;
  const sections = rawSections
    .map((section, index) => ({
      // 第一个 `##` 之前的导语统一叫「概述」，避免前端出现空 section
      heading: section.heading || (hasHeadings && index === 0 ? '概述' : '正文'),
      text: section.lines.join('\n').trim(),
    }))
    .filter((section) => section.text.length > 0);

  return { h1, sections };
}

/** 摘要：优先 front-matter，否则取第一段正文，截断 90 字 */
function deriveSummary(sections) {
  const first = sections[0];
  if (!first) return '';
  const paragraph = first.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!paragraph) return '';
  const plain = cleanInline(paragraph.replace(/^[-*+]\s+/, '').replace(/^\d+[.)、]\s*/, ''));
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

/** 去掉 markdown 行内记号（**粗体**、`代码`、[文字](链接)），展示更干净 */
export function cleanInline(value) {
  return String(value ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}
