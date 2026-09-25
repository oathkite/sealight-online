"""使役モンスターの形（仮）。丸いおもち型の体、短い耳、大きな目、額の光る結晶。

種族や見た目は後で決める。部品ごとに骨へ付けて動かすので、1 つのメッシュにはまとめない。
座標はゲームの向き（y が上、+z がカメラ側）で、足元が原点。
"""

import math

import bmesh
from mathutils import Matrix

from lowpoly import COLORS, GLOW, cone, ico, place, roughen

COLORS.update(
    {
        "monster": "#8fd3c7",
        "monster_dark": "#6bb8ad",
        "monster_belly": "#d2f2e8",
        "monster_cheek": "#f7a4a4",
        "eye": "#2a2440",
        "eye_shine": "#ffffff",
        "bandage": "#f4efe6",
        "plaster": "#f0c9a0",
        "sack": "#c89a62",
        "sack_tie": "#8a6a44",
    }
)
GLOW["monster_gem"] = ("#8fe0ff", 1.2)

BODY_H = 0.62
BODY_R = 0.34


def body():
    """下ぶくれの卵型。細かく割ってから少し歪ませ、手でこねたようにする"""
    bm = ico(1.0, 2)
    for v in bm.verts:
        z = v.co.z
        # 下半分を太らせ、上を少しすぼめる
        widen = 1.08 - 0.16 * z
        v.co.x *= BODY_R * widen
        v.co.y *= BODY_R * widen * 0.92
        v.co.z = (z + 1) / 2 * BODY_H
    roughen(bm, 0.012, seed=3)
    return bm


def belly():
    bm = ico(1.0, 2)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(0.14, 0.03, 0.12))
    return bm


def ear():
    bm = cone(0.09, 0.02, 0.2, 5)
    return bm


def build_parts():
    """部品を作って、名前と付ける骨の組を返す"""
    parts = [
        (place("m_body", body(), "monster"), "body"),
        (place("m_belly", belly(), "monster_belly", at=(0, 0.18, BODY_R * 0.95)), "body"),
    ]
    for side in (-1, 1):
        s = "L" if side == 1 else "R"
        parts += [
            (place(f"m_ear_{s}", ear(), "monster_dark", at=(side * 0.17, BODY_H - 0.1, -0.02), tilt=(0.0, -side * 0.45)), f"ear.{s}"),
            (place(f"m_eye_{s}", ico(0.068, 1), "eye", at=(side * 0.1, 0.39, BODY_R * 0.93), scale=(1, 1.3, 0.55)), f"eye.{s}"),
            (place(f"m_shine_{s}", ico(0.024, 0), "eye_shine", at=(side * 0.1 + 0.022, 0.425, BODY_R * 1.0)), f"eye.{s}"),
            (place(f"m_cheek_{s}", ico(0.055, 1), "monster_cheek", at=(side * 0.19, 0.3, BODY_R * 0.78), scale=(1, 0.6, 0.45)), "body"),
            (place(f"m_foot_{s}", ico(0.085, 1), "monster_dark", at=(side * 0.14, 0.035, 0.08), scale=(1, 0.5, 1.3)), f"foot.{s}"),
        ]
    gem = cone(0.045, 0.0, 0.13, 5)
    parts += [
        (place("m_gem", gem, "monster_gem", at=(0, BODY_H - 0.04, 0.12), tilt=(0.5, 0.0), bevel=False), "body"),
        (place("m_tail", cone(0.07, 0.0, 0.2, 5), "monster_dark", at=(0, 0.16, -BODY_R * 0.85), tilt=(-2.0, 0.0)), "tail"),
    ]
    return parts + build_accessories()


def bandage():
    """頭に巻いた包帯と、ほっぺの絆創膏。ボロボロで帰ってきたときだけ見せる"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=14, radius1=0.305, radius2=0.275, depth=0.075)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-0.2, 3, "X"))
    return bm


def sack():
    """背負った荷物袋。持ち帰ったものがあるときだけ見せる"""
    bm = ico(0.15, 1)
    roughen(bm, 0.02, seed=9)
    for v in bm.verts:
        v.co.z *= 1.1
    return bm


def build_accessories():
    return [
        (place("bandage", bandage(), "bandage", at=(0, 0.47, -0.01)), "body"),
        (place("bandage_plaster", ico(0.05, 0), "plaster", at=(-0.2, 0.3, BODY_R * 0.75), scale=(1.2, 0.5, 0.3), turn=math.pi / 5), "body"),
        (place("sack", sack(), "sack", at=(0, 0.28, -BODY_R - 0.08)), "body"),
        (place("sack_tie", cone(0.05, 0.02, 0.07, 6), "sack_tie", at=(0, 0.43, -BODY_R - 0.08)), "body"),
    ]
