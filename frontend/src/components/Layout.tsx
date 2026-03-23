import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { fonts, shadows } from '../styles/tokens';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  BookOpenIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  PresentationChartBarIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ClipboardDocumentListIcon as ClipboardDocumentListIconSolid,
  TruckIcon as TruckIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  PresentationChartBarIcon as PresentationChartBarIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  TableCellsIcon as TableCellsIconSolid,
} from '@heroicons/react/24/solid';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import TrialBanner from './TrialBanner';
import PageErrorBoundary from './PageErrorBoundary';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { CloudArrowUpIcon, WifiIcon } from '@heroicons/react/24/outline';
import { APP_BRAND_POS_LINE } from '../constants/branding';
import { storeService } from '../services/storeService';
import type { PosModuleType } from '../services/adminService';

/** Thumbtack pin — outline (sidebar not pinned) */
const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {/* Cap */}
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    {/* Wings */}
    <path d="M9 6.5L7 11h10l-2-4.5" />
    {/* Shaft */}
    <line x1="12" y1="11" x2="12" y2="15.5" />
    {/* Needle */}
    <line x1="12" y1="15.5" x2="12" y2="21.5" />
  </svg>
);

/** Thumbtack pin — filled (sidebar pinned) */
const PinIconSolid = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    {/* Cap */}
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    {/* Wings filled */}
    <path d="M9 6.5L7 11h10l-2-4.5z" />
    {/* Shaft + needle */}
    <rect x="11.25" y="11" width="1.5" height="10.5" rx="0.75" />
  </svg>
);

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [posModuleType, setPosModuleType] = useState<PosModuleType>('store');

  useTokenRefresh();
  const { pendingCount, isOnline, isSyncing, syncPendingSales } = useOfflineSync();

  const refreshPosModuleType = useCallback(async () => {
    try {
      const s = await storeService.getDefaultStore();
      if (s.pos_module_type) {
        setPosModuleType(s.pos_module_type);
      }
    } catch {
      // Keep current value on fetch failure.
    }
  }, []);

  useEffect(() => {
    void refreshPosModuleType();
  }, [refreshPosModuleType]);

  useEffect(() => {
    const unsubscribe = storeService.subscribeStoreModuleChanged(() => {
      void refreshPosModuleType();
    });
    return unsubscribe;
  }, [refreshPosModuleType]);

  const [isMobileMenuOpen, setIsMobileMenuOpen]   = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered]   = useState(false);
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem('sidebar-pinned') === 'true');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef  = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* fallthrough */ }
    logout();
    navigate('/login', { replace: true });
  };

  const handleTogglePin = () => setIsPinned(p => !p);

  useEffect(() => { if (isPinned) setIsSidebarCollapsed(false); }, []);
  useEffect(() => {
    localStorage.setItem('sidebar-pinned', String(isPinned));
    if (isPinned) setIsSidebarCollapsed(false);
  }, [isPinned]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) { /* no dropdown */ }
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node) && window.innerWidth < 768) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;

  const isRestaurant = posModuleType === 'restaurant';

  useEffect(() => {
    if (isRestaurant && location.pathname === '/sales') {
      navigate('/restaurant', { replace: true });
      return;
    }
    if (!isRestaurant && location.pathname === '/restaurant') {
      navigate('/sales', { replace: true });
    }
  }, [isRestaurant, location.pathname, navigate]);

  const navItems = [
    { path: '/dashboard',        label: 'Dashboard',        icon: HomeIcon,                    iconSolid: HomeIconSolid,                    blockedRoles: ['cashier'] as string[] },
    { path: '/products',         label: 'Products',         icon: BookOpenIcon,                iconSolid: BookOpenIconSolid },
    ...(isRestaurant
      ? [{ path: '/restaurant', label: 'Restaurant',  icon: TableCellsIcon, iconSolid: TableCellsIconSolid }]
      : [{ path: '/sales',      label: 'POS Sales',   icon: CreditCardIcon, iconSolid: CreditCardIconSolid }]),
    { path: '/sales-management', label: 'Sales',            icon: ClipboardDocumentListIcon,   iconSolid: ClipboardDocumentListIconSolid,   blockedRoles: ['cashier'] as string[] },
    { path: '/purchases',        label: 'Purchases',        icon: TruckIcon,                   iconSolid: TruckIconSolid },
    { path: '/customers',        label: 'Customers',        icon: UserGroupIcon,               iconSolid: UserGroupIconSolid },
    { path: '/suppliers',        label: 'Suppliers',        icon: BuildingOfficeIcon,          iconSolid: BuildingOfficeIconSolid },
    { path: '/reports',          label: 'Reports',          icon: PresentationChartBarIcon,    iconSolid: PresentationChartBarIconSolid },
    { path: '/admin',            label: 'Admin',            icon: ShieldCheckIcon,             iconSolid: ShieldCheckIconSolid,             role: 'admin' as const },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.role && user?.role !== 'admin') return false;
    if (item.blockedRoles && user && item.blockedRoles.includes(user.role)) return false;
    return true;
  });

  const sidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || 'U';
  const roleLabel   = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';

  /* ── Nav item renderer ── */
  const NavItem = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const active = isActive(item.path);
    const Icon   = active ? item.iconSolid : item.icon;
    return (
      <Link
        to={item.path}
        onClick={onClick}
        title={!sidebarExpanded ? item.label : undefined}
        className={`
          relative flex items-center
          ${sidebarExpanded ? 'px-3' : 'justify-center px-2'}
          py-2.5 rounded-lg text-sm font-medium
          transition-all duration-200 group
          ${active
            ? 'text-white bg-sidebar-active'
            : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'}
        `}
      >
        {/* Blue left-bar indicator for active */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-secondary-400 rounded-r-full" />
        )}
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-white' : ''}`} />
        {sidebarExpanded && (
          <span className="ml-3 truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f0f4fa] flex">

      {/* ══════════════════════════════════
          Desktop Sidebar
      ══════════════════════════════════ */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => { setIsSidebarHovered(true); if (!isPinned) setIsSidebarCollapsed(false); }}
        onMouseLeave={() => { setIsSidebarHovered(false); if (!isPinned) setIsSidebarCollapsed(true); }}
        className={`
          hidden md:flex flex-col
          bg-sidebar-bg border-r border-sidebar-border
          transition-all duration-300 ease-in-out
          ${sidebarExpanded ? 'w-60' : 'w-[68px]'}
          fixed left-0 top-0 bottom-0 z-40
        `}
        style={{ boxShadow: shadows.sidebar }}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-sidebar-border flex-shrink-0 ${sidebarExpanded ? 'px-4 justify-between' : 'justify-center px-2'}`}>
          {sidebarExpanded ? (
            <>
              <Link to="/dashboard" className="flex items-center space-x-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/10">
                  <img src="icon.png" alt="Logo" className="w-6 h-6 object-contain" onError={e => (e.currentTarget.style.display='none')} />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight truncate" style={{ fontFamily: fonts.display }}>
                    {APP_BRAND_POS_LINE}
                  </p>
                  <p className="text-sidebar-muted text-[10px] leading-tight">Point of Sale</p>
                </div>
              </Link>
              {/* Pin button */}
              <button
                onClick={handleTogglePin}
                aria-pressed={isPinned}
                title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                className={`ml-2 w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${isPinned ? 'text-accent-400 bg-white/10' : 'text-sidebar-muted hover:text-white hover:bg-white/10'}`}
              >
                {isPinned ? <PinIconSolid className="w-4 h-4" /> : <PinIcon className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <Link to="/dashboard">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-white/10">
                <img src="icon.png" alt="Logo" className="w-6 h-6 object-contain" onError={e => (e.currentTarget.style.display='none')} />
              </div>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 sidebar-dark">
          {filteredNavItems.map(item => <NavItem key={item.path} item={item} />)}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
          {sidebarExpanded ? (
            <div className="space-y-3">
              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center text-white font-bold text-sm">
                    {userInitial}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success-400 border-2 border-sidebar-bg rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.fullName || 'User'}</p>
                  <p className="text-sidebar-muted text-xs truncate">{roleLabel}</p>
                </div>
              </div>
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-red-300 hover:text-white hover:bg-red-900/30 rounded-lg transition-colors border border-red-900/20 hover:border-red-700/40"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white font-bold text-xs">
                {userInitial}
              </div>
              <button onClick={handleLogout} title="Sign out" className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-white hover:bg-red-900/30 transition-colors">
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════
          Main Content
      ══════════════════════════════════ */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarExpanded ? 'md:ml-60' : 'md:ml-[68px]'}`}>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-sidebar-bg text-white shadow-lg"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
        </button>

        <TrialBanner />

        {/* Offline sync indicator */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <>
                  <CloudArrowUpIcon className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    {isSyncing ? `Syncing ${pendingCount} pending sale${pendingCount > 1 ? 's' : ''}…` : `${pendingCount} sale${pendingCount > 1 ? 's' : ''} pending sync`}
                  </span>
                </>
              ) : (
                <>
                  <WifiIcon className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Offline — {pendingCount} sale{pendingCount > 1 ? 's' : ''} queued</span>
                </>
              )}
            </div>
            {isOnline && !isSyncing && (
              <button onClick={syncPendingSales} className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
                Sync Now
              </button>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-auto">
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {/* ══════════════════════════════════
          Mobile Sidebar Overlay
      ══════════════════════════════════ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div
            ref={sidebarRef}
            className="fixed top-0 left-0 bottom-0 w-64 flex flex-col overflow-y-auto"
            style={{ background: 'var(--sidebar-bg, #0f1c2e)', boxShadow: shadows.sidebarMobile, animation: 'slideInLeft 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  <img src="icon.png" alt="Logo" className="w-6 h-6 object-contain" onError={e => (e.currentTarget.style.display='none')} />
                </div>
                <p className="text-white text-sm font-semibold" style={{ fontFamily: fonts.display }}>{APP_BRAND_POS_LINE}</p>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="w-7 h-7 rounded-md flex items-center justify-center text-sidebar-muted hover:text-white hover:bg-white/10 transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 sidebar-dark overflow-y-auto">
              {filteredNavItems.map(item => <NavItem key={item.path} item={item} onClick={() => setIsMobileMenuOpen(false)} />)}
            </nav>

            {/* Footer */}
            <div className="border-t border-sidebar-border p-3 flex-shrink-0 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.fullName || 'User'}</p>
                  <p className="text-sidebar-muted text-xs truncate">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-red-300 hover:text-white hover:bg-red-900/30 rounded-lg transition-colors border border-red-900/20"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
