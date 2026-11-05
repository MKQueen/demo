#!/usr/bin/env node
/**
 * generate-village-tiles.mjs —— 「澜屿港」本地 3D Tiles 生成器（Node，可重复运行）。
 *
 * 用法：
 *   cd apps/flood-sim && node scripts/generate-village-tiles.mjs
 *   node scripts/generate-village-tiles.mjs --seed=20261104        # 换种子（可选）
 *   node scripts/generate-village-tiles.mjs --out=public/generated/village
 *
 * 产物（默认 `public/generated/village/`，该目录在 .gitignore 内）：
 *   - tileset.json           3D Tiles 1.0 入口：根 transform = 村庄中心 ENU，children = 4 个 b3dm
 *   - town-old-west.b3dm     老城西部（含河口栈桥）
 *   - town-old-east.b3dm     老城东部
 *   - town-harbor-south.b3dm 滨海新区南部（含 1/2 号码头）
 *   - town-harbor-north.b3dm 滨海新区北部（含 3/4 号码头 + 地标塔楼）
 *   - buildings.json         按 docs/INTERFACES.md §4 schema 的建筑清单（淹没分析直接读）
 *   - roads.json             道路中心线（场景局部米 + 相对村庄中心两套坐标）
 *
 * 数据来源：
 *   - 布局：`src/geo/villageLayout.js`（确定性 mulberry32，脚本 / 运行时共用）
 *   - 高程：`src/geo/terrainModel.js` 的 heightAtLocal()（全项目唯一真值，不另造地形）
 *
 * 坐标约定（关键，改之前先读 docs/INTERFACES.md §4）：
 *   - 3D Tiles root.transform = villageCenter 的 eastNorthUpToFixedFrame（椭球高 0，ECEF 列主序）。
 *   - GLB / content 坐标 = **相对村庄中心的 ENU 米**：x=东、y=北、z=海拔（绝对椭球高）。
 *   - glTF 默认 Y-up，Cesium 加载 b3dm 时会做 Y-up → Z-up 旋转 (x,y,z)→(x,-z,y)；
 *     因此写入 GLB 前要反向换算：(X东,Y北,Z上) → glTF (x=X, y=Z, z=-Y)。法线同理。
 *   - b3dm 各段 8 字节对齐；`_BATCHID` 逐顶点 f32（每个 b3dm 内部从 0 起），
 *     batch table 属性与各自 tile 的建筑子集一一对应（全局 id 写在属性里）。
 *
 * 建筑类别（kind）：house / shop / apartment / public / landmark / pier。
 *   buildings.json 的 type 仍只用 schema 的 house|shop|public|pier；公寓/酒店归入 shop，
 *   地标归入 public，`kind` 字段给出更细分类（附加字段，不影响既有消费方）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Cesium from 'cesium';
import {
  generateVillageLayout,
  VILLAGE_CENTER,
  FOUNDATION_DEPTH,
  LAYOUT_VERSION,
  TOWN,
} from '../src/geo/villageLayout.js';
import { heightAtLocal } from '../src/geo/terrainModel.js';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 参数 / 输出
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const SEED = Number(getArg('seed', '20261104'));
const OUT_DIR = path.resolve(APP_ROOT, getArg('out', 'public/generated/village'));
const TILESET_URI = 'generated/village/tileset.json';
const GENERATED_AT = new Date().toISOString();

/** 每个 b3dm 一个空间 tile（10 个 tile：老城/西城/北城/滨海三分/CBD 两分） */
const TILE_DEFS = [
  { id: 'city-old-west', uri: 'city-old-west.b3dm', filter: (b) => b.district === 'old' && b.x < -700 },
  { id: 'city-old-east', uri: 'city-old-east.b3dm', filter: (b) => b.district === 'old' && b.x >= -700 },
  { id: 'city-west-north', uri: 'city-west-north.b3dm', filter: (b) => b.district === 'west' && b.y >= -1000 },
  { id: 'city-west-south', uri: 'city-west-south.b3dm', filter: (b) => b.district === 'west' && b.y < -1000 },
  { id: 'city-north', uri: 'city-north.b3dm', filter: (b) => b.district === 'north' },
  { id: 'city-harbor-west', uri: 'city-harbor-west.b3dm', filter: (b) => b.district === 'harbor' && b.x < 800 },
  { id: 'city-harbor-mid', uri: 'city-harbor-mid.b3dm', filter: (b) => b.district === 'harbor' && b.x >= 800 && b.x < 1300 },
  { id: 'city-harbor-east', uri: 'city-harbor-east.b3dm', filter: (b) => b.district === 'harbor' && b.x >= 1300 },
  { id: 'city-cbd-north', uri: 'city-cbd-north.b3dm', filter: (b) => (b.district === 'cbd' || b.district === 'waterfront') && b.y >= 500 },
  { id: 'city-cbd-south', uri: 'city-cbd-south.b3dm', filter: (b) => (b.district === 'cbd' || b.district === 'waterfront') && b.y < 500 },
];

/** 几何预算 */
const BUDGET = {
  triangles: 130000,
  b3dmBytes: 2.8 * 1024 * 1024,
  totalB3dmBytes: 15 * 1024 * 1024,
  tilesMin: 6,
  tilesMax: 10,
};

