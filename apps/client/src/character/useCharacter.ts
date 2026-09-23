import { useCallback, useEffect, useState } from "react";
import type { CharacterState } from "@sealight/sim";
import type { ApiResult, CharacterApi } from "@/api/characterApi";
import { ensureNotificationPermission, scheduleLampEndNotification } from "./notify";

const POLL_INTERVAL_MS = 2000;

export type CharacterView = {
  readonly character: CharacterState | null;
  readonly error: string | null;
  readonly busy: boolean;
  /** API を呼んで結果を反映する。失敗したら error に入れる */
  readonly run: (call: () => Promise<ApiResult>) => Promise<void>;
  /** 探索が始まる API（出発、次の階へ進む、もう一度）を呼び、終了時刻に通知を予約する */
  readonly explore: (call: () => Promise<ApiResult>) => Promise<void>;
};

/** サーバーのキャラ状態を読み込み、行動の結果で更新する */
export const useCharacter = (api: CharacterApi): CharacterView => {
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((result: ApiResult): CharacterState | null => {
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    setCharacter(result.value);
    return result.value;
  }, []);

  const run = useCallback(
    async (call: () => Promise<ApiResult>) => {
      setBusy(true);
      apply(await call());
      setBusy(false);
    },
    [apply],
  );

  const explore = useCallback(
    async (call: () => Promise<ApiResult>) => {
      setBusy(true);
      // 許可を待っている間に探索が進まないよう、先に通知の許可を取る
      const canNotify = await ensureNotificationPermission();
      const next = apply(await call());
      setBusy(false);
      if (canNotify && next?.phase.type === "exploring") await scheduleLampEndNotification(next.phase.endsAt);
    },
    [apply],
  );

  useEffect(() => {
    void api.fetchMe().then(apply);
  }, [api, apply]);

  // 探索の終了時刻を過ぎたら、結果が確定するまでサーバーに取りに行く
  const endsAt = character?.phase.type === "exploring" ? character.phase.endsAt : null;
  useEffect(() => {
    if (endsAt === null) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= endsAt) void api.fetchMe().then(apply);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [api, apply, endsAt]);

  return { character, error, busy, run, explore };
};
