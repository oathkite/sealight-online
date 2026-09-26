import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCharacter, type CharacterState } from "@sealight/sim";
import { TargetPicker } from "./TargetPicker";

const setup = (overrides: Partial<CharacterState> = {}, busy = false) => {
  const onDepart = vi.fn();
  render(<TargetPicker character={{ ...createCharacter(), ...overrides }} busy={busy} onDepart={onDepart} />);
  return { onDepart, user: userEvent.setup() };
};

describe("TargetPicker", () => {
  it("目標の階と持たせる食料を選んで送り出す", async () => {
    const { onDepart, user } = setup();
    await user.click(screen.getByRole("radio", { name: /地下 3 階/ }));
    await user.click(screen.getByRole("button", { name: "食料を減らす" }));
    await user.click(screen.getByRole("button", { name: "食料を減らす" }));
    await user.click(screen.getByRole("button", { name: /送り出す/ }));
    expect(onDepart).toHaveBeenCalledWith(3, 2);
  });

  it("持たせられる食料は、家にある数と荷物の枠のうち少ない方まで", async () => {
    const { user } = setup({ rations: 3 });
    const more = screen.getByRole("button", { name: "食料を増やす" });
    expect(more).toBeDisabled();
    expect(screen.getByRole("group", { name: "持たせる食料" })).toHaveTextContent("3 個");
    await user.click(screen.getByRole("button", { name: "食料を減らす" }));
    expect(more).toBeEnabled();
  });

  it("食料は 0 より減らせない", async () => {
    const { user } = setup({ rations: 1 });
    const less = screen.getByRole("button", { name: "食料を減らす" });
    await user.click(less);
    expect(less).toBeDisabled();
    expect(screen.getByRole("group", { name: "持たせる食料" })).toHaveTextContent("0 個");
  });

  it("楽に行ける目標なら、モンスターは張り切っている", () => {
    setup({ stats: { str: 30, vit: 30, luk: 0 } });
    expect(screen.getByText(/張り切っている/)).toBeInTheDocument();
  });

  it("無理な目標だと、モンスターは怯える", async () => {
    const { user } = setup({ stats: { str: 0, vit: 0, luk: 0 } });
    await user.click(screen.getByRole("radio", { name: /地下 15 階/ }));
    expect(screen.getByText(/怯えている/)).toBeInTheDocument();
  });

  it("キーボードでは、選んでいる階だけに Tab で止まり、矢印キーで選び直す", async () => {
    const { user } = setup();
    const first = screen.getByRole("radio", { name: /地下 1 階/ });
    expect(first).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /地下 2 階/ })).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("radio", { name: /地下 3 階/ })).toBeChecked();
    await user.keyboard("{Home}");
    expect(first).toBeChecked();
  });

  it("かかる時間の目安を出す", () => {
    setup();
    expect(screen.getByText(/だいたい/)).toBeInTheDocument();
  });

  it("通信中は送り出せない", () => {
    setup({}, true);
    expect(screen.getByRole("button", { name: /送り出す/ })).toBeDisabled();
  });
});

describe("TargetPicker の初期値", () => {
  const lastExpeditionOf = (status: "returned" | "fainted", target: number, reached: number) => ({
    input: { seed: 1, target, loadout: { stats: createCharacter().stats, potions: 0, rations: 0, weapon: null, armor: null }, maps: [], potionThreshold: 30 },
    events: [],
    outcome: { status, reached, hp: 0, maxHp: 32, potions: 0, rations: 0, xp: 0, gold: 0, items: [], durationSec: 1, maps: [] },
  });

  it("無事に帰ったら、前回の目標を初期値にする", () => {
    render(<TargetPicker character={{ ...createCharacter(), bestDepth: 4, lastExpedition: lastExpeditionOf("returned", 4, 4) }} busy={false} onDepart={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /地下 4 階/ })).toBeChecked();
  });

  it("倒れたら、倒れた階の 1 つ上を初期値にする", () => {
    const character = createCharacter();
    const lastExpedition = {
      input: { seed: 1, target: 10, loadout: { stats: character.stats, potions: 0, rations: 0, weapon: null, armor: null }, maps: [], potionThreshold: 30 },
      events: [],
      outcome: { status: "fainted", reached: 6, hp: 0, maxHp: 32, potions: 0, rations: 0, xp: 0, gold: 0, items: [], durationSec: 1, maps: [] },
    } as const;
    render(<TargetPicker character={{ ...character, bestDepth: 6, lastExpedition }} busy={false} onDepart={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /地下 5 階/ })).toBeChecked();
  });
});
