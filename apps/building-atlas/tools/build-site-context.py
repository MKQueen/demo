#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""building-atlas · 东四十条街区语境数据管线（OSM → 静态前端资产）

把 BBBike Beijing extract（原始 OSM XML，gzip）加工成 building-atlas 所需的全部
静态数据产物，只依赖 Python 标准库：

    public/data/site/
        meta.json                  唯一事实来源（原点 / 范围 / 统计 / 图层 / 高度模型）
        white-models.glb           周边建筑白模（单 mesh / 顶点色 / Y-up / glTF 2.0）
        roads.geojson              路网 LineString（lon/lat）
        landuse.geojson            绿地 / 水系 / 地块 / 广场面
        poi.json                   精简 POI（含局部米坐标与距离）
        site-footprint.geojson     富华大厦地块 / 六座塔楼 / 中央庭院

坐标口径（与 apps/building-atlas/docs/upgrade-contract.md §1 完全一致）：

    局部米 x = (lon - ORIGIN.lon) * 111320 * cos(ORIGIN.lat)
    局部米 z = -(lat - ORIGIN.lat) * 110540
    场景 +X = 东，+Z = 南（北 = -Z），单位米
    glTF 顶点 (x=east, y=up, z=-north) → Three.js 直接加载即为上述朝向

数据来源：© OpenStreetMap contributors, ODbL 1.0；extract 来自
https://download.bbbike.org/osm/bbbike/Beijing/ 。本目录产物为 ODbL 衍生数据，
分发 / 展示时必须保留署名。

用法：

    # 生成（默认读取 /tmp/Beijing.osm.gz，输出到 <app>/public/data/site）
    python3 tools/build-site-context.py --osm-gz /tmp/Beijing.osm.gz

    # 只校验已有产物（不重新解析 OSM）
    python3 tools/build-site-context.py --verify-only

    # 换原点 / 范围（例如 --radius 1500）
    python3 tools/build-site-context.py --origin 116.429613,39.929566 --radius 1200

    # 常用便捷运行时（Python 3.12，仅标准库）
    /Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
        tools/build-site-context.py --osm-gz /tmp/Beijing.osm.gz

生成结果可确定性复现：除 meta.json 的 generatedAt 时间戳外，其余产物逐字节一致。
"""

from __future__ import annotations

import argparse
import array
import gzip
import hashlib
import json
import math
import struct
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

# --------------------------------------------------------------------------- #
# 0. 路径与常量（改这里即可换区域 / 调参）
# --------------------------------------------------------------------------- #

TOOL_NAME = "build-site-context"
GENERATOR = "building-atlas/site-context 1.0"

APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUT_DIR = APP_DIR / "public" / "data" / "site"
DEFAULT_OSM_GZ = Path("/tmp/Beijing.osm.gz")

# 原点：富华大厦地块 bbox 中心（WGS84）。与契约 §1 保持一致，前端从 meta.origin 读取。
ORIGIN_LON = 116.429613
ORIGIN_LAT = 39.929566
ORIGIN_LABEL = "富华大厦"

DEFAULT_RADIUS_M = 1500.0  # 街区语境半径（Lead 2026-11-04 决定由 1200 m 调至 1500 m：内城 OSM 建筑密度有限）

# 富华大厦地块：OSM way 78743408（landuse=commercial，name=富华大厦）
SITE_WAY_ID = "78743408"

# 挖空规则（契约 §2.2）：footprint 与 x∈[-72,72] ∧ z∈[-78,78] 相交，或质心距原点 < 95 m
CARVE_BOX_LOCAL = (-72.0, -78.0, 72.0, 78.0)   # (minX, minZ, maxX, maxZ)，局部米
CARVE_RADIUS_M = 95.0

# 白模几何参数
MIN_FOOTPRINT_AREA_M2 = 15.0     # footprint 面积下限
TRIANGLE_BUDGET = 120_000        # glb 三角面上限
GLB_MAX_BYTES = 5 * 1024 * 1024  # glb 体积上限
LEVEL_HEIGHT_M = 3.2             # building:levels 层高
GROUND_EXTRA_M = 1.2             # 底层 / 女儿墙附加
MIN_BUILDING_HEIGHT_M = 3.0
MAX_BUILDING_HEIGHT_M = 180.0

# 道路 / 面要素参数
ROAD_SIMPLIFY_TOL_M = 0.8        # RDP 抽稀容差（契约 §2.3）
LOCAL_WALK_RADIUS_M = 600.0      # 站点周边 pedestrian/footway 保留半径
MIN_LANDUSE_AREA_M2 = 200.0      # 小面积杂项丢弃阈值（水系 / 公园不受限）
NODE_MARGIN_M = 1500.0           # 解析时节点额外保留余量（保证裁剪后的折线 / 多边形完整）

# 白模配色：近白偏冷灰，按高度三档 + 确定性微抖动；墙底略暗、屋顶略亮
TIER_LIMITS = (24.0, 80.0)
TIER_COLORS = (
    (0.845, 0.868, 0.902),   # 低层
    (0.782, 0.806, 0.850),   # 中层
    (0.715, 0.740, 0.788),   # 高层
)
BASE_DARKEN = 0.88
ROOF_GAIN = 1.02

WHITE_MODEL_MATERIAL = {
    "name": "WhiteModel",
    "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
        "metallicFactor": 0.02,
        "roughnessFactor": 0.85,
    },
    "doubleSided": True,
}

# 高度 override：展示用估算（非测绘 / 非实测），仅对未提供 height / building:levels 的可识别地标生效。
# 单位米；最终夹取到 3–180 m。
HEIGHT_OVERRIDES = {
    "首创大厦": 95.0,
    "港澳中心": 50.0,
    "保利大厦酒店": 70.0,
    "保利大厦": 70.0,
    "中国保利集团": 70.0,
    "新保利大厦": 105.2,       # OSM 自带 height=105.2，优先级更高
    "五矿广场": 65.0,
    "中国移动": 40.0,
    "阳光国际大厦": 80.0,
    "新中大厦": 60.0,
    "东环广场A座": 55.0,
    "东环广场B座": 55.0,
    "天辰大厦": 75.0,
    "亚洲大酒店": 60.0,
    "工人体育馆": 30.0,
    "北京喜剧院": 20.0,
    "合生国际大厦": 40.0,
    "东方文华大厦": 40.0,
    "文化和旅游部": 30.0,
    "中华人民共和国文化和旅游部": 30.0,
    "外交部新闻中心": 40.0,
    "悠唐生活广场": 40.0,
    "丰联广场": 80.0,
    "中国人寿大厦": 60.0,
    "国华投资大厦": 80.0,
    "居然大厦": 70.0,
    "CYTS Plaza": 60.0,
    "天恒大厦": 70.0,
    "泛利大厦": 40.0,
    "中纺大厦": 40.0,
    "中海油大厦": 90.0,
    "中国人保办公楼": 60.0,
    "北京电信大楼": 80.0,
    "新闻出版大厦": 65.0,
    "东直门交通枢纽": 30.0,
    "南新仓商务大厦": 70.0,
    "凯恒中心": 80.0,
}

# 类型默认高度：[lo, hi] 用 building id 的 MD5 哈希在区间内确定性取值，或固定值。
DEFAULT_HEIGHTS = {
    "office": (24.0, 40.0),
    "commercial": (24.0, 40.0),
    "retail": (12.0, 18.0),
    "residential": (18.0, 22.0),
    "apartments": (18.0, 22.0),
    "hotel": (28.0, 40.0),
    "dormitory": (16.0, 24.0),
    "yes": (10.8, 13.2),
    "house": (8.0, 10.0),
    "detached": (8.0, 10.0),
    "terrace": (9.0, 11.0),
    "shed": (3.0, 4.0),
    "hut": (3.0, 4.0),
    "kiosk": (3.0, 4.0),
    "school": (12.0, 16.0),
    "university": (14.0, 20.0),
    "kindergarten": (8.0, 10.0),
    "hospital": (22.0, 28.0),
    "government": (16.0, 22.0),
    "public": (14.0, 20.0),
    "civic": (14.0, 20.0),
    "church": (15.0, 18.0),
    "temple": (10.0, 14.0),
    "mosque": (12.0, 16.0),
    "industrial": (9.0, 12.0),
    "warehouse": (8.0, 10.0),
    "factory": (10.0, 12.0),
    "garage": (3.0, 5.0),
    "garages": (3.0, 5.0),
    "parking": (3.0, 5.0),
    "parking_garage": (8.0, 12.0),
    "train_station": (14.0, 18.0),
    "transportation": (10.0, 14.0),
    "bus_station": (8.0, 12.0),
    "construction": (8.0, 12.0),
    "roof": (4.0, 6.0),
}
DEFAULT_HEIGHT_FALLBACK = (10.8, 13.2)

# 六座塔楼（与 src/floors.js 的 TOWERS 一致）：id, x, z, w(X 向), d(Z 向)
TOWERS = (
    ("A", -27.0, -28.0, 23.0, 25.0),
    ("B", -27.0, 0.0, 19.0, 31.0),
    ("C", -27.0, 28.0, 23.0, 25.0),
    ("D", 27.0, 28.0, 23.0, 25.0),
    ("E", 27.0, 0.0, 19.0, 31.0),
    ("F", 27.0, -28.0, 23.0, 25.0),
)
TOWER_ORDER = "ABCDEF"

# 中央庭院（示意图，处于东西两排塔楼之间；仅供小地图 / 高亮示意）
COURTYARD_RECT_LOCAL = (-15.5, -40.5, 15.5, 40.5)  # minX, minZ, maxX, maxZ

# OSM 解析：感兴趣的 tag
OSM_INTERESTING_TAGS = (
    "building", "highway", "landuse", "leisure", "natural", "waterway",
    "railway", "place", "amenity", "tourism", "office", "public_transport",
    "man_made",
)
OSM_POLYGON_TAGS = ("building", "landuse", "leisure", "natural", "waterway", "place")

# 道路等级（契约 §2.3）
DRIVABLE_CLASSES = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "unclassified", "living_street",
)
DRIVABLE_LINK_CLASSES = tuple(f"{c}_link" for c in DRIVABLE_CLASSES)
LOCAL_WALK_CLASSES = ("pedestrian", "footway")

# 关键干路：必须保留 name（契约 §2.3）
KEY_ROAD_NAMES = (
    "东四十条", "东中街", "朝阳门北大街", "东二环", "工人体育场北路",
    "东直门南大街", "东直门内大街", "朝阳门内大街", "朝阳门外大街",
)

# POI：kind 取值见契约 §2.5
POI_KINDS = ("metro", "landmark", "office", "hotel", "culture", "park", "stadium", "education", "government")

WGS84_ATTRIBUTION = "© OpenStreetMap contributors (ODbL 1.0)"
SOURCE_LABEL = "OpenStreetMap · BBBike Beijing extract"
COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"
LICENSE_URL = "https://opendatacommons.org/licenses/odbl/1-0/"
EXTRACT_URL = "https://download.bbbike.org/osm/bbbike/Beijing/"


# --------------------------------------------------------------------------- #
# 1. 小工具
# --------------------------------------------------------------------------- #

def log(msg: str) -> None:
    print(f"[{TOOL_NAME}] {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"[{TOOL_NAME}] WARN: {msg}", flush=True)


def die(msg: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"[{TOOL_NAME}] ERROR: {msg}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / 1024 / 1024:.2f} MB"


def utc_now_iso() -> str:
    """带 +08:00 时区的 ISO 时间（数据面向北京，方便人工阅读）。"""
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).replace(microsecond=0).isoformat()


def hash_unit(*parts) -> float:
    """确定性哈希 → [0, 1)，用于无随机种子的可复现微调。"""
    h = hashlib.md5("|".join(str(p) for p in parts).encode("utf-8")).digest()
    return int.from_bytes(h[:8], "big") / float(1 << 64)


def write_json(path: Path, obj, *, compact: bool = False) -> int:
    """写出 JSON（UTF-8，末尾换行），返回字节数。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=2)
    data = (text + "\n").encode("utf-8")
    path.write_bytes(data)
    return len(data)


# --------------------------------------------------------------------------- #
# 2. 坐标：契约口径的经纬度 ↔ 局部米（等距圆柱近似，与前端公式严格一致）
# --------------------------------------------------------------------------- #

class LocalFrame:
    """以 ORIGIN 为原点的局部平面坐标：east / north（米），场景 x=east, z=-north。"""

    def __init__(self, lon: float, lat: float):
        self.lon = float(lon)
        self.lat = float(lat)
        self.kx = 111320.0 * math.cos(math.radians(self.lat))  # 每度经度米数
        self.kz = 110540.0                                     # 每度纬度米数

    def en(self, lon: float, lat: float):
        """(lon, lat) → (east, north)，米。"""
        return ((lon - self.lon) * self.kx, (lat - self.lat) * self.kz)

    def lonlat(self, east: float, north: float):
        """(east, north) → (lon, lat)。"""
        return (self.lon + east / self.kx, self.lat + north / self.kz)

    # 场景局部坐标：x = east, z = -north
    def xz(self, lon: float, lat: float):
        e, n = self.en(lon, lat)
        return (e, -n)

    def xz_to_lonlat(self, x: float, z: float):
        return self.lonlat(x, -z)


