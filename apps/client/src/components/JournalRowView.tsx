import type { JournalLoot, JournalRow } from "@sealight/sim";
import { itemLabel, SOURCES, TRAITS } from "./format";
import { Face } from "./icons/Face";
import { HeartMeter, Icon } from "./icons/Icon";

const DIRECTION = { down: "行き", up: "帰り" } as const;

export const rowTitle = (row: JournalRow): string => `B${row.depth} ${DIRECTION[row.direction]}`;

const lootLabel = (l: JournalLoot): string => (l.loot.type === "gold" ? `${l.loot.amount} G` : itemLabel(l.loot.item));

/** 食料の絵は、多くても 6 つまで並べる */
const MAX_BREAD = 6;

/** 断面図の 1 行。モンスターの顔、ハート、食料、会った敵と出来事の絵を並べる */
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
      <Face expression={row.mood} size={26} />
      <span className="journal-hearts" aria-hidden="true">
        {row.death ? <Icon name="cross" size={18} /> : <HeartMeter count={row.hearts} />}
      </span>
      <span className="journal-bread" aria-hidden="true">
        {Array.from({ length: Math.min(row.rations, MAX_BREAD) }, (_, i) => (
          <Icon key={i} name="bread" size={16} />
        ))}
      </span>
      <span className="journal-events" aria-hidden="true">
        {row.foes.map((f) => (
          <span key={`${f.kind}-${f.name}`} className="journal-foe">
            {f.rare ? <Icon name="sparkle" size={15} /> : null}
            {f.name}×{f.count}
          </span>
        ))}
        {row.loot.length > 0 ? (
          <span className="journal-foe">
            <Icon name="chest" size={17} />
            {row.loot.length}
          </span>
        ) : null}
        {row.starving ? <Icon name="plate" size={17} /> : null}
        {row.turnaround ? <Icon name="flag" size={17} /> : null}
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
          {f.rare ? <Icon name="sparkle" size={13} /> : null}
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
