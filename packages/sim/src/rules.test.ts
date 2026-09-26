import { describe, expect, it } from "vitest";
import { createCharacter, type CharacterState } from "./character";
import { SHOP, type Equipment } from "./items";
import {
  allocateStat,
  buy,
  departExpedition,
  equip,
  returnFromExpedition,
  sell,
  setTactics,
  unequip,
  type Departure,
  type RuleResult,
} from "./rules";

const TRIP = { seed: 7, now: 1_000, timeScale: 1 } as const;

const ok = (result: RuleResult): CharacterState => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.value;
};

const depart = (state: CharacterState, target: number, rations: number): Departure => {
  const result = departExpedition(state, { ...TRIP, target, rations });
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.value;
};

const sword: Equipment = { id: "s1", slot: "weapon", name: "鉄の剣", rarity: "common", power: 4, value: 30 };
const strong = (): CharacterState => ({ ...createCharacter(), stats: { str: 30, vit: 30, luk: 5 } });
const weak = (): CharacterState => ({ ...createCharacter(), stats: { str: 0, vit: 0, luk: 0 }, potions: 0 });

describe("departExpedition", () => {
  it("目標と持たせる食料を決めて送り出す。結果と帰る時刻は別に返し、状態には入れない", () => {
    const { state, endsAt, result } = depart(strong(), 2, 4);
    expect(state.phase.type).toBe("exploring");
    expect(state.phase).not.toHaveProperty("endsAt");
    expect(endsAt).toBe(TRIP.now + result.outcome.durationSec * 1000);
    expect(result.input.target).toBe(2);
    expect(result.input.loadout.rations).toBe(4);
  });

  it("持たせた食料とポーションは家から減る", () => {
    const base = strong();
    const { state } = depart(base, 1, 3);
    expect(state.rations).toBe(base.rations - 3);
    expect(state.potions).toBe(0);
  });

  it("かかる時間の目安とモンスターの反応を、帰る時刻を漏らさない形で持つ", () => {
    const { state } = depart(strong(), 2, 4);
    if (state.phase.type !== "exploring") throw new Error("not exploring");
    expect(state.phase.estimate.maxMs).toBeGreaterThanOrEqual(state.phase.estimate.minMs);
    expect(state.phase.estimate.reaction).toBe("eager");
  });

  it("倍速にすると、帰る時刻もその分早くなる", () => {
    const normal = depart(strong(), 1, 2);
    const fast = departExpedition(strong(), { ...TRIP, timeScale: 10, target: 1, rations: 2 });
    expect(fast.ok && fast.value.endsAt - TRIP.now).toBe(Math.round((normal.endsAt - TRIP.now) / 10));
  });

  it("街にいないと送り出せない", () => {
    const { state } = depart(strong(), 1, 1);
    expect(departExpedition(state, { ...TRIP, target: 1, rations: 0 })).toEqual({ ok: false, error: "not_in_town" });
  });

  it("目標の階が範囲外なら送り出せない", () => {
    expect(departExpedition(strong(), { ...TRIP, target: 0, rations: 0 })).toEqual({ ok: false, error: "invalid_target" });
    expect(departExpedition(strong(), { ...TRIP, target: 21, rations: 0 })).toEqual({ ok: false, error: "invalid_target" });
  });

  it("持っている以上の食料や、荷物に入りきらない食料は持たせられない", () => {
    const base = strong();
    expect(departExpedition(base, { ...TRIP, target: 1, rations: base.rations + 1 })).toEqual({
      ok: false,
      error: "not_enough_rations",
    });
    expect(departExpedition({ ...base, rations: 99 }, { ...TRIP, target: 1, rations: 13 })).toEqual({
      ok: false,
      error: "not_enough_rations",
    });
  });
});

describe("returnFromExpedition", () => {
  it("無事に帰ると、拾ったもの、お金、残った食料とポーションを持ち帰り、街に戻る", () => {
    const base = { ...strong(), potions: 2 };
    const { state, result } = depart(base, 2, 4);
    const back = ok(returnFromExpedition(state, result));
    expect(result.outcome.status).toBe("returned");
    expect(back.phase).toEqual({ type: "town" });
    expect(back.stash).toEqual([...base.stash, ...result.outcome.items]);
    expect(back.gold).toBeGreaterThanOrEqual(base.gold + result.outcome.gold);
    expect(back.rations).toBe(base.rations - 4 + result.outcome.rations);
    expect(back.potions).toBe(result.outcome.potions);
    expect(back.lastExpedition).toEqual(result);
  });

  it("初めて到達した階から無事に帰ると、ご褒美のお金がもらえる", () => {
    const { state, result } = depart(strong(), 2, 4);
    const back = ok(returnFromExpedition(state, result));
    expect(back.gold).toBeGreaterThan(state.gold + result.outcome.gold);
    const again = depart(back, 2, 4);
    const second = ok(returnFromExpedition(again.state, again.result));
    expect(second.gold).toBe(again.state.gold + again.result.outcome.gold);
  });

  it("倒れたことのある階でも、初めて無事に帰ったときはご褒美がもらえる", () => {
    const fainted = depart(weak(), 12, 2);
    const afterFaint = ok(returnFromExpedition(fainted.state, fainted.result));
    const target = afterFaint.bestDepth;
    const { state, result } = depart({ ...afterFaint, stats: { str: 30, vit: 30, luk: 0 } }, target, 6);
    const back = ok(returnFromExpedition(state, result));
    expect(result.outcome.status).toBe("returned");
    expect(back.gold).toBeGreaterThan(state.gold + result.outcome.gold);
    expect(back.clearedDepth).toBe(target);
  });

  it("倒れると拾ったものと持たせた食料を失うが、経験と地図は残る", () => {
    const base = weak();
    const { state, result } = depart(base, 12, 2);
    const back = ok(returnFromExpedition(state, result));
    expect(result.outcome.status).toBe("fainted");
    expect(back.stash).toEqual(base.stash);
    expect(back.gold).toBe(base.gold);
    expect(back.rations).toBe(base.rations - 2);
    expect(back.maps).toEqual(result.outcome.maps);
    expect(back.maps.length).toBeGreaterThan(0);
    expect(back.bestDepth).toBe(result.outcome.reached);
  });

  it("経験値が貯まるとレベルが上がり、割り振りポイントが増える", () => {
    const { state, result } = depart({ ...strong(), xp: 9 }, 3, 6);
    const back = ok(returnFromExpedition(state, result));
    expect(back.level).toBeGreaterThan(1);
    expect(back.unspentPoints).toBeGreaterThan(createCharacter().unspentPoints);
  });

  it("冒険中でなければ帰還を反映できない", () => {
    const { result } = depart(strong(), 1, 1);
    expect(returnFromExpedition(createCharacter(), result)).toEqual({ ok: false, error: "not_exploring" });
  });
});

