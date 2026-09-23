import { describe, expect, it } from "vitest";
import { createCharacter, maxHpOf, type CharacterState } from "./character";
import type { Equipment } from "./items";
import {
  allocateStat,
  buy,
  completeLamp,
  decide,
  equip,
  sell,
  setTactics,
  startLamp,
  unequip,
  type RuleResult,
} from "./rules";

const LAMP = { seed: 1, now: 1_000, durationMs: 1_500_000 } as const;

const ok = (result: RuleResult): CharacterState => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.value;
};

const sword: Equipment = { id: "s1", slot: "weapon", name: "鉄の剣", rarity: "common", power: 4, value: 30 };

const withStash = (items: readonly Equipment[]): CharacterState => ({ ...createCharacter(), stash: items });

/** 生き残る灯を 1 回こなしてキャンプ状態にする */
const survivedOnce = (): CharacterState => {
  const strong = { ...createCharacter(), stats: { str: 20, vit: 20, luk: 0 } };
  const started = ok(startLamp({ ...strong, hp: maxHpOf(strong) }, LAMP));
  return ok(completeLamp(started));
};

describe("startLamp", () => {
  it("街からは地下 1 階の探索を始める", () => {
    const state = ok(startLamp(createCharacter(), LAMP));
    expect(state.phase).toEqual({ type: "exploring", depth: 1, seed: 1, startedAt: 1_000, endsAt: 1_501_000 });
  });

  it("探索中やキャンプ中は始められない", () => {
    const exploring = ok(startLamp(createCharacter(), LAMP));
    expect(startLamp(exploring, LAMP)).toEqual({ ok: false, error: "not_ready" });
    expect(startLamp(survivedOnce(), LAMP)).toEqual({ ok: false, error: "not_ready" });
  });
});

describe("completeLamp", () => {
  it("生き残ると戦利品は持ち物に入り、キャンプで判断を待つ", () => {
    const state = survivedOnce();
    expect(state.phase).toEqual({ type: "camp", depth: 1 });
    expect(state.lastLamp?.outcome.status).toBe("survived");
    expect(state.bag.items).toEqual(state.lastLamp?.outcome.items);
    expect(state.bag.gold).toBe(state.lastLamp?.outcome.gold);
  });

  it("倒れると持ち物を失い、倉庫と装備は残り、街に戻って HP が全快する", () => {
    const weak: CharacterState = {
      ...createCharacter(),
      stats: { str: 0, vit: 0, luk: 0 },
      hp: 1,
      potions: 0,
      bag: { items: [sword], gold: 99 },
      stash: [{ ...sword, id: "kept" }],
      phase: { type: "exploring", depth: 30, seed: 5, startedAt: 0, endsAt: 1 },
    };
    const state = ok(completeLamp(weak));
    expect(state.lastLamp?.outcome.status).toBe("dead");
    expect(state.bag).toEqual({ items: [], gold: 0 });
    expect(state.stash.map((i) => i.id)).toEqual(["kept"]);
    expect(state.equipment).toEqual(weak.equipment);
    expect(state.phase).toEqual({ type: "town" });
    expect(state.hp).toBe(maxHpOf(state));
  });

  it("損失ルール B では装備も失う", () => {
    const weak: CharacterState = {
      ...createCharacter(),
      stats: { str: 0, vit: 0, luk: 0 },
      hp: 1,
      potions: 0,
      phase: { type: "exploring", depth: 30, seed: 5, startedAt: 0, endsAt: 1 },
    };
    const state = ok(completeLamp(weak, "B"));
    expect(state.equipment).toEqual({ weapon: null, armor: null });
  });

  it("経験値が貯まるとレベルが上がり、割り振りポイントが増える", () => {
    const state = ok(
      completeLamp({
        ...createCharacter(),
        stats: { str: 30, vit: 30, luk: 0 },
        hp: 200,
        xp: 9,
        phase: { type: "exploring", depth: 3, seed: 11, startedAt: 0, endsAt: 1 },
        tactics: { potionThreshold: 0, priority: "treasure" },
      }),
    );
    expect(state.level).toBeGreaterThan(1);
    expect(state.unspentPoints).toBeGreaterThan(createCharacter().unspentPoints);
  });

  it("探索中でなければ完了できない", () => {
    expect(completeLamp(createCharacter())).toEqual({ ok: false, error: "not_exploring" });
  });
});

