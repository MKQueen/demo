/**
 * floors.js —— 楼层分层数据 / GLB 楼带切分 / 2D 平面布局生成
 *
 * 数据来源与推算规则：
 *   - 楼座平面尺寸、结构楼高、几何顶标高来自模型构建脚本 scripts/build_model.py（Blender 导出 GLB）。
 *     A(-27,-28) 23×25 H57 / B(-27,0) 19×31 H41 / C(-27,28) 23×25 H57
 *     F(27,-28) 23×25 H60 / E(27,0) 19×31 H43 / D(27,28) 23×25 H60
 *   - 模型立面窗列自 11.20 m 起、间距 3.35 m，据此把 3.35 m 作为标准层高。
 *   - 基座大堂 0–7.50 m；标准层从 7.50 m 起每 3.35 m 一层；顶部一层为设备/避难层，
 *     结构楼高以上（屋面机房、女儿墙、栏杆）并入屋顶机房层。
 *
 * 重要声明：本模块推算出的层数、面积、分区均为「按模型高度与层高估算的示意数据」，
 * 不是测绘 / BIM / 竣工图数据，2D 平面布局为示意分区。
 */
import * as THREE from 'three';

export const FLOOR_HEIGHT = 3.35; // 标准层高（m），依据立面窗列间距
export const LOBBY_HEIGHT = 7.5; // 基座大堂层高（m），依据首层拱券与 7.5 m 线脚
export const EXPLODE_GAP = 1.9; // 炸开时每层沿 Y 轴的间距（m）

/** 六座塔楼：与 build_model.py 一致（x/z 为平面中心，w/d 为平面尺寸，H 为结构楼高，top 为几何顶） */
export const TOWERS = {
  A: {
    id: 'A', label: 'A 座', x: -27, z: -28, w: 23, d: 25, H: 57, top: 64.6,
    entrance: 'west', loc: '西北侧 · 北部塔楼',
    desc: '西侧建筑群北端。重叠檐口与顶部拱窗强调塔楼轮廓，浅色石材延续整组建筑的古典语汇。',
  },
  B: {
    id: 'B', label: 'B 座', x: -27, z: 0, w: 19, d: 31, H: 41, top: 42.71,
    entrance: 'west', loc: '西侧 · 中部楼座',
    desc: '位于 A、C 座之间，较低体量形成高低错落的天际线。中央高拱玻璃窗构成西侧立面的视觉中心。',
  },
  C: {
    id: 'C', label: 'C 座', x: -27, z: 28, w: 23, d: 25, H: 57, top: 64.6,
    entrance: 'west', loc: '西南侧 · 南部塔楼',
    desc: '西侧建筑群南端，与 A 座相呼应。连续窗列、上部拱廊及柱式共同构成立面节奏。',
  },
  D: {
    id: 'D', label: 'D 座', x: 27, z: 28, w: 23, d: 25, H: 60, top: 67.6,
    entrance: 'east', loc: '东南侧 · 南部塔楼',
    desc: '东侧建筑群南端。朝向南侧通道与中央庭院，顶部退台及屋顶机房按参考照片概括重建。',
  },
  E: {
    id: 'E', label: 'E 座', x: 27, z: 0, w: 19, d: 31, H: 43, top: 44.71,
    entrance: 'east', loc: '东侧 · 中部楼座',
    desc: '位于 D、F 座之间，连接东侧两座塔楼。与西侧中部楼座共同界定中央庭院。',
  },
  F: {
    id: 'F', label: 'F 座', x: 27, z: -28, w: 23, d: 25, H: 60, top: 67.6,
    entrance: 'east', loc: '东北侧 · 北部塔楼',
    desc: '东侧建筑群北端。与 D 座构成东侧双塔轮廓，拱券、栏杆及窗间柱延续建筑整体秩序。',
  },
};

export const TOWER_IDS = Object.keys(TOWERS);

const LEVEL_META = {
  lobby: {
    name: '基座大堂层', usage: '大堂 · 商业 · 接待', tag: 'LOBBY',
    note: '双层通高入口大堂，拱券门厅 + 商业配套；层高按 7.50 m 推算。',
  },
  standard: {
    name: '标准办公层', usage: '办公', tag: 'OFFICE',
    note: '标准办公层：中央核心筒 + 环形走廊 + 环形布置办公单元。',
  },
  mechanical: {
    name: '设备 / 避难层', usage: '设备机房 · 避难', tag: 'MECHANICAL',
    note: '顶部设备层：空调、变配电、水泵与弱电管井，兼作避难层。',
  },
  roof: {
    name: '屋顶机房层', usage: '屋顶机房 · 设备平台', tag: 'ROOF',
    note: '结构楼高以上：屋顶机房、电梯机房、水箱与冷却设备，含女儿墙与栏杆。',
  },
};

/**
 * 按模型真实楼高推算楼层。
 * 规则（README 同步说明）：
 *   1. L1 = 基座大堂层 0–7.50 m
 *   2. 其下可容纳层数 nBody = floor((H - 7.50) / 3.35)
 *   3. 其中最后一层划为「设备 / 避难层」，其余为标准办公层
 *   4. 结构楼高 H 至几何顶 top 为屋顶机房层（对 B/E 这类无冠部的楼座为屋面设备平台）
 */
