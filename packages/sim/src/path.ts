import { isFloor } from "./maze";
import type { Maze, Point } from "./types";

export const DIRECTIONS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const toIndex = (maze: Maze, p: Point): number => p.y * maze.width + p.x;

const rebuild = (maze: Maze, parents: ReadonlyMap<number, Point>, to: Point): readonly Point[] => {
  const path: Point[] = [to];
  let current = parents.get(toIndex(maze, to));
  while (current) {
    path.unshift(current);
    current = parents.get(toIndex(maze, current));
  }
  return path;
};

/** 幅優先探索で最短経路を返す。始点と終点を含む。到達できなければ null。 */
export const findPath = (maze: Maze, from: Point, to: Point): readonly Point[] | null => {
  if (!isFloor(maze, from) || !isFloor(maze, to)) return null;

  const parents = new Map<number, Point>();
  const seen = new Set<number>([toIndex(maze, from)]);
  const queue: Point[] = [from];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (!current) break;
    if (current.x === to.x && current.y === to.y) return rebuild(maze, parents, to);

    for (const d of DIRECTIONS) {
      const next = { x: current.x + d.x, y: current.y + d.y };
      const key = toIndex(maze, next);
      if (!isFloor(maze, next) || seen.has(key)) continue;
      seen.add(key);
      parents.set(key, current);
      queue.push(next);
    }
  }
  return null;
};
