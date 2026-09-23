import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Frame } from "@/replay/timeline";
import { PALETTE } from "./palette";

type ExplorerProps = {
  /** 毎フレーム呼ばれ、その時点の再生状態を返す */
  readonly frameRef: { readonly current: Frame | null };
};

/** 仮のキャラクター（カプセルの体 + 頭 + ランタン）。本番は Blender のモデルに置き換える */
export const Explorer = ({ frameRef }: ExplorerProps) => {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = ref.current;
    const frame = frameRef.current;
    if (!group || !frame) return;
    const bob = frame.done ? 0 : Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.06;
    group.position.set(frame.position.x, bob, frame.position.y);
    if (frame.heading.x !== 0 || frame.heading.y !== 0) {
      group.rotation.y = Math.atan2(frame.heading.x, frame.heading.y);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.22, 3, 8]} />
        <meshStandardMaterial color={PALETTE.cloak} flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color={PALETTE.body} flatShading />
      </mesh>
      <mesh position={[0.18, 0.35, 0.12]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color={PALETTE.lantern} emissive={PALETTE.lantern} emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0.18, 0.45, 0.12]} color={PALETTE.lantern} intensity={2.5} distance={4} decay={1.5} />
    </group>
  );
};
