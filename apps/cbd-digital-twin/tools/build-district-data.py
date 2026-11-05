#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-district-data.py — 朝阳区全域低模数据管线
================================================

把「国贸 CBD Demo」扩展成「整个朝阳区」范围所需的数据，全部静态托管：

    public/data/district/
    ├── boundary.geojson                       # 朝阳区行政边界（MultiPolygon, 1203 点）
    ├── basemap.jpg                            # 3072px 暗色底图（经纬度线性映射）
    ├── roads.geojson                          # 全域干路（RDP 2.5m，剔除 CBD 精细 bbox）
    ├── context.geojson                        # 大公园 / 水系（可选图层）
    ├── meta.json                              # 前端唯一入口（Lead 指定 schema）
    └── tiles/district-massing/
        ├── tileset.json                       # 3D Tiles 1.1，root.transform = ENU→ECEF
        └── district-massing.glb               # EXT_mesh_gpu_instancing 低模 box（~2 万实例）

坐标系与轴向（与现有 CBD 数据完全一致）：
- 所有矢量/底图：WGS84 经纬度，经纬度线性映射；
- 3D Tiles：ENU 原点 ORIGIN=(116.4610, 39.9080, 0)，root.transform 为 ENU→ECEF（列主序）；
- glTF content 为 Y-up：单位 box 顶点 (x=east, y=up, z=-north)，Cesium 自动 Y_UP_TO_Z_UP；
- 实例语义：world(glTF) = TRANSLATION * ROTATION * SCALE * vertex(unit box)，
  TRANSLATION=(east, u_ground, -north)，ROTATION=绕 +Y（glTF 的 up）的航向四元数，
  SCALE=(footprint 长, 高度, footprint 宽)。u_ground 取该点 WGS84 椭球高 0 处的 ENU up
  分量（含地球曲率项，约 -d²/2R，20km 处约 -31m），因此远处体块不会悬空。

数据源：OpenStreetMap（BBBike Beijing extract，ODbL 1.0）。
依赖：Python 3.10+ 标准库；numpy 与 Pillow 可选加速（缺少时自动降级/跳过底图）。

用法：
    python3 tools/build-district-data.py                       # 默认 /tmp 输入 + public/data/district 输出
    python3 tools/build-district-data.py --osm-gz /tmp/Beijing.osm.gz \\
        --boundary /tmp/chaoyang-boundary.geojson --out public/data/district
    python3 tools/build-district-data.py --verify-only         # 只校验已有产物
    python3 tools/build-district-data.py --skip-basemap        # 无 Pillow 环境
    python3 tools/build-district-data.py --cache /tmp/parse.pkl  # 开发期复用解析结果
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import pickle
import re
import struct
import sys
import time
import xml.etree.ElementTree as ET
from array import array
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:  # numpy 仅用于加速点在多边形/底图暗角，缺失时用纯 Python 降级
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    from PIL import Image, ImageDraw
    HAS_PIL = True
except Exception:  # pragma: no cover
    HAS_PIL = False

# --------------------------------------------------------------------------- #
# 0. 常量
# --------------------------------------------------------------------------- #

TOOL = "cbd-digital-twin/tools/build-district-data.py"
GENERATOR = "cbd-digital-twin build-district-data.py"

DEFAULT_OSM = "/tmp/Beijing.osm.gz"
DEFAULT_BOUNDARY = "/tmp/chaoyang-boundary.geojson"

#: ENU 原点（沿用现有 CBD 数据）
ORIGIN = (116.4610, 39.9080, 0.0)
#: 现有 CBD 精细数据范围（新数据需剔除，避免与精细白模重叠）
CBD_BBOX = (116.430, 39.885, 116.495, 39.930)

WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)

#: 道路等级
ROAD_ARTERIAL = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
)
ROAD_MINOR = ("residential", "unclassified", "living_street")
ROAD_ALL = ROAD_ARTERIAL + ROAD_MINOR

#: 面状要素 tag
AREA_TAGS = ("landuse", "leisure", "natural")

#: 高度模型（与 build-city-data.py 完全一致，保证 CBD 内外一致）
LEVEL_HEIGHT_M = 3.2
GROUND_EXTRA_M = 1.2
DEFAULT_HEIGHTS = {
    "office": [24.0, 40.0], "commercial": [24.0, 40.0], "retail": 14.0,
    "apartments": [18.0, 22.0], "residential": [18.0, 22.0], "dormitory": [16.0, 24.0],
    "hotel": [28.0, 40.0], "yes": [10.8, 13.2], "house": 8.0, "bungalow": 6.0,
    "detached": 9.0, "terrace": 10.0, "shed": 4.0, "hut": 3.0, "kiosk": 3.0,
    "garage": 8.0, "garages": 8.0, "parking": 8.0, "roof": 4.0,
    "school": 12.0, "university": 16.0, "college": 16.0, "kindergarten": 8.0,
    "hospital": 25.0, "clinic": 12.0, "government": 18.0, "public": 16.0,
    "civic": 16.0, "museum": 18.0, "library": 16.0, "church": 15.0,
    "temple": 12.0, "mosque": 14.0, "industrial": 10.0, "warehouse": 9.0,
    "factory": 11.0, "service": 5.0, "train_station": 15.0,
    "transportation": 12.0, "construction": 8.0,
}

#: 建筑筛选
MASSING_MIN_AREA_M2 = 20.0     # footprint 面积下限
MASSING_MIN_HEIGHT_M = 2.0     # 高度下限
ROOF_MAX_HEIGHT_M = 2.0        # building=roof 且无有效 height 时丢弃
MASSING_MAX_HEIGHT_M = 700.0

#: 实例 box 的颜色分级（近白偏冷灰，按高度三档）
TIERS = (
    {"name": "massing-low", "maxHeight": 24.0, "color": [0.800, 0.830, 0.880, 1.0]},
    {"name": "massing-mid", "maxHeight": 80.0, "color": [0.870, 0.900, 0.940, 1.0]},
    {"name": "massing-high", "maxHeight": 1e9, "color": [0.920, 0.940, 0.970, 1.0]},
)
MATERIAL_COMMON = {"metallicFactor": 0.04, "roughnessFactor": 0.78}
MATERIAL_EMISSIVE = [0.018, 0.024, 0.038]

#: 道路交通/底图
ROAD_SIMPLIFY_TOL_M = 2.5
CONTEXT_PARK_MIN_AREA_M2 = 50_000.0
CONTEXT_WATER_MIN_AREA_M2 = 1_000.0
CONTEXT_SIMPLIFY_TOL_M = 5.0

#: basemap
BASEMAP_WIDTH = 3072
BASEMAP_PADDING_DEG = 0.008      # 边界 bbox 四周留白（约 0.7km）
BASEMAP_JPEG_QUALITY = 82
BASEMAP_MAX_BYTES = 3_000_000
BASEMAP_SUPERSAMPLE = 2

BASEMAP_COLORS = {
    "bg": (5, 8, 14),
    "district": (7, 13, 22),
    "block": (11, 20, 32),
    "block2": (13, 26, 43),
    "park": (13, 36, 24),
    "park2": (10, 27, 18),
    "water": (10, 39, 64),
    "building": (27, 38, 50),
    "building_hi": (39, 54, 69),
    "boundary": (44, 120, 148),
    "road": {
        "motorway": (59, 101, 124), "trunk": (59, 101, 124), "primary": (59, 101, 124),
        "motorway_link": (59, 101, 124), "trunk_link": (59, 101, 124), "primary_link": (59, 101, 124),
        "secondary": (39, 70, 90), "tertiary": (39, 70, 90),
        "secondary_link": (39, 70, 90), "tertiary_link": (39, 70, 90),
        "residential": (26, 41, 56), "unclassified": (26, 41, 56), "living_street": (26, 41, 56),
    },
}
BASEMAP_ROAD_WIDTH = {
    "motorway": 7, "trunk": 6, "primary": 5, "motorway_link": 5, "trunk_link": 5, "primary_link": 5,
    "secondary": 4, "tertiary": 3, "secondary_link": 3, "tertiary_link": 3,
    "residential": 2, "unclassified": 2, "living_street": 2,
}


# --------------------------------------------------------------------------- #
# 1. 通用小工具
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[build-district] {msg}", flush=True)


