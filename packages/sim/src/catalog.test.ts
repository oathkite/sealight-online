import { describe, expect, it } from "vitest";
import { bandOf, floorConfig, foeAt, spawnFoe } from "./catalog";
import { createRng } from "./rng";

describe("floorConfig", () => {
  it("深いほどモンスターが増え、レア率が上がる", () => {
    expect(floorConfig(10).monsterCount).toBeGreaterThan(floorConfig(1).monsterCount);
    expect(floorConfig(10).rareChance).toBeGreaterThan(floorConfig(1).rareChance);
  });

  it("上限を超えない", () => {
    const deep = floorConfig(20);
    expect(deep.monsterCount).toBeLessThanOrEqual(10);
    expect(deep.treasureCount).toBeLessThanOrEqual(6);
    expect(deep.rareChance).toBeLessThanOrEqual(0.4);
  });

  it("1 未満の深さは例外を投げる", () => {
    expect(() => floorConfig(0)).toThrow(RangeError);
  });
});

describe("bandOf", () => {
  it("5 階ごとに敵の傾向が変わる", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20].map(bandOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("foeAt", () => {
  it("深いほど同じ種類でも強い", () => {
    expect(foeAt("slime", 5).hp).toBeGreaterThan(foeAt("slime", 1).hp);
    expect(foeAt("slime", 5).xp).toBeGreaterThan(foeAt("slime", 1).xp);
  });

  it("特徴が付いている", () => {
    expect(foeAt("rat", 1).traits).toContain("swarm");
    expect(foeAt("beetle", 6).traits).toContain("armored");
    expect(foeAt("ogre", 11).traits).toContain("heavy");
    expect(foeAt("wraith", 16).traits).toContain("fast");
  });

  it("硬い敵は同じ帯の標準的な敵より防御が高く、強打の敵は攻撃が高い", () => {
    expect(foeAt("beetle", 6).defense).toBeGreaterThan(foeAt("goblin", 6).defense);
    expect(foeAt("ogre", 11).attack).toBeGreaterThan(foeAt("skeleton", 11).attack);
  });

  it("アルファは通常の個体より強く、経験値も多く、レア扱い", () => {
    const normal = foeAt("goblin", 7);
    const alpha = foeAt("goblin", 7, { alpha: true });
    expect(alpha.hp).toBeGreaterThan(normal.hp);
    expect(alpha.xp).toBeGreaterThan(normal.xp);
    expect(alpha.rare).toBe(true);
    expect(alpha.name).not.toBe(normal.name);
  });
});

describe("spawnFoe", () => {
  it("その階の帯の敵か、レアな敵だけが出る", () => {
    const rng = createRng(1);
    const kinds = new Set(Array.from({ length: 300 }, () => spawnFoe(rng, 3).kind));
    for (const kind of kinds) expect(["slime", "rat", "glowSlime"]).toContain(kind);
  });

  it("まれにレアな敵が出る", () => {
    const rng = createRng(2);
    const foes = Array.from({ length: 2000 }, () => spawnFoe(rng, 8));
    const rare = foes.filter((f) => f.rare).length;
    expect(rare).toBeGreaterThan(0);
    expect(rare).toBeLessThan(foes.length * 0.2);
  });

  it("同じ乱数からは同じ敵が出る", () => {
    const a = createRng(5);
    const b = createRng(5);
    expect(Array.from({ length: 20 }, () => spawnFoe(a, 12))).toEqual(Array.from({ length: 20 }, () => spawnFoe(b, 12)));
  });
});
