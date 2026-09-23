import type { Rng } from "./rng";

export type FoeKind = "slime" | "goblin" | "skeleton";

export type Foe = {
  readonly kind: FoeKind;
  readonly name: string;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly xp: number;
};

const FOES = {
  slime: { name: "スライム", hp: 8, attack: 3, defense: 0, xp: 3, minDepth: 1 },
  goblin: { name: "ゴブリン", hp: 14, attack: 5, defense: 1, xp: 6, minDepth: 2 },
  skeleton: { name: "スケルトン", hp: 20, attack: 7, defense: 2, xp: 10, minDepth: 4 },
} as const satisfies Record<FoeKind, Omit<Foe, "kind"> & { readonly minDepth: number }>;

const FOE_KINDS = Object.keys(FOES) as readonly FoeKind[];

export type FloorConfig = {
  readonly monsterCount: number;
  readonly treasureCount: number;
  readonly rareChance: number;
};

const assertDepth = (depth: number): void => {
  if (!Number.isInteger(depth) || depth < 1) throw new RangeError(`depth must be an integer >= 1: ${depth}`);
};

/** 深さごとのフロアの設定。深いほどモンスターが多く、レアが出やすい */
export const floorConfig = (depth: number): FloorConfig => {
  assertDepth(depth);
  return {
    monsterCount: Math.min(3 + Math.floor(depth / 2), 10),
    treasureCount: Math.min(3 + Math.floor(depth / 4), 6),
    rareChance: Math.min(0.05 + 0.02 * depth, 0.4),
  };
};

/** 種類と深さから、その階での強さを決める */
export const foeAt = (kind: FoeKind, depth: number): Foe => {
  assertDepth(depth);
  const base = FOES[kind];
  const scale = 1 + 0.2 * (depth - 1);
  return {
    kind,
    name: base.name,
    hp: Math.round(base.hp * scale),
    attack: Math.round(base.attack * scale),
    defense: base.defense + Math.floor(depth / 5),
    xp: Math.round(base.xp * scale),
  };
};

/** その深さに出現しうる種類から 1 体を選ぶ */
export const spawnFoe = (rng: Rng, depth: number): Foe => {
  const eligible = FOE_KINDS.filter((kind) => FOES[kind].minDepth <= depth);
  const kind = eligible[rng.int(eligible.length)] ?? "slime";
  return foeAt(kind, depth);
};
