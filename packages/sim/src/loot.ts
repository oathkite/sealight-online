import { floorConfig, type Foe } from "./catalog";
import { ITEM_NAMES, type Equipment, type Loot, type Rarity, type Slot } from "./items";
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

const rollEquipment = (rng: Rng, context: LootContext, forceRare = false): Equipment => {
  const { depth, luck, id } = context;
  const slot: Slot = rng.int(2) === 0 ? "weapon" : "armor";
  const rareChance = Math.min(floorConfig(depth).rareChance + luck * 0.01 + (context.rareBonus ?? 0), 0.9);
  const rarity: Rarity = forceRare || rng.next() < rareChance ? "rare" : "common";
  const base = 1 + Math.floor(depth * 0.8) + rng.int(3);
  const power = rarity === "rare" ? Math.round(base * 1.6) + 1 : base;
  const value = power * 5 * (rarity === "rare" ? 3 : 1);
  return { id, slot, name: pick(rng, ITEM_NAMES[slot][rarity]), rarity, power, value };
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
