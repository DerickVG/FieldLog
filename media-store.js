const DB_NAME = 'fieldlog-media-v1';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

function requestResult(request) {
  return new Promise(function(resolve,reject) {
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error || new Error('Storage request failed.')); };
  });
}

function transactionDone(transaction) {
  return new Promise(function(resolve,reject) {
    transaction.oncomplete = function() { resolve(); };
    transaction.onerror = function() { reject(transaction.error || new Error('Storage transaction failed.')); };
    transaction.onabort = function() { reject(transaction.error || new Error('Storage transaction was cancelled.')); };
  });
}

export function openMediaStore() {
  return new Promise(function(resolve,reject) {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available on this device.'));
    const request = indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded = function() {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{ keyPath:'id' });
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error || new Error('Could not open photo storage.')); };
  });
}

export function dataUrlBytes(value) {
  if (!value || typeof value !== 'string') return 0;
  const comma = value.indexOf(',');
  const body = comma >= 0 ? value.slice(comma+1) : value;
  return Math.ceil(body.length*3/4);
}

export function photoBytes(photo) {
  return dataUrlBytes(photo && photo.uri) + (photo && photo.baseUri && photo.baseUri !== photo.uri ? dataUrlBytes(photo.baseUri) : 0) + JSON.stringify(photo && photo.markup || []).length;
}

export async function savePhotoMedia(photo) {
  if (!photo || !photo.id || !photo.uri) throw new Error('Photo data is incomplete.');
  const db = await openMediaStore();
  const transaction = db.transaction(STORE_NAME,'readwrite');
  transaction.objectStore(STORE_NAME).put({
    id:photo.id,
    uri:photo.uri,
    baseUri:photo.baseUri || '',
    markup:photo.markup || [],
    bytes:photoBytes(photo),
    updatedAt:new Date().toISOString()
  });
  await transactionDone(transaction);
  db.close();
  photo.stored = true;
  photo._mediaStored = true;
  photo.bytes = photoBytes(photo);
  return photo;
}

export async function loadPhotoMedia(id) {
  const db = await openMediaStore();
  const transaction = db.transaction(STORE_NAME,'readonly');
  const result = await requestResult(transaction.objectStore(STORE_NAME).get(id));
  db.close();
  return result || null;
}

export async function deletePhotoMedia(id) {
  const db = await openMediaStore();
  const transaction = db.transaction(STORE_NAME,'readwrite');
  transaction.objectStore(STORE_NAME).delete(id);
  await transactionDone(transaction);
  db.close();
}

export async function clearPhotoMedia() {
  const db = await openMediaStore();
  const transaction = db.transaction(STORE_NAME,'readwrite');
  transaction.objectStore(STORE_NAME).clear();
  await transactionDone(transaction);
  db.close();
}

export async function hydratePhotoMedia(data) {
  let migrated = 0;
  let loaded = 0;
  let missing = 0;
  const reports = Object.values(data.reports || {});
  for (const report of reports) {
    for (const photo of report.photos || []) {
      if (photo.uri) {
        await savePhotoMedia(photo);
        migrated += 1;
        continue;
      }
      if (photo.stored || photo._mediaStored) {
        const media = await loadPhotoMedia(photo.id);
        if (media && media.uri) {
          photo.uri = media.uri;
          photo.baseUri = media.baseUri || '';
          photo.markup = media.markup || [];
          photo.bytes = media.bytes || photoBytes(photo);
          photo.stored = true;
          photo._mediaStored = true;
          loaded += 1;
        } else {
          photo.missing = true;
          missing += 1;
        }
      }
    }
  }
  return { migrated:migrated, loaded:loaded, missing:missing };
}

export async function storageEstimate(data) {
  let estimate = {};
  if (navigator.storage && navigator.storage.estimate) {
    try { estimate = await navigator.storage.estimate(); } catch {}
  }
  let persistent = false;
  if (navigator.storage && navigator.storage.persisted) {
    try { persistent = await navigator.storage.persisted(); } catch {}
  }
  const photos = Object.values(data.reports || {}).reduce(function(total,report) { return total+(report.photos || []).length; },0);
  const photoUsage = Object.values(data.reports || {}).reduce(function(total,report) {
    return total+(report.photos || []).reduce(function(sum,photo) { return sum+(photo.bytes || photoBytes(photo)); },0);
  },0);
  const usage = Number(estimate.usage || photoUsage || 0);
  const quota = Number(estimate.quota || 0);
  return {
    usage:usage,
    quota:quota,
    available:quota ? Math.max(0,quota-usage) : 0,
    percent:quota ? usage/quota*100 : 0,
    photos:photos,
    photoUsage:photoUsage,
    persistent:persistent,
    supported:Boolean(navigator.storage && navigator.storage.estimate)
  };
}

export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

export function buildBackup(data) {
  const copy = JSON.parse(JSON.stringify(data));
  Object.values(copy.reports || {}).forEach(function(report) {
    (report.photos || []).forEach(function(photo) {
      delete photo._mediaStored;
      delete photo.stored;
      delete photo.bytes;
      delete photo.missing;
    });
  });
  return {
    format:'FieldLog Backup',
    version:1,
    createdAt:new Date().toISOString(),
    data:copy
  };
}

export async function restoreBackup(backup) {
  if (!backup || backup.format !== 'FieldLog Backup' || !backup.data || !backup.data.reports) throw new Error('This is not a valid FieldLog backup.');
  await clearPhotoMedia();
  for (const report of Object.values(backup.data.reports || {})) {
    for (const photo of report.photos || []) {
      if (photo.uri) await savePhotoMedia(photo);
    }
  }
  return backup.data;
}
