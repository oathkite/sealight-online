import type { Tactics } from "@sealight/sim";

type TacticsFormProps = {
  readonly tactics: Tactics;
  readonly busy: boolean;
  readonly onChange: (tactics: Tactics) => void;
};

const THRESHOLDS = [0, 20, 30, 50, 70] as const;

const isPriority = (value: string): value is Tactics["priority"] => value === "stairs" || value === "treasure";

export const TacticsForm = ({ tactics, busy, onChange }: TacticsFormProps) => (
  <section aria-label="作戦">
    <h3>作戦</h3>
    <label className="field">
      <span>優先</span>
      <select
        aria-label="優先"
        disabled={busy}
        value={tactics.priority}
        onChange={(e) => {
          if (isPriority(e.target.value)) onChange({ ...tactics, priority: e.target.value });
        }}
      >
        <option value="stairs">階段を見つけたら進む（安全）</option>
        <option value="treasure">フロアを歩き尽くす（宝が多いが危険）</option>
      </select>
    </label>
    <label className="field">
      <span>ポーションを飲む HP</span>
      <select
        aria-label="ポーションを飲む HP"
        disabled={busy}
        value={tactics.potionThreshold}
        onChange={(e) => onChange({ ...tactics, potionThreshold: Number(e.target.value) })}
      >
        {THRESHOLDS.map((t) => (
          <option key={t} value={t}>
            {t === 0 ? "飲まない" : `${t}% 未満`}
          </option>
        ))}
      </select>
    </label>
  </section>
);
