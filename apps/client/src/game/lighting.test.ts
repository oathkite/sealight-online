import { describe, expect, it } from "vitest";
import { environmentAt, hourOf, skyAt } from "./lighting";
import type { LightAnchor } from "./props/types";

const brightness = (c: readonly number[]) => (c[0] ?? 0) * 0.3 + (c[1] ?? 0) * 0.59 + (c[2] ?? 0) * 0.11;

const anchors: readonly LightAnchor[] = [
  { kind: "lamp", position: [0, 1, 0] },
  { kind: "lantern", position: [1, 1, 0] },
  { kind: "flame", position: [2, 1, 0] },
  { kind: "magic", position: [3, 0.3, 0] },
];

describe("hourOf", () => {
  it("時刻を 0 以上 24 未満の小数の時間にする", () => {
    expect(hourOf(new Date(2026, 8, 26, 18, 30))).toBe(18.5);
    expect(hourOf(new Date(2026, 8, 26, 0, 0))).toBe(0);
  });
});

describe("skyAt", () => {
  it("昼は夜より空も日差しも明るい", () => {
    expect(brightness(skyAt(13).horizon)).toBeGreaterThan(brightness(skyAt(0).horizon));
    expect(brightness(skyAt(13).sun)).toBeGreaterThan(brightness(skyAt(0).sun));
  });

  it("夜は灯りがともり、昼は消えている。夕方はその間", () => {
    expect(skyAt(23).lamp).toBe(1);
    expect(skyAt(12).lamp).toBe(0);
    expect(skyAt(18.3).lamp).toBeGreaterThan(0);
    expect(skyAt(18.3).lamp).toBeLessThan(1);
  });

  it("24 時と 0 時は同じ空になる（日付をまたいでも途切れない）", () => {
    expect(skyAt(24)).toEqual(skyAt(0));
    expect(skyAt(-1)).toEqual(skyAt(23));
  });

  it("光は常に地面より上から照らす", () => {
    for (let h = 0; h < 24; h += 0.5) expect(skyAt(h).sunDirection[1]).toBeGreaterThan(0.2);
  });

  it("夜だけ星が出る", () => {
    expect(skyAt(1).stars).toBeGreaterThan(0.5);
    expect(skyAt(13).stars).toBe(0);
  });
});

describe("environmentAt", () => {
  it("昼は窓とランタンの光が届かず、夜は届く", () => {
    const noon = environmentAt({ hour: 13, time: 0, anchors, waiting: false });
    const night = environmentAt({ hour: 23, time: 0, anchors, waiting: false });
    expect(noon.lights.some((l) => l.position[0] === 0)).toBe(false);
    expect(night.lights.some((l) => l.position[0] === 0)).toBe(true);
    expect(night.glow[0]).toBe(1);
  });

  it("帰りを待つ間は、昼でも玄関のランタンを灯す（窓は灯さない）", () => {
    const waiting = environmentAt({ hour: 13, time: 0, anchors, waiting: true });
    expect(waiting.glow[3]).toBeGreaterThanOrEqual(0.8);
    expect(waiting.glow[0]).toBe(0);
    expect(waiting.lights.some((l) => l.position[0] === 1)).toBe(true);
  });

  it("松明と魔法の光はいつも灯っていて、光は 4 つまで", () => {
    const env = environmentAt({ hour: 13, time: 3, anchors, waiting: false });
    expect(env.lights.some((l) => l.position[0] === 2)).toBe(true);
    expect(env.lights.some((l) => l.position[0] === 3)).toBe(true);
    expect(environmentAt({ hour: 23, time: 3, anchors: [...anchors, ...anchors], waiting: true }).lights.length).toBeLessThanOrEqual(4);
  });

  it("炎は時間とともにゆらめく", () => {
    const a = environmentAt({ hour: 13, time: 0.1, anchors, waiting: false }).glow[2];
    const b = environmentAt({ hour: 13, time: 0.37, anchors, waiting: false }).glow[2];
    expect(a).not.toBe(b);
  });
});
