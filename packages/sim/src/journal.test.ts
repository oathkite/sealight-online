import { describe, expect, it } from "vitest";
import type { ExpeditionEvent } from "./expedition-types";
import { buildJournal, heartsOf, moodOf } from "./journal";

const slime = { kind: "slime", name: "スライム", hp: 8, traits: [], rare: false } as const;
const glow = { kind: "glowSlime", name: "光るスライム", hp: 10, traits: [], rare: true } as const;
const sword = { id: "a", slot: "weapon", name: "灯火の剣", rarity: "rare", power: 9, value: 135 } as const;

const events: readonly ExpeditionEvent[] = [
  { type: "floor", t: 0, depth: 1, direction: "down", hp: 40, rations: 4 },
  { type: "encounter", t: 60, depth: 1, foe: slime, hp: 40 },
  { type: "attack", by: "player", damage: 8, hp: 0 },
  { type: "victory", xp: 3 },
  { type: "encounter", t: 120, depth: 1, foe: slime, hp: 40 },
  { type: "attack", by: "foe", damage: 4, hp: 36 },
  { type: "attack", by: "player", damage: 8, hp: 0 },
  { type: "victory", xp: 3 },
  { type: "loot", t: 200, depth: 1, source: "chest", loot: { type: "gold", amount: 12 } },
  { type: "floor", t: 600, depth: 2, direction: "down", hp: 36, rations: 3 },
  { type: "encounter", t: 700, depth: 2, foe: glow, hp: 36 },
  { type: "attack", by: "foe", damage: 20, hp: 16 },
  { type: "attack", by: "player", damage: 10, hp: 0 },
  { type: "victory", xp: 25 },
  { type: "loot", t: 720, depth: 2, source: "drop", loot: { type: "item", item: sword } },
  { type: "turnaround", t: 900, depth: 2 },
  { type: "floor", t: 950, depth: 2, direction: "up", hp: 16, rations: 3 },
  { type: "floor", t: 1200, depth: 1, direction: "up", hp: 16, rations: 2 },
  { type: "home", t: 1400, hp: 14 },
];

const journal = buildJournal(events, { maxHp: 40, status: "returned" });

describe("heartsOf / moodOf", () => {
  it("HP をハート 5 つで表す。1 でも残っていればハートは 1 つ以上", () => {
    expect(heartsOf(40, 40)).toBe(5);
    expect(heartsOf(12, 40)).toBe(2);
    expect(heartsOf(1, 40)).toBe(1);
    expect(heartsOf(0, 40)).toBe(0);
  });

  it("HP の割合で顔が変わる", () => {
    expect([40, 24, 12, 4, 0].map((hp) => moodOf(hp, 40))).toEqual(["happy", "ok", "tired", "hurt", "down"]);
  });
});

