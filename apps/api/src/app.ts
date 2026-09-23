import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

// POC 用の許可リスト。ブラウザ開発、Capacitor（Android / iOS）、Tauri
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://localhost",
  "capacitor://localhost",
  "tauri://localhost",
  "http://tauri.localhost",
];

const startBodySchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff).optional(),
});
const lampIdSchema = z.uuid();
const durationSchema = z.coerce.number().int().positive();

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;

const lampStub = (env: Env, id: string) => env.LAMP_TIMER.get(env.LAMP_TIMER.idFromName(id));

export const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: ALLOWED_ORIGINS }));

app.post("/lamps", async (c) => {
  const json: unknown = await c.req.json().catch(() => undefined);
  const body = startBodySchema.safeParse(json);
  if (!body.success) return c.json({ error: "invalid_body" }, 400);

  const duration = durationSchema.safeParse(c.env.LAMP_DURATION_MS);
  if (!duration.success) return c.json({ error: "server_misconfigured" }, 500);

  const id = crypto.randomUUID();
  const started = await lampStub(c.env, id).start(body.data.seed ?? randomSeed(), duration.data);
  if (!started.ok) return c.json({ error: started.error }, 409);
  return c.json({ id, ...started.value }, 201);
});

app.get("/lamps/:id", async (c) => {
  const id = lampIdSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "invalid_id" }, 400);

  const state = await lampStub(c.env, id.data).state();
  if (state.status === "idle") return c.json({ error: "not_found" }, 404);
  return c.json(state);
});
