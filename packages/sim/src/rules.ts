import { maxHpOf, type CharacterState, type Tactics } from "./character";
import { estimateExpedition, reactionFor } from "./estimate";
import { simulateExpedition } from "./expedition";
import { PACE, type ExpeditionInput, type ExpeditionResult } from "./expedition-types";
import type { StatKey } from "./fighter";
import { MAX_DEPTH } from "./floor";
import { forgeCost, forgedWith, MAX_FORGE, SHOP, shopOffer, type Equipment, type ShopSku, type Slot } from "./items";
import { failure, success, type Result } from "./result";

export type RuleError =
  | "not_in_town"
  | "not_exploring"
  | "invalid_target"
  | "not_enough_rations"
  | "not_enough_potions"
  | "bag_overflow"
  | "no_points"
  | "item_not_found"
  | "not_enough_gold"
  | "invalid_quantity"
  | "invalid_material"
  | "max_forged";

export type RuleResult = Result<CharacterState, RuleError>;

export type DepartureRequest = {
  readonly target: number;
  /** 持たせる食料の数 */
  readonly rations: number;
  /** 持たせるポーションの数。食料と荷物の枠を分け合う */
  readonly potions: number;
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

const expeditionInput = (state: CharacterState, target: number, rations: number, potions: number): Omit<ExpeditionInput, "seed"> => ({
  target,
  loadout: {
    stats: state.stats,
    potions,
    rations,
    weapon: state.equipment.weapon,
    armor: state.equipment.armor,
  },
  maps: state.maps,
  potionThreshold: state.tactics.potionThreshold,
});

const isCount = (n: number, max: number): boolean => Number.isInteger(n) && n >= 0 && n <= max;

/** 目標の階と、持たせる食料とポーションを確かめる */
const checkDeparture = (state: CharacterState, { target, rations, potions }: DepartureRequest): RuleError | null => {
  if (state.phase.type !== "town") return "not_in_town";
  if (!Number.isInteger(target) || target < 1 || target > MAX_DEPTH) return "invalid_target";
  if (!isCount(rations, Math.min(state.rations, PACE.bagCapacity))) return "not_enough_rations";
  if (!isCount(potions, state.potions)) return "not_enough_potions";
  if (rations + potions > PACE.bagCapacity) return "bag_overflow";
  return null;
};

/** 目標の階と持たせる食料・ポーションを決めて送り出す。冒険はこの時点で計算し、結果は帰る時刻まで隠す */
export const departExpedition = (state: CharacterState, request: DepartureRequest): Result<Departure, RuleError> => {
  const error = checkDeparture(state, request);
  if (error) return failure(error);
  const { target, rations, potions, seed, now, timeScale } = request;
  const input = expeditionInput(state, target, rations, potions);
  const result = simulateExpedition({ ...input, seed });
  const estimate = estimateExpedition(input);
  const departed: CharacterState = {
    ...state,
    potions: state.potions - potions,
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
  const { price, item } = shopOffer(sku, state.clearedDepth);
  if (!isValidQuantity(quantity, item !== null)) return failure("invalid_quantity");
  const cost = price * quantity;
  if (state.gold < cost) return failure("not_enough_gold");
  const paid = { ...state, gold: state.gold - cost };
  if (item) return success({ ...paid, stash: [...paid.stash, { ...item, id: newItemId }] });
  if (SHOP[sku].type === "potion") return success({ ...paid, potions: paid.potions + quantity });
  return success({ ...paid, rations: paid.rations + quantity });
};

/** 鍛える装備を、身につけている物と倉庫から探す */
const findOwned = (state: CharacterState, itemId: string): Equipment | undefined =>
  [state.equipment.weapon, state.equipment.armor, ...state.stash].filter((i): i is Equipment => i !== null).find((i) => i.id === itemId);

/** 鍛えた装備を元の場所（身につけている所か倉庫）に戻し、素材を倉庫から除く */
const replaceForged = (state: CharacterState, forged: Equipment, materialId: string): CharacterState => {
  const worn = state.equipment[forged.slot]?.id === forged.id;
  const stash = state.stash.filter((i) => i.id !== materialId).map((i) => (i.id === forged.id ? forged : i));
  return { ...state, stash, equipment: worn ? { ...state.equipment, [forged.slot]: forged } : state.equipment };
};

/**
 * 鍛冶（モンスターが家にいるときだけ）。倉庫の装備を 1 つ溶かして、同じ部位の装備を鍛える。
 * 溶かした物の強さの一部が乗り、特性はそのまま残る。回を重ねるごとに手間賃が上がり、上限がある
 */
export const forge = (state: CharacterState, targetId: string, materialId: string): RuleResult =>
  inTown(state, (s) => {
    const target = findOwned(s, targetId);
    const material = s.stash.find((i) => i.id === materialId);
    if (!target || !material) return failure("item_not_found");
    if (target.id === material.id || target.slot !== material.slot) return failure("invalid_material");
    if (target.forged >= MAX_FORGE) return failure("max_forged");
    const cost = forgeCost(target);
    if (s.gold < cost) return failure("not_enough_gold");
    return success(replaceForged({ ...s, gold: s.gold - cost }, forgedWith(target, material), material.id));
  });

export { maxHpOf };
