import { useState } from "react";
import { MAX_FORGE, type CharacterState, type Equipment, type Slot } from "@sealight/sim";
import { ForgePanel } from "./Forge";
import { ItemCard } from "./items/ItemCard";
import { forgePanelId, gainOver } from "./items/items";

type GearProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  /** モンスターが留守の間は装備を変えたり鍛えたりできない */
  readonly canEquip: boolean;
  readonly onEquip: (itemId: string) => void;
  readonly onUnequip: (slot: Slot) => void;
  readonly onSell: (itemId: string) => void;
  readonly onForge: (targetId: string, materialId: string) => void;
};

/** 装備の一覧が共有する、鍛える欄の開け閉め */
type ListProps = GearProps & {
  readonly forging: string | null;
  readonly onToggle: (itemId: string | null) => void;
};

const SLOT_LABELS = { weapon: "武器", armor: "防具" } as const;

const canForge = (item: Equipment): boolean => item.forged < MAX_FORGE;

const ForgeToggle = ({ item, forging, busy, onToggle }: { readonly item: Equipment } & Pick<ListProps, "forging" | "busy" | "onToggle">) => {
  if (!canForge(item)) return null;
  const open = forging === item.id;
  return (
    <button type="button" aria-expanded={open} aria-controls={forgePanelId(item.id)} disabled={busy} onClick={() => onToggle(open ? null : item.id)}>
      鍛える
    </button>
  );
};

/** 開いていて、まだ鍛えられる装備の下にだけ鍛冶の欄を出す */
const ForgeSlot = ({ item, character, busy, canEquip, forging, onForge }: { readonly item: Equipment } & ListProps) =>
  canEquip && forging === item.id && canForge(item) ? (
    <ForgePanel target={item} stash={character.stash} gold={character.gold} busy={busy} onForge={onForge} />
  ) : null;

const EquippedList = (props: ListProps) => (
  <ul className="list">
    {(["weapon", "armor"] as const).map((slot) => {
      const item = props.character.equipment[slot];
      if (!item) return <li key={slot}><div className="slot-empty">{SLOT_LABELS[slot]}：なし</div></li>;
      return (
        <li key={slot}>
          <ItemCard item={item}>
            {props.canEquip ? (
              <>
                <ForgeToggle item={item} {...props} />
                <button type="button" disabled={props.busy} onClick={() => props.onUnequip(slot)}>
                  外す
                </button>
              </>
            ) : null}
          </ItemCard>
          <ForgeSlot item={item} {...props} />
        </li>
      );
    })}
  </ul>
);

const StashList = (props: ListProps) => (
  <ul className="list">
    {props.character.stash.map((item) => (
      <li key={item.id}>
        <ItemCard item={item} gain={gainOver(item, props.character.equipment)}>
          {props.canEquip ? (
            <>
              <button type="button" disabled={props.busy} onClick={() => props.onEquip(item.id)}>
                装備
              </button>
              <ForgeToggle item={item} {...props} />
            </>
          ) : null}
          <button type="button" disabled={props.busy} onClick={() => props.onSell(item.id)}>
            売る（{item.value} G）
          </button>
        </ItemCard>
        <ForgeSlot item={item} {...props} />
      </li>
    ))}
  </ul>
);

/** いまの装備と倉庫。倉庫の装備には、いまの装備と比べた強さの差を出す。家にいるときは鍛えられる */
export const Gear = (props: GearProps) => {
  const [forging, setForging] = useState<string | null>(null);
  const lists = { ...props, forging, onToggle: setForging };
  return (
    <section className="gear" aria-label="装備と倉庫">
      <h3 className="ribbon">装備</h3>
      <EquippedList {...lists} />
      <h3 className="ribbon">倉庫</h3>
      {props.character.stash.length === 0 ? <p className="muted">倉庫は空です。帰還すると持ち物がここに入ります</p> : <StashList {...lists} />}
    </section>
  );
};
