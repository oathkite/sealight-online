import type { Foe } from "./catalog";
import type { Affix } from "./items";
import type { Rng } from "./rng";

export type { Foe } from "./catalog";

/** 戦闘中のキャラの状態 */
export type Combatant = {
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly potions: number;
  /** 身につけた装備の特性 */
  readonly affixes: readonly Affix[];
};

export type BattleEvent =
  | { readonly type: "attack"; readonly by: "player" | "foe"; readonly damage: number; readonly hp: number }
  | { readonly type: "potion"; readonly hp: number }
  | { readonly type: "victory"; readonly xp: number };

export type BattleOutcome = {
  readonly won: boolean;
  readonly combatant: Combatant;
  readonly events: readonly BattleEvent[];
};

const POTION_HEAL_RATIO = 0.5;
const MAX_ROUNDS = 200;
/** 貫きが無視する、敵の防御の割合 */
const PIERCE_RATIO = 0.75;

/** 攻撃力 - 防御力 に ±1 の揺らぎ。最低 1 */
const damageOf = (rng: Rng, attack: number, defense: number): number => Math.max(1, attack - defense + rng.int(3) - 1);

const needsPotion = (c: Combatant, threshold: number): boolean => c.potions > 0 && c.hp * 100 < c.maxHp * threshold;

/** こちらの 1 撃。硬い敵にはダメージが半分しか通らない。貫きは硬さと防御を、薙ぎ払いは群れへのダメージを変える */
const strike = (rng: Rng, me: Combatant, foe: Foe): number => {
  const pierce = me.affixes.includes("pierce");
  const defense = pierce ? Math.floor(foe.defense * (1 - PIERCE_RATIO)) : foe.defense;
  const damage = damageOf(rng, me.attack, defense);
  if (foe.traits.includes("armored") && !pierce) return Math.max(1, Math.floor(damage / 2));
  return me.affixes.includes("sweep") && foe.traits.includes("swarm") ? damage * 2 : damage;
};

/** 敵の 1 撃。強打は受け止めで半分になる */
const struck = (rng: Rng, me: Combatant, foe: Foe): number => {
  const damage = damageOf(rng, foe.attack, me.defense);
  return me.affixes.includes("guard") && foe.traits.includes("heavy") ? Math.ceil(damage / 2) : damage;
};

/** 素早い敵は 1 ラウンドに 2 回攻撃する。身かわしがあれば 1 回 */
const strikesOf = (me: Combatant, foe: Foe): number => (foe.traits.includes("fast") && !me.affixes.includes("evade") ? 2 : 1);

/**
 * 1 対 1 の戦闘を決着まで進める。
 * 毎ラウンド、キャラが先に行動（HP がしきい値未満ならポーション、そうでなければ攻撃）し、生き残った敵が反撃する。
 */
export const resolveBattle = (rng: Rng, start: Combatant, foe: Foe, potionThreshold: number): BattleOutcome => {
  let me = start;
  let foeHp = foe.hp;
  const events: BattleEvent[] = [];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (needsPotion(me, potionThreshold)) {
      const hp = Math.min(me.maxHp, me.hp + Math.ceil(me.maxHp * POTION_HEAL_RATIO));
      me = { ...me, hp, potions: me.potions - 1 };
      events.push({ type: "potion", hp });
    } else {
      const damage = strike(rng, me, foe);
      foeHp = Math.max(0, foeHp - damage);
      events.push({ type: "attack", by: "player", damage, hp: foeHp });
      if (foeHp === 0) {
        events.push({ type: "victory", xp: foe.xp });
        return { won: true, combatant: me, events };
      }
    }

    for (let i = 0; i < strikesOf(me, foe); i += 1) {
      const damage = struck(rng, me, foe);
      me = { ...me, hp: Math.max(0, me.hp - damage) };
      events.push({ type: "attack", by: "foe", damage, hp: me.hp });
      if (me.hp === 0) return { won: false, combatant: me, events };
    }
  }
  // 決着がつかないほど長引いた戦闘は、力尽きたものとして扱う
  return { won: false, combatant: { ...me, hp: 0 }, events };
};
