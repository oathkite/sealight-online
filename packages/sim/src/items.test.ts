import { describe, expect, it } from "vitest";
import { isShopSku, SHOP, shopOffer } from "./items";

describe("店の品物", () => {
  it("食料とポーションの値段は変わらない", () => {
    expect(shopOffer("ration", 0)).toEqual({ price: SHOP.ration.price, item: null });
    expect(shopOffer("potion", 12)).toEqual({ price: SHOP.potion.price, item: null });
  });

  it("特性付きの装備を売っている。深い階から無事に帰るほど、強くて高い物が並ぶ", () => {
    const early = shopOffer("guard-shield", 0);
    const late = shopOffer("guard-shield", 12);
    expect(early.item).toMatchObject({ slot: "armor", affix: "guard", rarity: "common" });
    expect(late.item?.power ?? 0).toBeGreaterThan(early.item?.power ?? 0);
    expect(late.price).toBeGreaterThan(early.price);
  });

  it("店の装備を売ると、買値より安い", () => {
    for (const sku of ["pierce-sword", "sweep-axe", "guard-shield", "evade-cloak"] as const) {
      const offer = shopOffer(sku, 8);
      expect(offer.item?.value ?? 0).toBeLessThan(offer.price);
    }
  });

  it("商品名を見分ける", () => {
    expect(isShopSku("potion")).toBe(true);
    expect(isShopSku("dragon")).toBe(false);
    expect(isShopSku("toString")).toBe(false);
  });
});