def die(msg: str):
    print(f"[build-district] ERROR: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / 1024 / 1024:.2f} MB"


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    path.write_bytes(data)
    return len(data)


def utc_now_iso() -> str:
    return datetime.now(timezone(timedelta(hours=8))).replace(microsecond=0).isoformat()


def hash_unit(*parts) -> float:
    h = __import__("hashlib").md5("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:8], "big") / float(1 << 64)


def pad4(n: int) -> int:
    return (-n) % 4


# --------------------------------------------------------------------------- #
# 2. WGS84 → ECEF → ENU
# --------------------------------------------------------------------------- #

def geodetic_to_ecef(lon: float, lat: float, h: float = 0.0):
    lon_r = math.radians(lon)
    lat_r = math.radians(lat)
    sin_lat, cos_lat = math.sin(lat_r), math.cos(lat_r)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    return (
        (n + h) * cos_lat * math.cos(lon_r),
        (n + h) * cos_lat * math.sin(lon_r),
        (n * (1.0 - WGS84_E2) + h) * sin_lat,
    )


class LocalFrame:
    """ENU 局部坐标框架（原点 ORIGIN），与 Cesium eastNorthUpToFixedFrame 一致。"""

    def __init__(self, lon: float, lat: float, height: float = 0.0):
        self.lon, self.lat, self.height = lon, lat, height
        lon_r, lat_r = math.radians(lon), math.radians(lat)
        sin_lon, cos_lon = math.sin(lon_r), math.cos(lon_r)
        sin_lat, cos_lat = math.sin(lat_r), math.cos(lat_r)
        self.east = (-sin_lon, cos_lon, 0.0)
        self.north = (-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat)
        self.up = (cos_lat * cos_lon, cos_lat * sin_lon, sin_lat)
        self.origin_ecef = geodetic_to_ecef(lon, lat, height)
        ox, oy, oz = self.origin_ecef
        (ex, ey, ez), (nx, ny, nz), (ux, uy, uz) = self.east, self.north, self.up
        self._ox, self._oy, self._oz = ox, oy, oz
        self._basis = ((ex, ey, ez), (nx, ny, nz), (ux, uy, uz))

    def enu(self, lon: float, lat: float, h: float = 0.0):
        """(lon,lat,h) → (east, north, up) 米；up 含地球曲率项。"""
        x, y, z = geodetic_to_ecef(lon, lat, h)
        dx, dy, dz = x - self._ox, y - self._oy, z - self._oz
        (ex, ey, ez), (nx, ny, nz), (ux, uy, uz) = self._basis
        return (
            dx * ex + dy * ey + dz * ez,
            dx * nx + dy * ny + dz * nz,
            dx * ux + dy * uy + dz * uz,
        )

    def transform_matrix(self) -> list:
        """ENU→ECEF 4x4，列主序 16 数。"""
        e, n, u, o = self.east, self.north, self.up, self.origin_ecef
        return [
            e[0], e[1], e[2], 0.0,
            n[0], n[1], n[2], 0.0,
            u[0], u[1], u[2], 0.0,
            o[0], o[1], o[2], 1.0,
        ]


# --------------------------------------------------------------------------- #
# 3. 多边形工具
# --------------------------------------------------------------------------- #

def ring_area_2d(pts) -> float:
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s * 0.5


def clean_ring_xy(pts):
    """去闭合重复点 / 连续重复点（保持坐标类型）。"""
    if not pts:
        return []
    out = [p for p in pts if p is not None]
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-12 and abs(out[0][1] - out[-1][1]) < 1e-12:
        out = out[:-1]
    dedup = []
    for p in out:
        if not dedup or abs(p[0] - dedup[-1][0]) > 1e-12 or abs(p[1] - dedup[-1][1]) > 1e-12:
            dedup.append(p)
    return dedup


def min_area_rect(pts):
    """最小面积包围矩形（边方向枚举）。

    :param pts: [(x, y), ...] 局部米制坐标
    :return: dict(area, cx, cy, w, d, angle) 或 None
             angle = u 轴相对 +x(east) 逆时针旋转角（弧度），w 沿 u，d 沿 v=(-sin,cos)
    """
    n = len(pts)
    if n < 3:
        return None
    best = None
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        if length < 1e-9:
            continue
        ux, uy = dx / length, dy / length
        vx, vy = -uy, ux
        min_u = max_u = pts[0][0] * ux + pts[0][1] * uy
        min_v = max_v = pts[0][0] * vx + pts[0][1] * vy
        for (px, py) in pts:
            pu = px * ux + py * uy
            pv = px * vx + py * vy
            if pu < min_u:
                min_u = pu
            elif pu > max_u:
                max_u = pu
            if pv < min_v:
                min_v = pv
            elif pv > max_v:
                max_v = pv
        area = (max_u - min_u) * (max_v - min_v)
        if best is None or area < best[0]:
            cu = (min_u + max_u) * 0.5
            cv = (min_v + max_v) * 0.5
            cx = cu * ux + cv * vx
            cy = cu * uy + cv * vy
            best = (area, cx, cy, max_u - min_u, max_v - min_v, math.atan2(uy, ux))
    if best is None:
        return None
    area, cx, cy, w, d, angle = best
    return {"area": area, "cx": cx, "cy": cy, "w": w, "d": d, "angle": angle}


def simplify_rdp_indices(pts, tol: float):
    n = len(pts)
    if n <= 2:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    tol2 = tol * tol
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = pts[i]
        bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        best_d, best_k = -1.0, -1
        if seg2 <= 1e-18:
            for k in range(i + 1, j):
                px, py = pts[k]
                d2 = (px - ax) ** 2 + (py - ay) ** 2
                if d2 > best_d:
                    best_d, best_k = d2, k
        else:
            for k in range(i + 1, j):
                px, py = pts[k]
                t = ((px - ax) * dx + (py - ay) * dy) / seg2
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                cx, cy = ax + t * dx, ay + t * dy
                d2 = (px - cx) ** 2 + (py - cy) ** 2
                if d2 > best_d:
                    best_d, best_k = d2, k
        if best_k > 0 and best_d > tol2:
            keep[best_k] = True
            stack.append((i, best_k))
            stack.append((best_k, j))
    return [i for i in range(n) if keep[i]]


def bbox_contains(bbox, lon: float, lat: float) -> bool:
    return bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]


def clip_polygon_to_bbox(ring, bbox):
    """Sutherland–Hodgman 多边形裁剪到 bbox（lon/lat）。"""
    w, s, e, n = bbox
    out = list(ring)
    if len(out) < 3:
        return []

    def clip(poly, inside, ix):
        if not poly:
            return []
        res = []
        prev = poly[-1]
        prev_in = inside(prev)
        for cur in poly:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    res.append(ix(prev, cur))
                res.append(cur)
            elif prev_in:
                res.append(ix(prev, cur))
            prev, prev_in = cur, cur_in
        return res

    for inside, ix in (
        (lambda p: p[0] >= w, lambda a, b: (w, a[1] + (w - a[0]) / (b[0] - a[0]) * (b[1] - a[1]))),
        (lambda p: p[0] <= e, lambda a, b: (e, a[1] + (e - a[0]) / (b[0] - a[0]) * (b[1] - a[1]))),
        (lambda p: p[1] >= s, lambda a, b: (a[0] + (s - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), s)),
        (lambda p: p[1] <= n, lambda a, b: (a[0] + (n - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), n)),
    ):
        out = clip(out, inside, ix)
        if not out:
            return []
    dedup = []
    for p in out:
        if not dedup or p != dedup[-1]:
            dedup.append(p)
    if len(dedup) > 1 and dedup[0] == dedup[-1]:
        dedup.pop()
    return dedup if len(dedup) >= 3 else []


def _seg_intersect_t(p0, p1, bbox):
    """返回线段与 bbox 的交区间 [t0,t1] 或 None（Liang–Barsky）。"""
    w, s, e, n = bbox
    x0, y0 = p0
    dx, dy = p1[0] - x0, p1[1] - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - w), (dx, e - x0), (-dy, y0 - s), (dy, n - y0)):
        if abs(p) < 1e-18:
            if q < 0:
                return None
            continue
        r = q / p
        if p < 0:
            if r > t1:
                return None
            t0 = max(t0, r)
        else:
            if r < t0:
                return None
            t1 = min(t1, r)
    return (t0, t1) if t0 <= t1 else None


def subtract_bbox_from_line(coords, bbox):
    """从折线中剔除 bbox 内部的片段，返回若干段（lon/lat）。"""
    out = []
    cur = []
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        inter = _seg_intersect_t(a, b, bbox)
        if inter is None:
            # 整段不在 bbox 内
            if not cur:
                cur = [a, b]
            else:
                cur.append(b)
            continue
        t0, t1 = inter
        # 段内部分 [t0,t1] 属于 bbox，需要保留 [0,t0] 与 [t1,1]
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        if t0 > 1e-9:
            p0 = a
            p1 = (a[0] + dx * t0, a[1] + dy * t0)
            if not cur:
                cur = [p0, p1]
            else:
                if abs(cur[-1][0] - p0[0]) < 1e-12 and abs(cur[-1][1] - p0[1]) < 1e-12:
                    cur.append(p1)
                else:
                    if len(cur) >= 2:
                        out.append(cur)
                    cur = [p0, p1]
            if len(cur) >= 2:
                out.append(cur)
            cur = []
        if t1 < 1 - 1e-9:
            p0 = (a[0] + dx * t1, a[1] + dy * t1)
            p1 = b
            cur = [p0, p1]
        else:
            cur = []
    if len(cur) >= 2:
        out.append(cur)
    return out


# --------------------------------------------------------------------------- #
# 4. 点在多边形（numpy 加速 / 纯 Python 降级）
# --------------------------------------------------------------------------- #

def _ring_bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def pip_inputs(rings_enu):
    """把边界环（ENU 坐标）整理为 [(ring, bbox), ...]。"""
    out = []
    for ring in rings_enu:
        out.append((ring, _ring_bbox(ring)))
    return out


def pip_mask_np(points, prepared):
    """points: numpy (N,2) 或 list[(x,y)]；返回 numpy bool (N,)。

    多环语义：在任意环内即 inside（朝阳区含机场飞地，两环皆为外环）。
    """
    if np is None:
        return pip_mask_py(points, prepared)
    pts = np.asarray(points, dtype=float) if not isinstance(points, np.ndarray) else points
    inside = np.zeros(pts.shape[0], dtype=bool)
    if pts.shape[0] == 0:
        return inside
    for ring, (rx0, ry0, rx1, ry1) in prepared:
        m = (pts[:, 0] >= rx0 - 1) & (pts[:, 0] <= rx1 + 1) & (pts[:, 1] >= ry0 - 1) & (pts[:, 1] <= ry1 + 1)
        idx = np.nonzero(m)[0]
        if idx.size == 0:
            continue
        px = pts[idx, 0]
        py = pts[idx, 1]
        ring_np = ring if isinstance(ring, np.ndarray) else np.asarray(ring, dtype=float)
        rx = ring_np[:, 0]
        ry = ring_np[:, 1]
        n = ring_np.shape[0]
        hit = np.zeros(idx.size, dtype=bool)
        for i in range(n):
            x1, y1 = rx[i], ry[i]
            x2, y2 = rx[(i + 1) % n], ry[(i + 1) % n]
            cond = (y1 > py) != (y2 > py)
            if not cond.any():
                continue
            xint = x1 + (py - y1) * (x2 - x1) / (y2 - y1 + 1e-18)
            hit ^= cond & (px < xint)
        inside[idx] |= hit
    return inside


