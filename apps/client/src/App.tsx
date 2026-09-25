import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { createCharacterApi } from "@/api/characterApi";
import { CrayonFilter } from "@/components/icons/Icon";
import { loadCharacterId } from "@/character/characterId";
import { useCharacter } from "@/character/useCharacter";
import { useSeenReport } from "@/character/useSeenReport";
import { FpsProbe } from "@/hud/FpsProbe";
import { HomeScene } from "@/scene/HomeScene";
import { SkyBackdrop } from "@/scene/SkyBackdrop";
import { useStage } from "@/scene/useStage";
import { useTimeOfDay } from "@/scene/useTimeOfDay";
import { GamePanel } from "@/screens/GamePanel";
import { usePanelActions } from "@/screens/usePanelActions";

const params = new URLSearchParams(window.location.search);
const SHADOWS = params.get("shadows") !== "0";

export const App = () => {
  const api = useMemo(() => createCharacterApi(loadCharacterId()), []);
  const view = useCharacter(api);
  const actions = usePanelActions(api, view);
  const { character, error, busy } = view;
  const [fps, setFps] = useState(0);
  const lighting = useTimeOfDay();

  const lastExpedition = character?.lastExpedition ?? null;
  const { unseen, markSeen } = useSeenReport(lastExpedition);
  const present = character ? character.phase.type !== "exploring" : null;
  const outcome = lastExpedition?.outcome;
  // ボロボロで帰ってきた（または余裕がなかった）ときは、見た目で分かるようにする
  const mood = {
    hurt: present === true && outcome !== undefined && outcome.hp / outcome.maxHp < 0.4,
    sleepy: lighting.lamp > 0.85,
    carrying: outcome !== undefined && outcome.status === "returned" && (outcome.items.length > 0 || outcome.gold > 0),
  };
  const stage = useStage(present, mood.hurt);

  return (
    <main className="app">
      <SkyBackdrop lighting={lighting} />
      <CrayonFilter />
      <Canvas flat shadows={SHADOWS ? "percentage" : false} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <HomeScene stage={stage} mood={mood} lighting={lighting} />
        <FpsProbe onReport={setFps} />
      </Canvas>
      <div className="hud-fps">{fps} fps</div>
      <div className="overlay">
        {error ? <p className="error">エラー：{error}</p> : null}
        {character ? (
          <GamePanel character={character} busy={busy} reportUnseen={unseen && stage.act !== "arriving"} actions={actions} onCloseReport={markSeen} />
        ) : (
          <p className="panel compact">{error ? "サーバーに接続できません" : "読み込み中..."}</p>
        )}
      </div>
    </main>
  );
};
