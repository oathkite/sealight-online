import { maxHpOf, type CharacterState, type Tactics } from "./character";
import { estimateExpedition, reactionFor } from "./estimate";
import { simulateExpedition } from "./expedition";
import { PACE, type ExpeditionInput, type ExpeditionResult } from "./expedition-types";
import type { StatKey } from "./fighter";
import { MAX_DEPTH } from "./floor";
import { SHOP, type ShopSku, type Slot } from "./items";
import { failure, success, type Result } from "./result";

export type RuleError =
  | "not_in_town"
  | "not_exploring"
  | "invalid_target"
  | "not_enough_rations"
  | "no_points"
  | "item_not_found"
  | "not_enough_gold"
  | "invalid_quantity";

export type RuleResult = Result<CharacterState, RuleError>;

export type DepartureRequest = {
  readonly target: number;
  /** 持たせる食料の数 */
  readonly rations: number;
  readonly seed: number;
  readonly now: number;
  /** 何倍速で時間を進めるか。本番は 1 */
  readonly timeScale: number;
};

/** 送り出した後の状態と、サーバーの中に隠しておく帰る時刻と結果 */
export type Departure = {
  readonly state: CharacterState;
  readonly endsAt: number;
  readonly result: ExpeditionResult;
};

const POINTS_PER_LEVEL = 3;
/** 初めて到達した階から無事に帰ったときの、1 階あたりのご褒美 */
const FIRST_REACH_GOLD_PER_DEPTH = 15;

const xpToNext = (level: number): number => level * 10;
const toRealMs = (sec: number, timeScale: number): number => Math.round((sec * 1000) / timeScale);

const expeditionInput = (state: CharacterState, target: number, rations: number): Omit<ExpeditionInput, "seed"> => ({
  target,
  loadout: {
    stats: state.stats,
    potions: state.potions,
    rations,
    weapon: state.equipment.weapon,
    armor: state.equipment.armor,
  },
  maps: state.maps,
  potionThreshold: state.tactics.potionThreshold,
});

/** 目標の階と持たせる食料を決めて送り出す。冒険はこの時点で計算し、結果は帰る時刻まで隠す */
export const departExpedition = (state: CharacterState, request: DepartureRequest): Result<Departure, RuleError> => {
  if (state.phase.type !== "town") return failure("not_in_town");
  const { target, rations, seed, now, timeScale } = request;
  if (!Number.isInteger(target) || target < 1 || target > MAX_DEPTH) return failure("invalid_target");
  if (!Number.isInteger(rations) || rations < 0 || rations > state.rations || rations > PACE.bagCapacity) {
    return failure("not_enough_rations");
  }

  const input = expeditionInput(state, target, rations);
  const result = simulateExpedition({ ...input, seed });
  const estimate = estimateExpedition(input);
  const departed: CharacterState = {
    ...state,
    potions: 0,
    rations: state.rations - rations,
    phase: {
      type: "exploring",
      target,
      startedAt: now,
      estimate: {
        minMs: toRealMs(estimate.minSec, timeScale),
        maxMs: toRealMs(estimate.maxSec, timeScale),
        reaction: reactionFor(estimate.successRate),
      },
    },
  };
  return success({ state: departed, endsAt: now + toRealMs(result.outcome.durationSec, timeScale), result });
};

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

/** 帰ってきた冒険の結果を反映する。倒れた場合は拾ったものと持たせた食料を失うが、経験と地図は残る */
export const returnFromExpedition = (state: CharacterState, result: ExpeditionResult): RuleResult => {
  if (state.phase.type !== "exploring") return failure("not_exploring");
  const { outcome, input } = result;
  const grown: CharacterState = {
    ...gainXp(state, outcome.xp),
    maps: outcome.maps,
    bestDepth: Math.max(state.bestDepth, outcome.reached),
    phase: { type: "town" },
    lastExpedition: result,
  };
  if (outcome.status === "fainted") return success(grown);

  const firstReach = input.target > state.clearedDepth ? input.target * FIRST_REACH_GOLD_PER_DEPTH : 0;
  return success({
    ...grown,
    clearedDepth: Math.max(state.clearedDepth, input.target),
    stash: [...state.stash, ...outcome.items],
    gold: state.gold + outcome.gold + firstReach,
    potions: state.potions + outcome.potions,
    rations: state.rations + outcome.rations,
  });
};

const inTown = (state: CharacterState, action: (s: CharacterState) => RuleResult): RuleResult =>
  state.phase.type === "town" ? action(state) : failure("not_in_town");

/** ステータスの割り振り（モンスターが家にいるときだけ） */
export const allocateStat = (state: CharacterState, stat: StatKey): RuleResult =>
  inTown(state, (s) => {
    if (s.unspentPoints <= 0) return failure("no_points");
    return success({ ...s, stats: { ...s.stats, [stat]: s.stats[stat] + 1 }, unspentPoints: s.unspentPoints - 1 });
  });

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

export const setTactics = (state: CharacterState, tactics: Tactics): RuleResult =>
  inTown(state, (s) => success({ ...s, tactics }));

/** 倉庫の装備を売る（モンスターの留守中もできる） */
export const sell = (state: CharacterState, itemId: string): RuleResult => {
  const item = state.stash.find((i) => i.id === itemId);
  if (!item) return failure("item_not_found");
  return success({ ...state, gold: state.gold + item.value, stash: state.stash.filter((i) => i.id !== itemId) });
};

/** 一度にまとめて買える数の上限 */
export const MAX_BUY = 99;

const isValidQuantity = (quantity: number, isEquipment: boolean): boolean =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= (isEquipment ? 1 : MAX_BUY);

/**
 * 店で買う（モンスターの留守中もできる）。食料とポーションはまとめて買え、装備は 1 つずつ。
 * 装備を買うときは、呼び出し側が一意な ID を渡す
 */
export const buy = (state: CharacterState, sku: ShopSku, newItemId: string, quantity = 1): RuleResult => {
  const product = SHOP[sku];
  if (!isValidQuantity(quantity, product.type === "equipment")) return failure("invalid_quantity");
  const cost = product.price * quantity;
  if (state.gold < cost) return failure("not_enough_gold");
  const paid = { ...state, gold: state.gold - cost };
  if (product.type === "potion") return success({ ...paid, potions: paid.potions + quantity });
  if (product.type === "ration") return success({ ...paid, rations: paid.rations + quantity });
  const item = {
    id: newItemId,
    slot: product.slot,
    name: product.name,
    rarity: "common",
    power: product.power,
    value: Math.floor(product.price / 2),
  } as const;
  return success({ ...paid, stash: [...paid.stash, item] });
};

export { maxHpOf };
