import { afterEach, describe, expect, it } from "vitest";
import { GRAPHICS_KEY, loadGraphicsSetting, qualityFromSetting, saveGraphicsSetting } from "./graphics";

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("loadGraphicsSetting", () => {
  it("何も決めていなければ自動", () => {
    expect(loadGraphicsSetting()).toBe("auto");
  });

  it("保存した設定を読む", () => {
    saveGraphicsSetting("low");
    expect(window.localStorage.getItem(GRAPHICS_KEY)).toBe("low");
    expect(loadGraphicsSetting()).toBe("low");
  });

  it("URL の ?quality= が保存した設定より優先する（見た目の確認用）", () => {
    saveGraphicsSetting("low");
    window.history.replaceState(null, "", "/?quality=high");
    expect(loadGraphicsSetting()).toBe("high");
  });

  it("知らない値は自動として扱う", () => {
    window.localStorage.setItem(GRAPHICS_KEY, "ultra");
    expect(loadGraphicsSetting()).toBe("auto");
  });
});

describe("qualityFromSetting", () => {
  it("自動はエンジンに任せ、それ以外はその段階の設定を渡す", () => {
    expect(qualityFromSetting("auto")).toBe("auto");
    const low = qualityFromSetting("low");
    expect(low === "auto" ? null : low.tier).toBe("low");
  });
});
