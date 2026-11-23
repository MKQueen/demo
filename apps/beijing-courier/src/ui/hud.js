// 游戏内 HUD：右侧手绘图标按钮 / 对话气泡 / 任务目标 / 互动提示 /
// toast / 区域标题 / 表情轮盘
// ---------------------------------------------------------------------------
// createHud({ root, callbacks }) → {
//   el, show(), hide(),
//   openDialogue(line), setDialogueText(text, typing), closeDialogue(),
//   setDialogueNextEnabled(bool),
//   setObjective(text, {kicker}), clearObjective(),
//   showInteract(label), hideInteract(), setTouchInteract(bool),
//   toast(text, duration), showZone(cn, latin),
//   setSoundMuted(bool), setChecklistDot(bool), setSideVisible(bool),
//   openEmoji(), closeEmoji(), toggleEmoji(), isEmojiOpen(),
// }
// ---------------------------------------------------------------------------

import {
  iconList,
  iconSound,
  iconSoundMuted,
  iconTshirt,
  iconPoo,
  iconPlayArrow,
  iconLetter,
  iconCheck,
  EMOJI_FACES,
  svgEl,
} from './icons.js';

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

function hasCJK(text) {
  return CJK_RE.test(text || '');
}

export function createHud(options = {}) {
  const { root, callbacks = {}, audio = null } = options;

  const el = document.createElement('div');
  el.className = 'bc-hud';
  el.innerHTML = `
    <div class="bc-sides" aria-label="随身工具">
      <button class="bc-sides__btn bc-sides__btn--list" type="button" aria-label="清单" title="清单 (B)">
        ${iconList}
        <span class="bc-sides__dot" aria-hidden="true"></span>
      </button>
      <div class="bc-sides__lower">
        <button class="bc-sides__btn bc-sides__btn--sound" type="button" aria-label="声音" title="声音 (M)">
          <span class="bc-sides__sound">${iconSound}</span>
          <span class="bc-sides__muted">${iconSoundMuted}</span>
        </button>
        <button class="bc-sides__btn bc-sides__btn--outfit" type="button" aria-label="换装" title="换装 (C)">
          ${iconTshirt}
        </button>
        <button class="bc-sides__btn bc-sides__btn--emoji" type="button" aria-label="表情" title="表情 (Q)">
          ${iconPoo}
        </button>
      </div>
    </div>

    <div class="bc-objective bc-paper" role="status">
      <span class="bc-objective__icon">${iconLetter}</span>
      <span class="bc-objective__body">
        <span class="bc-objective__kicker">今日投递 · NEXT UP</span>
        <span class="bc-objective__text"></span>
      </span>
    </div>

    <div class="bc-dialog" role="dialog" aria-live="polite" aria-label="对话">
      <div class="bc-dialog__tag"><span class="bc-dialog__tag-name"></span></div>
      <div class="bc-dialog__box">
        <p class="bc-dialog__text"></p>
      </div>
      <button class="bc-dialog__next" type="button" aria-label="继续">
        ${iconPlayArrow}
      </button>
    </div>

    <div class="bc-interact bc-paper" role="button" tabindex="0">
      <span class="bc-interact__key">E</span>
      <span class="bc-interact__label"></span>
    </div>

    <div class="bc-toast bc-paper" role="status"></div>

    <div class="bc-zone" aria-hidden="true">
      <div class="bc-zone__cn"></div>
      <div class="bc-zone__latin"></div>
      <div class="bc-zone__rule"></div>
    </div>

    <div class="bc-emoji bc-paper" role="menu" aria-label="表情"></div>
  `;

  root.appendChild(el);

  const sidesEl = el.querySelector('.bc-sides');
  const listBtn = el.querySelector('.bc-sides__btn--list');
  const soundBtn = el.querySelector('.bc-sides__btn--sound');
  const outfitBtn = el.querySelector('.bc-sides__btn--outfit');
  const emojiBtn = el.querySelector('.bc-sides__btn--emoji');
  const objectiveEl = el.querySelector('.bc-objective');
  const objectiveKicker = el.querySelector('.bc-objective__kicker');
  const objectiveText = el.querySelector('.bc-objective__text');
  const dialogEl = el.querySelector('.bc-dialog');
  const dialogTag = el.querySelector('.bc-dialog__tag');
  const dialogName = el.querySelector('.bc-dialog__tag-name');
  const dialogText = el.querySelector('.bc-dialog__text');
  const dialogNext = el.querySelector('.bc-dialog__next');
  const interactEl = el.querySelector('.bc-interact');
  const interactLabel = el.querySelector('.bc-interact__label');
  const toastEl = el.querySelector('.bc-toast');
  const zoneEl = el.querySelector('.bc-zone');
  const zoneCn = el.querySelector('.bc-zone__cn');
  const zoneLatin = el.querySelector('.bc-zone__latin');
  const emojiEl = el.querySelector('.bc-emoji');

  // ---- 右侧按钮 ----------------------------------------------------------
  listBtn.addEventListener('click', () => {
    audio?.playCue?.('click');
    callbacks.onChecklist?.();
  });
  soundBtn.addEventListener('click', () => {
    audio?.playCue?.('click');
    callbacks.onSound?.();
  });
  outfitBtn.addEventListener('click', () => {
    audio?.playCue?.('click');
    callbacks.onOutfit?.();
  });
  emojiBtn.addEventListener('click', () => {
    audio?.playCue?.('emoji');
    toggleEmoji();
    callbacks.onEmojiToggle?.(emojiEl.classList.contains('is-open'));
  });

  // ---- 对话 --------------------------------------------------------------
  let onNext = null;
  dialogNext.addEventListener('click', () => {
    audio?.playCue?.('click');
    onNext?.();
  });
  // 点击气泡本身也能推进（原站箭头是主要入口，气泡点击更宽容）
  el.querySelector('.bc-dialog__box').addEventListener('click', (event) => {
    if (event.target.closest('.bc-dialog__next')) return;
    audio?.playCue?.('click');
    onNext?.();
  });

  let toastTimer = 0;
  let zoneTimer = 0;
  let activeInteract = null;

  function toggleEmoji(force) {
    const open = force == null ? !emojiEl.classList.contains('is-open') : !!force;
    emojiEl.classList.toggle('is-open', open);
    return open;
  }

  // 生成 10 个手绘表情按钮
  const faceButtons = EMOJI_FACES.map((face, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bc-emoji__face';
    btn.setAttribute('aria-label', `表情 ${index + 1}`);
    btn.innerHTML = face;
    btn.addEventListener('click', () => {
      audio?.playCue?.('emoteStart');
      toggleEmoji(false);
      callbacks.onEmote?.(index);
    });
    emojiEl.appendChild(btn);
    return btn;
  });

  return {
    el,
    sidesEl,
    show() {
      el.classList.add('is-on');
    },
    hide() {
      el.classList.remove('is-on');
    },
    setSideVisible(visible) {
      sidesEl.classList.toggle('is-hidden', !visible);
    },
    setSideVisibleAnimated(visible) {
      this.setSideVisible(visible);
    },

    // ---- 对话 ----
    openDialogue({ name = '', color = '#66BDE6', text = '', visibleText = '' } = {}) {
      dialogTag.style.background = color;
      dialogName.textContent = name;
      dialogName.classList.toggle('is-cn', hasCJK(name));
      const cn = hasCJK(text || visibleText);
      dialogText.classList.toggle('is-cn', cn);
      dialogText.textContent = visibleText || '';
      dialogEl.classList.add('is-on');
    },
    setDialogueText(visibleText, typing = false) {
      dialogText.textContent = visibleText;
      dialogText.classList.toggle('is-typing', !!typing);
    },
    closeDialogue() {
      dialogEl.classList.remove('is-on');
    },
    setDialogueNextEnabled(enabled) {
      dialogNext.disabled = !enabled;
      dialogNext.style.opacity = enabled ? '' : '0.6';
      dialogNext.style.pointerEvents = enabled ? 'auto' : 'none';
    },
    onNextClick(fn) {
      onNext = fn;
    },
    isDialogueOpen() {
      return dialogEl.classList.contains('is-on');
    },

    // ---- 任务目标 ----
    setObjective(text, opts = {}) {
      if (!text) {
        this.clearObjective();
        return;
      }
      objectiveText.textContent = text;
      if (opts.kicker) objectiveKicker.textContent = opts.kicker;
      objectiveEl.classList.add('is-on');
    },
    clearObjective() {
      objectiveEl.classList.remove('is-on');
    },

    // ---- 互动提示 ----
    showInteract(label, cb) {
      activeInteract = cb || null;
      interactLabel.textContent = label || '交谈';
      interactEl.classList.add('is-on');
      interactEl.classList.add('is-touch-ready');
    },
    hideInteract() {
      activeInteract = null;
      interactEl.classList.remove('is-on');
    },
    triggerInteract() {
      if (!interactEl.classList.contains('is-on')) return false;
      audio?.playCue?.('click');
      activeInteract?.();
      return true;
    },
    setTouchInteract(on) {
      interactEl.classList.toggle('is-touch', !!on);
    },

    // ---- toast ----
    toast(text, duration = 2600) {
      toastEl.textContent = text;
      toastEl.classList.add('is-on');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('is-on'), duration);
    },

    // ---- 区域标题 ----
    showZone(cn, latin = '', duration = 2600) {
      zoneCn.textContent = cn;
      zoneLatin.textContent = latin;
      zoneEl.classList.add('is-on');
      window.clearTimeout(zoneTimer);
      zoneTimer = window.setTimeout(() => zoneEl.classList.remove('is-on'), duration);
    },

    // ---- 声音 / 清单红点 ----
    setSoundMuted(muted) {
      soundBtn.classList.toggle('is-muted', !!muted);
      soundBtn.setAttribute('aria-label', muted ? '取消静音' : '声音');
    },
    setChecklistDot(on) {
      listBtn.classList.toggle('has-dot', !!on);
    },

    // ---- 表情 ----
    openEmoji() {
      return toggleEmoji(true);
    },
    closeEmoji() {
      return toggleEmoji(false);
    },
    toggleEmoji,
    isEmojiOpen() {
      return emojiEl.classList.contains('is-open');
    },

    // ---- 生命周期 ----
    destroy() {
      el.remove();
    },

    // 供 dom.js 绑定输入用
    elements: {
      interactEl,
      dialogEl,
      sidesEl,
      emojiEl,
      faces: faceButtons,
    },
  };
}

export default createHud;
