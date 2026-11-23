// 原创北京 NPC —— 遛鸟大爷 / 广场舞大妈 / 红领巾小学生
// ===========================================================================
//
// 和原创邮差一样：全部用 three.js 几何现场拼出来（无参考站模型、无外部动画），
// 材质走 src/render/toon.js，同一条描边 + LUT 管线，放进场景里与邮差同风格。
//
// 接口与 src/actor/npc.js 保持一致（Lead 可直接替换 createNPC）：
//   { root, ready, height, play(name, fade), update(dt), setTalking(bool),
//     setLookAt(vec3|null), setVisible(bool), dispose() }
//
// 约定：root 脚底 y=0、面朝 +Z，由世界摆到球面；root 的朝向代表球面切空间，
// 内部 `pivot` 负责朝 setLookAt 目标转身（和 npc.js 相同的做法）。

import * as THREE from 'three';
import {
  originalActorKit,
} from './originalCourier.js';

const {
  createMaterialStore,
  createPartCollector,
  buildBoneRig,
  createPoseAnimator,
  makeCanvasTexture,
  taperBox,
  limb,
  blob,
  box,
} = originalActorKit;

const PI2 = Math.PI * 2;
const TURN_SPEED = 6.5;

export const ORIGINAL_NPC_TYPES = Object.freeze(['beijing-daye', 'beijing-dama', 'xiaoxuesheng']);

export const ORIGINAL_NPC_LABELS = Object.freeze({
  'beijing-daye': '遛鸟大爷',
  'beijing-dama': '广场舞大妈',
  xiaoxuesheng: '红领巾小学生',
});

// ---------------------------------------------------------------- 共用骨架

/** 13 骨 Q 版人形骨架（和主角同一套结构），cfg 控制比例。 */
function buildHumanRig(rig, cfg) {
  return buildBoneRig(rig, [
    { name: 'hips', position: [0, cfg.hipY, 0] },
    { name: 'spine', parent: 'hips', position: [0, cfg.spineY, 0], rotation: [cfg.spineX || 0, 0, 0] },
    { name: 'chest', parent: 'spine', position: [0, cfg.chestY, 0] },
    { name: 'neck', parent: 'chest', position: [0, cfg.neckY, 0] },
    { name: 'head', parent: 'neck', position: [0, cfg.headY, 0] },
    { name: 'armL', parent: 'chest', position: [cfg.shoulderX, cfg.shoulderY, 0], rotation: cfg.armLRot || [-0.04, 0, 0.14] },
    { name: 'foreArmL', parent: 'armL', position: [0, -cfg.upperArm, 0], rotation: cfg.foreArmLRot || [-0.04, 0, 0] },
    { name: 'armR', parent: 'chest', position: [-cfg.shoulderX, cfg.shoulderY, 0], rotation: cfg.armRRot || [-0.04, 0, -0.14] },
    { name: 'foreArmR', parent: 'armR', position: [0, -cfg.upperArm, 0], rotation: cfg.foreArmRRot || [-0.04, 0, 0] },
    { name: 'thighL', parent: 'hips', position: [cfg.hipX, -(cfg.hipDrop || 0.035), 0], rotation: [0, 0, 0.012] },
    { name: 'shinL', parent: 'thighL', position: [0, -cfg.thighLen, 0] },
    { name: 'thighR', parent: 'hips', position: [-cfg.hipX, -(cfg.hipDrop || 0.035), 0], rotation: [0, 0, -0.012] },
    { name: 'shinR', parent: 'thighR', position: [0, -cfg.thighLen, 0] },
  ]);
}

function addHandsFeet(bones, cfg) {
  const handL = new THREE.Group();
  handL.name = 'handL';
  handL.position.set(0, -cfg.foreArm, 0);
  bones.foreArmL.add(handL);
  const handR = new THREE.Group();
  handR.name = 'handR';
  handR.position.set(0, -cfg.foreArm, 0);
  bones.foreArmR.add(handR);
  const footL = new THREE.Group();
  footL.name = 'footL';
  footL.position.set(0, -cfg.shinLen, 0);
  bones.shinL.add(footL);
  const footR = new THREE.Group();
  footR.name = 'footR';
  footR.position.set(0, -cfg.shinLen, 0);
  bones.shinR.add(footR);
  return { handL, handR, footL, footR };
}

/** 圆脸 + 五官的通用小工具；返回可被动画控制的网格。 */
function addChibiFace(ctx, options = {}) {
  const {
    headBone, radius = 0.175, centerY = 0.17, skin = '#e9bd94', eye = '#262220', mouth = '#8d4a3c',
    brows = '#3b3029', mouthWidth = 0.05, eyeScale = 1, browWidth = 0.058, browThickness = 0.013,
  } = options;
  const { collector, defs } = ctx;
  const face = {};

  const skull = blob(radius, 16, 12);
  skull.scale(1.0, 1.01, 0.96);
  skull.translate(0, centerY, 0.004);
  collector.add(headBone, skull, 'skin', defs.skin);

  for (const side of [-1, 1]) {
    const ear = blob(radius * 0.18, 8, 6);
    ear.scale(0.55, 1.0, 0.8);
    ear.translate(side * radius * 0.98, centerY - 0.01, -0.004);
    collector.add(headBone, ear, 'skin', defs.skin);

    const brow = box(browWidth, browThickness, 0.02, 0.0015);
    brow.rotateZ(side * 0.12);
    brow.translate(side * radius * 0.4, centerY + radius * 0.36, radius * 0.88);
    collector.add(headBone, brow, 'brows', defs.brows);

    const eyeGeo = blob(radius * 0.17 * eyeScale, 10, 8);
    eyeGeo.scale(1.0, 1.15, 0.45);
    eyeGeo.translate(side * radius * 0.4, centerY + radius * 0.12, radius * 0.9);
    collector.add(headBone, eyeGeo, 'eye', defs.eye);
    const glint = blob(radius * 0.055, 6, 5);
    glint.translate(side * radius * 0.42, centerY + radius * 0.18, radius * 0.99);
    collector.add(headBone, glint, 'eyeWhite', defs.eyeWhite);
  }

  const nose = blob(radius * 0.1, 8, 6);
  nose.scale(1.0, 0.85, 1.1);
  nose.translate(0, centerY - radius * 0.08, radius * 0.98);
  collector.add(headBone, nose, 'skinShade', defs.skinShade);

  const mouthGeo = box(mouthWidth, 0.016, 0.014, 0.001);
  mouthGeo.translate(0, centerY - radius * 0.42, radius * 0.92);
  collector.addMesh(headBone, mouthGeo, 'mouth', defs.mouth, { castShadow: false });

  return face;
}

// ---------------------------------------------------------------- 遛鸟大爷

