import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCharacter, PACE, type CharacterState } from "@sealight/sim";
import { TargetPicker } from "./TargetPicker";

const setup = (overrides: Partial<CharacterState> = {}, busy = false) => {
  const onDepart = vi.fn();
  const onRestock = vi.fn();
  render(<TargetPicker character={{ ...createCharacter(), ...overrides }} busy={busy} onDepart={onDepart} onRestock={onRestock} />);
  return { onDepart, onRestock, user: userEvent.setup() };
};

describe("TargetPicker", () => {
  it("目標の階と、持たせる食料とポーションを選んで送り出す", async () => {
    const { onDepart, user } = setup();
    await user.click(screen.getByRole("radio", { name: /地下 3 階/ }));
    await user.click(screen.getByRole("button", { name: "食料を減らす" }));
    await user.click(screen.getByRole("button", { name: "食料を減らす" }));
    await user.click(screen.getByRole("button", { name: "ポーションを増やす" }));
    await user.click(screen.getByRole("button", { name: /送り出す/ }));
    expect(onDepart).toHaveBeenCalledWith(3, 2, 2);
  });

  it("食料とポーションは合わせて荷物の枠まで。空いた枠は拾った物に使うと分かる", async () => {
    const { user } = setup({ rations: 30 });
    const more = screen.getByRole("button", { name: "食料を増やす" });
    // 初めは食料 4、ポーション 1。ポーションの 1 枠を残して、食料で埋める
    for (let i = 4; i < PACE.bagCapacity - 1; i += 1) await user.click(more);
    expect(more).toBeDisabled();
    expect(screen.getByRole("group", { name: "持たせる食料" })).toHaveTextContent(`${PACE.bagCapacity - 1} 個`);
    expect(screen.getByText(new RegExp(`荷物 ${PACE.bagCapacity} / ${PACE.bagCapacity}`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ポーションを増やす" })).toBeDisabled();
  });

  it("0 より減らせない", async () => {
    const { user } = setup();
    const less = screen.getByRole("button", { name: "ポーションを減らす" });
    await user.click(less);
    expect(less).toBeDisabled();
    expect(screen.getByRole("group", { name: "持たせるポーション" })).toHaveTextContent("0 本");
  });

  it("家にある数より多く選ぶと、足りない分をまとめて買うボタンが出て、買うまでは送り出せない", async () => {
    const { onRestock, user } = setup({ rations: 3, potions: 0, gold: 100 });
    const restock = screen.getByRole("button", { name: /足りない分を買う/ });
    expect(restock).toHaveTextContent("食料 1・ポーション 1");
    expect(restock).toHaveTextContent("20 G");
    expect(screen.getByRole("button", { name: /送り出す/ })).toBeDisabled();
    await user.click(restock);
    expect(onRestock).toHaveBeenCalledWith(1, 1);
  });

  it("足りない分を買うお金がなければ、買うボタンは押せない", () => {
    setup({ rations: 0, potions: 0, gold: 0 });
    expect(screen.getByRole("button", { name: /足りない分を買う/ })).toBeDisabled();
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
    input: { seed: 1, target, loadout: { level: 1, stats: createCharacter().stats, potions: 0, rations: 0, weapon: null, armor: null }, maps: [], potionThreshold: 30 },
    events: [],
    outcome: { status, reached, hp: 0, maxHp: 32, potions: 0, rations: 0, xp: 0, gold: 0, items: [], durationSec: 1, maps: [] },
  });

  it("無事に帰ったら、前回の目標を初期値にする", () => {
    render(<TargetPicker character={{ ...createCharacter(), bestDepth: 4, lastExpedition: lastExpeditionOf("returned", 4, 4) }} busy={false} onDepart={vi.fn()} onRestock={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /地下 4 階/ })).toBeChecked();
  });

  it("前回持たせた食料とポーションの数を初期値にする", () => {
    const last = lastExpeditionOf("returned", 2, 2);
    const lastExpedition = { ...last, input: { ...last.input, loadout: { ...last.input.loadout, rations: 6, potions: 3 } } };
    render(<TargetPicker character={{ ...createCharacter(), lastExpedition }} busy={false} onDepart={vi.fn()} onRestock={vi.fn()} />);
    expect(screen.getByRole("group", { name: "持たせる食料" })).toHaveTextContent("6 個");
    expect(screen.getByRole("group", { name: "持たせるポーション" })).toHaveTextContent("3 本");
  });

  it("倒れたら、倒れた階の 1 つ上を初期値にする", () => {
    const character = createCharacter();
    const lastExpedition = {
      input: { seed: 1, target: 10, loadout: { level: 1, stats: character.stats, potions: 0, rations: 0, weapon: null, armor: null }, maps: [], potionThreshold: 30 },
      events: [],
      outcome: { status: "fainted", reached: 6, hp: 0, maxHp: 32, potions: 0, rations: 0, xp: 0, gold: 0, items: [], durationSec: 1, maps: [] },
    } as const;
    render(<TargetPicker character={{ ...character, bestDepth: 6, lastExpedition }} busy={false} onDepart={vi.fn()} onRestock={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /地下 5 階/ })).toBeChecked();
  });
});