describe("decide", () => {
  it("降りると次は 1 つ下の階", () => {
    expect(ok(decide(survivedOnce(), "descend")).phase).toEqual({ type: "ready", depth: 2 });
  });

  it("留まると同じ階をもう一度", () => {
    expect(ok(decide(survivedOnce(), "stay")).phase).toEqual({ type: "ready", depth: 1 });
  });

  it("帰還すると持ち物が倉庫とお金に移り、HP が全快する", () => {
    const camp = survivedOnce();
    const state = ok(decide(camp, "return"));
    expect(state.phase).toEqual({ type: "town" });
    expect(state.bag).toEqual({ items: [], gold: 0 });
    expect(state.stash).toEqual([...camp.stash, ...camp.bag.items]);
    expect(state.gold).toBe(camp.gold + camp.bag.gold);
    expect(state.hp).toBe(maxHpOf(state));
  });

  it("降りた先から灯を始めると、その深さを探索する", () => {
    const ready = ok(decide(survivedOnce(), "descend"));
    const state = ok(startLamp(ready, LAMP));
    expect(state.phase.type === "exploring" && state.phase.depth).toBe(2);
  });

  it("キャンプ中でなければ判断できない", () => {
    expect(decide(createCharacter(), "descend")).toEqual({ ok: false, error: "not_in_camp" });
  });
});

describe("allocateStat", () => {
  it("ポイントを 1 消費してステータスを 1 上げる", () => {
    const base = createCharacter();
    const state = ok(allocateStat(base, "str"));
    expect(state.stats.str).toBe(base.stats.str + 1);
    expect(state.unspentPoints).toBe(base.unspentPoints - 1);
  });

  it("体を上げると最大 HP と現在 HP が増える", () => {
    const base = createCharacter();
    const state = ok(allocateStat(base, "vit"));
    expect(maxHpOf(state)).toBeGreaterThan(maxHpOf(base));
    expect(state.hp - base.hp).toBe(maxHpOf(state) - maxHpOf(base));
  });

  it("ポイントがなければ上げられない", () => {
    expect(allocateStat({ ...createCharacter(), unspentPoints: 0 }, "luk")).toEqual({ ok: false, error: "no_points" });
  });
});

describe("装備と売買（街でのみ）", () => {
  it("倉庫の装備を身につけ、元の装備は倉庫に戻る", () => {
    const base = withStash([sword]);
    const state = ok(equip(base, "s1"));
    expect(state.equipment.weapon).toEqual(sword);
    expect(state.stash).toEqual(base.equipment.weapon ? [base.equipment.weapon] : []);
  });

  it("外すと倉庫に戻る", () => {
    const state = ok(unequip(ok(equip(withStash([sword]), "s1")), "weapon"));
    expect(state.equipment.weapon).toBeNull();
    expect(state.stash.some((i) => i.id === "s1")).toBe(true);
  });

  it("倉庫にない装備は身につけられない", () => {
    expect(equip(createCharacter(), "missing")).toEqual({ ok: false, error: "item_not_found" });
  });

  it("売るとお金が増え、倉庫から消える", () => {
    const base = withStash([sword]);
    const state = ok(sell(base, "s1"));
    expect(state.gold).toBe(base.gold + sword.value);
    expect(state.stash).toEqual([]);
  });

  it("ポーションを買うとお金が減る", () => {
    const base = createCharacter();
    const state = ok(buy(base, "potion", "p1"));
    expect(state.potions).toBe(base.potions + 1);
    expect(state.gold).toBeLessThan(base.gold);
  });

  it("装備を買うと倉庫に入る", () => {
    const state = ok(buy({ ...createCharacter(), gold: 1000 }, "iron-sword", "bought-1"));
    expect(state.stash.at(-1)?.name).toBe("鉄の剣");
  });

  it("お金が足りなければ買えない", () => {
    expect(buy({ ...createCharacter(), gold: 0 }, "potion", "p2")).toEqual({ ok: false, error: "not_enough_gold" });
  });

  it("街の外では装備も売買もできない", () => {
    const exploring = ok(startLamp(withStash([sword]), LAMP));
    expect(equip(exploring, "s1")).toEqual({ ok: false, error: "not_in_town" });
    expect(sell(exploring, "s1")).toEqual({ ok: false, error: "not_in_town" });
    expect(buy(exploring, "potion", "p3")).toEqual({ ok: false, error: "not_in_town" });
  });
});

describe("setTactics", () => {
  it("探索中以外なら作戦を変えられる", () => {
    const tactics = { potionThreshold: 50, priority: "treasure" } as const;
    expect(ok(setTactics(createCharacter(), tactics)).tactics).toEqual(tactics);
  });

  it("探索中は変えられない", () => {
    const exploring = ok(startLamp(createCharacter(), LAMP));
    expect(setTactics(exploring, { potionThreshold: 10, priority: "stairs" })).toEqual({
      ok: false,
      error: "exploring",
    });
  });
});
