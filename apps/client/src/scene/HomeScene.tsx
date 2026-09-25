import { OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Monster } from "./Monster";
import { PALETTE } from "./palette";

const VIEW_SIZE = 10;

const IsoCamera = () => {
  const size = useThree((s) => s.size);
  const zoom = Math.min(size.width, size.height) / VIEW_SIZE;
  return (
    <OrthographicCamera makeDefault zoom={zoom} position={[8, 9, 8]} near={0.1} far={50} onUpdate={(c) => c.lookAt(0, 0, 0)} />
  );
};

/** 町外れの小屋（仮）。壁、屋根、扉 */
const Hut = () => (
  <group position={[-0.6, 0, -1]}>
    <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
      <boxGeometry args={[2, 1.2, 1.6]} />
      <meshStandardMaterial color={PALETTE.hutWall} flatShading />
    </mesh>
    <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[1.6, 0.8, 4]} />
      <meshStandardMaterial color={PALETTE.roof} flatShading />
    </mesh>
    <mesh position={[0.3, 0.4, 0.81]}>
      <boxGeometry args={[0.4, 0.8, 0.02]} />
      <meshStandardMaterial color={PALETTE.door} />
    </mesh>
  </group>
);

/** 小さな畑（仮）。2x2 の区画に芽が出ている */
const Field = () => (
  <group position={[1.6, 0, 0.2]}>
    {[-0.35, 0.35].flatMap((x) =>
      [-0.35, 0.35].map((z) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[0.6, 0.1, 0.6]} />
            <meshStandardMaterial color={PALETTE.soil} flatShading />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.08, 0.2, 5]} />
            <meshStandardMaterial color={PALETTE.sprout} flatShading />
          </mesh>
        </group>
      )),
    )}
  </group>
);

type HomeSceneProps = {
  /** モンスターが家にいるか（冒険中は寝床が空っぽ） */
  readonly present: boolean;
  readonly hurt: boolean;
};

/** 留守の家。モンスターの寝床（わら）とごはんの皿があり、家にいるときだけモンスターがいる */
export const HomeScene = ({ present, hurt }: HomeSceneProps) => (
  <>
    <IsoCamera />
    <hemisphereLight args={["#fff4dc", "#3a3450", 1.2]} />
    <directionalLight position={[5, 8, 3]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[4, 8]} />
      <meshStandardMaterial color={PALETTE.grass} flatShading />
    </mesh>
    <Hut />
    <Field />
    <mesh position={[0.4, 0.05, 0.9]} receiveShadow>
      <cylinderGeometry args={[0.55, 0.6, 0.1, 7]} />
      <meshStandardMaterial color={PALETTE.straw} flatShading />
    </mesh>
    <mesh position={[1.2, 0.06, 1.5]}>
      <cylinderGeometry args={[0.16, 0.12, 0.12, 8]} />
      <meshStandardMaterial color={PALETTE.bowl} flatShading />
    </mesh>
    {present ? <Monster position={[0.4, 0.1, 0.9]} hurt={hurt} /> : null}
  </>
);
