import { useEffect, useState, useCallback } from 'react';
import { offlineQueue } from '../services/offlineQueue';
import { saleService } from '../services/saleService';
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

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      logger.error('Failed to get pending count', error);
    }
  }, []);

  // Sync pending sales
  const syncPendingSales = useCallback(async () => {
    if (isSyncing) {
      return; // Already syncing
    }

    const pending = await offlineQueue.getPendingSales();
    if (pending.length === 0) {
      return; // Nothing to sync
    }

    setIsSyncing(true);
    try {
      const result = await offlineQueue.syncPendingSales(async (saleData) => {
        // Attempt to create sale via API
        return await saleService.createSale(saleData);
      });

      if (result.success > 0) {
        toast.success(`Synced ${result.success} pending sale${result.success > 1 ? 's' : ''}`);
        logger.info(`Synced ${result.success} pending sales`);
      }

      if (result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} sale${result.failed > 1 ? 's' : ''}. Will retry later.`);
        logger.warn(`Failed to sync ${result.failed} sales`);
      }

      await updatePendingCount();
    } catch (error) {
      logger.error('Failed to sync pending sales', error);
      toast.error('Failed to sync pending sales. Will retry when connection is restored.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updatePendingCount]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Connection restored, syncing pending sales...');
      // Small delay to ensure connection is stable
      setTimeout(() => {
        syncPendingSales();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Connection lost, sales will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      syncPendingSales();
    }

    // Periodic sync check (every 30 seconds when online)
    const syncInterval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        syncPendingSales();
      }
    }, 30000);

    // Initial pending count
    updatePendingCount();

    // Update pending count periodically
    const countInterval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
      clearInterval(countInterval);
    };
  }, [syncPendingSales, isSyncing, updatePendingCount]);

  return {
    pendingCount,
    isOnline,
    isSyncing,
    syncPendingSales,
    updatePendingCount,
  };
}

