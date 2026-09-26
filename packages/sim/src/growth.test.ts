import { describe, expect, it } from "vitest";
import { expectedLevel, scaledXp, xpScale } from "./growth";

describe("xpScale", () => {
  it("その階に見合うレベルまでは、経験値をそのままもらえる", () => {
    expect(xpScale(1, 1)).toBe(1);
    expect(xpScale(expectedLevel(10), 10)).toBe(1);
  });

  it("見合うレベルを超えるほど、もらえる経験値が減る", () => {
    const at = expectedLevel(5);
    expect(xpScale(at + 1, 5)).toBeLessThan(1);
    expect(xpScale(at + 3, 5)).toBeLessThan(xpScale(at + 1, 5));
  });

  it("どれだけ格下でも、少しはもらえる", () => {
    expect(xpScale(999, 1)).toBeGreaterThan(0);
  });

  it("深い階ほど、見合うレベルが高い", () => {
    expect(expectedLevel(20)).toBeGreaterThan(expectedLevel(10));
  });
});

describe("scaledXp", () => {
  it("割合をかけて丸める。どれだけ格下でも 0 にはしない", () => {
    expect(scaledXp(20, 1, 10)).toBe(20);
    expect(scaledXp(1, 999, 1)).toBe(1);
  });
});
