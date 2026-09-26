import { SHOP, shopOffer, type ShopSku } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { AFFIX_HINTS, AFFIX_NAMES } from "./format";
import { Glyph } from "./icons/Glyph";
import { ItemIcon } from "./items/ItemIcon";

type ShopProps = {
  readonly gold: number;
  /** 無事に帰った最も深い階。店の装備の強さが決まる */
  readonly clearedDepth: number;
  readonly busy: boolean;
  readonly onBuy: (sku: ShopSku, quantity: number) => void;
};

const SKUS = Object.keys(SHOP) as readonly ShopSku[];

/** 食料とポーションの買い方。1 つずつと、まとめ買い */
const BUNDLES = [1, 5, 10] as const;

const CONSUMABLES = {
  potion: { name: "ポーション", hint: "HP を半分回復" },
  ration: { name: "保存食", hint: "冒険の食料" },
} as const;

type RowProps = Omit<ShopProps, "clearedDepth"> & { readonly sku: ShopSku };

const buyWithSound = (onBuy: ShopProps["onBuy"], sku: ShopSku, quantity: number) => () => {
  playSfx("coin");
  onBuy(sku, quantity);
};

/** 食料とポーション。数ごとのボタンで、連打せずにまとめて買える */
const ConsumableRow = ({ sku, kind, gold, busy, onBuy }: RowProps & { readonly kind: keyof typeof CONSUMABLES }) => {
  const { name, hint } = CONSUMABLES[kind];
  const { price } = shopOffer(sku, 0);
  return (
    <div className="product consumable">
      <span className="product-art" aria-hidden="true">
        <Glyph name={kind === "potion" ? "potion" : "bread"} size={28} />
      </span>
      <span className="product-name">
        {name}
        <span className="muted">{hint}・{price} G</span>
      </span>
      <span className="bundles">
        {BUNDLES.map((n) => (
          <button key={n} type="button" aria-label={`${name}を ${n} 個買う`} disabled={busy || gold < price * n} onClick={buyWithSound(onBuy, sku, n)}>
            ×{n}
          </button>
        ))}
      </span>
    </div>
  );
};

/** 特性付きの装備。強さと値段は、無事に帰った最も深い階に合わせて変わる */
const EquipmentRow = ({ sku, clearedDepth, gold, busy, onBuy }: RowProps & { readonly clearedDepth: number }) => {
  const { price, item } = shopOffer(sku, clearedDepth);
  if (!item) return null;
  return (
    <button type="button" className="product" disabled={busy || gold < price} onClick={buyWithSound(onBuy, sku, 1)}>
      <span className="product-art" aria-hidden="true">
        <ItemIcon item={item} size={30} />
      </span>
      <span className="product-name">
        {item.name}（{item.slot === "weapon" ? "攻" : "防"}+{item.power}）<span className={`affix ${item.affix}`}>{AFFIX_NAMES[item.affix]}</span>
        <span className="affix-hint">{AFFIX_HINTS[item.affix]}</span>
      </span>
      <span className="price">{price} G</span>
    </button>
  );
};

/** 町の店。買えない物は値段が足りないことが分かるよう、暗くする */
export const Shop = ({ gold, clearedDepth, busy, onBuy }: ShopProps) => (
  <section className="shop" aria-label="店">
    <h3 className="ribbon">店</h3>
    <ul className="shop-list">
      {SKUS.map((sku) => {
        const type = SHOP[sku].type;
        return (
          <li key={sku}>
            {type === "potion" || type === "ration" ? (
              <ConsumableRow sku={sku} kind={type} gold={gold} busy={busy} onBuy={onBuy} />
            ) : (
              <EquipmentRow sku={sku} clearedDepth={clearedDepth} gold={gold} busy={busy} onBuy={onBuy} />
            )}
          </li>
        );
      })}
    </ul>
  </section>
);
