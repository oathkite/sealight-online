import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { PALETTE } from "./palette";

type MonsterProps = {
  readonly position: readonly [number, number, number];
  /** ボロボロで帰ってきたときは包帯を巻いている */
  readonly hurt: boolean;
};

/** 仮の使役モンスター（丸い体 + 目）。本番は Blender のモデルに置き換える */
export const Monster = ({ position, hurt }: MonsterProps) => {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    // ゆっくり呼吸するように上下させる
    const breath = Math.sin(clock.elapsedTime * 2) * 0.03;
    group.scale.set(1 + breath, 1 - breath, 1 + breath);
  });

  return (
    <group ref={ref} position={[...position]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color={PALETTE.monster} flatShading />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.26]}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshStandardMaterial color={PALETTE.eye} />
        </mesh>
      ))}
      {hurt ? (
        <mesh position={[0.12, 0.5, 0.12]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.28, 0.07, 0.07]} />
          <meshStandardMaterial color={PALETTE.bandage} />
        </mesh>
      ) : null}
    </group>
  );
};