export function buildFloors(tower) {
  const levels = [];
  const push = (y0, y1, type) => {
    const meta = LEVEL_META[type];
    levels.push({
      towerId: tower.id,
      index: levels.length,
      no: levels.length + 1,
      label: `L${levels.length + 1}`,
      type,
      name: meta.name,
      usage: meta.usage,
      tag: meta.tag,
      note: meta.note,
      y0: round2(y0),
      y1: round2(y1),
      height: round2(y1 - y0),
      grossArea: Math.round(tower.w * tower.d),
      lx: tower.x,
      lz: tower.z,
    });
  };

  push(0, LOBBY_HEIGHT, 'lobby');
  const nBody = Math.max(2, Math.floor((tower.H - LOBBY_HEIGHT) / FLOOR_HEIGHT));
  const stdCount = Math.max(1, nBody - 1);
  for (let i = 0; i < stdCount; i += 1) {
    const y0 = LOBBY_HEIGHT + i * FLOOR_HEIGHT;
    push(y0, y0 + FLOOR_HEIGHT, 'standard');
  }
  const stdTop = LOBBY_HEIGHT + stdCount * FLOOR_HEIGHT;
  const mechTop = Math.min(tower.H, stdTop + FLOOR_HEIGHT);
  push(stdTop, mechTop, 'mechanical');
  push(mechTop, Math.max(mechTop + 0.5, tower.top), 'roof');
  return levels;
}

export function floorsOf(tower) {
  return buildFloors(tower);
}

const LEVEL_SHORT = { lobby: '大堂', standard: '标准层', mechanical: '设备层', roof: '屋顶层' };
export function levelShortName(level) {
  return LEVEL_SHORT[level.type] || level.name;
}

