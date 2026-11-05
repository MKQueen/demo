#!/usr/bin/env node
/**
 * install-all.mjs —— 为所有 app 安装依赖。
 *
 * 合集里每个 demo 是独立的小项目（各自的 package.json / 构建方式），
 * 这样以后单独改某个 demo 时不用被整仓的依赖绑架。
 *
 *   node scripts/install-all.mjs            # 只装缺失 node_modules 的 app
 *   node scripts/install-all.mjs --force    # 全部重装
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const appsDir = path.join(ROOT, 'apps');

const apps = fs
  .readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(appsDir, d.name, 'package.json')))
  .map((d) => d.name);

if (!apps.length) {
  console.log('没有找到 apps/*/package.json');
  process.exit(0);
}

for (const name of apps) {
  const dir = path.join(appsDir, name);
  if (!force && fs.existsSync(path.join(dir, 'node_modules'))) {
    console.log(`= ${name}：node_modules 已存在，跳过（--force 可重装）`);
    continue;
  }
  console.log(`\n> ${name}：npm install`);
  const res = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✗ ${name} 依赖安装失败`);
    process.exit(res.status || 1);
  }
}
console.log('\n✓ 所有 app 依赖就绪');
