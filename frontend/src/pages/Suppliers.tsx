import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { supplierService, Supplier, SupplierFilters } from '../services/supplierService';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import { TableSkeleton } from '../components/ui/Skeleton';
import PageBanner from '../components/ui/PageBanner';
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
import { useTranslation } from '../i18n/I18nContext';

export default function Suppliers() {
  const { t } = useTranslation();
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
      toast.error(err.response?.data?.error?.message || t('suppliers.errors.load_suppliers'));
      logger.error('Error loading suppliers:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, t]);

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
      errors.name = t('suppliers.validation.name_required');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('suppliers.validation.email_invalid');
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
      toast.success(editingSupplier ? t('suppliers.success.supplier_updated') : t('suppliers.success.supplier_created'));
      loadSuppliers();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('suppliers.errors.timeout'));
      } else {
        const errorMessage =
          err.response?.data?.error?.message || t('suppliers.errors.save_supplier');
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
        t('suppliers.confirm.delete_supplier', { name: supplier.name })
      )
    ) {
      return;
    }

    try {
      await supplierService.deleteSupplier(supplier.supplier_id);
      toast.success(t('suppliers.success.supplier_deleted'));
      loadSuppliers();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('suppliers.errors.timeout'));
      } else {
        const errorMessage =
          err.response?.data?.error?.message || t('suppliers.errors.delete_supplier');
        toast.error(errorMessage);
      }
      console.error('Error deleting supplier:', err);
    }
  };

  return (
    <>
      <PageBanner
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        icon={<BuildingOfficeIcon className="w-5 h-5 text-white" />}
        action={
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold"
            leftIcon={<PlusIcon className="w-4 h-4" />}
          >
            {t('suppliers.actions.add_supplier')}
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
                  placeholder={t('suppliers.filters.search_placeholder')}
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
              <span>{t('suppliers.actions.refresh')}</span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="primary" size="sm">{t('suppliers.filters.suppliers_count', { count: pagination.total })}</Badge>
            {searchQuery && (
              <Badge variant="info" size="sm">
                {t('suppliers.filters.filtered_results', { count: suppliers.length })}
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
                  title={t('suppliers.empty.title')}
                  description={searchQuery ? t('suppliers.empty.filtered_description') : t('suppliers.empty.default_description')}
                  action={
                    !searchQuery && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                        {t('suppliers.actions.add_supplier')}
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.name')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.contact_person')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.phone')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.email')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.created')}</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('suppliers.table.actions')}</th>
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
              {t('suppliers.pagination.showing')} <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> {t('suppliers.pagination.to')}{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> {t('suppliers.pagination.of')}{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> {t('suppliers.pagination.suppliers')}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                {t('suppliers.pagination.previous')}
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                {t('suppliers.pagination.page')} {pagination.page} {t('suppliers.pagination.of')} {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                variant="outline"
                size="sm"
              >
                {t('suppliers.pagination.next')}
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
            <span className="text-base">{editingSupplier ? t('suppliers.modal.edit_title') : t('suppliers.modal.add_title')}</span>
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
              {t('suppliers.actions.cancel')}
            </Button>
            <Button
              type="submit"
              form="supplier-form"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingSupplier ? t('suppliers.actions.update') : t('suppliers.actions.create')}
            </Button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t('suppliers.form.supplier_name')} <span className="text-red-500">*</span>
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
                placeholder={t('suppliers.form.supplier_name_placeholder')}
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
              {t('suppliers.form.contact_person')}
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
                placeholder={t('suppliers.form.contact_person_placeholder')}
                maxLength={INPUT_LIMITS.FULL_NAME_MAX_LENGTH}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t('suppliers.form.phone')}
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
                placeholder={t('suppliers.form.phone_placeholder')}
                maxLength={INPUT_LIMITS.PHONE_MAX_LENGTH}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t('suppliers.form.email')}
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
                placeholder={t('suppliers.form.email_placeholder')}
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

