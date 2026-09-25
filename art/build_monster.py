"""使役モンスター（仮）を作り、骨とアニメーション付きの glb に書き出す。

    import sys; sys.path.insert(0, "<repo>/art"); import build_monster; build_monster.main()

包帯（bandage, bandage_plaster）と荷物袋（sack, sack_tie）も含めて書き出す。
見せるかどうかはゲーム側で名前を指定して切り替える。
"""

import math
import os

import bpy

import monster_anim
import monster_parts
from lowpoly import P, clear_scene, export_glb

ART_DIR = os.path.dirname(__file__)
GLB_PATH = os.path.join(ART_DIR, "..", "apps", "client", "public", "models", "monster.glb")
BLEND_PATH = os.path.join(ART_DIR, "out", "monster.blend")


def preview(path, clip, frame):
    """確認用に、アニメーションの 1 コマを斜め上からレンダリングする"""
    rig = bpy.data.objects["monster"]
    rig.animation_data.action = bpy.data.actions[clip]
    bpy.context.scene.frame_set(frame)
    cam_data = bpy.data.cameras.new("preview_camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.3
    cam = bpy.data.objects.new("preview_camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = P(3, 2.9, 3)
    cam.rotation_euler = (P(0, 0.35, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("preview_sun", "SUN")
    sun_data.energy = 3.5
    sun = bpy.data.objects.new("preview_sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(45), 0, math.radians(-30))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 600
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rig.animation_data.action = None


def main(export=True, preview_path=None, clip="idle", frame=1):
    clear_scene()
    parts = monster_parts.build_parts()
    rig = monster_anim.build_rig()
    monster_anim.attach(rig, parts)
    monster_anim.build_clips(rig)
    if export:
        os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
        export_glb(GLB_PATH, ["monster"], compress=True)
    if preview_path:
        preview(preview_path, clip, frame)
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    return {"parts": len(parts), "clips": [a.name for a in bpy.data.actions]}
