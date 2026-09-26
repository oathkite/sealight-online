import { useMemo } from "react";
import type { ApiResult, CharacterApi } from "@/api/characterApi";
import type { CharacterView } from "@/character/useCharacter";
import type { TownActions } from "@/components/TownPanel";

/**
 * 食料を買ってからポーションを買う（同じキャラへの書き込みを並べないため、順に呼ぶ）。
 * 食料を買えなかったらそこで止める。食料は買えてポーションを買えなかったときは、食料を買った後の状態を返す
 * （画面が買った食料を知らないまま、もう一度買わせないように。足りないポーションは画面に残る）
 */
export const buyBoth = async (api: CharacterApi, rations: number, potions: number): Promise<ApiResult> => {
  if (rations === 0) return api.buy("potion", potions);
  const bought = await api.buy("ration", rations);
  if (!bought.ok || potions === 0) return bought;
  const both = await api.buy("potion", potions);
  return both.ok ? both : bought;
};

/** 画面のボタンから呼ぶ行動を、API 呼び出しにつなぐ */
export const usePanelActions = (api: CharacterApi, { run, depart }: Pick<CharacterView, "run" | "depart">) =>
  useMemo((): TownActions => {
    return {
      allocate: (stat) => void run(() => api.allocate(stat)),
      equip: (itemId) => void run(() => api.equip(itemId)),
      unequip: (slot) => void run(() => api.unequip(slot)),
      sell: (itemId) => void run(() => api.sell(itemId)),
      buy: (sku, quantity) => void run(() => api.buy(sku, quantity)),
      setTactics: (tactics) => void run(() => api.setTactics(tactics)),
      forge: (targetId, materialId) => void run(() => api.forge(targetId, materialId)),
      restock: (rations, potions) => void run(() => buyBoth(api, rations, potions)),
      depart: (target, rations, potions) => void depart(target, rations, potions),
    };
  }, [api, run, depart]);
