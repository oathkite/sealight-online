import { PARTICLE_FLOATS, type ParticleSet, type Vec3 } from "@sealight/engine";

type Particle = readonly [x: number, y: number, z: number, size: number, r: number, g: number, b: number, alpha: number];

const pack = (particles: readonly Particle[], blend: ParticleSet["blend"]): ParticleSet => {
  const data = new Float32Array(particles.length * PARTICLE_FLOATS);
  particles.forEach((p, i) => data.set(p, i * PARTICLE_FLOATS));
  return { blend, data, count: particles.length };
};

const SMOKE_PUFFS = 7;
const SMOKE_CYCLE = 5.2;
const FIREFLIES = 18;
const MOTES = 10;

/** 煙突の煙。綿のような玉がふくらみながら昇り、風に流れて消える */
const smokeAt = (origin: Vec3, time: number): ParticleSet =>
  pack(
    Array.from({ length: SMOKE_PUFFS }, (_, i): Particle => {
      const t = (((time / SMOKE_CYCLE + i / SMOKE_PUFFS) % 1) + 1) % 1;
      const fade = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.7;
      return [origin[0] + t * 0.9 + Math.sin(t * 6 + i) * 0.07, origin[1] + t * 2.0, origin[2] - t * 0.25, 0.12 + t * 0.32, 0.86, 0.84, 0.88, fade];
    }),
    "alpha",
  );

/** 夜の蛍。庭のあちこちでゆっくり漂い、明滅する */
const firefliesAt = (time: number, lamp: number): ParticleSet =>
  pack(
    Array.from({ length: FIREFLIES }, (_, i): Particle => {
      const seed = i * 12.9898;
      const x = Math.sin(seed) * 7 + Math.sin(time * 0.21 + i) * 0.8;
      const z = Math.cos(seed * 1.7) * 4.5 + Math.cos(time * 0.17 + i * 2) * 0.8;
      const y = 0.5 + ((i * 7) % 5) * 0.2 + Math.sin(time * 0.9 + i) * 0.25;
      const blink = Math.max(0, Math.sin(time * 1.6 + i * 1.3));
      return [x, y, z, 0.09, 0.85, 1.0, 0.5, blink * lamp];
    }),
    "additive",
  );

/** 入口の階段から立ちのぼる、魔法の光の粒 */
const motesAt = (gate: Vec3, time: number): ParticleSet =>
  pack(
    Array.from({ length: MOTES }, (_, i): Particle => {
      const t = (((time / 3.5 + i / MOTES) % 1) + 1) % 1;
      const a = i * 2.4;
      return [gate[0] + Math.cos(a) * 0.35, gate[1] + t * 1.6, gate[2] + Math.sin(a) * 0.3, 0.07 + (1 - t) * 0.03, 0.5, 0.9, 1.0, Math.sin(t * Math.PI) * 0.9];
    }),
    "additive",
  );

export type ParticleInput = {
  readonly time: number;
  readonly smoke: Vec3 | null;
  /** 夜の深さ（0〜1）。蛍の数に効く */
  readonly lamp: number;
  /** 入口の階段の位置 */
  readonly gate: Vec3;
};

/** そのフレームの粒（煙、蛍、魔法の光） */
export const particlesAt = ({ time, smoke, lamp, gate }: ParticleInput): ParticleSet[] => [
  ...(smoke ? [smokeAt(smoke, time)] : []),
  motesAt(gate, time),
  ...(lamp > 0.3 ? [firefliesAt(time, lamp)] : []),
];
