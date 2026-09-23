import { useMemo } from "react";
import type { FoeKind, LampEvent, Point } from "@sealight/sim";
import { pointKey } from "@/replay/timeline";
import { PALETTE } from "./palette";

const FOE_COLORS = {
  slime: PALETTE.slime,
  goblin: PALETTE.goblin,
  skeleton: PALETTE.skeleton,
} as const satisfies Record<FoeKind, string>;

type MonstersProps = {
  readonly monsters: readonly Point[];
  readonly events: readonly LampEvent[];
  readonly defeated: ReadonlySet<string>;
};

/** まだ倒していないモンスターを描く。種類は遭遇イベントから分かったものだけ色分けする */
export const Monsters = ({ monsters, events, defeated }: MonstersProps) => {
  const kinds = useMemo(
    () => new Map(events.flatMap((e) => (e.type === "encounter" ? [[pointKey(e.at), e.foe.kind] as const] : []))),
    [events],
  );
  return (
    <group>
      {monsters
        .filter((m) => !defeated.has(pointKey(m)))
        .map((m) => {
          const kind = kinds.get(pointKey(m));
          return (
            <mesh key={pointKey(m)} position={[m.x, 0.28, m.y]} castShadow>
              <dodecahedronGeometry args={[0.22, 0]} />
              <meshStandardMaterial color={kind ? FOE_COLORS[kind] : PALETTE.unknownFoe} flatShading />
            </mesh>
          );
        })}
    </group>
  );
};
