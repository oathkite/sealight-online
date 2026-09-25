"""庭のもの。畑と柵、寝床と水の皿、ダンジョンの入口、木"""

import math

import bmesh

from lowpoly import box, cone, group, ico, place, roughen

PLOT_W, PLOT_D = 2.1, 1.7
ROWS = (-0.5, 0.0, 0.5)


def fence(parent):
    """柵。正面の真ん中だけ開けて入口にする"""
    hw, hd = PLOT_W / 2 + 0.15, PLOT_D / 2 + 0.15
    posts = {(x, -hd) for x in (-hw, -hw / 2, 0, hw / 2, hw)}
    posts |= {(sx * hw, z) for sx in (-1, 1) for z in (-hd, 0, hd)}
    posts |= {(x, hd) for x in (-hw, -hw / 2, hw / 2, hw)}
    for i, (x, z) in enumerate(sorted(posts)):
        post = box(0.09, 0.5, 0.09)
        roughen(post, 0.01, seed=i)
        place(f"fence_post_{i}", post, "wood", at=(x, 0, z), turn=(i % 3) * 0.1, parent=parent)
    rails = [((0, -hd), hw * 2, 0), ((hw, 0), hd * 2, math.pi / 2), ((-hw, 0), hd * 2, math.pi / 2)]
    rails += [((-(hw + 0.3) / 2, hd), hw - 0.3, 0), (((hw + 0.3) / 2, hd), hw - 0.3, 0)]
    for i, ((x, z), length, turn) in enumerate(rails):
        for k, y in enumerate((0.18, 0.36)):
            place(f"fence_rail_{i}_{k}", box(length, 0.05, 0.05), "wood_light", at=(x, y, z), turn=turn, parent=parent)


def crops(parent):
    """キャベツの列とニンジンの列"""
    for row, z in enumerate(ROWS):
        for i in range(4):
            x = -0.72 + i * 0.48
            grown = 0.8 + ((i * 7 + row * 3) % 5) * 0.08
            if row == 1:
                for k, dx in enumerate((-0.05, 0.05, 0.0)):
                    leaf = cone(0.04 * grown, 0.0, 0.26 * grown, 4)
                    place(f"carrot_{i}_{k}", leaf, "carrot_top", at=(x + dx, 0.18, z + (0.05 if k == 2 else 0)), tilt=(0.0, dx * 5), parent=parent)
                continue
            outer = ico(0.17 * grown, 1)
            roughen(outer, 0.02, seed=row * 10 + i)
            place(f"cabbage_{row}_{i}", outer, "cabbage", at=(x, 0.3, z), turn=i, scale=(1, 0.8, 1), parent=parent)
            place(f"cabbage_heart_{row}_{i}", ico(0.09 * grown, 0), "sprout", at=(x, 0.4, z), parent=parent)


def build_field(parent, at):
    field = group("field", at=at, parent=parent)
    place("field_soil", box(PLOT_W, 0.08, PLOT_D), "soil_dark", at=(0, -0.02, 0), parent=field)
    for i, z in enumerate(ROWS):
        ridge = box(PLOT_W - 0.2, 0.14, 0.3)
        bmesh.ops.subdivide_edges(ridge, edges=ridge.edges[:], cuts=2)
        roughen(ridge, 0.025, seed=30 + i)
        place(f"ridge_{i}", ridge, "soil", at=(0, 0.04, z), parent=field)
    crops(field)
    fence(field)


def build_bed(parent, at):
    """わらの寝床。ドーナツ型にわらを盛り、真ん中にくぼみ"""
    bed = group("bed", at=at, parent=parent)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, segments=10, radius=0.42)
    ring = [v.co.copy() for v in bm.verts]
    bm.free()
    for i, (x, y, _) in enumerate(ring):
        tuft = ico(0.16, 1)
        roughen(tuft, 0.03, seed=40 + i)
        place(f"straw_{i}", tuft, "straw", at=(x, 0.1, -y * 0.85), scale=(1.1, 0.7, 1.1), parent=bed)
    place("straw_floor", cone(0.48, 0.44, 0.06, 10), "straw_dark", parent=bed)
    for i, angle in enumerate((0.4, 1.9, 3.6, 5.1)):
        straw = cone(0.012, 0.012, 0.24, 3)
        place(f"straw_stray_{i}", straw, "straw", at=(math.cos(angle) * 0.66, 0.02, math.sin(angle) * 0.66), turn=-angle, tilt=(0.0, math.pi / 2), parent=bed)


