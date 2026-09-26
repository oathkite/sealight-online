import { describe, it } from "vitest";
import { MILESTONES, runCampaign } from "./campaign";
import { adapter, grinder } from "./policies";

// sim は Node の型を持たないので、環境変数と出力に使うぶんだけ宣言する
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
declare const console: { readonly log: (text: string) => void };

// バランスの計測。ふだんのテストでは動かさず、BALANCE=1 のときだけ表を出力する
describe.runIf(process.env["BALANCE"] === "1")("バランスの計測", () => {
  it("力任せと対策するの、節目の階までの冒険の回数と時間", () => {
    const seeds = [1, 2, 3];
    const rows = [grinder, adapter].flatMap((policy) =>
      seeds.map((seed) => {
        const r = runCampaign(policy, { seed, maxTrips: 300 });
        const cells = MILESTONES.map((m) => (r.milestones[m] ? `${r.milestones[m].trips}回/${r.milestones[m].hours}h` : "-"));
        return [r.policy, seed, ...cells, `倒れた ${r.faints}`, `Lv${r.level}`, `計 ${r.trips} 回`].join("\t");
      }),
    );
    console.log(["方針\tシード\tB5\tB10\tB15\tB20", ...rows].join("\n"));
  }, 600_000);
});
