/**
 * palette.js —— 「水墨北京」的总调色盘。
 *
 * 大原则：整幅画只有三组颜色。
 *   1. 纸：暖白偏黄，所有留白、屋顶亮面、白塔、汉白玉都从纸色里来；
 *   2. 墨：冷灰黑，从远山到最深的檐下阴影，是一根连续的墨色明度轴；
 *   3. 重彩点睛：朱红（宫墙 / 印章 / 灯笼）、石青石绿（天坛琉璃、湖水）、
 *      赭金（屋脊、门钉）。它们出现的面积必须极小，才压得住满纸水墨。
 *
 * 所有材质颜色统一用 sRGB 十六进制，交给 three 的 colorSpace 管理。
 */

export const PAPER = 0xf1e9d7; // 宣纸本白（天空 / 场景底色 / 留白）
export const PAPER_WARM = 0xf7f1e2; // 纸的受光面
export const PAPER_DEEP = 0xdccfb8; // 纸的背光 / 旧色
export const MIST = 0xe9e1d1; // 雾带

export const INK = 0x20262a; // 焦墨（轮廓、最深阴影、瓦当）
export const INK_DEEP = 0x333c40; // 重墨（屋顶暗部、树干）
export const INK_MID = 0x4f5a5c; // 中墨（灰瓦、石桥、远树）
export const INK_SOFT = 0x87908d; // 淡墨（远山、雾中城郭）
export const INK_WASH = 0xb9bfb8; // 极淡墨（山影、天光）

export const WATER = 0x4b5c66; // 湖水（比墨更青一层）
export const WATER_DEEP = 0x3a4a53;
export const WATER_LIGHT = 0x7c9197;
export const WATER_EDGE = 0xd9e0da; // 水岸的湿墨反光

export const VERMILION = 0xb8432f; // 朱砂：宫墙、城门、印章
export const VERMILION_DEEP = 0x8b3023;
export const VERMILION_LIGHT = 0xc25542;

export const GOLD = 0xbc974e; // 赭金：屋脊、鎏金宝顶
export const GOLD_LIGHT = 0xcda961;
export const JADE = 0x527f6e; // 石绿：天坛琉璃、松柏
export const JADE_DEEP = 0x39584c;
export const STONE = 0xe8e0ce; // 汉白玉 / 台基
export const STONE_SHADE = 0xc9bda6;
export const ROOF_TILE = 0x5c6769; // 灰瓦
export const ROOF_TILE_DARK = 0x495455;
export const ROOF_GLAZE = 0x41776b; // 青绿琉璃（天坛）
export const ROOF_GOLD = 0xc09a4a; // 金瓦（紫禁城）
export const WALL_RED = 0x9d3a2b;
export const WALL_WHITE = 0xf3eddf;

export const BLOSSOM = 0xd49a95; // 杏花 / 海棠（少用）
export const PINE = 0x3f5247; // 松针
export const WILLOW = 0x6c7c60; // 柳

/** 天色（晨 / 暮）切换时的整体氛围参数。 */
export const SNOW = {
  paper: 0xe9edec,
  fog: 0xdfe6e5,
  fogDensity: 0.00135,
  sunColor: 0xf3f5f2,
  sunIntensity: 2.6,
  hemiSky: 0xf6f8f7,
  hemiGround: 0xc0c8c7,
  hemiIntensity: 4.4,
  ambient: 0.78,
  fill: 1.5,
};

export const SKY = {
  dawn: {
    paper: PAPER,
    mist: MIST,
    sunColor: 0xffe9cc,
    sunIntensity: 4.2,
    hemiSky: 0xfff8ec,
    hemiGround: 0x77847e,
    hemiIntensity: 3.9,
    fog: MIST,
    fogDensity: 0.00085,
    lanternIntensity: 0,
    tint: 0x000000,
  },
  dusk: {
    paper: 0xcfc2ab,
    mist: 0xcbbda6,
    sunColor: 0xf08a52,
    sunIntensity: 4.0,
    hemiSky: 0xffd9b8,
    hemiGround: 0x555f5e,
    hemiIntensity: 1.9,
    fog: 0xd4c3ab,
    fogDensity: 0.0011,
    lanternIntensity: 1,
    tint: 0x120c08,
  },
};

/** 给 HTML 层复用的 CSS 变量。 */
export const cssVars = {
  '--paper': '#efe6d4',
  '--paper-deep': '#dccfb8',
  '--ink': '#20262a',
  '--ink-mid': '#5b6668',
  '--vermilion': '#a5392a',
  '--vermilion-deep': '#7c291f',
  '--gold': '#b08d4d',
  '--jade': '#4f7d6c',
};
