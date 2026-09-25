import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actLength } from "./stage";
import { useStage } from "./useStage";

const calm = { hurt: false, sleepy: false, carrying: false };

describe("useStage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("開いたときに家にいれば、演出なしで家の場面から始まる", () => {
    const { result } = renderHook(() => useStage(true, false));
    expect(result.current.act).toBe("home");
  });

  it("開いたときに冒険中なら、演出なしで留守の場面から始まる", () => {
    const { result } = renderHook(() => useStage(false, false));
    expect(result.current.act).toBe("away");
  });

  it("読み込み中は家の場面のまま、読み込めたら演出なしで切り替わる", () => {
    const { result, rerender } = renderHook(({ present }) => useStage(present, false), { initialProps: { present: null as boolean | null } });
    expect(result.current.act).toBe("home");
    rerender({ present: false });
    expect(result.current.act).toBe("away");
  });

  it("送り出すと出発の演出になり、終わると留守になる", () => {
    const { result, rerender } = renderHook(({ present }) => useStage(present, false), { initialProps: { present: true as boolean | null } });
    rerender({ present: false });
    expect(result.current.act).toBe("leaving");
    act(() => vi.advanceTimersByTime(actLength("leaving", calm) * 1000 + 10));
    expect(result.current.act).toBe("away");
  });

  it("帰ってくると帰りの演出になり、終わると家の場面になる", () => {
    const { result, rerender } = renderHook(({ present }) => useStage(present, false), { initialProps: { present: false as boolean | null } });
    rerender({ present: true });
    expect(result.current.act).toBe("arriving");
    act(() => vi.advanceTimersByTime(actLength("arriving", calm) * 1000 - 100));
    expect(result.current.act).toBe("arriving");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.act).toBe("home");
  });

  it("ボロボロで帰ってきたときは、ゆっくり帰る分だけ演出が長い", () => {
    const { result, rerender } = renderHook(({ present }) => useStage(present, true), { initialProps: { present: false as boolean | null } });
    rerender({ present: true });
    act(() => vi.advanceTimersByTime(actLength("arriving", calm) * 1000 + 100));
    expect(result.current.act).toBe("arriving");
  });
});
