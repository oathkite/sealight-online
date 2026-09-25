import { useCallback, useState } from "react";
import type { ExpeditionResult } from "@sealight/sim";

const STORAGE_KEY = "sealight.seenReport";

const keyOf = (result: ExpeditionResult): string => `${result.input.seed}:${result.input.target}`;

const readSeen = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** 冒険の報告を読み終えたかを覚えておく。同じ報告を何度も開かないため */
export const useSeenReport = (result: ExpeditionResult | null) => {
  const [seen, setSeen] = useState<string | null>(readSeen);

  const markSeen = useCallback(() => {
    if (!result) return;
    const key = keyOf(result);
    setSeen(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // 保存できなくても、この起動中は開かない
    }
  }, [result]);

  return { unseen: result !== null && seen !== keyOf(result), markSeen } as const;
};