// ---------------------------------------------------------------------------
// 颜色工具：sRGB hex → glTF 线性色
// ---------------------------------------------------------------------------

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** '#rrggbb' → [r,g,b]（线性空间 0..1）；mul 为整体明度微调 */
function hexToLinear(hex, mul = 1) {
  const n = parseInt(String(hex || '#cccccc').replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const clamp = (v) => Math.min(1, Math.max(0, v * mul));
  return [srgbToLinear(clamp(r)), srgbToLinear(clamp(g)), srgbToLinear(clamp(b))];
}

function pushColor(arr, rgb, alpha = 1) {
  arr.push(rgb[0], rgb[1], rgb[2], alpha);
}

// ---------------------------------------------------------------------------
// 网格构建器：内部坐标 = 相对村庄中心的 ENU 米（x 东 / y 北 / z 海拔）
// ---------------------------------------------------------------------------

class VillageMesh {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.batchIds = [];
    this.indices = [];
    this.triangleCount = 0;
    this.vertexCount = 0;
    this.bounds = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
  }

  /** 有向多边形面（顶点按逆时针=从外侧看），法线由前三点叉积求得 */
  addPolygon(verts, color, batchId) {
    if (verts.length < 3) return;
    const e1 = [
      verts[1][0] - verts[0][0],
      verts[1][1] - verts[0][1],
      verts[1][2] - verts[0][2],
    ];
    const e2 = [
      verts[2][0] - verts[0][0],
      verts[2][1] - verts[0][1],
      verts[2][2] - verts[0][2],
    ];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const normal = [nx / nl, ny / nl, nz / nl];

    const base = this.vertexCount;
    for (const v of verts) {
      this.positions.push(v[0], v[1], v[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      pushColor(this.colors, color);
      this.batchIds.push(batchId);
      this.vertexCount++;
      if (v[0] < this.bounds.min[0]) this.bounds.min[0] = v[0];
      if (v[1] < this.bounds.min[1]) this.bounds.min[1] = v[1];
      if (v[2] < this.bounds.min[2]) this.bounds.min[2] = v[2];
      if (v[0] > this.bounds.max[0]) this.bounds.max[0] = v[0];
      if (v[1] > this.bounds.max[1]) this.bounds.max[1] = v[1];
      if (v[2] > this.bounds.max[2]) this.bounds.max[2] = v[2];
    }
    for (let i = 1; i < verts.length - 1; i++) {
      this.indices.push(base, base + i, base + i + 1);
      this.triangleCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// 建筑本地坐标 → ENU 变换
// ---------------------------------------------------------------------------

/** 村中心 ENU→ECEF 矩阵（延迟缓存：布局阶段同步需要） */
let _villageEnuMatrix = null;
function villageEnuMatrix() {
  if (!_villageEnuMatrix) {
    _villageEnuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(VILLAGE_CENTER.lon, VILLAGE_CENTER.lat, 0),
    );
  }
  return _villageEnuMatrix;
}

/**
 * ENU 是村中心的切平面：距离中心 d 米处，切平面比椭球面高 d²/(2R)（3km 处约 0.7m）。
 * 为了让建筑精确落在 heightAtLocal 的椭球高上（而不是整体被抬 0.5m），
 * 生成几何时把内容 z 减去曲率抬升量：z_content = groundHeight - (h_tangent - groundHeight)。
 * 用一次牛顿式校正即可到 mm 级。
 */
function compensatedBaseZ(b) {
  const matrix = villageEnuMatrix();
  const point = new Cesium.Cartesian3(b.localX, b.localY, b.groundHeight);
  const ecef = Cesium.Matrix4.multiplyByPoint(matrix, point, new Cesium.Cartesian3());
  const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(ecef, new Cesium.Cartographic());
  const tangentHeight = carto ? carto.height : b.groundHeight;
  return b.groundHeight - (tangentHeight - b.groundHeight);
}

/** 本地坐标系：x' 沿街（面宽），y' 沿进深，z = 相对 groundHeight 的高度 */
function makeFrame(b) {
  const cos = Math.cos(b.rotation);
  const sin = Math.sin(b.rotation);
  const ox = b.localX;
  const oy = b.localY;
  const oz = b._baseZ ?? b.groundHeight;
  return (lx, ly, lz) => [ox + lx * cos - ly * sin, oy + lx * sin + ly * cos, oz + lz];
}

/** 本地坐标下的轴对齐长方体，返回 6 个面（外法线朝外的顶点顺序） */
function boxFaces(x0, x1, y0, y1, z0, z1) {
  return {
    front: [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    back: [
      [x1, y1, z0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x1, y1, z1],
    ],
    west: [
      [x0, y1, z0],
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
    ],
    east: [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    top: [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    bottom: [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y0, z0],
      [x0, y0, z0],
    ],
  };
}

function addLocalFace(mesh, frame, pts, color, batchId) {
  mesh.addPolygon(
    pts.map((p) => frame(p[0], p[1], p[2])),
    color,
    batchId,
  );
}

function addLocalBox(mesh, frame, { x0, x1, y0, y1, z0, z1, color, batchId, faces = 'all' }) {
  const f = boxFaces(x0, x1, y0, y1, z0, z1);
  const which =
    faces === 'all' ? ['front', 'back', 'west', 'east', 'top', 'bottom'] : faces;
  for (const key of which) addLocalFace(mesh, frame, f[key], color, batchId);
}

// ---------------------------------------------------------------------------
// 门窗 / 阳台（通用）
// ---------------------------------------------------------------------------

/**
 * 在矩形棱柱的立面上逐层布置窗。
 * 顶点顺序保证外法线朝外（front=-y / back=+y / west=-x / east=+x）。
 */
function addWindows(mesh, frame, batchId, o) {
  const {
    width,
    depth,
    zBottom,
    floors,
    floorH,
    winW,
    winH,
    color,
    out = 0.055,
    maxLong = 3,
    maxShort = 2,
    skipFirstFloorCenterFront = false,
    frontSign = 1,
    zTop = Infinity,
    faces = 'all',
  } = o;
  const hw = width / 2;
  const hd = depth / 2;
  const frontFaceKey = frontSign >= 0 ? 'back' : 'front';
  const longCount = Math.max(1, Math.min(maxLong, Math.floor((width - 1.4) / 2.35)));
  const shortCount = Math.max(1, Math.min(maxShort, Math.floor((depth - 1.4) / 2.4)));
  const allFaces = [
    { key: 'front', len: width, count: longCount },
    { key: 'back', len: width, count: longCount },
    { key: 'west', len: depth, count: shortCount },
    { key: 'east', len: depth, count: shortCount },
  ];
  const faceList = faces === 'frontback' ? allFaces.slice(0, 2) : allFaces;

  for (const face of faceList) {
    for (let f = 0; f < floors; f++) {
      const zc = zBottom + (f + 0.56) * floorH;
      const z0 = zc - winH / 2;
      const z1 = zc + winH / 2;
      if (z1 > zTop || z1 > zBottom + floors * floorH + 0.2) continue;
      for (let i = 0; i < face.count; i++) {
        const along = -face.len / 2 + ((i + 0.5) * face.len) / face.count;
        if (f === 0 && face.key === frontFaceKey && skipFirstFloorCenterFront) {
          const mid = (face.count - 1) / 2;
          if (Math.abs(i - mid) < 0.6) continue;
        }
        if (face.key === 'front' || face.key === 'back') {
          const x = along;
          const sign = face.key === 'front' ? -1 : 1;
          const y = sign * (hd + out);
          const pts =
            sign < 0
              ? [
                  [x - winW / 2, y, z0],
                  [x + winW / 2, y, z0],
                  [x + winW / 2, y, z1],
                  [x - winW / 2, y, z1],
                ]
              : [
                  [x + winW / 2, y, z0],
                  [x - winW / 2, y, z0],
                  [x - winW / 2, y, z1],
                  [x + winW / 2, y, z1],
                ];
          addLocalFace(mesh, frame, pts, color, batchId);
        } else {
          const y = along;
          const sign = face.key === 'west' ? -1 : 1;
          const x = sign * (hw + out);
          const pts =
            sign < 0
              ? [
                  [x, y + winW / 2, z0],
                  [x, y - winW / 2, z0],
                  [x, y - winW / 2, z1],
                  [x, y + winW / 2, z1],
                ]
              : [
                  [x, y - winW / 2, z0],
                  [x, y + winW / 2, z0],
                  [x, y + winW / 2, z1],
                  [x, y - winW / 2, z1],
                ];
          addLocalFace(mesh, frame, pts, color, batchId);
        }
      }
    }
  }
}

/** 正立面大门（可指定所在棱柱尺寸，用于裙楼等） */
function addDoorOnFacade(mesh, frame, batchId, o) {
  const { width, depth, facing, z0, height, doorWidth, color, out = 0.06 } = o;
  const frontSign = facing >= 0 ? 1 : -1;
  const y = frontSign * (depth / 2 + out);
  const z1 = z0 + height;
  const x0 = -doorWidth / 2;
  const x1 = doorWidth / 2;
  const pts =
    frontSign > 0
      ? [
          [x1, y, z0],
          [x0, y, z0],
          [x0, y, z1],
          [x1, y, z1],
        ]
      : [
          [x0, y, z0],
          [x1, y, z0],
          [x1, y, z1],
          [x0, y, z1],
        ];
  addLocalFace(mesh, frame, pts, color, batchId);
  void width;
}

/** 公寓/酒店的横向阳台带（正立面每层一块板 + 栏杆） */
function addBalconies(mesh, frame, b, batchId, { zBottom, floors, floorH, balconyColor }) {
  const hd = b.depth / 2;
  const frontSign = b.facing >= 0 ? 1 : -1;
  const slabColor = hexToLinear(balconyColor || '#cfcdc5', 1);
  const railColor = hexToLinear(balconyColor || '#cfcdc5', 0.8);
  const bw = Math.max(3, b.width * 0.78);
  const yInner = frontSign * hd;
  const yOuter = frontSign * (hd + 0.85);
  const y0 = Math.min(yInner, yOuter);
  const y1 = Math.max(yInner, yOuter);

  for (let f = 1; f < floors; f++) {
    const z = zBottom + f * floorH - 0.08;
    // 一条整体阳台带（板+栏合一，10 三角面/层），控制总三角面预算
    addLocalBox(mesh, frame, {
      x0: -bw / 2,
      x1: bw / 2,
      y0,
      y1,
      z0: z - 0.1,
      z1: z + 0.92,
      color: f % 2 === 0 ? railColor : slabColor,
      batchId,
      faces: ['front', 'back', 'west', 'east', 'top'],
    });
  }
}

// ---------------------------------------------------------------------------
// 通用：台基 + 墙体
// ---------------------------------------------------------------------------

function plinthTopLocal(b) {
  return Math.max(0.2, b.maxGround - b.groundHeight) + 0.32;
}

function foundationBottomLocal(b) {
  const groundMin = b.kind === 'pier' ? b.pierGroundMin ?? b.minGround : b.minGround;
  return groundMin - FOUNDATION_DEPTH - b.groundHeight;
}

/** 台基（下埋到基础底）+ 墙体（台基顶到 eave） */
function addPlinthAndWalls(mesh, frame, b, batchId, o) {
  const { width, depth, zWallTop, pad = 0.16, wallColor, plinthColor } = o;
  const hw = width / 2;
  const hd = depth / 2;
  const zBottom = foundationBottomLocal(b);
  const zPlinthTop = plinthTopLocal(b);

  addLocalBox(mesh, frame, {
    x0: -hw - pad,
    x1: hw + pad,
    y0: -hd - pad,
    y1: hd + pad,
    z0: zBottom,
    z1: zPlinthTop,
    color: plinthColor,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top'],
  });
  addLocalBox(mesh, frame, {
    x0: -hw,
    x1: hw,
    y0: -hd,
    y1: hd,
    z0: zPlinthTop - 0.02,
    z1: zWallTop,
    color: wallColor,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });
}

// ---------------------------------------------------------------------------
// 屋顶
// ---------------------------------------------------------------------------

/** 双坡屋顶（ridge 沿 x'，檐口朝街道两侧） */
function addGableRoof(mesh, frame, b, batchId, { eaveZ, trimColor }) {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const over = 0.7;
  const W2 = hw + over;
  const D2 = hd + over;
  const zRidge = eaveZ + b.roofHeight;
  const roofColor = b._roofColorLinear;
  const wallColor = b._wallColorLinear;

  // 檐口封板
  addLocalBox(mesh, frame, {
    x0: -hw - 0.4,
    x1: hw + 0.4,
    y0: -hd - 0.4,
    y1: hd + 0.4,
    z0: eaveZ - 0.3,
    z1: eaveZ - 0.02,
    color: trimColor,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });

  // 两坡面
  addLocalFace(
    mesh,
    frame,
    [
      [-W2, -D2, eaveZ],
      [W2, -D2, eaveZ],
      [W2, 0, zRidge],
      [-W2, 0, zRidge],
    ],
    roofColor,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [-W2, D2, eaveZ],
      [-W2, 0, zRidge],
      [W2, 0, zRidge],
      [W2, D2, eaveZ],
    ],
    roofColor,
    batchId,
  );

  // 山墙（两端三角）
  addLocalFace(
    mesh,
    frame,
    [
      [-hw, -hd, eaveZ],
      [-hw, 0, zRidge],
      [-hw, hd, eaveZ],
    ],
    wallColor,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [hw, -hd, eaveZ],
      [hw, hd, eaveZ],
      [hw, 0, zRidge],
    ],
    wallColor,
    batchId,
  );

  // 挑檐底面（向下）
  const zSoffit = eaveZ - 0.02;
  addLocalFace(
    mesh,
    frame,
    [
      [-W2, -D2, zSoffit],
      [-W2, -hd, zSoffit],
      [W2, -hd, zSoffit],
      [W2, -D2, zSoffit],
    ],
    trimColor,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [-W2, D2, zSoffit],
      [W2, D2, zSoffit],
      [W2, hd, zSoffit],
      [-W2, hd, zSoffit],
    ],
    trimColor,
    batchId,
  );

  // 屋脊压顶
  addLocalBox(mesh, frame, {
    x0: -W2,
    x1: W2,
    y0: -0.3,
    y1: 0.3,
    z0: zRidge - 0.16,
    z1: zRidge + 0.12,
    color: trimColor,
    batchId,
    faces: ['front', 'back', 'top'],
  });
}

/** 平屋顶：挑檐板 + 屋顶设备（楼梯间/水箱） */
function addFlatRoof(mesh, frame, b, batchId, { eaveZ, roofColor }) {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const over = 0.42;
  addLocalBox(mesh, frame, {
    x0: -hw - over,
    x1: hw + over,
    y0: -hd - over,
    y1: hd + over,
    z0: eaveZ - 0.12,
    z1: eaveZ + 0.62,
    color: roofColor,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
  });
  if (b.roofEquipment) {
    const eqW = Math.min(6.5, Math.max(2.8, b.width * 0.32));
    const eqD = Math.min(5.2, Math.max(2.6, b.depth * 0.32));
    addLocalBox(mesh, frame, {
      x0: -eqW / 2 + b.width * 0.16,
      x1: eqW / 2 + b.width * 0.16,
      y0: -eqD / 2,
      y1: eqD / 2,
      z0: eaveZ + 0.62,
      z1: eaveZ + 0.62 + Math.min(3.0, b.floorHeight),
      color: hexToLinear(b.wallColor, 0.84),
      batchId,
      faces: ['front', 'back', 'west', 'east', 'top'],
    });
  }
}

// ---------------------------------------------------------------------------
// 各类建筑的完整几何
// ---------------------------------------------------------------------------

function addGableBuildingGeometry(mesh, b, batchId) {
  const frame = makeFrame(b);
  const eaveZ = b.eaveHeight;
  const zPlinthTop = plinthTopLocal(b);

  addPlinthAndWalls(mesh, frame, b, batchId, {
    width: b.width,
    depth: b.depth,
    zWallTop: eaveZ,
    wallColor: b._wallColorLinear,
    plinthColor: b._plinthColorLinear,
  });
  addGableRoof(mesh, frame, b, batchId, { eaveZ, trimColor: b._trimColorLinear });

  addWindows(mesh, frame, batchId, {
    width: b.width,
    depth: b.depth,
    zBottom: zPlinthTop - 0.02,
    floors: b.floors,
    floorH: b.floorHeight,
    winW: 1.35,
    winH: 1.55,
    color: b._windowColorLinear,
    maxLong: 3,
    maxShort: 2,
    faces: 'frontback',
    skipFirstFloorCenterFront: true,
    frontSign: b.facing >= 0 ? 1 : -1,
    zTop: eaveZ - 0.3,
  });
  addDoorOnFacade(mesh, frame, batchId, {
    width: b.width,
    depth: b.depth,
    facing: b.facing,
    z0: zPlinthTop + 0.02,
    height: Math.min(2.35, b.floorHeight - 0.35),
    doorWidth: 1.9,
    color: b._doorColorLinear,
  });
}

function addFlatBuildingGeometry(mesh, b, batchId) {
  const frame = makeFrame(b);
  const eaveZ = b.eaveHeight;
  const zPlinthTop = plinthTopLocal(b);

  addPlinthAndWalls(mesh, frame, b, batchId, {
    width: b.width,
    depth: b.depth,
    zWallTop: eaveZ,
    wallColor: b._wallColorLinear,
    plinthColor: b._plinthColorLinear,
  });
  addFlatRoof(mesh, frame, b, batchId, { eaveZ, roofColor: b._roofColorLinear });

  if (b.balconies) {
    addBalconies(mesh, frame, b, batchId, {
      zBottom: zPlinthTop,
      floors: b.floors,
      floorH: b.floorHeight,
      balconyColor: b.balconyColor,
    });
  }

  addWindows(mesh, frame, batchId, {
    width: b.width,
    depth: b.depth,
    zBottom: zPlinthTop - 0.02,
    floors: b.floors,
    floorH: b.floorHeight,
    winW: b.kind === 'apartment' ? 1.45 : 1.3,
    winH: b.kind === 'apartment' ? 1.7 : 1.55,
    color: b._windowColorLinear,
    maxLong: b.kind === 'apartment' ? 4 : 3,
    maxShort: 2,
    faces: 'frontback',
    skipFirstFloorCenterFront: true,
    frontSign: b.facing >= 0 ? 1 : -1,
    zTop: eaveZ - 0.3,
  });
  addDoorOnFacade(mesh, frame, batchId, {
    width: b.width,
    depth: b.depth,
    facing: b.facing,
    z0: zPlinthTop + 0.02,
    height: Math.min(b.kind === 'apartment' ? 2.9 : 2.4, b.floorHeight - 0.35),
    doorWidth: b.kind === 'apartment' ? 2.8 : 2.0,
    color: b._doorColorLinear,
  });
}

/** 地标塔楼：裙楼 + 塔身 + 屋顶设备/桅杆 + 竖向装饰带 */
function addTowerGeometry(mesh, b, batchId) {
  const frame = makeFrame(b);
  const podiumFloors = b.podiumFloors ?? 2;
  const totalFloors = b.totalFloors ?? b.floors;
  const towerFloors = Math.max(3, totalFloors - podiumFloors);
  const podiumExpand = 5.0;
  const pw = b.width + podiumExpand * 2;
  const pd = b.depth + podiumExpand * 2;
  const podiumH = podiumFloors * b.floorHeight;
  const eaveZ = b.eaveHeight;
  const zPlinthTop = plinthTopLocal(b);
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const zBottom = foundationBottomLocal(b);
  const frontSign = b.facing >= 0 ? 1 : -1;

  // 裙楼台基
  addLocalBox(mesh, frame, {
    x0: -pw / 2 - 0.12,
    x1: pw / 2 + 0.12,
    y0: -pd / 2 - 0.12,
    y1: pd / 2 + 0.12,
    z0: zBottom,
    z1: zPlinthTop,
    color: b._plinthColorLinear,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top'],
  });
  // 裙楼墙体
  addLocalBox(mesh, frame, {
    x0: -pw / 2,
    x1: pw / 2,
    y0: -pd / 2,
    y1: pd / 2,
    z0: zPlinthTop - 0.02,
    z1: podiumH,
    color: b._wallColorLinear,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });
  // 裙楼顶板
  addLocalBox(mesh, frame, {
    x0: -pw / 2 - 0.5,
    x1: pw / 2 + 0.5,
    y0: -pd / 2 - 0.5,
    y1: pd / 2 + 0.5,
    z0: podiumH - 0.1,
    z1: podiumH + 0.35,
    color: b._roofColorLinear,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
  });
  // 塔身
  addLocalBox(mesh, frame, {
    x0: -hw,
    x1: hw,
    y0: -hd,
    y1: hd,
    z0: podiumH + 0.2,
    z1: eaveZ,
    color: b._wallColorLinear,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });
  // 竖向装饰/玻璃带（正立面居中）
  const accentColor = hexToLinear(b.accentColor || '#55707c', 1);
  const bandW = Math.min(7.5, Math.max(4, b.width * 0.42));
  const bandZ0 = podiumH + 0.35;
  const bandZ1 = eaveZ - 0.4;
  const yFace = frontSign * (hd + 0.09);
  addLocalBox(mesh, frame, {
    x0: -bandW / 2,
    x1: bandW / 2,
    y0: Math.min(yFace, yFace + frontSign * 0.16),
    y1: Math.max(yFace, yFace + frontSign * 0.16),
    z0: bandZ0,
    z1: bandZ1,
    color: accentColor,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });
  // 屋顶板 + 设备 + 桅杆
  addLocalBox(mesh, frame, {
    x0: -hw - 0.5,
    x1: hw + 0.5,
    y0: -hd - 0.5,
    y1: hd + 0.5,
    z0: eaveZ - 0.1,
    z1: eaveZ + 0.72,
    color: b._roofColorLinear,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
  });
  addLocalBox(mesh, frame, {
    x0: -3.0,
    x1: 1.2,
    y0: -2.2,
    y1: 1.6,
    z0: eaveZ + 0.72,
    z1: eaveZ + 0.72 + 2.6,
    color: hexToLinear(b.wallColor, 0.82),
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top'],
  });
  if (b.antenna) {
    addLocalBox(mesh, frame, {
      x0: -0.16,
      x1: 0.16,
      y0: -0.16,
      y1: 0.16,
      z0: eaveZ + 0.72,
      z1: eaveZ + 0.72 + 6.0,
      color: hexToLinear('#9a9a96', 1),
      batchId,
      faces: ['front', 'back', 'west', 'east', 'top'],
    });
  }

  // 裙楼窗
  addWindows(mesh, frame, batchId, {
    width: pw,
    depth: pd,
    zBottom: zPlinthTop - 0.02,
    floors: podiumFloors,
    floorH: b.floorHeight,
    winW: 1.55,
    winH: 1.9,
    color: b._windowColorLinear,
    maxLong: 4,
    maxShort: 2,
    faces: 'frontback',
    skipFirstFloorCenterFront: true,
    frontSign: b.facing >= 0 ? 1 : -1,
    zTop: podiumH - 0.2,
  });
  // 塔身窗
  addWindows(mesh, frame, batchId, {
    width: b.width,
    depth: b.depth,
    zBottom: podiumH + 0.2,
    floors: towerFloors,
    floorH: b.floorHeight,
    winW: 1.45,
    winH: 1.75,
    color: b._windowColorLinear,
    maxLong: 3,
    maxShort: 2,
    faces: 'frontback',
    frontSign: b.facing >= 0 ? 1 : -1,
    zTop: eaveZ - 0.3,
  });
  // 裙楼主入口
  addDoorOnFacade(mesh, frame, batchId, {
    width: pw,
    depth: pd,
    facing: b.facing,
    z0: zPlinthTop + 0.02,
    height: Math.min(3.6, b.floorHeight - 0.3),
    doorWidth: 5.0,
    color: b._doorColorLinear,
  });
}

// ---------------------------------------------------------------------------
// 栈桥 / 码头几何（桥面、栏杆、桩基、小棚）
// ---------------------------------------------------------------------------

function addPierGeometry(mesh, b, batchId) {
  const frame = makeFrame(b);
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const wood = hexToLinear(b.wallColor, 1);
  const woodDark = hexToLinear(b.wallColor, 0.78);
  const roof = hexToLinear(b.roofColor, 1);

  const deckTop = (b.deckTop ?? b.groundHeight) - b.groundHeight;
  const deckThick = 0.4;
  const deckBottom = deckTop - deckThick;
  const railTop = deckTop + 1.05;
  const postBottom = (b.pierGroundMin ?? b.groundHeight) - 1.2 - b.groundHeight;

  // 桥面
  addLocalBox(mesh, frame, {
    x0: -hw,
    x1: hw,
    y0: -hd,
    y1: hd,
    z0: deckBottom,
    z1: deckTop,
    color: wood,
    batchId,
    faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
  });

  // 桩基（两排，按长度布点）
  const stiltRows = [-hw + 0.8, hw - 0.8];
  const stiltCount = Math.max(2, Math.round(b.depth / 46));
  for (const sx of stiltRows) {
    for (let i = 0; i <= stiltCount; i++) {
      const y = -hd + 0.6 + ((b.depth - 1.2) * i) / stiltCount;
      addLocalBox(mesh, frame, {
        x0: sx - 0.17,
        x1: sx + 0.17,
        y0: y - 0.17,
        y1: y + 0.17,
        z0: postBottom,
        z1: deckBottom,
        color: woodDark,
        batchId,
        faces: ['front', 'back', 'west', 'east'],
      });
    }
  }

  // 两侧栏杆（上/中横杆 + 立柱）
  const railCount = Math.max(2, Math.round(b.depth / 42));
  for (const sideX of [-hw + 0.12, hw - 0.12]) {
    for (const [z0, z1] of [
      [railTop - 0.14, railTop],
    ]) {
      addLocalBox(mesh, frame, {
        x0: sideX - 0.06,
        x1: sideX + 0.06,
        y0: -hd + 0.1,
        y1: hd - 0.1,
        z0,
        z1,
        color: woodDark,
        batchId,
        faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
      });
    }
    for (let i = 0; i <= railCount; i++) {
      const y = -hd + 0.15 + ((b.depth - 0.3) * i) / railCount;
      addLocalBox(mesh, frame, {
        x0: sideX - 0.07,
        x1: sideX + 0.07,
        y0: y - 0.07,
        y1: y + 0.07,
        z0: deckTop,
        z1: railTop,
        color: woodDark,
        batchId,
        faces: ['front', 'back', 'west', 'east'],
      });
    }
  }
  // 海端横杆
  for (const [z0, z1] of [
    [railTop - 0.12, railTop],
    [railTop - 0.62, railTop - 0.52],
  ]) {
    addLocalBox(mesh, frame, {
      x0: -hw + 0.1,
      x1: hw - 0.1,
      y0: hd - 0.14,
      y1: hd - 0.02,
      z0,
      z1,
      color: woodDark,
      batchId,
      faces: ['front', 'back', 'west', 'east', 'top', 'bottom'],
    });
  }

  // 岸端小棚（候船/储物）
  const hutW = Math.min(3.6, b.width * 0.78);
  const hutD = Math.min(4.2, b.depth * 0.2);
  const hutCenterY = -hd + hutD / 2 + 0.6;
  const hutZ0 = deckTop;
  const hutZ1 = deckTop + 2.25;
  const hutWall = hexToLinear(b.wallColor, 0.92);
  addLocalBox(mesh, frame, {
    x0: -hutW / 2,
    x1: hutW / 2,
    y0: hutCenterY - hutD / 2,
    y1: hutCenterY + hutD / 2,
    z0: hutZ0,
    z1: hutZ1,
    color: hutWall,
    batchId,
    faces: ['front', 'back', 'west', 'east'],
  });
  const hw2 = hutW / 2 + 0.45;
  const hd2 = hutD / 2 + 0.45;
  const ridgeZ = hutZ1 + 0.85;
  addLocalFace(
    mesh,
    frame,
    [
      [-hw2, hutCenterY - hd2, hutZ1],
      [hw2, hutCenterY - hd2, hutZ1],
      [hw2, hutCenterY, ridgeZ],
      [-hw2, hutCenterY, ridgeZ],
    ],
    roof,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [-hw2, hutCenterY + hd2, hutZ1],
      [-hw2, hutCenterY, ridgeZ],
      [hw2, hutCenterY, ridgeZ],
      [hw2, hutCenterY + hd2, hutZ1],
    ],
    roof,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [-hutW / 2, hutCenterY - hutD / 2, hutZ1],
      [-hutW / 2, hutCenterY, ridgeZ],
      [-hutW / 2, hutCenterY + hutD / 2, hutZ1],
    ],
    hutWall,
    batchId,
  );
  addLocalFace(
    mesh,
    frame,
    [
      [hutW / 2, hutCenterY - hutD / 2, hutZ1],
      [hutW / 2, hutCenterY + hutD / 2, hutZ1],
      [hutW / 2, hutCenterY, ridgeZ],
    ],
    hutWall,
    batchId,
  );
}

// ---------------------------------------------------------------------------
// 单栋建筑 → 几何（预处理颜色缓存）
// ---------------------------------------------------------------------------

const DOOR_COLOR = '#403126';

function prepareColors(b) {
  const tint = 0.9 + ((Math.abs(b.x * 7.13 + b.y * 3.71) % 1) * 0.2);
  b._wallColorLinear = hexToLinear(b.wallColor, tint);
  b._plinthColorLinear = hexToLinear(b.plinthColor, 0.94 + tint * 0.05);
  b._roofColorLinear = hexToLinear(b.roofColor, 0.95 + tint * 0.06);
  b._trimColorLinear = hexToLinear(b.roofColor, 0.78);
  b._windowColorLinear = hexToLinear('#2f3d48', 0.85 + tint * 0.18);
  b._doorColorLinear = hexToLinear(DOOR_COLOR, 1);
}

function addBuildingGeometry(mesh, b, batchId) {
  prepareColors(b);
  b._baseZ = compensatedBaseZ(b);
  switch (b.kind) {
    case 'pier':
      addPierGeometry(mesh, b, batchId);
      break;
    case 'landmark':
    case 'tower':
      addTowerGeometry(mesh, b, batchId);
      break;
    default:
      if (b.roofStyle === 'gable') addGableBuildingGeometry(mesh, b, batchId);
      else addFlatBuildingGeometry(mesh, b, batchId);
      break;
  }
}

// ---------------------------------------------------------------------------
// GLB 编码（glTF 2.0，单个 primitive，内嵌 BIN）
// ---------------------------------------------------------------------------

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

function alignUp(n, a) {
  return Math.ceil(n / a) * a;
}

/** ENU（x 东 / y 北 / z 上）→ glTF Y-up：x_g = x, y_g = z, z_g = -y */
function buildGlb(mesh) {
  const vertexCount = mesh.vertexCount;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4);
  const batchIds = new Float32Array(vertexCount);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    const gx = x;
    const gy = z;
    const gz = -y;
    positions[i * 3] = gx;
    positions[i * 3 + 1] = gy;
    positions[i * 3 + 2] = gz;
    if (gx < minX) minX = gx;
    if (gy < minY) minY = gy;
    if (gz < minZ) minZ = gz;
    if (gx > maxX) maxX = gx;
    if (gy > maxY) maxY = gy;
    if (gz > maxZ) maxZ = gz;

    const nx = mesh.normals[i * 3];
    const ny = mesh.normals[i * 3 + 1];
    const nz = mesh.normals[i * 3 + 2];
    normals[i * 3] = nx;
    normals[i * 3 + 1] = nz;
    normals[i * 3 + 2] = -ny;

    colors[i * 4] = mesh.colors[i * 4];
    colors[i * 4 + 1] = mesh.colors[i * 4 + 1];
    colors[i * 4 + 2] = mesh.colors[i * 4 + 2];
    colors[i * 4 + 3] = mesh.colors[i * 4 + 3];

    batchIds[i] = mesh.batchIds[i];
  }

  const useUint32 = vertexCount > 65535;
  const indices = useUint32 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices);

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let byteOffset = 0;

  function addView(typedArray, target, componentType, accessorType, count, extra = {}) {
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const pad = alignUp(byteOffset, 4) - byteOffset;
    if (pad > 0) {
      chunks.push(Buffer.alloc(pad));
      byteOffset += pad;
    }
    bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType,
      count,
      type: accessorType,
      ...extra,
    });
    chunks.push(bytes);
    byteOffset += bytes.length;
    return accessors.length - 1;
  }

  const POSITION = addView(positions, 34962, 5126, 'VEC3', vertexCount, {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  });
  const NORMAL = addView(normals, 34962, 5126, 'VEC3', vertexCount);
  const COLOR_0 = addView(colors, 34962, 5126, 'VEC4', vertexCount);
  const BATCH_ID = addView(batchIds, 34962, 5126, 'SCALAR', vertexCount);
  const INDEX_ACCESSOR = addView(
    indices,
    34963,
    useUint32 ? 5125 : 5123,
    'SCALAR',
    indices.length,
  );

  let binLength = byteOffset;
  const binPad = alignUp(binLength, 4) - binLength;
  if (binPad > 0) {
    chunks.push(Buffer.alloc(binPad));
    binLength += binPad;
  }
  const bin = Buffer.concat(chunks);
  const binUnpadded = byteOffset;

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'flood-sim generate-village-tiles.mjs (procedural town)',
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'lan-yu-harbor' }],
    meshes: [
      {
        name: 'town',
        primitives: [
          {
            attributes: { POSITION, NORMAL, COLOR_0, _BATCHID: BATCH_ID },
            indices: INDEX_ACCESSOR,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'town-pbr',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.05,
          roughnessFactor: 0.85,
        },
        doubleSided: false,
      },
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binUnpadded }],
  };

  let jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = alignUp(jsonBuf.length, 4) - jsonBuf.length;
  if (jsonPad > 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);

  const totalLength = 12 + 8 + jsonBuf.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);

  const glbFinal = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, bin]);
  return {
    buffer: glbFinal,
    json: gltf,
    stats: {
      vertexCount,
      indexCount: indices.length,
      indexType: useUint32 ? 'u32' : 'u16',
      glbLength: glbFinal.length,
    },
  };
}

