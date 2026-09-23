import { floorConfig } from "./catalog";
import { ITEM_NAMES, type Equipment, type Loot, type Rarity, type Slot } from "./items";
import type { Rng } from "./rng";

export type LootContext = {
  readonly depth: number;
  readonly luck: number;
  /** 装備に付ける ID。シードとドロップ順から決め、同じ探索の中で一意にする */
  readonly id: string;
};

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(items.length)] as T;

const rollEquipment = (rng: Rng, { depth, luck, id }: LootContext): Equipment => {
  const slot: Slot = rng.int(2) === 0 ? "weapon" : "armor";
  const rareChance = Math.min(floorConfig(depth).rareChance + luck * 0.01, 0.6);
  const rarity: Rarity = rng.next() < rareChance ? "rare" : "common";
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
