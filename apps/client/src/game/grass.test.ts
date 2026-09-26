import { describe, expect, it } from "vitest";
import { FOLIAGE_FLOATS } from "@sealight/engine";
import { PATHS, placementOf, ROUTE_TILES } from "./layout";
import { scatterGrass } from "./grass";

const blades = (density: number) => {
  const data = scatterGrass(density);
  return Array.from({ length: data.length / FOLIAGE_FLOATS }, (_, i) => Array.from(data.slice(i * FOLIAGE_FLOATS, (i + 1) * FOLIAGE_FLOATS)));
};

describe("scatterGrass", () => {
  it("密度に比例して本数が増える", () => {
    const few = blades(0.2).length;
    const many = blades(1).length;
    expect(few).toBeGreaterThan(1000);
    expect(many).toBeGreaterThan(few * 3);
  });

  it("道と、家や畑のマスには生やさない", () => {
    const all = blades(0.5);
    const near = (tile: readonly [number, number], r: number) => all.filter(([x, , z]) => Math.abs((x ?? 0) - tile[0]) < r && Math.abs((z ?? 0) - tile[1]) < r);
    for (const tile of [...PATHS.flat(), ...ROUTE_TILES]) expect(near(tile, 0.3)).toHaveLength(0);
    const house = placementOf("house");
    expect(near([house.at[0] + 1.5, house.at[1] + 1], 0.8)).toHaveLength(0);
  });

  it("池の水の中には生やさない", () => {
    const pond = placementOf("pond");
    const center = [pond.at[0] + 1.5, pond.at[1] + 1] as const;
    expect(blades(1).filter(([x, , z]) => Math.hypot((x ?? 0) - center[0], (z ?? 0) - center[1]) < 0.8)).toHaveLength(0);
  });

  it("同じ密度なら毎回同じ配置になる", () => {
    expect(Array.from(scatterGrass(0.3).slice(0, 40))).toEqual(Array.from(scatterGrass(0.3).slice(0, 40)));
  });

  it("草の高さと幅は、ほどよい範囲に収まる", () => {
    for (const [, , , height, , width] of blades(0.2)) {
      expect(height).toBeGreaterThan(0.08);
      expect(height).toBeLessThan(0.45);
      expect(width).toBeGreaterThan(0.01);
    }
  });
});
