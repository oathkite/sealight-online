import { describe, expect, it } from "vitest";
import { compose, transformPoint } from "../math/mat4";
import { collectDrawables, node } from "./scene";

const rig = node("root", {
  children: [
    node("body", {
      mesh: "body",
      position: [0, 0.3, 0],
      children: [node("ear", { mesh: "ear", position: [0.2, 0.3, 0] })],
    }),
    node("sack", { mesh: "sack", position: [0, 0.3, -0.4] }),
  ],
});

const origin = (m: Float32Array) => transformPoint(m, [0, 0, 0]);
const expectAt = (m: Float32Array | undefined, expected: readonly number[]) => origin(m ?? new Float32Array(16)).forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? NaN, 5));

describe("collectDrawables", () => {
  it("メッシュを持つ node を、親の位置を重ねた行列と一緒に集める", () => {
    const drawables = collectDrawables(rig, new Map());
    expect(drawables.map((d) => d.mesh)).toEqual(["body", "ear", "sack"]);
    const ear = drawables.find((d) => d.mesh === "ear");
    expectAt(ear?.matrix, [0.2, 0.6, 0]);
  });

  it("モデル全体の置き場所を親として渡せる", () => {
    const drawables = collectDrawables(rig, new Map(), compose([5, 0, 0], 0, [1, 1, 1]));
    expectAt(drawables[0]?.matrix, [5, 0.3, 0]);
  });

  it("姿勢は元の位置からのずれとして足し、大きさは掛ける", () => {
    const pose = new Map([["body", { position: [0, 0.1, 0] as const, scale: [1, 0.5, 1] as const }]]);
    const drawables = collectDrawables(rig, pose);
    expect(origin(drawables[0]?.matrix ?? new Float32Array(16))[1]).toBeCloseTo(0.4);
    // 体がつぶれると、子の耳も一緒に下がる
    expect(origin(drawables[1]?.matrix ?? new Float32Array(16))[1]).toBeCloseTo(0.4 + 0.15);
  });

  it("見えなくした node は、子ごと描かない", () => {
    const drawables = collectDrawables(rig, new Map([["body", { visible: false }]]));
    expect(drawables.map((d) => d.mesh)).toEqual(["sack"]);
  });

  it("元から隠してある node は、姿勢で見せたときだけ描く", () => {
    const hidden = node("root", { children: [node("bandage", { mesh: "bandage", visible: false })] });
    expect(collectDrawables(hidden, new Map())).toHaveLength(0);
    expect(collectDrawables(hidden, new Map([["bandage", { visible: true }]]))).toHaveLength(1);
  });

  it("法線の行列も一緒に返す", () => {
    const drawables = collectDrawables(rig, new Map());
    expect(drawables[0]?.normal).toHaveLength(9);
  });
});
