import { patternIndex, type PatternDef } from "@sealight/engine";
import type { ColorName } from "./palette";

/*
 * 模様（手続き生成のテクスチャ）。形はデフォルメのまま、木目、石の割れ目、葉脈などで本物らしさを出す。
 * uv は 0〜1 で、整数の周期の雑音だけを使って継ぎ目なく繰り返す
 */

const pattern = (name: string, scale: number, body: string): PatternDef => ({ name, scale, glsl: `Surface s = plain();\n${body}\nreturn s;` });

export const PATTERNS: readonly PatternDef[] = [
  pattern("plaster", 0.7, `
    float n = pfbm(uv * 8.0, 8.0, 5);
    float crack = (1.0 - smoothstep(0.0, 0.02, abs(pfbm(uv * 4.0, 4.0, 3) - 0.5))) * 0.4;
    s.height = n * 0.7 + pnoise(uv * 32.0, 32.0) * 0.3 - crack * 0.3;
    s.shade = 0.9 + n * 0.2; s.rough = 0.9; s.cavity = 1.0 - crack;`),
  pattern("wood", 1.2, `
    float g = pfbm2(uv * vec2(3.0, 24.0), vec2(3.0, 24.0), 4);
    float rings = sin((uv.y * 24.0 + g * 6.0) * 3.14159) * 0.5 + 0.5;
    s.height = 0.35 + rings * 0.35 + g * 0.3;
    s.shade = 0.82 + rings * 0.18 + g * 0.1; s.rough = 0.75;`),
  pattern("planks", 1.0, `
    float r = uv.y * 5.0, row = floor(r), fy = fract(r), off = hash21(vec2(row, 3.0));
    float c = uv.x * 2.0 + off, gx = fract(c), board = mod(floor(c), 2.0);
    float seam = smoothstep(0.0, 0.06, fy) * (1.0 - smoothstep(0.94, 1.0, fy)) * smoothstep(0.0, 0.02, gx) * (1.0 - smoothstep(0.98, 1.0, gx));
    float grain = pfbm2(vec2(uv.x * 4.0, uv.y * 40.0), vec2(4.0, 40.0), 4);
    s.height = seam * (0.55 + grain * 0.3);
    s.shade = (0.8 + grain * 0.25 + (hash21(vec2(row, board)) - 0.5) * 0.18) * mix(0.6, 1.0, seam);
    s.cavity = mix(0.5, 1.0, seam); s.rough = 0.8;`),
  pattern("masonry", 0.9, `
    float r = uv.y * 4.0, row = floor(r), fy = fract(r);
    float c = uv.x * 2.0 + mod(row, 2.0) * 0.5, col = mod(floor(c), 2.0), fx = fract(c);
    float d = min(min(fx, 1.0 - fx) / 2.0, min(fy, 1.0 - fy) / 4.0);
    float block = smoothstep(0.006, 0.04, d), n = pfbm(uv * 8.0, 8.0, 5);
    s.height = block * (0.55 + n * 0.45);
    s.shade = mix(0.55, 0.85 + hash21(vec2(col, row)) * 0.3 + n * 0.15, block);
    s.cavity = mix(0.45, 1.0, block); s.rough = 0.92;`),
  pattern("cobble", 1.4, `
    vec3 v = pvoronoi(uv * 6.0, 6.0);
    float stone = smoothstep(0.02, 0.18, v.y), n = pfbm(uv * 16.0, 16.0, 3);
    s.height = stone * (0.6 + (1.0 - v.x) * 0.3 + n * 0.1);
    s.shade = mix(0.55, 0.8 + v.z * 0.35 + n * 0.1, stone);
    s.cavity = mix(0.4, 1.0, stone); s.rough = 0.85;`),
  pattern("slate", 1.3, `
    float r = uv.y * 6.0, row = floor(r), fy = fract(r);
    float c = uv.x * 5.0 + mod(row, 2.0) * 0.5, col = mod(floor(c), 5.0), fx = fract(c);
    float side = smoothstep(0.0, 0.04, min(fx, 1.0 - fx)), lip = smoothstep(0.0, 0.15, fy), n = pfbm(uv * 12.0, 12.0, 4);
    s.height = (fy * 0.6 + 0.2) * side + n * 0.15;
    s.shade = (0.8 + hash21(vec2(col, row)) * 0.3 + n * 0.1) * mix(0.55, 1.0, lip * side);
    s.cavity = mix(0.5, 1.0, lip * side); s.rough = 0.7;`),
  pattern("bark", 1.5, `
    float g = pfbm2(uv * vec2(10.0, 3.0), vec2(10.0, 3.0), 5);
    float ridges = abs(sin((uv.x * 10.0 + g * 2.0) * 3.14159));
    s.height = ridges * 0.7 + g * 0.3; s.shade = 0.7 + ridges * 0.35;
    s.cavity = mix(0.5, 1.0, ridges); s.rough = 0.95;`),
  pattern("leaves", 1.3, `
    vec3 v = pvoronoi(uv * 7.0, 7.0), w = pvoronoi(uv * 13.0 + 0.5, 13.0);
    float h = max((1.0 - smoothstep(0.1, 0.55, v.x)), (1.0 - smoothstep(0.1, 0.5, w.x)) * 0.8);
    s.height = h; s.shade = 0.7 + h * 0.35 + v.z * 0.12;
    s.cavity = mix(0.55, 1.0, h); s.rough = 0.6;`),
  pattern("needles", 1.6, `
    float n = pfbm2(uv * vec2(40.0, 6.0), vec2(40.0, 6.0), 3), clump = 1.0 - pvoronoi(uv * 5.0, 5.0).x;
    s.height = n * 0.6 + clump * 0.4; s.shade = 0.7 + n * 0.4;
    s.cavity = mix(0.6, 1.0, clump); s.rough = 0.8;`),
  pattern("meadow", 0.5, `
    float n = pfbm(uv * 6.0, 6.0, 5), blades = pfbm2(uv * vec2(60.0, 20.0), vec2(60.0, 20.0), 2);
    vec3 c = pvoronoi(uv * 9.0, 9.0);
    float clover = (1.0 - smoothstep(0.05, 0.25, c.x)) * step(0.7, c.z);
    s.height = n * 0.5 + blades * 0.4 + clover * 0.2;
    s.shade = 0.85 + n * 0.25 + blades * 0.1 + clover * 0.15;
    s.rough = 0.9; s.cavity = 0.85 + blades * 0.15;`),
  pattern("dirt", 0.7, `
    float n = pfbm(uv * 5.0, 5.0, 5);
    vec3 v = pvoronoi(uv * 14.0, 14.0);
    float pebble = (1.0 - smoothstep(0.1, 0.35, v.x)) * step(0.55, v.z);
    s.height = n * 0.5 + pebble * 0.5;
    s.shade = 0.85 + n * 0.25 + pebble * (v.z - 0.5) * 0.6;
    s.cavity = mix(0.75, 1.0, n); s.rough = 0.95;`),
  pattern("soil", 1.2, `
    vec3 v = pvoronoi(uv * 10.0, 10.0);
    float n = pfbm(uv * 8.0, 8.0, 4), clod = (1.0 - smoothstep(0.0, 0.6, v.x));
    s.height = clod * 0.6 + n * 0.4; s.shade = 0.75 + clod * 0.3 + n * 0.1;
    s.cavity = mix(0.55, 1.0, clod); s.rough = 0.98;`),
  pattern("straw", 2.0, `
    float a = pfbm2(uv * vec2(4.0, 40.0), vec2(4.0, 40.0), 3), b = pfbm2(uv.yx * vec2(4.0, 40.0), vec2(4.0, 40.0), 3);
    float f = max(a, b * 0.8);
    s.height = f; s.shade = 0.75 + f * 0.45; s.cavity = mix(0.55, 1.0, f); s.rough = 0.85;`),
  pattern("cabbage", 2.2, `
    float n = pfbm(uv * 4.0, 4.0, 4);
    float vein = 1.0 - smoothstep(0.0, 0.05, pvoronoi(uv * 5.0, 5.0).y);
    float fine = 1.0 - smoothstep(0.0, 0.03, pvoronoi(uv * 12.0, 12.0).y);
    s.height = 0.5 + n * 0.3 - vein * 0.25 + fine * 0.1;
    s.shade = 0.9 + n * 0.15 + vein * 0.25 + fine * 0.08; s.rough = 0.45;`),
  pattern("pumpkin", 2.0, `
    float rib = abs(sin(uv.x * 8.0 * 3.14159)), n = pfbm(uv * 6.0, 6.0, 3);
    s.height = rib * 0.8 + n * 0.2; s.shade = 0.75 + rib * 0.3 + n * 0.1;
    s.cavity = mix(0.6, 1.0, rib); s.rough = 0.5;`),
  pattern("rock", 1.1, `
    float n = pfbm(uv * 4.0, 4.0, 6);
    float strata = sin((uv.y * 6.0 + n * 2.0) * 6.28318) * 0.5 + 0.5;
    float crack = 1.0 - smoothstep(0.0, 0.03, pvoronoi(uv * 5.0, 5.0).y);
    s.height = n * 0.7 + strata * 0.2 - crack * 0.3;
    s.shade = 0.75 + n * 0.3 + strata * 0.08 - crack * 0.25;
    s.cavity = 1.0 - crack * 0.5; s.rough = 0.9;`),
  pattern("fabric", 3.0, `
    float t = 24.0, wx = sin(uv.x * t * 6.28318) * 0.5 + 0.5, wy = sin(uv.y * t * 6.28318) * 0.5 + 0.5;
    float weave = mix(wx, wy, step(0.5, fract((floor(uv.x * t) + floor(uv.y * t)) * 0.5)));
    float n = pfbm(uv * 8.0, 8.0, 3);
    s.height = weave * 0.6 + n * 0.2; s.shade = 0.85 + weave * 0.2 + n * 0.1;
    s.cavity = mix(0.75, 1.0, weave); s.rough = 0.95;`),
  pattern("metal", 2.0, `
    vec3 v = pvoronoi(uv * 10.0, 10.0);
    float n = pfbm(uv * 12.0, 12.0, 4);
    s.height = 1.0 - v.x * 0.6 + n * 0.1; s.shade = 0.85 + n * 0.3; s.rough = 0.45 + n * 0.2; s.cavity = 0.9;`),
  pattern("fuzz", 2.5, `
    float n = pfbm(uv * 10.0, 10.0, 4);
    s.height = 0.5 + n * 0.15 + pnoise(uv * 64.0, 64.0) * 0.1; s.shade = 0.94 + n * 0.1; s.rough = 0.85;`),
  pattern("petal", 4.0, `
    float n = pfbm2(uv * vec2(24.0, 3.0), vec2(24.0, 3.0), 3);
    s.height = n * 0.6; s.shade = 0.9 + n * 0.2; s.rough = 0.6;`),
  pattern("sand", 1.2, `
    float n = pfbm(uv * 10.0, 10.0, 4), grain = hash21(floor(uv * 128.0));
    s.height = n * 0.6 + grain * 0.2; s.shade = 0.9 + n * 0.15 + grain * 0.08; s.rough = 0.95;`),
  pattern("banner", 1.0, `
    float t = 20.0, wx = sin(uv.x * t * 6.28318) * 0.5 + 0.5, wy = sin(uv.y * t * 6.28318) * 0.5 + 0.5;
    float weave = mix(wx, wy, step(0.5, fract((floor(uv.x * t) + floor(uv.y * t)) * 0.5)));
    vec2 c = uv - vec2(0.5, 0.42);
    float moon = (1.0 - smoothstep(0.17, 0.185, length(c))) * smoothstep(0.15, 0.165, length(c - vec2(0.07, -0.05)));
    float star = 1.0 - smoothstep(0.02, 0.035, length(uv - vec2(0.64, 0.28)));
    float border = clamp(step(0.86, uv.y) * step(uv.y, 0.92) + step(uv.x, 0.06) + step(0.94, uv.x), 0.0, 1.0);
    float emblem = max(moon, max(star, border));
    s.height = weave * 0.5 + emblem * 0.3;
    s.shade = (0.85 + weave * 0.15) * mix(1.0, 1.9, emblem);
    s.cavity = mix(0.8, 1.0, weave); s.rough = 0.95;`),
  pattern("moss", 1.5, `
    float n = pfbm(uv * 12.0, 12.0, 5);
    s.height = n; s.shade = 0.8 + n * 0.35; s.cavity = mix(0.6, 1.0, n); s.rough = 0.95;`),
];

