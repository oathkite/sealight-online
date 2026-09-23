import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const TITLE = "探索が終わりました";
const BODY = "結果を確認して、次の行動を決めましょう。";
const NOTIFICATION_ID = 1;

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

/** 探索を始める前に呼び、通知の許可を取っておく（許可待ちの間に探索が進まないように） */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    return await requestByPlatform(detectPlatform());
  } catch (error) {
    console.warn("通知の許可を確認できませんでした", error);
    return false;
  }
};

/**
 * 探索の終了時刻に通知を出す。
 * スマホは OS のローカル通知（アプリが裏にあっても届く）、デスクトップとブラウザはプロセス内のタイマー。
 */
export const scheduleLampEndNotification = async (endsAt: number): Promise<void> => {
  const delay = endsAt - Date.now();
  if (delay <= 0) return;
  try {
    const platform = detectPlatform();
    if (platform === "native") {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      await LocalNotifications.schedule({
        notifications: [{ id: NOTIFICATION_ID, title: TITLE, body: BODY, schedule: { at: new Date(endsAt) } }],
      });
      return;
    }
    const send =
      platform === "tauri"
        ? () => sendNotification({ title: TITLE, body: BODY })
        : () => new Notification(TITLE, { body: BODY });
    window.setTimeout(send, delay);
  } catch (error) {
    console.warn("通知の予約に失敗しました", error);
  }
};
