import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useAuthStore } from '../store/authStore';
import { useLicenseStore } from '../store/licenseStore';
import { logger } from '../utils/logger';
import {
  adminService,
  AppUser,
  Store,
  Terminal,
} from '../services/adminService';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LicenseActivation from '../components/LicenseActivation';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  ComputerDesktopIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  KeyIcon,
  IdentificationIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CogIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CubeIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type AdminTab = 'users' | 'stores' | 'terminals' | 'license';

export default function Admin() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { licenseStatus, recordCounts, limits, checkLicense, isLoading: licenseLoading } = useLicenseStore();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const tab = searchParams.get('tab');
    return (tab === 'license' || tab === 'users' || tab === 'stores' || tab === 'terminals') ? tab as AdminTab : 'users';
  });
  const [loading, setLoading] = useState(true);
  const [showActivationModal, setShowActivationModal] = useState(false);

  // Users state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userFilters, setUserFilters] = useState({ page: 1, limit: 20, search: '', role: '' as 'cashier' | 'manager' | 'admin' | '' });
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState({ username: '', full_name: '', password: '', role: 'cashier' as 'cashier' | 'manager' | 'admin', is_active: true });
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [submittingUser, setSubmittingUser] = useState(false);

  // Stores state
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFilters, setStoreFilters] = useState({ page: 1, limit: 20, search: '' });
  const [storePagination, setStorePagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeFormData, setStoreFormData] = useState({
    code: '',
    name: '',
    address: '',
    is_active: true,
    timezone: 'UTC',
    // Store Settings Fields
    currency_code: 'USD',
    tax_inclusive: false,
    theme: 'classic',
    tax_rate: 0,
    receipt_footer: '',
    auto_backup: false,
    backup_frequency: 'daily',
    low_stock_threshold: 3,
    show_stock: true,
    auto_add_qty: true,
    allow_negative: false,
    paper_size: '80mm',
    auto_print: true,
    receipt_header: '',
  });
  const [storeFormErrors, setStoreFormErrors] = useState<Record<string, string>>({});
  const [submittingStore, setSubmittingStore] = useState(false);

  // Terminals state
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalFilters, setTerminalFilters] = useState({ page: 1, limit: 20, search: '', store_id: '' });
  const [terminalPagination, setTerminalPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [terminalFormData, setTerminalFormData] = useState({ store_id: '', code: '', name: '', is_active: true });
  const [terminalFormErrors, setTerminalFormErrors] = useState<Record<string, string>>({});
  const [submittingTerminal, setSubmittingTerminal] = useState(false);

  // Debounced search handlers
  const debouncedUserSearch = useDebouncedCallback((search: string) => {
    setUserFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const debouncedStoreSearch = useDebouncedCallback((search: string) => {
    setStoreFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const debouncedTerminalSearch = useDebouncedCallback((search: string) => {
    setTerminalFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'stores') loadStores();
    else if (activeTab === 'terminals') loadTerminals();
    else if (activeTab === 'license') checkLicense();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userFilters.search, userFilters.role, userFilters.page, storeFilters.search, storeFilters.page, terminalFilters.search, terminalFilters.store_id, terminalFilters.page]);

  // Handle tab change from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'license' || tab === 'users' || tab === 'stores' || tab === 'terminals') {
      setActiveTab(tab as AdminTab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load stores for terminal dropdown
  useEffect(() => {
    if (activeTab === 'terminals') {
      loadStoresForDropdown();
    }
  }, [activeTab]);

  const [storesForDropdown, setStoresForDropdown] = useState<Store[]>([]);

  const loadStoresForDropdown = async () => {
    try {
      const response = await adminService.getStores({ limit: 100 });
      setStoresForDropdown(response.data);
    } catch (err) {
      logger.error('Error loading stores:', err);
    }
  };

  // Users functions
  const loadUsers = async () => {
    try {
      setLoading(true);
      const filters: { page: number; limit: number; search?: string; role?: 'cashier' | 'manager' | 'admin' } = { 
        page: userFilters.page, 
        limit: userFilters.limit 
      };
      if (userFilters.search) filters.search = userFilters.search;
      if (userFilters.role) filters.role = userFilters.role as 'cashier' | 'manager' | 'admin';
      const response = await adminService.getUsers(filters);
      setUsers(response.data);
      setUserPagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormErrors({});
    const errors: Record<string, string> = {};
    if (!userFormData.username.trim()) errors.username = 'Username is required';
    if (!userFormData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!editingUser && !userFormData.password) errors.password = 'Password is required';
    if (userFormData.password && userFormData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (Object.keys(errors).length > 0) {
      setUserFormErrors(errors);
      return;
    }

    setSubmittingUser(true);
    try {
      if (editingUser) {
        const updates: { full_name: string; role: 'cashier' | 'manager' | 'admin'; is_active: boolean; password?: string } = { 
          full_name: userFormData.full_name, 
          role: userFormData.role, 
          is_active: userFormData.is_active 
        };
        if (userFormData.password) updates.password = userFormData.password;
        await adminService.updateUser(editingUser.user_id, updates);
      } else {
        await adminService.createUser(userFormData);
      }
      setShowUserModal(false);
      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
      loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleUserDelete = async (userToDelete: AppUser) => {
    if (userToDelete.user_id === user?.userId) {
      alert('Cannot delete your own account');
      return;
    }
    if (!window.confirm(`Delete user ${userToDelete.username}?`)) return;
    try {
      await adminService.deleteUser(userToDelete.user_id);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  // Stores functions
  const loadStores = async () => {
    try {
      setLoading(true);
      const filters: { page: number; limit: number; search?: string } = { 
        page: storeFilters.page, 
        limit: storeFilters.limit 
      };
      if (storeFilters.search) filters.search = storeFilters.search;
      const response = await adminService.getStores(filters);
      setStores(response.data);
      setStorePagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreFormErrors({});
    const errors: Record<string, string> = {};
    if (!storeFormData.code.trim()) errors.code = 'Code is required';
    if (!storeFormData.name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setStoreFormErrors(errors);
      return;
    }

    setSubmittingStore(true);
    try {
      // Send all store and settings fields
      const storeData: {
        code: string;
        name: string;
        address?: string;
        timezone?: string;
        is_active: boolean;
        currency_code?: string;
        tax_inclusive: boolean;
        theme?: string;
        tax_rate?: number;
        receipt_footer?: string;
        receipt_header?: string;
        auto_backup: boolean;
        backup_frequency?: string;
        low_stock_threshold?: number;
        show_stock: boolean;
        auto_add_qty: boolean;
        allow_negative: boolean;
        paper_size?: string;
        auto_print: boolean;
      } = {
        code: storeFormData.code.trim(),
        name: storeFormData.name.trim(),
        address: storeFormData.address?.trim() || undefined,
        timezone: storeFormData.timezone?.trim() || 'UTC',
        is_active: storeFormData.is_active,
        // Store Settings
        currency_code: storeFormData.currency_code?.trim() || undefined,
        tax_inclusive: storeFormData.tax_inclusive,
        theme: storeFormData.theme || undefined,
        tax_rate: storeFormData.tax_rate !== undefined ? storeFormData.tax_rate : undefined,
        receipt_footer: storeFormData.receipt_footer?.trim() || undefined,
        receipt_header: storeFormData.receipt_header?.trim() || undefined,
        auto_backup: storeFormData.auto_backup,
        backup_frequency: storeFormData.backup_frequency || undefined,
        low_stock_threshold: storeFormData.low_stock_threshold !== undefined ? storeFormData.low_stock_threshold : undefined,
        show_stock: storeFormData.show_stock,
        auto_add_qty: storeFormData.auto_add_qty,
        allow_negative: storeFormData.allow_negative,
        paper_size: storeFormData.paper_size || undefined,
        auto_print: storeFormData.auto_print,
      };

      if (editingStore) {
        await adminService.updateStore(editingStore.store_id, storeData);
      } else {
        await adminService.createStore(storeData);
      }
      setShowStoreModal(false);
      toast.success(editingStore ? 'Store updated successfully' : 'Store created successfully');
      loadStores();
      if (activeTab === 'terminals') loadStoresForDropdown();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save store');
    } finally {
      setSubmittingStore(false);
    }
  };

  const handleStoreDelete = async (store: Store) => {
    if (!window.confirm(`Delete store ${store.name}?`)) return;
    try {
      await adminService.deleteStore(store.store_id);
      toast.success('Store deleted successfully');
      loadStores();
      if (activeTab === 'terminals') loadStoresForDropdown();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to delete store');
    }
  };

  // Terminals functions
  const loadTerminals = async () => {
    try {
      setLoading(true);
      const filters: { page: number; limit: number; search?: string; store_id?: string } = { 
        page: terminalFilters.page, 
        limit: terminalFilters.limit 
      };
      if (terminalFilters.search) filters.search = terminalFilters.search;
      if (terminalFilters.store_id) filters.store_id = terminalFilters.store_id;
      const response = await adminService.getTerminals(filters);
      setTerminals(response.data);
      setTerminalPagination(response.pagination);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to load terminals');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTerminalFormErrors({});
    const errors: Record<string, string> = {};
    if (!terminalFormData.store_id) errors.store_id = 'Store is required';
    if (!terminalFormData.code.trim()) errors.code = 'Code is required';
    if (!terminalFormData.name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setTerminalFormErrors(errors);
      return;
    }

    setSubmittingTerminal(true);
    try {
      if (editingTerminal) {
        await adminService.updateTerminal(editingTerminal.terminal_id, terminalFormData);
      } else {
        await adminService.createTerminal(terminalFormData);
      }
      setShowTerminalModal(false);
      toast.success(editingTerminal ? 'Terminal updated successfully' : 'Terminal created successfully');
      loadTerminals();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save terminal');
    } finally {
      setSubmittingTerminal(false);
    }
  };

  const handleTerminalDelete = async (terminal: Terminal) => {
    if (!window.confirm(`Delete terminal ${terminal.name}?`)) return;
    try {
      await adminService.deleteTerminal(terminal.terminal_id);
      toast.success('Terminal deleted successfully');
      loadTerminals();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to delete terminal');
    }
  };

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheckIcon className="w-16 h-16" />}
          title="Access Denied"
          description="You must be an administrator to access this page."
        />
      </Card>
    );
  }

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <ShieldCheckIcon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Admin Panel</h1>
                <p className="text-red-50 text-xs sm:text-sm mt-1">Manage users, stores, and terminals</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card padding="none" className="border-2 border-gray-100 shadow-lg">
        {/* Enhanced Tabs */}
        <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <nav className="flex -mb-px px-3 sm:px-6 overflow-x-auto scrollbar-hide">
            {([
              { key: 'users', label: 'Users', icon: UserGroupIcon },
              { key: 'stores', label: 'Stores', icon: BuildingStorefrontIcon },
              { key: 'terminals', label: 'Terminals', icon: ComputerDesktopIcon },
              { key: 'license', label: 'License', icon: KeyIcon },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key as AdminTab)}
                className={`px-6 py-4 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                  activeTab === key
                    ? `border-red-500 text-red-600 bg-gradient-to-b from-red-50 to-white`
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Enhanced Search and Filters */}
            <Card className="border-2 border-gray-100 shadow-lg">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-1 gap-4 w-full sm:w-auto">
                    <div className="relative flex-1">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <MagnifyingGlassIcon className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userFilters.search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          setUserFilters(prev => ({ ...prev, search: value }));
                          debouncedUserSearch(value);
                        }}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <FunnelIcon className="w-5 h-5" />
                      </div>
                      <select
                        value={userFilters.role}
                        onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value as 'cashier' | 'manager' | 'admin' | '', page: 1 })}
                        className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none bg-white font-medium"
                      >
                        <option value="">All Roles</option>
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingUser(null);
                      setUserFormData({ username: '', full_name: '', password: '', role: 'cashier', is_active: true });
                      setUserFormErrors({});
                      setShowUserModal(true);
                    }}
                    className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PlusIcon className="w-5 h-5" />}
                  >
                    Add User
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="primary" size="sm">{userPagination.total} Users</Badge>
                  {userFilters.search && (
                    <Badge variant="info" size="sm">
                      Filtered: {users.length} results
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="px-6 py-8">
                <TableSkeleton rows={10} columns={6} />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon className="w-16 h-16" />}
                title="No users found"
                description={userFilters.search || userFilters.role ? "Try adjusting your filters" : "Get started by adding your first user"}
                action={
                  !userFilters.search && !userFilters.role && (
                    <Button
                      onClick={() => {
                        setEditingUser(null);
                        setUserFormData({ username: '', full_name: '', password: '', role: 'cashier', is_active: true });
                        setUserFormErrors({});
                        setShowUserModal(true);
                      }}
                      variant="primary"
                      leftIcon={<PlusIcon className="w-5 h-5" />}
                    >
                      Add User
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Username</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Full Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Role</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((u, idx) => (
                          <tr
                            key={u.user_id}
                            className={`transition-all duration-150 hover:bg-sky-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg">
                                  <UserIcon className="w-5 h-5 text-sky-600" />
                                </div>
                                <span className="text-sm font-bold text-gray-900">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{u.full_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant="primary" size="sm" className="capitalize">
                                {u.role}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={u.is_active ? 'success' : 'error'} size="sm">
                                {u.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-3 h-3 inline mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-3 h-3 inline mr-1" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setUserFormData({ username: u.username, full_name: u.full_name, password: '', role: u.role, is_active: u.is_active });
                                    setUserFormErrors({});
                                    setShowUserModal(true);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<PencilIcon className="w-4 h-4" />}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Edit
                                </Button>
                                {u.user_id !== user?.userId && (
                                  <Button
                                    onClick={() => handleUserDelete(u)}
                                    variant="danger"
                                    size="sm"
                                    leftIcon={<TrashIcon className="w-4 h-4" />}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </Card>
                </div>
                {userPagination.totalPages > 1 && (
                  <Card className="border-2 border-gray-100">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="text-sm text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((userFilters.page - 1) * userFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(userFilters.page * userFilters.limit, userPagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{userPagination.total}</span> users
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setUserFilters({ ...userFilters, page: userFilters.page - 1 })}
                          disabled={userFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
                          Page {userFilters.page} of {userPagination.totalPages}
                        </span>
                        <Button
                          onClick={() => setUserFilters({ ...userFilters, page: userFilters.page + 1 })}
                          disabled={userFilters.page >= userPagination.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Enhanced Search */}
            <Card className="border-2 border-gray-100 shadow-lg">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <MagnifyingGlassIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search stores..."
                      value={storeFilters.search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        setStoreFilters(prev => ({ ...prev, search: value }));
                        debouncedStoreSearch(value);
                      }}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setEditingStore(null);
                      setStoreFormData({
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
                      });
                      setStoreFormErrors({});
                      setShowStoreModal(true);
                    }}
                    className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PlusIcon className="w-5 h-5" />}
                  >
                    Add Store
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="primary" size="sm">{storePagination.total} Stores</Badge>
                  {storeFilters.search && (
                    <Badge variant="info" size="sm">
                      Filtered: {stores.length} results
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="px-6 py-8">
                <TableSkeleton rows={10} columns={5} />
              </div>
            ) : stores.length === 0 ? (
              <EmptyState
                icon={<BuildingStorefrontIcon className="w-16 h-16" />}
                title="No stores found"
                description={storeFilters.search ? "Try adjusting your search" : "Get started by adding your first store"}
                action={
                  !storeFilters.search && (
                    <Button
                      onClick={() => {
                        setEditingStore(null);
                        setStoreFormData({
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
                        });
                        setStoreFormErrors({});
                        setShowStoreModal(true);
                      }}
                      variant="primary"
                      leftIcon={<PlusIcon className="w-5 h-5" />}
                    >
                      Add Store
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Address</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stores.map((s, idx) => (
                          <tr
                            key={s.store_id}
                            className={`transition-all duration-150 hover:bg-indigo-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
                                  <BuildingStorefrontIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                                <span className="text-sm font-bold text-gray-900">{s.code}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{s.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{s.address || <span className="text-gray-400">-</span>}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={s.is_active ? 'success' : 'error'} size="sm">
                                {s.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-3 h-3 inline mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-3 h-3 inline mr-1" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  onClick={() => {
                                    setEditingStore(s);
                                    setStoreFormData({
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
                                    });
                                    setStoreFormErrors({});
                                    setShowStoreModal(true);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<PencilIcon className="w-4 h-4" />}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleStoreDelete(s)}
                                  variant="danger"
                                  size="sm"
                                  leftIcon={<TrashIcon className="w-4 h-4" />}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
                {storePagination.totalPages > 1 && (
                  <Card className="border-2 border-gray-100">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="text-sm text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((storeFilters.page - 1) * storeFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(storeFilters.page * storeFilters.limit, storePagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{storePagination.total}</span> stores
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setStoreFilters({ ...storeFilters, page: storeFilters.page - 1 })}
                          disabled={storeFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
                          Page {storeFilters.page} of {storePagination.totalPages}
                        </span>
                        <Button
                          onClick={() => setStoreFilters({ ...storeFilters, page: storeFilters.page + 1 })}
                          disabled={storeFilters.page >= storePagination.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Terminals Tab */}
        {activeTab === 'terminals' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Enhanced Search and Filters */}
            <Card className="border-2 border-gray-100 shadow-lg">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-1 gap-4 w-full sm:w-auto">
                    <div className="relative flex-1">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <MagnifyingGlassIcon className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search terminals..."
                        value={terminalFilters.search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          setTerminalFilters(prev => ({ ...prev, search: value }));
                          debouncedTerminalSearch(value);
                        }}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <FunnelIcon className="w-5 h-5" />
                      </div>
                      <select
                        value={terminalFilters.store_id}
                        onChange={(e) => setTerminalFilters({ ...terminalFilters, store_id: e.target.value, page: 1 })}
                        className="pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none bg-white font-medium"
                      >
                        <option value="">All Stores</option>
                        {storesForDropdown.map((s) => (
                          <option key={s.store_id} value={s.store_id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingTerminal(null);
                      setTerminalFormData({ store_id: '', code: '', name: '', is_active: true });
                      setTerminalFormErrors({});
                      setShowTerminalModal(true);
                    }}
                    className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PlusIcon className="w-5 h-5" />}
                  >
                    Add Terminal
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="primary" size="sm">{terminalPagination.total} Terminals</Badge>
                  {(terminalFilters.search || terminalFilters.store_id) && (
                    <Badge variant="info" size="sm">
                      Filtered: {terminals.length} results
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="px-6 py-8">
                <TableSkeleton rows={10} columns={5} />
              </div>
            ) : terminals.length === 0 ? (
              <EmptyState
                icon={<ComputerDesktopIcon className="w-16 h-16" />}
                title="No terminals found"
                description={terminalFilters.search || terminalFilters.store_id ? "Try adjusting your filters" : "Get started by adding your first terminal"}
                action={
                  !terminalFilters.search && !terminalFilters.store_id && (
                    <Button
                      onClick={() => {
                        setEditingTerminal(null);
                        setTerminalFormData({ store_id: '', code: '', name: '', is_active: true });
                        setTerminalFormErrors({});
                        setShowTerminalModal(true);
                      }}
                      variant="primary"
                      leftIcon={<PlusIcon className="w-5 h-5" />}
                    >
                      Add Terminal
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Store</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {terminals.map((t, idx) => (
                          <tr
                            key={t.terminal_id}
                            className={`transition-all duration-150 hover:bg-cyan-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-lg">
                                  <ComputerDesktopIcon className="w-5 h-5 text-cyan-600" />
                                </div>
                                <span className="text-sm font-bold text-gray-900">{t.code}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{t.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {storesForDropdown.find(s => s.store_id === t.store_id)?.name || <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={t.is_active ? 'success' : 'error'} size="sm">
                                {t.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-3 h-3 inline mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-3 h-3 inline mr-1" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  onClick={() => {
                                    setEditingTerminal(t);
                                    setTerminalFormData({ store_id: t.store_id, code: t.code, name: t.name, is_active: t.is_active });
                                    setTerminalFormErrors({});
                                    setShowTerminalModal(true);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<PencilIcon className="w-4 h-4" />}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleTerminalDelete(t)}
                                  variant="danger"
                                  size="sm"
                                  leftIcon={<TrashIcon className="w-4 h-4" />}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </Card>
                </div>
                {terminalPagination.totalPages > 1 && (
                  <Card className="border-2 border-gray-100">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="text-sm text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((terminalFilters.page - 1) * terminalFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(terminalFilters.page * terminalFilters.limit, terminalPagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{terminalPagination.total}</span> terminals
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setTerminalFilters({ ...terminalFilters, page: terminalFilters.page - 1 })}
                          disabled={terminalFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
                          Page {terminalFilters.page} of {terminalPagination.totalPages}
                        </span>
                        <Button
                          onClick={() => setTerminalFilters({ ...terminalFilters, page: terminalFilters.page + 1 })}
                          disabled={terminalFilters.page >= terminalPagination.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* License Tab */}
        {activeTab === 'license' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {licenseLoading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600"></div>
                <p className="mt-4 text-gray-600 font-medium">Loading license information...</p>
              </div>
            ) : (
              <>
                {/* License Status Card */}
                <Card className="border-2 border-gray-100 shadow-lg">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl">
                          <KeyIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">License Status</h2>
                          <p className="text-sm text-gray-600">Manage your subscription and activation</p>
                        </div>
                      </div>
                      {licenseStatus && (
                        <Badge
                          variant={licenseStatus.isValid ? 'success' : licenseStatus.isExpired ? 'error' : 'warning'}
                          size="md"
                        >
                          {licenseStatus.isValid ? (
                            <>
                              <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                              Active
                            </>
                          ) : licenseStatus.isExpired ? (
                            <>
                              <XCircleIcon className="w-4 h-4 inline mr-1" />
                              Expired
                            </>
                          ) : (
                            <>
                              <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
                              {licenseStatus.status}
                            </>
                          )}
                        </Badge>
                      )}
                    </div>

                    {!licenseStatus ? (
                      <div className="text-center py-8">
                        <LockClosedIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No License Found</h3>
                        <p className="text-gray-600 mb-6">You're currently using the application without a license.</p>
                        <Button
                          onClick={() => setShowActivationModal(true)}
                          className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                          leftIcon={<KeyIcon className="w-5 h-5" />}
                        >
                          Activate License
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Subscription Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-100">
                            <div className="flex items-center gap-2 mb-2">
                              <ChartBarIcon className="w-5 h-5 text-blue-600" />
                              <span className="text-sm font-semibold text-gray-700">Subscription Type</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 capitalize">{licenseStatus.subscriptionType}</p>
                          </div>
                          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-100">
                            <div className="flex items-center gap-2 mb-2">
                              <ClockIcon className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-semibold text-gray-700">
                                {licenseStatus.isTrial ? 'Days Remaining' : 'Expires On'}
                              </span>
                            </div>
                            {licenseStatus.isTrial ? (
                              <p className="text-2xl font-bold text-gray-900">{licenseStatus.daysRemaining} days</p>
                            ) : (
                              <p className="text-lg font-bold text-gray-900">
                                {new Date(licenseStatus.expiryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Record Usage (Trial Only) */}
                        {licenseStatus.isTrial && limits && recordCounts && (
                          <div className="pt-6 border-t-2 border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <ChartBarIcon className="w-5 h-5 text-indigo-600" />
                              Trial Usage Limits
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {([
                                { key: 'products', label: 'Products', icon: CubeIcon },
                                { key: 'customers', label: 'Customers', icon: UserGroupIcon },
                                { key: 'sales', label: 'Sales', icon: CurrencyDollarIcon },
                                { key: 'purchases', label: 'Purchases', icon: ShoppingCartIcon },
                                { key: 'suppliers', label: 'Suppliers', icon: BuildingStorefrontIcon },
                                { key: 'users', label: 'Users', icon: UserIcon },
                              ] as const).map(({ key, label, icon: Icon }) => {
                                const current = recordCounts[key as keyof typeof recordCounts];
                                const limit = limits[key as keyof typeof limits];
                                const percentage = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
                                const isNearLimit = percentage >= 80;
                                const isAtLimit = percentage >= 100;

                                return (
                                  <div
                                    key={key}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                      isAtLimit
                                        ? 'bg-red-50 border-red-200'
                                        : isNearLimit
                                        ? 'bg-orange-50 border-orange-200'
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Icon className={`w-4 h-4 ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-gray-600'}`} />
                                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                                      </div>
                                      <span
                                        className={`text-sm font-bold ${
                                          isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-gray-900'
                                        }`}
                                      >
                                        {current}/{limit}
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`h-2 rounded-full transition-all ${
                                          isAtLimit
                                            ? 'bg-red-500'
                                            : isNearLimit
                                            ? 'bg-orange-500'
                                            : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {isAtLimit
                                        ? 'Limit reached'
                                        : isNearLimit
                                        ? `${limit - current} remaining`
                                        : `${percentage}% used`}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-6 border-t-2 border-gray-200 flex flex-col sm:flex-row gap-3">
                          {licenseStatus.isTrial && (
                            <Button
                              onClick={() => setShowActivationModal(true)}
                              className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                              leftIcon={<KeyIcon className="w-5 h-5" />}
                            >
                              Upgrade to Yearly Subscription
                            </Button>
                          )}
                          {!licenseStatus.isTrial && licenseStatus.isExpired && (
                            <Button
                              onClick={() => setShowActivationModal(true)}
                              className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                              leftIcon={<KeyIcon className="w-5 h-5" />}
                            >
                              Renew License
                            </Button>
                          )}
                          <Button
                            onClick={checkLicense}
                            variant="outline"
                            leftIcon={<CheckCircleIcon className="w-5 h-5" />}
                          >
                            Refresh License Status
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </Card>

      {/* License Activation Modal */}
      <Modal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg">
              <KeyIcon className="w-5 h-5 text-white" />
            </div>
            <span>Activate License</span>
          </div>
        }
        size="md"
      >
        <LicenseActivation
          onSuccess={() => {
            setShowActivationModal(false);
            checkLicense();
            toast.success('License activated successfully!');
          }}
          onCancel={() => setShowActivationModal(false)}
        />
      </Modal>

      {/* Enhanced User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
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
              onClick={() => setShowUserModal(false)}
              variant="outline"
              disabled={submittingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="user-form"
              className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submittingUser}
            >
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleUserSubmit} className="space-y-5">
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
                value={userFormData.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserFormData({ ...userFormData, username: e.target.value })}
                disabled={!!editingUser}
                required={!editingUser}
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  userFormErrors.username ? 'border-red-300' : 'border-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
            {userFormErrors.username && (
              <p className="mt-1 text-sm text-red-600">{userFormErrors.username}</p>
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
                value={userFormData.full_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                required
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  userFormErrors.full_name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {userFormErrors.full_name && (
              <p className="mt-1 text-sm text-red-600">{userFormErrors.full_name}</p>
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
                value={userFormData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserFormData({ ...userFormData, password: e.target.value })}
                placeholder={editingUser ? 'Leave blank to keep current' : ''}
                required={!editingUser}
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  userFormErrors.password ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {userFormErrors.password && (
              <p className="mt-1 text-sm text-red-600">{userFormErrors.password}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
            <select
              value={userFormData.role}
              onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as 'cashier' | 'manager' | 'admin' })}
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
              checked={userFormData.is_active}
              onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
            />
            <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Active</label>
          </div>
        </form>
      </Modal>

      {/* Enhanced Store Modal */}
      <Modal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
              <BuildingStorefrontIcon className="w-5 h-5 text-white" />
            </div>
            <span>{editingStore ? 'Edit Store' : 'Add Store'}</span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => setShowStoreModal(false)}
              variant="outline"
              disabled={submittingStore}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="store-form"
              className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submittingStore}
            >
              {editingStore ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="store-form" onSubmit={handleStoreSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <BuildingStorefrontIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={storeFormData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, code: e.target.value })}
                required
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  storeFormErrors.code ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {storeFormErrors.code && (
              <p className="mt-1 text-sm text-red-600">{storeFormErrors.code}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <BuildingStorefrontIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={storeFormData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, name: e.target.value })}
                required
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  storeFormErrors.name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {storeFormErrors.name && (
              <p className="mt-1 text-sm text-red-600">{storeFormErrors.name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <MapPinIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={storeFormData.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, address: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
              />
            </div>
          </div>
          
          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
            <input
              type="checkbox"
              checked={storeFormData.is_active}
              onChange={(e) => setStoreFormData({ ...storeFormData, is_active: e.target.checked })}
              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
            />
            <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Active</label>
          </div>

          {/* Enhanced Store Settings Section */}
          <div className="pt-6 border-t-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
                <CogIcon className="w-5 h-5 text-white" />
              </div>
              Store Settings
            </h3>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Currency Code</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <CurrencyDollarIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={storeFormData.currency_code}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, currency_code: e.target.value.toUpperCase() })}
                      placeholder="USD"
                      maxLength={3}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">ISO currency code (e.g., USD, EUR, LBP)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Timezone</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <ClockIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={storeFormData.timezone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, timezone: e.target.value })}
                      placeholder="Asia/Beirut"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">IANA timezone (e.g., America/New_York, Asia/Beirut)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Tax Rate (%)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <CurrencyDollarIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={storeFormData.tax_rate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, tax_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Default tax rate for products</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Low Stock Threshold</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <CogIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={storeFormData.low_stock_threshold}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreFormData({ ...storeFormData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Alert when stock falls below this number</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Theme</label>
                  <select
                    value={storeFormData.theme}
                    onChange={(e) => setStoreFormData({ ...storeFormData, theme: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  >
                    <option value="classic">Classic</option>
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                    <option value="quantum">Quantum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Size</label>
                  <select
                    value={storeFormData.paper_size}
                    onChange={(e) => setStoreFormData({ ...storeFormData, paper_size: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  >
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={storeFormData.tax_inclusive}
                    onChange={(e) => setStoreFormData({ ...storeFormData, tax_inclusive: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <div className="ml-3">
                    <label className="text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Tax Inclusive Pricing</label>
                    <p className="text-xs text-gray-500 mt-0.5">(Prices include tax)</p>
                  </div>
                </div>
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={storeFormData.show_stock}
                    onChange={(e) => setStoreFormData({ ...storeFormData, show_stock: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Show Stock Levels</label>
                </div>
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={storeFormData.auto_add_qty}
                    onChange={(e) => setStoreFormData({ ...storeFormData, auto_add_qty: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Auto Add Quantity</label>
                </div>
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={storeFormData.allow_negative}
                    onChange={(e) => setStoreFormData({ ...storeFormData, allow_negative: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Allow Negative Stock</label>
                </div>
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={storeFormData.auto_print}
                    onChange={(e) => setStoreFormData({ ...storeFormData, auto_print: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Auto Print Receipts</label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Header</label>
                  <textarea
                    value={storeFormData.receipt_header}
                    onChange={(e) => setStoreFormData({ ...storeFormData, receipt_header: e.target.value })}
                    rows={3}
                    placeholder="Store Header Text"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all bg-white font-medium"
                  />
                  <p className="mt-1 text-xs text-gray-500">Custom text to display at the top of receipts</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Footer</label>
                  <textarea
                    value={storeFormData.receipt_footer}
                    onChange={(e) => setStoreFormData({ ...storeFormData, receipt_footer: e.target.value })}
                    rows={3}
                    placeholder="Thank you for your business!"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all bg-white font-medium"
                  />
                  <p className="mt-1 text-xs text-gray-500">Custom text to display at the bottom of receipts</p>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <CogIcon className="w-4 h-4 text-indigo-600" />
                  Backup Settings
                </h4>
                <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group mb-4">
                  <input
                    type="checkbox"
                    checked={storeFormData.auto_backup}
                    onChange={(e) => setStoreFormData({ ...storeFormData, auto_backup: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Enable Auto Backup</label>
                </div>
                {storeFormData.auto_backup && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Backup Frequency</label>
                    <select
                      value={storeFormData.backup_frequency}
                      onChange={(e) => setStoreFormData({ ...storeFormData, backup_frequency: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
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

      {/* Enhanced Terminal Modal */}
      <Modal
        isOpen={showTerminalModal}
        onClose={() => setShowTerminalModal(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg">
              <ComputerDesktopIcon className="w-5 h-5 text-white" />
            </div>
            <span>{editingTerminal ? 'Edit Terminal' : 'Add Terminal'}</span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => setShowTerminalModal(false)}
              variant="outline"
              disabled={submittingTerminal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="terminal-form"
              className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submittingTerminal}
            >
              {editingTerminal ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="terminal-form" onSubmit={handleTerminalSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Store <span className="text-red-500">*</span>
            </label>
            <select
              value={terminalFormData.store_id}
              onChange={(e) => setTerminalFormData({ ...terminalFormData, store_id: e.target.value })}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                terminalFormErrors.store_id ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              <option value="">Select Store</option>
              {storesForDropdown.map((s) => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
            {terminalFormErrors.store_id && (
              <p className="mt-1 text-sm text-red-600">{terminalFormErrors.store_id}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <ComputerDesktopIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={terminalFormData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerminalFormData({ ...terminalFormData, code: e.target.value })}
                required
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  terminalFormErrors.code ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {terminalFormErrors.code && (
              <p className="mt-1 text-sm text-red-600">{terminalFormErrors.code}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <ComputerDesktopIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={terminalFormData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerminalFormData({ ...terminalFormData, name: e.target.value })}
                required
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium ${
                  terminalFormErrors.name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {terminalFormErrors.name && (
              <p className="mt-1 text-sm text-red-600">{terminalFormErrors.name}</p>
            )}
          </div>
          
          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 cursor-pointer transition-all group">
            <input
              type="checkbox"
              checked={terminalFormData.is_active}
              onChange={(e) => setTerminalFormData({ ...terminalFormData, is_active: e.target.checked })}
              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
            />
            <label className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-red-700 cursor-pointer">Active</label>
          </div>
        </form>
      </Modal>
    </>
  );
}