def build_bowl(parent, at):
    bowl = group("bowl", at=at, parent=parent)
    place("bowl_body", cone(0.14, 0.2, 0.14, 9), "bowl", parent=bowl)
    place("bowl_water", cone(0.16, 0.16, 0.01, 9), "water", at=(0, 0.12, 0), parent=bowl)


def build_gate(parent, at, turn):
    """ダンジョンの入口。石の枠と門、闇へ沈んでいく階段。奥から青い光が漏れる"""
    gate = group("gate", at=at, turn=turn, parent=parent)
    w, d = 0.8, 1.0
    hw, hd = w / 2 + 0.1, d / 2 + 0.1
    for i, (size, pos) in enumerate([((0.18, 0.14, d + 0.36), (-hw, 0, 0)), ((0.18, 0.14, d + 0.36), (hw, 0, 0)), ((w + 0.02, 0.14, 0.18), (0, 0, -hd))]):
        stone = box(*size)
        roughen(stone, 0.02, seed=50 + i)
        place(f"gate_rim_{i}", stone, "gate_stone", at=pos, parent=gate)
    place("gate_hole", box(w, 0.01, d), "gate_dark", at=(0, 0.005, 0), parent=gate)
    for i in range(4):
        mat = "gate_stone" if i < 2 else "stairs_glow"
        place(f"gate_step_{i}", box(w - 0.08, 0.012, 0.13), mat, at=(0, 0.012, d / 2 - 0.1 - i * 0.2), parent=gate)
    for sx in (-1, 1):
        pillar = box(0.2, 1.05, 0.2)
        bmesh.ops.subdivide_edges(pillar, edges=pillar.edges[:], cuts=2)
        roughen(pillar, 0.02, seed=60 + sx)
        place(f"gate_pillar_{sx}", pillar, "gate_stone", at=(sx * hw, 0, hd - 0.05), parent=gate)
    place("gate_lintel", box(w + 0.6, 0.18, 0.26), "gate_stone", at=(0, 1.03, hd - 0.05), parent=gate)
    place("gate_gem", ico(0.08, 0), "crystal", at=(0, 1.12, hd + 0.1), parent=gate, bevel=False)
    group("gate_mouth", at=(at[0], 0, at[2]), parent=parent)


def pine(parent, name, at, scale):
    tree = group(name, at=at, parent=parent)
    place(f"{name}_trunk", cone(0.12 * scale, 0.08 * scale, 0.6 * scale, 6), "trunk", parent=tree)
    for i in range(3):
        tier = cone((0.7 - i * 0.17) * scale, 0.0, (0.9 - i * 0.1) * scale, 7)
        roughen(tier, 0.05 * scale, seed=70 + i)
        place(f"{name}_tier_{i}", tier, "leaf" if i == 2 else "pine", at=(0, (0.4 + i * 0.5) * scale, 0), parent=tree)


def round_tree(parent, name, at, scale):
    tree = group(name, at=at, parent=parent)
    place(f"{name}_trunk", cone(0.14 * scale, 0.09 * scale, 0.9 * scale, 6), "trunk", parent=tree)
    for i, (dx, dy, dz, size, mat) in enumerate([(0, 1.2, 0, 1.0, "leaf"), (0.32, 1.02, 0.18, 0.62, "leaf_light"), (-0.28, 1.05, -0.12, 0.55, "leaf_light")]):
        blob = ico(0.55 * size * scale, 1)
        roughen(blob, 0.08 * scale, seed=80 + i)
        place(f"{name}_leaves_{i}", blob, mat, at=(dx * scale, dy * scale, dz * scale), parent=tree)


def build_trees(parent):
    """奥に木を並べ、手前は開けておく（カメラから家とモンスターが見えるように）"""
    pine(parent, "pine_0", (-3.1, 0, -1.2), 1.1)
    pine(parent, "pine_1", (-0.4, 0, -3.4), 0.95)
    pine(parent, "pine_2", (1.45, 0, -3.35), 0.7)
    round_tree(parent, "tree_0", (-2.3, 0, -2.85), 1.0)
    round_tree(parent, "tree_1", (3.25, 0, -1.9), 0.8)
    round_tree(parent, "tree_2", (-3.3, 0, 1.3), 0.7)
