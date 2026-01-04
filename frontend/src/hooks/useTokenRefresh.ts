import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

/**
 * Hook to automatically refresh JWT token before expiry
 * Refreshes token every 12 hours to support long-running sessions (8-12 hours/day)
 */
export function useTokenRefresh() {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user) {
      return; // No user, don't set up refresh
    }

    // Refresh token every 12 hours (43200000 ms)
    // This ensures token stays valid for long sessions without re-login
    // Token is now in httpOnly cookie, so we just need to call refresh endpoint
    const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

    const refreshToken = async () => {
      if (isRefreshingRef.current) {
        return; // Already refreshing, skip
      }

      try {
        isRefreshingRef.current = true;
        const response = await authService.refreshToken();

        // Update user info and token in store
        const currentUser = useAuthStore.getState().user;
        useAuthStore.getState().login({
          userId: response.data.user.userId,
          username: response.data.user.username,
          fullName: currentUser?.fullName || response.data.user.username,
          role: response.data.user.role as 'cashier' | 'manager' | 'admin',
        }, response.data.token);

        logger.info('Token refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh token', error);
        // If refresh fails, user will be logged out on next 401
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // Set up interval to refresh token
    refreshIntervalRef.current = setInterval(refreshToken, REFRESH_INTERVAL_MS);

    // Also refresh immediately if token is close to expiry (optional - can be removed if not needed)
    // For now, we'll just rely on the interval

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []); // Run once on mount

  return null;
}

