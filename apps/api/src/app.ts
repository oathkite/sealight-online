import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { isShopSku, MAX_BUY, MAX_DEPTH, PACE, type RuleResult, type ShopSku } from "@sealight/sim";
import type { Action } from "./character";

// 同じ Worker から配信する画面は同一オリジンなので不要。Tauri / Capacitor から呼ぶときのための許可リスト
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://localhost",
  "capacitor://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
];

/** アカウントができるまでの仮の識別子。端末で生成した UUID をヘッダーで受け取る */
const characterIdSchema = z.uuid();
const timeScaleSchema = z.coerce.number().positive();

const schemas = {
  explore: z.object({
    target: z.number().int().min(1).max(MAX_DEPTH),
    rations: z.number().int().min(0).max(PACE.bagCapacity),
    potions: z.number().int().min(0).max(PACE.bagCapacity),
  }),
  stats: z.object({ stat: z.enum(["str", "vit", "luk"]) }),
  equip: z.object({ itemId: z.string().min(1).max(100) }),
  unequip: z.object({ slot: z.enum(["weapon", "armor"]) }),
  sell: z.object({ itemId: z.string().min(1).max(100) }),
  buy: z.object({
    sku: z.custom<ShopSku>((v) => typeof v === "string" && isShopSku(v)),
    quantity: z.number().int().min(1).max(MAX_BUY).default(1),
  }),
  tactics: z.object({ potionThreshold: z.number().int().min(0).max(100) }),
  forge: z.object({ targetId: z.string().min(1).max(100), materialId: z.string().min(1).max(100) }),
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

app.post("/me/explore", async (c) => {
  const timeScale = timeScaleSchema.safeParse(c.env.TIME_SCALE);
  if (!timeScale.success) return c.json({ error: "server_misconfigured" }, 500);
  const body = await readBody(c, schemas.explore);
  if (body === null) return c.json({ error: "invalid_body" }, 400);
  return respond(c, await stubOf(c).explore(body, timeScale.data));
});

app.post("/me/stats", actionRoute(schemas.stats, (b) => ({ type: "allocate", stat: b.stat })));
app.post("/me/equip", actionRoute(schemas.equip, (b) => ({ type: "equip", itemId: b.itemId })));
app.post("/me/unequip", actionRoute(schemas.unequip, (b) => ({ type: "unequip", slot: b.slot })));
app.post("/me/sell", actionRoute(schemas.sell, (b) => ({ type: "sell", itemId: b.itemId })));
app.post("/me/buy", actionRoute(schemas.buy, (b) => ({ type: "buy", sku: b.sku, quantity: b.quantity })));
app.post("/me/forge", actionRoute(schemas.forge, (b) => ({ type: "forge", targetId: b.targetId, materialId: b.materialId })));
app.put("/me/tactics", actionRoute(schemas.tactics, (b) => ({ type: "tactics", tactics: b })));
