import { createCharacter, type CharacterState } from "../character";
import { estimateExpedition } from "../estimate";
import { MAX_DEPTH } from "../floor";
import { departExpedition, returnFromExpedition } from "../rules";

/**
 * バランスを確かめるための自動で遊ぶプレイヤー。町での準備（割り振り、装備、鍛冶、売買）の方針だけを差し替え、
 * 目標の階の選び方と送り出し方は共通にして、方針の違いだけが結果に出るようにする
 */
export type Policy = {
  readonly name: string;
  /** 目標の階に向けて町で準備する。持たせる食料とポーションの数も決める */
  readonly prepare: (state: CharacterState, target: number, newId: () => string) => Prepared;
};

export type Prepared = { readonly state: CharacterState; readonly rations: number; readonly potions: number };

export type CampaignReport = {
  readonly policy: string;
  readonly trips: number;
  /** 各節目の階を初めて無事に往復するまでの冒険の回数と、かかった時間（時間）。届かなければ null */
  readonly milestones: Readonly<Record<number, { readonly trips: number; readonly hours: number } | null>>;
  readonly faints: number;
  readonly level: number;
};

export const MILESTONES = [5, 10, 15, 20] as const;

/** 送り出す前の見積もりで、この割合以上帰ってこられそうなら 1 つ深い階に挑む */
const PUSH_RATE = 0.5;

const loadoutFor = (state: CharacterState, target: number, prepared: Prepared) => ({
  target,
  loadout: { level: state.level, stats: state.stats, potions: prepared.potions, rations: prepared.rations, weapon: state.equipment.weapon, armor: state.equipment.armor },
  maps: state.maps,
  potionThreshold: state.tactics.potionThreshold,
});

/** 次の目標。まだ往復していない 1 つ深い階に挑めそうならそこ、無理そうなら往復できた一番深い階で力をつける */
const chooseTarget = (policy: Policy, state: CharacterState, newId: () => string): number => {
  const next = Math.min(MAX_DEPTH, state.clearedDepth + 1);
  if (state.clearedDepth === 0) return 1;
  const prepared = policy.prepare(state, next, newId);
  const rate = estimateExpedition(loadoutFor(prepared.state, next, prepared)).successRate;
  return rate >= PUSH_RATE ? next : state.clearedDepth;
};

const tripSeed = (seed: number, trip: number): number => (Math.imul(seed ^ 0x2545f491, trip + 1) ^ Math.imul(trip, 0x9e3779b9)) >>> 0;

type Progress = { readonly state: CharacterState; readonly faints: number; readonly hours: number };

/** 1 回の冒険：準備して送り出し、結果を反映する */
const playTrip = (policy: Policy, progress: Progress, trip: number, seed: number, newId: () => string): Progress => {
  const target = chooseTarget(policy, progress.state, newId);
  const prepared = policy.prepare(progress.state, target, newId);
  const departed = departExpedition(prepared.state, { target, rations: prepared.rations, potions: prepared.potions, seed: tripSeed(seed, trip), now: 0, timeScale: 1 });
  if (!departed.ok) throw new Error(`${policy.name}: 送り出せない（${departed.error}）`);
  const back = returnFromExpedition(departed.value.state, departed.value.result);
  if (!back.ok) throw new Error(`${policy.name}: 帰れない（${back.error}）`);
  const { outcome } = departed.value.result;
  return {
    state: back.value,
    faints: progress.faints + (outcome.status === "fainted" ? 1 : 0),
    hours: progress.hours + outcome.durationSec / 3600,
  };
};

/** 方針に従って、20 階を往復できるか冒険の上限の回数まで遊ぶ */
export const runCampaign = (policy: Policy, options: { readonly seed: number; readonly maxTrips: number }): CampaignReport => {
  let counter = 0;
  const newId = (): string => `bot-${(counter += 1)}`;
  let progress: Progress = { state: createCharacter(), faints: 0, hours: 0 };
  const milestones: Record<number, { trips: number; hours: number } | null> = Object.fromEntries(MILESTONES.map((m) => [m, null]));
  let trips = 0;
  while (trips < options.maxTrips && progress.state.clearedDepth < MAX_DEPTH) {
    trips += 1;
    progress = playTrip(policy, progress, trips, options.seed, newId);
    for (const m of MILESTONES) {
      if (milestones[m] === null && progress.state.clearedDepth >= m) milestones[m] = { trips, hours: Math.round(progress.hours * 10) / 10 };
    }
  }
  return { policy: policy.name, trips, milestones, faints: progress.faints, level: progress.state.level };
};
