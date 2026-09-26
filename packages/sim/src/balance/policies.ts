import { buildAdvice } from "../advice";
import { bandOf, bandTraits, type Trait } from "../catalog";
import type { CharacterState } from "../character";
import { PACE } from "../expedition-types";
import { AFFIXES, forgeCost, forgeGain, MAX_FORGE, SHOP, shopOffer, type Affix, type Equipment, type ShopSku, type Slot } from "../items";
import { allocateStat, buy, equip, forge, sell, type RuleResult } from "../rules";
import type { Policy, Prepared } from "./campaign";

const SLOTS: readonly Slot[] = ["weapon", "armor"];

/** 失敗しても止めずに、元の状態のまま進める（買えない、鍛えられないはよくあること） */
const orKeep = (state: CharacterState, result: RuleResult): CharacterState => (result.ok ? result.value : state);

/** 力と体に交互に割り振る */
const allocate = (start: CharacterState): CharacterState => {
  let state = start;
  while (state.unspentPoints > 0) state = orKeep(state, allocateStat(state, state.stats.str <= state.stats.vit ? "str" : "vit"));
  return state;
};

/** 深さに合わせた持たせる数 */
const loadFor = (target: number) => {
  const rations = Math.min(PACE.bagCapacity - 3, 1 + Math.ceil(target * 0.55));
  return { rations, potions: Math.min(PACE.bagCapacity - rations, 3 + Math.floor(target / 5)) };
};

const consumableCost = (state: CharacterState, target: number): number => {
  const { rations, potions } = loadFor(target);
  return Math.max(0, rations - state.rations) * SHOP.ration.price + Math.max(0, potions - state.potions) * SHOP.potion.price;
};

/** 足りない食料とポーションを買う（まとめ買いは全部買えるときだけ）。買えなければ家にある分だけ持たせる */
const stockUp = (start: CharacterState, target: number): Prepared => {
  const want = loadFor(target);
  let state = start;
  const needRations = want.rations - state.rations;
  if (needRations > 0) state = orKeep(state, buy(state, "ration", "-", needRations));
  const needPotions = want.potions - state.potions;
  if (needPotions > 0) state = orKeep(state, buy(state, "potion", "-", needPotions));
  return { state, rations: Math.min(want.rations, state.rations), potions: Math.min(want.potions, state.potions) };
};

const owned = (state: CharacterState, slot: Slot): readonly Equipment[] =>
  [state.equipment[slot], ...state.stash.filter((i) => i.slot === slot)].filter((i): i is Equipment => i !== null);

const strongest = (items: readonly Equipment[]): Equipment | undefined => [...items].sort((a, b) => b.power - a.power)[0];

const wear = (state: CharacterState, item: Equipment | undefined): CharacterState =>
  item && state.equipment[item.slot]?.id !== item.id ? orKeep(state, equip(state, item.id)) : state;

/** 身につけていない物を、keep に入っていなければ売る */
const sellExcept = (start: CharacterState, keep: ReadonlySet<string>): CharacterState =>
  start.stash.reduce((state, item) => (keep.has(item.id) ? state : orKeep(state, sell(state, item.id))), start);

/** 力任せ：強さが一番の装備を身につけ、残りは売る。鍛えない */
export const grinder: Policy = {
  name: "力任せ",
  prepare: (start, target) => {
    let state = allocate(start);
    for (const slot of SLOTS) state = wear(state, strongest(owned(state, slot)));
    return stockUp(sellExcept(state, new Set()), target);
  },
};

const COUNTER: Readonly<Record<Trait, Affix>> = { armored: "pierce", swarm: "sweep", heavy: "guard", fast: "evade" };
/** 同じ部位で欲しい特性が 2 つあるときの優先（強打は一撃で倒れるので、受け止めを先に） */
const PRIORITY: readonly Affix[] = ["pierce", "guard", "sweep", "evade"];
const SHOP_SKU: Readonly<Record<Affix, ShopSku>> = { pierce: "pierce-sword", sweep: "sweep-axe", guard: "guard-shield", evade: "evade-cloak" };
/** 特性付きを選ぶのは、一番強い物のこの割合以上の強さがあるとき */
const COUNTER_FLOOR = 0.6;

/** 前回の報告の手がかりで、一番削られた特徴（同じ帯の冒険だったときだけ） */
const hurtBy = (state: CharacterState, target: number): readonly Trait[] => {
  const last = state.lastExpedition;
  if (!last || bandOf(last.input.target) !== bandOf(target)) return [];
  return buildAdvice(last).flatMap((a) => (a.type === "trait" ? [a.trait] : []));
};