# --------------------------------------------------------------------------- #
# 3. 平面几何（全部在 east/north 平面内计算；输出时再映射到场景 / 经纬度）
# --------------------------------------------------------------------------- #

def signed_area(pts) -> float:
    """有向面积（east/north 右手系下 > 0 表示逆时针 CCW）。"""
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s * 0.5


def polygon_area(pts) -> float:
    return abs(signed_area(pts))


def clean_ring_en(pts, *, tol: float = 0.01):
    """清理 east/north 环：去闭合重复点 / 连续重复点 / 共线冗余点。不改变形状。"""
    out = []
    for p in pts:
        if not p or len(p) < 2:
            continue
        x, y = float(p[0]), float(p[1])
        if not (math.isfinite(x) and math.isfinite(y)):
            continue
        if not out or abs(x - out[-1][0]) > 1e-6 or abs(y - out[-1][1]) > 1e-6:
            out.append((x, y))
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) <= 1e-6 and abs(out[0][1] - out[-1][1]) <= 1e-6:
        out = out[:-1]
    # 去共线冗余点（中间点投影在相邻两点连线上且不构成尖刺）
    if len(out) > 3:
        changed = True
        guard = 0
        while changed and guard < 8:
            guard += 1
            changed = False
            new = []
            m = len(out)
            for i in range(m):
                prev = out[(i - 1) % m]
                cur = out[i]
                nxt = out[(i + 1) % m]
                ax, ay = cur[0] - prev[0], cur[1] - prev[1]
                bx, by = nxt[0] - cur[0], nxt[1] - cur[1]
                cross = ax * by - ay * bx
                dot = ax * bx + ay * by
                if abs(cross) <= tol * tol and dot > 0:
                    changed = True
                    continue
                new.append(cur)
            if len(new) >= 3:
                out = new
            else:
                break
    return out


def polygon_centroid(pts):
    """面积加权重心（对凹多边形同样成立）；退化时退回顶点平均。"""
    n = len(pts)
    if n == 0:
        return (0.0, 0.0)
    a = signed_area(pts)
    if abs(a) < 1e-6:
        return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)
    cx = cy = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cr = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cr
        cy += (y1 + y2) * cr
    return (cx / (6.0 * a), cy / (6.0 * a))


def bbox_of(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def bbox_intersects_rect(bbox, rect) -> bool:
    return not (bbox[2] < rect[0] or bbox[0] > rect[2] or bbox[3] < rect[1] or bbox[1] > rect[3])


def point_in_polygon(p, ring) -> bool:
    """射线法；含边界判定（先做顶点 / 边上的快速判断）。"""
    x, y = p
    n = len(ring)
    if n < 3:
        return False
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % n]
        if point_on_segment(p, a, b):
            return True
    inside = False
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            t = (y - y1) / (y2 - y1)
            if x < x1 + t * (x2 - x1):
                inside = not inside
    return inside


def point_on_segment(p, a, b, eps: float = 1e-7) -> bool:
    px, py = p
    ax, ay = a
    bx, by = b
    cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    if abs(cross) > eps:
        return False
    dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay)
    if dot < -eps:
        return False
    sq = (bx - ax) ** 2 + (by - ay) ** 2
    if dot > sq + eps:
        return False
    return True


def segments_intersect(a, b, c, d) -> bool:
    def orient(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        if abs(v) < 1e-9:
            return 0
        return 1 if v > 0 else -1

    o1 = orient(a, b, c)
    o2 = orient(a, b, d)
    o3 = orient(c, d, a)
    o4 = orient(c, d, b)
    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and point_on_segment(c, a, b):
        return True
    if o2 == 0 and point_on_segment(d, a, b):
        return True
    if o3 == 0 and point_on_segment(a, c, d):
        return True
    if o4 == 0 and point_on_segment(b, c, d):
        return True
    return False


def polygon_intersects_rect(ring, rect) -> bool:
    """多边形（east/north）与轴对齐矩形是否相交（含边界）。"""
    minx, miny, maxx, maxy = rect
    for p in ring:
        if minx <= p[0] <= maxx and miny <= p[1] <= maxy:
            return True
    corners = ((minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy))
    for c in corners:
        if point_in_polygon(c, ring):
            return True
    n = len(ring)
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % n]
        if segments_intersect(a, b, corners[0], corners[1]):
            return True
        if segments_intersect(a, b, corners[1], corners[2]):
            return True
        if segments_intersect(a, b, corners[2], corners[3]):
            return True
        if segments_intersect(a, b, corners[3], corners[0]):
            return True
    return False


def clip_line_to_rect(coords, rect):
    """Liang–Barsky 折线裁剪，返回若干段坐标数组（每段 >= 2 点）。"""
    minx, miny, maxx, maxy = rect

    def clip_seg(p0, p1):
        x0, y0 = p0
        dx, dy = p1[0] - x0, p1[1] - y0
        t0, t1 = 0.0, 1.0
        for p, q in ((-dx, x0 - minx), (dx, maxx - x0), (-dy, y0 - miny), (dy, maxy - y0)):
            if abs(p) < 1e-12:
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

    out = []
    cur = []
    for i in range(len(coords) - 1):
        seg = clip_seg(coords[i], coords[i + 1])
        if seg is None:
            if len(cur) >= 2:
                out.append(cur)
            cur = []
            continue
        a, b = seg
        if not cur:
            cur = [a, b]
        elif abs(cur[-1][0] - a[0]) <= 1e-9 and abs(cur[-1][1] - a[1]) <= 1e-9:
            cur.append(b)
        else:
            if len(cur) >= 2:
                out.append(cur)
            cur = [a, b]
    if len(cur) >= 2:
        out.append(cur)
    return out


def clip_polygon_to_rect(ring, rect):
    """Sutherland–Hodgman 多边形裁剪到矩形。返回新环（未闭合）或 []。"""
    minx, miny, maxx, maxy = rect
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

    def ix_minx(a, b):
        t = (minx - a[0]) / (b[0] - a[0])
        return (minx, a[1] + t * (b[1] - a[1]))

    def ix_maxx(a, b):
        t = (maxx - a[0]) / (b[0] - a[0])
        return (maxx, a[1] + t * (b[1] - a[1]))

    def ix_miny(a, b):
        t = (miny - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), miny)

    def ix_maxy(a, b):
        t = (maxy - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), maxy)

    for inside, intersect in (
        (lambda p: p[0] >= minx, ix_minx),
        (lambda p: p[0] <= maxx, ix_maxx),
        (lambda p: p[1] >= miny, ix_miny),
        (lambda p: p[1] <= maxy, ix_maxy),
    ):
        out = clip_edge(out, inside, intersect)
        if not out:
            return []
    dedup = []
    for p in out:
        if not dedup or abs(p[0] - dedup[-1][0]) > 1e-9 or abs(p[1] - dedup[-1][1]) > 1e-9:
            dedup.append(p)
    if len(dedup) >= 2 and abs(dedup[0][0] - dedup[-1][0]) <= 1e-9 and abs(dedup[0][1] - dedup[-1][1]) <= 1e-9:
        dedup.pop()
    return dedup if len(dedup) >= 3 else []


def simplify_rdp_indices(pts, tol: float):
    """RDP 抽稀（迭代栈实现），返回保留点索引。"""
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


def triangulate_earclip(pts):
    """简单多边形耳切三角化。返回 (pts_clean, triangles)；三角形按 CCW（法线 +up）。"""
    n = len(pts)
    if n < 3:
        return [], []
    if signed_area(pts) < 0:
        pts = list(reversed(pts))
    n = len(pts)
    if n == 3:
        return list(pts), [(0, 1, 2)]
    idx = list(range(n))
    tris = []
    guard = 0
    max_guard = max(256, n * n * 8)
    while len(idx) > 3 and guard < max_guard:
        guard += 1
        m = len(idx)
        clipped = False
        for k in range(m):
            i0 = idx[(k - 1) % m]
            i1 = idx[k]
            i2 = idx[(k + 1) % m]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-9:
                continue
            ok = True
            for j in idx:
                if j in (i0, i1, i2):
                    continue
                if point_in_triangle(pts[j], a, b, c):
                    ok = False
                    break
            if not ok:
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            clipped = True
            break
        if not clipped:
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
        i0 = remaining[0]
        for q in range(1, len(remaining) - 1):
            i1 = remaining[q]
            i2 = remaining[q + 1]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if abs(cross) > 1e-9:
                tris.append((i0, i1, i2) if cross > 0 else (i0, i2, i1))
    return pts, tris


def point_in_triangle(p, a, b, c, eps: float = 1e-9) -> bool:
    def cross(ux, uy, vx, vy):
        return ux * vy - uy * vx

    d1 = cross(b[0] - a[0], b[1] - a[1], p[0] - a[0], p[1] - a[1])
    d2 = cross(c[0] - b[0], c[1] - b[1], p[0] - b[0], p[1] - b[1])
    d3 = cross(a[0] - c[0], a[1] - c[1], p[0] - c[0], p[1] - c[1])
    has_neg = d1 < -eps or d2 < -eps or d3 < -eps
    has_pos = d1 > eps or d2 > eps or d3 > eps
    return not (has_neg and has_pos)


def tri_area3(p0, p1, p2) -> float:
    ux, uy, uz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    vx, vy, vz = p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]
    cx = uy * vz - uz * vy
    cy = uz * vx - ux * vz
    cz = ux * vy - uy * vx
    return 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)


# --------------------------------------------------------------------------- #
# 4. OSM 解析（gzip + ElementTree.iterparse 流式；只保留原点周边节点 / 相关 way）
# --------------------------------------------------------------------------- #

def parse_osm_gz(osm_path: Path, frame: LocalFrame, radius: float):
    """流式解析 .osm.gz，返回原点周边（含余量）的节点与相关 way。

    BBBike extract 顺序为「全部 node → 全部 way → 全部 relation」，因此一遍扫描即可：
    node 先缓存（限定在 radius + NODE_MARGIN_M 的方形内），way 解析时过滤出与缓存节点
    相关的要素。relation（多面体建筑 / 边界等）在本区域极少，忽略并在统计中报告。
    """
    limit = radius + NODE_MARGIN_M
    west = frame.lon - limit / frame.kx
    east = frame.lon + limit / frame.kx
    south = frame.lat - limit / frame.kz
    north = frame.lat + limit / frame.kz
    log(f"解析 {osm_path}（节点保留范围 ±{limit:.0f} m）…")
    t0 = time.time()
    nodes = {}
    ways = []
    rel_building = 0
    total_nodes = 0
    total_ways = 0
    seen = 0
    with gzip.open(osm_path, "rb") as fh:
        for _event, elem in ET.iterparse(fh, events=("end",)):
            tag = elem.tag
            if tag == "node":
                total_nodes += 1
                try:
                    lat = float(elem.get("lat"))
                    lon = float(elem.get("lon"))
                except (TypeError, ValueError):
                    elem.clear()
                    continue
                if south <= lat <= north and west <= lon <= east:
                    tags = {t.get("k"): t.get("v") for t in elem.findall("tag")}
                    nodes[elem.get("id")] = (lon, lat, tags)
                elem.clear()
            elif tag == "way":
                total_ways += 1
                tags = {t.get("k"): t.get("v") for t in elem.findall("tag")}
                if any(k in tags for k in OSM_INTERESTING_TAGS):
                    refs = [nd.get("ref") for nd in elem.findall("nd")]
                    if refs and any(r in nodes for r in refs):
                        ways.append((elem.get("id"), tags, refs))
                elem.clear()
            elif tag == "relation":
                if elem.find("tag[@k='building']") is not None:
                    rel_building += 1
                elem.clear()
            # 注意：不 clear <tag>/<nd>/<member> 子元素，否则父级 way 的 tags 会被清空
            seen += 1
            if seen % 500_000 == 0:
                log(f"  … 已扫描 {seen / 1e6:.1f}M 元素 | nodes={len(nodes)} ways={len(ways)}")
    log(f"扫描完成：nodes 总数 {total_nodes}、way 总数 {total_ways}；"
        f"缓存 nodes={len(nodes)}、相关 ways={len(ways)}、building relation={rel_building}；"
        f"耗时 {time.time() - t0:.1f}s")
    return {
        "nodes": nodes,
        "ways": ways,
        "totalNodes": total_nodes,
        "totalWays": total_ways,
        "relationBuildingTags": rel_building,
    }


def way_coords_runs(refs, nodes):
    """把 way 的 refs 转成「连续可用节点」的 runs（跨缺失节点断开）。"""
    runs = []
    cur = []
    for r in refs:
        node = nodes.get(r)
        if node is not None:
            cur.append(node)
        else:
            if len(cur) >= 2:
                runs.append(cur)
            cur = []
    if len(cur) >= 2:
        runs.append(cur)
    return runs


def find_site_way(osm) -> tuple[dict, list]:
    for wid, tags, refs in osm["ways"]:
        if wid == SITE_WAY_ID:
            coords = []
            for r in refs:
                node = osm["nodes"].get(r)
                if node is None:
                    continue
                coords.append(node)
            return {"id": wid, "tags": tags, "refs": refs}, coords
    return {}, []


# --------------------------------------------------------------------------- #
# 5. 高度模型
# --------------------------------------------------------------------------- #

_HEIGHT_RE = None


