/**
 * test/config.test.js —— 配置加载的小单测
 * 重点验证两件事：
 *   1) 手写的 .env 解析器能正确处理注释/引号/export/等号空格；
 *   2) 配置里不再有「离线演示 / mock」语义：没有 Key 就是没有 Key，
 *      由 rag/llm.js 判为不可用、server.js 明确报未连接，绝不伪造答案。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile, parseArgs, loadConfig } from '../config.js';

test('parseEnvFile 支持注释、引号、export 前缀与等号后的空格', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-cfg-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(
    file,
    ['# 注释', '', 'export A=1', 'B = "hello world"', "C='x'", 'D=a=b=c', 'INVALID_LINE'].join('\n'),
  );
  const env = parseEnvFile(file);
  assert.equal(env.A, '1');
  assert.equal(env.B, 'hello world');
  assert.equal(env.C, 'x');
  assert.equal(env.D, 'a=b=c');
  assert.equal(env.INVALID_LINE, undefined);
});

test('parseEnvFile 文件不存在时返回空对象（不能让启动挂掉）', () => {
  assert.deepEqual(parseEnvFile('/definitely/not/here/.env'), {});
});

test('parseArgs 支持 --key value 与 --flag', () => {
  assert.deepEqual(parseArgs(['--port', '9000', '--host', '127.0.0.1']), {
    port: '9000',
    host: '127.0.0.1',
  });
  assert.deepEqual(parseArgs(['--no-open']), { 'no-open': true });
});

test('loadConfig 默认值合理，且不再有 mock 字段', () => {
  const defaults = loadConfig();
  assert.equal(defaults.embedding.dim, 8192);
  assert.equal(defaults.embedding.mode, 'hash');
  assert.equal(defaults.topK, 6);
  assert.ok(defaults.kbDir.endsWith('/kb'));
  assert.ok(defaults.webDir.endsWith('/web'));
  assert.equal(defaults.version, '0.1.0');
  assert.equal('mock' in defaults, false, '配置对象里不应再有 mock 字段');

  // llm 段结构固定：key / baseUrl / model / reasoningEffort / displayBaseUrl
  assert.deepEqual(
    Object.keys(defaults.llm).sort(),
    ['apiKey', 'baseUrl', 'displayBaseUrl', 'model', 'reasoningEffort'].sort(),
  );
  assert.equal(typeof defaults.llm.baseUrl, 'string');
  assert.equal(defaults.llm.displayBaseUrl, defaults.llm.baseUrl);
});

test('loadConfig 从环境变量读取 key/baseUrl/model，并忽略已删除的 MOCK_LLM 语义', (t) => {
  const names = [
    'DEEPSEEK_API_KEY',
    'OPENAI_API_KEY',
    'RAG_API_KEY',
    'LLM_API_KEY',
    'OPENAI_BASE_URL',
    'RAG_BASE_URL',
    'RAG_MODEL',
    'MINI_MODEL',
    'MOCK_LLM',
  ];
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  for (const name of names) delete process.env[name];

  process.env.DEEPSEEK_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://example.com/v1/';
  process.env.RAG_MODEL = 'test-model';
  process.env.MOCK_LLM = '1'; // 旧的强制离线开关：现在必须被忽略

  const config = loadConfig();
  assert.equal(config.llm.apiKey, 'test-key');
  assert.equal(config.llm.baseUrl, 'https://example.com/v1', 'baseUrl 末尾斜杠应去掉');
  assert.equal(config.llm.model, 'test-model');
  assert.equal('mock' in config, false, 'MOCK_LLM 不应再产生 mock 字段');
});

test('loadConfig 支持端口与 topK 覆盖', () => {
  const cfg = loadConfig({ port: '9311', 'top-k': '8' });
  assert.equal(cfg.port, 9311);
  assert.equal(cfg.topK, 8);
  // 端口必须落在合法范围，避免 0/负数把服务起废
  assert.ok(cfg.port > 0 && cfg.port < 65536);
});
