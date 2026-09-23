import { z } from "zod";
import type { LampResult } from "@sealight/sim";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

const pointSchema = z.object({ x: z.number(), y: z.number() });
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), to: pointSchema }),
  z.object({ type: z.literal("treasure"), at: pointSchema }),
  z.object({ type: z.literal("stairs"), at: pointSchema }),
]);
const resultSchema = z.object({
  input: z.object({
    seed: z.number(),
    width: z.number(),
    height: z.number(),
    treasureCount: z.number().exactOptional(),
  }),
  maze: z.object({
    width: z.number(),
    height: z.number(),
    cells: z.array(z.boolean()),
    start: pointSchema,
    stairs: pointSchema,
    treasures: z.array(pointSchema),
  }),
  events: z.array(eventSchema),
});

const runningSchema = z.object({ status: z.literal("running"), endsAt: z.number() });
const startedSchema = runningSchema.extend({ id: z.uuid() });
const stateSchema = z.discriminatedUnion("status", [
  runningSchema,
  z.object({ status: z.literal("done"), endsAt: z.number(), result: resultSchema }),
]);

export type StartedLamp = { readonly id: string; readonly endsAt: number };
export type LampStatus =
  | { readonly status: "running"; readonly endsAt: number }
  | { readonly status: "done"; readonly endsAt: number; readonly result: LampResult };

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

const request = async <T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<ApiResult<T>> => {
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_response" };
  } catch {
    return { ok: false, error: "network_error" };
  }
};

export const startLamp = (): Promise<ApiResult<StartedLamp>> =>
  request("/lamps", startedSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

export const fetchLamp = (id: string): Promise<ApiResult<LampStatus>> => request(`/lamps/${id}`, stateSchema);
