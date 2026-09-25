import { useEffect, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Mesh, type AnimationAction, type Group, type Object3D } from "three";
import { poseAt, type Clip, type Mood } from "./stage";
import type { Stage } from "./useStage";

const MODEL_URL = "/models/monster.glb";
const FADE_SEC = 0.25;

/** 包帯と荷物袋。Blender で付けた名前で探し、場面に合わせて出し入れする */
const ACCESSORIES = { bandage: ["bandage", "bandage_plaster"], sack: ["sack", "sack_tie"] } as const;

type Accessories = { readonly bandage: readonly Object3D[]; readonly sack: readonly Object3D[] };

const showAll = (objects: readonly Object3D[], visible: boolean): void => {
  for (const obj of objects) obj.visible = visible;
};

const findAll = (root: Object3D, names: readonly string[]): Object3D[] =>
  names.map((name) => root.getObjectByName(name)).filter((obj): obj is Object3D => obj !== undefined);

/** アニメーションを切り替える。前の動きから少しずつ混ぜて移る */
const crossfade = (from: AnimationAction | undefined, to: AnimationAction | undefined): void => {
  from?.fadeOut(FADE_SEC);
  to?.reset().fadeIn(FADE_SEC).play();
};

type MonsterProps = {
  readonly stage: Stage;
  readonly mood: Mood;
};

/**
 * 使役モンスター（仮。art/build_monster.py で作る）。
 * 場面（家、出発、留守、帰り）と気分に合わせて、歩く位置と向き、アニメーションを決める
 */
export const Monster = ({ stage, mood }: MonsterProps) => {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const parts = useRef<Accessories>({ bandage: [], sack: [] });
  // 影を落とす設定をして、包帯と荷物袋の部品を一度だけ探しておく
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof Mesh) obj.castShadow = true;
    });
    parts.current = { bandage: findAll(scene, ACCESSORIES.bandage), sack: findAll(scene, ACCESSORIES.sack) };
  }, [scene]);
  const shown = useRef<string | null>(null);
  const playing = useRef<Clip | null>(null);

  useFrame(() => {
    const root = group.current;
    if (!root) return;
    const pose = poseAt(stage.act, (performance.now() - stage.since) / 1000, mood);
    root.position.set(...pose.position);
    root.rotation.y = pose.heading;
    root.visible = pose.visible;
    // 見た目が変わるときだけ出し入れする
    const key = `${mood.hurt}-${pose.sack}`;
    if (shown.current !== key && parts.current.bandage.length > 0) {
      showAll(parts.current.bandage, mood.hurt);
      showAll(parts.current.sack, pose.sack);
      shown.current = key;
    }
    if (playing.current !== pose.clip) {
      crossfade(playing.current ? actions[playing.current] ?? undefined : undefined, actions[pose.clip] ?? undefined);
      playing.current = pose.clip;
    }
    actions[pose.clip]?.setEffectiveTimeScale(pose.speed);
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);
