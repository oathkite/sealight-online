import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { simulateExpedition, STATE_VERSION, type CharacterState, type ExpeditionResult } from "@sealight/sim";

type Body = Record<string, unknown>;
type Pending = { readonly endsAt: number; readonly result: ExpeditionResult };

const client = (id: string = crypto.randomUUID()) => {
  const call = async (method: string, path: string, body?: Body) => {
    const res = await exports.default.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: { "x-character-id": id, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text) as CharacterState & { error?: string } };
  };
  const stub = () => env.CHARACTER.get(env.CHARACTER.idFromName(id));
  return { id, call, stub };
};

type Client = ReturnType<typeof client>;

const patchState = (c: Client, patch: Partial<CharacterState>) =>
  runInDurableObject(c.stub(), async (_, state) => {
    const current = await state.storage.get<CharacterState>("state");
    if (!current) throw new Error("character not created");
    await state.storage.put("state", { ...current, ...patch });
  });

const pendingOf = (c: Client) => runInDurableObject(c.stub(), (_, state) => state.storage.get<Pending>("pending"));

/** 帰る時刻を過去にずらす（実際に待つ代わり） */
const expire = (c: Client) =>
  runInDurableObject(c.stub(), async (_, state) => {
    const pending = await state.storage.get<Pending>("pending");
    if (pending) await state.storage.put("pending", { ...pending, endsAt: Date.now() - 1 });
  });

const strongCharacter = async (c: Client) => {
  await c.call("GET", "/me");
  await patchState(c, { stats: { str: 30, vit: 30, luk: 0 } });
};

describe("キャラ ID", () => {
  it("ヘッダーがないか UUID でなければ 400", async () => {
    expect((await exports.default.fetch(new Request("https://api.test/me"))).status).toBe(400);
    expect((await client("not-a-uuid").call("GET", "/me")).status).toBe(400);
  });
});

describe("GET /me", () => {
  it("初回は新しいキャラを作って街にいる", async () => {
    const { status, json } = await client().call("GET", "/me");
    expect(status).toBe(200);
    expect(json.version).toBe(STATE_VERSION);
    expect(json.phase).toEqual({ type: "town" });
  });

  it("古い形式で保存されたキャラは作り直す", async () => {
    const c = client();
    await runInDurableObject(c.stub(), (_, state) => state.storage.put("state", { level: 5, phase: { type: "camp" } }));
    const { json } = await c.call("GET", "/me");
    expect(json.version).toBe(STATE_VERSION);
    expect(json.level).toBe(1);
  });
});

