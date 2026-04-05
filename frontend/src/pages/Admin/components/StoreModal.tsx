import { memo, useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  adminService,
  Store,
  PosModuleType,
} from '../../../services/adminService';
import { storeService } from '../../../services/storeService';
import { logger } from '../../../utils/logger';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CogIcon,
  ArchiveBoxIcon,
  PrinterIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation, Language } from '../../../i18n/I18nContext';

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
  pos_module_type: PosModuleType;
  restaurant_table_count: number | null;
  restaurant_track_guests_per_table: boolean;
  lbp_exchange_rate: number | null;
  label_show_lbp: boolean;
}

function validateRestaurantForm(formData: StoreFormData): Record<string, string> {
  const err: Record<string, string> = {};
  const tables = formData.restaurant_table_count;
  if (tables === null || tables === undefined || !Number.isFinite(tables) || tables < 1) {
    err.restaurant_table_count = 'Enter at least one table';
  }
  return err;
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
  pos_module_type: 'store',
  restaurant_table_count: null,
  restaurant_track_guests_per_table: false,
  lbp_exchange_rate: null,
  label_show_lbp: true,
};

function storeToFormData(s: Store): StoreFormData {
  const pos = s.pos_module_type ?? 'store';
  const tableCount =
    s.restaurant_table_count !== undefined && s.restaurant_table_count !== null
      ? s.restaurant_table_count
      : pos === 'restaurant'
        ? 1
        : null;

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
    pos_module_type: pos,
    restaurant_table_count: tableCount,
    restaurant_track_guests_per_table: s.restaurant_track_guests_per_table ?? false,
    lbp_exchange_rate: s.lbp_exchange_rate ?? null,
    label_show_lbp: s.label_show_lbp ?? true,
  };
}

export interface StoreModalProps {
  isOpen: boolean;
  editingStore: Store | null;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'identity' | 'regional' | 'pos' | 'inventory' | 'settings' | 'backup';

function getTabs(t: any) {
  return [
    { id: 'identity' as Tab, label: t('admin.stores.identity'), icon: BuildingStorefrontIcon },
    { id: 'regional' as Tab, label: t('admin.stores.regional'), icon: ClockIcon },
    { id: 'pos' as Tab, label: t('admin.stores.pos_receipts'), icon: PrinterIcon },
    { id: 'inventory' as Tab, label: t('admin.stores.inventory'), icon: ArchiveBoxIcon },
    { id: 'settings' as Tab, label: t('admin.stores.settings'), icon: AdjustmentsHorizontalIcon },
    { id: 'backup' as Tab, label: t('admin.stores.backup'), icon: CogIcon },
  ];
}

// Shared input class
const inputCls = (hasError?: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-lg border transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500
   placeholder:text-gray-300 font-medium text-gray-800
   ${hasError ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'}`;

const selectCls =
  `w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 hover:border-gray-300 transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500 font-medium text-gray-800 cursor-pointer`;

// Field label
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// Toggle switch
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-3">
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
        )}
      </div>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className="w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-secondary-500
                     after:content-[''] after:absolute after:top-0.5 after:left-0.5
                     after:bg-white after:rounded-full after:h-5 after:w-5
                     after:transition-all after:shadow-sm
                     peer-checked:after:translate-x-5
                     transition-colors duration-200"
        />
      </div>
    </label>
  );
}

// Section divider with label
function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-5 mb-4">
      <span className="text-[10px] font-bold text-secondary-600 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-secondary-200" />
    </div>
  );
}

