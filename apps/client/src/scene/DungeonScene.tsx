import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { maxHpFor, type LampResult } from "@sealight/sim";
import { buildTimeline, frameAt, type Frame } from "@/replay/timeline";
import { Explorer } from "./Explorer";
import { MazeMesh } from "./MazeMesh";
import { Monsters } from "./Monsters";
import { Treasures } from "./Treasures";

const ISO_DIRECTION = [1, 1.15, 1] as const;

const IsoCamera = ({ width, height }: { readonly width: number; readonly height: number }) => {
  const size = useThree((s) => s.size);
  const cx = (width - 1) / 2;
  const cz = (height - 1) / 2;
  const distance = Math.max(width, height) * 2;
  // 迷路の対角線が画面の短辺に収まるように拡大率を決める
  const zoom = Math.min(size.width, size.height) / (Math.hypot(width, height) * 1.05);
  const [dx, dy, dz] = ISO_DIRECTION;
  return (
    <OrthographicCamera
      makeDefault
      zoom={zoom}
      position={[cx + dx * distance, dy * distance, cz + dz * distance]}
      near={0.1}
      far={distance * 4}
      onUpdate={(camera) => camera.lookAt(cx, 0, cz)}
    />
  );
};

/** 画面の表示（HUD）に関係する部分だけを比べ、変化したときだけ親に知らせる */
const hudSignature = (f: Frame): string =>
  `${f.hp}|${f.foe?.hp ?? "-"}|${f.log}|${f.status}|${f.defeated.size}|${f.opened.size}`;

/** 再生状態を持つので、別の探索を再生するときは key を変えて作り直す */
type DungeonSceneProps = {
  readonly lamp: LampResult;
  readonly shadows: boolean;
  readonly onFrame?: (frame: Frame) => void;
  readonly onFinished?: (frame: Frame) => void;
};

export const DungeonScene = ({ lamp, shadows, onFrame, onFinished }: DungeonSceneProps) => {
  const { maze, events, input } = lamp;
  const timeline = useMemo(
    () => buildTimeline({ start: maze.start, hp: input.loadout.hp, maxHp: maxHpFor(input.loadout.stats), events }),
    [maze.start, input.loadout, events],
  );
  const frameRef = useRef<Frame | null>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);
  const lastSignature = useRef("");
  const [visible, setVisible] = useState<Pick<Frame, "defeated" | "opened">>({ defeated: new Set(), opened: new Set() });

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    const frame = frameAt(timeline, clock.elapsedTime - startedAt.current);
    frameRef.current = frame;
    const signature = hudSignature(frame);
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      setVisible({ defeated: frame.defeated, opened: frame.opened });
      onFrame?.(frame);
    }
    if ((frame.status === "done" || frame.status === "dead") && !finished.current) {
      finished.current = true;
      onFinished?.(frame);
    }
  });

  return (
    <>
      <IsoCamera width={maze.width} height={maze.height} />
      <hemisphereLight args={["#d8d0ff", "#2a2440", 1.1]} />
      <directionalLight
        position={[maze.width, 18, maze.height * 0.3]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-maze.width}
        shadow-camera-right={maze.width}
        shadow-camera-top={maze.height}
        shadow-camera-bottom={-maze.height}
      />
      <MazeMesh maze={maze} />
      <Treasures treasures={maze.treasures} picked={visible.opened} />
      <Monsters monsters={maze.monsters} events={events} defeated={visible.defeated} />
      <Explorer frameRef={frameRef} />
    </>
  );
};
