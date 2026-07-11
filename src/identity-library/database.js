import { err, ok } from '../domain/result.js';

export const DB_NAME = 'my-avatars';
export const DB_VERSION = 1;
export const STORE_NAMES = Object.freeze(['meta', 'photos', 'identities', 'recipes', 'drafts', 'artifacts']);

const faultFrom = (error, fallbackKind = 'storage-failed') => {
  const quota = error?.name === 'QuotaExceededError';
  return { kind: quota ? 'quota-exceeded' : error?.kind ?? fallbackKind, message: error?.message || 'Local storage failed.' };
};

export const requestResult = (request) => new Promise((resolve, reject) => {
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error), { once: true });
});

export const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.addEventListener('complete', () => resolve(), { once: true });
  transaction.addEventListener('abort', () => reject(transaction.error ?? new DOMException('Transaction aborted', 'AbortError')), { once: true });
  transaction.addEventListener('error', () => reject(transaction.error), { once: true });
});

export function applyMigrationWithBackup(transaction, backup, rewrite, validate) {
  const meta = transaction.objectStore('meta');
  meta.put({ key: 'migration-backup', value: structuredClone(backup) });
  rewrite();
  if (validate() !== true) throw new Error('Migration validation failed.');
  meta.delete('migration-backup');
}

export async function openDatabase({ indexedDB, name = DB_NAME, version = DB_VERSION, migrations = {} } = {}) {
  if (!indexedDB?.open) return err({ kind: 'storage-unavailable', message: 'IndexedDB is unavailable.', canContinueInMemory: true });
  return new Promise((resolve) => {
    let migrationError = null;
    let settled = false;
    const finish = (result) => {
      if (settled) { if (result.ok) result.value.close(); return; }
      settled = true; resolve(result);
    };
    let request;
    try { request = indexedDB.open(name, version); } catch (error) { finish(err(faultFrom(error, 'storage-unavailable'))); return; }
    request.addEventListener('upgradeneeded', (event) => {
      const db = request.result;
      const transaction = request.transaction;
      try {
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const keyPath = storeName === 'meta' ? 'key' : storeName === 'identities' ? 'revision' : storeName === 'photos' ? undefined : 'id';
            db.createObjectStore(storeName, keyPath ? { keyPath } : undefined);
          }
        }
        for (let next = Math.max(2, event.oldVersion + 1); next <= version; next += 1) migrations[next]?.({ db, transaction, oldVersion: event.oldVersion, newVersion: version });
      } catch (error) {
        migrationError = error;
        transaction.abort();
      }
    });
    request.addEventListener('success', () => { request.result.onversionchange = () => request.result.close(); finish(ok(request.result)); }, { once: true });
    request.addEventListener('error', () => finish(err(faultFrom(migrationError ?? request.error, migrationError ? 'migration-failed' : 'storage-failed'))), { once: true });
    request.addEventListener('blocked', () => finish(err({ kind: 'storage-blocked', message: 'Local storage upgrade is blocked.' })), { once: true });
  });
}

export async function runTransaction(db, stores, mode, operation) {
  let transaction;
  try {
    transaction = db.transaction(stores, mode);
    const completion = transactionDone(transaction);
    try {
      const value = await operation(transaction);
      await completion;
      return ok(value);
    } catch (error) {
      try { transaction.abort(); } catch {}
      try { await completion; } catch {}
      return err(faultFrom(error));
    }
  } catch (error) {
    return err(faultFrom(error));
  }
}
