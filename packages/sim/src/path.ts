import { isFloor } from "./maze";
import type { Maze, Point } from "./types";

type Grid = Pick<Maze, "width" | "height" | "cells">;

export const DIRECTIONS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const toIndex = (maze: Pick<Maze, "width">, p: Point): number => p.y * maze.width + p.x;

const rebuild = (maze: Grid, parents: ReadonlyMap<number, Point>, to: Point): readonly Point[] => {
  const path: Point[] = [to];
  let current = parents.get(toIndex(maze, to));
  while (current) {
    path.unshift(current);
    current = parents.get(toIndex(maze, current));
  }
  return path;
};

/**
 * 幅優先探索で最短経路を返す。始点と終点を含む。到達できなければ null。
 * passable を渡すと、そのマスだけを通る経路を探す（地図に載っているマスだけを歩く、など）。
 */
export const findPath = (
  maze: Grid,
  from: Point,
  to: Point,
  passable: (index: number) => boolean = () => true,
): readonly Point[] | null => {
  const canWalk = (p: Point): boolean => isFloor(maze, p) && passable(toIndex(maze, p));
  if (!canWalk(from) || !canWalk(to)) return null;

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
      if (!canWalk(next) || seen.has(key)) continue;
      seen.add(key);
      parents.set(key, current);
      queue.push(next);
    }
  }
  return null;
};
