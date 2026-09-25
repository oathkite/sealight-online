import { useMemo, useState } from "react";
import { buildJournal, type BattleNote, type ExpeditionResult } from "@sealight/sim";
import { formatDuration, itemLabel, MARGINS } from "./format";
import { JournalRowDetail, JournalRowView } from "./JournalRowView";

const BattleCard = ({ title, note }: { title: string; note: BattleNote }) => (
  <section className="journal-battle" aria-label={title}>
    <h3>{title}</h3>
    <p>
      B{note.depth} {note.foe}：HP {note.hpBefore} → {note.hpAfter}（受けたダメージ {note.taken}、こちらの攻撃 {note.hits} 回{note.potions > 0 ? `、ポーション ${note.potions} 本` : ""}）
    </p>
  </section>
);

type JournalProps = {
  readonly result: ExpeditionResult;
  readonly onClose: () => void;
};

/** 帰ってきたモンスターの絵日記。断面図の行を押すと詳しい記録が見られる */
export const Journal = ({ result, onClose }: JournalProps) => {
  const { outcome, input } = result;
  const journal = useMemo(() => buildJournal(result.events, outcome), [result, outcome]);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRow = selected === null ? null : journal.rows[selected];
  const returned = outcome.status === "returned";

  return (
    <section className="panel journal" aria-label="冒険の報告">
      <header>
        <h2>{returned ? "無事に帰ってきた！" : "ボロボロで帰ってきた…"}</h2>
        <p>
          目標 B{input.target} ／ 到達 B{outcome.reached} ・ {MARGINS[journal.margin]} ・ {formatDuration(outcome.durationSec)}
        </p>
      </header>

      <div className="journal-rows">
        {journal.rows.map((row, i) => (
          <JournalRowView key={i} row={row} selected={selected === i} onSelect={() => setSelected(selected === i ? null : i)} />
        ))}
      </div>
      {selectedRow ? <JournalRowDetail row={selectedRow} /> : null}

      {journal.hardest ? <BattleCard title="一番苦しかった戦い" note={journal.hardest} /> : null}
      {journal.final ? <BattleCard title="最期の戦い" note={journal.final} /> : null}

      <section className="report-items" aria-label="持ち帰ったもの">
        <h3>持ち帰ったもの</h3>
        {returned ? (
          <ul>
            <li>{outcome.gold} G</li>
            {outcome.items.map((item) => (
              <li key={item.id}>{itemLabel(item)}</li>
            ))}
            <li>経験値 {outcome.xp}</li>
          </ul>
        ) : (
          <p>拾ったものは持ち帰れなかった。経験（{outcome.xp}）と地図は残っている</p>
        )}
      </section>

      <button type="button" className="primary" onClick={onClose}>
        閉じる
      </button>
    </section>
  );
};
