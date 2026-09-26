import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCharacter, simulateExpedition, type CharacterState } from "@sealight/sim";
import type { TownActions } from "@/components/TownPanel";
import { GamePanel } from "./GamePanel";

const actions: TownActions = {
  allocate: vi.fn(),
  equip: vi.fn(),
  unequip: vi.fn(),
  sell: vi.fn(),
  buy: vi.fn(),
  forge: vi.fn(),
  setTactics: vi.fn(),
  depart: vi.fn(),
  restock: vi.fn(),
};

const returned: CharacterState = {
  ...createCharacter(),
  lastExpedition: simulateExpedition({
    seed: 7,
    target: 1,
    loadout: { level: 1, stats: { str: 3, vit: 3, luk: 1 }, potions: 1, rations: 4, weapon: null, armor: null },
    maps: [],
    potionThreshold: 30,
  }),
};

const setup = (settled: boolean, reportUnseen = true) =>
  render(<GamePanel character={returned} busy={false} reportUnseen={reportUnseen} settled={settled} actions={actions} onCloseReport={vi.fn()} />);

describe("GamePanel", () => {
  it("帰りの演出の間は、報告も町の画面も出さず、送り出せない", () => {
    setup(false);
    expect(screen.getByRole("region", { name: "おかえり" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "冒険の報告" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /送り出す/ })).not.toBeInTheDocument();
  });

  it("寝床に戻ったら、まだ読んでいない報告を開く", () => {
    setup(true);
    expect(screen.getByRole("region", { name: "冒険の報告" })).toBeInTheDocument();
  });

  it("報告を読んだあとは、町の画面で次の準備ができる", () => {
    setup(true, false);
    expect(screen.getByRole("button", { name: /送り出す/ })).toBeInTheDocument();
  });
});
