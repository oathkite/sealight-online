import { describe, expect, it } from "vitest";
import { VERTEX_FLOATS } from "@sealight/engine";
import { homeTile, placementOf } from "./layout";
import { buildHomeWorld, groundHeight, POND_WATER } from "./world";

const world = buildHomeWorld();

describe("buildHomeWorld", () => {
  it("動かない物を 1 つのメッシュにまとめる（頂点は予算の中）", () => {
    const vertices = world.mesh.vertices.length / VERTEX_FLOATS;
    expect(vertices).toBeGreaterThan(10_000);
    expect(vertices).toBeLessThan(400_000);
    expect(Math.max(...world.mesh.indices.slice(-300))).toBeLessThan(vertices);
  });

  it("灯り（窓とランタン）、松明、魔法の光の位置を返す", () => {
    const kinds = world.lights.map((l) => l.kind).sort();
    expect(kinds).toEqual(["flame", "lamp", "lantern", "magic"]);
  });

  it("煙突の上に煙の出る位置がある", () => {
    expect(world.smoke?.[1]).toBeGreaterThan(3);
  });

  it("道のマスを地面の地図に塗る", () => {
    const { bounds, width, data } = world.terrain;
    const index = (homeTile[1] - bounds.min[1]) * width + (homeTile[0] - bounds.min[0]);
    expect(data[index]).toBe(255);
  });

  it("池の水面を 1 つ返す", () => {
    expect(world.waters).toEqual([POND_WATER]);
  });
});

describe("groundHeight", () => {
  it("庭は平らで、池のところだけ窪む", () => {
    expect(groundHeight(homeTile[0], homeTile[1])).toBe(0);
    const pond = placementOf("pond");
    expect(groundHeight(pond.at[0] + 1.5, pond.at[1] + 1)).toBeLessThan(-0.2);
  });

  it("地図の外はゆるやかに盛り上がる", () => {
    expect(groundHeight(0, -18)).toBeGreaterThan(0.2);
  });
});
