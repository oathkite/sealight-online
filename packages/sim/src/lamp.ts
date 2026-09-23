import { floorConfig, spawnFoe, type Foe, type FoeKind } from "./catalog";
import { resolveBattle, type BattleEvent, type Combatant } from "./combat";
import { attackFor, defenseFor, maxHpFor, type Stats } from "./fighter";
import type { Equipment, Loot } from "./items";
import { rollLoot } from "./loot";
import { generateMaze, isFloor } from "./maze";
import { DIRECTIONS, findPath } from "./path";
import { createRng, type Rng } from "./rng";
import type { Maze, Point } from "./types";

/** POC から使っている標準フロアの大きさ。サーバーとクライアントで同じ値を使う */
export const STANDARD_FLOOR = { width: 21, height: 15 } as const;

export type Tactics = {
  /** HP がこの割合（%）を下回ったらポーションを飲む。0 なら飲まない */
  readonly potionThreshold: number;
  /** stairs：階段を見つけたら終える。treasure：フロアを歩き尽くしてから階段へ */
  readonly priority: "stairs" | "treasure";
};

export type Loadout = {
  readonly stats: Stats;
  readonly hp: number;
  readonly potions: number;
  readonly weapon: Equipment | null;
  readonly armor: Equipment | null;
};

export type LampInput = {
  readonly seed: number;
  readonly depth: number;
  readonly loadout: Loadout;
  readonly tactics: Tactics;
};

export type LampEvent =
  | { readonly type: "move"; readonly to: Point }
  | { readonly type: "encounter"; readonly at: Point; readonly foe: { readonly kind: FoeKind; readonly name: string; readonly hp: number } }
  | BattleEvent
  | { readonly type: "loot"; readonly at: Point; readonly loot: Loot }
  | { readonly type: "death"; readonly at: Point }
  | { readonly type: "stairs"; readonly at: Point };

export type LampOutcome = {
  readonly status: "survived" | "dead";
  readonly hp: number;
  readonly potions: number;
  readonly xp: number;
  readonly gold: number;
  readonly items: readonly Equipment[];
};

export type LampResult = {
  readonly input: LampInput;
  readonly maze: Maze;
  readonly events: readonly LampEvent[];
  readonly outcome: LampOutcome;
};

const keyOf = (p: Point): string => `${p.x},${p.y}`;
const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** 未踏の隣接マスを 1 つ選ぶ。分岐ではシードに従って揺らぎを持たせる */
const pickUnvisited = (maze: Maze, from: Point, visited: ReadonlySet<string>, rng: Rng): Point | undefined => {
  const options = DIRECTIONS.map((d) => ({ x: from.x + d.x, y: from.y + d.y })).filter(
    (p) => isFloor(maze, p) && !visited.has(keyOf(p)),
  );
  if (options.length <= 1) return options[0];
  return options[rng.int(options.length)];
};

/** 1 回（25 分）ぶんの探索の途中経過。enter でマスに入るたびに更新する */
const createExpedition = (input: LampInput, maze: Maze, rng: Rng) => {
  const { seed, depth, loadout, tactics } = input;
  // 乱数の消費順を固定するため、モンスターの種類は迷路生成の直後にまとめて決める
  const foes = new Map<string, Foe>(maze.monsters.map((p) => [keyOf(p), spawnFoe(rng, depth)]));
  const treasures = new Set(maze.treasures.map(keyOf));
  const events: LampEvent[] = [];
  const items: Equipment[] = [];
  let me: Combatant = {
    hp: loadout.hp,
    maxHp: maxHpFor(loadout.stats),
    attack: attackFor(loadout.stats, loadout.weapon),
    defense: defenseFor(loadout.stats, loadout.armor),
    potions: loadout.potions,
  };
  let xp = 0;
  let gold = 0;
  let dead = false;

  const fight = (at: Point, foe: Foe): void => {
    events.push({ type: "encounter", at, foe: { kind: foe.kind, name: foe.name, hp: foe.hp } });
    const battle = resolveBattle(rng, me, foe, tactics.potionThreshold);
    events.push(...battle.events);
    me = battle.combatant;
    if (battle.won) xp += foe.xp;
    else {
      dead = true;
      events.push({ type: "death", at });
    }
  };

  const open = (at: Point): void => {
    const loot = rollLoot(rng, { depth, luck: loadout.stats.luk, id: `${seed}:${items.length}:${events.length}` });
    events.push({ type: "loot", at, loot });
    if (loot.type === "gold") gold += loot.amount;
    else items.push(loot.item);
  };

  /** マスに入る。モンスターがいれば戦い、宝箱があれば開ける */
  const enter = (to: Point): void => {
    events.push({ type: "move", to });
    const key = keyOf(to);
    const foe = foes.get(key);
    if (foe) {
      foes.delete(key);
      fight(to, foe);
      if (dead) return;
    }
    if (treasures.delete(key)) open(to);
  };

  const finish = (): LampOutcome => ({
    status: dead ? "dead" : "survived",
    hp: me.hp,
    potions: me.potions,
    xp,
    gold,
    items,
  });

  return { events, enter, finish, isDead: () => dead };
};

/**
 * 1 回（25 分）ぶんの探索をシミュレーションする。同じ入力なら必ず同じ結果になる。
 * キャラは深さ優先で未踏のマスを歩き、行き止まりでは来た道を戻る。
 */
export const simulateLamp = (input: LampInput): LampResult => {
  const floor = floorConfig(input.depth);
  const rng = createRng(input.seed);
  const maze = generateMaze(
    { ...STANDARD_FLOOR, treasureCount: floor.treasureCount, monsterCount: floor.monsterCount },
    rng,
  );
  const expedition = createExpedition(input, maze, rng);
  const stopAtStairs = input.tactics.priority === "stairs";

  const visited = new Set<string>([keyOf(maze.start)]);
  const trail: Point[] = [maze.start];
  let position = maze.start;
  const walk = (to: Point): void => {
    position = to;
    expedition.enter(to);
  };

  while (trail.length > 0 && !expedition.isDead()) {
    const current = trail.at(-1) as Point;
    if (stopAtStairs && same(current, maze.stairs)) break;
    const next = pickUnvisited(maze, current, visited, rng);
    if (next) {
      visited.add(keyOf(next));
      trail.push(next);
      walk(next);
      continue;
    }
    trail.pop();
    const back = trail.at(-1);
    if (back) walk(back);
  }

  if (!expedition.isDead() && !same(position, maze.stairs)) {
    // 歩き尽くした後、階段まで最短経路で向かう
    for (const step of (findPath(maze, position, maze.stairs) ?? []).slice(1)) {
      walk(step);
      if (expedition.isDead()) break;
    }
  }
  if (!expedition.isDead()) expedition.events.push({ type: "stairs", at: maze.stairs });

  return { input, maze, events: expedition.events, outcome: expedition.finish() };
};
