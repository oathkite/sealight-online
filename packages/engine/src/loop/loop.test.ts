import { describe, expect, it, vi } from "vitest";
import { createLoop, createResolutionGovernor, type FrameInfo, type Scheduler } from "./loop";

/** requestAnimationFrame の代わり。step で時計を進めて、待っている関数を 1 回呼ぶ */
const fakeScheduler = () => {
  let now = 0;
  let queued: ((t: number) => void) | null = null;
  const listeners = new Set<() => void>();
  const scheduler: Scheduler = {
    now: () => now,
    request: (cb) => { queued = cb; return 1; },
    cancel: () => { queued = null; },
    onVisibilityChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
  const step = (ms: number) => { now += ms; const cb = queued; queued = null; cb?.(now); };
  const toggleVisibility = () => listeners.forEach((l) => l());
  return { scheduler, step, toggleVisibility, pending: () => queued !== null };
};

describe("createLoop", () => {
  it("動いている間は毎フレーム描き、経過時間（秒）を渡す", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: true }));
    createLoop(fake.scheduler, onFrame).start();
    fake.step(16);
    fake.step(16);
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame.mock.calls[1]?.[0]?.dt ?? 0).toBeCloseTo(0.016);
  });

  it("動く物がないときは、描く回数を減らして電池を守る", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: false }));
    createLoop(fake.scheduler, onFrame, { idleFps: 10 }).start();
    for (let i = 0; i < 12; i += 1) fake.step(16);
    // 約 0.2 秒の間に、10fps なら 2〜3 回だけ描く
    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("invalidate すると、動きがなくても次のフレームで描く", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: false }));
    const loop = createLoop(fake.scheduler, onFrame, { idleFps: 1 });
    loop.start();
    fake.step(16);
    const before = onFrame.mock.calls.length;
    loop.invalidate();
    fake.step(16);
    expect(onFrame.mock.calls.length).toBe(before + 1);
  });

  it("タブの見え方が変わったら、経過時間を数え直す（止まっていた間の分を一度に進めない）", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: true }));
    createLoop(fake.scheduler, onFrame).start();
    fake.step(16);
    fake.toggleVisibility();
    fake.step(3000);
    expect(onFrame.mock.calls[1]?.[0]?.dt).toBe(0);
    expect(fake.pending()).toBe(true);
  });

  it("長く止まっていた後でも、経過時間は上限で切る（動きが飛ばない）", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: true }));
    createLoop(fake.scheduler, onFrame, { maxDt: 0.1 }).start();
    fake.step(16);
    fake.step(5000);
    expect(onFrame.mock.calls[1]?.[0]?.dt).toBe(0.1);
  });

  it("stop すると呼ばれなくなる", () => {
    const fake = fakeScheduler();
    const onFrame = vi.fn((_frame: FrameInfo) => ({ animating: true }));
    const loop = createLoop(fake.scheduler, onFrame);
    loop.start();
    loop.stop();
    fake.step(16);
    expect(onFrame).not.toHaveBeenCalled();
    expect(loop.running()).toBe(false);
  });
});

describe("createResolutionGovernor", () => {
  it("重いフレームが続くと解像度を下げ、下限で止まる", () => {
    const governor = createResolutionGovernor({ min: 0.6, budgetMs: 16, window: 10 });
    for (let i = 0; i < 100; i += 1) governor.sample(40);
    expect(governor.scale()).toBeCloseTo(0.6);
  });

  it("軽いフレームが続くと、少しずつ上限まで戻す", () => {
    const governor = createResolutionGovernor({ min: 0.5, budgetMs: 16, window: 10 });
    for (let i = 0; i < 30; i += 1) governor.sample(40);
    const low = governor.scale();
    for (let i = 0; i < 400; i += 1) governor.sample(5);
    expect(governor.scale()).toBeGreaterThan(low);
    expect(governor.scale()).toBeLessThanOrEqual(1);
  });

  it("予算の範囲なら変えない", () => {
    const governor = createResolutionGovernor({ budgetMs: 16, window: 10 });
    for (let i = 0; i < 100; i += 1) governor.sample(15);
    expect(governor.scale()).toBe(1);
  });
});
