import { describe, expect, it } from "vitest";
import { simulateLamp } from "./lamp";
import type { LampEvent, Point } from "./types";
import { isFloor } from "./maze";

const moves = (events: readonly LampEvent[]): readonly Point[] =>
  events.flatMap((e) => (e.type === "move" ? [e.to] : []));

const isAdjacent = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe("simulateLamp", () => {
  const input = { seed: 1234, width: 21, height: 15, treasureCount: 3 } as const;

  it("同じ入力からは完全に同じ結果を返す（サーバーとクライアントで結果を共有できる）", () => {
    expect(JSON.stringify(simulateLamp(input))).toBe(JSON.stringify(simulateLamp(input)));
  });

  it("シードが違えば結果も違う", () => {
    const other = simulateLamp({ ...input, seed: 4321 });
    expect(other.events).not.toEqual(simulateLamp(input).events);
  });

  it("キャラは床の上を 1 マスずつ移動する", () => {
    const { maze, events } = simulateLamp(input);
    let current = maze.start;
    for (const to of moves(events)) {
      expect(isFloor(maze, to)).toBe(true);
      expect(isAdjacent(current, to)).toBe(true);
      current = to;
    }
  });

  it("最後のイベントは階段の発見で、その位置は迷路の階段と一致する", () => {
    const { maze, events } = simulateLamp(input);
    const last = events.at(-1);
    expect(last).toEqual({ type: "stairs", at: maze.stairs });
    expect(moves(events).at(-1)).toEqual(maze.stairs);
  });

  it("通った宝箱は一度だけ拾う", () => {
    const { maze, events } = simulateLamp(input);
    const visited = new Set(moves(events).map((p) => `${p.x},${p.y}`));
    const picked = events.flatMap((e) => (e.type === "treasure" ? [`${e.at.x},${e.at.y}`] : []));
    const expected = maze.treasures.map((p) => `${p.x},${p.y}`).filter((k) => visited.has(k));
    expect([...picked].sort()).toEqual([...expected].sort());
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("宝箱を拾うイベントは、そのマスへの移動の直後に来る", () => {
    const { events } = simulateLamp(input);
    events.forEach((event, i) => {
      if (event.type !== "treasure") return;
      const prev = events[i - 1];
      expect(prev).toEqual({ type: "move", to: event.at });
    });
  });

  it("小さな迷路でも階段まで到達する", () => {
    const { maze, events } = simulateLamp({ seed: 1, width: 5, height: 5, treasureCount: 0 });
    expect(events.at(-1)).toEqual({ type: "stairs", at: maze.stairs });
  });
});
