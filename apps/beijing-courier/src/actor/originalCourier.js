// 原创北京邮差主角 —— 完全自建（无参考站模型）
// ===========================================================================
//
// 用户反馈「很多资产都是照搬参考站的，能不能有点自己的资产」，本文件就是回答：
// 角色由 three.js 基本几何体 + 少量自定义 BufferGeometry 现场拼出来，没有任何
// .drc / .glb 模型、也没有外部动画文件；材质统一走 `src/render/toon.js`
// （同一条卡通描边 + HSV 阴影 + MRT + LUT 管线，因此和场景风格一致）。
//
// 造型：墨绿邮差制服（衬衫领 + 铜扣 + 肩章 + 口袋）、平顶邮差帽（铜章 + 黑帽檐）、
//       斜挎帆布邮包（带「邮」字印戳 + 露出的信）、砖红围巾（会飘）、
//       白袜黑布鞋、左手的信。Q 版比例：头略大（约 4.3 头身），身高 ~1.64。
//
// 坐标约定与 avatar.js 一致：
//   - root 放在地面，脚底 y = 0，面朝 local +Z（由 controller 摆到球面）
//   - 内部 rig 只有骨架/网格，不做位移，root 交给游戏控制器
//
// 骨架（13 骨 + 脚踝/手挂点）：
//   hips → spine → chest → neck → head
//   chest → armL/R → foreArmL/R → handL/R(挂点)
//   hips  → thighL/R → shinL/R → footL/R(挂点)
//
// 动画：自写程序化姿态混合（idle / run / sprint / air / talk + 说话点头 + 眨眼 +
//       围巾/邮包摆动），没有使用 AnimationMixer / 动画文件。
//
// 本文件同时导出 `originalActorKit`，`originalNpc.js` 复用其中的建骨/合批/材质/
// 姿态混合工具。

import * as THREE from 'three';
import { createToonMaterial, box, makeCanvasTexture, merge } from '../render/toon.js';

// ---------------------------------------------------------------- 基础工具

/**
 * `src/render/toon.js` 的 ShaderMaterial 目前与 three r170 有一个冲突：
 * 它自己在 VERTEX 里声明了 `varying vec3 vNormal;`，而 `#include <normal_pars_vertex>`
 * 也声明了同一变量（r15x 起 three 把 varying 声明移进了 chunk），导致
 * `ERROR: 'vNormal' : redefinition`，整块材质 program 无效。
 * 这里在拿到材质后去掉 toon.js 的重复声明（保留 chunk 的声明 + toon.js 自己的
 * `vNormal = transformedNormal;` 赋值），语义完全不变。Lead 修好 toon.js 之后
 * 这个 patch 会自动变成 no-op。
 */
export function createToonMaterialSafe(options) {
  const material = createToonMaterial(options);
  if (material.vertexShader.includes('varying vec3 vNormal;')) {
    material.vertexShader = material.vertexShader.replace('varying vec3 vNormal;', '');
  }
  return material;
}

/** 手绘感的「上窄下宽 / 上宽下窄」盒体，低多边形躯干、四肢都用它。 */
export function taperBox(widthBottom, depthBottom, widthTop, depthTop, height, jitter = 0) {
  const geometry = new THREE.BoxGeometry(1, height, 1, 1, 1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const k = (y + height / 2) / height;
    const w = widthBottom + (widthTop - widthBottom) * k;
    const d = depthBottom + (depthTop - depthBottom) * k;
    position.setXYZ(
      i,
      position.getX(i) * w + (Math.random() - 0.5) * jitter,
      y + (Math.random() - 0.5) * jitter,
      position.getZ(i) * d + (Math.random() - 0.5) * jitter,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** 圆柱肢体（腿/胳膊/脖子/手指用）。 */
export function limb(radiusTop, radiusBottom, height, radialSegments = 7) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false);
}

/** 低面数球体（头/手/关节）。 */
export function blob(radius, widthSegments = 14, heightSegments = 10) {
  return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
}

/** 把 mesh/group 下的所有几何体、材质都释放掉（自建资产用）。 */
export function disposeTree(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.();
    }
  });
}

// ---------------------------------------------------------------- 材质仓库
//
// 一个角色实例一个仓库：`dispose()` 时只销毁自己的材质，不会影响别人。
// key 里带颜色变体名（hat:navy 等），setOutfit 时直接换 mesh.material。

export function createMaterialStore() {
  const cache = new Map();
  const all = [];
  function get(key, options) {
    let material = cache.get(key);
    if (!material) {
      material = createToonMaterialSafe(options);
      material.name = `original-${key}`;
      material.userData.shared = false;
      cache.set(key, material);
      all.push(material);
    }
    return material;
  }
  function dispose() {
    for (const material of all) material.dispose();
    all.length = 0;
    cache.clear();
  }
  return { get, dispose, materials: all };
}

// ---------------------------------------------------------------- 部件合批
//
// 每个角色几十个几何体，如果每个都一个 Mesh，draw call 会爆炸。
// 这里按 (骨骼, 材质 key) 合批：同一根骨头上同材质的几何体 merge 成一个 Mesh。

export function createPartCollector(store) {
  const buckets = new Map(); // bone -> Map(key -> { options, geometries: [] })
  const meshesByKey = new Map(); // key -> Set<Mesh>（换装用）
  const meshes = [];
  const extraGeometries = [];

  function bucketFor(bone, key, options) {
    let perBone = buckets.get(bone);
    if (!perBone) {
      perBone = new Map();
      buckets.set(bone, perBone);
    }
    let entry = perBone.get(key);
    if (!entry) {
      entry = { options, geometries: [] };
      perBone.set(key, entry);
    }
    return entry;
  }

  /** 登记一个静态几何体（会与同骨同材质的部件合批）。 */
  function add(bone, geometry, key, options) {
    bucketFor(bone, key, options).geometries.push(geometry);
  }

  /** 单独一个 Mesh（贴图件 / 需要单独动画的件）。 */
  function addMesh(bone, geometry, key, options, meshOptions = {}) {
    const material = store.get(key, options);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = meshOptions.castShadow !== false;
    mesh.receiveShadow = meshOptions.receiveShadow !== false;
    mesh.name = `${key}@${bone.name}`;
    bone.add(mesh);
    meshes.push(mesh);
    extraGeometries.push(geometry);
    registerMesh(key, mesh);
    return mesh;
  }

  function registerMesh(key, mesh) {
    let set = meshesByKey.get(key);
    if (!set) {
      set = new Set();
      meshesByKey.set(key, set);
    }
    set.add(mesh);
  }

  function build() {
    for (const [bone, perBone] of buckets) {
      for (const [key, entry] of perBone) {
        const sources = entry.geometries;
        let geometry;
        if (sources.length === 1) {
          geometry = sources[0];
        } else {
          const flat = sources.map((source) => (source.index ? source.toNonIndexed() : source));
          for (const source of sources) source.dispose();
          geometry = merge(flat);
          for (const source of flat) if (!sources.includes(source)) source.dispose();
        }
        const material = store.get(key, entry.options);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `${key}@${bone.name}`;
        bone.add(mesh);
        meshes.push(mesh);
        extraGeometries.push(geometry);
        registerMesh(key, mesh);
      }
    }
    buckets.clear();
  }

  function dispose() {
    for (const mesh of meshes) mesh.geometry?.dispose?.();
    for (const geometry of extraGeometries) geometry.dispose?.();
    meshes.length = 0;
    extraGeometries.length = 0;
  }

  return { add, addMesh, build, dispose, meshesByKey, meshes };
}

