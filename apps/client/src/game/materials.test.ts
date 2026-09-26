import { describe, expect, it } from "vitest";
import { MAX_PATTERNS } from "@sealight/engine";
import { PATTERNS, patternNumber, patternOf, TERRAIN_PATTERNS } from "./materials";

/** smoothstep(a, b, x) の数字の引数のうち、a > b のもの（GLSL では結果が定まらない） */
const reversedSmoothsteps = (glsl: string): string[] =>
  [...glsl.matchAll(/smoothstep\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?),/g)].filter((m) => Number(m[1]) > Number(m[2])).map((m) => m[0]);

describe("PATTERNS", () => {
  it("配列テクスチャの層の上限に収まり、名前が重ならない", () => {
    expect(PATTERNS.length).toBeLessThan(MAX_PATTERNS);
    expect(new Set(PATTERNS.map((p) => p.name)).size).toBe(PATTERNS.length);
  });

  it("どの模様も smoothstep を逆向きに使っていない", () => {
    for (const p of PATTERNS) expect(reversedSmoothsteps(p.glsl)).toEqual([]);
  });

  it("どの模様も、1 マスあたり 1 回以上は繰り返さないほど粗くはない", () => {
    for (const p of PATTERNS) expect(p.scale).toBeGreaterThan(0.3);
  });
});

describe("patternOf", () => {
  it("木は板、石は石積み、葉は葉の模様。光るものや水には模様を付けない", () => {
    expect(patternOf("wood")).toBe(patternNumber("planks"));
    expect(patternOf("stone")).toBe(patternNumber("masonry"));
    expect(patternOf("leaf")).toBe(patternNumber("leaves"));
    expect(patternOf("glass")).toBe(0);
    expect(patternOf("bowl_water")).toBe(0);
  });

  it("地面は草地、土の道、砂の模様を使う", () => {
    expect(TERRAIN_PATTERNS.every((n) => n > 0)).toBe(true);
  });
});
