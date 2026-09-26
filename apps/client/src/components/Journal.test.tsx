import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCharacter, type CharacterState, type ExpeditionEvent, type ExpeditionResult } from "@sealight/sim";
import { Journal } from "./Journal";

const slime = { kind: "slime", name: "スライム", hp: 8, traits: [], rare: false } as const;
const glow = { kind: "glowSlime", name: "光るスライム", hp: 10, traits: [], rare: true } as const;
const sword = { id: "a", slot: "weapon", name: "灯火の剣", rarity: "rare", power: 9, value: 135, affix: null, forged: 0 } as const;

const resultOf = (events: readonly ExpeditionEvent[], status: "returned" | "fainted", reached: number): ExpeditionResult => ({
  input: {
    seed: 1,
    target: 2,
    loadout: { stats: { str: 3, vit: 3, luk: 0 }, potions: 0, rations: 4, weapon: null, armor: null },
    maps: [],
    potionThreshold: 30,
  },
  events,
  outcome: {
    status,
    reached,
    hp: status === "fainted" ? 0 : 14,
    maxHp: 40,
    potions: 0,
    rations: 2,
    xp: 31,
    gold: 12,
    items: [sword],
    durationSec: 5400,
    maps: [],
  },
});

const returned = resultOf(
  [
    { type: "floor", t: 0, depth: 1, direction: "down", hp: 40, rations: 4 },
    { type: "encounter", t: 60, depth: 1, foe: slime, hp: 40 },
    { type: "attack", by: "player", damage: 8, hp: 0 },
    { type: "victory", xp: 3 },
    { type: "loot", t: 200, depth: 1, source: "chest", loot: { type: "gold", amount: 12 } },
    { type: "floor", t: 600, depth: 2, direction: "down", hp: 40, rations: 3 },
    { type: "encounter", t: 700, depth: 2, foe: glow, hp: 40 },
    { type: "attack", by: "foe", damage: 28, hp: 12 },
    { type: "attack", by: "player", damage: 10, hp: 0 },
    { type: "victory", xp: 25 },
    { type: "loot", t: 720, depth: 2, source: "drop", loot: { type: "item", item: sword } },
    { type: "turnaround", t: 900, depth: 2 },
    { type: "floor", t: 950, depth: 2, direction: "up", hp: 12, rations: 3 },
    { type: "floor", t: 1200, depth: 1, direction: "up", hp: 12, rations: 2 },
    { type: "home", t: 1400, hp: 14 },
  ],
  "returned",
  2,
);

const fainted = resultOf(
  [
    { type: "floor", t: 0, depth: 1, direction: "down", hp: 40, rations: 4 },
    { type: "encounter", t: 30, depth: 1, foe: slime, hp: 40 },
    { type: "attack", by: "foe", damage: 40, hp: 0 },
    { type: "death", t: 40, depth: 1, cause: "battle" },
  ],
  "fainted",
  1,
);

/** 帰ったあとのキャラ。持ち帰った剣は倉庫に入っている */
const home = (overrides: Partial<CharacterState> = {}): CharacterState => ({ ...createCharacter(), stash: [sword], ...overrides });

const setup = (result: ExpeditionResult, character: CharacterState = home()) => {
  const onClose = vi.fn();
  const onEquip = vi.fn();
  render(<Journal result={result} character={character} busy={false} onEquip={onEquip} onClose={onClose} />);
  return { onClose, onEquip, user: userEvent.setup() };
};