def pip_mask_py(points, prepared):
    inside = []
    for (x, y) in points:
        hit = False
        for ring, (rx0, ry0, rx1, ry1) in prepared:
            if x < rx0 - 1 or x > rx1 + 1 or y < ry0 - 1 or y > ry1 + 1:
                continue
            c = False
            n = len(ring)
            for i in range(n):
                x1, y1 = ring[i]
                x2, y2 = ring[(i + 1) % n]
                if (y1 > y) != (y2 > y):
                    xint = x1 + (y - y1) * (x2 - x1) / (y2 - y1 + 1e-18)
                    if x < xint:
                        c = not c
            if c:
                hit = True
                break
        inside.append(hit)
    return inside


# --------------------------------------------------------------------------- #
# 5. OSM 解析（两遍：先收集 way，再取引用节点）
# --------------------------------------------------------------------------- #

def parse_osm(osm_path: Path, *, cache: Path | None = None, progress: int = 2_000_000) -> dict:
    """返回 {'buildings': [...], 'areas': [...], 'roads': [...], 'nodes': {...}}。

    buildings/areas/roads: [(way_id, [node_ref, ...], tags_dict), ...]
    nodes: {node_id: (lon, lat)}
    """
    if cache and cache.exists():
        log(f"复用解析缓存 {cache} ({fmt_size(cache.stat().st_size)})")
        return pickle.loads(cache.read_bytes())

    t0 = time.time()
    buildings, areas, roads = [], [], []
    scanned = 0
    log(f"解析 {osm_path}（第一遍：收集 way）…")
    with gzip.open(osm_path, "rb") as fh:
        for _ev, elem in ET.iterparse(fh, events=("end",)):
            if elem.tag == "way":
                tags = {t.get("k"): t.get("v") for t in elem.findall("tag")}
                if tags:
                    if "building" in tags:
                        buildings.append((elem.get("id"), [nd.get("ref") for nd in elem.findall("nd")], tags))
                    elif any(k in tags for k in AREA_TAGS):
                        areas.append((elem.get("id"), [nd.get("ref") for nd in elem.findall("nd")], tags))
                    elif tags.get("highway") in ROAD_ALL and tags.get("area") != "yes":
                        roads.append((elem.get("id"), [nd.get("ref") for nd in elem.findall("nd")], tags))
                elem.clear()
            elif elem.tag in ("node", "relation"):
                elem.clear()
            scanned += 1
            if progress and scanned % progress == 0:
                log(f"  …{scanned / 1e6:.0f}M 元素 / {time.time() - t0:.0f}s")
    log(f"第一遍完成：buildings={len(buildings)} areas={len(areas)} roads={len(roads)} 耗时 {time.time() - t0:.1f}s")

    refs = set()
    for group in (buildings, areas, roads):
        for _wid, node_refs, _tags in group:
            refs.update(node_refs)
    log(f"引用节点 {len(refs)} 个，第二遍取坐标 …")

    nodes = {}
    t1 = time.time()
    with gzip.open(osm_path, "rb") as fh:
        for _ev, elem in ET.iterparse(fh, events=("end",)):
            if elem.tag == "node":
                nid = elem.get("id")
                if nid in refs:
                    try:
                        nodes[nid] = (float(elem.get("lon")), float(elem.get("lat")))
                    except (TypeError, ValueError):
                        pass
                elem.clear()
            elif elem.tag in ("way", "relation"):
                elem.clear()
    log(f"第二遍完成：nodes={len(nodes)} 耗时 {time.time() - t1:.1f}s")

    parsed = {"buildings": buildings, "areas": areas, "roads": roads, "nodes": nodes}
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(pickle.dumps(parsed, protocol=4))
        log(f"解析缓存已写入 {cache} ({fmt_size(cache.stat().st_size)})")
    log(f"解析总耗时 {time.time() - t0:.1f}s")
    return parsed


# --------------------------------------------------------------------------- #
# 6. 高度模型 / 面要素分类
# --------------------------------------------------------------------------- #

_HEIGHT_RE = re.compile(r"^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metre|meters|metres|米)?\s*$", re.I)


def parse_length_m(value):
    if value is None:
        return None
    m = _HEIGHT_RE.match(str(value).strip())
    if not m:
        return None
    try:
        v = float(m.group(1).replace(",", "."))
    except ValueError:
        return None
    return v if math.isfinite(v) and v > 0 else None


def parse_levels(value):
    if value is None:
        return None
    m = re.match(r"^([0-9]+(?:\.[0-9]+)?)", str(value).strip())
    if not m:
        return None
    try:
        v = float(m.group(1))
    except ValueError:
        return None
    return v if math.isfinite(v) and v > 0 else None


def building_kind(props: dict) -> str:
    b = (props.get("building") or "yes").strip().lower()
    if b.startswith("building:"):
        b = "yes"
    return b


def estimate_height(props: dict, oid: str):
    """返回 (height_m, source)，规则与 build-city-data.py 一致。"""
    h = parse_length_m(props.get("height"))
    if h is not None and MASSING_MIN_HEIGHT_M <= h <= 800.0:
        return h, "height"
    levels = parse_levels(props.get("building:levels"))
    if levels is not None and 1.0 <= levels <= 200.0:
        return min(levels * LEVEL_HEIGHT_M + GROUND_EXTRA_M, MASSING_MAX_HEIGHT_M), "levels"
    btype = building_kind(props)
    spec = DEFAULT_HEIGHTS.get(btype, DEFAULT_HEIGHTS["yes"])
    if isinstance(spec, (int, float)):
        return float(spec), "default:" + btype
    lo, hi = spec
    return lo + (hi - lo) * hash_unit("height", oid), "default:" + btype


def classify_area(props: dict):
    """面要素分类 → ('water'|'park'|'block', class) 或 None。"""
    lu = (props.get("landuse") or "").strip().lower()
    le = (props.get("leisure") or "").strip().lower()
    nat = (props.get("natural") or "").strip().lower()
    ww = (props.get("waterway") or "").strip().lower()
    if nat == "water" or ww in ("riverbank", "dock", "canal") or le == "swimming_pool" or lu in ("basin", "reservoir"):
        return ("water", nat or ww or le or lu or "water")
    if nat in ("wood", "scrub", "grassland", "heath"):
        return ("park", nat)
    if le in ("park", "garden", "common", "pitch", "stadium", "track", "playground",
              "recreation_ground", "golf_course", "nature_reserve", "fitness_station"):
        return ("park", le)
    if lu in ("grass", "forest", "meadow", "flowerbed", "plant_nursery", "orchard",
              "village_green", "recreation_ground", "cemetery", "allotments"):
        return ("park", lu)
    if lu:
        return ("block", lu)
    return None


# --------------------------------------------------------------------------- #
# 7. 建筑处理（ENU 精确投影 + OBB）
# --------------------------------------------------------------------------- #

def resolve_coords(refs, nodes, min_points: int = 3):
    coords = [nodes[r] for r in refs if r in nodes]
    if len(coords) != len(refs) or len(coords) < min_points:
        return None
    return coords


def process_buildings(buildings, nodes, frame: LocalFrame, prepared_rings):
    """两阶段：先算全部建筑质心/面积并做边界判定，再只为区内建筑计算 OBB。

    返回 dict：
      stats: 统计
      massing: [{id, east, north, up, w, d, angle, height, tier, area, kind, name}]
      inside_buildings: [{id, ring_lonlat, height, area, kind}]（底图绘制用，最多约 2.4 万）
      counts
    """
    t0 = time.time()
    total = len(buildings)
    centroids = []
    areas = []
    skipped = 0
    for wid, refs, tags in buildings:
        coords = resolve_coords(refs, nodes)
        if coords is None:
            skipped += 1
            continue
        ring = clean_ring_xy(coords)
        if len(ring) < 3:
            skipped += 1
            continue
        pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in ring]
        area = abs(ring_area_2d([(p[0], p[1]) for p in pts]))
        n = len(pts)
        if area < 1e-6:
            cx = sum(p[0] for p in pts) / n
            cy = sum(p[1] for p in pts) / n
        else:
            a = ring_area_2d([(p[0], p[1]) for p in pts])
            cx = cy = 0.0
            for i in range(n):
                x1, y1 = pts[i][0], pts[i][1]
                x2, y2 = pts[(i + 1) % n][0], pts[(i + 1) % n][1]
                cross = x1 * y2 - x2 * y1
                cx += (x1 + x2) * cross
                cy += (y1 + y2) * cross
            cx /= (6.0 * a)
            cy /= (6.0 * a)
        centroids.append((cx, cy))
        areas.append(area)
    log(f"  footprint 解析：{total} 条 → 有效 {len(centroids)}，跳过 {skipped}（{time.time() - t0:.1f}s）")

    mask = pip_mask_np(centroids, prepared_rings)
    if np is not None:
        mask = np.asarray(mask)
        inside_idx = [int(i) for i in np.nonzero(mask)[0]]
    else:
        inside_idx = [i for i, v in enumerate(mask) if v]
    log(f"  边界内建筑 {len(inside_idx)} / {len(centroids)}（{time.time() - t0:.1f}s）")

    # 第二遍：只为边界内建筑计算 OBB / 高度
    massing = []
    inside_buildings = []
    categories = {"height": 0, "levels": 0, "default": 0}
    skipped_area = 0
    skipped_roof = 0
    for i in inside_idx:
        wid, refs, tags = buildings[i]
        coords = resolve_coords(refs, nodes)
        if coords is None:
            continue
        ring = clean_ring_xy(coords)
        if len(ring) < 3:
            continue
        area = areas[i]
        kind = building_kind(tags)
        height, hsrc = estimate_height(tags, wid)
        categories[hsrc.split(":", 1)[0]] += 1
        # 过滤：面积 / roof（与 CBD 精细数据同规则）
        if area < MASSING_MIN_AREA_M2:
            skipped_area += 1
            continue
        if kind == "roof" and not (hsrc == "height" and height >= ROOF_MAX_HEIGHT_M):
            skipped_roof += 1
            continue
        height = max(MASSING_MIN_HEIGHT_M, min(height, MASSING_MAX_HEIGHT_M))
        inside_buildings.append({
            "id": wid, "ring": ring, "height": height, "area": area, "kind": kind,
        })
        lon_c = sum(p[0] for p in ring) / len(ring)
        lat_c = sum(p[1] for p in ring) / len(ring)
        if bbox_contains(CBD_BBOX, lon_c, lat_c):
            continue  # CBD 精细区由现有白模负责
        pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in ring]
        obb = min_area_rect([(p[0], p[1]) for p in pts])
        if obb is None:
            continue
        # 质心处地面 ENU（up 取顶点均值，含曲率）
        up_ground = sum(p[2] for p in pts) / len(pts)
        east, north = obb["cx"], obb["cy"]
        # up 用质心处的精确值：质心 ENU 的 east/north 与 obb 中心一致，高度用均值近似
        tier = 0 if height < TIERS[0]["maxHeight"] else (1 if height < TIERS[1]["maxHeight"] else 2)
        massing.append({
            "id": wid, "east": east, "north": north, "up": up_ground,
            "w": max(obb["w"], 1.0), "d": max(obb["d"], 1.0),
            "angle": obb["angle"], "height": height, "tier": tier,
            "area": area, "kind": kind,
            "name": (tags.get("name") or "").strip(),
        })
    log(f"  massing 实例 {len(massing)}（CBD bbox 外；面积过小 {skipped_area}，roof {skipped_roof}；"
        f"{time.time() - t0:.1f}s）")
    return {
        "massing": massing,
        "inside_buildings": inside_buildings,
        "stats": {
            "buildingWays": total,
            "resolved": len(centroids),
            "skippedDegenerate": skipped,
            "insideBoundary": len(inside_idx),
            "validInside": len(inside_buildings),
            "massingInstances": len(massing),
            "skippedArea": skipped_area,
            "skippedRoof": skipped_roof,
            "heightSources": categories,
        },
    }


