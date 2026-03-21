import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { customerService, Customer, CustomerFilters } from '../services/customerService';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import { TableSkeleton } from '../components/ui/Skeleton';
import PageBanner from '../components/ui/PageBanner';
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
  const customerAbortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (customerAbortController.current) {
        customerAbortController.current.abort();
      }
    };
  }, []);

  const loadCustomers = useCallback(async () => {
    // Cancel previous request
    if (customerAbortController.current) {
      customerAbortController.current.abort();
    }

    // Create new controller
    customerAbortController.current = new AbortController();
    const signal = customerAbortController.current.signal;

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
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage =
          err.response?.data?.error?.message || 'Failed to save customer';
        toast.error(errorMessage);
      }
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
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage =
          err.response?.data?.error?.message || 'Failed to delete customer';
        toast.error(errorMessage);
      }
      console.error('Error deleting customer:', err);
    }
  };

  return (
    <>
      <PageBanner
        title="Customers"
        subtitle="Manage your customer database and relationships"
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        action={
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all"
            leftIcon={<PlusIcon className="w-4 h-4" />}
          >
            Add Customer
          </Button>
        }
      />

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
                  placeholder="Search by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                />
              </div>
            </div>
            <button
              onClick={loadCustomers}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-secondary-300"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
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
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={6} />
              </div>
            ) : customers.length === 0 ? (
              <div className="px-4 py-12">
                <EmptyState
                  icon={<UserGroupIcon className="w-12 h-12" />}
                  title="No customers found"
                  description={searchQuery ? "Try adjusting your search" : "Get started by adding your first customer"}
                  action={
                    !searchQuery && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
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
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Contact</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Created</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">Actions</th>
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
        <Card className="mt-3 border-2 border-gray-100">
          <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-xs text-gray-600 font-medium">
              Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> customers
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
              <UserGroupIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</span>
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
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <UserGroupIcon className="w-4 h-4" />
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
                className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium ${formErrors.full_name ? 'border-red-300' : 'border-gray-200'
                  }`}
              />
            </div>
            {formErrors.full_name && (
              <p className="mt-1 text-xs text-red-600">{formErrors.full_name}</p>
            )}
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
                maxLength={INPUT_LIMITS.PHONE_MAX_LENGTH}
                placeholder="Enter phone number"
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
                maxLength={INPUT_LIMITS.EMAIL_MAX_LENGTH}
                placeholder="Enter email address"
                className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium ${formErrors.email ? 'border-red-300' : 'border-gray-200'
                  }`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notes
            </label>
            <div className="relative">
              <DocumentTextIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 resize-none transition-all bg-white font-medium"
                placeholder="Additional notes about this customer..."
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

