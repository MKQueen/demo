#!/usr/bin/env node
/**
 * ============================================================================
 * record-fixtures.mjs —— 用 mock 模型跑真实 Agent 会话，录成静态回放用的 fixtures
 * ============================================================================
 *
 * 静态站没有后端，但「Agent 可观测面板」的意义恰恰在于看到真实运行轨迹。
 * 所以这个脚本的做法是：真的把 Web 服务跑起来（直接 import 项目源码，零依赖），
 * 用自带的 mock 模型（剧本式假模型，不需要 API key）跑 2~3 个任务，
 * 把整条 SSE 事件流、回合结束后的 /api/state 快照、会话 JSONL 一起录下来。
 *
 * 录制产物（apps/agent-lab/fixtures/）：
 *   manifest.json          元信息 + 场景索引（静态前端据此渲染场景按钮）
 *   scenario-N.json        单个场景：初始快照、最终快照、SSE 事件流、会话详情
 *   sessions.json          会话列表（GET /api/sessions）
 *   meta.json              版本/工具/功能/文档（GET /api/meta）
 *   config.json            模型配置（已脱敏）
 *   workspace.json         工作区目录浏览（已脱敏）
 *   raw/<sessionId>.jsonl  干净的会话 JSONL（供 /api/session 回放参考）
 *
 * 安全边界：
 *   - 工作区是 os.tmpdir() 下的临时目录，不碰任何用户真实文件；
 *   - 启动前先清掉进程环境里的真实 API key，保证 fixtures 里不会出现密钥；
 *   - 产物最后统一脱敏：临时目录绝对路径 → /tmp/mini-opencode-demo，
 *     用户 home 路径 → /home/demo，形如 sk-xxx 的字符串 → sk-***；
 *   - 不读取、不复制源项目里的 .env 与 .mini-opencode/sessions。
 *
 * 用法：
 *   npm run record        # 重新录制并覆盖 fixtures/
 *   node scripts/record-fixtures.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');
const RAW_DIR = path.join(FIXTURES_DIR, 'raw');

/** 脱敏后的临时工作区展示路径（前端顶栏 / 工作区按钮会显示它）。 */
const CLEAN_WORKSPACE = '/tmp/mini-opencode-demo';
const CLEAN_HOME = '/home/demo';

/**
 * 演示场景。
 *
 * 任务文案必须能被 src/llm/mock.ts 的剧本正则命中（先读 mock.ts 再定）：
 *   - FILE_SCENARIO：/文件|创建|新建|写个|写一个|hello|file|目录/i
 *   - TODO_SCENARIO：/todo|待办|拆解|拆一下|计划|规划|任务/i
 *   - 都不命中 → DEFAULT_TURNS（纯文本介绍）
 * 权限档位决定是否会录制到「权限审批」事件：
 *   - accept-edits：写文件自动放行，bash 仍要审批（正好录到一次审批）
 *   - auto：全自动，不产生审批事件
 */
const SCENARIOS = [
  {
    key: 'demo-create-file',
    title: '创建 hello.txt',
    description: 'bash 查看目录 → write 创建文件 → read 验证内容，含一次真实的权限审批',
    task: '帮我创建一个 hello.txt',
    permissionLevel: 'accept-edits',
    approvalDecision: 'yes',
  },
  {
    key: 'demo-todo',
    title: 'todo 拆解任务',
    description: 'todowrite 两轮更新待办清单，演示 Agent 的工作记忆与会话状态',
    task: '用 todo 拆解一下这个任务',
    permissionLevel: 'auto',
  },
  {
    key: 'demo-chat',
    title: '纯文本对话',
    description: '不触发工具时的流式回复，演示 mock 模型的默认剧本',
    task: '介绍一下你能做什么，以及面板上能观察哪些东西',
    permissionLevel: 'auto',
  },
];

// ---------------------------------------------------------------------------
// 0. 安全：清掉真实 key / 环境覆盖，再动态 import 项目源码
// ---------------------------------------------------------------------------

const ENV_KEYS_TO_CLEAR = [
  'MINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'DEEPSEEK_BASE_URL',
  'OPENAI_BASE_URL',
  'MINI_MODEL',
  'MINI_TEMPERATURE',
  'MINI_CONTEXT_BUDGET',
  'MINI_MAX_STEPS',
  'MINI_MAX_TOOL_CALLS',
  'MINI_REPEAT_GUARD',
  'MINI_REASONING_EFFORT',
  'MINI_MOCK',
];
for (const key of ENV_KEYS_TO_CLEAR) delete process.env[key];

