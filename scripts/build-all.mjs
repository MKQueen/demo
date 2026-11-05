#!/usr/bin/env node
/**
 * build-all.mjs —— 构建所有 demo，并拼装成 site/。
 *
 * 五个 demo 是纯静态产物，可直接上传托管；mini-opencode 是真实 Agent 的客户端，
 * 页面本身也是静态的，但运行时需要本地后端（npm run serve 会一起拉起）。
 *
 * 目录约定：
 *   hub/                合集首页（纯静态，无构建）
 *   hub/demos.json      demo 元数据（首页卡片由此渲染）
 *   apps/<id>/          demo 源码（各自独立 package.json / 构建方式）
 *   apps/<id>/dist/     构建产物（约定：相对路径可嵌套部署）
 *   apps/<id>/screenshots/cover.jpg   首页封面图（可选，缺失时首页用渐变占位）
 *   site/               最终静态站点
 *
 * 用法：
 *   node scripts/build-all.mjs               # 构建全部 + 拼装 site/
 *   node scripts/build-all.mjs --skip-build  # 复用已有 dist，只重新拼装
 *   node scripts/build-all.mjs --only mecha-battle,rag-lab
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HUB = path.join(ROOT, 'hub');
const APPS = path.join(ROOT, 'apps');
const SITE = path.join(ROOT, 'site');

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
const onlyArg = argv.indexOf('--only');
const only = onlyArg >= 0 ? String(argv[onlyArg + 1] || '').split(',').filter(Boolean) : null;

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(msg = '') {
  console.log(msg);
}
function hr(title) {
  log(`\n${c.cyan}${'─'.repeat(4)} ${title} ${'─'.repeat(Math.max(4, 64 - title.length))}${c.reset}`);
}
function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return total;
}
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => !s.includes('__MACOSX') && path.basename(s) !== '.DS_Store',
  });
}
function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

const dataFile = path.join(HUB, 'demos.json');
if (!fs.existsSync(dataFile)) {
  console.error(`${c.red}✗ 缺少 hub/demos.json${c.reset}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const demos = (manifest.demos || []).filter((d) => !only || only.includes(d.id));

if (!demos.length) {
  console.error(`${c.red}✗ 没有需要构建的 demo${c.reset}`);
  process.exit(1);
}

log(`${c.bold}DEMO 合集构建${c.reset}  ${c.dim}${new Date().toLocaleString('zh-CN')}${c.reset}`);
if (skipBuild) log(`${c.yellow}（--skip-build：复用已有 dist）${c.reset}`);

// ---------------------------------------------------------------------------
// 1. 逐个构建 app
// ---------------------------------------------------------------------------
const results = [];
for (const demo of demos) {
  hr(`${demo.name || demo.id}  (apps/${demo.id})`);
  const appDir = path.join(APPS, demo.id);
  const distDir = path.join(appDir, 'dist');
  const pkgFile = path.join(appDir, 'package.json');

  if (!fs.existsSync(pkgFile)) {
    console.error(`${c.red}✗ apps/${demo.id}/package.json 不存在${c.reset}`);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

  if (!skipBuild) {
    if (!fs.existsSync(path.join(appDir, 'node_modules')) && pkg.dependencies && Object.keys(pkg.dependencies).length) {
      log(`${c.yellow}· node_modules 缺失，先执行 npm install…${c.reset}`);
      const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: appDir, stdio: 'inherit' });
      if (install.status !== 0) {
        console.error(`${c.red}✗ ${demo.id} 依赖安装失败${c.reset}`);
        process.exit(install.status || 1);
      }
    }
    log(`${c.dim}· npm run build${c.reset}`);
    const build = spawnSync('npm', ['run', 'build', '--silent'], { cwd: appDir, stdio: 'inherit', env: { ...process.env } });
    if (build.status !== 0) {
      console.error(`${c.red}✗ ${demo.id} 构建失败${c.reset}`);
      process.exit(build.status || 1);
    }
  } else if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`${c.red}✗ apps/${demo.id}/dist/index.html 不存在，无法 --skip-build${c.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`${c.red}✗ apps/${demo.id} 构建后没有 dist/index.html${c.reset}`);
    process.exit(1);
  }
  results.push({ demo, distDir });
}

// ---------------------------------------------------------------------------
// 2. 拼装 site/
// ---------------------------------------------------------------------------
hr('拼装站点');
rimraf(SITE);
fs.mkdirSync(path.join(SITE, 'demos'), { recursive: true });
fs.mkdirSync(path.join(SITE, 'thumbs'), { recursive: true });

for (const { demo, distDir } of results) {
  const dest = path.join(SITE, 'demos', demo.id);
  copyDir(distDir, dest);

  // 注入「返回作品集」按钮：只改动部署副本，不动 app 源码
  fs.copyFileSync(path.join(ROOT, 'scripts', 'back-home.js'), path.join(dest, '__back-home.js'));
  const indexPath = path.join(dest, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('__back-home.js')) {
    const tag = '  <script src="./__back-home.js" defer></script>\n';
    html = html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag;
    fs.writeFileSync(indexPath, html);
  }

  // 校验：构建产物里不应再有以 / 开头的绝对资源引用（嵌套部署会 404）
  const absoluteRefs = [...html.matchAll(/(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]);
  if (absoluteRefs.length) {
    console.log(
      `${c.yellow}⚠ ${demo.id}: index.html 仍有绝对路径 ${absoluteRefs.slice(0, 6).join(', ')}${c.reset}`,
    );
  }

  // 封面图：apps/<id>/screenshots/cover.jpg → site/thumbs/<id>.jpg
  const coverCandidates = [
    path.join(APPS, demo.id, 'screenshots', 'cover.jpg'),
    path.join(APPS, demo.id, 'screenshots', 'cover.png'),
    path.join(APPS, demo.id, 'screenshots', 'cover.jpeg'),
  ];
  const cover = coverCandidates.find((p) => fs.existsSync(p));
  if (cover) {
    fs.copyFileSync(cover, path.join(SITE, 'thumbs', `${demo.id}${path.extname(cover).toLowerCase()}`));
    console.log(`${c.green}✓${c.reset} ${demo.id}  ${c.dim}${mb(dirSize(dest))}${c.reset}`);
  } else {
    console.log(`${c.yellow}⚠ ${demo.id} 缺少 screenshots/cover.jpg（首页会用渐变占位）${c.reset}`);
  }
}

// hub → site（纯静态拷贝）
for (const entry of fs.readdirSync(HUB, { withFileTypes: true })) {
  if (entry.name === 'node_modules' || entry.name === 'package.json') continue;
  const src = path.join(HUB, entry.name);
  const dest = path.join(SITE, entry.name);
  if (entry.isDirectory()) copyDir(src, dest);
  else if (entry.name !== '.DS_Store') fs.copyFileSync(src, dest);
}
log(`${c.green}✓${c.reset} hub → site`);

// GitHub Pages 兼容：告诉 Jekyll 不要处理静态站点（分支部署时必需）
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

// 构建信息（便于排查线上版本）
fs.writeFileSync(
  path.join(SITE, 'build-info.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      demos: demos.map((d) => ({ id: d.id, name: d.name, version: d.version || null })),
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// 3. 汇总
// ---------------------------------------------------------------------------
hr('完成');
const totalSize = dirSize(SITE);
log(`站点目录：${path.relative(ROOT, SITE)}/  总大小：${c.bold}${mb(totalSize)}${c.reset}`);
log('');
log(`  ${c.bold}本地预览${c.reset}  npm run serve   →  http://127.0.0.1:5180/  （含真实 Agent 后端）`);
log(`  ${c.bold}打包上传${c.reset}  npm run zip     →  site.zip`);
log(`  ${c.bold}单页调试${c.reset}  node scripts/serve-app.mjs apps/<id>/dist /demos/<id> 5281`);
log('');
