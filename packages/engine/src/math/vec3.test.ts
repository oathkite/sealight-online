import { describe, expect, it } from "vitest";
import { add, cross, dot, length, lerp, normalize, scale, sub } from "./vec3";

describe("vec3", () => {
  it("足し算、引き算、大きさを変える", () => {
    expect(add([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(sub([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2]);
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it("内積と外積", () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it("長さを 1 にする。長さ 0 のベクトルはそのまま返す", () => {
    expect(length(normalize([3, 4, 0]))).toBeCloseTo(1);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("2 点の間を割合で結ぶ", () => {
    expect(lerp([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });
});
