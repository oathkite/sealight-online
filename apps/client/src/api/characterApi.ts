import type { CharacterState, Decision, ShopSku, Slot, StatKey, Tactics } from "@sealight/sim";
import { characterSchema, errorSchema } from "./schema";

// 本番は画面と API を同じ Worker から配信するので相対パスで呼ぶ。
// 開発中は Vite が /me を wrangler dev に中継する。別の場所の API を使うときだけ VITE_API_URL を指定する
const API_URL: string = import.meta.env.VITE_API_URL ?? "";

export type ApiResult = { readonly ok: true; readonly value: CharacterState } | { readonly ok: false; readonly error: string };

export type CharacterApi = {
  readonly fetchMe: () => Promise<ApiResult>;
  readonly startLamp: () => Promise<ApiResult>;
  readonly decide: (decision: Decision) => Promise<ApiResult>;
  readonly allocate: (stat: StatKey) => Promise<ApiResult>;
  readonly equip: (itemId: string) => Promise<ApiResult>;
  readonly unequip: (slot: Slot) => Promise<ApiResult>;
  readonly sell: (itemId: string) => Promise<ApiResult>;
  readonly buy: (sku: ShopSku) => Promise<ApiResult>;
  readonly setTactics: (tactics: Tactics) => Promise<ApiResult>;
};

const parseResponse = async (res: Response): Promise<ApiResult> => {
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const error = errorSchema.safeParse(json);
    return { ok: false, error: error.success ? error.data.error : `http_${res.status}` };
  }
  const parsed = characterSchema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_response" };
};

/** キャラ ID をヘッダーに付けて API を呼ぶクライアントを作る */
export const createCharacterApi = (characterId: string, baseUrl: string = API_URL): CharacterApi => {
  const call = async (method: string, path: string, body?: unknown): Promise<ApiResult> => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "x-character-id": characterId, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return await parseResponse(res);
    } catch {
      return { ok: false, error: "network_error" };
    }
  };

  return {
    fetchMe: () => call("GET", "/me"),
    startLamp: () => call("POST", "/me/explore"),
    decide: (decision) => call("POST", "/me/decide", { decision }),
    allocate: (stat) => call("POST", "/me/stats", { stat }),
    equip: (itemId) => call("POST", "/me/equip", { itemId }),
    unequip: (slot) => call("POST", "/me/unequip", { slot }),
    sell: (itemId) => call("POST", "/me/sell", { itemId }),
    buy: (sku) => call("POST", "/me/buy", { sku }),
    setTactics: (tactics) => call("PUT", "/me/tactics", tactics),
  };
};
