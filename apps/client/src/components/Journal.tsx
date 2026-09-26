import { useMemo, useState } from "react";
import { buildJournal, type BattleNote, type CharacterState, type ExpeditionResult } from "@sealight/sim";
import { formatDuration, MARGINS } from "./format";
import { Face } from "./icons/Face";
import { JournalRowDetail, JournalRowView } from "./JournalRowView";
import { LootReveal } from "./LootReveal";

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
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onEquip: (itemId: string) => void;
  readonly onClose: () => void;
};

/**
 * 帰ってきたモンスターの報告。まず持ち帰った袋を開けて宝を見せ、
 * そのあとに絵日記（断面図の行を押すと詳しい記録が見られる）を広げる
 */
export const Journal = ({ result, character, busy, onEquip, onClose }: JournalProps) => {
  const { outcome, input } = result;
  const journal = useMemo(() => buildJournal(result.events, outcome), [result, outcome]);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRow = selected === null ? null : journal.rows[selected];
  const returned = outcome.status === "returned";

  return (
    <section className="panel report" aria-label="冒険の報告">
      <header className="report-header">
        <Face expression={returned ? "happy" : "hurt"} size={46} />
        <div>
          <h2>{returned ? "無事に帰ってきた！" : "ボロボロで帰ってきた…"}</h2>
          <p className="muted">
            目標 B{input.target} ／ 到達 B{outcome.reached} ・ {MARGINS[journal.margin]} ・ {formatDuration(outcome.durationSec)}
          </p>
        </div>
      </header>

      <section className="report-items" aria-label="持ち帰ったもの">
        <h3 className="ribbon">持ち帰ったもの</h3>
        {returned ? (
          <LootReveal gold={outcome.gold} xp={outcome.xp} items={outcome.items} character={character} busy={busy} onEquip={onEquip} />
        ) : (
          <p className="muted">拾ったものは持ち帰れなかった。経験（{outcome.xp}）と地図は残っている</p>
        )}
      </section>

      <section className="journal parchment" aria-label="絵日記">
        <div className="journal-rows">
          {journal.rows.map((row, i) => (
            <JournalRowView key={i} row={row} selected={selected === i} onSelect={() => setSelected(selected === i ? null : i)} />
          ))}
        </div>
        {selectedRow ? <JournalRowDetail row={selectedRow} /> : null}
        {journal.hardest ? <BattleCard title="一番苦しかった戦い" note={journal.hardest} /> : null}
        {journal.final ? <BattleCard title="最期の戦い" note={journal.final} /> : null}
      </section>

      <button type="button" className="gold" onClick={onClose}>
        閉じる
      </button>
    </section>
  );
};
