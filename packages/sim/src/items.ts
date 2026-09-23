export type Rarity = "common" | "rare";
export type Slot = "weapon" | "armor";

export type Equipment = {
  readonly id: string;
  readonly slot: Slot;
  readonly name: string;
  readonly rarity: Rarity;
  /** 武器なら攻撃力、防具なら防御力に加わる */
  readonly power: number;
  /** 売値 */
  readonly value: number;
};

export type Loot =
  | { readonly type: "gold"; readonly amount: number }
  | { readonly type: "item"; readonly item: Equipment };

export const ITEM_NAMES = {
  weapon: { common: ["短剣", "棍棒", "手斧"], rare: ["灯火の剣", "星鉄の斧"] },
  armor: { common: ["布の服", "革の胸当て", "木の盾"], rare: ["月光の外套", "深海の鎧"] },
} as const satisfies Record<Slot, Record<Rarity, readonly string[]>>;

export type ShopItem =
  | { readonly type: "potion"; readonly price: number }
  | { readonly type: "equipment"; readonly price: number; readonly slot: Slot; readonly name: string; readonly power: number };

export const SHOP = {
  potion: { type: "potion", price: 15 },
  "iron-sword": { type: "equipment", price: 60, slot: "weapon", name: "鉄の剣", power: 4 },
  "leather-armor": { type: "equipment", price: 50, slot: "armor", name: "革の鎧", power: 2 },
  "steel-sword": { type: "equipment", price: 200, slot: "weapon", name: "鋼の剣", power: 8 },
  "chain-mail": { type: "equipment", price: 180, slot: "armor", name: "鎖かたびら", power: 5 },
} as const satisfies Record<string, ShopItem>;

export type ShopSku = keyof typeof SHOP;

export const isShopSku = (value: string): value is ShopSku => Object.hasOwn(SHOP, value);