export function standardFloorCount(tower) {
  return buildFloors(tower).filter((l) => l.type === 'standard').length;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ========================================================================== *
 * 2D 平面布局：示意分区（非测绘数据）
 * 角度约定：图形 x 轴 = 模型 +X（东），图形 y 轴 = 模型 +Z（南），北朝上。
 * ========================================================================== */

const PALETTE = {
  base: '#141f1f',
  floor: '#14232e',
  wall: '#93a6b1',
  corridor: '#1d333e',
  unit: ['#2a3f4a', '#2d4450', '#2b414c', '#314751', '#2c424d', '#2f4651', '#293e49', '#304853'],
  core: '#22343e',
  lift: '#3d5763',
  stair: '#3a5360',
  wc: '#476472',
  mech: '#263b46',
  roof: '#1b2c35',
  gold: '#f4b35b',
  goldSoft: '#c7b58f',
  text: '#d8e2e6',
  textDim: '#90a4ae',
};

function planFrame(tower, level) {
  return {
    tower,
    level,
    w: tower.w,
    d: tower.d,
    wall: 0.35,
    units: [],
    corridor: [],
    core: null,
    coreParts: [],
    extras: [],
    entrance: null,
    legend: [],
    summary: null,
  };
}

function addUnit(plan, index, side, x, y, w, h, kind, use, title) {
  const area = Math.round(w * h);
  const towerId = plan.tower.id;
  const id = `${towerId}-${String(plan.level.no).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`;
  const short = `${String(plan.level.no).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`;
  const label = kind === 'office' ? short : title || use;
  const unit = { id, short, index, side, x, y, w, h, area, kind, use, label, note: '' };
  plan.units.push(unit);
  return unit;
}

/** 核心筒：4 部客梯 + 2 部疏散楼梯 + 卫生间 / 管井（示意） */
function addCore(plan, x, y, w, h) {
  const core = { x, y, w, h };
  plan.core = core;
  const parts = plan.coreParts;
  const gap = 0.18;
  const liftW = Math.min(1.35, (w - 0.7 - gap * 3) / 4);
  const liftsW = liftW * 4 + gap * 3;
  const lx = x + (w - liftsW) / 2;
  const ly = y + 0.35;
  for (let i = 0; i < 4; i += 1) {
    parts.push({ kind: 'lift', x: lx + i * (liftW + gap), y: ly, w: liftW, h: 2.35 });
  }
  const sideGap = Math.max(0.28, w * 0.05);
  const stairW = clamp((w - sideGap * 2 - 0.9) / 2, 1.5, 2.2);
  const stairY = y + 3.15;
  const stairH = Math.max(2.2, y + h - 0.35 - stairY);
  parts.push({ kind: 'stair', x: x + sideGap, y: stairY, w: stairW, h: stairH });
  parts.push({ kind: 'stair', x: x + w - sideGap - stairW, y: stairY, w: stairW, h: stairH });
  const wcX = x + sideGap + stairW + 0.22;
  const wcW = w - sideGap * 2 - stairW * 2 - 0.44;
  if (wcW > 0.9) {
    parts.push({ kind: 'wc', x: wcX, y: stairY + 0.1, w: wcW, h: Math.min(2.3, stairH - 0.5) });
  }
  return core;
}

/** 标准办公层 */
function standardPlan(tower, level) {
  const plan = planFrame(tower, level);
  const { w, d, wall } = plan;
  const x0 = wall;
  const x1 = w - wall;
  const y0 = wall;
  const y1 = d - wall;
  const band = clamp(Math.min(w, d) * 0.235, 4.8, 6.2);
  const ix0 = x0 + band;
  const ix1 = x1 - band;
  const iy0 = y0 + band;
  const iy1 = y1 - band;

  // 核心筒居中，四周留环形走廊
  const cw = Math.min(6.6, ix1 - ix0 - 2.6);
  const cd = Math.min(8.4, iy1 - iy0 - 2.6);
  const cx = (ix0 + ix1) / 2;
  const cy = (iy0 + iy1) / 2;
  const core = addCore(plan, cx - cw / 2, cy - cd / 2, cw, cd);

  plan.corridor = [
    { x: ix0, y: iy0, w: ix1 - ix0, h: core.y - iy0 },
    { x: ix0, y: core.y + core.h, w: ix1 - ix0, h: iy1 - (core.y + core.h) },
    { x: ix0, y: iy0, w: core.x - ix0, h: iy1 - iy0 },
    { x: core.x + core.w, y: iy0, w: ix1 - (core.x + core.w), h: iy1 - iy0 },
  ];

  const nsSplit = 2;
  const ewSplit = iy1 - iy0 > 15 ? 2 : 1;
  let index = 0;
  const makeRoom = (x, y, rw, rh, side) => {
    const unit = addUnit(plan, index, side, x, y, rw, rh, 'office', '办公');
    const stations = Math.max(2, Math.round(unit.area / 9));
    unit.note = `${side}向采光办公单元 · 估算 ${unit.area} m² · 可布置约 ${stations} 个工位（按 9 m²/工位示意）`;
    index += 1;
  };
  const nw = (x1 - x0) / nsSplit;
  for (let i = 0; i < nsSplit; i += 1) makeRoom(x0 + i * nw, y0, nw, band, '北');
  const eh = (iy1 - iy0) / ewSplit;
  for (let i = 0; i < ewSplit; i += 1) makeRoom(x1 - band, iy0 + i * eh, band, eh, '东');
  for (let i = 0; i < nsSplit; i += 1) makeRoom(x1 - (i + 1) * nw, y1 - band, nw, band, '南');
  for (let i = 0; i < ewSplit; i += 1) makeRoom(x0, iy1 - (i + 1) * eh, band, eh, '西');

  plan.legend = [
    { label: '办公单元', color: PALETTE.unit[0] },
    { label: '环形走廊', color: PALETTE.corridor },
    { label: '核心筒', color: PALETTE.core, outline: PALETTE.goldSoft },
    { label: '电梯', color: PALETTE.lift, outline: PALETTE.gold },
    { label: '楼梯', color: PALETTE.stair },
    { label: '卫生间', color: PALETTE.wc },
  ];
  const officeArea = plan.units.reduce((sum, u) => sum + u.area, 0);
  const unitAreas = plan.units.map((u) => u.area);
  plan.summary = {
    unitCount: plan.units.length,
    officeArea,
    grossArea: Math.round(w * d),
    coreArea: Math.round(core.w * core.h),
    range: `${Math.min(...unitAreas)}–${Math.max(...unitAreas)}`,
    line: `建筑面积 ≈ ${Math.round(w * d)} m² · ${plan.units.length} 个办公单元（${Math.min(...unitAreas)}–${Math.max(...unitAreas)} m²）· 环形走廊`,
  };
  return plan;
}

/** 首层大堂层 */
function lobbyPlan(tower, level) {
  const plan = planFrame(tower, level);
  const { w, d, wall } = plan;
  const coreW = Math.min(6.6, w - 6.4);
  const coreH = clamp(d * 0.3, 6.4, 7.6);
  const core = addCore(plan, (w - coreW) / 2, 1.9, coreW, coreH);
  const hallY = core.y + core.h + 0.9;
  const hallBottom = d - 1.9;
  const hallX0 = 1.9;
  const hallX1 = w - 1.9;

  const westW = core.x - 0.8 - hallX0;
  if (westW > 2.6) {
    const west = addUnit(plan, 0, '西', hallX0, 1.9, westW, coreH, 'retail', '商业', '营业厅');
    west.note = `临街商业 / 营业厅（示意）· 估算 ${west.area} m² · 设独立对外出入口`;
  }
  const eastW = hallX1 - (core.x + core.w + 0.8);
  if (eastW > 2.6) {
    const east = addUnit(plan, 1, '东', core.x + core.w + 0.8, 1.9, eastW, coreH, 'retail', '商业', '商务中心');
    east.note = `临街商业 / 商务配套（示意）· 估算 ${east.area} m² · 可作咖啡 / 商务中心`;
  }
  const hall = addUnit(plan, 2, '南', hallX0, hallY, hallX1 - hallX0, hallBottom - hallY, 'lobby', '大堂', '大堂');
  hall.note = `双层通高入口大堂（示意）· 估算 ${hall.area} m² · 前台接待与垂直交通厅`;
  const reception = {
    id: `${tower.id}-${String(level.no).padStart(2, '0')}00`,
    short: '前台', label: '前台', x: w / 2 - 2.6, y: hallBottom - 3.1, w: 5.2, h: 1.15,
    area: 6, kind: 'desk', use: '接待',
  };
  plan.reception = reception;

  const entranceSide = tower.entrance === 'west' ? 'west' : 'east';
  plan.entrance = {
    side: entranceSide,
    x: entranceSide === 'west' ? 0 : w,
    y: (hall.y + hall.y + hall.h) / 2,
    label: '主入口 · 拱券门厅',
  };

  plan.legend = [
    { label: '大堂', color: PALETTE.unit[0] },
    { label: '商业 / 配套', color: PALETTE.unit[2] },
    { label: '核心筒', color: PALETTE.core, outline: PALETTE.goldSoft },
    { label: '电梯', color: PALETTE.lift, outline: PALETTE.gold },
    { label: '楼梯', color: PALETTE.stair },
    { label: '主入口', color: PALETTE.gold, dot: true },
  ];
  plan.summary = {
    unitCount: plan.units.length,
    officeArea: plan.units.reduce((sum, u) => sum + u.area, 0),
    grossArea: Math.round(w * d),
    coreArea: Math.round(coreW * coreH),
    range: '',
    line: `建筑面积 ≈ ${Math.round(w * d)} m² · 双层通高大堂 · 商业配套 + 核心筒`,
  };
  return plan;
}

/** 设备 / 避难层 */
function mechanicalPlan(tower, level) {
  const plan = planFrame(tower, level);
  const { w, d, wall } = plan;
  const x0 = wall + 1.4;
  const x1 = w - wall - 1.4;
  const y0 = wall + 1.4;
  const y1 = d - wall - 1.4;
  const coreW = Math.min(5.8, w - 9);
  const coreH = Math.min(6.4, d - 9);
  const core = addCore(plan, w / 2 - coreW / 2, d / 2 - coreH / 2, coreW, coreH);
  const gap = 1.35;
  const roomX0 = x0;
  const roomX1 = w / 2 - coreW / 2 - gap;
  const roomX2 = w / 2 + coreW / 2 + gap;
  const roomX3 = x1;
  const yTop = d / 2 - coreH / 2 - gap;
  const yBot = d / 2 + coreH / 2 + gap;

  const rooms = [
    { x: roomX0, y: y0, w: roomX1 - roomX0, h: yTop - y0, use: '空调', title: '空调机房', side: '西北', note: '空调机房 · 新风机组 / 空气处理机组' },
    { x: roomX2, y: y0, w: roomX3 - roomX2, h: yTop - y0, use: '变配电', title: '变配电室', side: '东北', note: '变配电室 · 高压柜 / 低压柜 / 变压器' },
    { x: roomX0, y: yBot, w: roomX1 - roomX0, h: y1 - yBot, use: '水泵', title: '水泵房', side: '西南', note: '水泵房 · 生活水箱 / 消防水箱 / 稳压设备' },
    { x: roomX2, y: yBot, w: roomX3 - roomX2, h: y1 - yBot, use: '弱电', title: '弱电机房', side: '东南', note: '弱电机房 · 通信 / 消防控制 / 楼控主机' },
  ];
  rooms.forEach((room, i) => {
    const unit = addUnit(plan, i, room.side, room.x, room.y, room.w, room.h, 'mech', room.use, room.title);
    unit.note = `${room.note}（示意机房分区）· 估算 ${unit.area} m²`;
  });
  // 环形检修走廊（用走道色描出核心筒四周）
  plan.corridor = [
    { x: roomX1, y: yTop, w: roomX2 - roomX1, h: gap },
    { x: roomX1, y: yBot, w: roomX2 - roomX1, h: gap },
    { x: roomX1, y: yTop, w: gap, h: yBot - yTop },
    { x: roomX2 - gap, y: yTop, w: gap, h: yBot - yTop },
  ];
  plan.legend = [
    { label: '设备机房', color: PALETTE.mech, dashed: true },
    { label: '检修走廊', color: PALETTE.corridor },
    { label: '核心筒', color: PALETTE.core, outline: PALETTE.goldSoft },
    { label: '电梯', color: PALETTE.lift, outline: PALETTE.gold },
    { label: '楼梯', color: PALETTE.stair },
  ];
  plan.summary = {
    unitCount: plan.units.length,
    officeArea: plan.units.reduce((sum, u) => sum + u.area, 0),
    grossArea: Math.round(w * d),
    coreArea: Math.round(coreW * coreH),
    range: '',
    line: `建筑面积 ≈ ${Math.round(w * d)} m² · 4 个设备机房 + 核心筒 · 兼作避难层`,
  };
  return plan;
}

/** 屋顶机房层 */
function roofPlan(tower, level) {
  const plan = planFrame(tower, level);
  const { w, d, wall } = plan;
  const crownW = Math.round(w * 0.53 * 10) / 10;
  const crownD = Math.round(d * 0.62 * 10) / 10;
  const crownX = (w - crownW) / 2;
  const crownY = (d - crownD) / 2 - 1.2;
  const hasCrown = tower.H > 50;

  if (hasCrown) {
    const plant = addUnit(plan, 0, '中', crownX, crownY, crownW, crownD, 'roofPlant', '屋顶机房');
    plant.note = `屋顶机房 / 电梯主机房（示意）· 估算 ${plant.area} m² · 冠部退台结构`;
    const lift = addUnit(plan, 1, '南', w / 2 - 3.4, crownY + crownD + 1.2, 6.8, 3.2, 'roofPlant', '电梯机房');
    lift.note = `电梯机房（示意）· 估算 ${lift.area} m² · 服务核心筒 4 部客梯`;
    const tank = {
      id: `${tower.id}-${String(level.no).padStart(2, '0')}03`, short: '水箱', label: '水箱间',
      shape: 'circle', cx: crownX - 2.6, cy: crownY + crownD / 2, r: 1.7, area: 9,
      kind: 'tank', use: '水箱', side: '西',
      note: '生活 / 消防水箱间（示意）· 估算容积约 18 m³',
    };
    const cool = {
      id: `${tower.id}-${String(level.no).padStart(2, '0')}04`, short: '冷却塔', label: '冷却塔',
      shape: 'circle', cx: crownX + crownW + 2.2, cy: crownY + crownD / 2, r: 1.55, area: 8,
      kind: 'cooler', use: '冷却', side: '东',
      note: '冷却塔平台（示意）· 屋面设备机组',
    };
    plan.units.push(tank, cool);
    plan.extras.push(tank, cool);
    plan.legend = [
      { label: '屋面 / 女儿墙', color: PALETTE.roof, dashed: true },
      { label: '屋顶机房', color: PALETTE.mech },
      { label: '水箱', color: PALETTE.lift, dot: true },
      { label: '冷却塔', color: PALETTE.stair, dot: true },
    ];
    plan.summary = {
      unitCount: plan.units.length,
      officeArea: plan.units.reduce((sum, u) => sum + u.area, 0),
      grossArea: Math.round(w * d),
      coreArea: 0,
      range: '',
      line: `屋面面积 ≈ ${Math.round(w * d)} m² · 屋顶机房（冠部退台）· 电梯机房 / 水箱 / 冷却塔`,
    };
  } else {
    const plant = addUnit(plan, 0, '中', w / 2 - 4.6, d / 2 - 4.6, 9.2, 7.4, 'roofPlant', '屋顶机房');
    plant.note = `屋顶机房 / 电梯机房（示意）· 估算 ${plant.area} m² · 屋面设备平台`;
    const tank = {
      id: `${tower.id}-${String(level.no).padStart(2, '0')}02`, short: '水箱', label: '水箱间',
      shape: 'circle', cx: w / 2 - 8.2, cy: d / 2 + 2.2, r: 1.6, area: 8,
      kind: 'tank', use: '水箱', side: '西',
      note: '生活 / 消防水箱间（示意）· 屋面设备平台',
    };
    const cool = {
      id: `${tower.id}-${String(level.no).padStart(2, '0')}03`, short: '冷却塔', label: '冷却塔',
      shape: 'circle', cx: w / 2 + 8.2, cy: d / 2 - 2.6, r: 1.5, area: 7,
      kind: 'cooler', use: '冷却', side: '东',
      note: '冷却塔平台（示意）· 屋面设备机组',
    };
    plan.units.push(tank, cool);
    plan.extras.push(tank, cool);
    plan.legend = [
      { label: '屋面 / 栏杆', color: PALETTE.roof, dashed: true },
      { label: '屋顶机房', color: PALETTE.mech },
      { label: '水箱', color: PALETTE.lift, dot: true },
      { label: '冷却塔', color: PALETTE.stair, dot: true },
    ];
    plan.summary = {
      unitCount: plan.units.length,
      officeArea: plan.units.reduce((sum, u) => sum + u.area, 0),
      grossArea: Math.round(w * d),
      coreArea: 0,
      range: '',
      line: `屋面面积 ≈ ${Math.round(w * d)} m² · 屋面机房 + 设备平台`,
    };
  }
  return plan;
}

export function buildFloorPlan(tower, level) {
  if (level.type === 'lobby') return lobbyPlan(tower, level);
  if (level.type === 'mechanical') return mechanicalPlan(tower, level);
  if (level.type === 'roof') return roofPlan(tower, level);
  return standardPlan(tower, level);
}

/* ------------------------------- SVG 渲染 -------------------------------- */

function esc(v) {
  return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');

function rect(x, y, w, h, attrs) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs || ''}/>`;
}
function text(x, y, str, size, fill, weight, attrs) {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${fill}" font-weight="${weight || 400}" text-anchor="middle" dominant-baseline="middle" ${attrs || ''}>${esc(str)}</text>`;
}

