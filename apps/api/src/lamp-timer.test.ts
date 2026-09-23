import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const stubFor = (name: string) => env.LAMP_TIMER.get(env.LAMP_TIMER.idFromName(name));

describe("LampTimer", () => {
  it("開始すると終了時刻にアラームを設定する", async () => {
    const stub = stubFor("alarm-set");
    const started = await stub.start(1, 30_000);
    const alarm = await runInDurableObject(stub, (_, state) => state.storage.getAlarm());
    expect(started).toMatchObject({ ok: true, value: { status: "running", endsAt: alarm } });
  });

  it("同じ灯を二重に開始できない", async () => {
    const stub = stubFor("double-start");
    await stub.start(1, 30_000);
    const second = await stub.start(2, 30_000);
    expect(second).toEqual({ ok: false, error: "already_started" });
  });

  it("開始前は idle", async () => {
    expect(await stubFor("never-started").state()).toEqual({ status: "idle" });
  });

  it("アラームが複数回走っても結果は変わらない", async () => {
    const stub = stubFor("idempotent");
    await stub.start(99, 30_000);
    await runDurableObjectAlarm(stub);
    const first = await stub.state();
    await runInDurableObject(stub, (instance) => instance.alarm());
    expect(await stub.state()).toEqual(first);
  });
});
