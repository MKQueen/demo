/**
 * site-dressing.js —— 富华大厦 · 场地产景模块
 *
 * 契约见 docs/upgrade-contract.md §4.2。职责：
 *   - 地块铺装（真实地块约 125×130m，英雄模型 94×106m，中间环带补齐）：
 *     分格铺装 / 入口前庭 / 路缘石 / 盲道 / 台阶 / 花池绿篱 / 挡车石 / 旗杆旗帜；
 *   - 行道树（80–150 棵，InstancedMesh，低模）；
 *   - 路灯（细杆 + 暖色灯头 Points + 夜间贴地暖光面片，避免大量 PointLight）；
 *   - 中央庭院环形水景（ShaderMaterial 波纹/高光随昼夜变化 + 夜间蓝白 LED 灯带）；
 *   - 东中街 / 地块南·北侧车道车流（InstancedMesh 车身+深色玻璃，夜间车灯 Points）；
 *   - 全部几何合并/实例化：draw call ≤ 30、三角面 < 80k；update 只更新矩阵/材质 uniform。
 *
 * 不新增依赖、不修改 main.js / index.html / style.css。失败路径只 console.warn。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------- 地块常量 ------------------------------- */
// 真实地块范围（契约 §1）：125 × 130 m
const PLOT = { x0: -64, x1: 64, z0: -65, z1: 65 };
// 英雄模型 GLB 实际覆盖范围：94 × 106 m
const HERO = { x0: -47, x1: 47, z0: -53, z1: 53 };
const PLAZA_Y = 0.16;          // 场外环带铺装标高（比英雄模型场地高 ~0.1m，用路缘石过渡）
const GROUND_Y = -1.6;         // 主工程地面高度（仅用于地台裙墙）

const NIGHT_TARGET = { day: 0, dusk: 0.5, night: 1 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const nextFrameClamp = (dt) => Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.25);

/* -------------------------------- 工具 --------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxGeometry(w, h, d, x, y, z) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

/** 水平四边形（8 个三角顶点合并前），UV 按世界米制铺贴，避免拉伸。 */
function groundQuad(x0, x1, z0, z1, y, uvScale = 3.6) {
  const geometry = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, position.getX(i) / uvScale, position.getZ(i) / uvScale);
  }
  uv.needsUpdate = true;
  return geometry;
}

function makeCanvasTexture(size, draw, { repeatX = 1, repeatY = 1, anisotropy = 4 } = {}) {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    console.warn('[site-dressing] 纹理生成失败：', error && error.message ? error.message : error);
    return null;
  }
}

