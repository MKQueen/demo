// 触屏控件：虚拟摇杆 / 跳跃 / 交互
// ---------------------------------------------------------------------------
// createTouch({ root, callbacks }) →
//   { el, show(), hide(), setVisible(bool), setInteractVisible(bool), destroy() }
// callbacks: { onMove(x, y), onJump(), onInteract() }
// x/y 为 -1..1 的归一化摇杆偏移（y 向上为正）。
// ---------------------------------------------------------------------------

import { iconJump, iconInteract } from './icons.js';

export function createTouch(options = {}) {
  const { root, callbacks = {} } = options;

  const el = document.createElement('div');
  el.className = 'bc-touch';
  el.innerHTML = `
    <div class="bc-stick" role="application" aria-label="移动摇杆">
      <div class="bc-stick__knob"></div>
    </div>
    <button class="bc-touchbtn bc-touchbtn--interact" type="button" aria-label="互动">
      ${iconInteract}
    </button>
    <button class="bc-touchbtn bc-touchbtn--jump" type="button" aria-label="跳跃">
      ${iconJump}
    </button>
  `;
  root.appendChild(el);

  const stick = el.querySelector('.bc-stick');
  const knob = el.querySelector('.bc-stick__knob');
  const jumpBtn = el.querySelector('.bc-touchbtn--jump');
  const interactBtn = el.querySelector('.bc-touchbtn--interact');

  let activePointer = null;
  let maxRadius = 1;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function emitMove(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    const limit = maxRadius;
    if (len > limit) {
      dx = (dx / len) * limit;
      dy = (dy / len) * limit;
    }
    setKnob(dx, dy);
    callbacks.onMove?.(dx / limit, -dy / limit);
  }

  function reset() {
    activePointer = null;
    stick.classList.remove('is-active');
    setKnob(0, 0);
    callbacks.onMove?.(0, 0);
  }

  stick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointer = event.pointerId;
    stick.setPointerCapture?.(event.pointerId);
    stick.classList.add('is-active');
    const rect = stick.getBoundingClientRect();
    maxRadius = Math.max(24, rect.width * 0.33);
    emitMove(event.clientX, event.clientY);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return;
    event.preventDefault();
    emitMove(event.clientX, event.clientY);
  });
  const endStick = (event) => {
    if (event.pointerId !== activePointer) return;
    reset();
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('lostpointercapture', endStick);

  jumpBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    jumpBtn.style.transform = 'translate(2px, 2px)';
    callbacks.onJump?.();
  });
  const jumpUp = () => {
    jumpBtn.style.transform = '';
  };
  jumpBtn.addEventListener('pointerup', jumpUp);
  jumpBtn.addEventListener('pointercancel', jumpUp);
  jumpBtn.addEventListener('pointerleave', jumpUp);

  interactBtn.addEventListener('click', (event) => {
    event.preventDefault();
    callbacks.onInteract?.();
  });

  return {
    el,
    show() {
      el.classList.add('is-on');
    },
    hide() {
      el.classList.remove('is-on');
    },
    setVisible(visible) {
      el.classList.toggle('is-on', !!visible);
      if (!visible) reset();
    },
    setInteractVisible(visible) {
      interactBtn.classList.toggle('is-on', !!visible);
    },
    get visible() {
      return el.classList.contains('is-on');
    },
    destroy() {
      el.remove();
    },
  };
}

export default createTouch;
