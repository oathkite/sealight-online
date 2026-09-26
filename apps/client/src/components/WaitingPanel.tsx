import { useEffect, useState, type CSSProperties } from "react";
import type { Phase } from "@sealight/sim";
import { formatDuration, REACTIONS } from "./format";
import { depthRatio, MUTTERS, stageOf } from "./waiting";
import { Face } from "./icons/Face";

type Exploring = Extract<Phase, { type: "exploring" }>;

/**
 * 留守の間：地下へ潜る縦穴の図に、モンスターの駒を置く。本当の居場所は分からないので、
 * 目安の時間から見当をつけて動かす。経過時間と、進み具合に合わせたつぶやきも出す
 */
export const WaitingPanel = ({ phase }: { readonly phase: Exploring }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsedSec = Math.max(0, (now - phase.startedAt) / 1000);
  const { reaction, minMs, maxMs } = phase.estimate;
  const average = (minMs + maxMs) / 2;
  const progress = average > 0 ? (elapsedSec * 1000) / average : 1;
  const stage = stageOf(progress);
  const lines = MUTTERS[stage];
  const line = lines[Math.floor(elapsedSec / 8) % lines.length] ?? lines[0];
  const token = { "--depth": depthRatio(progress) } as CSSProperties;
  return (
    <section className="panel waiting" aria-label="留守番中">
      <div className="shaft" style={token} aria-hidden="true">
        {Array.from({ length: Math.min(phase.target, 12) }, (_, i) => (
          <span key={i} className="shaft-floor">B{Math.round(((i + 1) * phase.target) / Math.min(phase.target, 12))}</span>
        ))}
        <span className={`shaft-token ${stage}`}>
          <Face expression={reaction} size={30} />
        </span>
      </div>
      <div className="waiting-body">
        <h3 className="ribbon">冒険中</h3>
        <div>地下 {phase.target} 階を目指して冒険中</div>
        <div className="elapsed">出発から {formatDuration(elapsedSec)}</div>
        <p className="mutter">{line}</p>
        <div className="muted">
          目安は {formatDuration(minMs / 1000)}〜{formatDuration(maxMs / 1000)}。出発のとき {REACTIONS[reaction]}
        </div>
      </div>
    </section>
  );
};
