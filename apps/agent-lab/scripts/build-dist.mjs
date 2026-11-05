#!/usr/bin/env node
/**
 * ============================================================================
 * build-dist.mjs —— 构建 mini-opencode 的「真实运行版」网页产物（dist/）
 * ============================================================================
 *
 * 以前这里打的是「静态回放版」：把录好的 fixtures 内联进页面，再注入一个假后端
 * 把 fetch / EventSource 骗过去。页面看着像 Agent，其实什么都没跑。
 *
 * 现在改成真的：
 *   - 前端就是 src/web/public/ 里那份**原样的真实前端**（一行不改）；
 *   - 页面照常请求 /api/*，由本地 mini-opencode 后端真实响应；
 *   - dist/ 里不再有 fixtures-data.js / static-api.js 这类「假后端」；
 *   - 额外注入一个 offline-guard.js：后端没起时如实提示「需要本地服务」，
 *     而不是拿假数据冒充。
 *
 * 输出（dist/）：
 *   index.html        绝对资源路径改成相对路径（可部署在 /demos/agent-lab/ 子路径）
 *   style.css         原样复制
 *   app.js            原样复制（保证和 `npm run web` 看到的一模一样）
 *   offline-guard.js  后端在线检测 + 未连接提示
 *
 * 用法：
 *   npm run build
 *   node scripts/build-dist.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'src/web/public');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const DIST_DIR = path.join(ROOT, 'dist');

/** 轻量断言：构建产物不完整时直接失败，别把坏包部署出去。 */
function assert(condition, message) {
  if (!condition) {
    console.error(`✗ 构建失败：${message}`);
    process.exit(1);
  }
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function main() {
  console.log('▶ 构建 mini-opencode 真实运行版前端 → dist/');

  // --- 0. 前置检查 -----------------------------------------------------------
  for (const file of ['index.html', 'app.js', 'style.css', 'codex.css', 'shell.js']) {
    assert(fs.existsSync(path.join(PUBLIC_DIR, file)), `缺少 src/web/public/${file}`);
  }
  const guardSource = path.join(SCRIPTS_DIR, 'offline-guard.js');
  assert(fs.existsSync(guardSource), '缺少 scripts/offline-guard.js');

  // --- 1. 清理旧产物（尤其是上一版留下的 fixtures-data.js / static-api.js）----
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // --- 2. index.html：绝对路径 → 相对路径，注入诚实模式标记和离线检测 -----------
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

  // 2.1 站点会被部署在 /demos/agent-lab/ 子路径下，绝对路径会 404
  html = html.replace(/(\s(?:href|src)=")\/(?!\/)/g, '$1');
  assert(!/(href|src)="\/(?!\/)/.test(html), 'index.html 里仍有绝对路径资源引用');

  // 2.2 meta 标记：这是真实运行版，不是回放
  html = html.replace(
    '<meta name="color-scheme" content="light" />',
    '<meta name="color-scheme" content="light" />\n  <meta name="agent-lab-mode" content="live" />',
  );

  // 2.3 在 app.js 之前注入离线检测（后端没起时给出可操作提示，而不是假装）
  const appScript = /<script src="app\.js[^"]*"><\/script>/;
  assert(appScript.test(html), 'index.html 里找不到 app.js 的 script 标签');
  html = html.replace(appScript, (match) => '<script src="offline-guard.js"></script>\n  ' + match);

  writeFile(path.join(DIST_DIR, 'index.html'), html);
  fs.copyFileSync(path.join(PUBLIC_DIR, 'style.css'), path.join(DIST_DIR, 'style.css'));
  fs.copyFileSync(path.join(PUBLIC_DIR, 'codex.css'), path.join(DIST_DIR, 'codex.css'));
  fs.copyFileSync(path.join(PUBLIC_DIR, 'app.js'), path.join(DIST_DIR, 'app.js'));
  fs.copyFileSync(path.join(PUBLIC_DIR, 'shell.js'), path.join(DIST_DIR, 'shell.js'));
  fs.copyFileSync(guardSource, path.join(DIST_DIR, 'offline-guard.js'));

  // --- 3. 自检 ---------------------------------------------------------------
  assert(!html.includes('fixtures-data.js'), 'dist/index.html 不应再引用 fixtures-data.js');
  assert(!html.includes('static-api.js'), 'dist/index.html 不应再引用 static-api.js');
  assert(
    !fs.readFileSync(path.join(DIST_DIR, 'app.js'), 'utf8').includes('__AGENT_LAB'),
    'app.js 不应被修改（它就是真实前端）',
  );
  assert(
    !/\bfetch\s*\(/.test(fs.readFileSync(path.join(DIST_DIR, 'shell.js'), 'utf8')) &&
      !fs.readFileSync(path.join(DIST_DIR, 'shell.js'), 'utf8').includes('new EventSource'),
    'shell.js 只做外壳交互，不应自己发网络请求（真相必须来自 app.js 的后端事件）',
  );

  const referenced = [...html.matchAll(/(?:href|src)="([^"]+\.(?:js|css))(?:\?[^"]*)?"/g)].map(
    (match) => match[1],
  );
  for (const asset of referenced) {
    assert(fs.existsSync(path.join(DIST_DIR, asset)), `index.html 引用的 ${asset} 不存在`);
  }

  // --- 4. 报告 ---------------------------------------------------------------
  const files = fs
    .readdirSync(DIST_DIR)
    .map((name) => ({ name, size: fs.statSync(path.join(DIST_DIR, name)).size }))
    .sort((a, b) => b.size - a.size);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  console.log('');
  for (const file of files) {
    console.log(`  ${file.name.padEnd(20)} ${formatKb(file.size)}`);
  }
  console.log(`  ${'合计'.padEnd(20)} ${formatKb(totalBytes)}`);
  console.log('');
  console.log('  · 前端无假数据：/api/* 由真实 mini-opencode 后端响应');
  console.log('  · 本地预览请从项目根目录执行：npm run serve');
  console.log('  · 产品目录：' + path.relative(process.cwd(), DIST_DIR) + '/');
  console.log(`✓ 构建完成（${formatKb(totalBytes)}）`);
}

main();
