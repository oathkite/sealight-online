import type { CharacterState, ShopSku, Slot, StatKey, Tactics } from "@sealight/sim";
import { CharacterSheet } from "./CharacterSheet";
import { Gear } from "./Gear";
import { Shop } from "./Shop";
import { TacticsForm } from "./TacticsForm";

export type TownActions = {
  readonly allocate: (stat: StatKey) => void;
  readonly equip: (itemId: string) => void;
  readonly unequip: (slot: Slot) => void;
  readonly sell: (itemId: string) => void;
  readonly buy: (sku: ShopSku) => void;
  readonly setTactics: (tactics: Tactics) => void;
  readonly startLamp: () => void;
};

type TownPanelProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly actions: TownActions;
};

/** 街：準備を整えて、探索に出る */
export const TownPanel = ({ character, busy, actions }: TownPanelProps) => (
  <section className="panel town" aria-label="街">
    <CharacterSheet character={character} busy={busy} onAllocate={actions.allocate} />
    <button type="button" className="primary" disabled={busy} onClick={actions.startLamp}>
      探索に出る（地下 1 階・25 分）
    </button>
    <div className="town-columns">
      <Gear
        character={character}
        busy={busy}
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
