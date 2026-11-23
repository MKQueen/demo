/**
 * units.js —— 世界尺度约定。
 *
 * 1 世界单位 = 50 米。垂直方向再乘 H 做适度夸张：
 * 真实 12 米的城墙在鸟瞰下只有 0.24 单位，几乎看不见；
 * ×1.8 之后屋顶、城台、塔才有「纸模型」该有的体量。
 *
 * 用法：
 *   import { u, h } from '../lib/units.js';
 *   const width = u(961);   // 太和殿面阔 961 米 → 19.2 世界单位
 *   const height = h(27);   // 太和殿高 27 米 → 0.97 世界单位
 */

export const U = 1 / 50; // 米 → 世界单位
export const H = 1.8; // 垂直夸张系数

/** 水平距离：米 → 世界单位 */
export const u = (m) => m * U;
/** 垂直高度：米 → 世界单位（已含夸张） */
export const h = (m) => m * U * H;

/** 常用换算好的参考尺寸（单位：世界单位）。 */
export const SCALE = {
  /** 故宫：961m × 753m */
  palace: { w: u(961), d: u(753) },
  /** 内城：约 6650m × 5200m */
  innerCity: { w: u(6650), d: u(5200) },
  /** 天坛公园：约 1700m 直径 */
  templePark: u(1700),
};
