import { afterEach, describe, expect, it } from "vitest";
import { isSoundOn, playSfx, setSoundOn, SOUND_KEY } from "./sfx";

afterEach(() => {
  window.localStorage.clear();
  setSoundOn(true);
});

describe("効果音の設定", () => {
  it("はじめは音が鳴る設定", () => {
    expect(isSoundOn()).toBe(true);
  });

  it("切った設定は保存され、次に開いたときも切れている", () => {
    setSoundOn(false);
    expect(window.localStorage.getItem(SOUND_KEY)).toBe("off");
    expect(isSoundOn()).toBe(false);
    setSoundOn(true);
    expect(isSoundOn()).toBe(true);
  });
});

describe("playSfx", () => {
  it("音を出せない環境（AudioContext がない）でも止まらない", () => {
    expect(() => playSfx("rare")).not.toThrow();
    expect(() => playSfx("coin")).not.toThrow();
  });
});
