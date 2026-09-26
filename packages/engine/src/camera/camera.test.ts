import { describe, expect, it } from "vitest";
import { frameCamera, toScreen, type CameraRig, type Rect } from "./camera";

const rig: CameraRig = {
  target: [0, 0, 0.5],
  pitch: 0.75,
  yaw: 0,
  fovy: 0.5,
  focus: { min: [-6, -5], max: [6, 5], height: 1.5 },
};
const viewport = { width: 1200, height: 800 };
const desktop: Rect = { x: 0, y: 0, width: 624, height: 800 };
const phone = { width: 390, height: 844 };
const phoneTop: Rect = { x: 0, y: 0, width: 390, height: 422 };

const inside = (p: readonly [number, number], r: Rect) => p[0] >= r.x - 0.5 && p[0] <= r.x + r.width + 0.5 && p[1] >= r.y - 0.5 && p[1] <= r.y + r.height + 0.5;

describe("frameCamera", () => {
  it("見せたい点は、パネルに隠れない場所の真ん中に写る", () => {
    const frame = frameCamera(rig, viewport, desktop);
    const [x, y] = toScreen(frame, viewport, rig.target);
    expect(x).toBeCloseTo(desktop.width / 2, 0);
    expect(y).toBeCloseTo(desktop.height / 2, 0);
  });

  it("スマホでは上半分の真ん中に写る", () => {
    const frame = frameCamera(rig, phone, phoneTop);
    const [x, y] = toScreen(frame, phone, rig.target);
    expect(x).toBeCloseTo(195, 0);
    expect(y).toBeCloseTo(211, 0);
  });

  it("見せたい範囲の四隅（高さを含む）は、見える場所に収まる", () => {
    for (const [vp, rect] of [[viewport, desktop], [phone, phoneTop]] as const) {
      const frame = frameCamera(rig, vp, rect);
      const { min, max, height } = rig.focus;
      for (const x of [min[0], max[0]]) for (const z of [min[1], max[1]]) for (const y of [0, height]) {
        expect(inside(toScreen(frame, vp, [x, y, z]), rect)).toBe(true);
      }
    }
  });

  it("見える場所が広いほど、カメラは近づく", () => {
    const narrow = frameCamera(rig, viewport, { x: 0, y: 0, width: 400, height: 800 });
    const wide = frameCamera(rig, viewport, { x: 0, y: 0, width: 1200, height: 800 });
    expect(wide.distance).toBeLessThan(narrow.distance);
  });

  it("向き 0 では手前（+z）の上から見下ろす", () => {
    const frame = frameCamera(rig, viewport, desktop);
    expect(frame.eye[2]).toBeGreaterThan(rig.target[2]);
    expect(frame.eye[1]).toBeGreaterThan(0);
    expect(frame.forward[1]).toBeCloseTo(-1);
  });
});
