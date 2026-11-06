/**
 * world/street.js —— 街道与街角结构：
 *   电线杆 / 电线 / 路灯 / 路牌 / 信号灯 / 护栏 / 旧楼 / 小巷（street-artist）。
 *
 * 这一块负责「街角的转折与纵深」：
 *   - 3 根混凝土电线杆撑起画面上方的电线剪影；
 *   - 主杆路灯 + 街名牌 + 止まれ + 禁停牌 + 转角镜；
 *   - 远处路口的信号灯（很慢、克制的红绿呼吸）；
 *   - 路缘白色护栏 + 邮筒 + 停车牌；
 *   - 左侧旧楼（卷帘门 / 旧瓷砖 / 二楼暖光窗 / 粉色「スナック」霓虹）与湿漉漉的小巷。
 *
 * 约定：只用 toon/flat/lightbox/glow + addOutline；不新增真实 PointLight。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, L, rng } from '../config.js';
import { toon, flat, lightbox, glow, glowSprite, addOutline, glowTexture } from '../lib/toon.js';
import { canvasTexture, JP_FONT, EN_FONT } from '../lib/textures.js';
import {
  box, roundedBox, plane, mesh, group, cyl, sphere, torus, tube, catenary,
  instanced, trs, circleGeo, planeGeo, boxGeo, cylGeo, DEG,
} from '../lib/kit.js';

const Y = L.lot.top; // 地块顶面 0.12

/* ========================================================================== */
/*  程序化贴图                                                                 */
/* ========================================================================== */

const TEXCACHE = new Map();
function tex(key, factory) {
  if (!TEXCACHE.has(key)) TEXCACHE.set(key, factory());
  return TEXCACHE.get(key);
}

/** 旧楼瓷砖（脏、旧、偶有青苔） */
function oldTileTexture(rx, ry) {
  return tex(`oldTile:${rx}:${ry}`, () => {
    const t = canvasTexture(512, 512, (ctx, w, h) => {
      const rand = rng(211);
      ctx.fillStyle = '#35322b';
      ctx.fillRect(0, 0, w, h);
      const cols = 8;
      const rows = 10;
      const tw = w / cols;
      const th = h / rows;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const n = rand();
          let col;
          if (n < 0.12) col = [112, 104, 82];
          else if (n < 0.26) col = [88, 97, 86];
          else if (n < 0.4) col = [132, 124, 104];
          else col = [152 + Math.floor(rand() * 24), 144 + Math.floor(rand() * 22), 118 + Math.floor(rand() * 18)];
          ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          ctx.fillRect(c * tw + 2, r * th + 2, tw - 4, th - 4);
          ctx.fillStyle = 'rgba(255,246,220,0.07)';
          ctx.fillRect(c * tw + 2, r * th + 2, tw - 4, 2);
          if (rand() > 0.55) {
            ctx.fillStyle = `rgba(26,26,20,${0.05 + rand() * 0.14})`;
            ctx.fillRect(c * tw + 2, r * th + 2, tw - 4, (th - 4) * (0.3 + rand() * 0.7));
          }
          if (rand() > 0.86) {
            ctx.fillStyle = 'rgba(58,72,42,0.22)';
            ctx.fillRect(c * tw + 2, r * th + th - 8, tw - 4, 6);
          }
        }
      }
      // 大片水渍 / 霉斑
      for (let i = 0; i < 16; i += 1) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 26 + rand() * 110;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(18,20,16,${0.1 + rand() * 0.18})`);
        grd.addColorStop(1, 'rgba(18,20,16,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 垂直雨痕
      for (let i = 0; i < 30; i += 1) {
        ctx.fillStyle = `rgba(16,18,14,${0.03 + rand() * 0.08})`;
        ctx.fillRect(rand() * w, rand() * h * 0.6, 1.5 + rand() * 3, 80 + rand() * 380);
      }
    });
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  });
}

/** 旧楼底层的金属卷帘门（横向帘片 + 锈迹） */
function shutterTexture() {
  return tex('shutter', () =>
    canvasTexture(512, 1024, (ctx, w, h) => {
      const rand = rng(88);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#565b60');
      g.addColorStop(0.45, '#494e54');
      g.addColorStop(1, '#3b3f45');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const slats = 52;
      const sh = h / slats;
      for (let i = 0; i < slats; i += 1) {
        const y = i * sh;
        const gg = ctx.createLinearGradient(0, y, 0, y + sh);
        gg.addColorStop(0, 'rgba(16,18,22,0.6)');
        gg.addColorStop(0.3, 'rgba(206,216,226,0.11)');
        gg.addColorStop(0.72, 'rgba(120,130,140,0.05)');
        gg.addColorStop(1, 'rgba(10,12,16,0.55)');
        ctx.fillStyle = gg;
        ctx.fillRect(0, y, w, sh);
      }
      // 竖向脏痕 / 锈
      for (let i = 0; i < 46; i += 1) {
        const x = rand() * w;
        ctx.fillStyle = rand() > 0.68
          ? `rgba(124,76,42,${0.05 + rand() * 0.13})`
          : `rgba(12,14,18,${0.05 + rand() * 0.13})`;
        ctx.fillRect(x, rand() * h * 0.35, 2 + rand() * 8, 90 + rand() * 520);
      }
      // 底部横杠 + 锁
      ctx.fillStyle = '#2b2f34';
      ctx.fillRect(0, h - 40, w, 40);
      ctx.fillStyle = '#1b1e22';
      ctx.fillRect(w / 2 - 22, h - 84, 44, 18);
    }),
  );
}

/** 蓝底白字街名牌「月見町 二丁目」 */
function streetNameTexture() {
  return tex('streetName', () =>
    canvasTexture(1024, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b4a86');
      g.addColorStop(1, '#0d2d5a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#eef4fb';
      ctx.lineWidth = 12;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.fillStyle = '#f2f7ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 112px ${JP_FONT}`;
      ctx.fillText('月見町 二丁目', w / 2, h * 0.45);
      ctx.fillStyle = 'rgba(226,238,255,0.8)';
      ctx.font = `600 38px ${EN_FONT}`;
      ctx.letterSpacing = '7px';
      ctx.fillText('TSUKIMI-MACHI 2', w / 2, h * 0.79);
      ctx.letterSpacing = '0px';
      // 左右小箭头
      ctx.fillStyle = 'rgba(238,244,251,0.9)';
      ctx.beginPath();
      ctx.moveTo(52, h / 2);
      ctx.lineTo(86, h / 2 - 22);
      ctx.lineTo(86, h / 2 + 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w - 52, h / 2);
      ctx.lineTo(w - 86, h / 2 - 22);
      ctx.lineTo(w - 86, h / 2 + 22);
      ctx.closePath();
      ctx.fill();
    }),
  );
}

/** 红色倒三角「止まれ」（透明底，alphaTest 切出） */
function stopTexture() {
  return tex('stop', () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(64, 78);
      ctx.lineTo(448, 78);
      ctx.lineTo(256, 452);
      ctx.closePath();
      ctx.fillStyle = '#c8322b';
      ctx.fill();
      ctx.strokeStyle = '#f3f5f7';
      ctx.lineWidth = 24;
      ctx.stroke();
      ctx.fillStyle = '#f3f5f7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 62px ${JP_FONT}`;
      ctx.fillText('止まれ', 256, 262);
    }),
  );
}

/** 蓝底红圈红斜杠的「駐車禁止」圆牌 */
function noParkingTexture() {
  return tex('noParking', () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#eef3f8';
      ctx.beginPath();
      ctx.arc(256, 256, 248, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1f5aa8');
      g.addColorStop(1, '#123a70');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(256, 256, 236, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d63a33';
      ctx.lineWidth = 40;
      ctx.beginPath();
      ctx.arc(256, 256, 214, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#d63a33';
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(384, 384);
      ctx.stroke();
    }),
  );
}

/** 「駐車禁止」小辅助牌 */
function noParkingSubTexture() {
  return tex('noParkingSub', () =>
    canvasTexture(512, 160, (ctx, w, h) => {
      ctx.fillStyle = '#f2f5f8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1c3f74';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#1c3f74';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 86px ${JP_FONT}`;
      ctx.fillText('駐車禁止', w / 2, h / 2 + 2);
    }),
  );
}

/** 竖排粉色霓虹「スナック」 */
function snackSignTexture() {
  return tex('snack', () =>
    canvasTexture(512, 1536, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d0c16');
      g.addColorStop(0.5, '#110810');
      g.addColorStop(1, '#1e0b17');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 内嵌深色板
      ctx.fillStyle = '#160a11';
      ctx.fillRect(18, 18, w - 36, h - 36);
      // 霓虹描边
      ctx.shadowColor = '#ff4f93';
      ctx.shadowBlur = 40;
      ctx.strokeStyle = '#ff77ad';
      ctx.lineWidth = 10;
      ctx.strokeRect(26, 26, w - 52, h - 52);
      ctx.shadowBlur = 0;
      // 顶部小字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff4f93';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffb6d2';
      ctx.font = `600 54px ${JP_FONT}`;
      ctx.fillText('月見町', w / 2, 132);
      // 竖排 スナック
      ctx.font = `700 212px ${JP_FONT}`;
      const chars = 'スナック'.split('');
      chars.forEach((ch, i) => {
        const y = 372 + i * 244;
        ctx.shadowColor = '#ff2f80';
        ctx.shadowBlur = 64;
        ctx.fillStyle = '#ff5f9e';
        ctx.fillText(ch, w / 2, y);
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#ffd2e2';
        ctx.fillText(ch, w / 2, y);
      });
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff9cc4';
      ctx.font = `600 42px ${EN_FONT}`;
      ctx.letterSpacing = '12px';
      ctx.fillText('SNACK', w / 2, h - 182);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = '#ffd9a0';
      ctx.font = `600 40px ${JP_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('営業中', w / 2, h - 112);
    }),
  );
}

/** 旧楼二楼暖光窗：暖色室内光 + 窗帘剪影 */
function warmWindowTexture() {
  return tex('warmWindow', () =>
    canvasTexture(512, 384, (ctx, w, h) => {
      // 室内暖光
      const g = ctx.createRadialGradient(w * 0.56, h * 0.4, 18, w * 0.5, h * 0.5, w * 0.7);
      g.addColorStop(0, '#fff0c8');
      g.addColorStop(0.45, '#f6bd72');
      g.addColorStop(1, '#9c5a28');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 窗帘（左右两片，带褶皱）
      function curtain(side) {
        const edge = side === 'left' ? 158 : w - 158;
        ctx.beginPath();
        if (side === 'left') {
          ctx.moveTo(0, 0);
          ctx.lineTo(edge, 0);
        } else {
          ctx.moveTo(w, 0);
          ctx.lineTo(edge, 0);
        }
        for (let y = 0; y <= h; y += 16) {
          const x = edge + Math.sin(y * 0.045 + (side === 'left' ? 0 : 1.7)) * 18 + Math.sin(y * 0.013) * 10;
          ctx.lineTo(x, y);
        }
        if (side === 'left') {
          ctx.lineTo(0, h);
        } else {
          ctx.lineTo(w, h);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(112,58,26,0.62)';
        ctx.fill();
        // 褶皱高光
        ctx.strokeStyle = 'rgba(255,206,146,0.2)';
        ctx.lineWidth = 7;
        for (let k = 0; k < 3; k += 1) {
          const bx = side === 'left' ? 26 + k * 40 : w - 26 - k * 40;
          ctx.beginPath();
          ctx.moveTo(bx, 6);
          ctx.bezierCurveTo(bx + 12, h * 0.35, bx - 10, h * 0.7, bx + 6, h - 6);
          ctx.stroke();
        }
      }
      curtain('left');
      curtain('right');

      // 窗台上坐着的猫剪影（很安静的一笔）
      ctx.save();
      ctx.translate(196, h - 92);
      ctx.fillStyle = 'rgba(44,28,16,0.94)';
      ctx.strokeStyle = 'rgba(44,28,16,0.94)';
      // 身体
      ctx.beginPath();
      ctx.ellipse(0, 34, 30, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      // 头
      ctx.beginPath();
      ctx.arc(0, -4, 21, 0, Math.PI * 2);
      ctx.fill();
      // 耳朵
      ctx.beginPath();
      ctx.moveTo(-20, -16);
      ctx.lineTo(-11, -36);
      ctx.lineTo(-2, -18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(20, -16);
      ctx.lineTo(11, -36);
      ctx.lineTo(2, -18);
      ctx.closePath();
      ctx.fill();
      // 尾巴
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(24, 48);
      ctx.bezierCurveTo(54, 54, 60, 26, 44, 12);
      ctx.stroke();
      ctx.restore();

      // 窗框
      ctx.fillStyle = 'rgba(48,32,20,0.9)';
      ctx.fillRect(0, 0, w, 16);
      ctx.fillRect(0, h - 16, w, 16);
      ctx.fillRect(0, 0, 16, h);
      ctx.fillRect(w - 16, 0, 16, h);
      ctx.fillRect(w / 2 - 5, 0, 10, h);
      ctx.fillRect(0, h * 0.46 - 5, w, 10);
      // 窗台
      ctx.fillStyle = 'rgba(58,40,24,0.92)';
      ctx.fillRect(0, h - 30, w, 16);
    }),
  );
}

/** 旧楼水平旧招牌（褪色的「スナック月見」） */
function oldShopSignTexture() {
  return tex('oldShopSign', () =>
    canvasTexture(512, 128, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ded3b8');
      g.addColorStop(1, '#b8ab8e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70,58,40,0.85)';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = 'rgba(96,44,40,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 68px ${JP_FONT}`;
      ctx.fillText('スナック 月見', w / 2, h / 2 + 2);
      // 风化污渍
      const rand = rng(9);
      for (let i = 0; i < 28; i += 1) {
        ctx.fillStyle = `rgba(60,50,36,${0.05 + rand() * 0.1})`;
        ctx.fillRect(rand() * w, rand() * h, 4 + rand() * 26, 2 + rand() * 8);
      }
    }),
  );
}