function StoreModalComponent({ isOpen, editingStore, onClose, onSaved }: StoreModalProps) {
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('identity');
  const { t, language, setLanguage } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('identity');
    if (editingStore) {
      setFormData(storeToFormData(editingStore));
    } else {
      setFormData(initialFormData);
    }
    setFormErrors({});
  }, [isOpen, editingStore]);

  const set = <K extends keyof StoreFormData>(key: K, value: StoreFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setActiveTab('identity');
      return;
    }

    if (formData.pos_module_type === 'restaurant') {
      const rErr = validateRestaurantForm(formData);
      if (Object.keys(rErr).length > 0) {
        setFormErrors(rErr);
        setActiveTab('settings');
        return;
      }
    }

    const isRestaurant = formData.pos_module_type === 'restaurant';
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
      pos_module_type: formData.pos_module_type,
      restaurant_table_count: isRestaurant ? formData.restaurant_table_count : null,
      restaurant_track_guests_per_table: isRestaurant
        ? formData.restaurant_track_guests_per_table
        : false,
      lbp_exchange_rate: formData.lbp_exchange_rate ?? null,
      label_show_lbp: formData.label_show_lbp,
    };

    setSubmitting(true);
    try {
      if (editingStore) {
        await adminService.updateStore(editingStore.store_id, storeData);
      } else {
        await adminService.createStore(storeData);
      }
      storeService.notifyStoreModuleChanged();
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
      title={editingStore ? t('admin.stores.edit_store') : t('admin.stores.add_store')}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {editingStore ? `ID: ${editingStore.store_id}` : 'Fields marked * are required'}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline" disabled={submitting} size="sm">
              {t('admin.stores.cancel')}
            </Button>
            <Button type="submit" form="store-form" variant="primary" isLoading={submitting} size="sm">
              {editingStore ? t('admin.stores.save_changes') : t('admin.stores.create_store')}
            </Button>
          </div>
        </div>
      }
    >
      {/* Store name subtitle when editing */}
      {editingStore && (
        <p className="text-xs text-gray-400 -mt-1 mb-4">{editingStore.name}</p>
      )}

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-50 border border-gray-200 rounded-xl p-1 mb-5">
        {getTabs(t).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150
                ${active
                  ? 'bg-white text-secondary-600 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                }`}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-secondary-600' : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <form id="store-form" onSubmit={handleSubmit}>
        {/* ── IDENTITY ── */}
        {activeTab === 'identity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>{t('admin.stores.code')}</FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set('code', e.target.value)}
                    required
                    placeholder="e.g. STORE-01"
                    className={inputCls(!!formErrors.code)}
                  />
                </div>
                {formErrors.code && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.code}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">Unique identifier for this store</p>
              </div>

              <div>
                <FieldLabel required>{t('admin.stores.name')}</FieldLabel>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
                  required
                  placeholder="e.g. Chapter One — Downtown"
                  className={inputCls(!!formErrors.name)}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>
            </div>

            <div>
              <FieldLabel>{t('admin.stores.address')}</FieldLabel>
              <div className="relative">
                <MapPinIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set('address', e.target.value)}
                  placeholder="123 Main Street, City, Country"
                  className={`${inputCls()} pl-9`}
                />
              </div>
            </div>

            <SectionDivider>{t('admin.stores.status')}</SectionDivider>

            <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
              <Toggle
                checked={formData.is_active}
                onChange={(v) => set('is_active', v)}
                label={t('admin.stores.store_active')}
                description="Inactive stores are hidden from the POS and reports"
              />
            </div>
          </div>
        )}

        {/* ── REGIONAL ── */}
        {activeTab === 'regional' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Currency Code</FieldLabel>
                <div className="relative">
                  <CurrencyDollarIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.currency_code}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      set('currency_code', e.target.value.toUpperCase())
                    }
                    placeholder="USD"
                    maxLength={3}
                    className={`${inputCls()} pl-9`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">ISO 4217 code — USD, EUR, LBP…</p>
              </div>

              <div>
                <FieldLabel>Timezone</FieldLabel>
                <div className="relative">
                  <ClockIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set('timezone', e.target.value)}
                    placeholder="America/New_York"
                    className={`${inputCls()} pl-9`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">IANA timezone identifier</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Default Tax Rate (%)</FieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_rate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    set('tax_rate', parseFloat(e.target.value) || 0)
                  }
                  className={inputCls()}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Default VAT/tax % for new products. When Tax-Inclusive Pricing is on, this rate is also used at checkout for
                  products that have no tax set, and to split shelf prices into net + tax on receipts.
                </p>
              </div>
            </div>

            <SectionDivider>LBP Exchange Rate</SectionDivider>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>LBP Rate (1 {formData.currency_code || 'USD'} = ? LBP)</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.lbp_exchange_rate ?? ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value;
                    set('lbp_exchange_rate', raw === '' ? null : parseFloat(raw) || null);
                  }}
                  placeholder="e.g. 89500"
                  className={inputCls()}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Enter how many LBP equal 1&nbsp;{formData.currency_code || 'USD'}. Leave blank to hide LBP prices in POS.
                </p>
              </div>

              {/* Live preview badge */}
              {formData.lbp_exchange_rate !== null && formData.lbp_exchange_rate > 0 && (
                <div className="flex items-start pt-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-lg">🇱🇧</span>
                    <div>
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Live Preview</p>
                      <p className="text-sm font-bold text-amber-900">
                        1 {formData.currency_code || 'USD'} = {formData.lbp_exchange_rate.toLocaleString()} LBP
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {formData.lbp_exchange_rate !== null && formData.lbp_exchange_rate > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <Toggle
                  checked={formData.label_show_lbp}
                  onChange={(v) => set('label_show_lbp', v)}
                  label="Show LBP on shelf labels"
                  description="When enabled, printed shelf labels include a line with the price in LBP (USD × this rate), between the product name and the main price."
                />
              </div>
            )}

            <SectionDivider>Pricing</SectionDivider>

            <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
              <Toggle
                checked={formData.tax_inclusive}
                onChange={(v) => set('tax_inclusive', v)}
                label="Tax-Inclusive Pricing"
                description="Shelf prices include tax; checkout uses each product’s tax % or the default above. Turn off to charge no tax on sales."
              />
            </div>
          </div>
        )}

        {/* ── POS & RECEIPTS ── */}
        {activeTab === 'pos' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>POS Theme</FieldLabel>
                <select
                  value={formData.theme}
                  onChange={(e) => set('theme', e.target.value)}
                  className={selectCls}
                >
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                  <option value="quantum">Quantum</option>
                </select>
              </div>

              <div>
                <FieldLabel>Receipt Paper Size</FieldLabel>
                <select
                  value={formData.paper_size}
                  onChange={(e) => set('paper_size', e.target.value)}
                  className={selectCls}
                >
                  <option value="80mm">80 mm</option>
                  <option value="58mm">58 mm</option>
                  <option value="A4">A4</option>
                </select>
              </div>
            </div>

            <SectionDivider>Receipt Content</SectionDivider>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Header Text</FieldLabel>
                <textarea
                  value={formData.receipt_header}
                  onChange={(e) => set('receipt_header', e.target.value)}
                  rows={3}
                  placeholder="e.g. Welcome to Chapter One"
                  className={`${inputCls()} resize-none`}
                />
                <p className="mt-1 text-xs text-gray-400">Printed at the top of every receipt</p>
              </div>
              <div>
                <FieldLabel>Footer Text</FieldLabel>
                <textarea
                  value={formData.receipt_footer}
                  onChange={(e) => set('receipt_footer', e.target.value)}
                  rows={3}
                  placeholder="e.g. Thank you for your purchase!"
                  className={`${inputCls()} resize-none`}
                />
                <p className="mt-1 text-xs text-gray-400">Printed at the bottom of every receipt</p>
              </div>
            </div>

            <SectionDivider>Printing</SectionDivider>

            <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
              <Toggle
                checked={formData.auto_print}
                onChange={(v) => set('auto_print', v)}
                label="Auto-Print Receipts"
                description="Automatically send receipt to printer after each sale"
              />
            </div>
          </div>
        )}

        {/* ── INVENTORY ── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div>
              <FieldLabel>Low Stock Threshold</FieldLabel>
              <input
                type="number"
                min="0"
                value={formData.low_stock_threshold}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  set('low_stock_threshold', parseInt(e.target.value, 10) || 0)
                }
                className={inputCls()}
              />
              <p className="mt-1 text-xs text-gray-400">
                Trigger a low-stock alert when quantity falls below this number
              </p>
            </div>

            <SectionDivider>Stock Behaviour</SectionDivider>

            <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
              <Toggle
                checked={formData.show_stock}
                onChange={(v) => set('show_stock', v)}
                label="Show Stock Levels"
                description="Display available quantities on the POS screen"
              />
              <Toggle
                checked={formData.auto_add_qty}
                onChange={(v) => set('auto_add_qty', v)}
                label="Auto-Add Quantity"
                description="Increase quantity automatically when a product is scanned again"
              />
              <Toggle
                checked={formData.allow_negative}
                onChange={(v) => set('allow_negative', v)}
                label="Allow Negative Stock"
                description="Permit sales even when stock reaches zero"
              />
            </div>
          </div>
        )}

        {/* ── SETTINGS (POS module / restaurant) ── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <SectionDivider>Platform Language</SectionDivider>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Interface Language</FieldLabel>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className={selectCls}
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic (العربية)</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Changes the current language and orientation of the interface.
                </p>
              </div>
            </div>

            <SectionDivider>POS System</SectionDivider>
            <div>
              <FieldLabel>POS module type</FieldLabel>
              <select
                value={formData.pos_module_type}
                onChange={(e) => {
                  const v = e.target.value as PosModuleType;
                  setFormData((prev) => ({
                    ...prev,
                    pos_module_type: v,
                    ...(v !== 'restaurant'
                      ? {
                          restaurant_table_count: null,
                          restaurant_track_guests_per_table: false,
                        }
                      : {
                            restaurant_table_count:
                              prev.restaurant_table_count !== null &&
                              prev.restaurant_table_count >= 1
                                ? prev.restaurant_table_count
                                : 1,
                          }),
                  }));
                }}
                className={selectCls}
              >
                <option value="store">Store</option>
                <option value="retail_store">Retail store</option>
                <option value="restaurant">Restaurant</option>
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Chooses how this location runs on the POS (restaurant enables tables and menus).
              </p>
            </div>

            {formData.pos_module_type === 'restaurant' && (
              <>
                <SectionDivider>Restaurant layout</SectionDivider>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Number of tables</FieldLabel>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={formData.restaurant_table_count ?? ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const raw = e.target.value;
                        set(
                          'restaurant_table_count',
                          raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1)
                        );
                      }}
                      className={inputCls(!!formErrors.restaurant_table_count)}
                    />
                    {formErrors.restaurant_table_count && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.restaurant_table_count}</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
                  <Toggle
                    checked={formData.restaurant_track_guests_per_table}
                    onChange={(v) => set('restaurant_track_guests_per_table', v)}
                    label="Track guest count per table"
                    description="When enabled, staff can record how many guests are seated at each table"
                  />
                </div>

                <SectionDivider>Menu pricing (tax)</SectionDivider>
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    formData.tax_inclusive
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}
                >
                  <p className="font-medium">
                    {formData.tax_inclusive
                      ? 'Menu prices are tax-inclusive (matches Regional → Tax-Inclusive Pricing).'
                      : 'Menu prices are shown before tax; tax is applied per your store tax settings.'}
                  </p>
                  <p className="text-xs mt-1.5 opacity-90">
                    Change this under the Regional tab → Pricing → Tax-Inclusive Pricing.
                  </p>
                </div>

                <SectionDivider>Menus</SectionDivider>
                <p className="text-sm text-gray-500">
                  Manage menus from the Admin <strong>Menus</strong> tab.
                </p>
              </>
            )}

            {formData.pos_module_type !== 'restaurant' && (
              <p className="text-sm text-gray-500 py-4">
                Restaurant tables and menus appear when you choose <strong>Restaurant</strong> above.
              </p>
            )}
          </div>
        )}

        {/* ── BACKUP ── */}
        {activeTab === 'backup' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
              <Toggle
                checked={formData.auto_backup}
                onChange={(v) => set('auto_backup', v)}
                label="Enable Auto Backup"
                description="Automatically back up store data on a schedule"
              />
            </div>

            {formData.auto_backup && (
              <div>
                <SectionDivider>Schedule</SectionDivider>
                <FieldLabel>Backup Frequency</FieldLabel>
                <select
                  value={formData.backup_frequency}
                  onChange={(e) => set('backup_frequency', e.target.value)}
                  className={selectCls}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  How often the backup job runs automatically
                </p>
              </div>
            )}

            {!formData.auto_backup && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <ArchiveBoxIcon className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">Auto Backup is disabled</p>
                <p className="text-xs text-gray-400 mt-1">
                  Enable the toggle above to configure a backup schedule
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

export const StoreModal = memo(StoreModalComponent);
