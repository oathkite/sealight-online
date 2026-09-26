import type { ReactNode } from "react";
import type { Equipment } from "@sealight/sim";
import { itemKind, type ItemKind } from "./items";

const INK = "#241a14";

/** 刃や金属の色。珍しい装備は名前に合わせて光る色にする */
type Palette = { readonly metal: string; readonly metalLight: string; readonly accent: string };

const COMMON: Palette = { metal: "#9aa3b2", metalLight: "#e3e8ef", accent: "#e6b45a" };
const RARE: readonly (readonly [string, Palette])[] = [
  ["灯火", { metal: "#f29a4f", metalLight: "#ffe1a0", accent: "#ffd27a" }],
  ["月光", { metal: "#8fa8ff", metalLight: "#e6ecff", accent: "#d5f6ff" }],
  ["深海", { metal: "#3aa7a0", metalLight: "#b8fff4", accent: "#7fe2ff" }],
  ["星鉄", { metal: "#9d7ae6", metalLight: "#efe2ff", accent: "#ffe1a0" }],
];

const paletteOf = (item: Pick<Equipment, "name" | "rarity">): Palette =>
  item.rarity === "rare" ? (RARE.find(([word]) => item.name.includes(word))?.[1] ?? { ...COMMON, metal: "#7fe2ff" }) : COMMON;

const WOOD = "#8a5a36";
const LEATHER = "#7a4a2e";

const SHAPES: Record<ItemKind, (p: Palette) => ReactNode> = {
  sword: (p) => (
    <>
      <path d="M13.5 3.5l6.5-1-1 6.5-9 9-3-3z" fill={p.metal} />
      <path d="M13.5 3.5l6.5-1-9.5 9.5-1.5-1.5z" fill={p.metalLight} />
      <path d="M5 13.5l5.5 5.5M4.5 19.5l2-2" stroke={p.accent} strokeWidth={2.4} />
      <path d="M6.5 17.5l-3 3" stroke={LEATHER} strokeWidth={2.6} />
    </>
  ),
  dagger: (p) => (
    <>
      <path d="M12 5l5-1.5-1.5 5-5.5 5.5-2.5-2.5z" fill={p.metal} />
      <path d="M12 5l5-1.5-6 6-1-1z" fill={p.metalLight} />
      <path d="M6.5 11.5l6 6" stroke={p.accent} strokeWidth={2.2} />
      <path d="M8 16l-3.5 3.5" stroke={LEATHER} strokeWidth={2.6} />
    </>
  ),
  club: () => (
    <>
      <path d="M6 20l7-7" stroke={WOOD} strokeWidth={3} />
      <path d="M11.5 10.5c1-4 5-7.5 8-6.5s0 6-2.5 8.5-5.5 2-5.5-2z" fill="#a8703f" />
      <circle cx="16" cy="8" r="0.9" fill={INK} />
      <circle cx="14" cy="11" r="0.8" fill={INK} />
    </>
  ),
  axe: (p) => (
    <>
      <path d="M5 20L16 7" stroke={WOOD} strokeWidth={2.6} />
      <path d="M13 5.5c2.5-2.5 6-2 7.5 0-1 1.5-.5 4 1 5.5-3.5 2-7 .5-8.5-2z" fill={p.metal} />
      <path d="M14.5 5c2-1.5 4.5-1.3 6 0" stroke={p.metalLight} strokeWidth={1.4} />
    </>
  ),
  stick: () => (
    <>
      <path d="M5 20c3-4 6-8 13-15" stroke={WOOD} strokeWidth={2.6} />
      <path d="M12 12c1 0 2.5-.5 3.5-2" stroke={WOOD} strokeWidth={1.6} />
    </>
  ),
  cloth: (p) => (
    <>
      <path d="M8 4l-4.5 3 2 4 2-1v10h9V10l2 1 2-4L16 4c-.5 2-2 3-4 3s-3.5-1-4-3z" fill="#c9b08a" />
      <path d="M8 13h8" stroke={p.accent} strokeWidth={1.4} />
    </>
  ),
  leather: (p) => (
    <>
      <path d="M7 4h10l2 4-1.5 12h-11L5 8z" fill={LEATHER} />
      <path d="M9 4c.5 2 1.5 3 3 3s2.5-1 3-3" fill="#5a3420" />
      <path d="M7.5 11h9M8 15h8" stroke={p.accent} strokeWidth={1.3} />
    </>
  ),
  shield: (p) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={WOOD} />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke={p.metal} strokeWidth={2} />
      <path d="M12 3.5v17M3.5 12h17" stroke="#6b4428" strokeWidth={1} />
      <circle cx="12" cy="12" r="2.4" fill={p.metalLight} />
    </>
  ),
  cloak: (p) => (
    <>
      <path d="M12 3c-3 0-5 2.5-5 5.5L4 20h16l-3-11.5C17 5.5 15 3 12 3z" fill={p.metal} />
      <path d="M12 3c-2 0-3.5 1.5-3.5 4 0 1.5 1.5 3 3.5 3s3.5-1.5 3.5-3c0-2.5-1.5-4-3.5-4z" fill="#1d1929" />
      <circle cx="12" cy="11.5" r="1.2" fill={p.accent} />
    </>
  ),
  plate: (p) => (
    <>
      <path d="M6 5h12l1.5 4-2 11h-11l-2-11z" fill={p.metal} />
      <path d="M12 5v15" stroke={p.metalLight} strokeWidth={1.4} />
      <path d="M6.5 9h11" stroke={p.accent} strokeWidth={1.4} />
    </>
  ),
  mail: (p) => (
    <>
      <path d="M7 4h10l2 4-1.5 12h-11L5 8z" fill={p.metal} />
      {[7, 10, 13, 16].map((y) => (
        <path key={y} d={`M8 ${y}h8`} stroke={INK} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="1 1.2" />
      ))}
    </>
  ),
};

/** 装備の絵。種類は名前から、色は珍しさと名前から決める。意味は周りの文字で伝える */
export const ItemIcon = ({ item, size = 40 }: { readonly item: Pick<Equipment, "name" | "slot" | "rarity">; readonly size?: number }) => (
  <svg className="item-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {SHAPES[itemKind(item)](paletteOf(item))}
  </svg>
);
