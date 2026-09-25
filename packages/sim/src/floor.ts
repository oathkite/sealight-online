import { generateMaze } from "./maze";
import { createRng } from "./rng";
import type { Point } from "./types";

/** 全プレイヤー共通のダンジョンを決める種。変えるとダンジョンの地形がすべて変わる */
export const WORLD_SEED = 0x5ea11947;

/** 現在作り込んでいる最深の階。アップデートで増やす */
export const MAX_DEPTH = 20;

export const FLOOR_SIZE = { width: 21, height: 15 } as const;

/** 固定の地形。敵と宝の配置は含まない（潜るたびに変わる） */
export type Floor = {
  readonly depth: number;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly boolean[];
  /** 上の階からの降り口。帰り道のゴール */
  readonly entrance: Point;
  /** 下の階への階段 */
  readonly stairs: Point;
};

export const assertDepth = (depth: number): void => {
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    throw new RangeError(`depth must be an integer in [1, ${MAX_DEPTH}]: ${depth}`);
  }
};

export const floorSeed = (depth: number): number => (WORLD_SEED ^ Math.imul(depth, 0x9e3779b1)) >>> 0;

/** 階ごとに決まったシードで地形を作る。同じ階は誰がいつ作っても同じになる */
export const generateFloor = (depth: number): Floor => {
  assertDepth(depth);
  const maze = generateMaze({ ...FLOOR_SIZE, treasureCount: 0, monsterCount: 0 }, createRng(floorSeed(depth)));
  return {
    depth,
    width: maze.width,
    height: maze.height,
    cells: maze.cells,
    entrance: maze.start,
    stairs: maze.stairs,
  };
};
