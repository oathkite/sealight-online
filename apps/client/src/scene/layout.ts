import spots from "./spots.json";

export type Vec3 = readonly [number, number, number];

const toVec3 = (values: readonly number[]): Vec3 => [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];

/**
 * 家の場面の配置。カメラは右手前の斜め上から見下ろす（+x と +z の面が見える）。
 * Blender のモデル（art/build_home.py）も同じ spots.json を読んで作る
 */
export const SPOTS = {
  hut: toVec3(spots.spots.hut),
  field: toVec3(spots.spots.field),
  bed: toVec3(spots.spots.bed),
  bowl: toVec3(spots.spots.bowl),
  lantern: toVec3(spots.spots.lantern),
  woodpile: toVec3(spots.spots.woodpile),
  gate: toVec3(spots.spots.gate),
} as const satisfies Record<string, Vec3>;

/** 寝床からダンジョンの入口までの道。送り出しと帰りはこの上を歩く */
export const ROUTE: readonly Vec3[] = spots.route.map(toVec3);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const segmentLengths = new WeakMap<readonly Vec3[], readonly number[]>();

/** 道の区間ごとの長さ。毎フレーム呼ばれるので、道ごとに一度だけ計算する */
const lengthsOf = (route: readonly Vec3[]): readonly number[] => {
  const cached = segmentLengths.get(route);
  if (cached) return cached;
  const lengths = route.slice(1).map((p, i) => {
    const q = route[i] ?? p;
    return Math.hypot(p[0] - q[0], p[2] - q[2]);
  });
  segmentLengths.set(route, lengths);
  return lengths;
};

/** 道のりの割合 t（0〜1）の位置と、進む向き（y 軸まわりの角度） */
export const alongRoute = (route: readonly Vec3[], t: number): { readonly position: Vec3; readonly heading: number } => {
  const lengths = lengthsOf(route);
  const total = lengths.reduce((sum, l) => sum + l, 0);
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i] ?? 0;
    const from = route[i];
    const to = route[i + 1];
    if (!from || !to) break;
    if (remaining <= length || i === lengths.length - 1) {
      const k = length === 0 ? 1 : Math.min(1, remaining / length);
      return {
        position: [lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k)],
        heading: Math.atan2(to[0] - from[0], to[2] - from[2]),
      };
    }
    remaining -= length;
  }
  const only = route[0] ?? [0, 0, 0];
  return { position: only, heading: 0 };
};