describe("buildJournal", () => {
  it("階に入るたびに 1 行できる（行きと帰りは別の行）", () => {
    expect(journal.rows.map((r) => `${r.direction}${r.depth}`)).toEqual(["down1", "down2", "up2", "up1"]);
  });

  it("行の終わりの HP と食料は、次の階に入った時点（最後の行は帰宅時）の値", () => {
    expect(journal.rows.map((r) => r.hp)).toEqual([36, 16, 16, 14]);
    expect(journal.rows.map((r) => r.rations)).toEqual([3, 3, 2, 2]);
    expect(journal.rows.map((r) => r.hearts)).toEqual([5, 2, 2, 2]);
  });

  it("同じ敵はまとめて数える", () => {
    expect(journal.rows[0]?.foes).toEqual([{ kind: "slime", name: "スライム", count: 2, rare: false, traits: [] }]);
  });

  it("手に入れたものと、その手に入れ方を残す", () => {
    expect(journal.rows[0]?.loot).toEqual([{ source: "chest", loot: { type: "gold", amount: 12 }, dropped: false }]);
    expect(journal.rows[1]?.loot).toEqual([{ source: "drop", loot: { type: "item", item: sword }, dropped: false }]);
  });

  it("レアな敵に会った行と、折り返した行に印が付く", () => {
    expect(journal.rows[1]?.rare).toBe(true);
    expect(journal.rows[1]?.turnaround).toBe(true);
    expect(journal.rows[0]?.rare).toBe(false);
  });

  it("一番苦しかった戦いを、戦いの前後の HP と一緒に取り出す", () => {
    expect(journal.hardest).toEqual({ depth: 2, foe: "光るスライム", hpBefore: 36, hpAfter: 16, taken: 20, hits: 1, potions: 0 });
  });

  it("一番低かった HP の割合から、余裕を判定する", () => {
    expect(journal.margin).toBe("close");
    const easy = buildJournal(events.slice(0, 9).concat([{ type: "home", t: 300, hp: 36 }]), { maxHp: 40, status: "returned" });
    expect(easy.margin).toBe("easy");
  });

  it("倒れた冒険は failed で、最期の階と原因が残る", () => {
    const fainted = buildJournal(
      [
        { type: "floor", t: 0, depth: 1, direction: "down", hp: 10, rations: 0 },
        { type: "encounter", t: 30, depth: 1, foe: slime, hp: 10 },
        { type: "attack", by: "foe", damage: 10, hp: 0 },
        { type: "death", t: 40, depth: 1, cause: "battle" },
      ],
      { maxHp: 40, status: "fainted" },
    );
    expect(fainted.margin).toBe("failed");
    expect(fainted.rows[0]?.death).toBe("battle");
    expect(fainted.rows[0]?.hearts).toBe(0);
    expect(fainted.final).toEqual({ depth: 1, foe: "スライム", hpBefore: 10, hpAfter: 0, taken: 10, hits: 0, potions: 0 });
  });

  it("荷物がいっぱいで置いてきたもの、飢えも行に残る", () => {
    const row = buildJournal(
      [
        { type: "floor", t: 0, depth: 3, direction: "down", hp: 30, rations: 0 },
        { type: "starving", t: 10, depth: 3 },
        { type: "bagFull", t: 20, depth: 3, source: "chest", item: sword },
        { type: "home", t: 30, hp: 29 },
      ],
      { maxHp: 40, status: "returned" },
    ).rows[0];
    expect(row?.starving).toBe(true);
    expect(row?.loot).toEqual([{ source: "chest", loot: { type: "item", item: sword }, dropped: true }]);
  });
});

describe("荷物の入れ替え", () => {
  it("前の階で拾った装備を後の階で置いてきたら、拾った階の記録に印を付け、新しい行は足さない", () => {
    const rows = buildJournal(
      [
        { type: "floor", t: 0, depth: 1, direction: "down", hp: 30, rations: 0 },
        { type: "loot", t: 5, depth: 1, source: "chest", loot: { type: "item", item: sword } },
        { type: "floor", t: 10, depth: 2, direction: "down", hp: 30, rations: 0 },
        { type: "bagFull", t: 15, depth: 2, source: "drop", item: sword },
        { type: "home", t: 30, hp: 29 },
      ],
      { maxHp: 40, status: "returned" },
    ).rows;
    expect(rows[0]?.loot).toEqual([{ source: "chest", loot: { type: "item", item: sword }, dropped: true }]);
    expect(rows[1]?.loot).toEqual([]);
  });
});

describe("戦いの記録とポーション", () => {
  it("戦いの中で飲んだポーションの数を残す（受けたダメージが戦う前の HP を超える理由が分かる）", () => {
    const journal = buildJournal(
      [
        { type: "floor", t: 0, depth: 6, direction: "down", hp: 13, rations: 0 },
        { type: "encounter", t: 10, depth: 6, foe: slime, hp: 13 },
        { type: "potion", hp: 33 },
        { type: "attack", by: "foe", damage: 20, hp: 13 },
        { type: "potion", hp: 33 },
        { type: "attack", by: "foe", damage: 33, hp: 0 },
        { type: "death", t: 20, depth: 6, cause: "battle" },
      ],
      { maxHp: 40, status: "fainted" },
    );
    expect(journal.final).toEqual({ depth: 6, foe: "スライム", hpBefore: 13, hpAfter: 0, taken: 53, hits: 0, potions: 2 });
  });
});

describe("敵の特徴", () => {
  it("会った敵の特徴（硬い、群れなど）を行に残す。報告から対策を考えるため", () => {
    const beetle = { kind: "beetle", name: "甲虫", hp: 14, traits: ["armored"], rare: false } as const;
    const journal = buildJournal(
      [
        { type: "floor", t: 0, depth: 6, direction: "down", hp: 40, rations: 1 },
        { type: "encounter", t: 10, depth: 6, foe: beetle, hp: 40 },
        { type: "attack", by: "player", damage: 14, hp: 0 },
        { type: "victory", xp: 8 },
        { type: "home", t: 20, hp: 40 },
      ],
      { maxHp: 40, status: "returned" },
    );
    expect(journal.rows[0]?.foes[0]?.traits).toEqual(["armored"]);
  });
});
