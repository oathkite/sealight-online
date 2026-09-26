/*
 * 模様（手続き生成のテクスチャ）。起動時に GPU で描き、配列テクスチャの層にする。
 * 画像を配らないので読み込みがなく、解像度は画質の段階で選べる。
 * 模様は継ぎ目なく繰り返すよう、uv（0〜1）で周期のある雑音から作る
 */

/** 配列テクスチャの層の数の上限（0 番の模様なしを含む） */
export const MAX_PATTERNS = 32;

/**
 * 模様の定義。glsl は `Surface patternN(vec2 uv)` の中身。
 * Surface は height（凹凸、0〜1）、shade（色の明るさの倍率、1 が元の色）、rough（ざらつき 0〜1）、cavity（隙間の暗さ、1 が明るい）
 */
export type PatternDef = {
  readonly name: string;
  /** 1 単位（1 マス）あたりの繰り返しの回数 */
  readonly scale: number;
  readonly glsl: string;
};

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform int uPattern;
in vec2 vUv;
layout(location=0) out vec4 oDetail;
layout(location=1) out vec4 oNormal;
struct Surface { float height; float shade; float rough; float cavity; };
Surface plain(){ return Surface(0.5, 1.0, 0.8, 1.0); }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash22(vec2 p){ float n = hash21(p); return vec2(n, hash21(p + n)); }
/** 縦と横で周期の違う値の雑音（木目や繊維のように、一方向に伸びた模様に使う） */
float pnoise2(vec2 p, vec2 period){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 a = mod(i, period), b = mod(i + 1.0, period);
  return mix(mix(hash21(a), hash21(vec2(b.x, a.y)), f.x), mix(hash21(vec2(a.x, b.y)), hash21(b), f.x), f.y);
}
/** 周期 period で繰り返す値の雑音 */
float pnoise(vec2 p, float period){ return pnoise2(p, vec2(period)); }
/** 周期のある雑音を重ねる（細かいほど弱く） */
float pfbm2(vec2 p, vec2 period, int octaves){
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 6; i++) { if (i >= octaves) break; sum += amp * pnoise2(p, period); p *= 2.0; period *= 2.0; amp *= 0.5; }
  return sum;
}
float pfbm(vec2 p, float period, int octaves){ return pfbm2(p, vec2(period), octaves); }
/** 周期のあるボロノイ。x = 一番近い点までの距離、y = 二番目との差（境目で 0）、z = 区画の番号（0〜1） */
vec3 pvoronoi(vec2 p, float period){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y), cell = mod(i + g, period), o = hash22(cell);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = hash21(cell + 7.1); } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2 - d1, id);
}
`;

const MAIN = `
void main(){
  Surface s = pick(vUv);
  // 凹凸の傾きは決まった幅で測る。テクスチャの大きさ（画質の段階）で凹凸の強さが変わらないように
  const float STEP = 1.0 / 256.0;
  float hx = pick(vUv + vec2(STEP, 0.0)).height - pick(vUv - vec2(STEP, 0.0)).height;
  float hy = pick(vUv + vec2(0.0, STEP)).height - pick(vUv - vec2(0.0, STEP)).height;
  vec3 n = normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0));
  oDetail = vec4(clamp(s.shade * 0.5, 0.0, 1.0), clamp(s.cavity, 0.0, 1.0), clamp(s.rough, 0.0, 1.0), clamp(s.height, 0.0, 1.0));
  oNormal = vec4(n.xy * 0.5 + 0.5, 0.0, 1.0);
}`;

/** 模様ごとの関数と、番号で選ぶ分岐から、模様を描くシェーダーを組み立てる */
export const synthesisShader = (patterns: readonly PatternDef[]): string => {
  if (patterns.length >= MAX_PATTERNS) throw new Error(`patterns must be fewer than ${MAX_PATTERNS}`);
  const functions = patterns.map((p, i) => `Surface pattern${i + 1}(vec2 uv){\n${p.glsl}\n}`).join("\n");
  const branches = patterns.map((_, i) => `  if (uPattern == ${i + 1}) return pattern${i + 1}(uv);`).join("\n");
  const pick = `Surface pick(vec2 uv){\n  uv = fract(uv);\n${branches}\n  return plain();\n}`;
  return `${PRELUDE}\n${functions}\n${pick}\n${MAIN}`;
};

/** 名前から層の番号を引く表。0 番は模様なし */
export const patternIndex = (patterns: readonly PatternDef[]): Readonly<Record<string, number>> =>
  Object.fromEntries(patterns.map((p, i) => [p.name, i + 1]));

/** 層ごとの繰り返しの細かさ。シェーダーに配列で渡す */
export const patternScales = (patterns: readonly PatternDef[]): Float32Array => {
  const scales = new Float32Array(MAX_PATTERNS).fill(1);
  patterns.forEach((p, i) => { scales[i + 1] = p.scale; });
  return scales;
};
