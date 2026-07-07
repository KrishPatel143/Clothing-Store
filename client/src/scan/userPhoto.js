// User scan photo — stored only in the browser (IndexedDB), never on the server.

import { openDB, STORES, storeOp } from './idb.js';

const PHOTO_KEY = 'current';

export async function saveUserPhoto(blob) {
  await storeOp(STORES.USER_PHOTO, 'readwrite', PHOTO_KEY, blob);
}

export async function loadUserPhoto() {
  const blob = await storeOp(STORES.USER_PHOTO, 'readonly', PHOTO_KEY);
  return blob instanceof Blob ? blob : null;
}

export async function hasUserPhoto() {
  const blob = await loadUserPhoto();
  return blob !== null;
}

export async function clearUserPhoto() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.USER_PHOTO, 'readwrite');
    const req = tx.objectStore(STORES.USER_PHOTO).delete(PHOTO_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