# --------------------------------------------------------------------------- #
# 8. 道路
# --------------------------------------------------------------------------- #

def build_roads(roads, nodes, frame, prepared_rings, *, arterial_only=True):
    """全域干路：边界内 + 剔除 CBD bbox + RDP 2.5m。"""
    t0 = time.time()
    classes = ROAD_ARTERIAL if arterial_only else ROAD_ALL
    # 第一步：收集候选 way 的顶点，批量做边界判定
    candidates = []
    all_pts = []
    way_slices = []
    for wid, refs, tags in roads:
        cls = (tags.get("highway") or "").strip()
        if cls not in classes:
            continue
        coords = resolve_coords(refs, nodes, min_points=2)
        if coords is None or len(coords) < 2:
            continue
        start = len(all_pts)
        for (lon, lat) in coords:
            all_pts.append((lon, lat))
        way_slices.append((wid, tags, coords, start, len(all_pts)))
    if not all_pts:
        return [], {"candidates": 0, "kept": 0}
    # 用 ENU 坐标做 PIP
    enu_pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in all_pts]
    mask = pip_mask_np(enu_pts, prepared_rings)
    if np is not None:
        mask = np.asarray(mask)

    out = []
    kept_pts_before = 0
    kept_pts_after = 0
    for (wid, tags, coords, start, end) in way_slices:
        seg = mask[start:end]
        if not (bool(seg.any()) if np is not None else any(seg)):
            continue
        pieces = subtract_bbox_from_line(coords, CBD_BBOX)
        for pi, piece in enumerate(pieces):
            if len(piece) < 2:
                continue
            # RDP（经纬度近似米制：用局部比例）
            lon0, lat0 = piece[0]
            kx = 111320.0 * math.cos(math.radians(lat0))
            ky = 111320.0
            planar = [((lon - lon0) * kx, (lat - lat0) * ky) for (lon, lat) in piece]
            keep = simplify_rdp_indices(planar, ROAD_SIMPLIFY_TOL_M)
            if len(keep) < 2:
                keep = [0, len(piece) - 1]
            lonlat = [[round(piece[i][0], 7), round(piece[i][1], 7)] for i in keep]
            if len(lonlat) < 2:
                continue
            kept_pts_before += len(piece)
            kept_pts_after += len(lonlat)
            oid = f"way/{wid}" if len(pieces) == 1 else f"way/{wid}#{pi}"
            prop = {"id": oid, "class": tags.get("highway")}
            name = (tags.get("name") or "").strip()
            if name:
                prop["name"] = name
            ref = (tags.get("ref") or "").strip()
            if ref:
                prop["ref"] = ref
            out.append({
                "type": "Feature", "id": oid, "properties": prop,
                "geometry": {"type": "LineString", "coordinates": lonlat},
            })
    stats = {
        "candidates": len(way_slices),
        "kept": len(out),
        "pointsBefore": kept_pts_before,
        "pointsAfter": kept_pts_after,
        "seconds": round(time.time() - t0, 1),
    }
    log(f"  roads: {len(out)} 条（候选 {len(way_slices)}，点 {kept_pts_before}→{kept_pts_after}，"
        f"{stats['seconds']}s）")
    return out, stats


# --------------------------------------------------------------------------- #
# 9. 面要素（公园 / 水系）
# --------------------------------------------------------------------------- #

def build_context(areas, nodes, frame, prepared_rings):
    """公园 / 水系（大面），同时返回底图用的全部面（含 block / 小面）。"""
    t0 = time.time()
    candidates = []
    centroids = []
    for wid, refs, tags in areas:
        coords = resolve_coords(refs, nodes)
        if coords is None or len(coords) < 4:
            continue
        ring = clean_ring_xy(coords)
        if len(ring) < 3:
            continue
        cls = classify_area(tags)
        if cls is None:
            continue
        pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in ring]
        area = abs(ring_area_2d([(p[0], p[1]) for p in pts]))
        centroids.append((sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)))
        candidates.append({"id": wid, "tags": tags, "ring": ring, "kind": cls[0], "cls": cls[1], "area": area})

    if not candidates:
        return [], {"kept": 0}, []
    mask = pip_mask_np(centroids, prepared_rings)
    if np is not None:
        mask = np.asarray(mask)

    out = []
    draw_areas = []
    for i, rec in enumerate(candidates):
        if not (bool(mask[i]) if np is not None else mask[i]):
            continue
        kind = rec["kind"]
        draw_areas.append({"kind": kind, "ring": rec["ring"]})
        # context.geojson 只保留大公园 / 水系
        if kind == "park" and rec["area"] < CONTEXT_PARK_MIN_AREA_M2:
            continue
        if kind == "water" and rec["area"] < CONTEXT_WATER_MIN_AREA_M2:
            continue
        if kind == "block":
            continue
        ring = rec["ring"]
        lon0, lat0 = ring[0]
        kx = 111320.0 * math.cos(math.radians(lat0))
        ky = 111320.0
        planar = [((lon - lon0) * kx, (lat - lat0) * ky) for (lon, lat) in ring]
        keep = simplify_rdp_indices(planar, CONTEXT_SIMPLIFY_TOL_M)
        if len(keep) < 3:
            keep = list(range(len(ring)))
        coords = [[round(ring[i][0], 7), round(ring[i][1], 7)] for i in keep]
        if len(coords) < 3:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        prop = {"kind": kind, "class": rec["cls"]}
        name = (rec["tags"].get("name") or "").strip()
        if name:
            prop["name"] = name
        oid = f"way/{rec['id']}"
        prop["id"] = oid
        out.append({
            "type": "Feature", "id": oid, "properties": prop,
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })
    stats = {"candidates": len(candidates), "kept": len(out), "seconds": round(time.time() - t0, 1)}
    log(f"  context: {len(out)} 面（候选 {len(candidates)}，底图面 {len(draw_areas)}，{stats['seconds']}s）")
    return out, stats, draw_areas


def collect_road_draw_features(roads, nodes, frame, prepared_rings):
    """底图用：全部可通车道路（含 minor），保留边界内的，返回 [{class, coords}]。"""
    t0 = time.time()
    items = []
    all_pts = []
    slices = []
    for wid, refs, tags in roads:
        cls = (tags.get("highway") or "").strip()
        if cls not in ROAD_ALL:
            continue
        coords = resolve_coords(refs, nodes, min_points=2)
        if coords is None or len(coords) < 2:
            continue
        start = len(all_pts)
        all_pts.extend(coords)
        slices.append((cls, coords, start, len(all_pts)))
    if not all_pts:
        return []
    enu_pts = [frame.enu(lon, lat, 0.0) for (lon, lat) in all_pts]
    mask = pip_mask_np(enu_pts, prepared_rings)
    if np is not None:
        mask = np.asarray(mask)
    for (cls, coords, start, end) in slices:
        seg = mask[start:end]
        if not (bool(seg.any()) if np is not None else any(seg)):
            continue
        items.append({"class": cls, "coords": coords})
    log(f"  底图道路：{len(items)} 条（候选 {len(slices)}，{round(time.time() - t0, 1)}s）")
    return items


# --------------------------------------------------------------------------- #
# 10. GLB（EXT_mesh_gpu_instancing）
# --------------------------------------------------------------------------- #

def unit_box_geometry():
    """单位 box：x∈[-.5,.5], y∈[0,1], z∈[-.5,.5]，flat normals，24 顶点 / 36 索引。"""
    faces = [
        ((1, 0, 0), (0, 0.5, 0), (0, 0, 0.5)),     # +X: a=(0,1,0)*0.5, b=(0,0,1)*0.5
        ((-1, 0, 0), (0, 0.5, 0), (0, 0, -0.5)),   # -X
        ((0, 1, 0), (0, 0, 0.5), (0.5, 0, 0)),     # +Y
        ((0, -1, 0), (0.5, 0, 0), (0, 0, 0.5)),    # -Y
        ((0, 0, 1), (0.5, 0, 0), (0, 0.5, 0)),     # +Z
        ((0, 0, -1), (0, 0.5, 0), (0.5, 0, 0)),    # -Z
    ]
    centers = {
        (1, 0, 0): (0.5, 0.5, 0.0),
        (-1, 0, 0): (-0.5, 0.5, 0.0),
        (0, 1, 0): (0.0, 1.0, 0.0),
        (0, -1, 0): (0.0, 0.0, 0.0),
        (0, 0, 1): (0.0, 0.5, 0.5),
        (0, 0, -1): (0.0, 0.5, -0.5),
    }
    positions = []
    normals = []
    indices = []
    for fi, (n, a, b) in enumerate(faces):
        cx, cy, cz = centers[n]
        for (sa, sb) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            positions.append((cx + sa * a[0] + sb * b[0], cy + sa * a[1] + sb * b[1], cz + sa * a[2] + sb * b[2]))
            normals.append(n)
        base = fi * 4
        indices.extend((base, base + 1, base + 2, base, base + 2, base + 3))
    return positions, normals, indices


