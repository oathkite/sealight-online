import { SHOP, type ShopSku } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { Glyph } from "./icons/Glyph";
import { ItemIcon } from "./items/ItemIcon";

type ShopProps = {
  readonly gold: number;
  readonly busy: boolean;
  readonly onBuy: (sku: ShopSku) => void;
};

const SKUS = Object.keys(SHOP) as readonly ShopSku[];

const productLabel = (sku: ShopSku): string => {
  const product = SHOP[sku];
  if (product.type === "potion") return "ポーション（HP を半分回復）";
  if (product.type === "ration") return "保存食（冒険の食料）";
  return `${product.name}（${product.slot === "weapon" ? "攻" : "防"}+${product.power}）`;
};

const ProductArt = ({ sku }: { readonly sku: ShopSku }) => {
  const product = SHOP[sku];
  if (product.type === "potion") return <Glyph name="potion" size={28} />;
  if (product.type === "ration") return <Glyph name="bread" size={28} />;
  return <ItemIcon item={{ name: product.name, slot: product.slot, rarity: "common" }} size={30} />;
};

/** 町の店。買えない物は値段が足りないことが分かるよう、暗くする */
export const Shop = ({ gold, busy, onBuy }: ShopProps) => (
  <section className="shop" aria-label="店">
    <h3 className="ribbon">店</h3>
    <ul className="shop-list">
      {SKUS.map((sku) => (
        <li key={sku}>
          <button
            type="button"
            className="product"
            disabled={busy || gold < SHOP[sku].price}
            onClick={() => {
              playSfx("coin");
              onBuy(sku);
            }}
          >
            <span className="product-art" aria-hidden="true">
              <ProductArt sku={sku} />
            </span>
            <span className="product-name">{productLabel(sku)}</span>
            <span className="price">{SHOP[sku].price} G</span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);
