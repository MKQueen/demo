// 手绘风 SVG 图标（全部内联，无外部资源）
// 风格对齐原站：圆头描边、轻微歪斜、墨色 #0f0f0f / 石板蓝 #6B8697 / 描边 #455762。
// 每个导出都是 SVG 字符串，尺寸由 CSS 决定（viewBox 固定）。

const ns = 'http://www.w3.org/2000/svg';

/** 列表 / 清单图标：三个圆点 + 三条线（对齐原站 sidebuttons/list.icon）。 */
export const iconList = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <g fill="#6B8697">
    <circle cx="17" cy="18.5" r="4.6"/>
    <circle cx="17.6" cy="32" r="4.2"/>
    <circle cx="17.2" cy="45.5" r="4.7"/>
  </g>
  <g stroke="#6B8697" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M28.5 18.6c7-.5 12.8-.4 18.6.2"/>
    <path d="M28.2 32.2c7.4.3 12.2.4 18.9-.1"/>
    <path d="M28.8 45.3c6.4.5 12.4.6 18.2.1"/>
  </g>
</svg>`;

/** 声音 / 音乐图标：八分音符（对齐原站 sound.icon）。 */
export const iconSound = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M39.8 12.6c.9 9 .5 18.1-.5 27.2" stroke="#6B8697" stroke-width="5.8" stroke-linecap="round"/>
  <path d="M40.2 13.2c5.8-3.5 10.5-4.3 14.1-2.8" stroke="#6B8697" stroke-width="5.8" stroke-linecap="round"/>
  <ellipse cx="26.4" cy="45.6" rx="10.4" ry="7.9" transform="rotate(-23 26.4 45.6)" fill="#6B8697"/>
</svg>`;

/** 静音：音符 + 斜杠。 */
export const iconSoundMuted = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <g opacity=".9">
    <path d="M38.2 15.2c.7 7 .4 14.2-.4 21.2" stroke="#6B8697" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M38.6 15.7c4.8-2.9 8.8-3.6 11.8-2.4" stroke="#6B8697" stroke-width="5.4" stroke-linecap="round"/>
    <ellipse cx="26.6" cy="46.2" rx="9.2" ry="7" transform="rotate(-23 26.6 46.2)" fill="#6B8697"/>
  </g>
  <path d="M16.4 48.8c10-10.6 21-21.2 32.2-31.6" stroke="#455762" stroke-width="4.6" stroke-linecap="round"/>
</svg>`;

/** 换装：T 恤。 */
export const iconTshirt = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M23.4 13.1c3.3 3.1 8.1 3.2 11.7.1l9.5 5.6c2.5 1.5 3.1 4.8 1.3 7l-4.4 5.5-4.2-3.1-.6 23.3c-6.2 1.4-12.8 1.3-19 .1l-.5-23.4-4.3 3.1-4.4-5.6c-1.6-2.2-1-5.4 1.4-6.9l9.5-5.7Z"
        fill="#6B8697"/>
</svg>`;

/** 表情：手绘便便（对齐原站 poo.icon）。 */
export const iconPoo = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M32.2 9.6c2.7 0 4.8 2.1 5.1 5.1 5.4.8 8.6 3.4 8.9 7.3.3 3.2-1.9 5.8-5.2 7.2 5.9 1.7 9.2 5.1 9.2 9.2 0 5.8-7.4 9.3-17.9 9.3s-17.9-3.5-17.9-9.3c0-4.1 3.3-7.5 9.2-9.2-3.3-1.4-5.5-4-5.2-7.2.3-3.9 3.5-6.5 8.9-7.3.3-3 2.4-5.1 5.1-5.1Z"
        fill="#6B8697"/>
  <g stroke="#F8F8F8" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M26.3 38.4v.4"/>
    <path d="M38.1 38.4v.4"/>
    <path d="M26.2 44.4c3.6 2.9 7.8 3 11.6.4"/>
  </g>
