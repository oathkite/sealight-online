import type { Equipment } from "./items";

export type Stats = {
  /** 力：攻撃力 */
  readonly str: number;
  /** 体：最大 HP と防御力 */
  readonly vit: number;
  /** 運：宝箱の中身 */
  readonly luk: number;
};

export type StatKey = keyof Stats;

export const STAT_KEYS: readonly StatKey[] = ["str", "vit", "luk"];

export const maxHpFor = (stats: Stats): number => 20 + stats.vit * 6;

export const attackFor = (stats: Stats, weapon: Equipment | null): number => 3 + stats.str * 2 + (weapon?.power ?? 0);

export const defenseFor = (stats: Stats, armor: Equipment | null): number => Math.floor(stats.vit / 2) + (armor?.power ?? 0);
