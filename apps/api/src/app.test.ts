import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { completeLamp, type CharacterState } from "@sealight/sim";

type Body = Record<string, unknown>;

const client = (id: string = crypto.randomUUID()) => {
  const call = async (method: string, path: string, body?: Body) => {
    const res = await exports.default.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: { "x-character-id": id, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    return { status: res.status, json: (await res.json()) as CharacterState & { error?: string } };
  };
  const stub = () => env.CHARACTER.get(env.CHARACTER.idFromName(id));
  return { id, call, stub };
};

/** 終了時刻を過去にずらす（25 分待つ代わり） */
const expire = (c: ReturnType<typeof client>) =>
  runInDurableObject(c.stub(), async (_, state) => {
    const current = await state.storage.get<CharacterState>("state");
    if (current?.phase.type === "exploring") {
      await state.storage.put("state", { ...current, phase: { ...current.phase, endsAt: Date.now() - 1 } });
    }
  });

/** 探索を始め、終了時刻を過ぎたものとしてアラームを発火させ、結果を反映させる */
const runLamp = async (c: ReturnType<typeof client>) => {
  const started = await c.call("POST", "/me/explore");
  expect(started.status).toBe(200);
  await expire(c);
  expect(await runDurableObjectAlarm(c.stub())).toBe(true);
  return c.call("GET", "/me");
};

/** 強いキャラにして、必ず生き残るようにする */
const makeStrong = (c: ReturnType<typeof client>) =>
  runInDurableObject(c.stub(), async (_, state) => {
    const current = await state.storage.get<CharacterState>("state");
    if (!current) throw new Error("character not created");
    await state.storage.put("state", { ...current, stats: { str: 30, vit: 30, luk: 0 }, hp: 200 });
  });

describe("認証の代わりのキャラ ID", () => {
  it("ヘッダーがなければ 400", async () => {
    const res = await exports.default.fetch(new Request("https://api.test/me"));
    expect(res.status).toBe(400);
  });

  it("UUID でなければ 400", async () => {
    expect((await client("not-a-uuid").call("GET", "/me")).status).toBe(400);
  });
});

describe("GET /me", () => {
  it("初回は新しいキャラを作って街にいる", async () => {
    const { status, json } = await client().call("GET", "/me");
    expect(status).toBe(200);
    expect(json.phase).toEqual({ type: "town" });
    expect(json.level).toBe(1);
  });
});

describe("探索", () => {
  it("開始すると探索中になり、終了時刻が決まる", async () => {
    const { json } = await client().call("POST", "/me/explore");
    expect(json.phase.type).toBe("exploring");
    if (json.phase.type === "exploring") {
      expect(json.phase.endsAt - json.phase.startedAt).toBe(Number(env.LAMP_DURATION_MS));
    }
  });

  it("探索中にもう一度始めると 409", async () => {
    const c = client();
    await c.call("POST", "/me/explore");
    const again = await c.call("POST", "/me/explore");
    expect(again.status).toBe(409);
    expect(again.json.error).toBe("not_in_town");
  });

  it("アラームで結果が確定し、sim で同じ状態から計算した結果と一致する", async () => {
    const c = client();
    await c.call("GET", "/me");
    await makeStrong(c);
    const started = await c.call("POST", "/me/explore");
    await expire(c);
    await runDurableObjectAlarm(c.stub());
    const { json } = await c.call("GET", "/me");

    const expected = completeLamp(started.json);
    expect(expected.ok && json).toEqual(expected.ok ? expected.value : null);
    expect(json.phase).toEqual({ type: "camp", depth: 1 });
  });

  it("探索中に判断すると 409", async () => {
    const c = client();
    await c.call("POST", "/me/explore");
    const res = await c.call("POST", "/me/decide", { decision: "descend" });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("not_in_camp");
  });
});

describe("POST /me/decide", () => {
  it("帰還すると持ち物が倉庫に移る", async () => {
    const c = client();
    await c.call("GET", "/me");
    await makeStrong(c);
    const camp = (await runLamp(c)).json;
    const { json } = await c.call("POST", "/me/decide", { decision: "return" });
    expect(json.phase).toEqual({ type: "town" });
    expect(json.stash).toEqual([...camp.stash, ...camp.bag.items]);
  });

  it("進むと、その場で次の階の探索が始まり、終了時刻にアラームが設定される", async () => {
    const c = client();
    await c.call("GET", "/me");
    await makeStrong(c);
    await runLamp(c);
    const { json } = await c.call("POST", "/me/decide", { decision: "descend" });
    expect(json.phase.type === "exploring" && json.phase.depth).toBe(2);
    const alarm = await runInDurableObject(c.stub(), (_, state) => state.storage.getAlarm());
    expect(json.phase.type === "exploring" && json.phase.endsAt).toBe(alarm);
  });

  it("不正な判断は 400", async () => {
    expect((await client().call("POST", "/me/decide", { decision: "fly" })).status).toBe(400);
  });
});

describe("街での行動", () => {
  it("ステータスを割り振れる", async () => {
    const { json } = await client().call("POST", "/me/stats", { stat: "str" });
    expect(json.stats.str).toBe(3);
  });

  it("ポーションを買える", async () => {
    const { json } = await client().call("POST", "/me/buy", { sku: "potion" });
    expect(json.potions).toBe(3);
  });

  it("装備を買うと一意な ID で倉庫に入り、身につけられる", async () => {
    const c = client();
    await c.call("GET", "/me");
    await runInDurableObject(c.stub(), async (_, state) => {
      const current = await state.storage.get<CharacterState>("state");
      if (current) await state.storage.put("state", { ...current, gold: 500 });
    });
    const bought = (await c.call("POST", "/me/buy", { sku: "iron-sword" })).json;
    const item = bought.stash.at(-1);
    expect(item?.name).toBe("鉄の剣");
    const equipped = (await c.call("POST", "/me/equip", { itemId: item?.id })).json;
    expect(equipped.equipment.weapon?.id).toBe(item?.id);
  });

  it("存在しない商品は 400", async () => {
    expect((await client().call("POST", "/me/buy", { sku: "dragon" })).status).toBe(400);
  });

  it("お金が足りなければ 409", async () => {
    const res = await client().call("POST", "/me/buy", { sku: "steel-sword" });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("not_enough_gold");
  });

  it("作戦を変えられる。範囲外の値は 400", async () => {
    const c = client();
    const { json } = await c.call("PUT", "/me/tactics", { potionThreshold: 50, priority: "treasure" });
    expect(json.tactics).toEqual({ potionThreshold: 50, priority: "treasure" });
    expect((await c.call("PUT", "/me/tactics", { potionThreshold: 101, priority: "treasure" })).status).toBe(400);
  });
});

describe("アラームの遅れへの備え", () => {
  it("終了時刻より前に古いアラームが届いても、探索は確定せずアラームを設定し直す", async () => {
    const c = client();
    const { json } = await c.call("POST", "/me/explore");
    const endsAt = json.phase.type === "exploring" ? json.phase.endsAt : 0;
    await runInDurableObject(c.stub(), (instance) => instance.alarm());
    const after = await c.call("GET", "/me");
    expect(after.json.phase.type).toBe("exploring");
    expect(await runInDurableObject(c.stub(), (_, state) => state.storage.getAlarm())).toBe(endsAt);
  });

  it("終了時刻を過ぎていれば、取得時にその場で結果を確定する", async () => {
    const c = client();
    await c.call("POST", "/me/explore");
    await expire(c);
    const { json } = await c.call("GET", "/me");
    expect(json.phase.type).not.toBe("exploring");
    expect(json.lastLamp).not.toBeNull();
  });
});
