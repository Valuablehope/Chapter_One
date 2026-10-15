/**
 * Shared IndexedDB open-with-recovery helper.
 *
 * A corrupted on-disk store (e.g. from an unclean shutdown/power loss on a
 * POS terminal) fails to open on every future launch unless deleted and
 * recreated. A disk-space failure needs a clear, actionable message instead —
 * deleting won't fix that, and would destroy whatever was already queued for
 * no benefit.
 */

import { logger } from './logger';

const LOW_DISK_SPACE_BYTES = 10 * 1024 * 1024; // 10MB

export async function getAvailableStorageBytes(): Promise<number | null> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return quota - used;
  } catch {
    return null;
  }
}

export function deleteIndexedDb(dbName: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(dbName);
    // Best-effort: proceed regardless of outcome. If another connection still
    // has it open, the retried open below will surface whatever the real,
    // current state is.
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/**
 * Opens an IndexedDB database, self-healing once from a corrupted on-disk
 * store, and raising a clear "low disk space" error instead of a raw
 * DOMException when that's actually the cause.
 */
export async function openWithRecovery(
  dbName: string,
  openOnce: () => Promise<IDBDatabase>
): Promise<IDBDatabase> {
  try {
    return await openOnce();
  } catch (err: any) {
    const available = await getAvailableStorageBytes();
    if (available !== null && available < LOW_DISK_SPACE_BYTES) {
      throw new Error(
        `Insufficient disk space (${Math.max(0, Math.round(available / (1024 * 1024)))}MB available) — free up space and restart the app.`
      );
    }

    logger.error(`IndexedDB "${dbName}" failed to open; recreating store`, { error: err?.message || String(err) });
    await deleteIndexedDb(dbName);
    return openOnce();
  }
}
