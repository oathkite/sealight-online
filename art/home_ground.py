"""町外れの平野。庭のまわりは平らで、遠くへ行くほどゆるやかに起伏し、霞に溶ける。

遠くには町の屋根と、町へ続く道がある（家は町外れにある）。
庭には道の敷石、草むら、野の花、石を置く。
"""

import math

import bmesh

from home_layout import ROAD, ROUTE, SPOTS, TOWN, YARD_RADIUS, scatter
from lowpoly import box, cone, group, ico, place, roughen

GROUND_HALF = 32.0
GROUND_SEGMENTS = 110


def ground_height(x, z):
    """庭の中は平ら。外へ行くほど、なだらかな丘がいくつか重なる"""
    distance = math.hypot(x, z)
    rise = max(0.0, min(1.0, (distance - YARD_RADIUS) / 6.0))
    rise = rise * rise * (3 - 2 * rise)
    hills = 0.55 * math.sin(x * 0.23 + 1.3) * math.cos(z * 0.19 - 0.4) + 0.35 * math.sin(x * 0.51 - z * 0.37)
    return rise * (hills + 0.25)


def _warp(value):
    u = value / GROUND_HALF
    return GROUND_HALF * (0.3 * u + 0.7 * u**3)


def plain(parent):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=GROUND_SEGMENTS, y_segments=GROUND_SEGMENTS, size=GROUND_HALF)
    for v in bm.verts:
        # 真ん中（庭）ほど細かく、遠くほど粗くする。庭の陰を細かく焼き込むため
        v.co.x = _warp(v.co.x)
        v.co.y = _warp(v.co.y)
        # Blender の座標で x はゲームの x、y はゲームの -z
        v.co.z = ground_height(v.co.x, -v.co.y)
    place("ground", bm, "grass", bevel=False, parent=parent)


def _smooth(points, per_segment=8):
    """折れ線の角を丸める（Catmull-Rom）。道を手で引いたようななめらかな線にする"""
    padded = [points[0], *points, points[-1]]
    out = []
    for i in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[i - 1], padded[i], padded[i + 1], padded[i + 2]
        for k in range(per_segment):
            t = k / per_segment
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t**3) for j in range(3)))
    return [*out, points[-1]]


def road(parent):
    """家の前から町へ続く土の道。地面の起伏に沿わせた帯で、町へ近づくほど広くなる"""
    line = _smooth(ROAD)
    bm = bmesh.new()
    rows = []
    for i, (x, _, z) in enumerate(line):
        ax, _, az = line[max(0, i - 1)]
        bx, _, bz = line[min(len(line) - 1, i + 1)]
        length = math.hypot(bx - ax, bz - az) or 1.0
        nx, nz = -(bz - az) / length, (bx - ax) / length
        width = 0.38 + 0.25 * i / len(line)
        rows.append([bm.verts.new((x + nx * side * width, -(z + nz * side * width), ground_height(x, z) + 0.02)) for side in (-1, 1)])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new([a[0], a[1], b[1], b[0]])
    place("road", bm, "path", bevel=False, parent=parent)


# 町の家並み（町の中心からのずれ x, z、向き、大きさ）
TOWN_HOUSES = [(0.4, 0.3, 0.3, 1.1), (-1.2, 1.3, -0.2, 0.9), (1.5, -1.0, 0.8, 1.0), (-0.9, -1.6, 0.1, 1.2), (-2.3, -0.2, -0.5, 1.0)]


def town(parent):
    """遠くに見える町の家並みと塔。霞の中に屋根が並ぶ"""
    tx, _, tz = TOWN
    for i, (dx, dz, turn, scale) in enumerate(TOWN_HOUSES):
        x, z = tx + dx, tz + dz
        house = group(f"town_house_{i}", at=(x, ground_height(x, z), z), turn=turn, parent=parent)
        place(f"town_wall_{i}", box(1.3 * scale, 0.9 * scale, 1.0 * scale), "hut_wall", parent=house)
        place(f"town_roof_{i}", cone(1.05 * scale, 0.0, 0.75 * scale, 4), "roof" if i % 2 else "roof_dark", at=(0, 0.9 * scale, 0), turn=math.pi / 4, scale=(1.0, 1.0, 0.8), parent=house)
    x, z = tx - 0.8, tz - 2.6
    y = ground_height(x, z)
    place("town_tower", cone(0.5, 0.45, 2.4, 10), "hut_stone", at=(x, y, z), parent=parent)
    place("town_tower_roof", cone(0.62, 0.0, 0.9, 10), "roof_dark", at=(x, y + 2.4, z), parent=parent)


def signpost(parent):
    """道しるべ。道の曲がり角で町の方角を指す"""
    (x0, _, z0), (x1, _, z1) = ROAD[1], ROAD[2]
    post = group("signpost", at=(x0 + 0.1, 0, z0 + 0.55), turn=math.atan2(x1 - x0, z1 - z0) - math.pi / 2, parent=parent)
    place("signpost_pole", box(0.08, 0.85, 0.08), "wood", parent=post)
    place("signpost_board", box(0.55, 0.18, 0.05), "wood_light", at=(0.14, 0.6, 0), parent=post)


