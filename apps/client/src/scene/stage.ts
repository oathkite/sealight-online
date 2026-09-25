import { alongRoute, ROUTE, SPOTS, type Vec3 } from "./layout";

/** モンスターの場面。送り出しと帰りの間だけ、道を歩く演出が入る */
export type Act = "home" | "leaving" | "away" | "arriving";

/** Blender で付けたアニメーションの名前（art/monster_anim.py） */
export type Clip = "idle" | "hop" | "droop" | "cheer" | "sleep";

export type Mood = {
  /** ボロボロで帰ってきた */
  readonly hurt: boolean;
  /** 夜なので眠い */
  readonly sleepy: boolean;
  /** 持ち帰ったものがある */
  readonly carrying: boolean;
};

export type Pose = {
  readonly position: Vec3;
  /** 上下軸まわりの向き。0 で +z（手前）を向く */
  readonly heading: number;
  readonly clip: Clip;
  /** アニメーションの再生速度 */
  readonly speed: number;
  readonly visible: boolean;
  readonly sack: boolean;
};

/** 寝床ではカメラの方を向いて座る */
const HOME_HEADING = Math.PI / 4;
const DEPTH_BELOW = -0.75;

const LEAVE = { turn: 0.5, walk: 2.6, descend: 1.1 } as const;
const ARRIVE = { emerge: 1.0, land: 1.4 } as const;
const walkTime = (mood: Pick<Mood, "hurt">): number => (mood.hurt ? 4.2 : 2.6);

/** 演出の長さ（秒）。家にいるときと冒険中は終わりがない */
export const actLength = (act: Act, mood: Pick<Mood, "hurt">): number => {
  if (act === "leaving") return LEAVE.turn + LEAVE.walk + LEAVE.descend;
  if (act === "arriving") return ARRIVE.emerge + walkTime(mood) + ARRIVE.land;
  return Infinity;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);
/** 向きを近い方へ回して補間する */
const turnTo = (from: number, to: number, t: number): number => {
  const diff = ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + diff * t;
};

const routeEnd = ROUTE.at(-1) ?? SPOTS.gate;
/** 入口の階段の奥（地面の下）。ここから降りていき、ここから上がってくる */
const stairsBottom: Vec3 = [lerp(routeEnd[0], SPOTS.gate[0], 1.6), DEPTH_BELOW, lerp(routeEnd[2], SPOTS.gate[2], 1.6)];
const stairsHeading = Math.atan2(stairsBottom[0] - routeEnd[0], stairsBottom[2] - routeEnd[2]);
const homePosition = ROUTE[0] ?? SPOTS.bed;

const between = (from: Vec3, to: Vec3, t: number): Vec3 => [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];

const homeClip = (mood: Mood): Clip => {
  if (mood.hurt) return "droop";
  return mood.sleepy ? "sleep" : "idle";
};

const still = (mood: Mood): Pose => ({ position: homePosition, heading: HOME_HEADING, clip: homeClip(mood), speed: 1, visible: true, sack: false });

const leaving = (t: number): Pose => {
  const base = { speed: 1, sack: false } as const;
  if (t < LEAVE.turn) {
    const start = alongRoute(ROUTE, 0).heading;
    return { ...base, position: homePosition, heading: turnTo(HOME_HEADING, start, ease(t / LEAVE.turn)), clip: "hop", visible: true };
  }
  if (t < LEAVE.turn + LEAVE.walk) {
    const walked = alongRoute(ROUTE, (t - LEAVE.turn) / LEAVE.walk);
    return { ...base, position: walked.position, heading: walked.heading, clip: "hop", visible: true };
  }
  const k = clamp01((t - LEAVE.turn - LEAVE.walk) / LEAVE.descend);
  return { ...base, position: between(routeEnd, stairsBottom, k), heading: stairsHeading, clip: "hop", visible: k < 1 };
};

const arriving = (t: number, mood: Mood): Pose => {
  const walk = walkTime(mood);
  const base = { speed: mood.hurt ? 0.6 : 1, sack: mood.carrying, visible: true } as const;
  if (t < ARRIVE.emerge) {
    return { ...base, position: between(stairsBottom, routeEnd, clamp01(t / ARRIVE.emerge)), heading: stairsHeading + Math.PI, clip: "hop" };
  }
  if (t < ARRIVE.emerge + walk) {
    const walked = alongRoute(ROUTE, 1 - (t - ARRIVE.emerge) / walk);
    return { ...base, position: walked.position, heading: walked.heading + Math.PI, clip: "hop" };
  }
  const k = clamp01((t - ARRIVE.emerge - walk) / 0.4);
  const facing = alongRoute(ROUTE, 0).heading + Math.PI;
  return { ...base, speed: 1, position: homePosition, heading: turnTo(facing, HOME_HEADING, ease(k)), clip: mood.hurt ? "droop" : "cheer" };
};

/** 場面が始まってから t 秒後のモンスターの姿 */
export const poseAt = (act: Act, t: number, mood: Mood): Pose => {
  if (act === "leaving") return leaving(t);
  if (act === "arriving") return arriving(t, mood);
  if (act === "away") return { ...still(mood), visible: false };
  return still(mood);
};