function renderCore(plan) {
  const c = plan.core;
  if (!c) return '';
  const parts = plan.coreParts
    .map((p) => {
      if (p.kind === 'lift') {
        return rect(p.x, p.y, p.w, p.h, `fill="${PALETTE.lift}" stroke="${PALETTE.gold}" stroke-width=".07" rx=".06"`);
      }
      if (p.kind === 'stair') {
        const step = 0.36;
        let lines = '';
        for (let yy = p.y + step; yy < p.y + p.h; yy += step) {
          lines += `<line x1="${fmt(p.x + 0.12)}" y1="${fmt(yy)}" x2="${fmt(p.x + p.w - 0.12)}" y2="${fmt(yy)}"/>`;
        }
        return `<g>${rect(p.x, p.y, p.w, p.h, `fill="${PALETTE.stair}" stroke="${PALETTE.wall}" stroke-width=".07"`)}<g stroke="${PALETTE.base}" stroke-width=".06" opacity=".55">${lines}</g></g>`;
      }
      return rect(p.x, p.y, p.w, p.h, `fill="${PALETTE.wc}" stroke="${PALETTE.wall}" stroke-width=".06"`);
    })
    .join('');
  const labelSize = Math.min(1.0, c.w * 0.18);
  return `<g class="plan-core">${rect(c.x, c.y, c.w, c.h, `fill="${PALETTE.core}" stroke="${PALETTE.goldSoft}" stroke-width=".12" stroke-dasharray=".5 .28"`)}${parts}${text(c.x + c.w / 2, c.y - 0.42, '核心筒 · 电梯厅', Math.max(0.68, labelSize * 0.82), PALETTE.goldSoft, 500)}</g>`;
}

