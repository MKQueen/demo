/**
 * floodAnalysis.js —— 动态水淹分析（纯计算，无 Cesium 依赖）。
 *
 * 两个数据来源：
 *   1) buildings.json：村庄建筑清单（tiles-dev 生成），带每栋建筑的地基最低点海拔；
 *   2) terrainModel 高程函数：启动时预采样一张粗糙高程网格，用于快速计算「受淹陆地面积」。
 *
 * 所有统计随水位即时计算（水位变化 → depth = 水位 - 地基海拔），不依赖渲染结果，
 * 也不做昂贵的屏幕空间查询，因此每帧都能算得起。
 *
 * 生产环境如果需要「基于真实体块」的精确淹没，可改为：
 *   - 3D Tiles 逐要素遍历（tileset.tileVisible / Cesium3DTileFeature）+ 采样地形高度；
 *   - 或服务端预计算洪水演进（HEC-RAS / LISFLOOD-FP）后按水位返回淹没栅格。
 */
import {
  SCENE,
  WATER,
  heightAtLocal,
} from '../geo/terrainModel.js';

/** 相对页面基址读取 public/ 下的 JSON，失败返回 null（不抛错） */
export async function loadGeneratedJSON(relativePath) {
  try {
    const url = new URL(relativePath, document.baseURI).href;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadBuildingManifest() {
  const data = await loadGeneratedJSON('generated/village/buildings.json');
  if (!data || !Array.isArray(data.buildings) || data.buildings.length === 0) return null;
  return data;
}

/**
 * 构建分析器（启动时预计算网格与直方图）。
 * @param {Array<object>} buildings
 */
export function buildAnalyzer(buildings = []) {
  const STEP = WATER.histogramStep;
  const levels = [];
  for (let l = WATER.min; l <= WATER.max + 1e-6; l += STEP) levels.push(Math.round(l * 10) / 10);

  // --- 预采样高程网格（约 83m 一格，用于面积统计；只在启动时算一次） ---
  const NX = 168;
  const NY = Math.round((NX * SCENE.heightMeters) / SCENE.widthMeters);
  const dx = SCENE.widthMeters / (NX - 1);
  const dy = SCENE.heightMeters / (NY - 1);
  const cellArea = dx * dy;
  const heights = new Float32Array(NX * NY);
  {
    let k = 0;
    for (let j = 0; j < NY; j++) {
      const y = SCENE.heightMeters / 2 - j * dy;
      for (let i = 0; i < NX; i++) {
        heights[k++] = heightAtLocal(-SCENE.widthMeters / 2 + i * dx, y);
      }
    }
  }

  /** 统计某一水位下的受淹陆地面积（不含海面） */
  function inundatedLandArea(level) {
    let area = 0;
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      if (h >= 0 && h < level) area += cellArea;
    }
    return area;
  }
  let landArea = 0;
  let sceneArea = 0;
  for (let i = 0; i < heights.length; i++) {
    sceneArea += cellArea;
    if (heights[i] >= 0) landArea += cellArea;
  }

  // --- 预计算水位-淹没直方图（统计卡图表用） ---
  const histogram = levels.map((level) => {
    let flooded = 0;
    let danger = 0;
    for (const b of buildings) {
      const depth = level - b.minGround;
      if (depth > 0.15) {
        flooded += 1;
        if (depth > 2) danger += 1;
      }
    }
    return { level, flooded, danger, area: inundatedLandArea(level) };
  });

  /** 计算某一水位下的完整统计（UI 每 4~5 帧调用一次） */
  function compute(level) {
    let floodedBuildings = 0;
    let dangerBuildings = 0;
    let maxDepth = 0;
    let sumDepth = 0;
    const flooded = [];
    for (const b of buildings) {
      const depth = level - b.minGround;
      if (depth > 0.15) {
        floodedBuildings += 1;
        sumDepth += depth;
        if (depth > maxDepth) maxDepth = depth;
        if (depth > 2) dangerBuildings += 1;
        flooded.push({
          id: b.id,
          name: b.name,
          type: b.type,
          depth,
          height: b.height,
          minGround: b.minGround,
        });
      }
    }
    flooded.sort((a, b) => b.depth - a.depth);
    const area = inundatedLandArea(level);
    const total = buildings.length;
    return {
      totalBuildings: total,
      floodedBuildings,
      dangerBuildings,
      floodedRatio: total ? floodedBuildings / total : 0,
      inundatedAreaM2: area,
      totalAreaM2: landArea,
      sceneAreaM2: sceneArea,
      inundatedRatio: landArea ? area / landArea : 0,
      maxDepth,
      meanDepth: floodedBuildings ? sumDepth / floodedBuildings : 0,
      waterLevel: level,
      histogram,
      floodedList: flooded.slice(0, 4),
    };
  }

  return {
    compute,
    histogram,
    levels,
    landAreaM2: landArea,
    sceneAreaM2: sceneArea,
    buildings,
  };
}
