import { simulateExpedition } from "./expedition";
import type { ExpeditionInput } from "./expedition-types";

export type Estimate = {
  readonly minSec: number;
  readonly maxSec: number;
  /** 見積もりの試行のうち、無事に帰ってきた割合 */
  readonly successRate: number;
};

export type Reaction = "eager" | "calm" | "nervous" | "scared";

const SAMPLES = 6;

/** 見積もり用のシード。本番のシードとは無関係に、目標と試行番号だけから決める */
const sampleSeed = (target: number, index: number): number =>
  (Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(target, 0x85ebca6b)) >>> 0;

/**
 * 送り出す前の見積もり。同じ条件で何回か試しに冒険させ、かかる時間の幅と成功しそうな割合を出す。
 * 本番のシードは使わないので、結果は漏れない。
 */
export const estimateExpedition = (input: Omit<ExpeditionInput, "seed">, samples: number = SAMPLES): Estimate => {
  const results = Array.from({ length: samples }, (_, i) =>
    simulateExpedition({ ...input, seed: sampleSeed(input.target, i) }).outcome,
  );
  const durations = results.map((r) => r.durationSec);
  return {
    minSec: Math.min(...durations),
    maxSec: Math.max(...durations),
    successRate: results.filter((r) => r.status === "returned").length / samples,
  };
};

/** 送り出す前のモンスターの反応。成功率は数字で見せず、反応で伝える */
export const reactionFor = (successRate: number): Reaction => {
  if (successRate >= 0.9) return "eager";
  if (successRate >= 0.6) return "calm";
  if (successRate >= 0.3) return "nervous";
  return "scared";
};
