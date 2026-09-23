import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCharacter, type CharacterState } from "@sealight/sim";
import { TownPanel, type TownActions } from "./TownPanel";

const setup = (overrides: Partial<CharacterState> = {}) => {
  const actions: TownActions = {
    allocate: vi.fn(),
    equip: vi.fn(),
    unequip: vi.fn(),
    sell: vi.fn(),
    buy: vi.fn(),
    setTactics: vi.fn(),
    startLamp: vi.fn(),
  };
  const character: CharacterState = {
    ...createCharacter(),
    stash: [{ id: "st1", slot: "armor", name: "革の胸当て", rarity: "common", power: 2, value: 10 }],
    ...overrides,
  };
  render(<TownPanel character={character} busy={false} actions={actions} />);
  return { actions, user: userEvent.setup() };
};

describe("TownPanel", () => {
  it("探索に出るボタンで探索を始める", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: /探索に出る/ }));
    expect(actions.startLamp).toHaveBeenCalled();
  });

  it("ポイントがあればステータスを上げられる", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: "力を上げる" }));
    expect(actions.allocate).toHaveBeenCalledWith("str");
  });

  it("ポイントがなければ上げるボタンは出ない", () => {
    setup({ unspentPoints: 0 });
    expect(screen.queryByRole("button", { name: "力を上げる" })).not.toBeInTheDocument();
  });

  it("倉庫の装備を身につけたり売ったりできる", async () => {
    const { actions, user } = setup();
    const row = screen.getByText(/革の胸当て/).closest("li");
    if (!row) throw new Error("倉庫の行が見つかりません");
    await user.click(within(row).getByRole("button", { name: "装備" }));
    await user.click(within(row).getByRole("button", { name: /売る/ }));
    expect(actions.equip).toHaveBeenCalledWith("st1");
    expect(actions.sell).toHaveBeenCalledWith("st1");
  });

  it("店で商品を買える。お金が足りない商品は押せない", async () => {
    const { actions, user } = setup({ gold: 20 });
    await user.click(screen.getByRole("button", { name: /ポーション/ }));
    expect(actions.buy).toHaveBeenCalledWith("potion");
    expect(screen.getByRole("button", { name: /鋼の剣/ })).toBeDisabled();
  });

  it("作戦の優先を変えると、変更後の作戦を渡す", async () => {
    const { actions, user } = setup();
    await user.selectOptions(screen.getByLabelText("優先"), "treasure");
    expect(actions.setTactics).toHaveBeenCalledWith({ potionThreshold: 30, priority: "treasure" });
  });

  it("ポーションを飲む HP を変えられる", async () => {
    const { actions, user } = setup();
    await user.selectOptions(screen.getByLabelText("ポーションを飲む HP"), "50");
    expect(actions.setTactics).toHaveBeenCalledWith({ potionThreshold: 50, priority: "stairs" });
  });
});
