/*
 * シェーダー。フレームに共通の値は Frame ブロック（UBO）で一度に渡す。
 * 色は sRGB で受け取り、光の計算はリニアで行い、最後に柔らかく丸めて sRGB に戻す
 */

const FRAME_BLOCK = `
layout(std140) uniform Frame {
  mat4 uViewProj;
  mat4 uLightVP;
  vec4 uEye;        // xyz, w = 時刻
  vec4 uSunDir;     // xyz, w = 曲げの強さ
  vec4 uSun;        // rgb, w = 霞の始まり
  vec4 uShade;      // rgb, w = 霞の終わり
  vec4 uFill;       // rgb, w = 四隅の暗さ
  vec4 uHorizon;    // rgb, w = 影の地図の大きさ
  vec4 uGlow;       // 灯り, 魔法, 炎, 目印の灯り
  vec4 uFocus;      // 見せたい点の xz, 奥へ向かう向きの xz
  vec4 uViewport;   // 幅, 高さ, 光の数, 水の数
  vec4 uTerrain;    // 道の地図の左上のマスの xz, 幅, 高さ
  vec4 uLightPos[4];
  vec4 uLightCol[4];
  vec4 uWater[2];   // 中心の xz, 半径の xz
  vec4 uWind;       // 向きの xz, 強さ, 突風
  vec4 uTerrainPatterns; // 草, 道, 砂の模様の番号
};`;

