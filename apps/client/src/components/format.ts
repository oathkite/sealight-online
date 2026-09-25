import type { Equipment, LootSource, Margin, Mood, Reaction } from "@sealight/sim";

export const itemLabel = (item: Equipment): string =>
  `${item.rarity === "rare" ? "★" : ""}${item.name}（${item.slot === "weapon" ? "攻" : "防"}+${item.power}）`;

export const STAT_LABELS = { str: "力", vit: "体", luk: "運" } as const;

/** 秒を「1 時間 20 分」のように表す */
export const formatDuration = (sec: number): string => {
  const minutes = Math.max(1, Math.round(sec / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} 分`;
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`;
};

/** 仮の顔。本番はクレヨン風の絵に置き換える */
export const MOOD_FACES = { happy: "😀", ok: "🙂", tired: "😅", hurt: "😣", down: "😵" } as const satisfies Record<Mood, string>;

export const REACTIONS = {
  eager: { face: "😆", label: "張り切っている" },
  calm: { face: "🙂", label: "落ち着いている" },
  nervous: { face: "😟", label: "少し不安そう" },
  scared: { face: "😨", label: "怯えている" },
} as const satisfies Record<Reaction, { readonly face: string; readonly label: string }>;

export const MARGINS = {
  easy: "楽勝だったみたい",
  fine: "まずまずだったみたい",
  close: "ギリギリだったみたい",
  failed: "力尽きてしまった",
} as const satisfies Record<Margin, string>;

export const SOURCES = { chest: "宝箱", drop: "敵が落とした", goal: "目標の階の宝" } as const satisfies Record<LootSource, string>;

export const hearts = (count: number): string => "♥".repeat(count) + "♡".repeat(Math.max(0, 5 - count));
