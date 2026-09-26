import { normalize, type Vec3 } from "../math/vec3";

export type SphereMesh = {
  readonly vertices: readonly Vec3[];
  readonly triangles: readonly (readonly [number, number, number])[];
};

const T = (1 + Math.sqrt(5)) / 2;

const BASE: SphereMesh = {
  vertices: ([[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]] as const).map((v) => normalize(v)),
  triangles: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]],
};

/** 三角形を 4 つに割り、新しい頂点を球の表面に押し出す。辺の中点は隣の三角形と共有する */
const subdivide = (mesh: SphereMesh): SphereMesh => {
  const vertices = [...mesh.vertices];
  const cache = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const found = cache.get(key);
    if (found !== undefined) return found;
    const [p, q] = [vertices[a] ?? [0, 0, 0], vertices[b] ?? [0, 0, 0]];
    vertices.push(normalize([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]));
    cache.set(key, vertices.length - 1);
    return vertices.length - 1;
  };
  const triangles = mesh.triangles.flatMap(([a, b, c]) => {
    const [ab, bc, ca] = [midpoint(a, b), midpoint(b, c), midpoint(c, a)];
    return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]] as const;
  });
  return { vertices, triangles };
};

const levels: SphereMesh[] = [BASE];

/** 細かさ level（0〜3）の球。一度作ったものは使い回す */
export const sphereLevel = (level: number): SphereMesh => {
  const target = Math.max(0, Math.min(3, Math.floor(level)));
  while (levels.length <= target) levels.push(subdivide(levels[levels.length - 1] ?? BASE));
  return levels[target] ?? BASE;
};
