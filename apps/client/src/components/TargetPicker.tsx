import { useMemo, useState } from "react";
import { estimateExpedition, PACE, reactionFor, type CharacterState } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { DepthPicker } from "./DepthPicker";
import { formatDuration, REACTIONS } from "./format";
import { Face } from "./icons/Face";
import { Icon } from "./icons/Icon";

type TargetPickerProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onDepart: (target: number, rations: number) => void;
};

/** 初期値。無事に帰ったら前回の目標、倒れたら倒れた階の 1 つ上（無理な目標を選びやすくならないように） */
const defaultTarget = (character: CharacterState): number => {
  const last = character.lastExpedition;
  if (!last) return 1;
  if (last.outcome.status === "returned") return last.input.target;
  return Math.max(1, last.outcome.reached - 1);
};

const RationStepper = ({ value, max, disabled, onChange }: { value: number; max: number; disabled: boolean; onChange: (n: number) => void }) => (
  <div className="stepper" role="group" aria-label="持たせる食料">
    <button type="button" aria-label="食料を減らす" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
      −
    </button>
    <span className="stepper-value">
      <span className="breads" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? "bread on" : "bread"}>
            <Icon name="bread" size={18} />
          </span>
        ))}
      </span>
      <span className="stepper-count">{value} 個</span>
    </span>
    <button type="button" aria-label="食料を増やす" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
      ＋
    </button>
  </div>
);

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
        loadout: { stats: character.stats, potions: character.potions, rations: carried, weapon: character.equipment.weapon, armor: character.equipment.armor },
        maps: character.maps,
        potionThreshold: character.tactics.potionThreshold,
      }),
    [target, carried, character],
  );
  const reaction = reactionFor(estimate.successRate);

  return (
    <section className="picker" aria-label="送り出す準備">
      <h3 className="ribbon">冒険の支度</h3>
      <DepthPicker value={target} bestDepth={character.bestDepth} disabled={busy} onChange={setTarget} />
      <RationStepper value={carried} max={maxRations} disabled={busy} onChange={setRations} />
      <div className={`reaction ${reaction}`}>
        <Face expression={reaction} size={52} />
        <p className="bubble">
          <strong>{REACTIONS[reaction]}</strong>
          <span className="muted">
            だいたい {formatDuration(estimate.minSec)}〜{formatDuration(estimate.maxSec)} で帰ってきそう
          </span>
        </p>
      </div>
      <button
        type="button"
        className="primary depart"
        disabled={busy}
        onClick={() => {
          playSfx("depart");
          onDepart(target, carried);
        }}
      >
        地下 {target} 階を目指して送り出す
      </button>
    </section>
  );
};
