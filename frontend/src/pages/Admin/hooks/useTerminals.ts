import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { adminService, Terminal } from '../../../services/adminService';
import { logger } from '../../../utils/logger';
import { DEBOUNCE_DELAY, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../../config/constants';
import toast from 'react-hot-toast';

export interface TerminalFilters {
  page: number;
  limit: number;
  search: string;
  store_id: string;
}

export interface TerminalPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TerminalFormData {
  store_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

const initialFormData: TerminalFormData = {
  store_id: '',
  code: '',
  name: '',
  is_active: true,
};

export function useTerminals() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TerminalFilters>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    search: '',
    store_id: '',
  });
  const [pagination, setPagination] = useState<TerminalPagination>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [formData, setFormData] = useState<TerminalFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadTerminals = useCallback(async () => {
    try {
      setLoading(true);
      const apiFilters: { page: number; limit: number; search?: string; store_id?: string } = {
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.search) apiFilters.search = filters.search;
      if (filters.store_id) apiFilters.store_id = filters.store_id;
      
      const response = await adminService.getTerminals(apiFilters);
      setTerminals(response.data);
      setPagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load terminals');
      logger.error('Error loading terminals:', err);
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

  const handleStoreFilter = useCallback((store_id: string) => {
    setFilters(prev => ({ ...prev, store_id, page: DEFAULT_PAGE }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // Load terminals when filters change
  useEffect(() => {
    loadTerminals();
  }, [loadTerminals]);

  const openAddModal = useCallback(() => {
    setEditingTerminal(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((terminal: Terminal) => {
    setEditingTerminal(terminal);
    setFormData({
      store_id: terminal.store_id,
      code: terminal.code,
      name: terminal.name,
      is_active: terminal.is_active,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingTerminal(null);
    setFormData(initialFormData);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const errors: Record<string, string> = {};
    
    if (!formData.store_id) errors.store_id = 'Store is required';
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      if (editingTerminal) {
        await adminService.updateTerminal(editingTerminal.terminal_id, formData);
      } else {
        await adminService.createTerminal(formData);
      }
      closeModal();
      toast.success(editingTerminal ? 'Terminal updated successfully' : 'Terminal created successfully');
      loadTerminals();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save terminal');
      logger.error('Error saving terminal:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingTerminal, closeModal, loadTerminals]);

  const handleDelete = useCallback(async (terminal: Terminal) => {
    if (!window.confirm(`Delete terminal ${terminal.name}?`)) return;
    
    try {
      await adminService.deleteTerminal(terminal.terminal_id);
      toast.success('Terminal deleted successfully');
      loadTerminals();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to delete terminal');
      logger.error('Error deleting terminal:', err);
    }
  }, [loadTerminals]);

  return {
    terminals,
    loading,
    filters,
    pagination,
    showModal,
    editingTerminal,
    formData,
    formErrors,
    submitting,
    setFormData,
    handleSearch,
    handleStoreFilter,
    handlePageChange,
    openAddModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    refresh: loadTerminals,
  };
}



