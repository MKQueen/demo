#!/usr/bin/env node
/**
 * deploy-gh-pages.mjs —— 备用部署方式：把构建好的 site/ 强推到一个干净的 gh-pages 分支。
 *
 * 适合：
 *   - 不想用 GitHub Actions（仓库没开 Action、或 Actions 构建失败时兜底）；
 *   - 希望 GitHub Pages 用「分支部署」而不是「Actions 部署」。
 *
 * 用法：
 *   npm run deploy:gh-pages                 # 先构建，再推送
 *   npm run deploy:gh-pages -- --skip-build # 复用已有 site/，只推送
 *
 * 说明：
 *   - 会在临时目录里创建一个「只有一个提交」的 gh-pages 分支并 force push，
 *     所以每次部署不会把历史构建产物累积进仓库；
 *   - 首次推送需要本机具备 GitHub 推送权限（HTTPS 用户名 + PAT，或 SSH key）；
 *   - 推送完成后到仓库 Settings → Pages → Source 选择
 *     "Deploy from a branch" → gh-pages / (root)。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n✗ 命令失败：${command} ${args.join(' ')}`);
    process.exit(result.status || 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return (result.stdout || '').trim();
}

const remoteUrl = capture('git', ['remote', 'get-url', 'origin']);
if (!remoteUrl) {
  console.error('✗ 还没有配置 git remote origin。先执行：');
  console.error('  git remote add origin https://github.com/<你的用户名>/demo.git');
  process.exit(1);
}

if (!skipBuild) {
  console.log('▸ 构建站点（node scripts/build-all.mjs）…\n');
  run('node', ['scripts/build-all.mjs']);
}

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('✗ 未找到 site/index.html，请先运行 npm run build');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-gh-pages-'));
try {
  console.log('\n▸ 准备 gh-pages 分支内容…');
  fs.cpSync(SITE, tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, '.nojekyll'), '');

  const name = capture('git', ['config', 'user.name']) || 'DEMO LAB';
  const email = capture('git', ['config', 'user.email']) || 'demo@local';

  run('git', ['init', '-q', '-b', 'gh-pages'], { cwd: tmp });
  run('git', ['config', 'user.name', name], { cwd: tmp });
  run('git', ['config', 'user.email', email], { cwd: tmp });
  run('git', ['add', '-A'], { cwd: tmp });
  run('git', ['commit', '-q', '-m', `deploy: static site ${new Date().toISOString()}`], { cwd: tmp });
  run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: tmp });

  console.log('▸ 推送 gh-pages（首次会要求 GitHub 账号 / PAT / SSH 认证）…\n');
  run('git', ['push', '--force', 'origin', 'gh-pages'], { cwd: tmp });

  const match = remoteUrl.match(/github\.com[:\/]([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  console.log('\n✓ gh-pages 已推送');
  if (match) {
    console.log(`  到仓库 Settings → Pages → Source 选择 "Deploy from a branch"`);
    console.log(`  分支选 gh-pages /(root)，访问地址通常是：`);
    console.log(`  https://${match[1]}.github.io/${match[2]}/`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