def write_instanced_glb(path: Path, massing, *, name="district-massing") -> dict:
    """写 EXT_mesh_gpu_instancing GLB。

    3 个 node/材质（按高度分档），共享同一单位 box 几何；每个 node 带
    EXT_mesh_gpu_instancing: TRANSLATION/ROTATION/SCALE。
    """
    positions, normals, indices = unit_box_geometry()
    pos_arr = array("f")
    for p in positions:
        pos_arr.extend(p)
    nrm_arr = array("f")
    for n in normals:
        nrm_arr.extend(n)
    idx_arr = array("H")
    idx_arr.extend(indices)

    # 按档位分组
    tiers_data = [[], [], []]
    for rec in massing:
        tiers_data[rec["tier"]].append(rec)

    bin_parts = []
    offset = 0
    buffer_views = []
    accessors = []

    def append_bytes(data: bytes) -> int:
        nonlocal offset
        pad = pad4(offset)
        if pad:
            bin_parts.append(b"\x00" * pad)
            offset += pad
        view_index = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
        bin_parts.append(data)
        offset += len(data)
        return view_index

    def add_accessor(view, ctype, count, atype, *, minmax=None, normalized=False):
        acc = {"bufferView": view, "componentType": ctype, "count": count, "type": atype}
        if normalized:
            acc["normalized"] = True
        if minmax is not None:
            acc["min"] = [round(v, 6) for v in minmax[0]]
            acc["max"] = [round(v, 6) for v in minmax[1]]
        accessors.append(acc)
        return len(accessors) - 1

    def to_bytes(arr):
        if sys.byteorder == "big":
            arr = array(arr.typecode, arr)
            arr.byteswap()
        return arr.tobytes()

    v_pos = append_bytes(to_bytes(pos_arr))
    v_nrm = append_bytes(to_bytes(nrm_arr))
    v_idx = append_bytes(to_bytes(idx_arr))
    buffer_views[v_pos]["target"] = 34962
    buffer_views[v_nrm]["target"] = 34962
    buffer_views[v_idx]["target"] = 34963
    acc_pos = add_accessor(v_pos, 5126, len(positions), "VEC3",
                           minmax=((-0.5, 0.0, -0.5), (0.5, 1.0, 0.5)))
    acc_nrm = add_accessor(v_nrm, 5126, len(normals), "VEC3")
    acc_idx = add_accessor(v_idx, 5123, len(indices), "SCALAR")

    meshes = []
    nodes = []
    materials = []
    for tier, recs in zip(TIERS, tiers_data):
        if not recs:
            continue
        trans = array("f")
        rot = array("f")
        scale = array("f")
        min_t = [math.inf] * 3
        max_t = [-math.inf] * 3
        min_s = [math.inf] * 3
        max_s = [-math.inf] * 3
        min_r = [math.inf] * 4
        max_r = [-math.inf] * 4
        for r in recs:
            t = (r["east"], r["up"], -r["north"])   # glTF: x=east, y=up, z=-north
            theta = r["angle"]
            q = (0.0, math.sin(theta * 0.5), 0.0, math.cos(theta * 0.5))  # 绕 glTF +Y
            s = (r["w"], r["height"], r["d"])       # x→w, y→height, z→d
            trans.extend(t)
            rot.extend(q)
            scale.extend(s)
            for k in range(3):
                min_t[k] = min(min_t[k], t[k])
                max_t[k] = max(max_t[k], t[k])
                min_s[k] = min(min_s[k], s[k])
                max_s[k] = max(max_s[k], s[k])
            for k in range(4):
                min_r[k] = min(min_r[k], q[k])
                max_r[k] = max(max_r[k], q[k])
        v_t = append_bytes(to_bytes(trans))
        v_r = append_bytes(to_bytes(rot))
        v_s = append_bytes(to_bytes(scale))
        for v in (v_t, v_r, v_s):
            buffer_views[v]["target"] = 34962
        a_t = add_accessor(v_t, 5126, len(recs), "VEC3", minmax=(min_t, max_t))
        a_r = add_accessor(v_r, 5126, len(recs), "VEC4", minmax=(min_r, max_r))
        a_s = add_accessor(v_s, 5126, len(recs), "VEC3", minmax=(min_s, max_s))
        mat_index = len(materials)
        materials.append({
            "name": tier["name"],
            "pbrMetallicRoughness": {
                "baseColorFactor": tier["color"],
                "metallicFactor": MATERIAL_COMMON["metallicFactor"],
                "roughnessFactor": MATERIAL_COMMON["roughnessFactor"],
            },
            "emissiveFactor": MATERIAL_EMISSIVE,
            "doubleSided": False,
        })
        meshes.append({
            "name": tier["name"],
            "primitives": [{
                "attributes": {"POSITION": acc_pos, "NORMAL": acc_nrm},
                "indices": acc_idx,
                "material": mat_index,
                "mode": 4,
            }],
        })
        nodes.append({
            "name": tier["name"],
            "mesh": len(meshes) - 1,
            "extensions": {
                "EXT_mesh_gpu_instancing": {
                    "attributes": {"TRANSLATION": a_t, "ROTATION": a_r, "SCALE": a_s},
                },
            },
        })

    bin_data = b"".join(bin_parts)
    gltf = {
        "asset": {"version": "2.0", "generator": GENERATOR},
        "extensionsUsed": ["EXT_mesh_gpu_instancing"],
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "extras": {
            "generator": GENERATOR,
            "instances": len(massing),
            "trianglesPerInstance": 12,
            "instancing": "EXT_mesh_gpu_instancing",
            "unitBox": {"x": [-0.5, 0.5], "y": [0.0, 1.0], "z": [-0.5, 0.5]},
            "axes": "glTF Y-up: x=east, y=up, z=-north; instance TRANSLATION=(east, up, -north)",
        },
    }
    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_pad = pad4(len(json_bytes))
    json_chunk = json_bytes + b" " * json_pad
    bin_pad = pad4(len(bin_data))
    bin_chunk = bin_data + b"\x00" * bin_pad
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<III", 0x46546C67, 2, total)
    chunk_json = struct.pack("<II", len(json_chunk), 0x4E4F534A)
    chunk_bin = struct.pack("<II", len(bin_chunk), 0x004E4942)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + chunk_json + json_chunk + chunk_bin + bin_chunk)
    return {
        "bytes": total,
        "jsonChunkBytes": len(json_chunk),
        "binChunkBytes": len(bin_chunk),
        "instances": len(massing),
        "triangles": len(massing) * 12,
        "tierCounts": [len(r) for r in tiers_data if r],
        "vertices": len(positions) * len([r for r in tiers_data if r]),
    }


def instance_tile_bounds(massing):
    """计算实例在 tile 坐标 (x=east,y=north,z=up) 下的 AABB。"""
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for r in massing:
        c, s = math.cos(r["angle"]), math.sin(r["angle"])
        hw, hd = r["w"] * 0.5, r["d"] * 0.5
        hx = abs(hw * c) + abs(hd * s)
        hy = abs(hw * s) + abs(hd * c)
        e, n, u = r["east"], r["north"], r["up"]
        mn[0] = min(mn[0], e - hx)
        mx[0] = max(mx[0], e + hx)
        mn[1] = min(mn[1], n - hy)
        mx[1] = max(mx[1], n + hy)
        mn[2] = min(mn[2], u)
        mx[2] = max(mx[2], u + r["height"])
    return mn, mx


def write_tileset(path: Path, massing, frame: LocalFrame, glb_rel: str) -> dict:
    mn, mx = instance_tile_bounds(massing)
    center = [(mn[k] + mx[k]) * 0.5 for k in range(3)]
    half = [(mx[k] - mn[k]) * 0.5 + 2.0 for k in range(3)]
    box = [
        round(center[0], 3), round(center[1], 3), round(center[2], 3),
        round(half[0], 3), 0.0, 0.0,
        0.0, round(half[1], 3), 0.0,
        0.0, 0.0, round(half[2], 3),
    ]
    tileset = {
        "asset": {"version": "1.1", "generator": GENERATOR},
        "geometricError": 800.0,
        "root": {
            "refine": "ADD",
            "boundingVolume": {"box": box},
            "geometricError": 0.0,
            "transform": [round(v, 10) for v in frame.transform_matrix()],
            "content": {"uri": glb_rel},
        },
    }
    write_json(path, tileset)
    return {"box": box, "center": center, "half": half, "tileset": tileset}


# --------------------------------------------------------------------------- #
# 11. basemap
# --------------------------------------------------------------------------- #

