/**
 * terrainProvider.js —— 用程序化高程函数喂给 Cesium 的本地地形（无需 Cesium ion Token / DEM 文件）。
 *
 * 原理：CustomHeightmapTerrainProvider 会在需要时按瓦片坐标回调我们，我们按
 * 64×64 采样 heightAtLonLat() 返回高度数组（行序：北→南、西→东，见 Cesium
 * HeightmapTerrainData 文档）。因为高程来自地形模型函数，LOD 任意层级都能现算，
 * 天然支持无限细分，也不会产生网络请求。
 *
 * 生产环境替换成真实地形：见 README「数据准备指南」——把这里换成
 * `CesiumTerrainProvider.fromUrl(...)` / `Cesium.createWorldTerrainAsync()`
 * 或本地 quantized-mesh 即可，其余代码不变。
 */
import * as Cesium from 'cesium';
import {
  heightAtLonLat,
  HALF_W,
  HALF_H,
  M_PER_DEG_LON,
  M_PER_DEG_LAT,
  SCENE,
} from '../geo/terrainModel.js';

/** 每个地形瓦片的高度采样数（64 → 4096 个采样点/瓦片） */
const TILE_SAMPLES = 64;
/** 最大细分层级：level 18 时瓦片约 76m 宽，采样精度 ~1.2m，足够近景观察 */
const MAX_LEVEL = 18;

const tilingScheme = new Cesium.GeographicTilingScheme();

// 场景外 ~35km 之外直接返回海平面，省掉无意义的计算
const SCENE_DEG = {
  west: Cesium.Math.toRadians(SCENE.lon0 - HALF_W / M_PER_DEG_LON - 0.35),
  east: Cesium.Math.toRadians(SCENE.lon0 + HALF_W / M_PER_DEG_LON + 0.35),
  south: Cesium.Math.toRadians(SCENE.lat0 - HALF_H / M_PER_DEG_LAT - 0.35),
  north: Cesium.Math.toRadians(SCENE.lat0 + HALF_H / M_PER_DEG_LAT + 0.35),
};
const flat = new Float32Array(TILE_SAMPLES * TILE_SAMPLES);

function tileSamples(x, y, level) {
  const rectangle = tilingScheme.tileXYToRectangle(x, y, level);
  const { west, east, south, north } = rectangle;

  // 在场景包围盒外（留 35km 余量）的瓦片：平海面，不浪费计算
  const out =
    east < SCENE_DEG.west ||
    west > SCENE_DEG.east ||
    north < SCENE_DEG.south ||
    south > SCENE_DEG.north;
  if (out) return flat;

  const buffer = new Float32Array(TILE_SAMPLES * TILE_SAMPLES);
  // 注意：tileXYToRectangle() 返回的是**弧度**，而 heightAtLonLat() 接收的是**度**，
  // 这里必须显式 toDegrees，否则会把弧度当度用，导致所有瓦片采样到远场同一个高度
  //（地形被“拍平”成一个高度，建筑全被埋进地形里）。
  const westDeg = Cesium.Math.toDegrees(west);
  const northDeg = Cesium.Math.toDegrees(north);
  const dLon = (Cesium.Math.toDegrees(east) - westDeg) / (TILE_SAMPLES - 1);
  const dLat = (Cesium.Math.toDegrees(south) - northDeg) / (TILE_SAMPLES - 1);
  let k = 0;
  for (let row = 0; row < TILE_SAMPLES; row++) {
    const lat = northDeg + dLat * row; // row 0 = 最北
    for (let col = 0; col < TILE_SAMPLES; col++) {
      buffer[k++] = heightAtLonLat(westDeg + dLon * col, lat);
    }
  }
  return buffer;
}

export function createTerrainProvider() {
  return new Cesium.CustomHeightmapTerrainProvider({
    width: TILE_SAMPLES,
    height: TILE_SAMPLES,
    tilingScheme,
    credit: '澜屿湾 · 程序化地形（本地实时生成）',
    callback: (x, y, level) => {
      if (level > MAX_LEVEL) return undefined; // 超过最大层级：让 Cesium 用父瓦片
      return tileSamples(x, y, level);
    },
  });
}