// ---------------------------------------------------------------------------
// b3dm 封装（3D Tiles 1.0）
// ---------------------------------------------------------------------------

/** JSON 段转 buffer，并在末尾补空格使 startOffset + len 对齐到 8 字节 */
function paddedJsonSection(obj, startOffset) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const pad = (8 - ((startOffset + json.length) % 8)) % 8;
  return Buffer.concat([json, Buffer.alloc(pad, 0x20)]);
}

function buildB3dm(glbBuffer, buildings) {
  const batchLength = buildings.length;

  const featureTableJson = paddedJsonSection({ BATCH_LENGTH: batchLength }, 28);
  const featureTableBinary = Buffer.alloc(0);

  const batchTableObj = {
    id: buildings.map((b) => b.id),
    name: buildings.map((b) => b.name),
    type: buildings.map((b) => b.type),
    kind: buildings.map((b) => b.kind),
    height: buildings.map((b) => b.height),
    floors: buildings.map((b) => b.floors),
    minGround: buildings.map((b) => b.minGround),
    area: buildings.map((b) => b.footprintArea),
  };
  const batchTableStart = 28 + featureTableJson.length + featureTableBinary.length;
  const batchTableJson = paddedJsonSection(batchTableObj, batchTableStart);
  const batchTableBinary = Buffer.alloc(0);

  const totalLength =
    28 +
    featureTableJson.length +
    featureTableBinary.length +
    batchTableJson.length +
    batchTableBinary.length +
    glbBuffer.length;

  const header = Buffer.alloc(28);
  header.write('b3dm', 0, 'ascii');
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(totalLength, 8);
  header.writeUInt32LE(featureTableJson.length, 12);
  header.writeUInt32LE(featureTableBinary.length, 16);
  header.writeUInt32LE(batchTableJson.length, 20);
  header.writeUInt32LE(batchTableBinary.length, 24);

  return Buffer.concat([
    header,
    featureTableJson,
    featureTableBinary,
    batchTableJson,
    batchTableBinary,
    glbBuffer,
  ]);
}

