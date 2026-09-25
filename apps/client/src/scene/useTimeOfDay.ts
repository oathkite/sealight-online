import { useEffect, useState } from "react";
import { hourOf, lightingAt, type Lighting } from "./timeOfDay";

const REFRESH_MS = 60_000;

/** URL の ?hour=19.5 で時刻を固定する（見た目の確認用） */
const fixedHour = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get("hour");
  if (raw === null) return null;
  const hour = Number(raw);
  return Number.isFinite(hour) ? hour : null;
};

/** いまの時刻の空と光。1 分ごとに更新する */
export const useTimeOfDay = (): Lighting => {
  const [hour, setHour] = useState(() => fixedHour() ?? hourOf(new Date()));
  useEffect(() => {
    if (fixedHour() !== null) return;
    const timer = window.setInterval(() => setHour(hourOf(new Date())), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  return lightingAt(hour);
};
