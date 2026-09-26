/*
 * 効果音。音の素材は配らず、WebAudio でその場で合成する（読み込みがなく、軽い）。
 * ブラウザは操作の前に音を出させないので、最初に鳴らすときに AudioContext を作る
 */

export type SfxName = "tap" | "open" | "coin" | "reveal" | "rare" | "depart";

export const SOUND_KEY = "sealight.sound";

/** この回に切り替えた設定。保存できない環境（プライベートブラウズなど）でも、この回は効くようにする */
let chosen: boolean | null = null;

export const isSoundOn = (): boolean => {
  if (chosen !== null) return chosen;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundOn = (on: boolean): void => {
  chosen = on;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // 保存できなくても、この回は切り替えた設定で鳴らす
  }
};

/** 音の出口。AudioContext と、音量をまとめる 1 つの GainNode をページで使い回す */
let output: { readonly ctx: AudioContext; readonly master: GainNode } | null = null;

const audio = (): { readonly ctx: AudioContext; readonly master: GainNode } | null => {
  if (output) return output;
  const Ctor = typeof window === "undefined" ? undefined : window.AudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  output = { ctx, master };
  return output;
};

type Tone = { readonly freq: number; readonly at: number; readonly dur: number; readonly type?: OscillatorType; readonly gain?: number; readonly glide?: number };

/** 1 つの音。すぐ立ち上がって、なめらかに消える */
const tone = (ctx: AudioContext, out: AudioNode, { freq, at, dur, type = "sine", gain = 0.2, glide }: Tone): void => {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
};

/** 布や風のような、ざわっとした音 */
const rustle = (ctx: AudioContext, out: AudioNode, at: number, dur: number, from: number, to: number, gain: number): void => {
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  source.connect(filter).connect(env).connect(out);
  source.start(t);
};

const SOUNDS: Readonly<Record<SfxName, (ctx: AudioContext, out: AudioNode) => void>> = {
  tap: (ctx, out) => tone(ctx, out, { freq: 660, at: 0, dur: 0.06, type: "triangle", gain: 0.08 }),
  open: (ctx, out) => {
    rustle(ctx, out, 0, 0.35, 600, 2400, 0.25);
    tone(ctx, out, { freq: 140, at: 0, dur: 0.25, gain: 0.25, glide: 90 });
  },
  coin: (ctx, out) => {
    tone(ctx, out, { freq: 1318, at: 0, dur: 0.18, type: "triangle", gain: 0.1 });
    tone(ctx, out, { freq: 1976, at: 0.05, dur: 0.25, type: "sine", gain: 0.08 });
  },
  reveal: (ctx, out) => {
    tone(ctx, out, { freq: 784, at: 0, dur: 0.5, gain: 0.12 });
    tone(ctx, out, { freq: 1175, at: 0.06, dur: 0.55, gain: 0.08 });
  },
  rare: (ctx, out) => {
    [1047, 1319, 1568, 2093].forEach((freq, i) => tone(ctx, out, { freq, at: i * 0.08, dur: 0.7, type: "triangle", gain: 0.1 }));
    tone(ctx, out, { freq: 2637, at: 0.34, dur: 1.2, gain: 0.06 });
    rustle(ctx, out, 0.3, 0.9, 5000, 9000, 0.05);
  },
  depart: (ctx, out) => {
    rustle(ctx, out, 0, 0.6, 300, 3000, 0.2);
    tone(ctx, out, { freq: 392, at: 0.1, dur: 1.2, gain: 0.12 });
    tone(ctx, out, { freq: 587, at: 0.16, dur: 1.2, gain: 0.08 });
  },
};

/** 効果音を鳴らす。音を切っているときと、音を出せない環境では何もしない */
export const playSfx = (name: SfxName): void => {
  if (!isSoundOn()) return;
  const out = audio();
  if (!out) return;
  // 操作の前は鳴らせないことがある。そのときは次の操作で鳴るので、失敗は無視する
  if (out.ctx.state === "suspended") out.ctx.resume().catch(() => undefined);
  SOUNDS[name](out.ctx, out.master);
};
