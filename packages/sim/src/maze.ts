import type { Rng } from "./rng";
import type { Maze, Point } from "./types";

export type MazeOptions = {
  /** 5 以上の奇数 */
  readonly width: number;
  /** 5 以上の奇数 */
  readonly height: number;
  readonly treasureCount?: number;
  readonly monsterCount?: number;
};

const DEFAULT_TREASURE_COUNT = 3;

const assertCount = (label: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer: ${value}`);
  }
};

const STEPS: readonly Point[] = [
  { x: 0, y: -2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
];

const assertSize = (label: string, value: number): void => {
  if (!Number.isInteger(value) || value < 5 || value % 2 === 0) {
    throw new RangeError(`${label} must be an odd integer >= 5: ${value}`);
  }
};

export const isFloor = (maze: Pick<Maze, "width" | "height" | "cells">, p: Point): boolean =>
  p.x >= 0 && p.y >= 0 && p.x < maze.width && p.y < maze.height && maze.cells[p.y * maze.width + p.x] === true;

const shuffled = <T>(items: readonly T[], rng: Rng): readonly T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
};

/** 穴掘り法（反復版の再帰的バックトラック）で、奇数座標を部屋とする迷路の床を掘る */
const carve = (width: number, height: number, start: Point, rng: Rng): readonly boolean[] => {
  const cells = new Array<boolean>(width * height).fill(false);
  const open = (p: Point): void => {
    cells[p.y * width + p.x] = true;
  };
  const inRoom = (p: Point): boolean => p.x > 0 && p.y > 0 && p.x < width - 1 && p.y < height - 1;

  open(start);
  const stack: Point[] = [start];
  while (stack.length > 0) {
    const current = stack.at(-1) as Point;
    const candidates = STEPS.map((s) => ({ x: current.x + s.x, y: current.y + s.y })).filter(
      (p) => inRoom(p) && cells[p.y * width + p.x] === false,
    );
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[rng.int(candidates.length)] as Point;
    open({ x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 });
    open(next);
    stack.push(next);
  }
  return cells;
};

const floorPoints = (width: number, cells: readonly boolean[]): readonly Point[] =>
  cells.flatMap((floor, i) => (floor ? [{ x: i % width, y: Math.floor(i / width) }] : []));

export const generateMaze = (options: MazeOptions, rng: Rng): Maze => {
  const { width, height } = options;
  assertSize("width", width);
  assertSize("height", height);

  const start: Point = { x: 1, y: 1 };
  const cells = carve(width, height, start, rng);
  const candidates = shuffled(
    floorPoints(width, cells).filter((p) => p.x !== start.x || p.y !== start.y),
    rng,
  );
  const [stairs, ...rest] = candidates;
  if (!stairs) throw new RangeError("maze has no room for stairs");

  const requestedTreasures = options.treasureCount ?? DEFAULT_TREASURE_COUNT;
  const requestedMonsters = options.monsterCount ?? 0;
  assertCount("treasureCount", requestedTreasures);
  assertCount("monsterCount", requestedMonsters);

  const treasureCount = Math.min(requestedTreasures, rest.length);
  const treasures = rest.slice(0, treasureCount);
  const monsters = rest.slice(treasureCount, treasureCount + requestedMonsters);
  return { width, height, cells, start, stairs, treasures, monsters };
};
