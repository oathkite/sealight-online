import type { ReactNode } from "react";

/** 画面の飾りに使う、くっきりした小さな絵（絵日記の手描きの絵とは別） */
const GLYPHS = {
  heart: <path d="M12 20c-4.5-3.2-7.8-6-7.8-9.6a4 4 0 0 1 7.8-1.6 4 4 0 0 1 7.8 1.6C19.8 14 16.5 16.8 12 20z" fill="#e8675e" />,
  sword: (
    <>
      <path d="M14 3.5l6.5-1-1 6.5-8.5 8.5-3-3z" fill="#cfd6e0" />
      <path d="M5.5 13l5.5 5.5M5 19l2-2" stroke="#e6b45a" strokeWidth={2.4} strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9.5-4.3-1.7-7.5-5-7.5-9.5V6z" fill="#8a5a36" />
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9.5z" fill="#a8703f" />
      <path d="M12 7v10M8 11h8" stroke="#e6b45a" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  potion: (
    <>
      <path d="M10 3h4v4.5l4 5.5a5 5 0 0 1-4 8h-4a5 5 0 0 1-4-8l4-5.5z" fill="#7fe2ff" fillOpacity={0.35} />
      <path d="M7.6 14h8.8a4 4 0 0 1-2.4 6.5h-4a4 4 0 0 1-2.4-6.5z" fill="#e8675e" />
      <path d="M9.5 3h5" stroke="#e6b45a" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  bread: (
    <>
      <path d="M3.5 13c0-3.8 3.8-6.3 8.5-6.3s8.5 2.5 8.5 6.3v3.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" fill="#e0a45a" />
      <path d="M8.5 9.5l-1.5 3M12.5 9l-1.5 3.2M16.5 9.5l-1.5 3" stroke="#a86a2e" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#e6b45a" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#a7742d" strokeWidth={1.4} />
      <path d="M12 8.5v7" stroke="#fff0c8" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  stairs: <path d="M4 20h5v-4h4v-4h4V8h3" fill="none" stroke="#7fe2ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />,
  gear: (
    <>
      <path
        d="M12 2.5l1.6 2.3 2.7-.7.7 2.7 2.6 1-1 2.6 1.9 2-1.9 2 1 2.6-2.6 1-.7 2.7-2.7-.7L12 21.5l-1.6-2.3-2.7.7-.7-2.7-2.6-1 1-2.6-1.9-2 1.9-2-1-2.6 2.6-1 .7-2.7 2.7.7z"
        fill="#e6b45a"
      />
      <circle cx="12" cy="12" r="3.2" fill="#1d1929" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#e6b45a" />
      <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="#e6b45a" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#b3a58d" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="#b3a58d" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof GLYPHS;

/** 飾りの絵。意味は周りの文字で伝えるので、読み上げない */
export const Glyph = ({ name, size = 18 }: { readonly name: GlyphName; readonly size?: number }) => (
  <svg className="glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {GLYPHS[name]}
  </svg>
);
