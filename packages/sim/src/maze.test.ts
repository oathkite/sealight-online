import { describe, expect, it } from "vitest";
import { generateMaze, isFloor } from "./maze";
import { createRng } from "./rng";
import { findPath } from "./path";

describe("generateMaze", () => {
  it("同じシードからは同じ迷路を生成する", () => {
    const a = generateMaze({ width: 15, height: 11 }, createRng(10));
    const b = generateMaze({ width: 15, height: 11 }, createRng(10));
    expect(a).toEqual(b);
  });

  it("異なるシードからは異なる迷路を生成する", () => {
    const a = generateMaze({ width: 15, height: 11 }, createRng(10));
    const b = generateMaze({ width: 15, height: 11 }, createRng(11));
    expect(a.cells).not.toEqual(b.cells);
  });

  it("外周はすべて壁になる", () => {
    const maze = generateMaze({ width: 11, height: 9 }, createRng(1));
    for (let x = 0; x < maze.width; x += 1) {
      expect(isFloor(maze, { x, y: 0 })).toBe(false);
      expect(isFloor(maze, { x, y: maze.height - 1 })).toBe(false);
    }
    for (let y = 0; y < maze.height; y += 1) {
      expect(isFloor(maze, { x: 0, y })).toBe(false);
      expect(isFloor(maze, { x: maze.width - 1, y })).toBe(false);
    }
  });

  it("すべての床マスがスタートから到達可能", () => {
    const maze = generateMaze({ width: 21, height: 15 }, createRng(99));
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        if (isFloor(maze, { x, y })) {
          expect(findPath(maze, maze.start, { x, y })).not.toBeNull();
        }
      }
    }
  });

  it("スタート、階段、宝箱はすべて床の上にあり、互いに重ならない", () => {
    const maze = generateMaze({ width: 21, height: 15, treasureCount: 4 }, createRng(5));
    const spots = [maze.start, maze.stairs, ...maze.treasures];
    for (const spot of spots) {
      expect(isFloor(maze, spot)).toBe(true);
    }
    const keys = new Set(spots.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(spots.length);
    expect(maze.treasures).toHaveLength(4);
  });

  it("最小サイズ 5x5 でも生成できる", () => {
    const maze = generateMaze({ width: 5, height: 5, treasureCount: 0 }, createRng(1));
    expect(isFloor(maze, maze.start)).toBe(true);
    expect(maze.stairs).not.toEqual(maze.start);
  });

  it("置き場所が足りないときは宝箱の数を床の数に合わせて減らす", () => {
    const maze = generateMaze({ width: 5, height: 5, treasureCount: 100 }, createRng(1));
    const floorCount = maze.cells.filter(Boolean).length;
    expect(maze.treasures.length).toBe(floorCount - 2);
  });

  it("宝箱の数に負の値や非整数を渡すと例外を投げる", () => {
    expect(() => generateMaze({ width: 11, height: 11, treasureCount: -1 }, createRng(1))).toThrow(RangeError);
    expect(() => generateMaze({ width: 11, height: 11, treasureCount: 1.5 }, createRng(1))).toThrow(RangeError);
  });

  it("偶数や 5 未満のサイズは例外を投げる", () => {
    expect(() => generateMaze({ width: 10, height: 11 }, createRng(1))).toThrow(RangeError);
    expect(() => generateMaze({ width: 11, height: 3 }, createRng(1))).toThrow(RangeError);
  });
});

describe("isFloor", () => {
  it("範囲外は床ではない", () => {
    const maze = generateMaze({ width: 7, height: 7 }, createRng(1));
    expect(isFloor(maze, { x: -1, y: 1 })).toBe(false);
    expect(isFloor(maze, { x: 1, y: 7 })).toBe(false);
  });
});
