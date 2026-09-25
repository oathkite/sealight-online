import type { CharacterState, Slot } from "@sealight/sim";
import { itemLabel } from "./format";

type GearProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  /** モンスターが留守の間は装備を変えられない */
  readonly canEquip: boolean;
  readonly onEquip: (itemId: string) => void;
  readonly onUnequip: (slot: Slot) => void;
  readonly onSell: (itemId: string) => void;
};

const SLOT_LABELS = { weapon: "武器", armor: "防具" } as const;

export const Gear = ({ character, busy, canEquip, onEquip, onUnequip, onSell }: GearProps) => (
  <section aria-label="装備と倉庫">
    <h3>装備</h3>
    <ul className="list">
      {(["weapon", "armor"] as const).map((slot) => {
        const item = character.equipment[slot];
        return (
          <li key={slot}>
            <span>
              {SLOT_LABELS[slot]}：{item ? itemLabel(item) : "なし"}
            </span>
            {item && canEquip ? (
              <button type="button" disabled={busy} onClick={() => onUnequip(slot)}>
                外す
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
    <h3>倉庫</h3>
    {character.stash.length === 0 ? (
      <p className="muted">倉庫は空です。帰還すると持ち物がここに入ります</p>
    ) : (
      <ul className="list">
        {character.stash.map((item) => (
          <li key={item.id}>
            <span>{itemLabel(item)}</span>
            <span className="actions">
              {canEquip ? (
                <button type="button" disabled={busy} onClick={() => onEquip(item.id)}>
                  装備
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => onSell(item.id)}>
                売る（{item.value} G）
              </button>
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);
