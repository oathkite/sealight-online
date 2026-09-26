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
    forge: vi.fn(),
    depart: vi.fn(),
  };
  const character: CharacterState = {
    ...createCharacter(),
    stash: [
      { id: "st1", slot: "armor", name: "革の胸当て", rarity: "common", power: 2, value: 10, affix: null, forged: 0 },
      { id: "st2", slot: "armor", name: "木の盾", rarity: "common", power: 1, value: 8, affix: "guard", forged: 0 },
    ],
    ...overrides,
  };
  render(<TownPanel character={character} busy={false} actions={actions} />);
  return { actions, user: userEvent.setup() };
};

describe("TownPanel", () => {
  it("目標を決めて送り出す", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("radio", { name: /地下 2 階/ }));
    await user.click(screen.getByRole("button", { name: /送り出す/ }));
    expect(actions.depart).toHaveBeenCalledWith(2, expect.any(Number));
  });

  it("ポイントがあればステータスを上げられる。なければボタンは出ない", async () => {
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

  it("店で食料やポーションを 1 つずつ、またはまとめて買える。お金が足りない買い方は押せない", async () => {
    const { actions, user } = setup({ gold: 30 });
    await user.click(screen.getByRole("button", { name: "保存食を 1 個買う" }));
    await user.click(screen.getByRole("button", { name: "保存食を 5 個買う" }));
    expect(actions.buy).toHaveBeenCalledWith("ration", 1);
    expect(actions.buy).toHaveBeenCalledWith("ration", 5);
    expect(screen.getByRole("button", { name: "保存食を 10 個買う" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /樫の大盾/ })).toBeDisabled();
  });

  it("特性付きの装備には、特性と効く敵が書いてある", () => {
    setup();
    const row = screen.getByText(/木の盾/).closest("li");
    if (!row) throw new Error("倉庫の行が見つかりません");
    expect(within(row).getByText("受け止め")).toBeInTheDocument();
    expect(within(row).getByText(/強打の敵/)).toBeInTheDocument();
  });

  it("店の装備は特性付きで、無事に帰った階が深いほど強い物が並ぶ", async () => {
    const { actions, user } = setup({ gold: 10_000, clearedDepth: 10 });
    const shield = screen.getByRole("button", { name: /樫の大盾/ });
    expect(within(shield).getByText("受け止め")).toBeInTheDocument();
    expect(shield).toHaveTextContent(/防\+8/);
    await user.click(shield);
    expect(actions.buy).toHaveBeenCalledWith("guard-shield", 1);
  });

  it("装備を鍛えるときは、同じ部位の倉庫の装備を溶かす。上がる強さと手間賃が分かる", async () => {
    const { actions, user } = setup();
    const row = screen.getByText(/木の盾/).closest("li");
    if (!row) throw new Error("倉庫の行が見つかりません");
    await user.click(within(row).getByRole("button", { name: "鍛える" }));
    const panel = screen.getByRole("region", { name: "木の盾を鍛える" });
    const melt = within(panel).getByRole("button", { name: /革の胸当てを溶かす/ });
    expect(melt).toHaveTextContent("防 +1");
    expect(melt).toHaveTextContent("10 G");
    expect(within(panel).queryByRole("button", { name: /木の盾を溶かす/ })).not.toBeInTheDocument();
    await user.click(melt);
    expect(actions.forge).toHaveBeenCalledWith("st2", "st1");
  });

  it("鍛えた回数が上限の装備は、鍛えるボタンが出ない", () => {
    setup({ equipment: { weapon: null, armor: null }, stash: [{ id: "m", slot: "armor", name: "木の盾", rarity: "common", power: 5, value: 40, affix: "guard", forged: 3 }] });
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "鍛える" })).not.toBeInTheDocument();
  });

  it("ポーションを飲む HP を変えられる", async () => {
    const { actions, user } = setup();
    await user.selectOptions(screen.getByLabelText("ポーションを飲む HP"), "50");
    expect(actions.setTactics).toHaveBeenCalledWith({ potionThreshold: 50 });
  });
});
