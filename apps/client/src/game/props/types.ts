import type { Vec3 } from "@sealight/engine";
import type { Shapes } from "../shapes";

/** 置き物が持つ灯り。種類ごとに時刻や留守に合わせて強さが変わる（lantern は玄関のランタン。留守の間は昼でも灯す） */
export type LightAnchor = { readonly kind: "lamp" | "lantern" | "flame" | "magic"; readonly position: Vec3 };

/** 置き物を作ったときに、ゲーム側で使う目印（灯りの位置、煙の出る位置） */
export type PropAnchors = {
  readonly lights?: readonly LightAnchor[];
  readonly smoke?: Vec3;
};

/** 置き物を作る関数。s の座標は置き物の中心が原点で、+z が正面 */
export type PropBuilder = (s: Shapes) => PropAnchors;
