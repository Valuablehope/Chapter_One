import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { adminService, AppUser } from '../../../services/adminService';
import { logger } from '../../../utils/logger';
import { DEBOUNCE_DELAY, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../../config/constants';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';

export interface UserFilters {
  page: number;
  limit: number;
  search: string;
  role: 'cashier' | 'manager' | 'admin' | '';
}

export interface UserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useUsers() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserFilters>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    search: '',
    role: '',
  });
  const [pagination, setPagination] = useState<UserPagination>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'cashier' as 'cashier' | 'manager' | 'admin',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const apiFilters: { page: number; limit: number; search?: string; role?: 'cashier' | 'manager' | 'admin' } = {
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.search) apiFilters.search = filters.search;
      if (filters.role) apiFilters.role = filters.role as 'cashier' | 'manager' | 'admin';
      
      const response = await adminService.getUsers(apiFilters);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load users');
      logger.error('Error loading users:', err);
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

  const handleRoleFilter = useCallback((role: 'cashier' | 'manager' | 'admin' | '') => {
    setFilters(prev => ({ ...prev, role, page: DEFAULT_PAGE }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // Load users when filters change
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAddModal = useCallback(() => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      password: '',
      role: 'cashier',
      is_active: true,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((userToEdit: AppUser) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      full_name: userToEdit.full_name,
      password: '',
      role: userToEdit.role,
      is_active: userToEdit.is_active,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      password: '',
      role: 'cashier',
      is_active: true,
    });
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const errors: Record<string, string> = {};
    
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!editingUser && !formData.password) errors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        const updates: {
          full_name: string;
          role: 'cashier' | 'manager' | 'admin';
          is_active: boolean;
          password?: string;
        } = {
          full_name: formData.full_name,
          role: formData.role,
          is_active: formData.is_active,
        };
        if (formData.password) updates.password = formData.password;
        await adminService.updateUser(editingUser.user_id, updates);
      } else {
        await adminService.createUser(formData);
      }
      closeModal();
      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
      loadUsers();
    } catch (err: unknown) {
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to save user');
      }
      logger.error('Error saving user:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingUser, closeModal, loadUsers]);

  const handleDelete = useCallback(async (userToDelete: AppUser) => {
    if (userToDelete.user_id === user?.userId) {
      toast.error('Cannot delete your own account');
      return;
    }
    if (!window.confirm(`Delete user ${userToDelete.username}?`)) return;
    
    try {
      await adminService.deleteUser(userToDelete.user_id);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (err: unknown) {
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to delete user');
      }
      logger.error('Error deleting user:', err);
    }
  }, [user, loadUsers]);

  return {
    users,
    loading,
    filters,
    pagination,
    showModal,
    editingUser,
    formData,
    formErrors,
    submitting,
    setFormData,
    handleSearch,
    handleRoleFilter,
    handlePageChange,
    openAddModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    refresh: loadUsers,
  };
}



