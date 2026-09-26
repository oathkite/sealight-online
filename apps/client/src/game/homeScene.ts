import {
  clothMesh,
  compose,
  createAnimator,
  createCloth,
  stepCloth,
  type CameraRig,
  type Cloth,
  type ClothDraw,
  type Engine,
  type EngineFrame,
  type Environment,
  type FrameInput,
  type Rect,
  type Vec3,
  type Viewport,
} from "@sealight/engine";
import { poseAt, type Mood } from "@/scene/stage";
import type { Stage } from "@/scene/useStage";
import { environmentAt, skyAt } from "./lighting";
import { scatterGrass } from "./grass";
import { patternNumber, TERRAIN_PATTERNS } from "./materials";
import { color } from "./palette";
import { CLIPS } from "./monster/clips";
import { buildMonster, monsterPose } from "./monster/rig";
import { particlesAt } from "./particles";
import { buildHomeWorld } from "./world";

/** PC で右側に出るパネルの幅（index.css の .overlay と合わせる） */
const PANEL_WIDTH = 576;
const WIDE = 900;
/** 操作してからしばらくは、家にいても毎フレーム描く */
const ACTIVE_MS = 30_000;

/** 固定のカメラ。手前の上から見下ろし、庭の全体が見える場所に収める */
const CAMERA: CameraRig = {
  target: [-0.5, 0, -0.9],
  pitch: 0.84,
  yaw: 0,
  fovy: 0.5,
  focus: { min: [-7, -5.2], max: [6.2, 3.6], height: 1.2 },
};

/** パネルに隠れない場所。PC は右のパネルの左側、スマホは下のパネルの上側 */
export const visibleArea = (v: Viewport): Rect =>
  v.width >= WIDE ? { x: 0, y: 0, width: v.width - PANEL_WIDTH, height: v.height } : { x: 0, y: 0, width: v.width, height: v.height * 0.5 };

/** 布を風の中で動かす。風の強さを布が受ける力に直す */
const WIND_FORCE = 7;
const windOf = (environment: Environment): Vec3 => {
  const { direction, strength } = environment.wind;
  return [direction[0] * strength * WIND_FORCE, 0, direction[1] * strength * WIND_FORCE];
};

/** 止めた布の形。画質が低いときは、垂れ下がった形で止めておく */
const settle = (cloth: Cloth): Cloth => {
  let current = cloth;
  for (let i = 0; i < 90; i += 1) current = stepCloth(current, { dt: 1 / 60, wind: [0.6, 0, 0.4], time: i / 60 });
  return current;
};

export type HomeState = {
  readonly stage: Stage;
  readonly mood: Mood;
  readonly hour: number;
  /** 最後に操作した時刻（performance.now のミリ秒） */
  readonly lastActive: number;
};

/**
 * 家の場面。動かない物と地面、モンスターをエンジンに登録し、
 * 毎フレーム、演出の場面と時刻からモンスターの姿、光、粒を決める
 */
export const createHomeScene = () => {
  const world = buildHomeWorld();
  const monster = buildMonster();
  const animator = createAnimator(CLIPS);
  // 魔法の光の粒は、入口の門が持つ魔法の灯りの真下（階段の上）から立ちのぼる
  const magic = world.lights.find((l) => l.kind === "magic")?.position ?? [0, 0, 0];
  const motes: Vec3 = [magic[0], 0.05, magic[2]];
  let cloths: Cloth[] = world.cloths.map((c) => settle(createCloth(c.spec)));
  let simulate = true;
  const clothLooks = world.cloths.map((c) => ({ color: color(c.color), pattern: patternNumber(c.pattern) }));
  const toDraws = (): ClothDraw[] => cloths.map((cloth, i) => ({ mesh: clothMesh(cloth), color: clothLooks[i]?.color ?? [1, 1, 1], pattern: clothLooks[i]?.pattern ?? 0 }));
  // 布を止めているとき（画質が低いとき）は、形を一度だけ作って使い回す
  let frozen: ClothDraw[] | null = null;
  const clothDraws = (): ClothDraw[] => (simulate ? toDraws() : (frozen ??= toDraws()));

  const install = (engine: Engine): void => {
    engine.setStatic(world.mesh);
    engine.setTerrain(world.terrain, world.waters, TERRAIN_PATTERNS);
    engine.addModel("monster", monster.root, monster.meshes);
    // 草の本数と布を計算で揺らすかは、実際に選ばれた画質の段階で決める
    engine.setFoliage({ data: scatterGrass(engine.quality.grass), color: color("grass") });
    simulate = engine.quality.cloth;
  };

  const frame = (info: EngineFrame, state: HomeState): { readonly input: FrameInput; readonly animating: boolean } => {
    const { stage, mood, hour } = state;
    const pose = poseAt(stage.act, Math.max(0, info.time - stage.since / 1000), mood);
    animator.play(pose.clip, pose.speed);
    const animated = animator.update(info.dt);
    const models = pose.visible
      ? [{ model: "monster", placement: compose(pose.position, pose.heading, [1, 1, 1]), pose: monsterPose(animated, { hurt: mood.hurt, sack: pose.sack }) }]
      : [];
    const environment = environmentAt({ hour, time: info.time, anchors: world.lights, waiting: stage.act === "away" });
    if (simulate) cloths = cloths.map((cloth) => stepCloth(cloth, { dt: info.dt, wind: windOf(environment), time: info.time }));
    const input: FrameInput = {
      camera: CAMERA,
      visible: visibleArea(info.viewport),
      environment,
      models,
      particles: particlesAt({ time: info.time, smoke: world.smoke, lamp: skyAt(hour).lamp, gate: motes }),
      cloths: clothDraws(),
      time: info.time,
    };
    const moving = stage.act === "leaving" || stage.act === "arriving";
    return { input, animating: moving || info.time * 1000 - state.lastActive < ACTIVE_MS };
  };

  return { install, frame };
};

export type HomeScene = ReturnType<typeof createHomeScene>;
