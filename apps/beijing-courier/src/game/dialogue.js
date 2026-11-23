// 对话状态机（纯逻辑，无 DOM）
// ---------------------------------------------------------------------------
// 负责：对话排队、逐字打字机、点击/按键推进、说话事件（给角色口型用）。
// 不依赖任何渲染层，Lead 可以直接拿去驱动 NPC 动画，UI 层（src/ui）订阅它。
//
// 用法：
//   const dialogue = createDialogue({
//     charsPerSecond: 26,
//     onLineStart: ({ line, index, total }) => {...},   // 开始说一句
//     onType:      ({ visibleText, line }) => {...},   // 每个字打出来（可选）
//     onLineEnd:   ({ line, index, total }) => {...},  // 一句说完（含跳字）
//     onTalk:      (speaker, talking) => {...},        // 说话/闭嘴（口型）
//     onDone:      () => {...},                        // 整个队列播完
//   });
//   dialogue.start([{ name, color, text, npc, voice }...]);
//   dialogue.update(dt);        // 每帧调用（或由 createUI 内部 rAF 驱动）
//   dialogue.advance();         // 点击/回车：正在打字→立刻显示整句；已显示→下一句
//   dialogue.skipAll();         // 全部跳过
//   dialogue.stop();
//   dialogue.active / dialogue.typing / dialogue.current / dialogue.total
//
// line 结构：{ name, text, color?, npc?, voice? }
//   name  气泡名牌上的名字
//   color 名牌底色（不传则用 #66BDE6）
//   npc   NPC 模型 id（chef/oldwoman/...，用于 setTalking 口型）
//   voice 配音 key（male1/female1/...，可忽略）
// ---------------------------------------------------------------------------

const PUNCT_PAUSE = {
  '，': 1.6,
  '、': 1.4,
  '；': 1.8,
  '：': 1.4,
  '。': 2.6,
  '！': 2.4,
  '？': 2.4,
  '…': 2.2,
  '—': 1.2,
  ',': 1.3,
  '.': 2.2,
  '!': 1.9,
  '?': 1.9,
};

