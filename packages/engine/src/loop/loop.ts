/** 時計とフレームの予約。ブラウザでは performance.now と requestAnimationFrame を渡す */
export type Scheduler = {
  readonly now: () => number;
  readonly request: (callback: (time: number) => void) => number;
  readonly cancel: (id: number) => void;
  /** 見える、見えないが変わったら呼ぶ。戻り値で登録を外す */
  readonly onVisibilityChange: (callback: () => void) => () => void;
};

export type FrameInfo = {
  /** 前に描いてからの秒数（上限つき） */
  readonly dt: number;
  /** 秒 */
  readonly time: number;
};

/** animating が false のときは、次から描く回数を減らす */
export type FrameResult = { readonly animating: boolean };

export type LoopOptions = {
  /** 動く物がないときの描く回数（1 秒あたり） */
  readonly idleFps?: number;
  readonly maxDt?: number;
};

export const browserScheduler = (): Scheduler => ({
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  onVisibilityChange: (callback) => {
    document.addEventListener("visibilitychange", callback);
    return () => document.removeEventListener("visibilitychange", callback);
  },
});

/**
 * フレームを回す。放置ゲームなので、動く物がない間は描く回数を減らして電池と CPU を守る。
 * タブが見えない間はブラウザが requestAnimationFrame を止めるので、それに任せる
 * （WebView によっては document.hidden が実際と食い違うため、こちらでは止めない）。
 * 見えるようになったら経過時間を数え直し、止まっていた間の分を一度に進めない
 */
export const createLoop = (scheduler: Scheduler, onFrame: (frame: FrameInfo) => FrameResult, options: LoopOptions = {}) => {
  const idleInterval = 1000 / (options.idleFps ?? 8);
  // 間引いている間の 1 コマ分より長くして、間引き中も動きが実時間どおりに進むようにする
  const maxDt = options.maxDt ?? Math.max(0.25, (idleInterval / 1000) * 1.5);
  let id: number | null = null;
  let running = false;
  let last: number | null = null;
  let animating = true;
  let dirty = true;
  let unsubscribe: (() => void) | null = null;

  const schedule = (): void => {
    if (running && id === null) id = scheduler.request(tick);
  };

  const tick = (): void => {
    id = null;
    if (!running) return;
    schedule();
    const now = scheduler.now();
    const elapsed = last === null ? 0 : now - last;
    if (!animating && !dirty && elapsed < idleInterval) return;
    const result = onFrame({ dt: Math.min(elapsed / 1000, maxDt), time: now / 1000 });
    last = now;
    animating = result.animating;
    dirty = false;
  };

  const start = (): void => {
    if (running) return;
    running = true;
    unsubscribe = scheduler.onVisibilityChange(() => {
      last = null;
      dirty = true;
    });
    schedule();
  };

  const stop = (): void => {
    running = false;
    if (id !== null) scheduler.cancel(id);
    id = null;
    unsubscribe?.();
    unsubscribe = null;
  };

  return { start, stop, invalidate: () => { dirty = true; }, running: () => running };
};

export type GovernorOptions = {
  readonly min?: number;
  readonly max?: number;
  /** 1 フレームにかけてよい時間（ミリ秒） */
  readonly budgetMs?: number;
  /** 何フレームごとに見直すか */
  readonly window?: number;
};

/**
 * 描画の重さに合わせて解像度（画素の倍率）を決める。重いフレームが続くと下げ、
 * 軽いフレームがしばらく続くと少しずつ戻す。上げ下げを繰り返さないよう、戻すときは慎重にする
 */
export const createResolutionGovernor = ({ min = 0.5, max = 1, budgetMs = 1000 / 55, window = 30 }: GovernorOptions = {}) => {
  let scale = max;
  let total = 0;
  let count = 0;
  let calm = 0;

  const sample = (frameMs: number): number => {
    total += frameMs;
    count += 1;
    if (count < window) return scale;
    const average = total / count;
    total = 0;
    count = 0;
    if (average > budgetMs * 1.25) {
      scale = Math.max(min, scale - 0.1);
      calm = 0;
    } else if (average < budgetMs * 0.7) {
      calm += 1;
      if (calm >= 4) {
        scale = Math.min(max, scale + 0.05);
        calm = 0;
      }
    } else calm = 0;
    return scale;
  };

  return { sample, scale: () => scale };
};
