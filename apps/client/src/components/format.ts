import type { Affix, Equipment, LootSource, Margin, Reaction, Trait } from "@sealight/sim";

export const AFFIX_NAMES = {
  pierce: "貫き",
  sweep: "薙ぎ払い",
  guard: "受け止め",
  evade: "身かわし",
} as const satisfies Record<Affix, string>;

/** 特性が何に効くか。装備の札と報告の手がかりで使う */
export const AFFIX_HINTS = {
  pierce: "硬い敵の守りを貫く",
  sweep: "群れの敵に 2 倍のダメージ",
  guard: "強打の敵のダメージを半分に",
  evade: "素早い敵の 2 回目の攻撃をかわす",
} as const satisfies Record<Affix, string>;

export const itemLabel = (item: Equipment): string =>
  `${item.rarity === "rare" ? "★" : ""}${item.name}${item.affix ? `［${AFFIX_NAMES[item.affix]}］` : ""}（${item.slot === "weapon" ? "攻" : "防"}+${item.power}）`;

export const STAT_LABELS = { str: "力", vit: "体", luk: "運" } as const;

/** 秒を「1 時間 20 分」のように表す */
export const formatDuration = (sec: number): string => {
  const minutes = Math.max(1, Math.round(sec / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} 分`;
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`;
};

/** 送り出す前の様子。顔の絵（Face）と一緒に出す */
export const REACTIONS = {
  eager: "張り切っている",
  calm: "落ち着いている",
  nervous: "少し不安そう",
  scared: "怯えている",
} as const satisfies Record<Reaction, string>;

export const MARGINS = {
  easy: "楽勝だったみたい",
  fine: "まずまずだったみたい",
  close: "ギリギリだったみたい",
  failed: "力尽きてしまった",
} as const satisfies Record<Margin, string>;

export const SOURCES = { chest: "宝箱", drop: "敵が落とした", goal: "目標の階の宝" } as const satisfies Record<LootSource, string>;

export const TRAITS = { swarm: "群れ", armored: "硬い", heavy: "強打", fast: "素早い" } as const satisfies Record<Trait, string>;
