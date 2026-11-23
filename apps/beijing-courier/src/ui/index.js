// 京城来信 · UI 唯一入口（Lead 从这里 import）
// ---------------------------------------------------------------------------
// 内部组合：intro.js / hud.js / overlays.js / touch.js，并引入 style.css。
// 不依赖 three.js，不操作 canvas，只往 #ui-root 里挂 DOM。
//
//   import { createUI } from './ui/index.js';
//   const ui = createUI({ audio });
//
// 门面 API 同时兼容两套命名：
//   · 老式：showDialogue({name, lines, onDone}) / showInteract(label, cb)
//   · 简写：showDialogue(lines, {onDone}) / showInteract(label) + onInteract(cb)
// 完整参数见 src/ui/README.md。
// ---------------------------------------------------------------------------

import './style.css';

import { createUI as createCoreUI } from './dom.js';
import { OUTFIT_CATALOG } from './overlays.js';
import {
  LETTERS,
  NPC_INFO,
  REGIONS,
  COURIER,
  INTRO_LINES,
  ENDING_LINES,
  getLetter,
  lettersForNpc,
  checklistItems,
  scriptFor,
  regionOf,
  SPOT_REGION,
} from '../game/story.js';

export { createDialogue } from '../game/dialogue.js';
export { createAudio, CUES } from '../game/audio.js';
export { OUTFIT_CATALOG } from './overlays.js';
export {
  LETTERS,
  NPC_INFO,
  REGIONS,
  COURIER,
  INTRO_LINES,
  ENDING_LINES,
  getLetter,
  lettersForNpc,
  checklistItems,
  scriptFor,
  regionOf,
  SPOT_REGION,
};
export { createIntro } from './intro.js';
export { createHud } from './hud.js';
export { createOverlays } from './overlays.js';
export { createTouch } from './touch.js';

const NOOP = () => {};

/**
 * 创建整套 DOM UI。
 * @param {object} opts
 * @param {HTMLElement} [opts.root=document.getElementById('ui-root')]
 * @param {object} [opts.audio] createAudio() 返回的控制器（可选，UI 只调 playCue/setRegion 等）
 * @param {object} [opts.intro] 传给开场界面的文案 { title, latin, eyebrow, cnLine, beginLabel, ... }
 * @param {Function} [opts.onBegin] BEGIN 点击回调
 * @param {Function} [opts.onTalk] (npcId, talking) => void，NPC 口型
 * @param {Function} [opts.onMove] (x,y) 触屏摇杆
 * @param {Function} [opts.onJump] () 触屏跳跃
 * @param {Function} [opts.onInteract] () 触屏/键 E 交互（也可以稍后 onInteract(cb) 注册）
 * @param {number} [opts.charsPerSecond=26] 打字机速度
 * @param {boolean} [opts.keys=true] 是否接管 Escape/Enter/B/C/M/Q/E 等 UI 键
 * @param {'auto'|true|false} [opts.touch='auto'] 触屏按钮
 * @returns {object} ui
 */