/** 欲しい特性。前回の報告で削られた特徴に効く物を先に、なければ帯の敵に効く物を優先の順に */
const wantedAffix = (state: CharacterState, target: number, slot: Slot): Affix | undefined => {
  const fits = (a: Affix) => (AFFIXES[slot] as readonly Affix[]).includes(a);
  const fromReport = hurtBy(state, target).map((t) => COUNTER[t]).find(fits);
  if (fromReport) return fromReport;
  const wanted = bandTraits(target).map((t) => COUNTER[t]);
  return PRIORITY.find((a) => wanted.includes(a) && fits(a));
};

/** 部位ごとに、一番強い物と、特性ごとに一番強い物は取っておく（次の帯の備え） */
const toolbox = (state: CharacterState): ReadonlySet<string> => {
  const keep = new Set<string>();
  for (const slot of SLOTS) {
    const items = owned(state, slot);
    const best = strongest(items);
    if (best) keep.add(best.id);
    for (const affix of AFFIXES[slot]) {
      const top = strongest(items.filter((i) => i.affix === affix));
      if (top) keep.add(top.id);
    }
  }
  return keep;
};

/** 余った同じ部位の装備（取っておく物は除く）で鍛えきったときの強さの見込み */
const potential = (item: Pick<Equipment, "id" | "power" | "forged" | "slot">, state: CharacterState): number => {
  const keep = toolbox(state);
  const gains = state.stash
    .filter((m) => m.slot === item.slot && m.id !== item.id && !keep.has(m.id))
    .map((m) => forgeGain(m))
    .sort((a, b) => b - a)
    .slice(0, MAX_FORGE - item.forged);
  return item.power + gains.reduce((sum, g) => sum + g, 0);
};

/** 欲しい特性の装備を、持っていれば身につけ、なければ店で買う。鍛えれば一番強い物に近づけるなら選ぶ */
const wearCounter = (start: CharacterState, target: number, slot: Slot, newId: () => string): CharacterState => {
  const affix = wantedAffix(start, target, slot);
  const best = strongest(owned(start, slot));
  if (!affix) return wear(start, best);
  const floor = (best?.power ?? 0) * COUNTER_FLOOR;
  const counter = [...owned(start, slot).filter((i) => i.affix === affix)].sort((a, b) => potential(b, start) - potential(a, start))[0];
  if (counter && potential(counter, start) >= floor) return wear(start, counter);
  const offer = shopOffer(SHOP_SKU[affix], start.clearedDepth);
  if (!offer.item) return wear(start, best);
  const id = newId();
  const afford = start.gold >= offer.price + consumableCost(start, target) + forgeCost({ forged: 0 }) * MAX_FORGE;
  if (!afford || potential({ ...offer.item, id }, start) < floor) return wear(start, best);
  return wear(orKeep(start, buy(start, SHOP_SKU[affix], id)), { ...offer.item, id });
};

/** 身につけている装備を、余った同じ部位の装備で鍛える */
const forgeWorn = (start: CharacterState, slot: Slot, keep: ReadonlySet<string>, reserve: number): CharacterState => {
  let state = start;
  for (let i = 0; i < MAX_FORGE; i += 1) {
    const worn = state.equipment[slot];
    const material = [...state.stash].filter((m) => m.slot === slot && !keep.has(m.id)).sort((a, b) => forgeGain(b) - forgeGain(a))[0];
    if (!worn || !material || worn.forged >= MAX_FORGE || state.gold < forgeCost(worn) + reserve) break;
    state = orKeep(state, forge(state, worn.id, material.id));
  }
  return state;
};

/**
 * 対策する：前回の報告で削られた特徴か、目標の帯の敵の特徴に効く特性の装備を、持っていれば身につけ、なければ買い、
 * 余った装備で鍛える。特性ごとに一番の物は取っておく
 */
export const adapter: Policy = {
  name: "対策する",
  prepare: (start, target, newId) => {
    let state = allocate(start);
    for (const slot of SLOTS) state = wearCounter(state, target, slot, newId);
    const keep = toolbox(state);
    const reserve = consumableCost(state, target);
    for (const slot of SLOTS) state = forgeWorn(state, slot, keep, reserve);
    return stockUp(sellExcept(state, toolbox(state)), target);
  },
};
