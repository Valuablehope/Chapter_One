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
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      trend: '+12.5%',
      trendColor: 'text-green-600',
      link: '/reports',
    },
    {
      title: 'Transactions',
      value: loading ? '...' : stats.todayTransactions,
      icon: ShoppingCartIcon,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      trend: 'Today',
      trendColor: 'text-blue-600',
      link: '/sales',
    },
    {
      title: 'Low Stock Items',
      value: loading ? '...' : stats.lowStockCount,
      icon: CubeIcon,
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-50 to-amber-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      trend: stats.lowStockCount > 0 ? 'Needs attention' : 'All good',
      trendColor: stats.lowStockCount > 0 ? 'text-orange-600' : 'text-green-600',
      link: '/products',
      alert: stats.lowStockCount > 0,
    },
    {
      title: 'Quick Actions',
      value: '6',
      icon: SparklesIcon,
      gradient: 'from-cyan-500 to-blue-500',
      bgGradient: 'from-cyan-50 to-blue-50',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      trend: 'Available',
      trendColor: 'text-cyan-600',
      link: '/sales',
    },
  ], [loading, stats.todayRevenue, stats.todayTransactions, stats.lowStockCount, formatCurrency]);

  const quickLinks = useMemo(() => [
    {
      to: '/products',
      label: 'Products',
      icon: CubeIcon,
      gradient: 'from-emerald-500 to-teal-500',
      description: 'Manage inventory',
      count: stats.totalProducts,
    },
    {
      to: '/sales',
      label: 'POS Sales',
      icon: CurrencyDollarIcon,
      gradient: 'from-green-500 to-emerald-500',
      description: 'Process sales',
      highlight: true,
    },
    {
      to: '/purchases',
      label: 'Purchases',
      icon: ShoppingCartIcon,
      gradient: 'from-orange-500 to-amber-500',
      description: 'Manage orders',
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: UserGroupIcon,
      gradient: 'from-sky-500 to-blue-500',
      description: 'View customers',
      count: stats.totalCustomers,
    },
    {
      to: '/suppliers',
      label: 'Suppliers',
      icon: BuildingOfficeIcon,
      gradient: 'from-indigo-500 to-blue-500',
      description: 'Manage suppliers',
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: ChartBarIcon,
      gradient: 'from-cyan-500 to-blue-500',
      description: 'View analytics',
    },
  ], [stats.totalProducts, stats.totalCustomers]);

  return (
    <div className="space-y-8">
      {/* Enhanced Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-white">
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-100 text-lg md:text-xl font-medium mb-2">
                {getGreeting()}, {user?.fullName?.split(' ')[0] || 'User'} 👋
              </p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 sm:mb-3">
                Welcome to Chapter One POS
              </h1>
              <p className="text-blue-50 text-sm sm:text-base md:text-lg">
                You are logged in as <span className="font-bold capitalize bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">{user?.role}</span>
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3">
              <ClockIcon className="w-5 h-5" />
              <span className="font-semibold">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Enhanced */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
              className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-gray-100 animate-card-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient Background Overlay */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-5 group-hover:opacity-10 transition-opacity rounded-full blur-2xl -mr-16 -mt-16`}></div>
              
              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {card.alert && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full animate-pulse">
                      !
                    </span>
                  )}
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{card.title}</p>
                  <p className={`text-3xl font-extrabold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent mb-3`}>
                    {card.value}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${card.trendColor}`}>
                      {card.trend}
                    </span>
                    <ArrowRightIcon className={`w-4 h-4 ${card.trendColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })
        )}
      </div>

      {/* Quick Links - Enhanced */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <SparklesIcon className="w-6 h-6 text-cyan-500" />
            <span>Quick Access</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">Navigate to key features instantly</p>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] animate-card-in ${
                    link.highlight
                      ? 'border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  style={{ animationDelay: `${(index + 4) * 0.1}s` }}
                >
                  {/* Gradient Background on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                  
                  <div className="relative p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${link.gradient} shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      {link.count !== undefined && (
                        <span className={`px-2.5 py-1 bg-gradient-to-r ${link.gradient} text-white text-xs font-bold rounded-full`}>
                          {link.count}
                        </span>
                      )}
                      {link.highlight && (
                        <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                          Popular
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-gray-700">
                      {link.label}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{link.description}</p>
                    
                    <div className="flex items-center text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                      <span>Open</span>
                      <ArrowRightIcon className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <ClockIcon className="w-6 h-6 text-orange-500" />
              <span>Recent Activity</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="text-center py-12 text-gray-500">
              <ClockIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No recent activity</p>
              <p className="text-sm">Activity will appear here</p>
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <ChartBarIcon className="w-6 h-6 text-blue-500" />
              <span>Performance Summary</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Performance</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {loading ? '...' : formatCurrency(stats.todayRevenue)}
                  </p>
                </div>
                <ArrowTrendingUpIcon className="w-8 h-8 text-green-500" />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions Today</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {loading ? '...' : stats.todayTransactions}
                  </p>
                </div>
                <ShoppingCartIcon className="w-8 h-8 text-blue-500" />
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
