import { MATERIAL, rotationX, rotationY, rotationZ } from "@sealight/engine";
import type { Shapes } from "../shapes";
import type { PropAnchors } from "./types";

const NONE: PropAnchors = {};

/** 畑（4×3 マス）。キャベツ、カボチャ、芽の 3 列と、丸い頭の杭の柵 */
export const buildGarden = (s: Shapes): PropAnchors => {
  s.box([0, -0.03, 0], [3.4, 0.1, 2.5], "soil", { round: 0.05 });
  [-0.8, 0, 0.8].forEach((z, row) => {
    s.box([0, 0.03, z], [3.1, 0.14, 0.46], "soil_light", { round: 0.07 });
    if (row === 0) for (let i = 0; i < 5; i += 1) { s.ball([-1.2 + i * 0.6, 0.3, z], [0.22, 0.17, 0.22], "cabbage", { material: MATERIAL.foliage, sway: [0.03, 0.03] }); s.ball([-1.2 + i * 0.6, 0.42, z], [0.1, 0.08, 0.1], "sprout", { material: MATERIAL.foliage, sway: [0.04, 0.04] }); }
    if (row === 1) for (const x of [-1.0, 0.05, 1.05]) { s.ball([x, 0.36, z], [0.27, 0.21, 0.27], "pumpkin"); s.cylinder([x, 0.52, z], 0.035, 0.025, 0.12, "sprout"); }
    if (row === 2) for (let i = 0; i < 6; i += 1) for (const dx of [-0.05, 0.05]) s.cylinder([-1.25 + i * 0.5 + dx, 0.14, z], 0.05, 0, 0.3, "sprout", { material: MATERIAL.foliage, rotation: rotationZ(dx * 5), sway: [0, 0.35] });
  });
  const posts: (readonly [number, number])[] = [];
  for (let i = 0; i <= 4; i += 1) posts.push([-1.85 + i * 0.925, -1.4]);
  for (const x of [-1.85, 1.85]) for (const z of [-0.47, 0.47, 1.4]) posts.push([x, z]);
  posts.push([-0.925, 1.4], [0.925, 1.4]);
  posts.forEach(([x, z]) => { s.cylinder([x, 0, z], 0.07, 0.07, 0.72, "wood_dark", { round: 0.06 }); });
  for (const y of [0.28, 0.54]) {
    s.box([0, y, -1.4], [3.7, 0.07, 0.06], "wood", { round: 0.025 });
    for (const x of [-1.85, 1.85]) s.box([x, y, 0], [0.06, 0.07, 2.8], "wood", { round: 0.025 });
    for (const x of [-1.39, 1.39]) s.box([x, y, 1.4], [0.93, 0.07, 0.06], "wood", { round: 0.025 });
  }
  return NONE;
};

/** 薪の山 */
export const buildWoodpile = (s: Shapes): PropAnchors => {
  ([[-0.16, 0.14], [0.16, 0.14], [0, 0.4]] as const).forEach(([x, y]) => s.cylinder([x, y, -0.4], 0.14, 0.14, 0.8, "wood_light", { round: 0.05, rotation: rotationX(Math.PI / 2) }));
  return NONE;
};

/** 鉄の輪をはめた樽 */
export const buildBarrels = (s: Shapes): PropAnchors => {
  ([[-0.18, 0.12, 0.28, 0.72], [0.24, -0.16, 0.23, 0.58]] as const).forEach(([x, z, r, h]) => {
    s.cylinder([x, 0, z], r * 0.9, r * 0.9, h, "wood", { round: 0.06 });
    s.cylinder([x, h * 0.3, z], r, r, h * 0.4, "wood", { round: 0.05 });
    for (const y of [0.12, h - 0.18]) s.cylinder([x, y, z], r * 0.95, r * 0.95, 0.05, "iron", { round: 0.02 });
  });
  return NONE;
};

/** 石積みの井戸（2×2 マス）。小さな屋根と、縄で吊った桶 */
export const buildWell = (s: Shapes): PropAnchors => {
  s.cylinder([0, 0, 0], 0.78, 0.74, 0.62, "stone", { round: 0.1 });
  s.cylinder([0, 0.6, 0], 0.56, 0.56, 0.03, "gate_dark", { round: 0.01 });
  for (const x of [-0.72, 0.72]) s.box([x, 0.5, 0], [0.14, 1.35, 0.14], "wood_dark", { round: 0.04 });
  s.cylinder([-0.75, 1.55, 0], 0.06, 0.06, 1.5, "wood", { round: 0.03, rotation: rotationZ(-Math.PI / 2) });
  for (const side of [1, -1]) s.box([0, 1.72 + 0.12, side * 0.3], [1.8, 0.1, 0.75], "slate", { round: 0.05, rotation: rotationX(side * 0.6) });
  s.cylinder([0.05, 1.05, 0], 0.012, 0.012, 0.5, "rope");
  s.cylinder([0.05, 0.82, 0], 0.13, 0.15, 0.22, "wood", { round: 0.03 });
  return NONE;
};

