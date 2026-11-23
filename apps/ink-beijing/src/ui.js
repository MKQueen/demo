/**
 * ui.js —— 题跋、印章、纸卡。
 *
 * 所有 DOM 交互收在这一层：开场、按钮、墨色滑杆、地标纸卡。
 * main.js 只关心「发生了什么」，不碰 DOM 结构。
 */
export class UI {
  constructor(handlers = {}) {
    this.h = handlers;
    this.body = document.body;

    this.$ = (id) => document.getElementById(id);
    this.intro = this.$('intro');
    this.loading = this.$('loading');
    this.card = this.$('card');
    this.cardSeal = this.$('card-seal');
    this.cardTitle = this.$('card-title');
    this.cardEn = this.$('card-en');
    this.cardText = this.$('card-text');
    this.timeText = this.$('btn-time-text');
    this.snowText = this.$('btn-snow-text');
    this.inkRange = this.$('ink-range');
    this.hint = this.$('hint');
    this.current = null;

    this.$('btn-start')?.addEventListener('click', () => {
      this.intro?.classList.add('is-hidden');
      this.body.classList.add('is-ready');
      this.h.end();
      this.h.onStart?.();
    });

    this.$('btn-center')?.addEventListener('click', () => this.h.onCenter?.());
    this.$('btn-scenic')?.addEventListener('click', () => this.h.onScenic?.());
    this.$('btn-country')?.addEventListener('click', () => this.h.onCountry?.());
    this.$('btn-labels')?.addEventListener('click', () => this.h.onLabels?.());
    this.$('btn-time')?.addEventListener('click', () => this.h.onTime?.());
    this.$('btn-snow')?.addEventListener('click', () => this.h.onSnow?.());
    this.inkRange?.addEventListener('input', () => this.h.onInk?.(Number(this.inkRange.value)));

    this.$('card-close')?.addEventListener('click', () => this.h.onCloseCard?.());
    this.$('card-go')?.addEventListener('click', () => this.current && this.h.onGo?.(this.current));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.h.onCloseCard?.();
    });

    // 第一次真正动起来之后，提示文字淡出
    const dismissHint = () => {
      this.hint?.classList.add('is-faded');
      window.removeEventListener('pointerdown', dismissHint);
      window.removeEventListener('wheel', dismissHint);
    };
    window.addEventListener('pointerdown', dismissHint, { once: true });
    window.addEventListener('wheel', dismissHint, { once: true });
  }

  ready() {
    this.loading?.classList.add('is-hidden');
  }

  start() {
    this.intro?.classList.add('is-hidden');
    this.body.classList.add('is-ready');
  }

  showCard(landmark) {
    this.current = landmark;
    if (!this.card) return;
    this.cardSeal.textContent = landmark.seal;
    this.cardTitle.textContent = landmark.name;
    this.cardEn.textContent = landmark.en;
    this.cardText.textContent = landmark.text;
    this.card.classList.add('is-open');
    this.card.setAttribute('aria-hidden', 'false');
  }

  hideCard() {
    this.current = null;
    this.card?.classList.remove('is-open');
    this.card?.setAttribute('aria-hidden', 'true');
  }

  setWeather(snow) {
    if (this.snowText) this.snowText.textContent = snow ? '晴日' : '雪霁';
    document.body.dataset.weather = snow ? 'snow' : 'clear';
  }

  setTime(dusk) {
    if (this.timeText) this.timeText.textContent = dusk ? '晨光' : '暮色';
    document.body.dataset.time = dusk ? 'dusk' : 'dawn';
  }

  setInk(v) {
    if (this.inkRange) this.inkRange.value = String(v);
  }
}
