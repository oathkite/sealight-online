import type { ReactNode } from "react";
import { CRAYON } from "./crayon";

const INK = "#3a2e28";

/** 絵日記の小さな絵。線は太く丸く、少し揺らして手描きに見せる */
const ICONS = {
  heart: (
    <path d="M12 20.5c-4.8-3.4-8.2-6.4-8.2-10a4.3 4.3 0 0 1 8.2-1.9 4.3 4.3 0 0 1 8.2 1.9c0 3.6-3.4 6.6-8.2 10z" fill="#f26b5b" stroke={INK} />
  ),
  heartEmpty: (
    <path d="M12 20.5c-4.8-3.4-8.2-6.4-8.2-10a4.3 4.3 0 0 1 8.2-1.9 4.3 4.3 0 0 1 8.2 1.9c0 3.6-3.4 6.6-8.2 10z" fill="#fff6e6" stroke={INK} strokeDasharray="2.5 2" />
  ),
  bread: (
    <>
      <path d="M3.5 13.5c0-4 3.8-6.5 8.5-6.5s8.5 2.5 8.5 6.5v3.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" fill="#e0a45a" stroke={INK} />
      <path d="M8.5 9.5l-1.5 3M12.5 9l-1.5 3.2M16.5 9.5l-1.5 3" stroke="#a86a2e" />
    </>
  ),
  sparkle: <path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" fill="#ffd45a" stroke={INK} />,
  chest: (
    <>
      <path d="M3.5 10h17v9.5h-17z" fill="#c07a3e" stroke={INK} />
      <path d="M3.5 10c0-3.6 3.8-5.5 8.5-5.5s8.5 1.9 8.5 5.5" fill="#d8914c" stroke={INK} />
      <path d="M10.3 10h3.4v4h-3.4z" fill="#ffd45a" stroke={INK} />
    </>
  ),
  plate: (
    <>
      <ellipse cx="12" cy="14" rx="9" ry="5" fill="#f4f0e6" stroke={INK} />
      <ellipse cx="12" cy="13.5" rx="5" ry="2.4" fill="none" stroke="#b9aecb" />
      <path d="M17.5 4.5l1.5 4M20 4l-1 4.5" stroke={INK} />
    </>
  ),
  flag: (
    <>
      <path d="M6 21.5V3" stroke={INK} />
      <path d="M6 3.5c3-1.5 5 1.5 8 0s4 0 4 0v7s-1-1.5-4 0-5-1.5-8 0z" fill="#f26b5b" stroke={INK} />
    </>
  ),
  cross: <path d="M5 5l14 14M19 5L5 19" stroke="#c0392b" strokeWidth={3.2} />,
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

/** 飾りの絵。意味は周りの文字（aria-label）で伝えるので、読み上げない */
export const Icon = ({ name, size = 16 }: { readonly name: IconName; readonly size?: number }) => (
  <svg
    className="icon"
    data-icon={name}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    filter={CRAYON}
    aria-hidden="true"
  >
    {ICONS[name]}
  </svg>
);

/** 残りの HP をハートで表す。5 つのうち、残っている数だけ塗る */
export const HeartMeter = ({ count, max = 5 }: { readonly count: number; readonly max?: number }) => (
  <span className="heart-meter" role="img" aria-label={`ハート ${count} / ${max}`}>
    {Array.from({ length: max }, (_, i) => (
      <Icon key={i} name={i < count ? "heart" : "heartEmpty"} size={16} />
    ))}
  </span>
);

/** 画面に 1 つだけ置く、クレヨン風の線のフィルター */
export const CrayonFilter = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);