function renderUnits(plan) {
  return plan.units
    .filter((u) => u.shape !== 'circle')
    .map((u, i) => {
      const selectedFill = PALETTE.unit[i % PALETTE.unit.length];
      const big = Math.min(u.w, u.h) > 5.4;
      const labelSize = clamp(Math.min(u.w, u.h) * 0.19, 0.62, 1.0);
      const areaSize = Math.max(0.56, labelSize * 0.72);
      const cx = u.x + u.w / 2;
      const cy = u.y + u.h / 2;
      const areaTxt = `${u.area} m²`;
      const label = u.kind === 'office' ? u.short : u.label;
      const twoLines = big || u.kind !== 'office';
      return `<g class="plan-unit plan-unit--${u.kind}" data-unit="${esc(u.id)}">
        <title>${esc(`${u.id} · ${u.use} · 估算 ${u.area} m²`)}</title>
        ${rect(u.x, u.y, u.w, u.h, `fill="${u.kind === 'mech' || u.kind === 'roofPlant' ? PALETTE.mech : selectedFill}" stroke="${PALETTE.wall}" stroke-width=".09" ${u.kind === 'mech' ? 'stroke-dasharray=".42 .26"' : ''}`)}
        ${text(cx, cy - (twoLines && areaTxt ? labelSize * 0.42 : 0), label, labelSize.toFixed(2), PALETTE.text, 600)}
        ${twoLines && areaTxt ? text(cx, cy + labelSize * 0.72, areaTxt, areaSize.toFixed(2), PALETTE.textDim, 400) : ''}
        ${!twoLines ? text(cx, cy + labelSize * 0.85, `${u.area} m²`, areaSize.toFixed(2), PALETTE.textDim, 400) : ''}
      </g>`;
    })
    .join('');
}

function renderCircles(plan) {
  return plan.extras
    .map((u) => {
      const fill = u.kind === 'cooler' ? PALETTE.stair : PALETTE.lift;
      return `<g class="plan-unit plan-unit--${u.kind}" data-unit="${esc(u.id)}">
        <circle cx="${fmt(u.cx)}" cy="${fmt(u.cy)}" r="${fmt(u.r)}" fill="${fill}" stroke="${PALETTE.goldSoft}" stroke-width=".1"/>
        <circle cx="${fmt(u.cx)}" cy="${fmt(u.cy)}" r="${fmt(u.r * 0.52)}" fill="none" stroke="${PALETTE.textDim}" stroke-width=".07" stroke-dasharray=".3 .22"/>
        ${text(u.cx, u.cy + u.r + 0.52, u.label, Math.max(0.66, u.r * 0.7).toFixed(2), PALETTE.textDim, 500)}
        ${text(u.cx, u.cy + u.r + 1.28, `${u.area} m²`, Math.max(0.52, u.r * 0.52).toFixed(2), PALETTE.textDim, 400)}
      </g>`;
    })
    .join('');
}

