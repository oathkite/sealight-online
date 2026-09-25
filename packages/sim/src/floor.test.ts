import { describe, expect, it } from "vitest";
import { floorSeed, generateFloor, MAX_DEPTH } from "./floor";
import { findPath } from "./path";

describe("generateFloor", () => {
  it("同じ階は何度作っても同じ地形になる（全プレイヤー共通の固定ダンジョン）", () => {
    expect(generateFloor(3)).toEqual(generateFloor(3));
  });

  it("階が違えば地形も違う", () => {
    expect(generateFloor(3).cells).not.toEqual(generateFloor(4).cells);
  });

  it("入口から階段まで必ず歩いて行ける", () => {
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      const floor = generateFloor(depth);
      expect(findPath(floor, floor.entrance, floor.stairs)).not.toBeNull();
    }
  });

  it("階ごとのシードは重ならない", () => {
    const seeds = Array.from({ length: MAX_DEPTH }, (_, i) => floorSeed(i + 1));
    expect(new Set(seeds).size).toBe(MAX_DEPTH);
  });

  it("範囲外の階は例外を投げる", () => {
    expect(() => generateFloor(0)).toThrow(RangeError);
    expect(() => generateFloor(MAX_DEPTH + 1)).toThrow(RangeError);
  });
});
