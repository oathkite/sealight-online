"""使役モンスターの骨とアニメーション。

骨はすべて真上に向ける。ポーズの軸は、x が右、y が上、z がカメラ側（ゲームの前）になる。
アニメーションは 24fps。ゲーム側（useAnimations）で名前を指定して再生する:
  idle   待機。呼吸、耳と尻尾のゆれ、まばたき
  hop    跳ねて歩く（送り出しと帰り）
  droop  しょんぼり（ボロボロで帰ってきたとき）
  cheer  喜ぶ（帰ってきて荷物を下ろすとき）
  sleep  眠る（夜の寝床）
"""

import math

import bpy

from lowpoly import P

FPS = 24

# 骨の名前、付け根（ゲームの座標）、長さ、親
BONES = [
    ("root", (0, 0, 0), 0.1, None),
    ("body", (0, 0, 0), 0.35, "root"),
    ("ear.L", (0.17, 0.5, -0.02), 0.15, "body"),
    ("ear.R", (-0.17, 0.5, -0.02), 0.15, "body"),
    ("eye.L", (0.1, 0.39, 0.29), 0.05, "body"),
    ("eye.R", (-0.1, 0.39, 0.29), 0.05, "body"),
    ("tail", (0, 0.16, -0.29), 0.1, "body"),
    ("foot.L", (0.14, 0.035, 0.08), 0.05, "root"),
    ("foot.R", (-0.14, 0.035, 0.08), 0.05, "root"),
]


