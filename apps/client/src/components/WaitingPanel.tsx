import { useEffect, useState } from "react";
import type { Phase } from "@sealight/sim";
import { formatDuration, REACTIONS } from "./format";

type Exploring = Extract<Phase, { type: "exploring" }>;

/** 留守の間：出発からの経過時間と、目安だけを出す。帰る時刻は分からない */
export const WaitingPanel = ({ phase }: { readonly phase: Exploring }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsedSec = Math.max(0, (now - phase.startedAt) / 1000);
  const reaction = REACTIONS[phase.estimate.reaction];
  return (
    <section className="panel compact" aria-label="留守番中">
      <div>地下 {phase.target} 階を目指して冒険中</div>
      <div className="elapsed">出発から {formatDuration(elapsedSec)}</div>
      <div className="muted">
        目安は {formatDuration(phase.estimate.minMs / 1000)}〜{formatDuration(phase.estimate.maxMs / 1000)}。
        出発のとき {reaction.face} {reaction.label}
      </div>
    </section>
  );
};
