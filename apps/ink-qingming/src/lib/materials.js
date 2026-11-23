/**
 * materials.js —— 全场景共用的一套材质。
 *
 * 材质只做三件事：给颜色、给一点粗糙的明暗、保持低多边形的硬边。
 * 真正的「墨」是后期那一层（lib/ink.js）压上去的，所以这里的颜色都留得比较亮，
 * 后期会把亮部抬向纸色、暗部压向墨色，中间调做层次。
 *
 * 约定：所有 demo 的几何都从这里取材质，不要自己 new，
 * 否则同一片屋顶会出现两种明暗，整幅画就散了。
 */
import * as THREE from 'three';
import * as P from './palette.js';

const cache = new WeakMap();

/** Store brush strength in the opaque colour target's alpha channel.
 * The post pass reads it as a material mask; no extra scene pass is needed.
 */
export function setInkWeight(material, strength) {
  material.userData.inkWeight = strength;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>\n gl_FragColor.a = ${strength.toFixed(3)};`,
    );
  };
  material.customProgramCacheKey = () => `ink-weight-${strength}`;
  material.needsUpdate = true;
  return material;
}

/** 通用墨面材质：哑光、硬边（flatShading），可以选双面。 */
export function inkMat(color, options = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...options,
  });
}

/** 自发光材质（灯笼、窗光、太阳），不受光，纯色加一点辉光。 */
export function glowMat(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: intensity });
}

/** 半透明墨片（雾、水汽、飞鸟、影子）。 */
export function planeMat({ color = P.INK, opacity = 0.3, map = null, depthWrite = false } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    depthWrite,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * 建好整份材质表。所有模块共用（ctx.mats）。
 */
export function makeMaterials(tex) {
  const m = {
    // —— 纸与地 ——
    paper: new THREE.MeshBasicMaterial({ color: P.PAPER_WARM, toneMapped: false }),
    paperShade: new THREE.MeshBasicMaterial({ color: P.PAPER_DEEP, toneMapped: false }),

    // —— 瓦 ——
    roofTile: inkMat(P.ROOF_TILE, { side: THREE.DoubleSide }),
    roofTileDark: inkMat(P.ROOF_TILE_DARK, { side: THREE.DoubleSide }),
    roofGold: inkMat(P.ROOF_GOLD, { side: THREE.DoubleSide }),
    roofGlaze: inkMat(P.ROOF_GLAZE, { side: THREE.DoubleSide }),
    roofJade: inkMat(P.JADE, { side: THREE.DoubleSide }),
    roofGreen: inkMat(P.JADE_DEEP, { side: THREE.DoubleSide }),
    roofWhite: inkMat(P.PAPER_WARM, { side: THREE.DoubleSide }),

    // —— 屋脊 / 檐口 / 最深的墨 ——
    ridge: inkMat(P.INK),
    eave: inkMat(P.INK_DEEP, { side: THREE.DoubleSide }),
    inkDark: inkMat(P.INK),
    inkDeep: inkMat(P.INK_DEEP),
    inkMid: inkMat(P.INK_MID),
    inkSoft: inkMat(P.INK_SOFT),
    inkWash: inkMat(P.INK_WASH),

    // —— 墙体 ——
    wallRed: inkMat(P.VERMILION),
    wallRedDeep: inkMat(P.VERMILION_DEEP),
    wallWhite: inkMat(P.WALL_WHITE),
    wallPlaster: inkMat(0xf0e9da), // 胡同灰墙（略暖）
    wallGray: inkMat(0xcfc8b8),
    column: inkMat(P.VERMILION_DEEP),
    door: inkMat(0x6f2419),
    gate: inkMat(P.VERMILION),

    // —— 石 ——
    stone: inkMat(P.STONE),
    stoneShade: inkMat(P.STONE_SHADE),
    marble: inkMat(0xeee7d8),
    stoneDark: inkMat(0x9c9484),

    // —— 金 / 琉璃 / 玉 ——
    gold: inkMat(P.GOLD),
    goldLight: inkMat(P.GOLD_LIGHT),
    jade: inkMat(P.JADE),
    jadeDeep: inkMat(P.JADE_DEEP),

    // —— 植物 ——
    pine: inkMat(P.PINE),
    cypress: inkMat(0x33453c),
    willow: inkMat(P.WILLOW),
    blossom: inkMat(P.BLOSSOM),
    trunk: inkMat(P.INK_DEEP),
    grass: inkMat(0x8f9584),

    // —— 清明上河图专用：木构、茅草、布幡 ——
    wood: inkMat(0x9a7a52),
    woodDark: inkMat(0x6d5438),
    timber: inkMat(0x8a6a45),
    thatch: inkMat(0xb19a73, { side: THREE.DoubleSide }),
    thatchDark: inkMat(0x8f7a58, { side: THREE.DoubleSide }),
    cloth: inkMat(0xd6c9b0),
    clothBlue: inkMat(0x5f7278),
    clothOchre: inkMat(0xa9803f),
    banner: inkMat(0xb64f34),
    paperSign: inkMat(0xefe4cb),

    // —— 其他 ——
    lantern: new THREE.MeshBasicMaterial({ color: 0xc23a24, toneMapped: false }),
    lanternGlow: new THREE.MeshBasicMaterial({
      color: 0xff8a5c,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false }),
    waterEdge: inkMat(P.WATER_EDGE),
  };

  if (tex) {
    m.groundWash = new THREE.MeshBasicMaterial({
      map: tex.wash,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      toneMapped: false,
    });
  }

  // Quiet supporting grey roofs; retain the palace silhouette and eave shadows.
  for (const [name, weight] of Object.entries({
    roofTile: 0.34, roofTileDark: 0.38, roofGold: 0.85, roofGlaze: 0.72,
    roofJade: 0.65, roofGreen: 0.65, roofWhite: 0.65, ridge: 0.65, eave: 0.65,
    wallPlaster: 0.2, wallGray: 0.2, wallWhite: 0.3, wallRed: 0.75,
    wallRedDeep: 0.7, stone: 0.3, stoneShade: 0.35, marble: 0.45,
    pine: 0.3, cypress: 0.3, willow: 0.25, blossom: 0.3,
  })) setInkWeight(m[name], weight);

  cache.set(m, true);
  return m;
}
