/**
 * Offline Queue Service
 * Manages queued sales operations when network is unavailable
 * Uses IndexedDB for persistent storage
 */

import { stockService } from './stockService';
import { logger } from '../utils/logger';
import { PaymentMethod } from './saleService';

export interface QueuedSale {
  id: string;
  clientSaleId: string; // Unique client-side sale ID for conflict resolution
  saleData: {
    customer_id?: string;
    items: Array<{
      product_id: string;
      qty: number;
      unit_price: number;
      tax_rate?: number;
    }>;
    payments: Array<{
      method: PaymentMethod;
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
const MAX_QUEUE_SIZE = 1000; // Maximum number of queued sales
const QUEUE_WARNING_THRESHOLD = 0.8; // Warn when queue is 80% full

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
          store.createIndex('clientSaleId', 'clientSaleId', { unique: true }); // Unique index for conflict detection
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Generate a unique client-side sale ID (UUID v4)
   */
  private generateClientSaleId(): string {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get current queue size
   */
  private async getQueueSize(): Promise<number> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get queue size'));
      };
    });
  }

  /**
   * Evict oldest sales when queue is full (FIFO)
   */
  private async evictOldestSales(count: number): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'next'); // Oldest first

      let evicted = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && evicted < count) {
          cursor.delete();
          evicted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to evict old sales'));
      };
    });
  }

  /**
   * Check IndexedDB quota and available space
   */
  private async checkQuota(): Promise<{ available: boolean; reason?: string }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = quota - used;
        
        // Warn if less than 10MB available
        if (available < 10 * 1024 * 1024) {
          return { available: false, reason: 'Insufficient disk space (less than 10MB available)' };
        }
        return { available: true };
      } catch (error) {
        // If quota check fails, allow enqueueing (graceful degradation)
        return { available: true };
      }
    }
    return { available: true };
  }

  /**
   * Enqueue a sale for offline sync
   * @param saleData The sale data to queue
   * @param clientSaleId Optional client-side sale ID (for conflict resolution). If not provided, one will be generated.
   */
  async enqueueSale(saleData: QueuedSale['saleData'], clientSaleId?: string): Promise<string> {
    await this.init();

    // Validate stock availability before enqueueing (using cached stock balances)
    try {
      const productIds = saleData.items.map(item => item.product_id);
      const stockBalances = await stockService.getStockBalances(productIds);
      
      // Check each item for sufficient stock
      for (const item of saleData.items) {
        const balance = stockBalances.find(b => b.product_id === item.product_id);
        const availableStock = balance?.qty_on_hand || 0;
        
        if (availableStock < item.qty) {
          throw new Error(
            `Insufficient stock for product ${item.product_id}. Available: ${availableStock}, Requested: ${item.qty}`
          );
        }
      }
    } catch (error: any) {
      // If stock validation fails, reject the sale
      if (error.message?.includes('Insufficient stock')) {
        logger.error('Stock validation failed for offline sale', { error: error.message, saleData });
        throw error;
      }
      // For other errors (e.g., cache issues), log but allow enqueueing
      // The backend will validate stock when syncing
      logger.warn('Stock validation warning (allowing enqueue)', { error: error.message });
    }

    // Check queue size
    const currentSize = await this.getQueueSize();
    
    // Evict oldest sales if queue is full
    if (currentSize >= MAX_QUEUE_SIZE) {
      const evictCount = currentSize - MAX_QUEUE_SIZE + 1;
      await this.evictOldestSales(evictCount);
    }

    // Check if queue is approaching limit
    const newSize = await this.getQueueSize();
    if (newSize >= MAX_QUEUE_SIZE * QUEUE_WARNING_THRESHOLD) {
      console.warn(`Offline queue is ${Math.round((newSize / MAX_QUEUE_SIZE) * 100)}% full. Consider syncing sales.`);
    }

    // Check disk quota
    const quotaCheck = await this.checkQuota();
    if (!quotaCheck.available) {
      throw new Error(quotaCheck.reason || 'Insufficient disk space to queue sale');
    }

    const id = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedSale: QueuedSale = {
      id,
      clientSaleId: clientSaleId || this.generateClientSaleId(),
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
        // DO NOT update stock cache optimistically when enqueueing
        // Cache will be updated only after successful sync to prevent desync
        // This prevents overselling if sync fails
        resolve(id);
      };

      request.onerror = (event: any) => {
        // Check if error is due to quota exceeded
        if (event.target?.error?.name === 'QuotaExceededError') {
          reject(new Error('Disk quota exceeded. Please free up space and try again.'));
        } else {
          reject(new Error('Failed to queue sale'));
        }
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
   * Sync all pending sales with conflict resolution
   */
  async syncPendingSales(
    syncFn: (saleData: QueuedSale['saleData'], clientSaleId: string) => Promise<any>
  ): Promise<{ success: number; failed: number }> {
    const pending = await this.getPendingSales();
    let success = 0;
    let failed = 0;

    for (const sale of pending) {
      try {
        // Mark as syncing
        await this.updateSaleStatus(sale.id, 'syncing', sale.retryCount + 1);

        // Attempt sync with client sale ID for conflict resolution
        await syncFn(sale.saleData, sale.clientSaleId);

        // Mark as synced and remove
        await this.removeSale(sale.id);
        success++;
      } catch (error: any) {
        // Check if error is due to duplicate (409 Conflict or specific error message)
        if (error.response?.status === 409 || 
            error.response?.data?.error?.message?.includes('duplicate') ||
            error.response?.data?.error?.message?.includes('already exists')) {
          // Duplicate sale - remove from queue (already synced)
          logger.info(`Duplicate sale detected: ${sale.clientSaleId}, removing from queue`);
          await this.removeSale(sale.id);
          success++;
        } else {
          // Mark as failed (will retry on next sync)
          await this.updateSaleStatus(sale.id, 'failed', sale.retryCount + 1);
          failed++;
        }
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

