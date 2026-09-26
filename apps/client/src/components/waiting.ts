/** 留守の間のつぶやき。冒険の進み具合（目安に対する経過）で変える */
export const MUTTERS = {
  down: ["階段を下りていく足音が遠ざかる…", "ランタンの灯りが、闇の奥で揺れている", "どこかで宝箱の音がした気がする"],
  deep: ["いまごろ一番深いところかな", "魔物と向き合っているのかもしれない", "袋が少し重くなっていたらいいな"],
  up: ["帰り道を急いでいるころかも", "階段を上る足音が聞こえる気がする", "そろそろ寝床を整えておこう"],
  late: ["まだかな…", "入口の奥から、かすかな光が見える", "もうすぐ帰ってくるはず"],
} as const;

/** 進み具合から、いまの様子（潜る、深い、戻る、遅い）を決める */
export const stageOf = (p: number): keyof typeof MUTTERS => {
  if (p < 0.35) return "down";
  if (p < 0.65) return "deep";
  return p < 1 ? "up" : "late";
};

/** 目安の真ん中を 1 として、潜って（0〜0.5）戻る（0.5〜1）ときの、いまいる深さの割合 */
export const depthRatio = (progress: number): number => {
  const p = Math.min(1, Math.max(0, progress));
  return p < 0.5 ? p * 2 : 2 - p * 2;
};
