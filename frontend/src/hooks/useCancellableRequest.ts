import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage request cancellation for unmounted components
 * Returns an AbortController that is automatically aborted when component unmounts
 */
export function useCancellableRequest() {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create new AbortController on mount
    abortControllerRef.current = new AbortController();

    // Cleanup: abort all pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getSignal = useCallback(() => {
    // Create new controller if current one was aborted
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current.signal;
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { getSignal, cancel };
}


