import { SHOP, type ShopSku } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { Glyph } from "./icons/Glyph";
import { ItemIcon } from "./items/ItemIcon";

type ShopProps = {
  readonly gold: number;
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

const ProductArt = ({ sku }: { readonly sku: ShopSku }) => {
  const product = SHOP[sku];
  if (product.type === "potion") return <Glyph name="potion" size={28} />;
  if (product.type === "ration") return <Glyph name="bread" size={28} />;
  return <ItemIcon item={{ name: product.name, slot: product.slot, rarity: "common" }} size={30} />;
};

type RowProps = { readonly sku: ShopSku; readonly gold: number; readonly busy: boolean; readonly onBuy: ShopProps["onBuy"] };

const buyWithSound = (onBuy: ShopProps["onBuy"], sku: ShopSku, quantity: number) => () => {
  playSfx("coin");
  onBuy(sku, quantity);
};

/** 食料とポーション。数ごとのボタンで、連打せずにまとめて買える */
const ConsumableRow = ({ sku, kind, gold, busy, onBuy }: RowProps & { readonly kind: keyof typeof CONSUMABLES }) => {
  const { name, hint } = CONSUMABLES[kind];
  const price = SHOP[sku].price;
  return (
    <div className="product consumable">
      <span className="product-art" aria-hidden="true">
        <ProductArt sku={sku} />
      </span>
      <span className="product-name">
        {name}
        <span className="muted">（{hint}・{price} G）</span>
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

const EquipmentRow = ({ sku, gold, busy, onBuy }: RowProps) => {
  const product = SHOP[sku];
  if (product.type !== "equipment") return null;
  return (
    <button type="button" className="product" disabled={busy || gold < product.price} onClick={buyWithSound(onBuy, sku, 1)}>
      <span className="product-art" aria-hidden="true">
        <ProductArt sku={sku} />
      </span>
      <span className="product-name">
        {product.name}（{product.slot === "weapon" ? "攻" : "防"}+{product.power}）
      </span>
      <span className="price">{product.price} G</span>
    </button>
  );
};

/** 町の店。買えない物は値段が足りないことが分かるよう、暗くする */
export const Shop = ({ gold, busy, onBuy }: ShopProps) => (
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
              <EquipmentRow sku={sku} gold={gold} busy={busy} onBuy={onBuy} />
            )}
          </li>
        );
      })}
    </ul>
  </section>
);