const COMMON = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 tone(vec3 c){ c = c / (1.0 + c * 0.22) * 1.1; return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float vignette(){ vec2 uv = gl_FragCoord.xy / uViewport.xy - 0.5; return 1.0 - uFill.w * smoothstep(0.35, 0.95, length(uv * vec2(1.1, 1.0)) * 1.3); }`;

/** 奥の地面を下へ曲げる。曲げるのは画面に写す位置だけで、影と光は曲げる前の位置で計算する */
const CURVE = `
vec3 curved(vec3 p){
  vec2 rel = p.xz - uFocus.xy; float f = dot(rel, uFocus.zw); float s = dot(rel, vec2(-uFocus.w, uFocus.z));
  p.y -= uSunDir.w * ((f > 0.0 ? f * f : f * f * 0.3) + 0.2 * s * s);
  return p;
}`;

/** 風で揺らす。場所ごとに少しずつずれた波と、ゆっくり通り過ぎる突風を重ねる */
const WIND = `
vec3 windy(vec3 w, float sway){
  if (sway <= 0.0) return w;
  float t = uEye.w, phase = dot(w.xz, vec2(0.37, 0.21));
  float gust = sin(t * 0.6 - dot(w.xz, uWind.xy) * 0.35) * 0.5 + 0.5;
  vec2 push = uWind.xy * uWind.z * (0.35 + gust * uWind.w);
  vec2 flutter = vec2(sin(t * 2.3 + phase), cos(t * 1.9 + phase * 1.3)) * 0.12 * uWind.z;
  vec2 bend = (push + flutter) * sway;
  return vec3(w.x + bend.x, w.y - dot(bend, bend) * 0.4, w.z + bend.y);
}`;

export const MAIN_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aM;
layout(location=6) in float aPattern; layout(location=7) in float aSway;
${FRAME_BLOCK}
uniform mat4 uModel;
out vec3 vW, vC, vLocal, vLocalN; out float vM, vPattern;
${CURVE}
${WIND}
void main(){
  vec3 w = windy((uModel * vec4(aP, 1.0)).xyz, aSway);
  vW = w; vC = aC; vM = aM; vPattern = aPattern; vLocal = aP; vLocalN = aN;
  gl_Position = uViewProj * vec4(curved(w), 1.0);
}`;

/** 模様を三方向から貼り、凹凸（ノーマルマップ）を法線に混ぜる。low では一番向いている 1 方向だけ読む */
const DETAIL = `
struct Detail { vec3 n; float shade; float cavity; float rough; };
vec3 unpackN(vec2 v){ vec2 xy = v * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
Detail detailAt(vec3 p, vec3 n, float layer){
  if (layer < 0.5) return Detail(n, 1.0, 1.0, 0.8);
  vec3 q = p * uScales[int(layer + 0.5)];
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
#if TRIPLANAR
  vec4 d = texture(uDetail, vec3(q.zy, layer)) * w.x + texture(uDetail, vec3(q.xz, layer)) * w.y + texture(uDetail, vec3(q.xy, layer)) * w.z;
  vec3 tx = unpackN(texture(uNormals, vec3(q.zy, layer)).xy);
  vec3 ty = unpackN(texture(uNormals, vec3(q.xz, layer)).xy);
  vec3 tz = unpackN(texture(uNormals, vec3(q.xy, layer)).xy);
#else
  vec2 uv = w.x > w.y && w.x > w.z ? q.zy : (w.y > w.z ? q.xz : q.xy);
  vec4 d = texture(uDetail, vec3(uv, layer));
  vec3 tx = unpackN(texture(uNormals, vec3(uv, layer)).xy), ty = tx, tz = tx;
#endif
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return Detail(normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z), d.r * 2.0, d.g, d.b);
}`;

export const MAIN_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow; precision highp sampler2DArray;
${FRAME_BLOCK}
in vec3 vW, vC, vLocal, vLocalN; in float vM, vPattern;
uniform mat3 uNormal;
uniform sampler2DShadow uShadow; uniform sampler2D uPaths;
uniform sampler2DArray uDetail, uNormals; uniform float uScales[32];
out vec4 o;
${COMMON}
${DETAIL}
float shadowAt(vec3 w, vec3 n){
  vec4 s = uLightVP * vec4(w + n * 0.03, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float t = 0.0, px = 1.3 / uHorizon.w;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) t += texture(uShadow, vec3(c.xy + vec2(x, y) * px, c.z - 0.0012));
  return t / 9.0;
}
/** 地面。草の模様と道の模様を、マスの道の地図で混ぜ、池の縁は砂にする */
Detail terrain(vec3 w, vec3 geo, out vec3 color){
  float patchy = noise(w.xz * 0.45) * 0.6 + noise(w.xz * 1.6) * 0.4;
  vec3 grass = mix(lin(vC) * 0.82, lin(vC) * 1.08, smoothstep(0.35, 0.72, patchy));
  vec2 uv = (w.xz - uTerrain.xy + 0.5) / uTerrain.zw;
  float path = smoothstep(0.42, 0.52, texture(uPaths, uv).r + (noise(w.xz * 4.0) - 0.5) * 0.28);
  float sand = 1.0 - smoothstep(-0.08, -0.02, w.y);
  Detail g = detailAt(w, geo, uTerrainPatterns.x);
  Detail p = detailAt(w, geo, uTerrainPatterns.y);
  Detail s = detailAt(w, geo, uTerrainPatterns.z);
  vec3 dirt = mix(lin(vec3(0.62, 0.5, 0.36)), lin(vec3(0.54, 0.42, 0.3)), noise(w.xz * 3.0));
  color = mix(mix(grass * g.shade, dirt * p.shade, path), lin(vec3(0.7, 0.62, 0.46)) * s.shade, sand);
  vec3 n = normalize(mix(mix(g.n, p.n, path), s.n, sand));
  return Detail(n, 1.0, mix(mix(g.cavity, p.cavity, path), s.cavity, sand), mix(g.rough, p.rough, path));
}
vec3 water(vec3 w, vec3 V, float sh){
  int index = 0; float e = 10.0;
  for (int i = 0; i < 2; i++) { if (float(i) >= uViewport.w) break; float d = length((w.xz - uWater[i].xy) / uWater[i].zw); if (d < e) { e = d; index = i; } }
  vec2 q = (w.xz - uWater[index].xy) / uWater[index].zw; float ang = atan(q.y, q.x), t = uEye.w;
  vec3 c = mix(lin(vec3(0.1, 0.36, 0.52)), lin(vec3(0.3, 0.62, 0.68)), smoothstep(0.1, 0.95, e));
  float fe = 0.94 + 0.022 * sin(ang * 9.0 + t * 1.5) + 0.012 * sin(ang * 17.0 - t * 2.1);
  float foam = smoothstep(fe - 0.03, fe, e);
  float rip = noise(w.xz * 2.2 + vec2(t * 0.3, t * 0.17)) * 0.6 + noise(w.xz * 4.7 - t * 0.22) * 0.4;
  float lines = (1.0 - smoothstep(0.0, 0.025, abs(rip - 0.5))) * (1.0 - foam) * smoothstep(0.2, 0.7, e);
  c = c * (uFill.rgb * 1.1 + uSun.rgb * (0.3 + 0.35 * sh)) + lines * (uSun.rgb * 0.3 + uFill.rgb * 0.45);
  c = mix(c, uSun.rgb * 0.6 + uFill.rgb, foam * 0.85);
  return mix(c, lin(uHorizon.rgb), pow(1.0 - max(V.y, 0.0), 3.0) * 0.3);
}
vec3 shadeSurface(vec3 base, Detail d, vec3 V, float sh, int m){
  vec3 n = d.n;
  bool leaf = m == 5;
  if (leaf) base *= mix(0.78, 1.18, n.y * 0.5 + 0.5);
  float lit = smoothstep(leaf ? -0.3 : -0.05, 0.2, dot(n, uSunDir.xyz)) * sh;
  vec3 col = base * mix(uShade.rgb * d.cavity, uSun.rgb, lit) + base * uFill.rgb * (0.55 + 0.45 * n.y) * d.cavity;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += lin(uHorizon.rgb) * rim * 0.14 * (0.3 + 0.7 * lit);
  vec3 h = normalize(uSunDir.xyz + V);
  float gloss = m == 6 ? 0.7 : (1.0 - d.rough) * 0.35;
  col += uSun.rgb * pow(max(dot(n, h), 0.0), mix(90.0, 10.0, d.rough)) * gloss * lit;
  return col;
}
void main(){
  int m = int(vM + 0.5);
  vec3 V = normalize(uEye.xyz - vW), base = lin(vC), col;
  vec3 geo = normalize(uNormal * vLocalN);
  float sh = shadowAt(vW, geo);
  if (m == 4) col = water(vW, V, sh);
  else if (m == 3) { Detail d = terrain(vW, geo, base); col = shadeSurface(base, d, V, sh, m); }
  else {
    Detail d = detailAt(vLocal, normalize(vLocalN), vPattern);
    d.n = normalize(uNormal * d.n);
    col = shadeSurface(base * d.shade, d, V, sh, m);
  }
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uViewport.z) break;
    vec3 dl = uLightPos[i].xyz - vW; float dist = length(dl), a = max(0.0, 1.0 - dist / uLightPos[i].w);
    col += base * uLightCol[i].rgb * a * a * (0.3 + 0.7 * max(dot(geo, dl / dist), 0.0));
  }
  if (m == 1) col = base * (0.25 + uGlow.x * 2.4);
  if (m == 8) col = base * (0.25 + uGlow.w * 2.4);
  if (m == 2) col = base * (0.6 + uGlow.y * 1.6);
  if (m == 7) col = base * (1.2 + uGlow.z * (1.4 + 0.5 * sin(uEye.w * 13.0 + vW.x * 7.0) * sin(uEye.w * 7.3 + vW.z * 5.0)));
  col = mix(col, lin(uHorizon.rgb), smoothstep(uSun.w, uShade.w, length(vW - uEye.xyz)));
  o = vec4(tone(col) * vignette(), 1.0);
}`;

export const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=7) in float aSway;
${FRAME_BLOCK}
uniform mat4 uLightVPs; uniform mat4 uModel;
${WIND}
void main(){ gl_Position = uLightVPs * vec4(windy((uModel * vec4(aP, 1.0)).xyz, aSway), 1.0); }`;

