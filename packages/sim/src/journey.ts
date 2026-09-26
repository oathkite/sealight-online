import { stow } from "./bag";
import { swarmSize, type Foe } from "./catalog";
import { resolveBattle, type Combatant } from "./combat";
import {
  PACE,
  type ExpeditionEvent,
  type ExpeditionInput,
  type ExpeditionOutcome,
  type LootSource,
  type MapKnowledge,
} from "./expedition-types";
import { affixesOf, attackFor, defenseFor, maxHpFor } from "./fighter";
import { scaledXp } from "./growth";
import type { Equipment } from "./items";
import { rollDrop, rollLoot } from "./loot";
import type { Rng } from "./rng";

/** 冒険 1 回ぶんの途中経過。以下の関数で更新していき、最後に outcome にまとめる */
type JourneyState = {
  readonly input: ExpeditionInput;
  readonly rng: Rng;
  readonly events: ExpeditionEvent[];
  readonly items: Equipment[];
  /** 荷物の装備をどこで拾ったか。入れ替えで置いてくるときの記録に使う */
  readonly sources: Map<string, LootSource>;
  me: Combatant;
  t: number;
  xp: number;
  gold: number;
  rations: number;
  movesSinceMeal: number;
  hungryMoves: number;
  starving: boolean;
  dead: boolean;
  reached: number;
};

const initialState = (input: ExpeditionInput, rng: Rng): JourneyState => {
  const { stats, weapon, armor, potions, rations } = input.loadout;
  const maxHp = maxHpFor(stats);
  return {
    input,
    rng,
    events: [],
    items: [],
    sources: new Map(),
    me: {
      hp: maxHp,
      maxHp,
      attack: attackFor(stats, weapon),
      defense: defenseFor(stats, armor),
      potions,
      affixes: affixesOf(weapon, armor),
    },
    t: 0,
    xp: 0,
    gold: 0,
    rations,
    movesSinceMeal: 0,
    hungryMoves: 0,
    starving: false,
    dead: false,
    reached: 0,
  };
};

const die = (s: JourneyState, depth: number, cause: "battle" | "hunger"): void => {
  s.dead = true;
  s.events.push({ type: "death", t: s.t, depth, cause });
};

/** 食料が尽きるまでは一定歩数ごとに食べ、尽きたら一定歩数ごとに HP が減る */
const digest = (s: JourneyState, depth: number): void => {
  s.movesSinceMeal += 1;
  if (s.movesSinceMeal < PACE.movesPerRation) return;
  if (s.rations > 0) {
    s.rations -= 1;
    s.movesSinceMeal = 0;
    s.events.push({ type: "eat", t: s.t, depth, rationsLeft: s.rations });
    return;
  }
  if (!s.starving) {
    s.starving = true;
    s.events.push({ type: "starving", t: s.t, depth });
  }
  s.hungryMoves += 1;
  if (s.hungryMoves % PACE.hungerEveryMoves !== 0) return;
  s.me = { ...s.me, hp: Math.max(0, s.me.hp - 1) };
  if (s.me.hp === 0) die(s, depth, "hunger");
};

/** 荷物に入れる。食料、ポーション、装備で枠を分け合い、いっぱいなら弱い方の装備を置いてくる */
const pick = (s: JourneyState, depth: number, source: LootSource, item: Equipment): void => {
  const { bag, left } = stow(s.items, item, PACE.bagCapacity - s.items.length - s.rations - s.me.potions);
  s.items.splice(0, s.items.length, ...bag);
  s.sources.set(item.id, source);
  if (left) s.events.push({ type: "bagFull", t: s.t, depth, source: s.sources.get(left.id) ?? source, item: left });
};

const lootContext = (s: JourneyState, depth: number, rareBonus = 0) => ({
  depth,
  luck: s.input.loadout.stats.luk,
  id: `${s.input.seed}:${s.events.length}`,
  rareBonus,
});

const battle = (s: JourneyState, depth: number, found: Foe): void => {
  const foe = { ...found, xp: scaledXp(found.xp, s.input.loadout.level, depth) };
  const view = { kind: foe.kind, name: foe.name, hp: foe.hp, traits: foe.traits, rare: foe.rare };
  s.events.push({ type: "encounter", t: s.t, depth, foe: view, hp: s.me.hp });
  const outcome = resolveBattle(s.rng, s.me, foe, s.input.potionThreshold);
  s.events.push(...outcome.events);
  s.me = outcome.combatant;
  s.t += outcome.events.length * PACE.battleRoundSec;
  if (!outcome.won) return die(s, depth, "battle");
  s.xp += foe.xp;
  const drop = rollDrop(s.rng, foe, lootContext(s, depth));
  if (!drop) return;
  s.events.push({ type: "loot", t: s.t, depth, source: "drop", loot: { type: "item", item: drop } });
  pick(s, depth, "drop", drop);
};

const openChest = (s: JourneyState, depth: number, source: LootSource, rareBonus: number): void => {
  s.t += PACE.chestSec;
  const loot = rollLoot(s.rng, lootContext(s, depth, rareBonus));
  s.events.push({ type: "loot", t: s.t, depth, source, loot });
  if (loot.type === "gold") s.gold += loot.amount;
  else pick(s, depth, source, loot.item);
};

const finish = (s: JourneyState, maps: MapKnowledge): ExpeditionOutcome => ({
  status: s.dead ? "fainted" : "returned",
  reached: s.reached,
  hp: s.me.hp,
  maxHp: s.me.maxHp,
  potions: s.me.potions,
  rations: s.rations,
  xp: s.xp,
  gold: s.gold,
  items: s.items,
  durationSec: s.t,
  maps,
});

export type Journey = ReturnType<typeof createJourney>;

/** 冒険 1 回ぶんの途中経過を持ち、歩く、戦う、宝箱を開けるといった操作を提供する */
export const createJourney = (input: ExpeditionInput, rng: Rng) => {
  const s = initialState(input, rng);
  return {
    events: s.events,
    isDead: (): boolean => s.dead,
    enterFloor: (depth: number, direction: "down" | "up"): void => {
      s.reached = Math.max(s.reached, depth);
      s.events.push({ type: "floor", t: s.t, depth, direction, hp: s.me.hp, rations: s.rations });
    },
    step: (depth: number): void => {
      s.t += PACE.moveSec;
      digest(s, depth);
    },
    /** 敵と戦う。群れなら何体かと連戦する */
    fight: (depth: number, foe: Foe): void => {
      const count = foe.traits.includes("swarm") ? swarmSize(rng) : 1;
      for (let i = 0; i < count && !s.dead; i += 1) battle(s, depth, foe);
    },
    open: (depth: number, source: LootSource, rareBonus = 0): void => openChest(s, depth, source, rareBonus),
    turnaround: (depth: number): void => {
      s.events.push({ type: "turnaround", t: s.t, depth });
    },
    home: (): void => {
      s.events.push({ type: "home", t: s.t, hp: s.me.hp });
    },
    finish: (maps: MapKnowledge): ExpeditionOutcome => finish(s, maps),
  };
};
