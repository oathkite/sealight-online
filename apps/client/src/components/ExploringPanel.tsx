import { useEffect, useState } from "react";

const formatRemaining = (ms: number): string => {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** 探索中：残り時間だけを出す。仕事の邪魔をしない */
export const ExploringPanel = ({ depth, endsAt }: { readonly depth: number; readonly endsAt: number }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = endsAt - now;
  return (
    <section className="panel compact" aria-label="探索中">
      <div>地下 {depth} 階を探索中（見ていなくても進みます）</div>
      <div className="countdown">{remaining > 0 ? formatRemaining(remaining) : "結果を受け取り中..."}</div>
    </section>
  );
};
