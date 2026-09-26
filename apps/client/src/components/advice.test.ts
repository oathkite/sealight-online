import { describe, expect, it } from "vitest";
import { adviceText, noAdviceText } from "./advice";

describe("adviceText", () => {
  it("効く特性を着けていなければ、特性と部位を教える", () => {
    expect(adviceText({ type: "trait", trait: "armored", foes: ["甲虫"], share: 0.62, countered: false })).toBe(
      "甲虫（硬い）に一番削られた（受けたダメージの 6 割）。貫きの武器が効く（硬い敵の守りを貫く）",
    );
  });

  it("ほぼ全部のダメージがその特徴の敵からなら「ほとんど」と言う。防具の特性は防具と言う", () => {
    expect(adviceText({ type: "trait", trait: "heavy", foes: ["オーガ"], share: 1, countered: false })).toBe(
      "オーガ（強打）に一番削られた（受けたダメージのほとんど）。受け止めの防具が効く（強打の敵のダメージを半分に）",
    );
  });

  it("着けていても削られたら、鍛えるか体を上げるよう伝える", () => {
    expect(adviceText({ type: "trait", trait: "fast", foes: ["レイス"], share: 0.5, countered: true })).toBe(
      "身かわしを着けていても、レイス（素早い）に削られた。装備を鍛えるか、体を上げよう",
    );
  });

  it("ポーション、空腹、荷物の手がかり", () => {
    expect(adviceText({ type: "potions", carried: 3, left: 0 })).toMatch(/使い切っていた/);
    expect(adviceText({ type: "potions", carried: 0, left: 0 })).toMatch(/持たせていなかった/);
    expect(adviceText({ type: "potions", carried: 3, left: 2 })).toBe("ポーションを 2 本残したまま倒れた。飲む HP を早めよう");
    expect(adviceText({ type: "hunger" })).toMatch(/食料を多めに/);
    expect(adviceText({ type: "bag", count: 4 })).toMatch(/4 個置いてきた/);
  });

  it("手がかりがないときは、帰ってきたかどうかで一言を変える", () => {
    expect(noAdviceText(true)).toMatch(/深くを目指せそう/);
    expect(noAdviceText(false)).toMatch(/力が足りなかった/);
  });
});
