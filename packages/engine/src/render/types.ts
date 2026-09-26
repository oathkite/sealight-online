import type { CameraRig, Rect } from "../camera/camera";
import type { Color } from "../geometry/meshBuilder";
import type { Mat4 } from "../math/mat4";
import type { Vec3 } from "../math/vec3";
import type { Pose } from "../scene/scene";

/**
 * 材質の番号。頂点ごとに持たせ、シェーダーが塗り方を切り替える。
 * 光るもの（lamp, magic, flame）は、フレームごとに渡す glow の強さで明るさが変わる
 */
export const MATERIAL = {
  standard: 0,
  /** 夜に灯る窓やランタン（glow[0]） */
  lamp: 1,
  /** 魔法の光。ルーンや結晶（glow[1]） */
  magic: 2,
  /** 地面。草の模様と、マスに沿った道を描く */
  terrain: 3,
  water: 4,
  /** 葉。光を回り込ませ、上ほど明るくする */
  foliage: 5,
  /** つやのあるもの。目、金具 */
  gloss: 6,
  /** 炎。ゆらめく（glow[2]） */
  flame: 7,
  /** 目印の灯り。ほかの灯りと別に点け消しする（glow[3]） */
  beacon: 8,
} as const;

/** 点の光。radius より遠くには届かない */
export type PointLight = { readonly position: Vec3; readonly color: Color; readonly radius: number };

/** 水面。地面の窪みに張る楕円 */
export type Water = { readonly center: readonly [number, number]; readonly radius: readonly [number, number] };

/** 空と光。色は sRGB、sun / shade / fill は強さを掛けた値 */
export type Environment = {
  readonly skyTop: Color;
  readonly skyHorizon: Color;
  readonly sunDirection: Vec3;
  readonly sunColor: Color;
  /** 影の側の色（青紫がかった色にすると柔らかく見える） */
  readonly shadeColor: Color;
  /** 空からの照り返し */
  readonly fillColor: Color;
  /** 光るものの強さ：灯り、魔法、炎、目印の灯り */
  readonly glow: readonly [number, number, number, number];
  readonly stars: number;
  readonly clouds: number;
  /** 霞。見せたい点より奥へ near から far の距離で、地平の色に溶ける（カメラの遠さに左右されない） */
  readonly fog: { readonly near: number; readonly far: number };
  /** 奥の地面を下へ曲げる強さ（丸太のような世界） */
  readonly curve: number;
  /** 画面の四隅を暗くする強さ */
  readonly vignette: number;
  /** 最大 4 つ */
  readonly lights: readonly PointLight[];
};

export type ModelInstance = {
  readonly model: string;
  /** モデル全体の置き場所 */
  readonly placement: Mat4;
  readonly pose: Pose;
};

/** 粒（煙、蛍など）。1 粒あたり 8 個の数：x, y, z, 大きさ, r, g, b, 不透明度 */
export type ParticleSet = {
  readonly blend: "alpha" | "additive";
  readonly data: Float32Array;
  readonly count: number;
};

export type FrameInput = {
  readonly camera: CameraRig;
  /** パネルに隠れない、見える場所 */
  readonly visible: Rect;
  readonly environment: Environment;
  readonly models: readonly ModelInstance[];
  readonly particles: readonly ParticleSet[];
  readonly time: number;
};

export const PARTICLE_FLOATS = 8;
export const MAX_LIGHTS = 4;
export const MAX_WATERS = 2;