const { resolveConfig } = await import('../src/config.ts');
const { startWebServer } = await import('../src/web/server.ts');

// ---------------------------------------------------------------------------
// 1. 临时工作区（演示 Agent 真的在这个目录里读写）
// ---------------------------------------------------------------------------

function prepareWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-opencode-demo-'));
  // docs/ 的章节列表会显示在面板「配套文档」里，所以只复制 .md 文件名（内容不参与录制）
  const docsDir = path.join(dir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const sourceDocs = path.join(ROOT, 'docs');
  for (const name of fs.readdirSync(sourceDocs)) {
    if (!name.endsWith('.md')) continue;
    fs.copyFileSync(path.join(sourceDocs, name), path.join(docsDir, name));
  }
  fs.writeFileSync(
    path.join(dir, 'README.md'),
    '# mini-opencode 演示工作区\n\n这个目录是录制 fixtures 时给 Agent 用的临时工作区。\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'notes.md'),
    '# 调试笔记\n\n- Agent 的每一步都会写进 .mini-opencode/sessions/*.jsonl\n- 面板左侧可以看上下文 token 与待办\n',
    'utf8',
  );
  return dir;
}

// ---------------------------------------------------------------------------
// 2. HTTP / SSE 小工具（Node 24 自带 fetch，零依赖）
// ---------------------------------------------------------------------------

async function api(baseUrl, method, apiPath, body) {
  const response = await fetch(baseUrl + apiPath, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(`${method} ${apiPath} → HTTP ${response.status}: ${payload?.error ?? text.slice(0, 200)}`);
  }
  return payload;
}

/**
 * 订阅 SSE。返回的对象里：
 *   events    已经收到的事件（hello 也会在里面）
 *   waitFor   等一个未来事件（谓词匹配即 resolve）
 *   onEvent   每个新事件的回调（用于自动审批）
 *   close     断开
 */