def parse_length_m(value):
    """把 OSM 长度字符串解析为米；支持 '35'、'35 m'、'35.5米'、'120,5'。"""
    import re
    if value is None:
        return None
    global _HEIGHT_RE
    if _HEIGHT_RE is None:
        _HEIGHT_RE = re.compile(
            r"^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meter|metre|meters|metres|米)?\s*$", re.I)
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
    import re
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


def clamp_height(h: float) -> float:
    return max(MIN_BUILDING_HEIGHT_M, min(MAX_BUILDING_HEIGHT_M, h))


def default_height_for(building_type: str, oid: str) -> float:
    spec = DEFAULT_HEIGHTS.get(building_type, DEFAULT_HEIGHT_FALLBACK)
    if isinstance(spec, (int, float)):
        return float(spec)
    lo, hi = spec
    return lo + (hi - lo) * hash_unit("height", oid)


def estimate_height(props: dict, oid: str, name: str):
    """返回 (height_m, source)；source ∈ {height, levels, override, default}。"""
    h = parse_length_m(props.get("height"))
    if h is not None:
        return clamp_height(h), "height"
    levels = parse_levels(props.get("building:levels"))
    if levels is not None:
        return clamp_height(levels * LEVEL_HEIGHT_M + GROUND_EXTRA_M), "levels"
    if name and name in HEIGHT_OVERRIDES:
        return clamp_height(HEIGHT_OVERRIDES[name]), "override"
    return clamp_height(default_height_for((props.get("building") or "yes").strip(), oid)), "default"


# --------------------------------------------------------------------------- #
# 6. 建筑筛选 / 挖空 / 白模几何
# --------------------------------------------------------------------------- #

def building_ring_en(osm, tags, refs, frame):
    """返回 (ring_en, ok)；只接受全部节点可用的闭合 way。"""
    if len(refs) < 4:
        return None, "too-few-refs"
    if refs[0] != refs[-1]:
        return None, "not-closed"
    coords = []
    for r in refs[:-1]:
        node = osm["nodes"].get(r)
        if node is None:
            return None, "missing-node"
        coords.append(node)
    # 经纬度层面清理，再投影到 east/north
    lonlat = []
    for lon, lat, _tags in coords:
        if not lonlat or abs(lon - lonlat[-1][0]) > 1e-9 or abs(lat - lonlat[-1][1]) > 1e-9:
            lonlat.append((lon, lat))
    if len(lonlat) < 3:
        return None, "degenerate"
    ring = clean_ring_en([frame.en(lon, lat) for lon, lat in lonlat])
    if len(ring) < 3:
        return None, "degenerate"
    return ring, "ok"


def select_buildings(osm, frame, radius):
    """筛选建筑：面积 / 闭合 / 范围过滤 → 高度估算 → 挖空。"""
    rect = (-radius, -radius, radius, radius)
    candidates = []
    stats = {"candidates": 0, "dropped": {}, "small": 0, "outside": 0}
    for wid, tags, refs in osm["ways"]:
        if "building" not in tags:
            continue
        if str(tags.get("building", "")).strip().lower() in ("", "no"):
            continue
        stats["candidates"] += 1
        ring, why = building_ring_en(osm, tags, refs, frame)
        if ring is None:
            stats["dropped"][why] = stats["dropped"].get(why, 0) + 1
            continue
        area = polygon_area(ring)
        if area < MIN_FOOTPRINT_AREA_M2:
            stats["small"] += 1
            continue
        bbox = bbox_of(ring)
        if not bbox_intersects_rect(bbox, rect):
            stats["outside"] += 1
            continue
        cx, cy = polygon_centroid(ring)
        rec = {
            "id": f"way/{wid}",
            "rawId": wid,
            "props": tags,
            "name": (tags.get("name") or "").strip(),
            "kind": (tags.get("building") or "yes").strip(),
            "ring": ring,
            "area": area,
            "bbox": bbox,
            "centroid": (cx, cy),
        }
        h, source = estimate_height(tags, f"way/{wid}", rec["name"])
        rec["height"] = h
        rec["heightSource"] = source
        candidates.append(rec)

    # 挖空英雄地块（契约 §2.2）
    carve_rect = (CARVE_BOX_LOCAL[0], CARVE_BOX_LOCAL[1], CARVE_BOX_LOCAL[2], CARVE_BOX_LOCAL[3])
    kept = []
    carved = []
    for rec in candidates:
        cx, cy = rec["centroid"]
        dist = math.hypot(cx, cy)
        reason = None
        if dist < CARVE_RADIUS_M:
            reason = f"质心距原点 {dist:.1f} m < {CARVE_RADIUS_M:.0f} m"
        elif polygon_intersects_rect(rec["ring"], carve_rect):
            reason = "footprint 与挖空框 x±72 / z±78 相交"
        if reason is not None:
            rec["carveReason"] = reason
            carved.append(rec)
        else:
            kept.append(rec)
    kept.sort(key=lambda r: int(r["rawId"]) if str(r["rawId"]).isdigit() else 0)
    carved.sort(key=lambda r: int(r["rawId"]) if str(r["rawId"]).isdigit() else 0)
    return kept, carved, candidates, stats


def estimate_triangle_count(buildings) -> int:
    total = 0
    for rec in buildings:
        n = len(rec["ring"])
        total += 2 * n + max(0, n - 2)
    return total


def prune_buildings(buildings, budget: int):
    """确定性裁剪：按 height×√area 升序丢弃，直到估算三角面 <= 预算。"""
    if estimate_triangle_count(buildings) <= budget:
        return buildings, 0
    ranked = sorted(
        buildings,
        key=lambda r: (r["height"] * math.sqrt(max(r["area"], 1.0)), int(r["rawId"]) if str(r["rawId"]).isdigit() else 0),
    )
    dropped = 0
    i = 0
    while i < len(ranked) and estimate_triangle_count(buildings) > budget:
        victim = ranked[i]
        i += 1
        buildings.remove(victim)
        dropped += 1
        if i > len(ranked):
            break
    return buildings, dropped


def build_white_model_geometry(buildings):
    """footprint 挤出 → glTF 顶点（x=east, y=up, z=-north）。

    顶点布局（每个 footprint 点 n → 3n 个顶点）：
      - 2n 个墙面顶点（墙底 b_i / 墙顶 t_i），法线为相邻两墙外法线的归一化平均；
      - n 个屋顶顶点 r_i，法线 (0, 1, 0)（glTF Y-up 下即 +up）。
    三角形：墙面每边 2 个（外法线朝外），屋顶用耳切法（CCW → 法线朝上）。
    """
    positions = array.array("f")
    normals = array.array("f")
    colors = array.array("B")
    indices = array.array("I")
    triangle_count = 0
    degenerate_rings = 0
    min_v = [math.inf, math.inf, math.inf]
    max_v = [-math.inf, -math.inf, -math.inf]

    def add_vertex(east, north, up, ne, nn, nu, rgb):
        # tile(east, north, up) → glTF(x=east, y=up, z=-north)
        positions.extend((east, up, -north))
        normals.extend((ne, nu, -nn))
        colors.extend((rgb[0], rgb[1], rgb[2], 255))
        if east < min_v[0]:
            min_v[0] = east
        if up < min_v[1]:
            min_v[1] = up
        if -north < min_v[2]:
            min_v[2] = -north
        if east > max_v[0]:
            max_v[0] = east
        if up > max_v[1]:
            max_v[1] = up
        if -north > max_v[2]:
            max_v[2] = -north

    for rec in buildings:
        enu = rec["ring"]
        n = len(enu)
        if n < 3:
            continue
        if signed_area(enu) < 0:
            enu = list(reversed(enu))
        n = len(enu)
        h = rec["height"]

        # 颜色：高度三档 + 确定性微抖动 + 冷色偏置；墙底压暗、屋顶提亮
        tier = 0 if h < TIER_LIMITS[0] else (1 if h < TIER_LIMITS[1] else 2)
        base = list(TIER_COLORS[tier])
        jitter = (hash_unit("color", rec["id"]) - 0.5) * 0.055
        base[0] = max(0.0, min(1.0, base[0] + jitter - 0.006))
        base[1] = max(0.0, min(1.0, base[1] + jitter))
        base[2] = max(0.0, min(1.0, base[2] + jitter + 0.008))
        col_top = tuple(int(round(c * 255)) for c in base)
        col_bot = tuple(int(round(min(1.0, c * BASE_DARKEN) * 255)) for c in base)
        col_roof = tuple(int(round(min(1.0, c * ROOF_GAIN) * 255)) for c in base)

        # 每条边外法线（CCW 环下 (dy, -dx) 指向外侧）
        edge_normals = []
        for i in range(n):
            x1, y1 = enu[i]
            x2, y2 = enu[(i + 1) % n]
            dx, dy = x2 - x1, y2 - y1
            length = math.hypot(dx, dy)
            edge_normals.append((dy / length, -dx / length) if length > 1e-9 else (0.0, 0.0))

        base_vertex = len(positions) // 3
        for i in range(n):
            x, y = enu[i]
            pnx, pny = edge_normals[(i - 1) % n]
            cnx, cny = edge_normals[i]
            nx, ny = pnx + cnx, pny + cny
            nl = math.hypot(nx, ny)
            if nl < 1e-9:
                nx, ny = cnx, cny
            else:
                nx, ny = nx / nl, ny / nl
            add_vertex(x, y, 0.0, nx, ny, 0.0, col_bot)   # b_i
            add_vertex(x, y, h, nx, ny, 0.0, col_top)     # t_i

        for i in range(n):
            j = (i + 1) % n
            b_i = base_vertex + 2 * i
            t_i = b_i + 1
            b_j = base_vertex + 2 * j
            t_j = b_j + 1
            p0 = (enu[i][0], enu[i][1], 0.0)
            p1 = (enu[j][0], enu[j][1], 0.0)
            p2 = (enu[j][0], enu[j][1], h)
            p3 = (enu[i][0], enu[i][1], h)
            if tri_area3(p0, p1, p2) > 1e-7:
                indices.extend((b_i, b_j, t_j))
                triangle_count += 1
            if tri_area3(p0, p2, p3) > 1e-7:
                indices.extend((b_i, t_j, t_i))
                triangle_count += 1

        # 屋顶
        roof_base = len(positions) // 3
        for i in range(n):
            add_vertex(enu[i][0], enu[i][1], h, 0.0, 0.0, 1.0, col_roof)
        pts_clean, tris = triangulate_earclip(list(enu))
        if len(pts_clean) != n:
            degenerate_rings += 1
            tris = [(a, b, c) for (a, b, c) in tris if a < n and b < n and c < n]
        for (a, b, c) in tris:
            pa = (enu[a][0], enu[a][1], h)
            pb = (enu[b][0], enu[b][1], h)
            pc = (enu[c][0], enu[c][1], h)
            if tri_area3(pa, pb, pc) > 1e-7:
                indices.extend((roof_base + a, roof_base + b, roof_base + c))
                triangle_count += 1

    # glTF 顶点本身即是 (east, up, -north)；场景 x=east, z=-north。
    bounds = {
        "min": min_v,
        "max": max_v,
        "localMinX": min_v[0],
        "localMaxX": max_v[0],
        "localMinZ": min_v[2],
        "localMaxZ": max_v[2],
        "minY": min_v[1],
        "maxY": max_v[1],
    }
    return {
        "positions": positions,
        "normals": normals,
        "colors": colors,
        "indices": indices,
        "vertexCount": len(positions) // 3,
        "triangleCount": triangle_count,
        "bounds": bounds,
        "degenerateRings": degenerate_rings,
    }


def write_glb(path: Path, geom, material, *, name: str = "white-models") -> dict:
    """写出 glTF 2.0 二进制（.glb）。返回诊断信息。"""
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

    def pad4(n: int) -> int:
        return (-n) % 4

    def to_bytes(arr) -> bytes:
        if sys.byteorder == "big":
            arr = array.array(arr.typecode, arr)
            arr.byteswap()
        return arr.tobytes()

    pos_bytes = to_bytes(positions)
    nrm_bytes = to_bytes(normals)
    col_bytes = colors.tobytes()
    idx_bytes = to_bytes(indices)

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

    def add_view(data: bytes, target: int) -> int:
        nonlocal offset
        aligned = offset + pad4(offset)
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
        {"bufferView": bv_nrm, "componentType": 5126, "count": vertex_count, "type": "VEC3"},
        {"bufferView": bv_col, "componentType": 5121, "normalized": True,
         "count": vertex_count, "type": "VEC4"},
        {"bufferView": bv_idx, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
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
        "extras": {
            "generator": GENERATOR,
            "vertexCount": vertex_count,
            "triangleCount": len(indices) // 3,
            "upAxis": "Y (x=east, y=up, z=-north)",
            "origin": {"lon": ORIGIN_LON, "lat": ORIGIN_LAT},
        },
    }
    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_chunk = json_bytes + b" " * pad4(len(json_bytes))
    bin_chunk = bin_data + b"\x00" * pad4(len(bin_data))
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<III", 0x46546C67, 2, total_length)
    chunk_json = struct.pack("<II", len(json_chunk), 0x4E4F534A)
    chunk_bin = struct.pack("<II", len(bin_chunk), 0x004E4942)
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
        "bounds": geom["bounds"],
    }


# --------------------------------------------------------------------------- #
# 7. 图层构建：roads / landuse / poi / site-footprint
# --------------------------------------------------------------------------- #