</svg>`;

/** 对话框右下角的蓝色播放箭头。 */
export const iconPlayArrow = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M21.5 11.2c0-2 2.2-3.1 3.8-2l28.2 19.4c1.4 1 1.4 3 0 4L25.3 52.8c-1.6 1.1-3.8 0-3.8-2V11.2Z"
        fill="#66BDE6" stroke="#66BDE6" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

/** 换装界面左箭头。 */
export const iconArrowLeft = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M42.5 11.7c0-2-2.2-3.1-3.8-2L10.5 30.5c-1.4 1-1.4 3 0 4l28.2 19.3c1.6 1.1 3.8 0 3.8-2V11.7Z"
        fill="#6B8697" stroke="#6B8697" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** 换装界面右箭头。 */
export const iconArrowRight = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M21.5 11.7c0-2 2.2-3.1 3.8-2l28.2 20.8c1.4 1 1.4 3 0 4L25.3 52.3c-1.6 1.1-3.8 0-3.8-2V11.7Z"
        fill="#6B8697" stroke="#6B8697" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** 关闭（红叉，换装界面用）。 */
export const iconCross = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M17.5 17.8c9.8 9.1 19.1 18.6 28.7 28.4" stroke="#D85656" stroke-width="7.4" stroke-linecap="round"/>
  <path d="M46.3 17.4C36.6 26.6 27.1 36 18.2 45.9" stroke="#D85656" stroke-width="7.4" stroke-linecap="round"/>
</svg>`;

/** 手绘信封（LOADING 屏 / 装饰用）。 */
export const envelope = (stroke = '#1d1d1b', sw = 2) => `
<svg viewBox="0 0 72 56" fill="none" aria-hidden="true">
  <path d="M8.5 9.2c18.5-1.4 37-1.6 55.2-.4 1.2 12.6 1.3 25.1.3 37.6-18 1.3-36.4 1.4-55.2.3C7.6 34 7.7 21.7 8.5 9.2Z"
        fill="#F8F8F8" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
  <path d="M8.9 10.1c9.3 7.9 18.3 15.3 27 22.1 8.9-6.9 17.9-14.4 27.2-22.4"
        stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.1 46.2c8.3-6.6 15.3-12.4 21.4-17.4" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
  <path d="M63.2 46.1c-8-6.4-15-12.1-21.1-17.1" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
</svg>`;

/** 小信封贴纸（开场飘着的装饰）。 */
export const stickerEnvelope = `
<svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
  <rect x="3" y="4" width="58" height="40" rx="5" fill="#EDF2E4" stroke="#253037" stroke-width="3" transform="rotate(-6 32 24)"/>
  <path d="M8 9c7.4 6.2 14.6 12 21.6 17.2 7-5.2 14.1-11 21.4-17.3" stroke="#253037" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="rotate(-6 32 24)"/>
</svg>`;

/** 邮戳（开场角落装饰）。 */
export const postmark = `
<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <circle cx="60" cy="60" r="49" stroke="#253037" stroke-width="3" stroke-dasharray="5 4" opacity=".8"/>
  <circle cx="60" cy="60" r="38" stroke="#253037" stroke-width="2" opacity=".7"/>
  <text x="60" y="47" text-anchor="middle" font-size="13" letter-spacing="2" fill="#253037" font-family="Patrick Hand, sans-serif">BEIJING</text>
  <text x="60" y="72" text-anchor="middle" font-size="26" fill="#253037" font-family="'ZCOOL KuaiLe','Ma Shan Zheng',serif">京城</text>
  <text x="60" y="91" text-anchor="middle" font-size="10" letter-spacing="1.6" fill="#253037" font-family="Patrick Hand, sans-serif">COURIER · 001</text>
</svg>`;

/** 触屏跳跃。 */
export const iconJump = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M32.4 44.6c.9-9.4.8-18.7-.2-28.2" stroke="#455762" stroke-width="6" stroke-linecap="round"/>
  <path d="M20.5 27.2C25 22.6 29 18.2 32.3 13.9c3.6 4.2 7.6 8.7 11.8 13.3"
        stroke="#455762" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** 交互按钮：E 圆圈。 */
export const iconInteract = `
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <circle cx="32" cy="32" r="22.5" stroke="#455762" stroke-width="4.4"/>
  <path d="M24.6 23.5c5.2-.8 10.2-.7 15 .1M24.4 32.2c4 .4 8 .4 12.9.1M24.7 41.4c5-.6 10-.5 14.9.2"
        stroke="#455762" stroke-width="4.2" stroke-linecap="round"/>
</svg>`;

/** 目标 / 任务的小信纸图标。 */
export const iconLetter = `
<svg viewBox="0 0 48 36" fill="none" aria-hidden="true">
  <path d="M3.4 4.6c13.5-1 27.2-1.2 41-.4.9 9.1.9 18.1.2 27.2-13.4.9-27.1.9-41 .1C2.7 22.4 2.7 13.4 3.4 4.6Z"
        fill="#F8F8F8" stroke="#455762" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M4 5.2c6.8 5.8 13.4 11.3 19.8 16.3 6.5-5.1 13.2-10.6 20-16.5"
        stroke="#455762" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** 清单勾选。 */
export const iconCheck = `
<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M5.5 17.5c4.2 2.6 7.7 5.9 10.4 9.1C20.2 17.1 26 10.5 32 5.2"
        stroke="#4F7A57" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** 10 个手绘表情（表情轮盘用）。 */
