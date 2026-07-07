// Cached try-on previews — stored on device only (IndexedDB), keyed by product + image.

import { openDB, STORES } from './idb.js';

function cacheKey(productId, imgIdx) {
  return `${productId}:${imgIdx}`;
}

function base64ToBlob(base64, mimeType) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function saveTryOnPreview({ productId, imgIdx, productImageUrl, imageBase64, mimeType }) {
  const blob = base64ToBlob(imageBase64, mimeType || 'image/jpeg');
  const record = {
    productId,
    imgIdx,
    productImageUrl,
    mimeType: mimeType || 'image/jpeg',
    blob,
    savedAt: Date.now(),
  };
  await openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.TRYON_PREVIEWS, 'readwrite');
        const req = tx.objectStore(STORES.TRYON_PREVIEWS).put(record, cacheKey(productId, imgIdx));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
  return blob;
}

export async function loadTryOnPreview(productId, imgIdx) {
  const record = await openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.TRYON_PREVIEWS, 'readonly');
        const req = tx.objectStore(STORES.TRYON_PREVIEWS).get(cacheKey(productId, imgIdx));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
  if (!record?.blob || !(record.blob instanceof Blob)) return null;
  return record;
}

export async function clearTryOnPreview(productId, imgIdx) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRYON_PREVIEWS, 'readwrite');
    const req = tx.objectStore(STORES.TRYON_PREVIEWS).delete(cacheKey(productId, imgIdx));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
