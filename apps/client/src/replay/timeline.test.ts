import { describe, expect, it } from "vitest";
import type { LampEvent } from "@sealight/sim";
import { buildTimeline, frameAt } from "./timeline";

const events: readonly LampEvent[] = [
  { type: "move", to: { x: 2, y: 1 } },
  { type: "move", to: { x: 3, y: 1 } },
  { type: "treasure", at: { x: 3, y: 1 } },
  { type: "move", to: { x: 3, y: 2 } },
  { type: "stairs", at: { x: 3, y: 2 } },
];
const timeline = buildTimeline({ x: 1, y: 1 }, events);

describe("buildTimeline", () => {
  it("スタート地点と移動先を順番に並べる", () => {
    expect(timeline.positions).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]);
  });

  it("宝箱を拾った時点を、何歩目かで記録する", () => {
    expect(timeline.pickups).toEqual([{ at: { x: 3, y: 1 }, step: 2 }]);
  });

  it("移動がなければスタート地点だけになる", () => {
    const empty = buildTimeline({ x: 1, y: 1 }, [{ type: "stairs", at: { x: 1, y: 1 } }]);
    expect(empty.positions).toEqual([{ x: 1, y: 1 }]);
  });
});

describe("frameAt", () => {
  it("開始時点はスタート地点にいる", () => {
    const frame = frameAt(timeline, 0, 2);
    expect(frame.position).toEqual({ x: 1, y: 1 });
    expect(frame.done).toBe(false);
  });

  it("マスの間は線形に補間する", () => {
    // 2 マス/秒で 0.25 秒 = 0.5 歩
    expect(frameAt(timeline, 0.25, 2).position).toEqual({ x: 1.5, y: 1 });
  });

  it("進行方向を返す", () => {
    expect(frameAt(timeline, 1.25, 2).heading).toEqual({ x: 0, y: 1 });
  });

  it("宝箱のマスに着いたら拾ったことになる", () => {
    expect(frameAt(timeline, 0.9, 2).picked.size).toBe(0);
    expect([...frameAt(timeline, 1.0, 2).picked]).toEqual(["3,1"]);
  });

  it("最後まで進むと終点で止まり done になる", () => {
    const frame = frameAt(timeline, 100, 2);
    expect(frame.position).toEqual({ x: 3, y: 2 });
    expect(frame.done).toBe(true);
  });

  it("負の経過時間は開始時点として扱う", () => {
    expect(frameAt(timeline, -5, 2).position).toEqual({ x: 1, y: 1 });
  });
});
