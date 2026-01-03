import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { adminService, Store } from '../../../services/adminService';
import { logger } from '../../../utils/logger';
import { DEBOUNCE_DELAY, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_TIMEZONE, DEFAULT_CURRENCY, DEFAULT_THEME, DEFAULT_PAPER_SIZE, DEFAULT_BACKUP_FREQUENCY, DEFAULT_LOW_STOCK_THRESHOLD } from '../../../config/constants';
import toast from 'react-hot-toast';

export interface StoreFilters {
  page: number;
  limit: number;
  search: string;
}

export interface StorePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StoreFormData {
  code: string;
  name: string;
  address: string;
  is_active: boolean;
  timezone: string;
  currency_code: string;
  tax_inclusive: boolean;
  theme: string;
  tax_rate: number;
  receipt_footer: string;
  receipt_header: string;
  auto_backup: boolean;
  backup_frequency: string;
  low_stock_threshold: number;
  show_stock: boolean;
  auto_add_qty: boolean;
  allow_negative: boolean;
  paper_size: string;
  auto_print: boolean;
}

const initialFormData: StoreFormData = {
  code: '',
  name: '',
  address: '',
  is_active: true,
  timezone: DEFAULT_TIMEZONE,
  currency_code: DEFAULT_CURRENCY,
  tax_inclusive: false,
  theme: DEFAULT_THEME,
  tax_rate: 0,
  receipt_footer: '',
  receipt_header: '',
  auto_backup: false,
  backup_frequency: DEFAULT_BACKUP_FREQUENCY,
  low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
  show_stock: true,
  auto_add_qty: true,
  allow_negative: false,
  paper_size: DEFAULT_PAPER_SIZE,
  auto_print: true,
};

export function useStores(onStoreChange?: () => void) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<StoreFilters>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    search: '',
  });
  const [pagination, setPagination] = useState<StorePagination>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      const apiFilters: { page: number; limit: number; search?: string } = {
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.search) apiFilters.search = filters.search;
      
      const response = await adminService.getStores(apiFilters);
      setStores(response.data);
      setPagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load stores');
      logger.error('Error loading stores:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced search
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: DEFAULT_PAGE }));
  }, DEBOUNCE_DELAY);

  const handleSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: DEFAULT_PAGE }));
    debouncedSearch(search);
  }, [debouncedSearch]);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // Load stores when filters change
  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const openAddModal = useCallback(() => {
    setEditingStore(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((store: Store) => {
    setEditingStore(store);
    setFormData({
      code: store.code || '',
      name: store.name || '',
      address: store.address || '',
      is_active: store.is_active ?? true,
      timezone: store.timezone || DEFAULT_TIMEZONE,
      currency_code: store.currency_code || DEFAULT_CURRENCY,
      tax_inclusive: store.tax_inclusive ?? false,
      theme: store.theme || DEFAULT_THEME,
      tax_rate: store.tax_rate ?? 0,
      receipt_footer: store.receipt_footer || '',
      receipt_header: store.receipt_header || '',
      auto_backup: store.auto_backup ?? false,
      backup_frequency: store.backup_frequency || DEFAULT_BACKUP_FREQUENCY,
      low_stock_threshold: store.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
      show_stock: store.show_stock ?? true,
      auto_add_qty: store.auto_add_qty ?? true,
      allow_negative: store.allow_negative ?? false,
      paper_size: store.paper_size || DEFAULT_PAPER_SIZE,
      auto_print: store.auto_print ?? true,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingStore(null);
    setFormData(initialFormData);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const errors: Record<string, string> = {};
    
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const storeData: {
        code: string;
        name: string;
        address?: string;
        timezone?: string;
        is_active: boolean;
        currency_code?: string;
        tax_inclusive: boolean;
        theme?: string;
        tax_rate?: number;
        receipt_footer?: string;
        receipt_header?: string;
        auto_backup: boolean;
        backup_frequency?: string;
        low_stock_threshold?: number;
        show_stock: boolean;
        auto_add_qty: boolean;
        allow_negative: boolean;
        paper_size?: string;
        auto_print: boolean;
      } = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        address: formData.address?.trim() || undefined,
        timezone: formData.timezone?.trim() || DEFAULT_TIMEZONE,
        is_active: formData.is_active,
        currency_code: formData.currency_code?.trim() || undefined,
        tax_inclusive: formData.tax_inclusive,
        theme: formData.theme || undefined,
        tax_rate: formData.tax_rate !== undefined ? formData.tax_rate : undefined,
        receipt_footer: formData.receipt_footer?.trim() || undefined,
        receipt_header: formData.receipt_header?.trim() || undefined,
        auto_backup: formData.auto_backup,
        backup_frequency: formData.backup_frequency || undefined,
        low_stock_threshold: formData.low_stock_threshold !== undefined ? formData.low_stock_threshold : undefined,
        show_stock: formData.show_stock,
        auto_add_qty: formData.auto_add_qty,
        allow_negative: formData.allow_negative,
        paper_size: formData.paper_size || undefined,
        auto_print: formData.auto_print,
      };

      if (editingStore) {
        await adminService.updateStore(editingStore.store_id, storeData);
      } else {
        await adminService.createStore(storeData);
      }
      closeModal();
      toast.success(editingStore ? 'Store updated successfully' : 'Store created successfully');
      loadStores();
      if (onStoreChange) onStoreChange();
    } catch (err: unknown) {
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to save store');
      }
      logger.error('Error saving store:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingStore, closeModal, loadStores, onStoreChange]);

  const handleDelete = useCallback(async (store: Store) => {
    if (!window.confirm(`Delete store ${store.name}?`)) return;
    
    try {
      await adminService.deleteStore(store.store_id);
      toast.success('Store deleted successfully');
      loadStores();
      if (onStoreChange) onStoreChange();
    } catch (err: unknown) {
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to delete store');
      }
      logger.error('Error deleting store:', err);
    }
  }, [loadStores, onStoreChange]);

  return {
    stores,
    loading,
    filters,
    pagination,
    showModal,
    editingStore,
    formData,
    formErrors,
    submitting,
    setFormData,
    handleSearch,
    handlePageChange,
    openAddModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    refresh: loadStores,
  };
}



