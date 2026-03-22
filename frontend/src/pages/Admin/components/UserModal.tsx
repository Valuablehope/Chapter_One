import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { AppUser } from '../../../services/adminService';
import { UserIcon, IdentificationIcon, KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { INPUT_LIMITS } from '../../../config/constants';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: AppUser | null;
  formData: {
    username: string;
    full_name: string;
    password: string;
    role: 'cashier' | 'manager' | 'admin';
    is_active: boolean;
  };
  formErrors: Record<string, string>;
  submitting: boolean;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

// Shared input class — matches StoreModal
const inputCls = (hasError?: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-lg border transition-all bg-white outline-none
   focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500
   placeholder:text-gray-300 font-medium text-gray-800
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

const ROLE_OPTIONS = [
  { value: 'cashier',  label: 'Cashier',  description: 'POS access only' },
  { value: 'manager',  label: 'Manager',  description: 'Reports & inventory' },
  { value: 'admin',    label: 'Admin',    description: 'Full access' },
] as const;

export default function UserModal({
  isOpen,
  onClose,
  editingUser,
  formData,
  formErrors,
  submitting,
  setFormData,
  onSubmit,
}: UserModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingUser ? 'Edit User' : 'Add User'}
      showCloseButton={false}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {editingUser ? `ID: ${editingUser.user_id}` : 'Fields marked * are required'}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline" disabled={submitting} size="sm">
              Cancel
            </Button>
            <Button type="submit" form="user-form" variant="primary" isLoading={submitting} size="sm">
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-4">

        {/* Subtitle when editing */}
        {editingUser && (
          <p className="text-xs text-gray-400 -mt-1">@{editingUser.username}</p>
        )}

        {/* Username */}
        <div>
          <FieldLabel required={!editingUser}>Username</FieldLabel>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={formData.username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.USERNAME_MAX_LENGTH)
                  setFormData({ ...formData, username: value });
              }}
              disabled={!!editingUser}
              required={!editingUser}
              minLength={INPUT_LIMITS.USERNAME_MIN_LENGTH}
              maxLength={INPUT_LIMITS.USERNAME_MAX_LENGTH}
              placeholder="e.g. john.doe"
              className={`${inputCls(!!formErrors.username)} pl-9 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50`}
            />
          </div>
          {editingUser && (
            <p className="mt-1 text-xs text-gray-400">Username cannot be changed after creation</p>
          )}
          {formErrors.username && (
            <p className="mt-1 text-xs text-red-500">{formErrors.username}</p>
          )}
        </div>

        {/* Full Name */}
        <div>
          <FieldLabel required>Full Name</FieldLabel>
          <div className="relative">
            <IdentificationIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={formData.full_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.FULL_NAME_MAX_LENGTH)
                  setFormData({ ...formData, full_name: value });
              }}
              required
              maxLength={INPUT_LIMITS.FULL_NAME_MAX_LENGTH}
              placeholder="e.g. John Doe"
              className={`${inputCls(!!formErrors.full_name)} pl-9`}
            />
          </div>
          {formErrors.full_name && (
            <p className="mt-1 text-xs text-red-500">{formErrors.full_name}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <FieldLabel required={!editingUser}>Password</FieldLabel>
          <div className="relative">
            <KeyIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.PASSWORD_MAX_LENGTH)
                  setFormData({ ...formData, password: value });
              }}
              placeholder={editingUser ? 'Leave blank to keep current password' : 'Min 6 characters'}
              required={!editingUser}
              minLength={editingUser ? undefined : INPUT_LIMITS.PASSWORD_MIN_LENGTH}
              maxLength={INPUT_LIMITS.PASSWORD_MAX_LENGTH}
              className={`${inputCls(!!formErrors.password)} pl-9`}
            />
          </div>
          {formErrors.password && (
            <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>
          )}
        </div>

        {/* Role */}
        <div>
          <FieldLabel>Role</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((opt) => {
              const active = formData.role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: opt.value })}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-center transition-all duration-150
                    ${active
                      ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <ShieldCheckIcon className={`w-4 h-4 ${active ? 'text-secondary-500' : 'text-gray-300'}`} />
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] leading-tight text-gray-400">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active toggle */}
        <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
          <Toggle
            checked={formData.is_active}
            onChange={(v) => setFormData({ ...formData, is_active: v })}
            label="Account Active"
            description="Inactive users cannot sign in to the POS"
          />
        </div>

      </form>
    </Modal>
  );
}
