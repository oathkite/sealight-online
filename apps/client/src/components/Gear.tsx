import type { CharacterState, Slot } from "@sealight/sim";
import { ItemCard } from "./items/ItemCard";
import { gainOver } from "./items/items";

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

/** いまの装備と倉庫。倉庫の装備には、いまの装備と比べた強さの差を出す */
export const Gear = ({ character, busy, canEquip, onEquip, onUnequip, onSell }: GearProps) => (
  <section className="gear" aria-label="装備と倉庫">
    <h3 className="ribbon">装備</h3>
    <ul className="list">
      {(["weapon", "armor"] as const).map((slot) => {
        const item = character.equipment[slot];
        return (
          <li key={slot}>
            {item ? (
              <ItemCard item={item}>
                {canEquip ? (
                  <button type="button" disabled={busy} onClick={() => onUnequip(slot)}>
                    外す
                  </button>
                ) : null}
              </ItemCard>
            ) : (
              <div className="slot-empty">{SLOT_LABELS[slot]}：なし</div>
            )}
          </li>
        );
      })}
    </ul>
    <h3 className="ribbon">倉庫</h3>
    {character.stash.length === 0 ? (
      <p className="muted">倉庫は空です。帰還すると持ち物がここに入ります</p>
    ) : (
      <ul className="list">
        {character.stash.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} gain={gainOver(item, character.equipment)}>
              {canEquip ? (
                <button type="button" disabled={busy} onClick={() => onEquip(item.id)}>
                  装備
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => onSell(item.id)}>
                売る（{item.value} G）
              </button>
            </ItemCard>
          </li>
        ))}
      </ul>
    )}
  </section>
);