def round_coords_lonlat(coords, ndigits: int = 7):
    return [[round(float(c[0]), ndigits), round(float(c[1]), ndigits)] for c in coords]


def road_props(wid, tags, frame, suffix=""):
    props = {"id": f"way/{wid}{suffix}", "class": tags.get("highway", "")}
    name = (tags.get("name") or "").strip()
    if name:
        props["name"] = name
    ref = (tags.get("ref") or "").strip()
    if ref:
        props["ref"] = ref
    oneway = (tags.get("oneway") or "").strip().lower()
    if oneway in ("yes", "true", "1"):
        props["oneway"] = "yes"
    elif oneway in ("-1", "reverse"):
        props["oneway"] = "-1"
    lanes = parse_levels(tags.get("lanes"))
    if lanes is not None:
        props["lanes"] = int(lanes)
    if (tags.get("bridge") or "").strip().lower() in ("yes", "true", "1", "viaduct"):
        props["bridge"] = "yes"
    if (tags.get("tunnel") or "").strip().lower() in ("yes", "true", "1", "culvert"):
        props["tunnel"] = "yes"
    return props


def build_roads(osm, frame, radius):
    """车行 / 站点周边步道 LineString：分类 → 裁剪 → RDP(0.8m) → 属性精简。"""
    # 留 0.5 m 内缩，避免圆整后越出 meta.bbox
    rect = (-(radius - 0.5), -(radius - 0.5), radius - 0.5, radius - 0.5)
    features = []
    stats = {"candidates": 0, "kept": 0, "clippedAway": 0, "simplified": 0,
             "pointsBefore": 0, "pointsAfter": 0, "walkKept": 0}
    for wid, tags, refs in osm["ways"]:
        cls = (tags.get("highway") or "").strip()
        if not cls:
            continue
        is_drivable = cls in DRIVABLE_CLASSES or cls in DRIVABLE_LINK_CLASSES
        is_walk = cls in LOCAL_WALK_CLASSES
        if not (is_drivable or is_walk):
            continue
        stats["candidates"] += 1
        runs = way_coords_runs(refs, osm["nodes"])
        if not runs:
            continue
        kept_any = False
        for si, run in enumerate(runs):
            en = [frame.en(n[0], n[1]) for n in run]
            segments = clip_line_to_rect(en, rect)
            for seg in segments:
                if len(seg) < 2:
                    continue
                if is_walk:
                    # 只保留站点周边的步道（距离原点 <= LOCAL_WALK_RADIUS_M）
                    dmin = min(math.hypot(p[0], p[1]) for p in seg)
                    if dmin > LOCAL_WALK_RADIUS_M:
                        continue
                stats["pointsBefore"] += len(seg)
                keep_idx = simplify_rdp_indices(seg, ROAD_SIMPLIFY_TOL_M)
                if len(keep_idx) < 2:
                    keep_idx = [0, len(seg) - 1]
                stats["pointsAfter"] += len(keep_idx)
                if len(keep_idx) < len(seg):
                    stats["simplified"] += 1
                coords = [frame.lonlat(seg[i][0], seg[i][1]) for i in keep_idx]
                suffix = f"#{si}" if len(runs) > 1 else ""
                props = road_props(wid, tags, frame, suffix)
                features.append({
                    "type": "Feature",
                    "id": props["id"],
                    "properties": props,
                    "geometry": {"type": "LineString", "coordinates": round_coords_lonlat(coords)},
                })
                kept_any = True
                if is_walk:
                    stats["walkKept"] += 1
        if not kept_any:
            stats["clippedAway"] += 1
    # 确定性排序：按 class 优先级 + id
    class_order = {c: i for i, c in enumerate(DRIVABLE_CLASSES + DRIVABLE_LINK_CLASSES + LOCAL_WALK_CLASSES)}
    features.sort(key=lambda f: (class_order.get(f["properties"]["class"], 99), f["properties"]["id"]))
    stats["kept"] = len(features)
    stats["names"] = sorted({f["properties"]["name"] for f in features if f["properties"].get("name")})
    return features, stats


def classify_area(tags):
    """面状要素分类 → (kind, class_value)；kind ∈ park/forest/water/block/plaza/sports。"""
    lu = (tags.get("landuse") or "").strip().lower()
    le = (tags.get("leisure") or "").strip().lower()
    nat = (tags.get("natural") or "").strip().lower()
    ww = (tags.get("waterway") or "").strip().lower()
    hw = (tags.get("highway") or "").strip().lower()
    place = (tags.get("place") or "").strip().lower()
    area = (tags.get("area") or "").strip().lower()

    if nat == "water" or ww in ("riverbank", "dock", "canal") or lu in ("basin", "reservoir"):
        return ("water", nat or ww or lu or "water")
    if le == "swimming_pool":
        return ("water", le)
    if nat in ("wood", "forest") or lu == "forest":
        return ("forest", nat or lu)
    if le in ("pitch", "track", "stadium", "sports_centre", "sports_hall", "fitness_station"):
        return ("sports", le)
    if lu in ("recreation_ground", "village_green"):
        return ("park", lu)
    if nat in ("scrub", "grassland", "heath", "grass"):
        return ("park", nat)
    if le in ("park", "garden", "common", "playground", "nature_reserve", "dog_park"):
        return ("park", le)
    if lu in ("grass", "meadow", "flowerbed", "plant_nursery", "orchard", "allotments"):
        return ("park", lu)
    if place in ("square",) or (hw == "pedestrian" and area == "yes") or hw == "pedestrian":
        return ("plaza", place or hw)
    if lu:
        return ("block", lu)
    if le:
        return ("block", le)
    return None


def build_landuse(osm, frame, radius):
    """绿地 / 水系 / 地块 / 广场 / 体育场面：分类 → 面积过滤 → 裁剪。"""
    rect = (-(radius - 0.5), -(radius - 0.5), radius - 0.5, radius - 0.5)
    features = []
    stats = {"candidates": 0, "kept": 0, "small": 0, "clippedAway": 0,
             "kinds": {}, "keepAll": 0}
    for wid, tags, refs in osm["ways"]:
        if len(refs) < 4 or refs[0] != refs[-1]:
            continue
        if not any(k in tags for k in ("landuse", "leisure", "natural", "waterway", "place")):
            continue
        cls = classify_area(tags)
        if cls is None:
            continue
        kind, klass = cls
        stats["candidates"] += 1
        ring = []
        ok = True
        for r in refs[:-1]:
            node = osm["nodes"].get(r)
            if node is None:
                ok = False
                break
            ring.append(node)
        if not ok or len(ring) < 3:
            continue
        en = clean_ring_en([frame.en(n[0], n[1]) for n in ring])
        if len(en) < 3:
            continue
        keep_all = kind in ("water", "park", "forest")
        if not keep_all and polygon_area(en) < MIN_LANDUSE_AREA_M2:
            stats["small"] += 1
            continue
        clipped = clip_polygon_to_rect(en, rect)
        if len(clipped) < 3:
            stats["clippedAway"] += 1
            continue
        coords = [frame.lonlat(x, y) for x, y in clipped]
        coords.append(coords[0])  # GeoJSON 环闭合
        props = {"id": f"way/{wid}", "kind": kind, "class": klass}
        name = (tags.get("name") or "").strip()
        if name:
            props["name"] = name
        features.append({
            "type": "Feature",
            "id": f"way/{wid}",
            "properties": props,
            "geometry": {"type": "Polygon", "coordinates": [round_coords_lonlat(coords)]},
        })
        stats["kinds"][kind] = stats["kinds"].get(kind, 0) + 1
        if keep_all:
            stats["keepAll"] += 1
    features.sort(key=lambda f: (f["properties"]["kind"], f["properties"]["id"]))
    stats["kept"] = len(features)
    return features, stats


# POI 精选清单：
#   resolve = building（按 OSM building name 匹配）/ node（地铁站节点）/ area（面要素）/ road（道路点）
CURATED_POIS = (
    # 地铁站（node，距离最近的同名站）
    {"name": "东四十条站", "osmName": "东四十条", "kind": "metro", "weight": 5,
     "note": "地铁 2 号线", "resolve": "node"},
    {"name": "东直门站", "osmName": "东直门", "kind": "metro", "weight": 5,
     "note": "地铁 2 号线 / 13 号线 / 首都机场线", "resolve": "node"},
    {"name": "朝阳门站", "osmName": "朝阳门", "kind": "metro", "weight": 5,
     "note": "地铁 2 号线 / 6 号线", "resolve": "node"},
    {"name": "工人体育场站", "osmName": "工人体育场", "kind": "metro", "weight": 4,
     "note": "地铁 3 号线 / 17 号线（2023 年底开通）", "resolve": "node"},
    # 地标 / 写字楼 / 酒店
    {"name": "保利大厦", "osmName": "保利大厦酒店", "kind": "hotel", "weight": 5,
     "note": "保利大厦 · 酒店 / 写字楼", "resolve": "building"},
    {"name": "北京保利剧院", "osmName": "北京保利剧院", "kind": "culture", "weight": 4,
     "note": "保利剧院", "resolve": "building"},
    {"name": "中国保利集团", "osmName": "中国保利集团", "kind": "landmark", "weight": 4,
     "note": "保利集团总部", "resolve": "building"},
    {"name": "港澳中心", "osmName": "港澳中心", "kind": "hotel", "weight": 4,
     "note": "港澳中心 · 酒店 / 写字楼", "resolve": "building"},
    {"name": "首创大厦", "osmName": "首创大厦", "kind": "landmark", "weight": 4,
     "note": "首创大厦（东四十条桥东北角）", "resolve": "building"},
    {"name": "新保利大厦", "osmName": "新保利大厦", "kind": "landmark", "weight": 5,
     "note": "105.2 m · OSM 自带 height", "resolve": "building"},
    {"name": "五矿广场", "osmName": "五矿广场", "kind": "office", "weight": 4,
     "note": "五矿广场（多栋）", "resolve": "building"},
    {"name": "中国移动", "osmName": "中国移动", "kind": "office", "weight": 3,
     "note": "中国移动（东中街）", "resolve": "building"},
    {"name": "阳光国际大厦", "osmName": "阳光国际大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "新中大厦", "osmName": "新中大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "东环广场A座", "osmName": "东环广场A座", "kind": "office", "weight": 3,
     "note": "东环广场 A 座", "resolve": "building"},
    {"name": "东环广场B座", "osmName": "东环广场B座", "kind": "office", "weight": 3,
     "note": "东环广场 B 座", "resolve": "building"},
    {"name": "天辰大厦", "osmName": "天辰大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "亚洲大酒店", "osmName": "亚洲大酒店", "kind": "hotel", "weight": 3,
     "note": "酒店", "resolve": "building"},
    {"name": "北京喜剧院", "osmName": "北京喜剧院", "kind": "culture", "weight": 4,
     "note": "剧场", "resolve": "building"},
    {"name": "工人体育馆", "osmName": "工人体育馆", "kind": "stadium", "weight": 4,
     "note": "体育馆", "resolve": "building"},
    {"name": "北京工人体育场", "osmName": "北京工人体育场", "kind": "stadium", "weight": 5,
     "note": "工人体育场（足球场）", "resolve": "area"},
    {"name": "外交部新闻中心", "osmName": "外交部新闻中心", "kind": "government", "weight": 4,
     "note": "外交部新闻中心", "resolve": "building"},
    {"name": "文化和旅游部", "osmName": "中华人民共和国文化和旅游部", "kind": "government",
     "weight": 4, "note": "中华人民共和国文化和旅游部", "resolve": "building"},
    {"name": "悠唐生活广场", "osmName": "悠唐生活广场", "kind": "landmark", "weight": 3,
     "note": "购物中心", "resolve": "building"},
    {"name": "丰联广场", "osmName": "丰联广场", "kind": "landmark", "weight": 3,
     "note": "购物中心 / 写字楼", "resolve": "building"},
    {"name": "中国人寿大厦", "osmName": "中国人寿大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "国华投资大厦", "osmName": "国华投资大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "居然大厦", "osmName": "居然大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "CYTS Plaza", "osmName": "CYTS Plaza", "kind": "office", "weight": 3,
     "note": "中青旅大厦", "resolve": "building"},
    {"name": "天恒大厦", "osmName": "天恒大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "泛利大厦", "osmName": "泛利大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "中纺大厦", "osmName": "中纺大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "中海油大厦", "osmName": "中海油大厦", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "中国人保办公楼", "osmName": "中国人保办公楼", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "北京电信大楼", "osmName": "北京电信大楼", "kind": "office", "weight": 3,
     "note": "写字楼", "resolve": "building"},
    {"name": "东直门交通枢纽", "osmName": "东直门交通枢纽", "kind": "landmark", "weight": 4,
     "note": "交通枢纽 / 商业综合体", "resolve": "building"},
    # 公园 / 广场
    {"name": "新中街城市森林公园", "osmName": "新中街城市森林公园", "kind": "park", "weight": 3,
     "note": "城市森林公园", "resolve": "area"},
    {"name": "东四奥林匹克社区公园", "osmName": "东四奥林匹克社区公园", "kind": "park",
     "weight": 3, "note": "社区公园", "resolve": "area"},
    {"name": "东岳文化广场", "osmName": "东岳文化广场", "kind": "park", "weight": 3,
     "note": "文化广场", "resolve": "area"},
    # 道路型 POI（簋街在 OSM 无同名要素，取东直门内大街上的点）
    {"name": "簋街", "osmName": "东直门内大街", "kind": "landmark", "weight": 4,
     "note": "东直门内大街 · 餐饮街（取道路点）", "resolve": "road",
     "targetXZ": (-450.0, -1105.0)},
)

