import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { Vec3 } from "./layout";
import { PALETTE } from "./palette";

const PUFFS = 6;
const CYCLE_SEC = 4.8;

/** 煙突から立ちのぼる煙。綿のように丸い煙がふくらみながら風に流れて消える */
export const Smoke = ({ origin }: { origin: Vec3 }) => {
  const group = useRef<Group>(null);

  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const t = ((clock.elapsedTime / CYCLE_SEC + i / PUFFS) % 1 + 1) % 1;
      const puff = child as Mesh;
      puff.position.set(t * 0.55 + Math.sin(t * 6 + i) * 0.05, t * 1.3, -t * 0.2);
      puff.scale.setScalar(0.08 + t * 0.2);
      puff.rotation.set(t * 2, i, t);
      const material = puff.material as MeshStandardMaterial;
      material.opacity = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.75;
    });
  });

  return (
    <group ref={group} position={[...origin]}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={PALETTE.smoke} transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};
