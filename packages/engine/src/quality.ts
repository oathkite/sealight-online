/** 画質の段階 */
export type QualityTier = "low" | "medium" | "high";

export type Quality = {
  readonly tier: QualityTier;
  /** 影の地図の一辺（画素） */
  readonly shadowSize: number;
  /** 画素の倍率の上限 */
  readonly maxPixelRatio: number;
  /** 模様のテクスチャの一辺（画素）。メモリの使い方はほぼこれで決まる */
  readonly textureSize: number;
  /** 三方向から模様を貼る（切ると 1 方向だけ。読み込みが 1/3 になる） */
  readonly triplanar: boolean;
  /** 草の本数の割合（0〜1） */
  readonly grass: number;
  /** 布を計算で揺らす（切ると止まった布） */
  readonly cloth: boolean;
};

const QUALITY: Readonly<Record<QualityTier, Quality>> = {
  low: { tier: "low", shadowSize: 1024, maxPixelRatio: 1.25, textureSize: 128, triplanar: false, grass: 0.2, cloth: false },
  medium: { tier: "medium", shadowSize: 2048, maxPixelRatio: 1.5, textureSize: 256, triplanar: true, grass: 0.55, cloth: true },
  high: { tier: "high", shadowSize: 2048, maxPixelRatio: 2, textureSize: 512, triplanar: true, grass: 1, cloth: true },
};

export const qualityFor = (tier: QualityTier): Quality => QUALITY[tier];

/** 端末の性能の手がかり。memory はブラウザが教えてくれないこともある（Safari など） */
export type DeviceInfo = {
  readonly mobile: boolean;
  readonly cores: number;
  readonly memory: number | undefined;
  readonly maxTextureSize: number;
};

/** 端末の性能から、無理のない画質の段階を選ぶ */
export const detectTier = ({ mobile, cores, memory, maxTextureSize }: DeviceInfo): QualityTier => {
  if (maxTextureSize < 4096 || cores <= 2 || (memory !== undefined && memory <= 2)) return "low";
  if (mobile) return cores <= 4 || (memory !== undefined && memory <= 3) ? "low" : "medium";
  const roomy = memory === undefined ? cores >= 8 : memory >= 8 && cores >= 6;
  return roomy ? "high" : "medium";
};
