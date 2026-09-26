import { dot, type Vec3 } from "../math/vec3";

/** 3×3 の回転（行ごと） */
export type Rotation = readonly [Vec3, Vec3, Vec3];

export const rotationX = (a: number): Rotation => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
export const rotationY = (a: number): Rotation => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
export const rotationZ = (a: number): Rotation => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

/** a を先に、b を後に回す */
export const combine = (b: Rotation, a: Rotation): Rotation => {
  const col = (i: 0 | 1 | 2): Vec3 => [a[0][i], a[1][i], a[2][i]];
  const row = (r: Vec3): Vec3 => [dot(r, col(0)), dot(r, col(1)), dot(r, col(2))];
  return [row(b[0]), row(b[1]), row(b[2])];
};

export const rotate = (r: Rotation, v: Vec3): Vec3 => [dot(r[0], v), dot(r[1], v), dot(r[2], v)];

/** 逆向きに回す（回転の転置） */
export const unrotate = (r: Rotation, v: Vec3): Vec3 => [
  r[0][0] * v[0] + r[1][0] * v[1] + r[2][0] * v[2],
  r[0][1] * v[0] + r[1][1] * v[1] + r[2][1] * v[2],
  r[0][2] * v[0] + r[1][2] * v[1] + r[2][2] * v[2],
];
