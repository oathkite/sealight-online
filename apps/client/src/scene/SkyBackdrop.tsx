import { useMemo } from "react";
import { createRng } from "@sealight/sim";
import type { Lighting } from "./timeOfDay";

const STAR_COUNT = 70;

/** 星の位置。box-shadow で一度に描く */
const useStarField = (): string =>
  useMemo(() => {
    const rng = createRng(4242);
    return Array.from({ length: STAR_COUNT }, () => {
      const x = (rng.next() * 100).toFixed(1);
      const y = (rng.next() * 70).toFixed(1);
      const alpha = (0.4 + rng.next() * 0.6).toFixed(2);
      return `${x}vw ${y}vh 0 rgb(255 255 240 / ${alpha})`;
    }).join(",");
  }, []);

/** 3D の後ろに敷く空。時刻の色のグラデーションと、夜の星 */
export const SkyBackdrop = ({ lighting }: { lighting: Lighting }) => {
  const stars = useStarField();
  return (
    <div className="sky" style={{ background: `linear-gradient(to bottom, ${lighting.skyTop} 0%, ${lighting.skyBottom} 85%)` }} aria-hidden="true">
      <div className="sky-stars" style={{ boxShadow: stars, opacity: lighting.stars }} />
    </div>
  );
};
