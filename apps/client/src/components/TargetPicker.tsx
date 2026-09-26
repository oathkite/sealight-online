import { useMemo, useState } from "react";
import { estimateExpedition, PACE, reactionFor, SHOP, type CharacterState } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { CountStepper } from "./CountStepper";
import { DepthPicker } from "./DepthPicker";
import { formatDuration, REACTIONS } from "./format";
import { Face } from "./icons/Face";
import { Glyph } from "./icons/Glyph";
import { Icon } from "./icons/Icon";

type TargetPickerProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onDepart: (target: number, rations: number, potions: number) => void;
  /** 家に足りない食料とポーションを、まとめて買う */
  readonly onRestock: (rations: number, potions: number) => void;
};

/** 初期値。無事に帰ったら前回の目標、倒れたら倒れた階の 1 つ上（無理な目標を選びやすくならないように） */
const defaultTarget = (character: CharacterState): number => {
  const last = character.lastExpedition;
  if (!last) return 1;
  if (last.outcome.status === "returned") return last.input.target;
  return Math.max(1, last.outcome.reached - 1);
};

/** 持たせる数の初期値は前回と同じ（初めては食料 4、ポーション 1）。荷物の枠に収まるように切り詰める */
const defaultLoad = (character: CharacterState) => {
  const last = character.lastExpedition?.input.loadout;
  const rations = Math.min(last?.rations ?? 4, PACE.bagCapacity);
  return { rations, potions: Math.min(last?.potions ?? 1, PACE.bagCapacity - rations) };
};

/** 本番のシードは使わない見積もり（サーバーと同じ計算） */
const useEstimate = (character: CharacterState, target: number, rations: number, potions: number) =>
  useMemo(
    () =>
      estimateExpedition({
        target,
        loadout: { stats: character.stats, potions, rations, weapon: character.equipment.weapon, armor: character.equipment.armor },
        maps: character.maps,
        potionThreshold: character.tactics.potionThreshold,
      }),
    [target, rations, potions, character],
  );

/** 荷物の枠のうち、食料とポーションが使う数と、拾った物に使える空き */
const BagMeter = ({ rations, potions }: { readonly rations: number; readonly potions: number }) => {
  const free = PACE.bagCapacity - rations - potions;
  return (
    <p className="bag-meter">
      荷物 {rations + potions} / {PACE.bagCapacity}
      <span className="muted">{free > 0 ? `（空き ${free} 枠に拾った物を入れて帰る）` : "（拾った物を入れる空きがない）"}</span>
    </p>
  );
};

/** 家に足りない数と、まとめて買う値段 */
const shortfallOf = (character: CharacterState, rations: number, potions: number) => {
  const needRations = Math.max(0, rations - character.rations);
  const needPotions = Math.max(0, potions - character.potions);
  return { needRations, needPotions, cost: needRations * SHOP.ration.price + needPotions * SHOP.potion.price };
};

const Restock = ({ character, busy, rations, potions, onRestock }: Pick<TargetPickerProps, "character" | "busy" | "onRestock"> & { readonly rations: number; readonly potions: number }) => {
  const { needRations, needPotions, cost } = shortfallOf(character, rations, potions);
  if (needRations + needPotions === 0) return null;
  const parts = [needRations > 0 ? `食料 ${needRations}` : "", needPotions > 0 ? `ポーション ${needPotions}` : ""].filter(Boolean);
  return (
    <button
      type="button"
      className="restock"
      disabled={busy || character.gold < cost}
      onClick={() => {
        playSfx("coin");
        onRestock(needRations, needPotions);
      }}
    >
      足りない分を買う（{parts.join("・")}）<span className="price">{cost} G</span>
    </button>
  );
};

/** 送り出す前の準備。目標の階と持たせる物を選ぶと、モンスターの反応とかかる時間の目安が変わる */
export const TargetPicker = ({ character, busy, onDepart, onRestock }: TargetPickerProps) => {
  const [target, setTarget] = useState(() => defaultTarget(character));
  const [load, setLoad] = useState(() => defaultLoad(character));
  const { rations, potions } = load;
  const short = shortfallOf(character, rations, potions).cost > 0;

  const estimate = useEstimate(character, target, rations, potions);
  const reaction = reactionFor(estimate.successRate);

  return (
    <section className="picker" aria-label="送り出す準備">
      <h3 className="ribbon">冒険の支度</h3>
      <DepthPicker value={target} bestDepth={character.bestDepth} disabled={busy} onChange={setTarget} />
      <CountStepper name="食料" unit="個" icon={<Icon name="bread" size={18} />} value={rations} max={PACE.bagCapacity - potions} stock={character.rations} disabled={busy} onChange={(n) => setLoad({ ...load, rations: n })} />
      <CountStepper name="ポーション" unit="本" icon={<Glyph name="potion" size={18} />} value={potions} max={PACE.bagCapacity - rations} stock={character.potions} disabled={busy} onChange={(n) => setLoad({ ...load, potions: n })} />
      <BagMeter rations={rations} potions={potions} />
      <Restock character={character} busy={busy} rations={rations} potions={potions} onRestock={onRestock} />
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
        disabled={busy || short}
        onClick={() => {
          playSfx("depart");
          onDepart(target, rations, potions);
        }}
      >
        地下 {target} 階を目指して送り出す
      </button>
    </section>
  );
};
