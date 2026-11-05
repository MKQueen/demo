/**
 * test/markdown.test.js —— 前端 Markdown 子集的回归测试（用极简 DOM 桩跑 Node）
 *
 * 为什么值得单独测：
 * 流式输出时，模型返回的文本是「半截」的。曾经出现过这样的线上 bug——
 * 某次刷新恰好拿到一行 "2. "（序号后面还没吐内容），renderMarkdown 的
 * 有序列表分支匹配不到条目、又没推进 index，于是 while 永远停在这一行，页面直接卡死。
 * 这里的用例就是把这个坑焊死：任何输入都必须能渲染完、且产出非空。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* -------------------------------------------------------------------------- *
 * 极简 DOM 桩：只实现 util.js 用到的 API
 * -------------------------------------------------------------------------- */
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.className = '';
    this._text = '';
    this.hidden = false;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  get firstChild() {
    return this.children[0] || null;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  addEventListener() {}
  removeEventListener() {}
  querySelectorAll() {
    return [];
  }
  get textContent() {
    if (this.children.length) return this.children.map((child) => child.textContent).join('');
    return this._text;
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value ?? '');
  }
}

globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createElementNS: (_ns, tag) => new FakeNode(tag),
  createTextNode: (text) => {
    const node = new FakeNode('#text');
    node.textContent = text;
    return node;
  },
  createDocumentFragment: () => new FakeNode('#fragment'),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: new FakeNode('body'),
};
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 0),
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
};
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const { renderMarkdown } = await import('../web/js/util.js');

/** 统计渲染结果里的节点数（含文本节点） */
function countNodes(node) {
  let total = 1;
  for (const child of node.children || []) total += countNodes(child);
  return total;
}

function render(text, timeoutMs = 2000) {
  const startedAt = Date.now();
  const fragment = renderMarkdown(text);
  const elapsed = Date.now() - startedAt;
  assert.ok(elapsed < timeoutMs, `渲染耗时 ${elapsed}ms 超过 ${timeoutMs}ms，疑似死循环`);
  return fragment;
}

/* -------------------------------------------------------------------------- *
 * 用例
 * -------------------------------------------------------------------------- */
test('半截列表标记不会死循环：流式输出的 "2. " 是历史 bug 的触发点', () => {
  const cases = [
    '2. ',
    '1. \n2. ',
    '2. \n\n后面还有正文',
    '- ',
    '- \n- \n',
    '* \n内容',
    '根据知识库整理如下：\n\n1. 第一条\n2. \n3. 第三条',
    '\n\n2. ',
    '2. \n   ',
  ];
  for (const input of cases) {
    const fragment = render(input);
    assert.ok(fragment, `输入 ${JSON.stringify(input)} 没有返回结果`);
    assert.ok(countNodes(fragment) > 1, `输入 ${JSON.stringify(input)} 渲染出空内容`);
  }
});

test('正常的列表 / 段落 / 引用 / 标题都能渲染', () => {
  const fragment = render(
    [
      '### 小标题',
      '',
      '- 第一项 **加粗**',
      '- 第二项 [1]',
      '',
      '1. 第一步',
      '2. 第二步',
      '',
      '> 引用一段话',
      '',
      '普通段落，带 `code`。',
    ].join('\n'),
  );
  const tags = new Set();
  const walk = (node) => {
    if (node.tagName) tags.add(node.tagName);
    for (const child of node.children || []) walk(child);
  };
  walk(fragment);
  for (const expected of ['H4', 'UL', 'OL', 'BLOCKQUOTE', 'P', 'STRONG', 'CODE', 'BUTTON']) {
    assert.ok(tags.has(expected), `缺少 <${expected.toLowerCase()}> 节点，实际: ${[...tags].join(',')}`);
  }
});

test('引用角标 [n] 渲染成可点击的 cite 按钮，且文本原样保留', () => {
  const fragment = render('可以退 [1]，运费由平台承担 [2]。');
  const buttons = [];
  const walk = (node) => {
    if (node.tagName === 'BUTTON') buttons.push(node);
    for (const child of node.children || []) walk(child);
  };
  walk(fragment);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].dataset.marker, '1');
  assert.equal(buttons[1].dataset.marker, '2');
  assert.match(fragment.textContent, /可以退 \[1\]/);
});

test('空输入 / 纯空白 / 超长单行都安全', () => {
  assert.ok(render(''));
  assert.ok(render('\n\n\n'));
  assert.ok(render('   '));
  assert.ok(render('一'.repeat(5000)));
});