async function connectSse(baseUrl) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/events`, { signal: controller.signal });
  if (!response.ok) throw new Error(`SSE 连接失败：HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const state = {
    events: [],
    onEvent: null,
    closed: false,
    buffer: '',
    waiters: [],
  };

  const dispatch = (event) => {
    state.events.push(event);
    try {
      state.onEvent?.(event);
    } catch (err) {
      console.warn('  ! onEvent 回调出错：', err?.message ?? err);
    }
    for (let i = state.waiters.length - 1; i >= 0; i--) {
      const waiter = state.waiters[i];
      if (waiter.predicate(event)) {
        state.waiters.splice(i, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(event);
      }
    }
  };

  void (async () => {
    try {
      while (!state.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        state.buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = state.buffer.indexOf('\n\n')) >= 0) {
          const chunk = state.buffer.slice(0, index);
          state.buffer = state.buffer.slice(index + 2);
          const dataLines = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());
          if (!dataLines.length) continue; // 心跳注释行 (: ping)
          try {
            dispatch(JSON.parse(dataLines.join('\n')));
          } catch {
            /* 坏帧跳过 */
          }
        }
      }
    } catch {
      /* abort 时会抛，正常 */
    }
  })();

  return {
    events: state.events,
    set onEvent(fn) {
      state.onEvent = fn;
    },
    waitFor(predicate, timeoutMs = 30_000) {
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            const index = state.waiters.indexOf(waiter);
            if (index >= 0) state.waiters.splice(index, 1);
            reject(new Error(`等待 SSE 事件超时（${timeoutMs}ms）`));
          }, timeoutMs),
        };
        state.waiters.push(waiter);
      });
    },
    close() {
      state.closed = true;
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 3. 录制一个场景
// ---------------------------------------------------------------------------

async function recordScenario(baseUrl, workspace, scenario, index) {
  console.log(`\n▶ 场景 ${index + 1}/${SCENARIOS.length}：${scenario.title}`);
  console.log(`  任务：${scenario.task}`);

  // 每个场景一个全新会话，保证 /api/state 快照里只有本场景的轨迹
  await api(baseUrl, 'POST', '/api/session', { id: null });
  await api(baseUrl, 'POST', '/api/permission', { level: scenario.permissionLevel });
  const initial = await api(baseUrl, 'GET', '/api/state');
  const sessionId = initial.state.session.id;

  const sse = await connectSse(baseUrl);
  await sse.waitFor((event) => event.type === 'hello', 10_000).catch(() => {});

  /** 本场景从 user_message 到 turn_complete 的完整 SSE 事件序列。 */
  const sseEvents = [];
  let approvalCount = 0;
  const startedAt = Date.now();

  sse.onEvent = (event) => {
    if (event.type === 'hello') return;
    sseEvents.push(event);
    if (event.type === 'permission_request') {
      approvalCount += 1;
      const id = event.data?.id;
      console.log(`  · 录到权限审批请求（${event.data?.toolName}），自动批准`);
      // 模拟真人思考 200ms 后再点「允许」，让录制出来的时间线更自然
      setTimeout(() => {
        void api(baseUrl, 'POST', '/api/approval', {
          id,
          decision: scenario.approvalDecision ?? 'yes',
        }).catch((err) => console.warn('  ! 自动审批失败：', err.message));
      }, 200);
    }
  };

  const turnComplete = sse.waitFor((event) => event.type === 'turn_complete', 90_000);
  const messageResponse = await api(baseUrl, 'POST', '/api/message', { text: scenario.task });
  if (!messageResponse?.ok) throw new Error('POST /api/message 没有返回 ok');
  await turnComplete;
  // turn_complete 是 executeRun finally 里的最后一个事件；再等一拍收尾
  await sleep(120);
  sse.close();

  const durationMs = Date.now() - startedAt;
  const final = await api(baseUrl, 'GET', '/api/state');
  const sessions = (await api(baseUrl, 'GET', '/api/sessions')).sessions ?? [];
  const sessionDetail = await api(baseUrl, 'GET', `/api/session/${encodeURIComponent(sessionId)}`);
  const jsonlPath = path.join(workspace, '.mini-opencode', 'sessions', `${sessionId}.jsonl`);
  const jsonl = fs.existsSync(jsonlPath) ? fs.readFileSync(jsonlPath, 'utf8') : '';

  const toolCalls = sseEvents.filter((event) => event.type === 'tool_start').length;
  console.log(
    `  ✓ 录制完成：${sseEvents.length} 个 SSE 事件 · ${toolCalls} 次工具调用 · ` +
      `${approvalCount} 次审批 · 用时 ${(durationMs / 1000).toFixed(1)}s`,
  );

  return {
    index,
    key: scenario.key,
    title: scenario.title,
    description: scenario.description,
    task: scenario.task,
    permissionLevel: scenario.permissionLevel,
    sessionId,
    recordedAt: new Date().toISOString(),
    durationMs,
    toolCalls,
    approvalCount,
    initialState: initial.state,
    finalState: final.state,
    sseEvents,
    session: sessionDetail,
    jsonl,
    sessions,
  };
}

// ---------------------------------------------------------------------------
// 4. 脱敏 & 落盘
// ---------------------------------------------------------------------------

/** 把任意 JSON 值里的绝对路径 / 密钥 / 本机用户名替换掉，返回新值。 */
function sanitize(value, replacements) {
  const json = JSON.stringify(value);
  let output = json;
  for (const [from, to] of replacements) {
    if (!from) continue;
    output = output.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
  }
  // `ls -la` 的输出里会带本机用户名（"one staff"），统一换成演示用账号
  output = output.replace(/\bone( +)staff\b/g, 'demo$1demo');
  // 兜底：任何形如 sk-xxxx 的字符串都抹掉
  output = output.replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, 'sk-***');
  return JSON.parse(output);
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// 5. main
// ---------------------------------------------------------------------------

async function main() {
  if (process.version < 'v22.6.0') {
    throw new Error(`需要 Node >= 22.6（当前 ${process.version}）：项目用原生 TypeScript 运行`);
  }

  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const workspace = prepareWorkspace();
  let server = null;

  try {
    // mock 模式：不需要任何 API key，浏览器里看到的每个 token 都来自这套剧本
    const config = resolveConfig(workspace, {
      mock: true,
      model: 'mock-model',
      maxSteps: 24,
      maxToolCalls: 48,
    });

    server = await startWebServer({
      cwd: workspace,
      config,
      host: '127.0.0.1',
      port: 0, // 0 = 让系统分配空闲端口，避免和本机 8787 冲突
      mode: 'build',
      permissionLevel: 'auto',
    });
    console.log(`\n录制服务已启动：${server.url}`);
    console.log(`临时工作区：${workspace}`);

    const recorded = [];
    for (let i = 0; i < SCENARIOS.length; i++) {
      recorded.push(await recordScenario(server.url, workspace, SCENARIOS[i], i));
    }

    // ---- 汇总 / 脱敏 ----
    const replacements = [
      [workspace, CLEAN_WORKSPACE],
      [fs.realpathSync(workspace), CLEAN_WORKSPACE],
      [os.homedir(), CLEAN_HOME],
      [server.url, 'http://127.0.0.1:8787'],
    ];

    const allSessions = (
      sanitize((await api(server.url, 'GET', '/api/sessions')).sessions ?? [], replacements)
    )
      // 服务启动时自动创建的空会话不算演示场景，从列表里去掉，避免侧栏多一条“(空会话)”
      .filter((session) => Number(session.messageCount) > 0);
    const meta = sanitize(await api(server.url, 'GET', '/api/meta'), replacements);
    const configPayload = sanitize(await api(server.url, 'GET', '/api/config'), replacements);
    const workspacePayload = sanitize(await api(server.url, 'GET', '/api/workspace'), replacements);
    // 临时目录的真实父目录（macOS 的 /var/folders/...）没有展示价值，统一成 /tmp
    workspacePayload.parent = '/tmp';

    const manifestScenarios = [];
    for (const item of recorded) {
      // 所有快照里的 sessions 列表统一成「最终完整列表」，避免点场景按钮时会话数跳动
      const initialState = sanitize({ ...item.initialState, sessions: allSessions }, replacements);
      const finalState = sanitize({ ...item.finalState, sessions: allSessions }, replacements);
      const sseEvents = sanitize(item.sseEvents, replacements);
      const sessionDetail = sanitize(item.session, replacements);

      const scenarioPayload = {
        key: item.key,
        title: item.title,
        description: item.description,
        task: item.task,
        permissionLevel: item.permissionLevel,
        sessionId: item.sessionId,
        recordedAt: item.recordedAt,
        durationMs: item.durationMs,
        toolCalls: item.toolCalls,
        approvalCount: item.approvalCount,
        initialState,
        finalState,
        sseEvents,
        session: sessionDetail,
      };
      const fileName = `scenario-${item.index + 1}.json`;
      writeJson(path.join(FIXTURES_DIR, fileName), scenarioPayload);
      if (item.jsonl) {
        writeJsonString(path.join(RAW_DIR, `${item.sessionId}.jsonl`), sanitizeJsonl(item.jsonl, replacements));
      }

      manifestScenarios.push({
        index: item.index,
        key: item.key,
        title: item.title,
        description: item.description,
        task: item.task,
        permissionLevel: item.permissionLevel,
        sessionId: item.sessionId,
        eventCount: sseEvents.length,
        toolCalls: item.toolCalls,
        approvalCount: item.approvalCount,
        durationMs: item.durationMs,
        file: `fixtures/${fileName}`,
        jsonl: `fixtures/raw/${item.sessionId}.jsonl`,
      });
      console.log(
        `  · fixture ${fileName}：state ${(JSON.stringify(finalState).length / 1024).toFixed(0)}KB / ` +
          `events ${(JSON.stringify(sseEvents).length / 1024).toFixed(0)}KB`,
      );
    }

    const manifest = sanitize(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: 'apps/agent-lab/scripts/record-fixtures.mjs',
        runtime: { node: process.version, platform: process.platform },
        project: 'mini-opencode',
        version: '0.2.0',
        model: 'mock-model',
        mock: true,
        cleanWorkspace: CLEAN_WORKSPACE,
        replay: {
          minGapMs: 15,
          maxGapMs: 40,
          note: '静态回放把录制时的事件间隔压缩到 15~40ms，保留“流式”观感',
        },
        note: '所有会话由项目自带的 mock 模型（剧本式假模型）真实跑出；不含 API key 与真实用户目录。',
        scenarios: manifestScenarios,
      },
      replacements,
    );
    writeJson(path.join(FIXTURES_DIR, 'manifest.json'), manifest);
    writeJson(path.join(FIXTURES_DIR, 'sessions.json'), allSessions);
    writeJson(path.join(FIXTURES_DIR, 'meta.json'), meta);
    writeJson(path.join(FIXTURES_DIR, 'config.json'), configPayload);
    writeJson(path.join(FIXTURES_DIR, 'workspace.json'), workspacePayload);

    console.log(`\n✓ fixtures 已写入 ${path.relative(process.cwd(), FIXTURES_DIR)}/`);
    console.log(`× 已删除临时工作区：${workspace}`);
  } catch (err) {
    console.error('\n✗ 录制失败：', err);
    process.exitCode = 1;
  } finally {
    if (server) await server.close().catch(() => {});
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

/** JSONL 逐行脱敏（保持一行一个 JSON）。 */
function sanitizeJsonl(text, replacements) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.stringify(sanitize(JSON.parse(line), replacements));
      } catch {
        return line;
      }
    })
    .join('\n') + '\n';
}

function writeJsonString(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

await main();
