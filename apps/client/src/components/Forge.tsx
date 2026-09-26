import { forgeCost, forgeGain, type Equipment } from "@sealight/sim";
import { playSfx } from "@/audio/sfx";
import { itemLabel } from "./format";
import { forgePanelId, statName } from "./items/items";

type ForgePanelProps = {
  readonly target: Equipment;
  readonly stash: readonly Equipment[];
  readonly gold: number;
  readonly busy: boolean;
  readonly onForge: (targetId: string, materialId: string) => void;
};

/** 鍛冶。同じ部位の倉庫の装備を溶かして、選んだ装備を鍛える。強い素材ほど大きく上がる */
export const ForgePanel = ({ target, stash, gold, busy, onForge }: ForgePanelProps) => {
  const cost = forgeCost(target);
  const materials = stash.filter((i) => i.slot === target.slot && i.id !== target.id).sort((a, b) => forgeGain(b) - forgeGain(a));
  return (
    <section id={forgePanelId(target.id)} className="forge" aria-label={`${target.name}を鍛える`}>
      <p className="forge-lead">
        溶かす装備を選ぶ（手間賃 {cost} G・特性はそのまま）
      </p>
      {materials.length === 0 ? (
        <p className="muted">溶かせる{target.slot === "weapon" ? "武器" : "防具"}が倉庫にありません</p>
      ) : (
        <ul className="forge-list">
          {materials.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                aria-label={`${m.name}を溶かす`}
                disabled={busy || gold < cost}
                onClick={() => {
                  playSfx("reveal");
                  onForge(target.id, m.id);
                }}
              >
                <span className="forge-material">{itemLabel(m)}</span>
                <span className="gain up">
                  {statName(target.slot)} +{forgeGain(m)}
                </span>
                <span className="price">{cost} G</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
