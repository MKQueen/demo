#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-beijing-data.py — 北京市全域低模数据管线
================================================

在现有「CBD 精细白模 + 朝阳区全域低模」之上，补齐「整个北京市」范围所需的
静态数据（全部写入 public/data/beijing/，不修改任何现有文件）：

    public/data/beijing/
    ├── boundary.geojson                  # 北京市行政边界（WGS84，MultiPolygon）
    ├── districts.geojson                 # 16 区边界（WGS84，含 name/center/areaKm2）
    ├── basemap.jpg                       # 北京市域 EOX Sentinel-2 卫星拼图（3072px，z11）
    ├── basemap-context.jpg               # 北京周边上下文卫星底图（2560px，z10，最底层）
    ├── roads.geojson                     # 中心城区干路（剔除朝阳区 + CBD 精细 bbox）
    ├── meta.json                         # 前端唯一入口
    └── tiles/massing/
        ├── tileset.json                  # 3D Tiles 1.1，root.transform = ENU→ECEF
        └── massing.glb                   # EXT_mesh_gpu_instancing 低模 box（~8 万实例）

数据源（三个源，许可各不相同，详见 meta.json.sources 与 docs/beijing-data.md）：
1. 行政边界：DataV.GeoAtlas  <https://geo.datav.aliyun.com/areas_v3/bound/110000.json>
   与 110000_full.json（16 区）。原始坐标系为 **GCJ-02**，本脚本用标准
   GCJ-02→WGS84 反算（迭代法）转换到 WGS84，否则与 OSM/卫星底图相差约 300–500 m。
   DataV 边界仅供演示参考，不作为官方测绘成果（见 docs）。
2. 卫星底图：EOX Sentinel-2 cloudless 2020（CC BY 4.0）
   WMTS: https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg
   取 z11 瓦片覆盖北京 bbox + padding，拼成 Web Mercator 大图后**重采样为等经纬度
   （Plate Carrée，经纬度线性映射）**，以便与 Cesium 单张贴图 rectangle / 矢量图层
   严格对齐。
3. 建筑/道路：/tmp/Beijing.osm.gz（BBBike Beijing extract，ODbL 1.0）
   中心城区 bbox 39.68–40.18 / 116.08–116.77；建筑生成 footprint OBB box 实例，
   **剔除朝阳区边界内**（由现有 public/data/district/ 数据负责）**以及 CBD 精细
   bbox**（由现有 public/data/ 精细白模负责），避免重复。

坐标系与轴向（与现有 CBD / district 数据完全一致）：
- 矢量/底图：WGS84 经纬度，底图经纬度线性映射；
- 3D Tiles：ENU 原点 ORIGIN=(116.4610, 39.9080, 0)，root.transform 为 ENU→ECEF（列主序）；
- glTF content 为 Y-up：x=east, y=up, z=-north，Cesium 自动 Y_UP_TO_Z_UP；
- 实例语义：world(glTF) = TRANSLATION * ROTATION * SCALE * unitBox，
  TRANSLATION=(east, up, -north)，up 为该点椭球高 0 的 ENU up（含地球曲率，约 -d²/2R），
  ROTATION=绕 glTF +Y 的航向四元数，SCALE=(footprint 长, 高度, footprint 宽)。

依赖：Python 3.10+；numpy + Pillow（卫星底图/点在多边形；缺少 numpy 时降级为纯 Python 但慢）。
默认复用同级目录的 build-district-data.py 中的 LocalFrame / OSM 解析 / OBB / GLB /
tileset / 校验逻辑（通过 importlib 动态加载，不修改原文件）。

用法：
    python3 tools/build-beijing-data.py                     # 全量生成
    python3 tools/build-beijing-data.py --only boundary,basemap  # 只跑部分步骤（boundary/basemap/context/massing/roads/meta）
    python3 tools/build-beijing-data.py --verify-only       # 只校验已有产物
    python3 tools/build-beijing-data.py --cache /tmp/district/parsed.pkl
    python3 tools/build-beijing-data.py --skip-basemap      # 不联网（底图保留旧文件）