METRO_LINE_NOTES = {
    "东四十条": "地铁 2 号线",
    "东直门": "地铁 2 号线 / 13 号线 / 首都机场线",
    "朝阳门": "地铁 2 号线 / 6 号线",
    "工人体育场": "地铁 3 号线 / 17 号线",
}


def build_poi_indexes(osm, frame, buildings_all, landuse_features):
    """建立 POI 解析所需的索引。"""
    bld_by_name = {}
    for rec in buildings_all:
        name = rec["name"]
        if not name:
            continue
        # 选面积最大的同名 footprint（多栋同名建筑取主楼）
        if name not in bld_by_name or rec["area"] > bld_by_name[name]["area"]:
            bld_by_name[name] = rec
    node_by_name = {}
    for node in osm["nodes"].values():
        lon, lat, tags = node
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        if tags.get("railway") == "station" or tags.get("station") == "subway":
            e, n = frame.en(lon, lat)
            dist = math.hypot(e, n)
            if name not in node_by_name or dist < node_by_name[name]["distance"]:
                node_by_name[name] = {"lon": lon, "lat": lat, "e": e, "n": n, "distance": dist,
                                      "tags": tags}
    # 面要素索引：by name（用经纬度质心的局部坐标）
    area_index = {}
    for f in landuse_features:
        name = f["properties"].get("name")
        if not name:
            continue
        ring = [frame.en(lon, lat) for lon, lat in f["geometry"]["coordinates"][0][:-1]]
        if len(ring) < 3:
            continue
        c = polygon_centroid(ring)
        area_index.setdefault(name, []).append({"ring": ring, "centroid": c})
    # 道路索引：name → [(e, n), ...]
    road_index = {}
    for wid, tags, refs in osm["ways"]:
        name = (tags.get("name") or "").strip()
        if not name or not tags.get("highway"):
            continue
        pts = []
        for run in way_coords_runs(refs, osm["nodes"]):
            pts.extend(frame.en(n[0], n[1]) for n in run)
        if pts:
            road_index.setdefault(name, []).extend(pts)
    return bld_by_name, node_by_name, area_index, road_index


def nearest_point_on_polyline(polyline, target):
    best = None
    best_d = math.inf
    for i in range(len(polyline) - 1):
        ax, ay = polyline[i]
        bx, by = polyline[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        if L2 < 1e-12:
            px, py = ax, ay
        else:
            t = max(0.0, min(1.0, ((target[0] - ax) * dx + (target[1] - ay) * dy) / L2))
            px, py = ax + t * dx, ay + t * dy
        d = math.hypot(px - target[0], py - target[1])
        if d < best_d:
            best_d = d
            best = (px, py)
    return best, best_d


def build_poi(osm, frame, buildings_all, landuse_features, radius):
    """精选 POI：地铁站 + 可识别地标建筑 + 面状公园 + 道路点。"""
    bld_by_name, node_by_name, area_index, road_index = build_poi_indexes(
        osm, frame, buildings_all, landuse_features)
    hidden = set()
    curated_node_names = set()
    rows = []
    for spec in CURATED_POIS:
        name = spec["name"]
        kind = spec["kind"]
        resolve = spec["resolve"]
        lon = lat = None
        footprint_bbox = None
        note = spec.get("note", "")
        if resolve == "node":
            osm_name = spec.get("osmName") or name
            hit = node_by_name.get(osm_name)
            if hit is None:
                continue
            curated_node_names.add(osm_name)
            lon, lat = hit["lon"], hit["lat"]
        elif resolve == "building":
            rec = bld_by_name.get(spec.get("osmName") or name)
            if rec is None:
                continue
            e, n = rec["centroid"]
            lon, lat = frame.lonlat(e, n)
            ring = rec["ring"]
            minx = min(p[0] for p in ring)
            maxx = max(p[0] for p in ring)
            minn = min(p[1] for p in ring)
            maxn = max(p[1] for p in ring)
            footprint_bbox = [round(minx, 1), round(-maxn, 1), round(maxx, 1), round(-minn, 1)]
        elif resolve == "area":
            hits = area_index.get(spec.get("osmName") or name)
            if not hits:
                continue
            best = max(hits, key=lambda h: polygon_area(h["ring"]))
            e, n = best["centroid"]
            lon, lat = frame.lonlat(e, n)
            ring = best["ring"]
            minx = min(p[0] for p in ring)
            maxx = max(p[0] for p in ring)
            minn = min(p[1] for p in ring)
            maxn = max(p[1] for p in ring)
            footprint_bbox = [round(minx, 1), round(-maxn, 1), round(maxx, 1), round(-minn, 1)]
        elif resolve == "road":
            pts = road_index.get(spec.get("osmName") or name)
            if not pts:
                continue
            target = spec.get("targetXZ")
            if target is not None:
                candidates = [(pt, math.hypot(pt[0] - target[0], pt[1] - target[1])) for pt in pts]
                pt = min(candidates, key=lambda c: c[1])[0]
            else:
                pt = min(pts, key=lambda p: math.hypot(p[0], p[1]))
            lon, lat = frame.lonlat(pt[0], pt[1])
        else:
            continue
        if lon is None or lat is None:
            continue
        loc = frame.xz(lon, lat)
        x, z = loc
        dist = math.hypot(x, z)
        if dist > radius * 1.12:
            continue
        key = name
        if key in hidden:
            continue
        hidden.add(key)
        rows.append({
            "name": name,
            "kind": kind,
            "lon": lon,
            "lat": lat,
            "x": x,
            "z": z,
            "distanceM": dist,
            "note": note,
            "weight": int(spec["weight"]),
            "footprintBBox": footprint_bbox,
        })
    # 补充：半径内所有 subway 站点（若精选漏掉；按 OSM name 去重，不与精选重复）
    for name, hit in sorted(node_by_name.items()):
        poi_name = name + "站"
        if name in curated_node_names or name in hidden or poi_name in hidden:
            continue
        dist = hit["distance"]
        if dist > radius:
            continue
        tags = hit["tags"]
        if not (tags.get("station") == "subway" or tags.get("subway") == "yes"):
            continue
        loc = frame.xz(hit["lon"], hit["lat"])
        rows.append({
            "name": poi_name,
            "kind": "metro",
            "lon": hit["lon"], "lat": hit["lat"],
            "x": loc[0], "z": loc[1], "distanceM": dist,
            "note": METRO_LINE_NOTES.get(name, "地铁站"),
            "weight": 5 if dist < 600 else 4,
            "footprintBBox": None,
        })
        hidden.add(poi_name)
    # 按名称去重（保守：同名只留首个）
    dedup = []
    seen_names = set()
    for row in rows:
        if row["name"] in seen_names:
            continue
        seen_names.add(row["name"])
        dedup.append(row)
    rows = dedup
    # 排序（距离升序，同距按名称）后编号
    rows.sort(key=lambda r: (round(r["distanceM"], 1), r["name"]))
    pois = []
    for i, row in enumerate(rows):
        pois.append({
            "id": f"poi/{i + 1:02d}",
            "name": row["name"],
            "kind": row["kind"],
            "lon": round(row["lon"], 7),
            "lat": round(row["lat"], 7),
            "x": round(row["x"], 1),
            "z": round(row["z"], 1),
            "distanceM": round(row["distanceM"], 1),
            "note": row["note"],
            "weight": row["weight"],
            **({"footprintBBox": row["footprintBBox"]} if row["footprintBBox"] else {}),
        })
    stats = {
        "count": len(pois),
        "kinds": {},
        "withFootprint": sum(1 for p in pois if "footprintBBox" in p),
        "curated": len(CURATED_POIS),
    }
    for p in pois:
        stats["kinds"][p["kind"]] = stats["kinds"].get(p["kind"], 0) + 1
    return pois, stats


# --------------------------------------------------------------------------- #
# 8. 富华大厦地块 / 塔楼 / 庭院（site-footprint.geojson）
# --------------------------------------------------------------------------- #

def rect_ring_en(cx, cz, w, d):
    """局部场景矩形（x 为东西、z 为南北）→ east/north 平面环（CCW）。"""
    half_w, half_d = w * 0.5, d * 0.5
    # 场景坐标 → en：e = x, n = -z
    corners = [
        (cx - half_w, cz - half_d),
        (cx + half_w, cz - half_d),
        (cx + half_w, cz + half_d),
        (cx - half_w, cz + half_d),
    ]
    return [(x, -z) for (x, z) in corners]


def build_site_footprint(site_way, site_coords, frame):
    features = []
    if not site_coords:
        die(f"OSM 数据里找不到富华大厦地块 way/{SITE_WAY_ID}")
    lonlat = [(n[0], n[1]) for n in site_coords]
    ring = clean_ring_en([frame.en(lon, lat) for lon, lat in lonlat])
    if len(ring) < 3:
        die(f"富华大厦地块 way/{SITE_WAY_ID} 几何退化")
    area = polygon_area(ring)
    coords = [frame.lonlat(e, n) for e, n in ring]
    coords.append(coords[0])
    tags = site_way.get("tags", {})
    features.append({
        "type": "Feature",
        "id": f"way/{SITE_WAY_ID}",
        "properties": {
            "kind": "site",
            "id": f"way/{SITE_WAY_ID}",
            "name": tags.get("name") or ORIGIN_LABEL,
            "class": tags.get("landuse") or "commercial",
            "areaM2": round(area, 1),
            "centerXZ": [0.0, 0.0],
        },
        "geometry": {"type": "Polygon", "coordinates": [round_coords_lonlat(coords)]},
    })
    for tid, cx, cz, w, d in TOWERS:
        ring_en = rect_ring_en(cx, cz, w, d)
        if signed_area(ring_en) < 0:
            ring_en = list(reversed(ring_en))
        coords = [frame.lonlat(e, n) for e, n in ring_en]
        coords.append(coords[0])
        features.append({
            "type": "Feature",
            "id": f"tower/{tid}",
            "properties": {
                "kind": "tower",
                "id": f"tower/{tid}",
                "towerId": tid,
                "name": f"{tid} 座",
                "x": cx,
                "z": cz,
                "widthM": w,
                "depthM": d,
            },
            "geometry": {"type": "Polygon", "coordinates": [round_coords_lonlat(coords)]},
        })
    minx, minz, maxx, maxz = COURTYARD_RECT_LOCAL
    cx, cz = (minx + maxx) * 0.5, (minz + maxz) * 0.5
    ring_en = rect_ring_en(cx, cz, maxx - minx, maxz - minz)
    if signed_area(ring_en) < 0:
        ring_en = list(reversed(ring_en))
    coords = [frame.lonlat(e, n) for e, n in ring_en]
    coords.append(coords[0])
    features.append({
        "type": "Feature",
        "id": "courtyard/main",
        "properties": {
            "kind": "courtyard",
            "id": "courtyard/main",
            "name": "中央庭院",
            "x": cx,
            "z": cz,
            "widthM": maxx - minx,
            "depthM": maxz - minz,
            "schematic": True,
        },
        "geometry": {"type": "Polygon", "coordinates": [round_coords_lonlat(coords)]},
    })
    return features


# --------------------------------------------------------------------------- #
# 9. meta.json 组装
# --------------------------------------------------------------------------- #

def compute_meta(*, args, frame, radius, glb_info, buildings_kept, carved, height_sources,
                 roads, road_stats, landuse, landuse_stats, pois, poi_stats,
                 site_features, osm_stats, white_stats, bbox, local_extent):
    glb_bytes = glb_info["bytes"]
    layers = {
        "whiteModels": {
            "path": "data/site/white-models.glb",
            "count": len(buildings_kept),
            "triangles": glb_info["triangleCount"],
        },
        "roads": {"path": "data/site/roads.geojson", "count": len(roads)},
        "landuse": {"path": "data/site/landuse.geojson", "count": len(landuse)},
        "poi": {"path": "data/site/poi.json", "count": len(pois)},
        "siteFootprint": {"path": "data/site/site-footprint.geojson", "count": len(site_features)},
    }
    meta = {
        "name": "东四十条 · 街区语境数据",
        "generatedAt": utc_now_iso(),
        "generator": GENERATOR,
        "source": SOURCE_LABEL,
        "sourceInfo": {
            "file": str(args.osm_gz),
            "fileBytes": args.osm_gz.stat().st_size if args.osm_gz.exists() else None,
            "extractUrl": EXTRACT_URL,
            "nodes": osm_stats["totalNodes"],
            "ways": osm_stats["totalWays"],
            "relationBuildingTags": osm_stats["relationBuildingTags"],
            "note": "BBBike Beijing extract（OSM XML 0.6，先 node 后 way；relation 未参与白模构建）",
        },
        "attribution": WGS84_ATTRIBUTION,
        "license": "ODbL 1.0",
        "licenseUrl": LICENSE_URL,
        "copyrightUrl": COPYRIGHT_URL,
        "origin": {"lon": round(frame.lon, 6), "lat": round(frame.lat, 6), "label": ORIGIN_LABEL},
        "bbox": [round(v, 7) for v in bbox],
        "radiusM": radius,
        "localExtent": {k: round(v, 1) for k, v in local_extent.items()},
        "coordConvention": {
            "local": "+X = 东，+Y = 上，+Z = 南（单位米）；北 = -Z",
            "lonlatToLocal": "x = (lon - origin.lon) * 111320 * cos(origin.lat * PI / 180); z = -(lat - origin.lat) * 110540",
            "gltf": "顶点 (x=east, y=up, z=-north)；Three.js 加载后即为 +X 东 / +Z 南，无需旋转",
        },
        "layers": layers,
        "stats": {
            "buildings": len(buildings_kept),
            "roads": len(roads),
            "landuse": len(landuse),
            "poi": len(pois),
            "carvedBuildings": len(carved),
            "prunedBuildings": white_stats.get("pruned", 0),
            "triangles": glb_info["triangleCount"],
            "vertices": glb_info["vertexCount"],
            "glbBytes": glb_bytes,
            "roadsPoints": road_stats["pointsAfter"],
            "heightSources": height_sources,
        },
        "heightModel": {
            "levelHeight": LEVEL_HEIGHT_M,
            "groundExtra": GROUND_EXTRA_M,
            "priority": ["height tag", "building:levels", "name override", "type default"],
            "validRangeM": [MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M],
            "overrideCount": len(HEIGHT_OVERRIDES),
            "note": "高度为 OSM / 名称估算示意值，非测绘、非实测；有效范围 3–180 m，超出夹取",
        },
        "carved": {
            "count": len(carved),
            "rule": {
                "box": list(CARVE_BOX_LOCAL),
                "boxSpace": "局部米 x∈[-72,72] ∧ z∈[-78,78]（footprint 与该框相交即剔除）",
                "radiusM": CARVE_RADIUS_M,
                "radiusRule": "质心距原点 < 95 m",
            },
            "buildings": [
                {"id": r["id"], "name": r["name"], "distanceM": round(math.hypot(*r["centroid"]), 1),
                 "reason": r["carveReason"]}
                for r in carved
            ],
        },
        "landuseKinds": landuse_stats["kinds"],
        "poiKinds": poi_stats["kinds"],
        "roadNames": KEY_ROAD_NAMES,
        "limitations": [
            "OSM footprint 由社区绘制，存在简化 / 偏移 / 缺失；高度多为估算（仅少数建筑带 height tag）",
            "高度模型为展示用估算：height → levels×3.2+1.2 → 名称 override → 类型默认，与真实竣工高度可能差别较大",
            "未引入 DEM，地面按 0 m 处理；无地形起伏",
            "道路 RDP 抽稀容差 0.8 m，几何误差 ≤ 0.8 m",
            "白模不含富华大厦自身楼栋（已按挖空规则剔除），避免与英雄 GLB 重叠",
            "非测绘 / 非 BIM 成果，坐标与几何仅供展示",
        ],
    }
    return meta


# --------------------------------------------------------------------------- #
# 10. 校验（--verify-only / 生成后自检）
# --------------------------------------------------------------------------- #

class Verifier:
    def __init__(self, out_dir: Path):
        self.out = out_dir
        self.failures = []
        self.checks = []

    def check(self, name: str, ok: bool, detail: str = ""):
        self.checks.append((name, bool(ok), detail))
        if not ok:
            self.failures.append((name, detail))
        return ok

    def load_json(self, rel: str):
        path = self.out / rel
        if not path.exists():
            self.check(f"{rel} 存在", False, f"缺少文件 {path}")
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            self.check(f"{rel} JSON 可解析", False, str(exc))
            return None

    def summary(self) -> bool:
        width = max((len(n) for n, _, _ in self.checks), default=10)
        for name, ok, detail in self.checks:
            mark = "PASS" if ok else "FAIL"
            print(f"  [{mark}] {name.ljust(width)}  {detail}", flush=True)
        print("", flush=True)
        if self.failures:
            print(f"校验失败：{len(self.failures)} 项", file=sys.stderr, flush=True)
            for name, detail in self.failures:
                print(f"  - {name}: {detail}", file=sys.stderr, flush=True)
            return False
        print(f"校验通过：{len(self.checks)} 项全部 PASS", flush=True)
        return True


def _read_glb(path: Path):
    """读取并解析 .glb：返回 (json_dict, bin_bytes, header_info, error)。"""
    if not path.exists():
        return None, b"", {}, f"缺少文件 {path}"
    data = path.read_bytes()
    if len(data) < 20:
        return None, b"", {}, "文件过短"
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        return None, b"", {}, "magic 不是 glTF"
    if version != 2:
        return None, b"", {}, f"version={version} != 2"
    if length != len(data):
        return None, b"", {}, f"header length={length} 与实际 {len(data)} 不一致"
    offset = 12
    gltf = None
    bin_data = b""
    chunks = []
    while offset + 8 <= len(data):
        clen, ctype = struct.unpack("<II", data[offset:offset + 8])
        offset += 8
        chunk = data[offset:offset + clen]
        offset += clen
        chunks.append((ctype, clen))
        if ctype == 0x4E4F534A:  # JSON
            try:
                gltf = json.loads(chunk.decode("utf-8"))
            except Exception as exc:  # noqa: BLE001
                return None, b"", {}, f"JSON chunk 解析失败: {exc}"
        elif ctype == 0x004E4942:  # BIN
            bin_data = chunk
    if gltf is None:
        return None, b"", {}, "缺少 JSON chunk"
    if offset != len(data):
        return None, b"", {}, "chunk 未对齐到文件末尾"
    return gltf, bin_data, {"chunks": chunks, "bytes": len(data)}, None


def _decode_accessor(gltf, bin_data, accessor_index: int):
    """解码简单 accessor（POSITION / 索引），返回 list。仅支持本项目用到的类型。"""
    acc = gltf["accessors"][accessor_index]
    bv = gltf["bufferViews"][acc["bufferView"]]
    comp = acc["componentType"]
    count = acc["count"]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    fmt = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}[comp]
    size = struct.calcsize(fmt)
    stride = bv.get("byteStride") or size * ncomp
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    out = []
    for i in range(count):
        off = base + i * stride
        vals = struct.unpack_from("<" + fmt * ncomp, bin_data, off)
        out.append(vals[0] if ncomp == 1 else vals)
    return out


