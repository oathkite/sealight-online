import type { CharacterState, Decision } from "@sealight/sim";
import { itemLabel } from "./format";

type DecisionPanelProps = {
  readonly depth: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly bag: CharacterState["bag"];
  readonly busy: boolean;
  readonly onDecide: (decision: Decision) => void;
};

/** 探索を終えて階段に着いたときの判断。進む、もう一度、帰還の 3 択 */
export const DecisionPanel = ({ depth, hp, maxHp, bag, busy, onDecide }: DecisionPanelProps) => (
  <section className="panel decision" aria-label="次の行動">
    <h2>地下 {depth} 階の階段にいます</h2>
    <p>
      HP {hp} / {maxHp}
    </p>
    <div className="bag">
      <div>持ち物（倒れると失います）</div>
      {bag.items.length === 0 && bag.gold === 0 ? (
        <div className="muted">持ち物はありません</div>
      ) : (
        <ul>
          {bag.gold > 0 ? <li>{bag.gold} G</li> : null}
          {bag.items.map((item) => (
            <li key={item.id}>{itemLabel(item)}</li>
          ))}
        </ul>
      )}
    </div>
    <div className="decision-buttons">
      <button type="button" disabled={busy} onClick={() => onDecide("descend")}>
        次の階へ進む（地下 {depth + 1} 階・25 分）
      </button>
      <button type="button" disabled={busy} onClick={() => onDecide("stay")}>
        この階をもう一度探索（25 分）
      </button>
      <button type="button" disabled={busy} onClick={() => onDecide("return")}>
        帰還する（持ち物を持ち帰る）
      </button>
    </div>
  </section>
);
