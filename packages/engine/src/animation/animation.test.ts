import { describe, expect, it } from "vitest";
import { blendPose, clipDuration, createAnimator, sampleClip, sampleKeys, type Clip } from "./animation";

const bounce: Clip = {
  name: "bounce",
  fps: 24,
  frames: 24,
  loop: true,
  tracks: [
    { node: "body", channel: "position", keys: [[0, 0, 0, 0], [12, 0, 1, 0], [24, 0, 0, 0]] },
    { node: "body", channel: "scale", keys: [[0, 1, 1, 1], [12, 1, 2, 1], [24, 1, 1, 1]] },
  ],
};
const wave: Clip = { name: "wave", fps: 24, frames: 12, loop: false, tracks: [{ node: "arm", channel: "rotation", keys: [[0, 0, 0, 0], [12, 0, 0, 1]] }] };

describe("sampleKeys", () => {
  it("キーの上ではその値、キーの間はなめらかに移る", () => {
    const keys = [[0, 0, 0, 0], [10, 10, 0, 0]] as const;
    expect(sampleKeys(keys, 0)).toEqual([0, 0, 0]);
    expect(sampleKeys(keys, 10)).toEqual([10, 0, 0]);
    expect(sampleKeys(keys, 5)[0]).toBeCloseTo(5);
    // 端ではゆっくり動き出す（等速より遅い）
    expect(sampleKeys(keys, 1)[0]).toBeLessThan(1);
  });

  it("最初のキーより前と最後のキーより後は、端の値のまま", () => {
    const keys = [[2, 1, 1, 1], [4, 3, 3, 3]] as const;
    expect(sampleKeys(keys, 0)).toEqual([1, 1, 1]);
    expect(sampleKeys(keys, 9)).toEqual([3, 3, 3]);
  });
});

describe("sampleClip", () => {
  it("秒からコマに直して、node ごとの姿勢を返す", () => {
    const pose = sampleClip(bounce, 0.5);
    expect(pose.get("body")?.position?.[1]).toBeCloseTo(1);
    expect(pose.get("body")?.scale?.[1]).toBeCloseTo(2);
  });

  it("繰り返す動きは、長さを過ぎると最初に戻る", () => {
    expect(sampleClip(bounce, 1.5).get("body")?.position?.[1]).toBeCloseTo(1);
  });

  it("1 回だけの動きは、最後の姿勢で止まる", () => {
    expect(sampleClip(wave, 10).get("arm")?.rotation?.[2]).toBeCloseTo(1);
  });

  it("長さは秒で返す", () => {
    expect(clipDuration(bounce)).toBe(1);
  });
});

describe("blendPose", () => {
  it("2 つの姿勢を割合で混ぜる。片方にない値は元の値（ずれ 0、倍率 1）として混ぜる", () => {
    const a = new Map([["body", { position: [0, 1, 0] as const }]]);
    const b = new Map([["body", { scale: [1, 3, 1] as const }]]);
    const mixed = blendPose(a, b, 0.5).get("body");
    expect(mixed?.position?.[1]).toBeCloseTo(0.5);
    expect(mixed?.scale?.[1]).toBeCloseTo(2);
  });
});

describe("createAnimator", () => {
  it("再生中の動きを時間とともに進める", () => {
    const animator = createAnimator({ bounce, wave });
    animator.play("bounce");
    expect(animator.update(0.5).get("body")?.position?.[1]).toBeCloseTo(1);
  });

  it("別の動きに切り替えると、前の姿勢から少しずつ移る", () => {
    const animator = createAnimator({ bounce, wave }, 0.2);
    animator.play("bounce");
    animator.update(0.5);
    animator.play("wave");
    const midway = animator.update(0.1);
    expect(midway.get("body")?.position?.[1]).toBeCloseTo(0.5, 1);
    const done = animator.update(0.2);
    expect(done.get("body")?.position?.[1] ?? 0).toBeCloseTo(0);
  });

  it("速さを変えると、進み方が変わる", () => {
    const animator = createAnimator({ bounce, wave });
    animator.play("bounce", 0.5);
    expect(animator.update(1).get("body")?.position?.[1]).toBeCloseTo(1);
  });

  it("同じ動きをもう一度指定しても、最初からやり直さない", () => {
    const animator = createAnimator({ bounce, wave });
    animator.play("bounce");
    animator.update(0.25);
    animator.play("bounce");
    expect(animator.update(0.25).get("body")?.position?.[1]).toBeCloseTo(1);
  });

  it("知らない名前は無視する", () => {
    const animator = createAnimator({ bounce });
    animator.play("nothing");
    expect(animator.update(0.1).size).toBe(0);
  });
});
