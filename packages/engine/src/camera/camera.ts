import { lensShift, lookAt, multiply, perspective, projectPoint, transformPoint, type Mat4 } from "../math/mat4";
import type { Vec3 } from "../math/vec3";

export type Viewport = { readonly width: number; readonly height: number };
/** 画面の中の長方形（ピクセル、左上が原点） */
export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type CameraRig = {
  /** 見せたい点。見える場所の真ん中に写る */
  readonly target: Vec3;
  /** 見下ろす角度（ラジアン） */
  readonly pitch: number;
  /** 上下軸まわりの向き。0 で +z の側から -z を見る */
  readonly yaw: number;
  /** 見える場所の高さに対する画角 */
  readonly fovy: number;
  /** 必ず画面に収める範囲（x, z）と、物の高さ */
  readonly focus: { readonly min: readonly [number, number]; readonly max: readonly [number, number]; readonly height: number };
};

export type CameraFrame = {
  readonly eye: Vec3;
  readonly distance: number;
  readonly view: Mat4;
  readonly projection: Mat4;
  readonly viewProjection: Mat4;
  /** 地面の上で、カメラから見て奥へ向かう向き（x, z） */
  readonly forward: readonly [number, number];
};

const build = (rig: CameraRig, viewport: Viewport, visible: Rect, distance: number): CameraFrame => {
  const { target, pitch, yaw } = rig;
  const eye: Vec3 = [target[0] + Math.sin(yaw) * Math.cos(pitch) * distance, target[1] + Math.sin(pitch) * distance, target[2] + Math.cos(yaw) * Math.cos(pitch) * distance];
  // 画面全体の画角は、見える場所の高さに合わせた画角から広げる
  const fovy = 2 * Math.atan((Math.tan(rig.fovy / 2) * viewport.height) / visible.height);
  const dx = (visible.x + visible.width / 2 - viewport.width / 2) / (viewport.width / 2);
  const dy = -(visible.y + visible.height / 2 - viewport.height / 2) / (viewport.height / 2);
  const projection = lensShift(perspective(fovy, viewport.width / viewport.height, Math.max(0.1, distance * 0.05), distance + 60), dx, dy);
  const view = lookAt(eye, target, [0, 1, 0]);
  return { eye, distance, view, projection, viewProjection: multiply(projection, view), forward: [-Math.sin(yaw), -Math.cos(yaw)] };
};

/** 世界の点を、画面のピクセルの位置に写す */
export const toScreen = (frame: CameraFrame, viewport: Viewport, p: Vec3): readonly [number, number] => {
  const [x, y] = projectPoint(frame.viewProjection, p);
  return [((x + 1) / 2) * viewport.width, ((1 - y) / 2) * viewport.height];
};

const fits = (frame: CameraFrame, rig: CameraRig, viewport: Viewport, visible: Rect): boolean => {
  const { min, max, height } = rig.focus;
  for (const x of [min[0], max[0]]) {
    for (const z of [min[1], max[1]]) {
      for (const y of [0, height]) {
        // カメラの後ろに回った点は、写った位置があてにならないので収まっていないとみなす
        if (transformPoint(frame.view, [x, y, z])[2] > -0.5) return false;
        const [sx, sy] = toScreen(frame, viewport, [x, y, z]);
        if (sx < visible.x || sx > visible.x + visible.width || sy < visible.y || sy > visible.y + visible.height) return false;
      }
    }
  }
  return true;
};

/**
 * 画面の一部（visible）だけが見えるときのカメラ。見せたい点をその真ん中に写し（レンズシフト）、
 * 見せたい範囲が収まる一番近い距離まで寄る。カメラの向きは変えないので、どの画面でも同じ角度で見える
 */
export const frameCamera = (rig: CameraRig, viewport: Viewport, visible: Rect): CameraFrame => {
  let near = 1;
  let far = 400;
  for (let i = 0; i < 40; i += 1) {
    const mid = (near + far) / 2;
    if (fits(build(rig, viewport, visible, mid), rig, viewport, visible)) far = mid;
    else near = mid;
  }
  return build(rig, viewport, visible, far);
};
