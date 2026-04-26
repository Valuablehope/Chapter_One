import { useEffect, useState, useCallback, useRef } from 'react';
import { offlineQueue } from '../services/offlineQueue';
import { saleService } from '../services/saleService';
import { stockService } from '../services/stockService';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

/**
 * Hook to manage offline sales sync
 * Automatically syncs queued sales when connection is restored
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ref mirrors pendingCount so the sync interval can read the current value
  // without needing pendingCount in the effect dependency array.
  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;

  // Ref-based guard prevents concurrent sync runs (setState is async, can't guard with it).
  const isSyncingRef = useRef(false);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      logger.error('Failed to get pending count', error);
    }
  }, []);

  // Sync pending sales - wrapped in useCallback with stable dependencies
  const syncPendingSales = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const pending = await offlineQueue.getPendingSales();
      if (pending.length === 0) {
        isSyncingRef.current = false;
        setIsSyncing(false);
        return; // Nothing to sync
      }

      const result = await offlineQueue.syncPendingSales(async (saleData, clientSaleId) => {
        // Re-validate stock from server before syncing to prevent overselling
        // This ensures cache is in sync with server state
        try {
          const productIds = saleData.items.map(item => item.product_id);
          await stockService.syncStockBalances(productIds);
          
          // Validate stock availability before syncing
          const stockBalances = await stockService.getStockBalances(productIds);
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
          // If stock validation fails, throw error to mark sale as failed
          if (error.message?.includes('Insufficient stock')) {
            logger.error('Stock validation failed during sync', { error: error.message, saleData });
            throw error;
          }
          // For other errors (e.g., network), log but allow sync to proceed
          // Backend will validate stock anyway
          logger.warn('Stock validation warning during sync', { error: error.message });
        }
        
        // Attempt to create sale via API with client sale ID for conflict resolution
        const sale = await saleService.createSale(saleData, clientSaleId);
        
        // Update stock cache ONLY after successful sync to prevent desync
        try {
          for (const item of saleData.items) {
            await stockService.updateStockBalance(item.product_id, -item.qty);
          }
        } catch (error) {
          // Log but don't fail - cache update is best effort
          // Sale is already created on server, so this is just cache maintenance
          logger.warn('Failed to update stock cache after sync', { error });
        }
        
        return sale;
      });

      if (result.success > 0) {
        toast.success(`Synced ${result.success} pending sale${result.success > 1 ? 's' : ''}`);
        logger.info(`Synced ${result.success} pending sales`);
      }

      if (result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} sale${result.failed > 1 ? 's' : ''}. Will retry later.`);
        logger.warn(`Failed to sync ${result.failed} sales`);
      }

      // Update pending count after sync
      try {
        const count = await offlineQueue.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        logger.error('Failed to get pending count', error);
      }
    } catch (error) {
      logger.error('Failed to sync pending sales', error);
      toast.error('Failed to sync pending sales. Will retry when connection is restored.');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []); // Empty deps - function doesn't depend on state

  // Monitor online/offline status and visibility changes (sleep/wake)
  useEffect(() => {
    // Track pending one-shot timeouts so they can be cancelled on unmount
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
    const scheduleOnce = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay);
      pendingTimeouts.push(id);
      return id;
    };

    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Connection restored, syncing pending sales and stock...');
      scheduleOnce(async () => {
        try {
          const pending = await offlineQueue.getPendingSales();
          const productIds = new Set<string>();
          pending.forEach(sale => {
            sale.saleData.items.forEach(item => productIds.add(item.product_id));
          });
          if (productIds.size > 0) {
            await stockService.syncStockBalances(Array.from(productIds));
          }
        } catch (error) {
          logger.warn('Failed to sync stock balances', error);
        }
        syncPendingSales();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Connection lost, sales will be queued');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        logger.info('App became visible, checking for pending sales...');
        scheduleOnce(() => syncPendingSales(), 2000);
      }
    };

    const handleAppReady = () => {
      if (navigator.onLine) {
        logger.info('App ready after wake, checking for pending sales...');
        scheduleOnce(() => syncPendingSales(), 2000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.on('app:ready', handleAppReady);
    }

    if (navigator.onLine) {
      syncPendingSales();
    }

    updatePendingCount();

    // Only run the periodic sync when there are actually pending sales to avoid
    // unnecessary IndexedDB reads on every interval tick.
    const syncInterval = setInterval(() => {
      if (navigator.onLine && pendingCount > 0) {
        syncPendingSales();
      }
    }, 60000);

    const countInterval = setInterval(() => {
      updatePendingCount();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (window.electronAPI?.ipcRenderer) {
        window.electronAPI.ipcRenderer.removeListener('app:ready', handleAppReady);
      }

      // Cancel any pending one-shot timeouts to prevent post-unmount state updates
      for (const id of pendingTimeouts) {
        clearTimeout(id);
      }

      clearInterval(syncInterval);
      clearInterval(countInterval);
    };
  }, [syncPendingSales, updatePendingCount, pendingCount]);

  return {
    pendingCount,
    isOnline,
    isSyncing,
    syncPendingSales,
    updatePendingCount,
  };
}

