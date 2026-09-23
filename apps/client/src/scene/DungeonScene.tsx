import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import type { LampResult } from "@sealight/sim";
import { buildTimeline, frameAt, type Frame } from "@/replay/timeline";
import { Explorer } from "./Explorer";
import { MazeMesh } from "./MazeMesh";
import { Treasures } from "./Treasures";

const CELLS_PER_SEC = 6;
const ISO_DIRECTION = [1, 1.15, 1] as const;

/** 再生状態を持つので、フロアが変わるときは key を変えて作り直す */
type DungeonSceneProps = {
  readonly result: LampResult;
  readonly shadows: boolean;
  readonly onPicked: (count: number) => void;
  readonly onFinished: () => void;
};

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

export const DungeonScene = ({ result, shadows, onPicked, onFinished }: DungeonSceneProps) => {
  const { maze, events } = result;
  const timeline = useMemo(() => buildTimeline(maze.start, events), [maze.start, events]);
  const frameRef = useRef<Frame | null>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  // シーンは key で作り直されるので、作り直しのたびに宝箱の数を 0 に戻す
  useEffect(() => onPicked(0), [onPicked]);

  useFrame(({ clock }) => {
    startedAt.current ??= clock.elapsedTime;
    const frame = frameAt(timeline, clock.elapsedTime - startedAt.current, CELLS_PER_SEC);
    frameRef.current = frame;
    if (frame.picked.size !== picked.size) {
      setPicked(frame.picked);
      onPicked(frame.picked.size);
    }
    if (frame.done && !finished.current) {
      finished.current = true;
      onFinished();
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
      <Treasures treasures={maze.treasures} picked={picked} />
      <Explorer frameRef={frameRef} />
    </>
  );
};
