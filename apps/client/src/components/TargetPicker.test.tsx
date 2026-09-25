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
    await user.selectOptions(screen.getByLabelText("目標の階"), "3");
    await user.selectOptions(screen.getByLabelText("持たせる食料"), "2");
    await user.click(screen.getByRole("button", { name: /送り出す/ }));
    expect(onDepart).toHaveBeenCalledWith(3, 2);
  });

  it("持たせられる食料は、家にある数と荷物の枠のうち少ない方まで", () => {
    setup({ rations: 3 });
    const options = screen.getAllByRole("option", { name: /個/ }).map((o) => o.getAttribute("value"));
    expect(options).toEqual(["0", "1", "2", "3"]);
  });

  it("楽に行ける目標なら、モンスターは張り切っている", () => {
    setup({ stats: { str: 30, vit: 30, luk: 0 } });
    expect(screen.getByText(/張り切っている/)).toBeInTheDocument();
  });

  it("無理な目標だと、モンスターは怯える", async () => {
    const { user } = setup({ stats: { str: 0, vit: 0, luk: 0 } });
    await user.selectOptions(screen.getByLabelText("目標の階"), "15");
    expect(screen.getByText(/怯えている/)).toBeInTheDocument();
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
    expect(screen.getByLabelText("目標の階")).toHaveValue("4");
  });

  it("倒れたら、倒れた階の 1 つ上を初期値にする", () => {
    const character = createCharacter();
    const lastExpedition = {
      input: { seed: 1, target: 10, loadout: { stats: character.stats, potions: 0, rations: 0, weapon: null, armor: null }, maps: [], potionThreshold: 30 },
      events: [],
      outcome: { status: "fainted", reached: 6, hp: 0, maxHp: 32, potions: 0, rations: 0, xp: 0, gold: 0, items: [], durationSec: 1, maps: [] },
    } as const;
    render(<TargetPicker character={{ ...character, bestDepth: 6, lastExpedition }} busy={false} onDepart={vi.fn()} />);
    expect(screen.getByLabelText("目標の階")).toHaveValue("5");
  });
});
