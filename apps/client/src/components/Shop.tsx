import { SHOP, type ShopSku } from "@sealight/sim";

type ShopProps = {
  readonly gold: number;
  readonly busy: boolean;
  readonly onBuy: (sku: ShopSku) => void;
};

const SKUS = Object.keys(SHOP) as readonly ShopSku[];

const productLabel = (sku: ShopSku): string => {
  const product = SHOP[sku];
  if (product.type === "potion") return "ポーション（HP を半分回復）";
  return `${product.name}（${product.slot === "weapon" ? "攻" : "防"}+${product.power}）`;
};

export const Shop = ({ gold, busy, onBuy }: ShopProps) => (
  <section aria-label="店">
    <h3>店</h3>
    <ul className="list shop-list">
      {SKUS.map((sku) => (
        <li key={sku}>
          <button type="button" disabled={busy || gold < SHOP[sku].price} onClick={() => onBuy(sku)}>
            {productLabel(sku)} {SHOP[sku].price} G
          </button>
        </li>
      ))}
    </ul>
  </section>
);
