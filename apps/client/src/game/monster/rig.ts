import { createMeshBuilder, MATERIAL, node, rotationX, rotationZ, type MeshData, type NodeDef, type Pose, type Vec3 } from "@sealight/engine";
import { shapesFor, type Shapes } from "../shapes";

/*
 * 使役モンスターの骨組み。丸いおもち型の体、短い耳、大きな目、額の結晶。
 * 大きさは約 1 マス。node の付け根を原点にメッシュを作り、動きは node を回したり伸ばしたりする
 */

const PIVOT = {
  ear: [0.21, 0.62, -0.025],
  eye: [0.125, 0.49, 0.36],
  tail: [0, 0.2, -0.36],
  foot: [0.175, 0.044, 0.1],
} as const satisfies Record<string, Vec3>;

const mesh = (build: (s: Shapes) => void): MeshData => {
  const builder = createMeshBuilder();
  build(shapesFor(builder));
  return builder.build();
};

const bodyMesh = (): MeshData =>
  mesh((s) => {
    s.ball([0, 0.39, 0], [0.425, 0.39, 0.4], "monster");
    for (const side of [-1, 1]) s.ball([side * 0.24, 0.375, 0.33], [0.068, 0.042, 0.025], "cheek");
    s.hull([[0, 0.11, 0], [0, -0.06, 0], [0.06, 0, 0], [-0.06, 0, 0], [0, 0, 0.05], [0, 0, -0.05]], [0, 0.8, 0.125], "rune", { material: MATERIAL.magic, round: 0.012 });
  });

const earMesh = (side: number): MeshData =>
  mesh((s) => s.cylinder([0, -0.06, 0], 0.105, 0.025, 0.3, "monster_dark", { round: 0.04, rotation: rotationZ(-side * 0.42) }));

const eyeMesh = (): MeshData =>
  mesh((s) => {
    s.ball([0, 0.01, 0.015], [0.06, 0.088, 0.038], "eye", { material: MATERIAL.gloss });
    s.ball([0.022, 0.047, 0.045], [0.021, 0.025, 0.01], "white", { material: MATERIAL.magic });
  });

const bandageMesh = (): MeshData =>
  mesh((s) => {
    s.cylinder([0, 0.55, -0.01], 0.39, 0.36, 0.1, "bandage", { round: 0.035, rotation: rotationX(-0.2) });
    s.box([-0.25, 0.34, 0.31], [0.1, 0.05, 0.02], "plaster_patch", { round: 0.01, rotation: rotationZ(0.6) });
  });

const sackMesh = (): MeshData =>
  mesh((s) => {
    s.ball([0, 0.36, -0.52], [0.19, 0.22, 0.17], "sack");
    s.cylinder([0, 0.55, -0.52], 0.07, 0.03, 0.09, "sack_tie", { round: 0.02 });
  });

export type MonsterModel = { readonly root: NodeDef; readonly meshes: Readonly<Record<string, MeshData>> };

export const buildMonster = (): MonsterModel => {
  const mirror = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];
  const root = node("root", {
    children: [
      node("body", {
        mesh: "m_body",
        children: [
          node("ear_l", { mesh: "m_ear_l", position: PIVOT.ear }),
          node("ear_r", { mesh: "m_ear_r", position: mirror(PIVOT.ear) }),
          node("eye_l", { mesh: "m_eye", position: PIVOT.eye }),
          node("eye_r", { mesh: "m_eye", position: mirror(PIVOT.eye) }),
          node("tail", { mesh: "m_tail", position: PIVOT.tail }),
          node("bandage", { mesh: "m_bandage", visible: false }),
          node("sack", { mesh: "m_sack", visible: false }),
        ],
      }),
      node("foot_l", { mesh: "m_foot", position: PIVOT.foot }),
      node("foot_r", { mesh: "m_foot", position: mirror(PIVOT.foot) }),
    ],
  });
  return {
    root,
    meshes: {
      m_body: bodyMesh(),
      m_ear_l: earMesh(1),
      m_ear_r: earMesh(-1),
      m_eye: eyeMesh(),
      m_tail: mesh((s) => s.ball([0, 0, -0.02], [0.09, 0.09, 0.09], "monster_dark")),
      m_foot: mesh((s) => s.ball([0, 0, 0], [0.11, 0.06, 0.14], "monster_dark")),
      m_bandage: bandageMesh(),
      m_sack: sackMesh(),
    },
  };
};

export const NODE_NAMES: readonly string[] = ["root", "body", "ear_l", "ear_r", "eye_l", "eye_r", "tail", "foot_l", "foot_r", "bandage", "sack"];

/** 動きの姿勢に、包帯（ボロボロのとき）と荷物袋（持ち帰ったとき）の見え方を重ねる */
export const monsterPose = (animated: Pose, show: { readonly hurt: boolean; readonly sack: boolean }): Pose =>
  new Map([...animated, ["bandage", { visible: show.hurt }], ["sack", { visible: show.sack }]]);
