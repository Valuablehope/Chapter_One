import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CubeIcon as CubeIconSolid,
  CurrencyDollarIcon as CurrencyDollarIconSolid,
  ShoppingCartIcon as ShoppingCartIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
} from '@heroicons/react/24/solid';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import TrialBanner from './TrialBanner';
import PageErrorBoundary from './PageErrorBoundary';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { CloudArrowUpIcon, WifiIcon } from '@heroicons/react/24/outline';

// Classic Pushpin Icon Component
const PushpinIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {/* Pin head - rounded cylinder shape */}
    <path
      d="M12 3C10 3 8 5 8 7C8 9 9 10 10 11C10.5 11.5 11 12 11 13C11 13.5 10.5 14 10 14H14C13.5 14 13 13.5 13 13C13 12 13.5 11.5 14 11C15 10 16 9 16 7C16 5 14 3 12 3Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Pin shaft */}
    <line x1="12" y1="14" x2="12" y2="21" strokeLinecap="round" />
  </svg>
);

const PushpinIconSolid = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    {/* Pin head - rounded cylinder shape */}
    <path
      d="M12 3C10 3 8 5 8 7C8 9 9 10 10 11C10.5 11.5 11 12 11 13C11 13.5 10.5 14 10 14H14C13.5 14 13 13.5 13 13C13 12 13.5 11.5 14 11C15 10 16 9 16 7C16 5 14 3 12 3Z"
    />
    {/* Pin shaft */}
    <rect x="11" y="14" width="2" height="7" rx="1" />
  </svg>
);

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Automatically refresh token for long-running sessions
  useTokenRefresh();

  // Manage offline sales sync
  const { pendingCount, isOnline, isSyncing, syncPendingSales } = useOfflineSync();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // Load pinned state from localStorage on mount
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('sidebar-pinned');
    return saved === 'true';
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      // Call backend to clear httpOnly cookie
      await authService.logout();
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    }
    logout();
    navigate('/login', { replace: true });
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
  };

  // Initialize sidebar state based on pinned preference on mount
  useEffect(() => {
    if (isPinned) {
      setIsSidebarCollapsed(false);
    }
  }, []); // Run only on mount

  // Save pinned state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebar-pinned', String(isPinned));
    // If pinned, ensure sidebar is expanded
    if (isPinned) {
      setIsSidebarCollapsed(false);
    }
  }, [isPinned]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && window.innerWidth < 768) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isDropdownOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isMobileMenuOpen]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      blockedRoles: ['cashier'],
    },
    {
      path: '/products',
      label: 'Products',
      icon: CubeIcon,
      iconSolid: CubeIconSolid,
    },
    {
      path: '/sales',
      label: 'POS Sales',
      icon: CurrencyDollarIcon,
      iconSolid: CurrencyDollarIconSolid,
    },
    {
      path: '/sales-management',
      label: 'Sales Management',
      icon: DocumentTextIcon,
      iconSolid: DocumentTextIconSolid,
      blockedRoles: ['cashier'],
    },
    {
      path: '/purchases',
      label: 'Purchases',
      icon: ShoppingCartIcon,
      iconSolid: ShoppingCartIconSolid,
    },
    {
      path: '/customers',
      label: 'Customers',
      icon: UserGroupIcon,
      iconSolid: UserGroupIconSolid,
    },
    {
      path: '/suppliers',
      label: 'Suppliers',
      icon: BuildingOfficeIcon,
      iconSolid: BuildingOfficeIconSolid,
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
    },
    {
      path: '/admin',
      label: 'Admin Panel',
      icon: Cog6ToothIcon,
      iconSolid: Cog6ToothIconSolid,
      role: 'admin',
    },
  ];

  const filteredNavItems = navItems.filter((item) => {
    // Hide items that require admin role if user is not admin
    if (item.role && user?.role !== 'admin') {
      return false;
    }
    // Hide items that are blocked for the user's role
    if (item.blockedRoles && user && item.blockedRoles.includes(user.role)) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => {
          setIsSidebarHovered(true);
          if (!isPinned) {
            setIsSidebarCollapsed(false);
          }
        }}
        onMouseLeave={() => {
          setIsSidebarHovered(false);
          // Only collapse if not pinned
          if (!isPinned) {
            setIsSidebarCollapsed(true);
          }
        }}
        onClick={() => {
          if (isSidebarCollapsed && !isPinned) {
            setIsSidebarCollapsed(false);
          }
        }}
        className={`
          hidden md:flex flex-col
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed && !isSidebarHovered ? 'w-20' : 'w-64'}
          fixed left-0 top-0 bottom-0 z-40
          shadow-lg
        `}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {(!isSidebarCollapsed || isSidebarHovered) && (
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 group flex-shrink-0 flex-1"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-secondary-400 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105 p-1.5">
                  <img
                    src="icon.png"
                    alt="Chapter One POS Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-secondary-500 truncate">
                  Chapter One POS
                </h1>
                <p className="text-xs text-gray-500 truncate">Point of Sale</p>
              </div>
            </Link>
          )}
          {(isSidebarCollapsed && !isSidebarHovered) && (
            <>
              <Link
                to="/dashboard"
                className="flex items-center justify-center flex-1 group"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-secondary-400 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105 p-1.5">
                    <img
                      src="icon.png"
                      alt="Chapter One POS Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </Link>
              {/* Pin Button - Always visible when collapsed */}
              <button
                onClick={handleTogglePin}
                className={`
                  flex items-center justify-center
                  w-8 h-8 rounded-lg
                  transition-all duration-200
                  ${isPinned
                    ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }
                `}
                title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {isPinned ? (
                  <PushpinIconSolid className="w-5 h-5" />
                ) : (
                  <PushpinIcon className="w-5 h-5" />
                )}
              </button>
            </>
          )}

          {/* Pin Button - When expanded */}
          {(!isSidebarCollapsed || isSidebarHovered) && (
            <button
              onClick={handleTogglePin}
              className={`
                flex items-center justify-center
                w-8 h-8 rounded-lg
                transition-all duration-200
                ${isPinned
                  ? 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }
              `}
              title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {isPinned ? (
                <PushpinIconSolid className="w-5 h-5" />
              ) : (
                <PushpinIcon className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = isActive(item.path) ? item.iconSolid : item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    group relative flex items-center
                    ${isSidebarCollapsed && !isSidebarHovered ? 'justify-center px-2' : 'px-3'}
                    py-2.5 rounded-xl
                    text-sm font-semibold
                    transition-all duration-300
                    ${active
                      ? 'text-white bg-secondary-500 shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  title={isSidebarCollapsed && !isSidebarHovered ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'drop-shadow-sm' : ''}`} />
                  {(!isSidebarCollapsed || isSidebarHovered) && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {active && (!isSidebarCollapsed || isSidebarHovered) && (
                    <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section - Bottom of Sidebar */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="relative flex-shrink-0">
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary-500 border-2 border-white rounded-full z-10"></div>
              <div className="w-10 h-10 bg-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            </div>
            {(!isSidebarCollapsed || isSidebarHovered) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {user?.fullName || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize truncate">
                  {user?.role || 'User'}
                </p>
              </div>
            )}
          </div>
          {(!isSidebarCollapsed || isSidebarHovered) && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:from-red-600 hover:to-rose-600 transition-all"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed && !isSidebarHovered ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Mobile Menu Button - Floating */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden fixed top-2 left-2 z-40 p-2 rounded-lg bg-white shadow-lg text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <XMarkIcon className="w-5 h-5" />
          ) : (
            <Bars3Icon className="w-5 h-5" />
          )}
        </button>

        {/* Trial Banner */}
        <TrialBanner />

        {/* Offline Sync Indicator */}
        {pendingCount > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <>
                  <CloudArrowUpIcon className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    {isSyncing
                      ? `Syncing ${pendingCount} pending sale${pendingCount > 1 ? 's' : ''}...`
                      : `${pendingCount} sale${pendingCount > 1 ? 's' : ''} pending sync`
                    }
                  </span>
                </>
              ) : (
                <>
                  <WifiIcon className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Offline: {pendingCount} sale{pendingCount > 1 ? 's' : ''} queued
                  </span>
                </>
              )}
            </div>
            {isOnline && !isSyncing && (
              <button
                onClick={syncPendingSales}
                className="text-sm font-semibold text-yellow-800 hover:text-yellow-900 underline"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-auto">
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            ref={sidebarRef}
            className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-2xl overflow-y-auto flex flex-col animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Menu Header */}
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-secondary-500 rounded-lg flex items-center justify-center">
                    <CubeIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Menu</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-gray-600 hover:bg-white transition-colors"
                  aria-label="Close menu"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
              {filteredNavItems.map((item) => {
                const Icon = isActive(item.path) ? item.iconSolid : item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`group relative flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${active ? 'text-white' : 'text-gray-700'
                      }`}
                  >
                    {active && (
                      <div className="absolute inset-0 bg-secondary-500 rounded-xl shadow-lg"></div>
                    )}
                    {!active && (
                      <div className="absolute inset-0 bg-gray-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    )}
                    <Icon className={`w-5 h-5 relative z-10 flex-shrink-0 ${active ? 'drop-shadow-sm' : ''}`} />
                    <span className="relative z-10 flex-1">{item.label}</span>
                    {active && (
                      <div className="ml-auto relative z-10 w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0"></div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Footer */}
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center space-x-3 mb-3">
                <div className="relative">
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary-500 border-2 border-white rounded-full z-10"></div>
                  <div className="w-10 h-10 bg-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user?.fullName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize truncate">
                    {user?.role || 'User'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:from-red-600 hover:to-rose-600 transition-all"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes dropdown-fade {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-left {
          animation: slide-in-left 0.3s ease-out;
        }
        
        .animate-dropdown-fade {
          animation: dropdown-fade 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