describe("街での行動", () => {
  it("ポイントを 1 消費してステータスを 1 上げる", () => {
    const base = createCharacter();
    const state = ok(allocateStat(base, "str"));
    expect(state.stats.str).toBe(base.stats.str + 1);
    expect(state.unspentPoints).toBe(base.unspentPoints - 1);
  });

  it("ポイントがなければ上げられない", () => {
    expect(allocateStat({ ...createCharacter(), unspentPoints: 0 }, "luk")).toEqual({ ok: false, error: "no_points" });
  });

  it("倉庫の装備を身につけ、元の装備は倉庫に戻る。外すと倉庫に戻る", () => {
    const base = { ...createCharacter(), stash: [sword] };
    const equipped = ok(equip(base, "s1"));
    expect(equipped.equipment.weapon).toEqual(sword);
    expect(equipped.stash).toEqual(base.equipment.weapon ? [base.equipment.weapon] : []);
    const removed = ok(unequip(equipped, "weapon"));
    expect(removed.equipment.weapon).toBeNull();
  });

  it("倉庫にない装備は身につけられない", () => {
    expect(equip(createCharacter(), "missing")).toEqual({ ok: false, error: "item_not_found" });
  });

  it("売るとお金が増える。食料とポーションを買える", () => {
    const base = { ...createCharacter(), stash: [sword] };
    expect(ok(sell(base, "s1")).gold).toBe(base.gold + sword.value);
    expect(ok(buy(base, "ration", "r")).rations).toBe(base.rations + 1);
    expect(ok(buy(base, "potion", "p")).potions).toBe(base.potions + 1);
  });

  it("食料とポーションはまとめて買える。代金は数のぶんだけかかる", () => {
    const base = { ...createCharacter(), gold: 100 };
    const state = ok(buy(base, "ration", "r", 10));
    expect(state.rations).toBe(base.rations + 10);
    expect(state.gold).toBe(100 - SHOP.ration.price * 10);
    expect(ok(buy(base, "potion", "p", 3)).potions).toBe(base.potions + 3);
  });

  it("まとめて買う数は 1〜99 の整数。装備は 1 つずつ", () => {
    const rich = { ...createCharacter(), gold: 10_000 };
    for (const quantity of [0, -1, 1.5, 100]) {
      expect(buy(rich, "ration", "r", quantity)).toEqual({ ok: false, error: "invalid_quantity" });
    }
    expect(buy(rich, "iron-sword", "i", 2)).toEqual({ ok: false, error: "invalid_quantity" });
  });

  it("まとめ買いの代金が足りなければ、1 つも買わない", () => {
    const base = { ...createCharacter(), gold: SHOP.potion.price * 2 };
    expect(buy(base, "potion", "p", 3)).toEqual({ ok: false, error: "not_enough_gold" });
  });

  it("お金が足りなければ買えない", () => {
    expect(buy({ ...createCharacter(), gold: 0 }, "potion", "p")).toEqual({ ok: false, error: "not_enough_gold" });
  });

  it("モンスターが留守の間も、売買はできるが、装備、ステータス、作戦は変えられない", () => {
    const { state } = depart({ ...strong(), stash: [sword] }, 1, 1);
    expect(buy(state, "ration", "r").ok).toBe(true);
    expect(sell(state, "s1").ok).toBe(true);
    expect(equip(state, "s1")).toEqual({ ok: false, error: "not_in_town" });
    expect(allocateStat({ ...state, unspentPoints: 1 }, "str")).toEqual({ ok: false, error: "not_in_town" });
    expect(setTactics(state, { potionThreshold: 50 })).toEqual({ ok: false, error: "not_in_town" });
  });

  it("作戦（ポーションを飲む HP）を変えられる", () => {
    expect(ok(setTactics(createCharacter(), { potionThreshold: 50 })).tactics).toEqual({ potionThreshold: 50 });
  });
});
