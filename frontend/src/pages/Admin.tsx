import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { TableSkeleton } from '../components/ui/Skeleton';
import PageBanner from '../components/ui/PageBanner';
import { useAuthStore } from '../store/authStore';
import { useLicenseStore } from '../store/licenseStore';
import { logger } from '../utils/logger';
import {
  adminService,
  AppUser,
  Store,
  Terminal,
} from '../services/adminService';
import { storeService } from '../services/storeService';
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
  CurrencyDollarIcon,
  ClockIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CubeIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { StoreModal } from './Admin/components/StoreModal';
import TerminalModal from './Admin/components/TerminalModal';
import UserModal from './Admin/components/UserModal';
import MenusTab from './Admin/components/MenusTab';

type AdminTab = 'users' | 'stores' | 'terminals' | 'license' | 'menus';

export default function Admin() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { licenseStatus, recordCounts, limits, checkLicense, isLoading: licenseLoading } = useLicenseStore();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const tab = searchParams.get('tab');
    return (tab === 'license' || tab === 'users' || tab === 'stores' || tab === 'terminals' || tab === 'menus') ? tab as AdminTab : 'users';
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
  const [storesForDropdown, setStoresForDropdown] = useState<Store[]>([]);

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

  const mergedStoreMap = new Map<string, Store>();
  [...storesForDropdown, ...stores].forEach((s) => mergedStoreMap.set(s.store_id, s));
  const allKnownStores = Array.from(mergedStoreMap.values());
  const showMenusTab = allKnownStores.some((s) => s.pos_module_type === 'restaurant');

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
    if (tab === 'menus' && !showMenusTab) {
      setActiveTab('stores');
      return;
    }
    if (tab === 'license' || tab === 'users' || tab === 'stores' || tab === 'terminals' || tab === 'menus') {
      setActiveTab(tab as AdminTab);
    }
  }, [searchParams, showMenusTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: AdminTab) => {
    if (tab === 'menus' && !showMenusTab) {
      setActiveTab('stores');
      setSearchParams({ tab: 'stores' });
      return;
    }
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load stores for terminal dropdown
  useEffect(() => {
    if (activeTab === 'terminals') {
      loadStoresForDropdown();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'menus' && !showMenusTab) {
      handleTabChange('stores');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showMenusTab]);

  const loadStoresForDropdown = async () => {
    try {
      const response = await adminService.getStores({ limit: 100 });
      setStoresForDropdown(response.data);
    } catch (err) {
      logger.error('Error loading stores:', err);
    }
  };

  useEffect(() => {
    loadStoresForDropdown();
  }, []);

  useEffect(() => {
    const unsubscribe = storeService.subscribeStoreModuleChanged(() => {
      loadStoresForDropdown();
      if (activeTab === 'stores') {
        loadStores();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to save user');
      }
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
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to delete user');
      }
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

  const handleStoreDelete = async (store: Store) => {
    if (!window.confirm(`Delete store ${store.name}?`)) return;
    try {
      await adminService.deleteStore(store.store_id);
      toast.success('Store deleted successfully');
      loadStores();
      if (activeTab === 'terminals') loadStoresForDropdown();
    } catch (err: unknown) {
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to delete store');
      }
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
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to save terminal');
      }
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
      const error = err as { 
        response?: { data?: { error?: { message?: string } } }; 
        isTimeout?: boolean;
        message?: string;
      };
      
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to delete terminal');
      }
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
      <PageBanner
        title="Admin Panel"
        subtitle="Manage users, stores, and terminals"
        icon={<ShieldCheckIcon className="w-5 h-5 text-white" />}
      />

      <Card padding="none" className="border-2 border-gray-100 shadow-md">
        {/* Enhanced Tabs */}
        <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <nav className="flex -mb-px px-3 overflow-x-auto scrollbar-hide">
            {([
              { key: 'users', label: 'Users', icon: UserGroupIcon },
              { key: 'stores', label: 'Stores', icon: BuildingStorefrontIcon },
              { key: 'terminals', label: 'Terminals', icon: ComputerDesktopIcon },
              { key: 'license', label: 'License', icon: KeyIcon },
              ...(showMenusTab ? [{ key: 'menus', label: 'Menus', icon: ClipboardDocumentListIcon }] : []),
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key as AdminTab)}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === key
                    ? `border-secondary-500 text-secondary-600 bg-secondary-50`
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="p-3 space-y-3">
            {/* Enhanced Search and Filters */}
            <Card className="border-2 border-gray-100 shadow-md">
              <div className="p-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex flex-1 gap-3 w-full sm:w-auto">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <MagnifyingGlassIcon className="w-4 h-4" />
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
                        className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <FunnelIcon className="w-4 h-4" />
                      </div>
                      <select
                        value={userFilters.role}
                        onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value as 'cashier' | 'manager' | 'admin' | '', page: 1 })}
                        className="pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 appearance-none bg-white font-medium"
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
                    size="sm"
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add User
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
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
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={6} />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon className="w-12 h-12" />}
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
                      size="sm"
                      leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                      Add User
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Username</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Full Name</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Role</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((u, idx) => (
                          <tr
                            key={u.user_id}
                            className={`transition-all duration-150 hover:bg-secondary-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <div className="p-1.5 bg-secondary-100 rounded-lg">
                                  <UserIcon className="w-3.5 h-3.5 text-secondary-500" />
                                </div>
                                <span className="text-xs font-bold text-gray-900">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-700">{u.full_name}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge variant="primary" size="sm" className="capitalize">
                                {u.role}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge variant={u.is_active ? 'success' : 'error'} size="sm">
                                {u.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
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
                    <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
                      <div className="text-xs text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((userFilters.page - 1) * userFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(userFilters.page * userFilters.limit, userPagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{userPagination.total}</span> users
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => setUserFilters({ ...userFilters, page: userFilters.page - 1 })}
                          disabled={userFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
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
          <div className="p-3 space-y-3">
            {/* Enhanced Search */}
            <Card className="border-2 border-gray-100 shadow-md">
              <div className="p-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <MagnifyingGlassIcon className="w-4 h-4" />
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
                      className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setEditingStore(null);
                      setShowStoreModal(true);
                    }}
                    size="sm"
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add Store
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
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
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={5} />
              </div>
            ) : stores.length === 0 ? (
              <EmptyState
                icon={<BuildingStorefrontIcon className="w-12 h-12" />}
                title="No stores found"
                description={storeFilters.search ? "Try adjusting your search" : "Get started by adding your first store"}
                action={
                  !storeFilters.search && (
                    <Button
                      onClick={() => {
                        setEditingStore(null);
                        setShowStoreModal(true);
                      }}
                      variant="primary"
                      size="sm"
                      leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                      Add Store
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Code</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Name</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Address</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Status</th>
                            <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stores.map((s, idx) => (
                          <tr
                            key={s.store_id}
                            className={`transition-all duration-150 hover:bg-secondary-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <div className="p-1.5 bg-secondary-100 rounded-lg">
                                  <BuildingStorefrontIcon className="w-3.5 h-3.5 text-secondary-500" />
                                </div>
                                <span className="text-xs font-bold text-gray-900">{s.code}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900">{s.name}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{s.address || <span className="text-gray-400">-</span>}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge variant={s.is_active ? 'success' : 'error'} size="sm">
                                {s.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  onClick={() => {
                                    setEditingStore(s);
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
                    <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
                      <div className="text-xs text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((storeFilters.page - 1) * storeFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(storeFilters.page * storeFilters.limit, storePagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{storePagination.total}</span> stores
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => setStoreFilters({ ...storeFilters, page: storeFilters.page - 1 })}
                          disabled={storeFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
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
          <div className="p-3 space-y-3">
            {/* Enhanced Search and Filters */}
            <Card className="border-2 border-gray-100 shadow-md">
              <div className="p-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex flex-1 gap-3 w-full sm:w-auto">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <MagnifyingGlassIcon className="w-4 h-4" />
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
                        className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <FunnelIcon className="w-4 h-4" />
                      </div>
                      <select
                        value={terminalFilters.store_id}
                        onChange={(e) => setTerminalFilters({ ...terminalFilters, store_id: e.target.value, page: 1 })}
                        className="pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 appearance-none bg-white font-medium"
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
                    size="sm"
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add Terminal
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
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
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={5} />
              </div>
            ) : terminals.length === 0 ? (
              <EmptyState
                icon={<ComputerDesktopIcon className="w-12 h-12" />}
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
                      size="sm"
                      leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                      Add Terminal
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Code</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Name</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Store</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {terminals.map((t, idx) => (
                          <tr
                            key={t.terminal_id}
                            className={`transition-all duration-150 hover:bg-secondary-50/50 group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <div className="p-1.5 bg-secondary-100 rounded-lg">
                                  <ComputerDesktopIcon className="w-3.5 h-3.5 text-secondary-500" />
                                </div>
                                <span className="text-xs font-bold text-gray-900">{t.code}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900">{t.name}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                              {storesForDropdown.find(s => s.store_id === t.store_id)?.name || <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge variant={t.is_active ? 'success' : 'error'} size="sm">
                                {t.is_active ? (
                                  <>
                                    <CheckCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
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
                    <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
                      <div className="text-xs text-gray-600 font-medium">
                        Showing <span className="font-bold text-gray-900">{((terminalFilters.page - 1) * terminalFilters.limit) + 1}</span> to{' '}
                        <span className="font-bold text-gray-900">{Math.min(terminalFilters.page * terminalFilters.limit, terminalPagination.total)}</span> of{' '}
                        <span className="font-bold text-gray-900">{terminalPagination.total}</span> terminals
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => setTerminalFilters({ ...terminalFilters, page: terminalFilters.page - 1 })}
                          disabled={terminalFilters.page === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
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

        {/* Menus Tab */}
        {activeTab === 'menus' && <MenusTab />}

        {/* License Tab */}
        {activeTab === 'license' && (
          <div className="p-3 space-y-3">
            {licenseLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-secondary-200 border-t-secondary-500"></div>
                <p className="mt-3 text-xs text-gray-600 font-medium">Loading license information...</p>
              </div>
            ) : (
              <>
                {/* License Status Card */}
                <Card className="border-2 border-gray-100 shadow-md">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg">
                          <KeyIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900">License Status</h2>
                          <p className="text-xs text-gray-600">Manage your subscription and activation</p>
                        </div>
                      </div>
                      {licenseStatus && (
                        <Badge
                          variant={licenseStatus.isValid ? 'success' : licenseStatus.isExpired ? 'error' : 'warning'}
                          size="sm"
                        >
                          {licenseStatus.isValid ? (
                            <>
                              <CheckCircleIcon className="w-3 h-3 inline mr-0.5" />
                              Active
                            </>
                          ) : licenseStatus.isExpired ? (
                            <>
                              <XCircleIcon className="w-3 h-3 inline mr-0.5" />
                              Expired
                            </>
                          ) : (
                            <>
                              <ExclamationTriangleIcon className="w-3 h-3 inline mr-0.5" />
                              {licenseStatus.status}
                            </>
                          )}
                        </Badge>
                      )}
                    </div>

                    {!licenseStatus ? (
                      <div className="text-center py-6">
                        <LockClosedIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">No License Found</h3>
                        <p className="text-xs text-gray-600 mb-4">You're currently using the application without a license.</p>
                        <Button
                          onClick={() => setShowActivationModal(true)}
                          size="sm"
                          className="bg-secondary-500 hover:bg-secondary-600 text-white"
                          leftIcon={<KeyIcon className="w-4 h-4" />}
                        >
                          Activate License
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Subscription Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <ChartBarIcon className="w-4 h-4 text-secondary-500" />
                              <span className="text-xs font-semibold text-gray-700">Subscription Type</span>
                            </div>
                            <p className="text-lg font-bold text-gray-900 capitalize">{licenseStatus.subscriptionType}</p>
                          </div>
                          <div className="p-3 bg-success-50 rounded-lg border-2 border-success-200">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <ClockIcon className="w-4 h-4 text-secondary-500" />
                              <span className="text-xs font-semibold text-gray-700">
                                {licenseStatus.isTrial ? 'Days Remaining' : 'Expires On'}
                              </span>
                            </div>
                            {licenseStatus.isTrial ? (
                              <p className="text-lg font-bold text-gray-900">{licenseStatus.daysRemaining} days</p>
                            ) : (
                              <p className="text-base font-bold text-gray-900">
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
                              className="bg-secondary-500 hover:bg-secondary-600 text-white"
                              leftIcon={<KeyIcon className="w-5 h-5" />}
                            >
                              Upgrade to Yearly Subscription
                            </Button>
                          )}
                          {!licenseStatus.isTrial && licenseStatus.isExpired && (
                            <Button
                              onClick={() => setShowActivationModal(true)}
                              className="bg-secondary-500 hover:bg-secondary-600 text-white"
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

                {/* Support Contact */}
                <Card className="border-2 border-green-100 shadow-md bg-green-50 mt-4">
                  <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Need Help or Support?</h3>
                      <p className="text-xs text-gray-600 mt-1">If you have any questions or need assistance with your license, please contact us via WhatsApp.</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border-2 border-green-200 shadow-sm hover:border-green-300 transition-colors">
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <a href="https://wa.me/96171282672" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-900 hover:text-green-600 transition-colors">
                        00 961 71 282 672
                      </a>
                    </div>
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

      {/* User Modal */}
      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        formData={userFormData}
        formErrors={userFormErrors}
        submitting={submittingUser}
        setFormData={setUserFormData}
        onSubmit={handleUserSubmit}
      />

      <StoreModal
        isOpen={showStoreModal}
        editingStore={editingStore}
        onClose={() => {
          setShowStoreModal(false);
          setEditingStore(null);
        }}
        onSaved={() => {
          loadStores();
          loadStoresForDropdown();
        }}
      />

      {/* Terminal Modal */}
      <TerminalModal
        isOpen={showTerminalModal}
        onClose={() => setShowTerminalModal(false)}
        editingTerminal={editingTerminal}
        formData={terminalFormData}
        formErrors={terminalFormErrors}
        submitting={submittingTerminal}
        storesForDropdown={storesForDropdown}
        setFormData={setTerminalFormData}
        onSubmit={handleTerminalSubmit}
      />
    </>
  );
}