/* ------------------------------- 主入口 -------------------------------- */
export function createSiteDressing({ scene, renderer, camera, city } = {}) {
  const warnings = [];
  const warn = (message, error) => {
    warnings.push(message);
    console.warn(`[site-dressing] ${message}`, error && error.message ? error.message : error ?? '');
  };

  const group = new THREE.Group();
  group.name = 'SiteDressing';

  const random = mulberry32(0x5eed1234);

  // 图层分组（每层一个 Group，便于 setLayer 切换，不影响 draw call）
  const subGroups = {
    paving: new THREE.Group(),
    trees: new THREE.Group(),
    lamps: new THREE.Group(),
    cars: new THREE.Group(),
    water: new THREE.Group(),
    flags: new THREE.Group(),
    people: new THREE.Group(),
  };
  for (const [name, sub] of Object.entries(subGroups)) {
    sub.name = `SiteDressing-${name}`;
    group.add(sub);
  }

  const anisotropy = (() => {
    try {
      return renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    } catch {
      return 4;
    }
  })();

  /* ------------------------------ 纹理与材质 ------------------------------ */
  const pavingTexture = makeCanvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#b7ab92';
    ctx.fillRect(0, 0, size, size);
    const cells = 3;                       // 一张贴图 = 3.6m，铺装分格 1.2m
    const cell = size / cells;
    for (let i = 0; i < cells; i += 1) {
      for (let j = 0; j < cells; j += 1) {
        const tone = 172 + Math.floor(random() * 22);
        ctx.fillStyle = `rgb(${tone + 12}, ${tone + 4}, ${tone - 18})`;
        ctx.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
        // 石面细粒
        for (let k = 0; k < 26; k += 1) {
          ctx.fillStyle = `rgba(90, 84, 70, ${0.04 + random() * 0.05})`;
          ctx.fillRect(i * cell + random() * cell, j * cell + random() * cell, 1.4, 1.4);
        }
      }
    }
    ctx.strokeStyle = 'rgba(122, 114, 96, 0.9)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= cells; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  }, { anisotropy });

  const tactileTexture = makeCanvasTexture(96, (ctx, size) => {
    ctx.fillStyle = '#c9a45a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(120, 92, 38, 0.55)';
    const step = size / 4;
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        ctx.beginPath();
        ctx.arc(step * (i + 0.5), step * (j + 0.5), step * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { anisotropy });

  const glowTexture = makeCanvasTexture(96, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.32, 'rgba(255,238,214,0.72)');
    gradient.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, { anisotropy: 1 });

  const pavingMaterial = new THREE.MeshStandardMaterial({
    map: pavingTexture, color: 0xffffff, roughness: 0.94, metalness: 0.03,
  });
  const forecourtMaterial = new THREE.MeshStandardMaterial({
    map: pavingTexture, color: 0xd8cfb8, roughness: 0.9, metalness: 0.03,
  });
  const darkPavingMaterial = new THREE.MeshStandardMaterial({
    map: pavingTexture, color: 0x6d6a62, roughness: 0.9, metalness: 0.05,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x9c9788, roughness: 0.86, metalness: 0.02 });
  const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.95, metalness: 0.02 });
  const tactileMaterial = new THREE.MeshStandardMaterial({
    map: tactileTexture, color: 0xffffff, roughness: 0.88, metalness: 0.02,
  });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x8e887a, roughness: 0.82, metalness: 0.04 });
  const hedgeMaterial = new THREE.MeshStandardMaterial({ color: 0x33523a, roughness: 0.95, metalness: 0 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3f31, roughness: 0.96, metalness: 0 });
  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92, metalness: 0, flatShading: true,
  });
  const lampPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3338, roughness: 0.55, metalness: 0.55 });
  const bollardMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3f43, roughness: 0.6, metalness: 0.4 });
  const flagPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x8d7c55, roughness: 0.4, metalness: 0.75 });
  const flagMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8322b, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide,
  });
  const carGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x18222c, roughness: 0.18, metalness: 0.65,
  });
  const carBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.25 });

  // 夜间需要调节的材质句柄（在构建阶段赋值，声明需早于构建调用）
  let lampHeadMaterial = null;
  let lampPoolMaterial = null;

  /* ============================ 1. 铺装与地台 ============================ */
  function buildPaving() {
    // 地台裙墙：环带下方实体，避免从街区侧看到「悬空」铺装
    const skirtHeight = PLAZA_Y - GROUND_Y + 0.22;
    const skirtY = (PLAZA_Y - 0.02 + GROUND_Y - 0.22) / 2;
    const skirts = [
      boxGeometry(PLOT.x1 - HERO.x1 + 0.4, skirtHeight, PLOT.z1 - PLOT.z0 + 1.2,
        (HERO.x1 + PLOT.x1) / 2, skirtY, 0),
      boxGeometry(HERO.x0 - PLOT.x0 + 0.4, skirtHeight, PLOT.z1 - PLOT.z0 + 1.2,
        (PLOT.x0 + HERO.x0) / 2, skirtY, 0),
      boxGeometry(HERO.x1 - HERO.x0, skirtHeight, HERO.z0 - PLOT.z0 + 0.4,
        0, skirtY, (PLOT.z0 + HERO.z0) / 2),
      boxGeometry(HERO.x1 - HERO.x0, skirtHeight, PLOT.z1 - HERO.z1 + 0.4,
        0, skirtY, (HERO.z1 + PLOT.z1) / 2),
    ];
    const skirtMesh = mergedMesh(skirts, plinthMaterial, 'SiteSkirt');
    if (skirtMesh) subGroups.paving.add(skirtMesh);

    // 分格铺装（环带四条，略微探入英雄模型底部 1.5m，隐藏接缝）
    const pavingGeometries = [
      groundQuad(-64, -45.5, -65, 65, PLAZA_Y),
      groundQuad(45.5, 64, -65, 65, PLAZA_Y),
      groundQuad(-45.5, 45.5, -65, -51.5, PLAZA_Y),
      groundQuad(-45.5, 45.5, 51.5, 65, PLAZA_Y),
    ];
    const pavingMesh = mergedMesh(pavingGeometries, pavingMaterial, 'SitePlazaPaving');
    if (pavingMesh) subGroups.paving.add(pavingMesh);

    // 入口前庭（浅色石材）：西、南为主入口，东、北次入口
    const forecourtGeometries = [
      groundQuad(-64, -48, -12, 12, PLAZA_Y + 0.012),
      groundQuad(48, 64, -10, 10, PLAZA_Y + 0.012),
      groundQuad(-12, 12, 52, 65, PLAZA_Y + 0.012),
      groundQuad(-8, 8, -65, -52, PLAZA_Y + 0.012),
    ];
    const forecourtMesh = mergedMesh(forecourtGeometries, forecourtMaterial, 'SiteForecourt');
    if (forecourtMesh) subGroups.paving.add(forecourtMesh);

    // 深色石材轴线：从入口指向建筑
    const axisGeometries = [
      groundQuad(-64, -46.5, -6.5, 6.5, PLAZA_Y + 0.024),
      groundQuad(46.5, 64, -5.5, 5.5, PLAZA_Y + 0.024),
      groundQuad(-6.5, 6.5, 52.6, 65, PLAZA_Y + 0.024),
      groundQuad(-5, 5, -65, -52.6, PLAZA_Y + 0.024),
    ];
    const axisMesh = mergedMesh(axisGeometries, darkPavingMaterial, 'SiteAxisPaving');
    if (axisMesh) subGroups.paving.add(axisMesh);

    // 盲道（简化：东西向两条 + 南北向两条 + 入口连接段）
    const tactileGeometries = [
      groundQuad(-58, -47.5, -0.19, 0.19, PLAZA_Y + 0.032, 0.38),
      groundQuad(-54.4, -54.02, -30, 30, PLAZA_Y + 0.032, 0.38),
      groundQuad(47.5, 58, -0.19, 0.19, PLAZA_Y + 0.032, 0.38),
      groundQuad(54.02, 54.4, -28, 28, PLAZA_Y + 0.032, 0.38),
      groundQuad(-0.19, 0.19, 52.5, 60, PLAZA_Y + 0.032, 0.38),
      groundQuad(-28, 28, 56.4, 56.78, PLAZA_Y + 0.032, 0.38),
      groundQuad(-0.19, 0.19, -60, -52.5, PLAZA_Y + 0.032, 0.38),
    ];
    const tactileMesh = mergedMesh(tactileGeometries, tactileMaterial, 'SiteTactilePaving');
    if (tactileMesh) subGroups.paving.add(tactileMesh);

    // 路缘石：沿地块边界一圈，入口处断开
    const curbTop = 0.36;
    const curbH = curbTop - PLAZA_Y + 0.04;
    const curbY = PLAZA_Y + curbH / 2 - 0.02;
    const curbs = [
      boxGeometry(0.62, curbH, 58, -64.2, curbY, -36),
      boxGeometry(0.62, curbH, 58, -64.2, curbY, 36),
      boxGeometry(0.62, curbH, 58, 64.2, curbY, -36),
      boxGeometry(0.62, curbH, 58, 64.2, curbY, 36),
      boxGeometry(57, curbH, 0.62, -35.5, curbY, -65.2),
      boxGeometry(57, curbH, 0.62, 35.5, curbY, -65.2),
      boxGeometry(0.62, curbH, 0.62, 64.2, curbY, -65.2),
      boxGeometry(57, curbH, 0.62, -35.5, curbY, 65.2),
      boxGeometry(57, curbH, 0.62, 35.5, curbY, 65.2),
      boxGeometry(0.62, curbH, 0.62, 64.2, curbY, 65.2),
      boxGeometry(0.62, curbH, 0.62, -64.2, curbY, -65.2),
      boxGeometry(0.62, curbH, 0.62, -64.2, curbY, 65.2),
    ];
    const curbMesh = mergedMesh(curbs, curbMaterial, 'SiteCurbs');
    if (curbMesh) subGroups.paving.add(curbMesh);

    // 入口台阶（简化：西 / 南 / 东三个入口，两级台阶下到人行道）
    const stepGeometries = [
      boxGeometry(1.8, 0.09, 15, -65.2, 0.045, 0),
      boxGeometry(1.3, 0.17, 15, -64.6, 0.085, 0),
      boxGeometry(15, 0.09, 1.8, 0, 0.045, 66.2),
      boxGeometry(15, 0.17, 1.3, 0, 0.085, 65.6),
      boxGeometry(1.8, 0.09, 12, 65.2, 0.045, 0),
      boxGeometry(1.3, 0.17, 12, 64.6, 0.085, 0),
    ];
    const stepMesh = mergedMesh(stepGeometries, curbMaterial, 'SiteSteps');
    if (stepMesh) subGroups.paving.add(stepMesh);

    // 花池 + 绿篱（沿英雄模型外缘布置，入口处留空）
    const planterSpecs = [
      { x: -48.9, z: -30, w: 1.9, l: 38 },
      { x: -48.9, z: 30, w: 1.9, l: 38 },
      { x: 48.9, z: -30, w: 1.9, l: 38 },
      { x: 48.9, z: 30, w: 1.9, l: 38 },
      { x: -27, z: 54.7, w: 30, l: 1.9 },
      { x: 27, z: 54.7, w: 30, l: 1.9 },
      { x: -27, z: -54.7, w: 30, l: 1.9 },
      { x: 27, z: -54.7, w: 30, l: 1.9 },
    ];
    const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
    const baseInstanced = new THREE.InstancedMesh(baseGeometry, stoneMaterial, planterSpecs.length);
    baseInstanced.name = 'PlanterBases';
    const hedgeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const hedgeInstanced = new THREE.InstancedMesh(hedgeGeometry, hedgeMaterial, planterSpecs.length);
    hedgeInstanced.name = 'Hedges';
    const matrix = new THREE.Matrix4();
    planterSpecs.forEach((spec, index) => {
      const height = 0.44;
      matrix.compose(
        new THREE.Vector3(spec.x, PLAZA_Y + height / 2, spec.z),
        new THREE.Quaternion(),
        new THREE.Vector3(spec.w, height, spec.l),
      );
      baseInstanced.setMatrixAt(index, matrix);
      const hedgeH = 0.56;
      matrix.compose(
        new THREE.Vector3(spec.x, PLAZA_Y + height + hedgeH / 2, spec.z),
        new THREE.Quaternion(),
        new THREE.Vector3(spec.w * 0.82, hedgeH, spec.l * 0.94),
      );
      hedgeInstanced.setMatrixAt(index, matrix);
    });
    baseInstanced.instanceMatrix.needsUpdate = true;
    hedgeInstanced.instanceMatrix.needsUpdate = true;
    subGroups.paving.add(baseInstanced, hedgeInstanced);

    // 挡车石（入口两侧）
    const bollardSpots = [];
    for (let z = -9.6; z <= 9.6; z += 2.4) bollardSpots.push([-49.4, z]);
    for (let z = -9.6; z <= 9.6; z += 2.4) bollardSpots.push([49.4, z]);
    for (let x = -9.6; x <= 9.6; x += 2.4) bollardSpots.push([x, 55.4]);
    for (let x = -7.2; x <= 7.2; x += 2.4) bollardSpots.push([x, -55.4]);
    const bollardGeometry = new THREE.CylinderGeometry(0.14, 0.16, 0.82, 8);
    bollardGeometry.translate(0, 0.41, 0);
    const bollardInstanced = new THREE.InstancedMesh(bollardGeometry, bollardMaterial, bollardSpots.length);
    bollardInstanced.name = 'Bollards';
    bollardSpots.forEach((spot, index) => {
      matrix.compose(
        new THREE.Vector3(spot[0], PLAZA_Y, spot[1]),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      bollardInstanced.setMatrixAt(index, matrix);
    });
    bollardInstanced.instanceMatrix.needsUpdate = true;
    subGroups.paving.add(bollardInstanced);
  }

  /* ============================== 2. 行道树 ============================== */
  const trees = [];
  function buildTrees() {
    // 地块环带内（树池）
    for (let z = -44; z <= 44; z += 8) {
      if (Math.abs(z) < 11) continue;
      trees.push({ x: -56.5 + (random() - 0.5) * 0.8, z: z + (random() - 0.5) * 0.8, pit: true });
      trees.push({ x: 56.5 + (random() - 0.5) * 0.8, z: z + (random() - 0.5) * 0.8, pit: true });
    }
    for (let x = -40; x <= 40; x += 8) {
      if (Math.abs(x) < 11) continue;
      trees.push({ x: x + (random() - 0.5) * 0.8, z: 58.8 + (random() - 0.5) * 0.8, pit: true });
      trees.push({ x: x + (random() - 0.5) * 0.8, z: -58.8 + (random() - 0.5) * 0.8, pit: true });
    }
    // 四角点缀
    for (const [x, z] of [[-58.5, -58.5], [58.5, -58.5], [-58.5, 58.5], [58.5, 58.5]]) {
      trees.push({ x, z, pit: true });
    }
    // 东中街西侧人行道
    for (let z = -88; z <= 88; z += 11) {
      trees.push({ x: 66.8, z: z + (random() - 0.5) * 1.2, pit: false });
    }
    // 东中街东侧人行道
    for (let z = -82; z <= 82; z += 13) {
      trees.push({ x: 79.5, z: z + (random() - 0.5) * 1.2, pit: false });
    }
    // 地块南 / 北侧车行道行道树
    for (let x = -84; x <= 84; x += 12) {
      trees.push({ x: x + (random() - 0.5) * 1.2, z: 67.2, pit: false });
      trees.push({ x: x + (random() - 0.5) * 1.2, z: -67.2, pit: false });
    }

    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6);
    trunkGeometry.translate(0, 1.6, 0);

    const crownLow = new THREE.IcosahedronGeometry(1.9, 1);
    crownLow.scale(1.3, 0.92, 1.3);
    crownLow.translate(0, 4.05, 0);
    const crownHigh = new THREE.IcosahedronGeometry(1.35, 1);
    crownHigh.scale(1.02, 0.9, 1.02);
    crownHigh.translate(0, 5.55, 0);
    const crownGeometry = (() => {
      try {
        const merged = mergeGeometries([crownLow, crownHigh], false);
        if (merged) return merged;
      } catch (error) {
        warn('树冠合并失败，使用单层树冠', error);
      }
      return crownLow;
    })();

    const trunkInstanced = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
    trunkInstanced.name = 'StreetTreesTrunk';
    const crownInstanced = new THREE.InstancedMesh(crownGeometry, crownMaterial, trees.length);
    crownInstanced.name = 'StreetTreesCrown';

    const pitGeometry = new THREE.PlaneGeometry(1.7, 1.7);
    pitGeometry.rotateX(-Math.PI / 2);
    const pitInstanced = new THREE.InstancedMesh(pitGeometry, new THREE.MeshStandardMaterial({
      color: 0x2f2c27, roughness: 0.98,
    }), trees.length);
    pitInstanced.name = 'StreetTreesPit';

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const color = new THREE.Color();
    let pitCount = 0;

    trees.forEach((tree, index) => {
      const size = 0.82 + random() * 0.42;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
      const baseY = tree.pit ? PLAZA_Y : 0.02;
      position.set(tree.x, baseY, tree.z);
      scale.set(size, size * (0.9 + random() * 0.22), size);
      matrix.compose(position, quaternion, scale);
      trunkInstanced.setMatrixAt(index, matrix);
      crownInstanced.setMatrixAt(index, matrix);
      const hue = 0.28 + (random() - 0.5) * 0.05;
      color.setHSL(hue, 0.26 + random() * 0.12, 0.24 + random() * 0.07);
      crownInstanced.setColorAt(index, color);

      if (tree.pit) {
        matrix.compose(
          new THREE.Vector3(tree.x, PLAZA_Y + 0.03, tree.z),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1, 1),
        );
        pitInstanced.setMatrixAt(pitCount, matrix);
        pitCount += 1;
      }
    });
    pitInstanced.count = pitCount;
    trunkInstanced.instanceMatrix.needsUpdate = true;
    crownInstanced.instanceMatrix.needsUpdate = true;
    pitInstanced.instanceMatrix.needsUpdate = true;
    if (crownInstanced.instanceColor) crownInstanced.instanceColor.needsUpdate = true;
    subGroups.trees.add(trunkInstanced, crownInstanced, pitInstanced);
  }

  /* =============================== 3. 路灯 =============================== */
  const lampSpots = [];
  function buildLamps() {
    for (let z = -56; z <= 56; z += 14) {
      if (Math.abs(z) < 6) continue;               // 东西入口轴线留空
      lampSpots.push({ x: -61.3, z, y: PLAZA_Y });
      lampSpots.push({ x: 61.3, z, y: PLAZA_Y });
    }
    for (let x = -48; x <= 48; x += 16) {
      if (Math.abs(x) < 6) continue;               // 南北入口轴线留空
      lampSpots.push({ x, z: 61.3, y: PLAZA_Y });
      lampSpots.push({ x, z: -61.3, y: PLAZA_Y });
    }
    for (let z = -80; z <= 80; z += 16) {
      lampSpots.push({ x: 65.2, z, y: 0.04 });
    }

    const poleGeometry = (() => {
      const pole = new THREE.CylinderGeometry(0.07, 0.11, 4.4, 6);
      pole.translate(0, 2.2, 0);
      const head = new THREE.BoxGeometry(0.46, 0.14, 0.24);
      head.translate(0, 4.5, 0);
      const base = new THREE.CylinderGeometry(0.2, 0.24, 0.28, 6);
      base.translate(0, 0.14, 0);
      try {
        const merged = mergeGeometries([pole, head, base], false);
        if (merged) return merged;
      } catch (error) {
        warn('路灯几何合并失败', error);
      }
      return pole;
    })();
    const poleInstanced = new THREE.InstancedMesh(poleGeometry, lampPoleMaterial, lampSpots.length);
    poleInstanced.name = 'StreetLampPoles';
    const matrix = new THREE.Matrix4();
    lampSpots.forEach((spot, index) => {
      matrix.makeTranslation(spot.x, spot.y, spot.z);
      poleInstanced.setMatrixAt(index, matrix);
    });
    poleInstanced.instanceMatrix.needsUpdate = true;
    subGroups.lamps.add(poleInstanced);

    // 灯头光点（Points，1 draw call）
    const headPositions = new Float32Array(lampSpots.length * 3);
    lampSpots.forEach((spot, index) => {
      headPositions[index * 3] = spot.x;
      headPositions[index * 3 + 1] = spot.y + 4.62;
      headPositions[index * 3 + 2] = spot.z;
    });
    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute('position', new THREE.BufferAttribute(headPositions, 3));
    const headMaterial = new THREE.PointsMaterial({
      color: 0xffc98a, size: 3.4, map: glowTexture, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    });
    const headPoints = new THREE.Points(headGeometry, headMaterial);
    headPoints.name = 'StreetLampHeads';
    headPoints.frustumCulled = false;
    subGroups.lamps.add(headPoints);
    lampHeadMaterial = headMaterial;

    // 贴地暖光面片（InstancedMesh，1 draw call；不新增 PointLight）
    const poolSpots = lampSpots.map((spot) => ({ ...spot, scale: 1 }));
    // 入口前庭额外加强暖光
    poolSpots.push({ x: -52.5, z: 0, y: PLAZA_Y, scale: 1.9 });
    poolSpots.push({ x: 52.5, z: 0, y: PLAZA_Y, scale: 1.9 });
    poolSpots.push({ x: 0, z: 58, y: PLAZA_Y, scale: 1.9 });
    const poolGeometry = new THREE.PlaneGeometry(8.2, 8.2);
    poolGeometry.rotateX(-Math.PI / 2);
    const poolMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture, color: 0xffae63, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const poolInstanced = new THREE.InstancedMesh(poolGeometry, poolMaterial, poolSpots.length);
    poolInstanced.name = 'StreetLampPools';
    poolSpots.forEach((spot, index) => {
      matrix.compose(
        new THREE.Vector3(spot.x, spot.y + 0.035, spot.z),
        new THREE.Quaternion(),
        new THREE.Vector3(spot.scale, 1, spot.scale),
      );
      poolInstanced.setMatrixAt(index, matrix);
    });
    poolInstanced.instanceMatrix.needsUpdate = true;
    subGroups.lamps.add(poolInstanced);
    lampPoolMaterial = poolMaterial;
  }

  /* ============================ 4. 中央庭院水景 =========================== */
  let waterMaterial = null;
  let ledMaterial = null;
  let waterUniforms = null;
  function buildWater() {
    waterUniforms = {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uDayColor: { value: new THREE.Color(0x3f6d74) },
      uNightColor: { value: new THREE.Color(0x0a2338) },
      uLedColor: { value: new THREE.Color(0x86d8ff) },
      uSkyColor: { value: new THREE.Color(0x9fc4dc) },
    };
    waterMaterial = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vWaterWorld;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWaterWorld = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uNight;
        uniform vec3 uDayColor;
        uniform vec3 uNightColor;
        uniform vec3 uLedColor;
        uniform vec3 uSkyColor;
        varying vec3 vWaterWorld;
        void main() {
          vec2 p = vWaterWorld.xz;
          float r = length(p);
          float ripple = sin(r * 3.1 - uTime * 1.7) * 0.5 + 0.5;
          float cross = sin(p.x * 2.3 + uTime * 0.9) * sin(p.y * 2.1 - uTime * 1.15);
          float sparkle = pow(clamp(ripple * 0.6 + cross * 0.45 + 0.12, 0.0, 1.0), 3.0);
          vec3 viewDir = normalize(cameraPosition - vWaterWorld);
          float fresnel = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 2.2);
          vec3 base = mix(uDayColor, uNightColor, uNight);
          vec3 col = base + uSkyColor * sparkle * 0.32 + uSkyColor * fresnel * 0.22;
          float ledOuter = smoothstep(0.34, 0.0, abs(r - 8.15));
          float ledInner = smoothstep(0.28, 0.0, abs(r - 5.62));
          col += uLedColor * ((ledOuter * 1.15) + (ledInner * 0.75)) * uNight;
          gl_FragColor = vec4(col, 0.9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const waterGeometry = new THREE.RingGeometry(5.55, 8.2, 96, 1);
    waterGeometry.rotateX(-Math.PI / 2);
    waterGeometry.translate(0, 0.13, 0);
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.name = 'CourtyardWaterRing';
    waterMesh.renderOrder = 2;
    subGroups.water.add(waterMesh);

    // 石质池沿（内外两圈）
    const rimOuter = new THREE.TorusGeometry(8.28, 0.17, 8, 64);
    rimOuter.rotateX(Math.PI / 2);
    rimOuter.translate(0, 0.16, 0);
    const rimInner = new THREE.TorusGeometry(5.48, 0.13, 8, 64);
    rimInner.rotateX(Math.PI / 2);
    rimInner.translate(0, 0.15, 0);
    const rimMesh = mergedMesh([rimOuter, rimInner], stoneMaterial, 'CourtyardWaterRim');
    if (rimMesh) subGroups.water.add(rimMesh);

    // 夜间 LED 灯带
    const ledGeometry = new THREE.RingGeometry(8.32, 8.44, 96, 1);
    ledGeometry.rotateX(-Math.PI / 2);
    ledGeometry.translate(0, 0.2, 0);
    ledMaterial = new THREE.MeshBasicMaterial({
      color: 0x9adeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    const ledMesh = new THREE.Mesh(ledGeometry, ledMaterial);
    ledMesh.name = 'CourtyardLedRing';
    subGroups.water.add(ledMesh);
  }

  /* ============================== 5. 旗杆旗帜 ============================ */
  let flagTimeUniform = { value: 0 };
  let flagCount = 0;
  function buildFlags() {
    const flagSpots = [
      { x: -56.5, z: -7.5, height: 11.4 },
      { x: -56.5, z: 7.5, height: 11.4 },
      { x: -7.5, z: 60.2, height: 10.6 },
      { x: 7.5, z: 60.2, height: 10.6 },
    ];
    flagCount = flagSpots.length;

    const poleParts = [];
    for (const spot of flagSpots) {
      const pole = new THREE.CylinderGeometry(0.085, 0.12, spot.height, 8);
      pole.translate(spot.x, PLAZA_Y + spot.height / 2, spot.z);
      poleParts.push(pole);
      const finial = new THREE.SphereGeometry(0.17, 8, 6);
      finial.translate(spot.x, PLAZA_Y + spot.height + 0.14, spot.z);
      poleParts.push(finial);
      const base = new THREE.CylinderGeometry(0.34, 0.44, 0.34, 10);
      base.translate(spot.x, PLAZA_Y + 0.17, spot.z);
      poleParts.push(base);
    }
    const poleMesh = mergedMesh(poleParts, flagPoleMaterial, 'FlagPoles');
    if (poleMesh) subGroups.flags.add(poleMesh);

    // 旗帜：合并成一块几何，顶点用 aPhase（摆动相位）与 aFlagU（0=贴旗杆，1=旗端）驱动波浪
    const flagGeometries = [];
    const segmentsX = 14;
    const segmentsY = 6;
    const vertexCount = (segmentsX + 1) * (segmentsY + 1);
    const phases = new Float32Array(vertexCount * flagSpots.length);
    const flagUs = new Float32Array(vertexCount * flagSpots.length);
    flagSpots.forEach((spot, flagIndex) => {
      const flag = new THREE.PlaneGeometry(2.7, 1.75, segmentsX, segmentsY);
      const uvAttribute = flag.attributes.uv;
      for (let i = 0; i < vertexCount; i += 1) {
        const u = uvAttribute ? uvAttribute.getX(i) : (i % (segmentsX + 1)) / segmentsX;
        flagUs[flagIndex * vertexCount + i] = 1 - u;      // 1-uv.x：旗杆侧 = 0
        phases[flagIndex * vertexCount + i] = flagIndex * 1.73 + 0.35;
      }
      flag.rotateY(-Math.PI / 2);                          // 旗面法线朝 ±X，旗面沿 +Z 展开
      flag.translate(spot.x, PLAZA_Y + spot.height - 1.05, spot.z + 1.4);
      flagGeometries.push(flag);
    });
    let flagGeometry = null;
    try {
      flagGeometry = mergeGeometries(flagGeometries, false);
    } catch (error) {
      warn('旗帜几何合并失败', error);
    }
    if (!flagGeometry) return;
    flagGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    flagGeometry.setAttribute('aFlagU', new THREE.BufferAttribute(flagUs, 1));

    flagMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uFlagTime = flagTimeUniform;
      shader.vertexShader = `
        uniform float uFlagTime;
        attribute float aPhase;
        attribute float aFlagU;
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float wave = sin(aFlagU * 3.6 - uFlagTime * 3.3 + aPhase) * 0.20 * aFlagU;
        float wave2 = sin(aFlagU * 6.2 - uFlagTime * 2.1 + aPhase * 1.7) * 0.07 * aFlagU;
        transformed.x += wave + wave2;
        transformed.y += sin(aFlagU * 4.4 - uFlagTime * 2.6 + aPhase) * 0.05 * aFlagU;`,
      );
    };
    flagMaterial.customProgramCacheKey = () => 'site-dressing-flag-v1';
    flagMaterial.needsUpdate = true;

    const flagMesh = new THREE.Mesh(flagGeometry, flagMaterial);
    flagMesh.name = 'Flags';
    subGroups.flags.add(flagMesh);
  }

  /* ============================== 6. 车流 =============================== */
  const carLanes = [
    // 东中街：x≈68.6 南行（+Z）/ x≈72.4 北行（-Z）
    { start: new THREE.Vector3(68.6, 0, -95), dir: new THREE.Vector3(0, 0, 1), length: 190, count: 7, rotY: 0 },
    { start: new THREE.Vector3(72.4, 0, 95), dir: new THREE.Vector3(0, 0, -1), length: 190, count: 7, rotY: Math.PI },
    // 地块南侧车道（z≈68.6 西行 / 72.4 东行）
    { start: new THREE.Vector3(90, 0, 68.6), dir: new THREE.Vector3(-1, 0, 0), length: 180, count: 6, rotY: -Math.PI / 2 },
    { start: new THREE.Vector3(-90, 0, 72.4), dir: new THREE.Vector3(1, 0, 0), length: 180, count: 6, rotY: Math.PI / 2 },
    // 地块北侧车道（z≈-68.6 东行 / -72.4 西行）
    { start: new THREE.Vector3(-90, 0, -68.6), dir: new THREE.Vector3(1, 0, 0), length: 180, count: 6, rotY: Math.PI / 2 },
    { start: new THREE.Vector3(90, 0, -72.4), dir: new THREE.Vector3(-1, 0, 0), length: 180, count: 6, rotY: -Math.PI / 2 },
  ];
  const cars = [];
  let carBodies = null;
  let carCabins = null;
  let carLightsPoints = null;
  let carLightMaterial = null;
  let carLightPositions = null;

  function buildCars() {
    const palette = [0xd8d8d6, 0xb9bec2, 0x2b2f36, 0x6a7480, 0x8d2f2a, 0x2f4a6d, 0xece9e2, 0x3c4540];
    for (const lane of carLanes) {
      for (let i = 0; i < lane.count; i += 1) {
        cars.push({
          lane,
          offset: (i / lane.count) * lane.length + random() * 8,
          speed: 8 + random() * 6,
          color: palette[Math.floor(random() * palette.length)],
        });
      }
    }
    const bodyGeometry = new THREE.BoxGeometry(1.86, 0.62, 4.5);
    bodyGeometry.translate(0, 0.56, 0);
    const cabinGeometry = new THREE.BoxGeometry(1.62, 0.52, 2.15);
    cabinGeometry.translate(0, 1.06, -0.18);

    carBodies = new THREE.InstancedMesh(bodyGeometry, carBodyMaterial, cars.length);
    carBodies.name = 'TrafficCarBodies';
    carCabins = new THREE.InstancedMesh(cabinGeometry, carGlassMaterial, cars.length);
    carCabins.name = 'TrafficCarCabins';
    carBodies.frustumCulled = false;
    carCabins.frustumCulled = false;
    const color = new THREE.Color();
    cars.forEach((car, index) => {
      color.setHex(car.color);
      carBodies.setColorAt(index, color);
    });
    if (carBodies.instanceColor) carBodies.instanceColor.needsUpdate = true;
    subGroups.cars.add(carBodies, carCabins);

    // 夜间车灯（每车 2 点：前灯暖白 + 尾灯红）
    carLightPositions = new Float32Array(cars.length * 2 * 3);
    const colors = new Float32Array(cars.length * 2 * 3);
    cars.forEach((car, index) => {
      const base = index * 6;
      // 前灯
      colors[base] = 1.0; colors[base + 1] = 0.93; colors[base + 2] = 0.78;
      // 尾灯
      colors[base + 3] = 1.0; colors[base + 4] = 0.16; colors[base + 5] = 0.06;
    });
    const lightGeometry = new THREE.BufferGeometry();
    lightGeometry.setAttribute('position', new THREE.BufferAttribute(carLightPositions, 3));
    lightGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    carLightMaterial = new THREE.PointsMaterial({
      size: 2.5, map: glowTexture, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    });
    carLightsPoints = new THREE.Points(lightGeometry, carLightMaterial);
    carLightsPoints.name = 'TrafficCarLights';
    carLightsPoints.frustumCulled = false;
    subGroups.cars.add(carLightsPoints);
    carLightsPoints.visible = false;

    // 初始位置
    updateCars(0);
  }

  const carMatrix = new THREE.Matrix4();
  const carPosition = new THREE.Vector3();
  const carQuaternion = new THREE.Quaternion();
  const carScale = new THREE.Vector3(1, 1, 1);
  const carAxisY = new THREE.Vector3(0, 1, 0);
  function updateCars(timeSeconds) {
    if (!carBodies || !carCabins) return;
    for (let index = 0; index < cars.length; index += 1) {
      const car = cars[index];
      const lane = car.lane;
      const distance = (car.offset + car.speed * timeSeconds) % lane.length;
      carPosition.copy(lane.start).addScaledVector(lane.dir, distance);
      carQuaternion.setFromAxisAngle(carAxisY, lane.rotY);
      carMatrix.compose(carPosition, carQuaternion, carScale);
      carBodies.setMatrixAt(index, carMatrix);
      carCabins.setMatrixAt(index, carMatrix);

      if (carLightPositions) {
        const forwardX = lane.dir.x;
        const forwardZ = lane.dir.z;
        const base = index * 6;
        // 前灯（车头）
        carLightPositions[base] = carPosition.x + forwardX * 2.35;
        carLightPositions[base + 1] = 0.72;
        carLightPositions[base + 2] = carPosition.z + forwardZ * 2.35;
        // 尾灯（车尾）
        carLightPositions[base + 3] = carPosition.x - forwardX * 2.3;
        carLightPositions[base + 4] = 0.7;
        carLightPositions[base + 5] = carPosition.z - forwardZ * 2.3;
      }
    }
    carBodies.instanceMatrix.needsUpdate = true;
    carCabins.instanceMatrix.needsUpdate = true;
    if (carLightsPoints && carLightsPoints.geometry) {
      carLightsPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  /* ============================= 构建全部 ============================== */
  function mergedMesh(geometries, material, name) {
    if (!geometries || !geometries.length) return null;
    try {
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        for (const geometry of geometries) geometry.dispose();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = name;
        return mesh;
      }
    } catch (error) {
      warn(`几何合并失败：${name}，回退为多 mesh`, error);
    }
    const fallback = new THREE.Group();
    fallback.name = name;
    for (const geometry of geometries) fallback.add(new THREE.Mesh(geometry, material));
    return fallback;
  }

  try { buildPaving(); } catch (error) { warn('铺装构建失败', error); }
  try { buildTrees(); } catch (error) { warn('行道树构建失败', error); }
  try { buildLamps(); } catch (error) { warn('路灯构建失败', error); }
  try { buildWater(); } catch (error) { warn('水景构建失败', error); }
  try { buildFlags(); } catch (error) { warn('旗杆构建失败', error); }
  try { buildCars(); } catch (error) { warn('车流构建失败', error); }

  /* ------------------------------- 状态 -------------------------------- */
  const layers = {
    paving: true, trees: true, lamps: true, cars: true, water: true, flags: true, people: true,
  };
  let mode = 'day';
  let nightF = 0;
  let targetNight = 0;
  let elapsed = 0;

  function applyNight(factor) {
    const f = clamp01(factor);
    if (lampHeadMaterial) {
      lampHeadMaterial.opacity = f * 0.92;
    }
    if (lampPoolMaterial) {
      lampPoolMaterial.opacity = f * 0.62;
    }
    if (ledMaterial) {
      ledMaterial.opacity = f * 0.9;
    }
    if (waterUniforms) {
      waterUniforms.uNight.value = f;
    }
    if (carLightMaterial) {
      carLightMaterial.opacity = f * 0.95;
    }
    if (carLightsPoints) {
      carLightsPoints.visible = f > 0.02;
    }
    if (crownMaterial) {
      crownMaterial.color.setScalar(1 - 0.38 * f);
    }
    if (trunkMaterial) {
      trunkMaterial.color.setScalar(1 - 0.3 * f);
    }
    if (flagMaterial) {
      flagMaterial.color.setRGB(0.66 - 0.12 * f, 0.2 - 0.03 * f, 0.16 - 0.02 * f);
    }
  }

  const dressing = {
    group,
    layers,
    get mode() { return mode; },
    get stats() { return { ...stats }; },
    get warnings() { return warnings.slice(); },
    city: city || null,

    setNight(nextMode) {
      if (!Object.prototype.hasOwnProperty.call(NIGHT_TARGET, nextMode)) {
        warn(`未知夜间模式 ${nextMode}，回退 day`);
        nextMode = 'day';
      }
      mode = nextMode;
      targetNight = NIGHT_TARGET[nextMode];
      return mode;
    },

    setLayer(name, on) {
      if (name === 'all') {
        for (const key of Object.keys(subGroups)) {
          layers[key] = Boolean(on);
          subGroups[key].visible = Boolean(on);
        }
        return true;
      }
      if (!Object.prototype.hasOwnProperty.call(subGroups, name)) {
        warn(`未知图层 ${name}`);
        return false;
      }
      layers[name] = Boolean(on);
      subGroups[name].visible = Boolean(on);
      return true;
    },

    toggleLayer(name) {
      if (!Object.prototype.hasOwnProperty.call(subGroups, name)) return false;
      return dressing.setLayer(name, !layers[name]);
    },

    update(dt, now) {
      const delta = nextFrameClamp(dt);
      const nowValue = Number.isFinite(now) ? now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
      elapsed += delta;
      // 夜间参数平滑（~0.8s）
      const k = Math.min(1, delta * 4.5);
      nightF += (targetNight - nightF) * k;
      if (Math.abs(targetNight - nightF) < 0.002) nightF = targetNight;
      applyNight(nightF);

      if (waterUniforms) waterUniforms.uTime.value = elapsed;
      flagTimeUniform.value = elapsed;

      if (subGroups.cars.visible) updateCars(nowValue / 1000);
    },

    dispose() {
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
      });
      if (pavingTexture) pavingTexture.dispose();
      if (tactileTexture) tactileTexture.dispose();
      if (glowTexture) glowTexture.dispose();
      for (const material of [pavingMaterial, forecourtMaterial, darkPavingMaterial, curbMaterial,
        plinthMaterial, tactileMaterial, stoneMaterial, hedgeMaterial, trunkMaterial, crownMaterial,
        lampPoleMaterial, bollardMaterial, flagPoleMaterial, flagMaterial, carGlassMaterial,
        carBodyMaterial, waterMaterial, ledMaterial]) {
        if (material && material.dispose) material.dispose();
      }
      if (scene) scene.remove(group);
    },
  };

  /* ------------------------------ 统计 --------------------------------- */
  let stats = { drawCalls: 0, triangles: 0, trees: 0, lamps: 0, cars: 0 };
  function computeStats() {
    let drawCalls = 0;
    let triangles = 0;
    group.traverse((object) => {
      if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite)) return;
      if (!object.geometry || object.visible === false) return;
      drawCalls += 1;
      const geometry = object.geometry;
      const count = geometry.index ? geometry.index.count : (geometry.attributes.position ? geometry.attributes.position.count : 0);
      const instances = object.isInstancedMesh ? object.count : 1;
      triangles += (count / 3) * instances;
    });
    stats = {
      drawCalls,
      triangles: Math.round(triangles),
      trees: trees.length,
      lamps: lampSpots.length,
      cars: cars.length,
      blades: flagCount,
    };
    return stats;
  }

  if (scene && typeof scene.add === 'function') scene.add(group);
  else warn('缺少 scene，site-dressing 未加入场景');

  computeStats();
  dressing.update(0, 0);
  return dressing;
}

export default createSiteDressing;
