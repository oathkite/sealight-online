import { describe, expect, it } from "vitest";
import { transformPoint } from "../math/mat4";
import { FRAME_FLOATS, FRAME_OFFSET, packFrame, sunView, toLinear } from "./frame";
import type { Environment } from "./types";

const environment: Environment = {
  skyTop: [0.2, 0.4, 0.8],
  skyHorizon: [0.8, 0.9, 1],
  sunDirection: [0, 1, 0],
  sunColor: [1, 0.9, 0.8],
  shadeColor: [0.3, 0.3, 0.5],
  fillColor: [0.2, 0.25, 0.3],
  glow: [1, 0.5, 0.25, 0],
  stars: 0,
  clouds: 1,
  fog: { near: 20, far: 30 },
  curve: 0.04,
  vignette: 0.3,
  lights: [{ position: [1, 2, 3], color: [1, 0.5, 0], radius: 2.5 }],
  wind: { direction: [1, 0], strength: 0.6, gust: 0.4 },
};

const base = {
  viewProjection: new Float32Array(16).fill(1),
  lightViewProjection: new Float32Array(16).fill(2),
  eye: [0, 10, 10] as const,
  time: 12.5,
  focus: [0.5, 1] as const,
  forward: [0, -1] as const,
  viewport: [800, 600] as const,
  shadowSize: 2048,
  terrain: { min: [-8, -6] as const, size: [17, 13] as const },
  waters: [{ center: [-5, 3] as const, radius: [1.5, 1] as const }],
  terrainPatterns: [3, 4, 5] as const,
};

describe("packFrame", () => {
  it("std140 の並びで、フレームに共通の値を 1 本の配列に詰める", () => {
    const data = packFrame({ ...base, environment });
    expect(data).toHaveLength(FRAME_FLOATS);
    expect(data[FRAME_OFFSET.viewProjection]).toBe(1);
    expect(data[FRAME_OFFSET.lightViewProjection]).toBe(2);
    expect(Array.from(data.slice(FRAME_OFFSET.eye, FRAME_OFFSET.eye + 4))).toEqual([0, 10, 10, 12.5]);
    expect(data[FRAME_OFFSET.sunDirection + 3]).toBeCloseTo(0.04);
    expect(data[FRAME_OFFSET.sun + 3]).toBe(20);
    expect(data[FRAME_OFFSET.shade + 3]).toBe(30);
  });

  it("光と水の数、道の地図の範囲を入れる", () => {
    const data = packFrame({ ...base, environment });
    expect(Array.from(data.slice(FRAME_OFFSET.viewport, FRAME_OFFSET.viewport + 4))).toEqual([800, 600, 1, 1]);
    expect(Array.from(data.slice(FRAME_OFFSET.terrain, FRAME_OFFSET.terrain + 4))).toEqual([-8, -6, 17, 13]);
    expect(Array.from(data.slice(FRAME_OFFSET.lightPosition, FRAME_OFFSET.lightPosition + 4))).toEqual([1, 2, 3, 2.5]);
    expect(Array.from(data.slice(FRAME_OFFSET.water, FRAME_OFFSET.water + 4))).toEqual([-5, 3, 1.5, 1]);
  });

  it("光は 4 つまでしか入れない", () => {
    const many = { ...environment, lights: Array.from({ length: 6 }, () => environment.lights[0]).filter((l) => l !== undefined) };
    expect(packFrame({ ...base, environment: many })[FRAME_OFFSET.viewport + 2]).toBe(4);
  });

  it("空の地平の色は sRGB のまま渡す（シェーダーでリニアに直す）", () => {
    const data = packFrame({ ...base, environment });
    expect(Array.from(data.slice(FRAME_OFFSET.horizon, FRAME_OFFSET.horizon + 3))).toEqual([0.8, 0.9, 1].map((v) => Math.fround(v)));
  });
});

describe("packFrame 風と地面の模様", () => {
  it("風の向き、強さ、突風と、地面に使う模様の番号を入れる", () => {
    const data = packFrame({ ...base, environment });
    expect(Array.from(data.slice(FRAME_OFFSET.wind, FRAME_OFFSET.wind + 4)).map((v) => Math.round(v * 10) / 10)).toEqual([1, 0, 0.6, 0.4]);
    expect(Array.from(data.slice(FRAME_OFFSET.terrainPatterns, FRAME_OFFSET.terrainPatterns + 3))).toEqual([3, 4, 5]);
  });
});

describe("toLinear", () => {
  it("sRGB をリニアに直す（中間の明るさは暗くなる）", () => {
    expect(toLinear([1, 0, 0.5])[0]).toBe(1);
    expect(toLinear([1, 0, 0.5])[2]).toBeLessThan(0.5);
  });
});

describe("sunView", () => {
  it("太陽の方から、見せたい点を中心に見る（影の地図の範囲に収める）", () => {
    const m = sunView([0.3, 1, 0.5], [0, 0, 0], 9);
    const p = transformPoint(m, [0, 0, 0]);
    expect(Math.abs(p[0])).toBeLessThan(1e-5);
    expect(Math.abs(p[1])).toBeLessThan(1e-5);
    const edge = transformPoint(m, [8, 0, 0]);
    expect(Math.abs(edge[0])).toBeLessThanOrEqual(1);
  });

  it("真上からの光でも壊れない", () => {
    expect(Array.from(sunView([0, 1, 0], [0, 0, 0], 9)).every(Number.isFinite)).toBe(true);
  });
});
