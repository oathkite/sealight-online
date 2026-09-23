import { DurableObject } from "cloudflare:workers";
import { simulateLamp, STANDARD_FLOOR, type LampResult } from "@sealight/sim";

type LampRecord = {
  readonly seed: number;
  readonly startedAt: number;
  readonly endsAt: number;
  readonly result?: LampResult;
};

export type LampState =
  | { readonly status: "idle" }
  | { readonly status: "running"; readonly seed: number; readonly startedAt: number; readonly endsAt: number }
  | {
      readonly status: "done";
      readonly seed: number;
      readonly startedAt: number;
      readonly endsAt: number;
      readonly result: LampResult;
    };

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

const KEY = "lamp";

const toState = (record: LampRecord | undefined): LampState => {
  if (!record) return { status: "idle" };
  const { seed, startedAt, endsAt, result } = record;
  return result ? { status: "done", seed, startedAt, endsAt, result } : { status: "running", seed, startedAt, endsAt };
};

/**
 * 1灯を 1 インスタンスで管理する。
 * 開始時に終了時刻のアラームを設定し、アラームで探索結果を確定して保存する。
 */
export class LampTimer extends DurableObject<Env> {
  async start(seed: number, durationMs: number): Promise<Result<LampState, "already_started">> {
    const existing = await this.ctx.storage.get<LampRecord>(KEY);
    if (existing) return { ok: false, error: "already_started" };

    const startedAt = Date.now();
    const record: LampRecord = { seed, startedAt, endsAt: startedAt + durationMs };
    await this.ctx.storage.put(KEY, record);
    await this.ctx.storage.setAlarm(record.endsAt);
    return { ok: true, value: toState(record) };
  }

  async state(): Promise<LampState> {
    return toState(await this.ctx.storage.get<LampRecord>(KEY));
  }

  override async alarm(): Promise<void> {
    const record = await this.ctx.storage.get<LampRecord>(KEY);
    if (!record || record.result) return;
    const result = simulateLamp({ seed: record.seed, ...STANDARD_FLOOR });
    await this.ctx.storage.put(KEY, { ...record, result });
  }
}
