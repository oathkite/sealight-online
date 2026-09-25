import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterState } from "@sealight/sim";
import type { ApiResult, CharacterApi } from "@/api/characterApi";
import { ensureNotificationPermission, notifyReturn } from "./notify";

/** 冒険中にサーバーへ確認しに行く間隔。帰る時刻は画面に渡されないので、確認するまで帰ってきたことは分からない */
const POLL_INTERVAL_MS = import.meta.env.DEV ? 3_000 : 30_000;

export type CharacterView = {
  readonly character: CharacterState | null;
  readonly error: string | null;
  readonly busy: boolean;
  /** API を呼んで結果を反映する。失敗したら error に入れる */
  readonly run: (call: () => Promise<ApiResult>) => Promise<void>;
  /** 送り出す。先に通知の許可を取っておく */
  readonly depart: (target: number, rations: number) => Promise<void>;
};

/** サーバーのキャラ状態を読み込み、行動の結果で更新する。冒険中は帰ってくるまで確認し続ける */
export const useCharacter = (api: CharacterApi): CharacterView => {
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previous = useRef<CharacterState | null>(null);

  const apply = useCallback((result: ApiResult): void => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const before = previous.current;
    const next = result.value;
    if (before?.phase.type === "exploring" && next.phase.type === "town") {
      void notifyReturn(next.lastExpedition?.outcome.status === "fainted");
    }
    previous.current = next;
    setError(null);
    setCharacter(next);
  }, []);

  const run = useCallback(
    async (call: () => Promise<ApiResult>) => {
      setBusy(true);
      apply(await call());
      setBusy(false);
    },
    [apply],
  );

  const depart = useCallback(
    async (target: number, rations: number) => {
      // 通知の許可を待っている間も押せないようにする（二重に送り出さないため）
      setBusy(true);
      await ensureNotificationPermission();
      apply(await api.explore(target, rations));
      setBusy(false);
    },
    [api, apply],
  );

  useEffect(() => {
    void api.fetchMe().then(apply);
  }, [api, apply]);

  const exploring = character?.phase.type === "exploring";
  useEffect(() => {
    if (!exploring) return;
    const timer = window.setInterval(() => void api.fetchMe().then(apply), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [api, apply, exploring]);

  return { character, error, busy, run, depart };
};
