const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class KeyboardInput {
  constructor() {
    this.held = new Set();
    this.events = [];
    this.enabled = true;
    this.onKey = null;
    this._down = (e) => {
      if (!this.enabled || document.querySelector('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)) return;
      if (BLOCKED.has(e.code) || e.code.startsWith('Key') || e.code.startsWith('Shift')) {
        // 只阻止游戏需要的键，保留浏览器刷新/开发者工具
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      }
      if (e.repeat) return;
      this.held.add(e.code);
      switch (e.code) {
        case 'KeyJ': this.events.push({ type: 'punch', side: 'left' }); break;
        case 'KeyK': this.events.push({ type: 'punch', side: 'right' }); break;
        case 'KeyL': this.events.push({ type: 'blast' }); break;
        case 'KeyR': this.events.push({ type: 'missile' }); break;
        case 'KeyF': this.events.push({ type: 'blade', side: 'right' }); break;
        case 'KeyU': this.events.push({ type: 'ultimate' }); break;
        case 'KeyE': this.events.push({ type: 'dodge', side: 'right' }); break;
        case 'KeyQ': this.events.push({ type: 'dodge', side: 'left' }); break;
        case 'KeyV': this.events.push({ type: 'jet' }); break;
        case 'Escape': this.events.push({ type: 'pause' }); break;
        case 'KeyC': this.events.push({ type: 'toggleCamera' }); break;
        case 'KeyH': this.events.push({ type: 'help' }); break;
        case 'KeyX': this.events.push({ type: 'resetCamera' }); break;
        default: break;
      }
      this.onKey?.(e);
    };
    this._up = (e) => {
      this.held.delete(e.code);
    };
    this._blur = () => this.held.clear();
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  get blocking() {
    return this.held.has('Space');
  }

  getInput() {
    if (!this.enabled) return { forward: 0, strafe: 0, run: false, blocking: false };
    let forward = 0;
    let strafe = 0;
    if (this.held.has('KeyW')) forward += 1;
    if (this.held.has('KeyS')) forward -= 1;
    if (this.held.has('KeyD')) strafe += 1;
    if (this.held.has('KeyA')) strafe -= 1;
    return {
      forward,
      strafe,
      run: this.held.has('ShiftLeft') || this.held.has('ShiftRight'),
      blocking: this.held.has('Space'),
    };
  }

  takeEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  reset() {
    this.held.clear();
    this.events = [];
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.held.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
  }
}
