import type { Bounds, Placement, Tile, Vec3 } from "@sealight/engine";

/*
 * 家の場面の配置。1 マスが 1 単位で、マス (col, row) の中心が世界の (col, 0, row)。
 * カメラは手前（+row）の上から奥を見る。家と畑が奥、寝床が真ん中、ダンジョンの入口が手前
 */

export const BOUNDS: Bounds = { min: [-10, -8], max: [9, 6] };

/** 置き物の種類。見た目の作り方（props）と対応する */
export type PropKind =
  | "house" | "garden" | "woodpile" | "barrels" | "well" | "lantern" | "bed" | "bowl" | "gate" | "pond"
  | "signpost" | "crates" | "oak" | "pine" | "bush" | "rock" | "mushrooms" | "stump" | "flagpole";

export type HomePlacement = Placement & { readonly kind: PropKind };

const at = (id: string, kind: PropKind, tile: Tile, size: readonly [number, number] = [1, 1], extra: Partial<Placement> = {}): HomePlacement => ({
  id, kind, at: tile, size, ...extra,
});

export const HOME: readonly HomePlacement[] = [
  at("house", "house", [-5, -5], [4, 3]),
  at("garden", "garden", [1, -5], [4, 3]),
  at("woodpile", "woodpile", [-1, -5]),
  at("barrels", "barrels", [0, -4]),
  at("well", "well", [5, -1], [2, 2]),
  at("crates", "crates", [7, -1]),
  at("lantern", "lantern", [-2, -2]),
  at("bed", "bed", [0, -1], [1, 1], { walkable: true }),
  at("bowl", "bowl", [-1, 0]),
  at("gate", "gate", [-1, 2], [3, 2], { walkable: true }),
  at("pond", "pond", [-8, 1], [4, 3]),
  at("signpost", "signpost", [-5, -1]),
  at("oak-1", "oak", [-8, -4]),
  at("pine-1", "pine", [-7, -6]),
  at("oak-2", "oak", [6, -4]),
  at("pine-2", "pine", [8, -3]),
  at("oak-3", "oak", [-9, -2]),
  at("pine-3", "pine", [-1, -7]),
  at("oak-4", "oak", [4, -7]),
  at("pine-4", "pine", [8, 2]),
  at("bush-1", "bush", [3, 3]),
  at("bush-2", "bush", [6, 3]),
  at("bush-3", "bush", [-3, 4]),
  at("rock-1", "rock", [5, 4]),
  at("rock-2", "rock", [-4, 2]),
  at("mushrooms", "mushrooms", [2, 1]),
  at("stump", "stump", [-6, -2]),
  at("flagpole", "flagpole", [-6, -5]),
];

/** 寝床。モンスターが待つマス */
export const homeTile: Tile = [0, -1];

/** 地面に描く道（マス単位）。家の扉から寝床へ、町へ続く道、井戸へ */
export const PATHS: readonly (readonly Tile[])[] = [
  [[-3, -2], [-3, -1], [-2, -1], [-1, -1], [0, -1]],
  [[-3, -1], [-4, -1], [-4, 0], [-5, 0], [-6, 0], [-7, 0], [-8, 0], [-9, 0], [-10, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
];

/** モンスターが歩く道。寝床から入口の門の下まで */
export const ROUTE_TILES: readonly Tile[] = [homeTile, [0, 0], [0, 1], [0, 2]];

/** 入口の階段の底（地面の下）。ここへ下りていき、ここから上がってくる */
export const STAIRS_BOTTOM: Vec3 = [0, -0.9, 3.4];

export const placementOf = (id: string): HomePlacement => {
  const found = HOME.find((p) => p.id === id);
  if (!found) throw new Error(`unknown placement: ${id}`);
  return found;
};
