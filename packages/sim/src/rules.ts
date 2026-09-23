import { createCharacter, INITIAL_STATS, maxHpOf, type CharacterState } from "./character";
import type { StatKey } from "./fighter";
import { SHOP, type ShopSku, type Slot } from "./items";
import { simulateLamp, type LampOutcome, type Tactics } from "./lamp";
import { failure, success, type Result } from "./result";

export type RuleError =
  | "not_exploring"
  | "not_in_camp"
  | "not_in_town"
  | "exploring"
  | "no_points"
  | "item_not_found"
  | "not_enough_gold";

export type RuleResult = Result<CharacterState, RuleError>;

/**
 * 倒れたときに失うもの。
 * A：持ち物だけ / B：持ち物と装備 / C：持ち物、装備、レベルとステータス
 */
export type LossPolicy = "A" | "B" | "C";

export const DEFAULT_LOSS_POLICY: LossPolicy = "A";

export type Decision = "descend" | "stay" | "return";

const POINTS_PER_LEVEL = 3;
const xpToNext = (level: number): number => level * 10;

export type LampStart = { readonly seed: number; readonly now: number; readonly durationMs: number };

const exploringAt = (state: CharacterState, depth: number, lamp: LampStart): CharacterState => ({
  ...state,
  phase: { type: "exploring", depth, seed: lamp.seed, startedAt: lamp.now, endsAt: lamp.now + lamp.durationMs },
});

/** 街から地下 1 階の探索に出る */
export const startLamp = (state: CharacterState, lamp: LampStart): RuleResult =>
  state.phase.type === "town" ? success(exploringAt(state, 1, lamp)) : failure("not_in_town");

const gainXp = (state: CharacterState, xp: number): CharacterState => {
  let { level, unspentPoints } = state;
  let remaining = state.xp + xp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
    unspentPoints += POINTS_PER_LEVEL;
  }
  return { ...state, level, unspentPoints, xp: remaining };
};

const applyDeath = (state: CharacterState, policy: LossPolicy): CharacterState => {
  const withoutBag: CharacterState = { ...state, bag: { items: [], gold: 0 }, phase: { type: "town" } };
  const withoutGear: CharacterState =
    policy === "A" ? withoutBag : { ...withoutBag, equipment: { weapon: null, armor: null } };
  const lost: CharacterState =
    policy === "C"
      ? { ...withoutGear, level: 1, xp: 0, unspentPoints: createCharacter().unspentPoints, stats: INITIAL_STATS }
      : withoutGear;
  return { ...lost, hp: maxHpOf(lost) };
};

const applySurvival = (state: CharacterState, outcome: LampOutcome, depth: number): CharacterState => ({
  ...gainXp(state, outcome.xp),
  hp: outcome.hp,
  bag: { items: [...state.bag.items, ...outcome.items], gold: state.bag.gold + outcome.gold },
  phase: { type: "camp", depth },
  bestDepth: Math.max(state.bestDepth, depth),
});

/** 探索の終了時に呼ぶ。探索をシミュレーションして結果を反映する */
export const completeLamp = (state: CharacterState, policy: LossPolicy = DEFAULT_LOSS_POLICY): RuleResult => {
  const { phase } = state;
  if (phase.type !== "exploring") return failure("not_exploring");

  const result = simulateLamp({
    seed: phase.seed,
    depth: phase.depth,
    loadout: {
      stats: state.stats,
      hp: state.hp,
      potions: state.potions,
      weapon: state.equipment.weapon,
      armor: state.equipment.armor,
    },
    tactics: state.tactics,
  });
  const withPotions = { ...state, potions: result.outcome.potions, lastLamp: result };
  const next =
    result.outcome.status === "dead"
      ? applyDeath(withPotions, policy)
      : applySurvival(withPotions, result.outcome, phase.depth);
  return success(next);
};

/** 階段での判断。進む・留まるはその場で次の探索を始め、帰還は持ち物を倉庫に移して街に戻る */
export const decide = (state: CharacterState, decision: Decision, lamp: LampStart): RuleResult => {
  const { phase } = state;
  if (phase.type !== "camp") return failure("not_in_camp");
  switch (decision) {
    case "descend":
      return success(exploringAt(state, phase.depth + 1, lamp));
    case "stay":
      return success(exploringAt(state, phase.depth, lamp));
    case "return":
      return success({
        ...state,
        stash: [...state.stash, ...state.bag.items],
        gold: state.gold + state.bag.gold,
        bag: { items: [], gold: 0 },
        hp: maxHpOf(state),
        phase: { type: "town" },
      });
  }
};

export const allocateStat = (state: CharacterState, stat: StatKey): RuleResult => {
  if (state.unspentPoints <= 0) return failure("no_points");
  const next = { ...state, stats: { ...state.stats, [stat]: state.stats[stat] + 1 }, unspentPoints: state.unspentPoints - 1 };
  return success({ ...next, hp: state.hp + (maxHpOf(next) - maxHpOf(state)) });
};

const inTown = (state: CharacterState, action: (s: CharacterState) => RuleResult): RuleResult =>
  state.phase.type === "town" ? action(state) : failure("not_in_town");

export const equip = (state: CharacterState, itemId: string): RuleResult =>
  inTown(state, (s) => {
    const item = s.stash.find((i) => i.id === itemId);
    if (!item) return failure("item_not_found");
    const previous = s.equipment[item.slot];
    const stash = [...s.stash.filter((i) => i.id !== itemId), ...(previous ? [previous] : [])];
    return success({ ...s, stash, equipment: { ...s.equipment, [item.slot]: item } });
  });

export const unequip = (state: CharacterState, slot: Slot): RuleResult =>
  inTown(state, (s) => {
    const item = s.equipment[slot];
    if (!item) return failure("item_not_found");
    return success({ ...s, stash: [...s.stash, item], equipment: { ...s.equipment, [slot]: null } });
  });

export const sell = (state: CharacterState, itemId: string): RuleResult =>
  inTown(state, (s) => {
    const item = s.stash.find((i) => i.id === itemId);
    if (!item) return failure("item_not_found");
    return success({ ...s, gold: s.gold + item.value, stash: s.stash.filter((i) => i.id !== itemId) });
  });

/** 装備を買うときは、呼び出し側が一意な ID を渡す */
export const buy = (state: CharacterState, sku: ShopSku, newItemId: string): RuleResult =>
  inTown(state, (s) => {
    const product = SHOP[sku];
    if (s.gold < product.price) return failure("not_enough_gold");
    const paid = { ...s, gold: s.gold - product.price };
    if (product.type === "potion") return success({ ...paid, potions: paid.potions + 1 });
    const item = {
      id: newItemId,
      slot: product.slot,
      name: product.name,
      rarity: "common",
      power: product.power,
      value: Math.floor(product.price / 2),
    } as const;
    return success({ ...paid, stash: [...paid.stash, item] });
  });

export const setTactics = (state: CharacterState, tactics: Tactics): RuleResult =>
  state.phase.type === "exploring" ? failure("exploring") : success({ ...state, tactics });