function buildDaye(ctx) {
  const { bones, collector } = ctx;
  const defs = {
    skin: { color: '#e2b48c', flatShading: false, surfaceId: 0.22 },
    skinShade: { color: '#cfa077', flatShading: false, surfaceId: 0.23 },
    eye: { color: '#2b2723', flatShading: false, surfaceId: 0.55 },
    eyeWhite: { color: '#f6f0e2', flatShading: false, surfaceId: 0.56 },
    brows: { color: '#b9b3a6', flatShading: false, surfaceId: 0.25 },
    mouth: { color: '#8d4a3c', flatShading: false, surfaceId: 0.54 },
    hair: { color: '#b9b3a6', flatShading: false, surfaceId: 0.245 },
    vest: { color: '#efe8d6', flatShading: true, surfaceId: 0.28 },
    vestShade: { color: '#d8d0bc', flatShading: true, surfaceId: 0.29 },
    shirt: { color: '#5b6b78', flatShading: true, surfaceId: 0.30 },
    shirtDark: { color: '#4a5865', flatShading: true, surfaceId: 0.31 },
    pants: { color: '#3b4652', flatShading: true, surfaceId: 0.32 },
    pantsDark: { color: '#303944', flatShading: true, surfaceId: 0.33 },
    glass: { color: '#b58a45', flatShading: true, surfaceId: 0.50 },
    shoe: { color: '#2b2b30', flatShading: true, surfaceId: 0.36 },
    shoeSole: { color: '#1a1b1e', flatShading: true, surfaceId: 0.37 },
    towel: { color: '#9db3b6', flatShading: true, surfaceId: 0.40 },
    cap: { color: '#6f7f8a', flatShading: true, surfaceId: 0.41 },
    capDark: { color: '#596771', flatShading: true, surfaceId: 0.42 },
    bamboo: { color: '#c9a05a', flatShading: true, surfaceId: 0.44 },
    bambooDark: { color: '#a9814a', flatShading: true, surfaceId: 0.45 },
    bird: { color: '#d9c05a', flatShading: false, surfaceId: 0.46 },
    beak: { color: '#c98a3a', flatShading: true, surfaceId: 0.47 },
    tassel: { color: '#b8503f', flatShading: false, surfaceId: 0.48 },
  };
  ctx.defs = defs;
  const J = 0.006;

  // 躯干：微驼背 + 微胖
  const pelvis = taperBox(0.285, 0.215, 0.32, 0.23, 0.26, J);
  pelvis.translate(0, -0.02, 0);
  collector.add(bones.hips, pelvis, 'pants', defs.pants);
  // 灰蓝短袖衬衫
  const belly = taperBox(0.30, 0.21, 0.345, 0.235, 0.19, J);
  belly.translate(0, 0.1, 0.008);
  collector.add(bones.spine, belly, 'shirt', defs.shirt);
  const chestGeo = taperBox(0.345, 0.235, 0.315, 0.195, 0.17, J);
  chestGeo.translate(0, 0.09, 0);
  collector.add(bones.chest, chestGeo, 'shirt', defs.shirt);
  // 敞开一点的白背心领口 + 衬衫门襟 + 扣子
  const tankV = taperBox(0.085, 0.02, 0.018, 0.016, 0.085, 0.001);
  tankV.translate(0, 0.145, 0.106);
  collector.add(bones.chest, tankV, 'vest', defs.vest);
  for (const side of [-1, 1]) {
    const lapel = box(0.055, 0.075, 0.024, 0.002);
    lapel.rotateZ(side * 0.32);
    lapel.rotateY(side * -0.35);
    lapel.translate(side * 0.062, 0.165, 0.105);
    collector.add(bones.chest, lapel, 'shirtDark', defs.shirtDark);
  }
  const placket = box(0.028, 0.3, 0.018, 0.002);
  placket.translate(0, 0.1, 0.112);
  collector.add(bones.spine, placket, 'shirtDark', defs.shirtDark);
  for (let i = 0; i < 3; i += 1) {
    const button = new THREE.CylinderGeometry(0.011, 0.011, 0.01, 8);
    button.rotateX(Math.PI / 2);
    button.translate(0, 0.205 - i * 0.07, 0.123);
    collector.add(bones.spine, button, 'shirtDark', defs.shirtDark);
  }
  // 脖子
  const neckGeo = new THREE.CylinderGeometry(0.052, 0.058, 0.11, 8);
  neckGeo.translate(0, 0.03, 0);
  collector.add(bones.neck, neckGeo, 'skin', defs.skin);
  // 衬衫短袖
  for (const side of ['L', 'R']) {
    const armBone = side === 'L' ? bones.armL : bones.armR;
    const sleeve = taperBox(0.115, 0.12, 0.1, 0.11, 0.14, J);
    sleeve.translate(0, -0.06, 0);
    collector.add(armBone, sleeve, 'shirt', defs.shirt);
  }
  // 一根毛巾搭在脖子上  // 一根毛巾搭在脖子上
  const towelRing = new THREE.TorusGeometry(0.075, 0.026, 5, 12);
  towelRing.rotateX(Math.PI / 2);
  towelRing.translate(0, 0.02, 0.02);
  collector.add(bones.neck, towelRing, 'towel', defs.towel);
  const towelTail = box(0.07, 0.2, 0.02, 0.002);
  towelTail.rotateZ(0.08);
  towelTail.translate(0.05, -0.09, 0.075);
  collector.add(bones.chest, towelTail, 'towel', defs.towel);

  // 腿（长裤）
  for (const side of ['L', 'R']) {
    const thigh = side === 'L' ? bones.thighL : bones.thighR;
    const shin = side === 'L' ? bones.shinL : bones.shinR;
    const foot = side === 'L' ? ctx.handFeet.footL : ctx.handFeet.footR;
    const thighGeo = taperBox(0.12, 0.135, 0.105, 0.12, 0.29, J);
    thighGeo.translate(0, -0.145, 0);
    collector.add(thigh, thighGeo, 'pants', defs.pants);
    const shinGeo = taperBox(0.105, 0.12, 0.09, 0.1, 0.27, J);
    shinGeo.translate(0, -0.135, 0);
    collector.add(shin, shinGeo, 'pants', defs.pantsDark);
    const shoe = box(0.11, 0.075, 0.2, 0.003);
    shoe.translate(0, -0.045, 0.04);
    collector.add(foot, shoe, 'shoe', defs.shoe);
    const sole = box(0.122, 0.028, 0.21, 0.002);
    sole.translate(0, -0.085, 0.042);
    collector.add(foot, sole, 'shoeSole', defs.shoeSole);
  }

  // 手臂：皮肤 + 衬衫短袖（上面已经加过），左手背在身后，右手提鸟笼
  for (const side of ['L', 'R']) {
    const armBone = side === 'L' ? bones.armL : bones.armR;
    const foreBone = side === 'L' ? bones.foreArmL : bones.foreArmR;
    const handBone = side === 'L' ? ctx.handFeet.handL : ctx.handFeet.handR;
    const shoulderCap = blob(0.06, 8, 6);
    shoulderCap.translate(0, -0.02, 0);
    collector.add(armBone, shoulderCap, 'shirt', defs.shirt);
    const upper = new THREE.CylinderGeometry(0.045, 0.04, 0.22, 7);
    upper.translate(0, -0.11, 0);
    collector.add(armBone, upper, 'skin', defs.skin);
    const fore = new THREE.CylinderGeometry(0.042, 0.038, 0.2, 7);
    fore.translate(0, -0.1, 0);
    collector.add(foreBone, fore, 'skin', defs.skin);
    const hand = blob(0.046, 8, 6);
    hand.scale(1.0, 0.9, 1.1);
    hand.translate(0, -0.02, 0.01);
    collector.add(handBone, hand, 'skin', defs.skin);
  }

  // 头
  const face = addChibiFace(ctx, {
    headBone: bones.head, radius: 0.175, centerY: 0.17, skin: '#e2b48c',
    eyeScale: 1.0, mouthWidth: 0.045, browWidth: 0.06, browThickness: 0.016,
  });
  // 谢顶也能看出来：灰白头发只从后脑/两鬓露出来（前半球藏在头里）
  const hairBack = blob(0.183, 16, 12);
  hairBack.scale(1.0, 1.0, 1.0);
  hairBack.translate(0, 0.168, -0.045);
  collector.add(bones.head, hairBack, 'hair', defs.hair);
  for (const side of [-1, 1]) {
    const sideburn = box(0.032, 0.075, 0.05, 0.002);
    sideburn.translate(side * 0.158, 0.14, 0.02);
    collector.add(bones.head, sideburn, 'hair', defs.hair);
    // 花镜（大爷的另一个记忆点）
    const lens = new THREE.TorusGeometry(0.029, 0.005, 4, 10);
    lens.translate(side * 0.07, 0.19, 0.176);
    collector.add(bones.head, lens, 'glass', defs.glass);
  }
  const bridge = box(0.042, 0.007, 0.007, 0.001);
  bridge.translate(0, 0.194, 0.176);
  collector.add(bones.head, bridge, 'glass', defs.glass);
  // 山羊胡 + 八字胡（灰白、小一点）
  const beard = taperBox(0.042, 0.022, 0.016, 0.016, 0.045, 0.002);
  beard.translate(0, 0.05, 0.146);
  collector.add(bones.head, beard, 'hair', defs.hair);
  for (const side of [-1, 1]) {
    const mustache = box(0.042, 0.01, 0.014, 0.0015);
    mustache.rotateZ(side * 0.16);
    mustache.translate(side * 0.032, 0.127, 0.168);
    collector.add(bones.head, mustache, 'hair', defs.hair);
  }

  // 蓝灰色鸭舌帽
  const capCrown = new THREE.CylinderGeometry(0.146, 0.178, 0.095, 12);
  capCrown.translate(0, 0.313, -0.004);
  const capDome = blob(0.148, 12, 6);
  capDome.scale(1.0, 0.4, 1.0);
  capDome.translate(0, 0.355, -0.004);
  collector.add(bones.head, capDome, 'cap', defs.cap);
  collector.add(bones.head, capCrown, 'cap', defs.cap);
  const capBrim = new THREE.CylinderGeometry(0.185, 0.185, 0.018, 16, 1, false, -Math.PI / 2, Math.PI);
  capBrim.rotateX(-0.12);
  capBrim.translate(0, 0.272, 0.055);
  collector.add(bones.head, capBrim, 'capDark', defs.capDark);
  const capTop = new THREE.CylinderGeometry(0.026, 0.03, 0.012, 8);
  capTop.translate(0, 0.372, -0.004);
  collector.add(bones.head, capTop, 'capDark', defs.capDark);

  // 鸟笼：挂在右手
  const cage = new THREE.Group();
  cage.name = 'birdcage';
  cage.position.set(0, -0.03, 0.01);
  cage.rotation.set(0.3, 0, 0.32);
  ctx.handFeet.handR.add(cage);

  const hook = new THREE.TorusGeometry(0.026, 0.006, 5, 10);
  hook.rotateX(Math.PI / 2);
  hook.translate(0, -0.01, 0);
  collector.add(cage, hook, 'bambooDark', defs.bambooDark);

  const cageBottom = -0.27;
  const cageTop = -0.09;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * PI2;
    const bar = new THREE.CylinderGeometry(0.0045, 0.0045, cageTop - cageBottom, 5);
    bar.translate(Math.cos(angle) * 0.092, (cageTop + cageBottom) / 2, Math.sin(angle) * 0.092);
    collector.add(cage, bar, 'bamboo', defs.bamboo);
  }
  for (const y of [cageTop, cageBottom]) {
    const ring = new THREE.TorusGeometry(0.092, 0.008, 5, 12);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, y, 0);
    collector.add(cage, ring, 'bambooDark', defs.bambooDark);
  }
  const basePlate = new THREE.CylinderGeometry(0.098, 0.098, 0.018, 12);
  basePlate.translate(0, cageBottom - 0.008, 0);
  collector.add(cage, basePlate, 'bambooDark', defs.bambooDark);
  const dome = new THREE.SphereGeometry(0.092, 10, 5, 0, PI2, 0, Math.PI / 2);
  dome.translate(0, cageTop, 0);
  collector.add(cage, dome, 'bamboo', defs.bamboo);
  // 笼里的鸟 + 站杆
  const perch = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5);
  perch.rotateZ(Math.PI / 2);
  perch.translate(0, -0.19, 0);
  collector.add(cage, perch, 'bambooDark', defs.bambooDark);
  const bird = new THREE.Group();
  bird.position.set(0.02, -0.19, 0);
  cage.add(bird);
  const birdBody = blob(0.035, 8, 6);
  birdBody.scale(1.25, 0.95, 0.85);
  collector.add(bird, birdBody, 'bird', defs.bird);
  const birdHead = blob(0.022, 7, 6);
  birdHead.translate(0.038, 0.026, 0);
  collector.add(bird, birdHead, 'bird', defs.bird);
  const beak = new THREE.ConeGeometry(0.011, 0.026, 5);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.062, 0.026, 0);
  collector.add(bird, beak, 'beak', defs.beak);
  const tail = new THREE.ConeGeometry(0.014, 0.05, 5);
  tail.rotateZ(Math.PI / 2);
  tail.translate(-0.055, 0.006, 0);
  collector.add(bird, tail, 'bird', defs.bird);
  const tassel = new THREE.CylinderGeometry(0.007, 0.016, 0.07, 5);
  tassel.translate(0, -0.31, 0);
  collector.add(cage, tassel, 'tassel', defs.tassel);

  const head = bones.head;
  const actions = {
    idle: {
      loop: 4.6,
      pose(t, pose) {
        const p = (t / 4.6) * PI2;
        const s = Math.sin(p);
        pose.hipsY = 0.005 * s - 0.004;
        pose.rot.hips[1] = 0.035 * s;
        pose.rot.spine[0] = 0.012 * s;
        pose.rot.chest[1] = -0.03 * s;
        pose.rot.head[0] = 0.03 + 0.02 * Math.sin(p * 1.7 + 0.6);
        pose.rot.head[1] = 0.12 * Math.sin(p * 0.7 + 0.3);
        pose.rot.head[2] = 0.03 * Math.sin(p * 0.5);
        pose.rot.armR[0] = 0.05 * s;
        pose.rot.armR[1] = 0.02 * Math.sin(p * 0.9);
        pose.rot.foreArmR[0] = 0.03 * s;
        pose.rot.armL[0] = 0.02 * Math.sin(p + 1.2);
        pose.rot.thighL[0] = 0.01 * s;
        pose.rot.thighR[0] = -0.01 * s;
        pose.rot.shinL[0] = 0.015;
        pose.rot.shinR[0] = 0.015;
      },
    },
    talk: {
      loop: 4.6,
      pose(t, pose) {
        actions.idle.pose(t, pose);
        pose.rot.head[0] += 0.08 * Math.sin(t * 3.6);
        pose.rot.head[1] += 0.05 * Math.sin(t * 1.9 + 0.4);
        pose.rot.chest[1] += 0.02 * Math.sin(t * 1.9);
      },
    },
  };

  void face;
  void head;
  return {
    actions,
    extras(t, weights) {
      // 鸟笼随手臂轻晃，偶尔鸟蹦一下
      cage.rotation.z = 0.32 + 0.06 * Math.sin(t * 1.6) + weights.talk * 0.03 * Math.sin(t * 3.2);
      cage.rotation.x = 0.3 + 0.04 * Math.sin(t * 1.2 + 0.7);
      bird.position.y = -0.19 + Math.max(0, Math.sin(t * 2.2)) * 0.018;
      bird.rotation.y = 0.3 * Math.sin(t * 0.8);
    },
  };
}