export type PatternName =
  | "plaster" | "wood" | "planks" | "masonry" | "cobble" | "slate" | "bark" | "leaves" | "needles" | "meadow" | "dirt"
  | "soil" | "straw" | "cabbage" | "pumpkin" | "rock" | "fabric" | "metal" | "fuzz" | "petal" | "sand" | "banner" | "moss";

const INDEX = patternIndex(PATTERNS);

/** 模様の層の番号。模様なしは 0 */
export const patternNumber = (name: PatternName | null): number => (name ? (INDEX[name] ?? 0) : 0);

/** 色ごとの模様。光るもの、水、目のように模様を付けない色は null */
const PATTERN_OF: Readonly<Record<ColorName, PatternName | null>> = {
  grass: "meadow", plaster: "plaster", timber: "wood", slate: "slate", slate_dark: "slate", stone: "masonry", stone_dark: "masonry",
  cobble: "cobble", wood: "planks", wood_dark: "planks", wood_light: "wood", iron: "metal", rope: "straw", soil: "soil",
  soil_light: "soil", cabbage: "cabbage", pumpkin: "pumpkin", sprout: "leaves", straw: "straw", straw_dark: "straw",
  blanket: "fabric", bowl: "wood", bowl_water: null, leaf: "leaves", leaf_light: "leaves", pine: "needles", trunk: "bark",
  apple: null, rock: "rock", moss: "moss", reed: "needles", lily: "leaves", mushroom: "fuzz", mushroom_dot: null,
  mushroom_stem: "fuzz", banner: "fabric", glass: null, flame: null, rune: null, gate_dark: null, flower_pink: "petal",
  flower_yellow: "petal", flower_white: "petal", flower_lavender: "petal", monster: "fuzz", monster_dark: "fuzz", eye: null,
  white: null, cheek: "fuzz", bandage: "fabric", plaster_patch: "fabric", sack: "fabric", sack_tie: "straw",
};

export const patternOf = (color: ColorName): number => patternNumber(PATTERN_OF[color]);

/** 地面の草、道、砂の模様 */
export const TERRAIN_PATTERNS: readonly [number, number, number] = [patternNumber("meadow"), patternNumber("dirt"), patternNumber("sand")];
