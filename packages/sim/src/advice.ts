import type { Trait } from "./catalog";
import type { ExpeditionEvent, ExpeditionResult } from "./expedition-types";
import { affixesOf } from "./fighter";
import { AFFIX_COUNTERS } from "./items";

/**
 * 報告から読み取れる、次の冒険への手がかり。
 * trait：その特徴の敵に一番削られた（share は受けたダメージのうちの割合）。countered は効く特性を着けていたか
 * potions：苦しい冒険でポーションが尽きていた（left が 0）か、残したまま倒れた（left が 1 以上）
 */
export type Advice =
  | { readonly type: "trait"; readonly trait: Trait; readonly foes: readonly string[]; readonly share: number; readonly countered: boolean }
  | { readonly type: "potions"; readonly carried: number; readonly left: number }
  | { readonly type: "hunger" }
  | { readonly type: "bag"; readonly count: number };

/** 受けたダメージが最大 HP のこの割合より少なければ、特徴の手がかりは出さない */
const HURT_RATIO = 0.3;
/** 受けたダメージのうち、この割合以上をその特徴の敵から受けたら手がかりにする */
const SHARE_RATIO = 0.35;
/** HP がこの割合を下回ったらギリギリ */
const CLOSE_RATIO = 0.4;
const MAX_TRAITS = 2;

type Damage = { readonly total: number; readonly byTrait: ReadonlyMap<Trait, { readonly amount: number; readonly foes: readonly string[] }>; readonly lowestHp: number };

/** 敵から受けたダメージを、敵の特徴ごとに足し合わせる */
const tallyDamage = (events: readonly ExpeditionEvent[], maxHp: number): Damage => {
  const byTrait = new Map<Trait, { amount: number; foes: string[] }>();
  let total = 0;
  let lowestHp = maxHp;
  let foe: Extract<ExpeditionEvent, { type: "encounter" }>["foe"] | null = null;
  for (const e of events) {
    if (e.type === "encounter") foe = e.foe;
    if (e.type !== "attack" || e.by !== "foe") continue;
    total += e.damage;
    lowestHp = Math.min(lowestHp, e.hp);
    for (const trait of foe?.traits ?? []) {
      const entry = byTrait.get(trait) ?? { amount: 0, foes: [] };
      entry.amount += e.damage;
      if (foe && !entry.foes.includes(foe.name)) entry.foes.push(foe.name);
      byTrait.set(trait, entry);
    }
  }
  return { total, byTrait, lowestHp };
};

const traitAdvice = (result: ExpeditionResult, damage: Damage): readonly Advice[] => {
  if (damage.total < result.outcome.maxHp * HURT_RATIO) return [];
  const { weapon, armor } = result.input.loadout;
  const worn = affixesOf(weapon, armor);
  return [...damage.byTrait.entries()]
    .map(([trait, { amount, foes }]) => ({ trait, foes, share: amount / damage.total }))
    .filter((t) => t.share >= SHARE_RATIO)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_TRAITS)
    .map((t) => ({ type: "trait", ...t, countered: worn.some((a) => AFFIX_COUNTERS[a] === t.trait) }) as const);
};

/** 倒れたかギリギリでポーションが尽きていた、または飲む前に倒れてポーションを残していた */
const potionAdvice = (result: ExpeditionResult, damage: Damage): readonly Advice[] => {
  const { outcome, input } = result;
  const carried = input.loadout.potions;
  if (outcome.status === "fainted" && outcome.potions > 0) return [{ type: "potions", carried, left: outcome.potions }];
  const struggled = outcome.status === "fainted" || damage.lowestHp < outcome.maxHp * CLOSE_RATIO;
  return struggled && outcome.potions === 0 ? [{ type: "potions", carried, left: 0 }] : [];
};

/** 冒険の結果から、次の冒険への手がかりを挙げる（大事な順） */
export const buildAdvice = (result: ExpeditionResult): readonly Advice[] => {
  const damage = tallyDamage(result.events, result.outcome.maxHp);
  const dropped = result.events.filter((e) => e.type === "bagFull").length;
  return [
    ...traitAdvice(result, damage),
    ...potionAdvice(result, damage),
    ...(result.events.some((e) => e.type === "starving") ? [{ type: "hunger" } as const] : []),
    ...(dropped > 0 ? [{ type: "bag", count: dropped } as const] : []),
  ];
};
