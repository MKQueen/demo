#!/usr/bin/env node
/**
 * build-static.mjs —— 生成浏览器模式 dist/（零依赖，只用 Node 内置模块）
 *
 * 产物结构（可直接丢到任意静态托管，支持 /demos/rag-lab/ 这种嵌套路径）：
 *
 *   dist/
 *   ├── index.html                  # 注入 window.__RAG_BROWSER_MODE__=true，路径全部相对
 *   ├── css/·js/                    # 浏览器模式前端（与服务端模式共用同一套页面）
 *   │   └── js/engine/              # 浏览器版 RAG 内核（从 rag/ 同步的副本 + 浏览器版 index.js）
 *   ├── kb-data.json                # 构建时用 rag/loader.js 解析 kb/*.md 得到的文档
 *   └── eval.json                   # 评测集（kb/eval.json 的副本）
 *
 * 浏览器模式只负责「本地知识库 + 检索 + Prompt 拼装」：回答由页面通过同源
 * POST /api/llm/chat/completions 转发给真实大模型生成。产物里不再包含任何离线
 * 抽取式答案 / 录制回放数据；没有模型 Key 时页面明确显示未连接，不伪造答案。
 *
 * 用法：
 *   node scripts/build-static.mjs            # 默认输出 dist/
 *   node scripts/build-static.mjs --out dist # 指定输出目录
 *   RAG_EMBED_DIM=4096 node scripts/build-static.mjs
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDocuments } from '../rag/loader.js';
import { chunkDocuments } from '../rag/chunker.js';
import { DEFAULT_DIM } from '../rag/embedder.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = path.join(ROOT, 'web');
const KB_DIR = path.join(ROOT, 'kb');
const ENGINE_DIR = path.join(WEB_DIR, 'js', 'engine');

/** 由 rag/ 单向同步到浏览器引擎的共用模块（保持一份算法实现，避免两边漂移） */
const ENGINE_MODULES = ['util', 'chunker', 'embedder', 'store', 'prompt'];

/** 旧版离线产物：不论 web/ 里是否还留着同源文件，dist 里都必须清掉 */
const STALE_DIST_PATHS = [
  'js/local-api.js',
  'js/engine/mock-answer.js',
  'css/static.css',
  'fixtures',
];

const argv = process.argv.slice(2);
const outArg = argv.includes('--out') ? String(argv[argv.indexOf('--out') + 1] || '') : '';
const DIST = outArg ? path.resolve(ROOT, outArg) : path.join(ROOT, 'dist');
const DIM = Math.max(64, Math.min(16384, Number(process.env.RAG_EMBED_DIM) || DEFAULT_DIM));

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message = '') {
  console.log(message);
}
function fail(message) {
  console.error(`${c.red}✗ ${message}${c.reset}`);
  process.exit(1);
}
function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else {
        try {
          total += fs.statSync(target).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return total;
}
function countFiles(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else total += 1;
    }
  }
  return total;
}
const fmtKB = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** 递归列出目录下所有普通文件（用于产物文本扫描） */
function walkFiles(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(target, acc);
    else acc.push(target);
  }
  return acc;
}

/* ------------------------------------------------------------------ *
 * 1. 同步浏览器引擎的共用模块
 * ------------------------------------------------------------------ */
function syncEngine() {
  log(`${c.bold}[1/5] 同步浏览器引擎${c.reset}  ${c.dim}rag/*.js → web/js/engine/${c.reset}`);
  fs.mkdirSync(ENGINE_DIR, { recursive: true });
  for (const name of ENGINE_MODULES) {
    const from = path.join(ROOT, 'rag', `${name}.js`);
    const to = path.join(ENGINE_DIR, `${name}.js`);
    if (!fs.existsSync(from)) fail(`缺少 rag/${name}.js`);
    const before = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
    const source = fs.readFileSync(from, 'utf8');
    if (before !== source) {
      fs.writeFileSync(to, source);
      log(`  · ${c.green}updated${c.reset} js/engine/${name}.js`);
    } else {
      log(`  · ${c.dim}unchanged${c.reset} js/engine/${name}.js`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. 读取知识库（复用 Node 版 loader，保证与服务端解析一致）
 * ------------------------------------------------------------------ */
async function buildKbData() {
  log(`${c.bold}[2/5] 解析知识库${c.reset}  ${c.dim}kb/*.md → kb-data.json${c.reset}`);
  const documents = await loadDocuments(KB_DIR);
  if (!documents.length) fail('kb/ 目录下没有可用文档');
  const chunkList = chunkDocuments(documents);
  return {
    data: {
      format: 1,
      version: readVersion(),
      generatedAt: new Date().toISOString(),
      source: 'kb/*.md',
      embedding: { mode: 'hash', dim: DIM },
      topK: 6,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        file: doc.file,
        order: doc.order,
        summary: doc.summary,
        sections: doc.sections,
      })),
    },
    documents,
    chunks: chunkList,
  };
}

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

/* ------------------------------------------------------------------ *
 * 3. 复制 web/ → dist/、清理旧离线残留、注入浏览器模式标记
 * ------------------------------------------------------------------ */
function copyWeb() {
  log(`${c.bold}[3/5] 复制前端资源${c.reset}  ${c.dim}web/* → dist/${c.reset}`);
  fs.cpSync(WEB_DIR, DIST, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== '.DS_Store' && base !== '__MACOSX';
    },
  });
  removeStaleArtifacts();
  injectBrowserFlag();
}

