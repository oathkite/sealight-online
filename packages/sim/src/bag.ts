import type { Equipment } from "./items";

export type Stowed = {
  readonly bag: readonly Equipment[];
  /** 置いてきた装備。全部持てたときは null */
  readonly left: Equipment | null;
};

/**
 * 装備を荷物に入れる。free は残りの枠の数。
 * いっぱいなら、拾った物と荷物の中で一番弱い物（価値が低い物）を比べ、弱い方を置いてくる。
 * 並んだときは先に持っていた物を残す。食料は捨てない
 */
export const stow = (bag: readonly Equipment[], item: Equipment, free: number): Stowed => {
  if (free > 0) return { bag: [...bag, item], left: null };
  const weakest = bag.reduce<Equipment | null>((low, i) => (low === null || i.value < low.value ? i : low), null);
  if (weakest === null || item.value <= weakest.value) return { bag, left: item };
  return { bag: [...bag.filter((i) => i !== weakest), item], left: weakest };
};
