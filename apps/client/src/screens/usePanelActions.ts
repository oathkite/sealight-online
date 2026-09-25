import { useMemo } from "react";
import type { CharacterApi } from "@/api/characterApi";
import type { CharacterView } from "@/character/useCharacter";
import type { TownActions } from "@/components/TownPanel";

/** 画面のボタンから呼ぶ行動を、API 呼び出しにつなぐ */
export const usePanelActions = (api: CharacterApi, { run, depart }: Pick<CharacterView, "run" | "depart">) =>
  useMemo((): TownActions => {
    return {
      allocate: (stat) => void run(() => api.allocate(stat)),
      equip: (itemId) => void run(() => api.equip(itemId)),
      unequip: (slot) => void run(() => api.unequip(slot)),
      sell: (itemId) => void run(() => api.sell(itemId)),
      buy: (sku) => void run(() => api.buy(sku)),
      setTactics: (tactics) => void run(() => api.setTactics(tactics)),
      depart: (target, rations) => void depart(target, rations),
    };
  }, [api, run, depart]);
