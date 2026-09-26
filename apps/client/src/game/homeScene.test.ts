import { describe, expect, it } from "vitest";
import { createHomeScene, visibleArea, type HomeState } from "./homeScene";

const calm = { hurt: false, sleepy: false, carrying: false };
const state = (overrides: Partial<HomeState> = {}): HomeState => ({
  stage: { act: "home", since: 0 },
  mood: calm,
  hour: 13,
  lastActive: -Infinity,
  ...overrides,
});
const info = { dt: 0.016, time: 100, viewport: { width: 1200, height: 800 } };

describe("visibleArea", () => {
  it("PC では右のパネルの左側、スマホでは下のパネルの上側", () => {
    expect(visibleArea({ width: 1200, height: 800 })).toEqual({ x: 0, y: 0, width: 624, height: 800 });
    expect(visibleArea({ width: 390, height: 844 })).toEqual({ x: 0, y: 0, width: 390, height: 422 });
  });
});

describe("createHomeScene", () => {
  const scene = createHomeScene();

  it("家にいるときは、寝床にモンスターを描く", () => {
    const { input } = scene.frame(info, state());
    expect(input.models).toHaveLength(1);
    expect(input.visible.width).toBe(624);
  });

  it("冒険中はモンスターを描かず、玄関のランタンを灯す", () => {
    const { input } = scene.frame(info, state({ stage: { act: "away", since: 0 } }));
    expect(input.models).toHaveLength(0);
    expect(input.environment.glow[3]).toBeGreaterThanOrEqual(0.8);
  });

  it("送り出しの間は動き続け、落ち着いたら描く回数を減らしてよい", () => {
    expect(scene.frame(info, state({ stage: { act: "leaving", since: 99_000 } })).animating).toBe(true);
    expect(scene.frame(info, state()).animating).toBe(false);
  });

  it("操作した直後は、家にいてもなめらかに動かす", () => {
    expect(scene.frame(info, state({ lastActive: 95_000 })).animating).toBe(true);
  });

  it("ボロボロで帰ってきたときは包帯を巻いている", () => {
    const { input } = scene.frame(info, state({ mood: { ...calm, hurt: true } }));
    expect(input.models[0]?.pose.get("bandage")?.visible).toBe(true);
  });

  it("門の垂れ幕と旗竿の旗、2 枚の布を描く", () => {
    const { input } = scene.frame(info, state());
    expect(input.cloths).toHaveLength(2);
    expect(input.cloths.every((c) => c.pattern > 0)).toBe(true);
  });

  it("煙と魔法の光の粒を描く", () => {
    const { input } = scene.frame(info, state());
    expect(input.particles.length).toBeGreaterThanOrEqual(2);
  });
});
