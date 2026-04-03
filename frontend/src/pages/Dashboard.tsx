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
import { useTranslation } from '../i18n/I18nContext';

interface DashboardStats {
  todayRevenue: number;
  todayTransactions: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { t, language } = useTranslation();
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
      toast.error(t('dashboard.errors.load_stats'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const formatCurrency = useCallback((amount: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', { style: 'currency', currency: 'USD' }).format(amount), [language]);

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greetings.morning');
    if (h < 18) return t('dashboard.greetings.afternoon');
    return t('dashboard.greetings.evening');
  }, [t]);

  const statCards = useMemo(() => [
    {
      title: t('dashboard.stats.revenue_title'),
      value: loading ? null : formatCurrency(stats.todayRevenue),
      icon: CurrencyDollarIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: t('dashboard.stats.revenue_sub'),
      link: '/reports',
    },
    {
      title: t('dashboard.stats.transactions_title'),
      value: loading ? null : String(stats.todayTransactions),
      icon: ShoppingCartIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: t('dashboard.stats.today'),
      link: '/sales',
    },
    {
      title: t('dashboard.stats.low_stock_title'),
      value: loading ? null : String(stats.lowStockCount),
      icon: stats.lowStockCount > 0 ? ExclamationTriangleIcon : BookOpenIcon,
      accent: stats.lowStockCount > 0 ? colors.warning : colors.brand,
      accentBg: stats.lowStockCount > 0 ? colors.warningLight : colors.brandLight,
      sub: stats.lowStockCount > 0 ? t('dashboard.stats.low_stock_attention') : t('dashboard.stats.low_stock_healthy'),
      link: '/products',
      alert: stats.lowStockCount > 0,
    },
    {
      title: t('dashboard.stats.avg_order_value_title'),
      value: loading ? null : (stats.todayTransactions > 0
        ? formatCurrency(stats.todayRevenue / stats.todayTransactions)
        : '—'),
      icon: ArrowTrendingUpIcon,
      accent: colors.brand,
      accentBg: colors.brandLight,
      sub: t('dashboard.stats.today'),
      link: '/reports',
    },
  ], [loading, stats, formatCurrency, t]);

  const quickLinks = useMemo(() => [
    { to: '/products',   label: t('dashboard.quick_access.products_label'),         icon: BookOpenIcon,           description: t('dashboard.quick_access.products_desc') },
    { to: '/sales',      label: t('dashboard.quick_access.pos_sale_label'),         icon: CreditCardIcon,         description: t('dashboard.quick_access.pos_sale_desc'), highlight: true },
    { to: '/purchases',  label: t('dashboard.quick_access.purchases_label'),        icon: TruckIcon,              description: t('dashboard.quick_access.purchases_desc') },
    { to: '/customers',  label: t('dashboard.quick_access.customers_label'),        icon: UserGroupIcon,          description: t('dashboard.quick_access.customers_desc') },
    { to: '/suppliers',  label: t('dashboard.quick_access.suppliers_label'),        icon: BuildingOfficeIcon,     description: t('dashboard.quick_access.suppliers_desc') },
    { to: '/reports',    label: t('dashboard.quick_access.reports_label'),          icon: PresentationChartBarIcon, description: t('dashboard.quick_access.reports_desc') },
  ], [t]);

  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstName = user?.fullName?.split(' ')[0] || t('dashboard.defaults.user_name_fallback');

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
            <p className="text-white/60 text-sm font-medium mb-1">
              {getGreeting()}, {firstName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight" style={{ fontFamily: fonts.display }}>
              {t('dashboard.welcome', { brand: APP_BRAND_POS_LINE })}
            </h1>
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-white/50 text-sm">{t('dashboard.signed_in_as')}</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md capitalize" style={{ background: 'rgba(147,197,253,0.20)', color: colors.brandAccentText }}>
                {user?.role}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
            <ClockIcon className="w-4 h-4 text-white/50" />
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
                  <div className="h-0.5 w-full" style={{ background: card.accent }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 rounded-xl" style={{ background: card.accentBg }}>
                        <Icon className="w-5 h-5" style={{ color: card.accent }} />
                      </div>
                      {card.alert && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mb-3 tabular-nums leading-none">
                      {card.value ?? '—'}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <span className="text-[11px] font-medium" style={{ color: card.accent }}>{card.sub}</span>
                      <ArrowRightIcon className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>

      {/* ── Quick Access ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">{t('dashboard.quick_access.title')}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wider font-medium">{t('dashboard.quick_access.subtitle')}</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`group flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-200 animate-card-in ${
                  link.highlight
                    ? 'border-secondary-200 bg-gradient-to-br from-secondary-50 to-blue-50 hover:border-secondary-300 hover:shadow-sm'
                    : 'border-[#e8ecf0] bg-[#f8fafc] hover:bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                style={{ animationDelay: `${(i + 4) * 0.06}s` }}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-150 ${
                  link.highlight
                    ? 'bg-secondary-500 group-hover:bg-secondary-600 shadow-sm'
                    : 'bg-white border border-gray-200 group-hover:border-gray-300 group-hover:shadow-sm'
                }`}>
                  <Icon className={`w-4.5 h-4.5 w-[18px] h-[18px] ${link.highlight ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate leading-tight ${link.highlight ? 'text-secondary-700' : 'text-gray-800'}`}>
                    {link.label}
                  </p>
                  <p className={`text-[11px] truncate mt-0.5 ${link.highlight ? 'text-secondary-500' : 'text-gray-400'}`}>{link.description}</p>
                </div>
                <ArrowRightIcon className={`w-3.5 h-3.5 flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ${link.highlight ? 'text-secondary-400' : 'text-gray-300'}`} />
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
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">{t('dashboard.performance.title')}</h2>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5 uppercase tracking-wider">{new Date().toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <div className="p-5 space-y-3">
            {/* Revenue row */}
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: colors.brandLight }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-400 mb-1">{t('dashboard.performance.revenue')}</p>
                <p className="text-2xl font-bold text-secondary-700 tabular-nums leading-none">
                  {loading ? '—' : formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary-100">
                <ArrowTrendingUpIcon className="w-5 h-5 text-secondary-500" />
              </div>
            </div>
            {/* Transactions + AOV row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col p-4 rounded-xl bg-[#f8fafc] border border-[#e8ecf0]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{t('dashboard.performance.transactions')}</p>
                <p className="text-2xl font-bold text-gray-800 tabular-nums leading-none">
                  {loading ? '—' : stats.todayTransactions}
                </p>
                <div className="mt-2">
                  <ShoppingCartIcon className="w-4 h-4 text-gray-300" />
                </div>
              </div>
              <div className="flex flex-col p-4 rounded-xl bg-[#f8fafc] border border-[#e8ecf0]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{t('dashboard.performance.avg_order')}</p>
                <p className="text-2xl font-bold text-gray-800 tabular-nums leading-none">
                  {loading ? '—' : (stats.todayTransactions > 0
                    ? formatCurrency(stats.todayRevenue / stats.todayTransactions)
                    : '—')}
                </p>
                <div className="mt-2">
                  <CurrencyDollarIcon className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Status */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e2e8f0]">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">{t('dashboard.inventory.title')}</h2>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5 uppercase tracking-wider">{t('dashboard.inventory.subtitle')}</p>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center h-[140px]">
                <div className="text-gray-400 text-sm">{t('dashboard.inventory.loading')}</div>
              </div>
            ) : stats.lowStockCount === 0 ? (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <BookOpenIcon className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{t('dashboard.inventory.all_healthy')}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{t('dashboard.inventory.no_low_items')}</p>
                </div>
              </div>
            ) : (
              <Link to="/products" className="group flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-300 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    {t('dashboard.inventory.low_items_running', { count: stats.lowStockCount })}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5 group-hover:underline underline-offset-2">{t('dashboard.inventory.review_inventory')}</p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}
            {/* Stock health bar */}
            {!loading && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.inventory.stock_health')}</span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {stats.lowStockCount === 0 ? '100%' : `${Math.max(0, 100 - stats.lowStockCount * 10)}%`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${stats.lowStockCount === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: stats.lowStockCount === 0 ? '100%' : `${Math.max(10, 100 - stats.lowStockCount * 10)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
