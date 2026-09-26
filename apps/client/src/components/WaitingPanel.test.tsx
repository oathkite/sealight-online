import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingPanel } from "./WaitingPanel";

const phase = (startedAt: number) => ({
  type: "exploring" as const,
  target: 5,
  startedAt,
  estimate: { minMs: 10 * 60_000, maxMs: 20 * 60_000, reaction: "calm" as const },
});

describe("WaitingPanel", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 26, 12, 0) }));
  afterEach(() => vi.useRealTimers());

  it("目標の階と、出発からの経過時間と、目安を出す", () => {
    render(<WaitingPanel phase={phase(Date.now() - 5 * 60_000)} />);
    const panel = screen.getByRole("region", { name: "留守番中" });
    expect(panel).toHaveTextContent("地下 5 階を目指して冒険中");
    expect(panel).toHaveTextContent("出発から 5 分");
    expect(panel).toHaveTextContent("目安は 10 分〜20 分");
  });

  it("出たばかりは潜っていくつぶやき、目安を過ぎると帰りを待つつぶやき", () => {
    const { unmount } = render(<WaitingPanel phase={phase(Date.now() - 60_000)} />);
    expect(screen.getByText(/足音が遠ざかる|ランタン|宝箱/)).toBeInTheDocument();
    unmount();
    render(<WaitingPanel phase={phase(Date.now() - 40 * 60_000)} />);
    expect(screen.getByText(/まだかな|かすかな光|もうすぐ/)).toBeInTheDocument();
  });
});
