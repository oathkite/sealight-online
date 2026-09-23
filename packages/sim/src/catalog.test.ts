import { describe, expect, it } from "vitest";
import { floorConfig, foeAt, spawnFoe } from "./catalog";
import { createRng } from "./rng";

describe("floorConfig", () => {
  it("深いほどモンスターが増え、レア率が上がる", () => {
    const shallow = floorConfig(1);
    const deep = floorConfig(10);
    expect(deep.monsterCount).toBeGreaterThan(shallow.monsterCount);
    expect(deep.rareChance).toBeGreaterThan(shallow.rareChance);
  });

  it("上限を超えない", () => {
    const abyss = floorConfig(100);
    expect(abyss.monsterCount).toBeLessThanOrEqual(10);
    expect(abyss.treasureCount).toBeLessThanOrEqual(6);
    expect(abyss.rareChance).toBeLessThanOrEqual(0.4);
  });

  it("1 未満の深さは例外を投げる", () => {
    expect(() => floorConfig(0)).toThrow(RangeError);
  });
});

describe("spawnFoe", () => {
  it("1 階ではスライムしか出ない", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i += 1) expect(spawnFoe(rng, 1).kind).toBe("slime");
  });

  it("深いほど同じ種類でも強い", () => {
    const shallow = foeAt("slime", 1);
    const deep = foeAt("slime", 9);
    expect(deep.hp).toBeGreaterThan(shallow.hp);
    expect(deep.attack).toBeGreaterThan(shallow.attack);
    expect(deep.xp).toBeGreaterThan(shallow.xp);
  });

  it("深い階では強い種類も出る", () => {
    const rng = createRng(7);
    const kinds = new Set(Array.from({ length: 60 }, () => spawnFoe(rng, 5).kind));
    expect(kinds.has("skeleton")).toBe(true);
  });
});