def verify_outputs(out_dir: Path) -> bool:
    v = Verifier(out_dir)
    meta = v.load_json("meta.json")
    if meta is None:
        return v.summary()

    # ---- meta 字段 ----
    required = ("name", "generatedAt", "source", "attribution", "license", "origin",
                "bbox", "radiusM", "localExtent", "layers", "stats", "heightModel")
    missing = [k for k in required if k not in meta]
    v.check("meta.json 字段完整", not missing, f"缺失 {missing}" if missing else "OK")
    v.check("meta 署名 ODbL", "ODbL" in str(meta.get("license", "")) and
            "OpenStreetMap" in str(meta.get("attribution", "")), str(meta.get("attribution")))
    origin = meta.get("origin", {})
    origin_ok = all(isinstance(origin.get(k), (int, float)) for k in ("lon", "lat"))
    v.check("meta.origin 合法", origin_ok, f"{origin}")
    bbox = meta.get("bbox", [])
    v.check("meta.bbox 4 个数且 west<south<east<north 顺序正确",
            len(bbox) == 4 and bbox[0] < bbox[2] and bbox[1] < bbox[3], str(bbox))
    ext = meta.get("localExtent", {})
    v.check("meta.localExtent 合法", all(k in ext for k in ("minX", "maxX", "minZ", "maxZ"))
            and ext.get("minX", 0) < 0 < ext.get("maxX", 0) and ext.get("minZ", 0) < 0 < ext.get("maxZ", 0),
            str(ext))
    hm = meta.get("heightModel", {})
    v.check("heightModel 字段", hm.get("levelHeight") == 3.2 and hm.get("groundExtra") == 1.2
            and len(hm.get("priority", [])) == 4, str(hm.get("priority")))

    # ---- 各图层文件存在 / 数量 ----
    layer_files = {
        "roads": ("roads.geojson", "data/site/roads.geojson"),
        "landuse": ("landuse.geojson", "data/site/landuse.geojson"),
    }
    file_count = {}
    for key, (fname, _path) in layer_files.items():
        layer = meta.get("layers", {}).get(key, {})
        v.check(f"layers.{key}.path 正确", layer.get("path") == f"data/site/{fname}",
                str(layer.get("path")))
        fc = v.load_json(fname)
        if fc is None:
            continue
        if fc.get("type") != "FeatureCollection" or not isinstance(fc.get("features"), list):
            v.check(f"{fname} 是 FeatureCollection", False, "结构不符")
            continue
        feats = fc["features"]
        file_count[key] = len(feats)
        v.check(f"{fname} 数量与 meta 一致", len(feats) == layer.get("count"),
                f"{len(feats)} vs {layer.get('count')}")
    poi_doc = v.load_json("poi.json")
    pois = (poi_doc or {}).get("pois") if isinstance(poi_doc, dict) else None
    if not isinstance(pois, list):
        v.check("poi.json 结构", False, "缺少 pois 数组")
        pois = []
    else:
        file_count["poi"] = len(pois)
        v.check("poi.json 数量与 meta 一致",
                len(pois) == meta.get("layers", {}).get("poi", {}).get("count"),
                f"{len(pois)} vs {meta.get('layers', {}).get('poi', {}).get('count')}")
    site = v.load_json("site-footprint.geojson")
    site_feats = (site or {}).get("features") if isinstance(site, dict) else None
    if not isinstance(site_feats, list):
        v.check("site-footprint.geojson 结构", False, "缺少 features")
        site_feats = []

    stats = meta.get("stats", {})
    v.check("stats.buildings == layers.whiteModels.count",
            stats.get("buildings") == meta.get("layers", {}).get("whiteModels", {}).get("count"),
            f"{stats.get('buildings')}")
    v.check("stats.roads == roads 数量", stats.get("roads") == file_count.get("roads"),
            f"{stats.get('roads')} vs {file_count.get('roads')}")
    v.check("stats.landuse == landuse 数量", stats.get("landuse") == file_count.get("landuse"),
            f"{stats.get('landuse')} vs {file_count.get('landuse')}")
    v.check("stats.poi == poi 数量", stats.get("poi") == file_count.get("poi"),
            f"{stats.get('poi')} vs {file_count.get('poi')}")
    hs = stats.get("heightSources", {})
    v.check("heightSources 合计 == buildings",
            sum(hs.values()) == stats.get("buildings"),
            f"{sum(hs.values())} vs {stats.get('buildings')}")

    # ---- GLB ----
    glb_path = out_dir / "white-models.glb"
    gltf, bin_data, header, err = _read_glb(glb_path)
    if err:
        v.check("white-models.glb 结构", False, err)
        gltf = None
    if gltf is not None:
        v.check("glb JSON 结构", gltf.get("asset", {}).get("version") == "2.0",
                gltf.get("asset", {}).get("version"))
        v.check("glb scenes/nodes/meshes/materials",
                len(gltf.get("scenes", [])) == 1 and len(gltf.get("nodes", [])) >= 1
                and len(gltf.get("meshes", [])) == 1 and len(gltf.get("materials", [])) == 1,
                f"scenes={len(gltf.get('scenes', []))} nodes={len(gltf.get('nodes', []))} "
                f"meshes={len(gltf.get('meshes', []))} materials={len(gltf.get('materials', []))}")
        prim = gltf["meshes"][0]["primitives"][0]
        attrs = prim.get("attributes", {})
        v.check("glb primitive 含 POSITION/NORMAL/COLOR_0/indices",
                all(k in attrs for k in ("POSITION", "NORMAL", "COLOR_0")) and "indices" in prim,
                str(sorted(attrs)))
        v.check("glb primitive mode == TRIANGLES(4)", prim.get("mode") == 4, str(prim.get("mode")))
        mat = gltf["materials"][0]
        pbr = mat.get("pbrMetallicRoughness", {})
        v.check("glb 材质参数（metallic≈0.02 / roughness≈0.85 / doubleSided）",
                abs(pbr.get("metallicFactor", -1) - 0.02) < 1e-6
                and abs(pbr.get("roughnessFactor", -1) - 0.85) < 1e-6
                and mat.get("doubleSided") is True,
                f"metallic={pbr.get('metallicFactor')} roughness={pbr.get('roughnessFactor')} "
                f"doubleSided={mat.get('doubleSided')}")
        # bufferView / accessor 边界
        views_ok = True
        for bv in gltf.get("bufferViews", []):
            if bv.get("byteOffset", 0) + bv["byteLength"] > len(bin_data):
                views_ok = False
            if bv.get("byteOffset", 0) % 4 != 0:
                views_ok = False
        v.check("glb bufferView 对齐 / 不越界", views_ok, f"BIN={len(bin_data)} B")
        buf = gltf.get("buffers", [{}])[0]
        v.check("glb buffer.byteLength == BIN chunk 长度",
                buf.get("byteLength", -1) <= len(bin_data) and buf.get("byteLength", -1) > 0,
                f"{buf.get('byteLength')} vs {len(bin_data)}")
        pos_acc = gltf["accessors"][attrs["POSITION"]]
        idx_acc = gltf["accessors"][prim["indices"]]
        col_acc = gltf["accessors"][attrs["COLOR_0"]]
        v.check("glb accessor 类型（POSITION VEC3 float / COLOR_0 VEC4 ubyte normalized / indices SCALAR uint）",
                pos_acc.get("type") == "VEC3" and pos_acc.get("componentType") == 5126
                and col_acc.get("type") == "VEC4" and col_acc.get("componentType") == 5121
                and col_acc.get("normalized") is True
                and idx_acc.get("type") == "SCALAR" and idx_acc.get("componentType") == 5125,
                f"pos={pos_acc.get('type')}/{pos_acc.get('componentType')} "
                f"col={col_acc.get('type')}/{col_acc.get('componentType')} "
                f"idx={idx_acc.get('type')}/{idx_acc.get('componentType')}")
        positions = _decode_accessor(gltf, bin_data, attrs["POSITION"])
        indices = _decode_accessor(gltf, bin_data, prim["indices"])
        vc = pos_acc["count"]
        v.check("glb POSITION count == NORMAL count == COLOR_0 count",
                vc == gltf["accessors"][attrs["NORMAL"]]["count"] == col_acc["count"], str(vc))
        v.check("glb 索引范围合法", len(indices) > 0 and max(indices) < vc and min(indices) >= 0,
                f"indexCount={len(indices)} max={max(indices) if indices else None} vertexCount={vc}")
        v.check("glb 索引数量为 3 的倍数", len(indices) % 3 == 0, str(len(indices)))
        tri = len(indices) // 3
        v.check("glb 三角面 < 120k", tri < TRIANGLE_BUDGET, f"{tri} tri")
        v.check("glb 文件 < 5 MB", header["bytes"] < GLB_MAX_BYTES, fmt_size(header["bytes"]))
        v.check("glb triangleCount 与 meta 一致",
                tri == meta.get("layers", {}).get("whiteModels", {}).get("triangles"),
                f"{tri} vs {meta.get('layers', {}).get('whiteModels', {}).get('triangles')}")
        # POSITION min/max 实测
        mins = [min(p[k] for p in positions) for k in range(3)]
        maxs = [max(p[k] for p in positions) for k in range(3)]
        acc_ok = all(abs(round(mins[k], 6) - round(pos_acc["min"][k], 6)) <= 1e-3 for k in range(3)) and \
                 all(abs(round(maxs[k], 6) - round(pos_acc["max"][k], 6)) <= 1e-3 for k in range(3))
        v.check("glb POSITION min/max 与实测一致", acc_ok,
                f"min={[round(x, 1) for x in mins]} max={[round(x, 1) for x in maxs]}")
        # 朝向 / 范围 / Y-up
        v.check("glb 顶点范围在 localExtent 内",
                mins[0] >= ext.get("minX", -9999) - 0.01 and maxs[0] <= ext.get("maxX", 9999) + 0.01
                and mins[2] >= ext.get("minZ", -9999) - 0.01 and maxs[2] <= ext.get("maxZ", 9999) + 0.01,
                f"x=[{mins[0]:.0f},{maxs[0]:.0f}] z=[{mins[2]:.0f},{maxs[2]:.0f}] ext={ext}")
        v.check("glb Y-up：墙底 y≈0、高度上限 ≤180",
                abs(mins[1]) < 0.05 and 3.0 <= maxs[1] <= MAX_BUILDING_HEIGHT_M + 0.01,
                f"y=[{mins[1]:.2f},{maxs[1]:.2f}]")
        # 挖空：挖空框内不应有任何白模顶点
        cb = (-72.0, -78.0, 72.0, 78.0)
        inside = sum(1 for p in positions
                     if cb[0] + 0.01 < p[0] < cb[2] - 0.01 and cb[1] + 0.01 < p[2] < cb[3] - 0.01)
        v.check("glb 已挖空英雄地块（挖空框内无顶点）", inside == 0, f"框内顶点 {inside}")
        # 朝向交叉验证：带 footprintBBox 的非挖空 POI 附近应有白模顶点
        anchors = [p for p in pois if "footprintBBox" in p and p.get("distanceM", 1e9) > 120][:8]
        if anchors:
            hit_ok = True
            details = []
            for p in anchors:
                bx0, bz0, bx1, bz1 = p["footprintBBox"]
                cnt = sum(1 for q in positions
                          if bx0 - 2 <= q[0] <= bx1 + 2 and bz0 - 2 <= q[2] <= bz1 + 2)
                details.append(f"{p['name']}={cnt}")
                if cnt <= 0:
                    hit_ok = False
            v.check("glb 与 POI footprint 局部坐标对齐（方位/朝向自检）", hit_ok, " ".join(details))
        # 法线
        normals = _decode_accessor(gltf, bin_data, attrs["NORMAL"])
        horizontal = sum(1 for n in normals if abs(n[1]) < 1e-3)
        up = sum(1 for n in normals if n[1] > 0.99)
        v.check("glb 法线：存在竖直墙面法线与朝上屋顶法线",
                horizontal > 0 and up > 0, f"horizontal={horizontal} up={up}")

    # ---- roads ----
    roads_doc = v.load_json("roads.geojson") if "roads" not in file_count or True else None
    roads_feats = (roads_doc or {}).get("features", [])
    if roads_feats:
        bad_geom = [f for f in roads_feats if f.get("geometry", {}).get("type") != "LineString"]
        v.check("roads 全部为 LineString", not bad_geom, f"{len(bad_geom)} 个异常")
        names = {f["properties"].get("name") for f in roads_feats if f["properties"].get("name")}
        required_names = ("东四十条", "东中街", "朝阳门北大街", "东二环", "工人体育场北路",
                          "东直门南大街", "东直门内大街", "朝阳门内大街", "朝阳门外大街")
        missing_names = [n for n in required_names if n not in names]
        v.check("roads 关键干路保留 name", not missing_names,
                f"缺失 {missing_names}" if missing_names else f"共 {len(names)} 条命名道路")
        classes = {f["properties"].get("class") for f in roads_feats}
        allowed = set(DRIVABLE_CLASSES) | set(DRIVABLE_LINK_CLASSES) | set(LOCAL_WALK_CLASSES)
        v.check("roads class 均在契约等级内", classes <= allowed, str(classes - allowed))
        # 坐标在 bbox 内（约 1e-6° 容差）
        tol = 2e-6
        outside = 0
        for f in roads_feats:
            for lon, lat in f["geometry"]["coordinates"]:
                if not (bbox[0] - tol <= lon <= bbox[2] + tol and bbox[1] - tol <= lat <= bbox[3] + tol):
                    outside += 1
        v.check("roads 坐标在 bbox 内", outside == 0, f"越界点 {outside}")
    else:
        v.check("roads 非空", False, "0 条道路")

    # ---- landuse ----
    lu_doc = v.load_json("landuse.geojson")
    lu_feats = (lu_doc or {}).get("features", [])
    if lu_feats:
        bad_kind = sorted({f["properties"].get("kind") for f in lu_feats} - set(("park", "forest", "water", "block", "plaza", "sports")))
        v.check("landuse kind 合法", not bad_kind, str(bad_kind))
        bad_geom = [f for f in lu_feats if f.get("geometry", {}).get("type") != "Polygon"]
        v.check("landuse 全部为 Polygon", not bad_geom, f"{len(bad_geom)} 个异常")
        unclosed = 0
        for f in lu_feats:
            ring = f["geometry"]["coordinates"][0]
            if len(ring) < 4 or ring[0] != ring[-1]:
                unclosed += 1
        v.check("landuse 环闭合", unclosed == 0, f"{unclosed} 个未闭合")
        kinds = {}
        for f in lu_feats:
            k = f["properties"].get("kind")
            kinds[k] = kinds.get(k, 0) + 1
        v.check("landuse 含公园/水系/地块", kinds.get("block", 0) > 0 and
                (kinds.get("park", 0) + kinds.get("forest", 0)) > 0, str(kinds))
    else:
        v.check("landuse 非空", False, "0 个面")

    # ---- poi ----
    if pois:
        v.check("poi 数量 >= 20", len(pois) >= 20, f"{len(pois)} 个")
        bad = []
        for p in pois:
            if not all(k in p for k in ("id", "name", "kind", "lon", "lat", "x", "z", "distanceM", "weight")):
                bad.append(p.get("id"))
                continue
            if p["kind"] not in POI_KINDS:
                bad.append(p.get("id"))
            if not (1 <= p["weight"] <= 5):
                bad.append(p.get("id"))
            # x/z 与 lon/lat 用 meta 公式复核
            ex = (p["lon"] - origin["lon"]) * 111320.0 * math.cos(math.radians(origin["lat"]))
            ez = -(p["lat"] - origin["lat"]) * 110540.0
            if abs(ex - p["x"]) > 0.06 or abs(ez - p["z"]) > 0.06:
                bad.append(p.get("id"))
            if abs(math.hypot(p["x"], p["z"]) - p["distanceM"]) > 0.2:
                bad.append(p.get("id"))
        v.check("poi schema / x·z·distanceM 自洽", not bad, f"异常 {sorted(set(bad))[:8]}")
        names = {p["name"] for p in pois}
        required_pois = ("东四十条站", "东直门站", "朝阳门站", "保利大厦", "北京保利剧院", "港澳中心",
                         "首创大厦", "亚洲大酒店", "新中大厦", "阳光国际大厦", "中国移动",
                         "东环广场A座", "新保利大厦", "五矿广场", "天辰大厦", "工人体育馆",
                         "北京喜剧院", "外交部新闻中心", "簋街", "悠唐生活广场", "丰联广场")
        missing_pois = [n for n in required_pois if n not in names]
        v.check("poi 覆盖契约 §2.5 关键清单", not missing_pois,
                f"缺失 {missing_pois}" if missing_pois else f"共 {len(pois)} 个 POI")
        # 关键距离抽查（与 OSM 实测一致）
        by_name = {p["name"]: p for p in pois}

        def dist_of(n):
            return by_name.get(n, {}).get("distanceM")

        d_metro = dist_of("东四十条站")
        v.check("东四十条站距离约 331 m", d_metro is not None and 315 <= d_metro <= 345,
                f"{d_metro} m")
        d_baoli = dist_of("保利大厦")
        v.check("保利大厦距离约 375 m", d_baoli is not None and 350 <= d_baoli <= 400,
                f"{d_baoli} m")
        d_sc = dist_of("首创大厦")
        v.check("首创大厦距离约 110 m", d_sc is not None and 100 <= d_sc <= 125, f"{d_sc} m")
        d_gm = dist_of("港澳中心")
        v.check("港澳中心距离约 207 m", d_gm is not None and 195 <= d_gm <= 220, f"{d_gm} m")
        v.check("poi 带 footprintBBox 的高亮锚点 >= 10",
                sum(1 for p in pois if "footprintBBox" in p) >= 10,
                f"{sum(1 for p in pois if 'footprintBBox' in p)} 个")
    # ---- site footprint ----
    if site_feats:
        kinds = {}
        for f in site_feats:
            k = f["properties"].get("kind")
            kinds[k] = kinds.get(k, 0) + 1
        v.check("site-footprint 含 site/tower/courtyard",
                kinds.get("site", 0) == 1 and kinds.get("tower", 0) == 6 and kinds.get("courtyard", 0) == 1,
                str(kinds))
        site_f = next((f for f in site_feats if f["properties"].get("kind") == "site"), None)
        if site_f is not None:
            area = site_f["properties"].get("areaM2", 0)
            v.check("富华大厦地块面积约 125×130 m（±15%）",
                    16000 * 0.85 <= area <= 16000 * 1.15, f"{area:.0f} m²")
            ring = [frame_en(x, y, origin) for x, y in site_f["geometry"]["coordinates"][0][:-1]] if False else None
        tower_ok = True
        details = []
        for f in site_feats:
            if f["properties"].get("kind") != "tower":
                continue
            w = f["properties"].get("widthM")
            d = f["properties"].get("depthM")
            ok = (abs(w - 23) < 0.01 and abs(d - 25) < 0.01) or (abs(w - 19) < 0.01 and abs(d - 31) < 0.01)
            details.append(f"{f['properties'].get('towerId')}:{w}×{d}")
            if not ok:
                tower_ok = False
        v.check("六座塔楼尺寸 23×25 / 19×31", tower_ok, " ".join(details))
    # ---- 单个文件体积 ----
    sizes = {}
    for name in ("meta.json", "white-models.glb", "roads.geojson", "landuse.geojson",
                 "poi.json", "site-footprint.geojson"):
        p = out_dir / name
        sizes[name] = p.stat().st_size if p.exists() else 0
    total = sum(sizes.values())
    v.check("产物合计 < 8 MB", total < 8 * 1024 * 1024, f"{fmt_size(total)}")
    print(f"\n产物体积：", flush=True)
    for name, size in sizes.items():
        print(f"  {name.ljust(26)} {fmt_size(size):>10}", flush=True)
    print(f"  {'合计'.ljust(26)} {fmt_size(total):>10}", flush=True)
    return v.summary()


