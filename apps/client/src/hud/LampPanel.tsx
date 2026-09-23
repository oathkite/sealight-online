import { useEffect, useState } from "react";
import type { LampView } from "@/lamp/useLamp";

const formatRemaining = (ms: number): string => {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const Countdown = ({ endsAt }: { readonly endsAt: number }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = endsAt - now;
  return <div className="lamp-countdown">{remaining > 0 ? formatRemaining(remaining) : "結果を受け取り中..."}</div>;
};

type LampPanelProps = {
  readonly view: LampView;
  readonly onStart: () => void;
  readonly onReset: () => void;
};

export const LampPanel = ({ view, onStart, onReset }: LampPanelProps) => {
  switch (view.phase) {
    case "idle":
      return (
        <div className="lamp-panel">
          <button type="button" onClick={onStart}>
            灯をともす
          </button>
          {view.error ? <div className="lamp-error">開始できませんでした（{view.error}）</div> : null}
        </div>
      );
    case "starting":
      return <div className="lamp-panel">灯をともしています...</div>;
    case "running":
      return (
        <div className="lamp-panel">
          <div>探索中（見なくて大丈夫です）</div>
          <Countdown endsAt={view.endsAt} />
        </div>
      );
    case "done":
      return (
        <div className="lamp-panel">
          <div>灯の結果を再生中</div>
          <button type="button" onClick={onReset}>
            次の灯へ
          </button>
        </div>
      );
  }
};
