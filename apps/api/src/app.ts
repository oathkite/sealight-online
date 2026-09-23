import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { isShopSku, type RuleResult, type ShopSku } from "@sealight/sim";
import type { Action } from "./character";

// ソロ版の許可リスト。ブラウザ開発、Capacitor（Android / iOS）、Tauri。デプロイ先の画面を追加する
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://localhost",
  "capacitor://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
];

/** アカウントができるまでの仮の識別子。端末で生成した UUID をヘッダーで受け取る */
const characterIdSchema = z.uuid();
const durationSchema = z.coerce.number().int().positive();

const actionSchemas = {
  decide: z.object({ decision: z.enum(["descend", "stay", "return"]) }),
  stats: z.object({ stat: z.enum(["str", "vit", "luk"]) }),
  equip: z.object({ itemId: z.string().min(1).max(100) }),
  unequip: z.object({ slot: z.enum(["weapon", "armor"]) }),
  sell: z.object({ itemId: z.string().min(1).max(100) }),
  buy: z.object({ sku: z.custom<ShopSku>((v) => typeof v === "string" && isShopSku(v)) }),
  tactics: z.object({
    potionThreshold: z.number().int().min(0).max(100),
    priority: z.enum(["stairs", "treasure"]),
  }),
} as const;

type AppEnv = { Bindings: Env; Variables: { characterId: string } };

const stubOf = (c: Context<AppEnv>) => c.env.CHARACTER.get(c.env.CHARACTER.idFromName(c.get("characterId")));

const respond = (c: Context<AppEnv>, result: RuleResult) =>
  result.ok ? c.json(result.value) : c.json({ error: result.error }, 409);

const readBody = async <T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T | null> => {
  const json: unknown = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
};

/** 本文を検証して Action に変換し、キャラに渡す */
const actionRoute =
  <T>(schema: z.ZodType<T>, toAction: (body: T) => Action) =>
  async (c: Context<AppEnv>) => {
    const body = await readBody(c, schema);
    if (body === null) return c.json({ error: "invalid_body" }, 400);
    return respond(c, await stubOf(c).act(toAction(body)));
  };

export const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowHeaders: ["content-type", "x-character-id"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  }),
);

const requireCharacterId = createMiddleware<AppEnv>(async (c, next) => {
  const id = characterIdSchema.safeParse(c.req.header("x-character-id"));
  if (!id.success) return c.json({ error: "invalid_character_id" }, 400);
  c.set("characterId", id.data);
  await next();
});

app.use("/me", requireCharacterId);
app.use("/me/*", requireCharacterId);

app.get("/me", async (c) => c.json(await stubOf(c).state()));

app.post("/me/lamp", async (c) => {
  const duration = durationSchema.safeParse(c.env.LAMP_DURATION_MS);
  if (!duration.success) return c.json({ error: "server_misconfigured" }, 500);
  return respond(c, await stubOf(c).startLamp(duration.data));
});

app.post("/me/decide", actionRoute(actionSchemas.decide, (b) => ({ type: "decide", decision: b.decision })));
app.post("/me/stats", actionRoute(actionSchemas.stats, (b) => ({ type: "allocate", stat: b.stat })));
app.post("/me/equip", actionRoute(actionSchemas.equip, (b) => ({ type: "equip", itemId: b.itemId })));
app.post("/me/unequip", actionRoute(actionSchemas.unequip, (b) => ({ type: "unequip", slot: b.slot })));
app.post("/me/sell", actionRoute(actionSchemas.sell, (b) => ({ type: "sell", itemId: b.itemId })));
app.post("/me/buy", actionRoute(actionSchemas.buy, (b) => ({ type: "buy", sku: b.sku })));
app.put("/me/tactics", actionRoute(actionSchemas.tactics, (b) => ({ type: "tactics", tactics: b })));
