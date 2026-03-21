import { memo, useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { adminService, Store } from '../../../services/adminService';
import { logger } from '../../../utils/logger';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  timezone: 'UTC',
  currency_code: 'USD',
  tax_inclusive: false,
  theme: 'classic',
  tax_rate: 0,
  receipt_footer: '',
  receipt_header: '',
  auto_backup: false,
  backup_frequency: 'daily',
  low_stock_threshold: 3,
  show_stock: true,
  auto_add_qty: true,
  allow_negative: false,
  paper_size: '80mm',
  auto_print: true,
};

function storeToFormData(s: Store): StoreFormData {
  return {
    code: s.code || '',
    name: s.name || '',
    address: s.address || '',
    is_active: s.is_active ?? true,
    timezone: s.timezone || 'UTC',
    currency_code: s.currency_code || 'USD',
    tax_inclusive: s.tax_inclusive ?? false,
    theme: s.theme || 'classic',
    tax_rate: s.tax_rate ?? 0,
    receipt_footer: s.receipt_footer || '',
    receipt_header: s.receipt_header || '',
    auto_backup: s.auto_backup ?? false,
    backup_frequency: s.backup_frequency || 'daily',
    low_stock_threshold: s.low_stock_threshold ?? 3,
    show_stock: s.show_stock ?? true,
    auto_add_qty: s.auto_add_qty ?? true,
    allow_negative: s.allow_negative ?? false,
    paper_size: s.paper_size || '80mm',
    auto_print: s.auto_print ?? true,
  };
}

export interface StoreModalProps {
  isOpen: boolean;
  editingStore: Store | null;
  onClose: () => void;
  onSaved: () => void;
}

