import type { CSSProperties, ReactNode } from "react";
import type { Equipment } from "@sealight/sim";
import { AFFIX_HINTS, AFFIX_NAMES } from "../format";
import { ItemIcon } from "./ItemIcon";
import { statName } from "./items";

type ItemCardProps = {
  readonly item: Equipment;
  /** 今の装備と比べた強さの差。比べないときは null */
  readonly gain?: number | null;
  /** 何番目に現れるか（袋から出てくる順）。現れる演出の遅れに使う */
  readonly order?: number;
  readonly children?: ReactNode;
};

const GainBadge = ({ gain, slot }: { readonly gain: number; readonly slot: Equipment["slot"] }) => {
  if (gain === 0) return <span className="gain same">いまと同じ</span>;
  return (
    <span className={`gain ${gain > 0 ? "up" : "down"}`}>
      {statName(slot)} {gain > 0 ? `+${gain}` : gain}
      <span aria-hidden="true">{gain > 0 ? " ▲" : " ▼"}</span>
    </span>
  );
};

/** 装備の札。珍しい物は縁が青く光り、きらめきが舞う */
export const ItemCard = ({ item, gain = null, order, children }: ItemCardProps) => {
  const style = order === undefined ? undefined : ({ "--order": order } as CSSProperties);
  return (
    <div className={`item-card ${item.rarity}${order === undefined ? "" : " revealing"}`} style={style}>
      <div className="item-art">
        <ItemIcon item={item} />
        {item.rarity === "rare" ? <span className="sparkles" aria-hidden="true" /> : null}
      </div>
      <div className="item-body">
        <span className="item-name">
          {item.rarity === "rare" ? <span className="rarity">レア</span> : null}
          {item.name}
          {item.affix ? <span className={`affix ${item.affix}`}>{AFFIX_NAMES[item.affix]}</span> : null}
        </span>
        <span className="item-stat">
          {statName(item.slot)} +{item.power}
          {gain === null ? null : <GainBadge gain={gain} slot={item.slot} />}
        </span>
        {item.affix ? <span className="affix-hint">{AFFIX_HINTS[item.affix]}</span> : null}
      </div>
      {children ? <div className="item-actions">{children}</div> : null}
    </div>
  );
};
