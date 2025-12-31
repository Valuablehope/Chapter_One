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

  // Sync pending sales - wrapped in useCallback with stable dependencies
  const syncPendingSales = useCallback(async () => {
    // Use functional state update to avoid dependency on isSyncing
    setIsSyncing((current) => {
      if (current) {
        return current; // Already syncing
      }
      return true;
    });

    try {
      const pending = await offlineQueue.getPendingSales();
      if (pending.length === 0) {
        setIsSyncing(false);
        return; // Nothing to sync
      }

      const result = await offlineQueue.syncPendingSales(async (saleData, clientSaleId) => {
        // Attempt to create sale via API with client sale ID for conflict resolution
        return await saleService.createSale(saleData, clientSaleId);
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
      setIsSyncing(false);
    }
  }, []); // Empty deps - function doesn't depend on state

  // Monitor online/offline status and visibility changes (sleep/wake)
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

    // Handle visibility change (app wake from sleep, tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        logger.info('App became visible, checking for pending sales...');
        // Small delay to ensure connection is stable after wake
        setTimeout(() => {
          syncPendingSales();
        }, 2000);
      }
    };

    // Handle Electron app ready event (wake from sleep)
    const handleAppReady = () => {
      if (navigator.onLine) {
        logger.info('App ready after wake, checking for pending sales...');
        setTimeout(() => {
          syncPendingSales();
        }, 2000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for Electron app ready event
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.on('app:ready', handleAppReady);
    }

    // Initial sync check
    if (navigator.onLine) {
      syncPendingSales();
    }

    // Initial pending count
    updatePendingCount();

    // Periodic sync check (every 60 seconds when online - reduced frequency)
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncPendingSales();
      }
    }, 60000); // Changed from 30s to 60s

    // Update pending count periodically (every 30 seconds - reduced frequency)
    const countInterval = setInterval(() => {
      updatePendingCount();
    }, 30000); // Changed from 5s to 30s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Remove Electron event listener
      if (window.electronAPI?.ipcRenderer) {
        window.electronAPI.ipcRenderer.removeListener('app:ready', handleAppReady);
      }
      
      clearInterval(syncInterval);
      clearInterval(countInterval);
    };
  }, [syncPendingSales, updatePendingCount]); // Now stable references

  return {
    pendingCount,
    isOnline,
    isSyncing,
    syncPendingSales,
    updatePendingCount,
  };
}