export const SHADOW_FS = `#version 300 es
precision highp float; void main(){}`;

export const SKY_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.9999, 1.0); }`;

export const SKY_FS = `#version 300 es
precision highp float;
${FRAME_BLOCK}
uniform vec3 uTop; uniform vec2 uSkyParams; out vec4 o;
${COMMON}
void main(){
  vec2 uv = gl_FragCoord.xy / uViewport.xy; float t = uEye.w;
  vec3 c = mix(lin(uHorizon.rgb), lin(uTop), smoothstep(0.35, 1.0, uv.y));
  float cl = noise(vec2(uv.x * 3.0 + t * 0.015, uv.y * 7.0)) * 0.6 + noise(vec2(uv.x * 7.0 + t * 0.03, uv.y * 14.0)) * 0.4;
  c = mix(c, mix(lin(uHorizon.rgb), vec3(0.9), 0.6), smoothstep(0.6, 0.78, cl) * uSkyParams.y * smoothstep(0.45, 0.8, uv.y) * 0.75);
  c += step(0.9975, hash(floor(gl_FragCoord.xy / 2.0))) * uSkyParams.x * smoothstep(0.5, 0.9, uv.y);
  o = vec4(tone(c) * vignette(), 1.0);
}`;

/** 粒。球を粒ごとの位置と大きさに置き、色と不透明度で塗る（煙は光を受け、蛍は光る） */
export const PARTICLE_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
layout(location=4) in vec4 aInst; layout(location=5) in vec4 aTint;
${FRAME_BLOCK}
out vec3 vN; out vec4 vTint; out vec3 vW;
${CURVE}
void main(){ vec3 w = aInst.xyz + aP * aInst.w; vW = w; vN = aN; vTint = aTint; gl_Position = uViewProj * vec4(curved(w), 1.0); }`;

