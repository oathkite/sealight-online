import { createRng } from "@sealight/sim";
import {
  centerOf,
  createMeshBuilder,
  headingOf,
  MATERIAL,
  paintTiles,
  tilesOf,
  type MeshData,
  type TileLayer,
  type Vec3,
  type Water,
} from "@sealight/engine";
import { BOUNDS, HOME, PATHS, placementOf, ROUTE_TILES, type PropKind } from "./layout";
import { color } from "./palette";
import { buildHouse } from "./props/house";
import { buildGate } from "./props/gate";
import { buildBush, buildFlower, buildMushrooms, buildOak, buildPine, buildPondEdge, buildRock } from "./props/nature";
import type { LightAnchor, PropBuilder } from "./props/types";
import { buildBarrels, buildBed, buildBowl, buildCrates, buildGarden, buildLantern, buildSignpost, buildStump, buildWell, buildWoodpile } from "./props/yard";
import { shapesFor } from "./shapes";

const BUILDERS: Readonly<Record<PropKind, PropBuilder>> = {
  house: buildHouse, garden: buildGarden, woodpile: buildWoodpile, barrels: buildBarrels, well: buildWell, crates: buildCrates,
  lantern: buildLantern, bed: buildBed, bowl: buildBowl, gate: buildGate, pond: buildPondEdge, signpost: buildSignpost,
  stump: buildStump, oak: (s) => buildOak(s), pine: (s) => buildPine(s), bush: buildBush, rock: buildRock, mushrooms: buildMushrooms,
};

const pond = placementOf("pond");
const POND_CENTER = centerOf(pond);
/** 池の窪み（楕円の半径）。水面はその内側に張る */
const HOLLOW: readonly [number, number] = [1.7, 1.25];
export const POND_WATER: Water = { center: [POND_CENTER[0], POND_CENTER[2]], radius: [1.8, 1.33] };
const WATER_LEVEL = -0.14;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** 地面の高さ。庭は平らで、池だけ窪み、地図の外はゆるやかな丘になる */
export const groundHeight = (x: number, z: number): number => {
  const e = Math.hypot((x - POND_CENTER[0]) / HOLLOW[0], (z - POND_CENTER[2]) / HOLLOW[1]);
  const outside = Math.hypot(Math.max(BOUNDS.min[0] - x, 0, x - BOUNDS.max[0]), Math.max(BOUNDS.min[1] - z, 0, z - BOUNDS.max[1]));
  const hollow = -0.34 * smooth(1.2, 0.8, e);
  const hills = smooth(0.5, 7, outside) * (0.7 + 0.35 * Math.sin(x * 0.45) * Math.cos(z * 0.38));
  return hollow + hills;
};

const key = (c: number, r: number): string => `${c},${r}`;

/** 地図の外の森。奥と左右を木で囲み、庭を箱庭に見せる */
const forest = (builder: ReturnType<typeof createMeshBuilder>): void => {
  const rng = createRng(303);
  for (let placed = 0, tries = 0; placed < 46 && tries < 600; tries += 1) {
    const x = -20 + rng.next() * 39;
    const z = -17 + rng.next() * 25;
    const inside = x > BOUNDS.min[0] - 1.5 && x < BOUNDS.max[0] + 1.5 && z > BOUNDS.min[1] - 1.5;
    if (inside || z > BOUNDS.max[1] - 2) continue;
    const size = 0.9 + rng.next() * 0.45;
    const s = shapesFor(builder, { origin: [x, groundHeight(x, z) - 0.05, z], heading: rng.next() * Math.PI * 2 });
    if (rng.next() < 0.45) buildPine(s, size);
    else buildOak(s, size);
    placed += 1;
  }
};

/** 置き物のない、道でもない草地のマスに、ところどころ花を咲かせる */
const flowers = (builder: ReturnType<typeof createMeshBuilder>): void => {
  const taken = new Set([...HOME.flatMap((p) => tilesOf(p)), ...PATHS.flat(), ...ROUTE_TILES].map(([c, r]) => key(c, r)));
  const rng = createRng(202);
  for (let r = BOUNDS.min[1]; r <= BOUNDS.max[1]; r += 1) {
    for (let c = BOUNDS.min[0]; c <= BOUNDS.max[0]; c += 1) {
      const chance = rng.next();
      const [dx, dz, pick, size] = [rng.next() - 0.5, rng.next() - 0.5, rng.next(), 0.85 + rng.next() * 0.4];
      if (chance > 0.2 || taken.has(key(c, r)) || groundHeight(c, r) < -0.01) continue;
      buildFlower(shapesFor(builder, { origin: [c + dx * 0.6, 0, r + dz * 0.6], heading: pick * 6 }), pick, size);
    }
  }
};

export type HomeWorld = {
  readonly mesh: MeshData;
  readonly terrain: TileLayer;
  readonly waters: readonly Water[];
  readonly lights: readonly LightAnchor[];
  readonly smoke: Vec3 | null;
};

/** 家の場面の動かない物をすべて作り、1 つのメッシュにまとめる */
export const buildHomeWorld = (): HomeWorld => {
  const builder = createMeshBuilder();
  builder.heightfield({ min: [-44, -40], max: [43, 30], segments: 190, height: groundHeight, color: color("grass"), material: MATERIAL.terrain });
  builder.disc({ center: [POND_WATER.center[0], WATER_LEVEL, POND_WATER.center[1]], radius: [POND_WATER.radius[0] * 1.12, POND_WATER.radius[1] * 1.12], segments: 48, color: color("bowl_water"), material: MATERIAL.water });
  const anchors = HOME.map((p) => BUILDERS[p.kind](shapesFor(builder, { origin: centerOf(p), heading: headingOf(p.turn) })));
  forest(builder);
  flowers(builder);
  return {
    mesh: builder.build(),
    terrain: paintTiles(BOUNDS, [{ tiles: [...PATHS.flat(), ...ROUTE_TILES], value: 255 }]),
    waters: [POND_WATER],
    lights: anchors.flatMap((a) => a.lights ?? []),
    smoke: anchors.find((a) => a.smoke)?.smoke ?? null,
  };
};
