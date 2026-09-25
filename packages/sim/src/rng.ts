export type Rng = {
  /** [0, 1) の一様乱数 */
  readonly next: () => number;
  /** [0, max) の整数 */
  readonly int: (max: number) => number;
};

/**
 * mulberry32。サーバーとクライアントで同じ結果を得るため、Math.random は使わない。
 */
export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number): number => {
    if (!Number.isInteger(max) || max <= 0) {
      throw new RangeError(`max must be a positive integer: ${max}`);
    }
    return Math.floor(next() * max);
  };

  return { next, int };
};

/** Fisher–Yates で並べ替えた新しい配列を返す。元の配列は変えない */
export const shuffle = <T>(rng: Rng, items: readonly T[]): readonly T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
};