export function createDialogue(options = {}) {
  const {
    charsPerSecond = 26,
    defaultColor = '#66BDE6',
    autoHideDelay = 0,
    onLineStart,
    onType,
    onLineEnd,
    onTalk,
    onDone,
    onEmpty,
  } = options;

  /** @type {Array<{name:string,text:string,color?:string,npc?:string,voice?:string}>} */
  let lines = [];
  let index = -1;
  let active = false;
  let typing = false;
  let finished = false;
  let reveal = 0; // 已显示的字数（浮点）
  let waitTimer = 0;
  let currentNPC = null;
  let lastSpeaker = null;
  let speed = Math.max(4, charsPerSecond);

  const listeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error('[dialogue] listener error:', err);
      }
    }
  }

  function normalizeLine(line) {
    if (typeof line === 'string') return { name: '', text: line, color: defaultColor };
    if (!line || typeof line.text !== 'string') return null;
    return {
      name: line.name || '',
      text: line.text,
      color: line.color || defaultColor,
      npc: line.npc || null,
      voice: line.voice || null,
    };
  }

  function setTalking(npc, talking) {
    const who = npc || null;
    if (talking) {
      if (lastSpeaker !== who) {
        if (lastSpeaker) emit('talk', { npc: lastSpeaker, talking: false });
        lastSpeaker = who;
        if (who) emit('talk', { npc: who, talking: true });
      }
      onTalk?.(who, true);
    } else {
      if (lastSpeaker !== null) {
        emit('talk', { npc: lastSpeaker, talking: false });
        onTalk?.(lastSpeaker, false);
        lastSpeaker = null;
      }
    }
  }

  function beginLine(i) {
    index = i;
    reveal = 0;
    waitTimer = 0;
    typing = true;
    const line = lines[i];
    currentNPC = line?.npc || null;
    setTalking(currentNPC, true);
    const payload = { line, index: i, total: lines.length };
    onLineStart?.(payload);
    emit('lineStart', payload);
    emit('type', { line, visibleText: '', index: i });
    onType?.({ line, visibleText: '', index: i });
  }

  function finishTyping() {
    if (!typing) return;
    typing = false;
    const line = lines[index];
    if (!line) return;
    reveal = line.text.length;
    setTalking(currentNPC, false);
    const payload = { line, index, total: lines.length, fullyTyped: true };
    onLineEnd?.(payload);
    emit('lineEnd', payload);
    emit('type', { line, visibleText: line.text, index });
    onType?.({ line, visibleText: line.text, index });
    if (index >= lines.length - 1) {
      // 最后一句说完，稍等一下再收尾，让玩家看清
      finished = true;
      emit('finished');
      if (autoHideDelay >= 0) {
        // onDone 不自动触发，保留给 UI：UI 自己决定何时 close
      }
    }
  }

  function complete() {
    if (!active) return;
    active = false;
    typing = false;
    finished = false;
    setTalking(null, false);
    const payload = { lines: lines.slice(), lastIndex: index };
    onDone?.(payload);
    emit('done', payload);
  }

  function next() {
    if (!active) return false;
    if (typing) {
      // 当下一句所有字瞬间显示
      finishTyping();
      return true;
    }
    if (index < lines.length - 1) {
      beginLine(index + 1);
      return true;
    }
    complete();
    return false;
  }

  return {
    /** 开始一段对话。lines 可以是数组，也可以是单个对象/字符串。 */
    start(script) {
      const list = Array.isArray(script) ? script : [script];
      lines = list.map(normalizeLine).filter(Boolean);
      index = -1;
      reveal = 0;
      typing = false;
      finished = false;
      waitTimer = 0;
      setTalking(null, false);
      if (!lines.length) {
        active = false;
        onEmpty?.();
        emit('empty');
        return false;
      }
      active = true;
      beginLine(0);
      emit('start', { lines: lines.slice() });
      return true;
    },

    /** 调整打字速度（字/秒）。 */
    setSpeed(cps) {
      speed = Math.max(4, Number(cps) || 26);
    },

    /** 往队列尾部追加一行（对白进行中也能用）。 */
    enqueue(line) {
      const l = normalizeLine(line);
      if (!l) return;
      lines.push(l);
      if (!active) {
        active = true;
        beginLine(0);
      }
    },

    update(dt) {
      if (!active) return;
      if (waitTimer > 0) {
        waitTimer -= dt;
        return;
      }
      if (!typing) return;
      const line = lines[index];
      if (!line) return;
      const cps = speed;
      const before = Math.floor(reveal);
      reveal = Math.min(reveal + dt * cps, line.text.length);
      let now = Math.floor(reveal);
      // 如果这一帧跨过了标点，就停在标点后一个字，给一点停顿
      if (now > before) {
        for (let p = before; p < now; p += 1) {
          const mult = PUNCT_PAUSE[line.text[p]];
          if (mult && p + 1 < line.text.length) {
            now = p + 1;
            reveal = now;
            waitTimer = (mult - 1) / cps;
            break;
          }
        }
        const visibleText = line.text.slice(0, now);
        onType?.({ line, visibleText, index });
        emit('type', { line, visibleText, index });
      }
      if (now >= line.text.length) {
        finishTyping();
      }
    },

    /** 点击 / 回车。返回 true 表示这次点击被消费。 */
    advance() {
      return next();
    },

    /** 立刻结束整段对话（不播剩余的句子），会触发 onDone。 */
    skipAll() {
      if (!active) return;
      complete();
    },

    stop() {
      if (!active) return;
      active = false;
      typing = false;
      setTalking(null, false);
      lines = [];
      index = -1;
      emit('stop');
    },

    /** 当前应该显示的文本（打字机进度）。 */
    get visibleText() {
      const line = lines[index];
      if (!line) return '';
      return line.text.slice(0, Math.floor(reveal));
    },

    get current() {
      const line = lines[index];
      if (!line) return null;
      return {
        ...line,
        visibleText: line.text.slice(0, Math.floor(reveal)),
        index,
        total: lines.length,
        last: index >= lines.length - 1,
      };
    },

    get active() {
      return active;
    },
    get typing() {
      return typing;
    },
    get finished() {
      return finished;
    },
    get index() {
      return index;
    },
    get total() {
      return lines.length;
    },

    on,
  };
}

export default createDialogue;
