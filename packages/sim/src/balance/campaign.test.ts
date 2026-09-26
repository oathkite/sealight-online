import { beforeAll, describe, expect, it } from "vitest";
import { runCampaign, type CampaignReport } from "./campaign";
import { adapter, grinder } from "./policies";

// 自動で遊ぶプレイヤーで、「敵の特徴に効く特性の装備を選んで鍛える方が、強い装備を着て売るだけの力任せより、
// ずっと早く深くへ進める」ことを確かめる（特性、鍛冶、店の装備、報告の手がかりを合わせた効き目）。
// 数値を変えてこのテストが落ちたら、BALANCE=1 pnpm vitest run src/balance --reporter=verbose で表を見て調整する
describe("バランス", () => {
  let grind: CampaignReport;
  let adapt: CampaignReport;

  beforeAll(() => {
    grind = runCampaign(grinder, { seed: 1, maxTrips: 240 });
    adapt = runCampaign(adapter, { seed: 1, maxTrips: 240 });
  });

  const tripsTo = (report: CampaignReport, depth: number): number => report.milestones[depth]?.trips ?? Number.POSITIVE_INFINITY;

  it("対策するプレイヤーは、地下 20 階まで 60 回以内の冒険で往復できる", () => {
    expect(tripsTo(adapt, 20)).toBeLessThanOrEqual(60);
  });

  it("力任せでは、地下 20 階までに対策するプレイヤーの 2 倍以上の冒険がかかる", () => {
    expect(adapt.milestones[20]).not.toBeNull();
    expect(tripsTo(grind, 20)).toBeGreaterThanOrEqual(tripsTo(adapt, 20) * 2);
  });

  it("地下 15 階でも、対策する方が早い", () => {
    expect(adapt.milestones[15]).not.toBeNull();
    expect(tripsTo(adapt, 15)).toBeLessThan(tripsTo(grind, 15));
  });

  it("はじめの帯（地下 5 階まで）は、どちらでもつまずかずに進める", () => {
    expect(tripsTo(grind, 5)).toBeLessThanOrEqual(8);
    expect(tripsTo(adapt, 5)).toBeLessThanOrEqual(8);
  });
});
