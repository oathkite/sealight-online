import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { simulateLamp, STANDARD_FLOOR } from "@sealight/sim";

const request = (path: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(`https://api.test${path}`, init));

const startLamp = (body: unknown): Promise<Response> =>
  request("/lamps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

type Started = { readonly id: string; readonly status: string; readonly seed: number; readonly endsAt: number; readonly startedAt: number };

describe("POST /lamps", () => {
  it("灯を開始し、終了予定時刻を返す", async () => {
    const res = await startLamp({ seed: 42 });
    expect(res.status).toBe(201);
    const body = await res.json<Started>();
    expect(body.status).toBe("running");
    expect(body.seed).toBe(42);
    expect(body.endsAt - body.startedAt).toBe(Number(env.LAMP_DURATION_MS));
  });

  it("シードを省略するとサーバーが決める", async () => {
    const body = await (await startLamp({})).json<Started>();
    expect(Number.isInteger(body.seed)).toBe(true);
  });

  it("不正なシードは 400 を返す", async () => {
    expect((await startLamp({ seed: -1 })).status).toBe(400);
    expect((await startLamp({ seed: 1.5 })).status).toBe(400);
    expect((await startLamp({ seed: "abc" })).status).toBe(400);
  });

  it("JSON でない本文は 400 を返す", async () => {
    const res = await request("/lamps", { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
  });
});

describe("GET /lamps/:id", () => {
  it("終了前は running を返す", async () => {
    const { id } = await (await startLamp({ seed: 7 })).json<Started>();
    const body = await (await request(`/lamps/${id}`)).json<{ status: string }>();
    expect(body.status).toBe("running");
  });

  it("アラーム後は、同じシードをローカルで計算した結果と完全に一致する", async () => {
    const { id } = await (await startLamp({ seed: 1234 })).json<Started>();
    const ran = await runDurableObjectAlarm(env.LAMP_TIMER.get(env.LAMP_TIMER.idFromName(id)));
    expect(ran).toBe(true);

    const body = await (await request(`/lamps/${id}`)).json<{ status: string; result: unknown }>();
    expect(body.status).toBe("done");
    expect(body.result).toEqual(simulateLamp({ seed: 1234, ...STANDARD_FLOOR }));
  });

  it("存在しない灯は 404 を返す", async () => {
    const res = await request(`/lamps/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it("UUID でない ID は 400 を返す", async () => {
    expect((await request("/lamps/not-a-uuid")).status).toBe(400);
  });
});
