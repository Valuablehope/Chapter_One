import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { AppUser } from '../../../services/adminService';
import {
  UserGroupIcon,
  UserIcon,
  IdentificationIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
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
      title={
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-sky-500 to-blue-500 rounded-lg">
            <UserGroupIcon className="w-5 h-5 text-white" />
          </div>
          <span>{editingUser ? 'Edit User' : 'Add User'}</span>
        </div>
      }
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            isLoading={submitting}
          >
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Username {!editingUser && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={formData.username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.USERNAME_MAX_LENGTH) {
                  setFormData({ ...formData, username: value });
                }
              }}
              disabled={!!editingUser}
              required={!editingUser}
              minLength={INPUT_LIMITS.USERNAME_MIN_LENGTH}
              maxLength={INPUT_LIMITS.USERNAME_MAX_LENGTH}
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                formErrors.username ? 'border-red-300' : 'border-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>
          {formErrors.username && (
            <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <IdentificationIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.FULL_NAME_MAX_LENGTH) {
                  setFormData({ ...formData, full_name: value });
                }
              }}
              required
              maxLength={INPUT_LIMITS.FULL_NAME_MAX_LENGTH}
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
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
            Password {!editingUser && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <KeyIcon className="w-5 h-5" />
            </div>
            <input
              type="password"
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.PASSWORD_MAX_LENGTH) {
                  setFormData({ ...formData, password: value });
                }
              }}
              placeholder={editingUser ? 'Leave blank to keep current' : ''}
              required={!editingUser}
              minLength={editingUser ? undefined : INPUT_LIMITS.PASSWORD_MIN_LENGTH}
              maxLength={INPUT_LIMITS.PASSWORD_MAX_LENGTH}
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                formErrors.password ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {formErrors.password && (
            <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'cashier' | 'manager' | 'admin' })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
          >
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        
        <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
          />
          <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Active</label>
        </div>
      </form>
    </Modal>
  );
}



