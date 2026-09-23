import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Object3D } from "three";
import type { Maze, Point } from "@sealight/sim";
import { PALETTE } from "./palette";

const WALL_HEIGHT = 0.9;

const cellsOf = (maze: Maze, floor: boolean): readonly Point[] =>
  maze.cells.flatMap((isFloor, i) => (isFloor === floor ? [{ x: i % maze.width, y: Math.floor(i / maze.width) }] : []));

type InstancedTilesProps = {
  readonly points: readonly Point[];
  readonly height: number;
  readonly color: (p: Point) => string;
};

/** 同じ形の箱を InstancedMesh でまとめて描く（描画命令を 1 回にする） */
const InstancedTiles = ({ points, height, color }: InstancedTilesProps) => {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const tint = new Color();
    points.forEach((p, i) => {
      dummy.position.set(p.x, height / 2, p.y);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.set(color(p)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [points, height, color]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} castShadow receiveShadow>
      <boxGeometry args={[1, height, 1]} />
      <meshStandardMaterial flatShading />
    </instancedMesh>
  );
};

const floorColor = (p: Point): string => ((p.x + p.y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB);
const wallColor = (): string => PALETTE.wall;

type MazeMeshProps = {
  readonly maze: Maze;
};

export const MazeMesh = ({ maze }: MazeMeshProps) => {
  const floors = useMemo(() => cellsOf(maze, true), [maze]);
  const walls = useMemo(() => cellsOf(maze, false), [maze]);

  return (
    <group>
      <InstancedTiles key={`f-${maze.width}-${floors.length}`} points={floors} height={0.1} color={floorColor} />
      <InstancedTiles key={`w-${maze.width}-${walls.length}`} points={walls} height={WALL_HEIGHT} color={wallColor} />
      <mesh position={[maze.stairs.x, 0.15, maze.stairs.y]} castShadow>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
        <meshStandardMaterial color={PALETTE.stairs} emissive={PALETTE.stairs} emissiveIntensity={0.4} flatShading />
      </mesh>
    </group>
  );
};
