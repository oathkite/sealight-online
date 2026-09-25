import type { CharacterState } from "@sealight/sim";
import { Gear } from "@/components/Gear";
import { Journal } from "@/components/Journal";
import { Shop } from "@/components/Shop";
import { TownPanel, type TownActions } from "@/components/TownPanel";
import { WaitingPanel } from "@/components/WaitingPanel";

type GamePanelProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  /** まだ読んでいない冒険の報告があるか */
  readonly reportUnseen: boolean;
  readonly actions: TownActions;
  readonly onCloseReport: () => void;
};

/** キャラの状態に応じて、画面下のパネルを切り替える */
export const GamePanel = ({ character, busy, reportUnseen, actions, onCloseReport }: GamePanelProps) => {
  const { phase, lastExpedition } = character;
  if (phase.type === "exploring") {
    // 留守の間も、倉庫の整理と買い物はできる
    return (
      <>
        <WaitingPanel phase={phase} />
        <section className="panel" aria-label="留守の間にできること">
          <Gear character={character} busy={busy} canEquip={false} onEquip={actions.equip} onUnequip={actions.unequip} onSell={actions.sell} />
          <Shop gold={character.gold} busy={busy} onBuy={actions.buy} />
        </section>
      </>
    );
  }
  if (reportUnseen && lastExpedition) return <Journal result={lastExpedition} onClose={onCloseReport} />;
  return <TownPanel character={character} busy={busy} actions={actions} />;
};