// ---------------------------------------------------------------- 骨架 / 姿态

export const BONE_NAMES = Object.freeze([
  'hips', 'spine', 'chest', 'neck', 'head',
  'armL', 'foreArmL', 'armR', 'foreArmR',
  'thighL', 'shinL', 'thighR', 'shinR',
]);

/**
 * 按 spec 建骨架：spec = [{ name, parent?, position:[x,y,z], rotation?:[x,y,z] }]
 * `rest` 里存每根骨的静止位姿，动画只写「相对静止位姿的偏移」。
 */
export function buildBoneRig(root, spec) {
  const bones = {};
  const rest = { rot: {}, pos: {} };
  for (const item of spec) {
    const bone = new THREE.Group();
    bone.name = item.name;
    bone.position.fromArray(item.position || [0, 0, 0]);
    bone.rotation.fromArray(item.rotation || [0, 0, 0]);
    const parent = item.parent ? bones[item.parent] : root;
    parent.add(bone);
    bones[item.name] = bone;
    rest.pos[item.name] = bone.position.clone();
    rest.rot[item.name] = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
  }
  return { bones, rest };
}

/** 一帧姿态：每根骨一个 euler 偏移 + hips 垂直位移 + 附件参数。 */
export function createPose() {
  const rot = {};
  for (const name of BONE_NAMES) rot[name] = [0, 0, 0];
  return { rot, hipsY: 0, mouth: 0 };
}

function resetPose(pose) {
  for (const name of BONE_NAMES) {
    const r = pose.rot[name];
    r[0] = 0; r[1] = 0; r[2] = 0;
  }
  pose.hipsY = 0;
  pose.mouth = 0;
}

/**
 * 程序化动画混合器：action = { loop, pose(timeSeconds, pose) }。
 * 权重线性交叉淡入淡出，然后归一化混合（没有 AnimationMixer、没有 clip 文件）。
 */
export function createPoseAnimator({ bones, rest, actions, defaultAction = 'idle', fade = 0.2 }) {
  const names = Object.keys(actions);
  if (!actions[defaultAction]) throw new Error(`createPoseAnimator: missing action "${defaultAction}"`);

  const weights = {};
  const times = {};
  for (const name of names) {
    weights[name] = name === defaultAction ? 1 : 0;
    times[name] = 0;
  }
  let target = defaultAction;
  let fadeTime = Math.max(0.0001, fade);
  let fading = false;

  const acc = createPose();
  const tmp = createPose();

  function play(name, fadeSeconds = fade) {
    if (!actions[name]) {
      console.warn(`originalActor.play: unknown action "${name}"`);
      return false;
    }
    if (name === target) return true;
    target = name;
    fadeTime = Math.max(0.0001, fadeSeconds);
    fading = fadeTime > 0.0001;
    times[name] = 0;
    if (!fading) {
      for (const key of names) weights[key] = key === name ? 1 : 0;
    }
    return true;
  }

  function update(step) {
    const dt = Math.max(0, step);

    // 各 action 本地时间推进（只推进有权重 / 是目标的，省算力）
    for (const name of names) {
      if (weights[name] > 1e-4 || name === target) {
        times[name] += dt;
        const loop = actions[name].loop;
        if (times[name] > loop * 1024) times[name] %= loop;
      }
    }

    // 权重过渡
    if (fading) {
      const delta = dt / fadeTime;
      for (const name of names) {
        const dir = name === target ? 1 : -1;
        weights[name] = Math.min(1, Math.max(0, weights[name] + dir * delta));
      }
      if (weights[target] >= 1) {
        for (const name of names) if (name !== target) weights[name] = 0;
        fading = false;
      }
    } else {
      for (const name of names) weights[name] = name === target ? 1 : 0;
    }

    let total = 0;
    for (const name of names) total += weights[name];
    if (total < 1e-5) {
      weights[target] = 1;
      total = 1;
    }

    // 姿态累加
    resetPose(acc);
    for (const name of names) {
      const weight = weights[name];
      if (weight <= 1e-5) continue;
      resetPose(tmp);
      actions[name].pose(times[name], tmp);
      const w = weight / total;
      for (const boneName of BONE_NAMES) {
        const src = tmp.rot[boneName];
        const dst = acc.rot[boneName];
        dst[0] += src[0] * w;
        dst[1] += src[1] * w;
        dst[2] += src[2] * w;
      }
      acc.hipsY += tmp.hipsY * w;
      acc.mouth += tmp.mouth * w;
    }

    // 写回骨骼
    for (const boneName of BONE_NAMES) {
      const bone = bones[boneName];
      const base = rest.rot[boneName];
      const offset = acc.rot[boneName];
      bone.rotation.set(base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]);
    }
    const hips = bones.hips;
    hips.position.y = rest.pos.hips.y + acc.hipsY;

    return { weights, pose: acc };
  }

  return {
    play,
    update,
    get target() { return target; },
    get weights() { return weights; },
    get actions() { return actions; },
    setActionTime(name, seconds) {
      if (actions[name]) times[name] = seconds;
    },
  };
}

// ---------------------------------------------------------------- 调色板

/** 北京邮差配色（低饱和、和场景手绘调色板一致）。 */
export const COURIER_PALETTE = Object.freeze({
  skin: '#e9bd94',
  skinShade: '#ddae86',
  blush: '#e7b096',
  hair: '#4a3a2e',
  hairDark: '#382c24',
  eye: '#262220',
  eyeWhite: '#f6f0e2',
  mouth: '#8d4a3c',
  jacket: '#3f6f52',
  jacketDark: '#2e5440',
  jacketLight: '#4d8161',
  pants: '#33483e',
  sock: '#efe6d6',
  shoe: '#2b2b30',
  shoeSole: '#1a1b1e',
  scarf: '#b8503f',
  scarfDark: '#94402f',
  bag: '#9c6b45',
  bagFlap: '#7d5235',
  strap: '#5f4430',
  brass: '#d9a63f',
  brassDark: '#8a6423',
  envelope: '#f4efe2',
  stamp: '#b8503f',
  badge: '#d9a63f',
});

/** setOutfit 支持的颜色变体（邮包 / 帽子 / 围巾）。 */
export const COURIER_OUTFITS = Object.freeze({
  hat: Object.freeze({ 'postal-green': '#38654c', navy: '#2c3b52', red: '#a8443e', brown: '#6d5136' }),
  bag: Object.freeze({ 'canvas-brown': '#9c6b45', 'postal-green': '#3e6b52', navy: '#33445c', red: '#94443b' }),
  scarf: Object.freeze({ scarlet: '#b8503f', mustard: '#c9a24a', cream: '#e8ddc8', teal: '#3f7f78' }),
});

