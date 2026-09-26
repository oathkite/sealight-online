import type { FoeKind, Trait } from "./catalog";
import type { BattleEvent } from "./combat";
import type { Stats } from "./fighter";
import type { Equipment, Loot } from "./items";

/** 時間と食料の係数。遊んで調整するつまみ */
export const PACE = {
  /** 1 マス歩くのにかかる秒数 */
  moveSec: 2,
  /** 戦闘 1 ラウンドにかかる秒数 */
  battleRoundSec: 6,
  /** 宝箱を開けるのにかかる秒数 */
  chestSec: 20,
  /** 食料 1 つで歩ける歩数 */
  movesPerRation: 60,
  /** 食料が尽きてから、何歩ごとに HP が 1 減るか */
  hungerEveryMoves: 4,
  /** 帰り道に新しく湧く敵の量（行きの敵の数に対する割合） */
  returnSpawnRatio: 0.3,
  /** 荷物の枠。食料とポーションは 1 つで 1 枠を使う */
  bagCapacity: 12,
  /** 目標の階の宝のレア率の上乗せ */
  goalRareBonus: 0.3,
} as const;

/** 階ごとの地図。depth - 1 番目に、歩いたことのあるマスの番号を並べる */
export type MapKnowledge = readonly (readonly number[])[];

export type ExpeditionLoadout = {
  /** 送り出したときのレベル。格下の階でもらえる経験値が減る */
  readonly level: number;
  readonly stats: Stats;
  readonly potions: number;
  readonly rations: number;
  readonly weapon: Equipment | null;
  readonly armor: Equipment | null;
};

export type ExpeditionInput = {
  readonly seed: number;
  readonly target: number;
  readonly loadout: ExpeditionLoadout;
  readonly maps: MapKnowledge;
  readonly potionThreshold: number;
};

export type Direction = "down" | "up";
export type LootSource = "chest" | "drop" | "goal";

export type FoeView = {
  readonly kind: FoeKind;
  readonly name: string;
  readonly hp: number;
  readonly traits: readonly Trait[];
  readonly rare: boolean;
};

/** 冒険の出来事。t は出発からの経過秒数。歩いた一歩ずつは記録しない（道中は見えない） */
export type ExpeditionEvent =
  | {
      readonly type: "floor";
      readonly t: number;
      readonly depth: number;
      readonly direction: Direction;
      /** 階に入った時点の HP と食料 */
      readonly hp: number;
      readonly rations: number;
    }
  | { readonly type: "encounter"; readonly t: number; readonly depth: number; readonly foe: FoeView; readonly hp: number }
  | BattleEvent
  | { readonly type: "loot"; readonly t: number; readonly depth: number; readonly source: LootSource; readonly loot: Loot }
  | {
      readonly type: "bagFull";
      readonly t: number;
      readonly depth: number;
      readonly source: LootSource;
      readonly item: Equipment;
    }
  | { readonly type: "eat"; readonly t: number; readonly depth: number; readonly rationsLeft: number }
  | { readonly type: "starving"; readonly t: number; readonly depth: number }
  | { readonly type: "turnaround"; readonly t: number; readonly depth: number }
  | { readonly type: "death"; readonly t: number; readonly depth: number; readonly cause: "battle" | "hunger" }
  | { readonly type: "home"; readonly t: number; readonly hp: number };

export type ExpeditionOutcome = {
  readonly status: "returned" | "fainted";
  /** 到達した最も深い階 */
  readonly reached: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly potions: number;
  readonly rations: number;
  readonly xp: number;
  /** 拾ったもの。倒れた場合は持ち帰れない（ルール側で捨てる） */
  readonly gold: number;
  readonly items: readonly Equipment[];
  /** 冒険にかかった秒数（ゲーム内の時間） */
  readonly durationSec: number;
  /** 冒険後の地図。倒れても地図は残る */
  readonly maps: MapKnowledge;
};

export type ExpeditionResult = {
  readonly input: ExpeditionInput;
  readonly events: readonly ExpeditionEvent[];
  readonly outcome: ExpeditionOutcome;
};
