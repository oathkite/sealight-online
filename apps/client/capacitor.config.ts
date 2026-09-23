import type { CapacitorConfig } from "@capacitor/cli";

// ローカル開発では http の API（wrangler dev）を呼ぶため、平文通信と混在コンテンツを許可する。
// 付け忘れて本番に出ないよう、CAP_ENV=development を指定したときだけ有効にする。
const isDev = process.env.CAP_ENV === "development";

const config: CapacitorConfig = {
  appId: "jp.oathkite.sealight",
  appName: "Sealight Online",
  webDir: "dist",
  ...(isDev ? { server: { cleartext: true }, android: { allowMixedContent: true } } : {}),
};

export default config;
