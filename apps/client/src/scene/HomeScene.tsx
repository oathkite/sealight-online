import { Suspense } from "react";
import { OrthographicCamera, Sparkles } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { HomeModel } from "./HomeModel";
import { SPOTS } from "./layout";
import { Monster } from "./Monster";
import { PALETTE } from "./palette";
import type { Mood } from "./stage";
import type { Lighting } from "./timeOfDay";
import type { Stage } from "./useStage";

/** 画面の短い辺に収める広さ（ワールド単位） */
const VIEW_SIZE = 8.5;
/** PC で右側に出るパネルの幅（index.css の .overlay と合わせる） */
const PANEL_WIDTH = 576;
const WIDE = 900;

/**
 * カメラの位置。平行投影なので離しても写る大きさは変わらない。
 * 縦長の画面で下端の地面がカメラの後ろに回り込まないよう、遠くに置く
 */
const EYE = new Vector3(20, 17.2, 20);
const TARGET = new Vector3(-0.6, 0, 0.6);
const FORWARD = TARGET.clone().sub(EYE).normalize();
const RIGHT = FORWARD.clone().cross(new Vector3(0, 1, 0)).normalize();
const UP = RIGHT.clone().cross(FORWARD).normalize();

/**
 * 斜め上から見下ろすカメラ。パネルに隠れない場所に島が来るよう、カメラを平行移動する。
 * PC はパネルの左側、スマホはパネルの上側の真ん中に島を置く
 */
const FramedCamera = () => {
  const { width, height } = useThree((s) => s.size);
  const wide = width >= WIDE;
  const visible = wide ? { w: width - PANEL_WIDTH, h: height } : { w: width, h: height * 0.5 };
  const zoom = Math.min(visible.w, visible.h * 1.15) / VIEW_SIZE;
  // 画面上で島を左（PC）または上（スマホ）へずらす量（ピクセル）
  const shiftX = wide ? PANEL_WIDTH / 2 : 0;
  const shiftY = wide ? 0 : height * 0.24;
  const offset = RIGHT.clone().multiplyScalar(shiftX / zoom).add(UP.clone().multiplyScalar(-shiftY / zoom));
  const eye = EYE.clone().add(offset);
  const target = TARGET.clone().add(offset);
  return (
    <OrthographicCamera makeDefault zoom={zoom} position={eye} near={1} far={90} onUpdate={(c) => c.lookAt(target)} />
  );
};

const Sky = ({ lighting }: { lighting: Lighting }) => (
  <>
    <color attach="background" args={[lighting.fog]} />
    <fog attach="fog" args={[lighting.fog, 35, 54]} />
    <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]} />
    <directionalLight
      position={[...lighting.sunPosition]}
      color={lighting.sunColor}
      intensity={lighting.sunIntensity}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0008}
      shadow-normalBias={0.03}
    >
      <orthographicCamera attach="shadow-camera" args={[-7, 7, 7, -7, 0.5, 30]} />
    </directionalLight>
    {/* 夜は蛍、昼は綿毛が漂う */}
    <Sparkles
      count={24}
      scale={[8, 2, 8]}
      position={[0, 1, 0]}
      size={lighting.lamp > 0.5 ? 3.5 : 2}
      speed={0.25}
      color={lighting.lamp > 0.5 ? "#e8ff9a" : "#fffbe8"}
      opacity={0.35 + lighting.lamp * 0.6}
    />
  </>
);

/** ダンジョンの入口から漏れる光と粒 */
const GateGlow = () => (
  <group position={[SPOTS.gate[0], 0, SPOTS.gate[2]]}>
    <pointLight position={[0, 0.3, 0]} color={PALETTE.dungeonGlow} intensity={1.5} distance={2.4} decay={2} />
    <Sparkles count={14} scale={[0.8, 1.2, 1]} position={[0, 0.6, 0]} size={2.4} speed={0.35} color={PALETTE.dungeonGlow} opacity={0.85} />
  </group>
);

type HomeSceneProps = {
  /** モンスターの場面（家、出発、留守、帰り） */
  readonly stage: Stage;
  readonly mood: Mood;
  readonly lighting: Lighting;
};

/** 宙に浮かぶ島の家。小屋と畑、寝床と皿、ダンジョンの入口がある。モンスターは入口から出かけ、入口から帰ってくる */
export const HomeScene = ({ stage, mood, lighting }: HomeSceneProps) => {
  // 帰りを待つ間は、昼でも玄関のランタンを灯しておく
  const lanternLit = stage.act === "away" ? Math.max(lighting.lamp, 0.8) : lighting.lamp;
  return (
    <>
      <FramedCamera />
      <Sky lighting={lighting} />
      <Suspense fallback={null}>
        <HomeModel lamp={lighting.lamp} lantern={lanternLit} />
      </Suspense>
      <GateGlow />
      <Suspense fallback={null}>
        <Monster stage={stage} mood={mood} />
      </Suspense>
    </>
  );
};
