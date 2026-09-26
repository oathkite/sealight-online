import { describe, expect, it } from "vitest";
import { estimateExpedition, reactionFor } from "./estimate";

const base = {
  target: 2,
  loadout: { level: 1, stats: { str: 30, vit: 30, luk: 0 }, potions: 0, rations: 11, weapon: null, armor: null },
  maps: [],
  potionThreshold: 30,
} as const;

describe("estimateExpedition", () => {
  it("同じ条件なら同じ見積もりになる（本番のシードは使わない）", () => {
    expect(estimateExpedition(base)).toEqual(estimateExpedition(base));
  });

  it("最短と最長の目安と、成功しそうな割合を返す", () => {
    const estimate = estimateExpedition(base);
    expect(estimate.minSec).toBeGreaterThan(0);
    expect(estimate.maxSec).toBeGreaterThanOrEqual(estimate.minSec);
    expect(estimate.successRate).toBe(1);
  });

  it("弱いまま深く行かせようとすると、成功しそうな割合が下がる", () => {
    const weak = { ...base, target: 12, loadout: { ...base.loadout, stats: { str: 0, vit: 0, luk: 0 } } };
    expect(estimateExpedition(weak).successRate).toBeLessThan(0.5);
  });
});

describe("reactionFor", () => {
  it("成功しそうな割合で、送り出す前の反応が変わる", () => {
    expect([1, 0.7, 0.4, 0.1].map(reactionFor)).toEqual(["eager", "calm", "nervous", "scared"]);
  });
});