export const DEFAULT_COURIER_OUTFIT = Object.freeze({
  hat: 'postal-green',
  bag: 'canvas-brown',
  scarf: 'scarlet',
});

function colorOf(slot, variant, fallback) {
  const table = COURIER_OUTFITS[slot];
  if (!table) return fallback;
  return table[variant] || table[Object.keys(table)[0]];
}

// ---------------------------------------------------------------- 贴图（原创）

function drawStar(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 邮差帽正面的铜章：黄铜底 + 红五星 + 信封线。 */
function createBadgeTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d9a63f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6423';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b8503f';
    drawStar(ctx, w / 2, 24, 12, 5, 5);
    ctx.fill();
    // 小信封
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(20, 38, 24, 15);
    ctx.strokeStyle = '#8a6423';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 38, 24, 15);
    ctx.beginPath();
    ctx.moveTo(20, 38);
    ctx.lineTo(32, 47);
    ctx.lineTo(44, 38);
    ctx.stroke();
  });
}

/** 邮包印戳：白「邮」字 + 信封轮廓 + 一圈胶带。 */
function createPostStampTexture() {
  return makeCanvasTexture(96, 96, (ctx, w, h) => {
    ctx.fillStyle = '#7d5235';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(244, 239, 226, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 44px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('邮', w / 2, h / 2 + 2);
    ctx.strokeStyle = 'rgba(184, 80, 63, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 70);
    ctx.lineTo(w / 2, 56);
    ctx.lineTo(w - 20, 70);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------- 姿态函数

const PI2 = Math.PI * 2;

function idlePose(t, pose) {
  const p = (t / 3.2) * PI2;
  const breath = Math.sin(p);
  pose.hipsY = 0.006 * breath - 0.002;
  pose.rot.spine[0] = -0.015 + 0.012 * breath;
  pose.rot.spine[1] = 0.012 * Math.sin(p + 0.7);
  pose.rot.chest[0] = -0.008 + 0.008 * Math.sin(p + 0.5);
  pose.rot.chest[1] = -0.02 * Math.sin(p + 0.4);
  pose.rot.neck[0] = 0.008;
  pose.rot.head[0] = 0.012 - 0.008 * breath;
  pose.rot.head[1] = 0.05 * Math.sin(p * 0.5 + 0.9);
  pose.rot.head[2] = 0.02 * Math.sin(p * 0.33 + 0.2);
  pose.rot.armL[0] = 0.03 * Math.sin(p + 0.4);
  pose.rot.armR[0] = 0.03 * Math.sin(p + 1.2);
  pose.rot.armL[2] = 0.02 * Math.sin(p * 0.7 + 0.3);
  pose.rot.armR[2] = -0.02 * Math.sin(p * 0.7 + 0.1);
  pose.rot.foreArmL[0] = -0.05 - 0.02 * Math.sin(p);
  pose.rot.foreArmR[0] = -0.05 - 0.02 * Math.sin(p + 1.4);
  pose.rot.thighL[0] = 0.004 * Math.sin(p);
  pose.rot.thighR[0] = -0.004 * Math.sin(p);
  pose.rot.shinL[0] = 0.02;
  pose.rot.shinR[0] = 0.02;
}

function runPose(t, pose, opts = {}) {
  const loop = opts.loop || 0.76;
  const thighAmp = opts.thighAmp ?? 0.78;
  const armAmp = opts.armAmp ?? 0.6;
  const lean = opts.lean ?? 0.17;
  const bob = opts.bob ?? 0.022;
  const p = (t / loop) * PI2;
  const s = Math.sin(p);

  pose.hipsY = -0.012 + bob * Math.sin(p * 2 + 0.5);
  pose.rot.hips[1] = 0.10 * s;
  pose.rot.hips[2] = -0.03 * Math.cos(p);
  pose.rot.spine[0] = -lean;
  pose.rot.spine[1] = -0.07 * s;
  pose.rot.spine[2] = 0.03 * Math.cos(p);
  pose.rot.chest[0] = -lean * 0.35;
  pose.rot.chest[1] = 0.11 * s;
  pose.rot.neck[0] = lean * 0.6;
  pose.rot.head[0] = lean * 0.75;
  pose.rot.head[1] = -0.08 * s;
  pose.rot.head[2] = 0.02 * Math.cos(p);

  pose.rot.thighL[0] = -thighAmp * s;
  pose.rot.thighR[0] = thighAmp * s;
  pose.rot.thighL[2] = 0.02;
  pose.rot.thighR[2] = -0.02;
  const knee = (phase) => 0.12 + 0.95 * Math.max(0, Math.sin(phase - 0.35));
  pose.rot.shinL[0] = knee(p);
  pose.rot.shinR[0] = knee(p + Math.PI);

  pose.rot.armL[0] = armAmp * s;
  pose.rot.armR[0] = -armAmp * s;
  pose.rot.armL[2] = 0.05;
  pose.rot.armR[2] = -0.05;
  pose.rot.foreArmL[0] = -0.62 - 0.18 * s;
  pose.rot.foreArmR[0] = -0.62 + 0.18 * s;
}

function sprintPose(t, pose) {
  runPose(t, pose, { loop: 0.62, thighAmp: 1.0, armAmp: 0.82, lean: 0.27, bob: 0.03 });
  const p = (t / 0.62) * PI2;
  pose.rot.foreArmL[0] -= 0.15;
  pose.rot.foreArmR[0] -= 0.15;
  pose.rot.head[0] += 0.04 * Math.sin(p * 2);
}

function airPose(t, pose) {
  const p = (t / 1.3) * PI2;
  const flutter = Math.sin(p);
  pose.hipsY = 0.035 + 0.012 * flutter;
  pose.rot.spine[0] = -0.07;
  pose.rot.chest[0] = -0.05;
  pose.rot.head[0] = 0.12;
  pose.rot.head[1] = 0.03 * flutter;
  pose.rot.thighL[0] = -0.95 + 0.05 * flutter;
  pose.rot.shinL[0] = 1.15;
  pose.rot.thighR[0] = 0.38;
  pose.rot.shinR[0] = 0.62;
  pose.rot.armL[0] = -1.15 + 0.06 * flutter;
  pose.rot.armR[0] = -1.0 - 0.06 * flutter;
  pose.rot.armL[2] = 0.5;
  pose.rot.armR[2] = -0.5;
  pose.rot.foreArmL[0] = -0.5;
  pose.rot.foreArmR[0] = -0.45;
  pose.mouth = 0;
}

function talkPose(t, pose) {
  idlePose(t, pose);
  pose.rot.head[0] += 0.07 * Math.sin(t * 4.6);
  pose.rot.head[1] += 0.05 * Math.sin(t * 2.1 + 0.4);
  pose.rot.chest[0] += 0.015 * Math.sin(t * 2.1);
  pose.rot.armR[0] -= 0.1 + 0.04 * Math.sin(t * 2.6);
  pose.rot.foreArmR[0] -= 0.12;
  pose.mouth = 0.5 + 0.5 * Math.abs(Math.sin(t * 8.2));
}

export const COURIER_ACTIONS = Object.freeze({
  idle: { loop: 3.2, pose: idlePose },
  run: { loop: 0.76, pose: runPose },
  sprint: { loop: 0.62, pose: sprintPose },
  air: { loop: 1.3, pose: airPose },
  talk: { loop: 5.0, pose: talkPose },
});

// ---------------------------------------------------------------- 主角构造

/**
 * 创建原创北京邮差主角。
 *
 * @param {object} [options]
 * @param {object} [options.materials] 兼容 main.js 现有调用（本角色走 toon.js 材质，忽略）
 * @param {object} [options.outfit]    颜色变体（hat/bag/scarf），见 COURIER_OUTFITS
 * @returns 见文件底部 `courier` 对象（root/ready/height/play/update/...）
 */
export function createOriginalCourier({ materials, outfit } = {}) {
  // `materials` 保留在签名里是为了和 main.js 的 createAvatar({ materials }) 对齐；
  // 原创角色不需要参考站的调色板贴图，材质全部由 src/render/toon.js 现场创建。
  void materials;

  const root = new THREE.Group();
  root.name = 'original-courier';
  const rig = new THREE.Group();
  rig.name = 'original-courier-rig';
  root.add(rig);

  const store = createMaterialStore();
  const collector = createPartCollector(store);
  const badgeTexture = createBadgeTexture();
  const stampTexture = createPostStampTexture();
  const textures = [badgeTexture, stampTexture];

  const state = {
    ready: false,
    disposed: false,
    talking: false,
    visible: true,
    time: 0,
    blinkTimer: 2.4,
    blink: 0,
    // 只认识 hat/bag/scarf 三个颜色槽；main.js 传来的参考站 outfit({hair,top,...}) 会被安全忽略
    outfit: { ...DEFAULT_COURIER_OUTFIT },
  };
  if (outfit && typeof outfit === 'object') {
    for (const slot of Object.keys(DEFAULT_COURIER_OUTFIT)) {
      const variant = outfit[slot];
      if (variant === undefined) continue;
      if (COURIER_OUTFITS[slot][variant]) state.outfit[slot] = variant;
      else console.warn(`originalCourier: unknown ${slot} variant "${variant}", falling back to default`);
    }
  }

  // ---- 材质定义
  const baseDefs = {
    skin: { color: COURIER_PALETTE.skin, flatShading: false, surfaceId: 0.22 },
    skinShade: { color: COURIER_PALETTE.skinShade, flatShading: false, surfaceId: 0.23 },
    blush: { color: COURIER_PALETTE.blush, flatShading: false, surfaceId: 0.525 },
    hair: { color: COURIER_PALETTE.hair, flatShading: true, surfaceId: 0.245 },
    hairDark: { color: COURIER_PALETTE.hairDark, flatShading: true, surfaceId: 0.25 },
    eye: { color: COURIER_PALETTE.eye, flatShading: false, surfaceId: 0.55 },
    eyeWhite: { color: COURIER_PALETTE.eyeWhite, flatShading: false, surfaceId: 0.56 },
    mouth: { color: COURIER_PALETTE.mouth, flatShading: false, surfaceId: 0.54 },
    jacket: { color: COURIER_PALETTE.jacket, flatShading: true, surfaceId: 0.28 },
    jacketDark: { color: COURIER_PALETTE.jacketDark, flatShading: true, surfaceId: 0.29 },
    jacketLight: { color: COURIER_PALETTE.jacketLight, flatShading: true, surfaceId: 0.30 },
    pants: { color: COURIER_PALETTE.pants, flatShading: true, surfaceId: 0.32 },
    sock: { color: COURIER_PALETTE.sock, flatShading: true, surfaceId: 0.34 },
    shoe: { color: COURIER_PALETTE.shoe, flatShading: true, surfaceId: 0.36 },
    shoeSole: { color: COURIER_PALETTE.shoeSole, flatShading: true, surfaceId: 0.37 },
    strap: { color: COURIER_PALETTE.strap, flatShading: true, surfaceId: 0.42 },
    brass: { color: COURIER_PALETTE.brass, flatShading: true, surfaceId: 0.44 },
    brassDark: { color: COURIER_PALETTE.brassDark, flatShading: true, surfaceId: 0.45 },
    envelope: { color: COURIER_PALETTE.envelope, flatShading: true, surfaceId: 0.46 },
    stamp: { color: COURIER_PALETTE.stamp, flatShading: true, surfaceId: 0.47 },
    badge: { color: '#ffffff', flatShading: true, surfaceId: 0.48, map: badgeTexture },
    stampPatch: { color: '#ffffff', flatShading: true, surfaceId: 0.49, map: stampTexture },
    scarfTie: { color: COURIER_PALETTE.scarfDark, flatShading: false, surfaceId: 0.40 },
  };
  // 换装槽位的材质 key 带颜色名
  const slotKey = (slot, variant) => `${slot}:${variant}`;
  const slotDefs = {
    hat: { flatShading: true, surfaceId: 0.26 },
    hatBand: { flatShading: true, surfaceId: 0.265 },
    bag: { flatShading: true, surfaceId: 0.38 },
    bagFlap: { flatShading: true, surfaceId: 0.385 },
    scarf: { flatShading: false, surfaceId: 0.40 },
  };
  function slotOptions(slot, variant) {
    const def = slotDefs[slot] || {};
    const color = colorOf(slot, variant, COURIER_PALETTE[slot] || '#ffffff');
    return { ...def, ...(def.color ? {} : { color }) };
  }

  function slotMaterial(slot, variant) {
    return store.get(slotKey(slot, variant), slotOptions(slot, variant));
  }

  // ---- 骨架
  const rigSpec = [
    { name: 'hips', position: [0, 0.78, 0] },
    { name: 'spine', parent: 'hips', position: [0, 0.09, 0], rotation: [-0.01, 0, 0] },
    { name: 'chest', parent: 'spine', position: [0, 0.19, 0], rotation: [-0.008, 0, 0] },
    { name: 'neck', parent: 'chest', position: [0, 0.155, 0] },
    { name: 'head', parent: 'neck', position: [0, 0.06, 0] },
    { name: 'armL', parent: 'chest', position: [0.172, 0.12, 0], rotation: [-0.04, 0, 0.13] },
    { name: 'foreArmL', parent: 'armL', position: [0, -0.235, 0], rotation: [-0.04, 0, 0] },
    { name: 'armR', parent: 'chest', position: [-0.172, 0.12, 0], rotation: [-0.04, 0, -0.13] },
    { name: 'foreArmR', parent: 'armR', position: [0, -0.235, 0], rotation: [-0.04, 0, 0] },
    { name: 'thighL', parent: 'hips', position: [0.09, -0.045, 0], rotation: [0, 0, 0.015] },
    { name: 'shinL', parent: 'thighL', position: [0, -0.315, 0] },
    { name: 'thighR', parent: 'hips', position: [-0.09, -0.045, 0], rotation: [0, 0, -0.015] },
    { name: 'shinR', parent: 'thighR', position: [0, -0.315, 0] },
  ];
  const { bones, rest } = buildBoneRig(rig, rigSpec);
  const { hips, spine, chest, neck, head, armL, foreArmL, armR, foreArmR, thighL, shinL, thighR, shinR } = bones;

  // 挂点（不是骨骼，但 NPC/道具可以挂东西；也让手的位置好算）
  const handL = new THREE.Group();
  handL.name = 'handL';
  handL.position.set(0, -0.205, 0);
  foreArmL.add(handL);
  const handR = new THREE.Group();
  handR.name = 'handR';
  handR.position.set(0, -0.205, 0);
  foreArmR.add(handR);
  const footL = new THREE.Group();
  footL.name = 'footL';
  footL.position.set(0, -0.3, 0);
  shinL.add(footL);
  const footR = new THREE.Group();
  footR.name = 'footR';
  footR.position.set(0, -0.3, 0);
  shinR.add(footR);

  const J = 0.006; // 手绘 jitter

  // ---- 躯干（短裤 / 制服上身）
  {
    // 短裤胯部（顶部伸进制服下摆里，避免露出背景）
    const pelvis = taperBox(0.30, 0.215, 0.335, 0.225, 0.28, J);
    pelvis.translate(0, -0.01, 0);
    collector.add(hips, pelvis, 'pants', baseDefs.pants);
    // 短裤裤脚卷边
    const hemL = new THREE.CylinderGeometry(0.088, 0.092, 0.045, 8);
    hemL.translate(0.085, -0.13, 0);
    collector.add(hips, hemL, 'pants', baseDefs.pants);

    // 制服上身：下段（腰 → 胸）+ 上段（胸 → 肩），分段让脊柱弯曲更自然
    const lower = taperBox(0.34, 0.225, 0.375, 0.238, 0.185, J);
    lower.translate(0, 0.1, 0);
    collector.add(spine, lower, 'jacket', baseDefs.jacket);
    const upper = taperBox(0.375, 0.238, 0.395, 0.232, 0.16, J);
    upper.translate(0, 0.085, 0);
    collector.add(chest, upper, 'jacket', baseDefs.jacket);

    // 下摆深色滚边
    const hem = box(0.345, 0.035, 0.235, 0.004);
    hem.translate(0, 0.012, 0);
    collector.add(spine, hem, 'jacketDark', baseDefs.jacketDark);

    // 门襟 + 三颗铜扣（上段）
    const placket = box(0.032, 0.155, 0.02, 0.002);
    placket.translate(0, 0.075, 0.118);
    collector.add(chest, placket, 'jacketDark', baseDefs.jacketDark);
    for (let i = 0; i < 3; i += 1) {
      const button = new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 8);
      button.rotateX(Math.PI / 2);
      button.translate(0, 0.13 - i * 0.055, 0.131);
      collector.add(chest, button, 'brass', baseDefs.brass);
    }

    // 肩章
    for (const side of [-1, 1]) {
      const epaulette = box(0.105, 0.022, 0.065, 0.003);
      epaulette.translate(side * 0.15, 0.178, 0);
      collector.add(chest, epaulette, 'jacketDark', baseDefs.jacketDark);
      const button = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 8);
      button.translate(side * 0.105, 0.19, 0);
      collector.add(chest, button, 'brass', baseDefs.brass);
    }

    // 衬衫领（奶油色）
    for (const side of [-1, 1]) {
      const flap = box(0.042, 0.026, 0.018, 0.0015);
      flap.rotateZ(side * 0.5);
      flap.rotateY(side * -0.3);
      flap.translate(side * 0.045, 0.148, 0.112);
      collector.add(chest, flap, 'sock', baseDefs.sock);
    }
    const collarV = taperBox(0.06, 0.018, 0.022, 0.014, 0.05, 0.001);
    collarV.translate(0, 0.126, 0.118);
    collector.add(chest, collarV, 'sock', baseDefs.sock);

    // 左胸小铜章（邮局徽）
    const chestBadge = new THREE.CircleGeometry(0.032, 14);
    chestBadge.translate(0.098, 0.122, 0.124);
    collector.addMesh(chest, chestBadge, 'badge', baseDefs.badge, { castShadow: false });

    // 两个口袋（下摆）
    for (const side of [-1, 1]) {
      const pocket = box(0.085, 0.07, 0.018, 0.003);
      pocket.translate(side * 0.088, 0.115, 0.112);
      collector.add(spine, pocket, 'jacketLight', baseDefs.jacketLight);
      const flap = box(0.09, 0.024, 0.022, 0.002);
      flap.translate(side * 0.088, 0.155, 0.114);
      collector.add(spine, flap, 'jacketDark', baseDefs.jacketDark);
    }
  }

  // ---- 脖子 / 头
  {
    const neckGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.075, 8);
    neckGeo.translate(0, 0.035, 0);
    collector.add(neck, neckGeo, 'skin', baseDefs.skin);

    const headGeo = blob(0.18, 18, 14);
    headGeo.scale(1.0, 1.02, 0.965);
    headGeo.translate(0, 0.168, 0.004);
    collector.add(head, headGeo, 'skin', baseDefs.skin);

    // 耳朵
    for (const side of [-1, 1]) {
      const ear = blob(0.032, 8, 6);
      ear.scale(0.55, 1.0, 0.8);
      ear.translate(side * 0.172, 0.16, -0.005);
      collector.add(head, ear, 'skin', baseDefs.skin);
    }

    // 头发：一个略大的球往后压，前半球藏进脸里，只在后脑/两侧露出来。
    // 用 flatShading 让后脑勺像手绘低多边形一样有块面，而不是一整块死黑。
    const hairBack = blob(0.192, 14, 10);
    hairBack.scale(1.05, 0.98, 1.02);
    hairBack.translate(0, 0.192, -0.058);
    collector.add(head, hairBack, 'hair', baseDefs.hair);
    // 刘海：几撮不规则碎发（手绘感）
    const fringeSeeds = [
      [-0.115, 0.055, 0.11, 0.5],
      [-0.06, 0.07, 0.135, -0.2],
      [0.0, 0.06, 0.145, 0.15],
      [0.058, 0.072, 0.135, 0.4],
      [0.113, 0.052, 0.11, -0.45],
    ];
    for (const [x, h, z, rz] of fringeSeeds) {
      const fringe = taperBox(0.045, 0.03, 0.02, 0.02, h, 0.002);
      fringe.rotateZ(rz);
      fringe.translate(x, 0.268 - h / 2, z);
      collector.add(head, fringe, 'hair', baseDefs.hair);
    }

    // 眉毛 / 眼睛 / 鼻子 / 嘴 / 腮红（Q 版：眼神友善，嘴角上扬）
    for (const side of [-1, 1]) {
      const brow = box(0.05, 0.011, 0.018, 0.0015);
      brow.rotateZ(side * -0.06);
      brow.translate(side * 0.07, 0.245, 0.158);
      collector.add(head, brow, 'hairDark', baseDefs.hairDark);

      const eye = blob(0.028, 10, 8);
      eye.scale(1.0, 1.12, 0.4);
      eye.translate(side * 0.07, 0.193, 0.163);
      collector.add(head, eye, 'eye', baseDefs.eye);

      const glint = blob(0.0055, 6, 5);
      glint.scale(1, 1, 0.6);
      glint.translate(side * 0.063, 0.201, 0.177);
      collector.add(head, glint, 'eyeWhite', baseDefs.eyeWhite);

      const cheek = blob(0.021, 8, 6);
      cheek.scale(1.0, 0.45, 0.18);
      cheek.translate(side * 0.108, 0.132, 0.146);
      collector.add(head, cheek, 'blush', baseDefs.blush);
    }
    const nose = blob(0.016, 8, 6);
    nose.scale(1.0, 0.85, 1.1);
    nose.translate(0, 0.155, 0.18);
    collector.add(head, nose, 'skinShade', baseDefs.skinShade);

    // 嘴单独一个 mesh（说话时缩放）：半圈圆环做微笑
    const mouthGeo = new THREE.TorusGeometry(0.026, 0.0065, 4, 10, Math.PI);
    mouthGeo.rotateZ(Math.PI);
    mouthGeo.scale(1, 1, 0.35);
    mouthGeo.translate(0, 0.112, 0.171);
    collector.addMesh(head, mouthGeo, 'mouth', baseDefs.mouth, { castShadow: false });
  }

  // ---- 邮差帽（帽顶 / 帽箍 / 帽檐 / 铜章）
  {
    const crown = new THREE.CylinderGeometry(0.168, 0.186, 0.082, 14);
    crown.translate(0, 0.318, -0.006);
    const crownTopDome = blob(0.168, 14, 8);
    crownTopDome.scale(1.0, 0.45, 1.0);
    crownTopDome.translate(0, 0.356, -0.006);
    collector.add(head, crownTopDome, slotKey('hat', state.outfit.hat), slotOptions('hat', state.outfit.hat));
    collector.add(head, crown, slotKey('hat', state.outfit.hat), slotOptions('hat', state.outfit.hat));
    const band = new THREE.CylinderGeometry(0.188, 0.189, 0.036, 14);
    band.translate(0, 0.274, -0.004);
    collector.add(head, band, slotKey('hatBand', state.outfit.hat), {
      ...slotDefs.hatBand,
      color: '#243f31',
    });
    // 帽檐（半圆盘，压扁的圆柱，朝 +Z 前伸）
    const brim = new THREE.CylinderGeometry(0.205, 0.205, 0.015, 18, 1, false, -Math.PI / 2, Math.PI);
    brim.rotateX(-0.15);
    brim.translate(0, 0.264, 0.07);
    collector.add(head, brim, 'brim', { color: '#2b352e', flatShading: true, surfaceId: 0.27 });
    // 帽顶小圆扣
    const crownTop = new THREE.CylinderGeometry(0.028, 0.032, 0.014, 8);
    crownTop.translate(0, 0.392, -0.006);
    collector.add(head, crownTop, slotKey('hat', state.outfit.hat), slotOptions('hat', state.outfit.hat));

    // 铜章（贴图）
    const badge = new THREE.CircleGeometry(0.034, 16);
    badge.translate(0, 0.303, 0.19);
    collector.addMesh(head, badge, 'badge', baseDefs.badge, { castShadow: false });
  }

  // ---- 手臂：袖子 + 袖口 + 手
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? 1 : -1;
    const armBone = side === 'L' ? armL : armR;
    const foreBone = side === 'L' ? foreArmL : foreArmR;
    const handBone = side === 'L' ? handL : handR;

    const sleeve = taperBox(0.113, 0.115, 0.1, 0.102, 0.235, J);
    sleeve.translate(0, -0.118, 0);
    collector.add(armBone, sleeve, 'jacket', baseDefs.jacket);

    const forearmSleeve = taperBox(0.096, 0.098, 0.084, 0.086, 0.175, J);
    forearmSleeve.translate(0, -0.093, 0);
    collector.add(foreBone, forearmSleeve, 'jacket', baseDefs.jacket);
    const cuff = new THREE.CylinderGeometry(0.05, 0.048, 0.028, 8);
    cuff.translate(0, -0.188, 0);
    collector.add(foreBone, cuff, 'jacketDark', baseDefs.jacketDark);

    const hand = blob(0.046, 10, 8);
    hand.scale(1.0, 0.92, 1.12);
    hand.translate(0, -0.03, 0.012);
    collector.add(handBone, hand, 'skin', baseDefs.skin);
    // 拇指
    const thumb = blob(0.018, 6, 5);
    thumb.scale(0.8, 1.3, 0.8);
    thumb.translate(sign * 0.028, -0.02, 0.04);
    collector.add(handBone, thumb, 'skin', baseDefs.skin);

    // 右手的信（记忆点：邮差不离手）
    if (side === 'R') {
      const letter = new THREE.Group();
      letter.position.set(0.03, -0.06, 0.055);
      letter.rotation.set(-0.35, 0.25, 0.18);
      handBone.add(letter);
      const paper = box(0.115, 0.075, 0.012, 0.001);
      collector.addMesh(letter, paper, 'envelope', baseDefs.envelope, { castShadow: false });
      const stamp = box(0.02, 0.018, 0.004, 0);
      stamp.rotateZ(0.1);
      stamp.translate(0.032, 0.02, 0.008);
      collector.addMesh(letter, stamp, 'stamp', baseDefs.stamp, { castShadow: false });
      const fold = box(0.11, 0.006, 0.003, 0);
      fold.rotateZ(0);
      fold.translate(0, 0.012, 0.0085);
      collector.addMesh(letter, fold, 'envelopeFold', { color: '#cfc8b8', flatShading: true, surfaceId: 0.5 }, { castShadow: false });
    }
  }

  // ---- 腿：短裤裤腿 / 大腿皮肤 / 小腿 / 白袜 / 黑布鞋
  for (const side of ['L', 'R']) {
    const thighBone = side === 'L' ? thighL : thighR;
    const shinBone = side === 'L' ? shinL : shinR;
    const footBone = side === 'L' ? footL : footR;

    const shorts = taperBox(0.155, 0.16, 0.145, 0.15, 0.16, J);
    shorts.translate(0, -0.08, 0);
    collector.add(thighBone, shorts, 'pants', baseDefs.pants);

    const thighSkin = new THREE.CylinderGeometry(0.062, 0.056, 0.17, 8);
    thighSkin.translate(0, -0.235, 0);
    collector.add(thighBone, thighSkin, 'skin', baseDefs.skin);

    const shinSkin = new THREE.CylinderGeometry(0.054, 0.046, 0.2, 8);
    shinSkin.translate(0, -0.14, 0);
    collector.add(shinBone, shinSkin, 'skin', baseDefs.skin);

    const sock = new THREE.CylinderGeometry(0.052, 0.055, 0.115, 8);
    sock.translate(0, -0.252, 0);
    collector.add(shinBone, sock, 'sock', baseDefs.sock);

    // 黑布鞋：鞋头朝 +Z（foot 挂点已经在脚踝处，这里只写鞋自身高度）
    const shoeUpper = box(0.115, 0.09, 0.2, 0.003);
    shoeUpper.translate(0, -0.052, 0.045);
    collector.add(footBone, shoeUpper, 'shoe', baseDefs.shoe);
    const shoeSole = box(0.125, 0.03, 0.21, 0.002);
    shoeSole.translate(0, -0.1, 0.048);
    collector.add(footBone, shoeSole, 'shoeSole', baseDefs.shoeSole);
    const shoeCap = blob(0.058, 8, 6);
    shoeCap.scale(1.0, 0.5, 0.72);
    shoeCap.translate(0, -0.058, 0.128);
    collector.add(footBone, shoeCap, 'shoe', baseDefs.shoe);
  }

  // ---- 斜挎邮包（邮差的记忆点） + 背带
  const bag = new THREE.Group();
  bag.name = 'courier-bag';
  bag.position.set(0.255, -0.055, -0.005);
  bag.rotation.set(0.03, -0.14, -0.07);
  hips.add(bag);
  {
    const bodyGeo = box(0.22, 0.2, 0.1, 0.004);
    bodyGeo.translate(0, -0.115, 0);
    collector.add(bag, bodyGeo, slotKey('bag', state.outfit.bag), slotOptions('bag', state.outfit.bag));
    const flapGeo = box(0.23, 0.085, 0.112, 0.003);
    flapGeo.rotateX(0.1);
    flapGeo.translate(0, -0.025, 0.004);
    collector.add(bag, flapGeo, slotKey('bagFlap', state.outfit.bag), {
      ...slotDefs.bagFlap,
      color: '#6d452c',
    });
    // 印戳贴片
    const patch = box(0.1, 0.1, 0.006, 0.001);
    patch.translate(0, -0.045, 0.064);
    collector.addMesh(bag, patch, 'stampPatch', baseDefs.stampPatch, { castShadow: false });
    // 铜扣
    const buckle = box(0.032, 0.026, 0.012, 0.001);
    buckle.translate(0, -0.075, 0.073);
    collector.add(bag, buckle, 'brass', baseDefs.brass);
    // 露出来的信
    const peek = box(0.145, 0.06, 0.012, 0.001);
    peek.rotateX(-0.28);
    peek.translate(0.0, 0.012, 0.02);
    collector.add(bag, peek, 'envelope', baseDefs.envelope);
    const peekStamp = box(0.022, 0.02, 0.004, 0);
    peekStamp.rotateX(-0.28);
    peekStamp.translate(0.04, 0.03, 0.035);
    collector.add(bag, peekStamp, 'stamp', baseDefs.stamp);
    // 侧袋
    const sidePocket = box(0.03, 0.09, 0.08, 0.002);
    sidePocket.translate(0.122, -0.12, 0);
    collector.add(bag, sidePocket, slotKey('bag', state.outfit.bag), slotOptions('bag', state.outfit.bag));
  }

  // 背带：胸前 / 背后各一段，从右肩斜到左胯（root 面朝 +Z）
  {
    const frontStrap = box(0.042, 0.5, 0.02, 0.002);
    frontStrap.rotateZ(-0.6);
    frontStrap.rotateX(0.08);
    frontStrap.translate(0.045, -0.045, 0.118);
    collector.add(chest, frontStrap, 'strap', baseDefs.strap);
    const backStrap = box(0.042, 0.5, 0.02, 0.002);
    backStrap.rotateZ(0.6);
    backStrap.rotateX(-0.08);
    backStrap.translate(-0.045, -0.045, -0.118);
    collector.add(chest, backStrap, 'strap', baseDefs.strap);
    const shoulderStrap = box(0.05, 0.03, 0.16, 0.002);
    shoulderStrap.translate(-0.14, 0.195, 0);
    collector.add(chest, shoulderStrap, 'strap', baseDefs.strap);
  }

  // ---- 红围巾（脖子 + 结 + 两条会飘的尾巴）
  const scarfTails = [];
  {
    const ring = new THREE.TorusGeometry(0.1, 0.029, 6, 14);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0.035, 0.004);
    collector.add(neck, ring, 'scarf', slotOptions('scarf', state.outfit.scarf));
    const knot = blob(0.038, 8, 6);
    knot.scale(1.0, 0.85, 0.9);
    knot.translate(0.04, 0.018, 0.088);
    collector.add(neck, knot, 'scarf', slotOptions('scarf', state.outfit.scarf));
    const knotEdge = box(0.03, 0.055, 0.02, 0.002);
    knotEdge.rotateZ(0.3);
    knotEdge.translate(0.06, -0.02, 0.09);
    collector.add(neck, knotEdge, 'scarfTie', baseDefs.scarfTie);

    for (const [index, setup] of [
      { x: 0.045, z: 0.085, rotX: -0.42, rotZ: 0.12, len: 0.24 },
      { x: -0.03, z: -0.085, rotX: -0.06, rotZ: -0.1, len: 0.2 },
    ].entries()) {
      const tail = new THREE.Group();
      tail.name = `scarfTail${index}`;
      tail.position.set(setup.x, 0.005, setup.z);
      tail.rotation.set(setup.rotX, 0, setup.rotZ);
      neck.add(tail);
      const tailGeo = taperBox(0.07, 0.028, 0.04, 0.02, setup.len, 0.003);
      tailGeo.translate(0, -setup.len / 2, 0);
      collector.add(tail, tailGeo, 'scarf', slotOptions('scarf', state.outfit.scarf));
      const tip = taperBox(0.028, 0.016, 0.07, 0.028, 0.035, 0.001);
      tip.translate(0, -setup.len - 0.012, 0);
      collector.add(tail, tip, 'scarf', slotOptions('scarf', state.outfit.scarf));
      scarfTails.push(tail);
    }
  }

  // ---- 合批出网格
  collector.build();

  // 脚底对齐 y=0（顺手得到真实身高）
  const bounds = new THREE.Box3().setFromObject(rig);
  const lift = -bounds.min.y;
  rig.position.y = lift;
  const rawHeight = bounds.max.y - bounds.min.y;
  // 游戏里 PLAYER_HEIGHT = 1.64；Q 版比例建得略高，这里等比缩到 1.64 保持接口一致
  const TARGET_HEIGHT = 1.64;
  const fitScale = rawHeight > 0 ? Math.min(1.05, TARGET_HEIGHT / rawHeight) : 1;
  rig.scale.setScalar(fitScale);
  const height = rawHeight * fitScale;

  // 口型 / 眨眼要单独控制的网格
  const headMeshes = collector.meshesByKey;
  const mouthMesh = [...(headMeshes.get('mouth') || [])][0] || null;
  const eyeMeshes = [...(headMeshes.get('eye') || [])];
  const glintMeshes = [...(headMeshes.get('eyeWhite') || [])];

  // ---- 动画器
  const animator = createPoseAnimator({
    bones,
    rest,
    actions: COURIER_ACTIONS,
    defaultAction: 'idle',
    fade: 0.2,
  });

  // ---- 换装
  function normalizeOutfit(partial, current) {
    const next = { ...current };
    for (const slot of Object.keys(DEFAULT_COURIER_OUTFIT)) {
      if (partial && partial[slot] !== undefined) {
        const variant = partial[slot];
        if (COURIER_OUTFITS[slot][variant]) next[slot] = variant;
        else console.warn(`originalCourier.setOutfit: unknown ${slot} variant "${variant}"`);
      }
    }
    return next;
  }

  function applyOutfit(next) {
    const swaps = [
      [slotKey('hat', next.hat), slotOptions('hat', next.hat)],
      [slotKey('hatBand', next.hat), { ...slotDefs.hatBand, color: next.hat === 'navy' ? '#1d2a3a' : next.hat === 'red' ? '#6f2b26' : '#243f31' }],
      [slotKey('bag', next.bag), slotOptions('bag', next.bag)],
      [slotKey('bagFlap', next.bag), { ...slotDefs.bagFlap, color: next.bag === 'navy' ? '#26344a' : next.bag === 'postal-green' ? '#2c4f3b' : next.bag === 'red' ? '#6f2f29' : '#6d452c' }],
      [slotKey('scarf', next.scarf), slotOptions('scarf', next.scarf)],
    ];
    const previousKeys = [
      slotKey('hat', state.outfit.hat),
      slotKey('hatBand', state.outfit.hat),
      slotKey('bag', state.outfit.bag),
      slotKey('bagFlap', state.outfit.bag),
      slotKey('scarf', state.outfit.scarf),
    ];
    previousKeys.forEach((key, index) => {
      const [nextKey, options] = swaps[index];
      if (nextKey === key) return;
      const meshes = collector.meshesByKey.get(key);
      if (!meshes || !meshes.size) return;
      const material = store.get(nextKey, options);
      for (const mesh of meshes) mesh.material = material;
    });
  }

  // ---- 每帧附件（眨眼 / 口型 / 围巾 / 邮包摆动）
  const tmpVec = new THREE.Vector3();
  const eyeBase = eyeMeshes.map((mesh) => mesh.scale.y);

  function update(dt) {
    if (state.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    state.time += step;

    animator.update(step);
    const weights = animator.weights;
    const speed = (weights.run || 0) + (weights.sprint || 0) * 1.7;
    const airiness = weights.air || 0;

    // 说话：口型 + 点头叠加（setTalking 只叠加，不切换 locomotion）
    const talking = state.talking;
    const mouthOpen = talking ? 0.35 + 0.65 * Math.abs(Math.sin(state.time * 7.6)) : 0;
    if (mouthMesh) {
      mouthMesh.scale.y = 1 + mouthOpen * 0.9;
      mouthMesh.scale.x = 1 - mouthOpen * 0.12;
    }

    // 眨眼
    state.blinkTimer -= step;
    if (state.blinkTimer <= 0) {
      state.blinkTimer = 2.2 + Math.random() * 2.4;
      state.blink = 0.16;
    }
    if (state.blink > 0) {
      state.blink = Math.max(0, state.blink - step);
      const k = state.blink > 0.08 ? (0.16 - state.blink) / 0.08 : state.blink / 0.08;
      const squash = 1 - Math.min(1, Math.max(0, k)) * 0.92;
      eyeMeshes.forEach((mesh) => { mesh.scale.y = squash; });
      glintMeshes.forEach((mesh) => { mesh.visible = squash > 0.4; });
    } else {
      eyeMeshes.forEach((mesh, index) => { mesh.scale.y = eyeBase[index] || 1; });
      glintMeshes.forEach((mesh) => { mesh.visible = true; });
    }

    // 围巾：跑步/跳跃时飘起来
    const wind = speed * 0.9 + airiness * 1.2;
    const flutter = Math.sin(state.time * (5.5 + speed * 5));
    scarfTails[0].rotation.x = -0.42 + wind * (0.9 + 0.22 * flutter) + 0.03 * Math.sin(state.time * 1.7);
    scarfTails[0].rotation.z = 0.12 + wind * 0.14 * Math.sin(state.time * 4.3);
    scarfTails[1].rotation.x = -0.06 + wind * (0.7 + 0.2 * Math.sin(state.time * (4.6 + speed * 4)));
    scarfTails[1].rotation.z = -0.1 - wind * 0.12 * Math.sin(state.time * 3.7);

    // 邮包：随步伐轻摆 + 起跳上扬
    const bounce = Math.sin(state.time * (6 + speed * 6));
    bag.rotation.x = 0.03 + speed * 0.12 * bounce + airiness * 0.25;
    bag.rotation.z = -0.07 - speed * 0.06 * Math.sin(state.time * 3.4);
    bag.position.y = -0.055 + Math.abs(bounce) * speed * 0.012;

    // 身体整体的轻微上下（呼吸/落地）
    tmpVec.set(0, 0, 0);
    if (airiness > 0.5) rig.rotation.x = -0.03 * airiness;
    else rig.rotation.x += (0 - rig.rotation.x) * Math.min(1, step * 8);
  }

  // ---- 接口
  const api = {
    type: 'original-courier',
    root,
    rig,
    ready: null,
    height,
    get ready_() { return state.ready; },
    get pose() { return animator.target; },
    get talking() { return state.talking; },
    get visible() { return state.visible; },
    get outfit() { return { ...state.outfit }; },
    get bones() { return bones; },
    get meshes() { return collector.meshes; },
    get materials() { return store.materials; },
    get animator() { return animator; },
    clips: Object.keys(COURIER_ACTIONS),
    play(name, fade = 0.2) {
      return animator.play(name, fade);
    },
    update,
    setTalking(talking) {
      state.talking = Boolean(talking);
    },
    setOutfit(partial = {}) {
      const next = normalizeOutfit(partial, state.outfit);
      state.outfit = next;
      applyOutfit(next);
      return { ...next };
    },
    setVisible(visible) {
      state.visible = Boolean(visible);
      root.visible = state.visible;
    },
    getBone(name) {
      return bones[name] || null;
    },
    setActionTime(name, seconds) {
      animator.setActionTime(name, seconds);
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      root.removeFromParent();
      collector.dispose();
      store.dispose();
      for (const texture of textures) texture.dispose?.();
    },
  };
  api.ready = Promise.resolve(api);
  state.ready = true;

  animator.play('idle', 0);
  animator.update(0);
  update(0);
  rig.position.y = lift;
  return api;
}

// ---------------------------------------------------------------- 共享套件
//
// originalNpc.js 复用：建骨 / 合批 / 材质 / 姿态混合 / 工具几何。
export const originalActorKit = {
  createToonMaterialSafe,
  taperBox,
  limb,
  blob,
  box,
  merge,
  makeCanvasTexture,
  disposeTree,
  createMaterialStore,
  createPartCollector,
  buildBoneRig,
  createPose,
  createPoseAnimator,
  BONE_NAMES,
  COURIER_PALETTE,
};
