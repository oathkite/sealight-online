import type { Color } from "@sealight/engine";

/**
 * 中世ファンタジーの、少し落ち着いた色（sRGB）。
 * 可愛さのために形は丸く、色は彩度を抑えて暗めにし、灯りの暖かさが引き立つようにする
 */
const HEX = {
  grass: "#5f9a4a",
  plaster: "#e3d3b2",
  timber: "#5a3d2b",
  slate: "#56606e",
  slate_dark: "#454d5b",
  stone: "#9c95a4",
  stone_dark: "#726c7f",
  cobble: "#88828f",
  wood: "#8a6444",
  wood_dark: "#5e412d",
  wood_light: "#a67c55",
  iron: "#4a4a55",
  rope: "#b89a6a",
  soil: "#6d4a33",
  soil_light: "#86593c",
  cabbage: "#93c26a",
  pumpkin: "#d98a3a",
  sprout: "#6fae4a",
  straw: "#d8b65e",
  straw_dark: "#b8953f",
  blanket: "#8a4a5a",
  bowl: "#8a6444",
  bowl_water: "#9fd0e0",
  leaf: "#4f8f45",
  leaf_light: "#69a653",
  pine: "#2f6f4f",
  trunk: "#6b4a33",
  apple: "#c9453c",
  rock: "#8c8796",
  moss: "#5d8a44",
  reed: "#5f8f47",
  lily: "#4f9a50",
  mushroom: "#c9453c",
  mushroom_dot: "#f3eadb",
  mushroom_stem: "#eadfc8",
  banner: "#9c3a3a",
  glass: "#ffc56e",
  flame: "#ffb14a",
  rune: "#7fe2ff",
  gate_dark: "#15131f",
  flower_pink: "#d98ca0",
  flower_yellow: "#e8cf6a",
  flower_white: "#efe6d6",
  flower_lavender: "#9d86d6",
  monster: "#82cbbf",
  monster_dark: "#5fb0a3",
  eye: "#241f38",
  white: "#ffffff",
  cheek: "#f29a9a",
  bandage: "#f1ebdf",
  plaster_patch: "#e8c29a",
  sack: "#b58a58",
  sack_tie: "#7a5a3a",
} as const;

export type ColorName = keyof typeof HEX;

const toColor = (hex: string): Color => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const color = (name: ColorName): Color => toColor(HEX[name]);
