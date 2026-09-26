import { cross, normalize, type Vec3 } from "../math/vec3";

/**
 * 布。1 行目の辺を留め、そこから down の向きに広がる格子。
 * 垂れ幕なら across を横、down を下に。旗なら across を竿に沿って下、down を竿から外へ向ける
 */
export type ClothSpec = {
  /** 留める辺の端 */
  readonly origin: Vec3;
  readonly across: Vec3;
  readonly down: Vec3;
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly rows: number;
};

export type Cloth = {
  readonly spec: ClothSpec;
  readonly positions: Float32Array;
  readonly previous: Float32Array;
};

export type ClothForces = {
  readonly dt: number;
  /** 風の向きと強さ（世界の単位/秒²） */
  readonly wind: Vec3;
  readonly time: number;
};

const GRAVITY = 3.2;
const DAMPING = 0.975;
const ITERATIONS = 8;
const MAX_STEP = 1 / 30;

const restPosition = (spec: ClothSpec, c: number, r: number): Vec3 => {
  const u = (c / (spec.cols - 1)) * spec.width;
  const v = (r / (spec.rows - 1)) * spec.height;
  return [spec.origin[0] + spec.across[0] * u + spec.down[0] * v, spec.origin[1] + spec.across[1] * u + spec.down[1] * v, spec.origin[2] + spec.across[2] * u + spec.down[2] * v];
};

export const createCloth = (spec: ClothSpec): Cloth => {
  const positions = new Float32Array(spec.cols * spec.rows * 3);
  for (let r = 0; r < spec.rows; r += 1) for (let c = 0; c < spec.cols; c += 1) positions.set(restPosition(spec, c, r), (r * spec.cols + c) * 3);
  return { spec, positions, previous: positions.slice() };
};

/** 2 点の距離を rest に近づける。留めた点（1 行目）は動かさない */
const satisfy = (p: Float32Array, a: number, b: number, rest: number, cols: number): void => {
  const [ax, ay, az] = [p[a * 3] ?? 0, p[a * 3 + 1] ?? 0, p[a * 3 + 2] ?? 0];
  const [bx, by, bz] = [p[b * 3] ?? 0, p[b * 3 + 1] ?? 0, p[b * 3 + 2] ?? 0];
  const [dx, dy, dz] = [bx - ax, by - ay, bz - az];
  const d = Math.hypot(dx, dy, dz) || 1e-6;
  const pinA = a < cols;
  const pinB = b < cols;
  if (pinA && pinB) return;
  const k = (d - rest) / d;
  const [wa, wb] = pinA ? [0, 1] : pinB ? [1, 0] : [0.5, 0.5];
  p[a * 3] = ax + dx * k * wa; p[a * 3 + 1] = ay + dy * k * wa; p[a * 3 + 2] = az + dz * k * wa;
  p[b * 3] = bx - dx * k * wb; p[b * 3 + 1] = by - dy * k * wb; p[b * 3 + 2] = bz - dz * k * wb;
};

const constrain = (p: Float32Array, spec: ClothSpec): void => {
  const { cols, rows } = spec;
  const sx = spec.width / (cols - 1);
  const sy = spec.height / (rows - 1);
  const diag = Math.hypot(sx, sy);
  for (let it = 0; it < ITERATIONS; it += 1) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        if (c + 1 < cols) satisfy(p, i, i + 1, sx, cols);
        if (r + 1 < rows) satisfy(p, i, i + cols, sy, cols);
        if (c + 1 < cols && r + 1 < rows) satisfy(p, i, i + cols + 1, diag, cols);
        if (c > 0 && r + 1 < rows) satisfy(p, i, i + cols - 1, diag, cols);
      }
    }
  }
};

/**
 * 布を 1 コマ進める（ベルレ積分と距離の拘束）。元の布は変えずに次の布を返す。
 * 大きな時間は刻みの上限で切り、止まっていた後でも暴れないようにする
 */
export const stepCloth = (cloth: Cloth, { dt, wind, time }: ClothForces): Cloth => {
  const { spec } = cloth;
  const h = Math.min(dt, MAX_STEP);
  const next = cloth.positions.slice();
  const count = spec.cols * spec.rows;
  for (let i = spec.cols; i < count; i += 1) {
    const flutter = 0.55 + 0.45 * Math.sin(time * 4.3 + i * 0.73) * Math.sin(time * 1.7 + i * 0.31);
    const acc: Vec3 = [wind[0] * flutter, wind[1] * flutter - GRAVITY, wind[2] * flutter];
    for (let k = 0; k < 3; k += 1) {
      const p = cloth.positions[i * 3 + k] ?? 0;
      const q = cloth.previous[i * 3 + k] ?? 0;
      next[i * 3 + k] = p + (p - q) * DAMPING + (acc[k] ?? 0) * h * h;
    }
  }
  constrain(next, spec);
  return { spec, positions: next, previous: cloth.positions.slice() };
};

export type ClothMeshData = {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
};

const at = (p: Float32Array, i: number): Vec3 => [p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, p[i * 3 + 2] ?? 0];

/** 布を描くための形。法線は隣の点から求め、uv は格子の位置 */
export const clothMesh = (cloth: Cloth): ClothMeshData => {
  const { cols, rows } = cloth.spec;
  const p = cloth.positions;
  const normals = new Float32Array(p.length);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      const [l, rr, u, d] = [at(p, r * cols + Math.max(0, c - 1)), at(p, r * cols + Math.min(cols - 1, c + 1)), at(p, Math.max(0, r - 1) * cols + c), at(p, Math.min(rows - 1, r + 1) * cols + c)];
      const n = normalize(cross([rr[0] - l[0], rr[1] - l[1], rr[2] - l[2]], [d[0] - u[0], d[1] - u[1], d[2] - u[2]]));
      normals.set(n, i * 3);
      uvs.set([c / (cols - 1), r / (rows - 1)], i * 2);
      if (c + 1 < cols && r + 1 < rows) indices.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  return { positions: p, normals, uvs, indices: new Uint32Array(indices) };
};
