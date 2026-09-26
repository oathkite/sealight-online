import { describe, expect, it } from "vitest";
import { buildAdvice } from "./advice";
import type { ExpeditionEvent, ExpeditionResult, FoeView } from "./expedition-types";
import type { Equipment } from "./items";

const ogre: FoeView = { kind: "ogre", name: "オーガ", hp: 40, traits: ["heavy"], rare: false };
const skeleton: FoeView = { kind: "skeleton", name: "スケルトン", hp: 24, traits: [], rare: false };
const rat: FoeView = { kind: "rat", name: "ネズミ", hp: 4, traits: ["swarm"], rare: false };
const shield: Equipment = { id: "g", slot: "armor", name: "樫の大盾", rarity: "common", power: 3, value: 24, affix: "guard", forged: 0 };

type Options = {
  readonly status?: "returned" | "fainted";
  readonly potions?: number;
  readonly potionsLeft?: number;
  readonly armor?: Equipment | null;
};

const resultOf = (events: readonly ExpeditionEvent[], options: Options = {}): ExpeditionResult => ({
  input: {
    seed: 1,
    target: 12,
    loadout: { level: 10, stats: { str: 5, vit: 5, luk: 0 }, potions: options.potions ?? 2, rations: 4, weapon: null, armor: options.armor ?? null },
    maps: [],
    potionThreshold: 30,
  },
  events,
  outcome: {
    status: options.status ?? "returned",
    reached: 12,
    hp: 10,
    maxHp: 50,
    potions: options.potionsLeft ?? 1,
    rations: 0,
    xp: 0,
    gold: 0,
    items: [],
    durationSec: 100,
    maps: [],
  },
});

/** 満タンの HP 50 から、受けたダメージのぶん HP が減っていく戦い */
const fight = (foe: FoeView, damages: readonly number[]): readonly ExpeditionEvent[] => [
  { type: "encounter", t: 0, depth: 12, foe, hp: 50 },
  ...damages.map((damage, i): ExpeditionEvent => {
    const taken = damages.slice(0, i + 1).reduce((sum, d) => sum + d, 0);
    return { type: "attack", by: "foe", damage, hp: Math.max(0, 50 - taken) };
  }),
  { type: "attack", by: "player", damage: 99, hp: 0 },
];

describe("buildAdvice", () => {
  it("一番削られた特徴の敵と、その割合を挙げる。効く特性を着けていなければ countered は false", () => {
    const advice = buildAdvice(resultOf([...fight(ogre, [20, 15]), ...fight(skeleton, [5])]));
    expect(advice[0]).toEqual({ type: "trait", trait: "heavy", foes: ["オーガ"], share: 0.875, countered: false });
  });

  it("効く特性を着けていたら countered は true", () => {
    const advice = buildAdvice(resultOf(fight(ogre, [20, 15]), { armor: shield }));
    expect(advice[0]).toMatchObject({ type: "trait", trait: "heavy", countered: true });
  });

  it("ほとんど削られなかった冒険や、特徴のない敵にやられた分は、特徴の手がかりにしない", () => {
    expect(buildAdvice(resultOf(fight(ogre, [3])))).toEqual([]);
    expect(buildAdvice(resultOf(fight(skeleton, [30])))).toEqual([]);
  });

  it("手がかりになる特徴は、多く削られた順に 2 つまで", () => {
    const fast: FoeView = { kind: "wraith", name: "レイス", hp: 26, traits: ["fast"], rare: false };
    const golem: FoeView = { kind: "golem", name: "ゴーレム", hp: 60, traits: ["armored", "heavy"], rare: false };
    const advice = buildAdvice(resultOf([...fight(golem, [20]), ...fight(fast, [18]), ...fight(rat, [2])]));
    expect(advice.map((a) => (a.type === "trait" ? a.trait : a.type))).toEqual(["armored", "heavy"]);
  });

  it("倒れるかギリギリで、ポーションを使い切っていた（持たせていなかった）ら、ポーションの手がかり", () => {
    const hurt = fight(ogre, [45]);
    expect(buildAdvice(resultOf(hurt, { status: "fainted", potions: 2, potionsLeft: 0 }))).toContainEqual({ type: "potions", carried: 2, left: 0 });
    expect(buildAdvice(resultOf(hurt, { status: "fainted", potions: 0, potionsLeft: 0 }))).toContainEqual({ type: "potions", carried: 0, left: 0 });
    expect(buildAdvice(resultOf(hurt, { potions: 2, potionsLeft: 0 }))).toContainEqual({ type: "potions", carried: 2, left: 0 });
  });

  it("余裕があった冒険や、ポーションが残っていた生還では、ポーションの手がかりは出ない", () => {
    expect(buildAdvice(resultOf(fight(ogre, [25]), { potions: 2, potionsLeft: 0 })).some((a) => a.type === "potions")).toBe(false);
    expect(buildAdvice(resultOf(fight(ogre, [45]), { potions: 2, potionsLeft: 1 })).some((a) => a.type === "potions")).toBe(false);
  });

  it("ポーションを残したまま倒れたら（一撃で倒れて飲めなかった）、残した数を手がかりにする", () => {
    const advice = buildAdvice(resultOf(fight(ogre, [50]), { status: "fainted", potions: 3, potionsLeft: 2 }));
    expect(advice).toContainEqual({ type: "potions", carried: 3, left: 2 });
  });

  it("空腹と、荷物がいっぱいで置いてきた数も手がかりにする", () => {
    const events: readonly ExpeditionEvent[] = [
      { type: "starving", t: 10, depth: 3 },
      { type: "bagFull", t: 20, depth: 3, source: "chest", item: shield },
      { type: "bagFull", t: 30, depth: 3, source: "drop", item: shield },
    ];
    expect(buildAdvice(resultOf(events))).toEqual([{ type: "hunger" }, { type: "bag", count: 2 }]);
  });
});
