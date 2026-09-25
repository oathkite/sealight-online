"""ローポリのモデルを組み立てる共通部品。

座標はゲーム（three.js）と同じ向きで書く。x は右、y は上、z は手前。
Blender は z が上なので、置くときに P() と S() で変換する。
glTF に書き出すと y が上に戻るので、ゲーム側の座標とそのまま一致する。
"""

import math

import bmesh
import bpy
from mathutils import Vector

# 絵本のような、少しくすんだ暖かい色。ゲーム側で光らせる色は名前で探す
COLORS = {
    "grass": "#78a860",
    "grass_tuft": "#8fbf68",
    "soil": "#7a5238",
    "soil_dark": "#5a3a28",
    "rock": "#6d6878",
    "rock_dark": "#4a4658",
    "rock_light": "#8a8494",
    "path": "#cdb48a",
    "sprout": "#9ad16e",
    "cabbage": "#a8d67a",
    "carrot_top": "#6fb050",
    "hut_wall": "#d9b98c",
    "hut_timber": "#6e4a34",
    "hut_stone": "#9a93a0",
    "roof": "#b0553f",
    "roof_dark": "#8a3f30",
    "door": "#5b3a28",
    "chimney": "#8c7f86",
    "straw": "#e8c870",
    "straw_dark": "#c9a650",
    "bowl": "#7a9ab8",
    "water": "#9fd4f0",
    "wood": "#8d6440",
    "wood_light": "#b88a5c",
    "leaf": "#5e9a58",
    "leaf_light": "#7fb865",
    "pine": "#3f7a5a",
    "trunk": "#6a4a36",
    "flower_pink": "#f2a0b8",
    "flower_yellow": "#f5d86a",
    "flower_white": "#f4f0e6",
    "gate_stone": "#8f8a9c",
    "gate_dark": "#15131f",
    "metal": "#ffd27a",
}

# 粘土の中で、つやを残すもの（ビーズの目、水、金具）
GLOSSY = {"eye": 0.25, "eye_shine": 0.2, "water": 0.15, "metal": 0.35}

# ゲーム側で明るさを変える（名前で探して emissiveIntensity を動かす）
GLOW = {
    "window": ("#ffcf7a", 0.2),
    "lantern": ("#ffd27a", 0.2),
    "crystal": ("#8fe0ff", 1.6),
    "stairs_glow": ("#7ad8ff", 0.5),
}


def P(x, y, z):
    """ゲームの座標を Blender の座標にする"""
    return Vector((x, -z, y))


def S(width, height, depth):
    """ゲームの寸法（幅、高さ、奥行き）を Blender の寸法にする"""
    return Vector((width, depth, height))


def _linear(hex_color):
    """sRGB の 16 進の色を、Blender の色（リニア）にする"""
    value = int(hex_color[1:], 16)
    channels = [((value >> shift) & 255) / 255 for shift in (16, 8, 0)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels] + [1.0]


def node_of_type(tree, bl_idname):
    """ノードを種類で探す（Blender の表示言語でノードの名前が変わるため）"""
    return next(n for n in tree.nodes if n.bl_idname == bl_idname)


def material(name):
    """名前の決まった色の材質。同じ名前なら使い回す"""
    found = bpy.data.materials.get(name)
    if found:
        return found
    mat = bpy.data.materials.new(name)
    bsdf = node_of_type(mat.node_tree, "ShaderNodeBsdfPrincipled")
    if name in GLOW:
        color, strength = GLOW[name]
        bsdf.inputs["Emission Color"].default_value = _linear(color)
        bsdf.inputs["Emission Strength"].default_value = strength
    else:
        color = COLORS[name]
    bsdf.inputs["Base Color"].default_value = _linear(color)
    # 粘土はつやのない質感。光を柔らかく散らす
    bsdf.inputs["Roughness"].default_value = GLOSSY.get(name, 0.97)
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.diffuse_color = _linear(color)
    return mat


def _noise(co, seed):
    """座標から -1〜1 の決まった値を作る。同じ座標なら同じ値になり、継ぎ目が開かない"""
    key = f"{co.x:.3f},{co.y:.3f},{co.z:.3f},{seed}"
    h = 2166136261
    for ch in key:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h / 0xFFFFFFFF * 2 - 1