def build_basemap(boundary_rings, inside_buildings, road_draw, area_draw,
                  boundary_bbox, out_path: Path, *, width=BASEMAP_WIDTH,
                  padding=BASEMAP_PADDING_DEG, quality=BASEMAP_JPEG_QUALITY):
    """朝阳区暗色栅格底图（经纬度线性映射）。

    :param road_draw: [{class, coords}]（全部可通车道路，含 minor）
    :param area_draw: [{kind, ring}]（landuse/leisure/natural 面，含 block/park/water）
    """
    if not HAS_PIL:
        log("WARNING: Pillow 不可用，跳过 basemap")
        return None
    t0 = time.time()
    w, s, e, n = boundary_bbox
    rect = [w - padding, s - padding, e + padding, n + padding]
    rw, rs, re_, rn = rect
    height = int(round(width * (rn - rs) / (re_ - rw)))
    ss = BASEMAP_SUPERSAMPLE
    W, H = width * ss, height * ss

    def px(lon):
        return (lon - rw) / (re_ - rw) * W

    def py(lat):
        return (rn - lat) / (rn - rs) * H

    img = Image.new("RGB", (W, H), BASEMAP_COLORS["bg"])
    draw = ImageDraw.Draw(img)

    # 1) 区界内底色
    for ring in boundary_rings:
        pts = [(px(lon), py(lat)) for (lon, lat) in ring]
        if len(pts) >= 3:
            draw.polygon(pts, fill=BASEMAP_COLORS["district"])

    # 2) 地块 / 公园 / 水系
    order = {"block": 0, "park": 1, "water": 2}
    for item in sorted(area_draw, key=lambda a: order.get(a["kind"], 9)):
        if item["kind"] == "water":
            color = BASEMAP_COLORS["water"]
        elif item["kind"] == "park":
            color = BASEMAP_COLORS["park"]
        else:
            color = BASEMAP_COLORS["block"]
        pts = [(px(lon), py(lat)) for (lon, lat) in item["ring"]]
        if len(pts) >= 3:
            draw.polygon(pts, fill=color)

    # 3) 建筑脚印（边界内）
    for rec in inside_buildings:
        pts = [(px(lon), py(lat)) for (lon, lat) in rec["ring"]]
        if len(pts) >= 3:
            draw.polygon(pts, fill=BASEMAP_COLORS["building"] if rec["height"] < 30 else BASEMAP_COLORS["building_hi"])

    # 4) 道路（先 minor，后 arterial）
    def road_color(cls):
        return BASEMAP_COLORS["road"].get(cls, BASEMAP_COLORS["road"]["residential"])

    for pred in (lambda c: c in ROAD_MINOR, lambda c: c in ROAD_ARTERIAL):
        for item in road_draw:
            cls = item["class"]
            if not pred(cls):
                continue
            lw = BASEMAP_ROAD_WIDTH.get(cls, 2) * ss
            pts = [(px(lon), py(lat)) for (lon, lat) in item["coords"]]
            if len(pts) >= 2:
                draw.line(pts, fill=road_color(cls), width=lw, joint="curve")

    # 5) 用区界 mask 把界外内容裁掉（保持底图只表达朝阳区）
    mask = Image.new("L", (W, H), 255)
    mdraw = ImageDraw.Draw(mask)
    for ring in boundary_rings:
        pts = [(px(lon), py(lat)) for (lon, lat) in ring]
        if len(pts) >= 3:
            mdraw.polygon(pts, fill=0)
    bg_img = Image.new("RGB", (W, H), BASEMAP_COLORS["bg"])
    img.paste(bg_img, (0, 0), mask)

    # 6) 区界描边
    for ring in boundary_rings:
        pts = [(px(lon), py(lat)) for (lon, lat) in ring]
        if len(pts) >= 3:
            draw.line(pts + [pts[0]], fill=BASEMAP_COLORS["boundary"], width=3 * ss, joint="curve")

    # 7) 降采样 + 暗角
    img = img.resize((width, height), Image.LANCZOS)
    if np is not None:
        arr = np.asarray(img).astype("float32")
        hh, ww = arr.shape[:2]
        yy, xx = np.mgrid[0:hh, 0:ww]
        cx, cy = (ww - 1) / 2.0, (hh - 1) / 2.0
        r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / math.sqrt(2.0)
        factor = 1.0 - 0.30 * np.clip((r - 0.40) / 0.60, 0.0, 1.0) ** 1.5
        arr *= factor[..., None]
        img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    chosen_quality = quality
    for q in (quality, 78, 74, 70, 66, 62):
        chosen_quality = q
        img.save(out_path, format="JPEG", quality=q, optimize=True, progressive=True, subsampling=1)
        if out_path.stat().st_size <= BASEMAP_MAX_BYTES:
            break
    size = out_path.stat().st_size
    log(f"  basemap: {width}x{height}, {fmt_size(size)} @ q{chosen_quality}, {time.time() - t0:.1f}s")
    return {
        "rect": rect, "width": width, "height": height, "bytes": size,
        "quality": chosen_quality, "supersample": ss,
    }


# --------------------------------------------------------------------------- #
# 12. 校验
# --------------------------------------------------------------------------- #

def validate_glb(path: Path, expected_instances: int) -> dict:
    report = {"errors": [], "warnings": [], "path": str(path)}
    data = path.read_bytes()
    report["bytes"] = len(data)
    if len(data) < 20:
        report["errors"].append("文件过短")
        return report
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        report["errors"].append(f"magic 非 glTF: 0x{magic:08x}")
    if version != 2:
        report["errors"].append(f"GLB version={version}")
    if length != len(data):
        report["errors"].append(f"header.length={length} != {len(data)}")
    off = 12
    chunks = []
    while off + 8 <= len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        off += 8
        if off + clen > len(data):
            report["errors"].append("chunk 越界")
            break
        chunks.append((ctype, data[off:off + clen]))
        off += clen
    if off != len(data):
        report["errors"].append("chunk 解析后有残余")
    json_chunk = next((b for t, b in chunks if t == 0x4E4F534A), None)
    bin_chunk = next((b for t, b in chunks if t == 0x004E4942), None)
    if json_chunk is None or bin_chunk is None:
        report["errors"].append("缺少 JSON/BIN chunk")
        return report
    try:
        gltf = json.loads(json_chunk.decode("utf-8").rstrip())
    except Exception as exc:
        report["errors"].append(f"JSON 解析失败: {exc}")
        return report
    report["gltf"] = gltf
    if "EXT_mesh_gpu_instancing" not in (gltf.get("extensionsUsed") or []):
        report["errors"].append("extensionsUsed 缺少 EXT_mesh_gpu_instancing")
    if gltf.get("buffers", [{}])[0].get("byteLength", -1) > len(bin_chunk) or \
            gltf.get("buffers", [{}])[0].get("byteLength", 0) <= len(bin_chunk) - 4:
        report["errors"].append("buffer.byteLength 与 BIN chunk 不匹配")
    for i, bv in enumerate(gltf.get("bufferViews") or []):
        if (bv.get("byteOffset", 0)) % 4 != 0:
            report["errors"].append(f"bufferView[{i}] 未 4 字节对齐")
        if bv.get("byteOffset", 0) + bv.get("byteLength", 0) > len(bin_chunk):
            report["errors"].append(f"bufferView[{i}] 越界")
    comp_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    arity = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    total_instances = 0
    for ni, node in enumerate(gltf.get("nodes") or []):
        ext = (node.get("extensions") or {}).get("EXT_mesh_gpu_instancing")
        if not ext:
            continue
        attrs = ext.get("attributes") or {}
        for key in ("TRANSLATION", "SCALE"):
            if key not in attrs:
                report["errors"].append(f"node[{ni}] 缺少 {key}")
        if "TRANSLATION" not in attrs:
            continue
        acc = gltf["accessors"][attrs["TRANSLATION"]]
        count = acc["count"]
        total_instances += count
        for key in ("TRANSLATION", "ROTATION", "SCALE"):
            if key not in attrs:
                continue
            a = gltf["accessors"][attrs[key]]
            unit = comp_size[a["componentType"]] * arity[a["type"]]
            bv = gltf["bufferViews"][a["bufferView"]]
            if unit * a["count"] > bv["byteLength"]:
                report["errors"].append(f"node[{ni}] {key} accessor 超出 bufferView")
            if a["count"] != count:
                report["errors"].append(f"node[{ni}] {key} 数量与 TRANSLATION 不一致")
            if "min" not in a or "max" not in a:
                report["warnings"].append(f"node[{ni}] {key} 缺少 min/max")
    report["instances"] = total_instances
    report["triangles"] = total_instances * 12
    if expected_instances and total_instances != expected_instances:
        report["errors"].append(f"实例数 {total_instances} != 期望 {expected_instances}")
    # 索引范围
    for mesh in gltf.get("meshes") or []:
        for prim in mesh.get("primitives") or []:
            idx_acc = gltf["accessors"][prim["indices"]]
            pos_acc = gltf["accessors"][prim["attributes"]["POSITION"]]
            if idx_acc["count"] % 3 != 0:
                report["errors"].append("索引数不是 3 的倍数")
            bv = gltf["bufferViews"][idx_acc["bufferView"]]
            start = bv.get("byteOffset", 0) + idx_acc.get("byteOffset", 0)
            if idx_acc["componentType"] == 5123:
                arr = struct.unpack_from("<%dH" % idx_acc["count"], bin_chunk, start)
                if arr and max(arr) >= pos_acc["count"]:
                    report["errors"].append("索引越界")
    return report


