import { useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Decision } from "@sealight/sim";
import { createCharacterApi } from "@/api/characterApi";
import { loadCharacterId } from "@/character/characterId";
import { useCharacter } from "@/character/useCharacter";
import { useSeenLamp } from "@/character/useSeenLamp";
import { FpsProbe } from "@/hud/FpsProbe";
import type { Frame } from "@/replay/timeline";
import { DungeonScene } from "@/scene/DungeonScene";
import { PALETTE } from "@/scene/palette";
import { useDemoLamp } from "@/scene/useDemoLamp";
import { GamePanel } from "@/screens/GamePanel";
import { usePanelActions } from "@/screens/usePanelActions";

const NEXT_DEMO_DELAY_MS = 1200;
const AFTER_REPLAY_DELAY_MS = 1500;

const params = new URLSearchParams(window.location.search);
const SHADOWS = params.get("shadows") !== "0";

export const App = () => {
  const api = useMemo(() => createCharacterApi(loadCharacterId()), []);
  const view = useCharacter(api);
  const actions = usePanelActions(api, view);
  const { character, error, busy, run, explore } = view;
  const demo = useDemoLamp();
  const [fps, setFps] = useState(0);
  const [frame, setFrame] = useState<Frame | null>(null);

  const lastLamp = character?.lastLamp ?? null;
  const { unseen, markSeen } = useSeenLamp(lastLamp);
  const phaseType = character?.phase.type;
  // 探索の結果は、判断の前（キャンプ）か倒れて街に戻ったときに一度だけ再生する
  const replaying = lastLamp !== null && unseen && (phaseType === "camp" || phaseType === "town");
  const sceneLamp = replaying && lastLamp ? lastLamp : demo.lamp;
  const sceneKey = replaying && lastLamp ? `lamp-${lastLamp.input.seed}-${lastLamp.input.depth}` : demo.key;

  const handleFinished = useCallback(() => {
    if (replaying) window.setTimeout(markSeen, AFTER_REPLAY_DELAY_MS);
    else window.setTimeout(demo.next, NEXT_DEMO_DELAY_MS);
  }, [replaying, markSeen, demo.next]);

  // 進む・もう一度はその場で次の探索が始まるので、通知も予約する
  const handleDecide = useCallback(
    (decision: Decision) => void (decision === "return" ? run : explore)(() => api.decide(decision)),
    [api, run, explore],
  );

  return (
    <main className="app">
      <Canvas shadows={SHADOWS ? "percentage" : false} dpr={[1, 1.5]} style={{ background: PALETTE.background }}>
        <DungeonScene
          key={sceneKey}
          lamp={sceneLamp}
          shadows={SHADOWS}
          onFrame={setFrame}
          onFinished={handleFinished}
        />
        <FpsProbe onReport={setFps} />
      </Canvas>
      <div className="hud-fps">{fps} fps</div>
      <div className="overlay">
        {error ? <p className="error">エラー：{error}</p> : null}
        {character ? (
          <GamePanel
            character={character}
            busy={busy}
            replaying={replaying}
            frame={frame}
            actions={actions}
            onDecide={handleDecide}
            onSkipReplay={markSeen}
          />
        ) : (
          <p className="panel compact">{error ? "サーバーに接続できません" : "読み込み中..."}</p>
        )}
      </div>
    </main>
  );
};
