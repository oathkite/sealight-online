import { maxHpFor, type Stats } from "./fighter";
import type { Equipment } from "./items";
import type { LampResult, Tactics } from "./lamp";

/**
 * キャラの居場所と進行状況。
 * town → exploring（25 分の探索）→ camp（階段で次の行動を待つ）→ exploring …
 * 進む・留まるを選ぶとその場で次の探索が始まる。倒れるか帰還すると town に戻る。
 */
export type Phase =
  | { readonly type: "town" }
  | {
      readonly type: "exploring";
      readonly depth: number;
      readonly seed: number;
      readonly startedAt: number;
      readonly endsAt: number;
    }
  | { readonly type: "camp"; readonly depth: number };

export type CharacterState = {
  readonly level: number;
  readonly xp: number;
  readonly unspentPoints: number;
  readonly stats: Stats;
  readonly hp: number;
  readonly gold: number;
  readonly potions: number;
  readonly equipment: { readonly weapon: Equipment | null; readonly armor: Equipment | null };
  /** 倉庫。倒れても失わない */
  readonly stash: readonly Equipment[];
  /** 持ち物（まだ持ち帰っていない戦利品）。倒れると失う */
  readonly bag: { readonly items: readonly Equipment[]; readonly gold: number };
  readonly tactics: Tactics;
  readonly phase: Phase;
  readonly lastLamp: LampResult | null;
  readonly bestDepth: number;
};

export const INITIAL_STATS: Stats = { str: 2, vit: 2, luk: 1 };

const STARTER_WEAPON: Equipment = {
  id: "starter-weapon",
  slot: "weapon",
  name: "木の棒",
  rarity: "common",
  power: 1,
  value: 1,
};

export const maxHpOf = (state: Pick<CharacterState, "stats">): number => maxHpFor(state.stats);

export const createCharacter = (): CharacterState => ({
  level: 1,
  xp: 0,
  unspentPoints: 3,
  stats: INITIAL_STATS,
  hp: maxHpFor(INITIAL_STATS),
  gold: 50,
  potions: 2,
  equipment: { weapon: STARTER_WEAPON, armor: null },
  stash: [],
  bag: { items: [], gold: 0 },
  tactics: { potionThreshold: 30, priority: "stairs" },
  phase: { type: "town" },
  lastLamp: null,
  bestDepth: 0,
});
