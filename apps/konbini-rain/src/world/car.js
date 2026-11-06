/**
 * world/car.js —— 停在便利店对面路边的轻卡（日本「軽トラ」）。
 *
 * 用途：给构图右侧的停车位一点「有人来过」的故事感；尾灯的红色和车身的
 * 冷白色在湿路面上会形成很漂亮的倒影，也是画面里唯一一辆车。
 * 全部 toon 材质，没有新增真实点光源（用自发光 + glowSprite）。
 */
import * as THREE from 'three';
import { C, L, rng } from '../config.js';
import { canvasTexture } from '../lib/textures.js';
import { toon, flat, glow, addOutline, glowSprite } from '../lib/toon.js';
import { box, roundedBox, plane, mesh, group, cyl, sphere, torus, shadow } from '../lib/kit.js';

function plateTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f2e8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7a7f6a';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#26302a';
    ctx.font = 'bold 46px "Hiragino Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('月見 580', w / 2, h / 2 - 6);
    ctx.font = 'bold 30px "Hiragino Sans", sans-serif';
    ctx.fillText('あ 24-06', w / 2, h / 2 + 38);
  });
}

export function buildCar(ctx) {
  const g = group('kei-truck');
  // 停在右侧路边车位里、车尾朝向镜头（+Z）
  g.position.set(4.12, 0, -3.25);
  g.rotation.y = 0.03;

  const body = toon('#e9e4d6', { rim: 0.22, rimColor: '#9fc8f0', gradient: 'soft' });
  const bodyDark = toon('#cfc9b8', { rim: 0.16, rimColor: '#9fc8f0', gradient: 'soft' });
  const trim = toon('#4a4f58', { rim: 0.12, rimColor: '#8fb0d4' });
  const glass = new THREE.MeshBasicMaterial({
    color: '#16283a',
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const tire = toon('#1b1e24', { rim: 0.14, rimColor: '#546a82', gradient: 'soft' });
  const hub = toon('#b8bcc4', { rim: 0.3, rimColor: '#f2faff', gradient: 'soft' });

  // 底盘
  box(1.36, 0.22, 3.1, trim, { y: 0.42, parent: g });
  // 货斗（后半）
  box(1.4, 0.5, 1.75, body, { y: 0.86, z: 0.62, parent: g });
  // 货斗围板
  box(1.42, 0.3, 0.06, bodyDark, { y: 1.18, z: 1.48, parent: g });
  box(0.06, 0.3, 1.7, bodyDark, { x: -0.69, y: 1.18, z: 0.62, parent: g });
  box(0.06, 0.3, 1.7, bodyDark, { x: 0.69, y: 1.18, z: 0.62, parent: g });
  // 车斗底板
  box(1.3, 0.04, 1.6, toon('#6d6255', { rim: 0.1 }), { y: 1.13, z: 0.6, parent: g, cast: false });
  // 驾驶室
  box(1.36, 1.12, 1.05, body, { y: 1.0, z: -0.68, parent: g });
  // 驾驶室圆角顶
  box(1.3, 0.1, 0.95, body, { y: 1.6, z: -0.68, parent: g });
  // 前挡风/侧窗
  plane(1.16, 0.52, glass, { y: 1.3, z: -1.215, cast: false, receive: false, parent: g });
  for (const sx of [-1, 1]) {
    plane(0.76, 0.48, glass, {
      x: sx * 0.686,
      y: 1.28,
      z: -0.65,
      ry: (sx * Math.PI) / 2,
      cast: false,
      receive: false,
      parent: g,
    });
  }
  // 车门线
  box(0.015, 0.6, 0.02, trim, { x: -0.687, y: 0.95, z: -0.62, parent: g, cast: false });
  box(0.015, 0.6, 0.02, trim, { x: 0.687, y: 0.95, z: -0.62, parent: g, cast: false });
  // 前保险杠、后保险杠
  box(1.38, 0.2, 0.12, trim, { y: 0.5, z: -1.28, parent: g });
  box(1.42, 0.18, 0.1, trim, { y: 0.48, z: 1.56, parent: g });
  // 前大灯 / 尾灯
  for (const sx of [-1, 1]) {
    const head = box(0.26, 0.13, 0.04, flat(new THREE.Color('#fff0cc').multiplyScalar(1.15)), {
      x: sx * 0.46,
      y: 0.8,
      z: -1.32,
      parent: g,
      cast: false,
    });
    head.userData.noOutline = true;
    // 尾灯（红色自发光，湿路面会反射出一小条红光）
    const tail = box(0.24, 0.16, 0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2f38').multiplyScalar(1.9) }), {
      x: sx * 0.45,
      y: 0.78,
      z: 1.585,
      parent: g,
      cast: false,
    });
    tail.userData.noOutline = true;
    const sp = glowSprite('#ff3a44', 0.55, 0.35);
    sp.position.set(sx * 0.45, 0.78, 1.65);
    g.add(sp);
  }
  // 车牌
  plane(0.34, 0.17, new THREE.MeshBasicMaterial({ map: plateTexture(), fog: true }), {
    y: 0.56,
    z: 1.615,
    cast: false,
    receive: false,
    parent: g,
  });
  // 后视镜
  for (const sx of [-1, 1]) {
    box(0.04, 0.04, 0.2, trim, { x: sx * 0.72, y: 1.34, z: -1.14, parent: g, cast: false });
    box(0.12, 0.16, 0.06, bodyDark, { x: sx * 0.8, y: 1.35, z: -1.2, parent: g, cast: false });
  }
  // 车轮
  for (const [x, z] of [
    [-0.62, -0.9],
    [0.62, -0.9],
    [-0.62, 0.98],
    [0.62, 0.98],
  ]) {
    torus(0.24, 0.09, 8, 14, tire, { x, y: 0.34, z, rx: 0, ry: Math.PI / 2, parent: g, cast: true });
    cyl(0.11, 0.11, 0.1, 12, hub, { x, y: 0.34, z, rz: Math.PI / 2, parent: g, cast: false });
    // 挡泥板
    box(0.16, 0.06, 0.42, bodyDark, { x: x * 1.06, y: 0.58, z: z + 0.02, parent: g, cast: false });
  }
  // 排气管
  cyl(0.035, 0.035, 0.22, 8, trim, { x: 0.5, y: 0.28, z: 1.5, rx: Math.PI / 2, parent: g, cast: false });
  // 车斗里一个纸箱（细节）
  box(0.32, 0.24, 0.3, toon('#c9a878', { rim: 0.1 }), { x: -0.25, y: 1.3, z: 0.7, parent: g, cast: false });
  box(0.28, 0.2, 0.26, toon('#b8946a', { rim: 0.1 }), { x: 0.15, y: 1.28, z: 1.0, parent: g, cast: false });

  shadow(g, true, true);
  addOutline(g, { width: 0.0011, color: '#080b14' });

  // 车顶挡风玻璃反光（一条淡淡的暖色）
  const streak = plane(1.05, 0.1, new THREE.MeshBasicMaterial({
    color: '#ffd9a0',
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), {
    y: 1.52,
    z: -1.23,
    rx: 0.05,
    cast: false,
    receive: false,
    parent: g,
  });
  streak.userData.noOutline = true;

  ctx.root.add(g);
  return { group: g };
}
