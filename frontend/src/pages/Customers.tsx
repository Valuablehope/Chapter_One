import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { customerService, Customer, CustomerFilters } from '../services/customerService';
import { useCancellableRequest } from '../hooks/useCancellableRequest';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import { TableSkeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { CustomerRow } from './Customers/components/CustomerRow';
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CustomerFilters>({
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getSignal } = useCancellableRequest();

  const loadCustomers = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const response = await customerService.getCustomers(filters, signal);
      // Check if request was cancelled
      if (signal.aborted) return;
      setCustomers(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      toast.error(err.response?.data?.error?.message || 'Failed to load customers');
      logger.error('Error loading customers:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Load customers when filters change
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

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
    setEditingCustomer(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      notes: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      notes: '',
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name?.trim()) {
      errors.full_name = 'Full name is required';
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
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.customer_id, formData);
      } else {
        await customerService.createCustomer(formData);
      }
      closeModal();
      toast.success(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
      loadCustomers();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to save customer';
      toast.error(errorMessage);
      console.error('Error saving customer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${customer.full_name || 'this customer'}?`
      )
    ) {
      return;
    }

    try {
      await customerService.deleteCustomer(customer.customer_id);
      toast.success('Customer deleted successfully');
      loadCustomers();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to delete customer';
      toast.error(errorMessage);
      console.error('Error deleting customer:', err);
    }
  };

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <UserGroupIcon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold">Customers</h1>
                <p className="text-sky-50 text-sm mt-1">Manage your customer database and relationships</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-white !text-blue-700 hover:bg-sky-50 font-semibold shadow-lg hover:shadow-xl transition-all"
            leftIcon={<PlusIcon className="w-5 h-5 !text-blue-700" />}
          >
            Add Customer
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
                  placeholder="Search by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-white font-medium"
                />
              </div>
            </div>
            <button
              onClick={loadCustomers}
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-sky-600 transition-colors px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-sky-300"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="primary" size="sm">{pagination.total} Customers</Badge>
            {searchQuery && (
              <Badge variant="info" size="sm">
                Filtered: {customers.length} results
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Customers Table */}
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
          <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-8">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : customers.length === 0 ? (
            <div className="px-6 py-16">
              <EmptyState
                icon={<UserGroupIcon className="w-16 h-16" />}
                title="No customers found"
                description={searchQuery ? "Try adjusting your search" : "Get started by adding your first customer"}
                action={
                  !searchQuery && (
                    <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-5 h-5" />} variant="primary">
                      Add Customer
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer, index) => (
                  <CustomerRow
                    key={customer.customer_id}
                    customer={customer}
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
              <span className="font-bold text-gray-900">{pagination.total}</span> customers
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
            <div className="p-2 bg-gradient-to-br from-sky-500 to-blue-500 rounded-lg">
              <UserGroupIcon className="w-5 h-5 text-white" />
            </div>
            <span>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</span>
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
              form="customer-form"
              className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <UserGroupIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.CUSTOMER_NAME_MAX_LENGTH) {
                    setFormData({ ...formData, full_name: value });
                  }
                }}
                placeholder="Enter full name"
                required
                maxLength={INPUT_LIMITS.CUSTOMER_NAME_MAX_LENGTH}
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-white font-medium ${
                  formErrors.full_name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {formErrors.full_name && (
              <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>
            )}
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
                maxLength={INPUT_LIMITS.PHONE_MAX_LENGTH}
                placeholder="Enter phone number"
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-white font-medium"
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
                maxLength={INPUT_LIMITS.EMAIL_MAX_LENGTH}
                placeholder="Enter email address"
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-white font-medium ${
                  formErrors.email ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes
            </label>
            <div className="relative">
              <DocumentTextIcon className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none transition-all bg-white font-medium"
                placeholder="Additional notes about this customer..."
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

