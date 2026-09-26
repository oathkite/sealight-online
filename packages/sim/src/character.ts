import type { Reaction } from "./estimate";
import type { ExpeditionResult, MapKnowledge } from "./expedition-types";
import { maxHpFor, type Stats } from "./fighter";
import type { Equipment } from "./items";

/** 保存形式の版。形を変えたら上げ、古い版のキャラは作り直す */
export const STATE_VERSION = 5;

export type Tactics = {
  /** HP がこの割合（%）を下回ったらポーションを飲む。0 なら飲まない */
  readonly potionThreshold: number;
};

/**
 * キャラの居場所。街で準備して送り出すと exploring になり、帰ってくると town に戻る。
 * exploring には帰る時刻と結果を入れない（サーバーの中に隠しておく）。
 */
export type Phase =
  | { readonly type: "town" }
  | {
      readonly type: "exploring";
      readonly target: number;
      readonly startedAt: number;
      readonly estimate: { readonly minMs: number; readonly maxMs: number; readonly reaction: Reaction };
    };

export type CharacterState = {
  readonly version: typeof STATE_VERSION;
  readonly level: number;
  readonly xp: number;
  readonly unspentPoints: number;
  readonly stats: Stats;
  readonly gold: number;
  readonly potions: number;
  /** 家にある食料 */
  readonly rations: number;
  readonly equipment: { readonly weapon: Equipment | null; readonly armor: Equipment | null };
  /** 倉庫。失敗しても失わない */
  readonly stash: readonly Equipment[];
  readonly tactics: Tactics;
  /** 階ごとの地図。失敗しても残る */
  readonly maps: MapKnowledge;
  readonly phase: Phase;
  readonly lastExpedition: ExpeditionResult | null;
  /** 到達した最も深い階（倒れた冒険も含む） */
  readonly bestDepth: number;
  /** 無事に帰ってきた冒険の、最も深い目標の階 */
  readonly clearedDepth: number;
};

export const INITIAL_STATS: Stats = { str: 2, vit: 2, luk: 1 };

const STARTER_WEAPON: Equipment = {
  id: "starter-weapon",
  slot: "weapon",
  name: "木の棒",
  rarity: "common",
  power: 1,
  value: 1,
  affix: null,
  forged: 0,
};

export const maxHpOf = (state: Pick<CharacterState, "stats">): number => maxHpFor(state.stats);

export const createCharacter = (): CharacterState => ({
  version: STATE_VERSION,
  level: 1,
  xp: 0,
  unspentPoints: 3,
  stats: INITIAL_STATS,
  gold: 50,
  potions: 2,
  rations: 8,
  equipment: { weapon: STARTER_WEAPON, armor: null },
  stash: [],
  tactics: { potionThreshold: 30 },
  maps: [],
  phase: { type: "town" },
  lastExpedition: null,
  bestDepth: 0,
  clearedDepth: 0,
});
