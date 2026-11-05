import * as Cesium from 'cesium';
import type { DataMeta } from '../../data/types';

/** 把 public/ 下的相对路径解析为当前页面下的绝对 URL，兼容 /demos/<id>/ 子路径部署 */
export function assetUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).href;
}

export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(assetUrl(path), { cache: 'no-cache' });
    if (!response.ok) {
      console.warn(`[CBD] 数据请求失败 ${path}: HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[CBD] 数据请求异常 ${path}:`, error);
    return null;
  }
}

/** 把 GeoJSON LineString 坐标转换为贴地（指定高度）的 Cartesian3 数组 */
export function lineToPositions(coords: GeoJSON.Position[], height = 1.2): Cesium.Cartesian3[] {
  const flat: number[] = [];
  for (const [lon, lat] of coords) {
    flat.push(lon, lat, height);
  }
  return Cesium.Cartesian3.fromDegreesArrayHeights(flat);
}

/** 计算两点球面近似距离（米），用于流光线速度/长度 */
export function distanceMeters(a: GeoJSON.Position, b: GeoJSON.Position): number {
  const radius = 6378137;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat = ((a[1] + b[1]) / 2 * Math.PI) / 180;
  const x = dLon * Math.cos(lat);
  return Math.hypot(x, dLat) * radius;
}

/** 取折线中最长一段的中点，用于道路名称标注 */
export function longestLineMidpoint(coords: GeoJSON.Position[]): GeoJSON.Position | null {
  if (coords.length < 2) return null;
  let best = 0;
  let bestIndex = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distanceMeters(coords[i], coords[i + 1]);
    if (d > best) {
      best = d;
      bestIndex = i;
    }
  }
  const a = coords[bestIndex];
  const b = coords[bestIndex + 1];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function bboxToRectangle(bbox: [number, number, number, number]): Cesium.Rectangle {
  return Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]);
}

export function metaBasemapRectangle(meta: DataMeta | null): [number, number, number, number] | null {
  if (meta?.basemap?.rectangle?.length === 4) return meta.basemap.rectangle;
  return meta?.bbox ?? null;
}

/** 判断点位是否在相机前方且投影到画布内（供 HTML InfoWindow 定位） */
export function worldToScreen(
  scene: Cesium.Scene,
  world: Cesium.Cartesian3,
): { x: number; y: number; visible: boolean } {
  const camera = scene.camera;
  const toPoint = Cesium.Cartesian3.subtract(world, camera.positionWC, new Cesium.Cartesian3());
  const inFront = Cesium.Cartesian3.dot(camera.directionWC, toPoint) > 0;
  if (!inFront) return { x: 0, y: 0, visible: false };
  const screen = scene.cartesianToCanvasCoordinates(world);
  if (!screen) return { x: 0, y: 0, visible: false };
  const canvas = scene.canvas;
  const margin = 28;
  const visible = screen.x > -margin && screen.y > -margin && screen.x < canvas.clientWidth + margin && screen.y < canvas.clientHeight + margin;
  return { x: screen.x, y: screen.y, visible };
}

/** 相机 HUD 数据：经纬度 / 高度 / 朝向 / 俯仰 */
export function cameraStats(scene: Cesium.Scene, fps: number) {
  const carto = Cesium.Cartographic.fromCartesian(scene.camera.positionWC);
  return {
    fps,
    altitude: carto.height,
    lon: Cesium.Math.toDegrees(carto.longitude),
    lat: Cesium.Math.toDegrees(carto.latitude),
    heading: Cesium.Math.toDegrees(scene.camera.heading),
    pitch: Cesium.Math.toDegrees(scene.camera.pitch),
  };
}

export function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}