describe("POST /me/explore", () => {
  it("送り出すと冒険中になり、帰る時刻と結果はレスポンスに含まれない", async () => {
    const c = client();
    await strongCharacter(c);
    const { status, json, text } = await c.call("POST", "/me/explore", { target: 2, rations: 3 });
    expect(status).toBe(200);
    expect(json.phase.type).toBe("exploring");
    expect(text).not.toContain("endsAt");
    expect(text).not.toContain("durationSec");
    expect(text).not.toContain("events");
    const again = await c.call("GET", "/me");
    expect(again.text).not.toContain("endsAt");
  });

  it("冒険中にもう一度送り出すと 409", async () => {
    const c = client();
    await c.call("POST", "/me/explore", { target: 1, rations: 1 });
    const again = await c.call("POST", "/me/explore", { target: 1, rations: 1 });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe("not_in_town");
  });

  it("目標や食料の数が不正なら 400、持っている以上の食料は 409", async () => {
    const c = client();
    expect((await c.call("POST", "/me/explore", { target: 0, rations: 1 })).status).toBe(400);
    expect((await c.call("POST", "/me/explore", { target: 21, rations: 1 })).status).toBe(400);
    expect((await c.call("POST", "/me/explore", { target: 1, rations: -1 })).status).toBe(400);
    const tooMany = await c.call("POST", "/me/explore", { target: 1, rations: 12 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.json.error).toBe("not_enough_rations");
  });

  it("帰る時刻を過ぎると結果が反映され、保存したシードで sim を動かした結果と一致する", async () => {
    const c = client();
    await strongCharacter(c);
    await c.call("POST", "/me/explore", { target: 2, rations: 3 });
    const pending = await pendingOf(c);
    await expire(c);
    const { json } = await c.call("GET", "/me");
    expect(json.phase).toEqual({ type: "town" });
    expect(pending && json.lastExpedition).toEqual(pending ? simulateExpedition(pending.result.input) : null);
  });

  it("アラームで結果が反映される。帰る時刻より前に届いた古いアラームでは反映しない", async () => {
    const c = client();
    await strongCharacter(c);
    await c.call("POST", "/me/explore", { target: 1, rations: 2 });
    await runInDurableObject(c.stub(), (instance) => instance.alarm());
    expect((await c.call("GET", "/me")).json.phase.type).toBe("exploring");
    const pending = await pendingOf(c);
    expect(await runInDurableObject(c.stub(), (_, state) => state.storage.getAlarm())).toBe(pending?.endsAt);

    await expire(c);
    expect(await runDurableObjectAlarm(c.stub())).toBe(true);
    const { json } = await c.call("GET", "/me");
    expect(json.phase.type).toBe("town");
    expect(await pendingOf(c)).toBeUndefined();
  });
});

describe("街での行動", () => {
  it("ステータスを割り振れる", async () => {
    expect((await client().call("POST", "/me/stats", { stat: "str" })).json.stats.str).toBe(3);
  });

  it("食料とポーションを買える。存在しない商品は 400、お金が足りなければ 409", async () => {
    const c = client();
    expect((await c.call("POST", "/me/buy", { sku: "ration" })).json.rations).toBe(9);
    expect((await c.call("POST", "/me/buy", { sku: "potion" })).json.potions).toBe(3);
    expect((await c.call("POST", "/me/buy", { sku: "dragon" })).status).toBe(400);
    const expensive = await c.call("POST", "/me/buy", { sku: "steel-sword" });
    expect(expensive.status).toBe(409);
    expect(expensive.json.error).toBe("not_enough_gold");
  });

  it("食料とポーションはまとめて買える。数が範囲外なら 400、装備を 2 つ以上なら 409", async () => {
    const c = client();
    await c.call("GET", "/me");
    await patchState(c, { gold: 1000 });
    expect((await c.call("POST", "/me/buy", { sku: "ration", quantity: 10 })).json.rations).toBe(18);
    expect((await c.call("POST", "/me/buy", { sku: "ration", quantity: 0 })).status).toBe(400);
    expect((await c.call("POST", "/me/buy", { sku: "ration", quantity: 100 })).status).toBe(400);
    expect((await c.call("POST", "/me/buy", { sku: "ration", quantity: "5" })).status).toBe(400);
    const two = await c.call("POST", "/me/buy", { sku: "iron-sword", quantity: 2 });
    expect(two.status).toBe(409);
    expect(two.json.error).toBe("invalid_quantity");
  });

  it("買った装備は一意な ID で倉庫に入り、身につけられる", async () => {
    const c = client();
    await c.call("GET", "/me");
    await patchState(c, { gold: 500 });
    const item = (await c.call("POST", "/me/buy", { sku: "iron-sword" })).json.stash.at(-1);
    const equipped = (await c.call("POST", "/me/equip", { itemId: item?.id })).json;
    expect(equipped.equipment.weapon?.id).toBe(item?.id);
  });

  it("作戦を変えられる。範囲外の値は 400", async () => {
    const c = client();
    expect((await c.call("PUT", "/me/tactics", { potionThreshold: 50 })).json.tactics).toEqual({ potionThreshold: 50 });
    expect((await c.call("PUT", "/me/tactics", { potionThreshold: 101 })).status).toBe(400);
  });

  it("留守の間も買い物はできるが、装備は変えられない", async () => {
    const c = client();
    await c.call("POST", "/me/explore", { target: 1, rations: 1 });
    expect((await c.call("POST", "/me/buy", { sku: "ration" })).status).toBe(200);
    const equip = await c.call("POST", "/me/unequip", { slot: "weapon" });
    expect(equip.status).toBe(409);
    expect(equip.json.error).toBe("not_in_town");
  });
});
