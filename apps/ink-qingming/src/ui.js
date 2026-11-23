/**
 * ui.js —— 长卷的界面：题跋、朱印、纸卡、卷尺。
 *
 * 界面只是画外的装裱：不抢画，只负责「起卷 / 停卷 / 跳到某段 / 调墨」。
 */
export class UI {
  constructor(handlers = {}, scenes = []) {
    this.h = handlers;
    this.body = document.body;
    this.scenes = scenes;
    this.$ = (id) => document.getElementById(id);

    this.intro = this.$('intro');
    this.loading = this.$('loading');
    this.card = this.$('card');
    this.cardSeal = this.$('card-seal');
    this.cardTitle = this.$('card-title');
    this.cardEn = this.$('card-en');
    this.cardText = this.$('card-text');
    this.playText = this.$('btn-play-text');
    this.inkRange = this.$('ink-range');
    this.hint = this.$('hint');
    this.current = null;

    this.$('btn-start')?.addEventListener('click', () => {
      this.intro?.classList.add('is-hidden');
      this.body.classList.add('is-ready');
      this.h.onStart?.();
    });

    this.$('btn-center')?.addEventListener('click', () => this.h.onCenter?.());
    this.$('btn-play')?.addEventListener('click', () => this.h.onPlay?.());
    this.$('btn-mode')?.addEventListener('click', () => this.h.onMode?.());
    this.$('btn-labels')?.addEventListener('click', () => {
      this.labelsOn = !this.labelsOn;
      this.$('btn-labels').textContent = this.labelsOn ? '藏签' : '露签';
      this.h.onLabels?.(this.labelsOn);
    });
    this.inkRange?.addEventListener('input', () => this.h.onInk?.(Number(this.inkRange.value)));

    this.$('card-close')?.addEventListener('click', () => this.h.onCloseCard?.());
    this.$('card-go')?.addEventListener('click', () => this.current && this.h.onGo?.(this.current));

    // —— 卷尺 ——
    this.track = this.$('ruler-track');
    this.progress = this.$('ruler-progress');
    this.cursor = this.$('ruler-cursor');
    this.marksEl = this.$('ruler-marks');
    this.labelsOn = true;
    if (this.track && this.marksEl) {
      for (const s of scenes) {
        const p = s.t * 100;
        const mark = document.createElement('button');
        mark.className = 'ruler-mark';
        mark.type = 'button';
        mark.style.left = `${Math.max(1, Math.min(99, p))}%`;
        mark.innerHTML = `<span class="ruler-mark-seal">${s.seal}</span><span class="ruler-mark-name">${s.name}</span>`;
        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          this.h.onScene?.(s.id);
        });
        this.marksEl.appendChild(mark);
      }
      const seek = (e) => {
        const rect = this.track.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.h.onRuler?.(t);
      };
      let dragging = false;
      this.track.addEventListener('pointerdown', (e) => {
        dragging = true;
        this.track.setPointerCapture?.(e.pointerId);
        seek(e);
      });
      this.track.addEventListener('pointermove', (e) => {
        if (dragging) seek(e);
      });
      this.track.addEventListener('pointerup', () => {
        dragging = false;
      });
      this.track.addEventListener('pointercancel', () => {
        dragging = false;
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.h.onCloseCard?.();
      if (e.key === ' ') {
        e.preventDefault();
        this.h.onPlay?.();
      }
    });
  }

  ready() {
    this.loading?.classList.add('is-hidden');
  }

  showCard(sceneDef) {
    this.current = sceneDef;
    if (!this.card) return;
    this.cardSeal.textContent = sceneDef.seal;
    this.cardTitle.textContent = sceneDef.name;
    this.cardEn.textContent = sceneDef.en;
    this.cardText.textContent = sceneDef.text;
    this.card.classList.add('is-open');
    this.card.setAttribute('aria-hidden', 'false');
  }

  hideCard() {
    this.current = null;
    this.card?.classList.remove('is-open');
    this.card?.setAttribute('aria-hidden', 'true');
  }

  setMode(city) {
    const t = this.$('btn-mode-text');
    if (t) t.textContent = city ? '展卷' : '全城';
    this.body.dataset.mode = city ? 'city' : 'scroll';
    if (this.$('ruler')) this.$('ruler').style.opacity = city ? '0.25' : '';
  }

  setPlaying(on) {
    if (this.playText) this.playText.textContent = on ? '停卷' : '续卷';
    this.body.dataset.playing = on ? 'on' : 'off';
  }

  setProgress(t) {
    const p = Math.max(0, Math.min(1, t)) * 100;
    if (this.progress) this.progress.style.width = `${p}%`;
    if (this.cursor) this.cursor.style.left = `${p}%`;
  }

  setInk(v) {
    if (this.inkRange) this.inkRange.value = String(v);
  }
}
