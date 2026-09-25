import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Face } from "./Face";
import { HeartMeter, Icon } from "./Icon";

describe("HeartMeter", () => {
  it("残りのハートの数を読み上げ用の名前で伝える", () => {
    render(<HeartMeter count={2} />);
    expect(screen.getByRole("img", { name: "ハート 2 / 5" })).toBeInTheDocument();
  });

  it("残っている数だけ塗ったハートを描き、残りは空のハートにする", () => {
    const { container } = render(<HeartMeter count={2} />);
    expect(container.querySelectorAll('[data-icon="heart"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-icon="heartEmpty"]')).toHaveLength(3);
  });

  it("0 のときは全部空、最大のときは全部塗る", () => {
    const empty = render(<HeartMeter count={0} />);
    expect(empty.container.querySelectorAll('[data-icon="heart"]')).toHaveLength(0);
    const full = render(<HeartMeter count={5} />);
    expect(full.container.querySelectorAll('[data-icon="heart"]')).toHaveLength(5);
  });
});

describe("Icon と Face", () => {
  it("飾りの絵は読み上げない", () => {
    const { container } = render(
      <>
        <Icon name="bread" />
        <Face expression="happy" />
      </>,
    );
    for (const svg of container.querySelectorAll("svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
