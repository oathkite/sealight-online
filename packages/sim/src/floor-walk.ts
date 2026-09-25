import { floorConfig, spawnFoe, type Foe } from "./catalog";
import { PACE } from "./expedition-types";
import type { Floor } from "./floor";
import type { Journey } from "./journey";
import { isFloor } from "./maze";
import { DIRECTIONS, findPath, toIndex } from "./path";
import { shuffle, type Rng } from "./rng";
import type { Point } from "./types";

/** 冒険中の 1 つの階の様子。敵と宝の配置は、その冒険で初めて入ったときに決まる */
export type FloorVisit = {
  readonly floor: Floor;
  readonly foes: Map<number, Foe>;
  readonly chests: Set<number>;
  /** 地図（歩いたことのあるマス）。この冒険で歩いたマスも足していく */
  readonly known: Set<number>;
};

const indexOf = (visit: FloorVisit, p: Point): number => toIndex(visit.floor, p);

/** 入口と階段以外の床マスを、乱数で並べ替えて返す */
const openCells = (rng: Rng, floor: Floor, exclude: ReadonlySet<number>): readonly number[] => {
  const cells = floor.cells.flatMap((isOpen, i) => (isOpen && !exclude.has(i) ? [i] : []));
  return shuffle(rng, cells);
};

/** 行きで初めて入ったときに、宝箱と敵を置く */
export const beginVisit = (rng: Rng, floor: Floor, known: readonly number[]): FloorVisit => {
  const config = floorConfig(floor.depth);
  const reserved = new Set([toIndex(floor, floor.entrance), toIndex(floor, floor.stairs)]);
  const cells = openCells(rng, floor, reserved);
  const chests = new Set(cells.slice(0, config.treasureCount));
  const foeCells = cells.slice(config.treasureCount, config.treasureCount + config.monsterCount);
  const foes = new Map(foeCells.map((cell) => [cell, spawnFoe(rng, floor.depth)] as const));
  return { floor, foes, chests, known: new Set(known) };
};

/** 帰り道に、新しく敵が湧く */
export const respawnForReturn = (rng: Rng, visit: FloorVisit): void => {
  const count = Math.round(floorConfig(visit.floor.depth).monsterCount * PACE.returnSpawnRatio);
  const reserved = new Set([
    indexOf(visit, visit.floor.entrance),
    indexOf(visit, visit.floor.stairs),
    ...visit.foes.keys(),
  ]);
  for (const cell of openCells(rng, visit.floor, reserved).slice(0, count)) {
    visit.foes.set(cell, spawnFoe(rng, visit.floor.depth));
  }
};

/** マスに入る。敵がいれば戦い、宝箱があれば開ける */
const enter = (journey: Journey, visit: FloorVisit, to: Point): void => {
  const cell = indexOf(visit, to);
  visit.known.add(cell);
  journey.step(visit.floor.depth);
  if (journey.isDead()) return;
  const foe = visit.foes.get(cell);
  if (foe) {
    visit.foes.delete(cell);
    journey.fight(visit.floor.depth, foe);
    if (journey.isDead()) return;
  }
  if (visit.chests.delete(cell)) journey.open(visit.floor.depth, "chest");
};

const walkPath = (journey: Journey, visit: FloorVisit, path: readonly Point[]): void => {
  for (const to of path.slice(1)) {
    enter(journey, visit, to);
    if (journey.isDead()) return;
  }
};

/** 地図を頼りに、知っているマスだけを通る道を探す */
const knownPath = (visit: FloorVisit, from: Point, to: Point): readonly Point[] | null =>
  findPath(visit.floor, from, to, (i) => visit.known.has(i));

/** 手探りで歩き、階段を見つけたら止まる（深さ優先。行き止まりでは来た道を戻る） */
const explore = (rng: Rng, journey: Journey, visit: FloorVisit): void => {
  const { floor } = visit;
  const visited = new Set([indexOf(visit, floor.entrance)]);
  const trail: Point[] = [floor.entrance];
  while (trail.length > 0 && !journey.isDead()) {
    const current = trail.at(-1) as Point;
    if (current.x === floor.stairs.x && current.y === floor.stairs.y) return;
    const options = DIRECTIONS.map((d) => ({ x: current.x + d.x, y: current.y + d.y })).filter(
      (p) => isFloor(floor, p) && !visited.has(indexOf(visit, p)),
    );
    const next = options.length > 1 ? options[rng.int(options.length)] : options[0];
    if (next) {
      visited.add(indexOf(visit, next));
      trail.push(next);
      enter(journey, visit, next);
      continue;
    }
    trail.pop();
    const back = trail.at(-1);
    if (back) enter(journey, visit, back);
  }
};

/** 行き：入口から階段へ。地図で道が分かっていれば最短で、分からなければ手探りで */
export const walkDown = (rng: Rng, journey: Journey, visit: FloorVisit): void => {
  visit.known.add(indexOf(visit, visit.floor.entrance));
  const path = knownPath(visit, visit.floor.entrance, visit.floor.stairs);
  if (path) walkPath(journey, visit, path);
  else explore(rng, journey, visit);
};

/** 帰り：階段から入口へ。行きで歩いた道があるので、地図を頼りに最短で戻る */
export const walkUp = (journey: Journey, visit: FloorVisit): void => {
  const { entrance, stairs } = visit.floor;
  const path = knownPath(visit, stairs, entrance) ?? findPath(visit.floor, stairs, entrance) ?? [];
  walkPath(journey, visit, path);
};
