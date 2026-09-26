import { describe, expect, it } from "vitest";
import { clothMesh, createCloth, stepCloth, type ClothSpec } from "./cloth";

const banner: ClothSpec = { origin: [0, 2, 0], across: [1, 0, 0], down: [0, -1, 0], width: 0.8, height: 1, cols: 6, rows: 8 };

const point = (positions: Float32Array, i: number) => [positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0] as const;
const run = (steps: number, wind: readonly [number, number, number]) => {
  let cloth = createCloth(banner);
  for (let i = 0; i < steps; i += 1) cloth = stepCloth(cloth, { dt: 1 / 60, wind, time: i / 60 });
  return cloth;
};

describe("createCloth", () => {
  it("留める辺（1 行目）から、down の向きに広げた格子を作る", () => {
    const cloth = createCloth(banner);
    expect(cloth.positions).toHaveLength(6 * 8 * 3);
    point(cloth.positions, 5).forEach((v, i) => expect(v).toBeCloseTo([0.8, 2, 0][i] ?? NaN));
    expect(point(cloth.positions, 6 * 7)[1]).toBeCloseTo(1);
  });
});

describe("stepCloth", () => {
  it("留めた辺は動かない", () => {
    const cloth = run(120, [3, 0, 0]);
    for (let c = 0; c < 6; c += 1) expect(point(cloth.positions, c)[1]).toBeCloseTo(2);
  });

  it("風がなければ垂れ下がり、布は伸びすぎない", () => {
    const cloth = run(180, [0, 0, 0]);
    const bottom = point(cloth.positions, 6 * 7 + 2);
    expect(bottom[1]).toBeLessThan(1.2);
    expect(bottom[1]).toBeGreaterThan(0.8);
  });

  it("風に押されて、風下へなびく", () => {
    const still = run(120, [0, 0, 0]);
    const windy = run(120, [0, 0, 4]);
    expect(point(windy.positions, 6 * 7 + 2)[2]).toBeGreaterThan(point(still.positions, 6 * 7 + 2)[2] + 0.1);
  });

  it("元の布は変えずに、次の布を返す", () => {
    const cloth = createCloth(banner);
    const before = Array.from(cloth.positions);
    stepCloth(cloth, { dt: 1 / 60, wind: [0, 0, 5], time: 0 });
    expect(Array.from(cloth.positions)).toEqual(before);
  });

  it("長く止まっていた後の大きな時間でも暴れない", () => {
    const cloth = stepCloth(createCloth(banner), { dt: 2, wind: [0, 0, 0], time: 0 });
    for (const v of cloth.positions) expect(Number.isFinite(v)).toBe(true);
    expect(point(cloth.positions, 6 * 7)[1]).toBeGreaterThan(0.5);
  });
});

describe("clothMesh", () => {
  it("格子を三角形に張り、法線は長さ 1、uv は 0〜1", () => {
    const mesh = clothMesh(run(30, [0, 0, 1]));
    expect(mesh.indices).toHaveLength(5 * 7 * 6);
    for (let i = 0; i < mesh.normals.length; i += 3) expect(Math.hypot(mesh.normals[i] ?? 0, mesh.normals[i + 1] ?? 0, mesh.normals[i + 2] ?? 0)).toBeCloseTo(1);
    expect(Math.max(...mesh.uvs)).toBe(1);
    expect(Math.min(...mesh.uvs)).toBe(0);
  });
});
