import { describe, expect, it } from "vitest";
import { createMeshBuilder, detailFor, VERTEX_FLOATS, type MeshData } from "./meshBuilder";
import { combine, rotate, rotationX, rotationY } from "./rotation";
import { sphereLevel } from "./sphere";
import { supportBox, supportEllipsoid, supportFrustum, supportPoints } from "./support";

const boundsOf = (mesh: MeshData) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.vertices.length; i += VERTEX_FLOATS) {
    for (let k = 0; k < 3; k += 1) {
      const v = mesh.vertices[i + k] ?? 0;
      min[k] = Math.min(min[k] ?? 0, v);
      max[k] = Math.max(max[k] ?? 0, v);
    }
  }
  return { min, max };
};

const expectClose = (actual: readonly number[], expected: readonly number[], digits = 3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? NaN, digits));

const hullMesh = (...args: Parameters<ReturnType<typeof createMeshBuilder>["hull"]>): MeshData => {
  const builder = createMeshBuilder();
  builder.hull(...args);
  return builder.build();
};

describe("sphereLevel", () => {
  it("正二十面体を割るたびに頂点が増える（12, 42, 162, 642）", () => {
    expect([0, 1, 2, 3].map((l) => sphereLevel(l).vertices.length)).toEqual([12, 42, 162, 642]);
  });

  it("頂点はすべて長さ 1", () => {
    for (const v of sphereLevel(2).vertices) expect(Math.hypot(...v)).toBeCloseTo(1);
  });
});

describe("hull", () => {
  it("角の丸い箱は、指定した外寸に収まる", () => {
    const mesh = hullMesh(supportBox([0.4, 0.2, 0.3]), { radius: 0.1, position: [1, 0.3, 0], color: [1, 1, 1], material: 0 });
    const { min, max } = boundsOf(mesh);
    expectClose(min, [0.5, 0, -0.4], 2);
    expectClose(max, [1.5, 0.6, 0.4], 2);
  });

  it("卵形は半径どおりの大きさ", () => {
    const { min, max } = boundsOf(hullMesh(supportEllipsoid([0.5, 0.3, 0.2]), { color: [1, 1, 1], material: 0 }));
    expectClose(max, [0.5, 0.3, 0.2]);
    expectClose(min, [-0.5, -0.3, -0.2]);
  });

  it("円錐台は中心を原点に、上下に高さの半分ずつ伸びる", () => {
    const { min, max } = boundsOf(hullMesh(supportFrustum(0.5, 0, 2), { color: [1, 1, 1], material: 0, detail: 3 }));
    expect(max[1]).toBeCloseTo(1);
    expect(min[1]).toBeCloseTo(-1);
    expect(max[0]).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(max[0]).toBeGreaterThan(0.45);
  });

  it("点の集まりを包む形になる", () => {
    const pts = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as const;
    const { max } = boundsOf(hullMesh(supportPoints(pts), { radius: 0.1, color: [1, 1, 1], material: 0 }));
    expect(max[1]).toBeCloseTo(1.1);
  });

  it("回すと向きが変わる（横長の箱を 90 度回すと奥に長くなる）", () => {
    const { max } = boundsOf(hullMesh(supportBox([1, 0.1, 0.1]), { color: [1, 1, 1], material: 0, rotation: rotationY(Math.PI / 2) }));
    expect(max[0]).toBeCloseTo(0.1);
    expect(max[2]).toBeCloseTo(1);
  });

  it("x 軸まわりに倒すと、上向きの箱が手前に寝る", () => {
    const { max } = boundsOf(hullMesh(supportBox([0.1, 1, 0.1]), { color: [1, 1, 1], material: 0, rotation: rotationX(Math.PI / 2) }));
    expect(max[2]).toBeCloseTo(1);
    expect(max[1]).toBeCloseTo(0.1);
  });

  it("法線は長さ 1 で、色と材質は頂点ごとに入る", () => {
    const mesh = hullMesh(supportEllipsoid([1, 1, 1]), { color: [0.2, 0.4, 0.6], material: 5 });
    const v = Array.from(mesh.vertices.slice(0, VERTEX_FLOATS));
    expect(Math.hypot(v[3] ?? 0, v[4] ?? 0, v[5] ?? 0)).toBeCloseTo(1);
    expectClose(v.slice(6), [0.2, 0.4, 0.6, 5], 5);
  });
});

describe("createMeshBuilder", () => {
  it("形を足すたびに、添字は前の頂点の後ろを指す", () => {
    const builder = createMeshBuilder();
    builder.hull(supportEllipsoid([1, 1, 1]), { color: [1, 1, 1], material: 0, detail: 1 });
    builder.hull(supportEllipsoid([1, 1, 1]), { color: [1, 1, 1], material: 0, detail: 1, position: [3, 0, 0] });
    const mesh = builder.build();
    expect(mesh.vertices.length / VERTEX_FLOATS).toBe(84);
    expect(Math.max(...mesh.indices)).toBe(83);
    expect(Math.min(...mesh.indices.slice(mesh.indices.length / 2))).toBe(42);
  });

  it("高さのある地面は格子の頂点を並べ、平らなら法線は真上", () => {
    const builder = createMeshBuilder();
    builder.heightfield({ min: [-1, -1], max: [1, 1], segments: 4, height: () => 0, color: [0, 1, 0], material: 3 });
    const mesh = builder.build();
    expect(mesh.vertices.length / VERTEX_FLOATS).toBe(25);
    expect(mesh.indices.length).toBe(4 * 4 * 6);
    expectClose(Array.from(mesh.vertices.slice(3, 6)), [0, 1, 0]);
  });

  it("地面の傾きに合わせて法線が傾く", () => {
    const builder = createMeshBuilder();
    builder.heightfield({ min: [-1, -1], max: [1, 1], segments: 2, height: (x) => x, color: [0, 1, 0], material: 3 });
    const mesh = builder.build();
    expect(mesh.vertices[3] ?? 0).toBeLessThan(0);
  });

  it("平らな円（水面など）を中心から扇形に張る", () => {
    const builder = createMeshBuilder();
    builder.disc({ center: [0, 0.5, 0], radius: [2, 1], segments: 8, color: [0, 0, 1], material: 4 });
    const { max } = boundsOf(builder.build());
    expectClose(max, [2, 0.5, 1], 5);
  });
});

describe("detailFor", () => {
  it("小さな物ほど粗い球から作る", () => {
    expect(detailFor(0.05)).toBe(1);
    expect(detailFor(0.3)).toBe(2);
    expect(detailFor(2)).toBe(3);
  });
});

describe("combine", () => {
  it("先に a、後に b で回す（x 軸で倒してから y 軸で回す）", () => {
    const r = combine(rotationY(Math.PI / 2), rotationX(Math.PI / 2));
    const up = rotate(r, [0, 1, 0]);
    // 上向きは x 軸で手前（+z）に倒れ、y 軸で回って +x を向く
    expectClose(up, [1, 0, 0], 5);
  });
});
