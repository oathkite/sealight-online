import { floorConfig, type Foe } from "./catalog";
import {
  AFFIX_POWER,
  AFFIXES,
  basePower,
  equipmentValue,
  ITEM_NAMES,
  type Affix,
  type Equipment,
  type Loot,
  type Rarity,
  type Slot,
} from "./items";
import type { Rng } from "./rng";

export type LootContext = {
  readonly depth: number;
  readonly luck: number;
  /** 装備に付ける ID。シードとドロップ順から決め、同じ冒険の中で一意にする */
  readonly id: string;
  /** レア率の上乗せ（目標の階の宝など） */
  readonly rareBonus?: number;
};

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(items.length)] as T;

/** 装備に特性が付く確率 */
const AFFIX_CHANCE = 0.35;

const rollAffix = (rng: Rng, slot: Slot): Affix | null => (rng.next() < AFFIX_CHANCE ? pick(rng, AFFIXES[slot]) : null);

const rollEquipment = (rng: Rng, context: LootContext, forceRare = false): Equipment => {
  const { depth, luck, id } = context;
  const slot: Slot = rng.int(2) === 0 ? "weapon" : "armor";
  const rareChance = Math.min(floorConfig(depth).rareChance + luck * 0.01 + (context.rareBonus ?? 0), 0.9);
  const rarity: Rarity = forceRare || rng.next() < rareChance ? "rare" : "common";
  const affix = rollAffix(rng, slot);
  const base = basePower(depth) + rng.int(3);
  const raw = rarity === "rare" ? Math.round(base * 1.6) + 1 : base;
  const power = affix ? Math.max(1, Math.round(raw * AFFIX_POWER)) : raw;
  const value = equipmentValue(power, rarity, affix);
  return { id, slot, name: pick(rng, ITEM_NAMES[slot][rarity]), rarity, power, value, affix };
};

/** 宝箱の中身を決める。運が高いほど装備が出やすく、お金も多い */
export const rollLoot = (rng: Rng, context: LootContext): Loot => {
  const itemChance = Math.min(0.4 + context.luck * 0.02, 0.8);
  if (rng.next() < itemChance) return { type: "item", item: rollEquipment(rng, context) };
  const amount = Math.round((5 + context.depth * 3) * (1 + context.luck * 0.05)) + rng.int(5);
  return { type: "gold", amount: Math.max(amount, 1) };
};

/** 倒した敵の落とし物。レアな敵は必ずレアな装備を落とす */
export const rollDrop = (rng: Rng, foe: Foe, context: LootContext): Equipment | null => {
  if (foe.rare) return rollEquipment(rng, context, true);
  if (foe.dropChance <= 0 || rng.next() >= foe.dropChance) return null;
  return rollEquipment(rng, context);
};
