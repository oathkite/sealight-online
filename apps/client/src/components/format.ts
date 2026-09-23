import type { Equipment } from "@sealight/sim";

export const itemLabel = (item: Equipment): string =>
  `${item.rarity === "rare" ? "★" : ""}${item.name}（${item.slot === "weapon" ? "攻" : "防"}+${item.power}）`;

export const STAT_LABELS = { str: "力", vit: "体", luk: "運" } as const;
