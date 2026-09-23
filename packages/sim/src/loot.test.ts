import { describe, expect, it } from "vitest";
import { rollLoot } from "./loot";
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
});
