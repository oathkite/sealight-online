import { useCallback, useState } from "react";
import type { LampResult } from "@sealight/sim";

const STORAGE_KEY = "sealight.seenLamp";

const keyOf = (lamp: LampResult): string => `${lamp.input.seed}:${lamp.input.depth}`;

const readSeen = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** 探索の結果の再生を見終えたかを覚えておく。同じ結果を何度も再生しないため */
export const useSeenLamp = (lamp: LampResult | null) => {
  const [seen, setSeen] = useState<string | null>(readSeen);

  const markSeen = useCallback(() => {
    if (!lamp) return;
    const key = keyOf(lamp);
    setSeen(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // 保存できなくても、この起動中は再生しない
    }
  }, [lamp]);

  return { unseen: lamp !== null && seen !== keyOf(lamp), markSeen } as const;
};