def build_rig():
    data = bpy.data.armatures.new("monster_rig")
    rig = bpy.data.objects.new("monster", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, length, parent in BONES:
        bone = data.edit_bones.new(name)
        bone.head = P(*head)
        bone.tail = P(head[0], head[1] + length, head[2])
        bone.roll = 0
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    return rig


def attach(rig, parts):
    """部品を骨に付ける。見た目の位置は変えない"""
    bpy.context.view_layer.update()
    for obj, bone in parts:
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        bpy.context.view_layer.update()
        obj.matrix_world = world


class Clip:
    """1 つのアニメーションを作る。key(骨, コマ, loc=, rot=, scale=) でキーを打つ"""

    def __init__(self, rig, name, length):
        self.rig = rig
        self.name = name
        self.length = length
        self.action = bpy.data.actions.new(name)
        self.action.use_fake_user = True
        rig.animation_data_create()
        rig.animation_data.action = self.action
        for pose_bone in rig.pose.bones:
            pose_bone.location = (0, 0, 0)
            pose_bone.rotation_euler = (0, 0, 0)
            pose_bone.scale = (1, 1, 1)

    def key(self, bone, frame, loc=None, rot=None, scale=None):
        pose_bone = self.rig.pose.bones[bone]
        for attr, value in (("location", loc), ("rotation_euler", rot), ("scale", scale)):
            if value is None:
                continue
            setattr(pose_bone, attr, value)
            pose_bone.keyframe_insert(attr, frame=frame)

    def loop(self, bone, frames_values, attr):
        """同じ値で始まり終わる繰り返しのキー。frames_values は (コマ, 値) の並び"""
        for frame, value in frames_values:
            self.key(bone, frame, **{attr: value})

    def finish(self):
        track = self.rig.animation_data.nla_tracks.new()
        track.name = self.name
        track.strips.new(self.name, 1, self.action)
        track.mute = True
        self.rig.animation_data.action = None


def blink(clip, frame):
    for side in ("L", "R"):
        clip.loop(f"eye.{side}", [(1, (1, 1, 1)), (frame, (1, 1, 1)), (frame + 1, (1, 0.12, 1)), (frame + 3, (1, 0.12, 1)), (frame + 4, (1, 1, 1)), (clip.length, (1, 1, 1))], "scale")


def idle(rig):
    clip = Clip(rig, "idle", 49)
    clip.loop("body", [(1, (1, 1, 1)), (25, (1.035, 0.955, 1.035)), (49, (1, 1, 1))], "scale")
    clip.loop("ear.L", [(1, (0, 0, 0)), (13, (0, 0, -0.14)), (25, (0, 0, 0)), (49, (0, 0, 0))], "rot")
    clip.loop("ear.R", [(1, (0, 0, 0)), (25, (0, 0, 0)), (37, (0, 0, 0.14)), (49, (0, 0, 0))], "rot")
    clip.loop("tail", [(1, (0, -0.35, 0)), (13, (0, 0.35, 0)), (25, (0, -0.35, 0)), (37, (0, 0.35, 0)), (49, (0, -0.35, 0))], "rot")
    blink(clip, 32)
    clip.finish()


def hop(rig):
    """12 コマで 1 回跳ねる。着地でつぶれ、跳ぶ前に伸びる"""
    clip = Clip(rig, "hop", 13)
    clip.loop("root", [(1, (0, 0, 0)), (3, (0, 0.04, 0)), (7, (0, 0.2, 0)), (11, (0, 0.04, 0)), (13, (0, 0, 0))], "loc")
    clip.loop("body", [(1, (1.14, 0.84, 1.14)), (3, (0.92, 1.12, 0.92)), (7, (1, 1, 1)), (11, (0.95, 1.06, 0.95)), (13, (1.14, 0.84, 1.14))], "scale")
    for side, sign in (("L", 1), ("R", -1)):
        clip.loop(f"ear.{side}", [(1, (0, 0, -sign * 0.35)), (7, (0, 0, sign * 0.15)), (13, (0, 0, -sign * 0.35))], "rot")
        clip.loop(f"foot.{side}", [(1, (0, 0, 0)), (7, (sign * 0.6, 0, 0)), (13, (0, 0, 0))], "rot")
    clip.loop("tail", [(1, (0, 0, 0)), (7, (0.5, 0, 0)), (13, (0, 0, 0))], "rot")
    clip.finish()


def droop(rig):
    """しょんぼり。うつむいて耳が垂れ、目は半分閉じ、ゆっくり息をする"""
    clip = Clip(rig, "droop", 73)
    clip.loop("body", [(1, (0.18, 0, 0.07)), (37, (0.22, 0, 0.1)), (73, (0.18, 0, 0.07))], "rot")
    clip.loop("body", [(1, (1.04, 0.93, 1.04)), (37, (1.06, 0.9, 1.06)), (73, (1.04, 0.93, 1.04))], "scale")
    for side, sign in (("L", 1), ("R", -1)):
        clip.loop(f"ear.{side}", [(1, (0.5, 0, -sign * 0.9)), (37, (0.55, 0, -sign * 1.0)), (73, (0.5, 0, -sign * 0.9))], "rot")
        clip.loop(f"eye.{side}", [(1, (1, 0.5, 1)), (55, (1, 0.5, 1)), (57, (1, 0.12, 1)), (60, (1, 0.12, 1)), (62, (1, 0.5, 1)), (73, (1, 0.5, 1))], "scale")
    clip.loop("tail", [(1, (-0.6, 0, 0)), (73, (-0.6, 0, 0))], "rot")
    clip.finish()


def cheer(rig):
    """喜ぶ。つぶれてから大きく跳び、くるっと 1 回転。目はにっこり"""
    clip = Clip(rig, "cheer", 31)
    clip.loop("root", [(1, (0, 0, 0)), (4, (0, 0, 0)), (11, (0, 0.42, 0)), (18, (0, 0, 0)), (23, (0, 0.1, 0)), (27, (0, 0, 0)), (31, (0, 0, 0))], "loc")
    clip.loop("root", [(1, (0, 0, 0)), (4, (0, 0, 0)), (18, (0, math.tau, 0)), (31, (0, math.tau, 0))], "rot")
    clip.loop("body", [(1, (1, 1, 1)), (4, (1.2, 0.78, 1.2)), (7, (0.88, 1.18, 0.88)), (11, (1, 1, 1)), (18, (1.16, 0.82, 1.16)), (22, (1, 1, 1)), (31, (1, 1, 1))], "scale")
    for side, sign in (("L", 1), ("R", -1)):
        clip.loop(f"ear.{side}", [(1, (0, 0, 0)), (11, (0, 0, sign * 0.3)), (18, (0, 0, -sign * 0.4)), (24, (0, 0, sign * 0.15)), (31, (0, 0, 0))], "rot")
        clip.loop(f"eye.{side}", [(1, (1, 1, 1)), (4, (1.1, 0.3, 1)), (27, (1.1, 0.3, 1)), (31, (1, 1, 1))], "scale")
    clip.finish()


def sleep(rig):
    """眠る。目を閉じて低く丸まり、ゆっくり大きく息をする"""
    clip = Clip(rig, "sleep", 97)
    clip.loop("body", [(1, (1.1, 0.84, 1.1)), (49, (1.14, 0.8, 1.14)), (97, (1.1, 0.84, 1.1))], "scale")
    clip.loop("body", [(1, (0.1, 0, 0.12)), (97, (0.1, 0, 0.12))], "rot")
    for side, sign in (("L", 1), ("R", -1)):
        clip.loop(f"eye.{side}", [(1, (1.1, 0.08, 1)), (97, (1.1, 0.08, 1))], "scale")
        clip.loop(f"ear.{side}", [(1, (0.3, 0, -sign * 0.7)), (97, (0.3, 0, -sign * 0.7))], "rot")
    clip.loop("tail", [(1, (-0.3, 0.9, 0)), (49, (-0.3, 1.0, 0)), (97, (-0.3, 0.9, 0))], "rot")
    clip.finish()


def build_clips(rig):
    bpy.context.scene.render.fps = FPS
    for make in (idle, hop, droop, cheer, sleep):
        make(rig)