def validate_tileset(path: Path, frame: LocalFrame, massing) -> dict:
    report = {"errors": [], "warnings": [], "path": str(path)}
    try:
        tileset = json.loads(path.read_text("utf-8"))
    except Exception as exc:
        report["errors"].append(f"JSON 解析失败: {exc}")
        return report
    report["tileset"] = tileset
    root = tileset.get("root") or {}
    ver = str((tileset.get("asset") or {}).get("version", ""))
    if not ver.startswith("1.1"):
        report["errors"].append(f"asset.version={ver}")
    t = root.get("transform")
    if not (isinstance(t, list) and len(t) == 16):
        report["errors"].append("transform 缺失")
    else:
        cols = [t[0:3], t[4:7], t[8:11]]
        for i, c in enumerate(cols):
            if abs(math.sqrt(sum(v * v for v in c)) - 1.0) > 1e-6:
                report["errors"].append(f"transform 列{i} 非单位")
        for i in range(3):
            for j in range(i + 1, 3):
                if abs(sum(cols[i][k] * cols[j][k] for k in range(3))) > 1e-9:
                    report["errors"].append(f"transform 列{i}·列{j}!=0")
        det = (
            cols[0][0] * (cols[1][1] * cols[2][2] - cols[1][2] * cols[2][1])
            - cols[1][0] * (cols[0][1] * cols[2][2] - cols[0][2] * cols[2][1])
            + cols[2][0] * (cols[0][1] * cols[1][2] - cols[0][2] * cols[1][1])
        )
        if det < 0:
            report["errors"].append("transform 为镜像")
        expect = frame.transform_matrix()
        if max(abs(a - b) for a, b in zip(t, expect)) > 1e-6:
            report["errors"].append("transform 与 ENU 原点不一致")
    box = (root.get("boundingVolume") or {}).get("box")
    if not (isinstance(box, list) and len(box) == 12):
        report["errors"].append("box 缺失")
    else:
        mn, mx = instance_tile_bounds(massing)
        for k in range(3):
            lo = box[k] - box[3 + 4 * k]
            hi = box[k] + box[3 + 4 * k]
            if not (lo <= mn[k] + 1e-6 and hi >= mx[k] - 1e-6):
                report["errors"].append(f"box 未覆盖实例 axis{k}: {lo:.1f}..{hi:.1f} vs {mn[k]:.1f}..{mx[k]:.1f}")
    uri = (root.get("content") or {}).get("uri")
    if not uri:
        report["errors"].append("content.uri 缺失")
    elif not (path.parent / uri).exists():
        report["errors"].append(f"content.uri 文件不存在: {uri}")
    if root.get("refine") not in ("ADD", "REPLACE"):
        report["errors"].append("refine 非法")
    return report


# --------------------------------------------------------------------------- #
# 13. 主流程
# --------------------------------------------------------------------------- #

def default_out_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "public" / "data" / "district"


def load_boundary(path: Path):
    doc = json.loads(path.read_text("utf-8"))
    features = doc.get("features") or []
    if not features:
        die("boundary GeoJSON 无 feature")
    feature = features[0]
    geom = feature.get("geometry") or {}
    if geom.get("type") != "MultiPolygon":
        die(f"boundary 几何类型 {geom.get('type')}，需要 MultiPolygon")
    rings = [poly[0] for poly in geom["coordinates"]]
    xs = [p[0] for ring in rings for p in ring]
    ys = [p[1] for ring in rings for p in ring]
    bbox = [min(xs), min(ys), max(xs), max(ys)]
    return feature, rings, bbox


def boundary_centroid_lonlat(rings):
    """边界面积加权质心（经纬度平面近似，仅用于 meta.center 展示）。"""
    total = 0.0
    cx = cy = 0.0
    for ring in rings:
        n = len(ring)
        if n < 3:
            continue
        a = 0.0
        sx = sy = 0.0
        for i in range(n):
            x1, y1 = ring[i]
            x2, y2 = ring[(i + 1) % n]
            cross = x1 * y2 - x2 * y1
            a += cross
            sx += (x1 + x2) * cross
            sy += (y1 + y2) * cross
        a *= 0.5
        if abs(a) < 1e-18:
            continue
        total += a
        cx += (sx / (6.0 * a)) * a
        cy += (sy / (6.0 * a)) * a
    if abs(total) < 1e-18:
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
    return (cx / total, cy / total)


def boundary_area_km2(rings):
    total = 0.0
    for ring in rings:
        n = len(ring)
        if n < 3:
            continue
        mean_lat = sum(p[1] for p in ring) / n
        kx = 111320.0 * math.cos(math.radians(mean_lat))
        ky = 111320.0
        xs = [(p[0]) * kx for p in ring]
        ys = [(p[1]) * ky for p in ring]
        a = 0.0
        for i in range(n):
            a += xs[i] * ys[(i + 1) % n] - xs[(i + 1) % n] * ys[i]
        total += abs(a) * 0.5
    return total / 1e6


def run_build(args) -> int:
    t_start = time.time()
    out_dir = Path(args.out).resolve() if args.out else default_out_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    tiles_dir = out_dir / "tiles" / "district-massing"
    tiles_dir.mkdir(parents=True, exist_ok=True)

    frame = LocalFrame(*ORIGIN)
    log(f"ENU 原点 {ORIGIN}，ECEF=({frame.origin_ecef[0]:.2f}, {frame.origin_ecef[1]:.2f}, {frame.origin_ecef[2]:.2f})")

    boundary_feature, boundary_rings, boundary_bbox = load_boundary(Path(args.boundary))
    center_lonlat = boundary_centroid_lonlat(boundary_rings)
    boundary_area = boundary_area_km2(boundary_rings)
    props = boundary_feature.get("properties") or {}
    log(f"边界：{props.get('name')} / {props.get('name:en')}，bbox={[round(v, 6) for v in boundary_bbox]}，"
        f"环数={len(boundary_rings)}，点数={sum(len(r) for r in boundary_rings)}")

    # 边界环 → ENU（PIP 用；线性和底图用原经纬度）
    rings_enu = [[frame.enu(lon, lat, 0.0)[:2] for (lon, lat) in ring] for ring in boundary_rings]
    prepared_rings = pip_inputs(rings_enu)

    parsed = parse_osm(Path(args.osm_gz), cache=Path(args.cache) if args.cache else None)
    nodes = parsed["nodes"]

    # 建筑
    log("处理建筑（ENU + OBB + 高度）…")
    bres = process_buildings(parsed["buildings"], nodes, frame, prepared_rings)
    massing = bres["massing"]
    stats = bres["stats"]
    log(f"建筑统计: {stats}")

    # 道路
    log("处理道路…")
    road_features, road_stats = build_roads(parsed["roads"], nodes, frame, prepared_rings, arterial_only=True)

    # 面要素
    log("处理公园/水系…")
    context_features, context_stats, area_draw = build_context(parsed["areas"], nodes, frame, prepared_rings)
    log("收集底图道路…")
    road_draw = collect_road_draw_features(parsed["roads"], nodes, frame, prepared_rings)

    # 写 GeoJSON
    log("写 boundary.geojson …")
    boundary_geometry = boundary_feature["geometry"]
    boundary_props = {
        "name": props.get("name") or "朝阳区",
        "name:en": props.get("name:en") or "Chaoyang District",
        "ref": props.get("ref:admin:CN") or "110105",
        "areaKm2": props.get("areaKm2") or 465.5,
        "source": props.get("source") or "OpenStreetMap relation 2988933",
        "attribution": "© OpenStreetMap contributors",
        "license": props.get("license") or "ODbL 1.0",
    }
    boundary_bytes = write_json(out_dir / "boundary.geojson", {
        "type": "FeatureCollection",
        "name": "chaoyang-boundary",
        "bbox": [round(v, 7) for v in boundary_bbox],
        "features": [{
            "type": "Feature",
            "id": boundary_feature.get("id") or "relation/2988933",
            "properties": boundary_props,
            "geometry": boundary_geometry,
        }],
    })

    log(f"写 roads.geojson（{len(road_features)} 条干路）…")
    roads_bytes = write_json(out_dir / "roads.geojson", {
        "type": "FeatureCollection",
        "name": "chaoyang-arterial-roads",
        "bbox": [round(v, 7) for v in boundary_bbox],
        "features": road_features,
    })

    log(f"写 context.geojson（{len(context_features)} 面）…")
    context_bytes = write_json(out_dir / "context.geojson", {
        "type": "FeatureCollection",
        "name": "chaoyang-context",
        "bbox": [round(v, 7) for v in boundary_bbox],
        "features": context_features,
    })

    # 白模实例
    log("生成 instanced GLB（EXT_mesh_gpu_instancing）…")
    glb_path = tiles_dir / "district-massing.glb"
    glb_info = write_instanced_glb(glb_path, massing)
    log(f"  district-massing.glb: {fmt_size(glb_info['bytes'])}，{glb_info['instances']} 实例，"
        f"{glb_info['triangles']} 三角形，档位={glb_info['tierCounts']}")

    tileset_path = tiles_dir / "tileset.json"
    ts_info = write_tileset(tileset_path, massing, frame, glb_path.name)
    log(f"  tileset.json: {fmt_size(tileset_path.stat().st_size)} box={ts_info['box']}")

    # 底图
    log("绘制 basemap.jpg（3072px 暗色）…")
    basemap_meta = None if args.skip_basemap else build_basemap(
        boundary_rings, bres["inside_buildings"], road_draw, area_draw,
        boundary_bbox, out_dir / "basemap.jpg",
    )

    # 统计
    tier_counts = glb_info["tierCounts"]
    counts = {
        "buildings": stats["validInside"],
        "instances": len(massing),
        "roads": len(road_features),
        "triangles": len(massing) * 12,
        "buildingsRaw": stats["insideBoundary"],
        "buildingsInCbdBbox": stats["validInside"] - len(massing),
        "context": len(context_features),
    }
    meta = {
        "name": boundary_props["name"],
        "nameEn": boundary_props["name:en"],
        "areaKm2": boundary_props["areaKm2"],
        "boundaryBbox": [round(v, 7) for v in boundary_bbox],
        "center": {
            "lon": round(center_lonlat[0], 6),
            "lat": round(center_lonlat[1], 6),
        },
        "origin": {"lon": ORIGIN[0], "lat": ORIGIN[1], "height": ORIGIN[2]},
        "originEcef": [round(v, 4) for v in frame.origin_ecef],
        "transform": [round(v, 10) for v in frame.transform_matrix()],
        "transformLayout": "column-major 4x4 ENU→ECEF；列0=east 列1=north 列2=up 列3=origin(ECEF)",
        "axis": {
            "tile": "x=east, y=north, z=up（root.transform 映射到 ECEF）",
            "gltf": "Y-up: x=east, y=up, z=-north；Cesium 自动做 Y_UP_TO_Z_UP (x,y,z)→(x,-z,y)",
            "instance": "world(glTF) = T * R * S * unitBox；TRANSLATION=(east, up, -north)，up 为该点椭球高 0 的 ENU up（含曲率），ROTATION=绕 glTF +Y 的 heading 四元数，SCALE=(footprint长, 高度, footprint宽)",
            "unitBox": {"x": [-0.5, 0.5], "y": [0.0, 1.0], "z": [-0.5, 0.5]},
            "frontendHint": "Cesium 1.147 直接加载即可，无需额外设置；若其他引擎不做 Y-up→Z-up，需给根节点补 +90° X 四元数",
        },
        "basemap": None if not basemap_meta else {
            "file": "data/district/basemap.jpg",
            "rectangle": [round(v, 7) for v in basemap_meta["rect"]],
            "width": basemap_meta["width"],
            "height": basemap_meta["height"],
            "bytes": basemap_meta["bytes"],
            "pixelMapping": "经纬度线性映射: x=(lon-west)/(east-west)*width, y=(north-lat)/(north-south)*height",
        },
        "counts": counts,
        "tiles": {
            "massing": {
                "tileset": "data/district/tiles/district-massing/tileset.json",
                "glb": "data/district/tiles/district-massing/district-massing.glb",
                "instances": len(massing),
                "triangles": len(massing) * 12,
                "bytes": glb_info["bytes"],
                "tilesetBytes": tileset_path.stat().st_size,
                "instancing": "EXT_mesh_gpu_instancing",
                "tiers": [
                    {"name": t["name"], "count": c, "maxHeight": t["maxHeight"], "color": t["color"]}
                    for t, c in zip(TIERS, tier_counts)
                ],
                "boundsEnu": {
                    "min": [round(v, 2) for v in instance_tile_bounds(massing)[0]],
                    "max": [round(v, 2) for v in instance_tile_bounds(massing)[1]],
                },
            },
        },
        "roads": {"file": "data/district/roads.geojson", "count": len(road_features), "bytes": roads_bytes,
                  "simplifyToleranceM": ROAD_SIMPLIFY_TOL_M, "excludedCbdBbox": list(CBD_BBOX)},
        "context": {"file": "data/district/context.geojson", "count": len(context_features), "bytes": context_bytes,
                    "parkMinAreaM2": CONTEXT_PARK_MIN_AREA_M2, "waterMinAreaM2": CONTEXT_WATER_MIN_AREA_M2},
        "boundary": {"file": "data/district/boundary.geojson", "points": sum(len(r) for r in boundary_rings),
                     "rings": len(boundary_rings), "bytes": boundary_bytes},
        "generatedAt": utc_now_iso(),
        "generator": TOOL,
        "source": "OpenStreetMap · BBBike Beijing extract",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL 1.0",
        "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "cbdExclusionBbox": list(CBD_BBOX),
        "heightModel": {
            "priority": ["height tag (米)", "building:levels * 3.2 + 1.2", "building 类型默认值"],
            "levelHeightM": LEVEL_HEIGHT_M,
            "groundExtraM": GROUND_EXTRA_M,
            "minFootprintAreaM2": MASSING_MIN_AREA_M2,
            "minHeightM": MASSING_MIN_HEIGHT_M,
        },
        "stats": {
            **stats,
            "boundaryAreaKm2Computed": round(boundary_area, 2),
            "roads": road_stats,
            "roadFeaturesDrawn": len(road_draw),
            "context": context_stats,
        },
        "notes": [
            "massing 仅覆盖朝阳区边界内、现有 CBD 精细 bbox 之外的低模体块；CBD 内由原有精细白模负责。",
            "box 为 footprint 的最小面积包围矩形（OBB），不是完整墙面/屋顶三角化。",
            "实例位置按 WGS84 椭球高 0 的地面放置（up 含地球曲率），与底图/精细白模同一基准。",
            "道路已剔除 CBD 精细 bbox 内的片段，避免与现有 roads.geojson 重复。",
            "底图 rectangle 含约 0.008° padding，绘制时按经纬度线性映射，可直接用 Cesium.Rectangle 贴地。",
        ],
    }
    meta_bytes = write_json(out_dir / "meta.json", meta)
    log(f"meta.json: {fmt_size(meta_bytes)}")

    # 自检
    problems = 0
    if not args.skip_verify:
        log("自检 …")
        glb_report = validate_glb(glb_path, len(massing))
        for err in glb_report["errors"]:
            problems += 1
            log(f"  GLB ERROR: {err}")
        ts_report = validate_tileset(tileset_path, frame, massing)
        for err in ts_report["errors"]:
            problems += 1
            log(f"  tileset ERROR: {err}")
        for f in ("boundary.geojson", "roads.geojson", "context.geojson"):
            try:
                doc = json.loads((out_dir / f).read_text("utf-8"))
                if doc.get("type") != "FeatureCollection":
                    problems += 1
                    log(f"  {f} ERROR: 非 FeatureCollection")
                if not isinstance(doc.get("features"), list):
                    problems += 1
                    log(f"  {f} ERROR: features 非法")
            except Exception as exc:
                problems += 1
                log(f"  {f} ERROR: {exc}")
        log(f"自检完成：{problems} 个问题" + (" ❌" if problems else " ✅"))
    meta["verification"] = {"errors": problems, "glbBytes": glb_info["bytes"]}
    write_json(out_dir / "meta.json", meta)

    # 汇总
    log("产物：")
    total = 0
    for p in sorted(out_dir.rglob("*")):
        if p.is_file():
            total += p.stat().st_size
            log(f"  {p.relative_to(out_dir)}  {fmt_size(p.stat().st_size)}")
    log(f"合计 {fmt_size(total)}，总耗时 {time.time() - t_start:.1f}s")
    return 0 if problems == 0 else 1


