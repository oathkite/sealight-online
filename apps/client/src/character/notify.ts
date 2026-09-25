import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

type Platform = "native" | "tauri" | "web";

const detectPlatform = (): Platform => {
  if (Capacitor.isNativePlatform()) return "native";
  if ("__TAURI_INTERNALS__" in window) return "tauri";
  return "web";
};

const requestByPlatform = async (platform: Platform): Promise<boolean> => {
  switch (platform) {
    case "native":
      return (await LocalNotifications.requestPermissions()).display === "granted";
    case "tauri":
      return (await isPermissionGranted()) || (await requestPermission()) === "granted";
    case "web":
      if (!("Notification" in window)) return false;
      if (Notification.permission !== "default") return Notification.permission === "granted";
      return (await Notification.requestPermission()) === "granted";
  }
};

/** 送り出すときに呼び、帰ってきたことを知らせる通知の許可を取っておく */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    return await requestByPlatform(detectPlatform());
  } catch (error) {
    console.warn("通知の許可を確認できませんでした", error);
    return false;
  }
};

/**
 * 帰ってきたことを知らせる。帰る時刻は画面に渡されないので、帰ってきたのを確認した時点で出す。
 * ブラウザではタブを開いている間だけ届く。
 */
export const notifyReturn = async (fainted: boolean): Promise<void> => {
  const title = fainted ? "ボロボロで帰ってきた…" : "無事に帰ってきた！";
  const body = "冒険の報告を見てみましょう。";
  try {
    const platform = detectPlatform();
    if (platform === "native") {
      await LocalNotifications.schedule({ notifications: [{ id: 1, title, body }] });
      return;
    }
    if (platform === "tauri") {
      sendNotification({ title, body });
      return;
    }
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch (error) {
    console.warn("通知を出せませんでした", error);
  }
};
