import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { supplierService, Supplier, SupplierFilters } from '../services/supplierService';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import { TableSkeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { SupplierRow } from './Suppliers/components/SupplierRow';
import {
  BuildingOfficeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SupplierFilters>({
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const supplierAbortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supplierAbortController.current) {
        supplierAbortController.current.abort();
      }
    };
  }, []);

  const loadSuppliers = useCallback(async () => {
    // Cancel previous request
    if (supplierAbortController.current) {
      supplierAbortController.current.abort();
    }

    // Create new controller
    supplierAbortController.current = new AbortController();
    const signal = supplierAbortController.current.signal;

    try {
      setLoading(true);
      const response = await supplierService.getSuppliers(filters, signal);

      // Check if request was cancelled
      if (signal.aborted) return;

      setSuppliers(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      toast.error(err.response?.data?.error?.message || 'Failed to load suppliers');
      logger.error('Error loading suppliers:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Load suppliers when filters change
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const handleSearch = useCallback((search: string) => {
    // Update local state immediately for responsive UI
    setSearchQuery(search);
    // Debounced update will trigger the actual API call
    debouncedSearch(search);
  }, [debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_name: '',
      phone: '',
      email: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_name: '',
      phone: '',
      email: '',
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Supplier name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        await supplierService.updateSupplier(editingSupplier.supplier_id, formData);
      } else {
        await supplierService.createSupplier(formData);
      }
      closeModal();
      toast.success(editingSupplier ? 'Supplier updated successfully' : 'Supplier created successfully');
      loadSuppliers();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage =
          err.response?.data?.error?.message || 'Failed to save supplier';
        toast.error(errorMessage);
      }
      console.error('Error saving supplier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${supplier.name}?`
      )
    ) {
      return;
    }

    try {
      await supplierService.deleteSupplier(supplier.supplier_id);
      toast.success('Supplier deleted successfully');
      loadSuppliers();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage =
          err.response?.data?.error?.message || 'Failed to delete supplier';
        toast.error(errorMessage);
      }
      console.error('Error deleting supplier:', err);
    }
  };

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-secondary-500 rounded-xl shadow-lg p-3 sm:p-4 mb-3 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <BuildingOfficeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold">Suppliers</h1>
                <p className="text-white/80 text-xs mt-0.5">Manage your supplier database and relationships</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-white !text-secondary-500 hover:bg-gray-50 font-semibold shadow-md hover:shadow-lg transition-all"
            leftIcon={<PlusIcon className="w-4 h-4 !text-secondary-500" />}
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <Card className="mb-3 border-2 border-gray-100 shadow-md">
        <div className="p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name, contact person, phone, or email..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                />
              </div>
            </div>
            <button
              onClick={loadSuppliers}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-secondary-300"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="primary" size="sm">{pagination.total} Suppliers</Badge>
            {searchQuery && (
              <Badge variant="info" size="sm">
                Filtered: {suppliers.length} results
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Suppliers Table */}
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={6} />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="px-4 py-12">
                <EmptyState
                  icon={<BuildingOfficeIcon className="w-12 h-12" />}
                  title="No suppliers found"
                  description={searchQuery ? "Try adjusting your search" : "Get started by adding your first supplier"}
                  action={
                    !searchQuery && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                        Add Supplier
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Contact Person</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Created</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {suppliers.map((supplier, index) => (
                    <SupplierRow
                      key={supplier.supplier_id}
                      supplier={supplier}
                      index={index}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Enhanced Pagination */}
      {pagination.totalPages > 1 && (
        <Card className="mt-3 border-2 border-gray-100">
          <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-xs text-gray-600 font-medium">
              Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> suppliers
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Enhanced Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <BuildingOfficeIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={closeModal}
              variant="outline"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="supplier-form"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingSupplier ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <BuildingOfficeIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.CUSTOMER_NAME_MAX_LENGTH) {
                    setFormData({ ...formData, name: value });
                  }
                }}
                placeholder="Enter supplier name"
                required
                maxLength={INPUT_LIMITS.CUSTOMER_NAME_MAX_LENGTH}
                className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium ${formErrors.name ? 'border-red-300' : 'border-gray-200'
                  }`}
              />
            </div>
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Contact Person
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.FULL_NAME_MAX_LENGTH) {
                    setFormData({ ...formData, contact_name: value });
                  }
                }}
                placeholder="Enter contact person name"
                maxLength={INPUT_LIMITS.FULL_NAME_MAX_LENGTH}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Phone
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <PhoneIcon className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.PHONE_MAX_LENGTH) {
                    setFormData({ ...formData, phone: value });
                  }
                }}
                placeholder="Enter phone number"
                maxLength={INPUT_LIMITS.PHONE_MAX_LENGTH}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <EnvelopeIcon className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.EMAIL_MAX_LENGTH) {
                    setFormData({ ...formData, email: value });
                  }
                }}
                placeholder="Enter email address"
                maxLength={INPUT_LIMITS.EMAIL_MAX_LENGTH}
                className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium ${formErrors.email ? 'border-red-300' : 'border-gray-200'
                  }`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