// ---------------------------------------------------------------------------
// 多 tile tileset.json（root transform = 村庄中心 ENU）
// ---------------------------------------------------------------------------

function boxFromBounds(bounds, pad = 0.5) {
  const [min, max] = [bounds.min, bounds.max];
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const hx = (max[0] - min[0]) / 2 + pad;
  const hy = (max[1] - min[1]) / 2 + pad;
  const hz = (max[2] - min[2]) / 2 + pad;
  return [cx, cy, cz, hx, 0, 0, 0, hy, 0, 0, 0, hz];
}

function unionBounds(list) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of list) {
    for (let i = 0; i < 3; i++) {
      if (b.min[i] < min[i]) min[i] = b.min[i];
      if (b.max[i] > max[i]) max[i] = b.max[i];
    }
  }
  return { min, max };
}

function buildTileset(layout, tiles) {
  const enuToEcef = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(VILLAGE_CENTER.lon, VILLAGE_CENTER.lat, 0),
  );
  const transform = Array.from(Cesium.Matrix4.toArray(enuToEcef));
  const allBounds = unionBounds(tiles.map((t) => t.mesh.bounds));

  // 空根 tile：geometricError 取大值，保证任意观察距离都会细化到 children
  return {
    asset: {
      version: '1.0',
      tilesetVersion: `lan-yu-harbor-v${LAYOUT_VERSION}-seed${layout.seed}`,
      gltfUpAxis: 'Y',
    },
    geometricError: 4096,
    root: {
      transform,
      boundingVolume: { box: boxFromBounds(allBounds, 2.0) },
      geometricError: 4096,
      refine: 'ADD',
      children: tiles.map((t) => ({
        name: t.id,
        boundingVolume: { box: boxFromBounds(t.mesh.bounds, 0.5) },
        geometricError: 0,
        content: { uri: t.uri },
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// buildings.json / roads.json
// ---------------------------------------------------------------------------

function buildBuildingsJson(layout) {
  const districts = {};
  for (const d of TOWN.districts) {
    districts[d.id] = {
      name: d.name,
      centerLocal: {
        x: Math.round((d.center.x - VILLAGE_CENTER.x) * 100) / 100,
        y: Math.round((d.center.y - VILLAGE_CENTER.y) * 100) / 100,
      },
      count: 0,
    };
  }
  for (const b of layout.buildings) {
    if (districts[b.district]) districts[b.district].count += 1;
  }
  return {
    generatedAt: GENERATED_AT,
    tileset: TILESET_URI,
    villageCenter: {
      lon: VILLAGE_CENTER.lon,
      lat: VILLAGE_CENTER.lat,
    },
    town: {
      name: TOWN.name,
      style: 'mountain-foot old town + coastal harbor district',
      districts,
    },
    buildings: layout.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      kind: b.kind,
      district: b.district,
      lon: b.lon,
      lat: b.lat,
      localX: b.localX,
      localY: b.localY,
      groundHeight: b.groundHeight,
      height: b.height,
      floors: b.floors,
      footprintArea: b.footprintArea,
      rotation: b.rotation,
      minGround: b.minGround,
    })),
  };
}

function buildRoadsJson(layout) {
  return {
    generatedAt: GENERATED_AT,
    villageCenter: { lon: VILLAGE_CENTER.lon, lat: VILLAGE_CENTER.lat },
    coordinateSystem:
      'points 为 terrainModel.js 场景局部米（x=东, y=北，原点 SCENE 中心，可直接用于地表贴图 / Cesium 局部坐标）；localPoints 为相对村庄中心的 ENU 米（= points - 村庄中心，与 buildings.json 的 localX/localY 同坐标系）。',
    roads: layout.roads.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      surface: r.surface,
      width: r.width,
      length: r.length,
      points: r.points.map((p) => ({ x: p.x, y: p.y })),
      localPoints: r.points.map((p) => ({
        x: Math.round((p.x - VILLAGE_CENTER.x) * 100) / 100,
        y: Math.round((p.y - VILLAGE_CENTER.y) * 100) / 100,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

function readB3dm(buf) {
  if (buf.length < 28) throw new Error('b3dm 长度不足 28 字节');
  const magic = buf.toString('ascii', 0, 4);
  const version = buf.readUInt32LE(4);
  const byteLength = buf.readUInt32LE(8);
  const ftJsonLen = buf.readUInt32LE(12);
  const ftBinLen = buf.readUInt32LE(16);
  const btJsonLen = buf.readUInt32LE(20);
  const btBinLen = buf.readUInt32LE(24);
  const glbOffset = 28 + ftJsonLen + ftBinLen + btJsonLen + btBinLen;
  const ftJson = JSON.parse(buf.toString('utf8', 28, 28 + ftJsonLen));
  const btStart = 28 + ftJsonLen + ftBinLen;
  const btJson = JSON.parse(buf.toString('utf8', btStart, btStart + btJsonLen));
  return { magic, version, byteLength, ftJson, btJson, glbOffset };
}

/** 与 villageLayout.js 中一致的 2D OBB 相交检测（校验用） */
function obbOverlap2D(a, b, margin) {
  const axes = [
    [Math.cos(a.rotation), Math.sin(a.rotation)],
    [-Math.sin(a.rotation), Math.cos(a.rotation)],
    [Math.cos(b.rotation), Math.sin(b.rotation)],
    [-Math.sin(b.rotation), Math.cos(b.rotation)],
  ];
  const project = (rect, ax) => {
    const axA = [Math.cos(rect.rotation), Math.sin(rect.rotation)];
    const axB = [-Math.sin(rect.rotation), Math.cos(rect.rotation)];
    const r =
      Math.abs(axA[0] * ax[0] + axA[1] * ax[1]) * (rect.width / 2) +
      Math.abs(axB[0] * ax[0] + axB[1] * ax[1]) * (rect.depth / 2);
    return { c: rect.x * ax[0] + rect.y * ax[1], r };
  };
  for (const ax of axes) {
    const pa = project(a, ax);
    const pb = project(b, ax);
    if (Math.abs(pa.c - pb.c) > pa.r + pb.r + margin) return false;
  }
  return true;
}

function validateArtifacts({ layout, tiles, b3dmByTile, tileset, buildingsJson, roadsJson }) {
  const errors = [];
  const warn = [];

  // ---- 每个 b3dm ----
  const allIds = new Set();
  let totalTriangles = 0;
  let totalVertices = 0;
  for (const t of tiles) {
    const buf = b3dmByTile[t.id];
    const parsed = readB3dm(buf);
    const n = t.buildings.length;
    if (parsed.magic !== 'b3dm') errors.push(`${t.id}: magic 错误`);
    if (parsed.version !== 1) errors.push(`${t.id}: version 错误`);
    if (parsed.byteLength !== buf.length) errors.push(`${t.id}: byteLength 不符`);
    if (parsed.ftJson.BATCH_LENGTH !== n) errors.push(`${t.id}: BATCH_LENGTH != ${n}`);
    for (const key of ['id', 'name', 'type', 'kind', 'height', 'floors', 'minGround', 'area']) {
      const arr = parsed.btJson[key];
      if (!Array.isArray(arr)) errors.push(`${t.id}: batch table 缺 ${key}`);
      else if (arr.length !== n) errors.push(`${t.id}: batch table.${key} 长度不符`);
    }
    if (parsed.glbOffset % 8 !== 0) errors.push(`${t.id}: GLB 未 8 字节对齐`);
    const glbMagic = buf.toString('ascii', parsed.glbOffset, parsed.glbOffset + 4);
    if (glbMagic !== 'glTF') errors.push(`${t.id}: 内嵌 GLB magic 错误`);
    const glbLen = buf.readUInt32LE(parsed.glbOffset + 8);
    if (parsed.glbOffset + glbLen !== buf.length) errors.push(`${t.id}: GLB 长度不符`);
    if (buf.length > BUDGET.b3dmBytes) {
      errors.push(`${t.id}: b3dm ${(buf.length / 1048576).toFixed(2)}MB 超预算`);
    }
    const glb = t.glb.json;
    const prim = glb.meshes[0].primitives[0];
    if (!('_BATCHID' in prim.attributes)) errors.push(`${t.id}: 缺 _BATCHID`);
    const batchAcc = glb.accessors[prim.attributes._BATCHID];
    if (batchAcc.type !== 'SCALAR' || batchAcc.componentType !== 5126) {
      errors.push(`${t.id}: _BATCHID 必须 SCALAR f32`);
    }
    const posAcc = glb.accessors[prim.attributes.POSITION];
    if (!posAcc.min || !posAcc.max) errors.push(`${t.id}: POSITION 缺 min/max`);
    // glTF Y-up → 3D Tiles Z-up 的反变换：ENU = (gx, -gz, gy)
    const acc = t.glb.json.accessors[t.glb.json.meshes[0].primitives[0].attributes.POSITION];
    const enuMin = [acc.min[0], -acc.max[2], acc.min[1]];
    const enuMax = [acc.max[0], -acc.min[2], acc.max[1]];
    const eb = t.mesh.bounds;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(enuMin[k] - eb.min[k]) > 0.01 || Math.abs(enuMax[k] - eb.max[k]) > 0.01) {
        errors.push(`${t.id}: glTF 位置反变换后包围盒与网格不一致（轴 ${k}）`);
      }
    }
    // batch table 数值与布局一致（抽样全部）
    for (let i = 0; i < n; i++) {
      const b = t.buildings[i];
      if (parsed.btJson.id[i] !== b.id) errors.push(`${t.id}: batch id[${i}] 不符`);
      if (Math.abs(parsed.btJson.minGround[i] - b.minGround) > 1e-6) {
        errors.push(`${t.id}: batch minGround[${i}] 不符`);
      }
      if (Math.abs(parsed.btJson.height[i] - b.height) > 1e-6) {
        errors.push(`${t.id}: batch height[${i}] 不符`);
      }
    }

    const uniqueLocal = new Set(t.mesh.batchIds.map((v) => Math.round(v)));
    if (uniqueLocal.size !== n) errors.push(`${t.id}: batchId 覆盖不全`);
    for (const id of parsed.btJson.id) {
      if (allIds.has(id)) errors.push(`重复 building id: ${id}`);
      allIds.add(id);
    }
    totalTriangles += t.mesh.triangleCount;
    totalVertices += t.mesh.vertexCount;
  }
  if (allIds.size !== layout.buildings.length) {
    errors.push(`b3dm batch id 并集 ${allIds.size} != 建筑总数 ${layout.buildings.length}`);
  }
  if (totalTriangles > BUDGET.triangles) {
    errors.push(`总三角面 ${totalTriangles} 超过预算 ${BUDGET.triangles}`);
  }
  if (layout.buildings.length < 1000 || layout.buildings.length > 1150) {
    errors.push(`建筑数量 ${layout.buildings.length} 不在 1000~1150 目标范围`);
  }
  if (tiles.length < BUDGET.tilesMin || tiles.length > BUDGET.tilesMax) {
    errors.push(`b3dm tile 数量 ${tiles.length} 不在 ${BUDGET.tilesMin}~${BUDGET.tilesMax}`);
  }
  const totalB3dmBytes = tiles.reduce((sum, t) => sum + t.b3dm.length, 0);
  if (totalB3dmBytes > BUDGET.totalB3dmBytes) {
    errors.push(`b3dm 总体积 ${(totalB3dmBytes / 1048576).toFixed(1)}MB 超过 15MB`);
  }

  // ---- tileset ----
  if (tileset.asset.version !== '1.0') errors.push('tileset asset.version != 1.0');
  if (!Array.isArray(tileset.root.transform) || tileset.root.transform.length !== 16) {
    errors.push('root.transform 不是 16 元素');
  }
  if (!Array.isArray(tileset.root.children) || tileset.root.children.length !== tiles.length) {
    errors.push('root.children 数量不符');
  }
  if (tileset.root.refine !== 'ADD') errors.push('root.refine 必须 ADD');
  for (const t of tiles) {
    const child = tileset.root.children.find((c) => c.content && c.content.uri === t.uri);
    if (!child) {
      errors.push(`${t.id}: tileset 缺 child`);
      continue;
    }
    const box = child.boundingVolume.box;
    if (!box || box.length !== 12) {
      errors.push(`${t.id}: child box 非法`);
      continue;
    }
    const [bcx, bcy, bcz, hx, , , , hy, , , , hz] = box;
    const min = t.mesh.bounds.min;
    const max = t.mesh.bounds.max;
    if (
      min[0] < bcx - hx - 0.01 || max[0] > bcx + hx + 0.01 ||
      min[1] < bcy - hy - 0.01 || max[1] > bcy + hy + 0.01 ||
      min[2] < bcz - hz - 0.01 || max[2] > bcz + hz + 0.01
    ) {
      errors.push(`${t.id}: child boundingVolume 未包住几何`);
    }
  }

  // ---- root.transform 往返：ENU(localX,localY,groundHeight) → ECEF → 经纬度 必须对上 ----
  {
    const matrix = Cesium.Matrix4.fromColumnMajorArray(tileset.root.transform, new Cesium.Matrix4());
    let maxLonErr = 0;
    let maxLatErr = 0;
    let maxHgtErr = 0;
    for (const b of layout.buildings) {
      // content 坐标的地面基准做了曲率补偿（b._baseZ），逆变换后应精确回到 heightAtLocal
      const enu = new Cesium.Cartesian3(b.localX, b.localY, b._baseZ ?? b.groundHeight);
      const ecef = Cesium.Matrix4.multiplyByPoint(matrix, enu, new Cesium.Cartesian3());
      const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(ecef);
      maxLonErr = Math.max(maxLonErr, Math.abs(Cesium.Math.toDegrees(carto.longitude) - b.lon));
      maxLatErr = Math.max(maxLatErr, Math.abs(Cesium.Math.toDegrees(carto.latitude) - b.lat));
      maxHgtErr = Math.max(maxHgtErr, Math.abs(carto.height - b.groundHeight));
    }
    if (maxLonErr > 1e-5 || maxLatErr > 1e-5 || maxHgtErr > 0.02) {
      errors.push(
        `root.transform 往返误差过大：lon ${maxLonErr.toExponential(2)}° lat ${maxLatErr.toExponential(2)}° h ${maxHgtErr.toFixed(3)}m`,
      );
    } else {
      var transformRoundtrip = {
        maxLonErrDeg: maxLonErr,
        maxLatErrDeg: maxLatErr,
        maxHeightErrM: maxHgtErr,
      };
    }
  }

  // ---- buildings.json ----
  const required = [
    'id', 'name', 'type', 'lon', 'lat', 'localX', 'localY',
    'groundHeight', 'height', 'floors', 'footprintArea', 'rotation', 'minGround',
  ];
  const validTypes = new Set(['house', 'shop', 'public', 'pier']);
  const validKinds = new Set(['house', 'shop', 'apartment', 'tower', 'public', 'landmark', 'pier']);
  for (const b of buildingsJson.buildings) {
    for (const key of required) if (b[key] === undefined) errors.push(`${b.id}: 缺字段 ${key}`);
    if (!validTypes.has(b.type)) errors.push(`${b.id}: type 非法 ${b.type}`);
    if (!validKinds.has(b.kind)) errors.push(`${b.id}: kind 非法 ${b.kind}`);
    const truth = heightAtLocal(VILLAGE_CENTER.x + b.localX, VILLAGE_CENTER.y + b.localY);
    if (Math.abs(truth - b.groundHeight) > 0.02) {
      errors.push(`${b.id}: groundHeight 与 heightAtLocal 不一致`);
    }
    if (b.kind === 'pier') {
      if (!(b.minGround >= 2 && b.minGround <= 10)) errors.push(`${b.id}: 栈桥 minGround 异常`);
    } else if (b.minGround > b.groundHeight + 0.001) {
      errors.push(`${b.id}: minGround > groundHeight`);
    }
    if (!(b.height > 2)) errors.push(`${b.id}: height 过小`);
    if (!(b.footprintArea > 10)) errors.push(`${b.id}: footprintArea 过小`);
    const lx = (b.lon - VILLAGE_CENTER.lon) * 99287;
    const ly = (b.lat - VILLAGE_CENTER.lat) * 110803;
    if (Math.abs(lx - b.localX) > 1.0 || Math.abs(ly - b.localY) > 1.0) {
      errors.push(`${b.id}: lon/lat 与 localX/localY 不匹配`);
    }
  }

  // ---- 类别 / 层数 / 高度约束 ----
  const kindCount = {};
  for (const b of layout.buildings) kindCount[b.kind] = (kindCount[b.kind] || 0) + 1;
  for (const b of layout.buildings) {
    if (b.kind === 'house') {
      if (b.floors < 3 || b.floors > 4) errors.push(`${b.id}: 民居层数 ${b.floors} 不在 3~4`);
      if (!(b.height >= 10 && b.height <= 14.2)) errors.push(`${b.id}: 民居高度 ${b.height} 不在 10~14m`);
      if (b.roofStyle !== 'gable') errors.push(`${b.id}: 民居不是坡屋顶`);
      if (!(b.width >= 12 && b.width <= 20)) errors.push(`${b.id}: 民居面宽 ${b.width} 不在 12~20m`);
    }
    if (b.kind === 'shop') {
      if (b.floors < 3 || b.floors > 8) errors.push(`${b.id}: 商铺层数 ${b.floors} 不在 3~8`);
    }
    if (b.kind === 'apartment') {
      if (b.floors < 10 || b.floors > 18) errors.push(`${b.id}: 公寓层数 ${b.floors} 不在 10~18`);
      if (!(b.height >= 30 && b.height <= 60)) errors.push(`${b.id}: 公寓高度 ${b.height} 不在 30~60m`);
    }
    if (b.kind === 'tower') {
      if (b.floors < 20 || b.floors > 40) errors.push(`${b.id}: CBD 塔楼层数 ${b.floors} 不在 20~40`);
      if (!(b.height >= 70 && b.height <= 150)) errors.push(`${b.id}: CBD 塔楼高度 ${b.height} 不在 70~150m`);
    }
    if (b.kind === 'landmark') {
      if (b.district === 'cbd') {
        if (b.floors < 40 || b.floors > 56) errors.push(`${b.id}: CBD 地标层数 ${b.floors} 不在 40~56`);
        if (!(b.height >= 150 && b.height <= 190)) errors.push(`${b.id}: CBD 地标高度 ${b.height} 不在 150~190m`);
      } else {
        if (b.floors < 18 || b.floors > 24) errors.push(`${b.id}: 地标层数 ${b.floors} 不在 18~24`);
        if (!(b.height >= 60 && b.height <= 90)) errors.push(`${b.id}: 地标高度 ${b.height} 不在 60~90m`);
      }
    }
  }
  if ((kindCount.landmark || 0) < 3) warn.push('地标少于 3 栋');
  if ((kindCount.apartment || 0) < 20) warn.push('公寓/酒店少于 20 栋');

  // ---- 建筑不重叠 ----
  const rects = layout.buildings.map((b) => ({
    x: b.localX, y: b.localY, width: b.width, depth: b.depth, rotation: b.rotation, id: b.id,
  }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (obbOverlap2D(rects[i], rects[j], 0.0)) {
        errors.push(`建筑重叠: ${rects[i].id} / ${rects[j].id}`);
      }
    }
  }

  // ---- roads.json ----
  if (roadsJson.roads.length < 45 || roadsJson.roads.length > 50) {
    errors.push(`道路数量 ${roadsJson.roads.length} 不在 45~50`);
  }
  for (const r of roadsJson.roads) {
    if (!(r.width > 0)) errors.push(`道路 ${r.id} 宽度非法`);
    if (r.points.length < 2) errors.push(`道路 ${r.id} 点数不足`);
    if (r.length <= 0) errors.push(`道路 ${r.id} 长度非法`);
    if (Math.abs(r.points[0].x - (r.localPoints[0].x + VILLAGE_CENTER.x)) > 0.02) {
      errors.push(`道路 ${r.id}: points 与 localPoints 不一致`);
    }
  }

  return { errors, warn, totalTriangles, totalVertices, kindCount, transformRoundtrip };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  const t0 = performance.now();
  console.log('■ 生成「澜屿市」（老城 + 西城 + 北城 + 滨海新区 + CBD）3D Tiles');
  console.log(`  种子: ${SEED}  输出: ${path.relative(APP_ROOT, OUT_DIR)}`);

  const layout = generateVillageLayout({ seed: SEED });
  const stats = layout.stats;
  console.log(
    `  布局: ${stats.buildingCount} 栋（民居 ${stats.byKind.house} / 商铺商住 ${stats.byKind.shop} / 公寓酒店 ${stats.byKind.apartment} / 公共 ${stats.byKind.public} / 地标 ${stats.byKind.landmark} / 码头 ${stats.byKind.pier}），道路 ${stats.roadCount} 条 ${stats.roadLength.toFixed(0)}m`,
  );
  console.log(
    `  分区: ${TOWN.districts.map((d) => `${d.name} ${stats.byDistrict[d.id]?.total ?? 0}`).join(' / ')}`,
  );

  // 分 tile 建网格 → GLB → b3dm
  const tiles = [];
  const b3dmByTile = {};
  for (const def of TILE_DEFS) {
    const buildings = layout.buildings.filter(def.filter);
    if (buildings.length === 0) continue;
    const mesh = new VillageMesh();
    buildings.forEach((b, idx) => addBuildingGeometry(mesh, b, idx));
    const glb = buildGlb(mesh);
    const b3dm = buildB3dm(glb.buffer, buildings);
    const tile = { id: def.id, uri: def.uri, buildings, mesh, glb, b3dm };
    tiles.push(tile);
    b3dmByTile[def.id] = b3dm;
  }

  const tileset = buildTileset(layout, tiles);
  const buildingsJson = buildBuildingsJson(layout);
  const roadsJson = buildRoadsJson(layout);

  const { errors, warn, totalTriangles, totalVertices, kindCount, transformRoundtrip } = validateArtifacts({
    layout, tiles, b3dmByTile, tileset, buildingsJson, roadsJson,
  });
  if (warn.length) for (const w of warn) console.warn(`  ⚠ ${w}`);
  if (errors.length) {
    console.error('\n✗ 校验失败：');
    for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
    if (errors.length > 40) console.error(`  ... 共 ${errors.length} 条`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // 清掉旧版本残留的 b3dm / JSON，避免 dist 或静态服务里出现过期 tile
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.b3dm')) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  const write = (name, content) => {
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, content);
    return { name, size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content) };
  };
  const files = [];
  files.push(write('tileset.json', `${JSON.stringify(tileset, null, 2)}\n`));
  for (const t of tiles) files.push(write(t.uri, t.b3dm));
  files.push(write('buildings.json', `${JSON.stringify(buildingsJson, null, 2)}\n`));
  files.push(write('roads.json', `${JSON.stringify(roadsJson, null, 2)}\n`));

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const bb = unionBounds(tiles.map((t) => t.mesh.bounds));
  const bbCx = (bb.min[0] + bb.max[0]) / 2;
  const bbCy = (bb.min[1] + bb.max[1]) / 2;
  const bbCz = (bb.min[2] + bb.max[2]) / 2;
  const worldCenter = Cesium.Cartesian3.fromDegrees(
    VILLAGE_CENTER.lon + bbCx / 99287,
    VILLAGE_CENTER.lat + bbCy / 110803,
    bbCz,
  );
  const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(worldCenter);
  const sphereRadius =
    Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) / 2;

  console.log('');
  console.log('  ── 几何 ──');
  console.log(
    `  顶点 ${totalVertices.toLocaleString()}  三角面 ${totalTriangles.toLocaleString()}  （预算 ${BUDGET.triangles.toLocaleString()}，余量 ${(BUDGET.triangles - totalTriangles).toLocaleString()}）`,
  );
  console.log(
    `  ENU 包围盒 x[${bb.min[0].toFixed(1)}, ${bb.max[0].toFixed(1)}] y[${bb.min[1].toFixed(1)}, ${bb.max[1].toFixed(1)}] z[${bb.min[2].toFixed(1)}, ${bb.max[2].toFixed(1)}]`,
  );
  console.log(
    `  世界中心 ${Cesium.Math.toDegrees(carto.longitude).toFixed(6)}, ${Cesium.Math.toDegrees(carto.latitude).toFixed(6)}  高 ${carto.height.toFixed(1)}m  半径 ${sphereRadius.toFixed(0)}m`,
  );
  console.log(
    `  地面高程 ${stats.groundRange.min} ~ ${stats.groundRange.max} m；minGround ${stats.minGroundRange.min} ~ ${stats.minGroundRange.max} m；最高 ${stats.heightMax} m`,
  );
  console.log('  ── 文件 ──');
  for (const f of files) console.log(`  ${f.name.padEnd(22)} ${kb(f.size).padStart(10)}`);
  console.log(`  ${'总计'.padEnd(22)} ${kb(files.reduce((s, f) => s + f.size, 0)).padStart(10)}`);
  console.log('  ── 分 tile ──');
  for (const t of tiles) {
    console.log(
      `  ${t.uri.padEnd(22)} ${String(t.buildings.length).padStart(3)} 栋  ${kb(t.b3dm.length).padStart(10)}  三角面 ${t.mesh.triangleCount.toLocaleString()}`,
    );
  }
  console.log('  ── 校验 ──');
  console.log('  ✓ 每个 b3dm：header / JSON / BATCH_LENGTH / 8 字节对齐 / GLB / _BATCHID / batch table');
  console.log('  ✓ tileset：root.transform / children 数 / 每个 child 包围盒包住几何');
  console.log('  ✓ buildings.json：schema 字段 / groundHeight=heightAtLocal / 经纬度一致 / 层数高度区间');
  if (transformRoundtrip) {
    console.log(
      `  ✓ root.transform 往返：lon ≤${transformRoundtrip.maxLonErrDeg.toExponential(1)}° lat ≤${transformRoundtrip.maxLatErrDeg.toExponential(1)}° 高 ≤${transformRoundtrip.maxHeightErrM.toFixed(3)}m`,
    );
  }
  console.log('  ✓ GLB Y-up→Z-up 反变换包围盒一致 / batch table 数值逐栋一致');
  console.log(
    `  ✓ 建筑互不重叠 / 数量 ${kindCount.house}+${kindCount.shop}+${kindCount.apartment}+${kindCount.public}+${kindCount.landmark}+${kindCount.pier}`,
  );
  console.log(`\n✓ 完成，耗时 ${(performance.now() - t0).toFixed(0)} ms`);
}

main();
