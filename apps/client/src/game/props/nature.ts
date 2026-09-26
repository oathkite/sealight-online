import { createRng } from "@sealight/sim";
import { MATERIAL, type Vec3 } from "@sealight/engine";
import type { ColorName } from "../palette";
import type { Shapes } from "../shapes";
import type { PropAnchors } from "./types";

const NONE: PropAnchors = {};

/** 風で揺れる重み。木の葉の塊は同じ木の中で一緒に動くよう一定にし、草花は根元を止めて先を揺らす */
const CANOPY = [0.18, 0.18] as const;
const BUSH = [0.07, 0.07] as const;
const FLOWER = 0.5;

/** 広葉樹。ふくらんだ葉の塊に、赤い実がいくつか */
export const buildOak = (s: Shapes, size = 1): PropAnchors => {
  const k = size;
  s.cylinder([0, 0, 0], 0.22 * k, 0.15 * k, 1.35 * k, "trunk", { round: 0.06 * k });
  s.ball([0, 2.0 * k, 0], [0.95 * k, 0.8 * k, 0.95 * k], "leaf", { material: MATERIAL.foliage, sway: CANOPY });
  ([[0.55, 1.75, 0.35], [-0.6, 1.8, 0.15], [0.1, 1.8, -0.6], [0.1, 2.4, 0.15]] as const).forEach(([x, y, z], i) =>
    s.ball([x * k, y * k, z * k], [0.55 * k, 0.5 * k, 0.55 * k], i % 2 ? "leaf" : "leaf_light", { material: MATERIAL.foliage, sway: CANOPY }));
  ([[0.45, 1.6, 0.78], [-0.4, 1.75, 0.8], [0.82, 2.0, 0.3]] as const).forEach(([x, y, z]) =>
    s.ball([x * k, y * k, z * k], [0.09 * k, 0.09 * k, 0.09 * k], "apple", { material: MATERIAL.gloss, sway: CANOPY }));
  return NONE;
};

/** 針葉樹。丸みのある円錐を 3 段重ねる */
export const buildPine = (s: Shapes, size = 1): PropAnchors => {
  const k = size;
  s.cylinder([0, 0, 0], 0.16 * k, 0.12 * k, 0.75 * k, "trunk", { round: 0.05 * k });
  ([[0.5, 0.95, 1.25], [1.15, 0.72, 1.05], [1.72, 0.5, 0.9]] as const).forEach(([y, r, h], i) =>
    s.cylinder([0, y * k, 0], r * k, 0, h * k, "pine", { material: MATERIAL.foliage, round: 0.14 * k, sway: [0.03 + i * 0.05, 0.1 + i * 0.07] }));
  return NONE;
};

/** 茂み。小さな花がのぞく */
export const buildBush = (s: Shapes): PropAnchors => {
  ([[0, 0, 0.45], [0.32, 0.12, 0.33], [-0.28, 0.16, 0.3]] as const).forEach(([x, z, r]) => s.ball([x, r * 0.72, z], [r, r * 0.82, r], "leaf", { material: MATERIAL.foliage, sway: BUSH }));
  const rng = createRng(41);
  for (let i = 0; i < 6; i += 1) {
    const a = rng.next() * Math.PI * 2;
    s.ball([Math.cos(a) * 0.32, 0.25 + rng.next() * 0.25, Math.sin(a) * 0.3 + 0.12], [0.055, 0.05, 0.055], "flower_lavender", { sway: BUSH });
  }
  return NONE;
};

/** 苔の乗った石 */
export const buildRock = (s: Shapes): PropAnchors => {
  const rng = createRng(73);
  const points: Vec3[] = Array.from({ length: 9 }, () => {
    const a = rng.next() * Math.PI * 2;
    const b = rng.next() * Math.PI;
    return [Math.cos(a) * Math.sin(b) * 0.36, Math.abs(Math.cos(b)) * 0.26, Math.sin(a) * Math.sin(b) * 0.32];
  });
  s.hull(points, [0, 0, 0], "rock", { round: 0.1 });
  s.ball([0.02, 0.32, 0], [0.22, 0.06, 0.18], "moss", { material: MATERIAL.foliage });
  return NONE;
};

/** 赤いキノコの群れ */
export const buildMushrooms = (s: Shapes): PropAnchors => {
  ([[-0.15, 0.05, 1], [0.18, -0.1, 0.8], [0.05, 0.22, 0.6]] as const).forEach(([x, z, k]) => {
    s.cylinder([x, 0, z], 0.05 * k, 0.045 * k, 0.18 * k, "mushroom_stem", { round: 0.02 });
    s.ball([x, 0.2 * k, z], [0.14 * k, 0.09 * k, 0.14 * k], "mushroom");
    for (const [dx, dz] of [[0.05, 0.06], [-0.06, 0.02], [0.01, -0.07]] as const) s.ball([x + dx * k, 0.27 * k, z + dz * k], [0.025 * k, 0.012 * k, 0.025 * k], "mushroom_dot");
  });
  return NONE;
};

/** 池のまわりの葦と、水に浮かぶ睡蓮の葉。窪みと水面はエンジンの地面と水で描く */
export const buildPondEdge = (s: Shapes): PropAnchors => {
  ([[-0.6, -0.25, 0.26], [0.55, 0.35, 0.2], [0.05, -0.5, 0.16]] as const).forEach(([x, z, r]) => s.ball([x, -0.125, z], [r, 0.014, r * 0.9], "lily", { material: MATERIAL.foliage }));
  ([[-1.55, -0.7, 0.62], [-1.65, -0.4, 0.48], [1.6, 0.55, 0.52], [1.5, 0.78, 0.42], [-1.2, 0.95, 0.4]] as const).forEach(([x, z, h]) =>
    s.cylinder([x, -0.08, z], 0.035, 0, h, "reed", { round: 0.012, material: MATERIAL.foliage, sway: [0, 0.7] }));
  ([[1.7, -0.6], [-1.85, 0.3], [0.9, 1.25]] as const).forEach(([x, z], i) => s.ball([x, 0.02, z], [0.2 + i * 0.03, 0.12, 0.17], i % 2 ? "rock" : "stone"));
  return NONE;
};

const FLOWERS: readonly ColorName[] = ["flower_pink", "flower_yellow", "flower_white", "flower_lavender"];

/** 野の花。茎と 5 枚の花びら */
export const buildFlower = (s: Shapes, pick: number, size: number): void => {
  const petal = FLOWERS[Math.floor(pick * FLOWERS.length) % FLOWERS.length] ?? "flower_white";
  s.cylinder([0, 0, 0], 0.016, 0.013, 0.17 * size, "reed", { round: 0.006, sway: [0, FLOWER] });
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2 + pick * 3;
    s.ball([Math.cos(a) * 0.05 * size, 0.18 * size, Math.sin(a) * 0.05 * size], [0.045 * size, 0.02 * size, 0.045 * size], petal, { sway: [FLOWER, FLOWER] });
  }
  s.ball([0, 0.19 * size, 0], [0.028 * size, 0.022 * size, 0.028 * size], petal === "flower_yellow" ? "flower_white" : "flower_yellow", { sway: [FLOWER, FLOWER] });
};
