"""町外れの小さな小屋。石の土台、木組みの壁、切妻屋根、煙突、窓、扉。玄関先のランタンと薪の山"""

import math

import bmesh

from lowpoly import box, cone, group, ico, place, roughen

WIDTH, HEIGHT, DEPTH, BASE = 2.0, 1.1, 1.6, 0.25
EAVE = BASE + HEIGHT
PITCH = 0.62
RISE = DEPTH / 2 * math.tan(PITCH)


def gable():
    """切妻の三角の壁。x 方向に伸びる三角柱"""
    bm = bmesh.new()
    half = DEPTH / 2
    # Blender の座標で、y がゲームの -z、z がゲームの上
    front = [bm.verts.new((x, y, z)) for x, y, z in [(-WIDTH / 2, half, 0), (-WIDTH / 2, -half, 0), (-WIDTH / 2, 0, RISE)]]
    back = [bm.verts.new((WIDTH / 2, y, z)) for _, y, z in [v.co for v in front]]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([front[i], front[j], back[j], back[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def roof(parent):
    length = (DEPTH / 2 + 0.28) / math.cos(PITCH)
    for side, mat in ((1, "roof"), (-1, "roof_dark")):
        z = side * (length / 2) * math.cos(PITCH) - side * 0.02
        y = EAVE + RISE - (length / 2) * math.sin(PITCH) + 0.02
        bm = box(WIDTH + 0.45, 0.12, length)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -0.06))
        place(f"roof_{side}", bm, mat, at=(0, y, z), tilt=(side * PITCH, 0.0), parent=parent)
    place("roof_ridge", box(WIDTH + 0.5, 0.1, 0.16), "roof_dark", at=(0, EAVE + RISE + 0.03, 0), parent=parent)


def chimney(parent):
    at = (0.55, EAVE + RISE * 0.45, -0.35)
    place("chimney", box(0.3, 0.9, 0.3), "chimney", at=at, parent=parent)
    place("chimney_cap", box(0.38, 0.08, 0.38), "rock_dark", at=(at[0], at[1] + 0.9, at[2]), parent=parent)
    # ゲーム側で煙を出す位置の目印
    group("smoke_origin", at=(at[0], at[1] + 1.0, at[2]), parent=parent)


def window(parent, name, at, turn=0.0):
    """光る窓と、花の咲いた窓辺の箱"""
    frame = group(name, at=at, turn=turn, parent=parent)
    place(f"{name}_frame", box(0.46, 0.46, 0.06), "hut_timber", at=(0, -0.23, 0), parent=frame)
    place(f"{name}_glass", box(0.34, 0.34, 0.02), "window", at=(0, -0.17, 0.035), parent=frame)
    place(f"{name}_bar_v", box(0.03, 0.34, 0.02), "hut_timber", at=(0, -0.17, 0.05), parent=frame)
    place(f"{name}_bar_h", box(0.34, 0.03, 0.02), "hut_timber", at=(0, -0.015, 0.05), parent=frame)
    place(f"{name}_box", box(0.56, 0.08, 0.16), "wood_light", at=(0, -0.32, 0.07), parent=frame)
    for i, x in enumerate((-0.17, 0, 0.17)):
        place(f"{name}_flower_{i}", ico(0.065, 0), "flower_yellow" if i == 1 else "flower_pink", at=(x, -0.2, 0.09), parent=frame)


def door(parent):
    d = group("door", at=(0.42, BASE, DEPTH / 2 + 0.01), parent=parent)
    place("door_frame", box(0.56, 0.86, 0.06), "hut_timber", parent=d)
    place("door_board", box(0.44, 0.78, 0.04), "door", at=(0, 0, 0.03), parent=d)
    place("door_knob", ico(0.03, 1), "metal", at=(0.14, 0.4, 0.07), parent=d)
    place("door_step", box(0.7, 0.1, 0.3), "hut_stone", at=(0, -0.25, 0.14), parent=d)


def walls(parent):
    base = box(WIDTH + 0.25, BASE, DEPTH + 0.25)
    bmesh.ops.subdivide_edges(base, edges=base.edges[:], cuts=2)
    roughen(base, 0.035, seed=4)
    place("hut_base", base, "hut_stone", parent=parent)
    place("hut_walls", box(WIDTH, HEIGHT, DEPTH), "hut_wall", at=(0, BASE, 0), parent=parent)
    for sx in (-1, 1):
        for sz in (-1, 1):
            place(f"post_{sx}_{sz}", box(0.13, HEIGHT, 0.13), "hut_timber", at=(sx * WIDTH / 2, BASE, sz * DEPTH / 2), parent=parent)
    place("beam", box(WIDTH + 0.06, 0.1, DEPTH + 0.06), "hut_timber", at=(0, EAVE - 0.1, 0), parent=parent)
    place("gable", gable(), "hut_wall", at=(0, EAVE, 0), parent=parent)


def build_hut(parent, at):
    hut = group("hut", at=at, parent=parent)
    walls(hut)
    roof(hut)
    chimney(hut)
    door(hut)
    window(hut, "window_front", at=(-0.45, BASE + 0.83, DEPTH / 2 + 0.02))
    window(hut, "window_side", at=(WIDTH / 2 + 0.02, BASE + 0.83, 0), turn=math.pi / 2)
    return hut


def build_lantern(parent, at):
    """玄関先のランタン。ゲーム側で、夜と留守の間だけ灯す"""
    lantern = group("lantern", at=at, parent=parent)
    place("lantern_post", box(0.08, 1.2, 0.08), "hut_timber", parent=lantern)
    place("lantern_arm", box(0.34, 0.05, 0.05), "hut_timber", at=(0.15, 1.14, 0), parent=lantern)
    place("lantern_glass", box(0.15, 0.2, 0.15), "lantern", at=(0.28, 0.88, 0), parent=lantern)
    place("lantern_cap", cone(0.13, 0.0, 0.09, 4), "rock_dark", at=(0.28, 1.08, 0), turn=math.pi / 4, parent=lantern)
    group("lantern_light", at=(at[0] + 0.28, at[1] + 0.98, at[2]), parent=parent)


def build_woodpile(parent, at):
    pile = group("woodpile", at=at, turn=0.5, parent=parent)
    for i, (x, y) in enumerate([(-0.14, 0.0), (0.14, 0.0), (0.0, 0.16)]):
        log = cone(0.1, 0.1, 0.6, 7)
        bmesh.ops.translate(log, verts=log.verts, vec=(0, 0, -0.3))
        place(f"log_{i}", log, "wood_light", at=(x, y + 0.1, 0), tilt=(math.pi / 2, 0.0), parent=pile)
    place("stump", cone(0.18, 0.16, 0.3, 8), "wood", at=(0.45, 0, 0.1), parent=pile)
