import type { Frame } from "@/replay/timeline";

type ReplayHudProps = {
  readonly depth: number;
  readonly maxHp: number;
  readonly frame: Frame | null;
  readonly onSkip: () => void;
};

const Bar = ({ label, value, max, tone }: { label: string; value: number; max: number; tone: "hp" | "foe" }) => (
  <div className="bar">
    <span>{label}</span>
    <div className="bar-track">
      <div className={`bar-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
    </div>
    <span className="bar-value">
      {value} / {max}
    </span>
  </div>
);

/** 探索の結果の再生中に出す表示。HP、戦闘中の敵、直近の出来事 */
export const ReplayHud = ({ depth, maxHp, frame, onSkip }: ReplayHudProps) => (
  <section className="panel replay" aria-label="探索の結果">
    <h2>地下 {depth} 階の探索</h2>
    <Bar label="HP" value={frame?.hp ?? maxHp} max={maxHp} tone="hp" />
    {frame?.foe ? <Bar label={frame.foe.name} value={frame.foe.hp} max={frame.foe.maxHp} tone="foe" /> : null}
    <p className="log">{frame?.log ?? ""}</p>
    <button type="button" onClick={onSkip}>
      結果まで飛ばす
    </button>
  </section>
);
