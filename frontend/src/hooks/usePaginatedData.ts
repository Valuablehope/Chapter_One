import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useCancellableRequest } from './useCancellableRequest';
import { logger } from '../utils/logger';
import { DEBOUNCE_DELAY, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../config/constants';
import toast from 'react-hot-toast';

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationState;
}

/**
 * Generic hook for paginated data fetching
 * Handles loading, error states, pagination, and debounced search
 * 
 * @template T - The data type
 * @template F - The filters type (must extend base filters with page and limit)
 * @param fetchFunction - Function that fetches data with filters and optional signal
 * @param initialFilters - Initial filter values
 * @param errorMessage - Custom error message for failed fetches
 * @returns Object containing data, loading state, pagination, and handlers
 */
export function usePaginatedData<T, F extends { page?: number; limit?: number; search?: string }>(
  fetchFunction: (filters: F, signal?: AbortSignal) => Promise<PaginatedResponse<T>>,
  initialFilters: F,
  errorMessage: string = 'Failed to load data'
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<F>({
    ...initialFilters,
    page: initialFilters.page || DEFAULT_PAGE,
    limit: initialFilters.limit || DEFAULT_PAGE_SIZE,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const { getSignal } = useCancellableRequest();

  const loadData = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const response = await fetchFunction(filters, signal);
      
      // Check if request was cancelled
      if (signal.aborted) return;
      
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      toast.error(err.response?.data?.error?.message || errorMessage);
      logger.error(`Error loading data:`, err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, fetchFunction, errorMessage]);

  // Load data when filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: DEFAULT_PAGE }));
  }, DEBOUNCE_DELAY);

  const handleSearch = useCallback((search: string) => {
    // Update local state immediately for responsive UI
    setFilters(prev => ({ ...prev, search, page: DEFAULT_PAGE }));
    // Debounced update will trigger the actual API call
    debouncedSearch(search);
  }, [debouncedSearch]);

  const handleFilterChange = useCallback((key: keyof F, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: DEFAULT_PAGE }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    pagination,
    filters,
    setFilters,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    refresh,
  };
}


