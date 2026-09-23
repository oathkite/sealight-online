import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const REPORT_INTERVAL_SEC = 0.5;

type FpsProbeProps = {
  readonly onReport: (fps: number) => void;
};

/** Canvas の中に置き、一定間隔で FPS を報告する */
export const FpsProbe = ({ onReport }: FpsProbeProps) => {
  const frames = useRef(0);
  const since = useRef<number | null>(null);

  useFrame(({ clock }) => {
    since.current ??= clock.elapsedTime;
    frames.current += 1;
    const elapsed = clock.elapsedTime - since.current;
    if (elapsed < REPORT_INTERVAL_SEC) return;
    onReport(Math.round(frames.current / elapsed));
    frames.current = 0;
    since.current = clock.elapsedTime;
  });

  return null;
};
