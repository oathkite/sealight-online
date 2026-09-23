import { generateMaze, isFloor } from "./maze";
import { DIRECTIONS } from "./path";
import { createRng, type Rng } from "./rng";
import type { LampEvent, LampInput, LampResult, Maze, Point } from "./types";

const keyOf = (p: Point): string => `${p.x},${p.y}`;
const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** 未踏の隣接マスを 1 つ選ぶ。分岐ではシードに従って揺らぎを持たせる */
const pickUnvisited = (maze: Maze, from: Point, visited: ReadonlySet<string>, rng: Rng): Point | undefined => {
  const options = DIRECTIONS.map((d) => ({ x: from.x + d.x, y: from.y + d.y })).filter(
    (p) => isFloor(maze, p) && !visited.has(keyOf(p)),
  );
  if (options.length <= 1) return options[0];
  return options[rng.int(options.length)];
};

/**
 * 1灯ぶんの探索をシミュレーションする。
 * キャラは深さ優先で未踏のマスを歩き、行き止まりでは来た道を戻り、階段を見つけたら止まる。
 * 同じ入力なら必ず同じ結果になる。
 */
export const simulateLamp = (input: LampInput): LampResult => {
  const rng = createRng(input.seed);
  const mazeOptions =
    input.treasureCount === undefined
      ? { width: input.width, height: input.height }
      : { width: input.width, height: input.height, treasureCount: input.treasureCount };
  const maze = generateMaze(mazeOptions, rng);

  const treasures = new Set(maze.treasures.map(keyOf));
  const visited = new Set<string>([keyOf(maze.start)]);
  const trail: Point[] = [maze.start];
  const events: LampEvent[] = [];

  const step = (to: Point): void => {
    events.push({ type: "move", to });
    if (treasures.delete(keyOf(to))) events.push({ type: "treasure", at: to });
  };

  while (trail.length > 0) {
    const current = trail.at(-1) as Point;
    if (same(current, maze.stairs)) {
      events.push({ type: "stairs", at: current });
      break;
    }
    const next = pickUnvisited(maze, current, visited, rng);
    if (next) {
      visited.add(keyOf(next));
      trail.push(next);
      step(next);
      continue;
    }
    trail.pop();
    const back = trail.at(-1);
    if (back) step(back);
  }

  return { input, maze, events };
};

/** POC で使う標準フロアの大きさ。サーバーとクライアントで同じ値を使う */
export const STANDARD_FLOOR = { width: 21, height: 15, treasureCount: 4 } as const;
