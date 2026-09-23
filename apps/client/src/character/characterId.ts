const STORAGE_KEY = "sealight.characterId";

/**
 * アカウントができるまでの仮のキャラ ID。初回に生成して端末に保存する。
 * localStorage は Capacitor、Tauri、ブラウザのいずれでも保持される。
 */
export const loadCharacterId = (): string => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、その場限りの ID で遊べるようにする
    return crypto.randomUUID();
  }
};
