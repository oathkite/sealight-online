import type { Vec3 } from "../math/vec3";

/*
 * マスの決まり。1 マスは 1 単位で、マス (col, row) の中心が世界の (col, 0, row) にある。
 * col は右（+x）、row は手前（+z）へ増える。物の大きさはすべて整数のマスで決める
 */

export type Tile = readonly [col: number, row: number];
/** 90 度単位の向き（0〜3） */
export type Quarter = 0 | 1 | 2 | 3;
/** 幅（col の方向）と奥行き（row の方向）のマス数 */
export type Size = readonly [width: number, depth: number];

export type Placement = {
  readonly id: string;
  /** 占める範囲の、col と row が一番小さいマス */
  readonly at: Tile;
  readonly size: Size;
  readonly turn?: Quarter;
  /** 上を歩ける物（寝床、敷物など）。道を塞がない */
  readonly walkable?: boolean;
};

export type Bounds = { readonly min: Tile; readonly max: Tile };

export type LayoutIssue = {
  readonly kind: "overlap" | "outside" | "blocked" | "gap";
  readonly ids: readonly string[];
  readonly tile: Tile;
};

export const turnedSize = (size: Size, turn: Quarter = 0): Size => (turn % 2 === 1 ? [size[1], size[0]] : size);

export const headingOf = (turn: Quarter = 0): number => (turn * Math.PI) / 2;

export const tilesOf = (p: Placement): Tile[] => {
  const [w, d] = turnedSize(p.size, p.turn);
  const tiles: Tile[] = [];
  for (let r = 0; r < d; r += 1) for (let c = 0; c < w; c += 1) tiles.push([p.at[0] + c, p.at[1] + r]);
  return tiles;
};

export const tileCenter = (tile: Tile): Vec3 => [tile[0], 0, tile[1]];

/** 占めるマスの真ん中の、世界の位置 */
export const centerOf = (p: Placement): Vec3 => {
  const [w, d] = turnedSize(p.size, p.turn);
  return [p.at[0] + (w - 1) / 2, 0, p.at[1] + (d - 1) / 2];
};

const key = (t: Tile): string => `${t[0]},${t[1]}`;
const inside = (b: Bounds, t: Tile): boolean => t[0] >= b.min[0] && t[0] <= b.max[0] && t[1] >= b.min[1] && t[1] <= b.max[1];

const placementIssues = (bounds: Bounds, placements: readonly Placement[]): { issues: LayoutIssue[]; owner: Map<string, Placement> } => {
  const owner = new Map<string, Placement>();
  const issues: LayoutIssue[] = [];
  for (const p of placements) {
    for (const t of tilesOf(p)) {
      if (!inside(bounds, t)) issues.push({ kind: "outside", ids: [p.id], tile: t });
      const other = owner.get(key(t));
      if (other) issues.push({ kind: "overlap", ids: [other.id, p.id], tile: t });
      else owner.set(key(t), p);
    }
  }
  return { issues, owner };
};

const pathIssues = (paths: readonly (readonly Tile[])[], owner: Map<string, Placement>): LayoutIssue[] =>
  paths.flatMap((path) =>
    path.flatMap((t, i): LayoutIssue[] => {
      const prev = path[i - 1];
      const issues: LayoutIssue[] = [];
      if (prev && Math.abs(prev[0] - t[0]) + Math.abs(prev[1] - t[1]) !== 1) issues.push({ kind: "gap", ids: [], tile: t });
      const blocker = owner.get(key(t));
      if (blocker && !blocker.walkable) issues.push({ kind: "blocked", ids: [blocker.id], tile: t });
      return issues;
    }),
  );

/** 配置の問題を洗い出す。重なり、地図からのはみ出し、道の塞がりと途切れ。空の配列なら問題なし */
export const validateLayout = (layout: {
  readonly bounds: Bounds;
  readonly placements: readonly Placement[];
  readonly paths: readonly (readonly Tile[])[];
}): LayoutIssue[] => {
  const { issues, owner } = placementIssues(layout.bounds, layout.placements);
  return [...issues, ...pathIssues(layout.paths, owner)];
};

/** 道のマスの中心を順に並べた点。モンスターが歩く道筋になる */
export const pathPoints = (tiles: readonly Tile[]): Vec3[] => tiles.map(tileCenter);

export type TileLayer = {
  readonly bounds: Bounds;
  readonly width: number;
  readonly height: number;
  /** 行ごと（row が小さい方から）、各行は col が小さい方から */
  readonly data: Uint8Array;
};

/** マスごとの値の地図を作る。地面のシェーダーに渡し、道や砂地をマスに沿って描く */
export const paintTiles = (bounds: Bounds, layers: readonly { readonly tiles: readonly Tile[]; readonly value: number }[]): TileLayer => {
  const width = bounds.max[0] - bounds.min[0] + 1;
  const height = bounds.max[1] - bounds.min[1] + 1;
  const data = new Uint8Array(width * height);
  for (const { tiles, value } of layers) {
    for (const t of tiles) if (inside(bounds, t)) data[(t[1] - bounds.min[1]) * width + (t[0] - bounds.min[0])] = value;
  }
  return { bounds, width, height, data };
};
