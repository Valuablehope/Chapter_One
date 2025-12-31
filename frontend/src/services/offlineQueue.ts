/**
 * Offline Queue Service
 * Manages queued sales operations when network is unavailable
 * Uses IndexedDB for persistent storage
 */

export interface QueuedSale {
  id: string;
  saleData: {
    customer_id?: string;
    items: Array<{
      product_id: string;
      qty: number;
      unit_price: number;
      tax_rate?: number;
    }>;
    payments: Array<{
      method: string;
      amount: number;
    }>;
  };
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

const DB_NAME = 'pos_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'sales_queue';

export class OfflineQueue {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Enqueue a sale for offline sync
   */
  async enqueueSale(saleData: QueuedSale['saleData']): Promise<string> {
    await this.init();

    const id = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedSale: QueuedSale = {
      id,
      saleData,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedSale);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error('Failed to queue sale'));
      };
    });
  }

  /**
   * Get all pending sales
   */
  async getPendingSales(): Promise<QueuedSale[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get pending sales'));
      };
    });
  }

  /**
   * Get count of pending sales
   */
  async getPendingCount(): Promise<number> {
    const pending = await this.getPendingSales();
    return pending.length;
  }

  /**
   * Update sale status
   */
  private async updateSaleStatus(id: string, status: QueuedSale['status'], retryCount?: number): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const sale = getRequest.result;
        if (!sale) {
          reject(new Error('Sale not found'));
          return;
        }

        sale.status = status;
        if (retryCount !== undefined) {
          sale.retryCount = retryCount;
        }

        const updateRequest = store.put(sale);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to update sale'));
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get sale'));
      };
    });
  }

  /**
   * Remove synced sale from queue
   */
  async removeSale(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to remove sale'));
      };
    });
  }

  /**
   * Sync all pending sales
   */
  async syncPendingSales(
    syncFn: (saleData: QueuedSale['saleData']) => Promise<any>
  ): Promise<{ success: number; failed: number }> {
    const pending = await this.getPendingSales();
    let success = 0;
    let failed = 0;

    for (const sale of pending) {
      try {
        // Mark as syncing
        await this.updateSaleStatus(sale.id, 'syncing', sale.retryCount + 1);

        // Attempt sync
        await syncFn(sale.saleData);

        // Mark as synced and remove
        await this.removeSale(sale.id);
        success++;
      } catch (error) {
        // Mark as failed (will retry on next sync)
        await this.updateSaleStatus(sale.id, 'failed', sale.retryCount + 1);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Clear all synced sales (cleanup)
   */
  async clearSyncedSales(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.openCursor('synced');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to clear synced sales'));
      };
    });
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