// ---------------------------------------------------------------- 广场舞大妈

function buildDama(ctx) {
  const { bones, collector } = ctx;
  const defs = {
    skin: { color: '#e8bd94', flatShading: false, surfaceId: 0.22 },
    skinShade: { color: '#d3a67d', flatShading: false, surfaceId: 0.23 },
    eye: { color: '#2b2723', flatShading: false, surfaceId: 0.55 },
    eyeWhite: { color: '#f6f0e2', flatShading: false, surfaceId: 0.56 },
    brows: { color: '#4a3a34', flatShading: false, surfaceId: 0.25 },
    mouth: { color: '#a34d4a', flatShading: false, surfaceId: 0.54 },
    pants: { color: '#3c4149', flatShading: true, surfaceId: 0.32 },
    pantsDark: { color: '#31353c', flatShading: true, surfaceId: 0.33 },
    shoe: { color: '#2b2b30', flatShading: true, surfaceId: 0.36 },
    shoeSole: { color: '#1a1b1e', flatShading: true, surfaceId: 0.37 },
    scarf: { color: '#a8434e', flatShading: false, surfaceId: 0.42 },
    scarfDark: { color: '#8a3540', flatShading: false, surfaceId: 0.43 },
    fan: { color: '#c9553f', flatShading: true, surfaceId: 0.46 },
    fanPaper: { color: '#e3c9a4', flatShading: true, surfaceId: 0.47 },
    gold: { color: '#d9a63f', flatShading: true, surfaceId: 0.44 },
  };
  // 上衣用「碎花布」贴图
  const floral = makeCanvasTexture(128, 128, (context, w, h) => {
    context.fillStyle = '#b5626b';
    context.fillRect(0, 0, w, h);
    context.fillStyle = 'rgba(244, 239, 226, 0.85)';
    for (let i = 0; i < 22; i += 1) {
      const x = (i * 53) % w;
      const y = (i * 91) % h;
      const r = 2.5 + (i % 3);
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(x + 7, y + 5, r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  });
  ctx.textures.push(floral);
  defs.top = { color: '#ffffff', flatShading: true, surfaceId: 0.28, map: floral };
  defs.topShade = { color: '#b5626b', flatShading: true, surfaceId: 0.29 };
  ctx.defs = defs;
  const J = 0.006;

  const pelvis = taperBox(0.33, 0.24, 0.365, 0.25, 0.2, J);
  pelvis.translate(0, -0.045, 0);
  collector.add(bones.hips, pelvis, 'pants', defs.pants);
  const hipSkirt = taperBox(0.365, 0.25, 0.34, 0.235, 0.09, J);
  hipSkirt.translate(0, 0.03, 0);
  collector.add(bones.hips, hipSkirt, 'top', defs.top);
  const lower = taperBox(0.345, 0.235, 0.375, 0.25, 0.165, J);
  lower.translate(0, 0.1, 0);
  collector.add(bones.spine, lower, 'top', defs.top);
  const upper = taperBox(0.375, 0.25, 0.35, 0.225, 0.145, J);
  upper.translate(0, 0.08, 0);
  collector.add(bones.chest, upper, 'top', defs.top);
  // 圆领
  const collar = new THREE.TorusGeometry(0.09, 0.018, 5, 12);
  collar.rotateX(Math.PI / 2);
  collar.translate(0, 0.145, 0.01);
  collector.add(bones.chest, collar, 'topShade', defs.topShade);

  // 腿（深色长裤）
  for (const side of ['L', 'R']) {
    const thigh = side === 'L' ? bones.thighL : bones.thighR;
    const shin = side === 'L' ? bones.shinL : bones.shinR;
    const foot = side === 'L' ? ctx.handFeet.footL : ctx.handFeet.footR;
    const thighGeo = taperBox(0.14, 0.155, 0.12, 0.135, 0.28, J);
    thighGeo.translate(0, -0.14, 0);
    collector.add(thigh, thighGeo, 'pants', defs.pants);
    const shinGeo = taperBox(0.115, 0.13, 0.095, 0.105, 0.26, J);
    shinGeo.translate(0, -0.13, 0);
    collector.add(shin, shinGeo, 'pants', defs.pantsDark);
    const shoe = box(0.105, 0.075, 0.19, 0.003);
    shoe.translate(0, -0.045, 0.038);
    collector.add(foot, shoe, 'shoe', defs.shoe);
    const sole = box(0.118, 0.028, 0.2, 0.002);
    sole.translate(0, -0.085, 0.04);
    collector.add(foot, sole, 'shoeSole', defs.shoeSole);
  }

  // 手臂：短袖 + 皮肤，左手举扇，右手叉腰
  for (const side of ['L', 'R']) {
    const armBone = side === 'L' ? bones.armL : bones.armR;
    const foreBone = side === 'L' ? bones.foreArmL : bones.foreArmR;
    const handBone = side === 'L' ? ctx.handFeet.handL : ctx.handFeet.handR;
    const sleeve = taperBox(0.1, 0.1, 0.088, 0.09, 0.13, J);
    sleeve.translate(0, -0.065, 0);
    collector.add(armBone, sleeve, 'top', defs.top);
    const fore = new THREE.CylinderGeometry(0.042, 0.036, 0.2, 7);
    fore.translate(0, -0.1, 0);
    collector.add(foreBone, fore, 'skin', defs.skin);
    const hand = blob(0.046, 8, 6);
    hand.scale(1.0, 0.9, 1.1);
    hand.translate(0, -0.02, 0.01);
    collector.add(handBone, hand, 'skin', defs.skin);
  }

  addChibiFace(ctx, {
    headBone: bones.head, radius: 0.168, centerY: 0.165, skin: '#e8bd94', mouthWidth: 0.048,
  });

  // 头巾（花布）：球体往上、往后挪，前半球藏进脸里，只盖住头顶/后脑
  const scarfCap = blob(0.185, 16, 12);
  scarfCap.scale(1.03, 1.0, 1.02);
  scarfCap.translate(0, 0.19, -0.05);
  collector.add(bones.head, scarfCap, 'scarf', { ...defs.scarf, map: floralBgTexture(ctx) });
  const scarfKnot = blob(0.05, 8, 6);
  scarfKnot.scale(1.1, 0.9, 0.8);
  scarfKnot.translate(0, 0.12, -0.17);
  collector.add(bones.head, scarfKnot, 'scarfDark', defs.scarfDark);
  const scarfTailGroup = new THREE.Group();
  scarfTailGroup.position.set(-0.035, 0.03, -0.185);
  scarfTailGroup.rotation.set(-0.25, 0, 0.06);
  bones.head.add(scarfTailGroup);
  const scarfTailGeo = box(0.06, 0.16, 0.025, 0.003);
  scarfTailGeo.translate(0, -0.08, 0);
  collector.add(scarfTailGroup, scarfTailGeo, 'scarfDark', defs.scarfDark);
  // 珍珠耳环
  for (const side of [-1, 1]) {
    const earring = blob(0.016, 6, 5);
    earring.translate(side * 0.155, 0.11, 0.01);
    collector.add(bones.head, earring, 'gold', defs.gold);
  }

  // 折扇：左手
  const fan = new THREE.Group();
  fan.name = 'dancing-fan';
  fan.position.set(0.44, 0.02, 0.2);
  fan.rotation.set(0, 0, 0.15);
  bones.chest.add(fan);
  const handle = new THREE.CylinderGeometry(0.011, 0.013, 0.12, 6);
  handle.translate(0, -0.06, 0);
  collector.add(fan, handle, 'fan', defs.fan);
  const fanDisc = new THREE.CircleGeometry(0.2, 12, Math.PI * 0.16, Math.PI * 0.68);
  fanDisc.translate(0, 0.1, 0.004);
  collector.add(fan, fanDisc, 'fanPaper', defs.fanPaper);
  const fanDiscBack = new THREE.CircleGeometry(0.2, 12, Math.PI * 0.16, Math.PI * 0.68);
  fanDiscBack.rotateY(Math.PI);
  fanDiscBack.translate(0, 0.1, -0.004);
  collector.add(fan, fanDiscBack, 'fan', defs.fan);
  for (let i = 0; i < 4; i += 1) {
    const rib = box(0.008, 0.19, 0.006, 0);
    rib.rotateZ(-0.5 + i * 0.33);
    rib.translate(Math.sin(-0.5 + i * 0.33) * 0.09, 0.1 + Math.cos(-0.5 + i * 0.33) * 0.02, 0.006);
    collector.add(fan, rib, 'gold', defs.gold);
  }

  const actions = {
    idle: {
      loop: 3.6,
      pose(t, pose) {
        const p = (t / 3.6) * PI2;
        const s = Math.sin(p);
        pose.hipsY = 0.008 * Math.sin(p * 2) - 0.002;
        pose.rot.hips[1] = 0.14 * s;
        pose.rot.hips[2] = 0.05 * Math.sin(p + 0.6);
        pose.rot.spine[1] = -0.06 * s;
        pose.rot.chest[1] = -0.08 * s;
        pose.rot.chest[2] = -0.04 * Math.sin(p + 0.6);
        pose.rot.neck[0] = 0.01;
        pose.rot.head[0] = 0.02 + 0.02 * Math.sin(p * 2 + 0.4);
        pose.rot.head[1] = 0.16 * Math.sin(p + 1.2);
        pose.rot.head[2] = 0.06 * Math.sin(p + 0.6);
        pose.rot.armL[0] = -0.15 + 0.08 * Math.sin(p * 1.5);
        pose.rot.armL[2] = 0.1 * Math.sin(p + 0.3);
        pose.rot.foreArmL[0] = -0.15 + 0.1 * Math.sin(p * 1.5 + 0.4);
        pose.rot.armR[0] = 0.04 * Math.sin(p + 1.1);
        pose.rot.thighL[0] = 0.02 * s;
        pose.rot.thighR[0] = -0.02 * s;
        pose.rot.shinL[0] = 0.025;
        pose.rot.shinR[0] = 0.025;
      },
    },
    talk: {
      loop: 4.0,
      pose(t, pose) {
        actions.idle.pose(t, pose);
        pose.rot.head[0] += 0.07 * Math.sin(t * 3.4);
        pose.rot.head[1] += 0.04 * Math.sin(t * 1.6 + 0.8);
      },
    },
  };

  return {
    actions,
    extras(t, weights) {
      fan.rotation.z = 0.15 + 0.26 * Math.sin(t * 2.1);
      fan.rotation.x = 0.08 * Math.sin(t * 1.3 + 0.5);
      scarfTailGroup.rotation.x = -0.25 + 0.08 * Math.sin(t * 1.8);
      void weights;
    },
  };
}

/** 大妈头巾用的另一张花布（复用画布逻辑，独立纹理）。 */
function floralBgTexture(ctx) {
  if (ctx._floralBg) return ctx._floralBg;
  const texture = makeCanvasTexture(96, 96, (context, w, h) => {
    context.fillStyle = '#a8434e';
    context.fillRect(0, 0, w, h);
    context.fillStyle = 'rgba(244, 239, 226, 0.8)';
    for (let i = 0; i < 16; i += 1) {
      const x = (i * 37 + 9) % w;
      const y = (i * 53 + 13) % h;
      context.beginPath();
      context.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
      context.fill();
    }
  });
  ctx._floralBg = texture;
  ctx.textures.push(texture);
  return texture;
}

// ---------------------------------------------------------------- 红领巾小学生

function buildXiaoxuesheng(ctx) {
  const { bones, collector } = ctx;
  const defs = {
    skin: { color: '#ebc49c', flatShading: false, surfaceId: 0.22 },
    skinShade: { color: '#d6a982', flatShading: false, surfaceId: 0.23 },
    blush: { color: '#e0a08a', flatShading: false, surfaceId: 0.525 },
    eye: { color: '#262220', flatShading: false, surfaceId: 0.55 },
    eyeWhite: { color: '#f6f0e2', flatShading: false, surfaceId: 0.56 },
    brows: { color: '#3b3029', flatShading: false, surfaceId: 0.25 },
    mouth: { color: '#a34d4a', flatShading: false, surfaceId: 0.54 },
    hair: { color: '#3b3029', flatShading: false, surfaceId: 0.245 },
    shirt: { color: '#f2ecdd', flatShading: true, surfaceId: 0.28 },
    shirtShade: { color: '#d9d2c1', flatShading: true, surfaceId: 0.29 },
    shorts: { color: '#3f5d7a', flatShading: true, surfaceId: 0.32 },
    shortsDark: { color: '#334a62', flatShading: true, surfaceId: 0.33 },
    sock: { color: '#efe6d6', flatShading: true, surfaceId: 0.34 },
    shoe: { color: '#2b2b30', flatShading: true, surfaceId: 0.36 },
    shoeSole: { color: '#1a1b1e', flatShading: true, surfaceId: 0.37 },
    scraft: { color: '#c0392b', flatShading: true, surfaceId: 0.42 },
    cap: { color: '#d9b23f', flatShading: true, surfaceId: 0.44 },
    capDark: { color: '#b8932c', flatShading: true, surfaceId: 0.45 },
    pack: { color: '#6d7f5a', flatShading: true, surfaceId: 0.46 },
    packDark: { color: '#58684a', flatShading: true, surfaceId: 0.47 },
    wrist: { color: '#c0392b', flatShading: true, surfaceId: 0.48 },
  };
  ctx.defs = defs;
  const J = 0.005;

  const pelvis = taperBox(0.245, 0.185, 0.27, 0.2, 0.16, J);
  pelvis.translate(0, -0.035, 0);
  collector.add(bones.hips, pelvis, 'shorts', defs.shorts);
  const lower = taperBox(0.245, 0.19, 0.26, 0.2, 0.13, J);
  lower.translate(0, 0.085, 0);
  collector.add(bones.spine, lower, 'shirt', defs.shirt);
  const upper = taperBox(0.26, 0.2, 0.245, 0.18, 0.115, J);
  upper.translate(0, 0.065, 0);
  collector.add(bones.chest, upper, 'shirt', defs.shirt);
  // 衬衫下摆
  const hem = box(0.25, 0.025, 0.2, 0.002);
  hem.translate(0, 0.012, 0);
  collector.add(bones.spine, hem, 'shirtShade', defs.shirtShade);
  // 领子
  const collar = new THREE.TorusGeometry(0.068, 0.014, 5, 10);
  collar.rotateX(Math.PI / 2);
  collar.translate(0, 0.118, 0.005);
  collector.add(bones.chest, collar, 'shirtShade', defs.shirtShade);
  // 红领巾：脖圈 + 大三角 + 结
  const scarfRing = new THREE.TorusGeometry(0.074, 0.026, 5, 12);
  scarfRing.rotateX(Math.PI / 2);
  scarfRing.translate(0, 0.112, 0.005);
  collector.add(bones.chest, scarfRing, 'scraft', defs.scraft);
  const scarfKnot = box(0.036, 0.03, 0.026, 0.002);
  scarfKnot.translate(0, 0.092, 0.106);
  collector.add(bones.chest, scarfKnot, 'scraft', defs.scraft);
  const scarfWing = taperBox(0.13, 0.02, 0.026, 0.02, 0.1, 0.001);
  scarfWing.translate(0, 0.055, 0.1);
  collector.add(bones.chest, scarfWing, 'scraft', defs.scraft);
  const scarfFrontGroup = new THREE.Group();
  scarfFrontGroup.position.set(0, 0.115, 0.09);
  scarfFrontGroup.rotation.set(0.08, 0, 0);
  bones.chest.add(scarfFrontGroup);
  const scarfFrontGeo = taperBox(0.11, 0.02, 0.022, 0.018, 0.15, 0.001);
  scarfFrontGeo.translate(0, -0.075, 0);
  collector.add(scarfFrontGroup, scarfFrontGeo, 'scraft', defs.scraft);
  const scarfFrontTipGeo = taperBox(0.075, 0.018, 0.022, 0.016, 0.09, 0.001);
  scarfFrontTipGeo.translate(0, -0.195, 0.004);
  collector.add(scarfFrontGroup, scarfFrontTipGeo, 'scraft', defs.scraft);

  // 腿：蓝短裤 + 白袜 + 黑鞋
  for (const side of ['L', 'R']) {
    const thigh = side === 'L' ? bones.thighL : bones.thighR;
    const shin = side === 'L' ? bones.shinL : bones.shinR;
    const foot = side === 'L' ? ctx.handFeet.footL : ctx.handFeet.footR;
    const shortsGeo = taperBox(0.125, 0.135, 0.115, 0.125, 0.14, J);
    shortsGeo.translate(0, -0.06, 0);
    collector.add(thigh, shortsGeo, 'shorts', defs.shorts);
    const thighSkin = new THREE.CylinderGeometry(0.052, 0.047, 0.13, 7);
    thighSkin.translate(0, -0.19, 0);
    collector.add(thigh, thighSkin, 'skin', defs.skin);
    const shinSkin = new THREE.CylinderGeometry(0.046, 0.04, 0.15, 7);
    shinSkin.translate(0, -0.115, 0);
    collector.add(shin, shinSkin, 'skin', defs.skin);
    const sock = new THREE.CylinderGeometry(0.045, 0.047, 0.08, 7);
    sock.translate(0, -0.21, 0);
    collector.add(shin, sock, 'sock', defs.sock);
    const shoe = box(0.098, 0.07, 0.17, 0.003);
    shoe.translate(0, -0.045, 0.035);
    collector.add(foot, shoe, 'shoe', defs.shoe);
    const sole = box(0.108, 0.025, 0.18, 0.002);
    sole.translate(0, -0.08, 0.037);
    collector.add(foot, sole, 'shoeSole', defs.shoeSole);
  }

  // 手臂：白短袖 + 皮肤
  for (const side of ['L', 'R']) {
    const armBone = side === 'L' ? bones.armL : bones.armR;
    const foreBone = side === 'L' ? bones.foreArmL : bones.foreArmR;
    const handBone = side === 'L' ? ctx.handFeet.handL : ctx.handFeet.handR;
    const sleeve = taperBox(0.088, 0.088, 0.078, 0.078, 0.1, J);
    sleeve.translate(0, -0.05, 0);
    collector.add(armBone, sleeve, 'shirt', defs.shirt);
    const fore = new THREE.CylinderGeometry(0.035, 0.031, 0.16, 7);
    fore.translate(0, -0.08, 0);
    collector.add(foreBone, fore, 'skin', defs.skin);
    const hand = blob(0.04, 8, 6);
    hand.scale(1.0, 0.9, 1.1);
    hand.translate(0, -0.02, 0.008);
    collector.add(handBone, hand, 'skin', defs.skin);
  }

  const face = addChibiFace(ctx, {
    headBone: bones.head, radius: 0.163, centerY: 0.155, skin: '#ebc49c', eyeScale: 1.08, mouthWidth: 0.052,
    browWidth: 0.044, browThickness: 0.011,
  });
  void face;
  // 小圆脸腮红
  for (const side of [-1, 1]) {
    const cheek = blob(0.026, 8, 6);
    cheek.scale(1.0, 0.55, 0.22);
    cheek.translate(side * 0.1, 0.13, 0.13);
    collector.add(bones.head, cheek, 'blush', defs.blush);
  }
  // 帽子两侧留一点黑发（小学生的头发从帽檐底下露出来）
  for (const side of [-1, 1]) {
    const tuft = box(0.03, 0.05, 0.04, 0.002);
    tuft.rotateZ(side * 0.15);
    tuft.translate(side * 0.142, 0.205, 0.015);
    collector.add(bones.head, tuft, 'hair', defs.hair);
  }

  // 小黄帽
  const capCrown = new THREE.CylinderGeometry(0.128, 0.162, 0.07, 12);
  capCrown.translate(0, 0.275, -0.004);
  collector.add(bones.head, capCrown, 'cap', defs.cap);
  const capBand = new THREE.CylinderGeometry(0.166, 0.166, 0.024, 12);
  capBand.translate(0, 0.246, -0.004);
  collector.add(bones.head, capBand, 'capDark', defs.capDark);
  const capBrim = new THREE.CylinderGeometry(0.172, 0.172, 0.016, 16, 1, false, -Math.PI / 2, Math.PI);
  capBrim.rotateX(-0.14);
  capBrim.translate(0, 0.238, 0.048);
  collector.add(bones.head, capBrim, 'capDark', defs.capDark);
  const capTop = new THREE.CylinderGeometry(0.022, 0.026, 0.01, 8);
  capTop.translate(0, 0.308, -0.004);
  collector.add(bones.head, capTop, 'capDark', defs.capDark);

  // 双肩书包
  const pack = new THREE.Group();
  pack.name = 'school-pack';
  pack.position.set(0, 0.0, -0.16);
  pack.rotation.x = -0.08;
  bones.chest.add(pack);
  const packBody = box(0.21, 0.22, 0.11, 0.004);
  packBody.translate(0, 0.0, 0);
  collector.add(pack, packBody, 'pack', defs.pack);
  const packFlap = box(0.215, 0.085, 0.115, 0.003);
  packFlap.translate(0, 0.075, 0.002);
  collector.add(pack, packFlap, 'packDark', defs.packDark);
  const packPocket = box(0.14, 0.09, 0.02, 0.002);
  packPocket.translate(0, -0.055, 0.058);
  collector.add(pack, packPocket, 'packDark', defs.packDark);
  for (const side of [-1, 1]) {
    const strap = box(0.03, 0.2, 0.018, 0.002);
    strap.rotateX(-0.1);
    strap.translate(side * 0.075, 0.02, 0.098);
    collector.add(bones.chest, strap, 'packDark', defs.packDark);
  }

  const actions = {
    idle: {
      loop: 2.6,
      pose(t, pose) {
        const p = (t / 2.6) * PI2;
        const s = Math.sin(p);
        pose.hipsY = 0.012 * Math.abs(Math.sin(p * 2)) - 0.004;
        pose.rot.hips[1] = 0.05 * s;
        pose.rot.spine[0] = -0.01 + 0.02 * Math.sin(p * 2);
        pose.rot.chest[1] = -0.04 * s;
        pose.rot.head[0] = 0.01 + 0.03 * Math.sin(p * 2 + 0.5);
        pose.rot.head[1] = 0.12 * Math.sin(p * 0.8 + 0.4);
        pose.rot.head[2] = 0.04 * Math.sin(p + 0.2);
        pose.rot.armL[0] = 0.1 * Math.sin(p + 0.5);
        pose.rot.armR[0] = -0.1 * Math.sin(p + 0.5);
        pose.rot.armL[2] = 0.04;
        pose.rot.armR[2] = -0.04;
        pose.rot.foreArmL[0] = -0.12;
        pose.rot.foreArmR[0] = -0.12;
        pose.rot.thighL[0] = 0.02 * s;
        pose.rot.thighR[0] = -0.02 * s;
        pose.rot.shinL[0] = 0.03;
        pose.rot.shinR[0] = 0.03;
      },
    },
    talk: {
      loop: 3.2,
      pose(t, pose) {
        actions.idle.pose(t, pose);
        pose.rot.head[0] += 0.08 * Math.sin(t * 4.2);
        pose.rot.head[1] += 0.06 * Math.sin(t * 2.2);
        pose.rot.armR[0] -= 0.2 + 0.1 * Math.sin(t * 3.0);
        pose.rot.foreArmR[0] -= 0.2;
      },
    },
  };

  return {
    actions,
    extras(t, weights) {
      pack.rotation.x = -0.08 + 0.03 * Math.sin(t * 3.1);
      pack.position.z = -0.16 + 0.006 * Math.sin(t * 2.6);
      scarfFrontGroup.rotation.x = 0.08 + 0.05 * Math.sin(t * 2.4);
      void weights;
    },
  };
}

// ---------------------------------------------------------------- 类型注册

const NPC_DEFS = {
  'beijing-daye': {
    rig: {
      hipY: 0.66, spineY: 0.1, chestY: 0.18, neckY: 0.14, headY: 0.06,
      shoulderX: 0.155, shoulderY: 0.115, upperArm: 0.22, foreArm: 0.2,
      hipX: 0.083, hipDrop: 0.03, thighLen: 0.28, shinLen: 0.27,
      spineX: -0.1,
      armLRot: [-0.02, 0, 0.14], foreArmLRot: [-0.18, 0, 0.05],
      armRRot: [-0.18, 0, -0.3], foreArmRRot: [-0.15, 0, 0],
    },
    build: buildDaye,
  },
  'beijing-dama': {
    rig: {
      hipY: 0.7, spineY: 0.09, chestY: 0.16, neckY: 0.13, headY: 0.055,
      shoulderX: 0.16, shoulderY: 0.105, upperArm: 0.21, foreArm: 0.19,
      hipX: 0.088, hipDrop: 0.03, thighLen: 0.27, shinLen: 0.26,
      armLRot: [-0.35, 0, 0.75], foreArmLRot: [-0.55, 0, 0.2],
      armRRot: [-0.05, 0, -0.55], foreArmRRot: [-0.9, 0, 1.3],
    },
    build: buildDama,
  },
  xiaoxuesheng: {
    rig: {
      hipY: 0.56, spineY: 0.075, chestY: 0.13, neckY: 0.105, headY: 0.05,
      shoulderX: 0.125, shoulderY: 0.085, upperArm: 0.16, foreArm: 0.15,
      hipX: 0.07, hipDrop: 0.025, thighLen: 0.22, shinLen: 0.21,
      armLRot: [-0.04, 0, 0.14], foreArmLRot: [-0.12, 0, 0],
      armRRot: [-0.04, 0, -0.14], foreArmRRot: [-0.12, 0, 0],
    },
    build: buildXiaoxuesheng,
  },
};

function resolveType(type) {
  const key = String(type || '').toLowerCase();
  if (key === 'daye' || key === 'birdman' || key === 'beijing-uncle') return 'beijing-daye';
  if (key === 'dama' || key === 'auntie') return 'beijing-dama';
  if (key === 'kid' || key === 'pupil' || key === 'student') return 'xiaoxuesheng';
  return NPC_DEFS[key] ? key : null;
}

/**
 * 参考站 NPC kind → 原创 NPC 类型的建议映射（Lead 集成 createNPC 时用）。
 * 返回 null 表示这个 kind 建议继续用参考站模型（例如 fox / owl / 场景专属角色）。
 * 用法：
 *   const originalType = resolveOriginalNpcType(anchor.kind);
 *   const npc = originalType
 *     ? createOriginalNPC({ type: originalType })
 *     : createNPC({ assets, materials, type: anchor.kind });
 */
export const ORIGINAL_NPC_KIND_MAP = Object.freeze({
  // 原创类型本身也可以直接传
  'beijing-daye': 'beijing-daye',
  'beijing-dama': 'beijing-dama',
  xiaoxuesheng: 'xiaoxuesheng',
  // 参考站 world NPC kind（见 src/world/planet-config.js）
  'office-worker': 'beijing-daye',
  chef: 'beijing-daye',
  oldwoman: 'beijing-dama',
  'young-lady': 'beijing-dama',
  musician: 'beijing-dama',
  scout: 'xiaoxuesheng',
  mountainman: 'beijing-daye',
  diver: 'beijing-daye',
  fox: null,
  owl: null,
  alien: null,
  boss: null,
  caveman: null,
  'factory-worker-a': null,
  'factory-worker-b': null,
  'factory-worker-c': null,
  'female-scientist': null,
  'male-scientist': null,
});

export function resolveOriginalNpcType(kind) {
  const key = String(kind || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ORIGINAL_NPC_KIND_MAP, key)) return ORIGINAL_NPC_KIND_MAP[key];
  if (NPC_DEFS[key]) return key;
  return null;
}

/**
 * 创建原创北京 NPC。
 *
 * @param {object} [options]
 * @param {string} options.type 'beijing-daye' | 'beijing-dama' | 'xiaoxuesheng'
 * @param {object} [options.materials] 兼容 createNPC 的调用签名（原创 NPC 用自己的 toon 材质）
 */
export function createOriginalNPC({ type = 'beijing-daye', materials } = {}) {
  void materials;
  const npcType = resolveType(type);
  if (!npcType) {
    throw new Error(
      `createOriginalNPC: unknown type "${type}". ` +
      `Supported: ${ORIGINAL_NPC_TYPES.join(', ')}. ` +
      'If you are mapping a reference NPC kind, use resolveOriginalNpcType(kind) first.',
    );
  }
  const def = NPC_DEFS[npcType];

  const root = new THREE.Group();
  root.name = `original-npc-${npcType}`;
  const pivot = new THREE.Group();
  pivot.name = 'original-npc-pivot';
  root.add(pivot);
  const rig = new THREE.Group();
  rig.name = 'original-npc-rig';
  pivot.add(rig);

  const store = createMaterialStore();
  const collector = createPartCollector(store);

  const state = { ready: false, disposed: false, talking: false, visible: true, yaw: 0, targetYaw: 0, lookAt: null, height: 1.5 };

  const { bones, rest } = buildHumanRig(rig, def.rig);
  const handFeet = addHandsFeet(bones, def.rig);
  const ctx = {
    bones,
    rest,
    collector,
    store,
    defs: {},
    handFeet,
    textures: [],
    state,
  };
  const built = def.build(ctx);
  collector.build();

  const bounds = new THREE.Box3().setFromObject(rig);
  rig.position.y = -bounds.min.y;
  state.height = bounds.max.y - bounds.min.y;

  const animator = createPoseAnimator({
    bones,
    rest,
    actions: built.actions,
    defaultAction: 'idle',
    fade: 0.25,
  });

  // 朝向：root 的朝向由世界给定（球面切空间），pivot 负责朝目标转
  const _target = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  function shortestAngle(from, to) {
    let delta = (to - from) % PI2;
    if (delta > Math.PI) delta -= PI2;
    if (delta < -Math.PI) delta += PI2;
    return delta;
  }
  function updateTargetYaw() {
    if (!state.lookAt) {
      state.targetYaw = 0;
      return;
    }
    _target.copy(state.lookAt);
    if (root.parent) root.parent.worldToLocal(_target);
    _dir.copy(_target).sub(root.position);
    _quat.copy(root.quaternion).invert();
    _dir.applyQuaternion(_quat);
    state.targetYaw = Math.atan2(_dir.x, _dir.z);
  }

  function play(name, fade = 0.25) {
    if (name === 'idleTalk') name = 'talk';
    if (name === 'walk') name = 'idle';
    if (!built.actions[name]) {
      console.warn(`originalNpc(${npcType}).play: unknown action "${name}"`);
      return false;
    }
    return animator.play(name, fade);
  }

  function setTalking(talking) {
    state.talking = Boolean(talking);
    play(state.talking ? 'talk' : 'idle');
  }

  function setLookAt(target) {
    if (!target) {
      state.lookAt = null;
      state.targetYaw = 0;
      return;
    }
    state.lookAt = state.lookAt || new THREE.Vector3();
    state.lookAt.copy(target);
    updateTargetYaw();
  }

  function update(dt) {
    if (state.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    animator.update(step);
    if (state.lookAt) updateTargetYaw();
    const delta = shortestAngle(state.yaw, state.targetYaw);
    if (Math.abs(delta) > 1e-5) {
      state.yaw += delta * (1 - Math.exp(-TURN_SPEED * step));
      pivot.rotation.y = state.yaw;
    }
    built.extras?.(state.time || 0, animator.weights);
  }
  // 给 extras 用的时间
  const updateInternal = update;
  const apiUpdate = (dt) => {
    state.time = (state.time || 0) + Math.min(Math.max(dt, 0), 0.1);
    updateInternal(dt);
  };

  const api = {
    type: 'original-npc',
    npcType,
    label: ORIGINAL_NPC_LABELS[npcType],
    root,
    pivot,
    rig,
    ready: null,
    get height() { return state.height; },
    get pose() { return animator.target; },
    get talking() { return state.talking; },
    get yaw() { return state.yaw; },
    get targetYaw() { return state.targetYaw; },
    get bones() { return bones; },
    get meshes() { return collector.meshes; },
    get materials() { return store.materials; },
    get clips() { return Object.keys(built.actions); },
    play,
    update: apiUpdate,
    setTalking,
    setLookAt,
    setVisible(visible) {
      state.visible = Boolean(visible);
      root.visible = state.visible;
    },
    getBone(name) {
      return bones[name] || null;
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      root.removeFromParent();
      collector.dispose();
      store.dispose();
      for (const texture of ctx.textures) texture.dispose?.();
      ctx.textures.length = 0;
    },
  };
  api.ready = Promise.resolve(api);
  state.ready = true;
  animator.update(0);
  return api;
}

export const originalNpcKit = {
  createOriginalNPC,
  ORIGINAL_NPC_TYPES,
  ORIGINAL_NPC_LABELS,
};
