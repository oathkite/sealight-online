import { describe, expect, it } from "vitest";
import { foeAt } from "./catalog";
import { rollDrop, rollLoot } from "./loot";
import { createRng } from "./rng";

const roll = (seed: number, depth: number, luck: number, count: number) => {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => rollLoot(rng, { depth, luck, id: `t:${i}` }));
};

describe("rollLoot", () => {
  it("同じ乱数からは同じドロップになる", () => {
    expect(roll(1, 3, 2, 20)).toEqual(roll(1, 3, 2, 20));
  });

  it("装備には指定した ID が付き、力と価値は 1 以上", () => {
    for (const loot of roll(2, 5, 0, 100)) {
      if (loot.type !== "item") continue;
      expect(loot.item.id.startsWith("t:")).toBe(true);
      expect(loot.item.power).toBeGreaterThanOrEqual(1);
      expect(loot.item.value).toBeGreaterThanOrEqual(1);
    }
  });

  it("お金は 1 以上の整数", () => {
    for (const loot of roll(3, 1, 0, 100)) {
      if (loot.type !== "gold") continue;
      expect(Number.isInteger(loot.amount)).toBe(true);
      expect(loot.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it("レアはコモンより強く高価", () => {
    const items = roll(4, 20, 10, 400).flatMap((l) => (l.type === "item" ? [l.item] : []));
    const rare = items.filter((i) => i.rarity === "rare");
    const common = items.filter((i) => i.rarity === "common");
    expect(rare.length).toBeGreaterThan(0);
    const avg = (xs: readonly { readonly value: number }[]) => xs.reduce((s, x) => s + x.value, 0) / xs.length;
    expect(avg(rare)).toBeGreaterThan(avg(common));
  });

  it("レア率を上乗せすると、レアが出やすくなる", () => {
    const count = (bonus: number) => {
      const rng = createRng(9);
      return Array.from({ length: 400 }, (_, i) => rollLoot(rng, { depth: 3, luck: 0, id: `g:${i}`, rareBonus: bonus })).filter(
        (l) => l.type === "item" && l.item.rarity === "rare",
      ).length;
    };
    expect(count(0.5)).toBeGreaterThan(count(0));
  });
});

describe("rollDrop", () => {
  it("レアな敵は必ずレアな装備を落とす", () => {
    const rng = createRng(1);
    const drop = rollDrop(rng, foeAt("glowSlime", 4), { depth: 4, luck: 0, id: "d" });
    expect(drop?.rarity).toBe("rare");
  });

  it("落とし物の確率が 0 の敵は何も落とさない", () => {
    const rng = createRng(1);
    const foe = { ...foeAt("slime", 1), dropChance: 0 };
    for (let i = 0; i < 50; i += 1) expect(rollDrop(rng, foe, { depth: 1, luck: 0, id: `d${i}` })).toBeNull();
  });
});
