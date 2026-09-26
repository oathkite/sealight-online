import { qualityFor, type Quality } from "@sealight/engine";

/** 画質の設定。auto は端末の性能から選ぶ */
export type GraphicsSetting = "auto" | "low" | "medium" | "high";

export const GRAPHICS_KEY = "sealight.graphics";
const SETTINGS: readonly GraphicsSetting[] = ["auto", "low", "medium", "high"];

const isSetting = (value: string | null): value is GraphicsSetting => value !== null && (SETTINGS as readonly string[]).includes(value);

/** 端末の保存領域は使えないこともある（プライベートブラウズなど）ので、失敗しても止めない */
const readStored = (): string | null => {
  try {
    return window.localStorage.getItem(GRAPHICS_KEY);
  } catch {
    return null;
  }
};

/** 画質の設定。URL の ?quality= を優先し、なければ保存した設定、それもなければ自動 */
export const loadGraphicsSetting = (): GraphicsSetting => {
  const fromUrl = new URLSearchParams(window.location.search).get("quality");
  if (isSetting(fromUrl)) return fromUrl;
  const stored = readStored();
  return isSetting(stored) ? stored : "auto";
};

export const saveGraphicsSetting = (setting: GraphicsSetting): void => {
  try {
    window.localStorage.setItem(GRAPHICS_KEY, setting);
  } catch {
    // 保存できなくても、この回の表示には使える
  }
};

export const qualityFromSetting = (setting: GraphicsSetting): Quality | "auto" => (setting === "auto" ? "auto" : qualityFor(setting));
