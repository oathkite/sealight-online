import { useMemo, useState } from "react";
import { estimateExpedition, MAX_DEPTH, PACE, reactionFor, type CharacterState } from "@sealight/sim";
import { formatDuration, REACTIONS } from "./format";
import { Face } from "./icons/Face";

type TargetPickerProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onDepart: (target: number, rations: number) => void;
};

const DEPTHS = Array.from({ length: MAX_DEPTH }, (_, i) => i + 1);

/** 初期値。無事に帰ったら前回の目標、倒れたら倒れた階の 1 つ上（無理な目標を選びやすくならないように） */
const defaultTarget = (character: CharacterState): number => {
  const last = character.lastExpedition;
  if (!last) return 1;
  if (last.outcome.status === "returned") return last.input.target;
  return Math.max(1, last.outcome.reached - 1);
};

/** 送り出す前の準備。目標の階と持たせる食料を選ぶと、モンスターの反応とかかる時間の目安が変わる */
export const TargetPicker = ({ character, busy, onDepart }: TargetPickerProps) => {
  const maxRations = Math.min(character.rations, PACE.bagCapacity);
  const [target, setTarget] = useState(() => defaultTarget(character));
  const [rations, setRations] = useState(() => Math.min(4, maxRations));
  const carried = Math.min(rations, maxRations);

  // 本番のシードは使わない見積もり（サーバーと同じ計算）
  const estimate = useMemo(
    () =>
      estimateExpedition({
        target,
        loadout: {
          stats: character.stats,
          potions: character.potions,
          rations: carried,
          weapon: character.equipment.weapon,
          armor: character.equipment.armor,
        },
        maps: character.maps,
        potionThreshold: character.tactics.potionThreshold,
      }),
    [target, carried, character],
  );
  const reaction = reactionFor(estimate.successRate);

  return (
    <section className="picker" aria-label="送り出す準備">
      <div className="picker-fields">
        <label className="field">
          <span>目標の階</span>
          <select aria-label="目標の階" value={target} disabled={busy} onChange={(e) => setTarget(Number(e.target.value))}>
            {DEPTHS.map((depth) => (
              <option key={depth} value={depth}>
                地下 {depth} 階{depth <= character.bestDepth ? "（到達済み）" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>持たせる食料</span>
          <select aria-label="持たせる食料" value={carried} disabled={busy} onChange={(e) => setRations(Number(e.target.value))}>
            {Array.from({ length: maxRations + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n} 個
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="reaction">
        <Face expression={reaction} size={30} />
        {REACTIONS[reaction]}
      </p>
      <p className="muted">
        だいたい {formatDuration(estimate.minSec)}〜{formatDuration(estimate.maxSec)} で帰ってきそう
      </p>
      <button type="button" className="primary" disabled={busy} onClick={() => onDepart(target, carried)}>
        地下 {target} 階を目指して送り出す
      </button>
    </section>
  );
};
