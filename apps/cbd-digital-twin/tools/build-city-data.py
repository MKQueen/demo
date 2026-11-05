#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-city-data.py — 北京朝阳 CBD 数字孪生 · 数据管线
=====================================================

从 OpenStreetMap（BBBike Beijing extract，ODbL 1.0）生成一套可直接静态托管的
Cesium 数据资产，全部落在 `apps/cbd-digital-twin/public/data/` 下：

    public/data/
    ├── meta.json                     # 元数据：来源/归属/统计/原点/height 模型/basemap 矩形
    ├── roads.geojson                 # 可通车道路（RDP 0.5m 抽稀，裁剪到 bbox）
    ├── context.geojson               # 水系 / 公园绿地 / landuse 面
    ├── railways.geojson              # 铁路 / 地铁线
    ├── buildings-fallback.geojson    # 3D Tiles 加载失败时的建筑面兜底（core 内，按高度/面积取前 700）
    ├── basemap.jpg                   # 暗色栅格底图（经纬度线性映射，与矢量图层严格对齐）
    └── tiles/white-models/
        ├── tileset.json              # 3D Tiles 1.1，root.transform = ENU→ECEF（列主序）
        └── white-models.glb          # glTF 2.0 白模（Y-up：x=east, y=up, z=-north）

三种输入模式（产物完全一致）：
    A. 已有预处理的 bbox 内 GeoJSON（最快，秒级）
       python3 tools/build-city-data.py --input /tmp/cbd-data/osm-filtered.geojson
    B. 从 BBBike 原始 .osm.gz 解析（可复现全流程，约 1~2 分钟）
       python3 tools/build-city-data.py --osm-gz /tmp/Beijing.osm.gz
    C. 自动下载 48MB extract 再解析（首次需要网络）
       python3 tools/build-city-data.py --download

校验（不需要重新生成数据）：
    python3 tools/build-city-data.py --verify-only
    node tools/verify-glb.mjs

依赖：Python 3.10+ 标准库；Pillow 仅用于生成 basemap（缺失时自动跳过并给出警告）。
本脚本不依赖 Cesium / Node / 第三方 GIS 库，所有坐标转换（WGS84 → ECEF → ENU）自行实现。

坐标系与精度声明见 tools/README.md。
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import struct
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET
from array import array
from datetime import datetime, timezone, timedelta
from pathlib import Path

# --------------------------------------------------------------------------- #
# 0. 全局常量（与 task-1 规格一致，改这里即可调参）
# --------------------------------------------------------------------------- #

TOOL_NAME = "cbd-digital-twin/tools/build-city-data.py"
GENERATOR = "cbd-digital-twin build-city-data.py"

#: 数据范围（WGS84 经纬度，lon/lat）：west, south, east, north
BBOX = (116.430, 39.885, 116.495, 39.930)
#: 核心区（CBD 核心，用于 fallback 建筑面） west, south, east, north
CORE_BBOX = (116.448, 39.900, 116.478, 39.918)
#: 白模 ENU 原点（经度, 纬度, 椭球高）
ORIGIN = (116.4610, 39.9080, 0.0)

#: BBBike 北京 extract（每日更新；数据本身以文件头时间戳为准）
BBBike_URL = "https://download.bbbike.org/osm/bbbike/Beijing/Beijing.osm.gz"
EXTRACT_LABEL = "BBBike Beijing extract"

#: 需要排除的地标（避免与 Lead 的程序化地标模型重叠），半径 80m
LANDMARKS = [
    {"name": "中国尊 (CITIC Tower)", "lon": 116.46014, "lat": 39.91157, "radiusM": 80},
    {"name": "国贸三期A (China World Tower A)", "lon": 116.45230, "lat": 39.91092, "radiusM": 80},
    {"name": "国贸三期B (China World Tower B)", "lon": 116.45451, "lat": 39.91157, "radiusM": 80},
    {"name": "央视总部 (CCTV HQ)", "lon": 116.4647, "lat": 39.9147, "radiusM": 80},
]

#: 白模高度模型
LEVEL_HEIGHT_M = 3.2      # 每层高度
GROUND_EXTRA_M = 1.2      # 底层/女儿墙附加
MIN_FOOTPRINT_AREA_M2 = 15.0   # 小于该面积的杂项面丢弃
ROOF_MAX_HEIGHT_M = 2.0        # building=roof 且无 height 时的丢弃阈值

#: 按类型的高度默认值（米）。单值 = 固定；[lo, hi] = 用 building id 哈希确定性取值
DEFAULT_HEIGHTS = {
    "office": [24.0, 40.0],
    "commercial": [24.0, 40.0],
    "retail": 14.0,
    "apartments": [18.0, 22.0],
    "residential": [18.0, 22.0],
    "dormitory": [16.0, 24.0],
    "hotel": [28.0, 40.0],
    "yes": [10.8, 13.2],
    "house": 8.0,
    "detached": 9.0,
    "terrace": 10.0,
    "shed": 4.0,
    "hut": 3.0,
    "kiosk": 3.0,
    "garage": 8.0,
    "garages": 8.0,
    "parking": 8.0,
    "roof": 4.0,
    "school": 12.0,
    "university": 16.0,
    "college": 16.0,
    "kindergarten": 8.0,
    "hospital": 25.0,
    "clinic": 12.0,
    "government": 18.0,
    "public": 16.0,
    "civic": 16.0,
    "museum": 18.0,
    "library": 16.0,
    "church": 15.0,
    "temple": 12.0,
    "mosque": 14.0,
    "industrial": 10.0,
    "warehouse": 9.0,
    "factory": 11.0,
    "service": 5.0,
    "train_station": 15.0,
    "transportation": 12.0,
    "construction": 8.0,
}

#: 道路：保留可通车等级（含 _link），其余（footway/steps/cycleway/path/service…）丢弃
DRIVABLE_CLASSES = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "unclassified", "living_street",
)
DRIVABLE_LINK_CLASSES = tuple(c + "_link" for c in (
    "motorway", "trunk", "primary", "secondary", "tertiary",
))
ROAD_SIMPLIFY_TOL_M = 0.5   # RDP 容差（米）

#: 铁路/地铁线（LineString）
RAIL_KINDS = {"rail", "subway", "light_rail", "tram", "narrow_gauge", "monorail", "funicular"}

#: 兜底建筑面上限
FALLBACK_MAX = 700

#: 白模视觉（近白偏冷灰，按高度分三档）
TIER_COLORS = (
    (0.830, 0.860, 0.900),   # < 24 m   低层
    (0.872, 0.898, 0.938),   # 24~80 m  中层
    (0.905, 0.925, 0.962),   # >= 80 m  高层
)
TIER_LIMITS = (24.0, 80.0)
BASE_DARKEN = 0.88   # 墙底相对墙顶的明度系数（竖向渐变，增加体积感）
ROOF_GAIN = 1.02

#: glTF 材质（暗色数字孪生场景里偏哑光、带一点冷色自发光）
WHITE_MODEL_MATERIAL = {
    "name": "white-model",
    "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
        "metallicFactor": 0.05,
        "roughnessFactor": 0.72,
    },
    "emissiveFactor": [0.020, 0.026, 0.045],
    # 双面渲染：即使个别面片绕序有误也不会“消失”，白模无室内代价可忽略
    "doubleSided": True,
}

#: basemap 调色板
BASEMAP_COLORS = {
    "bg": (5, 8, 14),
    "block": {
        "residential": (11, 20, 32), "commercial": (14, 27, 43), "retail": (13, 25, 41),
        "industrial": (10, 20, 33), "construction": (12, 22, 35), "railway": (9, 16, 25),
        "religious": (12, 23, 34), "cemetery": (10, 22, 28), "greenfield": (10, 22, 32),
        "default": (11, 20, 32),
    },
    "park": {
        "wood": (9, 27, 18), "grass": (13, 35, 23), "forest": (9, 26, 17),
        "park": (14, 37, 24), "garden": (13, 34, 22), "pitch": (12, 30, 21),
        "stadium": (12, 30, 21), "track": (12, 30, 21), "meadow": (13, 34, 23),
        "flowerbed": (14, 34, 23), "cemetery": (10, 22, 28),
        "default": (12, 32, 22),
    },
    "water": (10, 39, 64),
    "water_default": (10, 39, 64),
    "building": (20, 29, 39),
    "road": {
        "motorway": (59, 101, 124), "trunk": (59, 101, 124), "primary": (59, 101, 124),
        "motorway_link": (59, 101, 124), "trunk_link": (59, 101, 124), "primary_link": (59, 101, 124),
        "secondary": (39, 70, 90), "tertiary": (39, 70, 90),
        "secondary_link": (39, 70, 90), "tertiary_link": (39, 70, 90),
        "residential": (26, 41, 56), "unclassified": (26, 41, 56), "living_street": (26, 41, 56),
    },
}
BASEMAP_ROAD_WIDTH = {
    "motorway": 8, "trunk": 7, "primary": 6, "motorway_link": 5, "trunk_link": 5,
    "primary_link": 5, "secondary": 5, "tertiary": 4,
    "secondary_link": 4, "tertiary_link": 4,
    "residential": 3, "unclassified": 3, "living_street": 3,
}
BASEMAP_WIDTH = 2560
BASEMAP_MAX_BYTES = 1_500_000
BASEMAP_JPEG_QUALITY = 82
BASEMAP_SUPERSAMPLE = 2

#: WGS84
WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)


# --------------------------------------------------------------------------- #
# 1. 小工具
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[build-city-data] {msg}", flush=True)


