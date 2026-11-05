/** 业务数据类型：POI / 地标模型 / 图层 / HUD 指标 */

export type PoiCategory = 'landmark' | 'corporate' | 'retail' | 'transit';

export type LayerKey =
  | 'beijingMassing'
  | 'beijingBoundary'
  | 'whiteModels'
  | 'districtMassing'
  | 'landmarks'
  | 'roads'
  | 'boundary'
  | 'context'
  | 'pois'
  | 'flow';

export type LayerState = Record<LayerKey, boolean>;

export interface PoiStat {
  label: string;
  value: string;
}

export interface Poi {
  id: string;
  name: string;
  en: string;
  category: PoiCategory;
  lon: number;
  lat: number;
  /** 所属行政区（北京市 16 区名称，如 东城区 / 朝阳区） */
  district?: string;
  /** 免费在线模型的来源署名（如 3D Warehouse 作者） */
  modelCredit?: string;
  /** 所属范围：未设置视为 CBD 核心点位 */
  scope?: 'cbd' | 'district' | 'beijing';
  /** Marker 离地高度（米），默认 8m，避免与地面/底图 z-fighting */
  altitude?: number;
  /** 建筑结构高度（米），用于相机聚焦与光柱 */
  height?: number;
  floors?: number;
  /** 相机聚焦时使用的距离（米） */
  focusRange?: number;
  /** 相机聚焦时的俯仰角（弧度），默认 -0.38 */
  focusPitch?: number;
  description: string;
  tags: string[];
  stats: PoiStat[];
}

export interface PoiCategoryMeta {
  label: string;
  en: string;
  color: string;
  /** canvas 图标内的符号类型 */
  glyph: 'tower' | 'business' | 'shop' | 'metro';
}

export interface LandmarkModel {
  id: string;
  name: string;
  en: string;
  /** 模型文件相对 public 的路径 */
  glb: string;
  lon: number;
  lat: number;
  /** 模型真实高度（米），用于信息展示、包围球与标签 */
  height: number;
  /** 绕竖轴的朝向修正（度） */
  yaw?: number;
  /** glb 单位已经是米，通常 scale = 1 */
  scale?: number;
  /** 关联的业务点位 id，用于联动高亮 */
  poiId?: string;
}

export interface SceneStats {
  fps: number;
  altitude: number;
  lon: number;
  lat: number;
  heading: number;
  pitch: number;
}

export interface SceneProgress {
  percent: number;
  label: string;
}

export interface ScreenAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export interface DataMeta {
  source?: string;
  attribution?: string;
  bbox?: [number, number, number, number];
  coreBbox?: [number, number, number, number];
  basemap?: {
    file?: string;
    path?: string;
    url?: string;
    rectangle: [number, number, number, number];
    [key: string]: unknown;
  } | null;
  buildingCount?: number;
  roadCount?: number;
  origin?: { lon: number; lat: number; height: number };
  generatedAt?: string;
  stats?: Record<string, unknown>;
  tiles?: { whiteModels?: { buildingCount?: number; [key: string]: unknown }; [key: string]: unknown };
  layers?: Record<string, { count?: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** 北京市全境数据（data/beijing） */
export interface BeijingMeta {
  name?: string;
  nameEn?: string;
  areaKm2?: number;
  bbox?: [number, number, number, number];
  center?: { lon: number; lat: number } | [number, number];
  origin?: { lon: number; lat: number; height: number };
  basemap?: {
    file?: string;
    path?: string;
    url?: string;
    rectangle: [number, number, number, number];
    width?: number;
    height?: number;
    credit?: string;
    [key: string]: unknown;
  } | null;
  basemapContext?: {
    file?: string;
    rectangle: [number, number, number, number];
    width?: number;
    height?: number;
    credit?: string;
    [key: string]: unknown;
  } | null;
  counts?: {
    buildings?: number;
    instances?: number;
    roads?: number;
    districts?: number;
    triangles?: number;
    [key: string]: unknown;
  };
  tiles?: {
    massing?: {
      tileset?: string;
      instances?: number;
      triangles?: number;
      bytes?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  roads?: { file?: string; count?: number; [key: string]: unknown };
  districts?: { file?: string; count?: number; [key: string]: unknown };
  boundary?: { file?: string; points?: number; [key: string]: unknown };
  generatedAt?: string;
  source?: string;
  attribution?: string;
  license?: string;
  [key: string]: unknown;
}

export interface BeijingDataBundle {
  meta: BeijingMeta | null;
  boundary: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>> | null;
  districts: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>> | null;
  roads: GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, unknown>> | null;
}

/** 朝阳区全域数据（data/district） */
export interface DistrictMeta {
  name?: string;
  nameEn?: string;
  areaKm2?: number;
  boundaryBbox?: [number, number, number, number];
  center?: { lon: number; lat: number };
  origin?: { lon: number; lat: number; height: number };
  basemap?: {
    file?: string;
    path?: string;
    url?: string;
    rectangle: [number, number, number, number];
    width?: number;
    height?: number;
    [key: string]: unknown;
  } | null;
  counts?: {
    buildings?: number;
    instances?: number;
    roads?: number;
    triangles?: number;
    [key: string]: unknown;
  };
  tiles?: {
    massing?: {
      tileset?: string;
      instances?: number;
      bytes?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  roads?: { file?: string; count?: number; [key: string]: unknown };
  boundary?: { file?: string; points?: number; [key: string]: unknown };
  generatedAt?: string;
  source?: string;
  attribution?: string;
  license?: string;
  [key: string]: unknown;
}

export interface DistrictDataBundle {
  meta: DistrictMeta | null;
  boundary: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>> | null;
  roads: GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, unknown>> | null;
  context: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>> | null;
}

export interface CityDataBundle {
  roads: GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, unknown>> | null;
  context: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>> | null;
  railways: GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, unknown>> | null;
  meta: DataMeta | null;
}

/** 画质档位：auto 按实测帧率自适应，其余为固定分辨率倍率 */
export type ViewMode = 'beijing' | 'district' | 'cbd';

export type QualityPreset = 'auto' | 'high' | 'medium' | 'low';

export interface QualityState {
  preset: QualityPreset;
  /** 实际生效的 Cesium resolutionScale（相对设备像素） */
  scale: number;
}