def frame_en(lon, lat, origin):
    return ((lon - origin["lon"]) * 111320.0 * math.cos(math.radians(origin["lat"])),
            (lat - origin["lat"]) * 110540.0)


def run_verify(out_dir: Path) -> int:
    log(f"校验产物目录 {out_dir} …")
    ok = verify_outputs(out_dir)
    return 0 if ok else 1


# --------------------------------------------------------------------------- #
# 11. 主流程
# --------------------------------------------------------------------------- #

def run_build(args) -> int:
    out_dir: Path = args.out
    radius = float(args.radius)
    origin_lon, origin_lat = args.origin
    frame = LocalFrame(origin_lon, origin_lat)
    if frame.kx <= 0 or frame.kz <= 0:
        die("局部坐标系数非法")
    log(f"原点 {origin_lon:.6f},{origin_lat:.6f}（{ORIGIN_LABEL}）；半径 {radius:.0f} m；输出 {out_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    # ---- 解析 OSM ----
    osm = parse_osm_gz(args.osm_gz, frame, radius)
    site_way, site_coords = find_site_way(osm)
    if not site_coords:
        die(f"OSM 数据里找不到富华大厦地块 way/{SITE_WAY_ID}")

    # ---- 建筑 / 白模 ----
    buildings_kept, carved, buildings_all, bld_stats = select_buildings(osm, frame, radius)
    white_stats = {"pruned": 0}
    geom = None
    glb_info = None
    for attempt in range(6):
        geom = build_white_model_geometry(buildings_kept)
        if geom["triangleCount"] > TRIANGLE_BUDGET:
            keep, dropped = prune_buildings(buildings_kept, TRIANGLE_BUDGET)
            if dropped == 0:
                break
            white_stats["pruned"] += dropped
            log(f"三角面超预算，确定性裁剪 {dropped} 栋（按 height×√area 升序）")
            continue
        glb_info = write_glb(out_dir / "white-models.glb", geom, WHITE_MODEL_MATERIAL)
        if glb_info["bytes"] > GLB_MAX_BYTES:
            keep, dropped = prune_buildings(buildings_kept, int(TRIANGLE_BUDGET * 0.8))
            if dropped == 0:
                break
            white_stats["pruned"] += dropped
            log(f"GLB 超体积，确定性裁剪 {dropped} 栋")
            continue
        break
    if glb_info is None:
        die("白模生成失败")
    height_sources = {}
    for rec in buildings_kept:
        height_sources[rec["heightSource"]] = height_sources.get(rec["heightSource"], 0) + 1
    log(f"白模：{len(buildings_kept)} 栋 / {glb_info['triangleCount']} 三角面 / "
        f"{glb_info['vertexCount']} 顶点 / {fmt_size(glb_info['bytes'])}；"
        f"挖空 {len(carved)} 栋；高度来源 {height_sources}")
    if bld_stats["dropped"]:
        log(f"  建筑丢弃：{bld_stats['dropped']}（面积<15m² {bld_stats['small']}、"
            f"范围外 {bld_stats['outside']}）")

    # ---- 道路 ----
    roads, road_stats = build_roads(osm, frame, radius)
    write_json(out_dir / "roads.geojson", {
        "type": "FeatureCollection",
        "name": "roads",
        "description": "OpenStreetMap 车行 / 步行路网（WGS84 lon/lat；class=highway 等级）",
        "bbox": [round(v, 7) for v in bbox_meta(frame, radius)],
        "features": roads,
    }, compact=True)
    log(f"路网：{road_stats['kept']} 条（点数 {road_stats['pointsBefore']} → {road_stats['pointsAfter']}，"
        f"命名道路 {len(road_stats['names'])} 条）")

    # ---- 面要素 ----
    landuse, landuse_stats = build_landuse(osm, frame, radius)
    write_json(out_dir / "landuse.geojson", {
        "type": "FeatureCollection",
        "name": "landuse",
        "description": "OpenStreetMap 公园 / 绿地 / 水系 / 地块 / 广场 / 体育场面（WGS84 lon/lat）",
        "bbox": [round(v, 7) for v in bbox_meta(frame, radius)],
        "features": landuse,
    }, compact=True)
    log(f"面要素：{landuse_stats['kept']} 个 {landuse_stats['kinds']}（丢弃小面积 {landuse_stats['small']}）")

    # ---- POI ----
    pois, poi_stats = build_poi(osm, frame, buildings_all, landuse, radius)
    write_json(out_dir / "poi.json", {
        "pois": pois,
        "attribution": WGS84_ATTRIBUTION,
        "origin": {"lon": round(origin_lon, 6), "lat": round(origin_lat, 6), "label": ORIGIN_LABEL},
        "note": "x/z 为局部米（+X 东 / +Z 南），distanceM = hypot(x, z)；footprintBBox = [minX,minZ,maxX,maxZ]",
    })
    log(f"POI：{poi_stats['count']} 个 {poi_stats['kinds']}（带 footprint {poi_stats['withFootprint']}）")

    # ---- 地块足迹 ----
    site_features = build_site_footprint(site_way, site_coords, frame)
    write_json(out_dir / "site-footprint.geojson", {
        "type": "FeatureCollection",
        "name": "site-footprint",
        "description": "富华大厦地块 / 六座塔楼 / 中央庭院（WGS84 lon/lat；塔楼与庭院为示意矩形）",
        "bbox": [round(v, 7) for v in bbox_meta(frame, radius)],
        "features": site_features,
    })

    # ---- meta ----
    bbox = bbox_meta(frame, radius)
    bounds = glb_info["bounds"]
    max_abs = max(abs(bounds["localMinX"]), abs(bounds["localMaxX"]),
                  abs(bounds["localMinZ"]), abs(bounds["localMaxZ"]))
    # 输出几何可延伸到半径外（跨边界建筑），localExtent 取实际范围并向上取整到 50 m
    extent = max(radius + 50.0, math.ceil(max_abs / 50.0) * 50.0)
    local_extent = {"minX": -extent, "maxX": extent, "minZ": -extent, "maxZ": extent}
    meta = compute_meta(
        args=args, frame=frame, radius=radius, glb_info=glb_info,
        buildings_kept=buildings_kept, carved=carved, height_sources=height_sources,
        roads=roads, road_stats=road_stats, landuse=landuse, landuse_stats=landuse_stats,
        pois=pois, poi_stats=poi_stats, site_features=site_features,
        osm_stats=osm, white_stats=white_stats, bbox=bbox, local_extent=local_extent,
    )
    meta["stats"]["curatedPoi"] = poi_stats["curated"]
    write_json(out_dir / "meta.json", meta)
    log(f"meta.json 写出（localExtent ±{extent:.0f} m）；总耗时 {time.time() - t0:.1f}s")

    # ---- 打印统计 ----
    print("", flush=True)
    print("=== 生成完成 ===", flush=True)
    print(f"  白模建筑     {len(buildings_kept)}", flush=True)
    print(f"  三角面       {glb_info['triangleCount']}", flush=True)
    print(f"  挖空建筑     {len(carved)}", flush=True)
    print(f"  道路         {road_stats['kept']}", flush=True)
    print(f"  面要素       {landuse_stats['kept']}", flush=True)
    print(f"  POI          {poi_stats['count']}", flush=True)
    print(f"  高度来源     {height_sources}", flush=True)
    print(f"  输出目录     {out_dir}", flush=True)

    # 最高 10 栋（供人工核对 OSM height 误标 / 夹取情况）
    top = sorted(buildings_kept, key=lambda r: (-r["height"], r["id"]))[:10]
    print("  最高 10 栋：", flush=True)
    for rec in top:
        print(f"    {rec['height']:6.1f} m  [{rec['heightSource']:<8}]  "
              f"{rec['name'] or '(未命名)'}  {rec['id']}", flush=True)

    # 朝向自检：东中街应在 x≈+71（东）、二环（朝阳门北大街）在 x≈-110（西）、保利大厦在 z≈-375（北）
    orient = orientation_report(roads, pois, frame)
    print("  朝向自检：", flush=True)
    for line in orient:
        print(f"    {line}", flush=True)

    if not args.skip_verify:
        print("", flush=True)
        ok = verify_outputs(out_dir)
        if not ok:
            return 1
    return 0


def bbox_meta(frame: LocalFrame, radius: float):
    """meta.bbox：由 radius 精确换算的 west,south,east,north（WGS84）。"""
    west = frame.lon - radius / frame.kx
    east = frame.lon + radius / frame.kx
    south = frame.lat - radius / frame.kz
    north = frame.lat + radius / frame.kz
    return (round(west, 7), round(south, 7), round(east, 7), round(north, 7))


def _nearest_point_on_origin(ax, az, bx, bz):
    """线段上距原点最近的点 (x, z) 及其距离（局部场景坐标：x 东、z 南）。"""
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    if L2 < 1e-12:
        px, pz = ax, az
    else:
        t = max(0.0, min(1.0, -(ax * dx + az * dz) / L2))
        px, pz = ax + t * dx, az + t * dz
    return px, pz, math.hypot(px, pz)


def _side_label(x: float, z: float) -> str:
    """局部场景坐标的方位提示（+X 东、+Z 南、北=-Z）。"""
    parts = []
    if abs(x) >= 8:
        parts.append("东" if x > 0 else "西")
    if abs(z) >= 8:
        parts.append("南" if z > 0 else "北")
    return "·".join(parts) or "原点附近"


def orientation_report(roads, pois, frame: LocalFrame):
    """生成「东中街在东、二环在西、保利在北」等朝向自检行，供人工核对。"""
    lines = []
    # 道路：最近点局部坐标
    road_by_name = {}
    for f in roads:
        name = f["properties"].get("name")
        if name:
            road_by_name.setdefault(name, []).append(f)
    for name, expect in (
        ("东中街", "应在东侧 x≈+70"),
        ("朝阳门北大街", "应在西侧 x≈-110"),
        ("东二环", "应在西侧（trunk 主线，含东北段）"),
        ("东四十条", "应在北侧 z≈-300"),
        ("东直门内大街", "应在北侧 z≈-1100"),
        ("工人体育场北路", "应在东北侧 z≈-315"),
    ):
        best = None
        for f in road_by_name.get(name, []):
            coords = f["geometry"]["coordinates"]
            for i in range(len(coords) - 1):
                (x1, z1) = frame.xz(coords[i][0], coords[i][1])
                (x2, z2) = frame.xz(coords[i + 1][0], coords[i + 1][1])
                px, pz, d = _nearest_point_on_origin(x1, z1, x2, z2)
                if best is None or d < best[2]:
                    best = (px, pz, d)
        if best is not None:
            px, pz, d = best
            lines.append(f"{name}：最近点 (x={px:+.1f}, z={pz:+.1f}) d={d:.1f} m"
                         f"（{_side_label(px, pz)}；{expect}）")
    # POI：用已有局部坐标复核
    poi_checks = (
        ("保利大厦", "应在北侧 z≈-375"),
        ("首创大厦", "应在北侧 z≈-110"),
        ("港澳中心", "应在北侧 z≈-207"),
        ("新保利大厦", "应在西北侧"),
        ("工人体育馆", "应在东侧 x≈+546"),
        ("东四十条站", "应在西北侧 x≈-137 z≈-301"),
        ("朝阳门站", "应在东南侧 z≈+719"),
        ("东直门站", "应在北侧 z≈-1130"),
    )
    by_name = {p["name"]: p for p in pois}
    for name, expect in poi_checks:
        p = by_name.get(name)
        if p is None:
            continue
        lines.append(f"{name} POI：(x={p['x']:+.1f}, z={p['z']:+.1f}) d={p['distanceM']:.1f} m"
                     f"（{_side_label(p['x'], p['z'])}；{expect}）")
    return lines


# --------------------------------------------------------------------------- #
# 12. CLI
# --------------------------------------------------------------------------- #

def parse_origin(text: str):
    parts = [p.strip() for p in str(text).replace(";", ",").split(",") if p.strip()]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("--origin 需要 'lon,lat' 两个数")
    try:
        return (float(parts[0]), float(parts[1]))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"--origin 解析失败: {exc}") from exc


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="building-atlas · 东四十条 OSM 街区语境数据管线（仅标准库）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--osm-gz", type=Path, default=DEFAULT_OSM_GZ,
                        help=f"BBBike Beijing extract（.osm.gz），默认 {DEFAULT_OSM_GZ}")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR,
                        help=f"输出目录，默认 {DEFAULT_OUT_DIR}")
    parser.add_argument("--origin", type=parse_origin, default=(ORIGIN_LON, ORIGIN_LAT),
                        help="场景原点 'lon,lat'，默认 116.429613,39.929566（富华大厦地块中心）")
    parser.add_argument("--radius", type=float, default=DEFAULT_RADIUS_M,
                        help=f"数据半径（米），默认 {DEFAULT_RADIUS_M:.0f}")
    parser.add_argument("--verify-only", action="store_true",
                        help="只校验已有产物（不重新解析 OSM、不重新生成）")
    parser.add_argument("--skip-verify", action="store_true",
                        help="生成后跳过自检")
    return parser


def main(argv=None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    if args.verify_only:
        return run_verify(args.out)
    if not args.osm_gz.exists():
        die(f"OSM 数据文件不存在：{args.osm_gz}\n"
            f"  可用 BBBike 下载：{EXTRACT_URL}\n"
            f"  或指定 --osm-gz /tmp/Beijing.osm.gz")
    if args.radius <= 100:
        die(f"--radius 过小：{args.radius}")
    return run_build(args)


if __name__ == "__main__":
    raise SystemExit(main())