export function createUI(opts = {}) {
  const {
    onBegin,
    onMove,
    onJump,
    onInteract,
    onToggleSound,
    onTalk,
    ...rest
  } = opts;

  const beginHandlers = new Set();
  const interactHandlers = new Set();
  const soundHandlers = new Set();

  const core = createCoreUI({
    ...rest,
    onTalk,
    onBegin: () => {
      try {
        onBegin?.();
      } catch (err) {
        console.error('[ui] onBegin error:', err);
      }
      for (const fn of [...beginHandlers]) {
        try {
          fn();
        } catch (err) {
          console.error('[ui] onBegin handler error:', err);
        }
      }
    },
  });

  // 触屏 + opts 输入回调（Lead 也可以在创建时直接传）
  const inputController = {
    onMove: onMove || null,
    onJump: onJump || null,
    onInteract: onInteract || null,
  };
  core.bindInput({
    onMove: (x, y) => inputController.onMove?.(x, y),
    onJump: () => inputController.onJump?.(),
    onInteract: () => {
      if (inputController.onInteract) inputController.onInteract();
      else core.triggerInteract();
    },
  });

  // 保存原始实现，避免门面改写 core 时自我递归
  const coreShowDialogue = core.showDialogue.bind(core);
  const coreShowInteract = core.showInteract.bind(core);
  const coreUpdate = core.update.bind(core);
  const coreSetSound = core.setSound.bind(core);
  const coreOpenOutfit = core.openOutfit.bind(core);
  const coreSetOutfit = core.setOutfit.bind(core);

  // ---- 门面：在 core 上补齐 Lead 需要的命名 --------------------------------
  const ui = Object.assign(core, {
    /** 注册 BEGIN 回调（可多次注册） */
    onBegin(cb) {
      if (typeof cb === 'function') beginHandlers.add(cb);
      return () => beginHandlers.delete(cb);
    },

    /** 注册交互回调；showInteract(label) 会用它 */
    onInteract(cb) {
      if (typeof cb === 'function') interactHandlers.add(cb);
      return () => interactHandlers.delete(cb);
    },

    /** 注册静音切换回调（收到新的 muted 值） */
    onToggleSound(cb) {
      if (typeof cb === 'function') soundHandlers.add(cb);
      return () => soundHandlers.delete(cb);
    },

    /**
     * 显示对话。兼容两种签名：
     *   showDialogue({ name, lines, color, npc, voice, onDone }) → Promise
     *   showDialogue(lines, { onDone, name, color, npc })      → Promise
     * lines 允许是字符串数组或 { name, text, color, npc } 数组。
     */
    showDialogue(linesOrOptions, maybeOptions) {
      let payload = linesOrOptions;
      if (Array.isArray(linesOrOptions) || typeof linesOrOptions === 'string') {
        payload = { lines: Array.isArray(linesOrOptions) ? linesOrOptions : [linesOrOptions], ...(maybeOptions || {}) };
      } else if (linesOrOptions && maybeOptions) {
        payload = { ...linesOrOptions, ...maybeOptions };
      }
      return coreShowDialogue(payload);
    },

    isDialogueOpen() {
      return core.dialogue.active || core.hud.elements.dialogEl.classList.contains('is-on');
    },

    /** 设置静音；返回最终静音状态 */
    setMuted(muted) {
      return ui.setSound(!!muted);
    },
    isMuted() {
      return core.isSoundMuted();
    },
    toggleMute() {
      return ui.setSound(!core.isSoundMuted());
    },

    /** 显示互动提示；不传回调时使用 onInteract(cb) 注册的回调 */
    showInteract(label, cb) {
      const handler =
        cb ||
        (() => {
          for (const fn of [...interactHandlers]) {
            try {
              fn();
            } catch (err) {
              console.error('[ui] interact handler error:', err);
            }
          }
        });
      return coreShowInteract(label, handler);
    },

    /**
     * 打开换装。签名：openOutfit(current, catalog, onPick)
     * current: { hair:'hair3', top:'top2', bottom:'bottom4', shoes:'shoes5' }
     * catalog: { hair:{label,ids}, top:{...}, ... }（缺省用 OUTFIT_CATALOG）
     * onPick: (category, id, index) => avatar.setOutfit(...)
     */
    openOutfit(current, catalog, onPick) {
      coreSetOutfit(catalog || OUTFIT_CATALOG, current || {}, onPick);
      coreOpenOutfit();
    },

    /**
     * 把触屏摇杆/跳跃/交互接到控制器上：
     *   ui.bindTouch({ onMove, onJump, onInteract })  或
     *   ui.bindTouch(controller)  // controller 上找 onMove/move/setMove 等方法
     */
    bindTouch(controller = {}) {
      const get = (...names) => {
        for (const name of names) {
          if (typeof controller?.[name] === 'function') return controller[name].bind(controller);
        }
        return null;
      };
      inputController.onMove = get('onMove', 'move', 'setMove', 'moveInput') || inputController.onMove;
      inputController.onJump = get('onJump', 'jump') || inputController.onJump;
      inputController.onInteract = get('onInteract', 'interact') || inputController.onInteract;
      return ui;
    },

    /** 每帧调用；不传 dt 时按 1/60 推进打字机 */
    update(dt = 1 / 60) {
      return coreUpdate(dt);
    },

    // 快捷数据
    LETTERS,
    NPC_INFO,
    REGIONS,
    COURIER,
    OUTFIT_CATALOG,
  });

  // 静音回调：包一层 ui.setSound（Lead 也可以直接调 setMuted）
  ui.setSound = (muted) => {
    const value = coreSetSound(muted);
    for (const fn of [...soundHandlers]) {
      try {
        fn(value);
      } catch (err) {
        console.error('[ui] sound handler error:', err);
      }
    }
    return value;
  };

  // 兼容 Lead 可能用的别名
  ui.showLoading = ui.showLoading || NOOP;
  ui.hideLoading = ui.hideLoading || NOOP;

  return ui;
}

export default createUI;
