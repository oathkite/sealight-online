import { describe, expect, it } from "vitest";
import { simulateExpedition } from "./expedition";
import type { ExpeditionInput, ExpeditionLoadout, LootSource } from "./expedition-types";
import { generateFloor } from "./floor";
import { toIndex } from "./path";

const strong: ExpeditionLoadout = { stats: { str: 30, vit: 30, luk: 0 }, potions: 0, rations: 11, weapon: null, armor: null };
const weak: ExpeditionLoadout = { stats: { str: 0, vit: 0, luk: 0 }, potions: 0, rations: 11, weapon: null, armor: null };

const input = (overrides: Partial<ExpeditionInput> = {}): ExpeditionInput => ({
  seed: 1234,
  target: 3,
  loadout: strong,
  maps: [],
  potionThreshold: 30,
  ...overrides,
});

const floorsVisited = (result: ReturnType<typeof simulateExpedition>) =>
  result.events.flatMap((e) => (e.type === "floor" ? [`${e.direction}${e.depth}`] : []));

describe("simulateExpedition", () => {
  it("同じ入力からは完全に同じ結果を返す", () => {
    expect(JSON.stringify(simulateExpedition(input()))).toBe(JSON.stringify(simulateExpedition(input())));
  });

  it("特定のシードの結果が変わらない（乱数の消費順が変わったら検知する）", () => {
    const { events, outcome } = simulateExpedition(input({ seed: 42, target: 4, loadout: { ...strong, stats: { str: 6, vit: 6, luk: 2 } } }));
    expect({ eventCount: events.length, outcome: { ...outcome, maps: outcome.maps.map((m) => m.length) } }).toMatchSnapshot();
  });

  it("1 階から目標の階まで降り、折り返して 1 階まで歩いて戻る", () => {
    const result = simulateExpedition(input());
    expect(result.outcome.status).toBe("returned");
    expect(result.outcome.reached).toBe(3);
    expect(floorsVisited(result)).toEqual(["down1", "down2", "down3", "up3", "up2", "up1"]);
    expect(result.events.some((e) => e.type === "turnaround" && e.depth === 3)).toBe(true);
    expect(result.events.at(-1)?.type).toBe("home");
  });

  it("目標の階に着くと、その階ならではの宝が手に入る", () => {
    const result = simulateExpedition(input());
    expect(result.events.some((e) => e.type === "loot" && e.source === "goal" && e.depth === 3)).toBe(true);
  });

  it("かかった時間は最後の出来事の時刻と一致し、0 より大きい", () => {
    const result = simulateExpedition(input());
    expect(result.outcome.durationSec).toBeGreaterThan(0);
    const last = result.events.at(-1);
    expect(last?.type).toBe("home");
    expect(last && "t" in last ? last.t : null).toBe(result.outcome.durationSec);
  });

  it("弱いと途中で倒れ、倒れた後の出来事はない", () => {
    const result = simulateExpedition(input({ target: 15, loadout: weak }));
    expect(result.outcome.status).toBe("fainted");
    expect(result.outcome.hp).toBe(0);
    expect(result.events.at(-1)?.type).toBe("death");
  });

  it("歩いた階の地図が残り、階段の場所も地図に載る。倒れても地図は残る", () => {
    const result = simulateExpedition(input({ target: 15, loadout: weak }));
    const { reached, maps } = result.outcome;
    expect(reached).toBeGreaterThanOrEqual(1);
    for (let depth = 1; depth < reached; depth += 1) {
      const floor = generateFloor(depth);
      expect(maps[depth - 1]).toContain(toIndex(floor, floor.stairs));
    }
  });

  it("地図がある階は迷わないので、同じ冒険でも早く帰ってくる", () => {
    const first = simulateExpedition(input());
    const second = simulateExpedition(input({ maps: first.outcome.maps }));
    expect(second.outcome.durationSec).toBeLessThan(first.outcome.durationSec);
  });

  it("食料を持たせないと飢え、HP が削られる", () => {
    const fed = simulateExpedition(input({ target: 2 }));
    const hungry = simulateExpedition(input({ target: 2, loadout: { ...strong, rations: 0 } }));
    expect(hungry.events.some((e) => e.type === "starving")).toBe(true);
    expect(fed.events.some((e) => e.type === "starving")).toBe(false);
    expect(hungry.outcome.hp).toBeLessThan(fed.outcome.hp);
  });

  it("食料を食べると残りが減り、食べた分だけ荷物の枠が空く", () => {
    const result = simulateExpedition(input());
    const eats = result.events.filter((e) => e.type === "eat");
    expect(eats.length).toBeGreaterThan(0);
    expect(result.outcome.rations).toBe(strong.rations - eats.length);
  });

  it("荷物がいっぱいのときに拾った装備は置いてくる", () => {
    const full = { ...strong, rations: 12, stats: { ...strong.stats, luk: 30 } };
    const result = simulateExpedition(input({ target: 5, loadout: full }));
    const dropped = result.events.filter((e) => e.type === "bagFull");
    expect(dropped.length).toBeGreaterThan(0);
  });

  it("いっぱいで強い物を拾ったら前に拾った弱い物と入れ替え、置いてきた物には拾った場所を残す", () => {
    const tight = { ...strong, rations: 8, stats: { ...strong.stats, luk: 30 } };
    const { events } = simulateExpedition(input({ target: 8, loadout: tight }));
    const found = new Map<string, LootSource>();
    let swapped = 0;
    let latest = "";
    for (const e of events) {
      if (e.type === "loot" && e.loot.type === "item") {
        found.set(e.loot.item.id, e.source);
        latest = e.loot.item.id;
      }
      if (e.type !== "bagFull") continue;
      expect(e.source).toBe(found.get(e.item.id));
      if (e.item.id !== latest) swapped += 1;
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it("持ち帰る装備の ID は一意", () => {
    const result = simulateExpedition(input({ target: 6, loadout: { ...strong, rations: 4, stats: { ...strong.stats, luk: 20 } } }));
    const ids = result.outcome.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("範囲外の目標は例外を投げる", () => {
    expect(() => simulateExpedition(input({ target: 0 }))).toThrow(RangeError);
    expect(() => simulateExpedition(input({ target: 21 }))).toThrow(RangeError);
  });
});
