import type { Rng } from "./rng";

export type FoeKind = "slime" | "rat" | "goblin" | "beetle" | "skeleton" | "ogre" | "wraith" | "golem" | "glowSlime";

/**
 * 敵の特徴。報告から読み取れる失敗の型と、打てる手に対応させる。
 * swarm：群れで連戦になる / armored：硬い / heavy：一撃が重い / fast：1 ラウンドに 2 回攻撃
 */
export type Trait = "swarm" | "armored" | "heavy" | "fast";

export type Foe = {
  readonly kind: FoeKind;
  readonly name: string;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly xp: number;
  readonly traits: readonly Trait[];
  /** レアな敵（光るスライム、アルファ）。必ずレアな装備を落とす */
  readonly rare: boolean;
  readonly dropChance: number;
};

type FoeSpec = Omit<Foe, "kind" | "rare">;

const FOES = {
  slime: { name: "スライム", hp: 8, attack: 3, defense: 0, xp: 3, traits: [], dropChance: 0.05 },
  rat: { name: "ネズミ", hp: 4, attack: 2, defense: 0, xp: 1, traits: ["swarm"], dropChance: 0.02 },
  goblin: { name: "ゴブリン", hp: 16, attack: 6, defense: 1, xp: 7, traits: [], dropChance: 0.1 },
  beetle: { name: "甲虫", hp: 14, attack: 5, defense: 6, xp: 8, traits: ["armored"], dropChance: 0.08 },
  skeleton: { name: "スケルトン", hp: 24, attack: 9, defense: 3, xp: 12, traits: [], dropChance: 0.1 },
  ogre: { name: "オーガ", hp: 40, attack: 16, defense: 2, xp: 18, traits: ["heavy"], dropChance: 0.12 },
  wraith: { name: "レイス", hp: 26, attack: 10, defense: 4, xp: 20, traits: ["fast"], dropChance: 0.12 },
  golem: { name: "ゴーレム", hp: 60, attack: 18, defense: 12, xp: 30, traits: ["armored", "heavy"], dropChance: 0.15 },
  glowSlime: { name: "光るスライム", hp: 10, attack: 2, defense: 1, xp: 25, traits: [], dropChance: 1 },
} as const satisfies Record<FoeKind, FoeSpec>;

/** 5 階ごとの帯に出る敵 */
const BAND_FOES = {
  1: ["slime", "rat"],
  2: ["goblin", "beetle"],
  3: ["skeleton", "ogre"],
  4: ["wraith", "golem"],
} as const satisfies Record<number, readonly FoeKind[]>;

type Band = keyof typeof BAND_FOES;

const RARE_CHANCE = 0.03;
const ALPHA_CHANCE = 0.02;

export type FloorConfig = {
  readonly monsterCount: number;
  readonly treasureCount: number;
  readonly rareChance: number;
};

const assertPositiveDepth = (depth: number): void => {
  if (!Number.isInteger(depth) || depth < 1) throw new RangeError(`depth must be an integer >= 1: ${depth}`);
};

export const bandOf = (depth: number): Band => (Math.min(Math.ceil(depth / 5), 4) as Band);

/** 深さごとのフロアの設定。深いほどモンスターが多く、レアが出やすい */
export const floorConfig = (depth: number): FloorConfig => {
  assertPositiveDepth(depth);
  return {
    monsterCount: Math.min(3 + Math.floor(depth / 2), 10),
    treasureCount: Math.min(3 + Math.floor(depth / 4), 6),
    rareChance: Math.min(0.05 + 0.02 * depth, 0.4),
  };
};

/** 種類と深さから、その階での強さを決める。帯の中で深いほど強い */
export const foeAt = (kind: FoeKind, depth: number, options: { readonly alpha?: boolean } = {}): Foe => {
  assertPositiveDepth(depth);
  const spec = FOES[kind];
  const scale = 1 + 0.15 * (depth - 1);
  const alpha = options.alpha === true;
  const power = alpha ? 2 : 1;
  return {
    kind,
    name: alpha ? `アルファ・${spec.name}` : spec.name,
    hp: Math.round(spec.hp * scale * power),
    attack: Math.round(spec.attack * scale * (alpha ? 1.5 : 1)),
    defense: spec.defense + Math.floor(depth / 5),
    xp: Math.round(spec.xp * scale * (alpha ? 3 : 1)),
    traits: spec.traits,
    rare: alpha || kind === "glowSlime",
    dropChance: alpha ? 1 : spec.dropChance,
  };
};

/** その深さに出る敵を 1 体選ぶ。まれに光るスライムやアルファが出る */
export const spawnFoe = (rng: Rng, depth: number): Foe => {
  const roll = rng.next();
  if (roll < RARE_CHANCE) return foeAt("glowSlime", depth);
  const kinds = BAND_FOES[bandOf(depth)];
  const kind = kinds[rng.int(kinds.length)] ?? "slime";
  return foeAt(kind, depth, { alpha: roll < RARE_CHANCE + ALPHA_CHANCE });
};

/** 群れの敵は 1 回の遭遇で何体と連戦するか */
export const swarmSize = (rng: Rng): number => 2 + rng.int(3);
