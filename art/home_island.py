"""宙に浮かぶ島。地層の崖、崖に埋まった結晶、道の敷石、草むらと野の花"""

import math

import bmesh
from mathutils import Matrix

from home_layout import ISLAND_RADIUS, ROUTE, SPOTS, scatter
from lowpoly import cone, ico, place, roughen

SEGMENTS = 14

# 地層の寸法。崖はほぼ垂直に立て、斜め上から見ても断面が見えるようにする
LAYERS = [
    # 名前, 材質, 上の半径, 下の半径, 厚さ, ずらす量
    ("grass", "grass", ISLAND_RADIUS, ISLAND_RADIUS - 0.08, 0.3, 0.12),
    ("soil", "soil", ISLAND_RADIUS - 0.1, ISLAND_RADIUS - 0.3, 0.8, 0.12),
    ("rock", "rock", ISLAND_RADIUS - 0.3, 3.1, 1.5, 0.2),
]
BASE_HEIGHT = 3.2


def strata(parent):
    """上から草、土、岩、尖った底。天面の高さが 0"""
    top = 0.0
    for name, mat, r_top, r_bottom, height, amount in LAYERS:
        bm = cone(r_bottom, r_top, height, SEGMENTS)
        if name != "grass":
            bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.01], cuts=2)
        roughen(bm, amount, seed=len(name), vertical=0.0 if name == "grass" else 0.6)
        place(f"island_{name}", bm, mat, at=(0, top - height, 0), parent=parent)
        top -= height
    base = cone(0.05, LAYERS[-1][3], BASE_HEIGHT, SEGMENTS)
    bmesh.ops.subdivide_edges(base, edges=[e for e in base.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.01], cuts=3)
    roughen(base, 0.3, seed=7)
    place("island_base", base, "rock_dark", at=(0, top - BASE_HEIGHT, 0), parent=parent)
    return top


def band(parent):
    """土と岩の間の、色の違う薄い地層。断面図らしさを出す"""
    y = -(LAYERS[0][4] + LAYERS[1][4]) - 0.35
    bm = cone(LAYERS[2][2] - 0.05, LAYERS[2][2] + 0.04, 0.18, SEGMENTS)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 0.01], cuts=1)
    roughen(bm, 0.08, seed=9, vertical=0.3)
    place("island_band", bm, "rock_light", at=(0, y, 0), parent=parent)


def roots(parent):
    """草の縁から垂れ下がる根。見えている側（+x と +z）にだけ付ける"""
    for i, angle in enumerate((0.05, 0.3, 0.62, 0.95, 1.2, 1.5, -0.2, 1.75)):
        r = ISLAND_RADIUS - 0.12
        length = 0.35 + (i * 37 % 5) * 0.09
        bm = cone(0.035, 0.01, length, 4)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi, 3, "X"))
        place(f"root_{i}", bm, "trunk" if i % 2 else "soil_dark", at=(math.cos(angle) * r, -0.28, math.sin(angle) * r), turn=-angle, tilt=(0.0, 0.25), parent=parent)


def cliff_radius(y, rock_top):
    """崖の高さ y での島の半径（岩の層と尖った底）"""
    _, _, r_top, r_bottom, height, _ = LAYERS[-1]
    rock_bottom = rock_top - height
    if y >= rock_bottom:
        return r_bottom + (y - rock_bottom) / height * (r_top - r_bottom)
    return r_bottom * max(0.0, 1 - (rock_bottom - y) / BASE_HEIGHT)


# 崖に埋まった結晶（+x から +z への角度、高さ、大きさ）。家の下にダンジョンがあることをほのめかす
CRYSTALS = [(0.35, -1.7, 0.26), (1.05, -2.3, 0.2), (0.7, -3.5, 0.18), (1.5, -1.6, 0.2), (0.1, -2.9, 0.15), (1.2, -4.3, 0.13)]


def crystals(parent):
    rock_top = -(LAYERS[0][4] + LAYERS[1][4])
    for i, (angle, y, size) in enumerate(CRYSTALS):
        r = cliff_radius(y, rock_top) - 0.03
        for k, (spread, lean, grow) in enumerate(((0.0, -1.1, 1.0), (0.12, -0.7, 0.6), (-0.1, -1.5, 0.55))):
            a = angle + spread / max(r, 0.5)
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=size * grow, radius2=0, depth=size * 2.6 * grow)
            place(f"crystal_{i}_{k}", bm, "crystal", at=(math.cos(a) * r, y - k * 0.05, math.sin(a) * r), turn=-a, tilt=(0.0, lean), parent=parent)


def path_stones(parent):
    """寝床からダンジョンの入口まで続く敷石"""
    index = 0
    gx, _, gz = SPOTS["gate"]
    for (x0, _, z0), (x1, _, z1) in zip(ROUTE, ROUTE[1:]):
        for k in (0.25, 0.75):
            x, z = x0 + (x1 - x0) * k, z0 + (z1 - z0) * k
            if math.hypot(x - gx, z - gz) < 0.85:
                continue
            bm = ico(0.2, 1)
            roughen(bm, 0.03, seed=index)
            place(f"path_{index}", bm, "path", at=(x, -0.03, z), turn=index * 1.3, scale=(1.15, 0.3, 0.95), parent=parent)
            index += 1


def meadow(parent):
    """草むら（3 本ずつの葉）と野の花"""
    for i, spot in enumerate(scatter(101, 52)):
        for k, dx in enumerate((-0.05, 0.03, 0.08)):
            bm = cone(0.05, 0.0, 0.22 * spot["scale"] * (1 - k * 0.15), 3)
            place(f"tuft_{i}_{k}", bm, "grass_tuft", at=(spot["x"] + dx, 0, spot["z"] + (k - 1) * 0.04), turn=spot["turn"], tilt=(0.0, (k - 1) * 0.35), parent=parent)
    colors = ("flower_pink", "flower_yellow", "flower_white")
    for i, spot in enumerate(scatter(202, 28)):
        stem = cone(0.012, 0.012, 0.1, 3)
        place(f"stem_{i}", stem, "grass_tuft", at=(spot["x"], 0, spot["z"]), parent=parent)
        petals = ico(0.055 * spot["scale"], 0)
        place(f"flower_{i}", petals, colors[int(spot["pick"] * 3) % 3], at=(spot["x"], 0.11, spot["z"]), scale=(1, 0.6, 1), parent=parent)


def rocks(parent):
    for i, (x, z, sx, sy, sz) in enumerate([(-1.9, 1.85, 1.2, 0.7, 1.0), (3.4, 0.4, 0.9, 0.6, 0.8), (0.9, 3.4, 0.7, 0.5, 0.6), (-3.6, -0.2, 0.6, 0.45, 0.7)]):
        bm = ico(0.3, 0)
        roughen(bm, 0.06, seed=20 + i)
        place(f"rock_{i}", bm, "rock", at=(x, 0.05, z), turn=i * 0.9, scale=(sx, sy, sz), parent=parent)


def build(parent):
    strata(parent)
    band(parent)
    roots(parent)
    crystals(parent)
    path_stones(parent)
    meadow(parent)
    rocks(parent)
