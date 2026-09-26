import type { DeviceInfo } from "./quality";

type NavigatorHints = Navigator & { readonly deviceMemory?: number; readonly userAgentData?: { readonly mobile?: boolean } };

/** ブラウザから端末の手がかりを集める */
export const readDevice = (gl: WebGL2RenderingContext | null): DeviceInfo => {
  const nav = navigator as NavigatorHints;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return {
    mobile: nav.userAgentData?.mobile ?? (coarse && Math.min(screen.width, screen.height) < 820),
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory,
    maxTextureSize: gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096,
  };
};