/** 行人信号灯：红（站立）/ 绿（行走） */
function pedTexture(kind) {
  return tex(`ped:${kind}`, () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#080b0f';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#39434f';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      const col = kind === 'red' ? '#ff5a5a' : '#7dffc0';
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineCap = 'round';
      ctx.lineWidth = 22;
      if (kind === 'red') {
        ctx.beginPath();
        ctx.arc(128, 64, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(128, 94);
        ctx.lineTo(128, 158);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(128, 110);
        ctx.lineTo(92, 142);
        ctx.moveTo(128, 110);
        ctx.lineTo(164, 142);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(128, 158);
        ctx.lineTo(104, 204);
        ctx.moveTo(128, 158);
        ctx.lineTo(152, 204);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(134, 60, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(134, 88);
        ctx.lineTo(124, 148);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(130, 104);
        ctx.lineTo(172, 130);
        ctx.moveTo(128, 112);
        ctx.lineTo(90, 132);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(124, 148);
        ctx.lineTo(164, 198);
        ctx.moveTo(124, 148);
        ctx.lineTo(92, 204);
        ctx.stroke();
      }
    }),
  );
}

/** 停车 P 牌 */
function parkingTexture() {
  return tex('parking', () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1f5aa8');
      g.addColorStop(1, '#123a70');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#eef4fb';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#f2f7ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 170px ${EN_FONT}`;
      ctx.fillText('P', w / 2, 116);
      ctx.font = `600 42px ${JP_FONT}`;
      ctx.fillText('駐車場', w / 2, 212);
    }),
  );
}

/** 电柱番号小牌 */
function poleIdTexture() {
  return tex('poleId', () =>
    canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#eef0e8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#232830';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#232830';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 46px ${JP_FONT}`;
      ctx.fillText('月見町', w / 2, 52);
      ctx.font = `800 60px ${EN_FONT}`;
      ctx.fillText('12-3', w / 2, 116);
    }),
  );
}

/** 黄黑警示条纹（电线杆防撞条用） */
function warningStripeTexture() {
  return tex('warningStripe', () => {
    const t = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#e8bb2f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#26251f';
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      for (let i = -3; i <= 3; i += 2) {
        ctx.fillRect(-w, i * 22 - 11, w * 2, 22);
      }
      ctx.restore();
      // 磨损
      const rand = rng(41);
      for (let i = 0; i < 40; i += 1) {
        ctx.fillStyle = `rgba(30,28,22,${0.05 + rand() * 0.2})`;
        ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 12, 2 + rand() * 8);
      }
    });
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 1);
    return t;
  });
}

/** 小巷湿地面 */
function alleyFloorTexture() {
  return tex('alleyFloor', () =>
    canvasTexture(512, 1024, (ctx, w, h) => {
      const rand = rng(55);
      ctx.fillStyle = '#2f3237';
      ctx.fillRect(0, 0, w, h);
      // 混凝土斑驳
      for (let i = 0; i < 9000; i += 1) {
        const g = 30 + rand() * 40;
        ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},${0.1 + rand() * 0.3})`;
        ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
      }
      // 大面积湿痕
      for (let i = 0; i < 22; i += 1) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 30 + rand() * 150;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(9,13,20,${0.16 + rand() * 0.24})`);
        grd.addColorStop(1, 'rgba(9,13,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 排水沟一侧的深色湿带（贴近便利店墙）
      const gt = ctx.createLinearGradient(w * 0.72, 0, w, 0);
      gt.addColorStop(0, 'rgba(8,11,16,0)');
      gt.addColorStop(1, 'rgba(8,11,16,0.5)');
      ctx.fillStyle = gt;
      ctx.fillRect(w * 0.72, 0, w * 0.28, h);
      // 细裂纹
      ctx.strokeStyle = 'rgba(12,14,18,0.4)';
      for (let i = 0; i < 26; i += 1) {
        let x = rand() * w;
        let y = rand() * h;
        ctx.lineWidth = 0.8 + rand() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k += 1) {
          x += (rand() - 0.5) * 60;
          y += (rand() - 0.5) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 靠墙的青苔
      ctx.fillStyle = 'rgba(46,66,42,0.18)';
      ctx.fillRect(0, 0, 18, h);
    }),
  );
}

/** 铁门上的「立入禁止」牌 */
function gateSignTexture() {
  return tex('gateSign', () =>
    canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e9e8e2';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8f3a34';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#2a2c30';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 62px ${JP_FONT}`;
      ctx.fillText('関係者以外', w / 2, 84);
      ctx.fillText('立入禁止', w / 2, 168);
    }),
  );
}

/** 邮筒白牌 〒 + 取集时间 */
function postPlateTexture() {
  return tex('postPlate', () =>
    canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#f1f0ea';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c2372f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 74px ${JP_FONT}`;
      ctx.fillText('〒', w / 2, 58);
      ctx.fillStyle = '#3a3d42';
      ctx.font = `600 26px ${JP_FONT}`;
      ctx.fillText('取集 平日 3 回', w / 2, 120);
    }),
  );
}

