import type { JournalLoot, JournalRow } from "@sealight/sim";
import { hearts, itemLabel, MOOD_FACES, SOURCES, TRAITS } from "./format";

const DIRECTION = { down: "行き", up: "帰り" } as const;

export const rowTitle = (row: JournalRow): string => `B${row.depth} ${DIRECTION[row.direction]}`;

const lootLabel = (l: JournalLoot): string => (l.loot.type === "gold" ? `${l.loot.amount} G` : itemLabel(l.loot.item));

/** 断面図の 1 行。仮の絵文字で描く（本番はクレヨン風の絵とアイコン） */
export const JournalRowView = ({ row, selected, onSelect }: { row: JournalRow; selected: boolean; onSelect: () => void }) => {
  const summary = [
    rowTitle(row),
    `ハート ${row.hearts}`,
    row.rare ? "レア" : "",
    row.death ? "倒れた" : "",
    row.starving ? "空腹" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={`journal-row${selected ? " selected" : ""}`} aria-label={summary} onClick={onSelect}>
      <span className="journal-depth">
        B{row.depth}
        {row.direction === "down" ? "↓" : "↑"}
      </span>
      <span aria-hidden="true">{MOOD_FACES[row.mood]}</span>
      <span className="journal-hearts" aria-hidden="true">
        {row.death ? "✕" : hearts(row.hearts)}
      </span>
      <span aria-hidden="true">{"🍞".repeat(Math.min(row.rations, 6))}</span>
      <span className="journal-events" aria-hidden="true">
        {row.foes.map((f) => `${f.rare ? "✨" : ""}${f.name}×${f.count}`).join(" ")}
        {row.loot.length > 0 ? ` 🎁${row.loot.length}` : ""}
        {row.starving ? " 🍽️" : ""}
        {row.turnaround ? " 🚩" : ""}
      </span>
    </button>
  );
};

/** 行を選んだときに出す詳しい記録 */
export const JournalRowDetail = ({ row }: { row: JournalRow }) => (
  <section className="journal-detail" aria-label={`${rowTitle(row)}の記録`}>
    <h3>{rowTitle(row)}の記録</h3>
    <ul>
      {row.foes.map((f) => (
        <li key={`${f.kind}-${f.name}`}>
          {f.rare ? "✨" : ""}
          {f.name} × {f.count}
          {f.traits.map((t) => (
            <span key={t} className="trait">
              {TRAITS[t]}
            </span>
          ))}
        </li>
      ))}
      {row.loot.map((l, i) => (
        <li key={i}>
          {SOURCES[l.source]} → {lootLabel(l)}
          {l.dropped ? "（荷物がいっぱいで置いてきた）" : ""}
        </li>
      ))}
      {row.starving ? <li>食料が尽きて、お腹を空かせていた</li> : null}
      {row.death ? <li>ここで力尽きた（{row.death === "hunger" ? "空腹" : "戦闘"}）</li> : null}
      {row.foes.length === 0 && row.loot.length === 0 && !row.death ? <li>何事もなく通り抜けた</li> : null}
    </ul>
  </section>
);
