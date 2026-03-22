import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Terminal, Store } from '../../../services/adminService';
import { ComputerDesktopIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

interface TerminalFormData {
  store_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTerminal: Terminal | null;
  formData: TerminalFormData;
  formErrors: Record<string, string>;
  submitting: boolean;
  storesForDropdown: Store[];
  setFormData: (data: TerminalFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

// Shared input class — matches StoreModal & UserModal
const inputCls = (hasError?: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-lg border transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500
   placeholder:text-gray-300 font-medium text-gray-800
   ${hasError ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'}`;

const selectCls = (hasError?: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-lg border transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500
   font-medium text-gray-800 cursor-pointer
   ${hasError ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'}`;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

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

export default function TerminalModal({
  isOpen,
  onClose,
  editingTerminal,
  formData,
  formErrors,
  submitting,
  storesForDropdown,
  setFormData,
  onSubmit,
}: TerminalModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTerminal ? 'Edit Terminal' : 'Add Terminal'}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {editingTerminal ? `ID: ${editingTerminal.terminal_id}` : 'Fields marked * are required'}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline" disabled={submitting} size="sm">
              Cancel
            </Button>
            <Button type="submit" form="terminal-form" variant="primary" isLoading={submitting} size="sm">
              {editingTerminal ? 'Save Changes' : 'Create Terminal'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="terminal-form" onSubmit={onSubmit} className="space-y-4">

        {/* Subtitle when editing */}
        {editingTerminal && (
          <p className="text-xs text-gray-400 -mt-1">{editingTerminal.name}</p>
        )}

        {/* Store */}
        <div>
          <FieldLabel required>Store</FieldLabel>
          <div className="relative">
            <BuildingStorefrontIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <select
              value={formData.store_id}
              onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
              className={`${selectCls(!!formErrors.store_id)} pl-9`}
            >
              <option value="">Select a store…</option>
              {storesForDropdown.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>
          {formErrors.store_id && (
            <p className="mt-1 text-xs text-red-500">{formErrors.store_id}</p>
          )}
        </div>

        {/* Code + Name side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>Terminal Code</FieldLabel>
            <div className="relative">
              <ComputerDesktopIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                required
                placeholder="e.g. TERM-01"
                className={`${inputCls(!!formErrors.code)} pl-9`}
              />
            </div>
            {formErrors.code && (
              <p className="mt-1 text-xs text-red-500">{formErrors.code}</p>
            )}
          </div>

          <div>
            <FieldLabel required>Display Name</FieldLabel>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g. Cashier 1"
              className={inputCls(!!formErrors.name)}
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
            )}
          </div>
        </div>

        {/* Active toggle */}
        <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
          <Toggle
            checked={formData.is_active}
            onChange={(v) => setFormData({ ...formData, is_active: v })}
            label="Terminal Active"
            description="Inactive terminals cannot process transactions"
          />
        </div>

      </form>
    </Modal>
  );
}
