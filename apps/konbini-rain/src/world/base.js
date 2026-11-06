/**
 * world/base.js —— 收藏模型底座：深色胡桃木 + 铜牌 + 黄铜包边。
 * 底座尺寸跟随整条商店街（约 35 × 15），地面层由 ground.js 绘制。
 */
import * as THREE from 'three';
import { C, E } from '../config.js';
import { BASE_TEX, canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import { toon, addOutline } from '../lib/toon.js';
import { roundedBox, box, plane, group, mesh, cyl } from '../lib/kit.js';

function streetPlateTexture() {
  return canvasTexture(2048, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d9b570');
    g.addColorStop(0.35, '#c49a55');
    g.addColorStop(0.55, '#e0c084');
    g.addColorStop(1, '#9c7639');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 拉丝
    for (let i = 0; i < 120; i += 1) {
      ctx.strokeStyle = `rgba(255,240,200,${0.03 + (i % 6) * 0.012})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, (i * 37) % h);
      ctx.lineTo(w, (i * 37) % h);
      ctx.stroke();
    }

    // 刻字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,246,214,0.55)';
    ctx.font = `700 118px ${JP_FONT}`;
    ctx.fillText('雨夜の小さな町', w / 2 + 3, 124);
    ctx.fillStyle = 'rgba(58,38,16,0.92)';
    ctx.fillText('雨夜の小さな町', w / 2, 121);

    ctx.fillStyle = 'rgba(58,38,16,0.78)';
    ctx.font = `600 36px ${EN_FONT}`;
    ctx.letterSpacing = '12px';
    ctx.fillText('RAINY LITTLE TOWN  ·  TSUKIMI', w / 2, 232);
    ctx.letterSpacing = '0px';

    const screw = (x, y) => {
      const rg = ctx.createRadialGradient(x - 5, y - 5, 1, x, y, 16);
      rg.addColorStop(0, '#f0d8a0');
      rg.addColorStop(1, '#8a6630');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,16,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.stroke();
    };
    screw(44, 38);
    screw(w - 44, 38);
    screw(44, h - 38);
    screw(w - 44, h - 38);
  });
}

export function buildBase(ctx) {
  const g = group('base');
  const { minX, maxX, minZ, maxZ } = E.bounds;
  const width = maxX - minX; // 35
  const depth = maxZ - minZ; // 15
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const plinthHalfW = width / 2 + 0.32;
  const plinthHalfD = depth / 2 + 0.32;

  // 胡桃木底座
  const woodMat = toon('#c9b8a8', { map: BASE_TEX.wood(), rim: 0.06, rimColor: '#b98a55', gradient: 'soft' });
  const plinth = roundedBox(
    width + 0.64,
    0.85,
    depth + 0.64,
    0.1,
    woodMat,
    { x: centerX, y: -0.525, z: centerZ, cast: true, receive: true, parent: g, seg: 3 },
  );
  plinth.name = 'plinth';

  // 底座下面的深色绒垫
  const felt = box(
    width + 0.2,
    0.05,
    depth + 0.2,
    toon('#0b0908', { rim: 0 }),
    { x: centerX, y: -0.975, z: centerZ, cast: false, receive: false, parent: g },
  );
  felt.name = 'felt';

  // 地面层的侧壁（沥青断面），顶部由 ground.js 覆盖
  const slabMat = toon('#20242c', { rim: 0.1, rimColor: '#4a5b74' });
  box(width, 0.1, depth, slabMat, { x: centerX, y: -0.05, z: centerZ, cast: true, receive: true, parent: g }).name = 'ground-slab';

  // 黄铜包边（底座顶面四周）
  const brass = toon(C.brass, { rim: 0.35, rimColor: '#ffe1a8', emissive: '#3a2a10', emissiveIntensity: 0.35, gradient: 'soft' });
  const strip = 0.035;
  const y = -0.093;
  box(width + 0.24, 0.02, strip, brass, { x: centerX, y, z: minZ - 0.1, parent: g, cast: false });
  box(width + 0.24, 0.02, strip, brass, { x: centerX, y, z: maxZ + 0.1, parent: g, cast: false });
  box(strip, 0.02, depth + 0.1, brass, { y, x: minX - 0.1, z: centerZ, parent: g, cast: false });
  box(strip, 0.02, depth + 0.1, brass, { y, x: maxX + 0.1, z: centerZ, parent: g, cast: false });

  // 正面的铜铭牌
  const plateMat = toon('#ffffff', {
    map: streetPlateTexture(),
    rim: 0.2,
    rimColor: '#ffe6b0',
    emissive: '#2a1c08',
    emissiveIntensity: 0.5,
    gradient: 'soft',
  });
  const plateW = 5.6;
  const plateZ = maxZ + 0.322;
  const plate = plane(plateW, 0.66, plateMat, {
    x: centerX,
    y: -0.5,
    z: plateZ,
    cast: false,
    receive: false,
    parent: g,
  });
  plate.name = 'nameplate';
  // 铭牌外框
  box(plateW + 0.12, 0.78, 0.03, toon(C.brassDark, { rim: 0.3, rimColor: '#ffd898', gradient: 'soft' }), {
    x: centerX,
    y: -0.5,
    z: plateZ - 0.014,
    cast: false,
    parent: g,
  });
  // 四颗小螺丝
  for (const sx of [centerX - plateW / 2 + 0.16, centerX + plateW / 2 - 0.16]) {
    for (const sy of [-0.72, -0.28]) {
      cyl(0.028, 0.028, 0.02, 8, toon('#d9b671', { rim: 0.4, rimColor: '#fff0c0' }), {
        y: sy,
        z: plateZ + 0.012,
        x: sx,
        rx: Math.PI / 2,
        parent: g,
        cast: false,
      });
    }
  }

  // 底座四角的黄铜包角
  const cornerMat = toon(C.brass, { rim: 0.3, rimColor: '#ffe3ac', gradient: 'soft' });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = centerX + sx * (plinthHalfW - 0.03);
      const cz = centerZ + sz * (plinthHalfD - 0.03);
      box(0.16, 0.98, 0.16, cornerMat, { x: cx, y: -0.52, z: cz, cast: false, parent: g });
      box(0.2, 0.14, 0.2, cornerMat, { x: cx, y: -0.06, z: cz, cast: false, parent: g });
    }
  }

  addOutline(g, { width: 0.0009, color: '#07080d' });

  // 底座在「地面以下」，不参与湿路面的平面反射。
  g.traverse((obj) => {
    if (obj.isMesh) obj.layers.set(1);
  });

  return { group: g };
}
