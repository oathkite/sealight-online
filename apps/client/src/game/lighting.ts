import { normalize, toLinear, type Color, type Environment, type PointLight, type Vec3 } from "@sealight/engine";
import type { LightAnchor } from "./props/types";

/** その時刻の空と光。sun / shade / fill はリニアの色に強さを掛けた値 */
export type Sky = {
  readonly top: Color;
  readonly horizon: Color;
  readonly sun: Color;
  readonly shade: Color;
  readonly fill: Color;
  readonly sunDirection: Vec3;
  /** 窓の灯りのともり具合（0〜1） */
  readonly lamp: number;
  readonly stars: number;
  readonly clouds: number;
};

type Key = {
  readonly hour: number;
  readonly top: string;
  readonly horizon: string;
  readonly sun: string;
  readonly sunPower: number;
  readonly shade: string;
  readonly fill: string;
  readonly fillPower: number;
  readonly lamp: number;
  readonly stars: number;
  readonly clouds: number;
};

const NIGHT = { top: "#0b1128", horizon: "#202a52", sun: "#9aa8e8", sunPower: 0.42, shade: "#2e3668", fill: "#28325e", fillPower: 0.32, lamp: 1, stars: 1, clouds: 0.2 } as const;

const START: Key = { hour: 0, ...NIGHT };
const END: Key = { hour: 24, ...NIGHT };

/** 時刻ごとの見本。中世の少し暗めの空。間の時刻は前後を混ぜる */
const KEYS: readonly Key[] = [
  START,
  { hour: 4.8, top: "#1c2246", horizon: "#9a7890", sun: "#e6a890", sunPower: 0.4, shade: "#4c4474", fill: "#45487a", fillPower: 0.34, lamp: 1, stars: 0.3, clouds: 0.3 },
  { hour: 6.4, top: "#5a88b8", horizon: "#e8b890", sun: "#f2c08e", sunPower: 0.85, shade: "#6c6a9c", fill: "#8090b8", fillPower: 0.38, lamp: 0.5, stars: 0, clouds: 0.6 },
  { hour: 9, top: "#4a90c4", horizon: "#b8d6e0", sun: "#f8e8cc", sunPower: 1.05, shade: "#66769e", fill: "#93aecb", fillPower: 0.42, lamp: 0, stars: 0, clouds: 0.8 },
  { hour: 13, top: "#4288c2", horizon: "#bdd8e4", sun: "#fbf1e0", sunPower: 1.1, shade: "#6a7aa2", fill: "#98b4d0", fillPower: 0.44, lamp: 0, stars: 0, clouds: 0.8 },
  { hour: 16.8, top: "#5a86b8", horizon: "#e8cc9c", sun: "#f5c88c", sunPower: 1.0, shade: "#6e6c9a", fill: "#a6a4c4", fillPower: 0.4, lamp: 0.15, stars: 0, clouds: 0.7 },
  { hour: 18.3, top: "#52508e", horizon: "#e8906c", sun: "#f08a5c", sunPower: 0.8, shade: "#5e4e86", fill: "#86709e", fillPower: 0.36, lamp: 0.75, stars: 0, clouds: 0.5 },
  { hour: 19.6, top: "#222a5a", horizon: "#6a5690", sun: "#9a8ad0", sunPower: 0.45, shade: "#3a3a72", fill: "#484a82", fillPower: 0.34, lamp: 1, stars: 0.5, clouds: 0.3 },
  END,
];

const hex = (h: string): Color => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mixColor = (a: string, b: string, t: number): Color => {
  const [x, y] = [hex(a), hex(b)];
  return [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];
};
const power = (c: Color, k: number): Color => {
  const l = toLinear(c);
  return [l[0] * k, l[1] * k, l[2] * k];
};

export const hourOf = (date: Date): number => date.getHours() + date.getMinutes() / 60;

/** 太陽は左手前から昇って右へ沈む。夜は月の光が上から差す */
const sunDirectionAt = (hour: number): Vec3 => {
  const day = Math.min(1, Math.max(0, (hour - 5.5) / 13.5)) * Math.PI;
  const up = hour > 5.5 && hour < 19 ? Math.min(1, Math.max(0, Math.sin(day) * 4)) : 0;
  const sun: Vec3 = normalize([-Math.cos(day) * 0.85 - 0.35, 0.45 + Math.sin(day) * 0.8, 0.55]);
  const moon: Vec3 = normalize([0.3, 1, 0.5]);
  return normalize([lerp(moon[0], sun[0], up), lerp(moon[1], sun[1], up), lerp(moon[2], sun[2], up)]);
};

