import { describe, expect, it } from "vitest";
import { ROUTE } from "./layout";
import { actLength, poseAt } from "./stage";

const calm = { hurt: false, sleepy: false, carrying: false };

describe("poseAt 家にいるとき", () => {
  it("寝床で待機している", () => {
    const pose = poseAt("home", 0, calm);
    expect(pose.visible).toBe(true);
    expect(pose.clip).toBe("idle");
    expect(pose.position).toEqual(ROUTE[0]);
  });

  it("夜は眠り、ボロボロのときはしょんぼりする（眠気より優先）", () => {
    expect(poseAt("home", 5, { ...calm, sleepy: true }).clip).toBe("sleep");
    expect(poseAt("home", 5, { ...calm, hurt: true, sleepy: true }).clip).toBe("droop");
  });
});

describe("poseAt 送り出し", () => {
  it("寝床から出発し、道を跳ねて進む", () => {
    expect(poseAt("leaving", 0, calm).position).toEqual(ROUTE[0]);
    const walking = poseAt("leaving", actLength("leaving", calm) * 0.45, calm);
    expect(walking.clip).toBe("hop");
    expect(walking.visible).toBe(true);
  });

  it("最後は入口の階段を降りて地面の下に消える", () => {
    const end = poseAt("leaving", actLength("leaving", calm), calm);
    expect(end.position[1]).toBeLessThan(0);
    expect(end.visible).toBe(false);
  });

  it("冒険中は姿が見えない", () => {
    expect(poseAt("away", 100, calm).visible).toBe(false);
  });
});

describe("poseAt 帰り", () => {
  it("入口の地面の下から現れる", () => {
    expect(poseAt("arriving", 0, calm).position[1]).toBeLessThan(0);
  });

  it("寝床に着いたら、無事なら喜び、ボロボロならしょんぼりする", () => {
    expect(poseAt("arriving", actLength("arriving", calm) - 0.1, calm).clip).toBe("cheer");
    const hurt = { ...calm, hurt: true };
    expect(poseAt("arriving", actLength("arriving", hurt) - 0.1, hurt).clip).toBe("droop");
    expect(poseAt("arriving", actLength("arriving", calm), calm).position).toEqual(ROUTE[0]);
  });

  it("ボロボロのときは、ゆっくり歩いて帰ってくる", () => {
    expect(actLength("arriving", { ...calm, hurt: true })).toBeGreaterThan(actLength("arriving", calm));
    const hurt = { ...calm, hurt: true };
    expect(poseAt("arriving", 2, hurt).speed).toBeLessThan(poseAt("arriving", 2, calm).speed);
  });

  it("荷物を持ち帰ったときだけ袋を背負っている", () => {
    expect(poseAt("arriving", 2, calm).sack).toBe(false);
    expect(poseAt("arriving", 2, { ...calm, carrying: true }).sack).toBe(true);
    expect(poseAt("home", 2, { ...calm, carrying: true }).sack).toBe(false);
  });
});

describe("actLength", () => {
  it("家にいるときと冒険中は終わりがない", () => {
    expect(actLength("home", calm)).toBe(Infinity);
    expect(actLength("away", calm)).toBe(Infinity);
  });
});
