import type { Vec3 } from "../math/vec3";
import type { NodePose, Pose } from "../scene/scene";

export type Channel = "position" | "rotation" | "scale";
/** キー：コマ番号と値（x, y, z） */
export type Key = readonly [frame: number, x: number, y: number, z: number];
export type Track = { readonly node: string; readonly channel: Channel; readonly keys: readonly Key[] };

export type Clip = {
  readonly name: string;
  readonly fps: number;
  /** 長さ（コマ）。繰り返す動きは、このコマで最初の姿勢に戻る */
  readonly frames: number;
  readonly loop: boolean;
  readonly tracks: readonly Track[];
};

const REST: Record<Channel, Vec3> = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const CHANNELS: readonly Channel[] = ["position", "rotation", "scale"];

const ease = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const valueOf = (key: Key): Vec3 => [key[1], key[2], key[3]];

/** キーの並びを、あるコマで読む。キーの間は端でゆっくりになるように補間する */
export const sampleKeys = (keys: readonly Key[], frame: number): Vec3 => {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return [0, 0, 0];
  if (frame <= first[0]) return valueOf(first);
  if (frame >= last[0]) return valueOf(last);
  const i = keys.findIndex((k) => k[0] > frame);
  const a = keys[i - 1] ?? first;
  const b = keys[i] ?? last;
  return mix(valueOf(a), valueOf(b), ease((frame - a[0]) / (b[0] - a[0])));
};

export const clipDuration = (clip: Clip): number => clip.frames / clip.fps;

/** 動きをある時刻（秒）で読み、node ごとの姿勢にする */
export const sampleClip = (clip: Clip, time: number): Pose => {
  const raw = time * clip.fps;
  const frame = clip.loop ? ((raw % clip.frames) + clip.frames) % clip.frames : Math.min(raw, clip.frames);
  const pose = new Map<string, NodePose>();
  for (const track of clip.tracks) pose.set(track.node, { ...pose.get(track.node), [track.channel]: sampleKeys(track.keys, frame) });
  return pose;
};

/** 2 つの姿勢を t の割合で混ぜる（0 で a、1 で b） */
export const blendPose = (a: Pose, b: Pose, t: number): Pose => {
  const names = new Set([...a.keys(), ...b.keys()]);
  const out = new Map<string, NodePose>();
  for (const name of names) {
    const pa = a.get(name);
    const pb = b.get(name);
    const blended: Partial<Record<Channel, Vec3>> = {};
    for (const c of CHANNELS) {
      if (pa?.[c] === undefined && pb?.[c] === undefined) continue;
      blended[c] = mix(pa?.[c] ?? REST[c], pb?.[c] ?? REST[c], t);
    }
    out.set(name, blended);
  }
  return out;
};

/**
 * 動きを再生する。別の動きに切り替えると、切り替えた瞬間の姿勢から fade 秒かけて移る
 */
export const createAnimator = (clips: Readonly<Record<string, Clip>>, fade = 0.25) => {
  let current: Clip | null = null;
  let time = 0;
  let speed = 1;
  let from: Pose = new Map();
  let fading = fade;
  let last: Pose = new Map();

  const play = (name: string, playSpeed = 1): void => {
    speed = playSpeed;
    const next = clips[name];
    if (!next || next === current) return;
    from = last;
    current = next;
    time = 0;
    fading = 0;
  };

  const update = (dt: number): Pose => {
    if (!current) return last;
    time += dt * speed;
    fading = Math.min(fade, fading + dt);
    const pose = sampleClip(current, time);
    last = fade > 0 && fading < fade ? blendPose(from, pose, ease(fading / fade)) : pose;
    return last;
  };

  return { play, update };
};

export type Animator = ReturnType<typeof createAnimator>;
