// 静态 UI 验收台的场景编排（Vite dev server 下运行，无 three.js）
// 截图：node tools/ui/shot.mjs
// 手动：http://127.0.0.1:5190/tools/ui/test.html#outfit

import { createUI, INTRO_LINES, checklistItems } from '../../src/ui/index.js';

const params = new URLSearchParams(location.search);
const clean = params.get('clean') === '1';
const screenParam = params.get('screen');
const hashScreen = location.hash.replace('#', '');
let screen = screenParam || hashScreen || 'intro';

if (clean) document.body.classList.add('clean');

const stage = document.getElementById('stage');
const sceneName = document.getElementById('scene-name');

const isTouch = screen === 'touch' || params.get('touch') === '1';

const ui = createUI({
  touch: isTouch ? true : 'auto',
  charsPerSecond: 30,
  onBegin() {
    showScene('loading');
    window.setTimeout(() => showScene('dialogue'), 1300);
  },
  onInteract() {
    ui.toast('（演示）你点了一下互动');
  },
});

// 演示用清单状态：第 1 封已送达、第 2 封在身上、其余在路上
function demoChecklist() {
  return checklistItems({
    'harbour-recipe': 'done',
    'village-postcard': 'carrying',
  });
}

function resetUI() {
  ui.hideLoading();
  ui.hideIntro();
  ui.hideDialogue();
  ui.closeChecklist();
  ui.closeOutfit();
  ui.closeEmoji();
  ui.hideInteract();
  ui.clearObjective();
  ui.setHudVisible(false);
  stage.className = '';
}

function showScene(name) {
  screen = name;
  if (!clean) {
    sceneName.textContent = name;
    history.replaceState(null, '', `?screen=${name}${clean ? '&clean=1' : ''}`);
    for (const btn of document.querySelectorAll('#debug button')) {
      btn.classList.toggle('is-active', btn.dataset.screen === name);
    }
  }
  resetUI();

  if (name === 'intro') {
    stage.className = 'stage--intro';
    ui.setPhase('intro');
    ui.showIntro();
    return;
  }

  if (name === 'loading') {
    stage.className = 'stage--intro';
    ui.setPhase('intro');
    ui.hideIntro();
    ui.showLoading();
    return;
  }

  // 其余都是游戏内
  stage.className = 'stage--game';
  ui.setPhase('game');
  ui.setHudVisible(true);

  if (name === 'dialogue') {
    ui.setObjective('把泡过海水的信送到码头饭馆的周师傅手里', {
      kicker: '今日投递 · 第 1 封 · NEXT UP',
    });
    ui.showDialogue({ lines: INTRO_LINES });
    return;
  }

  if (name === 'checklist') {
    ui.setObjective('把泡过海水的信送到码头饭馆的周师傅手里', {
      kicker: '今日投递 · 第 1 封 · NEXT UP',
    });
    ui.setChecklist(demoChecklist());
    ui.openChecklist();
    return;
  }

  if (name === 'outfit') {
    ui.openOutfit(
      { hair: 'hair3', top: 'top2', bottom: 'bottom4', shoes: 'shoes5' },
      undefined,
      (category, id) => ui.toast(`换上了 ${category} · ${id}`)
    );
    return;
  }

  if (name === 'emoji') {
    ui.setObjective('把泡过海水的信送到码头饭馆的周师傅手里', {
      kicker: '今日投递 · 第 1 封 · NEXT UP',
    });
    ui.openEmoji((index) => ui.toast(`发了一个表情 (${index + 1})`));
    return;
  }

  if (name === 'hud' || name === 'touch') {
    ui.setObjective('把泡过海水的信送到码头饭馆的周师傅手里', {
      kicker: '今日投递 · 第 1 封 · NEXT UP',
    });
    ui.setChecklist(demoChecklist());
    ui.setRegion('beach');
    ui.toast('送达 · 海底捞上来的信', 60000);
    ui.showInteract('和潜水员阿海说话');
    if (name === 'touch') ui.setTouchVisible(true);
    return;
  }
}

// 调试条
for (const btn of document.querySelectorAll('#debug button')) {
  btn.addEventListener('click', () => showScene(btn.dataset.screen));
}

// hash 变化（方便直接打开 #outfit）
window.addEventListener('hashchange', () => {
  const next = location.hash.replace('#', '');
  if (next) showScene(next);
});

// 等字体加载后再通知外部（截图脚本用）
document.fonts?.ready?.then(() => {
  document.body.dataset.fontsReady = '1';
});

showScene(screen);
