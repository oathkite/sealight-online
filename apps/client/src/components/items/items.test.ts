import { describe, expect, it } from "vitest";
import type { Equipment } from "@sealight/sim";
import { gainOver, itemKind, statName } from "./items";

const item = (name: string, slot: Equipment["slot"], power: number, rarity: Equipment["rarity"] = "common"): Equipment => ({ id: name, slot, name, rarity, power, value: 1, affix: null });

describe("itemKind", () => {
  it("名前から絵の種類を決める", () => {
    expect(itemKind(item("灯火の剣", "weapon", 5))).toBe("sword");
    expect(itemKind(item("星鉄の斧", "weapon", 5))).toBe("axe");
    expect(itemKind(item("短剣", "weapon", 2))).toBe("dagger");
    expect(itemKind(item("棍棒", "weapon", 2))).toBe("club");
    expect(itemKind(item("木の盾", "armor", 2))).toBe("shield");
    expect(itemKind(item("月光の外套", "armor", 5))).toBe("cloak");
    expect(itemKind(item("鎖かたびら", "armor", 5))).toBe("mail");
    expect(itemKind(item("深海の鎧", "armor", 5))).toBe("plate");
  });

  it("知らない名前は、武器なら剣、防具なら革の胸当ての絵", () => {
    expect(itemKind(item("謎の杖", "weapon", 1))).toBe("sword");
    expect(itemKind(item("謎の衣", "armor", 1))).toBe("leather");
  });
});

describe("gainOver", () => {
  it("同じ部位の今の装備と比べた強さの差", () => {
    const equipment = { weapon: item("短剣", "weapon", 3), armor: null };
    expect(gainOver(item("鉄の剣", "weapon", 7), equipment)).toBe(4);
    expect(gainOver(item("木の棒", "weapon", 1), equipment)).toBe(-2);
  });

  it("その部位に何も着けていなければ、強さがそのまま差になる", () => {
    expect(gainOver(item("布の服", "armor", 2), { weapon: null, armor: null })).toBe(2);
  });
});

describe("statName", () => {
  it("武器は攻、防具は防", () => {
    expect(statName("weapon")).toBe("攻");
    expect(statName("armor")).toBe("防");
  });
});
