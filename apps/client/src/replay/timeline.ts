import type { LampEvent, Point } from "@sealight/sim";

export type Pickup = {
  readonly at: Point;
  /** positions のインデックス。この位置に着いた時点で拾う */
  readonly step: number;
};

export type Timeline = {
  readonly positions: readonly Point[];
  readonly pickups: readonly Pickup[];
};

export type Frame = {
  /** マス座標。マスの間は小数になる */
  readonly position: Point;
  readonly heading: Point;
  readonly picked: ReadonlySet<string>;
  readonly done: boolean;
};

export const pointKey = (p: Point): string => `${p.x},${p.y}`;

export const buildTimeline = (start: Point, events: readonly LampEvent[]): Timeline => {
  const positions: Point[] = [start];
  const pickups: Pickup[] = [];
  for (const event of events) {
    if (event.type === "move") positions.push(event.to);
    if (event.type === "treasure") pickups.push({ at: event.at, step: positions.length - 1 });
  }
  return { positions, pickups };
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 経過秒数と速度（マス/秒）から、その時点の再生状態を求める */
export const frameAt = (timeline: Timeline, elapsedSec: number, cellsPerSec: number): Frame => {
  const { positions, pickups } = timeline;
  const lastStep = positions.length - 1;
  const progress = Math.min(Math.max(elapsedSec, 0) * cellsPerSec, lastStep);
  const step = Math.floor(progress);
  const from = positions[step] as Point;
  const to = positions[Math.min(step + 1, lastStep)] as Point;
  const t = progress - step;

  const picked = new Set(pickups.filter((p) => p.step <= step).map((p) => pointKey(p.at)));
  return {
    position: { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) },
    heading: { x: to.x - from.x, y: to.y - from.y },
    picked,
    done: progress >= lastStep,
  };
};
