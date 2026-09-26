import { useEffect, useRef, useState } from "react";
import { createEngine, type Engine, type EngineStats } from "@sealight/engine";
import type { Mood } from "@/scene/stage";
import type { Stage } from "@/scene/useStage";
import { createHomeScene, type HomeScene, type HomeState } from "./homeScene";

type HomeViewProps = {
  readonly stage: Stage;
  readonly mood: Mood;
  readonly hour: number;
  readonly quality: "high" | "low";
  readonly onStats?: (stats: EngineStats) => void;
};

/** 家の場面は作るのに時間がかかるので、一度だけ作って使い回す */
let shared: HomeScene | null = null;
const homeScene = (): HomeScene => (shared ??= createHomeScene());

const startEngine = (
  canvas: HTMLCanvasElement,
  quality: HomeViewProps["quality"],
  read: () => HomeState,
  onStats: (stats: EngineStats) => void,
  onFailure: (message: string) => void,
): Engine | null => {
  const scene = homeScene();
  const created = createEngine({ canvas, quality, frame: (info) => scene.frame(info, read()), onStats });
  if (!created.ok) {
    onFailure(created.error);
    return null;
  }
  scene.install(created.value);
  created.value.start();
  return created.value;
};

/**
 * 家の場面を描くキャンバス。エンジンは一度だけ作り、演出の場面や時刻は ref で毎フレーム読む
 */
export const HomeView = ({ stage, mood, hour, quality, onStats }: HomeViewProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<HomeState>({ stage, mood, hour, lastActive: -Infinity });
  const report = useRef(onStats);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    state.current = { ...state.current, stage, mood, hour };
  }, [stage, mood, hour]);

  useEffect(() => {
    report.current = onStats;
  }, [onStats]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const markActive = () => { state.current = { ...state.current, lastActive: performance.now() }; };
    // 開いた直後もなめらかに動かす
    markActive();
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    const engine = startEngine(element, quality, () => state.current, (stats) => report.current?.(stats), setFailure);
    return () => {
      engine?.dispose();
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
    };
  }, [quality]);

  return (
    <>
      <canvas ref={canvas} className="home-canvas" aria-label="モンスターの家" />
      {failure ? <p className="home-failure">{failure}</p> : null}
    </>
  );
};
