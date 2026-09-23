import { describe, expect, it } from "vitest";
import type { LampEvent } from "@sealight/sim";
import { BEAT, buildTimeline, frameAt } from "./timeline";

const events: readonly LampEvent[] = [
  { type: "move", to: { x: 2, y: 1 } },
  { type: "encounter", at: { x: 2, y: 1 }, foe: { kind: "slime", name: "スライム", hp: 8 } },
  { type: "attack", by: "player", damage: 5, hp: 3 },
  { type: "attack", by: "foe", damage: 2, hp: 18 },
  { type: "attack", by: "player", damage: 5, hp: 0 },
  { type: "victory", xp: 3 },
  { type: "move", to: { x: 3, y: 1 } },
  { type: "loot", at: { x: 3, y: 1 }, loot: { type: "gold", amount: 10 } },
  { type: "stairs", at: { x: 3, y: 1 } },
];

const timeline = buildTimeline({ start: { x: 1, y: 1 }, hp: 20, maxHp: 20, events });
// n 番目のイベントが起きた直後の時刻（イベントは拍の開始時点で起きる）
const timeAt = (n: number): number => (timeline.beats[n - 1]?.start ?? 0) + 0.01;

describe("buildTimeline", () => {
  it("イベントごとに拍を作り、合計時間はその和", () => {
    expect(timeline.beats).toHaveLength(events.length);
    const sum = events.reduce((s, e) => s + BEAT[e.type], 0);
    expect(timeline.duration).toBeCloseTo(sum);
  });
});

describe("frameAt", () => {
  it("開始時点はスタート地点で、HP は満タン", () => {
    const frame = frameAt(timeline, 0);
    expect(frame.position).toEqual({ x: 1, y: 1 });
    expect(frame.hp).toBe(20);
    expect(frame.status).toBe("walking");
  });

  it("移動の拍の途中はマスの間を補間する", () => {
    expect(frameAt(timeline, BEAT.move / 2).position).toEqual({ x: 1.5, y: 1 });
  });

  it("遭遇すると戦闘中になり、敵の HP を表示する", () => {
    const frame = frameAt(timeline, timeAt(2));
    expect(frame.status).toBe("fighting");
    expect(frame.foe).toEqual({ name: "スライム", hp: 8, maxHp: 8 });
  });

  it("攻撃を受けると HP が減る", () => {
    const frame = frameAt(timeline, timeAt(4));
    expect(frame.hp).toBe(18);
    expect(frame.foe?.hp).toBe(3);
  });

  it("勝つと敵は消え、倒したマスとして記録される", () => {
    const frame = frameAt(timeline, timeAt(6));
    expect(frame.foe).toBeNull();
    expect([...frame.defeated]).toEqual(["2,1"]);
    expect(frame.status).toBe("walking");
  });

  it("宝箱を開けると開封済みになり、得たものがログに出る", () => {
    const frame = frameAt(timeline, timeAt(8));
    expect([...frame.opened]).toEqual(["3,1"]);
    expect(frame.log).toContain("10 ゴールド");
  });

  it("最後まで進むと done", () => {
    const frame = frameAt(timeline, timeline.duration + 5);
    expect(frame.status).toBe("done");
    expect(frame.position).toEqual({ x: 3, y: 1 });
  });

  it("倒れた探索は dead で終わる", () => {
    const deathTimeline = buildTimeline({
      start: { x: 1, y: 1 },
      hp: 2,
      maxHp: 20,
      events: [
        { type: "move", to: { x: 2, y: 1 } },
        { type: "encounter", at: { x: 2, y: 1 }, foe: { kind: "goblin", name: "ゴブリン", hp: 14 } },
        { type: "attack", by: "player", damage: 3, hp: 11 },
        { type: "attack", by: "foe", damage: 5, hp: 0 },
        { type: "death", at: { x: 2, y: 1 } },
      ],
    });
    const frame = frameAt(deathTimeline, deathTimeline.duration);
    expect(frame.status).toBe("dead");
    expect(frame.hp).toBe(0);
  });

  it("攻撃の直後は、攻撃された側が点滅する", () => {
    expect(frameAt(timeline, timeAt(4)).flash).toBe("player");
    expect(frameAt(timeline, timeAt(3)).flash).toBe("foe");
  });
});