def die(msg: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"[build-city-data] ERROR: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / 1024 / 1024:.2f} MB"


def write_json(path: Path, obj, *, compact: bool = False) -> int:
    """写出 JSON（UTF-8），返回字节数；compact=True 时用最小分隔符。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=2)
    data = (text + "\n").encode("utf-8")
    path.write_bytes(data)
    return len(data)


def hash_unit(*parts) -> float:
    """确定性哈希 → [0, 1)，用于无随机种子的可复现“随机”微调。"""
    h = hashlib.md5("|".join(str(p) for p in parts).encode("utf-8")).digest()
    return int.from_bytes(h[:8], "big") / float(1 << 64)


def utc_now_iso() -> str:
    """带 +08:00 时区的 ISO 时间（数据面向北京，方便人工阅读）。"""
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).replace(microsecond=0).isoformat()


# --------------------------------------------------------------------------- #
# 2. WGS84 坐标转换：geodetic → ECEF → ENU（不依赖 Cesium）
# --------------------------------------------------------------------------- #

def geodetic_to_ecef(lon_deg: float, lat_deg: float, h: float = 0.0):
    """WGS84 大地坐标 (lon, lat, h) → ECEF (x, y, z)，单位米。"""
    lon = math.radians(lon_deg)
    lat = math.radians(lat_deg)
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    x = (n + h) * cos_lat * math.cos(lon)
    y = (n + h) * cos_lat * math.sin(lon)
    z = (n * (1.0 - WGS84_E2) + h) * sin_lat
    return (x, y, z)


def ecef_to_geodetic(x: float, y: float, z: float):
    """ECEF → WGS84 (lon, lat, h)；Bowring 近似 + 一次牛顿迭代，亚毫米级。"""
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    if p < 1e-9:
        return (math.degrees(lon), math.copysign(90.0, z), abs(z) - WGS84_A)
    b = WGS84_A * (1.0 - WGS84_F)
    ep2 = (WGS84_A ** 2 - b ** 2) / (b ** 2)
    theta = math.atan2(z * WGS84_A, p * b)
    sin_t, cos_t = math.sin(theta), math.cos(theta)
    lat = math.atan2(
        z + ep2 * b * sin_t ** 3,
        p - WGS84_E2 * WGS84_A * cos_t ** 3,
    )
    sin_lat = math.sin(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    h = p / math.cos(lat) - n
    return (math.degrees(lon), math.degrees(lat), h)


class LocalFrame:
    """以 ORIGIN 为原点的东-北-天(ENU) 局部坐标框架。

    与 Cesium 的 `Transforms.eastNorthUpToFixedFrame(origin)` 完全一致：
    tile 坐标 (x=east, y=north, z=up)，单位米。
    """

    def __init__(self, lon: float, lat: float, height: float = 0.0):
        self.lon = lon
        self.lat = lat
        self.height = height
        lon_r = math.radians(lon)
        lat_r = math.radians(lat)
        sin_lon, cos_lon = math.sin(lon_r), math.cos(lon_r)
        sin_lat, cos_lat = math.sin(lat_r), math.cos(lat_r)
        self.east = (-sin_lon, cos_lon, 0.0)
        self.north = (-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat)
        self.up = (cos_lat * cos_lon, cos_lat * sin_lon, sin_lat)
        self.origin_ecef = geodetic_to_ecef(lon, lat, height)

    def enu(self, lon: float, lat: float, h: float = 0.0):
        """(lon, lat, h) → (east, north, up)，米。"""
        x, y, z = geodetic_to_ecef(lon, lat, h)
        ox, oy, oz = self.origin_ecef
        dx, dy, dz = x - ox, y - oy, z - oz
        e = dx * self.east[0] + dy * self.east[1] + dz * self.east[2]
        n = dx * self.north[0] + dy * self.north[1] + dz * self.north[2]
        u = dx * self.up[0] + dy * self.up[1] + dz * self.up[2]
        return (e, n, u)

    def enu_xy(self, lon: float, lat: float):
        e, n, _ = self.enu(lon, lat, 0.0)
        return (e, n)

    def transform_matrix(self) -> list:
        """ENU→ECEF 4x4 矩阵，**列主序** 16 个数（3D Tiles root.transform 用）。"""
        e, n, u, o = self.east, self.north, self.up, self.origin_ecef
        return [
            e[0], e[1], e[2], 0.0,
            n[0], n[1], n[2], 0.0,
            u[0], u[1], u[2], 0.0,
            o[0], o[1], o[2], 1.0,
        ]

    def matrix_to_ecef(self, tile_xyz) -> tuple:
        """用 transform 矩阵把 tile 坐标变换到 ECEF（用于自检，验证矩阵正确）。"""
        m = self.transform_matrix()
        x, y, z = tile_xyz
        return (
            m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14],
        )


# --------------------------------------------------------------------------- #
# 3. 平面几何：环清理 / 面积 / 耳切三角化 / RDP / 裁剪
# --------------------------------------------------------------------------- #

def signed_area_2d(pts) -> float:
    """有向面积（x=east, y=north 右手系下 >0 表示逆时针 CCW）。"""
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s * 0.5


def polygon_area_m2(enu_pts) -> float:
    return abs(signed_area_2d(enu_pts))


def clean_ring(coords, *, close: bool = True):
    """清理 GeoJSON 环：去闭合重复点、去连续重复点、去共线冗余点。

    返回 (coords_clean, enu_pts, ring_closed) —— 后两者在 triangulate 中按需重建。
    这里只做「经纬度层面的拓扑清理」，不改变形状。
    """
    out = []
    for p in coords:
        if not p or len(p) < 2:
            continue
        lon, lat = float(p[0]), float(p[1])
        if not (math.isfinite(lon) and math.isfinite(lat)):
            continue
        out.append((lon, lat))
    # 去掉闭合重复点
    if len(out) > 1 and out[0] == out[-1]:
        out = out[:-1]
    # 去掉连续重复点
    dedup = []
    for p in out:
        if not dedup or (abs(p[0] - dedup[-1][0]) > 1e-12 or abs(p[1] - dedup[-1][1]) > 1e-12):
            dedup.append(p)
    if len(dedup) > 1 and dedup[0] == dedup[-1]:
        dedup = dedup[:-1]
    # 去掉共线冗余点（三点近似共线且中间点不是尖刺）
    if len(dedup) > 3:
        changed = True
        guard = 0
        while changed and guard < 8:
            guard += 1
            changed = False
            new = []
            m = len(dedup)
            for i in range(m):
                prev = dedup[(i - 1) % m]
                cur = dedup[i]
                nxt = dedup[(i + 1) % m]
                ax, ay = cur[0] - prev[0], cur[1] - prev[1]
                bx, by = nxt[0] - cur[0], nxt[1] - cur[1]
                cross = ax * by - ay * bx
                dot = ax * bx + ay * by
                # 经纬度尺度：1e-7 deg ≈ 1cm，cross 用度² 判断，阈值极小
                if abs(cross) < 1e-13 and dot > 0:
                    changed = True
                    continue
                new.append(cur)
            if len(new) >= 3:
                dedup = new
            else:
                break
    return dedup


def point_in_triangle(p, a, b, c, eps: float = 0.0) -> bool:
    """p 是否在三角形 abc 内（含边界，eps 容差）。"""
    px, py = p
    ax, ay = a
    bx, by = b
    cx, cy = c

    def cross(ux, uy, vx, vy):
        return ux * vy - uy * vx

    d1 = cross(bx - ax, by - ay, px - ax, py - ay)
    d2 = cross(cx - bx, cy - by, px - bx, py - by)
    d3 = cross(ax - cx, ay - cy, px - cx, py - cy)
    has_neg = (d1 < -eps) or (d2 < -eps) or (d3 < -eps)
    has_pos = (d1 > eps) or (d2 > eps) or (d3 > eps)
    return not (has_neg and has_pos)


def triangulate_earclip(pts, *, max_guard_factor: int = 64):
    """简单多边形的耳切法三角化（不含洞）。

    :param pts: [(x, y), ...]，表示一个简单多边形环（函数内部会规范化 CCW、去重）
    :return: (pts_clean, triangles) —— triangles 为索引三元组，顺序为 CCW（右手系下法线 +z）
    """
    n = len(pts)
    if n < 3:
        return [], []
    if n == 3:
        tri = [(0, 1, 2)]
        if signed_area_2d(pts) < 0:
            tri = [(0, 2, 1)]
        return list(pts), tri
    if signed_area_2d(pts) < 0:
        pts = list(reversed(pts))
    n = len(pts)
    idx = list(range(n))
    tris = []
    guard = 0
    max_guard = max(256, n * n * max_guard_factor // 8)
    while len(idx) > 3 and guard < max_guard:
        guard += 1
        m = len(idx)
        clipped = False
        for k in range(m):
            i0 = idx[(k - 1) % m]
            i1 = idx[k]
            i2 = idx[(k + 1) % m]
            a = pts[i0]
            b = pts[i1]
            c = pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-9:      # 凹点或退化 → 不是耳
                continue
            ok = True
            for j in idx:
                if j == i0 or j == i1 or j == i2:
                    continue
                if point_in_triangle(pts[j], a, b, c, eps=1e-12):
                    ok = False
                    break
            if not ok:
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            clipped = True
            break
        if not clipped:
            # 退化/自交：删掉一个面积≈0 的顶点继续
            removed = False
            m = len(idx)
            for k in range(m):
                i0 = idx[(k - 1) % m]
                i1 = idx[k]
                i2 = idx[(k + 1) % m]
                a, b, c = pts[i0], pts[i1], pts[i2]
                cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
                if abs(cross) <= 1e-9:
                    idx.pop(k)
                    removed = True
                    break
            if not removed:
                break
    remaining = idx
    if len(remaining) >= 3:
        # 兜底：以首点扇形三角化（对残余凸多边形有效；自交时几何可能有瑕疵但不会崩）
        i0 = remaining[0]
        for q in range(1, len(remaining) - 1):
            i1 = remaining[q]
            i2 = remaining[q + 1]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if abs(cross) > 1e-9:
                if cross > 0:
                    tris.append((i0, i1, i2))
                else:
                    tris.append((i0, i2, i1))
    return pts, tris


def simplify_rdp_indices(pts, tol: float):
    """RDP 抽稀（迭代栈实现，避免深递归爆栈），返回保留点的索引列表。"""
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
        seg_len2 = dx * dx + dy * dy
        best_d = -1.0
        best_k = -1
        if seg_len2 <= 1e-18:
            for k in range(i + 1, j):
                px, py = pts[k]
                d2 = (px - ax) ** 2 + (py - ay) ** 2
                if d2 > best_d:
                    best_d, best_k = d2, k
        else:
            for k in range(i + 1, j):
                px, py = pts[k]
                t = ((px - ax) * dx + (py - ay) * dy) / seg_len2
                if t < 0.0:
                    cx, cy = ax, ay
                elif t > 1.0:
                    cx, cy = bx, by
                else:
                    cx, cy = ax + t * dx, ay + t * dy
                d2 = (px - cx) ** 2 + (py - cy) ** 2
                if d2 > best_d:
                    best_d, best_k = d2, k
        if best_k > 0 and best_d > tol2:
            keep[best_k] = True
            stack.append((i, best_k))
            stack.append((best_k, j))
    return [i for i in range(n) if keep[i]]


def _clip_segment_lb(p0, p1, bbox):
    """Liang–Barsky 线段裁剪到 bbox(w,s,e,n)。返回 (q0, q1) 或 None。"""
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
            if r > t0:
                t0 = r
        else:
            if r < t0:
                return None
            if r < t1:
                t1 = r
    return ((x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy))


def clip_line_to_bbox(coords, bbox):
    """折线裁剪，返回若干段坐标数组（每段 >= 2 点）。"""
    if len(coords) < 2:
        return []
    out = []
    cur = []
    for i in range(len(coords) - 1):
        seg = _clip_segment_lb(coords[i], coords[i + 1], bbox)
        if seg is None:
            if len(cur) >= 2:
                out.append(cur)
            cur = []
            continue
        a, b = seg
        if not cur:
            cur = [a, b]
        else:
            if cur[-1] != a:
                if len(cur) >= 2:
                    out.append(cur)
                cur = [a, b]
            else:
                cur.append(b)
    if len(cur) >= 2:
        out.append(cur)
    return out


def clip_polygon_sutherland_hodgman(ring, bbox):
    """Sutherland–Hodgman 多边形裁剪到 bbox。ring 为 (lon, lat) 列表（不闭合亦可）。"""
    w, s, e, n = bbox
    out = list(ring)
    if len(out) < 3:
        return []

    def clip_edge(poly, inside, intersect):
        if not poly:
            return []
        res = []
        prev = poly[-1]
        prev_in = inside(prev)
        for cur in poly:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    res.append(intersect(prev, cur))
                res.append(cur)
            elif prev_in:
                res.append(intersect(prev, cur))
            prev, prev_in = cur, cur_in
        return res

    def ix_west(a, b):
        t = (w - a[0]) / (b[0] - a[0])
        return (w, a[1] + t * (b[1] - a[1]))

    def ix_east(a, b):
        t = (e - a[0]) / (b[0] - a[0])
        return (e, a[1] + t * (b[1] - a[1]))

    def ix_south(a, b):
        t = (s - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), s)

    def ix_north(a, b):
        t = (n - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), n)

    for inside, intersect in (
        (lambda p: p[0] >= w, ix_west),
        (lambda p: p[0] <= e, ix_east),
        (lambda p: p[1] >= s, ix_south),
        (lambda p: p[1] <= n, ix_north),
    ):
        out = clip_edge(out, inside, intersect)
        if not out:
            return []
    # 去掉裁剪产生的重复点
    dedup = []
    for p in out:
        if not dedup or p != dedup[-1]:
            dedup.append(p)
    if len(dedup) >= 2 and dedup[0] == dedup[-1]:
        dedup.pop()
    return dedup if len(dedup) >= 3 else []


# --------------------------------------------------------------------------- #
# 4. 数据源：下载 / 解析 OSM.gz / 读取 GeoJSON
# --------------------------------------------------------------------------- #

OSM_INTERESTING_TAGS = ("building", "highway", "landuse", "leisure", "natural", "waterway", "railway")
OSM_POLYGON_TAGS = ("building", "landuse", "leisure", "natural", "waterway", "railway")


def download_osm(dest: Path, *, timeout: float = 300.0) -> Path:
    """从 BBBike 下载北京 extract（48MB）。已存在且体积合理时复用。"""
    if dest.exists() and dest.stat().st_size > 10 * 1024 * 1024:
        log(f"复用已下载的 extract: {dest} ({fmt_size(dest.stat().st_size)})")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    log(f"下载 {BBBike_URL}（约 48MB，超时 {timeout:.0f}s）…")
    req = urllib.request.Request(BBBike_URL, headers={"User-Agent": f"cbd-digital-twin/1.0 ({TOOL_NAME})"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(tmp, "wb") as fh:
        total = int(resp.headers.get("Content-Length") or 0)
        got = 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
            got += len(chunk)
            if total:
                pct = got * 100.0 / total
                if int(pct) % 10 == 0:
                    log(f"  … {pct:5.1f}%  {fmt_size(got)}/{fmt_size(total)}")
    tmp.replace(dest)
    log(f"下载完成：{dest} ({fmt_size(dest.stat().st_size)})，耗时 {time.time() - t0:.1f}s")
    return dest


def parse_osm_gz(osm_path: Path, bbox=BBOX, *, progress_every: int = 400_000) -> list:
    """流式解析 .osm.gz，返回 bbox 内 features（与预处理的 osm-filtered.geojson 同构）。"""
    w, s, e, n = bbox
    nodes = {}
    ways = []
    log(f"解析 {osm_path}（bbox={bbox}）…")
    t0 = time.time()
    seen = 0
    with gzip.open(osm_path, "rb") as fh:
        for _event, elem in ET.iterparse(fh, events=("end",)):
            tag = elem.tag
            if tag == "node":
                try:
                    lat = float(elem.get("lat"))
                    lon = float(elem.get("lon"))
                except (TypeError, ValueError):
                    elem.clear()
                    continue
                if s <= lat <= n and w <= lon <= e:
                    nodes[elem.get("id")] = (lon, lat)
                elem.clear()
            elif tag == "way":
                tags = {t.get("k"): t.get("v") for t in elem.findall("tag")}
                if any(k in tags for k in OSM_INTERESTING_TAGS):
                    refs = [nd.get("ref") for nd in elem.findall("nd")]
                    if refs:
                        ways.append((elem.get("id"), tags, refs))
                elem.clear()
            elif tag == "relation":
                elem.clear()
            seen += 1
            if progress_every and seen % progress_every == 0:
                log(f"  … 已扫描 {seen / 1e6:.1f}M 元素 | nodes={len(nodes)} ways={len(ways)}")
    log(f"扫描完成：nodes={len(nodes)}，候选 ways={len(ways)}，耗时 {time.time() - t0:.1f}s")

    features = []
    dropped = 0
    for wid, tags, refs in ways:
        coords = [nodes[r] for r in refs if r in nodes]
        if len(coords) < 2 or len(coords) != len(refs):
            dropped += 1
            continue
        closed = len(coords) >= 4 and coords[0] == coords[-1]
        if closed and any(k in tags for k in OSM_POLYGON_TAGS):
            geom = {"type": "Polygon", "coordinates": [coords]}
        else:
            geom = {"type": "LineString", "coordinates": coords}
        features.append({"type": "Feature", "id": "way/" + wid, "properties": tags, "geometry": geom})
    log(f"构造 features={len(features)}（丢弃跨 bbox 边界 way {dropped} 条），耗时 {time.time() - t0:.1f}s")
    return features


def load_geojson(path: Path) -> list:
    log(f"读取 {path} ({fmt_size(path.stat().st_size)})…")
    with open(path, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    feats = doc.get("features") if isinstance(doc, dict) else doc
    if not isinstance(feats, list):
        die(f"{path} 不是合法的 GeoJSON FeatureCollection")
    out = []
    for f in feats:
        if not isinstance(f, dict) or not f.get("geometry"):
            continue
        out.append(f)
    log(f"读取 features={len(out)}")
    return out


# --------------------------------------------------------------------------- #
# 5. 高度模型
# --------------------------------------------------------------------------- #

_HEIGHT_RE = re.compile(r"^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metre|meters|metres|米)?\s*$", re.I)


def parse_length_m(value):
    """把 OSM 长度字符串解析为米；支持 '35'、'35 m'、'35.5米'、'120,5'。"""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    m = _HEIGHT_RE.match(text)
    if not m:
        return None
    try:
        v = float(m.group(1).replace(",", "."))
    except ValueError:
        return None
    if not math.isfinite(v) or v <= 0:
        return None
    return v


def parse_levels(value):
    if value is None:
        return None
    text = str(value).strip()
    m = re.match(r"^([0-9]+(?:\.[0-9]+)?)", text)
    if not m:
        return None
    try:
        v = float(m.group(1))
    except ValueError:
        return None
    if not math.isfinite(v) or v <= 0:
        return None
    return v


def default_height_for(building_type: str, oid: str):
    spec = DEFAULT_HEIGHTS.get(building_type)
    if spec is None:
        spec = DEFAULT_HEIGHTS["yes"]
    if isinstance(spec, (int, float)):
        return float(spec)
    lo, hi = spec
    return lo + (hi - lo) * hash_unit("height", oid)


def estimate_height(props: dict, oid: str):
    """返回 (height_m, source)；source ∈ {height, levels, default:<type>}。"""
    h = parse_length_m(props.get("height"))
    if h is not None and 2.0 <= h <= 800.0:
        return h, "height"
    lv = parse_levels(props.get("building:levels"))
    if lv is not None and 1.0 <= lv <= 200.0:
        return min(lv * LEVEL_HEIGHT_M + GROUND_EXTRA_M, 700.0), "levels"
    btype = (props.get("building") or "yes").strip().lower()
    if ":" in btype:
        btype = btype.split(":", 1)[0]
    return default_height_for(btype, oid), "default:" + btype


def building_kind(props: dict) -> str:
    b = (props.get("building") or "yes").strip().lower()
    if ":" in b and b.startswith("building"):
        b = "yes"
    return b


# --------------------------------------------------------------------------- #
# 6. 要素分类
# --------------------------------------------------------------------------- #

def is_building(f) -> bool:
    props = f.get("properties") or {}
    return "building" in props and (f.get("geometry") or {}).get("type") == "Polygon"


def is_road(f) -> bool:
    props = f.get("properties") or {}
    return "highway" in props and (f.get("geometry") or {}).get("type") == "LineString"


def road_class(props: dict):
    cls = (props.get("highway") or "").strip()
    if cls in DRIVABLE_CLASSES or cls in DRIVABLE_LINK_CLASSES:
        return cls
    return None


def classify_area(props: dict):
    """面状要素分类 → (kind, class) 或 None。kind ∈ {water, park, block}。"""
    lu = (props.get("landuse") or "").strip().lower()
    le = (props.get("leisure") or "").strip().lower()
    nat = (props.get("natural") or "").strip().lower()
    ww = (props.get("waterway") or "").strip().lower()

    if nat == "water" or ww in ("riverbank", "dock", "canal") or le == "swimming_pool" or lu in ("basin", "reservoir", "salt_pond"):
        return ("water", nat or ww or le or lu or "water")
    if nat in ("wood", "scrub", "grassland", "heath", "tree_row"):
        return ("park", nat)
    if le in ("park", "garden", "common", "pitch", "stadium", "track", "playground",
              "recreation_ground", "golf_course", "nature_reserve", "fitness_station"):
        return ("park", le)
    if lu in ("grass", "forest", "meadow", "flowerbed", "plant_nursery", "orchard",
              "village_green", "recreation_ground", "cemetery", "allotments"):
        return ("park", lu)
    if lu:
        return ("block", lu)
    if le:
        return ("block", le)
    return None


# --------------------------------------------------------------------------- #
# 7. 图层构建
# --------------------------------------------------------------------------- #

def _round_coords(coords, ndigits: int = 7):
    return [[round(float(c[0]), ndigits), round(float(c[1]), ndigits)] for c in coords]


def build_roads(features, bbox=BBOX):
    """可通车道路：过滤等级 → 裁剪 bbox → RDP(0.5m) → 属性精简。"""
    lat_ref = (bbox[1] + bbox[3]) * 0.5
    kx = 111320.0 * math.cos(math.radians(lat_ref))
    ky = 111320.0
    out = []
    stats = {"candidates": 0, "kept": 0, "clippedAway": 0, "simplified": 0, "pointsBefore": 0, "pointsAfter": 0}
    for f in features:
        if not is_road(f):
            continue
        props = f.get("properties") or {}
        cls = road_class(props)
        if not cls:
            continue
        stats["candidates"] += 1
        coords = f["geometry"]["coordinates"]
        if len(coords) < 2:
            continue
        segments = clip_line_to_bbox(coords, bbox)
        if not segments:
            stats["clippedAway"] += 1
            continue
        # 折线被 bbox 切成多段时拆成多个 feature（同一 OSM id 加后缀）
        for si, seg in enumerate(segments):
            stats["pointsBefore"] += len(seg)
            pts_planar = [(p[0] * kx, p[1] * ky) for p in seg]
            keep_idx = simplify_rdp_indices(pts_planar, ROAD_SIMPLIFY_TOL_M)
            if len(keep_idx) < 2:
                keep_idx = [0, len(seg) - 1]
            stats["pointsAfter"] += len(keep_idx)
            if len(keep_idx) < len(seg):
                stats["simplified"] += 1
            coords_out = _round_coords([seg[i] for i in keep_idx])
            oid = f.get("id") or f"road/{len(out)}"
            if len(segments) > 1:
                oid = f"{oid}#{si}"
            prop = {"id": oid, "class": cls}
            name = (props.get("name") or "").strip()
            if name:
                prop["name"] = name
            ref = (props.get("ref") or "").strip()
            if ref:
                prop["ref"] = ref
            oneway = (props.get("oneway") or "").strip().lower()
            if oneway in ("yes", "true", "1"):
                prop["oneway"] = "yes"
            elif oneway in ("-1", "reverse"):
                prop["oneway"] = "-1"
            lanes = parse_levels(props.get("lanes"))
            if lanes is not None:
                prop["lanes"] = int(lanes)
            # 统一输出 OSM tag 风格的 "yes" 字符串：前端可用 String(v) === 'yes' 判断
            if (props.get("bridge") or "").strip().lower() in ("yes", "true", "1", "viaduct"):
                prop["bridge"] = "yes"
            if (props.get("tunnel") or "").strip().lower() in ("yes", "true", "1", "culvert"):
                prop["tunnel"] = "yes"
            out.append({
                "type": "Feature",
                "id": oid,
                "properties": prop,
                "geometry": {"type": "LineString", "coordinates": coords_out},
            })
    stats["kept"] = len(out)
    return out, stats


def build_context(features, bbox=BBOX):
    """水系 / 公园绿地 / landuse 面（只留面状要素）。"""
    out = []
    stats = {"candidates": 0, "water": 0, "park": 0, "block": 0, "droppedLine": 0, "droppedOther": 0}
    for f in features:
        geom = f.get("geometry") or {}
        if geom.get("type") != "Polygon":
            if geom.get("type") in ("LineString", "MultiLineString", "Point", "MultiPoint"):
                stats["droppedLine"] += 1
            continue
        props = f.get("properties") or {}
        cls = classify_area(props)
        if not cls:
            stats["droppedOther"] += 1
            continue
        stats["candidates"] += 1
        kind, klass = cls
        ring = clean_ring(geom["coordinates"][0])
        if len(ring) < 3:
            continue
        clipped = clip_polygon_sutherland_hodgman(ring, bbox)
        if len(clipped) < 3:
            continue
        coords = _round_coords(clipped)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        prop = {"kind": kind, "class": klass}
        name = (props.get("name") or "").strip()
        if name:
            prop["name"] = name
        oid = f.get("id") or f"area/{len(out)}"
        prop["id"] = oid
        out.append({
            "type": "Feature",
            "id": oid,
            "properties": prop,
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })
        stats[kind] += 1
    stats["kept"] = len(out)
    return out, stats


def build_railways(features, bbox=BBOX):
    out = []
    for f in features:
        geom = f.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        props = f.get("properties") or {}
        kind = (props.get("railway") or "").strip().lower()
        if kind not in RAIL_KINDS:
            continue
        segments = clip_line_to_bbox(geom["coordinates"], bbox)
        for si, seg in enumerate(segments):
            if len(seg) < 2:
                continue
            oid = f.get("id") or f"rail/{len(out)}"
            if len(segments) > 1:
                oid = f"{oid}#{si}"
            prop = {"id": oid, "kind": kind}
            name = (props.get("name") or "").strip()
            if name:
                prop["name"] = name
            if (props.get("tunnel") or "").strip().lower() in ("yes", "true", "1"):
                prop["tunnel"] = True
            if (props.get("bridge") or "").strip().lower() in ("yes", "true", "1"):
                prop["bridge"] = True
            out.append({
                "type": "Feature",
                "id": oid,
                "properties": prop,
                "geometry": {"type": "LineString", "coordinates": _round_coords(seg)},
            })
    return out, {"kept": len(out)}


def make_building_record(f):
    """把 OSM building feature 转成白模/兜底共用的中间记录。"""
    props = f.get("properties") or {}
    ring = clean_ring(f["geometry"]["coordinates"][0])
    if len(ring) < 3:
        return None
    return {
        "id": f.get("id") or "",
        "props": props,
        "ring": ring,
        "kind": building_kind(props),
        "name": (props.get("name") or "").strip(),
        "levels": parse_levels(props.get("building:levels")),
    }


def building_centroid_enu(frame: LocalFrame, ring):
    pts = [frame.enu_xy(lon, lat) for lon, lat in ring]
    if not pts:
        return (0.0, 0.0)
    n = len(pts)
    # 用面积加权重心更稳（对凹多边形也成立）；退化时用顶点平均
    a = signed_area_2d(pts)
    if abs(a) < 1e-6:
        return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)
    cx = cy = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return (cx / (6.0 * a), cy / (6.0 * a))


def _landmark_distance_m(frame: LocalFrame, lm) -> callable:
    lx, ly = frame.enu_xy(lm["lon"], lm["lat"])
    radius = float(lm["radiusM"])

    def dist(cx, cy):
        return math.hypot(cx - lx, cy - ly)

    return dist


def select_white_model_buildings(features, frame: LocalFrame):
    """白模建筑筛选：面积/退化过滤 + 地标半径排除 + 高度估算。"""
    used, excluded = [], {"landmark": [], "small": 0, "degenerate": 0}
    landmark_fns = [(_landmark_distance_m(frame, lm), lm) for lm in LANDMARKS]
    for f in features:
        if not is_building(f):
            continue
        rec = make_building_record(f)
        if rec is None:
            excluded["degenerate"] += 1
            continue
        enu = [frame.enu_xy(lon, lat) for lon, lat in rec["ring"]]
        area = polygon_area_m2(enu)
        rec["enu"] = enu
        rec["area"] = area
        if area < MIN_FOOTPRINT_AREA_M2:
            excluded["small"] += 1
            continue
        cx, cy = building_centroid_enu(frame, rec["ring"])
        rec["centroid"] = (cx, cy)
        # building=roof 且没有有效 height → 丢弃（多为雨棚/连廊等杂项）
        if rec["kind"] == "roof":
            h, src = estimate_height(rec["props"], rec["id"])
            if src != "height" or h < ROOF_MAX_HEIGHT_M:
                excluded["small"] += 1
                continue
        hit = False
        for dist, lm in landmark_fns:
            if dist(cx, cy) <= lm["radiusM"]:
                excluded["landmark"].append({"id": rec["id"], "name": rec["name"], "landmark": lm["name"],
                                             "distanceM": round(dist(cx, cy), 1)})
                hit = True
                break
        if hit:
            continue
        h, src = estimate_height(rec["props"], rec["id"])
        rec["height"] = h
        rec["heightSource"] = src
        used.append(rec)
    return used, excluded


def build_fallback_buildings(buildings, frame: LocalFrame, bbox=CORE_BBOX):
    """core 内建筑面兜底（≤700），按 height * sqrt(area) 优先。"""
    w, s, e, n = bbox
    cands = []
    for rec in buildings:
        cx, cy = rec["centroid"]
        lon, lat, _ = ecef_to_geodetic(*frame.matrix_to_ecef((cx, cy, 0.0)))
        if not (w <= lon <= e and s <= lat <= n):
            continue
        score = rec["height"] * math.sqrt(max(rec["area"], 1.0))
        cands.append((score, rec))
    cands.sort(key=lambda x: -x[0])
    picked = [rec for _, rec in cands[:FALLBACK_MAX]]
    out = []
    for rec in picked:
        coords = _round_coords(rec["ring"])
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        prop = {
            "id": rec["id"],
            "height": round(rec["height"], 1),
            "kind": rec["kind"],
        }
        if rec["levels"] is not None:
            prop["levels"] = int(round(rec["levels"]))
        if rec["name"]:
            prop["name"] = rec["name"]
        prop["area"] = round(rec["area"], 1)
        out.append({
            "type": "Feature",
            "id": rec["id"],
            "properties": prop,
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })
    return out, {"candidates": len(cands), "kept": len(out), "maxScore": round(cands[-1][0], 1) if cands else 0}


# --------------------------------------------------------------------------- #
# 8. 白模几何 + GLB 写出（glTF 2.0，Y-up：x=east, y=up, z=-north）
# --------------------------------------------------------------------------- #

def build_white_model_geometry(buildings, frame: LocalFrame):
    """把 footprint 拉伸成白模网格。

    顶点布局（每个 footprint 点 3 个顶点，共 3n）：
      - 2n 个墙面顶点：底(b_i)、顶(t_i)，法线为相邻两墙外法线的归一化平均（平滑转角）
      - n  个屋顶顶点：法线 (0,0,1)
    三角化：墙面每边 2 个三角形（CCW 朝外），屋顶用耳切法（CCW → 法线 +up）。

    返回 dict：positions/normals/colors/indices 均为可直接写 glTF 的平铺数组，
    其中 positions/normals 已是 **glTF Y-up 坐标**；另外返回 tile 坐标下的 bounds。
    """
    positions = array("f")   # glTF: x=east, y=up, z=-north
    normals = array("f")
    colors = array("B")      # RGBA，normalized ubyte
    indices = array("I")
    tile_min = [math.inf, math.inf, math.inf]
    tile_max = [-math.inf, -math.inf, -math.inf]
    degenerate = 0
    triangle_count = 0

    def add_vertex(east, north, up, n_east, n_north, n_up, rgb):
        """写入一个顶点：tile(east, north, up) → glTF(x=east, y=up, z=-north)。"""
        positions.extend((east, up, -north))
        normals.extend((n_east, n_up, -n_north))
        colors.extend((rgb[0], rgb[1], rgb[2], 255))
        if east < tile_min[0]: tile_min[0] = east
        if north < tile_min[1]: tile_min[1] = north
        if up < tile_min[2]: tile_min[2] = up
        if east > tile_max[0]: tile_max[0] = east
        if north > tile_max[1]: tile_max[1] = north
        if up > tile_max[2]: tile_max[2] = up

    for rec in buildings:
        enu = rec["enu"]
        n = len(enu)
        if n < 3:
            continue
        # OSM 环的绕向不保证；墙体外法线依赖 CCW 假设，这里统一规范化为 CCW
        enu = list(reversed(enu)) if signed_area_2d(enu) < 0 else list(enu)
        n = len(enu)
        h = rec["height"]
        # -- 颜色：按高度分档 + building id 哈希微调 + 竖向明度渐变 --
        tier_idx = 0 if h < TIER_LIMITS[0] else (1 if h < TIER_LIMITS[1] else 2)
        base = list(TIER_COLORS[tier_idx])
        jitter = (hash_unit("color", rec["id"]) - 0.5) * 0.055
        # 冷色偏置：蓝通道略提，红通道略降
        base[0] = max(0.0, min(1.0, base[0] + jitter - 0.006))
        base[1] = max(0.0, min(1.0, base[1] + jitter))
        base[2] = max(0.0, min(1.0, base[2] + jitter + 0.008))
        col_top = tuple(int(round(c * 255)) for c in base)
        col_bot = tuple(int(round(min(1.0, c * BASE_DARKEN) * 255)) for c in base)
        col_roof = tuple(int(round(min(1.0, c * ROOF_GAIN) * 255)) for c in base)

        # -- 每个边的外法线 --
        edge_normals = []
        for i in range(n):
            x1, y1 = enu[i]
            x2, y2 = enu[(i + 1) % n]
            dx, dy = x2 - x1, y2 - y1
            length = math.hypot(dx, dy)
            if length < 1e-9:
                edge_normals.append((0.0, 0.0))
                continue
            # CCW 环下 (dy, -dx) 指向外侧
            edge_normals.append((dy / length, -dx / length))

        base_vertex = len(positions) // 3
        # 墙面顶点：先写 2n 个（b_i, t_i）
        for i in range(n):
            x, y = enu[i]
            ex_prev, ey_prev = edge_normals[(i - 1) % n]
            ex_cur, ey_cur = edge_normals[i]
            nx, ny = ex_prev + ex_cur, ey_prev + ey_cur
            nl = math.hypot(nx, ny)
            if nl < 1e-9:
                nx, ny = ex_cur, ey_cur
            else:
                nx, ny = nx / nl, ny / nl
            add_vertex(x, y, 0.0, nx, ny, 0.0, col_bot)      # b_i = base+2i
            add_vertex(x, y, h, nx, ny, 0.0, col_top)        # t_i = base+2i+1

        # 墙面三角形：边 i 的四边形 (b_i, b_{i+1}, t_{i+1}, t_i)，外法线朝外
        for i in range(n):
            j = (i + 1) % n
            b_i = base_vertex + 2 * i
            t_i = b_i + 1
            b_j = base_vertex + 2 * j
            t_j = b_j + 1
            tri1 = (b_i, b_j, t_j)
            tri2 = (b_i, t_j, t_i)
            # 剔除退化三角形（相邻点重合时可能出现）
            p0 = (enu[i][0], enu[i][1], 0.0)
            p1 = (enu[j][0], enu[j][1], 0.0)
            p2 = (enu[j][0], enu[j][1], h)
            p3 = (enu[i][0], enu[i][1], h)
            if _tri_area3(p0, p1, p2) > 1e-7:
                indices.extend(tri1)
                triangle_count += 1
            if _tri_area3(p0, p2, p3) > 1e-7:
                indices.extend(tri2)
                triangle_count += 1

        # 屋顶：n 个顶点 + 耳切三角化
        roof_base = len(positions) // 3
        for i in range(n):
            x, y = enu[i]
            add_vertex(x, y, h, 0.0, 0.0, 1.0, col_roof)
        pts_clean, tris = triangulate_earclip(list(enu))
        if pts_clean and len(pts_clean) != n:
            # 清理后点集变了会错位；此处 enu 已足够干净，正常情况下不会发生
            degenerate += 1
        for (a, b, c) in tris:
            if a >= n or b >= n or c >= n:
                continue
            pa = (enu[a][0], enu[a][1], h)
            pb = (enu[b][0], enu[b][1], h)
            pc = (enu[c][0], enu[c][1], h)
            if _tri_area3(pa, pb, pc) > 1e-7:
                indices.extend((roof_base + a, roof_base + b, roof_base + c))
                triangle_count += 1

    bounds = {
        "min": [tile_min[0], tile_min[1], tile_min[2]],
        "max": [tile_max[0], tile_max[1], tile_max[2]],
    }
    return {
        "positions": positions,
        "normals": normals,
        "colors": colors,
        "indices": indices,
        "vertexCount": len(positions) // 3,
        "triangleCount": triangle_count,
        "bounds": bounds,
        "degenerateLevels": degenerate,
    }


def _tri_area3(p0, p1, p2) -> float:
    ux, uy, uz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    vx, vy, vz = p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]
    cx = uy * vz - uz * vy
    cy = uz * vx - ux * vz
    cz = ux * vy - uy * vx
    return 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)


def _pad4(n: int, align: int = 4) -> int:
    return (-n) % align


def write_glb(path: Path, geom, material, *, name: str = "white-models") -> dict:
    """写出 glTF 2.0 binary（.glb），返回诊断信息。"""
    positions = geom["positions"]
    normals = geom["normals"]
    colors = geom["colors"]
    indices = geom["indices"]
    vertex_count = geom["vertexCount"]
    if len(normals) != len(positions):
        die("NORMAL 数量与 POSITION 不一致")
    if len(colors) != vertex_count * 4:
        die("COLOR_0 数量与顶点数不一致")
    if len(indices) % 3 != 0:
        die("索引数量不是 3 的倍数")

    def to_bytes(arr) -> bytes:
        if sys.byteorder == "big":
            arr = array(arr.typecode, arr)
            arr.byteswap()
        return arr.tobytes()

    pos_bytes = to_bytes(positions)
    nrm_bytes = to_bytes(normals)
    col_bytes = colors.tobytes()
    idx_bytes = to_bytes(indices)

    # POSITION 的 min/max 必须覆盖实际存储的 float32 值
    pos_min = [math.inf, math.inf, math.inf]
    pos_max = [-math.inf, -math.inf, -math.inf]
    for i in range(0, len(positions), 3):
        for k in range(3):
            v = positions[i + k]
            if v < pos_min[k]:
                pos_min[k] = v
            if v > pos_max[k]:
                pos_max[k] = v

    buffer_views = []
    blobs = []
    offset = 0

    def add_view(data: bytes, target: int):
        nonlocal offset
        aligned = offset + _pad4(offset)
        if aligned != offset:
            blobs.append(b"\x00" * (aligned - offset))
            offset = aligned
        buffer_views.append({
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(data),
            "target": target,
        })
        blobs.append(data)
        offset += len(data)
        return len(buffer_views) - 1

    bv_pos = add_view(pos_bytes, 34962)
    bv_nrm = add_view(nrm_bytes, 34962)
    bv_col = add_view(col_bytes, 34962)
    bv_idx = add_view(idx_bytes, 34963)
    bin_data = b"".join(blobs)
    assert len(bin_data) == offset

    accessors = [
        {
            "bufferView": bv_pos,
            "componentType": 5126,
            "count": vertex_count,
            "type": "VEC3",
            "min": [round(v, 6) for v in pos_min],
            "max": [round(v, 6) for v in pos_max],
        },
        {
            "bufferView": bv_nrm,
            "componentType": 5126,
            "count": vertex_count,
            "type": "VEC3",
        },
        {
            "bufferView": bv_col,
            "componentType": 5121,
            "normalized": True,
            "count": vertex_count,
            "type": "VEC4",
        },
        {
            "bufferView": bv_idx,
            "componentType": 5125,
            "count": len(indices),
            "type": "SCALAR",
        },
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": GENERATOR},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                "indices": 3,
                "material": 0,
                "mode": 4,
            }],
        }],
        "materials": [material],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    gltf["extras"] = {
        "generator": GENERATOR,
        "vertexCount": vertex_count,
        "triangleCount": len(indices) // 3,
        "upAxis": "Y (x=east, y=up, z=-north)",
    }

    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_pad = _pad4(len(json_bytes))
    json_chunk = json_bytes + b" " * json_pad
    bin_pad = _pad4(len(bin_data))
    bin_chunk = bin_data + b"\x00" * bin_pad
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<III", 0x46546C67, 2, total_length)   # magic 'glTF', version 2
    chunk_json = struct.pack("<II", len(json_chunk), 0x4E4F534A)  # 'JSON'
    chunk_bin = struct.pack("<II", len(bin_chunk), 0x004E4942)    # 'BIN\0'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + chunk_json + json_chunk + chunk_bin + bin_chunk)
    return {
        "bytes": total_length,
        "jsonChunkBytes": len(json_chunk),
        "binChunkBytes": len(bin_chunk),
        "binDataBytes": len(bin_data),
        "vertexCount": vertex_count,
        "triangleCount": len(indices) // 3,
        "indexCount": len(indices),
    }


def write_tileset(path: Path, geom_bounds: dict, frame: LocalFrame, glb_rel_uri: str,
                  *, geometric_error: float = 0.0) -> dict:
    """写出 3D Tiles 1.1 tileset.json（root.content 为 glTF，boundingVolume 用 tile 坐标）。"""
    mn = geom_bounds["min"]
    mx = geom_bounds["max"]
    center = [(mn[k] + mx[k]) * 0.5 for k in range(3)]
    half = [(mx[k] - mn[k]) * 0.5 for k in range(3)]
    # 轻微 padding，避免浮点在边界抖动导致裁剪
    half[0] += 2.0
    half[1] += 2.0
    half[2] += 2.0
    box = [
        round(center[0], 3), round(center[1], 3), round(center[2], 3),
        round(half[0], 3), 0.0, 0.0,
        0.0, round(half[1], 3), 0.0,
        0.0, 0.0, round(half[2], 3),
    ]
    tileset = {
        "asset": {
            "version": "1.1",
            "generator": GENERATOR,
        },
        "geometricError": 200.0,
        "root": {
            "refine": "ADD",
            "boundingVolume": {"box": box},
            "geometricError": geometric_error,
            "transform": [round(v, 10) for v in frame.transform_matrix()],
            "content": {"uri": glb_rel_uri},
        },
    }
    write_json(path, tileset)
    return {"box": box, "center": center, "half": half, "tileset": tileset}


# --------------------------------------------------------------------------- #
# 9. basemap（Pillow）
# --------------------------------------------------------------------------- #

def _project_area(features, bbox=BBOX):
    """收集用于底图绘制的面要素：[(kind, class, ring_coords)]。"""
    out = []
    for f in features:
        geom = f.get("geometry") or {}
        if geom.get("type") != "Polygon":
            continue
        props = f.get("properties") or {}
        cls = classify_area(props)
        if not cls:
            continue
        ring = clean_ring(geom["coordinates"][0])
        if len(ring) < 3:
            continue
        out.append((cls[0], cls[1], ring))
    return out


def build_basemap(features, roads, out_path: Path, bbox=BBOX, *,
                  width: int = BASEMAP_WIDTH,
                  quality: int = BASEMAP_JPEG_QUALITY) -> dict | None:
    """暗色栅格底图：Pillow 按经纬度线性映射绘制，超采样 2x 后降采样，JPEG <1.5MB。"""
    try:
        from PIL import Image, ImageDraw
    except Exception as exc:  # pragma: no cover
        log(f"WARNING: Pillow 不可用（{exc}），跳过 basemap 生成")
        return None
    try:
        import numpy as np
    except Exception:  # pragma: no cover
        np = None

    w, s, e, n = bbox
    height = int(round(width * (n - s) / (e - w)))
    ss = BASEMAP_SUPERSAMPLE
    W, H = width * ss, height * ss

    def px(lon):
        return (lon - w) / (e - w) * W

    def py(lat):
        return (n - lat) / (n - s) * H

    t0 = time.time()
    img = Image.new("RGB", (W, H), BASEMAP_COLORS["bg"])
    draw = ImageDraw.Draw(img)

    # 1) landuse / 绿地 / 水系（先 block，再 park，再 water，保证层次）
    areas = _project_area(features, bbox)
    order = {"block": 0, "park": 1, "water": 2}
    areas.sort(key=lambda x: order.get(x[0], 9))
    for kind, klass, ring in areas:
        pts = [(px(lon), py(lat)) for lon, lat in ring]
        if len(pts) < 3:
            continue
        if kind == "water":
            color = BASEMAP_COLORS["water"]
        elif kind == "park":
            palette = BASEMAP_COLORS["park"]
            color = palette.get(klass, palette["default"])
        else:
            palette = BASEMAP_COLORS["block"]
            color = palette.get(klass, palette["default"])
        draw.polygon(pts, fill=color)

    # 2) 建筑脚印（全部 building 面）
    bldg_color = BASEMAP_COLORS["building"]
    n_bld = 0
    for f in features:
        if not is_building(f):
            continue
        ring = clean_ring(f["geometry"]["coordinates"][0])
        if len(ring) < 3:
            continue
        pts = [(px(lon), py(lat)) for lon, lat in ring]
        draw.polygon(pts, fill=bldg_color)
        n_bld += 1

    # 3) 道路（按等级分色/分宽）
    n_road = 0
    for f in roads:
        cls = (f.get("properties") or {}).get("class") or "residential"
        color = BASEMAP_COLORS["road"].get(cls, BASEMAP_COLORS["road"]["residential"])
        lw = BASEMAP_ROAD_WIDTH.get(cls, 3) * ss
        coords = f["geometry"]["coordinates"]
        pts = [(px(lon), py(lat)) for lon, lat in coords]
        if len(pts) < 2:
            continue
        draw.line(pts, fill=color, width=lw, joint="curve")
        n_road += 1

    # 4) 降采样 + 暗角
    img = img.resize((width, height), Image.LANCZOS)
    if np is not None:
        arr = np.asarray(img).astype("float32")
        hh, ww = arr.shape[:2]
        yy, xx = np.mgrid[0:hh, 0:ww]
        cx, cy = (ww - 1) / 2.0, (hh - 1) / 2.0
        r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / math.sqrt(2.0)
        factor = 1.0 - 0.42 * np.clip((r - 0.45) / 0.55, 0.0, 1.0) ** 1.4
        arr *= factor[..., None]
        img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    chosen_quality = quality
    for q in (quality, 78, 74, 70, 66):
        chosen_quality = q
        img.save(out_path, format="JPEG", quality=q, optimize=True, progressive=True, subsampling=1)
        size = out_path.stat().st_size
        if size <= BASEMAP_MAX_BYTES:
            break
    size = out_path.stat().st_size
    log(f"basemap: {width}x{height}, {n_bld} 建筑, {n_road} 道路, "
        f"{fmt_size(size)} @ q{chosen_quality}, {time.time() - t0:.1f}s")
    return {
        "path": out_path,
        "width": width,
        "height": height,
        "bytes": size,
        "quality": chosen_quality,
        "supersample": ss,
        "rectangle": [w, s, e, n],
        "buildings": n_bld,
        "roads": n_road,
    }


# --------------------------------------------------------------------------- #
# 10. 自检（不依赖 Cesium）
# --------------------------------------------------------------------------- #

def validate_glb(path: Path) -> dict:
    """校验 .glb：header / chunk 对齐 / JSON / accessor min-max / 索引范围 / 法线。"""
    report = {"path": str(path), "errors": [], "warnings": []}
    data = path.read_bytes()
    report["bytes"] = len(data)
    if len(data) < 20:
        report["errors"].append("文件过短，不是合法 GLB")
        return report
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        report["errors"].append(f"magic 不是 'glTF'（0x{magic:08x}）")
    if version != 2:
        report["errors"].append(f"GLB version={version}，应为 2")
    if length != len(data):
        report["errors"].append(f"header.length={length} != 文件大小 {len(data)}")
    offset = 12
    chunks = []
    while offset + 8 <= len(data):
        clen, ctype = struct.unpack("<II", data[offset:offset + 8])
        offset += 8
        if offset + clen > len(data):
            report["errors"].append("chunk 越界")
            break
        body = data[offset:offset + clen]
        offset += clen
        if clen % 4 != 0:
            report["errors"].append(f"chunk 长度 {clen} 未 4 字节对齐")
        chunks.append((ctype, body))
    if offset != len(data):
        report["errors"].append("chunk 解析后仍有残余字节")
    json_chunk = next((b for t, b in chunks if t == 0x4E4F534A), None)
    bin_chunk = next((b for t, b in chunks if t == 0x004E4942), None)
    if json_chunk is None:
        report["errors"].append("缺少 JSON chunk")
        return report
    if bin_chunk is None:
        report["errors"].append("缺少 BIN chunk")
        return report
    try:
        gltf = json.loads(json_chunk.decode("utf-8").rstrip())
    except Exception as exc:
        report["errors"].append(f"JSON chunk 解析失败: {exc}")
        return report
    report["gltf"] = {
        "asset": gltf.get("asset"),
        "meshes": len(gltf.get("meshes", [])),
        "materials": len(gltf.get("materials", [])),
        "accessors": len(gltf.get("accessors", [])),
    }
    # buffer
    buffers = gltf.get("buffers") or []
    if len(buffers) != 1:
        report["errors"].append(f"buffers 数量 {len(buffers)} != 1")
    else:
        bl = buffers[0].get("byteLength")
        if not isinstance(bl, int) or bl > len(bin_chunk) or bl <= len(bin_chunk) - 4:
            report["errors"].append(f"buffer.byteLength={bl} 与 BIN chunk 长度 {len(bin_chunk)} 不匹配")
    # bufferViews
    for i, bv in enumerate(gltf.get("bufferViews") or []):
        off = bv.get("byteOffset", 0)
        ln = bv.get("byteLength", 0)
        if off % 4 != 0:
            report["errors"].append(f"bufferView[{i}].byteOffset={off} 未 4 字节对齐")
        if off + ln > len(bin_chunk):
            report["errors"].append(f"bufferView[{i}] 越界")
    # accessors
    accessors = gltf.get("accessors") or []
    comp_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    type_arity = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    decoded = {}
    for i, acc in enumerate(accessors):
        bvi = acc.get("bufferView")
        ctype = acc.get("componentType")
        count = acc.get("count")
        arity = type_arity.get(acc.get("type"))
        if bvi is None or ctype not in comp_size or not isinstance(count, int) or arity is None:
            report["errors"].append(f"accessor[{i}] 字段非法")
            continue
        unit = comp_size[ctype] * arity
        need = unit * count
        bv = gltf["bufferViews"][bvi]
        if need > bv["byteLength"]:
            report["errors"].append(f"accessor[{i}] 数据量 {need} > bufferView.byteLength {bv['byteLength']}")
        if i == 0 and ("min" not in acc or "max" not in acc):
            report["errors"].append("POSITION accessor 缺少 min/max")
        if ctype == 5126:
            start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            vals = struct.unpack_from("<%df" % (count * arity), bin_chunk, start)
            if any(not math.isfinite(v) for v in vals):
                report["errors"].append(f"accessor[{i}] 含 NaN/Inf")
            decoded[i] = vals
        elif ctype == 5121 and i == 2:
            start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            decoded[i] = bin_chunk[start:start + count * 4]
        elif ctype == 5125 and i == 3:
            start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            vals = struct.unpack_from("<%dI" % count, bin_chunk, start)
            decoded[i] = vals
    # POSITION min/max 与实际数据比对
    if 0 in decoded:
        vals = decoded[0]
        mins = [min(vals[k::3]) for k in range(3)]
        maxs = [max(vals[k::3]) for k in range(3)]
        amin = accessors[0].get("min") or []
        amax = accessors[0].get("max") or []
        for k in range(3):
            if abs(mins[k] - amin[k]) > 1e-3 or abs(maxs[k] - amax[k]) > 1e-3:
                report["errors"].append(f"POSITION accessor min/max 与实际数据不符: axis{k}")
        report["positionMin"] = mins
        report["positionMax"] = maxs
    # 索引范围
    if 3 in decoded and 0 in decoded:
        idx = decoded[3]
        vc = accessors[0]["count"]
        if idx and (max(idx) >= vc or min(idx) < 0):
            report["errors"].append(f"索引越界：max={max(idx)} / vertexCount={vc}")
        if len(idx) % 3 != 0:
            report["errors"].append("索引数不是 3 的倍数")
        report["triangleCount"] = len(idx) // 3
        report["vertexCount"] = vc
    # 法线归一性抽检
    if 1 in decoded:
        vals = decoded[1]
        bad = 0
        for k in range(0, len(vals), 3 * 97):
            x, y, z = vals[k], vals[k + 1], vals[k + 2]
            ln = math.sqrt(x * x + y * y + z * z)
            if abs(ln - 1.0) > 1e-2:
                bad += 1
        if bad:
            report["warnings"].append(f"NORMAL 抽检 {bad} 个非单位向量")
    return report


def validate_tileset(path: Path, data_dir: Path, frame: LocalFrame | None = None) -> dict:
    report = {"path": str(path), "errors": [], "warnings": []}
    try:
        tileset = json.loads(path.read_text("utf-8"))
    except Exception as exc:
        report["errors"].append(f"JSON 解析失败: {exc}")
        return report
    report["tileset"] = tileset
    asset = tileset.get("asset") or {}
    if not str(asset.get("version", "")).startswith("1.1"):
        report["errors"].append(f"asset.version={asset.get('version')}，应为 1.1")
    root = tileset.get("root") or {}
    bv = root.get("boundingVolume") or {}
    box = bv.get("box")
    if not (isinstance(box, list) and len(box) == 12 and all(isinstance(v, (int, float)) for v in box)):
        report["errors"].append("root.boundingVolume.box 缺失或不是 12 个数")
    if root.get("refine") not in ("ADD", "REPLACE"):
        report["errors"].append(f"root.refine={root.get('refine')} 非法")
    transform = root.get("transform")
    if not (isinstance(transform, list) and len(transform) == 16):
        report["errors"].append("root.transform 缺失或不是 16 个数")
        transform = None
    else:
        # 列主序 → 取三列检查正交归一
        cols = [transform[0:3], transform[4:7], transform[8:11]]
        for i, c in enumerate(cols):
            ln = math.sqrt(sum(v * v for v in c))
            if abs(ln - 1.0) > 1e-6:
                report["errors"].append(f"transform 列{i} 不是单位向量（|v|={ln:.9f}）")
        for i in range(3):
            for j in range(i + 1, 3):
                dot = sum(cols[i][k] * cols[j][k] for k in range(3))
                if abs(dot) > 1e-9:
                    report["errors"].append(f"transform 列{i}·列{j}={dot} 不为 0")
        det = (
            cols[0][0] * (cols[1][1] * cols[2][2] - cols[1][2] * cols[2][1])
            - cols[1][0] * (cols[0][1] * cols[2][2] - cols[0][2] * cols[2][1])
            + cols[2][0] * (cols[0][1] * cols[1][2] - cols[0][2] * cols[1][1])
        )
        if det < 0:
            report["errors"].append("transform 行列式为负（镜像），tile 坐标系应为右手系")
        if transform[3] != 0 or transform[7] != 0 or transform[11] != 0 or transform[15] != 1:
            report["errors"].append("transform 第 4 行/列应为 [0,0,0,1]")
        o = transform[12:15]
        if frame is not None:
            ecef = frame.origin_ecef
            err = math.dist(o, ecef)
            report["transformOriginErrorM"] = err
            if err > 1e-3:
                report["errors"].append(f"transform 平移列与 ENU 原点 ECEF 差 {err:.6f} m")
            # ENU 基向量一致性
            for name, vec, expect in (("east", cols[0], frame.east),
                                      ("north", cols[1], frame.north),
                                      ("up", cols[2], frame.up)):
                if math.dist(vec, expect) > 1e-9:
                    report["errors"].append(f"transform {name} 列与 WGS84 公式不一致")
    content = root.get("content") or {}
    uri = content.get("uri") or content.get("url")
    if not uri:
        report["errors"].append("root.content.uri 缺失")
    else:
        glb_path = path.parent / uri
        if not glb_path.exists():
            report["errors"].append(f"content.uri 指向的文件不存在: {glb_path}")
        else:
            report["contentPath"] = str(glb_path)
    return report


def validate_geojson_file(path: Path, expect_geom_types=None) -> dict:
    report = {"path": str(path), "errors": []}
    try:
        doc = json.loads(path.read_text("utf-8"))
    except Exception as exc:
        report["errors"].append(f"JSON 解析失败: {exc}")
        return report
    if doc.get("type") != "FeatureCollection":
        report["errors"].append("顶层 type 不是 FeatureCollection")
    feats = doc.get("features")
    if not isinstance(feats, list):
        report["errors"].append("features 不是数组")
        return report
    report["count"] = len(feats)
    report["bytes"] = path.stat().st_size
    types = {}
    for f in feats:
        gt = (f.get("geometry") or {}).get("type")
        types[gt] = types.get(gt, 0) + 1
        if expect_geom_types and gt not in expect_geom_types:
            report["errors"].append(f"非法几何类型 {gt}")
            break
    report["geometryTypes"] = types
    return report


# --------------------------------------------------------------------------- #
# 11. 主流程
# --------------------------------------------------------------------------- #

def default_out_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "public" / "data"


def gather_source(args) -> tuple[list, dict]:
    """按优先级选择数据源，返回 (features, source_meta)。"""
    if args.input:
        path = Path(args.input).expanduser()
        if not path.exists():
            die(f"--input 文件不存在: {path}")
        feats = load_geojson(path)
        return feats, {
            "mode": "geojson",
            "input": str(path),
            "inputBytes": path.stat().st_size,
            "extractLabel": EXTRACT_LABEL,
            "extractUrl": BBBike_URL,
        }
    if args.osm_gz:
        path = Path(args.osm_gz).expanduser()
        if not path.exists():
            die(f"--osm-gz 文件不存在: {path}")
        feats = parse_osm_gz(path)
        return feats, {
            "mode": "osm-gz",
            "input": str(path),
            "inputBytes": path.stat().st_size,
            "extractLabel": EXTRACT_LABEL,
            "extractUrl": BBBike_URL,
        }
    if args.download:
        tmp_dir = Path(tempfile.gettempdir()) / "cbd-data"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        path = download_osm(tmp_dir / "Beijing.osm.gz")
        feats = parse_osm_gz(path)
        return feats, {
            "mode": "download",
            "input": str(path),
            "inputBytes": path.stat().st_size,
            "extractLabel": EXTRACT_LABEL,
            "extractUrl": BBBike_URL,
        }
    # 无参数时尝试默认位置（方便本地一键重跑）
    for candidate in (
        Path("/tmp/cbd-data/osm-filtered.geojson"),
        Path(__file__).resolve().parent / "source" / "osm-filtered.geojson",
        Path(__file__).resolve().parent / "source" / "Beijing.osm.gz",
    ):
        if candidate.exists():
            log(f"未指定 --input/--osm-gz/--download，自动使用 {candidate}")
            if candidate.suffix == ".gz":
                return parse_osm_gz(candidate), {
                    "mode": "auto-osm-gz", "input": str(candidate),
                    "inputBytes": candidate.stat().st_size,
                    "extractLabel": EXTRACT_LABEL, "extractUrl": BBBike_URL,
                }
            return load_geojson(candidate), {
                "mode": "auto-geojson", "input": str(candidate),
                "inputBytes": candidate.stat().st_size,
                "extractLabel": EXTRACT_LABEL, "extractUrl": BBBike_URL,
            }
    die("没有数据源：请指定 --input <geojson> 或 --osm-gz <osm.gz> 或 --download")


def run_build(args) -> int:
    t_start = time.time()
    out_dir = Path(args.out).resolve() if args.out else default_out_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    tiles_dir = out_dir / "tiles" / "white-models"
    tiles_dir.mkdir(parents=True, exist_ok=True)

    origin = ORIGIN
    if args.origin:
        parts = [p.strip() for p in str(args.origin).split(",")]
        if len(parts) != 2:
            die("--origin 需要 'lon,lat' 格式")
        origin = (float(parts[0]), float(parts[1]), 0.0)
    frame = LocalFrame(*origin)
    log(f"ENU 原点: lon={origin[0]}, lat={origin[1]}, h={origin[2]}")
    local_ecef = frame.origin_ecef
    log(f"原点 ECEF: ({local_ecef[0]:.3f}, {local_ecef[1]:.3f}, {local_ecef[2]:.3f})")

    features, source_meta = gather_source(args)
    if not features:
        die("数据源为空")

    # ---- 图层 ----
    log("构建 roads.geojson …")
    roads, roads_stats = build_roads(features)
    roads_doc = {
        "type": "FeatureCollection",
        "name": "cbd-roads",
        "bbox": list(BBOX),
        "features": roads,
    }
    roads_bytes = write_json(out_dir / "roads.geojson", roads_doc, compact=True)

    log("构建 context.geojson …")
    context, context_stats = build_context(features)
    context_doc = {
        "type": "FeatureCollection",
        "name": "cbd-context",
        "bbox": list(BBOX),
        "features": context,
    }
    context_bytes = write_json(out_dir / "context.geojson", context_doc, compact=True)

    log("构建 railways.geojson …")
    railways, rail_stats = build_railways(features)
    rail_doc = {
        "type": "FeatureCollection",
        "name": "cbd-railways",
        "bbox": list(BBOX),
        "features": railways,
    }
    rail_bytes = write_json(out_dir / "railways.geojson", rail_doc, compact=True)

    # ---- 白模 ----
    log("筛选白模建筑（面积过滤 / 地标排除 / 高度估算）…")
    buildings, excluded = select_white_model_buildings(features, frame)
    log(f"白模建筑 {len(buildings)} / {sum(1 for f in features if is_building(f))}；"
        f"地标排除 {len(excluded['landmark'])}，面积过小 {excluded['small']}，退化 {excluded['degenerate']}")
    if excluded["landmark"]:
        for item in excluded["landmark"]:
            log(f"  - 排除 {item['id']} 距 {item['landmark']} {item['distanceM']}m")

    log("构建白模几何（耳切三角化）…")
    t_geo = time.time()
    geom = build_white_model_geometry(buildings, frame)
    log(f"几何：vertices={geom['vertexCount']} triangles={geom['triangleCount']} "
        f"bounds(min={[round(v,1) for v in geom['bounds']['min']]}, max={[round(v,1) for v in geom['bounds']['max']]}) "
        f"{time.time() - t_geo:.2f}s")

    # 单文件 <4MB 保护：按高度*面积升序丢弃，直到体积达标（确定性）
    glb_path = tiles_dir / "white-models.glb"
    glb_info = write_glb(glb_path, geom, WHITE_MODEL_MATERIAL)
    max_glb_bytes = 4 * 1024 * 1024
    if glb_info["bytes"] > max_glb_bytes:
        log(f"WARNING: glb {fmt_size(glb_info['bytes'])} 超过 4MB，按面积裁剪后再试 …")
        ranked = sorted(buildings, key=lambda r: r["height"] * math.sqrt(max(r["area"], 1.0)))
        while glb_info["bytes"] > max_glb_bytes and len(buildings) > 100:
            drop_n = max(10, len(buildings) // 20)
            drop_ids = {r["id"] for r in ranked[:drop_n]}
            buildings = [r for r in buildings if r["id"] not in drop_ids]
            geom = build_white_model_geometry(buildings, frame)
            glb_info = write_glb(glb_path, geom, WHITE_MODEL_MATERIAL)
            log(f"  裁剪到 {len(buildings)} 栋 → {fmt_size(glb_info['bytes'])}")
    log(f"white-models.glb: {fmt_size(glb_info['bytes'])}（vertices={glb_info['vertexCount']}, "
        f"triangles={glb_info['triangleCount']}, JSON chunk={fmt_size(glb_info['jsonChunkBytes'])}）")

    tileset_path = tiles_dir / "tileset.json"
    tileset_info = write_tileset(tileset_path, geom["bounds"], frame, "white-models.glb")
    tileset_bytes = tileset_path.stat().st_size
    log(f"tileset.json: {fmt_size(tileset_bytes)}  box={tileset_info['box']}")

    # ---- 兜底建筑面（core 内，最多 700） ----
    log("构建 buildings-fallback.geojson …")
    fallback, fallback_stats = build_fallback_buildings(buildings, frame, CORE_BBOX)
    fallback_doc = {
        "type": "FeatureCollection",
        "name": "cbd-buildings-fallback",
        "bbox": list(CORE_BBOX),
        "features": fallback,
    }
    fallback_bytes = write_json(out_dir / "buildings-fallback.geojson", fallback_doc, compact=True)
    log(f"fallback 建筑 {fallback_stats['kept']} 个（core 内候选 {fallback_stats['candidates']}）")

    # ---- basemap ----
    basemap_meta = None
    if args.skip_basemap:
        log("跳过 basemap（--skip-basemap）")
    else:
        log("绘制 basemap.jpg …")
        basemap_meta = build_basemap(features, roads, out_dir / "basemap.jpg", BBOX)

    # ---- meta.json ----
    height_sources = {}
    for rec in buildings:
        src = rec["heightSource"].split(":", 1)[0] if rec["heightSource"].startswith("default") else rec["heightSource"]
        height_sources[src] = height_sources.get(src, 0) + 1
    hist = {"<15": 0, "15-30": 0, "30-60": 0, "60-100": 0, "100-200": 0, ">=200": 0}
    for rec in buildings:
        h = rec["height"]
        if h < 15: hist["<15"] += 1
        elif h < 30: hist["15-30"] += 1
        elif h < 60: hist["30-60"] += 1
        elif h < 100: hist["60-100"] += 1
        elif h < 200: hist["100-200"] += 1
        else: hist[">=200"] += 1

    bmin = geom["bounds"]["min"]
    bmax = geom["bounds"]["max"]
    # 白模 tile 坐标范围 → 经纬度（用 transform 反推，校验两侧一致性）
    west_b = ecef_to_geodetic(*frame.matrix_to_ecef((bmin[0], bmin[1], 0.0)))
    east_b = ecef_to_geodetic(*frame.matrix_to_ecef((bmax[0], bmax[1], 0.0)))
    south_b = ecef_to_geodetic(*frame.matrix_to_ecef((bmin[0], bmin[1], 0.0)))
    north_b = ecef_to_geodetic(*frame.matrix_to_ecef((bmax[0], bmax[1], 0.0)))
    geo_bounds = [
        round(west_b[0], 7), round(south_b[1], 7),
        round(east_b[0], 7), round(north_b[1], 7),
    ]

    meta = {
        "name": "Beijing Chaoyang CBD — Digital Twin Data",
        "description": "北京朝阳 CBD 数字孪生静态数据资产（OSM 白模 3D Tiles + 矢量图层 + 暗色底图）",
        "generatedAt": utc_now_iso(),
        "generator": TOOL_NAME,
        "generatorVersion": "1.0.0",
        # 前端 DataMeta 约定 source 为可展示字符串；结构化源信息放在 sourceInfo
        "source": "OpenStreetMap · BBBike Beijing extract (2026-10-31)",
        "attribution": "© OpenStreetMap contributors (ODbL 1.0)",
        "sourceInfo": {
            "name": "OpenStreetMap",
            "extract": source_meta.get("input"),
            "extractLabel": EXTRACT_LABEL,
            "downloadUrl": BBBike_URL,
            "extractDate": args.extract_date,
            "license": "ODbL 1.0",
            "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
            "attribution": "© OpenStreetMap contributors",
            "attributionHtml": "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors (ODbL 1.0)",
            "sourceMode": source_meta.get("mode"),
            "sourceFeatures": len(features),
        },
        "crs": {
            "geographic": "WGS84 (EPSG:4326), lon/lat, degrees",
            "vertical": "WGS84 ellipsoidal height (米)，未做大地水准面改正",
            "local": "ENU (x=east, y=north, z=up)，单位米，原点见 origin",
        },
        "bbox": list(BBOX),
        "coreBbox": list(CORE_BBOX),
        "origin": {
            "lon": origin[0], "lat": origin[1], "height": origin[2],
            "ecef": [round(v, 4) for v in frame.origin_ecef],
            "note": "3D Tiles root.transform 的 ENU→ECEF 平移列；白模 tile 坐标 x=east, y=north, z=up",
        },
        "tiles": {
            "whiteModels": {
                "tileset": "data/tiles/white-models/tileset.json",
                "glb": "data/tiles/white-models/white-models.glb",
                "tilesetVersion": "1.1",
                "contentType": "glTF 2.0 (.glb)，3D Tiles 1.1 直接支持，无需 b3dm",
                "glbUpAxis": "Y (glTF) → Z-up (tile)：x=east, y=up, z=-north",
                "transform": [round(v, 10) for v in frame.transform_matrix()],
                "transformLayout": "column-major 4x4, ENU→ECEF, 列0=east 列1=north 列2=up 列3=origin(ECEF)",
                "boundingVolumeBox": tileset_info["box"],
                "boundingVolumeBoxLayout": "tile 坐标: [cx,cy,cz, hx,0,0, 0,hy,0, 0,0,hz]，x=east,y=north,z=up",
                "buildingCount": len(buildings),
                "vertexCount": glb_info["vertexCount"],
                "triangleCount": glb_info["triangleCount"],
                "boundsEnu": {"min": [round(v, 2) for v in bmin], "max": [round(v, 2) for v in bmax]},
                "boundsGeographic": geo_bounds,
                "bytes": glb_info["bytes"],
                "tilesetBytes": tileset_bytes,
                "material": {
                    "baseColor": "vertex colors (near-white cool gray, 3 height tiers)",
                    "metallic": WHITE_MODEL_MATERIAL["pbrMetallicRoughness"]["metallicFactor"],
                    "roughness": WHITE_MODEL_MATERIAL["pbrMetallicRoughness"]["roughnessFactor"],
                    "emissive": WHITE_MODEL_MATERIAL["emissiveFactor"],
                    "doubleSided": WHITE_MODEL_MATERIAL["doubleSided"],
                },
            },
        },
        "layers": {
            "roads": {
                "path": "data/roads.geojson", "count": roads_stats["kept"],
                "bytes": roads_bytes, "geometry": "LineString",
                "fields": ["id", "class", "name", "ref", "oneway", "lanes", "bridge", "tunnel"],
                "classes": list(DRIVABLE_CLASSES + DRIVABLE_LINK_CLASSES),
                "simplifyToleranceM": ROAD_SIMPLIFY_TOL_M,
                "stats": roads_stats,
            },
            "context": {
                "path": "data/context.geojson", "count": context_stats["kept"],
                "bytes": context_bytes, "geometry": "Polygon",
                "fields": ["id", "kind", "class", "name"],
                "kinds": {"water": context_stats["water"], "park": context_stats["park"], "block": context_stats["block"]},
            },
            "railways": {
                "path": "data/railways.geojson", "count": rail_stats["kept"],
                "bytes": rail_bytes, "geometry": "LineString",
                "fields": ["id", "kind", "name", "tunnel", "bridge"],
                "kinds": sorted(RAIL_KINDS),
            },
            "buildingsFallback": {
                "path": "data/buildings-fallback.geojson", "count": fallback_stats["kept"],
                "bytes": fallback_bytes, "geometry": "Polygon",
                "fields": ["id", "height", "levels", "name", "kind", "area"],
                "bbox": list(CORE_BBOX),
                "note": "3D Tiles 加载失败时用 Cesium Entity/Polygon 拉伸兜底；地标体块已排除",
            },
        },
        "basemap": None if not basemap_meta else {
            "file": "data/basemap.jpg",
            "path": "data/basemap.jpg",
            "url": "data/basemap.jpg",
            "rectangle": basemap_meta["rectangle"],
            "rectangleLayout": "[west, south, east, north]，与 Cesium.Rectangle 一致",
            "width": basemap_meta["width"],
            "height": basemap_meta["height"],
            "bytes": basemap_meta["bytes"],
            "jpegQuality": basemap_meta["quality"],
            "supersample": basemap_meta["supersample"],
            "pixelMapping": "线性映射: x=(lon-west)/(east-west)*width, y=(north-lat)/(north-south)*height",
            "buildingsDrawn": basemap_meta["buildings"],
            "roadsDrawn": basemap_meta["roads"],
            "attribution": "© OpenStreetMap contributors",
        },
        "heightModel": {
            "priority": ["height tag (米)", "building:levels * 3.2 + 1.2", "building 类型默认值"],
            "levelHeightM": LEVEL_HEIGHT_M,
            "groundExtraM": GROUND_EXTRA_M,
            "defaultsByType": {k: v for k, v in sorted(DEFAULT_HEIGHTS.items())},
            "filters": {
                "minFootprintAreaM2": MIN_FOOTPRINT_AREA_M2,
                "dropRoofWithoutHeightBelowM": ROOF_MAX_HEIGHT_M,
                "landmarkExclusionRadiusM": 80,
            },
            "heightSourceCounts": height_sources,
            "heightHistogramM": hist,
        },
        "buildingCount": len(buildings),
        "roadCount": roads_stats["kept"],
        "landmarksExcluded": [
            {
                "name": lm["name"], "lon": lm["lon"], "lat": lm["lat"],
                "radiusM": lm["radiusM"],
                "excludedBuildingIds": [e["id"] for e in excluded["landmark"] if e["landmark"] == lm["name"]],
            }
            for lm in LANDMARKS
        ],
        "stats": {
            "sourceFeatures": len(features),
            "buildingsInSource": sum(1 for f in features if is_building(f)),
            "whiteModelBuildings": len(buildings),
            "roadFeatures": roads_stats["kept"],
            "roadPointsBefore": roads_stats["pointsBefore"],
            "roadPointsAfter": roads_stats["pointsAfter"],
            "contextFeatures": context_stats["kept"],
            "railwayFeatures": rail_stats["kept"],
            "fallbackBuildings": fallback_stats["kept"],
            "whiteModelTriangles": glb_info["triangleCount"],
            "whiteModelVertices": glb_info["vertexCount"],
        },
        "notes": [
            "所有矢量图层与 basemap 使用同一 bbox：WGS84 经纬度，可直接与 Cesium 图层对齐。",
            "白模地面按 WGS84 椭球高 0m 处理；未引入地形/大地水准面改正，与程序化地标保持同一基准。",
            "白模 footprint 来自 OSM，OSM 无高度的建筑按 building:levels 或类型默认值估算，仅为视觉近似。",
            "中国尊/国贸三期A/B/央视总部 80m 半径内的体块已排除，由前端程序化地标模型呈现。",
            "道路几何已按 RDP 0.5m 抽稀；buildings-fallback 与白模共用同一高度估算值。",
            "若 3D Tiles 加载失败，可回退 buildings-fallback.geojson（core 内 ≤700 栋，按高度/面积优选）。",
        ],
    }
    meta_bytes = write_json(out_dir / "meta.json", meta)
    log(f"meta.json: {fmt_size(meta_bytes)}")

    # ---- 自检 ----
    if not args.skip_verify:
        log("自检 …")
        problems = 0
        glb_report = validate_glb(glb_path)
        if glb_report["errors"]:
            problems += len(glb_report["errors"])
        for err in glb_report["errors"]:
            log(f"  GLB ERROR: {err}")
        ts_report = validate_tileset(tileset_path, out_dir, frame)
        if ts_report["errors"]:
            problems += len(ts_report["errors"])
        for err in ts_report["errors"]:
            log(f"  tileset ERROR: {err}")
        layer_checks = [
            ("roads.geojson", {"LineString", "MultiLineString"}),
            ("context.geojson", {"Polygon", "MultiPolygon"}),
            ("railways.geojson", {"LineString", "MultiLineString"}),
            ("buildings-fallback.geojson", {"Polygon", "MultiPolygon"}),
        ]
        for name, geoms in layer_checks:
            rep = validate_geojson_file(out_dir / name, geoms)
            for err in rep["errors"]:
                problems += 1
                log(f"  {name} ERROR: {err}")
        # 白模顶点范围 vs tileset box 一致性
        if glb_report.get("positionMin") and ts_report.get("tileset"):
            box = ts_report["tileset"]["root"]["boundingVolume"]["box"]
            # glTF Y-up → tile: x=e, y=up, z=-n → 与 box 比较（注意轴映射）
            pmin = glb_report["positionMin"]
            pmax = glb_report["positionMax"]
            tile_min = [pmin[0], -pmax[2], pmin[1]]
            tile_max = [pmax[0], -pmin[2], pmax[1]]
            for k in range(3):
                lo = box[k] - box[3 + 4 * k]
                hi = box[k] + box[3 + 4 * k]
                if not (lo - 3.0 <= tile_min[k] and hi + 3.0 >= tile_max[k]):
                    problems += 1
                    log(f"  tileset ERROR: boundingVolume box 未覆盖白模几何 axis{k} "
                        f"({tile_min[k]:.1f}..{tile_max[k]:.1f} vs {lo:.1f}..{hi:.1f})")
        if problems:
            log(f"自检发现 {problems} 个问题")
        else:
            log("自检通过：GLB / tileset / GeoJSON 结构合法，boundingVolume 覆盖几何")
        # 便于脚本化调用
        meta["verification"] = {
            "glbBytes": glb_info["bytes"],
            "glbPositionsMin": [round(v, 3) for v in (glb_report.get("positionMin") or [])],
            "glbPositionsMax": [round(v, 3) for v in (glb_report.get("positionMax") or [])],
            "errors": problems,
        }
        write_json(out_dir / "meta.json", meta)

    # ---- 汇总 ----
    log("产物：")
    total = 0
    for p in sorted(out_dir.rglob("*")):
        if p.is_file():
            total += p.stat().st_size
            log(f"  {p.relative_to(out_dir)}  {fmt_size(p.stat().st_size)}")
    log(f"合计 {fmt_size(total)}，耗时 {time.time() - t_start:.1f}s")
    return 0


def run_verify(args) -> int:
    out_dir = Path(args.out).resolve() if args.out else default_out_dir()
    log(f"校验 {out_dir} …")
    frame = None
    problems = 0
    meta_path = out_dir / "meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text("utf-8"))
            origin = meta.get("origin") or {}
            frame = LocalFrame(float(origin.get("lon", ORIGIN[0])), float(origin.get("lat", ORIGIN[1])),
                               float(origin.get("height", 0.0)))
            log(f"meta.json 可解析，generatedAt={meta.get('generatedAt')}")
            exp = meta.get("tiles", {}).get("whiteModels", {}).get("transform")
            if exp:
                actual = frame.transform_matrix()
                if len(exp) == 16:
                    diff = max(abs(a - b) for a, b in zip(exp, actual))
                    log(f"transform 与 meta/origin 重建值最大偏差 {diff:.3e}")
                    if diff > 1e-6:
                        problems += 1
                        log("  ERROR: transform 与 origin 不自洽")
        except Exception as exc:
            problems += 1
            log(f"  meta.json ERROR: {exc}")
    glb_path = out_dir / "tiles" / "white-models" / "white-models.glb"
    if glb_path.exists():
        rep = validate_glb(glb_path)
        log(f"GLB: {fmt_size(rep['bytes'])} vertices={rep.get('vertexCount')} triangles={rep.get('triangleCount')}")
        problems += len(rep["errors"])
        for err in rep["errors"]:
            log(f"  GLB ERROR: {err}")
        for warn in rep["warnings"]:
            log(f"  GLB WARN: {warn}")
    else:
        problems += 1
        log(f"  ERROR: 缺少 {glb_path}")
    ts_path = out_dir / "tiles" / "white-models" / "tileset.json"
    if ts_path.exists():
        rep = validate_tileset(ts_path, out_dir, frame)
        problems += len(rep["errors"])
        for err in rep["errors"]:
            log(f"  tileset ERROR: {err}")
        log(f"tileset: version={(rep.get('tileset') or {}).get('asset', {}).get('version')} "
            f"content={(rep.get('tileset') or {}).get('root', {}).get('content', {}).get('uri')}")
    else:
        problems += 1
        log(f"  ERROR: 缺少 {ts_path}")
    for name, geoms in (
        ("roads.geojson", {"LineString", "MultiLineString"}),
        ("context.geojson", {"Polygon", "MultiPolygon"}),
        ("railways.geojson", {"LineString", "MultiLineString"}),
        ("buildings-fallback.geojson", {"Polygon", "MultiPolygon"}),
    ):
        p = out_dir / name
        if not p.exists():
            problems += 1
            log(f"  ERROR: 缺少 {name}")
            continue
        rep = validate_geojson_file(p, geoms)
        log(f"{name}: {rep['count']} features, {fmt_size(rep['bytes'])}, {rep['geometryTypes']}")
        problems += len(rep["errors"])
        for err in rep["errors"]:
            log(f"  {name} ERROR: {err}")
    bm = out_dir / "basemap.jpg"
    if bm.exists():
        try:
            from PIL import Image
            with Image.open(bm) as im:
                log(f"basemap.jpg: {im.size[0]}x{im.size[1]} {fmt_size(bm.stat().st_size)}")
                if im.size[0] < 1024:
                    problems += 1
                    log("  ERROR: basemap 宽度过小")
        except Exception as exc:
            log(f"  WARN: 无法读取 basemap ({exc})")
    if problems:
        log(f"校验失败：{problems} 个问题")
        return 1
    log("校验通过 ✅")
    return 0


# --------------------------------------------------------------------------- #
# 12. CLI
# --------------------------------------------------------------------------- #

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="北京朝阳 CBD 数字孪生数据管线：OSM → 3D Tiles 白模 / GeoJSON / basemap",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""示例:
  python3 tools/build-city-data.py --input /tmp/cbd-data/osm-filtered.geojson
  python3 tools/build-city-data.py --osm-gz /tmp/Beijing.osm.gz
  python3 tools/build-city-data.py --download
  python3 tools/build-city-data.py --verify-only
""",
    )
    src = p.add_mutually_exclusive_group()
    src.add_argument("--input", metavar="GEOJSON",
                     help="预处理好的 bbox 内 GeoJSON（FeatureCollection，properties 为原始 OSM tags）")
    src.add_argument("--osm-gz", metavar="OSM.GZ", help="BBBike 原始 .osm.gz 路径（流式解析）")
    src.add_argument("--download", action="store_true",
                     help=f"从 {BBBike_URL} 下载 extract 后解析（约 48MB）")
    p.add_argument("--out", metavar="DIR", help="输出目录，默认 <app>/public/data")
    p.add_argument("--origin", metavar="LON,LAT", help="白模 ENU 原点经纬度，默认 116.4610,39.9080")
    p.add_argument("--extract-date", default="2026-10-31", help="标注 extract 日期（默认 2026-10-31）")
    p.add_argument("--skip-basemap", action="store_true", help="跳过 basemap.jpg 生成")
    p.add_argument("--skip-verify", action="store_true", help="跳过生成后的自检")
    p.add_argument("--verify-only", action="store_true", help="只校验已有产物，不重新生成")
    return p


def main(argv=None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.verify_only:
        return run_verify(args)
    return run_build(args)


if __name__ == "__main__":
    raise SystemExit(main())
