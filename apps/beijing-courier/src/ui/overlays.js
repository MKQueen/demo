// 覆盖层：清单 CHECKLIST / 换装 OUTFIT
// ---------------------------------------------------------------------------
// createOverlays({ root, callbacks, audio }) → {
//   checklist: { el, open(items), close(), toggle(items), setItems(items), isOpen },
//   outfit:    { el, open({outfits, current}), close(), setState({outfits,current}), isOpen },
//   closeAll(), isAnyOpen(),
// }
// 原站里这两块都是「白纸 + 石板蓝投影 + 手写体」；
// 清单挂在右上角（右 115px、上 50px，1440×900 基准），换装是绕着角色的 8 个方向键。
// ---------------------------------------------------------------------------

import {
  iconArrowLeft,
  iconArrowRight,
  iconCross,
  iconCheck,
} from './icons.js';

/** 默认换装目录（char-dev 的 avatar.setOutfit 接受这些 id）。 */
export const OUTFIT_CATALOG = {
  hair: { label: '头发', latin: 'HAIR', ids: ['hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6', 'hair7'] },
  top: { label: '上衣', latin: 'TOP', ids: ['top1', 'top2', 'top3', 'top4', 'top5', 'top6', 'top7', 'top8', 'top9'] },
  bottom: { label: '裤子', latin: 'BOTTOM', ids: ['bottom1', 'bottom2', 'bottom3', 'bottom4', 'bottom5', 'bottom6', 'bottom7'] },
  shoes: { label: '鞋子', latin: 'SHOES', ids: ['shoes1', 'shoes2', 'shoes3', 'shoes4', 'shoes5', 'shoes6', 'shoes7'] },
};

let OUTFIT_ROWS = ['hair', 'top', 'bottom', 'shoes'];

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

