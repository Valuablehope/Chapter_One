import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { supplierService, Supplier, SupplierFilters } from '../services/supplierService';
import { useCancellableRequest } from '../hooks/useCancellableRequest';
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
  const { getSignal } = useCancellableRequest();

  const loadSuppliers = useCallback(async () => {
    const signal = getSignal();
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
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to save supplier';
      toast.error(errorMessage);
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
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to delete supplier';
      toast.error(errorMessage);
      console.error('Error deleting supplier:', err);
    }
  };

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <BuildingOfficeIcon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Suppliers</h1>
                <p className="text-indigo-50 text-xs sm:text-sm mt-1">Manage your supplier database and relationships</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-white !text-indigo-700 hover:bg-indigo-50 font-semibold shadow-lg hover:shadow-xl transition-all"
            leftIcon={<PlusIcon className="w-5 h-5 !text-indigo-700" />}
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <Card className="mb-4 sm:mb-6 border-2 border-gray-100 shadow-lg">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name, contact person, phone, or email..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white font-medium"
                />
              </div>
            </div>
            <button
              onClick={loadSuppliers}
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-indigo-300"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="mt-4 flex items-center gap-2">
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
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
          <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-8">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="px-6 py-16">
              <EmptyState
                icon={<BuildingOfficeIcon className="w-16 h-16" />}
                title="No suppliers found"
                description={searchQuery ? "Try adjusting your search" : "Get started by adding your first supplier"}
                action={
                  !searchQuery && (
                    <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-5 h-5" />} variant="primary">
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
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
        <Card className="mt-4 sm:mt-6 border-2 border-gray-100">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 font-medium">
              Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> suppliers
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
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
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
              <BuildingOfficeIcon className="w-5 h-5 text-white" />
            </div>
            <span>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</span>
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
              className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingSupplier ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <BuildingOfficeIcon className="w-5 h-5" />
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
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white font-medium ${
                  formErrors.name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contact Person
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <UserIcon className="w-5 h-5" />
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
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <PhoneIcon className="w-5 h-5" />
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
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <EnvelopeIcon className="w-5 h-5" />
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
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white font-medium ${
                  formErrors.email ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

