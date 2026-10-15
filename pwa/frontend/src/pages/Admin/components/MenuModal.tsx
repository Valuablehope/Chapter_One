import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  MenuType,
  menuService,
  MenuInput,
} from '../../../services/adminService';

import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  TagIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

// ── helpers ────────────────────────────────────────────────────────────────
const MENU_TYPE_OPTIONS: { value: MenuType; label: string; emoji: string; color: string }[] = [
  { value: 'regular',  label: 'Regular',  emoji: '🍽️', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { value: 'holiday',  label: 'Holiday',  emoji: '🎄', color: 'bg-red-50 border-red-200 text-red-700' },
  { value: 'seasonal', label: 'Seasonal', emoji: '🌸', color: 'bg-green-50 border-green-200 text-green-700' },
  { value: 'event',    label: 'Event',    emoji: '🎉', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { value: 'special',  label: 'Special',  emoji: '⭐', color: 'bg-amber-50 border-amber-200 text-amber-700' },
];

const inputCls = (err?: boolean) =>
  `w-full px-3 py-2 text-sm rounded-lg border transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500
   placeholder:text-gray-300 font-medium text-gray-800
   ${err ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'}`;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

// ── props ──────────────────────────────────────────────────────────────────
export interface MenuModalProps {
  isOpen: boolean;
  storeId: string;
  editingMenu: Menu | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  menu_type: MenuType;
  is_active: boolean;
  display_order: number;
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  menu_type: 'regular',
  is_active: true,
  display_order: 0,
};

function menuToForm(m: Menu): FormState {
  return {
    name: m.name,
    description: m.description ?? '',
    menu_type: m.menu_type,
    is_active: m.is_active,
    display_order: m.display_order,
  };
}

function validate(form: FormState): Record<string, string> {
  const err: Record<string, string> = {};
  if (!form.name.trim()) err.name = 'Menu name is required';
  return err;
}

// ── component ─────────────────────────────────────────────────────────────
function MenuModalComponent({ isOpen, storeId, editingMenu, onClose, onSaved }: MenuModalProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setForm(editingMenu ? menuToForm(editingMenu) : DEFAULT_FORM);
  }, [isOpen, editingMenu]);

  // ── submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const payload: Partial<MenuInput> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        menu_type: form.menu_type,
        is_active: form.is_active,
        display_order: form.display_order,
        store_id: storeId,
      };
      if (editingMenu) {
        await menuService.updateMenu(editingMenu.menu_id, payload);
        toast.success('Menu updated successfully');
      } else {
        await menuService.createMenu(payload as MenuInput);
        toast.success('Menu created successfully');
      }
      onClose();
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  const goToProducts = () => {
    onClose();
    navigate('/products');
  };

  const selectedType = MENU_TYPE_OPTIONS.find(o => o.value === form.menu_type) ?? MENU_TYPE_OPTIONS[0];
  const categories = editingMenu?.categories ?? [];
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingMenu ? 'Edit Menu' : 'New Menu'}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-gray-400">
            {editingMenu ? `ID: ${editingMenu.menu_id.slice(0, 8)}…` : 'Fields marked * are required'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="menu-form" variant="primary" size="sm" isLoading={saving}>
              {editingMenu ? 'Save Changes' : 'Create Menu'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="menu-form" onSubmit={handleSubmit} className="space-y-5">

        {/* ── BASIC INFO ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel required>Menu Name</FieldLabel>
            <div className="relative">
              <ClipboardDocumentListIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Dinner Menu, Christmas Special…"
                className={`${inputCls(!!errors.name)} pl-9`}
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Brief description of this menu (optional)"
              className={`${inputCls()} resize-none`}
            />
          </div>
        </div>

        {/* ── TYPE SELECTOR ────────────────────────────────────────────── */}
        <div>
          <FieldLabel>Menu Type</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
            {MENU_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, menu_type: opt.value }))}
                className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all duration-150 cursor-pointer
                  ${form.menu_type === opt.value
                    ? `${opt.color} ring-2 ring-offset-1 ring-current shadow-sm scale-[1.03]`
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white'
                  }`}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── STATUS + ORDER ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Active toggle */}
          <label className={`flex flex-1 items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
            ${form.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-5 rounded-full bg-gray-200 peer-checked:bg-emerald-500
                             after:content-[''] after:absolute after:top-0.5 after:left-0.5
                             after:bg-white after:rounded-full after:h-4 after:w-4
                             after:transition-all after:shadow-sm
                             peer-checked:after:translate-x-5 transition-colors" />
            </div>
            <div>
              <span className={`text-sm font-semibold ${form.is_active ? 'text-emerald-800' : 'text-gray-600'}`}>
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.is_active ? 'This menu will appear on the POS' : 'Hidden from the POS'}
              </p>
            </div>
            {form.is_active && <CheckCircleIcon className="w-5 h-5 text-emerald-500 ml-auto flex-shrink-0" />}
          </label>

          {/* Display order */}
          <div className="w-full sm:w-36">
            <FieldLabel>Display Order</FieldLabel>
            <input
              type="number"
              min={0}
              step={1}
              value={form.display_order}
              onChange={e => setForm(p => ({ ...p, display_order: parseInt(e.target.value, 10) || 0 }))}
              className={inputCls()}
            />
            <p className="mt-1 text-[10px] text-gray-400">Lower = shown first</p>
          </div>
        </div>

        {/* ── ITEMS PREVIEW (read-only — managed from Products) ───────── */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-secondary-500" />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Categories &amp; Items
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              rightIcon={<ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />}
              onClick={goToProducts}
            >
              Manage in Products
            </Button>
          </div>

          <p className="mb-3 px-3 py-2 rounded-lg bg-secondary-50 border border-secondary-100 text-xs text-secondary-700">
            Menu items are assigned from the Products page — open a product and pick this menu &amp; a category
            to add it here. This section just shows a live preview.
          </p>

          {!editingMenu ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              Save this menu first, then assign products to it from the Products page.
            </div>
          ) : categories.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              No products are assigned to this menu yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[min(400px,45vh)] overflow-y-auto pr-1 scroll-smooth">
              {categories.map((cat, ci) => (
                <div key={ci} className="border-2 border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700 truncate">{item.name}</span>
                        <span className="font-semibold text-gray-800 flex-shrink-0">{item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${selectedType.color}`}>
          <span className="text-base">{selectedType.emoji}</span>
          <span className="font-medium">{selectedType.label} menu</span>
          <span className="ml-auto text-gray-500">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} ·{' '}
            {totalItems} items
          </span>
        </div>
      </form>
    </Modal>
  );
}

export const MenuModal = memo(MenuModalComponent);
