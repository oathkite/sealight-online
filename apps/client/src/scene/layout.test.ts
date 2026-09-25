import { describe, expect, it } from "vitest";
import { alongRoute, ROUTE } from "./layout";

describe("alongRoute", () => {
  it("0 で道の始まり、1 で道の終わりにいる", () => {
    expect(alongRoute(ROUTE, 0).position).toEqual(ROUTE[0]);
    expect(alongRoute(ROUTE, 1).position).toEqual(ROUTE.at(-1));
  });

  it("範囲外の割合は始まりと終わりに収める", () => {
    expect(alongRoute(ROUTE, -0.5).position).toEqual(ROUTE[0]);
    expect(alongRoute(ROUTE, 3).position).toEqual(ROUTE.at(-1));
  });

  it("途中では、区間の長さに比例した位置にいる", () => {
    const route = [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, 4],
    ] as const;
    expect(alongRoute(route, 0.5).position[2]).toBeCloseTo(2);
  });

  it("進む向きを返す（+z に進むなら 0、+x に進むなら 90 度）", () => {
    expect(alongRoute([[0, 0, 0], [0, 0, 1]], 0.5).heading).toBeCloseTo(0);
    expect(alongRoute([[0, 0, 0], [1, 0, 0]], 0.5).heading).toBeCloseTo(Math.PI / 2);
  });

  it("点が 1 つだけの道でも落ちない", () => {
    expect(alongRoute([[1, 0, 2]], 0.5).position).toEqual([1, 0, 2]);
  });
});
