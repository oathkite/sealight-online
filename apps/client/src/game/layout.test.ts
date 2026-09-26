import { describe, expect, it } from "vitest";
import { validateLayout } from "@sealight/engine";
import { BOUNDS, HOME, homeTile, PATHS, ROUTE_TILES, placementOf, STAIRS_BOTTOM } from "./layout";

describe("家の場面の配置", () => {
  it("重なり、はみ出し、道の塞がりや途切れがない", () => {
    expect(validateLayout({ bounds: BOUNDS, placements: HOME, paths: [...PATHS, ROUTE_TILES] })).toEqual([]);
  });

  it("モンスターの道は寝床から始まり、入口の門の下で終わる", () => {
    expect(ROUTE_TILES[0]).toEqual(homeTile);
    const gate = placementOf("gate");
    const end = ROUTE_TILES.at(-1);
    expect(end?.[1]).toBe(gate.at[1]);
  });

  it("階段の底は、門の下から手前へ下りた地面の下にある", () => {
    const end = ROUTE_TILES.at(-1) ?? [0, 0];
    expect(STAIRS_BOTTOM[1]).toBeLessThan(0);
    expect(STAIRS_BOTTOM[2]).toBeGreaterThan(end[1]);
  });

  it("名前で置き場所を引ける。知らない名前は例外にする", () => {
    expect(placementOf("house").size).toEqual([4, 3]);
    expect(() => placementOf("castle")).toThrow();
  });
});
