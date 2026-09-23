import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

const take = (seed: number, count: number): readonly number[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe("createRng", () => {
  it("同じシードからは同じ数列を返す", () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it("異なるシードからは異なる数列を返す", () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it("next は 0 以上 1 未満を返す", () => {
    for (const value of take(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("int は [0, max) の整数を返す", () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(5);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
  });

  it("int に 0 以下や非整数を渡すと例外を投げる", () => {
    const rng = createRng(3);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(-1)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
  });

  it("シード 0 でも偏らない数列を返す", () => {
    const values = take(0, 100);
    expect(new Set(values).size).toBe(100);
  });
});
