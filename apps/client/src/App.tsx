import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { createCharacterApi } from "@/api/characterApi";
import { loadCharacterId } from "@/character/characterId";
import { useCharacter } from "@/character/useCharacter";
import { useSeenReport } from "@/character/useSeenReport";
import { FpsProbe } from "@/hud/FpsProbe";
import { HomeScene } from "@/scene/HomeScene";
import { PALETTE } from "@/scene/palette";
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

  const lastExpedition = character?.lastExpedition ?? null;
  const { unseen, markSeen } = useSeenReport(lastExpedition);
  const present = character?.phase.type !== "exploring";
  // ボロボロで帰ってきた（または余裕がなかった）ときは、見た目で分かるようにする
  const hurt = present && lastExpedition !== null && lastExpedition.outcome.hp / lastExpedition.outcome.maxHp < 0.4;

  return (
    <main className="app">
      <Canvas shadows={SHADOWS ? "percentage" : false} dpr={[1, 1.5]} style={{ background: PALETTE.background }}>
        <HomeScene present={present} hurt={hurt} />
        <FpsProbe onReport={setFps} />
      </Canvas>
      <div className="hud-fps">{fps} fps</div>
      <div className="overlay">
        {error ? <p className="error">エラー：{error}</p> : null}
        {character ? (
          <GamePanel character={character} busy={busy} reportUnseen={unseen} actions={actions} onCloseReport={markSeen} />
        ) : (
          <p className="panel compact">{error ? "サーバーに接続できません" : "読み込み中..."}</p>
        )}
      </div>
    </main>
  );
};