/** 转角镜面 */
function mirrorTexture() {
  return tex('mirror', () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.42, h * 0.36, 8, w / 2, h / 2, w * 0.55);
      g.addColorStop(0, '#dfe7f0');
      g.addColorStop(0.45, '#9fb4c8');
      g.addColorStop(1, '#48586c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      // 一条街灯的反光
      ctx.fillStyle = 'rgba(255,232,186,0.7)';
      ctx.beginPath();
      ctx.ellipse(w * 0.38, h * 0.4, 34, 12, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,180,220,0.5)';
      ctx.beginPath();
      ctx.ellipse(w * 0.62, h * 0.62, 26, 40, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
}

/** 墙上的雨渍 */
function dripStainTexture() {
  return tex('dripStain', () =>
    canvasTexture(64, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(12,16,12,0.55)');
      g.addColorStop(0.6, 'rgba(12,16,12,0.28)');
      g.addColorStop(1, 'rgba(12,16,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(w * 0.25, 0, w * 0.5, h);
      ctx.fillStyle = 'rgba(12,16,12,0.18)';
      ctx.fillRect(w * 0.1, 0, w * 0.2, h * 0.7);
    }),
  );
}

/* ========================================================================== */
/*  小工具                                                                     */
/* ========================================================================== */

function noOutline(obj) {
  obj.userData.skipOutline = true;
  return obj;
}

/** 直线圆管（给水管 / 灯臂 / 车架用；比 tube 省事） */
function pipe(a, b, r, material, parent, opts = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const m = cyl(r, r, len, opts.seg ?? 8, material, {
    parent,
    cast: opts.cast ?? true,
    receive: opts.receive ?? true,
  });
  m.position.copy(A).lerp(B, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** 贴在墙面 / 杆上的平面贴图件（不描边、不投影） */
function decal(w, h, material, opts = {}) {
  const m = plane(w, h, material, { cast: false, receive: false, ...opts });
  m.userData.skipOutline = true;
  return m;
}

/** 自发光平面 */
function litPlane(w, h, color, intensity, opts = {}) {
  return decal(w, h, glow(color, intensity), opts);
}

function addGlow(parent, color, size, opacity, x, y, z) {
  const sp = glowSprite(color, size, opacity);
  sp.position.set(x, y, z);
  parent.add(sp);
  return sp;
}

function lampSprite(color, size, opacity) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color).multiplyScalar(1.1),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return { sprite, material };
}

function smoothRamp(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ========================================================================== */
/*  电线杆                                                                     */
/* ========================================================================== */

const POLE_ANCHOR = {
  mainTop: 6.92,
  frontTop: 6.78,
  mainBack: 6.58,
  backTop: 6.44,
  mainTeleF: 5.89,
  frontTele: 5.72,
  mainTeleB: 5.64,
  backTele: 5.42,
};

/**
 * 一根混凝土电线杆。
 * @returns {{group: THREE.Group, anchors: object}}
 */
function buildUtilityPole(parent, M, cfg) {
  const g = group('utility-pole');
  g.position.set(cfg.x, 0, cfg.z);
  const rand = rng(cfg.seed);
  const h = cfg.h;

  // 杆身（锥形混凝土）
  cyl(0.105, 0.17, h, 14, M.concrete, { y: h / 2, parent: g });
  // 浇筑接缝
  for (let i = 1; i <= 3; i += 1) {
    const y = h * (0.24 + i * 0.19);
    cyl(0.128 - i * 0.005, 0.13 - i * 0.005, 0.03, 14, M.concreteDark, { y, parent: g, cast: false });
  }
  // 根部保护 + 黄黑防撞条
  cyl(0.2, 0.225, 0.16, 14, M.concreteDark, { y: 0.08, parent: g });
  cyl(0.185, 0.196, 0.92, 14, M.warningStripe, { y: 0.72, parent: g });
  // 杆身黄牌「感電注意」+ 杆号牌（主杆上牌子已够多，省掉）
  if (!cfg.main) {
    decal(0.2, 0.26, M.warnPlate, { x: 0, y: 1.78, z: 0.168, parent: g });
    decal(0.18, 0.113, M.poleId, { x: 0.02, y: 1.42, z: 0.17, parent: g });
  }

  // 爬梯踏钉
  const stepMats = [];
  for (let i = 0; i < 12; i += 1) {
    const y = 1.35 + i * 0.4;
    stepMats.push(trs(0, y, 0.2, Math.PI / 2, 0, 0));
  }
  instanced(cylGeo(0.017, 0.017, 0.3, 6), M.metalDark, stepMats, { parent: g, cast: true });

  // 横担 + 绝缘子
  const insulatorMats = [];
  for (const arm of cfg.arms) {
    const len = arm.len;
    if (arm.axis === 'z') {
      box(0.07, 0.08, len, M.metalDark, { y: arm.y, parent: g });
      // 斜撑
      box(0.04, 0.04, len * 0.32, M.metalDark, {
        y: arm.y - 0.22,
        z: len * 0.24,
        rx: -38 * DEG,
        parent: g,
      });
      box(0.04, 0.04, len * 0.32, M.metalDark, {
        y: arm.y - 0.22,
        z: -len * 0.24,
        rx: 38 * DEG,
        parent: g,
      });
      for (const o of arm.ins || []) insulatorMats.push(trs(0, arm.y + 0.09, o));
    } else {
      box(len, 0.08, 0.07, M.metalDark, { y: arm.y, parent: g });
      for (const o of arm.ins || []) insulatorMats.push(trs(o, arm.y + 0.09, 0));
    }
    // 电信小托架
    for (const o of arm.tele || []) {
      if (arm.axis === 'z') {
        box(0.05, 0.05, 0.16, M.metalDark, { y: arm.y, z: o, parent: g });
        cyl(0.02, 0.02, 0.1, 6, M.metalDark, { y: arm.y + 0.07, z: o, parent: g });
        insulatorMats.push(trs(0, arm.y + 0.07, o));
      } else {
        box(0.16, 0.05, 0.05, M.metalDark, { y: arm.y, x: o, parent: g });
        cyl(0.02, 0.02, 0.1, 6, M.metalDark, { y: arm.y + 0.07, x: o, parent: g });
        insulatorMats.push(trs(o, arm.y + 0.07, 0));
      }
    }
  }
  if (insulatorMats.length) {
    instanced(cylGeo(0.03, 0.038, 0.1, 8), M.ceramic, insulatorMats, { parent: g, cast: true });
  }

  // 变压器（主杆）
  if (cfg.main) {
    const tg = group('transformer');
    tg.position.set(-0.33, 5.35, 0.02);
    cyl(0.26, 0.26, 0.78, 14, M.transformer, { parent: tg });
    cyl(0.275, 0.275, 0.06, 14, M.metalDark, { y: 0.4, parent: tg });
    cyl(0.275, 0.275, 0.06, 14, M.metalDark, { y: -0.4, parent: tg });
    // 顶部套管
    for (const o of [-0.11, 0, 0.11]) {
      cyl(0.028, 0.04, 0.14, 8, M.ceramic, { x: o, y: 0.48, parent: tg });
    }
    // 支架
    box(0.34, 0.06, 0.34, M.metalDark, { y: -0.52, parent: tg });
    box(0.4, 0.06, 0.12, M.metalDark, { y: 0.12, x: 0.28, parent: tg });
    g.add(tg);
    // 变压器警示牌
    decal(0.16, 0.1, M.warnPlate, { x: -0.34, y: 5.0, z: 0.27, parent: g });
  }

  // 顶部封帽
  cyl(0.1, 0.11, 0.12, 12, M.concreteDark, { y: h + 0.05, parent: g });

  addOutline(g, { width: 0.0011, color: '#080b14' });
  parent.add(g);
  return { group: g, rand };
}

/* ========================================================================== */
/*  电线                                                                       */
/* ========================================================================== */

function buildWires(parent, M, wireState) {
  const wg = group('wires');
  wg.userData.noOutline = true;

  /** 拉一根弧垂电缆，返回可摆动的小组 */
  function wire(a, b, sag, radius, material, axis, phase) {
    const pts = catenary(a, b, sag);
    const mid = new THREE.Vector3();
    for (const p of pts) mid.add(p);
    mid.multiplyScalar(1 / pts.length);
    const local = pts.map((p) => p.clone().sub(mid));
    const m = tube(local, radius, material, { segments: 22, radialSegments: 4, cast: false, receive: false });
    m.position.copy(mid);
    m.userData.noOutline = true;
    wg.add(m);
    wireState.push({
      mesh: m,
      axis,
      phase,
      amp: 0.0075 + (phase % 1) * 0.004,
      freq: 0.2 + (phase % 0.7) * 0.2,
    });
  }

  const main = { x: L.poleMain.x, z: L.poleMain.z };
  const front = { x: L.poleFront.x, z: L.poleFront.z };
  const back = { x: L.poleBack.x, z: L.poleBack.z };

  // 前侧跨街电线（沿 X），4 根相线
  const frontOffsets = [-0.44, -0.15, 0.15, 0.44];
  const frontSags = [0.72, 0.84, 0.66, 0.9];
  frontOffsets.forEach((o, i) => {
    wire(
      [front.x, POLE_ANCHOR.frontTop, front.z + o],
      [main.x, POLE_ANCHOR.mainTop, main.z + o],
      frontSags[i],
      0.024,
      M.wire,
      'x',
      i * 0.83,
    );
  });
  // 电信线（下垂更大）
  wire(
    [front.x, POLE_ANCHOR.frontTele, front.z - 0.18],
    [main.x, POLE_ANCHOR.mainTeleF, main.z - 0.2],
    1.05,
    0.031,
    M.wire,
    'x',
    2.1,
  );
  wire(
    [front.x, POLE_ANCHOR.frontTele, front.z + 0.16],
    [main.x, POLE_ANCHOR.mainTeleF, main.z + 0.18],
    1.16,
    0.031,
    M.wire,
    'x',
    3.4,
  );

  // 后方沿街电线（沿 Z），3 根相线
  const backOffsets = [-0.34, 0, 0.34];
  const backSags = [0.82, 0.94, 0.74];
  backOffsets.forEach((o, i) => {
    wire(
      [main.x + o, POLE_ANCHOR.mainBack, main.z],
      [back.x + o, POLE_ANCHOR.backTop, back.z],
      backSags[i],
      0.024,
      M.wire,
      'z',
      i * 1.17 + 0.4,
    );
  });
  wire(
    [main.x - 0.13, POLE_ANCHOR.mainTeleB, main.z],
    [back.x - 0.13, POLE_ANCHOR.backTele, back.z],
    1.02,
    0.031,
    M.wire,
    'z',
    4.2,
  );
  wire(
    [main.x + 0.12, POLE_ANCHOR.mainTeleB, main.z],
    [back.x + 0.12, POLE_ANCHOR.backTele, back.z],
    1.12,
    0.031,
    M.wire,
    'z',
    5.1,
  );

  // 入户线：主杆 → 便利店屋顶
  wire([main.x, 5.6, main.z], [1.2, 3.98, -1.1], 0.34, 0.02, M.wire, 'x', 0.9);
  wire([main.x + 0.1, 5.52, main.z + 0.04], [0.9, 3.99, -1.35], 0.38, 0.018, M.wire, 'x', 1.7);
  // 入户线：前杆 → 旧楼前立面墙上的接线盒
  wire([front.x, 5.95, front.z], [-4.95, 5.16, 1.06], 0.22, 0.02, M.wire, 'x', 2.6);

  // 杆上的盘线（细节）
  for (const p of [main, front]) {
    const coil = torus(0.13, 0.012, 5, 14, M.wire, {
      x: p.x + 0.02,
      y: 4.7,
      z: p.z + 0.17,
      rx: 90 * DEG,
      parent: wg,
      cast: false,
      receive: false,
    });
    coil.userData.noOutline = true;
    coil.userData.skipOutline = true;
    const coil2 = torus(0.1, 0.011, 5, 12, M.wire, {
      x: p.x + 0.06,
      y: 4.42,
      z: p.z + 0.16,
      rx: 90 * DEG,
      parent: wg,
      cast: false,
      receive: false,
    });
    coil2.userData.skipOutline = true;
  }

  parent.add(wg);
}

/* ========================================================================== */
/*  主杆路灯                                                                   */
/* ========================================================================== */

function buildStreetLamp(parent, M) {
  const g = group('street-lamp');
  const head = new THREE.Vector3(4.15, 5.5, 4.0);
  // 灯臂：从主杆弯向路口
  const armPts = [
    [3.02, 5.32, 2.74],
    [3.3, 5.68, 3.05],
    [3.72, 5.78, 3.55],
    [4.02, 5.66, 3.88],
    [4.15, 5.56, 4.0],
  ];
  tube(armPts, 0.034, toon('#5f656b', { rim: 0.22, rimColor: '#8fa8c8', gradient: 'soft' }), {
    segments: 26,
    radialSegments: 6,
    parent: g,
  });
  // 根部卡箍
  cyl(0.19, 0.19, 0.12, 12, M.metalDark, { x: 3.02, y: 5.3, z: 2.74, parent: g });

  // 灯头（扁圆盒 + 发光底面）
  const hg = group('lamp-head');
  hg.position.copy(head);
  hg.rotation.y = 0.73;
  roundedBox(0.58, 0.15, 0.34, 0.05, M.metalDark, { parent: hg });
  box(0.62, 0.04, 0.38, M.metal, { y: 0.09, parent: hg });
  // 发光面（朝下）
  const face = litPlane(0.46, 0.24, '#fff0cf', 1.55, {
    rx: Math.PI / 2,
    y: -0.08,
    parent: hg,
  });
  face.name = 'lamp-face';
  // 灯罩小格栅
  for (let i = -1; i <= 1; i += 1) {
    box(0.02, 0.03, 0.24, M.metal, { x: i * 0.15, y: -0.095, z: 0, parent: hg, cast: false });
  }
  g.add(hg);

  // 暖色光晕
  addGlow(g, '#ffd9a0', 3.4, 0.17, head.x, head.y - 0.18, head.z);
  addGlow(g, '#ffe7bb', 1.5, 0.22, head.x, head.y - 0.1, head.z);

  // 灯下的暖光池（湿地面反光）
  const pool = decal(2.6, 2.6, new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffcf94').multiplyScalar(0.5),
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), { x: head.x, y: 0.012, z: head.z, rx: -Math.PI / 2 });
  pool.renderOrder = 2;

  addOutline(g, { width: 0.001, color: '#080b14' });
  parent.add(g);
  return { group: g };
}

/* ========================================================================== */
/*  主杆上的路牌                                                               */
/* ========================================================================== */

function buildPoleSigns(parent, M) {
  const g = group('pole-signs');
  g.position.set(L.poleMain.x, 0, L.poleMain.z);

  // —— 蓝底白字街名牌（正面 + 侧面各一块） ——
  const nameTex = streetNameTexture();
  const nameMat = lightbox(nameTex, 0.92, { side: THREE.FrontSide });
  const backMat = toon('#39434f', { rim: 0.14, rimColor: '#8fb2d8' });
  const nameBoard = group('street-name');
  box(1.06, 0.32, 0.06, backMat, { parent: nameBoard });
  decal(1.0, 0.26, nameMat, { z: 0.033, parent: nameBoard });
  nameBoard.position.set(0, 3.12, 0.2);
  g.add(nameBoard);
  // 固定支架
  box(0.05, 0.05, 0.22, M.metalDark, { x: 0, y: 3.12, z: 0.09, parent: g });

  // —— 「止まれ」倒三角 ——
  const stopMat = lightbox(stopTexture(), 1.05, { alphaTest: 0.5, side: THREE.DoubleSide });
  decal(0.62, 0.62, stopMat, { x: 0.02, y: 2.32, z: 0.19, parent: g });
  // 三角牌背板 + 支架
  box(0.1, 0.62, 0.05, M.metalDark, { x: 0, y: 2.32, z: 0.155, parent: g, cast: false });

  addOutline(g, { width: 0.001, color: '#080b14' });
  parent.add(g);
  return { group: g };
}

/* ========================================================================== */
/*  转角凸面镜（挂在前杆上）                                                   */
/* ========================================================================== */

function buildCornerMirror(parent, M) {
  const g = group('corner-mirror');
  g.position.set(L.poleFront.x, 0, L.poleFront.z);
  const dir = new THREE.Vector3(0.58, 0, 0.81).normalize();
  // 支臂
  pipe([0, 3.62, 0], [dir.x * 0.42, 3.9, dir.z * 0.42], 0.024, M.metal, g, { seg: 6 });
  const mg = group('mirror');
  mg.position.set(dir.x * 0.46, 3.96, dir.z * 0.46);
  mg.rotation.y = Math.atan2(dir.x, dir.z);
  mg.rotation.x = -0.16;
  // 橙色圆框
  torus(0.215, 0.028, 8, 24, toon('#d97a2e', { rim: 0.32, rimColor: '#ffc27a' }), { parent: mg });
  // 镜面
  const disc = mesh(circleGeo(0.2, 24), lightbox(mirrorTexture(), 0.85), {
    z: 0.014,
    parent: mg,
    cast: false,
    receive: false,
  });
  noOutline(disc);
  // 背壳
  const shell = mesh(circleGeo(0.22, 24), M.metalDark, { z: -0.03, parent: mg, cast: false });
  shell.rotation.y = Math.PI;
  g.add(mg);

  // 禁停圆牌（挂在前杆上，斜对着街口）
  const np = group('no-parking');
  np.position.set(0, 2.28, 0.19);
  np.rotation.y = 0.22;
  box(0.07, 0.07, 0.14, M.metalDark, { z: -0.07, parent: np });
  const back = mesh(circleGeo(0.175, 26), toon('#4a5158', { rim: 0.1 }), { z: -0.012, parent: np, cast: false });
  back.rotation.y = Math.PI;
  const face = mesh(circleGeo(0.17, 26), lightbox(noParkingTexture(), 0.95), {
    z: 0.014,
    parent: np,
    cast: false,
    receive: false,
  });
  noOutline(face);
  g.add(np);

  addOutline(g, { width: 0.001, color: '#080b14' });
  parent.add(g);
}

/* ========================================================================== */
/*  远处路口信号灯                                                             */
/* ========================================================================== */

function buildTrafficLight(parent, M) {
  const g = group('traffic-light');
  g.position.set(L.trafficLight.x, 0, L.trafficLight.z);

  // 杆（矮一些、细一些：远处路口的小信号灯）
  const POLE_H = 4.16;
  cyl(0.058, 0.08, POLE_H, 12, M.metal, { y: 0.12 + POLE_H / 2, parent: g });
  cyl(0.125, 0.145, 0.18, 12, M.metalDark, { y: 0.21, parent: g });
  cyl(0.088, 0.098, 0.08, 12, M.metalDark, { y: 0.12 + POLE_H + 0.03, parent: g });

  /* ---------- 灯头 ---------- */
  const lamps = {
    green: { base: new THREE.Color(C.trafficGreen), mat: null, sprites: [], spriteMats: [] },
    amber: { base: new THREE.Color('#ffc95e'), mat: null, sprites: [], spriteMats: [] },
    red: { base: new THREE.Color(C.trafficRed), mat: null, sprites: [], spriteMats: [] },
  };
  lamps.green.mat = glow(C.trafficGreen, 0.1);
  lamps.amber.mat = glow('#ffc95e', 0.1);
  lamps.red.mat = glow(C.trafficRed, 0.1);

  function head({ x = 0, y = 0, z = 0, ry = 0, scale = 1, withSprites = true }) {
    const hg = group('signal-head');
    hg.position.set(x, y, z);
    hg.rotation.y = ry;
    // 灯箱
    roundedBox(0.98 * scale, 0.32 * scale, 0.24 * scale, 0.05, M.signalBox, { parent: hg });
    box(0.86 * scale, 0.04 * scale, 0.22 * scale, toon('#2c333b', { rim: 0.2, rimColor: '#8fb2d8' }), {
      y: 0.17 * scale,
      parent: hg,
      cast: false,
    });
    const xs = [-0.3, 0, 0.3];
    const keys = ['green', 'amber', 'red'];
    keys.forEach((k, i) => {
      const lx = xs[i] * scale;
      // 灯碗
      cyl(0.1 * scale, 0.105 * scale, 0.05 * scale, 14, M.metalDark, {
        x: lx,
        y: 0,
        z: 0.115 * scale,
        rx: Math.PI / 2,
        parent: hg,
        cast: false,
      });
      // 灯片
      const lens = mesh(circleGeo(0.092 * scale, 20), lamps[k].mat, {
        x: lx,
        y: 0,
        z: 0.145 * scale,
        parent: hg,
        cast: false,
        receive: false,
      });
      noOutline(lens);
      // 遮光檐
      box(0.24 * scale, 0.045 * scale, 0.17 * scale, M.signalBox, {
        x: lx,
        y: 0.105 * scale,
        z: 0.06 * scale,
        parent: hg,
        cast: false,
      });
      // 背侧小灯碗
      const back = mesh(circleGeo(0.085 * scale, 14), M.metalDark, {
        x: lx,
        y: 0,
        z: -0.122 * scale,
        parent: hg,
        cast: false,
      });
      back.rotation.y = Math.PI;
      if (withSprites) {
        const sp = lampSprite(k === 'green' ? C.trafficGreen : k === 'amber' ? '#ffc95e' : C.trafficRed, 0.95, 0);
        sp.sprite.position.set(lx, 0, 0.17 * scale);
        hg.add(sp.sprite);
        lamps[k].sprites.push(sp.sprite);
        lamps[k].spriteMats.push(sp.material);
      }
    });
    // 吊架
    box(0.05, 0.3, 0.05, M.metalDark, { y: 0.3 * scale, parent: hg });
    g.add(hg);
    return hg;
  }

  // 杆上、面向路口方向的车辆信号：远处看得到三灯的红绿呼吸
  const poleHead = head({ x: 0, y: 3.52, z: 0.11, ry: 0, scale: 0.86, withSprites: true });
  poleHead.name = 'vehicle-signal';
  box(0.05, 0.05, 0.18, M.metalDark, { y: 3.52, z: 0.04, parent: g });

  /* ---------- 行人信号灯 ---------- */
  const pedG = group('ped-signal');
  pedG.position.set(0, 2.2, 0.11);
  roundedBox(0.3, 0.62, 0.2, 0.035, M.signalBox, { parent: pedG });
  box(0.34, 0.05, 0.24, M.signalBox, { y: 0.34, parent: pedG });
  const pedRedMat = flat(pedTexture('red'));
  const pedGreenMat = flat(pedTexture('green'));
  pedRedMat.color.setScalar(0.06);
  pedGreenMat.color.setScalar(0.06);
  const pedRed = decal(0.22, 0.22, pedRedMat, { y: 0.145, z: 0.105, parent: pedG });
  const pedGreen = decal(0.22, 0.22, pedGreenMat, { y: -0.145, z: 0.105, parent: pedG });
  noOutline(pedRed);
  noOutline(pedGreen);
  addGlow(pedG, '#ff5a5a', 0.7, 0, 0, 0.145, 0.16);
  addGlow(pedG, '#7dffc0', 0.7, 0, 0, -0.145, 0.16);
  const pedGlowRed = pedG.children[pedG.children.length - 2];
  const pedGlowGreen = pedG.children[pedG.children.length - 1];
  g.add(pedG);

  // 按钮盒
  box(0.14, 0.2, 0.1, M.metalDark, { y: 1.06, z: 0.09, parent: g });
  const btn = mesh(circleGeo(0.03, 10), glow('#ffd166', 0.6), {
    y: 1.08,
    z: 0.145,
    parent: g,
    cast: false,
  });
  noOutline(btn);

  addOutline(g, { width: 0.001, color: '#080b14' });
  parent.add(g);

  return {
    group: g,
    lamps,
    pedRedMat,
    pedGreenMat,
    pedGlowRed,
    pedGlowGreen,
  };
}

/* ========================================================================== */
/*  白色金属护栏 + 反光条                                                      */
/* ========================================================================== */

function buildGuardrails(parent, M) {
  const g = group('guardrails');
  const railMat = M.whiteRail;
  const postMat = M.whiteRail;
  const reflectMats = [];

  // [x0, z0, x1, z1, tiltZ]（巷口 x -4.0..-2.9 前不设护栏，保持通透）
  const segments = [
    [-5.12, 2.93, -4.12, 2.93, 0],
    [3.12, 0.5, 3.12, 2.32, 0],
    [3.12, -4.86, 3.12, -4.5, 0.035],
  ];

  for (const [x0, z0, x1, z1, tilt] of segments) {
    const sg = group('guardrail-seg');
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    sg.position.set((x0 + x1) / 2, Y, (z0 + z1) / 2);
    sg.rotation.y = ang;
    sg.rotation.z = tilt;
    // 立柱
    const n = Math.max(2, Math.round(len / 1.02) + 1);
    for (let i = 0; i < n; i += 1) {
      const lz = -len / 2 + (len / (n - 1)) * i;
      const bent = i === n - 1 && tilt > 0.02;
      cyl(0.034, 0.04, 0.82, 10, postMat, {
        y: 0.41,
        z: lz,
        rz: bent ? 0.09 : 0,
        parent: sg,
      });
      sphere(0.04, postMat, { y: 0.83, z: lz, parent: sg });
      box(0.11, 0.03, 0.11, toon('#8e969e', { rim: 0.1 }), { y: 0.015, z: lz, parent: sg, cast: false });
    }
    // 双横杆
    for (const ry of [0.4, 0.72]) {
      const r = cyl(0.028, 0.028, len, 10, railMat, {
        y: ry,
        rx: Math.PI / 2,
        parent: sg,
        seg: 10,
      });
      r.castShadow = true;
    }
    // 反光条
    const strips = Math.max(1, Math.floor(len / 0.55));
    for (let i = 0; i < strips; i += 1) {
      const lz = -len / 2 + (len / (strips + 1)) * (i + 1);
      for (const ry of [0.4, 0.72]) {
        const wx = sg.position.x + Math.sin(ang) * lz;
        const wz = sg.position.z + Math.cos(ang) * lz;
        reflectMats.push({ x: wx, y: Y + ry, z: wz, ry: ang });
      }
    }
    addOutline(sg, { width: 0.001, color: '#0a0c12' });
    g.add(sg);
  }

  // 反光条（实例化）
  const reflMat = glow('#ffbe6a', 1.05);
  instanced(boxGeo(0.09, 0.05, 0.07), reflMat, reflectMats, {
    parent: g,
    cast: false,
    receive: false,
  });

  parent.add(g);
  return { group: g };
}

/* ========================================================================== */
/*  街角邮筒 / 停车牌                                                          */
/* ========================================================================== */

function buildPostbox(parent, M) {
  const g = group('postbox');
  g.position.set(-4.62, L.lot.top, 2.38); // 远侧人行道顶面，靠角但不挡斑马线

  const red = toon('#c2372f', { rim: 0.26, rimColor: '#ff9a7a', gradient: 'soft' });
  const redDark = toon('#9c2a24', { rim: 0.2, rimColor: '#ff8a6a' });

  // 底座（贴地）
  box(0.5, 0.06, 0.46, M.metalDark, { y: 0.03, parent: g });
  box(0.44, 0.1, 0.4, redDark, { y: 0.11, parent: g });
  // 桶身
  roundedBox(0.42, 0.82, 0.38, 0.07, red, { y: 0.57, parent: g });
  // 圆顶
  cyl(0.21, 0.21, 0.42, 16, red, { y: 0.98, rz: Math.PI / 2, parent: g });
  // 投信口
  box(0.26, 0.055, 0.05, toon('#2a2320', { rim: 0.1 }), { y: 0.85, z: 0.195, parent: g });
  // 白牌
  decal(0.26, 0.16, lightbox(postPlateTexture(), 0.5), { y: 0.62, z: 0.198, parent: g });

  addOutline(g, { width: 0.0011, color: '#080b14' });
  parent.add(g);
}

function buildParkingSign(parent, M) {
  const g = group('parking-sign');
  // 放在路边靠近停车位入口处（z>0），避免挡住贩卖机正面的商品窗
  g.position.set(3.13, 0, 0.28);
  cyl(0.032, 0.038, 2.36, 8, M.metal, { y: 1.18 + Y, parent: g });
  const boardMat = lightbox(parkingTexture(), 0.9, { side: THREE.DoubleSide });
  const board = decal(0.46, 0.46, boardMat, { y: 2.12 + Y, ry: Math.PI / 2, parent: g });
  // 牌框
  box(0.05, 0.5, 0.5, M.metalDark, { y: 2.12 + Y, x: -0.015, parent: g, cast: false });
  addOutline(g);
  parent.add(g);
}

/* ========================================================================== */
/*  左侧旧楼                                                                   */
/* ========================================================================== */

function buildOldBuilding(parent, M) {
  const g = group('old-building');
  const OB = L.neighbor;
  const cx = (OB.minX + OB.maxX) / 2;
  const cz = (OB.minZ + OB.maxZ) / 2;
  const w = OB.maxX - OB.minX;
  const d = OB.maxZ - OB.minZ;
  const h = OB.height;
  const topY = Y + h;
  const frontZ = OB.maxZ;

  // 主体
  box(w, h, d, M.oldWall, { x: cx, y: Y + h / 2, z: cz, parent: g });
  // 前立面旧瓷砖
  plane(w, h, M.oldTileFront, { x: cx, y: Y + h / 2, z: frontZ + 0.004, parent: g, cast: false, receive: true });
  // 小巷侧立面旧瓷砖
  plane(d, h, M.oldTileSide, {
    x: OB.maxX + 0.004,
    y: Y + h / 2,
    z: cz,
    ry: Math.PI / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  // 屋顶
  box(w + 0.06, 0.12, d + 0.06, M.oldRoof, { x: cx, y: topY + 0.06, z: cz, parent: g });
  // 女儿墙
  box(w + 0.08, 0.32, 0.1, M.oldWall2, { x: cx, y: topY + 0.22, z: frontZ - 0.03, parent: g });
  box(w + 0.08, 0.32, 0.1, M.oldWall2, { x: cx, y: topY + 0.22, z: OB.minZ + 0.03, parent: g });
  box(0.1, 0.32, d + 0.08, M.oldWall2, { x: OB.minX + 0.04, y: topY + 0.22, z: cz, parent: g });
  box(0.1, 0.32, d + 0.08, M.oldWall2, { x: OB.maxX - 0.04, y: topY + 0.22, z: cz, parent: g });

  /* ---------- 底层卷帘门 ---------- */
  const sx = -4.72;
  decal(1.1, 2.28, M.shutter, { x: sx, y: 0.14 + 1.14, z: frontZ + 0.012, parent: g });
  // 导轨
  box(0.055, 2.36, 0.07, M.metalDark, { x: sx - 0.58, y: 1.28, z: frontZ + 0.05, parent: g });
  box(0.055, 2.36, 0.07, M.metalDark, { x: sx + 0.58, y: 1.28, z: frontZ + 0.05, parent: g });
  // 卷帘盒
  box(1.28, 0.22, 0.17, M.metalDark, { x: sx, y: 2.53, z: frontZ + 0.08, parent: g });
  // 底杆 + 锁
  box(1.1, 0.055, 0.1, M.metalDark, { x: sx, y: 0.175, z: frontZ + 0.05, parent: g });
  box(0.1, 0.12, 0.06, M.metalDark, { x: sx, y: 0.27, z: frontZ + 0.08, parent: g });
  // 门槛
  box(1.18, 0.045, 0.2, M.concretePale, { x: sx, y: 0.142, z: frontZ + 0.12, parent: g });
  // 旧招牌（架在卷帘盒上方，右侧给霓虹灯牌留空）
  box(0.86, 0.22, 0.05, M.metalDark, { x: -4.9, y: 2.79, z: frontZ + 0.03, parent: g });
  decal(0.8, 0.17, M.oldShopSign, { x: -4.9, y: 2.79, z: frontZ + 0.058, parent: g });

  /* ---------- 二楼暖光窗 ---------- */
  const wx = -4.98;
  const wy = 4.3;
  const ww = 0.8;
  const wh = 0.6;
  box(ww + 0.12, wh + 0.12, 0.06, M.metalDark, { x: wx, y: wy, z: frontZ + 0.01, parent: g, cast: false });
  decal(ww, wh, lightbox(warmWindowTexture(), 1.12), { x: wx, y: wy, z: frontZ + 0.05, parent: g });
  // 窗框
  const frameCol = toon('#3d332a', { rim: 0.24, rimColor: '#c08a52' });
  box(ww + 0.08, 0.045, 0.07, frameCol, { x: wx, y: wy + wh / 2, z: frontZ + 0.055, parent: g });
  box(ww + 0.08, 0.045, 0.07, frameCol, { x: wx, y: wy - wh / 2, z: frontZ + 0.055, parent: g });
  box(0.045, wh + 0.08, 0.07, frameCol, { x: wx - ww / 2, y: wy, z: frontZ + 0.055, parent: g });
  box(0.045, wh + 0.08, 0.07, frameCol, { x: wx + ww / 2, y: wy, z: frontZ + 0.055, parent: g });
  // 窗台
  box(ww + 0.18, 0.05, 0.16, M.concretePale, { x: wx, y: wy - wh / 2 - 0.04, z: frontZ + 0.08, parent: g });
  addGlow(g, '#ffcf94', 1.7, 0.12, wx, wy, frontZ + 0.35);

  /* ---------- 粉色霓虹竖排「スナック」 ---------- */
  const nx = -4.24;
  const ny = 4.1;
  // 挂架
  box(0.05, 0.08, 0.16, M.metalDark, { x: nx, y: 3.05, z: frontZ + 0.06, parent: g });
  box(0.05, 0.08, 0.16, M.metalDark, { x: nx, y: 5.18, z: frontZ + 0.06, parent: g });
  // 灯箱体
  box(0.46, 2.44, 0.2, toon('#26101a', { rim: 0.2, rimColor: '#ff8ab0', gradient: 'soft' }), {
    x: nx,
    y: ny,
    z: frontZ + 0.17,
    parent: g,
  });
  // 上下盖
  box(0.5, 0.09, 0.24, M.metalDark, { x: nx, y: ny + 1.25, z: frontZ + 0.17, parent: g });
  box(0.5, 0.09, 0.24, M.metalDark, { x: nx, y: ny - 1.25, z: frontZ + 0.17, parent: g });
  // 霓虹面
  const snackMat = lightbox(snackSignTexture(), 1.45);
  decal(0.42, 2.36, snackMat, { x: nx, y: ny, z: frontZ + 0.272, parent: g });
  // 背面深色
  decal(0.42, 2.36, flat('#170a10'), { x: nx, y: ny, z: frontZ + 0.068, ry: Math.PI, parent: g });
  // 粉色光晕（画面左侧唯一粉色光源）
  const neonGlow = addGlow(g, '#ff6f9c', 3.0, 0.16, nx, ny, frontZ + 0.55);
  addGlow(g, '#ff6f9c', 1.4, 0.12, nx, ny - 0.9, frontZ + 0.45);

  /* ---------- 空调外机（小巷侧墙） ---------- */
  const acg = group('old-ac');
  acg.position.set(OB.maxX, 0, -0.9);
  box(0.26, 0.42, 0.72, M.acBody, { x: 0.14, y: 3.72, z: 0, parent: acg });
  // 风扇格栅（朝 +X）
  const grille = mesh(circleGeo(0.15, 20), M.metalDark, {
    x: 0.275,
    y: 3.72,
    z: 0,
    ry: Math.PI / 2,
    parent: acg,
    cast: false,
  });
  const grille2 = mesh(circleGeo(0.115, 16), toon('#2b3036', { rim: 0.1 }), {
    x: 0.279,
    y: 3.72,
    z: 0,
    ry: Math.PI / 2,
    parent: acg,
    cast: false,
  });
  noOutline(grille);
  noOutline(grille2);
  torus(0.15, 0.012, 4, 18, M.metal, { x: 0.28, y: 3.72, z: 0, ry: Math.PI / 2, parent: acg, cast: false });
  // 支架
  box(0.3, 0.05, 0.06, M.metalDark, { x: 0.2, y: 3.46, z: -0.28, parent: acg });
  box(0.3, 0.05, 0.06, M.metalDark, { x: 0.2, y: 3.46, z: 0.28, parent: acg });
  // 铜管
  pipe([0.27, 3.6, 0.18], [0.06, 2.9, 0.18], 0.016, M.copper, acg, { seg: 6 });
  // 滴水污渍
  decal(0.16, 1.1, M.dripStain, { x: 0.005, y: 2.95, z: -0.88, ry: Math.PI / 2, parent: acg });
  g.add(acg);

  /* ---------- 排水立管 ---------- */
  const dpMat = toon('#6d7176', { rim: 0.18, rimColor: '#9fb8d8' });
  pipe([-5.42, 0.14, 1.06], [-5.42, topY - 0.04, 1.06], 0.045, dpMat, g, { seg: 8 });
  for (const y of [1.3, 3.1, 4.9]) {
    box(0.12, 0.05, 0.12, M.metalDark, { x: -5.42, y, z: 1.0, parent: g, cast: false });
  }
  // 底部弯头
  pipe([-5.42, 0.16, 1.06], [-5.42, 0.16, 1.22], 0.045, dpMat, g, { seg: 6 });
  pipe([-5.42, 0.16, 1.22], [-5.42, 0.3, 1.22], 0.045, dpMat, g, { seg: 6 });
  // 巷侧落水管
  pipe([OB.maxX + 0.06, 0.14, -4.55], [OB.maxX + 0.06, topY - 0.02, -4.55], 0.04, dpMat, g, { seg: 8 });

  /* ---------- 屋顶设备：水箱 + 天线 ---------- */
  const roof = group('old-roof');
  // 水箱
  const tank = group('water-tank');
  tank.position.set(-4.92, topY, -3.35);
  for (const [dx, dz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
    cyl(0.035, 0.035, 0.42, 6, M.metalDark, { x: dx, y: 0.21, z: dz, parent: tank });
  }
  cyl(0.42, 0.42, 0.78, 16, M.tank, { y: 0.81, parent: tank });
  cyl(0.445, 0.445, 0.06, 16, M.metal, { y: 1.23, parent: tank });
  cyl(0.05, 0.05, 0.1, 8, M.metalDark, { y: 1.31, parent: tank });
  // 侧面小梯
  for (let i = 0; i < 5; i += 1) {
    box(0.02, 0.02, 0.24, M.metalDark, { x: 0.44, y: 0.55 + i * 0.16, z: 0, parent: tank, cast: false });
  }
  roof.add(tank);
  // 通风管
  pipe([-4.2, topY + 0.12, -4.5], [-4.2, topY + 0.85, -4.5], 0.06, M.metalDark, roof, { seg: 8 });
  cyl(0.09, 0.09, 0.05, 10, M.metal, { x: -4.2, y: topY + 0.88, z: -4.5, parent: roof });
  // 天线
  const ant = group('antenna');
  ant.position.set(-4.32, topY + 0.12, -2.85);
  pipe([0, 0, 0], [0, 1.95, 0], 0.013, M.metalDark, ant, { seg: 4 });
  for (const y of [1.45, 1.7, 1.9]) {
    box(0.5 - (1.9 - y) * 0.5, 0.015, 0.015, M.metalDark, { y, parent: ant, cast: false });
  }
  // 航空障碍灯（慢闪）
  const aviMat = glow('#ff4a4a', 1.8);
  const avi = sphere(0.035, aviMat, { y: 2.0, parent: ant, cast: false });
  noOutline(avi);
  roof.add(ant);
  // 屋顶小通风口
  box(0.34, 0.3, 0.34, M.metalDark, { x: -4.35, y: topY + 0.27, z: -1.6, parent: roof });
  box(0.4, 0.05, 0.4, M.metal, { x: -4.35, y: topY + 0.44, z: -1.6, parent: roof });
  g.add(roof);

  /* ---------- 巷侧墙面细节 ---------- */
  // 电表箱
  box(0.14, 0.42, 0.3, M.meterBox, { x: OB.maxX + 0.07, y: 1.78, z: -1.95, parent: g });
  decal(0.18, 0.26, flat('#cfd3cb'), {
    x: OB.maxX + 0.137,
    y: 1.8,
    z: -1.95,
    ry: Math.PI / 2,
    parent: g,
  });
  // 墙面竖向水管
  pipe([OB.maxX + 0.05, 0.14, -2.62], [OB.maxX + 0.05, 5.4, -2.62], 0.04, dpMat, g, { seg: 8 });
  pipe([OB.maxX + 0.05, 0.14, -1.4], [OB.maxX + 0.05, 3.5, -1.4], 0.024, M.copper, g, { seg: 6 });
  for (const y of [1.4, 3.0, 4.6]) {
    box(0.1, 0.05, 0.1, M.metalDark, { x: OB.maxX + 0.07, y, z: -2.62, parent: g, cast: false });
  }
  // 横向管线
  pipe([OB.maxX + 0.08, 2.5, -4.55], [OB.maxX + 0.08, 2.5, 0.86], 0.028, dpMat, g, { seg: 6 });
  // 巷侧小通风口
  box(0.06, 0.26, 0.34, M.metalDark, { x: OB.maxX + 0.03, y: 2.05, z: 0.52, parent: g });

  addOutline(g, { width: 0.0011, color: '#080b14' });
  parent.add(g);
  return { group: g, neonMat: snackMat, neonGlow, aviMat };
}

/* ========================================================================== */
/*  小巷                                                                       */
/* ========================================================================== */

function buildAlley(parent, M) {
  const g = group('alley');
  const AX = L.alley;
  const cx = (AX.minX + AX.maxX) / 2; // -3.45
  const len = AX.maxZ - AX.minZ; // 6.5
  const cz = (AX.minZ + AX.maxZ) / 2; // -2.25

  /* ---------- 湿地面 ---------- */
  plane(1.1, len, M.alleyFloor, {
    x: cx,
    y: 0.1235,
    z: cz,
    rx: -Math.PI / 2,
    parent: g,
    cast: false,
    receive: true,
  });
  // 积水微光
  const puddleMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#8fb0d8').multiplyScalar(0.6),
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  for (const [x, z, sx, sz] of [
    [-3.55, 0.35, 0.8, 0.6],
    [-3.4, -1.6, 0.9, 0.7],
    [-3.62, -3.2, 0.7, 0.55],
  ]) {
    const p = decal(1, 1, puddleMat, { x, y: 0.1265, z, rx: -Math.PI / 2 });
    p.scale.set(sx, sz, 1);
    p.renderOrder = 1;
    g.add(p);
  }

  /* ---------- 排水沟（贴便利店墙） ---------- */
  const drainMat = toon('#1b1f26', { rim: 0.1, rimColor: '#5878a0', gradient: 'tiny' });
  const dx = -3.02;
  decal(0.17, 6.1, drainMat, { x: dx, y: 0.1252, z: -2.35, rx: -Math.PI / 2, parent: g });
  const grateMats = [];
  for (let i = 0; i < 14; i += 1) {
    grateMats.push(trs(dx, 0.1285, -5.15 + i * 0.42));
  }
  instanced(boxGeo(0.15, 0.012, 0.32), M.grate, grateMats, { parent: g, cast: false, receive: true });

  /* ---------- 入口暖黄壁灯 ---------- */
  function wallLamp(z, scale, glowSize, glowOp, poolOp) {
    const lg = group('alley-wall-lamp');
    const lx = AX.minX + 0.02;
    pipe([lx, 2.42, z], [lx + 0.24, 2.42, z], 0.022, M.metalDark, lg, { seg: 6 });
    // 灯罩
    cyl(0.06, 0.14, 0.13, 10, M.lampShade, { x: lx + 0.26, y: 2.38, z, parent: lg });
    // 灯泡
    const bulbMat = glow('#ffe1a8', 1.6 * scale);
    const bulb = sphere(0.04, bulbMat, { x: lx + 0.26, y: 2.3, z, parent: lg, cast: false });
    noOutline(bulb);
    addGlow(lg, '#ffd9a0', glowSize, glowOp, lx + 0.26, 2.28, z);
    // 地面光池
    const poolMat = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: new THREE.Color('#ffcf94').multiplyScalar(0.9),
      transparent: true,
      opacity: poolOp,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const pool = decal(1, 1, poolMat, { x: lx + 0.28, y: 0.1305, z, rx: -Math.PI / 2 });
    pool.scale.set(1.15 * scale, 1.35 * scale, 1);
    pool.renderOrder = 2;
    lg.add(pool);
    g.add(lg);
  }
  wallLamp(0.42, 1.18, 2.8, 0.26, 0.44);
  wallLamp(-3.95, 0.85, 1.8, 0.17, 0.24);

  /* ---------- 巷子中段一盏吊着的裸灯泡（纵深层次） ---------- */
  const hang = group('alley-bulb');
  const hx = cx - 0.02;
  const hz = -1.15;
  // 电线从横跨小巷的煤气管上垂下来
  cyl(0.005, 0.005, 0.82, 4, M.wire, { x: hx, y: 3.92, z: hz, parent: hang, cast: false });
  cyl(0.05, 0.12, 0.11, 10, M.lampShade, { x: hx, y: 3.46, z: hz, parent: hang });
  const bulbMat = glow('#ffe6b0', 1.5);
  const hb = sphere(0.045, bulbMat, { x: hx, y: 3.38, z: hz, parent: hang, cast: false });
  noOutline(hb);
  addGlow(hang, '#ffd9a0', 1.9, 0.2, hx, 3.35, hz);
  const hangPool = decal(1, 1, new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffcf94').multiplyScalar(0.8),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), { x: hx, y: 0.132, z: hz, rx: -Math.PI / 2, parent: hang });
  hangPool.scale.set(1.5, 1.8, 1);
  hangPool.renderOrder = 2;
  g.add(hang);

  /* ---------- 啤酒筐 / 牛奶筐 ---------- */
  const crateYellow = toon('#c8a03a', { rim: 0.18, rimColor: '#f0c86a', gradient: 'soft' });
  const crateRed = toon('#a83b32', { rim: 0.18, rimColor: '#e07a60', gradient: 'soft' });
  const crateBlue = toon('#35628f', { rim: 0.18, rimColor: '#7fa8d8', gradient: 'soft' });
  const crateDark = toon('#2a2620', { rim: 0.1 });
  const crateGeo = boxGeo(0.42, 0.26, 0.32);
  const bottleGeo = cylGeo(0.032, 0.032, 0.16, 8);
  const bottleMats = [];

  function crate(x, y, z, mat, bottles) {
    const m = mesh(crateGeo, mat, { x, y, z, parent: g });
    // 筐口暗色
    box(0.36, 0.02, 0.26, crateDark, { x, y: y + 0.13, z, parent: g, cast: false });
    if (bottles) {
      for (let i = 0; i < 3; i += 1) {
        for (let k = 0; k < 2; k += 1) {
          bottleMats.push(trs(x - 0.11 + i * 0.11, y + 0.21, z - 0.07 + k * 0.14));
        }
      }
    }
    return m;
  }
  crate(-3.72, 0.25, -2.62, crateYellow);
  crate(-3.72, 0.51, -2.62, crateYellow);
  crate(-3.7, 0.77, -2.6, crateYellow, true);
  crate(-3.74, 0.25, -3.02, crateRed, true);
  crate(-3.74, 0.51, -3.02, crateRed);
  // 牛奶筐（蓝色）
  crate(-3.12, 0.25, -1.5, crateBlue);
  crate(-3.12, 0.51, -1.5, crateBlue, true);
  // 瓶子
  instanced(bottleGeo, M.bottle, bottleMats, { parent: g, cast: true, receive: true });

  /* ---------- 纸箱 ---------- */
  const cardboard = toon('#a98457', { rim: 0.16, rimColor: '#d8b888', gradient: 'soft' });
  const tape = toon('#c9b184', { rim: 0.1 });
  function carton(x, y, z, w, h, d, ry, rz) {
    const cg = group('carton');
    cg.position.set(x, y, z);
    cg.rotation.set(0, ry || 0, rz || 0);
    box(w, h, d, cardboard, { parent: cg });
    box(w * 0.16, h * 1.01, d * 1.01, tape, { parent: cg, cast: false });
    g.add(cg);
  }
  carton(-3.24, 0.28, -3.55, 0.42, 0.32, 0.36, 0.12);
  carton(-3.26, 0.62, -3.58, 0.34, 0.28, 0.3, -0.22);
  carton(-3.78, 0.25, -3.62, 0.4, 0.26, 0.32, 0.4);
  carton(-3.82, 0.35, -3.28, 0.34, 0.42, 0.24, 0.1, 0.16);

  /* ---------- 拖把桶 ---------- */
  const bucket = group('mop-bucket');
  bucket.position.set(-3.7, Y, -0.34);
  cyl(0.15, 0.125, 0.3, 12, toon('#cfa83a', { rim: 0.2, rimColor: '#f0d070', gradient: 'soft' }), {
    y: 0.15,
    parent: bucket,
  });
  cyl(0.135, 0.135, 0.02, 12, toon('#3c3828', { rim: 0.1 }), { y: 0.29, parent: bucket, cast: false });
  box(0.14, 0.1, 0.16, toon('#9c9c94', { rim: 0.14 }), { x: 0.08, y: 0.34, parent: bucket });
  // 拖把
  const mopAngle = 0.24;
  const handle = cyl(0.014, 0.014, 1.05, 6, M.mopHandle, {
    x: -0.02,
    y: 0.72,
    rz: mopAngle,
    parent: bucket,
  });
  const mopHead = box(0.2, 0.14, 0.16, M.mopHead, { x: -0.14, y: 0.22, rz: mopAngle, parent: bucket });
  g.add(bucket);

  /* ---------- 简化旧自行车 ---------- */
  const bike = group('old-bike');
  bike.position.set(-3.2, Y, -3.98);
  bike.rotation.z = -0.1;
  const bikeMat = toon('#5c6066', { rim: 0.24, rimColor: '#a8c0d8', gradient: 'soft' });
  const rubber = toon('#1c1e22', { rim: 0.08 });
  function wheel(z) {
    const w = torus(0.29, 0.022, 6, 22, rubber, { y: 0.31, z, ry: Math.PI / 2, parent: bike });
    // 轮圈
    torus(0.255, 0.008, 4, 20, M.metal, { y: 0.31, z, ry: Math.PI / 2, parent: bike, cast: false });
    // 辐条
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 4;
      const spoke = box(0.008, 0.5, 0.008, M.metal, { y: 0.31, z, parent: bike, cast: false });
      spoke.rotation.x = a;
    }
    cyl(0.032, 0.032, 0.06, 8, M.metal, { x: 0, y: 0.31, z, rz: Math.PI / 2, parent: bike });
    return w;
  }
  wheel(-0.32);
  wheel(0.34);
  // 车架
  pipe([0, 0.31, -0.32], [0, 0.6, -0.12], 0.02, bikeMat, bike, { seg: 5 });
  pipe([0, 0.6, -0.12], [0, 0.62, 0.16], 0.02, bikeMat, bike, { seg: 5 });
  pipe([0, 0.62, 0.16], [0, 0.31, 0.34], 0.02, bikeMat, bike, { seg: 5 });
  pipe([0, 0.6, -0.12], [0, 0.3, 0.02], 0.018, bikeMat, bike, { seg: 5 });
  pipe([0, 0.3, 0.02], [0, 0.31, 0.34], 0.018, bikeMat, bike, { seg: 5 });
  // 车把
  cyl(0.016, 0.016, 0.42, 6, bikeMat, { y: 0.72, z: 0.18, rz: Math.PI / 2, parent: bike });
  cyl(0.02, 0.02, 0.1, 6, rubber, { x: -0.2, y: 0.72, z: 0.18, rz: Math.PI / 2, parent: bike });
  cyl(0.02, 0.02, 0.1, 6, rubber, { x: 0.2, y: 0.72, z: 0.18, rz: Math.PI / 2, parent: bike });
  // 车座
  box(0.1, 0.05, 0.22, rubber, { y: 0.66, z: -0.14, parent: bike });
  // 后货架
  box(0.16, 0.02, 0.24, M.metal, { y: 0.44, z: -0.3, parent: bike, cast: false });
  // 前车筐（旧铁丝篮）
  box(0.24, 0.16, 0.2, M.basket, { y: 0.55, z: 0.4, parent: bike });
  box(0.26, 0.02, 0.22, M.metal, { y: 0.64, z: 0.4, parent: bike, cast: false });
  // 脚蹬
  cyl(0.05, 0.05, 0.03, 8, M.metalDark, { y: 0.3, z: 0.02, rz: Math.PI / 2, parent: bike });
  g.add(bike);

  /* ---------- 尽头：矮墙 + 铁门 + 深处的暗巷 ---------- */
  const endG = group('alley-end');
  const gz = -4.56;
  // 两根门柱
  box(0.17, 1.5, 0.17, M.brick, { x: -3.94, y: Y + 0.75, z: gz, parent: endG });
  box(0.17, 1.5, 0.17, M.brick, { x: -2.98, y: Y + 0.75, z: gz, parent: endG });
  box(0.21, 0.08, 0.21, M.concretePale, { x: -3.94, y: Y + 1.52, z: gz, parent: endG });
  box(0.21, 0.08, 0.21, M.concretePale, { x: -2.98, y: Y + 1.52, z: gz, parent: endG });
  // 矮墙
  box(0.9, 0.52, 0.1, M.brick, { x: cx, y: Y + 0.26, z: gz, parent: endG });
  box(0.94, 0.05, 0.14, M.concretePale, { x: cx, y: Y + 0.55, z: gz, parent: endG });
  // 铁门竖栅
  const barMats = [];
  for (let i = 0; i < 8; i += 1) {
    barMats.push(trs(cx - 0.4 + i * 0.114, Y + 1.04, gz));
  }
  instanced(cylGeo(0.016, 0.016, 1.02, 6), M.gateIron, barMats, { parent: endG, cast: true });
  // 横杆
  box(0.8, 0.035, 0.035, M.gateIron, { x: cx, y: Y + 0.8, z: gz, parent: endG });
  box(0.8, 0.035, 0.035, M.gateIron, { x: cx, y: Y + 1.45, z: gz, parent: endG });
  // 门牌
  decal(0.34, 0.17, lightbox(gateSignTexture(), 0.5), { x: cx, y: Y + 1.2, z: gz + 0.06, parent: endG });
  // 门后的暗巷背景（制造纵深）
  box(1.24, 2.3, 0.1, M.voidWall, { x: cx, y: Y + 1.15, z: -5.36, parent: endG });
  // 深处一扇很暗的窗 / 一点暖光
  decal(0.26, 0.3, lightbox(warmWindowTexture(), 0.28), {
    x: cx + 0.14,
    y: Y + 1.62,
    z: -5.3,
    parent: endG,
  });
  addGlow(endG, '#ffb45e', 1.5, 0.1, cx + 0.14, Y + 1.62, -5.12);
  // 门后地面湿亮
  decal(0.95, 0.6, new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffb45e').multiplyScalar(0.35),
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), { x: cx, y: 0.126, z: -4.9, rx: -Math.PI / 2, parent: endG });
  g.add(endG);

  /* ---------- 横跨小巷的管线 / 电缆（加强纵深） ---------- */
  pipe([AX.minX, 4.32, -1.15], [AX.maxX, 4.24, -1.15], 0.032, M.metalDark, g, { seg: 6 });
  pipe([AX.minX, 4.55, -2.7], [AX.maxX, 4.48, -2.7], 0.022, M.copper, g, { seg: 6 });
  const cablePts = catenary([AX.minX, 3.85, -0.75], [AX.maxX + 0.02, 3.72, -0.75], 0.16);
  const cable = tube(cablePts, 0.012, M.wire, { segments: 10, radialSegments: 4, parent: g, cast: false });
  noOutline(cable);
  const cable2 = tube(catenary([AX.minX, 3.7, -2.2], [AX.maxX + 0.02, 3.62, -2.25], 0.2), 0.01, M.wire, {
    segments: 10,
    radialSegments: 4,
    parent: g,
    cast: false,
  });
  noOutline(cable2);

  /* ---------- 便利店侧墙的巷内附件 ---------- */
  const storeX = AX.maxX; // -2.9
  // 落水管
  pipe([storeX - 0.03, 0.14, -0.35], [storeX - 0.03, 3.5, -0.35], 0.042, M.pipeGray, g, { seg: 8 });
  // 排水口小斗
  box(0.16, 0.14, 0.2, M.metalDark, { x: storeX - 0.06, y: 3.42, z: -0.35, parent: g });
  // 排风口
  box(0.05, 0.24, 0.32, M.metalDark, { x: storeX - 0.025, y: 2.62, z: -3.15, parent: g });
  // 墙面电缆
  pipe([storeX - 0.03, 2.86, -4.4], [storeX - 0.03, 2.86, 0.9], 0.014, M.wire, g, { seg: 4 });
  // 门口台阶
  box(1.08, 0.04, 0.1, M.concretePale, { x: cx, y: 0.145, z: 0.94, parent: g });
  // 巷口暖光外溢（让正面看过来时能一眼注意到巷子）
  const spill = decal(1.15, 0.9, new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffcf94').multiplyScalar(0.75),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }), { x: cx, y: 0.128, z: 1.32, rx: -Math.PI / 2, parent: g });
  spill.scale.set(1.15, 0.9, 1);
  spill.renderOrder = 2;

  addOutline(g, { width: 0.001, color: '#080b14' });
  parent.add(g);
  return { group: g };
}


/* ========================================================================== */
/*  性能：把静态网格按「材质 + 阴影开关」合并成少量大 mesh                     */
/* ========================================================================== */

function optimizeStatics(root, dynamicMeshes) {
  root.updateMatrixWorld(true);
  const buckets = new Map(); // key: mat.uuid + flags -> { mat, geos, cast, receive, outline }
  const removals = [];

  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
    if (dynamicMeshes && dynamicMeshes.has(o)) return;
    const mat = o.material;
    if (!mat || Array.isArray(mat)) return;
    const geo = o.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;
    const isOutline = o.userData.isOutline === true;
    let baked;
    try {
      baked = geo.index ? geo.toNonIndexed() : geo.clone();
    } catch (err) {
      return;
    }
    // 只保留 position / normal / uv，保证 mergeGeometries 兼容
    for (const key of Object.keys(baked.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') baked.deleteAttribute(key);
    }
    if (!baked.attributes.normal) baked.computeVertexNormals();
    if (!baked.attributes.uv) {
      const count = baked.attributes.position.count;
      baked.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    baked.clearGroups();
    baked.applyMatrix4(o.matrixWorld);

    const cast = !isOutline && o.castShadow !== false;
    const receive = !isOutline && o.receiveShadow !== false;
    const key = `${mat.uuid}|${isOutline ? 'o' : cast ? 'c' : 'n'}${receive ? 'r' : ''}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { mat, geos: [], cast, receive, outline: isOutline };
      buckets.set(key, bucket);
    }
    bucket.geos.push(baked);
    removals.push(o);
  });

  for (const o of removals) {
    if (o.parent) o.parent.remove(o);
  }

  for (const bucket of buckets.values()) {
    if (!bucket.geos.length) continue;
    const merged = mergeGeometries(bucket.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, bucket.mat);
    m.castShadow = bucket.cast;
    m.receiveShadow = bucket.receive;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    if (bucket.outline) {
      m.renderOrder = 1;
      m.userData.isPerformanceMesh = true;
    } else {
      m.userData.isPerformanceMesh = true;
    }
    root.add(m);
  }
}

/* ========================================================================== */
/*  入口                                                                       */
/* ========================================================================== */

export function buildStreet(ctx) {
  const g = group('street');

  /* ---------------- 材质 ---------------- */
  const M = {
    concrete: toon('#8b8f94', { rim: 0.2, rimColor: '#9cc0e8', gradient: 'soft' }),
    concreteDark: toon('#666b71', { rim: 0.16, rimColor: '#7f9ec0', gradient: 'soft' }),
    concretePale: toon('#a3a6a8', { rim: 0.16, rimColor: '#a8c8e8', gradient: 'soft' }),
    metal: toon('#98a0a8', { rim: 0.26, rimColor: '#b6d4f0', gradient: 'soft' }),
    metalDark: toon('#464c54', { rim: 0.2, rimColor: '#8fa8c8', gradient: 'soft' }),
    whiteRail: toon('#dee3ea', { rim: 0.24, rimColor: '#a8c8e8', gradient: 'soft' }),
    wire: toon('#22262e', { rim: 0.16, rimColor: '#6f96c8', gradient: 'tiny' }),
    ceramic: toon('#e6e4dc', { rim: 0.1, rimColor: '#cfe0f0', gradient: 'tiny' }),
    transformer: toon('#777d82', { rim: 0.18, rimColor: '#9fb8d8', gradient: 'soft' }),
    signalBox: toon('#3d444c', { rim: 0.2, rimColor: '#8fa8c8', gradient: 'soft' }),
    warningStripe: toon('#ffffff', { map: warningStripeTexture(), rim: 0.12, rimColor: '#ffe08a', gradient: 'tiny' }),
    warnPlate: lightbox(tex('warnPlate', () =>
      canvasTexture(256, 320, (c, w, h) => {
        c.fillStyle = '#f0c62e';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#24221a';
        c.lineWidth = 10;
        c.strokeRect(8, 8, w - 16, h - 16);
        c.fillStyle = '#24221a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `800 66px ${JP_FONT}`;
        c.fillText('感電', w / 2, 96);
        c.fillText('注意', w / 2, 180);
        c.font = `600 30px ${JP_FONT}`;
        c.fillText('DANGER', w / 2, 262);
      })), 0.85),
    poleId: lightbox(poleIdTexture(), 0.55),
    oldWall: toon('#5b564c', { rim: 0.14, rimColor: '#8fb2d8', gradient: 'soft' }),
    oldWall2: toon('#4f4a42', { rim: 0.12, rimColor: '#8fa8c8', gradient: 'soft' }),
    oldRoof: toon('#3d3b38', { rim: 0.1, rimColor: '#7f9ec0', gradient: 'soft' }),
    oldTileFront: toon('#b9b5a8', { map: oldTileTexture(2.1, 6.9), rim: 0.14, rimColor: '#8fb2d8', gradient: 'soft' }),
    oldTileSide: toon('#a9a598', { map: oldTileTexture(8, 6.9), rim: 0.12, rimColor: '#7fa8d8', gradient: 'soft' }),
    shutter: toon('#b9bcc0', { map: shutterTexture(), rim: 0.24, rimColor: '#a8c8e8', gradient: 'soft' }),
    oldShopSign: toon('#d5cbb2', { map: oldShopSignTexture(), rim: 0.16, rimColor: '#d8b888', gradient: 'soft' }),
    acBody: toon('#a7a79f', { rim: 0.16, rimColor: '#b8d0e8', gradient: 'soft' }),
    copper: toon('#8a6a4a', { rim: 0.16, rimColor: '#d8a878', gradient: 'soft' }),
    tank: toon('#93999e', { rim: 0.24, rimColor: '#c0d8f0', gradient: 'soft' }),
    meterBox: toon('#9a9580', { rim: 0.14, rimColor: '#c8c8a8', gradient: 'soft' }),
    dripStain: new THREE.MeshBasicMaterial({
      map: dripStainTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    alleyFloor: toon('#a2a3a6', { map: alleyFloorTexture(), rim: 0.14, rimColor: '#7f9cc0', gradient: 'soft' }),
    grate: toon('#2b2f36', { rim: 0.12, rimColor: '#5f7fa0', gradient: 'tiny' }),
    lampShade: toon('#3f4b41', { rim: 0.2, rimColor: '#9fb8a8', gradient: 'soft' }),
    brick: toon('#6d5f52', { rim: 0.16, rimColor: '#b89078', gradient: 'soft' }),
    voidWall: toon('#232a33', { rim: 0.1, rimColor: '#6f96c8', gradient: 'soft' }),
    gateIron: toon('#565e66', { rim: 0.22, rimColor: '#a8c0d8', gradient: 'soft' }),
    bottle: toon('#5a6b3a', { rim: 0.3, rimColor: '#c8e0a0', gradient: 'tiny' }),
    pipeGray: toon('#6d7176', { rim: 0.18, rimColor: '#9fb8d8', gradient: 'soft' }),
    mopHandle: toon('#8f7a56', { rim: 0.14, rimColor: '#d8b888', gradient: 'soft' }),
    mopHead: toon('#8a8f8c', { rim: 0.1, rimColor: '#c8d0d8', gradient: 'soft' }),
    basket: toon('#7a7f7c', { rim: 0.16, rimColor: '#b8c8d8', gradient: 'soft' }),
  };

  /* ---------------- 搭建 ---------------- */
  // 电线杆
  buildUtilityPole(g, M, {
    x: L.poleMain.x,
    z: L.poleMain.z,
    h: 7.36,
    seed: 11,
    main: true,
    arms: [
      { axis: 'z', y: 6.78, len: 1.4, ins: [-0.44, -0.15, 0.15, 0.44] },
      { axis: 'x', y: 6.44, len: 1.15, ins: [-0.34, 0, 0.34] },
      { axis: 'z', y: 5.85, len: 0.72, tele: [-0.2, 0.18] },
      { axis: 'x', y: 5.6, len: 0.6, tele: [-0.14, 0.12] },
    ],
  });
  buildUtilityPole(g, M, {
    x: L.poleFront.x,
    z: L.poleFront.z,
    h: 7.2,
    seed: 23,
    arms: [
      { axis: 'z', y: 6.64, len: 1.25, ins: [-0.42, -0.14, 0.14, 0.42] },
      { axis: 'z', y: 5.68, len: 0.65, tele: [-0.18, 0.16] },
    ],
  });
  buildUtilityPole(g, M, {
    x: L.poleBack.x,
    z: L.poleBack.z,
    h: 6.95,
    seed: 37,
    arms: [
      { axis: 'x', y: 6.3, len: 1.1, ins: [-0.34, 0, 0.34] },
      { axis: 'x', y: 5.38, len: 0.6, tele: [-0.13, 0.11] },
    ],
  });

  // 电线（带风摆）
  const wireState = [];
  buildWires(g, M, wireState);

  // 主杆路灯 + 路牌
  buildStreetLamp(g, M);
  const signs = buildPoleSigns(g, M);

  // 前杆转角镜（日本街角的经典物件）
  buildCornerMirror(g, M);

  // 远处路口信号灯
  const traffic = buildTrafficLight(g, M);

  // 路缘护栏 / 邮筒 / 停车牌
  buildGuardrails(g, M);
  buildPostbox(g, M);
  buildParkingSign(g, M);

  // 左侧旧楼 + 小巷
  const oldBuilding = buildOldBuilding(g, M);
  buildAlley(g, M);

  /* ---------------- 性能：静态网格合并 ---------------- */
  const dynamicMeshes = new Set();
  for (const w of wireState) dynamicMeshes.add(w.mesh);
  optimizeStatics(g, dynamicMeshes);

  /* ---------------- 动画 ---------------- */
  const neonBase = 1.45;
  const aviBase = new THREE.Color('#ff4a4a');
  const lampBase = { green: traffic.lamps.green.base, amber: traffic.lamps.amber.base, red: traffic.lamps.red.base };
  const CYCLE = 46;
  const tmp = new THREE.Color();

  return {
    group: g,
    update(t, dt) {
      // 电线风摆（极轻微）
      for (let i = 0; i < wireState.length; i += 1) {
        const w = wireState[i];
        const s = Math.sin(t * w.freq + w.phase);
        const s2 = Math.sin(t * w.freq * 1.63 + w.phase * 1.7);
        if (w.axis === 'x') {
          w.mesh.rotation.z = s * w.amp;
          w.mesh.rotation.x = s2 * w.amp * 0.6;
        } else {
          w.mesh.rotation.x = s * w.amp;
          w.mesh.rotation.z = s2 * w.amp * 0.6;
        }
      }

      // 信号灯：很慢、克制的呼吸
      const phase = (t + 5.5) % CYCLE;
      const gv = smoothRamp(phase, 0.4, 1.8) * (1 - smoothRamp(phase, 17.4, 18.8));
      const av = smoothRamp(phase, 18.0, 19.2) * (1 - smoothRamp(phase, 21.6, 22.8));
      const rv = smoothRamp(phase, 22.2, 23.4) * (1 - smoothRamp(phase, 41.8, 43.2));
      traffic.lamps.green.mat.color.copy(lampBase.green).multiplyScalar(0.05 + 2.1 * gv);
      traffic.lamps.amber.mat.color.copy(lampBase.amber).multiplyScalar(0.05 + 1.9 * av);
      traffic.lamps.red.mat.color.copy(lampBase.red).multiplyScalar(0.05 + 2.1 * rv);
      for (const sp of traffic.lamps.green.spriteMats) sp.opacity = 0.55 * gv;
      for (const sp of traffic.lamps.amber.spriteMats) sp.opacity = 0.42 * av;
      for (const sp of traffic.lamps.red.spriteMats) sp.opacity = 0.55 * rv;

      // 行人：车红时行人绿
      const pv = smoothRamp(phase, 23.6, 25.0) * (1 - smoothRamp(phase, 40.2, 41.6));
      traffic.pedGreenMat.color.setScalar(0.05 + 0.5 * pv);
      traffic.pedRedMat.color.setScalar(0.05 + 0.4 * (1 - pv));
      traffic.pedGlowGreen.material.opacity = 0.16 * pv;
      traffic.pedGlowRed.material.opacity = 0.13 * (1 - pv);

      // 粉色霓虹极缓的呼吸
      oldBuilding.neonMat.color.setScalar(neonBase + Math.sin(t * 0.6) * 0.035);
      oldBuilding.neonGlow.material.opacity = 0.16 + Math.sin(t * 0.6) * 0.015;

      // 屋顶航空障碍灯慢闪
      const blink = Math.max(0, Math.sin(t * 1.15 - 0.5));
      const blinkK = blink * blink * blink * blink * blink;
      tmp.copy(aviBase).multiplyScalar(0.05 + 2.4 * blinkK);
      oldBuilding.aviMat.color.copy(tmp);
    },
  };
}
