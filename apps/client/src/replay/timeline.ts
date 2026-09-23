import type { LampEvent, Point } from "@sealight/sim";

/** イベントの種類ごとの再生時間（秒） */
export const BEAT = {
  move: 0.12,
  encounter: 0.5,
  attack: 0.35,
  potion: 0.6,
  victory: 0.5,
  loot: 0.6,
  death: 1.5,
  stairs: 1,
} as const satisfies Record<LampEvent["type"], number>;

export type Beat = {
  readonly start: number;
  readonly end: number;
  readonly event: LampEvent;
};

export type Timeline = {
  readonly start: Point;
  readonly hp: number;
  readonly maxHp: number;
  readonly beats: readonly Beat[];
  readonly duration: number;
};

export type Frame = {
  /** マス座標。移動中は小数になる */
  readonly position: Point;
  readonly heading: Point;
  readonly hp: number;
  readonly foe: { readonly name: string; readonly hp: number; readonly maxHp: number } | null;
  readonly defeated: ReadonlySet<string>;
  readonly opened: ReadonlySet<string>;
  /** 直前の攻撃で点滅させる側 */
  readonly flash: "player" | "foe" | null;
  readonly log: string;
  readonly status: "walking" | "fighting" | "done" | "dead";
};

const FLASH_SEC = 0.15;

export const pointKey = (p: Point): string => `${p.x},${p.y}`;

export const buildTimeline = (input: {
  readonly start: Point;
  readonly hp: number;
  readonly maxHp: number;
  readonly events: readonly LampEvent[];
}): Timeline => {
  let cursor = 0;
  const beats = input.events.map((event) => {
    const beat = { start: cursor, end: cursor + BEAT[event.type], event };
    cursor = beat.end;
    return beat;
  });
  return { start: input.start, hp: input.hp, maxHp: input.maxHp, beats, duration: cursor };
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const describeLoot = (event: Extract<LampEvent, { type: "loot" }>): string =>
  event.loot.type === "gold" ? `${event.loot.amount} ゴールドを拾った` : `${event.loot.item.name}を見つけた`;

/** イベントは拍の開始時点で起きる。起きたイベントを状態に反映する */
type Tracking = { lastFoePoint: Point | null; readonly defeated: Set<string>; readonly opened: Set<string> };

const applyEvent = (frame: Mutable<Frame>, event: LampEvent, tracking: Tracking): void => {
  switch (event.type) {
    case "move":
      frame.heading = { x: event.to.x - frame.position.x, y: event.to.y - frame.position.y };
      frame.position = event.to;
      return;
    case "encounter":
      frame.foe = { name: event.foe.name, hp: event.foe.hp, maxHp: event.foe.hp };
      frame.status = "fighting";
      frame.log = `${event.foe.name}が現れた`;
      tracking.lastFoePoint = event.at;
      return;
    case "attack":
      if (event.by === "player" && frame.foe) frame.foe = { ...frame.foe, hp: event.hp };
      if (event.by === "foe") frame.hp = event.hp;
      frame.log = event.by === "player" ? `${event.damage} のダメージを与えた` : `${event.damage} のダメージを受けた`;
      return;
    case "potion":
      frame.hp = event.hp;
      frame.log = "ポーションを飲んだ";
      return;
    case "victory":
      frame.log = `${frame.foe?.name ?? "敵"}を倒した（経験値 ${event.xp}）`;
      frame.foe = null;
      frame.status = "walking";
      if (tracking.lastFoePoint) tracking.defeated.add(pointKey(tracking.lastFoePoint));
      return;
    case "loot":
      tracking.opened.add(pointKey(event.at));
      frame.log = describeLoot(event);
      return;
    case "death":
      frame.status = "dead";
      frame.log = "力尽きた…";
      return;
    case "stairs":
      frame.status = "done";
      frame.log = "階段を見つけた";
      return;
  }
};

/** 経過秒数から、その時点の再生状態を求める */
export const frameAt = (timeline: Timeline, elapsedSec: number): Frame => {
  const t = Math.max(elapsedSec, 0);
  const tracking: Tracking = { lastFoePoint: null, defeated: new Set(), opened: new Set() };
  const frame: Mutable<Frame> = {
    position: timeline.start,
    heading: { x: 0, y: 1 },
    hp: timeline.hp,
    foe: null,
    defeated: tracking.defeated,
    opened: tracking.opened,
    flash: null,
    log: "探索を始めた",
    status: "walking",
  };
  for (const beat of timeline.beats) {
    if (t < beat.start) break;
    const { event } = beat;
    if (t < beat.end && event.type === "move") {
      // 移動の途中はマスの間を補間する
      const ratio = (t - beat.start) / (beat.end - beat.start);
      const from = frame.position;
      frame.heading = { x: event.to.x - from.x, y: event.to.y - from.y };
      frame.position = { x: from.x + (event.to.x - from.x) * ratio, y: from.y + (event.to.y - from.y) * ratio };
      break;
    }
    applyEvent(frame, event, tracking);
    const sinceStart = t - beat.start;
    frame.flash =
      event.type === "attack" && sinceStart < FLASH_SEC ? (event.by === "player" ? "foe" : "player") : null;
    if (t < beat.end) break;
  }
  return frame;
};
