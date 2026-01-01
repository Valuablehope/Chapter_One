/**
 * Stock Service
 * Manages stock balance caching in IndexedDB for offline support
 * Syncs stock balances from API and validates stock availability
 */

import api from './api';
import { logger } from '../utils/logger';

export interface StockBalance {
  store_id: string;
  product_id: string;
  qty_on_hand: number;
  updated_at?: number; // Client-side timestamp for cache management
}

const DB_NAME = 'pos_stock_cache';
const DB_VERSION = 1;
const STORE_NAME = 'stock_balances';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

class StockService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB for stock cache
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
        reject(new Error('Failed to open stock cache database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'product_id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get stock balance for a product (from cache or API)
   */
  async getStockBalance(productId: string): Promise<StockBalance | null> {
    await this.init();

    // Try cache first
    const cached = await this.getFromCache(productId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // If cache miss or expired, fetch from API
    try {
      const balance = await this.fetchFromAPI(productId);
      if (balance) {
        await this.saveToCache(balance);
      }
      return balance;
    } catch (error) {
      // If API fails, return cached value even if expired (graceful degradation)
      if (cached) {
        logger.warn('API fetch failed, using expired cache', { productId, error });
        return cached;
      }
      throw error;
    }
  }

  /**
   * Get stock balances for multiple products (batch)
   */
  async getStockBalances(productIds: string[]): Promise<StockBalance[]> {
    await this.init();

    // Try cache first
    const cached = await Promise.all(
      productIds.map(id => this.getFromCache(id))
    );

    const validCached = cached.filter(
      (b): b is StockBalance => b !== null && this.isCacheValid(b)
    );

    // If all products are in cache and valid, return cached
    if (validCached.length === productIds.length) {
      return validCached;
    }

    // Fetch missing or expired from API
    const missingIds = productIds.filter(
      id => !validCached.find(b => b.product_id === id)
    );

    try {
      const apiBalances = await this.fetchBatchFromAPI(missingIds);
      
      // Save to cache
      await Promise.all(apiBalances.map(b => this.saveToCache(b)));

      // Combine cached and API results
      const allBalances: StockBalance[] = [...validCached];
      for (const apiBalance of apiBalances) {
        const existing = allBalances.find(b => b.product_id === apiBalance.product_id);
        if (!existing) {
          allBalances.push(apiBalance);
        }
      }

      // Fill in missing products with zero stock
      for (const productId of productIds) {
        if (!allBalances.find(b => b.product_id === productId)) {
          allBalances.push({
            store_id: '', // Will be set by API
            product_id: productId,
            qty_on_hand: 0,
            updated_at: Date.now(),
          });
        }
      }

      return allBalances;
    } catch (error) {
      // If API fails, return cached values even if expired
      logger.warn('Batch API fetch failed, using expired cache', { error });
      return validCached.length > 0 ? validCached : [];
    }
  }

  /**
   * Sync all stock balances from API (for offline support)
   */
  async syncStockBalances(productIds?: string[]): Promise<void> {
    await this.init();

    try {
      if (productIds && productIds.length > 0) {
        // Sync specific products
        const balances = await this.fetchBatchFromAPI(productIds);
        await Promise.all(balances.map(b => this.saveToCache(b)));
      } else {
        // Full sync - would need an endpoint that returns all stock balances
        // For now, we'll sync on-demand when products are accessed
        logger.info('Full stock sync not implemented, using on-demand sync');
      }
    } catch (error) {
      logger.error('Failed to sync stock balances', error);
      throw error;
    }
  }

  /**
   * Update stock balance in cache (after successful sale)
   */
  async updateStockBalance(productId: string, qtyChange: number): Promise<void> {
    await this.init();

    const cached = await this.getFromCache(productId);
    if (cached) {
      cached.qty_on_hand = Math.max(0, cached.qty_on_hand + qtyChange);
      cached.updated_at = Date.now();
      await this.saveToCache(cached);
    }
  }

  /**
   * Clear all cached stock balances
   */
  async clearCache(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear cache'));
    });
  }

  /**
   * Get stock balance from cache
   */
  private async getFromCache(productId: string): Promise<StockBalance | null> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(productId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null); // Graceful degradation
      };
    });
  }

  /**
   * Save stock balance to cache
   */
  private async saveToCache(balance: StockBalance): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      const balanceWithTimestamp: StockBalance = {
        ...balance,
        updated_at: Date.now(),
      };

      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(balanceWithTimestamp);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save to cache'));
    });
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(balance: StockBalance): boolean {
    if (!balance.updated_at) {
      return false;
    }
    return Date.now() - balance.updated_at < CACHE_TTL_MS;
  }

  /**
   * Fetch stock balance from API
   */
  private async fetchFromAPI(productId: string): Promise<StockBalance | null> {
    try {
      const response = await api.get<{ success: boolean; data: StockBalance }>(
        `/stock/${productId}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Product not found, return zero stock
        return {
          store_id: '',
          product_id: productId,
          qty_on_hand: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Fetch stock balances for multiple products from API (batch)
   */
  private async fetchBatchFromAPI(productIds: string[]): Promise<StockBalance[]> {
    try {
      const response = await api.post<{ success: boolean; data: StockBalance[] }>(
        '/stock/batch',
        { product_ids: productIds }
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch batch stock balances', error);
      throw error;
    }
  }
}

// Export singleton instance
export const stockService = new StockService();



