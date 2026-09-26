import { composeEuler, identity, multiply, normalFromMat4, type Mat3, type Mat4 } from "../math/mat4";
import type { Vec3 } from "../math/vec3";

/** 登録したメッシュの名前 */
export type MeshId = string;

export type Transform = {
  readonly position: Vec3;
  /** x → y → z の順に回すオイラー角 */
  readonly rotation: Vec3;
  readonly scale: Vec3;
};

/** 動かない骨組みの定義。動きは Pose で上から重ねる */
export type NodeDef = {
  readonly name: string;
  readonly rest: Transform;
  readonly mesh: MeshId | null;
  readonly visible: boolean;
  readonly children: readonly NodeDef[];
};

/** 1 つの node の姿勢。位置と回転は元の値からのずれ、大きさは元の値に掛ける倍率 */
export type NodePose = Partial<Transform> & { readonly visible?: boolean };
export type Pose = ReadonlyMap<string, NodePose>;

export type Drawable = {
  readonly node: string;
  readonly mesh: MeshId;
  readonly matrix: Mat4;
  readonly normal: Mat3;
};

export const node = (
  name: string,
  options: Partial<Transform> & { readonly mesh?: MeshId; readonly visible?: boolean; readonly children?: readonly NodeDef[] } = {},
): NodeDef => ({
  name,
  rest: { position: options.position ?? [0, 0, 0], rotation: options.rotation ?? [0, 0, 0], scale: options.scale ?? [1, 1, 1] },
  mesh: options.mesh ?? null,
  visible: options.visible ?? true,
  children: options.children ?? [],
});

const localMatrix = (rest: Transform, pose: NodePose | undefined): Mat4 => {
  const p = pose?.position ?? [0, 0, 0];
  const r = pose?.rotation ?? [0, 0, 0];
  const s = pose?.scale ?? [1, 1, 1];
  return composeEuler(
    [rest.position[0] + p[0], rest.position[1] + p[1], rest.position[2] + p[2]],
    [rest.rotation[0] + r[0], rest.rotation[1] + r[1], rest.rotation[2] + r[2]],
    [rest.scale[0] * s[0], rest.scale[1] * s[1], rest.scale[2] * s[2]],
  );
};

/** 骨組みをたどって、描くメッシュとその行列を集める。parent はモデル全体の置き場所 */
export const collectDrawables = (root: NodeDef, pose: Pose, parent: Mat4 = identity()): Drawable[] => {
  const nodePose = pose.get(root.name);
  if (!(nodePose?.visible ?? root.visible)) return [];
  const matrix = multiply(parent, localMatrix(root.rest, nodePose));
  const self: Drawable[] = root.mesh ? [{ node: root.name, mesh: root.mesh, matrix, normal: normalFromMat4(matrix) }] : [];
  return [...self, ...root.children.flatMap((child) => collectDrawables(child, pose, matrix))];
};
