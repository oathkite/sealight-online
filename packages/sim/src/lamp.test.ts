import { describe, expect, it } from "vitest";
import { simulateLamp, type LampEvent, type LampInput } from "./lamp";
import { isFloor } from "./maze";
import type { Point } from "./types";

const loadout = {
  stats: { str: 4, vit: 4, luk: 2 },
  hp: 44,
  potions: 2,
  weapon: { id: "w", slot: "weapon", name: "剣", rarity: "common", power: 3, value: 10 },
  armor: null,
} as const;

const input = (overrides: Partial<LampInput> = {}): LampInput => ({
  seed: 1234,
  depth: 1,
  loadout,
  tactics: { potionThreshold: 30, priority: "stairs" },
  ...overrides,
});

const moves = (events: readonly LampEvent[]): readonly Point[] =>
  events.flatMap((e) => (e.type === "move" ? [e.to] : []));

const isAdjacent = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe("simulateLamp", () => {
  it("同じ入力からは完全に同じ結果を返す", () => {
    expect(JSON.stringify(simulateLamp(input()))).toBe(JSON.stringify(simulateLamp(input())));
  });

  it("特定のシードの結果が変わらない（乱数の消費順が変わったら検知する）", () => {
    const { events, outcome } = simulateLamp(input({ seed: 42, depth: 3 }));
    expect({ eventCount: events.length, outcome }).toMatchSnapshot();
  });

  it("キャラは床の上を 1 マスずつ移動する", () => {
    const { maze, events } = simulateLamp(input({ tactics: { potionThreshold: 30, priority: "treasure" } }));
    let current = maze.start;
    for (const to of moves(events)) {
      expect(isFloor(maze, to)).toBe(true);
      expect(isAdjacent(current, to)).toBe(true);
      current = to;
    }
  });

  it("生き残れば最後は階段で、結果は survived", () => {
    const result = simulateLamp(input());
    expect(result.outcome.status).toBe("survived");
    expect(result.events.at(-1)).toEqual({ type: "stairs", at: result.maze.stairs });
  });

  it("倒れたら death で終わり、それ以降のイベントはない", () => {
    const weak = { ...loadout, stats: { str: 0, vit: 0, luk: 0 }, hp: 1, potions: 0, weapon: null };
    const result = simulateLamp(input({ depth: 30, loadout: weak }));
    expect(result.outcome.status).toBe("dead");
    expect(result.outcome.hp).toBe(0);
    expect(result.events.at(-1)?.type).toBe("death");
  });

  it("宝箱優先は階段優先より多くのマスを歩く", () => {
    const stairs = simulateLamp(input({ seed: 9 }));
    const treasure = simulateLamp(input({ seed: 9, tactics: { potionThreshold: 30, priority: "treasure" } }));
    expect(moves(treasure.events).length).toBeGreaterThanOrEqual(moves(stairs.events).length);
    expect(treasure.outcome.status === "dead" || treasure.events.at(-1)?.type === "stairs").toBe(true);
  });

  it("結果の戦利品と経験値はイベントの合計と一致する", () => {
    const result = simulateLamp(input({ depth: 2, tactics: { potionThreshold: 30, priority: "treasure" } }));
    const xp = result.events.reduce((sum, e) => sum + (e.type === "victory" ? e.xp : 0), 0);
    const gold = result.events.reduce((sum, e) => sum + (e.type === "loot" && e.loot.type === "gold" ? e.loot.amount : 0), 0);
    const items = result.events.flatMap((e) => (e.type === "loot" && e.loot.type === "item" ? [e.loot.item] : []));
    expect(result.outcome.xp).toBe(xp);
    expect(result.outcome.gold).toBe(gold);
    expect(result.outcome.items).toEqual(items);
  });

  it("装備の ID はシードごとに一意", () => {
    const result = simulateLamp(input({ depth: 5, tactics: { potionThreshold: 30, priority: "treasure" } }));
    const ids = result.outcome.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("1 未満の深さは例外を投げる", () => {
    expect(() => simulateLamp(input({ depth: 0 }))).toThrow(RangeError);
  });
});
