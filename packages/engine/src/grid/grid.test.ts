import { describe, expect, it } from "vitest";
import { centerOf, headingOf, paintTiles, pathPoints, tileCenter, tilesOf, turnedSize, validateLayout, type Placement } from "./grid";

const house: Placement = { id: "house", at: [-4, -4], size: [4, 3] };

describe("占有範囲", () => {
  it("置いた角のマスから、幅と奥行きの分だけマスを占める", () => {
    expect(tilesOf({ id: "bed", at: [0, 0], size: [2, 1] })).toEqual([[0, 0], [1, 0]]);
    expect(tilesOf(house)).toHaveLength(12);
  });

  it("90 度回すと幅と奥行きが入れ替わる", () => {
    expect(turnedSize([4, 3], 1)).toEqual([3, 4]);
    expect(turnedSize([4, 3], 2)).toEqual([4, 3]);
    expect(tilesOf({ ...house, turn: 1 })).toContainEqual([-2, -1]);
  });

  it("中心は占めるマスの真ん中（マスの中心が整数の座標）", () => {
    expect(centerOf(house)).toEqual([-2.5, 0, -3]);
    expect(tileCenter([2, -1])).toEqual([2, 0, -1]);
  });

  it("向きは 90 度単位の角度になる", () => {
    expect(headingOf(0)).toBe(0);
    expect(headingOf(3)).toBeCloseTo((Math.PI * 3) / 2);
  });
});

describe("validateLayout", () => {
  const bounds = { min: [-8, -8], max: [8, 8] } as const;

  it("重ならず、はみ出さず、道が空いていれば問題なし", () => {
    const placements = [house, { id: "bed", at: [0, 0], size: [1, 1], walkable: true }] as const;
    expect(validateLayout({ bounds, placements, paths: [[[-2, -1], [-1, -1], [0, -1], [0, 0]]] })).toEqual([]);
  });

  it("重なった物を見つける", () => {
    const issues = validateLayout({ bounds, placements: [house, { id: "well", at: [-2, -3], size: [2, 2] }], paths: [] });
    expect(issues[0]).toMatchObject({ kind: "overlap", ids: ["house", "well"] });
  });

  it("地図からはみ出した物を見つける", () => {
    const issues = validateLayout({ bounds, placements: [{ id: "tree", at: [8, 8], size: [2, 1] }], paths: [] });
    expect(issues).toEqual([{ kind: "outside", ids: ["tree"], tile: [9, 8] }]);
  });

  it("道を塞いでいる物を見つける（寝床のように上を歩ける物は塞がない）", () => {
    const issues = validateLayout({ bounds, placements: [house], paths: [[[-3, -1], [-3, -2]]] });
    expect(issues).toEqual([{ kind: "blocked", ids: ["house"], tile: [-3, -2] }]);
  });

  it("道が隣のマスへ続いていなければ知らせる", () => {
    const issues = validateLayout({ bounds, placements: [], paths: [[[0, 0], [2, 0]]] });
    expect(issues).toEqual([{ kind: "gap", ids: [], tile: [2, 0] }]);
  });
});

describe("pathPoints", () => {
  it("道のマスの中心を順に結ぶ", () => {
    expect(pathPoints([[0, 0], [0, 1]])).toEqual([[0, 0, 0], [0, 0, 1]]);
  });
});

describe("paintTiles", () => {
  it("地図の範囲に、塗ったマスの値を並べる（行ごと、左上から）", () => {
    const layer = paintTiles({ min: [0, 0], max: [2, 1] }, [{ tiles: [[1, 0], [2, 1]], value: 255 }]);
    expect(layer.width).toBe(3);
    expect(layer.height).toBe(2);
    expect(Array.from(layer.data)).toEqual([0, 255, 0, 0, 0, 255]);
  });

  it("範囲の外のマスは無視する", () => {
    const layer = paintTiles({ min: [0, 0], max: [1, 1] }, [{ tiles: [[5, 5]], value: 9 }]);
    expect(Array.from(layer.data)).toEqual([0, 0, 0, 0]);
  });
});
