import type { Trait } from "./catalog";

export type Rarity = "common" | "rare";
export type Slot = "weapon" | "armor";

/**
 * 装備の特性。敵の特徴 1 つに強く効く代わりに、同じ深さの特性なしの装備より少し弱い。
 * pierce 貫き：防御をほとんど無視 / sweep 薙ぎ払い：群れに 2 倍 / guard 受け止め：強打を半減 / evade 身かわし：素早い敵の 2 回目をかわす
 */
export type Affix = "pierce" | "sweep" | "guard" | "evade";

export const AFFIXES = {
  weapon: ["pierce", "sweep"],
  armor: ["guard", "evade"],
} as const satisfies Record<Slot, readonly Affix[]>;

/** 特性が効く敵の特徴 */
export const AFFIX_COUNTERS = {
  pierce: "armored",
  sweep: "swarm",
  guard: "heavy",
  evade: "fast",
} as const satisfies Record<Affix, Trait>;

export type Equipment = {
  readonly id: string;
  readonly slot: Slot;
  readonly name: string;
  readonly rarity: Rarity;
  /** 武器なら攻撃力、防具なら防御力に加わる */
  readonly power: number;
  /** 売値 */
  readonly value: number;
  readonly affix: Affix | null;
  /** 鍛えた回数 */
  readonly forged: number;
};

export type Loot =
  | { readonly type: "gold"; readonly amount: number }
  | { readonly type: "item"; readonly item: Equipment };

export const ITEM_NAMES = {
  weapon: { common: ["短剣", "棍棒", "手斧"], rare: ["灯火の剣", "星鉄の斧"] },
  armor: { common: ["布の服", "革の胸当て", "木の盾"], rare: ["月光の外套", "深海の鎧"] },
} as const satisfies Record<Slot, Record<Rarity, readonly string[]>>;

/** 深さごとの装備の強さの基準。拾う装備はこれに 0〜2 の揺らぎが乗る */
export const basePower = (depth: number): number => 1 + Math.floor(depth * 0.8);

/** 特性付きの装備の強さの割合 */
export const AFFIX_POWER = 0.75;

/** 売値。珍しい物と特性付きは高い */
export const equipmentValue = (power: number, rarity: Rarity, affix: Affix | null): number =>
  Math.round(power * 5 * (rarity === "rare" ? 3 : 1) * (affix ? 1.6 : 1));

/** 鍛えられる回数の上限 */
export const MAX_FORGE = 3;
/** 溶かした装備の強さのうち、鍛えた装備に乗る割合 */
const FORGE_RATIO = 0.25;
/** 鍛える手間賃の、1 回目の値段。回を重ねるごとに増える */
const FORGE_FEE = 10;

/** 素材を溶かしたときに上がる強さ。最低 1 */
export const forgeGain = (material: Pick<Equipment, "power">): number => Math.max(1, Math.round(material.power * FORGE_RATIO));

export const forgeCost = (target: Pick<Equipment, "forged">): number => FORGE_FEE * (target.forged + 1);

/** 素材を溶かして鍛えた後の装備。特性はそのまま */
export const forgedWith = (target: Equipment, material: Equipment): Equipment => {
  const power = target.power + forgeGain(material);
  return { ...target, power, value: equipmentValue(power, target.rarity, target.affix), forged: target.forged + 1 };
};

type ShopEquipment = { readonly type: "equipment"; readonly slot: Slot; readonly name: string; readonly affix: Affix };

export type ShopItem =
  | { readonly type: "potion"; readonly price: number }
  | { readonly type: "ration"; readonly price: number }
  | ShopEquipment;

/** 店の品物。装備はどれも特性付きで、敵の特徴への備えを買える */
export const SHOP = {
  ration: { type: "ration", price: 5 },
  potion: { type: "potion", price: 15 },
  "pierce-sword": { type: "equipment", slot: "weapon", name: "鋼の細剣", affix: "pierce" },
  "sweep-axe": { type: "equipment", slot: "weapon", name: "大斧", affix: "sweep" },
  "guard-shield": { type: "equipment", slot: "armor", name: "樫の大盾", affix: "guard" },
  "evade-cloak": { type: "equipment", slot: "armor", name: "旅人の外套", affix: "evade" },
} as const satisfies Record<string, ShopItem>;

export type ShopSku = keyof typeof SHOP;

export const isShopSku = (value: string): value is ShopSku => Object.hasOwn(SHOP, value);

/** 店の装備の買値は、売値の何倍か */
const MARKUP = 3;

export type ShopOffer = {
  readonly price: number;
  /** 装備なら並んでいる品（ID は買うときに付ける。店の装備には必ず特性がある）。食料とポーションは null */
  readonly item: (Omit<Equipment, "id" | "affix"> & { readonly affix: Affix }) | null;
};

/** 店の値段と品。装備は、無事に帰った最も深い階に合わせた強さのものが並ぶ */
export const shopOffer = (sku: ShopSku, clearedDepth: number): ShopOffer => {
  const product: ShopItem = SHOP[sku];
  if (product.type !== "equipment") return { price: product.price, item: null };
  const power = Math.max(1, Math.round((basePower(Math.max(1, clearedDepth)) + 1) * AFFIX_POWER));
  const value = equipmentValue(power, "common", product.affix);
  const item = { slot: product.slot, name: product.name, rarity: "common", power, value, affix: product.affix, forged: 0 } as const;
  return { price: value * MARKUP, item };
};