export const PARTICLE_FS = `#version 300 es
precision highp float;
${FRAME_BLOCK}
in vec3 vN; in vec4 vTint; in vec3 vW; uniform float uAdditive; out vec4 o;
${COMMON}
void main(){
  vec3 n = normalize(vN), base = lin(vTint.rgb), V = normalize(uEye.xyz - vW);
  vec3 lit = base * (uFill.rgb * 1.2 + uSun.rgb * (0.4 + 0.6 * max(dot(n, uSunDir.xyz), 0.0)));
  vec3 col = mix(lit, base * 1.8, uAdditive);
  // 縁ほど透かして、輪郭のない柔らかい玉にする（光る粒はより強く絞って、芯だけ明るく）
  float facing = max(dot(n, V), 0.0);
  float soft = mix(pow(facing, 0.9), pow(facing, 2.2), uAdditive);
  o = vec4(tone(col), vTint.a * soft);
}`;

/** 草の葉。1 枚の細い葉を、草ごとの位置・高さ・向き・幅で置き、先ほど強く風に揺らす */
export const FOLIAGE_VS = `#version 300 es
layout(location=0) in vec3 aBlade; layout(location=4) in vec4 aPlace; layout(location=5) in vec4 aShape;
${FRAME_BLOCK}
out vec3 vW, vN; out float vT, vShade;
${CURVE}
${WIND}
void main(){
  float c = cos(aShape.x), s = sin(aShape.x);
  vec3 local = vec3(aBlade.x * aShape.y, aBlade.y * aPlace.w, aBlade.z * aPlace.w);
  vec3 w = aPlace.xyz + vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
  w = windy(w, aBlade.y * aBlade.y * 1.1);
  vW = w; vT = aBlade.y; vShade = aShape.z;
  vN = normalize(mix(vec3(s, 0.0, c), vec3(0.0, 1.0, 0.0), 0.65));
  gl_Position = uViewProj * vec4(curved(w), 1.0);
}`;

