import { cross, dot, normalize, sub, type Vec3 } from "./vec3";

/** 4×4 の行列。WebGL にそのまま渡せる列優先の並び */
export type Mat4 = Float32Array;
/** 法線を写す 3×3 の行列（列優先） */
export type Mat3 = Float32Array;

/** 行列の要素を読む（範囲外は 0） */
const at = (m: Float32Array, i: number): number => m[i] ?? 0;

export const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** a × b。点には b が先に効く */
export const multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += at(a, k * 4 + r) * at(b, c * 4 + k);
      out[c * 4 + r] = sum;
    }
  }
  return out;
};

/** 位置、上下軸まわりの向き、大きさから行列を作る。向き 0 で +z を向く */
export const compose = (position: Vec3, heading: number, size: Vec3): Mat4 => {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const [sx, sy, sz] = size;
  return new Float32Array([c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, position[0], position[1], position[2], 1]);
};

/** compose と同じ向きと大きさのときの、法線の行列（回転 × 大きさの逆数） */
export const normalMatrix = (heading: number, size: Vec3): Mat3 => {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const [sx, sy, sz] = size;
  return new Float32Array([c / sx, 0, -s / sx, 0, 1 / sy, 0, s / sz, 0, c / sz]);
};

export const perspective = (fovy: number, aspect: number, near: number, far: number): Mat4 => {
  const t = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = t / aspect;
  out[5] = t;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
};

export const orthographic = (left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 => {
  const out = new Float32Array(16);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = -2 / (far - near);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = -(far + near) / (far - near);
  out[15] = 1;
  return out;
};

export const lookAt = (eye: Vec3, target: Vec3, up: Vec3): Mat4 => {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
};

/**
 * 写った絵を画面の中でずらす（レンズシフト）。dx, dy は画面の幅と高さを 2 とした量。
 * 画面の一部がパネルで隠れるとき、見せたいものを見える場所の真ん中に写すのに使う
 */
export const lensShift = (projection: Mat4, dx: number, dy: number): Mat4 => {
  const shift = identity();
  shift[12] = dx;
  shift[13] = dy;
  return multiply(shift, projection);
};

/** 行列で点を写す（w で割らない） */
export const transformPoint = (m: Mat4, p: Vec3): Vec3 => [
  at(m, 0) * p[0] + at(m, 4) * p[1] + at(m, 8) * p[2] + at(m, 12),
  at(m, 1) * p[0] + at(m, 5) * p[1] + at(m, 9) * p[2] + at(m, 13),
  at(m, 2) * p[0] + at(m, 6) * p[1] + at(m, 10) * p[2] + at(m, 14),
];

/** 投影して w で割った、画面の座標（-1〜1）と深さ */
export const projectPoint = (m: Mat4, p: Vec3): Vec3 => {
  const [x, y, z] = transformPoint(m, p);
  const w = at(m, 3) * p[0] + at(m, 7) * p[1] + at(m, 11) * p[2] + at(m, 15);
  return [x / w, y / w, z / w];
};

/**
 * 位置、回転（x → y → z の順に回すオイラー角）、大きさから行列を作る。
 * モンスターの耳や目のように、3 つの軸で回す部品に使う
 */
export const composeEuler = (position: Vec3, rotation: Vec3, size: Vec3): Mat4 => {
  const [cx, cy, cz] = [Math.cos(rotation[0]), Math.cos(rotation[1]), Math.cos(rotation[2])];
  const [sx, sy, sz] = [Math.sin(rotation[0]), Math.sin(rotation[1]), Math.sin(rotation[2])];
  // R = Rz × Ry × Rx（列優先で並べる）
  const [kx, ky, kz] = size;
  return new Float32Array([
    cy * cz * kx, cy * sz * kx, -sy * kx, 0,
    (sx * sy * cz - cx * sz) * ky, (sx * sy * sz + cx * cz) * ky, sx * cy * ky, 0,
    (cx * sy * cz + sx * sz) * kz, (cx * sy * sz - sx * cz) * kz, cx * cy * kz, 0,
    position[0], position[1], position[2], 1,
  ]);
};

/** 行列の左上 3×3 の逆行列の転置。法線を正しく写す（つぶした形でも面に垂直なまま） */
export const normalFromMat4 = (m: Mat4): Mat3 => {
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = [at(m, 0), at(m, 1), at(m, 2), at(m, 4), at(m, 5), at(m, 6), at(m, 8), at(m, 9), at(m, 10)];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const det = a00 * b01 + a01 * b11 + a02 * b21 || 1;
  return new Float32Array([
    b01 / det, b11 / det, b21 / det,
    (-a22 * a01 + a02 * a21) / det, (a22 * a00 - a02 * a20) / det, (-a21 * a00 + a01 * a20) / det,
    (a12 * a01 - a02 * a11) / det, (-a12 * a00 + a02 * a10) / det, (a11 * a00 - a01 * a10) / det,
  ]);
};
