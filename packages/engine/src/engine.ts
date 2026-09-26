import type { Viewport } from "./camera/camera";
import { browserScheduler, createLoop, createResolutionGovernor, type FrameInfo } from "./loop/loop";
import { createRenderer, type Renderer } from "./render/gl/renderer";
import type { FrameInput } from "./render/types";

export type EngineFrame = FrameInfo & { readonly viewport: Viewport };

export type EngineStats = {
  readonly fps: number;
  readonly drawCalls: number;
  /** 実際に描いている画素の倍率（端末の倍率 × 重さに合わせた調整） */
  readonly pixelRatio: number;
};

export type EngineOptions = {
  readonly canvas: HTMLCanvasElement;
  /** low は影の地図を小さくし、画素の倍率の上限を下げる */
  readonly quality?: "high" | "low";
  /** 毎フレーム呼ぶ。描くものと、動く物があるか（なければ描く回数を減らす）を返す */
  readonly frame: (info: EngineFrame) => { readonly input: FrameInput; readonly animating: boolean };
  readonly onStats?: (stats: EngineStats) => void;
};

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

const build = ({ canvas, quality = "high", frame, onStats }: EngineOptions, renderer: Renderer) => {
  const governor = createResolutionGovernor({ min: 0.55, max: 1, budgetMs: 1000 / 50 });
  const maxRatio = quality === "low" ? 1.25 : 2;
  let viewport: Viewport = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
  let wasAnimating = false;
  let frames = 0;
  let windowStart: number | null = null;

  const loop = createLoop(browserScheduler(), (info) => {
    const { input, animating } = frame({ ...info, viewport });
    // 動いている間の間隔だけで重さを測る（間引いている間の長い間隔は数えない）
    const scale = animating && wasAnimating ? governor.sample(info.dt * 1000) : governor.scale();
    wasAnimating = animating;
    const pixelRatio = Math.min(maxRatio, window.devicePixelRatio || 1) * scale;
    const stats = renderer.render(input, { ...viewport, pixelRatio });
    frames += 1;
    windowStart ??= info.time;
    if (info.time - windowStart >= 1) {
      onStats?.({ fps: Math.round(frames / (info.time - windowStart)), drawCalls: stats.drawCalls, pixelRatio });
      frames = 0;
      windowStart = info.time;
    }
    return { animating };
  });

  const observer = new ResizeObserver(() => {
    viewport = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
    loop.invalidate();
  });
  observer.observe(canvas);

  const dispose = (): void => {
    loop.stop();
    observer.disconnect();
    renderer.dispose();
  };

  return {
    setStatic: renderer.setStatic,
    addModel: renderer.addModel,
    setTerrain: renderer.setTerrain,
    start: loop.start,
    stop: loop.stop,
    invalidate: loop.invalidate,
    dispose,
  };
};

export type Engine = ReturnType<typeof build>;

/**
 * エンジンの入口。キャンバスの大きさに追従し、フレームを回し、重さに合わせて解像度を調整して描く。
 * WebGL2 が使えない端末では、理由を添えた失敗を返す
 */
export const createEngine = (options: EngineOptions): Result<Engine, string> => {
  try {
    const renderer = createRenderer(options.canvas, { shadowSize: options.quality === "low" ? 1024 : 2048 });
    return { ok: true, value: build(options, renderer) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "描画を始められませんでした" };
  }
};
