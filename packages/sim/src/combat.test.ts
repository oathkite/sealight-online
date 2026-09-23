import { describe, expect, it } from "vitest";
import { resolveBattle, type Combatant, type Foe } from "./combat";
import { createRng } from "./rng";

const hero = (overrides: Partial<Combatant> = {}): Combatant => ({
  hp: 30,
  maxHp: 30,
  attack: 6,
  defense: 1,
  potions: 0,
  ...overrides,
});

const slime: Foe = { kind: "slime", name: "スライム", hp: 8, attack: 3, defense: 0, xp: 3 };

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
    const dragon: Foe = { kind: "skeleton", name: "竜", hp: 999, attack: 50, defense: 50, xp: 100 };
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
