import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSoundOn } from "@/audio/sfx";
import { Hud } from "./Hud";

afterEach(() => {
  window.localStorage.clear();
  setSoundOn(true);
});

describe("Hud", () => {
  it("設定を開いて画質を選ぶ", async () => {
    const onGraphics = vi.fn();
    const user = userEvent.setup();
    render(<Hud fps={60} graphics="auto" onGraphics={onGraphics} />);
    expect(screen.queryByRole("region", { name: "設定" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByRole("radio", { name: /自動/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: /低/ }));
    expect(onGraphics).toHaveBeenCalledWith("low");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "設定" })).not.toBeInTheDocument();
  });

  it("効果音を切り替えると、設定が保存される", async () => {
    const user = userEvent.setup();
    render(<Hud fps={60} graphics="auto" onGraphics={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.click(screen.getByRole("button", { name: /効果音あり/ }));
    expect(screen.getByRole("button", { name: /効果音なし/ })).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("sealight.sound")).toBe("off");
  });
});
