import { describe, expect, it } from "vitest";
import { resolveBattle, type Combatant, type Foe } from "./combat";
import { createRng } from "./rng";

const hero = (overrides: Partial<Combatant> = {}): Combatant => ({
  hp: 30,
  maxHp: 30,
  attack: 6,
  defense: 1,
  potions: 0,
  affixes: [],
  ...overrides,
});

const slime: Foe = {
  kind: "slime",
  name: "スライム",
  hp: 8,
  attack: 3,
  defense: 0,
  xp: 3,
  traits: [],
  rare: false,
  dropChance: 0,
};

describe("resolveBattle", () => {
  it("同じ乱数からは同じ戦闘結果になる", () => {
    const a = resolveBattle(createRng(1), hero(), slime, 30);
    const b = resolveBattle(createRng(1), hero(), slime, 30);
    expect(a).toEqual(b);
  });

  it("勝てば victory で終わり、経験値を得る", () => {
    const outcome = resolveBattle(createRng(2), hero(), slime, 30);
    expect(outcome.won).toBe(true);
    expect(outcome.events.at(-1)).toEqual({ type: "victory", xp: 3 });
  });

  it("ダメージは最低 1 で、HP は攻撃のたびに減る", () => {
    const tank: Foe = { ...slime, defense: 99, hp: 3 };
    const outcome = resolveBattle(createRng(3), hero({ attack: 1 }), tank, 0);
    const hits = outcome.events.filter((e) => e.type === "attack" && e.by === "player");
    expect(hits.length).toBe(3);
    for (const hit of hits) expect(hit.type === "attack" && hit.damage).toBe(1);
  });

  it("負けると HP 0 で終わり、victory は出ない", () => {
    const dragon: Foe = { ...slime, kind: "golem", name: "竜", hp: 999, attack: 50, defense: 50, xp: 100 };
    const outcome = resolveBattle(createRng(4), hero(), dragon, 0);
    expect(outcome.won).toBe(false);
    expect(outcome.combatant.hp).toBe(0);
    expect(outcome.events.some((e) => e.type === "victory")).toBe(false);
  });

  it("HP がしきい値を下回るとポーションを飲み、その手番は攻撃しない", () => {
    const outcome = resolveBattle(createRng(5), hero({ hp: 5, potions: 1 }), slime, 30);
    expect(outcome.events[0]).toEqual({ type: "potion", hp: 20 });
    expect(outcome.combatant.potions).toBe(0);
  });

  it("しきい値 0 ならポーションを飲まない", () => {
    const outcome = resolveBattle(createRng(5), hero({ hp: 5, potions: 1 }), slime, 0);
    expect(outcome.events.some((e) => e.type === "potion")).toBe(false);
    expect(outcome.combatant.potions).toBe(1);
  });

  it("ポーションの回復は最大 HP を超えない", () => {
    const outcome = resolveBattle(createRng(6), hero({ hp: 20, potions: 1 }), slime, 100);
    expect(outcome.events[0]).toEqual({ type: "potion", hp: 30 });
  });
});

describe("素早い敵", () => {
  it("1 ラウンドに 2 回攻撃してくる", () => {
    const fast: Foe = { ...slime, hp: 999, traits: ["fast"] };
    const outcome = resolveBattle(createRng(7), hero({ hp: 100, maxHp: 100 }), fast, 0);
    const firstRound = outcome.events.slice(0, 3).map((e) => (e.type === "attack" ? e.by : e.type));
    expect(firstRound).toEqual(["player", "foe", "foe"]);
  });
});

/** 最初の 1 ラウンドの、こちらの攻撃とあちらの攻撃 */
const firstRound = (me: Combatant, foe: Foe) => {
  const { events } = resolveBattle(createRng(3), me, foe, 0);
  const mine = events.find((e) => e.type === "attack" && e.by === "player");
  const firstFoe = events.findIndex((e) => e.type === "attack" && e.by === "foe");
  const nextMine = events.findIndex((e, i) => i > firstFoe && e.type === "attack" && e.by === "player");
  const theirs = events.slice(firstFoe, nextMine === -1 ? undefined : nextMine).filter((e) => e.type === "attack" && e.by === "foe");
  return { mine: mine?.type === "attack" ? mine.damage : 0, theirs: theirs.map((e) => (e.type === "attack" ? e.damage : 0)) };
};

describe("装備の特性", () => {
  const brute = (traits: Foe["traits"], overrides: Partial<Foe> = {}): Foe => ({ ...slime, hp: 999, attack: 20, defense: 0, traits, ...overrides });

  it("貫き：硬い敵の防御をほとんど無視する", () => {
    const shell = brute(["armored"], { defense: 10 });
    expect(firstRound(hero({ attack: 12 }), shell).mine).toBeLessThanOrEqual(3);
    expect(firstRound(hero({ attack: 12, affixes: ["pierce"] }), shell).mine).toBeGreaterThanOrEqual(9);
  });

  it("薙ぎ払い：群れの敵に 2 倍のダメージ。群れでない敵には効かない", () => {
    expect(firstRound(hero({ attack: 6 }), brute(["swarm"])).mine).toBeLessThanOrEqual(7);
    expect(firstRound(hero({ attack: 6, affixes: ["sweep"] }), brute(["swarm"])).mine).toBeGreaterThanOrEqual(10);
    expect(firstRound(hero({ attack: 6, affixes: ["sweep"] }), brute([])).mine).toBeLessThanOrEqual(7);
  });

  it("受け止め：強打の敵から受けるダメージを半分にする。強打でない敵には効かない", () => {
    expect(firstRound(hero({ hp: 99, maxHp: 99, defense: 0 }), brute(["heavy"])).theirs[0]).toBeGreaterThanOrEqual(19);
    expect(firstRound(hero({ hp: 99, maxHp: 99, defense: 0, affixes: ["guard"] }), brute(["heavy"])).theirs[0]).toBeLessThanOrEqual(11);
    expect(firstRound(hero({ hp: 99, maxHp: 99, defense: 0, affixes: ["guard"] }), brute([])).theirs[0]).toBeGreaterThanOrEqual(19);
  });

  it("身かわし：素早い敵の 2 回目の攻撃をかわす", () => {
    expect(firstRound(hero({ hp: 99, maxHp: 99 }), brute(["fast"])).theirs).toHaveLength(2);
    expect(firstRound(hero({ hp: 99, maxHp: 99, affixes: ["evade"] }), brute(["fast"])).theirs).toHaveLength(1);
  });
});
