import {
  combine,
  MATERIAL,
  rotate,
  rotationY,
  supportBox,
  supportEllipsoid,
  supportFrustum,
  supportPoints,
  type MeshBuilder,
  type Rotation,
  type Vec3,
} from "@sealight/engine";
import { color, type ColorName } from "./palette";

export type Material = (typeof MATERIAL)[keyof typeof MATERIAL];

export type ShapeOptions = {
  /** 角の丸み（マス単位） */
  readonly round?: number;
  readonly material?: Material;
  readonly rotation?: Rotation;
};

/** 置き物の中の座標系。origin を中心に、上下軸まわりに heading だけ回した向き */
export type Frame = { readonly origin: Vec3; readonly heading: number };

const WORLD: Frame = { origin: [0, 0, 0], heading: 0 };

/**
 * 形を置く道具。位置は置き物の中の座標で書き、frame で世界の位置に直す。
 * 箱と円柱は底面の中心、卵形と包む形は中心の位置で指定する
 */
export const shapesFor = (builder: MeshBuilder, frame: Frame = WORLD) => {
  const turn = rotationY(frame.heading);
  const place = (p: Vec3): Vec3 => {
    const r = rotate(turn, p);
    return [frame.origin[0] + r[0], frame.origin[1] + r[1], frame.origin[2] + r[2]];
  };
  const orient = (rotation?: Rotation): Rotation => (rotation ? combine(turn, rotation) : turn);
  const common = (name: ColorName, options: ShapeOptions, size: number) => ({
    color: color(name),
    material: options.material ?? MATERIAL.standard,
    rotation: orient(options.rotation),
    size,
  });

  const box = (at: Vec3, size: Vec3, name: ColorName, options: ShapeOptions = {}): void => {
    const r = Math.min(options.round ?? 0.04, size[0] / 2, size[1] / 2, size[2] / 2);
    const center = place([at[0], at[1] + size[1] / 2, at[2]]);
    builder.hull(supportBox([size[0] / 2 - r, size[1] / 2 - r, size[2] / 2 - r]), { ...common(name, options, Math.max(...size)), radius: r, position: center });
  };

  const ball = (center: Vec3, radii: Vec3, name: ColorName, options: ShapeOptions = {}): void => {
    builder.hull(supportEllipsoid(radii), { ...common(name, options, Math.max(...radii) * 2), position: place(center) });
  };

  const cylinder = (at: Vec3, radiusBottom: number, radiusTop: number, height: number, name: ColorName, options: ShapeOptions = {}): void => {
    const r = Math.min(options.round ?? 0.03, radiusBottom, height / 2);
    const rotation = options.rotation;
    // 倒した円柱も、底面の中心を軸の端として置く
    const axis = rotation ? rotate(rotation, [0, height / 2, 0]) : ([0, height / 2, 0] as const);
    const center = place([at[0] + axis[0], at[1] + axis[1], at[2] + axis[2]]);
    builder.hull(supportFrustum(radiusBottom - r, Math.max(0, radiusTop - r), height - 2 * r), {
      ...common(name, options, Math.max(radiusBottom * 2, height)),
      radius: r,
      position: center,
    });
  };

  const hull = (points: readonly Vec3[], center: Vec3, name: ColorName, options: ShapeOptions = {}): void => {
    builder.hull(supportPoints(points), { ...common(name, options, 0.6), radius: options.round ?? 0.03, position: place(center), detail: 2 });
  };

  return { box, ball, cylinder, hull, place };
};

export type Shapes = ReturnType<typeof shapesFor>;
