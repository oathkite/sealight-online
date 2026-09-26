import { MATERIAL } from "@sealight/engine";
import type { Shapes } from "../shapes";
import type { PropAnchors } from "./types";

/** 苔むした石の柱 */
const pillar = (s: Shapes, x: number, height: number): void => {
  s.box([x, 0, -0.5], [0.46, 0.18, 0.46], "stone", { round: 0.06 });
  s.box([x, 0.12, -0.5], [0.38, height, 0.38], "stone_dark", { round: 0.1 });
  s.ball([x - 0.08, height * 0.55, -0.3], [0.14, 0.09, 0.06], "moss", { material: MATERIAL.foliage });
  s.box([x, 0.12 + height - 0.04, -0.5], [0.46, 0.14, 0.46], "stone", { round: 0.05 });
};

const torch = (s: Shapes, x: number): void => {
  s.box([x, 1.2, -0.25], [0.08, 0.1, 0.16], "iron", { round: 0.02 });
  s.cylinder([x, 1.18, -0.18], 0.05, 0.07, 0.24, "wood_dark", { round: 0.02 });
  s.ball([x, 1.5, -0.18], [0.08, 0.13, 0.08], "flame", { material: MATERIAL.flame });
};

/**
 * ダンジョンの入口（3×2 マス）。奥の列に古い石の門とルーンの結晶、
 * 手前の列に地下へ下りる階段。階段の奥から魔法の光が漏れ、門には松明が灯る
 */
export const buildGate = (s: Shapes): PropAnchors => {
  s.box([0, -0.03, 0.5], [1.0, 0.05, 1.0], "gate_dark", { round: 0.02 });
  for (const z of [0.3, 0.65]) s.box([0, 0.01, z], [0.9, 0.02, 0.13], "rune", { material: MATERIAL.magic, round: 0.01 });
  for (const x of [-0.62, 0.62]) s.box([x, 0, 0.45], [0.26, 0.2, 1.2], "cobble", { round: 0.08 });
  s.box([0, 0, 1.08], [1.5, 0.2, 0.26], "cobble", { round: 0.08 });
  pillar(s, -0.95, 1.9);
  pillar(s, 0.95, 1.9);
  s.box([0, 2.0, -0.5], [2.5, 0.34, 0.52], "stone", { round: 0.13 });
  s.ball([0.7, 2.36, -0.45], [0.3, 0.07, 0.2], "moss", { material: MATERIAL.foliage });
  s.hull([[0, 0.2, 0], [0, -0.2, 0], [0.12, 0, 0], [-0.12, 0, 0], [0, 0, 0.09], [0, 0, -0.09]], [0, 2.18, -0.2], "rune", { material: MATERIAL.magic, round: 0.02 });
  torch(s, -0.95);
  torch(s, 0.95);
  return {
    lights: [
      { kind: "flame", position: s.place([-0.95, 1.6, 0.05]) },
      { kind: "magic", position: s.place([0, 0.35, 0.55]) },
    ],
  };
};
