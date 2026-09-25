/** 空と光の色。遊んでいる人の時計に合わせて、家の場面の空が移り変わる */
export type Lighting = {
  readonly skyTop: string;
  readonly skyBottom: string;
  /** 遠くを霞ませる色。空の下の方の色に合わせる */
  readonly fog: string;
  readonly sunColor: string;
  readonly sunIntensity: number;
  readonly sunPosition: readonly [number, number, number];
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly hemiIntensity: number;
  /** 窓と灯りのともり具合（0〜1） */
  readonly lamp: number;
  /** 星の見え具合（0〜1） */
  readonly stars: number;
};

type Key = Omit<Lighting, "sunPosition" | "fog"> & { readonly hour: number };

const NIGHT = {
  skyTop: "#0a0f2c",
  skyBottom: "#2b2b5c",
  sunColor: "#8ea2ff",
  sunIntensity: 0.45,
  hemiSky: "#5a6ab0",
  hemiGround: "#16142a",
  hemiIntensity: 0.55,
  lamp: 1,
  stars: 1,
} as const;

/** 時刻ごとの見本。間の時刻は前後の見本を混ぜる */
const KEYS: readonly Key[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.5, ...NIGHT },
  { hour: 6, skyTop: "#2d3a78", skyBottom: "#f0a58a", sunColor: "#ffb48a", sunIntensity: 0.9, hemiSky: "#9aa8e0", hemiGround: "#3a2e3e", hemiIntensity: 0.8, lamp: 0.5, stars: 0.2 },
  { hour: 8, skyTop: "#5b98dc", skyBottom: "#d6e8f2", sunColor: "#fff0d4", sunIntensity: 1.7, hemiSky: "#dfeeff", hemiGround: "#4a4a3a", hemiIntensity: 1.05, lamp: 0, stars: 0 },
  { hour: 13, skyTop: "#4f97e2", skyBottom: "#dcefff", sunColor: "#fffaf0", sunIntensity: 2, hemiSky: "#eef6ff", hemiGround: "#51513e", hemiIntensity: 1.15, lamp: 0, stars: 0 },
  { hour: 16.5, skyTop: "#6592d0", skyBottom: "#f4d6a8", sunColor: "#ffdca4", sunIntensity: 1.7, hemiSky: "#f2e4d0", hemiGround: "#4d4234", hemiIntensity: 1, lamp: 0, stars: 0 },
  { hour: 18.2, skyTop: "#3a4690", skyBottom: "#f7955f", sunColor: "#ff8f52", sunIntensity: 1.25, hemiSky: "#d8a6b8", hemiGround: "#3a2a38", hemiIntensity: 0.85, lamp: 0.7, stars: 0.1 },
  { hour: 19.6, skyTop: "#1b2058", skyBottom: "#83568a", sunColor: "#b48cdc", sunIntensity: 0.6, hemiSky: "#7a70b8", hemiGround: "#1e1a30", hemiIntensity: 0.65, lamp: 1, stars: 0.6 },
  { hour: 21, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const channels = (hex: string): readonly [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** 2 つの色を t の割合で混ぜる */
export const mixHex = (from: string, to: string, t: number): string => {
  const k = clamp01(t);
  const a = channels(from);
  const b = channels(to);
  const mixed = a.map((c, i) => Math.round(c + ((b[i] ?? c) - c) * k));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 日付から、0 以上 24 未満の小数の時間を取り出す */
export const hourOf = (date: Date): number => date.getHours() + date.getMinutes() / 60;

/** 太陽（夜は月）の向き。低くても地面より上から照らし、影が長く伸びる */
const sunPositionAt = (hour: number): readonly [number, number, number] => {
  const day = hour >= 6 && hour <= 18.5;
  const phase = day ? (hour - 6) / 12.5 : ((hour + 5.5) % 24) / 11.5;
  const angle = phase * Math.PI;
  const height = Math.max(0.35, Math.sin(angle)) * 9;
  return [Math.cos(angle) * 7, height, 3.5];
};

const NIGHT_KEY_END: Key = { hour: 24, ...NIGHT };

/** その時刻の空と光 */
export const lightingAt = (hour: number): Lighting => {
  const h = ((hour % 24) + 24) % 24;
  const index = KEYS.findIndex((k) => k.hour > h);
  const next = KEYS[index] ?? NIGHT_KEY_END;
  const prev = KEYS[index - 1] ?? KEYS[0] ?? NIGHT_KEY_END;
  const t = next.hour === prev.hour ? 0 : (h - prev.hour) / (next.hour - prev.hour);
  const skyBottom = mixHex(prev.skyBottom, next.skyBottom, t);
  return {
    skyTop: mixHex(prev.skyTop, next.skyTop, t),
    skyBottom,
    fog: skyBottom,
    sunColor: mixHex(prev.sunColor, next.sunColor, t),
    sunIntensity: mix(prev.sunIntensity, next.sunIntensity, t),
    sunPosition: sunPositionAt(h),
    hemiSky: mixHex(prev.hemiSky, next.hemiSky, t),
    hemiGround: mixHex(prev.hemiGround, next.hemiGround, t),
    hemiIntensity: mix(prev.hemiIntensity, next.hemiIntensity, t),
    lamp: mix(prev.lamp, next.lamp, t),
    stars: mix(prev.stars, next.stars, t),
  };
};