describe("Journal", () => {
  it("次への手がかりを出す。特徴のある敵に削られたら、効く特性を教える", () => {
    const ogre = { kind: "ogre", name: "オーガ", hp: 40, traits: ["heavy"], rare: false } as const;
    const beaten = resultOf(
      [
        { type: "floor", t: 0, depth: 1, direction: "down", hp: 40, rations: 4 },
        { type: "encounter", t: 30, depth: 1, foe: ogre, hp: 40 },
        { type: "attack", by: "foe", damage: 40, hp: 0 },
        { type: "death", t: 40, depth: 1, cause: "battle" },
      ],
      "fainted",
      1,
    );
    setup(beaten);
    const tips = screen.getByRole("region", { name: "次への手がかり" });
    expect(within(tips).getByText(/オーガ（強打）に一番削られた/)).toBeInTheDocument();
    expect(within(tips).getByText(/受け止めの防具が効く/)).toBeInTheDocument();
    expect(within(tips).getByText(/ポーションを持たせていなかった/)).toBeInTheDocument();
  });

  it("困ったことがなければ、その旨を伝える", () => {
    const calm = resultOf(
      [
        { type: "floor", t: 0, depth: 1, direction: "down", hp: 40, rations: 4 },
        { type: "turnaround", t: 100, depth: 1 },
        { type: "floor", t: 150, depth: 1, direction: "up", hp: 40, rations: 4 },
        { type: "home", t: 300, hp: 40 },
      ],
      "returned",
      1,
    );
    setup(calm);
    expect(within(screen.getByRole("region", { name: "次への手がかり" })).getByText(/困ったことはなかった/)).toBeInTheDocument();
  });

  it("無事に帰ってきたら、目標と到達した階を出し、袋を開けると持ち帰ったものが出てくる", async () => {
    const { user } = setup(returned);
    expect(screen.getByText(/無事に帰ってきた/)).toBeInTheDocument();
    expect(screen.getByText(/目標 B2/)).toBeInTheDocument();
    expect(screen.queryByText(/灯火の剣/, { selector: ".report-items *" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "袋を開ける" }));
    expect(screen.getByText(/灯火の剣/, { selector: ".report-items *" })).toBeInTheDocument();
    expect(screen.getByLabelText("12 G")).toBeInTheDocument();
  });

  it("珍しい物が入っていると、開ける前から袋の口から光が漏れている", () => {
    setup(returned);
    expect(screen.getByText(/青い光が漏れている/)).toBeInTheDocument();
  });

  it("いまの装備より強ければ差を見せ、その場で装備できる", async () => {
    const { user, onEquip } = setup(returned);
    await user.click(screen.getByRole("button", { name: "袋を開ける" }));
    expect(screen.getByText(/攻 \+8/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "装備する" }));
    expect(onEquip).toHaveBeenCalledWith("a");
  });

  it("もう装備している物は「装備中」と出し、装備のボタンは出さない", async () => {
    const { user } = setup(returned, home({ stash: [], equipment: { weapon: sword, armor: null } }));
    await user.click(screen.getByRole("button", { name: "袋を開ける" }));
    expect(screen.getByText("装備中")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "装備する" })).not.toBeInTheDocument();
  });

  it("階を通るたびに 1 行の断面図になり、ハートで残りの HP を表す", () => {
    setup(returned);
    const rows = screen.getAllByRole("button", { name: /^B\d/ });
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveAccessibleName(/B2 行き.*ハート 2/);
  });

  it("レアな敵に会った行には印が付く", () => {
    setup(returned);
    expect(screen.getAllByRole("button", { name: /^B\d/ })[1]).toHaveAccessibleName(/レア/);
  });

  it("行を押すと、その階で会った敵と、手に入れたものと手に入れ方が見られる", async () => {
    const { user } = setup(returned);
    await user.click(screen.getAllByRole("button", { name: /^B\d/ })[1] as HTMLElement);
    const detail = screen.getByRole("region", { name: /B2 行きの記録/ });
    expect(within(detail).getByText(/光るスライム/)).toBeInTheDocument();
    expect(within(detail).getByText(/敵が落とした/)).toBeInTheDocument();
  });

  it("一番苦しかった戦いを、戦いの前後の HP と一緒に出す", () => {
    setup(returned);
    const hardest = screen.getByRole("region", { name: "一番苦しかった戦い" });
    expect(within(hardest).getByText(/光るスライム/)).toBeInTheDocument();
    expect(within(hardest).getByText(/40 → 12/)).toBeInTheDocument();
  });

  it("倒れた冒険は、ボロボロで帰ってきたことと、最期の戦いを出す", () => {
    setup(fainted);
    expect(screen.getByText(/ボロボロで帰ってきた/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^B\d/ })[0]).toHaveAccessibleName(/倒れた/);
    expect(screen.getByRole("region", { name: "最期の戦い" })).toBeInTheDocument();
    expect(screen.getByText(/持ち帰れなかった/)).toBeInTheDocument();
  });

  it("閉じるボタンで報告を閉じる", async () => {
    const { onClose, user } = setup(returned);
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Journal の敵の特徴", () => {
  it("行の詳しい記録に、敵の特徴（硬いなど）が出る", async () => {
    const beetle = { kind: "beetle", name: "甲虫", hp: 14, traits: ["armored"], rare: false } as const;
    const { user } = setup(
      resultOf(
        [
          { type: "floor", t: 0, depth: 6, direction: "down", hp: 40, rations: 1 },
          { type: "encounter", t: 10, depth: 6, foe: beetle, hp: 40 },
          { type: "attack", by: "foe", damage: 40, hp: 0 },
          { type: "death", t: 20, depth: 6, cause: "battle" },
        ],
        "fainted",
        6,
      ),
    );
    await user.click(screen.getAllByRole("button", { name: /^B\d/ })[0] as HTMLElement);
    expect(within(screen.getByRole("region", { name: /B6 行きの記録/ })).getByText("硬い")).toBeInTheDocument();
  });
});
