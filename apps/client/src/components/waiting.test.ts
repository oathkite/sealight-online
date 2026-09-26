import { describe, expect, it } from "vitest";
import { depthRatio, stageOf } from "./waiting";

describe("depthRatio", () => {
  it("目安の半分で一番深く、目安で地上に戻る", () => {
    expect(depthRatio(0)).toBe(0);
    expect(depthRatio(0.25)).toBeCloseTo(0.5);
    expect(depthRatio(0.5)).toBe(1);
    expect(depthRatio(0.75)).toBeCloseTo(0.5);
    expect(depthRatio(1)).toBe(0);
  });

  it("目安を過ぎても地上のまま（範囲の外は端に収める）", () => {
    expect(depthRatio(3)).toBe(0);
    expect(depthRatio(-1)).toBe(0);
  });
});

describe("stageOf", () => {
  it("潜る、深いところ、戻る、目安を過ぎた、の順に変わる", () => {
    expect([0.1, 0.5, 0.8, 1.4].map(stageOf)).toEqual(["down", "deep", "up", "late"]);
  });
});
