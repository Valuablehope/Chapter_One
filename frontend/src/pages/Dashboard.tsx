import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { colors, gradients, fonts } from '../styles/tokens';
import { useAuthStore } from '../store/authStore';
import { reportService } from '../services/reportService';
import { logger } from '../utils/logger';
import {
  BookOpenIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  PresentationChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { APP_BRAND_POS_LINE } from '../constants/branding';
import { StatCardSkeleton } from '../components/ui/Skeleton';

interface DashboardStats {
  todayRevenue: number;
  todayTransactions: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    todayTransactions: 0,
    totalProducts: 0,
    totalCustomers: 0,
    lowStockCount: 0,
  });

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const [salesSummary, lowStock] = await Promise.all([
        reportService.getSalesSummary({ start_date: today, end_date: today, limit: 1 }),
        reportService.getLowStockReport(undefined, 10),
      ]);
      setStats({
        todayRevenue:     salesSummary[0]?.total_revenue   || 0,
        todayTransactions: salesSummary[0]?.transaction_count || 0,
        totalProducts:    0,
        totalCustomers:   0,
        lowStockCount:    lowStock.length,
      });
    } catch (err: any) {
      logger.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const formatCurrency = useCallback((amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount), []);

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const statCards = useMemo(() => [
    {
      title: "Today's Revenue",
      value: loading ? null : formatCurrency(stats.todayRevenue),
      icon: CurrencyDollarIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: 'View full report →',
      link: '/reports',
    },
    {
      title: 'Transactions',
      value: loading ? null : String(stats.todayTransactions),
      icon: ShoppingCartIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: 'Today',
      link: '/sales',
    },
    {
      title: 'Low Stock Items',
      value: loading ? null : String(stats.lowStockCount),
      icon: stats.lowStockCount > 0 ? ExclamationTriangleIcon : BookOpenIcon,
      accent: stats.lowStockCount > 0 ? colors.warning : colors.brand,
      accentBg: stats.lowStockCount > 0 ? colors.warningLight : colors.brandLight,
      sub: stats.lowStockCount > 0 ? 'Needs attention' : 'Stock is healthy',
      link: '/products',
      alert: stats.lowStockCount > 0,
    },
    {
      title: 'Avg. Order Value',
      value: loading ? null : (stats.todayTransactions > 0
        ? formatCurrency(stats.todayRevenue / stats.todayTransactions)
        : '—'),
      icon: ArrowTrendingUpIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: 'Today',
      link: '/reports',
    },
  ], [loading, stats, formatCurrency]);

  const quickLinks = useMemo(() => [
    { to: '/products',   label: 'Products',         icon: BookOpenIcon,           description: 'Manage your catalogue' },
    { to: '/sales',      label: 'POS — New Sale',   icon: CreditCardIcon,         description: 'Process a transaction', highlight: true },
    { to: '/purchases',  label: 'Purchases',        icon: TruckIcon,              description: 'Purchase orders' },
    { to: '/customers',  label: 'Customers',        icon: UserGroupIcon,          description: 'Customer accounts' },
    { to: '/suppliers',  label: 'Suppliers',        icon: BuildingOfficeIcon,     description: 'Supplier directory' },
    { to: '/reports',    label: 'Reports',          icon: PresentationChartBarIcon, description: 'Analytics & insights' },
  ], []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Welcome Banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl text-white px-6 py-7"
        style={{ background: gradients.brand }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10" style={{ background: colors.brandAccent }} />
        <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full opacity-[0.06]" style={{ background: colors.brandAccent }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-green-300/80 text-sm font-medium mb-1">
              {getGreeting()}, {firstName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight" style={{ fontFamily: fonts.display }}>
              Welcome to {APP_BRAND_POS_LINE}
            </h1>
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-white/60 text-sm">Signed in as</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md capitalize" style={{ background: 'rgba(147,197,253,0.20)', color: colors.brandAccentText }}>
                {user?.role}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
            <ClockIcon className="w-4 h-4 text-green-300/70" />
            <span className="text-sm font-medium text-white/80">{today}</span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Link
                  key={i}
                  to={card.link}
                  className="group bg-white rounded-xl border border-[#e2e8f0] hover:border-secondary-200 hover:shadow-medium transition-all duration-200 overflow-hidden animate-card-in"
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  {/* Top accent bar */}
                  <div className="h-1 w-full" style={{ background: card.accent }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 rounded-lg" style={{ background: card.accentBg }}>
                        <Icon className="w-5 h-5" style={{ color: card.accent }} />
                      </div>
                      {card.alert && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mb-3 tabular-nums">
                      {card.value ?? '—'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: card.accent }}>{card.sub}</span>
                      <ArrowRightIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>

      {/* ── Quick Access ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900" style={{ fontFamily: fonts.display }}>
              Quick Access
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Jump to any module</p>
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`group flex items-center space-x-4 p-4 rounded-xl border transition-all duration-200 animate-card-in ${
                  link.highlight
                    ? 'border-secondary-300 bg-secondary-50 hover:bg-secondary-100 hover:border-secondary-400'
                    : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-gray-50 hover:border-gray-300'
                }`}
                style={{ animationDelay: `${(i + 4) * 0.06}s` }}
              >
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${link.highlight ? 'bg-secondary-500' : 'bg-gray-100 group-hover:bg-gray-200'} transition-colors`}>
                  <Icon className={`w-5 h-5 ${link.highlight ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${link.highlight ? 'text-secondary-700' : 'text-gray-800'}`}>
                    {link.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{link.description}</p>
                </div>
                <ArrowRightIcon className={`w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${link.highlight ? 'text-secondary-500' : 'text-gray-400'}`} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Performance Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's performance */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0]">
            <h2 className="text-sm font-semibold text-gray-900" style={{ fontFamily: fonts.display }}>Today's Performance</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: colors.brandLight }}>
              <div>
                <p className="text-xs font-medium text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-secondary-600 mt-0.5 tabular-nums">
                  {loading ? '—' : formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-secondary-100">
                <ArrowTrendingUpIcon className="w-6 h-6 text-secondary-500" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <div>
                <p className="text-xs font-medium text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-800 mt-0.5 tabular-nums">
                  {loading ? '—' : stats.todayTransactions}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-100">
                <ShoppingCartIcon className="w-6 h-6 text-gray-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Stock alert */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0]">
            <h2 className="text-sm font-semibold text-gray-900" style={{ fontFamily: fonts.display }}>Inventory Status</h2>
          </div>
          <div className="p-5 flex flex-col items-center justify-center h-[calc(100%-57px)] min-h-[140px]">
            {loading ? (
              <div className="text-gray-400 text-sm">Loading…</div>
            ) : stats.lowStockCount === 0 ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-3">
                  <BookOpenIcon className="w-6 h-6 text-success-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All stock levels healthy</p>
                <p className="text-xs text-gray-400 mt-1">No items below threshold</p>
              </div>
            ) : (
              <Link to="/products" className="text-center group">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  <span className="text-amber-600 font-bold">{stats.lowStockCount}</span> item{stats.lowStockCount > 1 ? 's' : ''} running low
                </p>
                <p className="text-xs text-secondary-500 mt-1.5 group-hover:underline underline-offset-2">Review inventory →</p>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