/** 板を打ち付けた木箱 */
export const buildCrates = (s: Shapes): PropAnchors => {
  s.box([0, 0, 0], [0.62, 0.6, 0.62], "wood", { round: 0.04 });
  for (const y of [0.12, 0.46]) s.box([0, y, 0.31], [0.64, 0.07, 0.03], "wood_dark", { round: 0.015 });
  s.box([0.05, 0.6, -0.02], [0.42, 0.4, 0.42], "wood_light", { round: 0.04, rotation: rotationY(0.4) });
  return NONE;
};

/** 腕木に吊るしたランタン。夜と留守の間に灯る */
export const buildLantern = (s: Shapes): PropAnchors => {
  s.box([0, 0, 0], [0.12, 1.6, 0.12], "wood_dark", { round: 0.03 });
  s.box([0.2, 1.52, 0], [0.5, 0.07, 0.07], "wood_dark", { round: 0.02 });
  s.cylinder([0.36, 1.3, 0], 0.01, 0.01, 0.22, "iron");
  s.box([0.36, 1.0, 0], [0.24, 0.3, 0.24], "glass", { material: MATERIAL.beacon, round: 0.05 });
  s.cylinder([0.36, 1.28, 0], 0.17, 0.02, 0.1, "iron", { round: 0.02 });
  s.box([0.36, 0.96, 0], [0.28, 0.05, 0.28], "iron", { round: 0.02 });
  return { lights: [{ kind: "lantern", position: s.place([0.36, 1.15, 0]) }] };
};

/** わらの寝床と毛布 */
export const buildBed = (s: Shapes): PropAnchors => {
  s.cylinder([0, 0, 0], 0.46, 0.44, 0.07, "straw_dark", { round: 0.03 });
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    s.ball([Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.38], [0.19, 0.12, 0.15], "straw", { rotation: rotationY(-(a + Math.PI / 2)) });
  }
  s.ball([0, 0.1, -0.2], [0.3, 0.05, 0.16], "blanket");
  return NONE;
};

/** 木の水入れ */
export const buildBowl = (s: Shapes): PropAnchors => {
  s.cylinder([0, 0, 0], 0.16, 0.22, 0.16, "bowl", { round: 0.04 });
  s.cylinder([0, 0.12, 0], 0.19, 0.19, 0.03, "bowl_water", { material: MATERIAL.gloss, round: 0.01 });
  return NONE;
};

/** 町へ向かう道しるべ */
export const buildSignpost = (s: Shapes): PropAnchors => {
  s.box([0, 0, 0], [0.12, 1.3, 0.12], "wood_dark", { round: 0.03 });
  s.box([-0.25, 1.0, 0.04], [0.7, 0.2, 0.06], "wood_light", { round: 0.03, rotation: rotationY(0.15) });
  s.box([0.18, 0.72, 0.04], [0.55, 0.17, 0.06], "wood_light", { round: 0.03, rotation: rotationY(-0.2) });
  return NONE;
};

/** 切り株と、刺さった斧 */
export const buildStump = (s: Shapes): PropAnchors => {
  s.cylinder([0, 0, 0], 0.32, 0.28, 0.32, "wood", { round: 0.06 });
  s.cylinder([0, 0.31, 0], 0.25, 0.25, 0.02, "wood_light", { round: 0.01 });
  s.box([0.05, 0.32, 0], [0.05, 0.5, 0.05], "wood_light", { round: 0.02, rotation: rotationZ(-0.5) });
  s.box([-0.05, 0.3, 0], [0.18, 0.12, 0.04], "iron", { round: 0.02, rotation: rotationZ(-0.5) });
  return NONE;
};

/** 旗竿。てっぺんの旗が風になびく */
export const buildFlagpole = (s: Shapes): PropAnchors => {
  s.cylinder([0, 0, 0], 0.13, 0.11, 0.18, "stone", { round: 0.04 });
  s.cylinder([0, 0.1, 0], 0.05, 0.04, 3.0, "wood_dark", { round: 0.02 });
  s.ball([0, 3.14, 0], [0.07, 0.07, 0.07], "iron", { material: MATERIAL.gloss });
  const origin = s.place([0.04, 3.0, 0]);
  const out = s.place([1.04, 3.0, 0]);
  return {
    cloths: [{
      spec: { origin, across: [0, -1, 0], down: [out[0] - origin[0], out[1] - origin[1], out[2] - origin[2]], width: 0.5, height: 0.85, cols: 5, rows: 9 },
      color: "banner",
      pattern: "banner",
    }],
  };
};
