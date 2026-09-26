import { describe, expect, it } from "vitest";
import { sampleClip } from "@sealight/engine";
import { CLIPS } from "./clips";
import { NODE_NAMES } from "./rig";

describe("モンスターの動き", () => {
  it("5 つの動きがあり、どれも骨組みにある node だけを動かす", () => {
    expect(Object.keys(CLIPS).sort()).toEqual(["cheer", "droop", "hop", "idle", "sleep"]);
    for (const clip of Object.values(CLIPS)) for (const track of clip.tracks) expect(NODE_NAMES).toContain(track.node);
  });

  it("繰り返す動きは、最初と最後の姿勢が同じ（つなぎ目で跳ねない）", () => {
    for (const clip of Object.values(CLIPS)) {
      for (const track of clip.tracks) {
        const first = track.keys[0];
        const last = track.keys[track.keys.length - 1];
        expect(first?.[0]).toBe(0);
        expect(last?.[0]).toBe(clip.frames);
        if (track.channel === "rotation" && track.node === "root") continue;
        expect(last?.slice(1)).toEqual(first?.slice(1));
      }
    }
  });

  it("待機中にまばたきをする", () => {
    const open = sampleClip(CLIPS.idle, 0).get("eye_l")?.scale?.[1];
    const closed = sampleClip(CLIPS.idle, 33 / 24).get("eye_l")?.scale?.[1];
    expect(open).toBeCloseTo(1);
    expect(closed).toBeLessThan(0.2);
  });

  it("跳ねるとき、半ばで一番高く上がる", () => {
    const top = sampleClip(CLIPS.hop, 6 / 24).get("root")?.position?.[1] ?? 0;
    const ground = sampleClip(CLIPS.hop, 0).get("root")?.position?.[1] ?? 1;
    expect(top).toBeGreaterThan(0.2);
    expect(ground).toBeCloseTo(0);
  });

  it("しょんぼりすると耳が外へ垂れ、目が半分閉じる", () => {
    const pose = sampleClip(CLIPS.droop, 0.5);
    expect(pose.get("ear_l")?.rotation?.[2]).toBeLessThan(-0.5);
    expect(pose.get("ear_r")?.rotation?.[2]).toBeGreaterThan(0.5);
    expect(pose.get("eye_l")?.scale?.[1]).toBeCloseTo(0.5);
  });

  it("喜ぶと 1 回転してから、正面に戻る", () => {
    const spinning = sampleClip(CLIPS.cheer, 10 / 24).get("root")?.rotation?.[1] ?? 0;
    const after = sampleClip(CLIPS.cheer, 25 / 24).get("root")?.rotation?.[1] ?? 1;
    expect(spinning).toBeGreaterThan(1);
    expect(after).toBeCloseTo(0);
  });
});
