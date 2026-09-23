import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DecisionPanel } from "./DecisionPanel";

const setup = (props: Partial<Parameters<typeof DecisionPanel>[0]> = {}) => {
  const onDecide = vi.fn();
  render(
    <DecisionPanel
      depth={3}
      hp={12}
      maxHp={40}
      bag={{ items: [{ id: "a", slot: "weapon", name: "灯火の剣", rarity: "rare", power: 7, value: 105 }], gold: 30 }}
      busy={false}
      onDecide={onDecide}
      {...props}
    />,
  );
  return { onDecide, user: userEvent.setup() };
};

describe("DecisionPanel", () => {
  it("次の階へ進むを押すと descend を渡す", async () => {
    const { onDecide, user } = setup();
    await user.click(screen.getByRole("button", { name: /次の階へ進む/ }));
    expect(onDecide).toHaveBeenCalledWith("descend");
  });

  it("この階をもう一度探索を押すと stay を渡す", async () => {
    const { onDecide, user } = setup();
    await user.click(screen.getByRole("button", { name: /この階をもう一度/ }));
    expect(onDecide).toHaveBeenCalledWith("stay");
  });

  it("帰還を押すと return を渡す", async () => {
    const { onDecide, user } = setup();
    await user.click(screen.getByRole("button", { name: /帰還/ }));
    expect(onDecide).toHaveBeenCalledWith("return");
  });

  it("進む先の深さと、かかる時間と、失うかもしれない持ち物を表示する", () => {
    setup();
    expect(screen.getByRole("button", { name: /地下 4 階.*25 分/ })).toBeInTheDocument();
    expect(screen.getByText(/灯火の剣/)).toBeInTheDocument();
    expect(screen.getByText(/30 G/)).toBeInTheDocument();
    expect(screen.getByText(/12 \/ 40/)).toBeInTheDocument();
  });

  it("通信中はどのボタンも押せない", async () => {
    const { onDecide, user } = setup({ busy: true });
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("持ち物が空なら、その旨を表示する", () => {
    setup({ bag: { items: [], gold: 0 } });
    expect(screen.getByText(/持ち物はありません/)).toBeInTheDocument();
  });
});