function StoreModalComponent({ isOpen, editingStore, onClose, onSaved }: StoreModalProps) {
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingStore) {
      setFormData(storeToFormData(editingStore));
    } else {
      setFormData(initialFormData);
    }
    setFormErrors({});
  }, [isOpen, editingStore]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const storeData = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      address: formData.address?.trim() || undefined,
      timezone: formData.timezone?.trim() || 'UTC',
      is_active: formData.is_active,
      currency_code: formData.currency_code?.trim() || undefined,
      tax_inclusive: formData.tax_inclusive,
      theme: formData.theme || undefined,
      tax_rate: formData.tax_rate !== undefined ? formData.tax_rate : undefined,
      receipt_footer: formData.receipt_footer?.trim() || undefined,
      receipt_header: formData.receipt_header?.trim() || undefined,
      auto_backup: formData.auto_backup,
      backup_frequency: formData.backup_frequency || undefined,
      low_stock_threshold:
        formData.low_stock_threshold !== undefined ? formData.low_stock_threshold : undefined,
      show_stock: formData.show_stock,
      auto_add_qty: formData.auto_add_qty,
      allow_negative: formData.allow_negative,
      paper_size: formData.paper_size || undefined,
      auto_print: formData.auto_print,
    };

    setSubmitting(true);
    try {
      if (editingStore) {
        await adminService.updateStore(editingStore.store_id, storeData);
      } else {
        await adminService.createStore(storeData);
      }
      onClose();
      toast.success(editingStore ? 'Store updated successfully' : 'Store created successfully');
      onSaved();
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
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-secondary-500 rounded-lg">
            <BuildingStorefrontIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-base">{editingStore ? 'Edit Store' : 'Add Store'}</span>
        </div>
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" onClick={onClose} variant="outline" disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="store-form"
            className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            isLoading={submitting}
          >
            {editingStore ? 'Update' : 'Create'}
          </Button>
        </div>
      }
    >
      <form id="store-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Code <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <BuildingStorefrontIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={formData.code}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, code: e.target.value }))
              }
              required
              className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                formErrors.code ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {formErrors.code && <p className="mt-1 text-xs text-red-600">{formErrors.code}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <BuildingStorefrontIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              className={`w-full pl-10 pr-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                formErrors.name ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Address</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <MapPinIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={formData.address}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
            />
          </div>
        </div>

        <div className="flex items-center p-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
          />
          <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">
            Active
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <CogIcon className="w-4 h-4 text-white" />
            </div>
            Store Settings
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Currency Code</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <CurrencyDollarIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={formData.currency_code}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        currency_code: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="USD"
                    maxLength={3}
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">ISO currency code (e.g., USD, EUR, LBP)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Timezone</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <ClockIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, timezone: e.target.value }))
                    }
                    placeholder="Asia/Beirut"
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">IANA timezone (e.g., America/New_York, Asia/Beirut)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Default Tax Rate (%)</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <CurrencyDollarIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        tax_rate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">Default tax rate for products</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Low Stock Threshold</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <CogIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        low_stock_threshold: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">Alert when stock falls below this number</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Theme</label>
                <select
                  value={formData.theme}
                  onChange={(e) => setFormData((prev) => ({ ...prev, theme: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium h-[56px]"
                >
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                  <option value="quantum">Quantum</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Paper Size</label>
                <select
                  value={formData.paper_size}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paper_size: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium h-[56px]"
                >
                  <option value="80mm">80mm</option>
                  <option value="58mm">58mm</option>
                  <option value="A4">A4</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group h-[56px]">
                <input
                  type="checkbox"
                  checked={formData.tax_inclusive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tax_inclusive: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer flex-shrink-0 mt-0.5"
                />
                <div className="ml-2.5 flex-1 min-w-0">
                  <label className="text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer block">
                    Tax Inclusive Pricing
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">(Prices include tax)</p>
                </div>
              </div>
              <div className="flex items-center px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group h-[56px]">
                <input
                  type="checkbox"
                  checked={formData.show_stock}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, show_stock: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer flex-shrink-0"
                />
                <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer flex-1">
                  Show Stock Levels
                </label>
              </div>
              <div className="flex items-center px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group h-[56px]">
                <input
                  type="checkbox"
                  checked={formData.auto_add_qty}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, auto_add_qty: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer flex-shrink-0"
                />
                <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer flex-1">
                  Auto Add Quantity
                </label>
              </div>
              <div className="flex items-center px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group h-[56px]">
                <input
                  type="checkbox"
                  checked={formData.allow_negative}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, allow_negative: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer flex-shrink-0"
                />
                <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer flex-1">
                  Allow Negative Stock
                </label>
              </div>
              <div className="flex items-center px-3 py-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group h-[56px]">
                <input
                  type="checkbox"
                  checked={formData.auto_print}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, auto_print: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer flex-shrink-0"
                />
                <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer flex-1">
                  Auto Print Receipts
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Receipt Header</label>
                <textarea
                  value={formData.receipt_header}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, receipt_header: e.target.value }))
                  }
                  rows={2}
                  placeholder="Store Header Text"
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all bg-white font-medium"
                />
                <p className="mt-0.5 text-xs text-gray-500">Custom text to display at the top of receipts</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Receipt Footer</label>
                <textarea
                  value={formData.receipt_footer}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, receipt_footer: e.target.value }))
                  }
                  rows={2}
                  placeholder="Thank you for your business!"
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all bg-white font-medium"
                />
                <p className="mt-0.5 text-xs text-gray-500">Custom text to display at the bottom of receipts</p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CogIcon className="w-3.5 h-3.5 text-indigo-600" />
                Backup Settings
              </h4>
              <div className="flex items-center p-2.5 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group mb-3">
                <input
                  type="checkbox"
                  checked={formData.auto_backup}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, auto_backup: e.target.checked }))
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                />
                <label className="ml-2.5 text-xs font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">
                  Enable Auto Backup
                </label>
              </div>
              {formData.auto_backup && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Backup Frequency</label>
                  <select
                    value={formData.backup_frequency}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, backup_frequency: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export const StoreModal = memo(StoreModalComponent);
