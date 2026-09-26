import { describe, expect, it } from "vitest";
import { MAX_PATTERNS, patternIndex, patternScales, synthesisShader, type PatternDef } from "./patterns";

const patterns: readonly PatternDef[] = [
  { name: "planks", scale: 1, glsl: "Surface s = plain(); s.height = fract(uv.x * 5.0); return s;" },
  { name: "stone", scale: 0.8, glsl: "Surface s = plain(); s.height = pvoronoi(uv * 4.0, 4.0).x; return s;" },
];

describe("synthesisShader", () => {
  it("模様ごとの関数と、番号で選ぶ分岐を作る（0 番は模様なし）", () => {
    const source = synthesisShader(patterns);
    expect(source).toContain("Surface pattern1(vec2 uv)");
    expect(source).toContain("Surface pattern2(vec2 uv)");
    expect(source).toContain("if (uPattern == 1) return pattern1(uv);");
    expect(source).toContain("if (uPattern == 2) return pattern2(uv);");
  });

  it("継ぎ目のない模様のための、周期のある雑音の道具を含む", () => {
    const source = synthesisShader(patterns);
    for (const name of ["pnoise", "pfbm", "pvoronoi"]) expect(source).toContain(name);
  });

  it("模様が多すぎるときは例外にする（テクスチャの層の上限）", () => {
    const many = Array.from({ length: MAX_PATTERNS }, (_, i) => ({ name: `p${i}`, scale: 1, glsl: "return plain();" }));
    expect(() => synthesisShader(many)).toThrow();
  });
});

describe("patternIndex", () => {
  it("名前から層の番号を引く。0 は模様なしなので 1 から数える", () => {
    const index = patternIndex(patterns);
    expect(index.planks).toBe(1);
    expect(index.stone).toBe(2);
  });
});

describe("patternScales", () => {
  it("層ごとの繰り返しの細かさを並べる（0 番は 1）", () => {
    expect(Array.from(patternScales(patterns).slice(0, 3))).toEqual([1, 1, 0.800000011920929]);
    expect(patternScales(patterns)).toHaveLength(MAX_PATTERNS);
  });
});
