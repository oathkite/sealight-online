"""家の場面（宙に浮かぶ島のジオラマ）を作り、ゲーム用の glb に書き出す。

Blender MCP か Blender の Python コンソールから実行する:
    import sys; sys.path.insert(0, "<repo>/art"); import build_home; build_home.main()

動かない部分はすべて 1 つのメッシュにまとめる（描画の回数を減らすため）。
ゲーム側で位置を使う目印（煙、ランタンの光、入口）は空の物体として残す。
"""

import math
import os

import bpy

import home_hut
import home_island
import home_yard
from home_layout import SPOTS, route_heading
from lowpoly import P, clear_scene, export_glb, group, node_of_type

ART_DIR = os.path.dirname(__file__)
GLB_PATH = os.path.join(ART_DIR, "..", "apps", "client", "public", "models", "home.glb")
BLEND_PATH = os.path.join(ART_DIR, "out", "home.blend")
MARKERS = ("smoke_origin", "lantern_light", "gate_mouth")


def build(root):
    home_island.build(root)
    home_hut.build_hut(root, SPOTS["hut"])
    home_hut.build_lantern(root, SPOTS["lantern"])
    home_hut.build_woodpile(root, SPOTS["woodpile"])
    home_yard.build_field(root, SPOTS["field"])
    home_yard.build_bed(root, SPOTS["bed"])
    home_yard.build_bowl(root, SPOTS["bowl"])
    home_yard.build_gate(root, SPOTS["gate"], route_heading() + math.pi)
    home_yard.build_trees(root)


def _unparent(obj):
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = world


def flatten(root):
    """メッシュを 1 つにまとめ、目印だけを root の子として残す"""
    # 親子をたどった位置（matrix_world）を計算し直してから外す
    bpy.context.view_layer.update()
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    markers = [o for o in root.children_recursive if o.name in MARKERS]
    for obj in meshes + markers:
        _unparent(obj)
    for obj in [o for o in root.children_recursive if o.type == "EMPTY"]:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    static = bpy.context.view_layer.objects.active
    static.name = "home_static"
    static.data.name = "home_static"
    for obj in (static, *markers):
        obj.parent = root


def preview_stage():
    """ゲームと同じ向きのカメラと、夕方の光（確認用のレンダリングに使う。書き出さない）"""
    cam_data = bpy.data.cameras.new("preview_camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 13
    cam = bpy.data.objects.new("preview_camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = P(10, 8.6, 10)
    direction = P(0, -1.4, 0) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("preview_sun", "SUN")
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.86, 0.68)
    sun_data.angle = 0.1
    sun = bpy.data.objects.new("preview_sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.35, 0.33, 0.42)
    background = node_of_type(world.node_tree, "ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.42, 0.38, 0.5, 1)
    background.inputs["Strength"].default_value = 0.9


def render(path, size=(1200, 1000)):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main(export=True, preview_path=None):
    clear_scene()
    root = group("home")
    build(root)
    flatten(root)
    if export:
        os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
        export_glb(GLB_PATH, ["home"])
    preview_stage()
    if preview_path:
        render(preview_path)
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    static = bpy.data.objects["home_static"]
    return {"vertices": len(static.data.vertices), "faces": len(static.data.polygons), "materials": len(static.data.materials)}
