import type { FoeKind, Trait } from "./catalog";
import type { Direction, ExpeditionEvent, ExpeditionOutcome, LootSource } from "./expedition-types";
import type { Loot } from "./items";

export type Mood = "happy" | "ok" | "tired" | "hurt" | "down";
export type Margin = "easy" | "fine" | "close" | "failed";

export type JournalFoe = {
  readonly kind: FoeKind;
  readonly name: string;
  readonly count: number;
  readonly rare: boolean;
  /** 敵の特徴。報告から対策を考える手がかり */
  readonly traits: readonly Trait[];
};
export type JournalLoot = { readonly source: LootSource; readonly loot: Loot; readonly dropped: boolean };

/** 絵日記の断面図の 1 行。1 つの階を行き（または帰り）に通ったぶん */
export type JournalRow = {
  readonly depth: number;
  readonly direction: Direction;
  readonly startT: number;
  readonly endT: number;
  /** 階を出た時点の HP と食料 */
  readonly hp: number;
  readonly rations: number;
  readonly hearts: number;
  readonly mood: Mood;
  readonly foes: readonly JournalFoe[];
  readonly loot: readonly JournalLoot[];
  readonly rare: boolean;
  readonly starving: boolean;
  readonly turnaround: boolean;
  readonly death: "battle" | "hunger" | null;
};

/** 1 回の戦い（群れの場合は 1 体ぶん）の様子 */
export type BattleNote = {
  readonly depth: number;
  readonly foe: string;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly taken: number;
  /** こちらが攻撃した回数。多いほど攻撃が通りにくかった */
  readonly hits: number;
  /** 戦いの中で飲んだポーションの数 */
  readonly potions: number;
};

export type Journal = {
  readonly rows: readonly JournalRow[];
  readonly margin: Margin;
  /** 一番苦しかった戦い */
  readonly hardest: BattleNote | null;
  /** 最期の戦い（倒れたときだけ） */
  readonly final: BattleNote | null;
};

const HEARTS = 5;

export const heartsOf = (hp: number, maxHp: number): number => (hp <= 0 ? 0 : Math.max(1, Math.round((hp / maxHp) * HEARTS)));

export const moodOf = (hp: number, maxHp: number): Mood => {
  const ratio = hp / maxHp;
  if (ratio <= 0) return "down";
  if (ratio >= 0.8) return "happy";
  if (ratio >= 0.5) return "ok";
  if (ratio >= 0.25) return "tired";
  return "hurt";
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Draft = Mutable<Omit<JournalRow, "foes" | "loot" | "hearts" | "mood">> & {
  foes: JournalFoe[];
  loot: JournalLoot[];
};

const newRow = (e: Extract<ExpeditionEvent, { type: "floor" }>): Draft => ({
  depth: e.depth,
  direction: e.direction,
  startT: e.t,
  endT: e.t,
  hp: e.hp,
  rations: e.rations,
  foes: [],
  loot: [],
  rare: false,
  starving: false,
  turnaround: false,
  death: null,
});

const addFoe = (row: Draft, foe: Extract<ExpeditionEvent, { type: "encounter" }>["foe"]): void => {
  const found = row.foes.findIndex((f) => f.kind === foe.kind && f.name === foe.name);
  const existing = row.foes[found];
  if (existing) row.foes[found] = { ...existing, count: existing.count + 1 };
  else row.foes.push({ kind: foe.kind, name: foe.name, count: 1, rare: foe.rare, traits: foe.traits });
  if (foe.rare) row.rare = true;
};

/** 置いてきた装備は、拾った記録に印を付ける（拾った記録がなければ足す） */
const markDropped = (row: Draft, e: Extract<ExpeditionEvent, { type: "bagFull" }>): void => {
  const index = row.loot.findIndex((l) => l.loot.type === "item" && l.loot.item.id === e.item.id);
  const existing = row.loot[index];
  if (existing) row.loot[index] = { ...existing, dropped: true };
  else row.loot.push({ source: e.source, loot: { type: "item", item: e.item }, dropped: true });
};

const applyToRow = (row: Draft, e: ExpeditionEvent): void => {
  if ("t" in e) row.endT = e.t;
  if (e.type === "encounter") addFoe(row, e.foe);
  if (e.type === "loot") row.loot.push({ source: e.source, loot: e.loot, dropped: false });
  if (e.type === "bagFull") markDropped(row, e);
  if (e.type === "starving") row.starving = true;
  if (e.type === "turnaround") row.turnaround = true;
  if (e.type === "death") {
    row.death = e.cause;
    row.hp = 0;
  }
};

/** 冒険の出来事を、階ごとの行にまとめる */
const buildRows = (events: readonly ExpeditionEvent[], maxHp: number): readonly JournalRow[] => {
  const rows: Draft[] = [];
  for (const e of events) {
    if (e.type === "floor") {
      const previous = rows.at(-1);
      if (previous) {
        previous.hp = e.hp;
        previous.rations = e.rations;
      }
      rows.push(newRow(e));
    }
    const current = rows.at(-1);
    if (!current) continue;
    applyToRow(current, e);
    if (e.type === "home") current.hp = e.hp;
  }
  return rows.map((r) => ({ ...r, hearts: heartsOf(r.hp, maxHp), mood: moodOf(r.hp, maxHp) }));
};

/** 戦いごとに、前後の HP と受けたダメージを取り出す */
const battleNotes = (events: readonly ExpeditionEvent[]): readonly BattleNote[] => {
  const notes: Mutable<BattleNote>[] = [];
  for (const e of events) {
    if (e.type === "encounter") {
      notes.push({ depth: e.depth, foe: e.foe.name, hpBefore: e.hp, hpAfter: e.hp, taken: 0, hits: 0, potions: 0 });
      continue;
    }
    const note = notes.at(-1);
    if (!note) continue;
    if (e.type === "attack" && e.by === "player") note.hits += 1;
    if (e.type === "attack" && e.by === "foe") {
      note.taken += e.damage;
      note.hpAfter = e.hp;
    }
    if (e.type === "potion") {
      note.potions += 1;
      note.hpAfter = e.hp;
    }
  }
  return notes;
};

/** 冒険中に一番低かった HP（階を出た時点と、各戦いの直後）の割合で余裕を決める */
const marginOf = (
  rows: readonly JournalRow[],
  notes: readonly BattleNote[],
  maxHp: number,
  status: ExpeditionOutcome["status"],
): Margin => {
  if (status === "fainted") return "failed";
  const lowest = Math.min(...rows.map((r) => r.hp), ...notes.map((n) => n.hpAfter), maxHp) / maxHp;
  if (lowest >= 0.7) return "easy";
  if (lowest >= 0.4) return "fine";
  return "close";
};

/** 冒険の出来事から、絵日記の材料（階ごとの行、余裕、苦しかった戦い）を作る */
export const buildJournal = (
  events: readonly ExpeditionEvent[],
  outcome: Pick<ExpeditionOutcome, "maxHp" | "status">,
): Journal => {
  const rows = buildRows(events, outcome.maxHp);
  const notes = battleNotes(events);
  const hardest = notes.reduce<BattleNote | null>((worst, n) => (n.taken > (worst?.taken ?? 0) ? n : worst), null);
  return {
    rows,
    margin: marginOf(rows, notes, outcome.maxHp, outcome.status),
    hardest,
    final: outcome.status === "fainted" ? (notes.at(-1) ?? null) : null,
  };
};
