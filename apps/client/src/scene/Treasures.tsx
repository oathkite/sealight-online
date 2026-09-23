import type { Point } from "@sealight/sim";
import { pointKey } from "@/replay/timeline";
import { PALETTE } from "./palette";

type TreasuresProps = {
  readonly treasures: readonly Point[];
  readonly picked: ReadonlySet<string>;
};

export const Treasures = ({ treasures, picked }: TreasuresProps) => (
  <group>
    {treasures
      .filter((t) => !picked.has(pointKey(t)))
      .map((t) => (
        <mesh key={pointKey(t)} position={[t.x, 0.25, t.y]} castShadow>
          <boxGeometry args={[0.4, 0.3, 0.3]} />
          <meshStandardMaterial color={PALETTE.treasure} flatShading />
        </mesh>
      ))}
  </group>
);