def roughen(bm, amount, seed=1, vertical=1.0):
    """頂点を少しずつずらして、手で削ったような形にする。vertical はゲームの上下方向の割合"""
    for v in bm.verts:
        co = v.co.copy()
        v.co.x += _noise(co, seed) * amount
        v.co.y += _noise(co, seed + 1) * amount
        v.co.z += _noise(co, seed + 2) * amount * vertical


def cone(radius_bottom, radius_top, height, segments):
    """底面が原点、上に伸びる円錐台"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius_bottom, radius2=radius_top, depth=height)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, height / 2))
    return bm


def box(width, height, depth):
    """底面が原点の箱（ゲームの寸法で指定）"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, verts=bm.verts, vec=S(width, height, depth))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, height / 2))
    return bm


def ico(radius, subdivisions=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    return bm


# 角を丸める辺の条件。これより鋭く折れた辺だけを丸める（球のように元から丸い形はそのまま）
SHARP_ANGLE = math.radians(50)
# これより小さい部品（花の茎、目の光など）は角を丸めず、細分化もしない。
# 細分化は、先に角を丸めた形にだけかける（丸めずに細分化すると、箱が枕のように縮む）
MIN_SOFTEN_SIZE = 0.04


def _smallest_side(bm):
    if not bm.verts:
        return 0.0
    return min(max(v.co[i] for v in bm.verts) - min(v.co[i] for v in bm.verts) for i in range(3))


def round_edges(bm, size):
    """角の立った辺を丸め、粘土をこねて作ったような柔らかい形にする"""
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > SHARP_ANGLE]
    if size < MIN_SOFTEN_SIZE or not sharp:
        return
    bmesh.ops.bevel(bm, geom=sharp, offset=min(0.08, size * 0.25), segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)


def soften(obj, size):
    """細分化で角をさらに丸め、粘土をこねたふっくらした形にする。小さな部品はそのまま"""
    if size < MIN_SOFTEN_SIZE:
        return
    modifier = obj.modifiers.new("soften", "SUBSURF")
    modifier.levels = 1
    modifier.render_levels = 1


def apply_modifiers(objects):
    """細分化などを形に焼き込む（1 つのメッシュにまとめる前に必要）"""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if not obj.modifiers:
            continue
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        obj.modifiers.clear()
        obj.data = mesh


def place(name, bm, mat, at=(0, 0, 0), turn=0.0, tilt=(0.0, 0.0), scale=(1, 1, 1), parent=None, bevel=True):
    """形を物体として置く。at はゲームの座標、turn は上下軸まわりの回転、tilt は (x 軸, z 軸) まわりの傾き。
    bevel を切ると角を丸めない（地面や道のような大きな面）"""
    size = _smallest_side(bm)
    if bevel:
        round_edges(bm, size)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    # なめらかな陰影にする。手でこねた歪み（roughen）が、指で押したふくらみに見える
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(material(mat))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = P(*at)
    obj.rotation_euler = (tilt[0], -tilt[1], turn)
    obj.scale = S(*scale)
    if parent is not None:
        obj.parent = parent
    if bevel:
        soften(obj, size)
    return obj


def group(name, at=(0, 0, 0), turn=0.0, parent=None):
    """まとめ役の空の物体"""
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = P(*at)
    obj.rotation_euler = (0, 0, turn)
    if parent is not None:
        obj.parent = parent
    return obj


def clear_scene():
    """前回作ったものを全部消す"""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            collection.remove(block)


def rng(seed):
    """mulberry32。ゲーム側の配置（layout.ts）と同じ乱数を使う"""
    state = seed & 0xFFFFFFFF

    def next_value():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def _imul(a, b):
    return (a * b) & 0xFFFFFFFF


def export_glb(path, root_names, vertex_colors=False, compress=False):
    """指定した物体とその子孫だけを glb に書き出す"""
    bpy.ops.object.select_all(action="DESELECT")
    for name in root_names:
        root = bpy.data.objects[name]
        for obj in [root, *root.children_recursive]:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=True,
        export_extras=False,
        export_lights=False,
        export_cameras=False,
        export_vertex_color="ACTIVE" if vertex_colors else "NONE",
        # Draco で圧縮する。ゲーム側は public/draco/ の展開プログラムで読む
        export_draco_mesh_compression_enable=compress,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_color_quantization=8,
    )


def ring(count, radius, start=0.0):
    """円周上に並べる位置（ゲームの x, z）"""
    return [(math.cos(start + i * 2 * math.pi / count) * radius, math.sin(start + i * 2 * math.pi / count) * radius) for i in range(count)]
