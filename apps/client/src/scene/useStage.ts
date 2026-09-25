import { useEffect, useRef, useState } from "react";
import { actLength, type Act } from "./stage";

export type Stage = {
  readonly act: Act;
  /** 場面が始まった時刻（performance.now() のミリ秒） */
  readonly since: number;
};

const settledAct = (present: boolean | null): Act => (present === false ? "away" : "home");
const AFTER: Partial<Record<Act, Act>> = { leaving: "away", arriving: "home" };

/**
 * モンスターが家にいるかどうかの変化から、場面を決める。
 * 画面を開いている間に出発したら出発の演出、帰ってきたら帰りの演出を挟む。
 * 開いたときの状態（読み込み中を含む）では演出を挟まない。hurt（ボロボロ）のときは帰りの演出が長い
 */
export const useStage = (present: boolean | null, hurt: boolean): Stage => {
  const [stage, setStage] = useState<Stage>(() => ({ act: settledAct(present), since: performance.now() }));
  const previous = useRef(present);

  useEffect(() => {
    const before = previous.current;
    previous.current = present;
    if (before === present) return;
    const act: Act = before === null || present === null ? settledAct(present) : present ? "arriving" : "leaving";
    setStage({ act, since: performance.now() });
  }, [present]);

  // 演出が終わったら、落ち着いた場面（家か留守）に移る
  useEffect(() => {
    const next = AFTER[stage.act];
    if (!next) return;
    const remaining = stage.since + actLength(stage.act, { hurt }) * 1000 - performance.now();
    const timer = window.setTimeout(() => setStage({ act: next, since: performance.now() }), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [stage, hurt]);

  return stage;
};
