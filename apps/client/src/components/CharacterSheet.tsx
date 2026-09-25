import { attackFor, defenseFor, maxHpOf, STAT_KEYS, type CharacterState, type StatKey } from "@sealight/sim";
import { STAT_LABELS } from "./format";

type CharacterSheetProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onAllocate: (stat: StatKey) => void;
};

export const CharacterSheet = ({ character, busy, onAllocate }: CharacterSheetProps) => {
  const { level, xp, stats, gold, potions, rations, unspentPoints, equipment, bestDepth } = character;
  return (
    <section className="sheet" aria-label="キャラクター">
      <div className="sheet-row">
        <strong>Lv {level}</strong>
        <span>経験値 {xp} / {level * 10}</span>
        <span>最深 地下 {bestDepth} 階</span>
      </div>
      <div className="sheet-row">
        <span>HP {maxHpOf(character)}</span>
        <span>攻 {attackFor(stats, equipment.weapon)}</span>
        <span>防 {defenseFor(stats, equipment.armor)}</span>
        <span>{gold} G</span>
        <span>ポーション {potions}</span>
        <span>食料 {rations}</span>
      </div>
      <div className="sheet-row">
        {STAT_KEYS.map((key) => (
          <span key={key} className="stat">
            {STAT_LABELS[key]} {stats[key]}
            {unspentPoints > 0 ? (
              <button type="button" aria-label={`${STAT_LABELS[key]}を上げる`} disabled={busy} onClick={() => onAllocate(key)}>
                +
              </button>
            ) : null}
          </span>
        ))}
        {unspentPoints > 0 ? <span className="accent">残り {unspentPoints} ポイント</span> : null}
      </div>
    </section>
  );
};
