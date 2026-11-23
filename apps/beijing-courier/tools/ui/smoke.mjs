// 纯 Node 冒烟测试（不需要浏览器 / dev server）
//   node tools/ui/smoke.mjs
// 覆盖：story 数据完整性、dialogue 状态机、audio 无 AudioContext 时的降级、
//       四个 UI 模块能否在 Node 下被 import（它们只在函数里用 document）。
import assert from 'node:assert/strict';

const { LETTERS, NPC_INFO, REGIONS, INTRO_LINES, ENDING_LINES, checklistItems, scriptFor, regionOf, lettersForNpc } =
  await import('../../src/game/story.js');
const { createDialogue } = await import('../../src/game/dialogue.js');
const { createAudio, CUES } = await import('../../src/game/audio.js');
const introMod = await import('../../src/ui/intro.js');
const hudMod = await import('../../src/ui/hud.js');
const overlaysMod = await import('../../src/ui/overlays.js');
const touchMod = await import('../../src/ui/touch.js');
const iconsMod = await import('../../src/ui/icons.js');

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

// ---------- story ----------
ok(LETTERS.length === 5, '应该有 5 封信');
ok(new Set(LETTERS.map((l) => l.id)).size === 5, '信的 id 唯一');
const REQUIRED = ['id', 'order', 'title', 'item', 'giverModel', 'giverSpot', 'targetModel', 'targetSpot', 'pickupSpot', 'objective', 'ask', 'reply', 'doneText'];
for (const letter of LETTERS) {
  for (const key of REQUIRED) ok(letter[key] != null, `${letter.id} 缺字段 ${key}`);
  ok(NPC_INFO[letter.target], `${letter.id} target 不在 NPC_INFO`);
  ok(NPC_INFO[letter.giver], `${letter.id} giver 不在 NPC_INFO`);
  ok(REGIONS[letter.targetRegion], `${letter.id} targetRegion 无 REGIONS`);
  ok(letter.ask.length >= 2 && letter.reply.length >= 2, `${letter.id} 对话太短`);
  for (const line of [...letter.ask, ...letter.reply]) {
    ok(typeof line.text === 'string' && line.text.length > 0, `${letter.id} 空对话`);
    ok(typeof line.name === 'string' && line.name.length > 0, `${letter.id} 对话缺 name`);
  }
}
ok(INTRO_LINES.length === 3, '开场 3 句');
ok(ENDING_LINES.length >= 2, '收尾文案');
const states = { [LETTERS[0].id]: 'done', [LETTERS[1].id]: 'carrying' };
const items = checklistItems(states);
ok(items.length === 5, 'checklistItems 返回 5 条');
ok(items[0].done === true && items[0].status === 'done', 'done 状态');
ok(items[1].status === 'carrying', 'carrying 状态');
ok(items[2].status === 'pending', 'pending 状态');
ok(scriptFor(LETTERS[0].id, 'ask').length > 0, 'scriptFor ask');
ok(scriptFor(LETTERS[0].id, 'done')[0].text === LETTERS[0].doneText, 'scriptFor done');
ok(regionOf(LETTERS[0].giverSpot) === LETTERS[0].giverRegion, 'regionOf 映射');
ok(lettersForNpc('chef').length >= 1, 'lettersForNpc');

// 区县 / 环境音 key 合法
const OK_AMBIENCE = new Set(['base', 'beach', 'village', 'city', 'factory', 'forest', 'temple', 'waterfalls']);
for (const region of Object.values(REGIONS)) ok(OK_AMBIENCE.has(region.ambience), `未知环境音 ${region.ambience}`);

// ---------- dialogue 状态机 ----------
const events = [];
const dialogue = createDialogue({
  charsPerSecond: 1000,
  onLineStart: ({ line }) => events.push(['start', line.text]),
  onLineEnd: ({ line }) => events.push(['end', line.text]),
  onTalk: (npc, talking) => events.push(['talk', npc, talking]),
  onDone: () => events.push(['done']),
});
ok(dialogue.active === false, '初始不活跃');
dialogue.start([
  { name: 'A', text: '你好。', npc: 'chef' },
  { name: 'B', text: '嗯。', npc: 'diver' },
]);
ok(dialogue.active === true && dialogue.typing === true, 'start 后活跃且打字中');
ok(dialogue.current.index === 0 && dialogue.current.total === 2, '第一句');
ok(events.some((e) => e[0] === 'talk' && e[1] === 'chef' && e[2] === true), 'NPC 开始说话事件');
// 第一句很快打完
for (let i = 0; i < 20; i += 1) dialogue.update(0.1);
ok(dialogue.typing === false, '第一句打完');
ok(dialogue.visibleText === '你好。', '整句可见');
ok(events.some((e) => e[0] === 'talk' && e[2] === false), 'NPC 闭嘴事件');
// 点击推进
dialogue.advance();
ok(dialogue.current.index === 1, '推进到第二句');
for (let i = 0; i < 20; i += 1) dialogue.update(0.1);
ok(dialogue.typing === false, '第二句打完');
dialogue.advance(); // 最后一句再点一次 → done
ok(dialogue.active === false, '结束后不活跃');
ok(events.some((e) => e[0] === 'done'), 'onDone 触发');
// 打字中 advance 先跳字
const d2 = createDialogue({ charsPerSecond: 5 });
d2.start([{ name: 'A', text: '这是一句比较长的话。' }]);
d2.update(0.2);
ok(d2.typing === true, '慢速正在打字');
const before = d2.visibleText.length;
d2.advance();
ok(d2.typing === false && d2.visibleText.length > before, 'advance 跳字');
d2.stop();
ok(d2.active === false, 'stop');
// 标点停顿（不应崩溃）
const d3 = createDialogue({ charsPerSecond: 30 });
d3.start([{ name: 'A', text: '先停一下，再走。' }]);
for (let i = 0; i < 80; i += 1) d3.update(1 / 60);
ok(d3.typing === false && d3.visibleText.endsWith('。'), '标点停顿后仍能打完');

// ---------- audio 降级 ----------
const audio = createAudio(null);
ok(typeof audio.unlock === 'function', 'audio.unlock');
ok(typeof audio.setRegion === 'function', 'audio.setRegion');
ok(typeof audio.playCue === 'function', 'audio.playCue');
ok(audio.isMuted() === false, 'audio 默认不静音');
ok(audio.region === null, 'audio 默认无区域');
audio.unlock();
audio.setRegion('beach');
audio.playFootstep();
audio.playJump();
audio.playLand();
audio.playCue('click');
audio.setMuted(true);
ok(audio.isMuted() === true, 'audio 静音可设置');
audio.update();
audio.dispose();
ok(Object.keys(CUES).length >= 15, '音效 cue 数量');

// ---------- UI 模块可 import ----------
ok(typeof introMod.createIntro === 'function', 'createIntro');
ok(typeof hudMod.createHud === 'function', 'createHud');
ok(typeof overlaysMod.createOverlays === 'function', 'createOverlays');
ok(typeof touchMod.createTouch === 'function', 'createTouch');
ok(overlaysMod.OUTFIT_CATALOG.hair.ids.length === 7, 'OUTFIT_CATALOG.hair');
ok(iconsMod.EMOJI_FACES.length === 10, '10 个表情');

console.log(`\n✅ smoke ok — ${checks} 项检查通过`);
