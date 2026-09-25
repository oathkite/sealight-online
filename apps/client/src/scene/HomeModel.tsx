import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { PALETTE } from "./palette";
import { Smoke } from "./Smoke";

const MODEL_URL = "/models/home.glb";

type Vec3 = readonly [number, number, number];

/** Blender で付けた材質の名前。ゲーム側で光り具合を変える */
const findMaterial = (root: Object3D, name: string): MeshStandardMaterial | null => {
  let found: MeshStandardMaterial | null = null;
  root.traverse((obj) => {
    if (found || !(obj instanceof Mesh)) return;
    const materials: unknown[] = Array.isArray(obj.material) ? obj.material : [obj.material];
    const match = materials.find((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial && m.name === name);
    if (match) found = match;
  });
  return found;
};

/** Blender で置いた目印（空の物体）の位置 */
const markerPosition = (root: Object3D, name: string): Vec3 => {
  const marker = root.getObjectByName(name);
  return marker ? [marker.position.x, marker.position.y, marker.position.z] : [0, 0, 0];
};

const useHomeModel = () => {
  const { scene } = useGLTF(MODEL_URL);
  return useMemo(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    const windowGlass = findMaterial(scene, "window");
    const lanternGlass = findMaterial(scene, "lantern");
    return {
      scene,
      smoke: markerPosition(scene, "smoke_origin"),
      lanternLight: markerPosition(scene, "lantern_light"),
      /** 窓とランタンの光り具合を変える */
      setGlow: (lamp: number, lantern: number): void => {
        if (windowGlass) windowGlass.emissiveIntensity = 0.2 + lamp * 2.2;
        if (lanternGlass) lanternGlass.emissiveIntensity = 0.2 + lantern * 3;
      },
    };
  }, [scene]);
};

type HomeModelProps = {
  /** 窓の灯り（0〜1） */
  readonly lamp: number;
  /** 玄関先のランタンの灯り（0〜1） */
  readonly lantern: number;
};

/** Blender で作った家の場面（art/build_home.py）。窓とランタンは時刻と留守に合わせて灯す */
export const HomeModel = ({ lamp, lantern }: HomeModelProps) => {
  const model = useHomeModel();

  const { setGlow } = model;
  useEffect(() => setGlow(lamp, lantern), [setGlow, lamp, lantern]);

  return (
    <>
      <primitive object={model.scene} />
      <Smoke origin={model.smoke} />
      <pointLight position={[...model.lanternLight]} color={PALETTE.lantern} intensity={lantern * 3} distance={3.5} decay={2} />
    </>
  );
};

useGLTF.preload(MODEL_URL);
