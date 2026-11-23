/**
 * terrain.js —— 长卷的绢底与河岸。
 *
 * 河道把画面分成南北两岸：北岸高一点（城与街市），南岸是郊野。
 * 这里只负责「绢」和「岸」：大块平铺的绢面、斜入水面的河坡、
 * 城外几条土路与河岸的湿墨边。水面、船、桥、房子都由各自的模块画。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { RIVER, WATER_Y, GROUND_Y, northBankZ, southBankZ, ROAD, CAMERA } from '../layout.js';

const SLOPE = 7; // 岸坡水平宽度
const X0 = -420;
const X1 = 900;
const STEP = 6;

function xs() {
  const out = [];
  for (let x = X0; x <= X1; x += STEP) out.push(x);
  return out;
}

/** 由「两条边线」生成一条带状地面（near/far 可以是函数 x→z）。 */
function stripGeometry(list, nearZ, farZ, yNear, yFar) {
  const pos = [];
  const uv = [];
  const idx = [];
  const U = (x) => (x + 420) / 1320;
  const V = (z) => (z + 700) / 1400;
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    const zn = typeof nearZ === 'function' ? nearZ(x) : nearZ;
    const zf = typeof farZ === 'function' ? farZ(x) : farZ;
    pos.push(x, yNear, zn, x, yFar, zf);
    uv.push(U(x), V(zn), U(x), V(zf));
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 折线 → 平面带状路（y 固定）。 */
function ribbon(points, halfWidth, y) {
  const pos = [];
  const idx = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    let dx;
    let dz;
    if (i === 0) {
      dx = points[1][0] - x;
      dz = points[1][1] - z;
    } else if (i === points.length - 1) {
      dx = x - points[i - 1][0];
      dz = z - points[i - 1][1];
    } else {
      dx = points[i + 1][0] - points[i - 1][0];
      dz = points[i + 1][1] - points[i - 1][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * halfWidth;
    const nz = (dx / len) * halfWidth;
    pos.push(x + nx, y, z + nz, x - nx, y, z - nz);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function edgeLine(points, offset, y) {
  const arr = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * offset;
    const nz = (dx / len) * offset;
    arr.push(ax + nx, y, az + nz, bx + nx, y, bz + nz);
    arr.push(ax - nx, y, az - nz, bx - nx, y, bz - nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

function groundTexture() {
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rng = (() => {
    let s = 88991;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  // 绢底：比天空略暖一点的土色
  ctx.fillStyle = '#f2efe7';
  ctx.fillRect(0, 0, W, H);
  // 大块淡墨/赭色的地气
  for (let i = 0; i < 160; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 40 + rng() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.02 + rng() * 0.035;
    const warm = rng() > 0.45;
    g.addColorStop(0, warm ? `rgba(184,160,120,${a})` : `rgba(120,128,108,${a})`);
    g.addColorStop(1, 'rgba(180,160,120,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.45 + rng() * 0.4);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 极淡的横向笔触（像绢的经纬）
  for (let i = 0; i < 500; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const len = 20 + rng() * 160;
    ctx.strokeStyle = `rgba(110,108,92,${0.008 + rng() * 0.016})`;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rng() - 0.5) * 6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function buildTerrain(ctx) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const L = xs();

  const groundMat = new THREE.MeshLambertMaterial({ map: groundTexture(), color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
  const bankMat = new THREE.MeshLambertMaterial({ color: P.PAPER_DEEP, flatShading: true, side: THREE.DoubleSide });

  // 北岸：河岸坡 → 远的绢面
  const northTop = (x) => northBankZ(x);
  group.add(new THREE.Mesh(stripGeometry(L, (x) => northTop(x) - SLOPE, northTop, WATER_Y, GROUND_Y), bankMat));
  group.add(new THREE.Mesh(stripGeometry(L, northTop, -760, GROUND_Y, GROUND_Y), groundMat));

  // 南岸
  const southTop = (x) => southBankZ(x);
  group.add(new THREE.Mesh(stripGeometry(L, southTop, (x) => southTop(x) + SLOPE, GROUND_Y, WATER_Y), bankMat));
  group.add(new THREE.Mesh(stripGeometry(L, southTop, 800, GROUND_Y, GROUND_Y), groundMat));

  // —— 土路 ——
  const roadMat = new THREE.MeshLambertMaterial({ color: 0xeadfc8, flatShading: true });
  const roads = [
    { pts: ROAD.main, w: 4.2 },
    { pts: ROAD.south, w: 3.2 },
  ];
  for (const r of roads) {
    const y = GROUND_Y + 0.03;
    group.add(new THREE.Mesh(ribbon(r.pts, r.w / 2, y), roadMat));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6f6a5b,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      toneMapped: false,
    });
    group.add(new THREE.LineSegments(edgeLine(r.pts, r.w / 2 + 0.05, y + 0.01), lineMat));
  }

  // —— 河岸的湿墨线 ——
  const wetMat = new THREE.LineBasicMaterial({
    color: 0x5f6a63,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    toneMapped: false,
  });
  for (const edge of [
    { fn: northTop, y: GROUND_Y + 0.02 },
    { fn: southTop, y: GROUND_Y + 0.02 },
  ]) {
    const arr = [];
    for (let i = 0; i < L.length - 1; i++) {
      const x0 = L[i];
      const x1 = L[i + 1];
      arr.push(x0, edge.y, edge.fn(x0), x1, edge.y, edge.fn(x1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    group.add(new THREE.LineSegments(g, wetMat));
  }

  // —— 长卷两端的淡墨收口 ——
  const endMat = new THREE.MeshBasicMaterial({
    color: P.PAPER_DEEP,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    toneMapped: false,
  });
  const endPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), endMat);
  endPlane.visible = false;
  group.add(endPlane);

  // —— 河面墨色兜底：沿河心铺一条不透明的淡墨带（比水面略高，压在水与纸之间） ——
  {
    const half = RIVER.halfWidth - 4;
    const pts = RIVER.path.filter(([x]) => x > -260 && x < 780);
    const pos = [];
    const idx = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next[0] - prev[0];
      const dz = next[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      pos.push(x + nx, GROUND_Y + 0.085, z + nz, x - nx, GROUND_Y + 0.085, z - nz);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.MeshLambertMaterial({ color: 0x5a6a62, side: THREE.DoubleSide, flatShading: true });
    const river = new THREE.Mesh(g, m);
    river.name = 'river-ink';
    river.renderOrder = 1;
    group.add(river);
  }

  return group;
}
