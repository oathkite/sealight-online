import { describe, expect, it } from "vitest";
import { hourOf, lightingAt, mixHex } from "./timeOfDay";

const luminance = (hex: string): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
};

describe("mixHex", () => {
  it("0 なら最初の色、1 なら次の色、0.5 なら中間の色になる", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("範囲外の割合は 0〜1 に収める", () => {
    expect(mixHex("#102030", "#405060", -1)).toBe("#102030");
    expect(mixHex("#102030", "#405060", 2)).toBe("#405060");
  });
});

describe("hourOf", () => {
  it("時刻を 0 以上 24 未満の小数の時間にする", () => {
    expect(hourOf(new Date(2026, 8, 25, 18, 30))).toBe(18.5);
    expect(hourOf(new Date(2026, 8, 25, 0, 0))).toBe(0);
  });
});

describe("lightingAt", () => {
  it("昼は夜より空も日差しも明るい", () => {
    const noon = lightingAt(13);
    const midnight = lightingAt(0);
    expect(luminance(noon.skyTop)).toBeGreaterThan(luminance(midnight.skyTop));
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity);
  });

  it("夜は家の灯りがともり星が出て、昼は消えている", () => {
    expect(lightingAt(23).lamp).toBe(1);
    expect(lightingAt(23).stars).toBe(1);
    expect(lightingAt(12).lamp).toBe(0);
    expect(lightingAt(12).stars).toBe(0);
  });

  it("夕方は昼と夜の間で、灯りがともり始める", () => {
    const dusk = lightingAt(18.5);
    expect(dusk.lamp).toBeGreaterThan(0);
    expect(dusk.lamp).toBeLessThan(1);
  });

  it("24 時と 0 時は同じ光になる（日付をまたいでも途切れない）", () => {
    expect(lightingAt(24)).toEqual(lightingAt(0));
    expect(lightingAt(23.99).skyTop).toBe(lightingAt(0).skyTop);
  });

  it("太陽は常に地面より上から照らす（影が裏返らない）", () => {
    for (let hour = 0; hour < 24; hour += 0.5) expect(lightingAt(hour).sunPosition[1]).toBeGreaterThan(0);
  });
});