function renderEntrance(plan) {
  const e = plan.entrance;
  if (!e) return '';
  const dir = e.side === 'west' ? -1 : 1;
  const y = e.y;
  const ax = e.x;
  return `<g class="plan-entrance">
    <line x1="${fmt(ax)}" y1="${fmt(y - 1.5)}" x2="${fmt(ax)}" y2="${fmt(y + 1.5)}" stroke="${PALETTE.gold}" stroke-width=".34"/>
    <line x1="${fmt(ax - dir * 2.2)}" y1="${fmt(y)}" x2="${fmt(ax - dir * 0.28)}" y2="${fmt(y)}" stroke="${PALETTE.gold}" stroke-width=".16" marker-end="url(#planArrow)"/>
    ${text(ax - dir * 2.45, y - 1.05, '主入口 · 拱券门厅', 0.8, PALETTE.gold, 500)}
  </g>`;
}

function renderReception(plan) {
  const r = plan.reception;
  if (!r) return '';
  return `<g class="plan-furniture">${rect(r.x, r.y, r.w, r.h, `fill="${PALETTE.goldSoft}" opacity=".24" stroke="${PALETTE.goldSoft}" stroke-width=".07" rx=".2"`)}${text(r.x + r.w / 2, r.y + r.h / 2, '接待前台', 0.66, PALETTE.goldSoft, 500)}</g>`;
}

function renderAnnotations(plan) {
  const { w, d } = plan;
  const dimStroke = `stroke="${PALETTE.textDim}" stroke-width=".07"`;
  let out = '';
  // 顶部宽度尺寸
  out += `<g class="plan-dim">
    <line x1="0" y1="-1.05" x2="${fmt(w)}" y2="-1.05" ${dimStroke}/>
    <line x1="0" y1="-1.35" x2="0" y2="-.75" ${dimStroke}/>
    <line x1="${fmt(w)}" y1="-1.35" x2="${fmt(w)}" y2="-.75" ${dimStroke}/>
    ${text(w / 2, -1.72, `${fmt(w)} m`, 0.82, PALETTE.textDim, 400)}
  </g>`;
  // 左侧深度尺寸
  out += `<g class="plan-dim">
    <line x1="-1.05" y1="0" x2="-1.05" y2="${fmt(d)}" ${dimStroke}/>
    <line x1="-1.35" y1="0" x2="-.75" y2="0" ${dimStroke}/>
    <line x1="-1.35" y1="${fmt(d)}" x2="-.75" y2="${fmt(d)}" ${dimStroke}/>
    <text x="-1.72" y="${fmt(d / 2)}" font-size=".82" fill="${PALETTE.textDim}" text-anchor="middle" transform="rotate(-90 -1.72 ${fmt(d / 2)})">${fmt(d)} m</text>
  </g>`;
  // 指北针
  out += `<g class="plan-north" transform="translate(${fmt(w + 1.15)}, -1.2)">
    <path d="M 0 0.9 L 0 -0.5" stroke="${PALETTE.goldSoft}" stroke-width=".12"/>
    <path d="M -0.42 -0.28 L 0 -1.05 L 0.42 -0.28 Z" fill="${PALETTE.goldSoft}"/>
    <text x="0" y="-1.55" font-size=".82" fill="${PALETTE.goldSoft}" text-anchor="middle" font-weight="600">N</text>
  </g>`;
  // 比例尺（10 m）
  out += `<g class="plan-scale" transform="translate(0, ${fmt(d + 1.55)})">
    <line x1="0" y1="0" x2="10" y2="0" stroke="${PALETTE.textDim}" stroke-width=".1"/>
    <line x1="0" y1="-0.22" x2="0" y2="0.22" stroke="${PALETTE.textDim}" stroke-width=".1"/>
    <line x1="5" y1="-0.16" x2="5" y2="0.16" stroke="${PALETTE.textDim}" stroke-width=".08"/>
    <line x1="10" y1="-0.22" x2="10" y2="0.22" stroke="${PALETTE.textDim}" stroke-width=".1"/>
    <text x="0" y="0.62" font-size=".66" fill="${PALETTE.textDim}" text-anchor="middle">0</text>
    <text x="10" y="0.62" font-size=".66" fill="${PALETTE.textDim}" text-anchor="middle">10 m</text>
  </g>`;
  return out;
}

/** 生成平面 SVG（含 hover / click 目标） */
export function renderFloorPlanSvg(plan) {
  const { w, d } = plan;
  const pad = 2.9;
  const viewBox = `${-pad} ${-pad} ${w + pad * 2} ${d + pad * 2}`;
  const wallRect = rect(0, 0, w, d, `fill="${PALETTE.floor}" stroke="${PALETTE.wall}" stroke-width=".22" rx=".4"`);
  const corridor = plan.corridor
    .map((c) => rect(c.x, c.y, c.w, c.h, `fill="${PALETTE.corridor}" opacity=".92"`))
    .join('');
  const roofDashed = plan.level.type === 'roof'
    ? `<rect x=".7" y=".7" width="${fmt(w - 1.4)}" height="${fmt(d - 1.4)}" fill="url(#roofHatch)" stroke="${PALETTE.textDim}" stroke-width=".1" stroke-dasharray=".55 .35" opacity=".85"/>`
    : '';
  const inner = [
    wallRect,
    roofDashed,
    corridor,
    renderUnits(plan),
    renderCircles(plan),
    renderCore(plan),
    renderReception(plan),
    renderEntrance(plan),
    renderAnnotations(plan),
  ].join('');
  return `<svg class="plan-svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(`${plan.tower.id} 座 ${plan.level.label} ${plan.level.name} 示意平面`)}">
    <defs>
      <marker id="planArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="${PALETTE.gold}"/>
      </marker>
      <pattern id="roofHatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="1.2" stroke="${PALETTE.textDim}" stroke-width=".08" opacity=".35"/>
      </pattern>
    </defs>
    <g class="plan-body">${inner}</g>
  </svg>`;
}