def run_verify(args) -> int:
    out_dir = Path(args.out).resolve() if args.out else default_out_dir()
    log(f"校验 {out_dir} …")
    problems = 0
    meta_path = out_dir / "meta.json"
    frame = LocalFrame(*ORIGIN)
    massing_instances = 0
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text("utf-8"))
            massing_instances = int(meta["counts"]["instances"])
            generated = meta.get("generatedAt")
            log(f"meta.json OK，generatedAt={generated}，instances={massing_instances}")
        except Exception as exc:
            problems += 1
            log(f"  meta.json ERROR: {exc}")
    else:
        problems += 1
        log("  ERROR: 缺少 meta.json")
    glb_path = out_dir / "tiles" / "district-massing" / "district-massing.glb"
    if glb_path.exists():
        glb_report = validate_glb(glb_path, massing_instances)
        problems += len(glb_report["errors"])
        log(f"GLB: {fmt_size(glb_report['bytes'])}，实例 {glb_report.get('instances')}，"
            f"三角形 {glb_report.get('triangles')}")
        for err in glb_report["errors"]:
            log(f"  GLB ERROR: {err}")
        for warn in glb_report["warnings"]:
            log(f"  GLB WARN: {warn}")
    else:
        problems += 1
        log("  ERROR: 缺少 district-massing.glb")
    # 用 meta 中的实例边界近似校验 tileset box（不重跑 OBB 计算）
    tileset_path = out_dir / "tiles" / "district-massing" / "tileset.json"
    if tileset_path.exists():
        try:
            tileset = json.loads(tileset_path.read_text("utf-8"))
            t = tileset["root"]["transform"]
            cols = [t[0:3], t[4:7], t[8:11]]
            for i, c in enumerate(cols):
                if abs(math.sqrt(sum(v * v for v in c)) - 1.0) > 1e-6:
                    problems += 1
                    log(f"  tileset ERROR: transform 列{i} 非单位")
            expect = frame.transform_matrix()
            if max(abs(a - b) for a, b in zip(t, expect)) > 1e-6:
                problems += 1
                log("  tileset ERROR: transform 与 ORIGIN 不自洽")
            uri = tileset["root"]["content"]["uri"]
            if not (tileset_path.parent / uri).exists():
                problems += 1
                log(f"  tileset ERROR: content.uri 不存在: {uri}")
            log(f"tileset OK: version={tileset['asset']['version']}，content={uri}")
        except Exception as exc:
            problems += 1
            log(f"  tileset ERROR: {exc}")
    else:
        problems += 1
        log("  ERROR: 缺少 tileset.json")
    for f in ("boundary.geojson", "roads.geojson", "context.geojson"):
        p = out_dir / f
        if not p.exists():
            problems += 1
            log(f"  ERROR: 缺少 {f}")
            continue
        try:
            doc = json.loads(p.read_text("utf-8"))
            log(f"{f}: {len(doc.get('features') or [])} features, {fmt_size(p.stat().st_size)}")
        except Exception as exc:
            problems += 1
            log(f"  {f} ERROR: {exc}")
    bm = out_dir / "basemap.jpg"
    if bm.exists() and HAS_PIL:
        try:
            from PIL import Image as _Image
            with _Image.open(bm) as im:
                log(f"basemap.jpg: {im.size[0]}x{im.size[1]} {fmt_size(bm.stat().st_size)}")
                if im.size[0] < 2048:
                    problems += 1
                    log("  ERROR: basemap 宽度不足")
        except Exception as exc:
            log(f"  WARN: 无法读取 basemap ({exc})")
    if problems:
        log(f"校验失败：{problems} 个问题")
        return 1
    log("校验通过 ✅")
    return 0


def build_arg_parser():
    p = argparse.ArgumentParser(description="朝阳区全域低模数据管线（OSM → 边界/底图/干路/实例化 box）")
    p.add_argument("--osm-gz", default=DEFAULT_OSM, help=f"OSM extract 路径，默认 {DEFAULT_OSM}")
    p.add_argument("--boundary", default=DEFAULT_BOUNDARY, help=f"朝阳区边界 GeoJSON，默认 {DEFAULT_BOUNDARY}")
    p.add_argument("--out", default=None, help="输出目录，默认 <app>/public/data/district")
    p.add_argument("--cache", default=None, help="解析缓存 pickle 路径（开发期加速，可选）")
    p.add_argument("--skip-basemap", action="store_true", help="跳过 basemap.jpg")
    p.add_argument("--skip-verify", action="store_true", help="跳过生成后自检")
    p.add_argument("--verify-only", action="store_true", help="只校验已有产物")
    return p


def main(argv=None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.verify_only:
        return run_verify(args)
    return run_build(args)


if __name__ == "__main__":
    raise SystemExit(main())
