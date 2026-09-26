import type { CSSProperties } from "react";
import { attackFor, defenseFor, maxHpOf, STAT_KEYS, type CharacterState, type StatKey } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { STAT_LABELS } from "./format";
import { Face } from "./icons/Face";
import { Glyph, type GlyphName } from "./icons/Glyph";

type CharacterSheetProps = {
  readonly character: CharacterState;
  readonly busy: boolean;
  readonly onAllocate: (stat: StatKey) => void;
};

const Badge = ({ icon, label, value }: { icon: GlyphName; label: string; value: number }) => (
  <span className="badge">
    <Glyph name={icon} size={20} />
    <span className="badge-label">{label}</span>
    <strong>{value}</strong>
  </span>
);

/** モンスターの札。肖像とレベル、経験値の帯、強さ、持ち物、能力の振り分け */
export const CharacterSheet = ({ character, busy, onAllocate }: CharacterSheetProps) => {
  const { level, xp, stats, gold, potions, rations, unspentPoints, equipment, bestDepth } = character;
  const next = level * 10;
  const progress = { "--progress": `${next > 0 ? Math.min(100, (xp / next) * 100) : 0}%` } as CSSProperties;
  return (
    <section className="sheet" aria-label="キャラクター">
      <div className="portrait">
        <Face expression={unspentPoints > 0 ? "eager" : "happy"} size={64} />
        <span className="level">Lv {level}</span>
      </div>
      <div className="sheet-main">
        <div className="xp" style={progress}>
          <span className="xp-bar" aria-hidden="true" />
          <span className="muted">
            経験値 {xp} / {next}
          </span>
        </div>
        <div className="badges">
          <Badge icon="heart" label="HP" value={maxHpOf(character)} />
          <Badge icon="sword" label="攻" value={attackFor(stats, equipment.weapon)} />
          <Badge icon="shield" label="防" value={defenseFor(stats, equipment.armor)} />
        </div>
        <div className="resources">
          <span className="chip"><Glyph name="coin" /><strong>{gold}</strong> G</span>
          <span className="chip"><Glyph name="potion" />ポーション {potions}</span>
          <span className="chip"><Glyph name="bread" />食料 {rations}</span>
          <span className="chip"><Glyph name="stairs" />最深 地下 {bestDepth} 階</span>
        </div>
        <div className="stats">
          {STAT_KEYS.map((key) => (
            <span key={key} className="stat">
              {STAT_LABELS[key]} <strong>{stats[key]}</strong>
              {unspentPoints > 0 ? (
                <button
                  type="button"
                  className="gem"
                  aria-label={`${STAT_LABELS[key]}を上げる`}
                  disabled={busy}
                  onClick={() => {
                    playSfx("tap");
                    onAllocate(key);
                  }}
                >
                  +
                </button>
              ) : null}
            </span>
          ))}
          {unspentPoints > 0 ? <span className="points">残り {unspentPoints} ポイント</span> : null}
        </div>
      </div>
    </section>
  );
};
