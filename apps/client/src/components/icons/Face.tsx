import type { ReactNode } from "react";
import type { Mood, Reaction } from "@sealight/sim";
import { CRAYON } from "./crayon";

const INK = "#3a2e28";
/** モンスターの体の色。日記の顔は、帰ってきたこの子の顔 */
const SKIN = "#8fd3c7";

type Expression = Mood | Reaction;

const happyEyes = <path d="M8 11.5q1.5-2 3 0M13 11.5q1.5-2 3 0" />;
const dotEyes = (
  <>
    <circle cx="9.5" cy="11" r="1.1" fill={INK} />
    <circle cx="14.5" cy="11" r="1.1" fill={INK} />
  </>
);
const sweat = <path d="M18.5 6.5q1.5 2 0 3a1 1 0 0 1-1.4-1.2z" fill="#9fd4f0" />;

/** 表情ごとの目と口 */
const FEATURES: Record<Expression, ReactNode> = {
  happy: (
    <>
      {happyEyes}
      <path d="M8.5 14.5q3.5 3.5 7 0z" fill="#f26b5b" />
    </>
  ),
  eager: (
    <>
      {happyEyes}
      <path d="M8 14q4 4.5 8 0z" fill="#f26b5b" />
      <path d="M19.5 3.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" fill="#ffd45a" />
    </>
  ),
  ok: (
    <>
      {dotEyes}
      <path d="M9.5 15q2.5 1.8 5 0" />
    </>
  ),
  calm: (
    <>
      {dotEyes}
      <path d="M9.5 15q2.5 1.8 5 0" />
    </>
  ),
  tired: (
    <>
      <path d="M8.3 11h2.4M13.3 11h2.4" />
      <path d="M9.5 15.5h5" />
      {sweat}
    </>
  ),
  nervous: (
    <>
      {dotEyes}
      <path d="M8.5 15.5q1-1 2 0t2 0 2 0 2 0" />
      {sweat}
    </>
  ),
  hurt: (
    <>
      <path d="M8.2 9.8l2.2 1.3-2.2 1.3M15.8 9.8l-2.2 1.3 2.2 1.3" />
      <path d="M9 16q1.5-1.3 3 0t3 0" />
    </>
  ),
  scared: (
    <>
      <circle cx="9.5" cy="10.8" r="1.8" fill="#fff" />
      <circle cx="14.5" cy="10.8" r="1.8" fill="#fff" />
      <circle cx="9.5" cy="11" r="0.8" fill={INK} />
      <circle cx="14.5" cy="11" r="0.8" fill={INK} />
      <path d="M9 16l1.2-1 1.2 1 1.2-1 1.2 1 1.2-1" />
      {sweat}
    </>
  ),
  down: (
    <>
      <path d="M8.3 9.8l2.4 2.4M10.7 9.8l-2.4 2.4M13.3 9.8l2.4 2.4M15.7 9.8l-2.4 2.4" />
      <ellipse cx="12" cy="15.6" rx="1.4" ry="1.2" />
    </>
  ),
};

/** モンスターの顔。耳の付いた丸い顔に、表情を描く（読み上げない。意味は周りの文字で伝える） */
export const Face = ({ expression, size = 20 }: { readonly expression: Expression; readonly size?: number }) => (
  <svg
    className="icon face"
    data-face={expression}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={INK}
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    filter={CRAYON}
    aria-hidden="true"
  >
    <path d="M5.5 7.5L4.5 2.8 8.8 5.2M18.5 7.5l1-4.7-4.3 2.4" fill="#6bb8ad" />
    <path d="M12 4.5c5 0 8.5 3.6 8.5 8.3S17 21 12 21s-8.5-3.5-8.5-8.2S7 4.5 12 4.5z" fill={SKIN} />
    <ellipse cx="6.8" cy="14.3" rx="1.4" ry="0.9" fill="#f7a4a4" stroke="none" />
    <ellipse cx="17.2" cy="14.3" rx="1.4" ry="0.9" fill="#f7a4a4" stroke="none" />
    {FEATURES[expression]}
  </svg>
);
