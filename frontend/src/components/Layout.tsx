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
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
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
} from '@heroicons/react/24/solid';
import { useAuthStore } from '../store/authStore';
import TrialBanner from './TrialBanner';
import PageErrorBoundary from './PageErrorBoundary';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: HomeIcon, 
      iconSolid: HomeIconSolid,
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      path: '/products', 
      label: 'Products', 
      icon: CubeIcon, 
      iconSolid: CubeIconSolid,
      color: 'from-emerald-500 to-teal-500'
    },
    { 
      path: '/sales', 
      label: 'POS Sales', 
      icon: CurrencyDollarIcon, 
      iconSolid: CurrencyDollarIconSolid,
      color: 'from-green-500 to-emerald-500'
    },
    { 
      path: '/purchases', 
      label: 'Purchases', 
      icon: ShoppingCartIcon, 
      iconSolid: ShoppingCartIconSolid,
      color: 'from-orange-500 to-amber-500'
    },
    { 
      path: '/customers', 
      label: 'Customers', 
      icon: UserGroupIcon, 
      iconSolid: UserGroupIconSolid,
      color: 'from-sky-500 to-blue-500'
    },
    { 
      path: '/suppliers', 
      label: 'Suppliers', 
      icon: BuildingOfficeIcon, 
      iconSolid: BuildingOfficeIconSolid,
      color: 'from-indigo-500 to-blue-500'
    },
    { 
      path: '/reports', 
      label: 'Reports', 
      icon: ChartBarIcon, 
      iconSolid: ChartBarIconSolid,
      color: 'from-cyan-500 to-blue-500'
    },
    { 
      path: '/admin', 
      label: 'Admin Panel', 
      icon: Cog6ToothIcon, 
      iconSolid: Cog6ToothIconSolid, 
      role: 'admin',
      color: 'from-red-500 to-rose-500'
    },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (item.role && user?.role !== 'admin') {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with Light Background */}
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-12">
          <div className="flex items-center h-16 sm:h-20 gap-2 sm:gap-4">
            {/* Logo Section - Enhanced */}
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 sm:space-x-3 group flex-shrink-0"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <CubeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent whitespace-nowrap">
                  Chapter One POS
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">Point of Sale</p>
              </div>
            </Link>

            {/* Desktop Navigation - Enhanced with Responsive Design */}
            <div className="flex-1 min-w-0 hidden md:block">
              {/* Scrollable Navigation Container - Allow horizontal scrolling */}
              <nav 
                ref={navRef}
                className="flex items-center space-x-1 md:space-x-1.5 lg:space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 py-2 -mx-2 px-2 scroll-smooth"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgb(209 213 219) transparent',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {filteredNavItems.map((item) => {
                  const Icon = isActive(item.path) ? item.iconSolid : item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`group relative px-2.5 md:px-3 lg:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 flex items-center space-x-1.5 md:space-x-2 flex-shrink-0 ${
                        active
                          ? 'text-white'
                          : 'text-gray-700 hover:text-gray-900'
                      }`}
                      title={item.label}
                    >
                      {/* Active Background with Gradient */}
                      {active && (
                        <div className={`absolute inset-0 bg-gradient-to-r ${item.color} rounded-xl shadow-lg animate-scale-in`}></div>
                      )}
                      
                      {/* Hover Background */}
                      {!active && (
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      )}
                      
                      {/* Icon - Always visible */}
                      <div className={`relative z-10 flex items-center ${active ? 'animate-bounce-subtle' : ''}`}>
                        <Icon className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 ${active ? 'drop-shadow-sm' : ''}`} />
                      </div>
                      
                      {/* Label - Show on lg screens and up */}
                      <span className="relative z-10 whitespace-nowrap hidden lg:inline">{item.label}</span>
                      
                      {/* Active Indicator Dot */}
                      {active && (
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gradient-to-r ${item.color} rounded-full shadow-lg animate-pulse`}></div>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Bars3Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>

            {/* User Section - Enhanced and Responsive */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {/* User Info - Responsive visibility */}
              <div className="text-right hidden lg:block">
                <p className="text-xs lg:text-sm font-bold text-gray-900 whitespace-nowrap">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-500 capitalize whitespace-nowrap flex items-center justify-end space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="hidden xl:inline">{user?.role}</span>
                </p>
              </div>

              {/* Avatar Dropdown - Enhanced and Responsive */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-1 sm:space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl p-1 transition-all duration-200 hover:bg-gray-50 group"
                  aria-label="User menu"
                  aria-expanded={isDropdownOpen}
                >
                  <div className="relative">
                    {/* Status Ring */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full z-10"></div>
                    {/* Avatar - Responsive sizing */}
                    <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105 flex-shrink-0">
                      {user?.fullName?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <ChevronDownIcon 
                    className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 flex-shrink-0 hidden md:block ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Enhanced Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 py-3 z-50 animate-dropdown-fade">
                    {/* User Info Section - Enhanced */}
                    <div className="px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full z-10"></div>
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {user?.fullName?.charAt(0) || 'U'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-900 truncate">
                            {user?.fullName || 'User'}
                          </p>
                          <p className="text-sm text-gray-500 capitalize truncate flex items-center space-x-2 mt-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span>{user?.role || 'User'}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Logout Button - Enhanced */}
                    <div className="px-3 py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
                      >
                        <ArrowRightOnRectangleIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu - Enhanced Full Screen Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div 
              className="fixed top-0 left-0 bottom-0 w-64 sm:w-80 bg-white shadow-2xl overflow-y-auto animate-slide-down flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Menu Header */}
              <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
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
              
              <nav className="px-3 sm:px-4 py-4 space-y-1 flex-1 overflow-y-auto">
                {filteredNavItems.map((item) => {
                  const Icon = isActive(item.path) ? item.iconSolid : item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`group relative flex items-center space-x-3 px-3 sm:px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        active ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {active && (
                        <div className={`absolute inset-0 bg-gradient-to-r ${item.color} rounded-xl shadow-lg`}></div>
                      )}
                      {!active && (
                        <div className="absolute inset-0 bg-gray-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      )}
                      <Icon className={`w-5 h-5 relative z-10 flex-shrink-0 ${active ? 'drop-shadow-sm' : ''}`} />
                      <span className="relative z-10 flex-1">{item.label}</span>
                      {active && (
                        <div className={`ml-auto relative z-10 w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0`}></div>
                      )}
                    </Link>
                  );
                })}
              </nav>
              
              {/* Mobile Menu Footer with User Info */}
              <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative">
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full z-10"></div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
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
      </header>

      {/* Trial Banner */}
      <TrialBanner />

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-12 py-6 sm:py-8 md:py-10">
        <PageErrorBoundary>
          {children}
        </PageErrorBoundary>
      </main>

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
        
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        .animate-dropdown-fade {
          animation: dropdown-fade 0.2s ease-out;
        }
        
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        
        .animate-bounce-subtle {
          animation: bounce-subtle 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
}