/** 清理旧离线版产物（web/ 里就算还有同名文件，也不允许进 dist） */
function removeStaleArtifacts() {
  for (const rel of STALE_DIST_PATHS) {
    const target = path.join(DIST, rel);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    log(`  · ${c.yellow}removed${c.reset} ${rel} ${c.dim}（旧离线版残留）${c.reset}`);
  }
}

function injectBrowserFlag() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) fail('web/index.html 不存在');
  let html = fs.readFileSync(indexPath, 'utf8');
  const alreadyInjected = /<script>\s*window\.__RAG_BROWSER_MODE__\s*=\s*true\s*;?\s*<\/script>/.test(html);
  if (alreadyInjected) {
    log(`  · ${c.yellow}index.html 已包含浏览器模式标记脚本（跳过注入）${c.reset}`);
  } else {
    const marker = '<script type="module" src="js/app.js"></script>';
    if (!html.includes(marker)) fail('index.html 中找不到 app.js 入口，无法注入浏览器模式标记');
    // 内联脚本必须在 module 之前执行：api.js 在模块求值/调用时就会读取这个标记
    html = html.replace(
      marker,
      `  <script>window.__RAG_BROWSER_MODE__ = true;</script>\n  ${marker}`,
    );
    fs.writeFileSync(indexPath, html);
    log(`  · ${c.green}injected${c.reset} window.__RAG_BROWSER_MODE__=true`);
  }

  // 校验：嵌套部署到 /demos/<id>/ 时，任何以 / 开头的资源都会 404
  const absoluteRefs = [...html.matchAll(/(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((match) => match[1]);
  if (absoluteRefs.length) {
    fail(`index.html 仍有绝对路径资源（嵌套部署会 404）：${absoluteRefs.slice(0, 8).join(', ')}`);
  }
}

/* ------------------------------------------------------------------ *
 * 4. 写 dist/kb-data.json 与 dist/eval.json
 * ------------------------------------------------------------------ */
async function writeData(kb) {
  log(`${c.bold}[4/5] 写入知识库数据${c.reset}`);
  const kbPath = path.join(DIST, 'kb-data.json');
  await fsp.writeFile(kbPath, `${JSON.stringify(kb.data)}\n`, 'utf8');
  log(
    `  · kb-data.json  ${c.dim}${kb.documents.length} 篇文档 / ${kb.chunks.length} 个块 / dim=${DIM} / ${fmtKB(fs.statSync(kbPath).size)}${c.reset}`,
  );

  const evalSrc = path.join(KB_DIR, 'eval.json');
  if (!fs.existsSync(evalSrc)) fail('kb/eval.json 不存在（评测页需要它）');
  const evalData = JSON.parse(await fsp.readFile(evalSrc, 'utf8'));
  const evalPath = path.join(DIST, 'eval.json');
  await fsp.writeFile(evalPath, `${JSON.stringify(evalData, null, 2)}\n`, 'utf8');
  log(`  · eval.json  ${c.dim}${Array.isArray(evalData) ? evalData.length : 0} 条评测用例${c.reset}`);
}

/* ------------------------------------------------------------------ *
 * 5. 产物自检
 * ------------------------------------------------------------------ */
async function verifyDist(kb) {
  log(`${c.bold}[5/5] 产物自检${c.reset}`);
  const required = [
    'index.html',
    'kb-data.json',
    'eval.json',
    'css/base.css',
    'js/app.js',
    'js/api.js',
    'js/browser-api.js',
    'js/engine/index.js',
    'js/engine/chunker.js',
    'js/engine/store.js',
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.join(DIST, rel))) fail(`产物缺少 ${rel}`);
  }
  if (fs.existsSync(path.join(DIST, '.env'))) fail('产物里出现了 .env，拒绝构建');

  // 旧离线产物一个都不许留
  const staleNames = ['js/local-api.js', 'js/engine/mock-answer.js', 'fixtures/recorded-answers.json'];
  for (const rel of staleNames) {
    if (fs.existsSync(path.join(DIST, rel))) fail(`产物里残留旧离线文件 ${rel}，请在 web/ 中删除`);
  }

  // 产物文本扫描：旧标记 / 旧模块名 / 密钥形态字符串都不允许出现
  const textRules = [
    { name: '旧静态标记 __RAG_STATIC__', pattern: /__RAG_STATIC__/ },
    { name: '旧离线 API 层 local-api.js', pattern: /local-api\.js/ },
    { name: '旧离线答案模块 mock-answer', pattern: /mock-answer/ },
    { name: '旧录制回放数据 fixtures/recorded-answers', pattern: /fixtures\/recorded-answers/ },
  ];
  const hits = [];
  for (const file of walkFiles(DIST)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt'].includes(ext)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const rule of textRules) {
      if (rule.pattern.test(text)) hits.push(`${path.relative(DIST, file)} :: ${rule.name}`);
    }
    if (/sk-[A-Za-z0-9]{16,}/.test(text)) {
      hits.push(`${path.relative(DIST, file)} :: 疑似 API Key（sk-*）`);
    }
  }
  if (hits.length) {
    fail(`产物自检发现 ${hits.length} 处不允许的内容：\n  · ${hits.slice(0, 12).join('\n  · ')}`);
  }
  log(`  · ${c.green}无旧离线标记/模块/密钥残留${c.reset}`);

  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  if (!/window\.__RAG_BROWSER_MODE__\s*=\s*true/.test(html)) fail('index.html 缺少 __RAG_BROWSER_MODE__ 标记');
  log(`  · ${c.green}index.html 已注入浏览器模式标记${c.reset}`);

  // 校验两份数据文件可解析且与构建输入一致
  const kbData = JSON.parse(fs.readFileSync(path.join(DIST, 'kb-data.json'), 'utf8'));
  if (!Array.isArray(kbData.documents) || kbData.documents.length !== kb.documents.length) {
    fail('dist/kb-data.json 的文档数与构建输入不一致');
  }
  const evalData = JSON.parse(fs.readFileSync(path.join(DIST, 'eval.json'), 'utf8'));
  if (!Array.isArray(evalData) || !evalData.length) fail('dist/eval.json 为空');
  log(`  · ${c.green}kb-data.json / eval.json 可解析且完整${c.reset}`);

  const forbidden = ['server.js', 'config.js', 'rag', 'test', 'scripts', 'kb', 'docs', '.env'];
  for (const name of forbidden) {
    if (fs.existsSync(path.join(DIST, name))) {
      log(`  · ${c.yellow}注意${c.reset} dist/${name} 不应出现（若非前端资源请清理）`);
    }
  }

  // 用 Node 动态 import 一遍浏览器引擎，提前抓语法/引用错误（不执行 fetch）
  try {
    const engineUrl = `${pathToFileURL(path.join(DIST, 'js', 'engine', 'index.js')).href}?t=${Date.now()}`;
    const mod = await import(engineUrl);
    const exportName = Object.keys(mod).find((name) => /^create/.test(name) && typeof mod[name] === 'function');
    if (!exportName) fail('js/engine/index.js 没有导出 create* 工厂函数');
    log(`  · ${c.green}engine/index.js 可加载${c.reset}（导出 ${exportName}）`);
  } catch (error) {
    fail(`js/engine/index.js 加载失败：${error?.message || error}`);
  }

  const files = countFiles(DIST);
  const size = dirSize(DIST);
  log('');
  log(`${c.bold}浏览器模式产物就绪${c.reset}  ${path.relative(process.cwd(), DIST)}/`);
  log(`  文件数 ${files} · 体积 ${c.bold}${fmtKB(size)}${c.reset}`);
  log(`  知识库 ${kb.documents.length} 篇 / ${kb.chunks.length} 块 · 向量维度 ${DIM}`);
  log(
    `  生成方式：浏览器内检索 + 同源 /api/llm/chat/completions 转发真实大模型${c.dim}（无 Key 时页面明确显示未连接）${c.reset}`,
  );
  log('');
  log(`  ${c.bold}本地预览${c.reset}  项目根目录 npm run serve  →  http://127.0.0.1:5180/demos/rag-lab/`);
  log(`  ${c.bold}单页预览${c.reset}  node scripts/serve-app.mjs apps/rag-lab/dist /demos/rag-lab 5283 --llm`);
  log(`  ${c.bold}服务器模式${c.reset}  npm start  → http://127.0.0.1:8900（需配 .env，否则明确报未连接）`);
  log('');
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */
async function main() {
  log(`${c.bold}RAG 观测台 · 浏览器模式构建${c.reset}  ${c.dim}${new Date().toLocaleString('zh-CN')}${c.reset}`);
  log('');

  syncEngine();
  const kb = await buildKbData();

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  copyWeb();
  await writeData(kb);
  await verifyDist(kb);
}

main().catch((error) => {
  console.error(`${c.red}构建失败：${error?.stack || error}${c.reset}`);
  process.exit(1);
});
