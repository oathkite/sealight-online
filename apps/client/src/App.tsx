import { useMemo, useState } from "react";
import { createCharacterApi } from "@/api/characterApi";
import { CrayonFilter } from "@/components/icons/Icon";
import { loadCharacterId } from "@/character/characterId";
import { useCharacter } from "@/character/useCharacter";
import { useSeenReport } from "@/character/useSeenReport";
import { HomeView } from "@/game/HomeView";
import { loadGraphicsSetting, saveGraphicsSetting, type GraphicsSetting } from "@/game/graphics";
import { skyAt } from "@/game/lighting";
import { useClockHour } from "@/game/useClockHour";
import { Hud } from "@/hud/Hud";
import { useStage } from "@/scene/useStage";
import { GamePanel } from "@/screens/GamePanel";
import { usePanelActions } from "@/screens/usePanelActions";


export const App = () => {
  const api = useMemo(() => createCharacterApi(loadCharacterId()), []);
  const view = useCharacter(api);
  const actions = usePanelActions(api, view);
  const { character, error, busy } = view;
  const [fps, setFps] = useState(0);
  const hour = useClockHour();
  const [graphics, setGraphics] = useState<GraphicsSetting>(loadGraphicsSetting);
  const chooseGraphics = (setting: GraphicsSetting): void => {
    saveGraphicsSetting(setting);
    setGraphics(setting);
  };

  const lastExpedition = character?.lastExpedition ?? null;
  const { unseen, markSeen } = useSeenReport(lastExpedition);
  const present = character ? character.phase.type !== "exploring" : null;
  const outcome = lastExpedition?.outcome;
  // ボロボロで帰ってきた（または余裕がなかった）ときは、見た目で分かるようにする
  const mood = {
    hurt: outcome !== undefined && outcome.hp / outcome.maxHp < 0.4,
    sleepy: skyAt(hour).lamp > 0.85,
    carrying: outcome !== undefined && outcome.status === "returned" && (outcome.items.length > 0 || outcome.gold > 0),
  };
  const stage = useStage(present, mood.hurt);

  return (
    <main className="app">
      <CrayonFilter />
      <HomeView stage={stage} mood={mood} hour={hour} quality={graphics} onStats={(stats) => setFps(stats.fps)} />
      <Hud fps={fps} graphics={graphics} onGraphics={chooseGraphics} />
      <div className="overlay">
        {error ? <p className="error">エラー：{error}</p> : null}
        {character ? (
          <GamePanel character={character} busy={busy} reportUnseen={unseen}
            settled={stage.act === "home"} actions={actions} onCloseReport={markSeen} />
        ) : (
          <p className="panel compact">{error ? "サーバーに接続できません" : "読み込み中..."}</p>
        )}
      </div>
    </main>
  );
};