export function renderFloorLegend(plan) {
  return plan.legend
    .map((l) => {
      const swatch = l.dot
        ? `<i class="dot" style="background:${l.color}"></i>`
        : `<i style="background:${l.color};${l.outline ? `border-color:${l.outline}` : ''};${l.dashed ? 'border-style:dashed' : ''}"></i>`;
      return `<span>${swatch}${esc(l.label)}</span>`;
    })
    .join('');
}

/* ========================================================================== *
 * GLB 楼带切分：把每栋楼的三角形按楼层高度切分为楼层组
 * ========================================================================== */

export function collectMaterialNames(model) {
  const names = new Set();
  model.traverse((o) => {
    if (o.isMesh && o.material && o.material.name) names.add(o.material.name);
  });
  return [...names];
}

export function resolveBuildingId(object, towers) {
  const own = object.userData && object.userData.building;
  if (own && towers[own]) return own;
  const prefix = String(object.name || '').split('_')[0];
  if (towers[prefix]) return prefix;
  return null;
}

const CLIP_EPS = 1e-4;

function findBandIndex(levels, y) {
  let lo = 0;
  let hi = levels.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (levels[mid].y1 <= y + CLIP_EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function clipPolyY(poly, planeY, keepAbove) {
  const out = [];
  const n = poly.length / 3;
  for (let i = 0; i < n; i += 1) {
    const ax = poly[i * 3];
    const ay = poly[i * 3 + 1];
    const az = poly[i * 3 + 2];
    const j = (i + 1) % n;
    const bx = poly[j * 3];
    const by = poly[j * 3 + 1];
    const bz = poly[j * 3 + 2];
    const aIn = keepAbove ? ay >= planeY : ay <= planeY;
    const bIn = keepAbove ? by >= planeY : by <= planeY;
    if (aIn) out.push(ax, ay, az);
    if (aIn !== bIn) {
      const t = (planeY - ay) / (by - ay);
      out.push(ax + (bx - ax) * t, planeY, az + (bz - az) * t);
    }
  }
  return out;
}

function pushTriangle(out, ax, ay, az, bx, by, bz, cx, cy, cz) {
  out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
}

function clipTriangleToBand(out, ax, ay, az, bx, by, bz, cx, cy, cz, y0, y1) {
  let poly = [ax, ay, az, bx, by, bz, cx, cy, cz];
  if (Math.min(ay, by, cy) < y0 - CLIP_EPS) poly = clipPolyY(poly, y0, true);
  if (poly.length < 9) return;
  if (Math.max(ay, by, cy) > y1 + CLIP_EPS) poly = clipPolyY(poly, y1, false);
  if (poly.length < 9) return;
  const n = poly.length / 3;
  for (let i = 1; i < n - 1; i += 1) {
    out.push(
      poly[0], poly[1], poly[2],
      poly[i * 3], poly[i * 3 + 1], poly[i * 3 + 2],
      poly[(i + 1) * 3], poly[(i + 1) * 3 + 1], poly[(i + 1) * 3 + 2],
    );
  }
}

/**
 * 切分模型：每栋楼按楼层带生成独立 Group（带半透明楼板与轮廓线）。
 * @param {THREE.Object3D} model GLB 场景
 * @param {Record<string, object>} towers
 * @param {Map<string, Array>} levelsByTower
 * @param {Record<string, object>} materialPools matName -> { normal, dim, focus }
 * @param {Record<string, object>} slabPools  { normal, dim, focus }
 * @returns {{ root: THREE.Group, towers: Map, stats: object }}
 */
export function buildFloorStack(model, towers, levelsByTower, materialPools, slabPools) {
  const started = performance.now();
  const root = new THREE.Group();
  root.name = 'floor-stack';
  root.visible = false;

  const buckets = new Map();
  for (const id of Object.keys(towers)) {
    const levels = levelsByTower.get(id) || [];
    buckets.set(id, {
      levels,
      bands: levels.map(() => new Map()), // matName -> number[]
    });
  }

  const stats = { sourceTriangles: 0, outputTriangles: 0, bands: 0, bandMeshes: 0, slabs: 0, ms: 0 };
  const wpos = new THREE.Vector3();
  const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x8b9aa3, roughness: 0.8 });

  model.traverse((object) => {
    if (!object.isMesh) return;
    const buildingId = resolveBuildingId(object, towers);
    if (!buildingId || !buckets.has(buildingId)) return;
    const bucket = buckets.get(buildingId);
    if (!bucket.levels.length) return;
    const geometry = object.geometry;
    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return;
    const index = geometry.getIndex();
    const triCount = (index ? index.count : posAttr.count) / 3;
    stats.sourceTriangles += triCount;

    object.updateWorldMatrix(true, false);
    const matrix = object.matrixWorld;
    const worldPos = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i += 1) {
      wpos.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
      worldPos[i * 3] = wpos.x;
      worldPos[i * 3 + 1] = wpos.y;
      worldPos[i * 3 + 2] = wpos.z;
    }

    const matName = (object.material && object.material.name) || 'default';
    const levels = bucket.levels;
    const vertexCount = index ? index.count : posAttr.count;
    for (let t = 0; t < vertexCount; t += 3) {
      const ia = index ? index.getX(t) : t;
      const ib = index ? index.getX(t + 1) : t + 1;
      const ic = index ? index.getX(t + 2) : t + 2;
      const ax = worldPos[ia * 3];
      const ay = worldPos[ia * 3 + 1];
      const az = worldPos[ia * 3 + 2];
      const bx = worldPos[ib * 3];
      const by = worldPos[ib * 3 + 1];
      const bz = worldPos[ib * 3 + 2];
      const cx = worldPos[ic * 3];
      const cy = worldPos[ic * 3 + 1];
      const cz = worldPos[ic * 3 + 2];
      const minY = Math.min(ay, by, cy);
      const maxY = Math.max(ay, by, cy);
      let band = findBandIndex(levels, minY);
      for (; band < levels.length; band += 1) {
        const level = levels[band];
        if (level.y0 >= maxY - CLIP_EPS) break;
        const map = bucket.bands[band];
        let out = map.get(matName);
        if (!out) {
          out = [];
          map.set(matName, out);
        }
        if (minY >= level.y0 - CLIP_EPS && maxY <= level.y1 + CLIP_EPS) {
          pushTriangle(out, ax, ay, az, bx, by, bz, cx, cy, cz);
        } else {
          clipTriangleToBand(out, ax, ay, az, bx, by, bz, cx, cy, cz, level.y0, level.y1);
        }
      }
    }
  });

  const towerGroups = new Map();
  for (const [id, bucket] of buckets) {
    const tower = towers[id];
    const levels = bucket.levels;
    const towerGroup = new THREE.Group();
    towerGroup.name = `floor-tower-${id}`;
    const bands = [];
    // 同栋楼共用楼板几何
    const slabGeo = new THREE.BoxGeometry(tower.w - 1.3, 0.16, tower.d - 1.3);
    const slabEdgeGeo = new THREE.EdgesGeometry(slabGeo);
    levels.forEach((level, bandIndex) => {
      const group = new THREE.Group();
      group.name = `band-${id}-${level.label}`;
      group.userData = { building: id, levelIndex: bandIndex, floorGroup: true };
      const meshes = [];
      for (const [matName, arr] of bucket.bands[bandIndex]) {
        if (!arr.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, (materialPools[matName] && materialPools[matName].normal) || fallbackMaterial);
        mesh.name = `${id}-${level.label}-${matName}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { building: id, levelIndex: bandIndex };
        group.add(mesh);
        meshes.push({ mesh, matName });
        stats.outputTriangles += arr.length / 9;
        stats.bandMeshes += 1;
      }
      const slab = new THREE.Mesh(slabGeo, slabPools.dim);
      slab.position.set(tower.x, level.y0 + 0.09, tower.z);
      slab.userData = { building: id, levelIndex: bandIndex, slab: true };
      slab.receiveShadow = true;
      group.add(slab);
      const edge = new THREE.LineSegments(slabEdgeGeo, slabPools.edgeDim);
      edge.position.copy(slab.position);
      edge.userData = { building: id, levelIndex: bandIndex, slab: true };
      group.add(edge);
      // 选中楼层的金色轮廓（只显示当前聚焦层，不额外增加常驻 draw call）
      const frameGeo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(tower.w * 1.004, Math.max(0.5, level.height), tower.d * 1.004),
      );
      const frame = new THREE.LineSegments(frameGeo, slabPools.edgeFocus);
      frame.position.set(tower.x, (level.y0 + level.y1) / 2, tower.z);
      frame.visible = false;
      frame.userData = { building: id, levelIndex: bandIndex, frame: true };
      group.add(frame);
      towerGroup.add(group);
      bands.push({ group, meshes, slab, edge, frame, level, bandIndex });
      stats.bands += 1;
      stats.slabs += 1;
    });
    root.add(towerGroup);
    towerGroups.set(id, { tower, group: towerGroup, bands });
  }

  stats.ms = Math.round(performance.now() - started);
  return { root, towers: towerGroups, stats };
}

/* ========================================================================== *
 * 场景外辅助：相机 / 动画参数
 * ========================================================================== */

export const FLOOR_VIEW = {
  dir: new THREE.Vector3(-0.5, 0.32, 0.81).normalize(),
  minDistance: 96,
};

/** 按纵向可视高度反算相机距离 */
function distanceForHeight(height, fov) {
  return height / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
}

/** 计算楼层模式的观察位（整栋炸开堆叠取景） */
export function floorOverviewCamera(tower, levels, explode = 1, aspect = 1.6, fov = 36) {
  const n = levels.length;
  const totalH = tower.top + (n - 1) * EXPLODE_GAP * explode;
  const target = new THREE.Vector3(tower.x, totalH * 0.5, tower.z);
  const vFov = THREE.MathUtils.degToRad(fov);
  const hFovHalf = Math.atan(Math.tan(vFov / 2) * aspect);
  const distV = distanceForHeight(totalH * 1.14, fov);
  const distH = tower.w * 1.5 / 2 / Math.tan(hFovHalf);
  const distance = clamp(Math.max(distV, distH, 70), 70, 320);
  const position = target.clone().addScaledVector(FLOOR_VIEW.dir, distance);
  return { position, target };
}

/**
 * 计算聚焦到某一层的观察位。
 * 横屏时有意裁切整栋塔楼、把当前楼层与上下数层放大展示；竖屏（手机）则尽量容纳整栋。
 */
export function floorFocusCamera(tower, levels, levelIndex, explode = 1, aspect = 1.6, fov = 36) {
  const n = levels.length;
  const level = levels[levelIndex];
  const totalH = tower.top + (n - 1) * EXPLODE_GAP * explode;
  const bandCenter = (level.y0 + level.y1) / 2 + levelIndex * EXPLODE_GAP * explode;
  const target = new THREE.Vector3(tower.x, bandCenter + 1, tower.z);
  const vFov = THREE.MathUtils.degToRad(fov);
  const hFovHalf = Math.atan(Math.tan(vFov / 2) * aspect);
  const portrait = aspect < 1.15;
  const distV = distanceForHeight(totalH * (portrait ? 1.14 : 0.95), fov);
  const distH = tower.w * 1.5 / 2 / Math.tan(hFovHalf);
  const distance = clamp(Math.max(distV, distH, 70), 70, 320);
  const position = target.clone().addScaledVector(FLOOR_VIEW.dir, distance);
  return { position, target };
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
