import type { Foe } from "./catalog";
import type { Rng } from "./rng";

export type { Foe } from "./catalog";

/** 戦闘中のキャラの状態 */
export type Combatant = {
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly potions: number;
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

/** 攻撃力 - 防御力 に ±1 の揺らぎ。最低 1 */
const damageOf = (rng: Rng, attack: number, defense: number): number => Math.max(1, attack - defense + rng.int(3) - 1);

const needsPotion = (c: Combatant, threshold: number): boolean => c.potions > 0 && c.hp * 100 < c.maxHp * threshold;

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
      const damage = damageOf(rng, me.attack, foe.defense);
      foeHp = Math.max(0, foeHp - damage);
      events.push({ type: "attack", by: "player", damage, hp: foeHp });
      if (foeHp === 0) {
        events.push({ type: "victory", xp: foe.xp });
        return { won: true, combatant: me, events };
      }
    }

    const damage = damageOf(rng, foe.attack, me.defense);
    me = { ...me, hp: Math.max(0, me.hp - damage) };
    events.push({ type: "attack", by: "foe", damage, hp: me.hp });
    if (me.hp === 0) return { won: false, combatant: me, events };
  }
  // 決着がつかないほど長引いた戦闘は、力尽きたものとして扱う
  return { won: false, combatant: { ...me, hp: 0 }, events };
};
