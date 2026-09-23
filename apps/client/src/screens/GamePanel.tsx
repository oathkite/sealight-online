import { maxHpOf, type CharacterState, type Decision } from "@sealight/sim";
import { DecisionPanel } from "@/components/DecisionPanel";
import { ExploringPanel } from "@/components/ExploringPanel";
import { ReplayHud } from "@/components/ReplayHud";
import { TownPanel, type TownActions } from "@/components/TownPanel";
import type { Frame } from "@/replay/timeline";

type GamePanelProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly replaying: boolean;
  readonly frame: Frame | null;
  readonly actions: TownActions;
  readonly onDecide: (decision: Decision) => void;
  readonly onSkipReplay: () => void;
};

const DeathNotice = ({ character }: { readonly character: CharacterState }) => {
  const last = character.lastLamp;
  if (last?.outcome.status !== "dead") return null;
  return <p className="notice">前回：地下 {last.input.depth} 階で力尽き、持ち物を失いました</p>;
};

/** キャラの状態に応じて、画面下のパネルを切り替える */
export const GamePanel = ({ character, busy, replaying, frame, actions, onDecide, onSkipReplay }: GamePanelProps) => {
  const { phase, lastLamp } = character;
  if (replaying && lastLamp) {
    return (
      <ReplayHud
        depth={lastLamp.input.depth}
        maxHp={maxHpOf({ stats: lastLamp.input.loadout.stats })}
        frame={frame}
        onSkip={onSkipReplay}
      />
    );
  }
  switch (phase.type) {
    case "town":
      return (
        <>
          <DeathNotice character={character} />
          <TownPanel character={character} busy={busy} actions={actions} />
        </>
      );
    case "exploring":
      return <ExploringPanel depth={phase.depth} endsAt={phase.endsAt} />;
    case "camp":
      return (
        <DecisionPanel
          depth={phase.depth}
          hp={character.hp}
          maxHp={maxHpOf(character)}
          bag={character.bag}
          busy={busy}
          onDecide={onDecide}
        />
      );
  }
};
