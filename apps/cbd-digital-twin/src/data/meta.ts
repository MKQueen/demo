import type { DataMeta } from './types';

/**
 * 数据管线会把 meta 拆成 tiles / layers / stats / basemap 等分组，
 * UI 与场景只关心几个数字和底图路径，这里做一层容错读取。
 */
export interface MetaSummary {
  buildingCount: number | null;
  roadCount: number | null;
  fallbackCount: number | null;
  railwayCount: number | null;
  contextCount: number | null;
  generatedAt: string;
  basemapFile: string | null;
  basemapRectangle: [number, number, number, number] | null;
  basemapWidth: number;
  basemapHeight: number;
}

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function summarizeMeta(meta: DataMeta | null | undefined): MetaSummary {
  if (!meta) {
    return {
      buildingCount: null,
      roadCount: null,
      fallbackCount: null,
      railwayCount: null,
      contextCount: null,
      generatedAt: '',
      basemapFile: null,
      basemapRectangle: null,
      basemapWidth: 2048,
      basemapHeight: 2048,
    };
  }

  const root = meta as DataMeta & {
    stats?: Record<string, unknown>;
    tiles?: { whiteModels?: { buildingCount?: unknown } };
    layers?: Record<string, { count?: unknown }>;
    basemap?: {
      file?: string;
      path?: string;
      url?: string;
      rectangle?: [number, number, number, number];
      width?: number;
      height?: number;
    };
  };

  const basemap = root.basemap;
  const rawFile = basemap?.file || basemap?.path || basemap?.url || null;
  const basemapFile = rawFile ? String(rawFile).replace(/^\/+/, '') : null;
  const rectangle = Array.isArray(basemap?.rectangle) && basemap.rectangle.length === 4 ? basemap.rectangle : null;

  return {
    buildingCount:
      asNumber(root.stats?.whiteModelBuildings) ??
      asNumber(root.tiles?.whiteModels?.buildingCount) ??
      asNumber(root.buildingCount),
    roadCount: asNumber(root.stats?.roadFeatures) ?? asNumber(root.layers?.roads?.count) ?? asNumber(root.roadCount),
    fallbackCount:
      asNumber(root.stats?.fallbackBuildings) ?? asNumber(root.layers?.buildingsFallback?.count),
    railwayCount: asNumber(root.stats?.railwayFeatures) ?? asNumber(root.layers?.railways?.count),
    contextCount: asNumber(root.stats?.contextFeatures) ?? asNumber(root.layers?.context?.count),
    generatedAt: typeof root.generatedAt === 'string' ? root.generatedAt : '',
    basemapFile,
    basemapRectangle: rectangle ?? (Array.isArray(meta.bbox) && meta.bbox.length === 4 ? meta.bbox : null),
    basemapWidth: asNumber(basemap?.width) ?? 2048,
    basemapHeight: asNumber(basemap?.height) ?? 2048,
  };
}
