import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { reportService } from '../services/reportService';
import { logger } from '../utils/logger';
import {
  CubeIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
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
      
      // Get today's sales summary
      const salesSummary = await reportService.getSalesSummary({
        start_date: today,
        end_date: today,
        limit: 1,
      });

      // Get low stock items
      const lowStock = await reportService.getLowStockReport(undefined, 10);

      setStats({
        todayRevenue: salesSummary[0]?.total_revenue || 0,
        todayTransactions: salesSummary[0]?.transaction_count || 0,
        totalProducts: 0,
        totalCustomers: 0,
        lowStockCount: lowStock.length,
      });
    } catch (err: any) {
      logger.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const statCards = useMemo(() => [
    {
      title: "Today's Revenue",
      value: loading ? '...' : formatCurrency(stats.todayRevenue),
      icon: CurrencyDollarIcon,
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-500',
      trend: '+12.5%',
      trendColor: 'text-secondary-500',
      link: '/reports',
    },
    {
      title: 'Transactions',
      value: loading ? '...' : stats.todayTransactions,
      icon: ShoppingCartIcon,
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-500',
      trend: 'Today',
      trendColor: 'text-secondary-500',
      link: '/sales',
    },
    {
      title: 'Low Stock Items',
      value: loading ? '...' : stats.lowStockCount,
      icon: CubeIcon,
      iconBg: stats.lowStockCount > 0 ? 'bg-warning-100' : 'bg-secondary-100',
      iconColor: stats.lowStockCount > 0 ? 'text-warning-600' : 'text-secondary-500',
      trend: stats.lowStockCount > 0 ? 'Needs attention' : 'All good',
      trendColor: stats.lowStockCount > 0 ? 'text-warning-600' : 'text-secondary-500',
      link: '/products',
      alert: stats.lowStockCount > 0,
    },
    {
      title: 'Quick Actions',
      value: '6',
      icon: SparklesIcon,
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-500',
      trend: 'Available',
      trendColor: 'text-secondary-500',
      link: '/sales',
    },
  ], [loading, stats.todayRevenue, stats.todayTransactions, stats.lowStockCount, formatCurrency]);

  const quickLinks = useMemo(() => [
    {
      to: '/products',
      label: 'Products',
      icon: CubeIcon,
      description: 'Manage inventory',
      count: stats.totalProducts,
    },
    {
      to: '/sales',
      label: 'POS Sales',
      icon: CurrencyDollarIcon,
      description: 'Process sales',
      highlight: true,
    },
    {
      to: '/purchases',
      label: 'Purchases',
      icon: ShoppingCartIcon,
      description: 'Manage orders',
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: UserGroupIcon,
      description: 'View customers',
      count: stats.totalCustomers,
    },
    {
      to: '/suppliers',
      label: 'Suppliers',
      icon: BuildingOfficeIcon,
      description: 'Manage suppliers',
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: ChartBarIcon,
      description: 'View analytics',
    },
  ], [stats.totalProducts, stats.totalCustomers]);

  return (
    <div className="space-y-4">
      {/* Enhanced Welcome Section */}
      <div className="relative overflow-hidden bg-secondary-500 rounded-xl shadow-xl p-3 sm:p-4 md:p-5 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-white/90 text-sm md:text-base font-medium mb-1">
                {getGreeting()}, {user?.fullName?.split(' ')[0] || 'User'} 👋
              </p>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-1">
                Welcome to {localStorage.getItem('store-name') || 'Supermarket'} POS
              </h1>
              <p className="text-white/80 text-xs sm:text-sm">
                You are logged in as <span className="font-bold capitalize bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm">{user?.role}</span>
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <ClockIcon className="w-4 h-4" />
              <span className="font-semibold text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Enhanced */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))
        ) : (
          statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link
              key={index}
              to={card.link}
              className="group relative overflow-hidden bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border border-gray-100 animate-card-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Subtle Background Overlay */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-secondary-100 opacity-5 group-hover:opacity-10 transition-opacity rounded-full blur-2xl -mr-12 -mt-12"></div>
              
              <div className="relative p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${card.iconBg} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  {card.alert && (
                    <span className="px-1.5 py-0.5 bg-warning-100 text-warning-600 text-[10px] font-bold rounded-full animate-pulse">
                      !
                    </span>
                  )}
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">{card.title}</p>
                  <p className={`text-2xl font-extrabold ${card.iconColor} mb-2`}>
                    {card.value}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${card.trendColor}`}>
                      {card.trend}
                    </span>
                    <ArrowRightIcon className={`w-3 h-3 ${card.trendColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })
        )}
      </div>

      {/* Quick Links - Enhanced */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 flex items-center space-x-1.5">
            <SparklesIcon className="w-4 h-4 text-secondary-500" />
            <span>Quick Access</span>
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">Navigate to key features instantly</p>
        </div>
        
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] animate-card-in ${
                    link.highlight
                      ? 'border-2 border-orange-400/60 bg-orange-200/70'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  style={{ animationDelay: `${(index + 4) * 0.1}s` }}
                >
                  {/* Subtle Background on Hover */}
                  <div className="absolute inset-0 bg-secondary-50 opacity-0 group-hover:opacity-5 transition-opacity"></div>
                  
                  <div className="relative p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-secondary-500 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      {link.count !== undefined && (
                        <span className="px-1.5 py-0.5 bg-secondary-500 text-white text-[10px] font-bold rounded-full">
                          {link.count}
                        </span>
                      )}
                      {link.highlight && (
                        <span className="px-1.5 py-0.5 bg-secondary-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                          Popular
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-sm font-bold text-gray-900 mb-0.5 group-hover:text-gray-700">
                      {link.label}
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">{link.description}</p>
                    
                    <div className="flex items-center text-xs font-semibold text-gray-700 group-hover:text-gray-900">
                      <span>Open</span>
                      <ArrowRightIcon className="w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-1.5">
              <ClockIcon className="w-4 h-4 text-orange-500" />
              <span>Recent Activity</span>
            </h2>
          </div>
          <div className="p-4">
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-sm">No recent activity</p>
              <p className="text-xs">Activity will appear here</p>
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-1.5">
              <ChartBarIcon className="w-4 h-4 text-blue-500" />
              <span>Performance Summary</span>
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg border border-secondary-200">
                <div>
                  <p className="text-xs font-medium text-gray-600">Today's Performance</p>
                  <p className="text-xl font-bold text-secondary-500 mt-0.5">
                    {loading ? '...' : formatCurrency(stats.todayRevenue)}
                  </p>
                </div>
                <ArrowTrendingUpIcon className="w-6 h-6 text-secondary-500" />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-xs font-medium text-gray-600">Transactions Today</p>
                  <p className="text-xl font-bold text-blue-600 mt-0.5">
                    {loading ? '...' : stats.todayTransactions}
                  </p>
                </div>
                <ShoppingCartIcon className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes card-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-card-in {
          animation: card-in 0.6s ease-out both;
        }
      `}</style>
    </div>
  );
}
