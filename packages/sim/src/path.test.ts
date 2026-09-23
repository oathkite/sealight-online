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
