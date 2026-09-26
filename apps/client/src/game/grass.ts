import { createRng } from "@sealight/sim";
import { tilesOf } from "@sealight/engine";
import { BOUNDS, HOME, PATHS, ROUTE_TILES, type PropKind } from "./layout";
import { groundHeight } from "./world";

/** 1 マスあたりの草の本数（密度 1 のとき） */
const PER_TILE = 90;
/** 地図の外にも少し生やし、庭の縁が切れて見えないようにする */
const MARGIN = 3;
/** 小さな物は、真ん中のまわりだけ草を避ける（マス全体を空けると不自然） */
const SMALL: ReadonlySet<PropKind> = new Set(["oak", "pine", "bush", "rock", "mushrooms", "stump", "signpost", "lantern", "crates", "flagpole"]);

const key = (c: number, r: number): string => `${c},${r}`;

const clearTiles = (): { readonly full: ReadonlySet<string>; readonly centers: readonly (readonly [number, number])[] } => {
  const full = new Set<string>([...PATHS.flat(), ...ROUTE_TILES].map(([c, r]) => key(c, r)));
  const centers: (readonly [number, number])[] = [];
  for (const p of HOME) {
    if (SMALL.has(p.kind)) centers.push(p.at);
    else for (const [c, r] of tilesOf(p)) full.add(key(c, r));
  }
  return { full, centers };
};

/**
 * 一面の草。1 本あたり 8 個の数（エンジンの FOLIAGE_FLOATS）（位置 x, y, z、高さ、向き、幅、明るさ、予備）。
 * 道、家や畑のマス、池の水の中には生やさない。density は画質の段階の草の割合
 */
export const scatterGrass = (density: number): Float32Array => {
  const { full, centers } = clearTiles();
  const rng = createRng(909);
  const out: number[] = [];
  const perTile = Math.round(PER_TILE * density);
  for (let r = BOUNDS.min[1] - MARGIN; r <= BOUNDS.max[1] + MARGIN; r += 1) {
    for (let c = BOUNDS.min[0] - MARGIN; c <= BOUNDS.max[0] + MARGIN; c += 1) {
      if (full.has(key(c, r))) continue;
      for (let i = 0; i < perTile; i += 1) {
        const x = c + rng.next() - 0.5;
        const z = r + rng.next() - 0.5;
        const [height, angle, width, shade] = [0.12 + rng.next() * 0.2, rng.next() * Math.PI * 2, 0.025 + rng.next() * 0.02, 0.8 + rng.next() * 0.4];
        const y = groundHeight(x, z);
        if (y < -0.04 || centers.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.32)) continue;
        out.push(x, y, z, height, angle, width, shade, 0);
      }
    }
  }
  return new Float32Array(out);
};
