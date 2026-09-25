import { PACE, type ExpeditionInput, type ExpeditionResult, type MapKnowledge } from "./expedition-types";
import { assertDepth, generateFloor } from "./floor";
import { beginVisit, respawnForReturn, walkDown, walkUp, type FloorVisit } from "./floor-walk";
import { createJourney } from "./journey";
import { createRng } from "./rng";

const mergeMaps = (before: MapKnowledge, visits: ReadonlyMap<number, FloorVisit>): MapKnowledge => {
  const depth = Math.max(before.length, ...visits.keys());
  return Array.from({ length: depth }, (_, i) => {
    const visit = visits.get(i + 1);
    const cells = visit ? visit.known : new Set(before[i] ?? []);
    return [...cells].sort((a, b) => a - b);
  });
};

/**
 * 冒険 1 回ぶんをシミュレーションする。同じ入力なら必ず同じ結果になる。
 * 1 階から目標の階まで降り、目標の階の宝を手に入れて折り返し、1 階の入口まで歩いて戻る。
 */
export const simulateExpedition = (input: ExpeditionInput): ExpeditionResult => {
  assertDepth(input.target);
  const rng = createRng(input.seed);
  const journey = createJourney(input, rng);
  const visits = new Map<number, FloorVisit>();

  for (let depth = 1; depth <= input.target && !journey.isDead(); depth += 1) {
    const visit = beginVisit(rng, generateFloor(depth), input.maps[depth - 1] ?? []);
    visits.set(depth, visit);
    journey.enterFloor(depth, "down");
    walkDown(rng, journey, visit);
  }

  if (!journey.isDead()) {
    journey.turnaround(input.target);
    journey.open(input.target, "goal", PACE.goalRareBonus);
  }

  for (let depth = input.target; depth >= 1 && !journey.isDead(); depth -= 1) {
    const visit = visits.get(depth);
    if (!visit) break;
    respawnForReturn(rng, visit);
    journey.enterFloor(depth, "up");
    walkUp(journey, visit);
  }

  if (!journey.isDead()) journey.home();
  return { input, events: journey.events, outcome: journey.finish(mergeMaps(input.maps, visits)) };
};
