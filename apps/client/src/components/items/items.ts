import type { CharacterState, Equipment, Slot } from "@sealight/sim";

/** 装備の絵の種類 */
export type ItemKind = "sword" | "dagger" | "club" | "axe" | "stick" | "cloth" | "leather" | "shield" | "cloak" | "plate" | "mail";

/** 名前に含まれる言葉から絵を決める（先に書いたものが優先） */
const KINDS: readonly (readonly [string, ItemKind])[] = [
  ["短剣", "dagger"],
  ["剣", "sword"],
  ["斧", "axe"],
  ["棍棒", "club"],
  ["棒", "stick"],
  ["盾", "shield"],
  ["外套", "cloak"],
  ["かたびら", "mail"],
  ["革", "leather"],
  ["鎧", "plate"],
  ["服", "cloth"],
];

export const itemKind = (item: Pick<Equipment, "name" | "slot">): ItemKind =>
  KINDS.find(([word]) => item.name.includes(word))?.[1] ?? (item.slot === "weapon" ? "sword" : "leather");

/** 同じ部位の今の装備と比べた、強さの差 */
export const gainOver = (item: Equipment, equipment: CharacterState["equipment"]): number => item.power - (equipment[item.slot]?.power ?? 0);

export const statName = (slot: Slot): string => (slot === "weapon" ? "攻" : "防");

/** 鍛える欄の id。開くボタンの aria-controls から指す */
export const forgePanelId = (itemId: string): string => `forge-${itemId}`;
