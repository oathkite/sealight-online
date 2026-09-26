import { describe, expect, it } from "vitest";
import { detectTier, qualityFor } from "./quality";

describe("detectTier", () => {
  it("メモリが少ない、または CPU が少ない端末は low", () => {
    expect(detectTier({ mobile: false, cores: 8, memory: 2, maxTextureSize: 16384 })).toBe("low");
    expect(detectTier({ mobile: false, cores: 2, memory: undefined, maxTextureSize: 16384 })).toBe("low");
  });

  it("スマホはふつう medium、古い（CPU が 4 以下、メモリ 3GB 以下）なら low", () => {
    expect(detectTier({ mobile: true, cores: 6, memory: undefined, maxTextureSize: 16384 })).toBe("medium");
    expect(detectTier({ mobile: true, cores: 4, memory: undefined, maxTextureSize: 8192 })).toBe("low");
    expect(detectTier({ mobile: true, cores: 8, memory: 3, maxTextureSize: 16384 })).toBe("low");
  });

  it("CPU とメモリに余裕のある PC は high、そうでなければ medium", () => {
    expect(detectTier({ mobile: false, cores: 8, memory: 8, maxTextureSize: 16384 })).toBe("high");
    expect(detectTier({ mobile: false, cores: 10, memory: undefined, maxTextureSize: 16384 })).toBe("high");
    expect(detectTier({ mobile: false, cores: 4, memory: 8, maxTextureSize: 16384 })).toBe("medium");
  });

  it("大きなテクスチャを扱えない GPU は low", () => {
    expect(detectTier({ mobile: false, cores: 16, memory: 16, maxTextureSize: 2048 })).toBe("low");
  });
});

describe("qualityFor", () => {
  it("段階が上がるほど、影とテクスチャが細かく、草が多い", () => {
    const [low, medium, high] = (["low", "medium", "high"] as const).map(qualityFor);
    if (!low || !medium || !high) throw new Error("missing tier");
    expect(low.shadowSize).toBeLessThan(high.shadowSize);
    expect(low.textureSize).toBeLessThan(medium.textureSize);
    expect(medium.textureSize).toBeLessThanOrEqual(high.textureSize);
    expect(low.grass).toBeLessThan(medium.grass);
    expect(medium.grass).toBeLessThan(high.grass);
  });

  it("low は三方向の投影と布の計算を省く", () => {
    expect(qualityFor("low").triplanar).toBe(false);
    expect(qualityFor("low").cloth).toBe(false);
    expect(qualityFor("high").triplanar).toBe(true);
  });
});
