import { useUsers } from '../hooks/useUsers';
import { useAuthStore } from '../../../store/authStore';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import UserModal from './UserModal';
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { INPUT_LIMITS } from '../../../config/constants';

export default function UsersTab() {
  const { user } = useAuthStore();
  const {
    users,
    loading,
    filters,
    pagination,
    showModal,
    editingUser,
    formData,
    formErrors,
    submitting,
    setFormData,
    handleSearch,
    handleRoleFilter,
    handlePageChange,
    openAddModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
  } = useUsers();

  return (
    <>
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
                    value={filters.search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      if (value.length <= INPUT_LIMITS.USERNAME_MAX_LENGTH) {
                        handleSearch(value);
                      }
                    }}
                    maxLength={INPUT_LIMITS.USERNAME_MAX_LENGTH}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white font-medium"
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <FunnelIcon className="w-5 h-5" />
                  </div>
                  <select
                    value={filters.role}
                    onChange={(e) => handleRoleFilter(e.target.value as 'cashier' | 'manager' | 'admin' | '')}
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
                onClick={openAddModal}
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Add User
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="primary" size="sm">{pagination.total} Users</Badge>
              {filters.search && (
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
            description={filters.search || filters.role ? "Try adjusting your filters" : "Get started by adding your first user"}
            action={
              !filters.search && !filters.role && (
                <Button
                  onClick={openAddModal}
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
                              <div className="p-2 bg-secondary-100 rounded-lg">
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
                                onClick={() => openEditModal(u)}
                                variant="ghost"
                                size="sm"
                                leftIcon={<PencilIcon className="w-4 h-4" />}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Edit
                              </Button>
                              {u.user_id !== user?.userId && (
                                <Button
                                  onClick={() => handleDelete(u)}
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
            {pagination.totalPages > 1 && (
              <Card className="border-2 border-gray-100">
                <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-600 font-medium">
                    Showing <span className="font-bold text-gray-900">{((filters.page - 1) * filters.limit) + 1}</span> to{' '}
                    <span className="font-bold text-gray-900">{Math.min(filters.page * filters.limit, pagination.total)}</span> of{' '}
                    <span className="font-bold text-gray-900">{pagination.total}</span> users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={filters.page === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
                      Page {filters.page} of {pagination.totalPages}
                    </span>
                    <Button
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={filters.page >= pagination.totalPages}
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

      <UserModal
        isOpen={showModal}
        onClose={closeModal}
        editingUser={editingUser}
        formData={formData}
        formErrors={formErrors}
        submitting={submitting}
        setFormData={setFormData}
        onSubmit={handleSubmit}
      />
    </>
  );
}