步骤：boundary → basemap（z11 市域）→ context（z10 周边）→ massing → roads → meta → verify
"""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
import math
import struct
import sys
import time
import urllib.request
from pathlib import Path

try:  # numpy 用于点在多边形 / 卫星重采样
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

# --------------------------------------------------------------------------- #
# 0. 常量
# --------------------------------------------------------------------------- #

TOOL = "cbd-digital-twin/tools/build-beijing-data.py"
GENERATOR = "cbd-digital-twin build-beijing-data.py"
HERE = Path(__file__).resolve().parent
APP_ROOT = HERE.parent

DEFAULT_OSM = "/tmp/Beijing.osm.gz"
DEFAULT_DISTRICT_BOUNDARY = str(APP_ROOT / "public" / "data" / "district" / "boundary.geojson")
DEFAULT_OUT = str(APP_ROOT / "public" / "data" / "beijing")
DEFAULT_DATAV_CACHE = "/tmp/beijing-data-cache/datav"
DEFAULT_EOX_CACHE = "/tmp/beijing-data-cache/eox"

DATAV_CITY_URL = "https://geo.datav.aliyun.com/areas_v3/bound/110000.json"
DATAV_FULL_URL = "https://geo.datav.aliyun.com/areas_v3/bound/110000_full.json"

EOX_URL_TEMPLATE = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
EOX_ATTRIBUTION = "Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)"
EOX_LICENSE_URL = "https://cloudless.eox.at/"
DATAV_ATTRIBUTION = "DataV.GeoAtlas (阿里云); 原始 GCJ-02, GCJ-02→WGS84 转换"
DATAV_LICENSE = "DataV.GeoAtlas 服务条款；仅供参考、非官方测绘成果，不得用于边界争议/测绘出版"
OSM_ATTRIBUTION = "© OpenStreetMap contributors"
OSM_LICENSE = "ODbL 1.0"
OSM_LICENSE_URL = "https://opendatacommons.org/licenses/odbl/1-0/"
OSM_EXTRACT = "BBBike Beijing extract (/tmp/Beijing.osm.gz)"
OSM_DOWNLOAD_URL = "https://download.bbbike.org/osm/bbbike/Beijing/"

#: ENU 原点（沿用现有 CBD / district 数据，保证所有图层同一基准）
ORIGIN = (116.4610, 39.9080, 0.0)
#: 现有 CBD 精细白模 / 精细道路 bbox（新数据剔除，避免重复）
CBD_BBOX = (116.430, 39.885, 116.495, 39.930)
#: OSM extract 覆盖范围（BBBike Beijing extract，中心城区）
CENTRAL_BBOX = (116.08, 39.68, 116.77, 40.18)

#: 中心城区干路（只保留快速路/主干/次干，不含 tertiary —— 朝阳区数据里已有 tertiary）
ROAD_CLASSES = (
    "motorway", "trunk", "primary", "secondary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link",
)
ROAD_SIMPLIFY_TOL_M = 3.0
ROAD_MAX_BYTES = 5_000_000

#: 建筑实例筛选（与 district 数据同规则）
MASSING_MIN_AREA_M2 = 20.0
MASSING_MIN_HEIGHT_M = 2.0
MASSING_MAX_HEIGHT_M = 700.0
ROOF_MAX_HEIGHT_M = 2.0

#: basemap
BASEMAP_WIDTH = 3072
BASEMAP_PADDING_DEG = 0.05
BASEMAP_ZOOM = 11
BASEMAP_JPEG_QUALITIES = (90, 87, 84, 81, 77, 72, 66)
BASEMAP_MIN_BYTES = 300_000          # 防"纯黑/空图"自检
BASEMAP_MAX_BYTES = 8_000_000
BASEMAP_MEAN_LUMA_RANGE = (18.0, 245.0)

#: 上下文卫星底图（远视距最底层；z11 北京底图叠在其上，避免市域边缘外露黑边）
# 覆盖范围由「最远总览视距」反推：300 km 视高、16:10 视口下可见约 4.0°×1.9°，
# 再向四周留 ≥1° 余量，保证 290~330 km 总览时画面四角不会露出上下文底图边缘的拉伸条纹。
BASEMAP_CONTEXT_BBOX = (113.80, 38.10, 119.00, 42.20)   # 约 5.2° × 4.1°
BASEMAP_CONTEXT_ZOOM = 10
BASEMAP_CONTEXT_WIDTH = 3072
BASEMAP_CONTEXT_QUALITIES = (90, 86, 82, 77, 71, 64)
BASEMAP_CONTEXT_MAX_BYTES = 3_000_000
BASEMAP_CONTEXT_MIN_OVERLAP_DEG = 0.5   # 至少比市域 z11 rectangle 每侧外扩 0.5°

#: 验收阈值
AREA_EXPECTED_KM2 = 16410.54
AREA_TOLERANCE = 0.05                # ±5%
CHAOYANG_CENTROID_MAX_ERR_M = 1000.0
BOUNDARY_BBOX_EXPECTED = (115.42, 39.44, 117.52, 41.06)   # 允许 ~0.02° 误差（仅记录）

DISTRICT_EN_NAMES = {
    "东城区": "Dongcheng District",
    "西城区": "Xicheng District",
    "朝阳区": "Chaoyang District",
    "丰台区": "Fengtai District",
    "石景山区": "Shijingshan District",
    "海淀区": "Haidian District",
    "门头沟区": "Mentougou District",
    "房山区": "Fangshan District",
    "通州区": "Tongzhou District",
    "顺义区": "Shunyi District",
    "昌平区": "Changping District",
    "大兴区": "Daxing District",
    "怀柔区": "Huairou District",
    "平谷区": "Pinggu District",
    "密云区": "Miyun District",
    "延庆区": "Yanqing District",
}

WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)

# 中国 GCJ-02 偏移算法常量
GCJ_A = 6378245.0
GCJ_EE = 0.00669342162296594323


# --------------------------------------------------------------------------- #
# 1. 通用小工具
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[build-beijing] {msg}", flush=True)


def die(msg: str):
    print(f"[build-beijing] ERROR: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def fmt_size(n: int) -> str:
    if n >= 1 << 20:
        return f"{n / (1 << 20):.2f} MB"
    if n >= 1 << 10:
        return f"{n / (1 << 10):.1f} KB"
    return f"{n} B"


def utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(data)
    return len(data)


def fetch_bytes(url: str, *, timeout: int = 60, retries: int = 4,
                headers: dict | None = None) -> bytes:
    """带重试的 HTTP GET（幂等只读）。"""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers or {
                "User-Agent": "cbd-digital-twin/1.0 (static demo; build-beijing-data.py)",
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # pragma: no cover - 网络重试
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"下载失败 {url}: {last}")


def load_district_module(path: Path):
    """动态加载同级 build-district-data.py（文件名含连字符，不能直接 import）。"""
    if not path.exists():
        die(f"找不到可复用的 district 脚本: {path}")
    spec = importlib.util.spec_from_file_location("build_district_data", path)
    if spec is None or spec.loader is None:
        die(f"无法加载 {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --------------------------------------------------------------------------- #
# 2. GCJ-02 → WGS84
# --------------------------------------------------------------------------- #

def _gcj_tlat(x: float, y: float) -> float:
    r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    r += (160.0 * math.sin(y / 12.0 * math.pi) + 320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return r


def _gcj_tlon(x: float, y: float) -> float:
    r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    r += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return r


def wgs84_to_gcj02(lon: float, lat: float):
    """WGS84 → GCJ-02 正向公式（用于反算的固定点迭代）。"""
    dlat = _gcj_tlat(lon - 105.0, lat - 35.0)
    dlon = _gcj_tlon(lon - 105.0, lat - 35.0)
    radlat = math.radians(lat)
    magic = math.sin(radlat)
    magic = 1.0 - GCJ_EE * magic * magic
    sqrtmagic = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((GCJ_A * (1.0 - GCJ_EE)) / (magic * sqrtmagic) * math.pi)
    dlon = (dlon * 180.0) / (GCJ_A / sqrtmagic * math.cos(radlat) * math.pi)
    return lon + dlon, lat + dlat


def gcj02_to_wgs84(lon: float, lat: float, iters: int = 60):
    """GCJ-02 → WGS84（固定点迭代反解，误差 < 1e-9°）。"""
    wlon, wlat = lon, lat
    for _ in range(iters):
        glon, glat = wgs84_to_gcj02(wlon, wlat)
        dlon, dlat = lon - glon, lat - glat
        if abs(dlon) < 1e-12 and abs(dlat) < 1e-12:
            break
        wlon += dlon
        wlat += dlat
    return wlon, wlat


def convert_gcj_coords(coords, ndigits: int = 7):
    """递归转换 GeoJSON coordinates 数组（GCJ-02 → WGS84）。"""
    if coords and isinstance(coords[0], (int, float)):
        lon, lat = gcj02_to_wgs84(float(coords[0]), float(coords[1]))
        return [round(lon, ndigits), round(lat, ndigits)]
    return [convert_gcj_coords(item, ndigits) for item in coords]


# --------------------------------------------------------------------------- #
# 3. 多边形工具（面积 / 质心 / bbox / 环组织）
# --------------------------------------------------------------------------- #

def polygons_of_geometry(geom: dict):
    """GeoJSON Polygon/MultiPolygon → [ [exterior_ring, hole1, ...], ... ]。"""
    gtype = geom.get("type")
    if gtype == "Polygon":
        return [geom["coordinates"]]
    if gtype == "MultiPolygon":
        return list(geom["coordinates"])
    die(f"不支持的几何类型: {gtype}")


def all_rings(polygons):
    rings = []
    for poly in polygons:
        rings.extend(poly)
    return rings


def rings_bbox(rings):
    xs = [p[0] for ring in rings for p in ring]
    ys = [p[1] for ring in rings for p in ring]
    return [min(xs), min(ys), max(xs), max(ys)]


def _ring_shoelace(ring):
    """返回 (signed_area, sx, sy)；sx/sy 为质心分子（对逆时针为正）。"""
    n = len(ring)
    a = sx = sy = 0.0
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a += cross
        sx += (x1 + x2) * cross
        sy += (y1 + y2) * cross
    return a * 0.5, sx, sy


def polygons_area_km2(polygons, ndigits: int | None = None) -> float:
    """多边形面积（km²）：按各多边形平均纬度做等距近似，扣除洞。"""
    total = 0.0
    for poly in polygons:
        for idx, ring in enumerate(poly):
            n = len(ring)
            if n < 3:
                continue
            mean_lat = sum(p[1] for p in ring) / n
            kx = 111320.0 * math.cos(math.radians(mean_lat))
            ky = 111320.0
            a = 0.0
            for i in range(n):
                x1 = ring[i][0] * kx
                y1 = ring[i][1] * ky
                x2 = ring[(i + 1) % n][0] * kx
                y2 = ring[(i + 1) % n][1] * ky
                a += x1 * y2 - x2 * y1
            area = abs(a) * 0.5 / 1e6
            total += -area if idx > 0 else area
    if ndigits is not None:
        return round(total, ndigits)
    return total


def polygons_centroid(polygons):
    """面积加权质心（经纬度平面近似，作为标签/相机参考点）。"""
    total = cx = cy = 0.0
    for poly in polygons:
        for idx, ring in enumerate(poly):
            n = len(ring)
            if n < 3:
                continue
            signed, sx, sy = _ring_shoelace(ring)
            if abs(signed) < 1e-18:
                continue
            w = -signed if idx > 0 else signed
            total += w
            cx += (sx / (6.0 * signed)) * w
            cy += (sy / (6.0 * signed)) * w
    if abs(total) < 1e-18:
        rings = all_rings(polygons)
        bbox = rings_bbox(rings)
        return ((bbox[0] + bbox[2]) * 0.5, (bbox[1] + bbox[3]) * 0.5)
    return (cx / total, cy / total)


def point_in_rings(lon: float, lat: float, rings) -> bool:
    """多边形环集合 even-odd 点在多边形（洞自动生效）。"""
    inside = False
    for ring in rings:
        n = len(ring)
        j = n - 1
        for i in range(n):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > lat) != (yj > lat):
                x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
                if lon < x_cross:
                    inside = not inside
            j = i
    return inside


def haversine_m(lon1, lat1, lon2, lat2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2.0 * 6371008.8 * math.asin(math.sqrt(a))


def geodetic_to_ecef(lon: float, lat: float, h: float = 0.0):
    lon_r, lat_r = math.radians(lon), math.radians(lat)
    sin_lat, cos_lat = math.sin(lat_r), math.cos(lat_r)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    return (
        (n + h) * cos_lat * math.cos(lon_r),
        (n + h) * cos_lat * math.sin(lon_r),
        (n * (1.0 - WGS84_E2) + h) * sin_lat,
    )


def ecef_to_geodetic(x: float, y: float, z: float):
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    if p < 1e-9:
        return math.degrees(lon), (90.0 if z > 0 else -90.0), abs(z) - WGS84_A * (1.0 - WGS84_F)
    lat = math.atan2(z, p * (1.0 - WGS84_E2))
    h = 0.0
    for _ in range(10):
        sin_lat = math.sin(lat)
        n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
        h = p / math.cos(lat) - n
        lat = math.atan2(z, p * (1.0 - WGS84_E2 * n / (n + h)))
    return math.degrees(lon), math.degrees(lat), h


# --------------------------------------------------------------------------- #
# 4. 边界数据（DataV → WGS84）
# --------------------------------------------------------------------------- #

def load_datav(datav_cache: Path, *, city_url=DATAV_CITY_URL, full_url=DATAV_FULL_URL):
    datav_cache.mkdir(parents=True, exist_ok=True)
    city_path = datav_cache / "110000.json"
    full_path = datav_cache / "110000_full.json"
    if not city_path.exists():
        log(f"下载 {city_url} …")
        city_path.write_bytes(fetch_bytes(city_url))
    if not full_path.exists():
        log(f"下载 {full_url} …")
        full_path.write_bytes(fetch_bytes(full_url))
    city = json.loads(city_path.read_text("utf-8"))
    full = json.loads(full_path.read_text("utf-8"))
    return city, full


def build_boundaries(datav_cache: Path, out_dir: Path, district_boundary: Path) -> dict:
    """输出 boundary.geojson（北京市）与 districts.geojson（16 区），全部 WGS84。"""
    t0 = time.time()
    city, full = load_datav(datav_cache)
    city_feature = (city.get("features") or [None])[0]
    if not city_feature:
        die("DataV 110000.json 无 feature")
    district_features = full.get("features") or []
    if len(district_features) != 16:
        die(f"DataV 110000_full.json 期望 16 个区，实际 {len(district_features)}")

    # --- 北京市边界 ---
    city_geom = json.loads(json.dumps(city_feature["geometry"]))
    city_geom["coordinates"] = convert_gcj_coords(city_geom["coordinates"])
    city_polys = polygons_of_geometry(city_geom)
    city_rings = all_rings(city_polys)
    city_bbox = rings_bbox(city_rings)
    city_area = polygons_area_km2(city_polys)
    city_center = polygons_centroid(city_polys)
    city_props = city_feature.get("properties") or {}
    center_conv = convert_gcj_coords(city_props.get("center") or [0, 0])
    log(f"北京市边界：{len(city_rings)} 环 / {len(city_rings[0])} 点，"
        f"bbox={[round(v, 6) for v in city_bbox]}，面积={city_area:.2f} km²")

    # --- 16 区 ---
    district_feats = []
    district_areas = {}
    for feat in district_features:
        props = feat.get("properties") or {}
        name = props.get("name") or ""
        geom = json.loads(json.dumps(feat["geometry"]))
        geom["coordinates"] = convert_gcj_coords(geom["coordinates"])
        polys = polygons_of_geometry(geom)
        rings = all_rings(polys)
        area = polygons_area_km2(polys)
        cen = polygons_centroid(polys)
        center_conv_d = convert_gcj_coords(props.get("center") or [0, 0])
        centroid_conv_d = convert_gcj_coords(props.get("centroid") or [0, 0])
        district_areas[name] = area
        district_feats.append({
            "type": "Feature",
            "id": f"district/{props.get('adcode', '')}",
            "properties": {
                "name": name,
                "name:en": DISTRICT_EN_NAMES.get(name, ""),
                "adcode": int(props.get("adcode") or 0),
                "level": "district",
                "areaKm2": round(area, 2),
                "center": [round(center_conv_d[0], 6), round(center_conv_d[1], 6)],
                "centroid": [round(cen[0], 6), round(cen[1], 6)],
                "centerNote": "center = DataV 中心点经 GCJ-02→WGS84；centroid = 本脚本面积加权质心；两者均为 WGS84",
                "source": "DataV.GeoAtlas 110000_full.json",
                "attribution": DATAV_ATTRIBUTION,
            },
            "geometry": geom,
        })

    # --- 一致性校验 ---
    sum_area = sum(district_areas.values())
    area_err_pct = abs(city_area - AREA_EXPECTED_KM2) / AREA_EXPECTED_KM2 * 100.0
    if area_err_pct > AREA_TOLERANCE * 100.0:
        die(f"北京市边界面积 {city_area:.1f} km² 偏差 {area_err_pct:.2f}% 超过 5%")

    # 朝阳区质心 vs 现有 OSM 朝阳区边界（public/data/district/boundary.geojson）
    chaoyang_centroid = None
    chaoyang_area = district_areas.get("朝阳区")
    for feat in district_feats:
        if feat["properties"]["name"] == "朝阳区":
            chaoyang_centroid = feat["properties"]["centroid"]
            break
    osm_center = None
    osm_area = None
    if district_boundary.exists():
        try:
            osm_feature = json.loads(district_boundary.read_text("utf-8"))["features"][0]
            osm_polys = polygons_of_geometry(osm_feature["geometry"])
            osm_rings = all_rings(osm_polys)
            osm_center = polygons_centroid(osm_polys)
            osm_area = polygons_area_km2(osm_polys)
        except Exception as exc:
            log(f"WARNING: 无法读取现有朝阳区边界：{exc}")
    centroid_err_m = None
    if chaoyang_centroid and osm_center:
        centroid_err_m = haversine_m(chaoyang_centroid[0], chaoyang_centroid[1],
                                     osm_center[0], osm_center[1])
        if centroid_err_m > CHAOYANG_CENTROID_MAX_ERR_M:
            die(f"朝阳区质心与 OSM 边界相差 {centroid_err_m:.0f} m（阈值 {CHAOYANG_CENTROID_MAX_ERR_M:.0f} m）")
        log(f"朝阳区校验：DataV→WGS84 质心=({chaoyang_centroid[0]:.5f},{chaoyang_centroid[1]:.5f})，"
            f"OSM 质心=({osm_center[0]:.5f},{osm_center[1]:.5f})，差 {centroid_err_m:.1f} m；"
            f"面积 DataV={chaoyang_area:.2f} / OSM={osm_area:.2f} km²")

    # --- 写出 ---
    boundary_bytes = write_json(out_dir / "boundary.geojson", {
        "type": "FeatureCollection",
        "name": "beijing-boundary",
        "bbox": [round(v, 7) for v in city_bbox],
        "coordinateSystem": "WGS84 (EPSG:4326)，由 DataV GCJ-02 转换",
        "attribution": DATAV_ATTRIBUTION,
        "features": [{
            "type": "Feature",
            "id": "city/110000",
            "properties": {
                "name": "北京市",
                "name:en": "Beijing Municipality",
                "adcode": 110000,
                "level": "province",
                "areaKm2": round(city_area, 2),
                "center": [round(center_conv[0], 6), round(center_conv[1], 6)],
                "centroid": [round(city_center[0], 6), round(city_center[1], 6)],
                "source": "DataV.GeoAtlas 110000.json (GCJ-02 → WGS84)",
                "attribution": DATAV_ATTRIBUTION,
                "license": DATAV_LICENSE,
            },
            "geometry": city_geom,
        }],
    })
    district_names = [f["properties"]["name"] for f in district_feats]
    districts_bytes = write_json(out_dir / "districts.geojson", {
        "type": "FeatureCollection",
        "name": "beijing-districts",
        "bbox": [round(v, 7) for v in city_bbox],
        "coordinateSystem": "WGS84 (EPSG:4326)，由 DataV GCJ-02 转换",
        "attribution": DATAV_ATTRIBUTION,
        "features": district_feats,
    })
    log(f"boundary.geojson {fmt_size(boundary_bytes)}；districts.geojson {fmt_size(districts_bytes)}"
        f"（16 区，{sum(len(all_rings(polygons_of_geometry(f['geometry']))) for f in district_feats)} 环）"
        f"，耗时 {time.time() - t0:.1f}s")

    return {
        "boundaryFile": "data/beijing/boundary.geojson",
        "districtsFile": "data/beijing/districts.geojson",
        "bbox": city_bbox,
        "areaKm2": round(city_area, 2),
        "areaExpectedKm2": AREA_EXPECTED_KM2,
        "areaErrorPct": round(area_err_pct, 3),
        "center": [round(city_center[0], 6), round(city_center[1], 6)],
        "centerDataV": [round(center_conv[0], 6), round(center_conv[1], 6)],
        "points": sum(len(r) for r in city_rings),
        "rings": len(city_rings),
        "boundaryBytes": boundary_bytes,
        "districtsBytes": districts_bytes,
        "districts": district_names,
        "districtAreasKm2": {k: round(v, 2) for k, v in district_areas.items()},
        "sumDistrictsAreaKm2": round(sum_area, 2),
        "chaoyang": {
            "areaKm2": round(chaoyang_area, 2) if chaoyang_area else None,
            "centroid": chaoyang_centroid,
            "osmCentroid": [round(v, 6) for v in osm_center] if osm_center else None,
            "osmAreaKm2": round(osm_area, 2) if osm_area else None,
            "centroidErrorM": round(centroid_err_m, 2) if centroid_err_m is not None else None,
        },
        "source": {
            "name": "DataV.GeoAtlas 北京市行政边界",
            "cityUrl": DATAV_CITY_URL,
            "districtsUrl": DATAV_FULL_URL,
            "coordinateSystem": "GCJ-02 → WGS84（固定点迭代反算，最大残差 < 1e-9°）",
            "attribution": DATAV_ATTRIBUTION,
            "license": DATAV_LICENSE,
            "caveat": "DataV 边界为展示用近似边界，非官方测绘成果，精度约百米级，仅用于演示",
        },
    }


# --------------------------------------------------------------------------- #
# 5. 卫星底图（EOX Sentinel-2 z11 → 等经纬度重采样）
# --------------------------------------------------------------------------- #

def _tile_x(lon: float, z: int) -> float:
    return (lon + 180.0) / 360.0 * (1 << z)


def _tile_y(lat: float, z: int) -> float:
    lat_r = math.radians(lat)
    return (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * (1 << z)


def _lon_of_tile_x(x: int, z: int) -> float:
    return x / (1 << z) * 360.0 - 180.0


def _lat_of_tile_y(y: int, z: int) -> float:
    n = math.pi - 2.0 * math.pi * y / (1 << z)
    return math.degrees(math.atan(math.sinh(n)))


def _global_px(lon: float, lat: float, z: int):
    """WGS84 经纬度 → Web Mercator 全局像素坐标（z 级，256px 瓦片）。"""
    return _tile_x(lon, z) * 256.0, _tile_y(lat, z) * 256.0


def fetch_eox_tiles(x0, x1, y0, y1, z: int, cache: Path, *, jobs: int = 6,
                    progress_every: int = 20) -> int:
    """并发下载 EOX z11 瓦片到缓存目录（幂等，已存在则跳过）。返回下载数。"""
    cache.mkdir(parents=True, exist_ok=True)
    tasks = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    todo = [(x, y) for (x, y) in tasks if not _valid_jpeg(cache / f"{z}_{y}_{x}.jpg")]
    if not todo:
        log(f"EOX 瓦片已全部缓存（{len(tasks)} 张）")
        return 0
    log(f"下载 EOX z{z} 瓦片 {len(todo)}/{len(tasks)} 张（每张 256×256）…")

    def _one(xy):
        x, y = xy
        url = EOX_URL_TEMPLATE.format(z=z, y=y, x=x)
        data = fetch_bytes(url, timeout=45,
                           headers={"User-Agent": "cbd-digital-twin/1.0 (static demo)"})
        if len(data) < 256 or data[:2] != b"\xff\xd8":
            raise RuntimeError(f"瓦片非 JPEG: {url}")
        (cache / f"{z}_{y}_{x}.jpg").write_bytes(data)
        return len(data)

    t0 = time.time()
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as ex:
        futures = {ex.submit(_one, xy): xy for xy in todo}
        done = 0
        for fut in concurrent.futures.as_completed(futures):
            done += 1
            try:
                fut.result()
            except Exception as exc:  # pragma: no cover
                failed.append((futures[fut], exc))
            if done % progress_every == 0:
                log(f"  …{done}/{len(todo)}（{time.time() - t0:.0f}s）")
    if failed:
        die(f"EOX 瓦片下载失败 {len(failed)} 张：{failed[:3]}")
    log(f"EOX 瓦片下载完成 {len(todo)} 张（{time.time() - t0:.1f}s）")
    return len(todo)


def _valid_jpeg(path: Path) -> bool:
    try:
        return path.exists() and path.stat().st_size > 256 and path.read_bytes()[:2] == b"\xff\xd8"
    except Exception:
        return False


def _render_eox_rect(rect, out_path: Path, eox_cache: Path, *, zoom: int, width: int,
                     max_bytes: int, qualities, label: str, jobs: int = 6,
                     note: str = "") -> dict:
    """通用 EOX 瓦片管线：下载 → Web Mercator 拼图 → 等经纬度重采样 → JPEG。

    输出图片的像素与经纬度是**线性映射**（Plate Carrée），可直接用于 Cesium
    单张贴图 / GeoJSON 对齐；返回包含 rectangle/width/height/字节数的信息字典。
    """
    if np is None or Image is None:
        die("basemap 需要 numpy + Pillow，请使用 bundled Python")
    t0 = time.time()
    west, south, east, north = rect
    lon_span, lat_span = east - west, north - south
    out_h = int(round(width * lat_span / lon_span))

    z = zoom
    x0 = math.floor(_tile_x(west, z))
    x1 = math.floor(_tile_x(east, z))
    y0 = math.floor(_tile_y(north, z))
    y1 = math.floor(_tile_y(south, z))
    mosaic_lon_w, mosaic_lon_e = _lon_of_tile_x(x0, z), _lon_of_tile_x(x1 + 1, z)
    mosaic_lat_n, mosaic_lat_s = _lat_of_tile_y(y0, z), _lat_of_tile_y(y1 + 1, z)
    if not (west >= mosaic_lon_w and east <= mosaic_lon_e and north <= mosaic_lat_n and south >= mosaic_lat_s):
        die("瓦片覆盖范围未完全包含 basemap rectangle")
    log(f"{label} rectangle={rect}（lon {lon_span:.4f}° / lat {lat_span:.4f}°），"
        f"z{z} 瓦片 x[{x0},{x1}] y[{y0},{y1}]，输出 {width}×{out_h}px")
    fetch_eox_tiles(x0, x1, y0, y1, z, eox_cache, jobs=jobs)

    # --- 拼图 ---
    cols, rows = x1 - x0 + 1, y1 - y0 + 1
    mosaic = Image.new("RGB", (cols * 256, rows * 256))
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            tile_path = eox_cache / f"{z}_{ty}_{tx}.jpg"
            with Image.open(tile_path) as tile:
                mosaic.paste(tile.convert("RGB"), ((tx - x0) * 256, (ty - y0) * 256))
    mw, mh = mosaic.size
    src = np.asarray(mosaic, dtype=np.uint8)
    log(f"  {label} 拼图 {mw}×{mh}（{cols}×{rows} 瓦片），等经纬度重采样 …")

    # --- 等经纬度重采样（双线性） ---
    # 输出像素中心对应的经纬度（线性），再映射到 Mercator 拼图像素坐标
    lons = west + (np.arange(width, dtype=np.float64) + 0.5) * (lon_span / width)
    lats = north - (np.arange(out_h, dtype=np.float64) + 0.5) * (lat_span / out_h)
    gx = ((lons + 180.0) / 360.0 * (1 << z) * 256.0) - x0 * 256.0 - 0.5
    lat_r = np.radians(lats)
    gy = ((1.0 - np.arcsinh(np.tan(lat_r)) / np.pi) / 2.0 * (1 << z) * 256.0) - y0 * 256.0 - 0.5
    gx = np.clip(gx, 0.0, mw - 1.000001)
    gy = np.clip(gy, 0.0, mh - 1.000001)
    x_floor = np.floor(gx).astype(np.int32)
    y_floor = np.floor(gy).astype(np.int32)
    fx = (gx - x_floor).astype(np.float32)[None, :, None]
    x_next = np.minimum(x_floor + 1, mw - 1)
    out = np.empty((out_h, width, 3), dtype=np.uint8)
    chunk = 64
    for y_start in range(0, out_h, chunk):
        y_end = min(out_h, y_start + chunk)
        ys = y_floor[y_start:y_end]
        y_next = np.minimum(ys + 1, mh - 1)
        fy = (gy[y_start:y_end] - ys).astype(np.float32)[:, None, None]
        top = src[ys[:, None], x_floor[None, :]].astype(np.float32)
        bot = src[y_next[:, None], x_floor[None, :]].astype(np.float32)
        top_r = src[ys[:, None], x_next[None, :]].astype(np.float32)
        bot_r = src[y_next[:, None], x_next[None, :]].astype(np.float32)
        upper = top * (1.0 - fx) + top_r * fx
        lower = bot * (1.0 - fx) + bot_r * fx
        blended = upper * (1.0 - fy) + lower * fy
        out[y_start:y_end] = np.clip(np.rint(blended), 0, 255).astype(np.uint8)

    img = Image.fromarray(out, "RGB")
    mean_luma = float(np.asarray(img.convert("L"), dtype=np.float32).mean())
    if not (BASEMAP_MEAN_LUMA_RANGE[0] <= mean_luma <= BASEMAP_MEAN_LUMA_RANGE[1]):
        die(f"{label} 平均亮度 {mean_luma:.1f} 异常（可能全黑/全白）")

    # --- JPEG（质量自适应，确保体积上限） ---
    out_path.parent.mkdir(parents=True, exist_ok=True)
    chosen = None
    for quality in qualities:
        img.save(out_path, "JPEG", quality=quality, optimize=True, progressive=True,
                 subsampling=1)
        size = out_path.stat().st_size
        if size < max_bytes:
            chosen = (quality, size)
            break
    if chosen is None:
        die(f"{label} JPEG 无法压到 {fmt_size(max_bytes)} 以下")
    if chosen[1] < BASEMAP_MIN_BYTES:
        log(f"WARNING: {label} 体积偏小（{chosen[1]} B），可能是纯色图？")
    quality, size = chosen
    log(f"{out_path.name} {fmt_size(size)}（{width}×{out_h}，z{z}，quality={quality}，"
        f"meanLuma={mean_luma:.1f}，{time.time() - t0:.1f}s）")

    return {
        "file": f"data/beijing/{out_path.name}",
        "rectangle": [round(v, 7) for v in rect],
        "width": width,
        "height": out_h,
        "bytes": size,
        "zoom": z,
        "jpegQuality": quality,
        "meanLuma": round(mean_luma, 1),
        "pixelMapping": "等经纬度（Plate Carrée）线性映射：x=(lon-west)/(east-west)*width，y=(north-lat)/(north-south)*height",
        "projection": "源瓦片为 Web Mercator (EPSG:3857)，已双线性重采样为经纬度线性（EPSG:4326），可直接贴 Cesium.Rectangle 与矢量图层对齐",
        "tileRange": {"x": [x0, x1], "y": [y0, y1], "z": z},
        "attribution": EOX_ATTRIBUTION,
        "license": "CC BY 4.0",
        "licenseUrl": EOX_LICENSE_URL,
        "source": {
            "name": "EOX Sentinel-2 cloudless 2020",
            "urlTemplate": EOX_URL_TEMPLATE,
            "zoom": z,
            "mosaicTiles": cols * rows,
            "mosaicPixels": [mw, mh],
            "attribution": EOX_ATTRIBUTION,
            "license": "CC BY 4.0",
            "licenseUrl": EOX_LICENSE_URL,
            "note": note or "影像时相约 2020 年 Sentinel-2 无云合成",
        },
    }


def build_basemap(city_bbox, out_path: Path, eox_cache: Path, *,
                  width: int = BASEMAP_WIDTH,
                  padding: float = BASEMAP_PADDING_DEG,
                  zoom: int = BASEMAP_ZOOM,
                  jobs: int = 6) -> dict:
    """北京市域卫星底图（z11，覆盖 boundary bbox + padding）。"""
    rect = [round(city_bbox[0] - padding, 7), round(city_bbox[1] - padding, 7),
            round(city_bbox[2] + padding, 7), round(city_bbox[3] + padding, 7)]
    return _render_eox_rect(rect, out_path, eox_cache, zoom=zoom, width=width,
                            max_bytes=BASEMAP_MAX_BYTES, qualities=BASEMAP_JPEG_QUALITIES,
                            label="basemap(z11 北京)", jobs=jobs,
                            note="影像时相约 2020 年 Sentinel-2 无云合成；z11 约 60 m/px")


def build_context_basemap(out_path: Path, eox_cache: Path, *,
                          width: int = BASEMAP_CONTEXT_WIDTH,
                          jobs: int = 6) -> dict:
    """北京周边上下文卫星底图（z10，覆盖约 3.9°×3.2°，作为最底层，z11 北京底图叠其上）。

    用于远视距（>150 km）时避免市域 z11 底图边缘之外露出纯黑背景/贴图拉伸。
    """
    rect = [round(v, 7) for v in BASEMAP_CONTEXT_BBOX]
    return _render_eox_rect(rect, out_path, eox_cache, zoom=BASEMAP_CONTEXT_ZOOM,
                            width=width, max_bytes=BASEMAP_CONTEXT_MAX_BYTES,
                            qualities=BASEMAP_CONTEXT_QUALITIES,
                            label="basemap-context(z10 北京周边)", jobs=jobs,
                            note="影像时相约 2020 年 Sentinel-2 无云合成；z10 约 120 m/px，仅作远视距上下文背景")


# --------------------------------------------------------------------------- #
# 6. 中心城区建筑 massing（剔除朝阳区 + CBD 精细 bbox）
# --------------------------------------------------------------------------- #

def _ring_centroid_enu(pts):
    """ENU 平面环的 (质心x, 质心y, |面积|)。"""
    n = len(pts)
    a = 0.0
    cx = cy = 0.0
    for i in range(n):
        x1, y1 = pts[i][0], pts[i][1]
        x2, y2 = pts[(i + 1) % n][0], pts[(i + 1) % n][1]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a *= 0.5
    if abs(a) < 1e-9:
        return sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n, 0.0
    return cx / (6.0 * a), cy / (6.0 * a), abs(a)


def process_massing(buildings, nodes, frame, dd, *, exclude_rings_enu,
                    exclude_rings_lonlat) -> dict:
    """中心城区 OBB box 实例。

    过滤顺序：有效 footprint → 中心城区 bbox → 朝阳区外 → CBD bbox 外 →
    面积/高度/roof 规则。返回 massing 列表 + 统计 + 抽样。
    """
    t0 = time.time()
    total = len(buildings)
    prepared = dd.pip_inputs(exclude_rings_enu) if exclude_rings_enu else None
    cbd_w, cbd_s, cbd_e, cbd_n = CBD_BBOX
    c_w, c_s, c_e, c_n = CENTRAL_BBOX

    phase1 = []   # (index, lon_c, lat_c, east, north, area, ring_enu, ring_lonlat)
    skipped_degenerate = 0
    skipped_central = 0
    skipped_cbd = 0
    skipped_chaoyang = 0
    for idx, (wid, refs, tags) in enumerate(buildings):
        coords = dd.resolve_coords(refs, nodes)
        if coords is None:
            skipped_degenerate += 1
            continue
        ring = dd.clean_ring_xy(coords)
        if len(ring) < 3:
            skipped_degenerate += 1
            continue
        pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in ring]
        cx, cy, area = _ring_centroid_enu(pts)
        lon_c = sum(p[0] for p in ring) / len(ring)
        lat_c = sum(p[1] for p in ring) / len(ring)
        if not (c_w <= lon_c <= c_e and c_s <= lat_c <= c_n):
            skipped_central += 1
            continue
        if cbd_w <= lon_c <= cbd_e and cbd_s <= lat_c <= cbd_n:
            skipped_cbd += 1
            continue
        # 先按质心做 O(1) 的边界外快速筛选，PIP 只在第二阶段做批量
        phase1.append((idx, lon_c, lat_c, cx, cy, area, pts, ring))

    # 批量 PIP：剔除朝阳区边界内
    if prepared is not None and phase1:
        mask = dd.pip_mask_np([(rec[3], rec[4]) for rec in phase1], prepared)
        if np is not None:
            mask = np.asarray(mask)
        keep = []
        for i, rec in enumerate(phase1):
            if bool(mask[i]) if np is not None else mask[i]:
                skipped_chaoyang += 1
            else:
                keep.append(rec)
        phase1 = keep
    log(f"  建筑 {total} 条 → 中心城区外 {skipped_central}，CBD 精细 bbox 内 {skipped_cbd}，"
        f"朝阳区边界内 {skipped_chaoyang}，剩余 {len(phase1)}（{time.time() - t0:.1f}s）")

    massing = []
    samples = []
    skipped_area = 0
    skipped_roof = 0
    height_sources = {"height": 0, "levels": 0, "default": 0}
    for idx, lon_c, lat_c, cx, cy, area, pts, ring in phase1:
        wid, refs, tags = buildings[idx]
        kind = dd.building_kind(tags)
        height, hsrc = dd.estimate_height(tags, wid)
        height_sources[hsrc.split(":", 1)[0]] += 1
        if area < MASSING_MIN_AREA_M2:
            skipped_area += 1
            continue
        if kind == "roof" and not (hsrc == "height" and height >= ROOF_MAX_HEIGHT_M):
            skipped_roof += 1
            continue
        height = max(MASSING_MIN_HEIGHT_M, min(height, MASSING_MAX_HEIGHT_M))
        obb = dd.min_area_rect([(p[0], p[1]) for p in pts])
        if obb is None:
            continue
        # 质心处 ground ENU up（含曲率）；用顶点均值近似（与 district 数据一致）
        up_ground = sum(p[2] for p in pts) / len(pts)
        # 二次确认：OBB 中心也不能落在 CBD 精细 bbox（顶点均值质心可能刚好在 bbox 外，
        # 但 OBB 中心偏移十几米就跨进去，会与现有精细白模产生重叠）
        lon_obb, lat_obb, _h = _enu_to_lonlat(frame, obb["cx"], obb["cy"], up_ground)
        if cbd_w - 1e-9 <= lon_obb <= cbd_e + 1e-9 and cbd_s - 1e-9 <= lat_obb <= cbd_n + 1e-9:
            skipped_cbd += 1
            continue
        tier = 0 if height < dd.TIERS[0]["maxHeight"] else (1 if height < dd.TIERS[1]["maxHeight"] else 2)
        rec = {
            "id": wid, "east": obb["cx"], "north": obb["cy"], "up": up_ground,
            "w": max(obb["w"], 1.0), "d": max(obb["d"], 1.0),
            "angle": obb["angle"], "height": height, "tier": tier,
            "area": area, "kind": kind,
            "name": (tags.get("name") or "").strip(),
            # 以下字段仅构建期使用（不写入 GLB）
            "lon": lon_c, "lat": lat_c,
        }
        massing.append(rec)

    # 抽样：给 Cesium 校验用的大体量建筑（选 footprint 大、够高的，避免被遮挡）
    candidates = [r for r in massing if r["w"] >= 40 and r["d"] >= 40 and r["height"] >= 30]
    candidates.sort(key=lambda r: (-round(r["height"], -1), -r["area"]))
    seen = set()
    for rec in candidates:
        key = (round(rec["east"] / 2000), round(rec["north"] / 2000))
        if key in seen:
            continue
        seen.add(key)
        lon, lat, _h = _enu_to_lonlat(frame, rec["east"], rec["north"], rec["up"])
        samples.append({
            "id": rec["id"], "lon": round(lon, 7), "lat": round(lat, 7),
            "east": round(rec["east"], 3), "north": round(rec["north"], 3),
            "up": round(rec["up"], 3), "height": round(rec["height"], 2),
            "w": round(rec["w"], 2), "d": round(rec["d"], 2),
        })
        if len(samples) >= 10:
            break

    log(f"  massing 实例 {len(massing)}（面积过小 {skipped_area}，roof {skipped_roof}；"
        f"高度来源 {height_sources}；{time.time() - t0:.1f}s）")
    # 双重校验：实例中心不得落在朝阳区内
    if prepared is not None and massing:
        check = dd.pip_mask_np([(r["east"], r["north"]) for r in massing], prepared)
        if np is not None:
            inside = int(np.asarray(check).sum())
        else:
            inside = sum(1 for v in check if v)
        if inside:
            die(f"massing 中有 {inside} 个实例落在朝阳区边界内（不应发生）")
        log(f"  校验：{len(massing)} 个实例中落在朝阳区内的 = 0 ✅")

    return {
        "massing": massing,
        "samples": samples,
        "stats": {
            "buildingWays": total,
            "skippedDegenerate": skipped_degenerate,
            "skippedOutsideCentralBbox": skipped_central,
            "skippedInsideCbdBbox": skipped_cbd,
            "skippedInsideChaoyang": skipped_chaoyang,
            "candidatesOutsideChaoyang": len(phase1),
            "massingInstances": len(massing),
            "skippedArea": skipped_area,
            "skippedRoof": skipped_roof,
            "heightSources": height_sources,
        },
    }


def _enu_to_lonlat(frame, east: float, north: float, up: float):
    ex, ey, ez = frame.east
    nx, ny, nz = frame.north
    ux, uy, uz = frame.up
    ox, oy, oz = frame.origin_ecef
    x = ox + east * ex + north * nx + up * ux
    y = oy + east * ey + north * ny + up * uy
    z = oz + east * ez + north * nz + up * uz
    return ecef_to_geodetic(x, y, z)


# --------------------------------------------------------------------------- #
# 7. 中心城区干路（剔除朝阳区 + CBD bbox）
# --------------------------------------------------------------------------- #

def _segment_intersection_t(p, q, a, b):
    """线段 p→q 与 a→b 相交参数 t（沿 p→q），无交点返回 None。二维。"""
    rx, ry = q[0] - p[0], q[1] - p[1]
    sx, sy = b[0] - a[0], b[1] - a[1]
    denom = rx * sy - ry * sx
    if abs(denom) < 1e-12:
        return None
    qpx, qpy = a[0] - p[0], a[1] - p[1]
    t = (qpx * sy - qpy * sx) / denom
    u = (qpx * ry - qpy * rx) / denom
    if -1e-9 <= t <= 1.0 + 1e-9 and -1e-9 <= u <= 1.0 + 1e-9:
        return min(1.0, max(0.0, t))
    return None


def _first_boundary_crossing(p_enu, q_enu, boundary_edges):
    best = None
    for (a, b) in boundary_edges:
        t = _segment_intersection_t(p_enu, q_enu, a, b)
        if t is not None and (best is None or t < best):
            best = t
    return best


def _lerp_lonlat(p, q, t):
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]


def clip_line_outside_polygon(coords, enu_pts, inside_flags, boundary_edges):
    """把一条折线裁剪成「多边形外」的若干段（交点精确到线段级）。"""
    if not any(inside_flags):
        return [coords]
    if all(inside_flags):
        return []
    runs = []
    cur = []
    n = len(coords)
    for i in range(n):
        if not inside_flags[i]:
            if cur and i > 0 and inside_flags[i - 1]:
                t = _first_boundary_crossing(enu_pts[i - 1], enu_pts[i], boundary_edges)
                if t is not None:
                    cur.append(_lerp_lonlat(coords[i - 1], coords[i], t))
            cur.append(coords[i])
        else:
            if cur:
                if i > 0 and not inside_flags[i - 1]:
                    t = _first_boundary_crossing(enu_pts[i - 1], enu_pts[i], boundary_edges)
                    if t is not None:
                        cur.append(_lerp_lonlat(coords[i - 1], coords[i], t))
                if len(cur) >= 2:
                    runs.append(cur)
                cur = []
    if cur and len(cur) >= 2:
        runs.append(cur)
    return runs


def process_roads(roads, nodes, frame, dd, *, exclude_rings_enu):
    """中心城区干路：剔除朝阳区内片段 + CBD bbox，RDP 3 m。"""
    t0 = time.time()
    prepared = dd.pip_inputs(exclude_rings_enu)
    boundary_edges = []
    for ring in exclude_rings_enu:
        for i in range(len(ring)):
            boundary_edges.append((ring[i], ring[(i + 1) % len(ring)]))

    candidates = []
    all_enu = []
    for wid, refs, tags in roads:
        cls = (tags.get("highway") or "").strip()
        if cls not in ROAD_CLASSES:
            continue
        coords = dd.resolve_coords(refs, nodes, min_points=2)
        if coords is None or len(coords) < 2:
            continue
        enu = [frame.enu(lon, lat, 0.0) for (lon, lat) in coords]
        start = len(all_enu)
        all_enu.extend([(p[0], p[1]) for p in enu])
        candidates.append((wid, tags, coords, enu, start))

    if not candidates:
        die("没有候选道路")
    mask = dd.pip_mask_np([(p[0], p[1]) for p in all_enu], prepared)
    if np is not None:
        mask = np.asarray(mask)

    features = []
    kept_before = kept_after = 0
    skipped_inside = 0
    for (wid, tags, coords, enu, start) in candidates:
        flags = [bool(v) for v in (mask[start:start + len(coords)])]
        if all(flags):
            skipped_inside += 1
            continue
        runs = clip_line_outside_polygon(coords, enu, flags, boundary_edges)
        for run in runs:
            # 剔除 CBD 精细 bbox（与现有精细道路重复）
            for piece in dd.subtract_bbox_from_line(run, CBD_BBOX):
                if len(piece) < 2:
                    continue
                lon0, lat0 = piece[0]
                kx = 111320.0 * math.cos(math.radians(lat0))
                ky = 111320.0
                planar = [((lon - lon0) * kx, (lat - lat0) * ky) for (lon, lat) in piece]
                keep = dd.simplify_rdp_indices(planar, ROAD_SIMPLIFY_TOL_M)
                if len(keep) < 2:
                    keep = [0, len(piece) - 1]
                lonlat = [[round(piece[i][0], 7), round(piece[i][1], 7)] for i in keep]
                if len(lonlat) < 2:
                    continue
                kept_before += len(piece)
                kept_after += len(lonlat)
                oid = f"way/{wid}#{len(features)}"
                prop = {"id": oid, "class": tags.get("highway")}
                name = (tags.get("name") or "").strip()
                if name:
                    prop["name"] = name
                ref = (tags.get("ref") or "").strip()
                if ref:
                    prop["ref"] = ref
                features.append({
                    "type": "Feature", "id": oid, "properties": prop,
                    "geometry": {"type": "LineString", "coordinates": lonlat},
                })
    stats = {
        "candidates": len(candidates),
        "kept": len(features),
        "skippedFullyInsideChaoyang": skipped_inside,
        "pointsBefore": kept_before,
        "pointsAfter": kept_after,
        "seconds": round(time.time() - t0, 1),
    }
    log(f"  roads: {len(features)} 条（候选 {len(candidates)}，完全在朝阳区内 {skipped_inside}，"
        f"点 {kept_before}→{kept_after}，{stats['seconds']}s）")
    return features, stats


# --------------------------------------------------------------------------- #
# 8. 校验
# --------------------------------------------------------------------------- #

def _read_glb_instances(glb_path: Path):
    """从 GLB 中还原实例 (east,north,up,w,height,d,angle)。"""
    data = glb_path.read_bytes()
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise ValueError("GLB magic 非法")
    off = 12
    json_chunk = bin_chunk = None
    while off + 8 <= len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        off += 8
        payload = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            json_chunk = payload
        elif ctype == 0x004E4942:
            bin_chunk = payload
    gltf = json.loads(json_chunk.decode("utf-8").rstrip())
    out = []
    for node in gltf.get("nodes") or []:
        ext = (node.get("extensions") or {}).get("EXT_mesh_gpu_instancing")
        if not ext:
            continue
        attrs = ext.get("attributes") or {}
        tr = gltf["accessors"][attrs["TRANSLATION"]]
        ro = gltf["accessors"][attrs["ROTATION"]]
        sc = gltf["accessors"][attrs["SCALE"]]
        tr_bytes = bin_chunk[gltf["bufferViews"][tr["bufferView"]].get("byteOffset", 0):]
        ro_bytes = bin_chunk[gltf["bufferViews"][ro["bufferView"]].get("byteOffset", 0):]
        sc_bytes = bin_chunk[gltf["bufferViews"][sc["bufferView"]].get("byteOffset", 0):]
        n = tr["count"]
        t = struct.unpack_from("<%df" % (n * 3), tr_bytes)
        r = struct.unpack_from("<%df" % (n * 4), ro_bytes)
        s = struct.unpack_from("<%df" % (n * 3), sc_bytes)
        for i in range(n):
            angle = 2.0 * math.asin(max(-1.0, min(1.0, r[i * 4 + 1])))
            out.append({
                "east": t[i * 3], "up": t[i * 3 + 1], "north": -t[i * 3 + 2],
                "w": s[i * 3], "height": s[i * 3 + 1], "d": s[i * 3 + 2],
                "angle": angle,
            })
    return gltf, out


def verify_outputs(out_dir: Path, dd, frame, boundary_info: dict,
                   basemap_info: dict | None) -> dict:
    """对已生成产物做全面自检（生成后 / --verify-only 共用）。"""
    report = {"errors": [], "warnings": [], "checks": {}, "files": {}}
    tiles_dir = out_dir / "tiles" / "massing"
    glb_path = tiles_dir / "massing.glb"
    tileset_path = tiles_dir / "tileset.json"

    for name, path in [
        ("boundary", out_dir / "boundary.geojson"),
        ("districts", out_dir / "districts.geojson"),
        ("roads", out_dir / "roads.geojson"),
        ("meta", out_dir / "meta.json"),
        ("basemap", out_dir / "basemap.jpg"),
        ("basemapContext", out_dir / "basemap-context.jpg"),
        ("tileset", tileset_path),
        ("glb", glb_path),
    ]:
        report["files"][name] = path.stat().st_size if path.exists() else None
        if not path.exists():
            report["errors"].append(f"缺少文件 {path}")

    # GeoJSON 可解析
    for name in ("boundary", "districts", "roads"):
        path = out_dir / f"{name}.geojson"
        if not path.exists():
            continue
        try:
            doc = json.loads(path.read_text("utf-8"))
            if doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
                report["errors"].append(f"{name}.geojson 结构非法")
            else:
                report["checks"][name] = {"features": len(doc["features"]), "bytes": path.stat().st_size}
        except Exception as exc:
            report["errors"].append(f"{name}.geojson 解析失败: {exc}")
    if report["files"].get("roads") and report["files"]["roads"] > ROAD_MAX_BYTES:
        report["errors"].append(f"roads.geojson {fmt_size(report['files']['roads'])} 超过 5MB")

    # 边界面积/区数
    try:
        bdoc = json.loads((out_dir / "boundary.geojson").read_text("utf-8"))
        polys = polygons_of_geometry(bdoc["features"][0]["geometry"])
        area = polygons_area_km2(polys)
        report["checks"]["boundaryAreaKm2"] = round(area, 2)
        if abs(area - AREA_EXPECTED_KM2) / AREA_EXPECTED_KM2 > AREA_TOLERANCE:
            report["errors"].append(f"边界面积 {area:.1f} km² 偏差超 5%")
        ddoc = json.loads((out_dir / "districts.geojson").read_text("utf-8"))
        if len(ddoc["features"]) != 16:
            report["errors"].append(f"districts 数量 {len(ddoc['features'])} != 16")
        report["checks"]["districts"] = len(ddoc["features"])
    except Exception as exc:
        report["errors"].append(f"边界校验失败: {exc}")

    # basemap
    if (out_dir / "basemap.jpg").exists() and Image is not None:
        try:
            with Image.open(out_dir / "basemap.jpg") as img:
                report["checks"]["basemapSize"] = list(img.size)
                if img.size[0] < 2000:
                    report["errors"].append(f"basemap 宽度 {img.size[0]} 过小")
            report["checks"]["basemapBytes"] = (out_dir / "basemap.jpg").stat().st_size
        except Exception as exc:
            report["errors"].append(f"basemap 读取失败: {exc}")

    # 上下文底图
    ctx_path = out_dir / "basemap-context.jpg"
    if ctx_path.exists() and Image is not None:
        try:
            with Image.open(ctx_path) as img:
                report["checks"]["basemapContextSize"] = list(img.size)
            report["checks"]["basemapContextBytes"] = ctx_path.stat().st_size
            if ctx_path.stat().st_size >= BASEMAP_CONTEXT_MAX_BYTES:
                report["errors"].append(
                    f"basemap-context.jpg {fmt_size(ctx_path.stat().st_size)} 超过 3MB")
            try:
                meta = json.loads((out_dir / "meta.json").read_text("utf-8"))
                ctx = meta.get("basemapContext") or {}
                cr = ctx.get("rectangle")
                br = (meta.get("basemap") or {}).get("rectangle")
                if not cr:
                    report["warnings"].append("meta.basemapContext 缺失（远视距可能露黑边）")
                elif br and not (cr[0] < br[0] and cr[1] < br[1] and cr[2] > br[2] and cr[3] > br[3]):
                    report["errors"].append("meta.basemapContext rectangle 未覆盖 basemap rectangle")
                else:
                    report["checks"]["basemapContextCovers"] = True
            except Exception:
                pass
        except Exception as exc:
            report["errors"].append(f"basemap-context.jpg 读取失败: {exc}")

    # tileset + glb
    if glb_path.exists() and tileset_path.exists():
        try:
            gltf, instances = _read_glb_instances(glb_path)
            glb_report = dd.validate_glb(glb_path, len(instances))
            ts_report = dd.validate_tileset(tileset_path, frame, instances)
            report["checks"]["instances"] = len(instances)
            report["checks"]["triangles"] = len(instances) * 12
            report["checks"]["glbBytes"] = glb_path.stat().st_size
            report["errors"].extend(f"GLB: {e}" for e in glb_report["errors"])
            report["errors"].extend(f"tileset: {e}" for e in ts_report["errors"])
            # 实例不得落在朝阳区内
            district_path = Path(DEFAULT_DISTRICT_BOUNDARY)
            if district_path.exists():
                osm = json.loads(district_path.read_text("utf-8"))["features"][0]
                ex_rings = all_rings(polygons_of_geometry(osm["geometry"]))
                ex_enu = [[frame.enu(lon, lat, 0.0)[:2] for (lon, lat) in ring] for ring in ex_rings]
                prepared = dd.pip_inputs(ex_enu)
                mask = dd.pip_mask_np([(r["east"], r["north"]) for r in instances], prepared)
                inside = int(np.asarray(mask).sum()) if np is not None else sum(1 for v in mask if v)
                report["checks"]["instancesInsideChaoyang"] = inside
                if inside:
                    report["errors"].append(f"{inside} 个实例落在朝阳区内")
            # GLB 实例翻译回经纬度抽样（语义自检）
            sample_errors = []
            for rec in instances[:3]:
                lon, lat, _ = _enu_to_lonlat(frame, rec["east"], rec["north"], rec["up"])
                if not (-180 <= lon <= 180 and -90 <= lat <= 90):
                    sample_errors.append((lon, lat))
            if sample_errors:
                report["errors"].append(f"实例 ENU→经纬度反算异常: {sample_errors}")
        except Exception as exc:
            report["errors"].append(f"GLB/tileset 校验失败: {exc}")

    # meta 一致性
    try:
        meta = json.loads((out_dir / "meta.json").read_text("utf-8"))
        report["checks"]["metaName"] = meta.get("name")
        if report["checks"].get("instances") and meta.get("tiles", {}).get("massing", {}).get("instances") not in (None, report["checks"]["instances"]):
            report["errors"].append("meta 实例数与 GLB 不一致")
        if basemap_info and meta.get("basemap", {}).get("rectangle") != basemap_info.get("rectangle"):
            report["errors"].append("meta basemap rectangle 与本次生成不一致")
    except Exception as exc:
        report["errors"].append(f"meta 校验失败: {exc}")

    report["ok"] = not report["errors"]
    return report


# --------------------------------------------------------------------------- #
# 9. 主流程
# --------------------------------------------------------------------------- #

def default_out_dir() -> Path:
    return Path(DEFAULT_OUT)


def run_build(args) -> int:
    t_start = time.time()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    tiles_dir = out_dir / "tiles" / "massing"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    only = set(args.only.split(",")) if args.only else {"all"}
    do = lambda step: "all" in only or step in only  # noqa: E731

    dd = load_district_module(Path(args.district_tool))
    dd.GENERATOR = GENERATOR  # 让 GLB/tileset 的 generator 记录正确的脚本名
    frame = dd.LocalFrame(*ORIGIN)
    log(f"复用 {Path(args.district_tool).name} 的 LocalFrame/OSM/OBB/GLB/tileset 逻辑")
    log(f"ENU 原点 {ORIGIN}，ECEF=({frame.origin_ecef[0]:.1f}, {frame.origin_ecef[1]:.1f}, {frame.origin_ecef[2]:.1f})")

    boundary_info_path = out_dir / "_boundary_info.json"
    basemap_info_path = out_dir / "_basemap_info.json"
    context_info_path = out_dir / "_basemap_context_info.json"

    # --- 1) 边界 ---
    boundary_info = None
    if do("boundary"):
        log("=" * 70)
        log("步骤 1/6：行政边界（DataV GCJ-02 → WGS84）")
        boundary_info = build_boundaries(Path(args.datav_cache), out_dir,
                                         Path(args.district_boundary))
        write_json(boundary_info_path, boundary_info)
    else:
        if boundary_info_path.exists():
            boundary_info = json.loads(boundary_info_path.read_text("utf-8"))
        else:
            log("WARNING: 缺少 boundary 步骤产物 _boundary_info.json，面积/bbox 信息可能不完整")
            boundary_info = {"bbox": BOUNDARY_BBOX_EXPECTED, "areaKm2": AREA_EXPECTED_KM2}

    city_bbox = boundary_info.get("bbox") or list(BOUNDARY_BBOX_EXPECTED)

    # --- 2) 市域卫星底图（z11） ---
    basemap_info = None
    if do("basemap") and not args.skip_basemap:
        log("=" * 70)
        log("步骤 2/6：北京市域卫星底图（EOX Sentinel-2 z11 → 等经纬度重采样）")
        basemap_info = build_basemap(city_bbox, out_dir / "basemap.jpg",
                                     Path(args.eox_cache), width=args.basemap_width,
                                     padding=args.basemap_padding, jobs=args.jobs)
        write_json(basemap_info_path, basemap_info)
    else:
        if basemap_info_path.exists():
            basemap_info = json.loads(basemap_info_path.read_text("utf-8"))

    # --- 3) 上下文卫星底图（z10，远视距最底层） ---
    context_info = None
    if do("context") and not args.skip_basemap:
        log("=" * 70)
        log("步骤 3/6：北京周边上下文卫星底图（EOX z10，覆盖 %.2f°×%.2f°）"
            % (BASEMAP_CONTEXT_BBOX[2] - BASEMAP_CONTEXT_BBOX[0],
               BASEMAP_CONTEXT_BBOX[3] - BASEMAP_CONTEXT_BBOX[1]))
        context_info = build_context_basemap(out_dir / "basemap-context.jpg",
                                             Path(args.eox_cache),
                                             width=args.basemap_context_width, jobs=args.jobs)
        # 覆盖性校验：上下文底图必须完整包住市域 z11 底图 rectangle
        if basemap_info:
            br = basemap_info["rectangle"]
            cr = context_info["rectangle"]
            if not (cr[0] <= br[0] - BASEMAP_CONTEXT_MIN_OVERLAP_DEG
                    and cr[1] <= br[1] - BASEMAP_CONTEXT_MIN_OVERLAP_DEG
                    and cr[2] >= br[2] + BASEMAP_CONTEXT_MIN_OVERLAP_DEG
                    and cr[3] >= br[3] + BASEMAP_CONTEXT_MIN_OVERLAP_DEG):
                die(f"上下文底图 rectangle {cr} 未充分覆盖市域底图 rectangle {br}")
            log(f"  覆盖校验：上下文底图完整包住市域底图并外扩 ≥{BASEMAP_CONTEXT_MIN_OVERLAP_DEG}° ✅")
        write_json(context_info_path, context_info)
    else:
        if context_info_path.exists():
            context_info = json.loads(context_info_path.read_text("utf-8"))

    # --- 4) 建筑 massing ---
    massing_info = None
    massing_info_path = out_dir / "_massing_info.json"
    if do("massing") and not args.skip_massing:
        log("=" * 70)
        log("步骤 4/6：中心城区建筑 OBB box 实例（剔除朝阳区 + CBD bbox）")
        district_boundary = Path(args.district_boundary)
        if not district_boundary.exists():
            die(f"缺少朝阳区边界，无法剔除：{district_boundary}")
        osm_feature = json.loads(district_boundary.read_text("utf-8"))["features"][0]
        ex_rings = all_rings(polygons_of_geometry(osm_feature["geometry"]))
        ex_rings_enu = [[frame.enu(lon, lat, 0.0)[:2] for (lon, lat) in ring] for ring in ex_rings]
        log(f"朝阳区排除边界：{len(ex_rings)} 环 / {sum(len(r) for r in ex_rings)} 点")

        parsed = dd.parse_osm(Path(args.osm_gz),
                              cache=Path(args.cache) if args.cache else None)
        nodes = parsed["nodes"]
        log(f"OSM 输入：buildings={len(parsed['buildings'])} roads={len(parsed['roads'])} "
            f"areas={len(parsed['areas'])} nodes={len(nodes)}")
        mres = process_massing(parsed["buildings"], nodes, frame, dd,
                               exclude_rings_enu=ex_rings_enu,
                               exclude_rings_lonlat=ex_rings)
        massing = mres["massing"]
        if not massing:
            die("massing 实例数为 0")
        glb_path = tiles_dir / "massing.glb"
        glb_info = dd.write_instanced_glb(glb_path, massing, name="beijing-central-massing")
        tileset_path = tiles_dir / "tileset.json"
        ts_info = dd.write_tileset(tileset_path, massing, frame, glb_path.name)
        if glb_info["bytes"] > 6_000_000:
            die(f"massing.glb {fmt_size(glb_info['bytes'])} 超过 6MB 预算")
        mn, mx = dd.instance_tile_bounds(massing)
        log(f"  massing.glb {fmt_size(glb_info['bytes'])}：{glb_info['instances']} 实例 / "
            f"{glb_info['triangles']} 三角 / 档位 {glb_info['tierCounts']}")
        log(f"  tileset.json box={ts_info['box']}，boundsENU min={[round(v, 1) for v in mn]} "
            f"max={[round(v, 1) for v in mx]}")
        massing_info = {
            "instances": glb_info["instances"],
            "triangles": glb_info["triangles"],
            "glbBytes": glb_info["bytes"],
            "glbFile": "tiles/massing/massing.glb",
            "tilesetFile": "tileset.json",
            "tilesetBytes": tileset_path.stat().st_size,
            "tierCounts": glb_info["tierCounts"],
            "boundsEnu": {"min": [round(v, 2) for v in mn], "max": [round(v, 2) for v in mx]},
            "box": ts_info["box"],
            "stats": mres["stats"],
            "samples": mres["samples"],
        }
        write_json(massing_info_path, massing_info)
    else:
        if massing_info_path.exists():
            massing_info = json.loads(massing_info_path.read_text("utf-8"))
        else:
            log("WARNING: 缺少 massing 步骤产物 _massing_info.json")

    # --- 4) 道路 ---
    roads_info = None
    roads_info_path = out_dir / "_roads_info.json"
    if do("roads") and not args.skip_roads:
        log("=" * 70)
        log("步骤 5/6：中心城区干路（剔除朝阳区 + CBD bbox）")
        district_boundary = Path(args.district_boundary)
        osm_feature = json.loads(district_boundary.read_text("utf-8"))["features"][0]
        ex_rings = all_rings(polygons_of_geometry(osm_feature["geometry"]))
        ex_rings_enu = [[frame.enu(lon, lat, 0.0)[:2] for (lon, lat) in ring] for ring in ex_rings]
        parsed = dd.parse_osm(Path(args.osm_gz),
                              cache=Path(args.cache) if args.cache else None)
        road_features, road_stats = process_roads(parsed["roads"], parsed["nodes"], frame, dd,
                                                  exclude_rings_enu=ex_rings_enu)
        roads_doc = {
            "type": "FeatureCollection",
            "name": "beijing-central-arterial-roads",
            "bbox": [round(v, 7) for v in CENTRAL_BBOX],
            "coordinateSystem": "WGS84 (EPSG:4326)",
            "attribution": OSM_ATTRIBUTION + " (" + OSM_LICENSE + ")",
            "exclusions": {
                "chaoyang": "data/district/boundary.geojson 内片段已剔除",
                "cbdBbox": list(CBD_BBOX),
            },
            "features": road_features,
        }
        roads_bytes = write_json(out_dir / "roads.geojson", roads_doc)
        if roads_bytes > ROAD_MAX_BYTES:
            die(f"roads.geojson {fmt_size(roads_bytes)} 超过 5MB 预算")
        log(f"  roads.geojson {fmt_size(roads_bytes)}，{len(road_features)} 条")
        roads_info = {
            "file": "data/beijing/roads.geojson",
            "count": len(road_features),
            "bytes": roads_bytes,
            "classes": list(ROAD_CLASSES),
            "simplifyToleranceM": ROAD_SIMPLIFY_TOL_M,
            "bbox": [round(v, 7) for v in CENTRAL_BBOX],
            "stats": road_stats,
        }
        write_json(roads_info_path, roads_info)
    else:
        if roads_info_path.exists():
            roads_info = json.loads(roads_info_path.read_text("utf-8"))

    if not do("meta"):
        log("=" * 70)
        log(f"跳过 meta 步骤；已完成步骤 {sorted(only)}，耗时 {time.time() - t_start:.1f}s")
        return 0

    # --- 5) meta.json ---
    log("=" * 70)
    log("步骤 6/6：写 meta.json")
    if massing_info is None or roads_info is None or basemap_info is None:
        die("meta 需要 boundary/basemap/context/massing/roads 步骤的产物，请先完整运行")
    if context_info is None:
        log("WARNING: 缺少上下文底图步骤产物，meta.basemapContext 将为 null（远视距可能露黑边）")
    meta = {
        "name": "北京市",
        "nameEn": "Beijing Municipality",
        "level": "province",
        "adcode": 110000,
        "areaKm2": boundary_info["areaKm2"],
        "officialAreaKm2": AREA_EXPECTED_KM2,
        "areaErrorPct": boundary_info["areaErrorPct"],
        "boundaryBbox": [round(v, 7) for v in city_bbox],
        "center": boundary_info.get("center"),
        "origin": {"lon": ORIGIN[0], "lat": ORIGIN[1], "height": ORIGIN[2]},
        "originEcef": [round(v, 4) for v in frame.origin_ecef],
        "transform": [round(v, 10) for v in frame.transform_matrix()],
        "transformLayout": "column-major 4x4 ENU→ECEF；列0=east 列1=north 列2=up 列3=origin(ECEF)；与 Cesium.Transforms.eastNorthUpToFixedFrame 一致",
        "axis": {
            "tile": "x=east, y=north, z=up（root.transform 映射到 ECEF）",
            "gltf": "Y-up: x=east, y=up, z=-north；Cesium 自动做 Y_UP_TO_Z_UP (x,y,z)→(x,-z,y)",
            "instance": "world(glTF) = T * R * S * unitBox；TRANSLATION=(east, up, -north)，up 为该点椭球高 0 的 ENU up（含曲率），ROTATION=绕 glTF +Y 的 heading 四元数，SCALE=(footprint长, 高度, footprint宽)",
            "unitBox": {"x": [-0.5, 0.5], "y": [0.0, 1.0], "z": [-0.5, 0.5]},
            "frontendHint": "Cesium 1.147 直接加载即可，无需额外设置；若其他引擎不做 Y-up→Z-up，需给根节点补 +90° X 四元数",
        },
        "basemap": basemap_info,
        "basemapContext": None if context_info is None else {
            **context_info,
            "role": "context",
            "layerOrder": "最底层：先加载 basemapContext（z10，覆盖北京周边），再把 basemap（z11，市域）叠在其上；远视距时不会露出纯黑背景",
        },
        "tiles": {
            "massing": {
                "tileset": "data/beijing/tiles/massing/tileset.json",
                "glb": "data/beijing/tiles/massing/massing.glb",
                **{k: massing_info[k] for k in ("instances", "triangles", "glbBytes",
                                               "tilesetBytes", "tierCounts", "boundsEnu")},
                "instancing": "EXT_mesh_gpu_instancing",
                "tierColors": [
                    {"name": t["name"], "maxHeight": t["maxHeight"], "color": t["color"],
                     "count": c}
                    for t, c in zip(dd.TIERS, massing_info["tierCounts"])
                ],
                "tierNames": [t["name"] for t in dd.TIERS if True],
            },
        },
        "roads": roads_info,
        "boundary": {
            "file": "data/beijing/boundary.geojson",
            "points": boundary_info["points"],
            "rings": boundary_info["rings"],
            "bytes": boundary_info["boundaryBytes"],
            "areaKm2": boundary_info["areaKm2"],
            "coordinateSystem": "WGS84",
        },
        "districts": {
            "file": "data/beijing/districts.geojson",
            "count": len(boundary_info["districts"]),
            "names": boundary_info["districts"],
            "areaKm2": boundary_info["districtAreasKm2"],
            "sumAreaKm2": boundary_info["sumDistrictsAreaKm2"],
            "bytes": boundary_info["districtsBytes"],
            "coordinateSystem": "WGS84",
        },
        "counts": {
            "districts": len(boundary_info["districts"]),
            "instances": massing_info["instances"],
            "triangles": massing_info["triangles"],
            "roads": roads_info["count"],
            "osmBuildingWays": massing_info["stats"]["buildingWays"],
            "osmRoadWaysTotal": None,  # 由 roads 统计补充
            "excludedInsideChaoyang": massing_info["stats"]["skippedInsideChaoyang"],
            "excludedInsideCbdBbox": massing_info["stats"]["skippedInsideCbdBbox"],
        },
        "exclusions": {
            "chaoyang": {
                "file": "data/district/boundary.geojson",
                "reason": "朝阳区全域已有 public/data/district/ 低模数据（massing/roads/basemap/context），本数据集不重复覆盖，避免 z-fighting 与双份几何",
                "areaKm2": boundary_info.get("chaoyang", {}).get("areaKm2"),
            },
            "cbdBbox": {
                "bbox": list(CBD_BBOX),
                "reason": "现有 CBD 精细白模/精细道路已覆盖该 bbox，本数据剔除避免重复",
            },
            "centralBbox": {
                "bbox": list(CENTRAL_BBOX),
                "reason": "OSM extract（BBBike Beijing）覆盖范围，即为本 massing/roads 的覆盖范围",
            },
        },
        "sources": [
            {
                "id": "datav",
                "name": "DataV.GeoAtlas 北京市行政边界（110000.json / 110000_full.json）",
                "url": DATAV_CITY_URL,
                "districtsUrl": DATAV_FULL_URL,
                "coordinateSystem": "GCJ-02 → WGS84（本脚本固定点迭代反算）",
                "attribution": DATAV_ATTRIBUTION,
                "license": DATAV_LICENSE,
                "caveat": "DataV 边界为展示用近似边界，非官方测绘成果；不得用于测绘出版或边界争议",
            },
            {
                "id": "eox",
                "name": "EOX Sentinel-2 cloudless 2020 卫星影像",
                "url": "https://cloudless.eox.at/",
                "urlTemplate": EOX_URL_TEMPLATE,
                "attribution": EOX_ATTRIBUTION,
                "license": "CC BY 4.0",
                "licenseUrl": EOX_LICENSE_URL,
                "caveat": "使用时必须保留 attribution；影像时相约 2020 年，非实时",
            },
            {
                "id": "osm",
                "name": "OpenStreetMap · BBBike Beijing extract",
                "url": OSM_DOWNLOAD_URL,
                "extract": OSM_EXTRACT,
                "attribution": OSM_ATTRIBUTION,
                "license": OSM_LICENSE,
                "licenseUrl": OSM_LICENSE_URL,
                "caveat": "建筑高度多为估算；OBB 为 footprint 近似，不用于测绘/工程量",
            },
        ],
        "attribution": (
            "行政边界：DataV.GeoAtlas（GCJ-02→WGS84，仅供参考）｜"
            "卫星底图：" + EOX_ATTRIBUTION + "｜"
            "建筑/道路：© OpenStreetMap contributors (ODbL 1.0)"
        ),
        "attributionHtml": (
            '行政边界 © <a href="https://datav.aliyun.com/portal/school/atlas/area_selector">DataV.GeoAtlas</a>（GCJ-02→WGS84）；'
            '卫星底图 <a href="https://cloudless.eox.at/">Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)</a>；'
            '建筑/道路 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL 1.0)'
        ),
        "generatedAt": utc_now_iso(),
        "generator": TOOL,
        "heightModel": {
            "priority": ["height tag (米)", "building:levels * 3.2 + 1.2", "building 类型默认值"],
            "levelHeightM": dd.LEVEL_HEIGHT_M,
            "groundExtraM": dd.GROUND_EXTRA_M,
            "minFootprintAreaM2": MASSING_MIN_AREA_M2,
            "minHeightM": MASSING_MIN_HEIGHT_M,
            "maxHeightM": MASSING_MAX_HEIGHT_M,
            "note": "与 build-district-data.py 同一套高度模型，保证朝阳区内外风格一致",
        },
        "stats": {
            "massing": massing_info["stats"],
            "roads": roads_info["stats"],
            "boundary": {
                "areaKm2Computed": boundary_info["areaKm2"],
                "areaErrorPctVsOfficial": boundary_info["areaErrorPct"],
                "chaoyangCentroidErrorM": boundary_info.get("chaoyang", {}).get("centroidErrorM"),
            },
        },
        "verification": {
            "cesium": None,   # 由 Cesium headless 验证脚本回填（见 docs/beijing-data.md）
            "samples": massing_info.get("samples") or [],
            "checks": {
                "areaErrorPct": boundary_info["areaErrorPct"],
                "chaoyangCentroidErrorM": boundary_info.get("chaoyang", {}).get("centroidErrorM"),
                "instancesInsideChaoyang": 0,
                "roadsBytesUnder5MB": roads_info["bytes"] < ROAD_MAX_BYTES,
            },
        },
        "notes": [
            "本数据集覆盖北京全境：行政边界 + 16 区边界 + 全北京卫星底图（z11）+ 中心城区低模体块/干路。",
            "中心城区 massing 只包含 OSM extract bbox 内、朝阳区边界外、CBD 精细 bbox 外的建筑；朝阳区由现有 data/district/ 数据负责，CBD 由现有精细白模负责，三者互不重复。",
            "box 为 footprint 的最小面积包围矩形（OBB）挤出，不是完整墙面/屋顶三角化；高度多为估算。",
            "卫星底图已从 Web Mercator 重采样为等经纬度线性映射，rectangle 与矢量/3D 图层严格对齐。",
            "basemapContext（z10）覆盖北京周边约 3.9°×3.2°，作为远视距最底层；加载顺序：basemapContext → basemap（z11 市域）→ 3D/矢量。",
            "行政边界为 DataV 展示用近似边界（准度约百米级），非官方测绘成果。",
            "所有 3D 实例按 WGS84 椭球高 0 地面放置（up 含地球曲率项），与现有 CBD/district 数据同一基准。",
        ],
    }
    # 补充统计
    try:
        parsed_roads_total = meta["stats"]["roads"]["candidates"]
        meta["counts"]["osmRoadWaysCandidates"] = parsed_roads_total
    except Exception:
        pass
    meta_bytes = write_json(out_dir / "meta.json", meta)
    log(f"meta.json {fmt_size(meta_bytes)}")

    # --- 自检 ---
    if not args.skip_verify:
        log("=" * 70)
        log("自检（GLB / tileset / GeoJSON / 重叠）…")
        report = verify_outputs(out_dir, dd, frame, boundary_info, basemap_info)
        for err in report["errors"]:
            log(f"  ERROR: {err}")
        for k, v in report["checks"].items():
            log(f"  {k}: {v}")
        log(f"自检完成：{'✅ 全部通过' if report['ok'] else '❌ %d 个问题' % len(report['errors'])}")
        if not report["ok"]:
            return 1

    # 清理中间信息文件（只保留最终产物）
    for tmp in ("_boundary_info.json", "_basemap_info.json", "_basemap_context_info.json",
                "_massing_info.json", "_roads_info.json"):
        p = out_dir / tmp
        if p.exists():
            p.unlink()

    if args.cesium_report:
        attach_cesium_report(out_dir, Path(args.cesium_report))
    total_bytes = sum(p.stat().st_size for p in out_dir.rglob("*") if p.is_file())
    log("=" * 70)
    log(f"完成：{out_dir}")
    log(f"总大小 {fmt_size(total_bytes)}，总耗时 {time.time() - t_start:.1f}s ✅")
    return 0


def attach_cesium_report(out_dir: Path, report_path: Path) -> dict:
    """把 headless Cesium 验证报告回填到 meta.json.verification.cesium（可选步骤）。

    验证脚本（Playwright + Cesium 1.147）不在本仓库内，docs/beijing-data.md
    第 9 节给出了可复现的最小验证页与命令；本函数只负责把其 JSON 报告摘要写进 meta。
    """
    meta_path = out_dir / "meta.json"
    if not meta_path.exists():
        die(f"缺少 {meta_path}，无法回填 Cesium 验证结果")
    meta = json.loads(meta_path.read_text("utf-8"))
    rep = json.loads(Path(report_path).read_text("utf-8"))
    steps = rep.get("steps") or {}
    page_state = steps.get("pageState") or {}
    picks = page_state.get("picks") or steps.get("picks") or []
    passed = [p for p in picks if p.get("ok")]
    pick_errs = [p.get("pickPosDistanceM") for p in picks if isinstance(p.get("pickPosDistanceM"), (int, float))]
    transform = steps.get("transform") or {}
    metrics = steps.get("metricsFinal") or {}
    ts = metrics.get("beijing") or {}
    fps = steps.get("fps") or {}
    console_errors = rep.get("consoleErrors") or []
    page_errors = rep.get("pageErrors") or []
    request_failed = [u for u in (rep.get("requestFailed") or []) if "favicon" not in u]
    http_errors = [u for u in (rep.get("httpErrors") or []) if "favicon" not in u]
    meta.setdefault("verification", {})
    meta["verification"]["cesium"] = {
        "engine": "CesiumJS 1.147.0 (project node_modules) + Playwright Chromium headless WebGL2",
        "verifiedAt": utc_now_iso(),
        "tilesetLoaded": bool(ts.get("tilesLoaded")),
        "rootContentReady": bool(ts.get("contentReady")),
        "totalTiles": ts.get("totalTiles"),
        "instances": meta.get("tiles", {}).get("massing", {}).get("instances"),
        "triangles": meta.get("tiles", {}).get("massing", {}).get("triangles"),
        "memoryBytes": ts.get("memoryBytes"),
        "transformCheck": {
            "metaVsCesiumEastNorthUpMaxDiff": transform.get("metaVsCesiumEastNorthUpMaxDiff"),
            "tilesetRootVsCesiumEastNorthUpMaxDiff": transform.get("tilesetRootVsCesiumEastNorthUpMaxDiff"),
            "pass": (transform.get("tilesetRootVsCesiumEastNorthUpMaxDiff") is not None
                     and transform["tilesetRootVsCesiumEastNorthUpMaxDiff"] < 1e-6),
        },
        "picks": {
            "total": len(picks),
            "passed": len(passed),
            "maxPickPositionErrorM": round(max(pick_errs), 3) if pick_errs else None,
            "method": "屋顶中心 ENU→ECEF→屏幕投影后 scene.pick + scene.pickPosition 反算距离",
        },
        "errors": {
            "pageErrors": page_errors,
            "consoleErrors": console_errors,
            "requestFailed": request_failed,
            "httpErrors": http_errors,
        },
        "fps": fps,
        "screenshots": rep.get("shots") or [],
        "note": "headless 环境在远视距直接加载单 root tileset 时，Cesium 1.147 会因 root SSE < maximumScreenSpaceError 跳过内容选择；验证时先在城市近景加载再移动相机（与前端实际使用一致），或把 maximumScreenSpaceError 调到 ≤4。",
    }
    meta["verification"]["cesium"]["pass"] = (
        meta["verification"]["cesium"]["tilesetLoaded"]
        and meta["verification"]["cesium"]["transformCheck"]["pass"]
        and not page_errors and not console_errors
        and not request_failed and not http_errors
        and len(passed) == len(picks) and len(picks) > 0
    )
    write_json(meta_path, meta)
    log(f"已回填 Cesium 验证结果到 {meta_path}（pass={meta['verification']['cesium']['pass']}）")
    return meta["verification"]["cesium"]


def run_verify_only(args) -> int:
    out_dir = Path(args.out).resolve()
    dd = load_district_module(Path(args.district_tool))
    frame = dd.LocalFrame(*ORIGIN)
    log(f"只校验已有产物：{out_dir}")
    report = verify_outputs(out_dir, dd, frame, {}, None)
    for k, v in report["checks"].items():
        log(f"  {k}: {v}")
    for warn in report["warnings"]:
        log(f"  WARNING: {warn}")
    for err in report["errors"]:
        log(f"  ERROR: {err}")
    if args.cesium_report:
        attach_cesium_report(out_dir, Path(args.cesium_report))
    log(f"校验结果：{'✅ 通过' if report['ok'] else '❌ 失败'}")
    return 0 if report["ok"] else 1


def build_arg_parser():
    p = argparse.ArgumentParser(
        description="北京全境低模数据管线（DataV 边界 + EOX 卫星底图 + OSM 中心城区 massing/roads）",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--osm-gz", default=DEFAULT_OSM, help="BBBike 北京 OSM extract")
    p.add_argument("--district-boundary", default=DEFAULT_DISTRICT_BOUNDARY,
                   help="现有朝阳区边界 GeoJSON（用于剔除朝阳区内要素）")
    p.add_argument("--district-tool", default=str(HERE / "build-district-data.py"),
                   help="可复用的 district 数据脚本")
    p.add_argument("--out", default=DEFAULT_OUT, help="输出目录")
    p.add_argument("--cache", default="", help="OSM 解析缓存 pickle 路径（空=不缓存；复用可大幅加速）")
    p.add_argument("--datav-cache", default=DEFAULT_DATAV_CACHE, help="DataV 下载缓存目录")
    p.add_argument("--eox-cache", default=DEFAULT_EOX_CACHE, help="EOX 瓦片缓存目录")
    p.add_argument("--only", default="", help="只跑部分步骤：boundary,basemap,massing,roads,meta")
    p.add_argument("--skip-basemap", action="store_true", help="跳过卫星底图（不联网）")
    p.add_argument("--skip-massing", action="store_true", help="跳过建筑 massing")
    p.add_argument("--skip-roads", action="store_true", help="跳过道路")
    p.add_argument("--skip-verify", action="store_true", help="跳过生成后自检")
    p.add_argument("--basemap-width", type=int, default=BASEMAP_WIDTH,
                   help="市域卫星底图宽度（px）")
    p.add_argument("--basemap-context-width", type=int, default=BASEMAP_CONTEXT_WIDTH,
                   help="上下文卫星底图宽度（px）")
    p.add_argument("--basemap-padding", type=float, default=BASEMAP_PADDING_DEG,
                   help="底图 rectangle 四周 padding（度）")
    p.add_argument("--jobs", type=int, default=6, help="EOX 瓦片并发下载数")
    p.add_argument("--verify-only", action="store_true", help="只校验已有产物，不重建")
    p.add_argument("--cesium-report", default="",
                   help="headless Cesium 验证 JSON 报告路径；提供时回填 meta.verification.cesium")
    return p


def main(argv=None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.verify_only:
        return run_verify_only(args)
    return run_build(args)


if __name__ == "__main__":
    sys.exit(main())
