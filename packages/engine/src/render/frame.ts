import type { Color } from "../geometry/meshBuilder";
import { lookAt, multiply, orthographic, type Mat4 } from "../math/mat4";
import { add, scale, type Vec3 } from "../math/vec3";
import { MAX_LIGHTS, MAX_WATERS, type Environment, type Water } from "./types";

/** Frame ブロック（シェーダーの uniform ブロック）の中の位置。std140 で mat4 は 16、vec4 は 4 個分 */
export const FRAME_OFFSET = {
  viewProjection: 0,
  lightViewProjection: 16,
  eye: 32,
  sunDirection: 36,
  sun: 40,
  shade: 44,
  fill: 48,
  horizon: 52,
  glow: 56,
  focus: 60,
  viewport: 64,
  terrain: 68,
  lightPosition: 72,
  lightColor: 72 + MAX_LIGHTS * 4,
  water: 72 + MAX_LIGHTS * 8,
} as const;

export const FRAME_FLOATS = FRAME_OFFSET.water + MAX_WATERS * 4;

export const toLinear = (c: Color): Color => [c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2];

export type FrameValues = {
  readonly environment: Environment;
  readonly viewProjection: Mat4;
  readonly lightViewProjection: Mat4;
  readonly eye: Vec3;
  readonly time: number;
  readonly focus: readonly [number, number];
  readonly forward: readonly [number, number];
  readonly viewport: readonly [number, number];
  readonly shadowSize: number;
  readonly terrain: { readonly min: readonly [number, number]; readonly size: readonly [number, number] };
  readonly waters: readonly Water[];
};

/** フレームに共通の値を、Frame ブロックの並びで 1 本の配列に詰める（GPU には 1 回で送る） */
export const packFrame = (v: FrameValues): Float32Array => {
  const out = new Float32Array(FRAME_FLOATS);
  const put = (offset: number, values: readonly number[]): void => out.set(values, offset);
  const env = v.environment;
  const lights = env.lights.slice(0, MAX_LIGHTS);
  const waters = v.waters.slice(0, MAX_WATERS);
  put(FRAME_OFFSET.viewProjection, Array.from(v.viewProjection));
  put(FRAME_OFFSET.lightViewProjection, Array.from(v.lightViewProjection));
  put(FRAME_OFFSET.eye, [...v.eye, v.time]);
  put(FRAME_OFFSET.sunDirection, [...env.sunDirection, env.curve]);
  put(FRAME_OFFSET.sun, [...env.sunColor, env.fog.near]);
  put(FRAME_OFFSET.shade, [...env.shadeColor, env.fog.far]);
  put(FRAME_OFFSET.fill, [...env.fillColor, env.vignette]);
  put(FRAME_OFFSET.horizon, [...env.skyHorizon, v.shadowSize]);
  put(FRAME_OFFSET.glow, env.glow);
  put(FRAME_OFFSET.focus, [...v.focus, ...v.forward]);
  put(FRAME_OFFSET.viewport, [...v.viewport, lights.length, waters.length]);
  put(FRAME_OFFSET.terrain, [...v.terrain.min, ...v.terrain.size]);
  lights.forEach((l, i) => {
    put(FRAME_OFFSET.lightPosition + i * 4, [...l.position, l.radius]);
    put(FRAME_OFFSET.lightColor + i * 4, [...l.color, 0]);
  });
  waters.forEach((w, i) => put(FRAME_OFFSET.water + i * 4, [...w.center, ...w.radius]));
  return out;
};

/** 影の地図を描くための、太陽から見た行列。見せたい点を中心に、±extent の範囲を収める */
export const sunView = (direction: Vec3, focus: Vec3, extent: number): Mat4 => {
  const eye = add(focus, scale(direction, extent * 3));
  const up: Vec3 = Math.abs(direction[1]) > 0.97 ? [0, 0, 1] : [0, 1, 0];
  return multiply(orthographic(-extent, extent, -extent, extent, 0.5, extent * 7), lookAt(eye, focus, up));
};
