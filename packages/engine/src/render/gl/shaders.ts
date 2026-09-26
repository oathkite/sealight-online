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

export const MAIN_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aM;
${FRAME_BLOCK}
uniform mat4 uModel; uniform mat3 uNormal;
out vec3 vW, vN, vC; out float vM;
${CURVE}
void main(){
  vec4 w = uModel * vec4(aP, 1.0); vW = w.xyz; vN = uNormal * aN; vC = aC; vM = aM;
  gl_Position = uViewProj * vec4(curved(w.xyz), 1.0);
}`;

export const MAIN_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
${FRAME_BLOCK}
in vec3 vW, vN, vC; in float vM;
uniform sampler2DShadow uShadow; uniform sampler2D uPaths;
out vec4 o;
${COMMON}
float shadowAt(vec3 w, vec3 n){
  vec4 s = uLightVP * vec4(w + n * 0.03, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float t = 0.0, px = 1.3 / uHorizon.w;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) t += texture(uShadow, vec3(c.xy + vec2(x, y) * px, c.z - 0.0012));
  return t / 9.0;
}
vec3 terrain(vec3 w){
  float patchy = noise(w.xz * 0.45) * 0.6 + noise(w.xz * 1.6) * 0.4;
  vec3 g = mix(lin(vC) * 0.82, lin(vC) * 1.08, smoothstep(0.35, 0.72, patchy));
  vec2 cell = floor(w.xz * 2.0 + 0.5); vec2 f = fract(w.xz * 2.0 + 0.5) - 0.5;
  vec2 q = f - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.4;
  float tri = max(abs(q.x) * 1.8 - q.y, q.y * 1.6);
  g = mix(g, g * 1.45, (1.0 - smoothstep(0.07, 0.085, tri)) * step(0.55, hash(cell)));
  vec2 uv = (w.xz - uTerrain.xy + 0.5) / uTerrain.zw;
  float path = texture(uPaths, uv).r + (noise(w.xz * 4.0) - 0.5) * 0.28;
  vec3 dirt = mix(lin(vec3(0.62, 0.5, 0.36)), lin(vec3(0.54, 0.42, 0.3)), noise(w.xz * 7.0));
  dirt = mix(dirt, lin(vec3(0.5, 0.48, 0.5)), step(0.72, hash(floor(w.xz * 3.0))) * 0.5);
  g = mix(g, dirt, smoothstep(0.42, 0.5, path));
  return mix(g, lin(vec3(0.7, 0.62, 0.46)), 1.0 - smoothstep(-0.08, -0.02, w.y));
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
void main(){
  int m = int(vM + 0.5);
  vec3 n = normalize(vN), V = normalize(uEye.xyz - vW), base = lin(vC), col;
  float sh = shadowAt(vW, n);
  if (m == 4) col = water(vW, V, sh);
  else {
    if (m == 3) base = terrain(vW);
    bool leaf = m == 5;
    if (leaf) base *= mix(0.78, 1.18, n.y * 0.5 + 0.5);
    float lit = smoothstep(leaf ? -0.3 : -0.05, 0.2, dot(n, uSunDir.xyz)) * sh;
    col = base * mix(uShade.rgb, uSun.rgb, lit) + base * uFill.rgb * (0.55 + 0.45 * n.y);
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    col += lin(uHorizon.rgb) * rim * 0.14 * (0.3 + 0.7 * lit);
    if (m == 6) col += vec3(pow(max(dot(n, normalize(uSunDir.xyz + V)), 0.0), 60.0)) * 0.7 * (0.3 + 0.7 * sh);
  }
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uViewport.z) break;
    vec3 d = uLightPos[i].xyz - vW; float dist = length(d), a = max(0.0, 1.0 - dist / uLightPos[i].w);
    col += base * uLightCol[i].rgb * a * a * (0.3 + 0.7 * max(dot(n, d / dist), 0.0));
  }
  if (m == 1) col = base * (0.25 + uGlow.x * 2.4);
  if (m == 8) col = base * (0.25 + uGlow.w * 2.4);
  if (m == 2) col = base * (0.6 + uGlow.y * 1.6);
  if (m == 7) col = base * (1.2 + uGlow.z * (1.4 + 0.5 * sin(uEye.w * 13.0 + vW.x * 7.0) * sin(uEye.w * 7.3 + vW.z * 5.0)));
  col = mix(col, lin(uHorizon.rgb), smoothstep(uSun.w, uShade.w, length(vW - uEye.xyz)));
  o = vec4(tone(col) * vignette(), 1.0);
}`;

export const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uLightVPs; uniform mat4 uModel;
void main(){ gl_Position = uLightVPs * uModel * vec4(aP, 1.0); }`;

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
  vec3 n = normalize(vN), base = lin(vTint.rgb);
  vec3 lit = base * (uFill.rgb * 1.2 + uSun.rgb * (0.4 + 0.6 * max(dot(n, uSunDir.xyz), 0.0)));
  vec3 col = mix(lit, base * 1.6, uAdditive);
  o = vec4(tone(col), vTint.a);
}`;
