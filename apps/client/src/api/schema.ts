import { z } from "zod";
import type { CharacterState } from "@sealight/sim";

// サーバーから届く CharacterState を検証する。sim の型と食い違うとコンパイルエラーになる

const equipment = z.object({
  id: z.string(),
  slot: z.enum(["weapon", "armor"]),
  name: z.string(),
  rarity: z.enum(["common", "rare"]),
  power: z.number(),
  value: z.number(),
  affix: z.enum(["pierce", "sweep", "guard", "evade"]).nullable(),
  forged: z.number(),
});

const stats = z.object({ str: z.number(), vit: z.number(), luk: z.number() });
const maps = z.array(z.array(z.number()));
const foeKind = z.enum(["slime", "rat", "goblin", "beetle", "skeleton", "ogre", "wraith", "golem", "glowSlime"]);
const trait = z.enum(["swarm", "armored", "heavy", "fast"]);
const source = z.enum(["chest", "drop", "goal"]);

const loot = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gold"), amount: z.number() }),
  z.object({ type: z.literal("item"), item: equipment }),
]);

const at = { t: z.number(), depth: z.number() };

const event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("floor"), ...at, direction: z.enum(["down", "up"]), hp: z.number(), rations: z.number() }),
  z.object({
    type: z.literal("encounter"),
    ...at,
    foe: z.object({ kind: foeKind, name: z.string(), hp: z.number(), traits: z.array(trait), rare: z.boolean() }),
    hp: z.number(),
  }),
  z.object({ type: z.literal("attack"), by: z.enum(["player", "foe"]), damage: z.number(), hp: z.number() }),
  z.object({ type: z.literal("potion"), hp: z.number() }),
  z.object({ type: z.literal("victory"), xp: z.number() }),
  z.object({ type: z.literal("loot"), ...at, source, loot }),
  z.object({ type: z.literal("bagFull"), ...at, source, item: equipment }),
  z.object({ type: z.literal("eat"), ...at, rationsLeft: z.number() }),
  z.object({ type: z.literal("starving"), ...at }),
  z.object({ type: z.literal("turnaround"), ...at }),
  z.object({ type: z.literal("death"), ...at, cause: z.enum(["battle", "hunger"]) }),
  z.object({ type: z.literal("home"), t: z.number(), hp: z.number() }),
]);

const expeditionResult = z.object({
  input: z.object({
    seed: z.number(),
    target: z.number(),
    loadout: z.object({
      level: z.number(),
      stats,
      potions: z.number(),
      rations: z.number(),
      weapon: equipment.nullable(),
      armor: equipment.nullable(),
    }),
    maps,
    potionThreshold: z.number(),
  }),
  events: z.array(event),
  outcome: z.object({
    status: z.enum(["returned", "fainted"]),
    reached: z.number(),
    hp: z.number(),
    maxHp: z.number(),
    potions: z.number(),
    rations: z.number(),
    xp: z.number(),
    gold: z.number(),
    items: z.array(equipment),
    durationSec: z.number(),
    maps,
  }),
});

const phase = z.discriminatedUnion("type", [
  z.object({ type: z.literal("town") }),
  z.object({
    type: z.literal("exploring"),
    target: z.number(),
    startedAt: z.number(),
    estimate: z.object({
      minMs: z.number(),
      maxMs: z.number(),
      reaction: z.enum(["eager", "calm", "nervous", "scared"]),
    }),
  }),
]);

export const characterSchema: z.ZodType<CharacterState> = z.object({
  version: z.literal(6),
  level: z.number(),
  xp: z.number(),
  unspentPoints: z.number(),
  stats,
  gold: z.number(),
  potions: z.number(),
  rations: z.number(),
  equipment: z.object({ weapon: equipment.nullable(), armor: equipment.nullable() }),
  stash: z.array(equipment),
  tactics: z.object({ potionThreshold: z.number() }),
  maps,
  phase,
  lastExpedition: expeditionResult.nullable(),
  bestDepth: z.number(),
  clearedDepth: z.number(),
});

export const errorSchema = z.object({ error: z.string() });
