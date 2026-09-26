import { describe, expect, it } from "vitest";
import { PARTICLE_FLOATS } from "@sealight/engine";
import { particlesAt } from "./particles";

const read = (data: Float32Array, i: number) => Array.from(data.slice(i * PARTICLE_FLOATS, (i + 1) * PARTICLE_FLOATS));

describe("particlesAt", () => {
  it("煙突の上に、ふくらみながら昇る煙を出す", () => {
    const [smoke] = particlesAt({ time: 1, smoke: [0, 4, 0], lamp: 0, gate: [0, 0, 3] });
    expect(smoke?.blend).toBe("alpha");
    expect(smoke?.count).toBe(7);
    const puffs = Array.from({ length: smoke?.count ?? 0 }, (_, i) => read(smoke?.data ?? new Float32Array(), i));
    const low = puffs.reduce((a, b) => ((a[1] ?? 0) < (b[1] ?? 0) ? a : b));
    const high = puffs.reduce((a, b) => ((a[1] ?? 0) > (b[1] ?? 0) ? a : b));
    expect(low[1]).toBeGreaterThanOrEqual(4);
    expect(high[3] ?? 0).toBeGreaterThan(low[3] ?? 0);
  });

  it("蛍は夜だけ飛ぶ", () => {
    const day = particlesAt({ time: 1, smoke: null, lamp: 0, gate: [0, 0, 3] });
    const night = particlesAt({ time: 1, smoke: null, lamp: 1, gate: [0, 0, 3] });
    const fireflies = (sets: typeof day) => sets.find((s) => s.blend === "additive" && s.count > 12);
    expect(fireflies(day)).toBeUndefined();
    expect(fireflies(night)?.count).toBeGreaterThan(12);
  });

  it("入口の階段から、魔法の光の粒が立ちのぼる", () => {
    const sets = particlesAt({ time: 2, smoke: null, lamp: 0, gate: [1, 0, 3] });
    const motes = sets.find((s) => s.blend === "additive");
    expect(motes?.count).toBe(10);
    const first = read(motes?.data ?? new Float32Array(), 0);
    expect(Math.abs((first[0] ?? 0) - 1)).toBeLessThan(0.6);
  });

  it("煙の出る位置がなければ煙は出さない", () => {
    expect(particlesAt({ time: 1, smoke: null, lamp: 0, gate: [0, 0, 3] }).some((s) => s.blend === "alpha")).toBe(false);
  });
});
