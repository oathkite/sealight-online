import { normalize, type Vec3 } from "../math/vec3";
import { rotate, unrotate, type Rotation } from "./rotation";
import { sphereLevel } from "./sphere";
import type { Support } from "./support";

/** 1 頂点の並び：位置 3、法線 3、色 3（sRGB）、材質 1 */
export const VERTEX_FLOATS = 10;

export type Color = readonly [number, number, number];

export type MeshData = {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
};

export type HullOptions = {
  readonly color: Color;
  /** 材質の番号。シェーダーが塗り方を切り替える */
  readonly material: number;
  /** 丸みの半径。支持点の形の外側にこの分だけふくらむ */
  readonly radius?: number;
  /** 球の細かさ（0〜3）。省くと大きさから決める */
  readonly detail?: number;
  readonly position?: Vec3;
  readonly rotation?: Rotation;
  /** 細かさを決めるための大きさ。省くと 0.5 とみなす */
  readonly size?: number;
};

export type HeightfieldOptions = {
  readonly min: readonly [number, number];
  readonly max: readonly [number, number];
  readonly segments: number;
  readonly height: (x: number, z: number) => number;
  readonly color: Color;
  readonly material: number;
};

export type DiscOptions = {
  readonly center: Vec3;
  readonly radius: readonly [number, number];
  readonly segments: number;
  readonly color: Color;
  readonly material: number;
};

/** 小さな物ほど粗い球から作り、頂点を節約する */
export const detailFor = (size: number): number => {
  if (size < 0.12) return 1;
  return size < 0.5 ? 2 : 3;
};

/**
 * メッシュを組み立てる。形を足していき、最後に build で 1 つのバッファにする。
 * 動かない物をまとめて 1 回で描けるよう、何個でも足せる
 */
export const createMeshBuilder = () => {
  const vertices: number[] = [];
  const indices: number[] = [];
  const count = (): number => vertices.length / VERTEX_FLOATS;
  const vertex = (p: Vec3, n: Vec3, color: Color, material: number): void => {
    vertices.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], material);
  };

  const hull = (support: Support, options: HullOptions): void => {
    const { radius = 0, position = [0, 0, 0], rotation, color, material } = options;
    const sphere = sphereLevel(options.detail ?? detailFor(options.size ?? 0.5));
    const base = count();
    for (const d of sphere.vertices) {
      const s = rotation ? rotate(rotation, support(unrotate(rotation, d))) : support(d);
      vertex([position[0] + s[0] + d[0] * radius, position[1] + s[1] + d[1] * radius, position[2] + s[2] + d[2] * radius], d, color, material);
    }
    for (const [a, b, c] of sphere.triangles) indices.push(base + a, base + b, base + c);
  };

  const heightfield = ({ min, max, segments, height, color, material }: HeightfieldOptions): void => {
    const base = count();
    const step = [(max[0] - min[0]) / segments, (max[1] - min[1]) / segments];
    const e = Math.min(step[0] ?? 1, step[1] ?? 1) * 0.25;
    for (let j = 0; j <= segments; j += 1) {
      for (let i = 0; i <= segments; i += 1) {
        const x = min[0] + i * (step[0] ?? 0);
        const z = min[1] + j * (step[1] ?? 0);
        const n = normalize([height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)]);
        vertex([x, height(x, z), z], n, color, material);
      }
    }
    for (let j = 0; j < segments; j += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = base + j * (segments + 1) + i;
        const c = a + segments + 1;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  };

  const disc = ({ center, radius, segments, color, material }: DiscOptions): void => {
    const base = count();
    vertex(center, [0, 1, 0], color, material);
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      vertex([center[0] + Math.cos(a) * radius[0], center[1], center[2] + Math.sin(a) * radius[1]], [0, 1, 0], color, material);
    }
    for (let i = 1; i <= segments; i += 1) indices.push(base, base + i, base + i + 1);
  };

  const build = (): MeshData => ({ vertices: new Float32Array(vertices), indices: new Uint32Array(indices) });

  return { hull, heightfield, disc, build, count };
};

export type MeshBuilder = ReturnType<typeof createMeshBuilder>;
