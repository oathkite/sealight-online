import { useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { simulateLamp, STANDARD_FLOOR } from "@sealight/sim";
import { FpsProbe } from "@/hud/FpsProbe";
import { LampPanel } from "@/hud/LampPanel";
import { useLamp } from "@/lamp/useLamp";
import { DungeonScene } from "@/scene/DungeonScene";
import { PALETTE } from "@/scene/palette";

const NEXT_FLOOR_DELAY_MS = 1200;
const BASE_SEED = 20260923;

const params = new URLSearchParams(window.location.search);
const SHADOWS = params.get("shadows") !== "0";

export const App = () => {
  const [demoFloor, setDemoFloor] = useState(1);
  const [fps, setFps] = useState(0);
  const [picked, setPicked] = useState(0);
  const { view, start, reset } = useLamp();

  // 灯の結果が届くまでは、デモ用のフロアを繰り返し再生する
  const serverResult = view.phase === "done" ? view.result : null;
  const demoResult = useMemo(() => simulateLamp({ seed: BASE_SEED + demoFloor, ...STANDARD_FLOOR }), [demoFloor]);
  const result = serverResult ?? demoResult;
  const sceneKey = serverResult ? `lamp-${serverResult.input.seed}` : `demo-${demoFloor}`;

  const handleFinished = useCallback(() => {
    if (serverResult) return;
    window.setTimeout(() => setDemoFloor((f) => f + 1), NEXT_FLOOR_DELAY_MS);
  }, [serverResult]);

  return (
    <main className="app">
      <Canvas shadows={SHADOWS ? "percentage" : false} dpr={[1, 1.5]} style={{ background: PALETTE.background }}>
        <DungeonScene key={sceneKey} result={result} shadows={SHADOWS} onPicked={setPicked} onFinished={handleFinished} />
        <FpsProbe onReport={setFps} />
      </Canvas>
      <div className="hud">
        <div>{serverResult ? "灯の結果" : `デモ 地下 ${demoFloor} 階`}</div>
        <div>
          宝箱 {picked} / {result.maze.treasures.length}
        </div>
        <div className="hud-fps">{fps} fps</div>
      </div>
      <LampPanel view={view} onStart={() => void start()} onReset={reset} />
    </main>
  );
};
