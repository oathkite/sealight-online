import { describe, expect, it } from "vitest";
import { collectDrawables, compose, VERTEX_FLOATS } from "@sealight/engine";
import { buildMonster, monsterPose, NODE_NAMES } from "./rig";

const monster = buildMonster();

describe("buildMonster", () => {
  it("node ごとにメッシュがあり、すべて中身がある", () => {
    const drawn = collectDrawables(monster.root, new Map([["bandage", { visible: true }], ["sack", { visible: true }]]));
    for (const d of drawn) expect((monster.meshes[d.mesh]?.vertices.length ?? 0) / VERTEX_FLOATS).toBeGreaterThan(10);
    expect(drawn.map((d) => d.node)).toEqual(expect.arrayContaining(["body", "ear_l", "ear_r", "eye_l", "eye_r", "tail", "foot_l", "foot_r", "bandage", "sack"]));
  });

  it("包帯と荷物袋は、ふだんは隠れている", () => {
    const drawn = collectDrawables(monster.root, new Map()).map((d) => d.node);
    expect(drawn).not.toContain("bandage");
    expect(drawn).not.toContain("sack");
  });

  it("骨組みの node の名前を並べる", () => {
    expect(NODE_NAMES).toContain("root");
    expect(NODE_NAMES).toContain("eye_r");
  });
});

describe("monsterPose", () => {
  it("動きの姿勢に、包帯と荷物袋の見え方を重ねる", () => {
    const pose = monsterPose(new Map([["body", { scale: [1, 0.9, 1] as const }]]), { hurt: true, sack: false });
    expect(pose.get("bandage")?.visible).toBe(true);
    expect(pose.get("sack")?.visible).toBe(false);
    expect(pose.get("body")?.scale).toEqual([1, 0.9, 1]);
  });

  it("置き場所の行列と組み合わせて描ける", () => {
    const pose = monsterPose(new Map(), { hurt: false, sack: true });
    const drawn = collectDrawables(monster.root, pose, compose([2, 0, 3], 0, [1, 1, 1]));
    expect(drawn.some((d) => d.node === "sack")).toBe(true);
  });
});
