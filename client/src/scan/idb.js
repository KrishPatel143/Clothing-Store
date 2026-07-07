// Shared IndexedDB for on-device scan photo and try-on previews.

export const DB_NAME = 'mira_store';
export const DB_VERSION = 2;

export const STORES = {
  USER_PHOTO: 'user_photo',
  TRYON_PREVIEWS: 'tryon_previews',
};

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.USER_PHOTO)) {
        db.createObjectStore(STORES.USER_PHOTO);
      }
      if (!db.objectStoreNames.contains(STORES.TRYON_PREVIEWS)) {
        db.createObjectStore(STORES.TRYON_PREVIEWS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function storeOp(storeName, mode, key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req =
          mode === 'readwrite' && value !== undefined ? store.put(value, key) : store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}