def far_trees(parent):
    """庭の外の木立。町と道のまわりは空けておく。遠いものは霞で薄くなる"""
    keep_out = [(0, 0, YARD_RADIUS + 0.5), (TOWN[0], TOWN[2], 3.5), *[(x, z, 1.4) for x, _, z in ROAD]]
    for i, spot in enumerate(scatter(303, 40, keep_out=keep_out, radius=15.0)):
        x, z = spot["x"], spot["z"]
        # カメラの手前側には置かない（家とモンスターを隠さないように）
        if (x + z) / math.sqrt(2) > 3.0:
            continue
        y = ground_height(x, z)
        size = 0.6 + spot["scale"] * 0.45
        # 霞の中の遠い木は細分化しない（なめらかな陰影だけで丸く見える）
        place(f"far_trunk_{i}", cone(0.12 * size, 0.08 * size, 0.6 * size, 6), "trunk", at=(x, y, z), parent=parent, bevel=False)
        crown = ico(0.6 * size, 2)
        roughen(crown, 0.08 * size, seed=90 + i)
        place(f"far_crown_{i}", crown, "leaf" if i % 3 else "pine", at=(x, y + 1.0 * size, z), parent=parent, bevel=False)


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
    """草むら（3 本ずつの葉）と野の花。庭のまわりだけ"""
    for i, spot in enumerate(scatter(101, 60)):
        for k, dx in enumerate((-0.05, 0.03, 0.08)):
            bm = cone(0.05, 0.0, 0.22 * spot["scale"] * (1 - k * 0.15), 5)
            # 草の葉は数が多いので細分化せず、なめらかな陰影だけで丸く見せる
            place(f"tuft_{i}_{k}", bm, "grass_tuft", at=(spot["x"] + dx, 0, spot["z"] + (k - 1) * 0.04), turn=spot["turn"], tilt=(0.0, (k - 1) * 0.35), parent=parent, bevel=False)
    colors = ("flower_pink", "flower_yellow", "flower_white")
    for i, spot in enumerate(scatter(202, 34)):
        place(f"stem_{i}", cone(0.012, 0.012, 0.1, 3), "grass_tuft", at=(spot["x"], 0, spot["z"]), parent=parent)
        place(f"flower_{i}", ico(0.055 * spot["scale"], 1), colors[int(spot["pick"] * 3) % 3], at=(spot["x"], 0.11, spot["z"]), scale=(1, 0.6, 1), parent=parent, bevel=False)


def rocks(parent):
    for i, (x, z, sx, sy, sz) in enumerate([(-3.0, 2.4, 1.2, 0.7, 1.0), (3.4, 0.4, 0.9, 0.6, 0.8), (0.9, 3.4, 0.7, 0.5, 0.6), (-2.4, 3.3, 0.6, 0.45, 0.7), (4.2, 3.1, 1.0, 0.6, 0.9)]):
        bm = ico(0.3, 1)
        roughen(bm, 0.06, seed=20 + i)
        place(f"rock_{i}", bm, "rock", at=(x, 0.05, z), turn=i * 0.9, scale=(sx, sy, sz), parent=parent)


def pond(parent):
    """左手前の小さな池。粘土の縁石で囲み、水面だけつやを出す"""
    x, _, z = SPOTS["pond"]
    water = cone(1.05, 1.05, 0.02, 20)
    for v in water.verts:
        v.co.x *= 1.25
    place("pond_water", water, "water", at=(x, 0.0, z), turn=0.4, bevel=False, parent=parent)
    for i in range(14):
        angle = i / 14 * math.tau
        stone = ico(0.16 + (i * 37 % 5) * 0.015, 1)
        roughen(stone, 0.03, seed=110 + i)
        sx, sz = math.cos(angle) * 1.1 * 1.25, math.sin(angle) * 1.1
        # 池は 0.4 回したので、縁石も同じだけ回す
        rx = sx * math.cos(0.4) + sz * math.sin(0.4)
        rz = -sx * math.sin(0.4) + sz * math.cos(0.4)
        place(f"pond_stone_{i}", stone, "rock" if i % 3 else "hut_stone", at=(x + rx, 0.02, z + rz), turn=i, scale=(1.2, 0.6, 1.0), parent=parent)
    for i, (dx, dz, h) in enumerate([(-0.5, -0.2, 0.5), (-0.35, -0.35, 0.38), (0.6, 0.3, 0.42)]):
        place(f"reed_{i}", cone(0.03, 0.0, h, 5), "carrot_top", at=(x + dx, 0.0, z + dz), tilt=(0.0, dx * 0.2), parent=parent, bevel=False)


# 茂み（x, z, 大きさ）。手前を少し埋めて、ジオラマの縁取りにする
BUSHES = [(3.3, 1.2, 1.0), (3.9, 1.7, 0.7), (0.6, 4.1, 0.9), (1.2, 4.4, 0.65), (-3.6, 0.4, 0.8), (4.3, -0.4, 0.75)]


def bushes(parent):
    for i, (x, z, size) in enumerate(BUSHES):
        for k, (dx, dz, s) in enumerate([(0, 0, 1.0), (0.28, 0.1, 0.7), (-0.22, 0.18, 0.62)]):
            blob = ico(0.36 * size * s, 1)
            roughen(blob, 0.05 * size, seed=130 + i * 3 + k)
            place(f"bush_{i}_{k}", blob, "leaf_light" if k else "leaf", at=(x + dx * size, 0.18 * size * s, z + dz * size), scale=(1.0, 0.8, 1.0), parent=parent)


def build(parent):
    plain(parent)
    pond(parent)
    bushes(parent)
    road(parent)
    town(parent)
    signpost(parent)
    far_trees(parent)
    path_stones(parent)
    meadow(parent)
    rocks(parent)
