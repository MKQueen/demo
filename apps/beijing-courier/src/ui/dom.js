// 京城来信 · DOM UI 总入口
// ---------------------------------------------------------------------------
// 纯 DOM / CSS 实现，挂到 Lead 提供的 #ui-root 上（不覆盖 canvas，不改 index.html）。
// 所有交互元素的 pointer-events 单独打开；#ui-root 本身保持 pointer-events:none。
//
//   import { createUI } from './ui/dom.js';
//   const ui = createUI({ audio });
//
// 主要 API（详见 src/ui/README.md）：
//   开场/加载： showIntro() hideIntro() showLoading() hideLoading()
//   对话：      showDialogue({name, lines, color, voice, onDone}) → Promise
//               hideDialogue() advanceDialogue() get dialogue()
//   任务/清单： setObjective(text,{kicker}) setChecklist(items)
//               openChecklist() closeChecklist() toggleChecklist() isChecklistOpen()
//   互动：      showInteract(label, cb) hideInteract() triggerInteract()
//   换装：      setOutfit(outfits, current, onPick) openOutfit() closeOutfit()
//   声音：      setSound(muted) toggleSound() isSoundMuted()
//   表情：      openEmoji(cb) closeEmoji() setEmoteHandler(fn)
//   区域：      setRegion(name|{name,latin,ambience}) — 同时切环境音、显示区域标题
//   其它：      toast(text) setSideVisible(bool) setPhase('intro'|'game')
//               bindInput({onMove,onJump,onInteract}) setTouchVisible(bool)
//               update(dt) destroy() on(event, fn)
// ---------------------------------------------------------------------------

import './style.css';
import { createDialogue } from '../game/dialogue.js';
import { REGIONS } from '../game/story.js';
import { createIntro } from './intro.js';
import { createHud } from './hud.js';
import { createOverlays, OUTFIT_CATALOG } from './overlays.js';
import { createTouch } from './touch.js';

const TOUCH_QUERY = '(pointer: coarse)';

// Lead 的世界区域 id → story.REGIONS 的别名（main.js 里 REGION_TO_STORY 的产物）
const REGION_ALIASES = {
  harbor: 'beach',
  city: 'village',
  countryside: 'forest',
  mountain: 'temple',
  falls: 'waterfalls',
  town: 'village',
};

function isTouchDevice() {
  try {
    return window.matchMedia?.(TOUCH_QUERY)?.matches || 'ontouchstart' in window;
  } catch {
    return 'ontouchstart' in window;
  }
}

function normalizeScript(input, defaults = {}) {
  const { name = '', color, npc, voice } = defaults;
  const mapLine = (line) => {
    if (typeof line === 'string') return { name, text: line, color, npc, voice };
    if (!line || typeof line.text !== 'string') return null;
    return {
      name: line.name || name,
      text: line.text,
      color: line.color || color,
      npc: line.npc || npc,
      voice: line.voice || voice,
    };
  };
  let lines = [];
  let onDone = null;
  let onTalk = null;
  if (Array.isArray(input)) {
    lines = input;
  } else if (input && Array.isArray(input.lines)) {
    lines = input.lines;
    onDone = input.onDone || null;
    onTalk = input.onTalk || null;
  } else if (input && typeof input.text === 'string') {
    lines = [input];
    onDone = input.onDone || null;
    onTalk = input.onTalk || null;
  }
  return {
    lines: lines.map(mapLine).filter(Boolean),
    onDone,
    onTalk,
    defaults,
  };
}