export const FOLIAGE_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
${FRAME_BLOCK}
in vec3 vW, vN; in float vT, vShade;
uniform sampler2DShadow uShadow; uniform vec3 uGrass;
out vec4 o;
${COMMON}
float shadowAt(vec3 w){
  vec4 s = uLightVP * vec4(w, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  return texture(uShadow, vec3(c.xy, c.z - 0.002));
}
void main(){
  vec3 base = lin(uGrass) * mix(0.45, 1.2, vT) * vShade;
  float sh = shadowAt(vW);
  float lit = (0.45 + 0.55 * max(dot(vN, uSunDir.xyz), 0.0)) * sh;
  vec3 col = base * mix(uShade.rgb, uSun.rgb, lit) + base * uFill.rgb * mix(0.5, 1.0, vT);
  col += uSun.rgb * base * pow(max(dot(normalize(uEye.xyz - vW), -uSunDir.xyz), 0.0), 4.0) * vT * 0.6 * sh;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uViewport.z) break;
    float d = length(uLightPos[i].xyz - vW), a = max(0.0, 1.0 - d / uLightPos[i].w);
    col += base * uLightCol[i].rgb * a * a * 0.8;
  }
  col = mix(col, lin(uHorizon.rgb), smoothstep(uSun.w, uShade.w, length(vW - uEye.xyz)));
  o = vec4(tone(col) * vignette(), 1.0);
}`;

/** 布。uv で模様を貼り、表裏どちらからも見える。日に透けると裏から明るく光る */
export const CLOTH_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aUV;
${FRAME_BLOCK}
out vec3 vW, vN; out vec2 vUV;
${CURVE}
void main(){ vW = aP; vN = aN; vUV = aUV; gl_Position = uViewProj * vec4(curved(aP), 1.0); }`;

export const CLOTH_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow; precision highp sampler2DArray;
${FRAME_BLOCK}
in vec3 vW, vN; in vec2 vUV;
uniform sampler2DShadow uShadow; uniform sampler2DArray uDetail;
uniform vec3 uCloth; uniform float uClothPattern;
out vec4 o;
${COMMON}
float shadowAt(vec3 w){
  vec4 s = uLightVP * vec4(w, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  return texture(uShadow, vec3(c.xy, c.z - 0.002));
}
void main(){
  vec3 V = normalize(uEye.xyz - vW), n = normalize(vN);
  if (dot(n, V) < 0.0) n = -n;
  vec4 d = uClothPattern > 0.5 ? texture(uDetail, vec3(vUV, uClothPattern)) : vec4(0.5, 1.0, 0.9, 0.5);
  vec3 base = lin(uCloth) * d.r * 2.0;
  float sh = shadowAt(vW);
  float lit = smoothstep(-0.1, 0.3, dot(n, uSunDir.xyz)) * sh;
  vec3 col = base * mix(uShade.rgb * d.g, uSun.rgb, lit) + base * uFill.rgb * d.g * 0.8;
  col += base * uSun.rgb * max(dot(-n, uSunDir.xyz), 0.0) * 0.45 * sh;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uViewport.z) break;
    vec3 l = uLightPos[i].xyz - vW; float dist = length(l), a = max(0.0, 1.0 - dist / uLightPos[i].w);
    col += base * uLightCol[i].rgb * a * a * (0.4 + 0.6 * abs(dot(n, l / dist)));
  }
  col = mix(col, lin(uHorizon.rgb), smoothstep(uSun.w, uShade.w, length(vW - uEye.xyz)));
  o = vec4(tone(col) * vignette(), 1.0);
}`;

/** 模様を描くための、画面いっぱいの三角形 */
export const QUAD_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
out vec2 vUv;
void main(){ vUv = P[gl_VertexID] * 0.5 + 0.5; gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

/** 三方向の投影を使うかどうかを、シェーダーの先頭で決める */
export const withTriplanar = (source: string, on: boolean): string => source.replace("#version 300 es", `#version 300 es\n#define TRIPLANAR ${on ? 1 : 0}`);
