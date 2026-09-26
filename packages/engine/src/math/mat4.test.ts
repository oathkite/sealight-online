import { describe, expect, it } from "vitest";
import { compose, composeEuler, identity, normalFromMat4, lensShift, lookAt, multiply, normalMatrix, orthographic, perspective, projectPoint, transformPoint } from "./mat4";

const close = (actual: readonly number[], expected: readonly number[]) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? NaN, 5));

describe("multiply", () => {
  it("単位行列を掛けても変わらない", () => {
    const m = compose([1, 2, 3], 0.5, [2, 2, 2]);
    close(Array.from(multiply(identity(), m)), Array.from(m));
    close(Array.from(multiply(m, identity())), Array.from(m));
  });

  it("右から順に効く（先に回してから動かす）", () => {
    const move = compose([5, 0, 0], 0, [1, 1, 1]);
    const turn = compose([0, 0, 0], Math.PI / 2, [1, 1, 1]);
    close(transformPoint(multiply(move, turn), [0, 0, 1]), [6, 0, 0]);
  });
});

describe("compose", () => {
  it("大きさ、上下軸の回転、位置の順に掛ける。向き 0 で +z を向く", () => {
    const m = compose([1, 0, 0], Math.PI / 2, [2, 1, 1]);
    close(transformPoint(m, [0, 0, 1]), [2, 0, 0]);
    close(transformPoint(m, [1, 0, 0]), [1, 0, -2]);
  });
});

describe("normalMatrix", () => {
  it("つぶした形でも、法線は面に垂直なまま（大きさの逆数を掛ける）", () => {
    const n = normalMatrix(0, [1, 0.5, 1]);
    // 上に 0.5 倍つぶすと、斜めの面の法線は上向きが強くなる
    const at = (i: number) => n[i] ?? 0;
    const v = [at(0) + at(3), at(1) + at(4), at(2) + at(5)];
    expect(v[1]).toBeGreaterThan(v[0] ?? 0);
  });
});

describe("lookAt", () => {
  it("見ている点は、カメラの正面（-z）に来る", () => {
    const view = lookAt([0, 5, 5], [0, 0, 0], [0, 1, 0]);
    const p = transformPoint(view, [0, 0, 0]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(0);
    expect(p[2]).toBeCloseTo(-Math.hypot(5, 5));
  });
});

describe("perspective", () => {
  it("近い面は -1、遠い面は 1 の深さに写る", () => {
    const p = perspective(Math.PI / 3, 1, 1, 10);
    expect(projectPoint(p, [0, 0, -1])[2]).toBeCloseTo(-1);
    expect(projectPoint(p, [0, 0, -10])[2]).toBeCloseTo(1);
  });

  it("画角の端は画面の端に写る", () => {
    const p = perspective(Math.PI / 2, 2, 1, 10);
    expect(projectPoint(p, [0, 1, -1])[1]).toBeCloseTo(1);
    expect(projectPoint(p, [2, 0, -1])[0]).toBeCloseTo(1);
  });
});

describe("orthographic", () => {
  it("箱の中を -1〜1 に写す", () => {
    const o = orthographic(-2, 2, -1, 1, 1, 11);
    close(projectPoint(o, [2, 1, -1]), [1, 1, -1]);
    close(projectPoint(o, [-2, -1, -11]), [-1, -1, 1]);
  });
});

describe("lensShift", () => {
  it("写る絵を画面の中でずらす（奥行きは変えない）", () => {
    const p = perspective(Math.PI / 3, 1, 1, 10);
    const shifted = lensShift(p, -0.5, 0.25);
    const a = projectPoint(p, [0, 0, -5]);
    const b = projectPoint(shifted, [0, 0, -5]);
    expect(b[0]).toBeCloseTo(a[0] - 0.5);
    expect(b[1]).toBeCloseTo(a[1] + 0.25);
    expect(b[2]).toBeCloseTo(a[2]);
  });
});

describe("composeEuler", () => {
  it("回転 0 なら大きさと位置だけ", () => {
    close(transformPoint(composeEuler([1, 2, 3], [0, 0, 0], [2, 2, 2]), [1, 1, 1]), [3, 4, 5]);
  });

  it("z 軸まわりに 90 度回すと、上（+y）が左（-x）を向く", () => {
    close(transformPoint(composeEuler([0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1]), [0, 1, 0]), [-1, 0, 0]);
  });

  it("上下軸だけ回すなら compose と同じ", () => {
    close(Array.from(composeEuler([1, 0, 2], [0, 0.7, 0], [1, 2, 1])), Array.from(compose([1, 0, 2], 0.7, [1, 2, 1])));
  });
});

describe("normalFromMat4", () => {
  it("回すだけなら、法線も同じだけ回る", () => {
    const n = normalFromMat4(compose([5, 5, 5], Math.PI / 2, [1, 1, 1]));
    close([n[6] ?? 0, n[7] ?? 0, n[8] ?? 0], [1, 0, 0]);
  });

  it("compose と同じ形なら normalMatrix と比例する", () => {
    const a = normalFromMat4(compose([0, 0, 0], 0.3, [1, 0.5, 1]));
    const b = normalMatrix(0.3, [1, 0.5, 1]);
    close(Array.from(a), Array.from(b));
  });
});