export function createOverlays(options = {}) {
  const { root, callbacks = {}, audio = null } = options;

  // ---- 清单 ---------------------------------------------------------------
  const checklistEl = el('aside', 'bc-checklist');
  checklistEl.setAttribute('aria-label', '投递清单');
  checklistEl.innerHTML = `
    <div class="bc-checklist__paper">
      <div class="bc-checklist__head">
        <span class="bc-checklist__title">清单</span>
        <span class="bc-checklist__latin">CHECKLIST</span>
      </div>
      <div class="bc-checklist__rule"></div>
      <ol class="bc-checklist__items"></ol>
      <div class="bc-checklist__foot">按 B 收起 · 五封信，一颗星</div>
    </div>
  `;
  const itemsEl = checklistEl.querySelector('.bc-checklist__items');

  let checklistOpen = false;
  let itemData = [];

  function renderChecklist() {
    itemsEl.replaceChildren();
    for (const item of itemData) {
      const li = el('li', 'bc-checklist__item');
      li.classList.toggle('is-done', !!item.done || item.status === 'done');
      li.classList.toggle('is-carrying', item.status === 'carrying');
      li.innerHTML = `
        <span class="bc-checklist__num">${item.order}.</span>
        <span class="bc-checklist__body">
          <span class="bc-checklist__row">
            <span class="bc-checklist__name">${item.title}</span>
            <span class="bc-checklist__count">${item.count || `${item.done ? 1 : 0}/1`}</span>
          </span>
          <span class="bc-checklist__meta">收件人 ${item.target} · ${item.place}</span>
        </span>
        <span class="bc-checklist__check">${iconCheck}</span>
      `;
      itemsEl.appendChild(li);
    }
  }

  function openChecklist(items) {
    if (Array.isArray(items)) {
      itemData = items;
      renderChecklist();
    }
    checklistOpen = true;
    checklistEl.classList.add('is-open');
    audio?.playCue?.('checklist');
    callbacks.onChecklistOpen?.();
  }

  function closeChecklist() {
    if (!checklistOpen) return;
    checklistOpen = false;
    checklistEl.classList.remove('is-open');
    audio?.playCue?.('paper');
    callbacks.onChecklistClose?.();
  }

  // ---- 换装 ---------------------------------------------------------------
  const outfitEl = el('div', 'bc-outfit');
  outfitEl.setAttribute('aria-label', '换装');
  const outfitButtons = {};

  const closeBtn = el('button', 'bc-outfit__btn bc-outfit__close', iconCross);
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭换装');
  closeBtn.addEventListener('click', () => {
    audio?.playCue?.('turn');
    closeOutfit();
  });
  outfitEl.appendChild(closeBtn);

  let outfitState = {
    outfits: OUTFIT_CATALOG,
    current: { hair: 'hair3', top: 'top2', bottom: 'bottom4', shoes: 'shoes5' },
    onPick: null,
  };

  let outfitRowsBuiltFor = '';
  function buildOutfitRows() {
    const signature = OUTFIT_ROWS.join('|');
    if (outfitRowsBuiltFor === signature) return;
    outfitRowsBuiltFor = signature;
    // remove previously built arrows / labels / hint (keep close button)
    for (const node of [...outfitEl.querySelectorAll('.bc-outfit__arrow, .bc-outfit__label, .bc-outfit__hint')]) node.remove();
    for (const key of OUTFIT_ROWS) {
      const catalog = outfitState.outfits[key] || OUTFIT_CATALOG[key];
      const rowIndex = OUTFIT_ROWS.indexOf(key) + 1;
      for (const dir of ['left', 'right']) {
        const btn = el('button', `bc-outfit__btn bc-outfit__arrow bc-outfit__arrow--${dir} bc-outfit__row${rowIndex}`);
        btn.type = 'button';
        btn.dataset.category = key;
        btn.dataset.dir = dir;
        btn.setAttribute('aria-label', `${catalog.label}${dir === 'left' ? '上一个' : '下一个'}`);
        btn.innerHTML = dir === 'left' ? iconArrowLeft : iconArrowRight;
        btn.addEventListener('click', () => {
          cycleOutfit(key, dir === 'left' ? -1 : 1);
        });
        outfitEl.appendChild(btn);
        outfitButtons[`${key}-${dir}`] = btn;
      }
      const label = el('div', `bc-outfit__label bc-outfit__label--row${rowIndex}`);
      label.innerHTML = `<b>${catalog.label}</b><span class="bc-outfit__count"></span>`;
      // 行位置与箭头所在行一致
      label.classList.add(`bc-outfit__row${rowIndex}`);
      label.dataset.category = key;
      outfitEl.appendChild(label);
    }
    const hint = el('div', 'bc-outfit__hint');
    hint.textContent = '左右挑选 · 按 C 试穿';
    outfitEl.appendChild(hint);
  }
  const labels = {};

  function refreshOutfitLabels() {
    for (const key of OUTFIT_ROWS) {
      const catalog = outfitState.outfits[key] || OUTFIT_CATALOG[key];
      const ids = catalog.ids || [];
      const current = outfitState.current?.[key];
      const index = Math.max(0, ids.indexOf(current));
      const labelEl = outfitEl.querySelector(`.bc-outfit__label[data-category="${key}"] .bc-outfit__count`);
      if (labelEl) labelEl.textContent = `${index + 1} / ${ids.length}`;
      labels[key] = index;
    }
  }

  function cycleOutfit(category, delta) {
    const catalog = outfitState.outfits[category] || OUTFIT_CATALOG[category];
    const ids = catalog.ids || [];
    if (!ids.length) return;
    const current = outfitState.current?.[category];
    const index = Math.max(0, ids.indexOf(current));
    const nextIndex = (index + delta + ids.length) % ids.length;
    const nextId = ids[nextIndex];
    outfitState.current = { ...outfitState.current, [category]: nextId };
    refreshOutfitLabels();
    audio?.playCue?.('clothes');
    outfitState.onPick?.(category, nextId, nextIndex);
    callbacks.onOutfitPick?.(category, nextId, nextIndex);
  }

  let outfitOpen = false;

  function setOutfitCategories(outfits) {
    if (!outfits) return;
    const categories = Object.keys(outfits).slice(0, 4);
    if (!categories.length) return;
    if (categories.join('|') !== OUTFIT_ROWS.join('|')) {
      OUTFIT_ROWS = categories;
    }
    buildOutfitRows();
  }

  function openOutfit(state) {
    if (state) {
      if (state.outfits) outfitState.outfits = state.outfits;
      if (state.current) outfitState.current = { ...outfitState.current, ...state.current };
      if (state.onPick) outfitState.onPick = state.onPick;
    }
    setOutfitCategories(outfitState.outfits);
    buildOutfitRows();
    refreshOutfitLabels();
    outfitOpen = true;
    outfitEl.classList.add('is-open');
    audio?.playCue?.('open');
    callbacks.onOutfitOpen?.();
  }

  function closeOutfit() {
    if (!outfitOpen) return;
    outfitOpen = false;
    outfitEl.classList.remove('is-open');
    callbacks.onOutfitClose?.();
  }

  // ---- 关闭所有 -----------------------------------------------------------
  function closeAll() {
    closeChecklist();
    closeOutfit();
  }

  // ---- 组装 ---------------------------------------------------------------
  const wrap = document.createDocumentFragment();
  wrap.append(checklistEl, outfitEl);
  root.appendChild(checklistEl);
  root.appendChild(outfitEl);

  return {
    checklistEl,
    outfitEl,
    checklist: {
      el: checklistEl,
      open: openChecklist,
      close: closeChecklist,
      toggle(items) {
        if (checklistOpen) closeChecklist();
        else openChecklist(items);
      },
      setItems(items) {
        itemData = items || [];
        renderChecklist();
      },
      get isOpen() {
        return checklistOpen;
      },
    },
    outfit: {
      el: outfitEl,
      open: openOutfit,
      close: closeOutfit,
      toggle(state) {
        if (outfitOpen) closeOutfit();
        else openOutfit(state);
      },
      setState(state) {
        outfitState = { ...outfitState, ...state };
        if (state?.current) outfitState.current = { ...outfitState.current, ...state.current };
        setOutfitCategories(outfitState.outfits);
        buildOutfitRows();
        refreshOutfitLabels();
      },
      get isOpen() {
        return outfitOpen;
      },
      get current() {
        return { ...outfitState.current };
      },
      get outfits() {
        return outfitState.outfits;
      },
    },
    closeAll,
    isAnyOpen() {
      return checklistOpen || outfitOpen;
    },
    destroy() {
      checklistEl.remove();
      outfitEl.remove();
    },
  };
}

export default createOverlays;
