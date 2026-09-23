import { z } from "zod";
import type { CharacterState } from "@sealight/sim";

// サーバーから届く CharacterState を検証する。sim の型と食い違うとコンパイルエラーになる

const point = z.object({ x: z.number(), y: z.number() });

const equipment = z.object({
  id: z.string(),
  slot: z.enum(["weapon", "armor"]),
  name: z.string(),
  rarity: z.enum(["common", "rare"]),
  power: z.number(),
  value: z.number(),
});

const stats = z.object({ str: z.number(), vit: z.number(), luk: z.number() });
const tactics = z.object({ potionThreshold: z.number(), priority: z.enum(["stairs", "treasure"]) });

const loot = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gold"), amount: z.number() }),
  z.object({ type: z.literal("item"), item: equipment }),
]);

const event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), to: point }),
  z.object({
    type: z.literal("encounter"),
    at: point,
    foe: z.object({ kind: z.enum(["slime", "goblin", "skeleton"]), name: z.string(), hp: z.number() }),
  }),
  z.object({ type: z.literal("attack"), by: z.enum(["player", "foe"]), damage: z.number(), hp: z.number() }),
  z.object({ type: z.literal("potion"), hp: z.number() }),
  z.object({ type: z.literal("victory"), xp: z.number() }),
  z.object({ type: z.literal("loot"), at: point, loot }),
  z.object({ type: z.literal("death"), at: point }),
  z.object({ type: z.literal("stairs"), at: point }),
]);

const lampResult = z.object({
  input: z.object({
    seed: z.number(),
    depth: z.number(),
    loadout: z.object({
      stats,
      hp: z.number(),
      potions: z.number(),
      weapon: equipment.nullable(),
      armor: equipment.nullable(),
    }),
    tactics,
  }),
  maze: z.object({
    width: z.number(),
    height: z.number(),
    cells: z.array(z.boolean()),
    start: point,
    stairs: point,
    treasures: z.array(point),
    monsters: z.array(point),
  }),
  events: z.array(event),
  outcome: z.object({
    status: z.enum(["survived", "dead"]),
    hp: z.number(),
    potions: z.number(),
    xp: z.number(),
    gold: z.number(),
    items: z.array(equipment),
  }),
});

const phase = z.discriminatedUnion("type", [
  z.object({ type: z.literal("town") }),
  z.object({
    type: z.literal("exploring"),
    depth: z.number(),
    seed: z.number(),
    startedAt: z.number(),
    endsAt: z.number(),
  }),
  z.object({ type: z.literal("camp"), depth: z.number() }),
]);

export const characterSchema: z.ZodType<CharacterState> = z.object({
  level: z.number(),
  xp: z.number(),
  unspentPoints: z.number(),
  stats,
  hp: z.number(),
  gold: z.number(),
  potions: z.number(),
  equipment: z.object({ weapon: equipment.nullable(), armor: equipment.nullable() }),
  stash: z.array(equipment),
  bag: z.object({ items: z.array(equipment), gold: z.number() }),
  tactics,
  phase,
  lastLamp: lampResult.nullable(),
  bestDepth: z.number(),
});

export const errorSchema = z.object({ error: z.string() });
