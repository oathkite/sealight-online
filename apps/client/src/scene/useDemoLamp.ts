import { useCallback, useMemo, useState } from "react";
import { createCharacter, maxHpOf, simulateLamp, type LampResult } from "@sealight/sim";

const BASE_SEED = 20260923;
const starter = createCharacter();

/** 見せる探索の結果がないときに、背景で流すデモの探索 */
export const useDemoLamp = () => {
  const [round, setRound] = useState(0);
  const lamp: LampResult = useMemo(
    () =>
      simulateLamp({
        seed: BASE_SEED + round,
        depth: 1,
        loadout: {
          stats: starter.stats,
          hp: maxHpOf(starter),
          potions: starter.potions,
          weapon: starter.equipment.weapon,
          armor: starter.equipment.armor,
        },
        tactics: starter.tactics,
      }),
    [round],
  );
  const next = useCallback(() => setRound((r) => r + 1), []);
  return { lamp, key: `demo-${round}`, next } as const;
};
