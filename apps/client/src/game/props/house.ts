import { MATERIAL, rotationX, rotationY, rotationZ } from "@sealight/engine";
import type { Shapes } from "../shapes";
import type { PropAnchors } from "./types";

const EAVE = 1.72;
const PITCH = 0.75;
const HALF_DEPTH = 1.55;
const RIDGE = EAVE + HALF_DEPTH * Math.tan(PITCH);

/** 石の土台に白い漆喰と黒い木組み。急な石葺きの屋根と、石の煙突 */
const walls = (s: Shapes): void => {
  s.box([0, 0, 0], [3.6, 0.3, 2.6], "stone", { round: 0.08 });
  s.box([0, 0.28, 0], [3.3, 1.5, 2.3], "plaster", { round: 0.06 });
  for (const x of [-1.65, 0, 1.65]) for (const z of [-1.15, 1.15]) s.box([x, 0.28, z], [0.16, 1.5, 0.16], "timber", { round: 0.03 });
  s.box([1.66, 0.28, 0], [0.14, 1.5, 0.16], "timber", { round: 0.03 });
  s.box([0, EAVE - 0.08, 0], [3.42, 0.14, 2.42], "timber", { round: 0.04 });
  s.box([-0.8, 0.28 + 0.62, 1.17], [1.5, 0.1, 0.05], "timber", { round: 0.02 });
  s.box([-1.28, 0.33, 1.17], [0.08, 0.66, 0.05], "timber", { round: 0.02, rotation: rotationZ(0.6) });
  s.box([1.1, 0.33, 1.17], [0.08, 0.66, 0.05], "timber", { round: 0.02, rotation: rotationZ(-0.6) });
  s.hull([[-1.65, 0, -1.15], [-1.65, 0, 1.15], [-1.65, RIDGE - 0.2 - EAVE, 0], [1.65, 0, -1.15], [1.65, 0, 1.15], [1.65, RIDGE - 0.2 - EAVE, 0]], [0, EAVE, 0], "plaster", { round: 0.03 });
};

const roof = (s: Shapes): void => {
  const thickness = 0.22;
  for (const side of [1, -1]) {
    const mid = [0, EAVE + (HALF_DEPTH / 2) * Math.tan(PITCH), (side * HALF_DEPTH) / 2] as const;
    const n = [0, Math.cos(PITCH), side * Math.sin(PITCH)] as const;
    const center = [mid[0] - (n[0] * thickness) / 2, mid[1] - (n[1] * thickness) / 2, mid[2] - (n[2] * thickness) / 2] as const;
    s.box([center[0], center[1] - thickness / 2, center[2]], [3.9, thickness, HALF_DEPTH / Math.cos(PITCH) + 0.12], side > 0 ? "slate" : "slate_dark", { round: 0.09, rotation: rotationX(side * PITCH) });
  }
  s.cylinder([-2.0, RIDGE - 0.02, 0], 0.13, 0.13, 4.0, "slate_dark", { round: 0.06, rotation: rotationZ(-Math.PI / 2) });
  s.box([0.9, 2.1, -0.6], [0.44, 1.5, 0.44], "stone_dark", { round: 0.06 });
  s.box([0.9, 3.55, -0.6], [0.56, 0.12, 0.56], "stone", { round: 0.04 });
};

const door = (s: Shapes): void => {
  s.box([0.55, 0.28, 1.17], [0.64, 0.98, 0.1], "wood_dark", { round: 0.05 });
  s.ball([0.55, 1.24, 1.17], [0.32, 0.24, 0.05], "wood_dark");
  for (const y of [0.5, 0.95]) s.box([0.55, 0.28 + y, 1.23], [0.58, 0.05, 0.03], "iron", { round: 0.015 });
  s.ball([0.75, 0.82, 1.25], [0.035, 0.035, 0.035], "iron", { material: MATERIAL.gloss });
  s.box([0.55, 0, 1.5], [0.9, 0.12, 0.42], "cobble", { round: 0.05 });
};

const window = (s: Shapes, x: number, z: number, heading: number): void => {
  const rotation = rotationY(heading);
  const at = (dx: number, y: number, dz: number) => {
    const c = Math.cos(heading);
    const sn = Math.sin(heading);
    return [x + dx * c + dz * sn, y, z - dx * sn + dz * c] as const;
  };
  s.box(at(0, 0.82, 0), [0.66, 0.66, 0.08], "timber", { round: 0.03, rotation });
  s.box(at(0, 0.88, 0.03), [0.48, 0.54, 0.06], "glass", { material: MATERIAL.lamp, rotation });
  s.box(at(0, 0.88, 0.07), [0.05, 0.54, 0.03], "timber", { round: 0.01, rotation });
  s.box(at(0, 1.13, 0.07), [0.48, 0.05, 0.03], "timber", { round: 0.01, rotation });
  for (const side of [-1, 1]) s.box(at(side * 0.46, 0.82, 0.06), [0.24, 0.66, 0.05], "wood", { round: 0.03, rotation });
  s.box(at(0, 0.72, 0.13), [0.74, 0.12, 0.2], "wood", { round: 0.04, rotation });
  ([-0.22, 0, 0.22] as const).forEach((dx, i) => s.ball(at(dx, 0.9, 0.13), [0.08, 0.07, 0.08], i === 1 ? "flower_yellow" : "flower_pink"));
};

/** 木組みの家（4×3 マス）。正面の窓が夜に灯り、煙突から煙が出る */
export const buildHouse = (s: Shapes): PropAnchors => {
  walls(s);
  roof(s);
  door(s);
  window(s, -0.8, 1.17, 0);
  window(s, 1.67, 0.1, Math.PI / 2);
  return {
    lights: [{ kind: "lamp", position: s.place([-0.8, 1.2, 1.7]) }],
    smoke: s.place([0.9, 3.75, -0.6]),
  };
};
