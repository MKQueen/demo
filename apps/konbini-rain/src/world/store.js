/**
 * world/store.js —— 便利店外壳。
 *
 * 负责「建筑」本身：墙体 / 大面积玻璃 / 自动门 / 雨棚 / 招牌 / 立柱灯箱 /
 * 屋顶女儿墙 / 后场门。室内陈列归 interior.js，门外小道具归 props.js。
 *
 * 对其它模块暴露的 handles：
 *   handles.door = { left, right, closedX, openX, y, z }       自动门两扇
 *   handles.glass = { material, uniforms }                      玻璃材质（fx 可驱雨痕）
 *   handles.flickerMats / handles.flickerLights                 招牌轻微闪烁
 *   handles.dripPoints                                         屋檐滴水点
 */
import * as THREE from 'three';
import { C, L, BRAND } from '../config.js';
import { TEX, canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import { toon, flat, lightbox, addOutline, glowSprite } from '../lib/toon.js';
import { box, roundedBox, plane, mesh, group, cyl, shadow, DEG } from '../lib/kit.js';

/* -------------------------------------------------------------------------- */
/*  玻璃                                                                       */
/* -------------------------------------------------------------------------- */

function createGlass() {
  const uniforms = {
    uTime: { value: 0 },
    uTint: { value: new THREE.Color('#9fd6d8') },
    uReflect: { value: 0.3 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize( normalMatrix * normal );
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vViewPos = - mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uReflect;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        vec3 n = normalize( vNormal );
        vec3 v = normalize( vViewPos );
        float fres = pow( 1.0 - clamp( dot( n, v ), 0.0, 1.0 ), 3.2 );

        // 灯箱在玻璃上的斜向柔光反光
        float streak = smoothstep( 0.78, 1.0, 1.0 - abs( fract( vUv.y * 1.35 + vUv.x * 0.28 ) - 0.5 ) * 2.0 );
        float streak2 = smoothstep( 0.86, 1.0, 1.0 - abs( fract( vUv.y * 0.72 - vUv.x * 0.12 + 0.3 ) - 0.5 ) * 2.0 );

        // 顶部雨棚暖光映在玻璃上沿
        float warmTop = smoothstep( 0.55, 1.0, vUv.y ) * 0.10;

        vec3 color = mix( uTint * 0.75, vec3( 0.78, 0.93, 1.0 ), fres * 0.7 );
        color += vec3( 0.9, 0.96, 1.0 ) * ( streak * 0.1 + streak2 * 0.06 ) * uReflect;
        color += vec3( 1.0, 0.75, 0.45 ) * warmTop * uReflect * 0.6;

        float alpha = 0.018 + fres * 0.12 * uReflect + streak * 0.018 + streak2 * 0.012 + warmTop * 0.22;
        gl_FragColor = vec4( color, alpha );
      }
    `,
  });
  return { material, uniforms };
}

/* -------------------------------------------------------------------------- */
/*  自动门单扇                                                                 */
/* -------------------------------------------------------------------------- */

function doorPanel(width, height, glass, opts = {}) {
  const g = group('door-panel');
  const frameMat = toon(C.frame, { rim: 0.18, rimColor: '#a8c8e0', gradient: 'soft' });
  const fw = 0.045;
  const t = 0.05;
  // 边框
  box(width, fw * 1.4, t, frameMat, { y: height / 2 - fw * 0.7, parent: g, cast: true, receive: true });
  box(width, fw * 1.4, t, frameMat, { y: -height / 2 + fw * 0.7, parent: g, cast: true, receive: true });
  box(fw, height, t, frameMat, { x: -width / 2 + fw / 2, parent: g, cast: true, receive: true });
  box(fw, height, t, frameMat, { x: width / 2 - fw / 2, parent: g, cast: true, receive: true });

  // 玻璃
  const glassMesh = plane(width - fw * 2, height - fw * 2, glass.material, {
    z: 0.002,
    cast: false,
    receive: false,
    parent: g,
  });
  glassMesh.userData.isGlass = true;

  // 拉手（内外各一根竖杆）
  const metal = toon('#b7bcc4', { rim: 0.3, rimColor: '#eaf4ff', gradient: 'soft' });
  const hx = opts.handleSide === 'left' ? -width * 0.3 : width * 0.3;
  for (const z of [0.055, -0.055]) {
    cyl(0.014, 0.014, 0.46, 10, metal, { x: hx, y: -0.06, z, parent: g, cast: false });
    box(0.03, 0.03, 0.08, metal, { x: hx, y: 0.17, z: z * 0.6, parent: g, cast: false });
    box(0.03, 0.03, 0.08, metal, { x: hx, y: -0.29, z: z * 0.6, parent: g, cast: false });
  }

  // 自动门贴纸
  const sticker = plane(0.2, 0.1, flat('#ffffff', { map: TEX.doorSticker(), transparent: true, alphaTest: 0.05 }), {
    x: -0.02,
    y: 0.52,
    z: 0.04,
    cast: false,
    receive: false,
    parent: g,
  });
  sticker.userData.noOutline = true;

  return g;
}

/* -------------------------------------------------------------------------- */
/*  build                                                                      */
/* -------------------------------------------------------------------------- */

export function buildStore(ctx) {
  const { handles } = ctx;
  const g = group('store');
  const S = L.store;
  const I = S.interior;
  const wallH = S.wallTopY - L.lot.top;
  const wallY = (L.lot.top + S.wallTopY) / 2;
  const cx = (S.minX + S.maxX) / 2;
  const cz = (S.minZ + S.maxZ) / 2;
  const width = S.maxX - S.minX;
  const depth = S.maxZ - S.minZ;

  const wallMat = toon(C.wall, { rim: 0.16, rimColor: '#9fc4e8', gradient: 'soft' });
  const wallShade = toon(C.wallShade, { rim: 0.14, rimColor: '#9fc4e8', gradient: 'soft' });
  const kickMat = toon(C.kick, { rim: 0.14, rimColor: '#7f9ec4', gradient: 'soft' });
  const frameMat = toon(C.frame, { rim: 0.2, rimColor: '#a8c8e0', gradient: 'soft' });
  const roofMat = toon(C.roof, { rim: 0.14, rimColor: '#9fb4d0', gradient: 'soft' });
  const roofDark = toon(C.roofDark, { rim: 0.1, rimColor: '#8aa2c0', gradient: 'soft' });
  const metalMat = toon('#a9aeb6', { rim: 0.22, rimColor: '#e8f2ff', gradient: 'soft' });
  const canopyMat = toon('#e2eae6', {
    rim: 0.26,
    rimColor: '#b8d8ee',
    gradient: 'soft',
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  });

  /* ---------------- 四面墙 ---------------- */

  // 左墙（临小巷）
  box(0.18, wallH, depth, wallMat, { x: S.minX + 0.09, y: wallY, z: cz, parent: g });
  // 后墙
  box(width, wallH, 0.18, wallMat, { x: cx, y: wallY, z: S.minZ + 0.09, parent: g });
  // 右墙（临人行道）
  box(0.18, wallH, depth, wallMat, { x: S.maxX - 0.09, y: wallY, z: cz, parent: g });

  // 右墙分缝 + 踢脚
  for (const z of [-3.7, -2.4, -1.1, 0.2]) {
    box(0.012, wallH - 0.2, 0.03, wallShade, { x: S.maxX + 0.002, y: wallY + 0.02, z, parent: g, cast: false });
  }
  box(0.02, 0.3, depth, kickMat, { x: S.maxX + 0.003, y: L.lot.top + 0.15, z: cz, parent: g, cast: false });
  box(0.02, 0.12, depth, frameMat, { x: S.maxX + 0.004, y: S.wallTopY - 0.3, z: cz, parent: g, cast: false });

  // 左墙分缝（面向小巷）
  for (const z of [-3.9, -2.4, -0.9, 0.6]) {
    box(0.012, wallH - 0.2, 0.03, wallShade, { x: S.minX - 0.002, y: wallY + 0.02, z, parent: g, cast: false });
  }

  /* ---------------- 正面：玻璃幕墙 ---------------- */

  // 底部踢脚墙
  box(S.doorX1 - S.minX + 0.18, 0.33, 0.18, kickMat, {
    x: (S.minX + S.doorX1) / 2 + 0.02,
    y: L.lot.top + 0.165,
    z: S.maxZ - 0.09,
    parent: g,
  });
  // 踢脚上沿铝条
  box(S.doorX1 - S.minX + 0.2, 0.035, 0.2, frameMat, {
    x: (S.minX + S.doorX1) / 2 + 0.02,
    y: L.lot.top + 0.35,
    z: S.maxZ - 0.09,
    parent: g,
    cast: false,
  });

  // 顶部 fascia（招牌背后的整条墙）
  box(width, S.wallTopY - S.fasciaY0, 0.18, wallMat, {
    x: cx,
    y: (S.fasciaY0 + S.wallTopY) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });
  // fascia 下沿铝条
  box(width, 0.05, 0.2, frameMat, { x: cx, y: S.fasciaY0 + 0.02, z: S.maxZ - 0.08, parent: g, cast: false });

  // 左右角柱 / 门与窗之间的立柱
  box(0.18, S.fasciaY0 - L.lot.top, 0.18, frameMat, {
    x: S.minX + 0.09,
    y: (L.lot.top + S.fasciaY0) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });
  box(0.18, S.fasciaY0 - L.lot.top, 0.18, frameMat, {
    x: S.maxX - 0.09,
    y: (L.lot.top + S.fasciaY0) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });
  // 窗与门之间的竖柱
  box(0.1, S.fasciaY0 - L.lot.top, 0.18, frameMat, {
    x: (S.windowX1 + S.doorX0) / 2,
    y: (L.lot.top + S.fasciaY0) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });

  const glass = createGlass();
  handles.glass = glass;

  // 大玻璃窗
  const winW = S.windowX1 - S.windowX0;
  const winH = S.glassY1 - S.glassY0;
  const winY = (S.glassY0 + S.glassY1) / 2;
  const winX = (S.windowX0 + S.windowX1) / 2;
  const glassWin = plane(winW, winH, glass.material, {
    x: winX,
    y: winY,
    z: S.maxZ - 0.11,
    cast: false,
    receive: false,
    parent: g,
  });
  glassWin.userData.isGlass = true;

  // 玻璃分格竖梃
  for (const mx of [-1.62, -0.51]) {
    box(0.05, winH, 0.07, frameMat, { x: mx, y: winY, z: S.maxZ - 0.09, parent: g, cast: false });
  }
  // 上下横梃
  box(winW, 0.06, 0.08, frameMat, { x: winX, y: S.glassY0 + 0.03, z: S.maxZ - 0.09, parent: g, cast: false });
  box(winW, 0.055, 0.08, frameMat, { x: winX, y: S.glassY1 - 0.02, z: S.maxZ - 0.09, parent: g, cast: false });

  // 自动门门框
  box(0.07, S.fasciaY0 - L.lot.top, 0.2, frameMat, {
    x: S.doorX0 - 0.035,
    y: (L.lot.top + S.fasciaY0) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });
  box(0.07, S.fasciaY0 - L.lot.top, 0.2, frameMat, {
    x: S.doorX1 + 0.035,
    y: (L.lot.top + S.fasciaY0) / 2,
    z: S.maxZ - 0.09,
    parent: g,
  });
  box(S.doorX1 - S.doorX0 + 0.14, 0.07, 0.2, frameMat, {
    x: (S.doorX0 + S.doorX1) / 2,
    y: S.fasciaY0 - 0.03,
    z: S.maxZ - 0.09,
    parent: g,
  });

  // 门槛 / 台阶
  box(S.doorX1 - S.doorX0 + 0.2, 0.028, 0.34, metalMat, {
    x: (S.doorX0 + S.doorX1) / 2,
    y: L.lot.top + 0.014,
    z: S.maxZ + 0.08,
    parent: g,
    cast: false,
  });

  // 两扇自动门
  const doorW = (S.doorX1 - S.doorX0) / 2 - 0.005;
  const doorH = S.glassY1 - S.glassY0;
  const leftDoor = doorPanel(doorW, doorH, glass, { handleSide: 'right' });
  const rightDoor = doorPanel(doorW, doorH, glass, { handleSide: 'left' });
  const doorZ = S.maxZ - 0.06;
  leftDoor.position.set((S.doorX0 + S.doorX1) / 2 - doorW / 2 - 0.003, winY, doorZ);
  rightDoor.position.set((S.doorX0 + S.doorX1) / 2 + doorW / 2 + 0.003, winY, doorZ);
  g.add(leftDoor, rightDoor);
  handles.door = {
    left: leftDoor,
    right: rightDoor,
    closedX: [leftDoor.position.x, rightDoor.position.x],
    openX: [leftDoor.position.x - doorW - 0.03, rightDoor.position.x + doorW + 0.03],
    y: winY,
    z: doorZ,
  };

  // 自动门传感器
  box(0.24, 0.1, 0.12, toon('#2c3340', { rim: 0.15, rimColor: '#7f9ec4' }), {
    x: (S.doorX0 + S.doorX1) / 2,
    y: S.fasciaY0 - 0.1,
    z: S.maxZ + 0.02,
    parent: g,
    cast: false,
  });
  box(0.07, 0.025, 0.07, flat(new THREE.Color('#ff9d6b').multiplyScalar(1.4)), {
    x: (S.doorX0 + S.doorX1) / 2,
    y: S.fasciaY0 - 0.11,
    z: S.maxZ + 0.07,
    parent: g,
    cast: false,
  });

  // 窗内灯带（玻璃上方的暖色灯槽）
  const warmStrip = box(width - 0.34, 0.045, 0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe1b4').multiplyScalar(1.5) }), {
    x: cx,
    y: S.fasciaY0 - 0.04,
    z: S.maxZ + 0.035,
    parent: g,
    cast: false,
  });
  warmStrip.userData.noOutline = true;

  /* ---------------- 招牌 ---------------- */

  const signMat = lightbox(TEX.mainSign(), 1.68, { side: THREE.DoubleSide });
  const signBoxX = cx;
  const signY = (S.sign.y0 + S.sign.y1) / 2;
  // 灯箱箱体
  box(S.sign.x1 - S.sign.x0 + 0.1, S.sign.y1 - S.sign.y0 + 0.12, 0.14, toon('#2b3b5b', { rim: 0.2, rimColor: '#8fb4dd', gradient: 'soft' }), {
    x: signBoxX,
    y: signY,
    z: S.sign.z + 0.05,
    parent: g,
    cast: true,
  });
  const signFace = plane(S.sign.x1 - S.sign.x0, S.sign.y1 - S.sign.y0, signMat, {
    x: signBoxX,
    y: signY,
    z: S.sign.z + 0.125,
    cast: false,
    receive: false,
    parent: g,
  });
  signFace.name = 'main-sign';
  signFace.userData.noOutline = true;
  // 灯箱边框（四根细铝条，强化赛璐璐轮廓）
  const edgeMat = toon('#c9ced8', { rim: 0.25, rimColor: '#f2f8ff', gradient: 'soft' });
  const sw = S.sign.x1 - S.sign.x0;
  const sh = S.sign.y1 - S.sign.y0;
  box(sw + 0.12, 0.04, 0.06, edgeMat, { x: signBoxX, y: signY + sh / 2 + 0.02, z: S.sign.z + 0.13, parent: g, cast: false });
  box(sw + 0.12, 0.04, 0.06, edgeMat, { x: signBoxX, y: signY - sh / 2 - 0.02, z: S.sign.z + 0.13, parent: g, cast: false });
  box(0.04, sh + 0.08, 0.06, edgeMat, { x: signBoxX - sw / 2 - 0.04, y: signY, z: S.sign.z + 0.13, parent: g, cast: false });
  box(0.04, sh + 0.08, 0.06, edgeMat, { x: signBoxX + sw / 2 + 0.04, y: signY, z: S.sign.z + 0.13, parent: g, cast: false });

  /* ---------------- 雨棚 ---------------- */

  const canopy = group('canopy');
  const cw = S.canopy.x1 - S.canopy.x0;
  const cd = S.canopy.z1 - S.canopy.z0;
  const ccx = (S.canopy.x0 + S.canopy.x1) / 2;
  // 半透明棚面（外低内高）
  const panel = box(cw, S.canopy.thickness, cd, canopyMat, {
    x: ccx,
    y: S.canopy.y,
    z: (S.canopy.z0 + S.canopy.z1) / 2,
    rx: 0.055,
    parent: canopy,
  });
  panel.castShadow = false;
  // 棚面金属框
  const cFrameMat = toon('#c3c9d1', { rim: 0.24, rimColor: '#eef6ff', gradient: 'soft' });
  box(cw + 0.04, 0.06, 0.055, cFrameMat, { x: ccx, y: S.canopy.y - 0.02, z: S.canopy.z0 + 0.03, parent: canopy, cast: false });
  box(cw + 0.04, 0.06, 0.055, cFrameMat, { x: ccx, y: S.canopy.y - 0.055, z: S.canopy.z1 - 0.03, parent: canopy, cast: false });
  box(0.055, 0.06, cd, cFrameMat, { x: S.canopy.x0 + 0.03, y: S.canopy.y - 0.04, z: (S.canopy.z0 + S.canopy.z1) / 2, parent: canopy, cast: false });
  box(0.055, 0.06, cd, cFrameMat, { x: S.canopy.x1 - 0.03, y: S.canopy.y - 0.04, z: (S.canopy.z0 + S.canopy.z1) / 2, parent: canopy, cast: false });
  // 横向加强肋
  for (const x of [-0.55, 0.35, 1.25]) {
    box(0.04, 0.035, cd - 0.1, cFrameMat, { x, y: S.canopy.y - 0.065, z: (S.canopy.z0 + S.canopy.z1) / 2, parent: canopy, cast: false });
  }
  // 斜撑
  for (const x of [-1.05, 0.25, 1.55]) {
    const strut = cyl(0.022, 0.022, 1.28, 8, cFrameMat, {
      x,
      y: S.canopy.y + 0.22,
      z: S.canopy.z1 - 0.52,
      rx: 39 * DEG,
      parent: canopy,
      cast: false,
    });
    strut.rotation.z = 0;
  }
  // 雨棚下灯带
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffdca6').multiplyScalar(1.8) });
  const led = box(cw - 0.2, 0.03, 0.045, ledMat, {
    x: ccx,
    y: S.canopy.y - 0.1,
    z: S.canopy.z1 - 0.12,
    parent: canopy,
    cast: false,
  });
  led.userData.noOutline = true;
  // 雨棚下三盏小筒灯
  for (const x of [-0.8, 0.35, 1.45]) {
    cyl(0.05, 0.055, 0.05, 12, flat('#fff0cf'), {
      x,
      y: S.canopy.y - 0.11,
      z: S.canopy.z1 - 0.42,
      parent: canopy,
      cast: false,
    });
  }
  g.add(canopy);

  /* ---------------- 立柱灯箱（pylon sign）---------------- */

  const pylon = group('pylon');
  pylon.position.set(L.pylon.x, L.pylon.baseY, L.pylon.z);
  // 基座 + 柱子
  box(0.56, 0.22, 0.56, toon('#6b6f78', { rim: 0.14, rimColor: '#9db8d8' }), { y: 0.11, parent: pylon });
  cyl(0.085, 0.1, 2.0, 12, metalMat, { y: 1.12, parent: pylon });
  const pylonMat = lightbox(TEX.pylonSign(), 1.58, { side: THREE.DoubleSide });
  box(1.02, 2.6, 0.22, toon('#efe8d6', { rim: 0.18, rimColor: '#ffd9a0', gradient: 'soft' }), {
    x: 0,
    y: 3.0,
    z: 0,
    parent: pylon,
  });
  plane(0.94, 2.48, pylonMat, { y: 3.0, z: 0.113, cast: false, receive: false, parent: pylon });
  plane(0.94, 2.48, pylonMat, { y: 3.0, z: -0.113, ry: Math.PI, cast: false, receive: false, parent: pylon });
  box(1.08, 0.12, 0.26, toon('#2b3b5b', { rim: 0.18, rimColor: '#8fb4dd' }), { y: 4.36, parent: pylon });
  box(1.08, 0.08, 0.26, toon('#3fa8a0', { rim: 0.2, rimColor: '#8ff0e8' }), { y: 1.68, parent: pylon });
  g.add(pylon);

  /* ---------------- 屋顶 / 女儿墙 ---------------- */

  box(width + 0.12, 0.16, depth + 0.12, roofMat, { x: cx, y: S.wallTopY + 0.08, z: cz, parent: g });
  const parH = 0.24;
  const parY = S.wallTopY + 0.16 + parH / 2;
  box(width + 0.2, parH, 0.1, wallMat, { x: cx, y: parY, z: S.minZ - 0.04, parent: g, cast: false });
  box(width + 0.2, parH, 0.1, wallMat, { x: cx, y: parY, z: S.maxZ + 0.04, parent: g, cast: false });
  box(0.1, parH, depth + 0.2, wallMat, { x: S.minX - 0.04, y: parY, z: cz, parent: g, cast: false });
  box(0.1, parH, depth + 0.2, wallMat, { x: S.maxX + 0.04, y: parY, z: cz, parent: g, cast: false });
  // 女儿墙压顶
  const capMat = toon('#c7cbd2', { rim: 0.24, rimColor: '#eaf4ff', gradient: 'soft' });
  box(width + 0.26, 0.04, 0.14, capMat, { x: cx, y: parY + parH / 2 + 0.02, z: S.minZ - 0.04, parent: g, cast: false });
  box(width + 0.26, 0.04, 0.14, capMat, { x: cx, y: parY + parH / 2 + 0.02, z: S.maxZ + 0.04, parent: g, cast: false });
  box(0.14, 0.04, depth + 0.26, capMat, { x: S.minX - 0.04, y: parY + parH / 2 + 0.02, z: cz, parent: g, cast: false });
  box(0.14, 0.04, depth + 0.26, capMat, { x: S.maxX + 0.04, y: parY + parH / 2 + 0.02, z: cz, parent: g, cast: false });

  /* ---------------- 后场门 / 细节 ---------------- */

  const serviceDoor = toon('#4d5563', { rim: 0.14, rimColor: '#8fb0d4', gradient: 'soft' });
  // 后门（朝 -Z，位于后墙右侧）
  box(0.92, 2.05, 0.06, serviceDoor, { x: 0.86, y: L.lot.top + 1.025, z: S.minZ - 0.02, parent: g, cast: false });
  box(0.98, 0.06, 0.1, toon('#8d939c'), { x: 0.86, y: L.lot.top + 2.08, z: S.minZ - 0.02, parent: g, cast: false });
  // 后门上方小壁灯
  box(0.16, 0.08, 0.12, toon('#5a606b'), { x: 0.86, y: L.lot.top + 2.35, z: S.minZ - 0.04, parent: g, cast: false });
  box(0.11, 0.035, 0.09, flat(new THREE.Color('#ffc987').multiplyScalar(1.3)), {
    x: 0.86,
    y: L.lot.top + 2.31,
    z: S.minZ - 0.06,
    parent: g,
    cast: false,
  });
  // 后墙通风格栅
  for (let i = 0; i < 5; i += 1) {
    box(0.6, 0.03, 0.03, metalMat, { x: -1.55, y: L.lot.top + 1.3 + i * 0.09, z: S.minZ - 0.03, parent: g, cast: false });
  }
  // 后墙角落水管
  cyl(0.055, 0.055, 3.2, 10, metalMat, { x: S.minX + 0.12, y: L.lot.top + 1.6, z: S.minZ - 0.08, parent: g, cast: false });
  cyl(0.07, 0.07, 0.18, 10, metalMat, { x: S.minX + 0.12, y: S.wallTopY - 0.1, z: S.minZ - 0.08, parent: g, cast: false });

  // 左墙上的小金属门（小巷侧）
  box(0.06, 1.95, 0.82, serviceDoor, { x: S.minX - 0.03, y: L.lot.top + 0.975, z: -3.15, parent: g, cast: false });
  box(0.1, 0.06, 0.9, toon('#8d939c'), { x: S.minX - 0.03, y: L.lot.top + 1.98, z: -3.15, parent: g, cast: false });
  // 门上小灯（暖）
  box(0.12, 0.07, 0.16, toon('#5a606b'), { x: S.minX - 0.06, y: L.lot.top + 2.28, z: -3.15, parent: g, cast: false });
  box(0.08, 0.03, 0.1, flat(new THREE.Color('#ffc987').multiplyScalar(1.3)), {
    x: S.minX - 0.09,
    y: L.lot.top + 2.24,
    z: -3.15,
    parent: g,
    cast: false,
  });

  /* ---------------- 地板托层 / 天花板 ---------------- */

  box(I.maxX - I.minX, 0.03, I.maxZ - I.minZ, toon('#8d8678', { rim: 0.1, rimColor: '#c8b58e' }), {
    x: (I.minX + I.maxX) / 2,
    y: L.lot.top + 0.01,
    z: (I.minZ + I.maxZ) / 2,
    parent: g,
    cast: false,
  });
  const ceil = box(I.maxX - I.minX, 0.06, I.maxZ - I.minZ, toon(C.interiorCeil, { rim: 0.06, rimColor: '#ffe9c4', gradient: 'soft' }), {
    x: (I.minX + I.maxX) / 2,
    y: I.ceilY + 0.03,
    z: (I.minZ + I.maxZ) / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  ceil.userData.isCeil = true;

  /* ---------------- 玻璃海报 / 贴纸 / 雨棚招牌带 ---------------- */

  // 玻璃外贴的海报（店员用胶带贴上去的那种）
  const posterOden = plane(0.44, 0.62, new THREE.MeshBasicMaterial({ map: TEX.glassPosterOden(), transparent: false, fog: true }), {
    x: -2.46,
    y: 1.02,
    z: S.maxZ - 0.096,
    cast: false,
    receive: false,
    parent: g,
  });
  posterOden.rotation.z = -0.035;
  const posterCoffee = plane(0.3, 0.44, new THREE.MeshBasicMaterial({ map: TEX.glassPosterCoffee(), transparent: false, fog: true }), {
    x: 0.5,
    y: 1.42,
    z: S.maxZ - 0.096,
    cast: false,
    receive: false,
    parent: g,
  });
  posterCoffee.rotation.z = 0.025;
  for (const post of [posterOden, posterCoffee]) {
    post.userData.noOutline = true;
    post.renderOrder = 2;
    // 胶带
    const tape = new THREE.MeshBasicMaterial({ color: '#f0eee1', transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    for (const dy of [0.4, -0.4]) {
      const tp = plane(0.16, 0.05, tape, { x: 0, y: dy, z: 0.002, cast: false, receive: false, parent: post });
      tp.userData.noOutline = true;
    }
  }

  // 玻璃上的白字贴纸（24H / ATM / 防犯カメラ）
  const stickerTex = canvasTexture(512, 256, (ctx2, w, h) => {
    ctx2.clearRect(0, 0, w, h);
    ctx2.fillStyle = 'rgba(255,255,255,0.95)';
    ctx2.font = `700 66px ${JP_FONT}`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText('24時間営業', w / 2, 60);
    ctx2.font = `600 46px ${JP_FONT}`;
    ctx2.fillText('ATM・コピー機', w / 2, 135);
    ctx2.font = `600 34px ${JP_FONT}`;
    ctx2.fillStyle = 'rgba(255,255,255,0.8)';
    ctx2.fillText('防犯カメラ作動中', w / 2, 200);
  });
  const stickerMat = new THREE.MeshBasicMaterial({ map: stickerTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const sticker = plane(0.6, 0.3, stickerMat, {
    x: 0.24,
    y: 2.18,
    z: S.maxZ - 0.094,
    cast: false,
    receive: false,
    parent: g,
  });
  sticker.userData.noOutline = true;

  // 雨棚前沿的招牌带
  const bandTex = canvasTexture(1024, 128, (ctx2, w, h) => {
    const grd = ctx2.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#f8f1dc');
    grd.addColorStop(1, '#efe3c8');
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, w, h);
    ctx2.fillStyle = '#3fa8a0';
    ctx2.fillRect(0, 0, w, 14);
    ctx2.fillStyle = '#20304f';
    ctx2.font = `700 62px ${EN_FONT}`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.letterSpacing = '12px';
    ctx2.fillText('TSUKIMI MART · 24H', w / 2, h / 2 + 4);
    ctx2.letterSpacing = '0px';
  });
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex, fog: false });
  bandMat.color.setScalar(1.18);
  const band = plane(cw - 0.08, 0.16, bandMat, {
    x: ccx,
    y: S.canopy.y - 0.075,
    z: S.canopy.z1 + 0.012,
    cast: false,
    receive: false,
    parent: g,
  });
  band.userData.noOutline = true;
  handles.flickerMats = handles.flickerMats || [];
  handles.flickerMats.push({ mat: bandMat, base: 1.18 });

  // 门口暖光溢出的小光晕
  const doorGlow = glowSprite('#ffc27a', 2.2, 0.08);
  doorGlow.position.set((S.doorX0 + S.doorX1) / 2, 1.15, S.maxZ + 0.55);
  g.add(doorGlow);

  /* ---------------- handles & 光晕 ---------------- */

  handles.flickerMats = handles.flickerMats || [];
  handles.flickerMats.push(
    { mat: signMat, base: 1.12 },
    { mat: pylonMat, base: 1.15 },
    { mat: ledMat, base: 1.8 },
  );

  // 滴水点：雨棚外缘
  handles.dripPoints = handles.dripPoints || [];
  for (const x of [-1.15, -0.6, -0.05, 0.5, 1.05, 1.6]) {
    handles.dripPoints.push(new THREE.Vector3(x, S.canopy.y - 0.06, S.canopy.z1 - 0.02));
  }
  // 招牌下沿
  handles.dripPoints.push(new THREE.Vector3(-2.2, S.sign.y0 - 0.05, S.sign.z + 0.16));
  handles.dripPoints.push(new THREE.Vector3(0.9, S.sign.y0 - 0.05, S.sign.z + 0.16));
  // 屋顶前檐
  handles.dripPoints.push(new THREE.Vector3(-1.8, S.wallTopY + 0.18, S.maxZ + 0.12));
  handles.dripPoints.push(new THREE.Vector3(1.2, S.wallTopY + 0.18, S.maxZ + 0.12));

  // 柔和光晕
  const glowA = glowSprite('#ffd9a0', 5.2, 0.12);
  glowA.position.set(signBoxX, signY, S.sign.z + 0.7);
  g.add(glowA);
  const glowB = glowSprite('#ffc987', 3.0, 0.09);
  glowB.position.set(0, 2.25, 1.7);
  g.add(glowB);
  const glowC = glowSprite('#ffd9a0', 3.0, 0.1);
  glowC.position.set(L.pylon.x, 3.1, L.pylon.z + 0.4);
  g.add(glowC);
  const glowD = glowSprite('#ffb066', 1.8, 0.16);
  glowD.position.set(0.86, L.lot.top + 2.3, S.minZ - 0.2);
  g.add(glowD);

  // 阴影/描边
  shadow(g, true, true);
  g.traverse((obj) => {
    if (obj.userData.isGlass || obj.isSprite) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  addOutline(g, { width: 0.0011, color: '#080b14' });

  return {
    group: g,
    update(t) {
      glass.uniforms.uTime.value = t;
    },
  };
}
