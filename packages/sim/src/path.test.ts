import { describe, expect, it } from "vitest";
import type { Maze } from "./types";
import { findPath } from "./path";

// "#" = 壁, "." = 床
const fromAscii = (rows: readonly string[]): Maze => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  cells: rows.flatMap((row) => [...row].map((c) => c === ".")),
  start: { x: 1, y: 1 },
  stairs: { x: 1, y: 1 },
  treasures: [],
  monsters: [],
});

describe("findPath", () => {
  const maze = fromAscii([
    "#######",
    "#.....#",
    "#.###.#",
    "#...#.#",
    "#######",
  ]);

  it("最短経路を始点と終点を含めて返す", () => {
    const path = findPath(maze, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it("始点と終点が同じなら 1 マスの経路を返す", () => {
    expect(findPath(maze, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });

  it("到達できないときは null を返す", () => {
    const split = fromAscii(["#####", "#.#.#", "#####"]);
    expect(findPath(split, { x: 1, y: 1 }, { x: 3, y: 1 })).toBeNull();
  });

  it("始点か終点が壁なら null を返す", () => {
    expect(findPath(maze, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    expect(findPath(maze, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe("findPath で通れるマスを絞る", () => {
  const maze = fromAscii(["#######", "#.....#", "#.###.#", "#...#.#", "#######"]);
  const index = (x: number, y: number): number => y * maze.width + x;

  it("通れるマスだけを通る経路を返す", () => {
    const known = new Set([index(1, 1), index(2, 1), index(3, 1), index(4, 1), index(5, 1), index(5, 2), index(5, 3)]);
    const path = findPath(maze, { x: 1, y: 1 }, { x: 5, y: 3 }, (i) => known.has(i));
    expect(path?.every((p) => known.has(index(p.x, p.y)))).toBe(true);
  });

  it("通れるマスだけではたどり着けないときは null", () => {
    const known = new Set([index(1, 1), index(1, 2)]);
    expect(findPath(maze, { x: 1, y: 1 }, { x: 3, y: 3 }, (i) => known.has(i))).toBeNull();
  });
});
