import { useCallback, useEffect, useState } from "react";
import type { LampResult } from "@sealight/sim";
import { fetchLamp, startLamp } from "./lampApi";
import { ensureNotificationPermission, scheduleLampEndNotification } from "./notify";

const POLL_INTERVAL_MS = 2000;

export type LampView =
  | { readonly phase: "idle"; readonly error?: string }
  | { readonly phase: "starting" }
  | { readonly phase: "running"; readonly id: string; readonly endsAt: number }
  | { readonly phase: "done"; readonly result: LampResult };

/** 灯の開始から結果の受け取りまでを管理する */
export const useLamp = () => {
  const [view, setView] = useState<LampView>({ phase: "idle" });

  const start = useCallback(async () => {
    setView({ phase: "starting" });
    const canNotify = await ensureNotificationPermission();
    const started = await startLamp();
    if (!started.ok) {
      setView({ phase: "idle", error: started.error });
      return;
    }
    setView({ phase: "running", id: started.value.id, endsAt: started.value.endsAt });
    if (canNotify) await scheduleLampEndNotification(started.value.endsAt);
  }, []);

  const reset = useCallback(() => setView({ phase: "idle" }), []);

  const runningId = view.phase === "running" ? view.id : null;
  const endsAt = view.phase === "running" ? view.endsAt : 0;

  // 終了時刻を過ぎたらサーバーに結果を取りに行く
  useEffect(() => {
    if (!runningId) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      if (Date.now() < endsAt) return;
      const lamp = await fetchLamp(runningId);
      if (!cancelled && lamp.ok && lamp.value.status === "done") {
        setView({ phase: "done", result: lamp.value.result });
      }
    };
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runningId, endsAt]);

  return { view, start, reset } as const;
};
