import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "@sealight/sim";
import type { ApiResult, CharacterApi } from "@/api/characterApi";
import { buyBoth } from "./usePanelActions";

const okResult: ApiResult = { ok: true, value: createCharacter() };

const fakeApi = (buy: CharacterApi["buy"]): CharacterApi => ({
  fetchMe: vi.fn(),
  explore: vi.fn(),
  allocate: vi.fn(),
  equip: vi.fn(),
  unequip: vi.fn(),
  sell: vi.fn(),
  buy,
  setTactics: vi.fn(),
  forge: vi.fn(),
});

describe("buyBoth", () => {
  it("食料を買ってからポーションを買う", async () => {
    const buy = vi.fn(async () => okResult);
    await buyBoth(fakeApi(buy), 2, 3);
    expect(buy.mock.calls).toEqual([
      ["ration", 2],
      ["potion", 3],
    ]);
  });

  it("片方だけ足りなければ、そちらだけ買う", async () => {
    const buy = vi.fn(async () => okResult);
    await buyBoth(fakeApi(buy), 0, 1);
    await buyBoth(fakeApi(buy), 4, 0);
    expect(buy.mock.calls).toEqual([
      ["potion", 1],
      ["ration", 4],
    ]);
  });

  it("食料は買えてポーションを買えなかったら、食料を買った後の状態を返す（二重に買わせない）", async () => {
    const afterRations: ApiResult = { ok: true, value: { ...createCharacter(), rations: 12 } };
    const buy = vi.fn(async (sku: string): Promise<ApiResult> => (sku === "ration" ? afterRations : { ok: false, error: "network_error" }));
    expect(await buyBoth(fakeApi(buy), 4, 2)).toBe(afterRations);
  });

  it("食料を買えなかったら、ポーションは買わずにその失敗を返す", async () => {
    const buy = vi.fn(async (): Promise<ApiResult> => ({ ok: false, error: "not_enough_gold" }));
    expect(await buyBoth(fakeApi(buy), 2, 3)).toEqual({ ok: false, error: "not_enough_gold" });
    expect(buy).toHaveBeenCalledTimes(1);
  });
});
