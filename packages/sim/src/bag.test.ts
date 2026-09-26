import { describe, expect, it } from "vitest";
import { stow } from "./bag";
import type { Equipment } from "./items";

const item = (id: string, value: number): Equipment => ({ id, slot: "weapon", name: "短剣", rarity: "common", power: value / 5, value, affix: null, forged: 0 });

describe("stow", () => {
  it("空きがあれば入れて、何も置いてこない", () => {
    const result = stow([item("a", 10)], item("b", 5), 1);
    expect(result.bag.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.left).toBeNull();
  });

  it("いっぱいで、拾った物の方が強ければ一番弱い物と入れ替える", () => {
    const bag = [item("a", 30), item("b", 10), item("c", 20)];
    const result = stow(bag, item("d", 40), 0);
    expect(result.bag.map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(result.left?.id).toBe("b");
  });

  it("いっぱいで、拾った物が一番弱い物以下なら拾った物を置いてくる", () => {
    const bag = [item("a", 30), item("b", 10)];
    expect(stow(bag, item("c", 10), 0)).toEqual({ bag, left: item("c", 10) });
    expect(stow(bag, item("d", 5), 0).left?.id).toBe("d");
  });

  it("枠が食料で埋まって装備がないときは、拾った物を置いてくる（食料は捨てない）", () => {
    expect(stow([], item("a", 99), 0)).toEqual({ bag: [], left: item("a", 99) });
  });

  it("空きがマイナス（食料が枠を超えている）でも、いっぱいとして扱う", () => {
    const result = stow([item("a", 10)], item("b", 50), -2);
    expect(result.bag.map((i) => i.id)).toEqual(["b"]);
    expect(result.left?.id).toBe("a");
  });

  it("元の荷物は書き換えない", () => {
    const bag = [item("a", 10)];
    stow(bag, item("b", 50), 0);
    expect(bag.map((i) => i.id)).toEqual(["a"]);
  });
});