export const EMOJI_FACES = [
  // 0 微笑
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M23 28v.2M41 28v.2" stroke="#0f0f0f" stroke-width="5" stroke-linecap="round"/><path d="M22.5 37.5c4.8 5.2 12.5 5.4 18.3.4" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  // 1 大笑
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M22 26c2.6-2.2 5.4-2.3 8.2-.3M34 25.7c2.8-2 5.6-1.9 8.2.3" stroke="#0f0f0f" stroke-width="3.2" stroke-linecap="round"/><path d="M21 36.5c4 9 18.4 9 22.3 0-7.4 2.2-14.8 2.2-22.3 0Z" fill="#0f0f0f"/></svg>`,
  // 2 哭
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M22 27v.2M42 27v.2" stroke="#0f0f0f" stroke-width="5" stroke-linecap="round"/><path d="M22 42c5.4-4.6 12-4.7 19.4-.4" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/><path d="M22 30c-2 4.4-2 7 .2 8.4 2.3-1.6 2.2-4 1.2-8.6M42 30c2 4.4 2 7-.2 8.4-2.3-1.6-2.2-4-1.2-8.6" fill="#66BDE6" stroke="#0f0f0f" stroke-width="2.2"/></svg>`,
  // 3 惊讶
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><circle cx="23.5" cy="27" r="3" fill="#0f0f0f"/><circle cx="40.5" cy="27" r="3" fill="#0f0f0f"/><ellipse cx="32" cy="41" rx="6" ry="7.5" stroke="#0f0f0f" stroke-width="3.2"/></svg>`,
  // 4 爱心
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M32 44c-8.4-5.4-12-9.2-12-13.4 0-3.2 2.3-5.4 5.3-5.4 2.6 0 4.8 1.6 6.7 4.6 1.9-3 4.1-4.6 6.7-4.6 3 0 5.3 2.2 5.3 5.4 0 4.2-3.6 8-12 13.4Z" fill="#D85656" stroke="#0f0f0f" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
  // 5 眨眼
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M21 27c2.6-1.8 5-1.8 7.3-.2M35 26c2.8-1.6 5.2-1.6 7.4.2" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/><path d="M22.5 38c5.4 4.4 12.8 4.4 19 .1" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  // 6 生气
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M20 24.5c2.8-1.6 5.4-1.2 7.6.8M36.5 25.3c2.2-2 4.8-2.4 7.5-.8" stroke="#0f0f0f" stroke-width="3.2" stroke-linecap="round"/><path d="M23.5 41.5c5.6-3.6 11.8-3.6 17.4.2" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  // 7 睡觉
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M21 27c2.4 1.8 4.8 1.8 7 0M36 27c2.4 1.8 4.8 1.8 7 0" stroke="#0f0f0f" stroke-width="3.2" stroke-linecap="round"/><path d="M26 39c3.6 1.6 7.8 1.6 12 0" stroke="#0f0f0f" stroke-width="3.2" stroke-linecap="round"/><path d="M47 12c2 .2 3.4 1.4 3.6 3.4-2.6 2.8-5.2 5.4-7.8 7.8 2.6.4 5 .3 7.2.1" stroke="#0f0f0f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 8 星星眼
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M23.5 22v.2M40.5 22v.2" stroke="#0f0f0f" stroke-width="5" stroke-linecap="round"/><path d="M22.6 36c5.6 6.4 13.4 6.4 18.8 0" stroke="#0f0f0f" stroke-width="3.4" stroke-linecap="round"/><path d="M13.5 15.5l1.2 2.8 3 .3-2.2 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.2-2 3-.3 1.2-2.8Z" fill="#F0D055"/></svg>`,
  // 9 吐舌
  `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#0f0f0f" stroke-width="3.6"/><path d="M22 27v.2M42 27v.2" stroke="#0f0f0f" stroke-width="5" stroke-linecap="round"/><path d="M22 36c5 4 12.8 4 18.4.2" stroke="#0f0f0f" stroke-width="3.2" stroke-linecap="round"/><path d="M29 39c.4 3.8 2 6 4.2 6.4 2.3.4 4.1-1.4 4.4-5.4" fill="#D85656" stroke="#0f0f0f" stroke-width="2.6" stroke-linejoin="round"/></svg>`,
];

/** 供 createElement 使用的便捷函数。 */
export function svgEl(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export { ns };
