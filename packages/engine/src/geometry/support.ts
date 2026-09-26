import { dot, type Vec3 } from "../math/vec3";

/**
 * 支持点の関数。向き d（長さ 1）に対して、形の中で一番その向きに張り出した点を返す。
 * 球の頂点をこの点に写し、さらに d の向きに丸みの半径だけ押し出すと、角の丸い形になる
 * （形と球のミンコフスキー和）。法線はそのまま d になるので、陰影がなめらかにつながる
 */
export type Support = (d: Vec3) => Vec3;

/** 中心が原点の箱。half は各軸の半分の長さ */
export const supportBox = (half: Vec3): Support => (d) => [Math.sign(d[0]) * half[0], Math.sign(d[1]) * half[1], Math.sign(d[2]) * half[2]];

/** 中心が原点の卵形（楕円体）。radii は各軸の半径 */
export const supportEllipsoid = (radii: Vec3): Support => (d) => {
  const [a, b, c] = radii;
  const k = Math.sqrt(a * a * d[0] * d[0] + b * b * d[1] * d[1] + c * c * d[2] * d[2]) || 1;
  return [(a * a * d[0]) / k, (b * b * d[1]) / k, (c * c * d[2]) / k];
};

/** 中心が原点で上下に伸びる円錐台。上の半径を 0 にすると円錐になる */
export const supportFrustum = (radiusBottom: number, radiusTop: number, height: number): Support => (d) => {
  const l = Math.hypot(d[0], d[2]);
  const hx = l > 1e-6 ? d[0] / l : 0;
  const hz = l > 1e-6 ? d[2] / l : 0;
  const bottom: Vec3 = [hx * radiusBottom, -height / 2, hz * radiusBottom];
  const top: Vec3 = [hx * radiusTop, height / 2, hz * radiusTop];
  return dot(d, bottom) > dot(d, top) ? bottom : top;
};

/** 点の集まりを包む形（凸包）。石や切妻の壁、結晶など */
export const supportPoints = (points: readonly Vec3[]): Support => (d) =>
  points.reduce<Vec3>((best, p) => (dot(p, d) > dot(best, d) ? p : best), points[0] ?? [0, 0, 0]);