export function createUI(options = {}) {
  const {
    root = document.getElementById('ui-root') || document.body,
    audio = null,
    intro = {},
    charsPerSecond = 26,
    keys = true,
    touch = 'auto',
    onBegin,
    onTalk,
    onEvent,
    phase: initialPhase = 'intro',
  } = options;

  const listeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    const set = listeners.get(event);
    if (set) {
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          console.error('[ui] listener error:', err);
        }
      }
    }
    onEvent?.(event, payload);
  }

  // ---- 容器 --------------------------------------------------------------
  const container = document.createElement('div');
  container.className = 'bc-ui';
  container.dataset.phase = initialPhase;
  container.setAttribute('data-ui', 'beijing-courier');
  root.appendChild(container);

  // ---- 各模块 ------------------------------------------------------------
  const initialMuted = audio?.isMuted?.() ?? false;

  const introView = createIntro({
    root: container,
    ...intro,
    onBegin() {
      audio?.playCue?.('buttons');
      onBegin?.();
      emit('begin');
    },
    onMuteClick() {
      ui.toggleSound();
    },
  });

  const hud = createHud({
    root: container,
    audio,
    callbacks: {
      onChecklist: () => ui.toggleChecklist(),
      onOutfit: () => ui.toggleOutfit(),
      onSound: () => ui.toggleSound(),
      onEmote: (index) => {
        emit('emote', { index });
        emoteHandler?.(index);
      },
      onEmojiToggle: (open) => emit('emoji', { open }),
    },
  });
  hud.setSoundMuted(initialMuted);

  // 覆盖层打开时临时藏起任务目标（参考站的清单/换装屏上除了面板和按钮外很干净）
  let lastObjective = null;
  let objectiveHiddenByOverlay = false;
  function hideObjectiveForOverlay() {
    if (lastObjective && !objectiveHiddenByOverlay) {
      objectiveHiddenByOverlay = true;
      hud.clearObjective();
    }
  }
  function restoreObjectiveAfterOverlay() {
    if (lastObjective && objectiveHiddenByOverlay) {
      objectiveHiddenByOverlay = false;
      hud.setObjective(lastObjective.text, lastObjective.kicker ? { kicker: lastObjective.kicker } : {});
    }
  }

  const overlays = createOverlays({
    root: container,
    audio,
    callbacks: {
      onChecklistOpen: () => {
        hud.setChecklistDot(false);
        // 参考图里清单打开时右侧按钮保留可见（清单面板在按钮列左边）
        hideObjectiveForOverlay();
        emit('checklistOpen');
      },
      onChecklistClose: () => {
        restoreObjectiveAfterOverlay();
        emit('checklistClose');
      },
      onOutfitOpen: () => {
        hud.setSideVisible(false);
        hud.hideInteract();
        hideObjectiveForOverlay();
        emit('outfitOpen');
      },
      onOutfitClose: () => {
        hud.setSideVisible(true);
        restoreObjectiveAfterOverlay();
        emit('outfitClose');
      },
      onOutfitPick: (category, id, index) => emit('outfitPick', { category, id, index }),
    },
  });

  const touchInput = createTouch({
    root: container,
    callbacks: {
      onMove: (x, y) => input.onMove?.(x, y),
      onJump: () => input.onJump?.(),
      onInteract: () => ui.triggerInteract(),
    },
  });

  // ---- 输入绑定 ----------------------------------------------------------
  const input = { onMove: null, onLook: null, onJump: null, onInteract: null };
  // 触屏按钮是否显示
  const touchEnabled = touch === true || (touch === 'auto' && isTouchDevice());
  if (touchEnabled) {
    touchInput.setVisible(true);
    hud.setTouchInteract(true);
  } else if (touch === false) {
    touchInput.setVisible(false);
  }

  // ---- 对话状态机 --------------------------------------------------------
  let dialogResolve = null;
  let dialogOnDone = null;
  let dialogOnTalk = null;
  let lastExternalUpdate = 0;

  const dialogue = createDialogue({
    charsPerSecond,
    onLineStart: ({ line }) => {
      hud.openDialogue({ name: line.name, color: line.color, text: line.text, visibleText: '' });
      hud.setDialogueText('', true);
      hud.setDialogueNextEnabled(true);
      audio?.playCue?.('bubbleStart');
      emit('lineStart', { line });
    },
    onType: ({ line, visibleText }) => {
      hud.setDialogueText(visibleText, true);
      emit('line', { line, visibleText });
    },
    onLineEnd: ({ line }) => {
      hud.setDialogueText(line.text, false);
      emit('lineEnd', { line });
    },
    onTalk: (npc, talking) => {
      onTalk?.(npc, talking);
      dialogOnTalk?.(npc, talking);
      emit('talk', { npc, talking });
    },
    onDone: () => finalizeDialogue(),
  });

  // 点击右下角蓝色箭头 / 气泡 → 推进对话（Lead 不需要额外接线）
  hud.onNextClick(() => dialogue.advance());

  function finalizeDialogue() {
    hud.setDialogueNextEnabled(true);
    audio?.playCue?.('bubbleEnd');
    // 延长一点点再收起，让最后一句被看见
    window.setTimeout(() => {
      hud.closeDialogue();
      hud.setSideVisible(true);
      emit('dialogueDone');
    }, 120);
    const resolve = dialogResolve;
    const doneCb = dialogOnDone;
    dialogResolve = null;
    dialogOnDone = null;
    dialogOnTalk = null;
    doneCb?.();
    resolve?.();
  }

  // ---- 区域 --------------------------------------------------------------
  let currentRegion = null;

  // ---- 键盘 --------------------------------------------------------------
  function onKeyDown(event) {
    if (!keys) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = event.key;
    const phase = container.dataset.phase;

    // 开场：回车/空格 = 开始
    if (phase === 'intro') {
      if (key === 'Enter' || key === ' ') {
        if (!introView.visible) return;
        event.preventDefault();
        introView.beginButton.click();
        return;
      }
    }

    // 对话：回车/空格/E 推进
    if (dialogue.active && (key === 'Enter' || key === ' ' || key === 'e' || key === 'E')) {
      event.preventDefault();
      event.stopPropagation();
      dialogue.advance();
      return;
    }

    if (key === 'Escape') {
      if (overlays.isAnyOpen()) {
        event.preventDefault();
        overlays.closeAll();
        return;
      }
      if (hud.isEmojiOpen()) {
        event.preventDefault();
        hud.closeEmoji();
        return;
      }
    }

    if (event.repeat) return;

    // 清单 / 换装 / 静音 / 表情
    if (key === 'b' || key === 'B') {
      if (phase === 'game') {
        event.preventDefault();
        ui.toggleChecklist();
      }
      return;
    }
    if (key === 'c' || key === 'C') {
      if (phase === 'game') {
        event.preventDefault();
        ui.toggleOutfit();
      }
      return;
    }
    if (key === 'm' || key === 'M') {
      event.preventDefault();
      ui.toggleSound();
      return;
    }
    if (key === 'q' || key === 'Q') {
      if (phase === 'game') {
        event.preventDefault();
        ui.toggleEmoji();
      }
      return;
    }
    // 交互：只有当提示显示时才吃 E，避免和 Lead 的按键冲突
    if ((key === 'e' || key === 'E') && hud.elements.interactEl.classList.contains('is-on')) {
      event.preventDefault();
      ui.triggerInteract();
    }
  }

  if (keys) document.addEventListener('keydown', onKeyDown);

  // ---- 内部 rAF：驱动打字机（Lead 不调用 update 也能工作） ---------------
  let rafId = 0;
  let lastTime = 0;
  function loop(now) {
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;
    // 外部已经调了 update 就不再重复推进
    if (now - lastExternalUpdate > 120) dialogue.update(dt);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // ---- 清单状态 ----------------------------------------------------------
  let checklistData = [];
  let checklistOpenedOnce = false;
  let checklistDirty = false;

  // ---- 表情 --------------------------------------------------------------
  let emoteHandler = null;

  // ---- 对外对象 ----------------------------------------------------------
  const ui = {
    container,
    intro: introView,
    hud,
    overlays,
    touch: touchInput,
    dialogue,
    OUTFIT_CATALOG,

    // ---------- 阶段 / 开场 ----------
    showIntro() {
      container.dataset.phase = 'intro';
      introView.show();
      hud.hide();
      touchInput.setVisible(false);
      emit('phase', { phase: 'intro' });
    },
    hideIntro({ immediate = false } = {}) {
      introView.hide();
      if (immediate) introView.el.style.display = 'none';
      emit('introHidden');
    },
    showLoading() {
      introView.showLoading();
      hud.hide();
      touchInput.setVisible(false);
      emit('loading', { visible: true });
    },
    hideLoading() {
      introView.hideLoading();
      emit('loading', { visible: false });
    },
    setPhase(phase) {
      container.dataset.phase = phase;
      if (phase === 'game') {
        introView.hide();
        introView.hideLoading();
        hud.show();
        if (touchEnabled) touchInput.setVisible(true);
      } else if (phase === 'intro') {
        hud.hide();
        touchInput.setVisible(false);
      }
      emit('phase', { phase });
    },
    get phase() {
      return container.dataset.phase;
    },

    // ---------- 对话 ----------
    /**
     * 显示一段对话。
     * @returns {Promise<void>} 对话结束时 resolve
     */
    showDialogue(script) {
      const normalized = normalizeScript(script);
      if (!normalized.lines.length) return Promise.resolve();
      // 打断上一段
      if (dialogue.active) {
        const prevResolve = dialogResolve;
        dialogue.stop();
        dialogResolve = null;
        dialogOnDone = null;
        prevResolve?.();
      }
      dialogOnDone = normalized.onDone;
      dialogOnTalk = normalized.onTalk || null;
      if (normalized.onTalk) normalized.onTalk = undefined;
      hud.setSideVisible(false);
      hud.setChecklistDot(false);
      return new Promise((resolve) => {
        dialogResolve = resolve;
        dialogue.start(normalized.lines);
      });
    },
    hideDialogue() {
      if (!dialogue.active) {
        hud.closeDialogue();
        return;
      }
      dialogue.stop();
      hud.closeDialogue();
      hud.setSideVisible(true);
      const resolve = dialogResolve;
      dialogResolve = null;
      dialogOnDone = null;
      resolve?.();
      emit('dialogueHidden');
    },
    advanceDialogue() {
      return dialogue.advance();
    },
    get dialogueActive() {
      return dialogue.active;
    },
    setDialogueSpeed(cps) {
      dialogue.setSpeed?.(cps);
    },

    // ---------- 目标 / 清单 ----------
    setObjective(text, opts = {}) {
      lastObjective = text ? { text, kicker: opts.kicker || '' } : null;
      objectiveHiddenByOverlay = false;
      hud.setObjective(text, opts);
      emit('objective', { text });
    },
    clearObjective() {
      lastObjective = null;
      objectiveHiddenByOverlay = false;
      hud.clearObjective();
    },
    setChecklist(items) {
      checklistData = items || [];
      overlays.checklist.setItems(checklistData);
      if (!checklistOpenedOnce && checklistData.some((item) => item.status !== 'done')) {
        hud.setChecklistDot(true);
        checklistDirty = true;
      }
      emit('checklistData', { items: checklistData });
    },
    openChecklist(items) {
      if (items) ui.setChecklist(items);
      else overlays.checklist.setItems(checklistData);
      overlays.checklist.open();
    },
    closeChecklist() {
      overlays.checklist.close();
    },
    toggleChecklist() {
      if (overlays.checklist.isOpen) ui.closeChecklist();
      else {
        checklistOpenedOnce = true;
        checklistDirty = false;
        ui.openChecklist();
      }
    },
    isChecklistOpen() {
      return overlays.checklist.isOpen;
    },
    /** 新的信出现在清单里时，给列表按钮加个红点 */
    markChecklistNew() {
      hud.setChecklistDot(true);
    },

    // ---------- 互动 ----------
    showInteract(label, cb) {
      hud.showInteract(label, () => {
        ui.hideInteract();
        cb?.();
      });
      touchInput.setInteractVisible(true);
      emit('interactShow', { label });
    },
    hideInteract() {
      hud.hideInteract();
      touchInput.setInteractVisible(false);
      emit('interactHide');
    },
    triggerInteract() {
      return hud.triggerInteract();
    },
    get interactVisible() {
      return hud.elements.interactEl.classList.contains('is-on');
    },

    // ---------- 换装 ----------
    setOutfit(outfits, current, onPick) {
      overlays.outfit.setState({ outfits: outfits || OUTFIT_CATALOG, current, onPick });
      emit('outfitState', { current });
    },
    openOutfit() {
      overlays.outfit.open();
    },
    closeOutfit() {
      overlays.outfit.close();
    },
    toggleOutfit() {
      overlays.outfit.toggle();
    },
    isOutfitOpen() {
      return overlays.outfit.isOpen;
    },
    get outfitCurrent() {
      return overlays.outfit.current;
    },

    // ---------- 声音 ----------
    setSound(muted) {
      const value = audio ? audio.setMuted(!!muted) : !!muted;
      hud.setSoundMuted(value);
      emit('sound', { muted: value });
      return value;
    },
    toggleSound() {
      const next = audio ? !(audio.isMuted?.() ?? false) : null;
      const value = ui.setSound(next == null ? true : next);
      return value;
    },
    isSoundMuted() {
      return audio?.isMuted?.() ?? false;
    },

    // ---------- 表情 ----------
    openEmoji(cb) {
      if (cb) emoteHandler = cb;
      hud.openEmoji();
    },
    closeEmoji() {
      hud.closeEmoji();
    },
    toggleEmoji() {
      hud.toggleEmoji();
    },
    setEmoteHandler(fn) {
      emoteHandler = fn;
    },

    // ---------- 区域 ----------
    setRegion(nameOrInfo) {
      let info;
      if (typeof nameOrInfo === 'string') {
        const key = REGION_ALIASES[nameOrInfo] || nameOrInfo;
        info = REGIONS[key] || { name: nameOrInfo, latin: '', ambience: nameOrInfo };
      } else if (nameOrInfo) {
        info = nameOrInfo;
      } else return;
      const key = info.ambience || info.key || info.name;
      if (key === currentRegion) return;
      currentRegion = key;
      hud.showZone(info.name || '', info.latin || '');
      audio?.setRegion?.(key);
      emit('region', { name: info.name, latin: info.latin, key });
    },
    get region() {
      return currentRegion;
    },

    // ---------- 其它 ----------
    setSideVisible(visible) {
      hud.setSideVisible(!!visible);
    },
    toast(text, duration) {
      hud.toast(text, duration);
      emit('toast', { text });
    },
    bindInput(handlers = {}) {
      Object.assign(input, handlers || {});
      if ((touch === 'auto' && isTouchDevice()) || touch === true) {
        touchInput.setVisible(true);
      }
      return () => {
        for (const key of Object.keys(handlers || {})) input[key] = null;
      };
    },
    setTouchVisible(visible) {
      touchInput.setVisible(!!visible);
      hud.setTouchInteract(!!visible);
    },
    setHudVisible(visible) {
      if (visible) hud.show();
      else hud.hide();
    },
    update(dt) {
      lastExternalUpdate = performance.now();
      dialogue.update(dt);
      audio?.update?.(dt);
    },
    on,
    off: on,
    destroy() {
      if (keys) document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(rafId);
      overlays.destroy();
      hud.destroy();
      touchInput.destroy();
      introView.destroy();
      container.remove();
    },
    // 触屏按键直接转发（Harness / 调试用）
    _input: input,
  };

  return ui;
}

export default createUI;
