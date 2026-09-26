import type { CharacterState, ShopSku, Slot, StatKey, Tactics } from "@sealight/sim";
import { CharacterSheet } from "./CharacterSheet";
import { Gear } from "./Gear";
import { Shop } from "./Shop";
import { TacticsForm } from "./TacticsForm";
import { TargetPicker } from "./TargetPicker";

export type TownActions = {
  readonly allocate: (stat: StatKey) => void;
  readonly equip: (itemId: string) => void;
  readonly unequip: (slot: Slot) => void;
  readonly sell: (itemId: string) => void;
  readonly buy: (sku: ShopSku, quantity: number) => void;
  readonly setTactics: (tactics: Tactics) => void;
  readonly depart: (target: number, rations: number) => void;
};

type TownPanelProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly actions: TownActions;
};

/** 家：準備を整えて、目標の階を決めて送り出す */
export const TownPanel = ({ character, busy, actions }: TownPanelProps) => (
  <section className="panel town" aria-label="家">
    <CharacterSheet character={character} busy={busy} onAllocate={actions.allocate} />
    <TargetPicker character={character} busy={busy} onDepart={actions.depart} />
    <div className="town-columns">
      <Gear
        character={character}
        busy={busy}
        canEquip
        onEquip={actions.equip}
        onUnequip={actions.unequip}
        onSell={actions.sell}
      />
      <div>
        <TacticsForm tactics={character.tactics} busy={busy} onChange={actions.setTactics} />
        <Shop gold={character.gold} busy={busy} onBuy={actions.buy} />
      </div>
    </div>
  </section>
);