export const skyAt = (hour: number): Sky => {
  const h = ((hour % 24) + 24) % 24;
  const index = KEYS.findIndex((k) => k.hour > h);
  const next = KEYS[index] ?? END;
  const prev = KEYS[index - 1] ?? START;
  const raw = next.hour === prev.hour ? 0 : (h - prev.hour) / (next.hour - prev.hour);
  const t = raw * raw * (3 - 2 * raw);
  return {
    top: mixColor(prev.top, next.top, t),
    horizon: mixColor(prev.horizon, next.horizon, t),
    sun: power(mixColor(prev.sun, next.sun, t), lerp(prev.sunPower, next.sunPower, t)),
    shade: power(mixColor(prev.shade, next.shade, t), 0.6),
    fill: power(mixColor(prev.fill, next.fill, t), lerp(prev.fillPower, next.fillPower, t)),
    sunDirection: sunDirectionAt(h),
    lamp: lerp(prev.lamp, next.lamp, t),
    stars: lerp(prev.stars, next.stars, t),
    clouds: lerp(prev.clouds, next.clouds, t),
  };
};

export type EnvironmentInput = {
  readonly hour: number;
  readonly time: number;
  readonly anchors: readonly LightAnchor[];
  /** モンスターの帰りを待っている（玄関のランタンを灯す） */
  readonly waiting: boolean;
};

/** 風。西から吹き、強さはゆっくり波打つ。夜（灯りがともる頃）は穏やかになる */
const windAt = (time: number, lamp: number): Environment["wind"] => {
  const direction = normalize([0.85, 0, 0.35]);
  return { direction: [direction[0], direction[2]], strength: (0.5 + 0.18 * Math.sin(time * 0.05) + 0.08 * Math.sin(time * 0.13)) * (1 - lamp * 0.45), gust: 0.7 };
};

const flicker = (time: number): number => 0.85 + 0.15 * Math.sin(time * 11.3) * Math.sin(time * 5.7 + 1.3);

const lightFor = (anchor: LightAnchor, lamp: number, lantern: number, flame: number, magic: number): PointLight | null => {
  const [k, color, radius]: readonly [number, Color, number] =
    anchor.kind === "lamp" ? [lamp, [1.0, 0.62, 0.28], 3.2]
    : anchor.kind === "lantern" ? [lantern, [1.0, 0.66, 0.3], 3.4]
    : anchor.kind === "flame" ? [flame, [1.0, 0.52, 0.2], 2.8]
    : [magic, [0.35, 0.8, 1.0], 2.6];
  return k > 0.02 ? { position: anchor.position, color: [color[0] * k * 1.3, color[1] * k * 1.3, color[2] * k * 1.3], radius } : null;
};

/** エンジンに渡す空と光。灯りは時刻と、帰りを待っているかで強さが変わる */
export const environmentAt = ({ hour, time, anchors, waiting }: EnvironmentInput): Environment => {
  const sky = skyAt(hour);
  const lantern = waiting ? Math.max(sky.lamp, 0.8) : sky.lamp;
  const flame = flicker(time);
  const magic = 0.55 + sky.lamp * 0.35 + 0.1 * Math.sin(time * 1.7);
  return {
    skyTop: sky.top,
    skyHorizon: sky.horizon,
    sunDirection: sky.sunDirection,
    sunColor: sky.sun,
    shadeColor: sky.shade,
    fillColor: sky.fill,
    glow: [sky.lamp, magic, flame, lantern],
    stars: sky.stars,
    clouds: sky.clouds,
    fog: { near: 6, far: 20 },
    curve: 0.016,
    vignette: 0.35,
    wind: windAt(time, sky.lamp),
    lights: anchors.flatMap((a) => lightFor(a, sky.lamp, lantern, flame * (0.5 + sky.lamp * 0.5), magic) ?? []).slice(0, 4),
  };
};
