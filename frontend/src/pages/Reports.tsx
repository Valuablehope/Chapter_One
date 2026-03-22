import { useState, useEffect, useMemo } from 'react';
import {
  reportService,
  SalesSummary,
  ProductSalesReport,
  CustomerSalesReport,
  PaymentMethodReport,
  PurchaseSummary,
  SupplierPurchaseReport,
  StockReport,
  LowStockReport,
  ReportFilters,
} from '../services/reportService';
import { logger } from '../utils/logger';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { TableSkeleton, CardSkeleton } from '../components/ui/Skeleton';
import PageBanner from '../components/ui/PageBanner';
import {
  ChartBarIcon,
  PresentationChartBarIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CubeIcon,
  CalendarIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

type ReportTab = 'sales' | 'purchases' | 'inventory';
type SalesReportType = 'summary' | 'products' | 'customers' | 'payment-methods';
type PurchaseReportType = 'summary' | 'suppliers';
type InventoryReportType = 'stock' | 'low-stock';
type DatePreset = 'week' | 'month' | 'quarter' | 'custom';

const DATE_PRESETS: { id: DatePreset; label: string; days?: number }[] = [
  { id: 'week',    label: 'Last Week',    days: 7  },
  { id: 'month',   label: 'Last Month',   days: 30 },
  { id: 'quarter', label: 'Last Quarter', days: 90 },
  { id: 'custom',  label: 'Custom Dates'           },
];

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function presetRange(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  const entry = DATE_PRESETS.find((p) => p.id === preset);
  if (!entry?.days) return { start: toDateStr(today), end: toDateStr(today) };
  const from = new Date(today);
  from.setDate(today.getDate() - entry.days);
  return { start: toDateStr(from), end: toDateStr(today) };
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 text-gray-500 bg-gray-100">
        <MinusIcon className="w-2.5 h-2.5" /> 0%
      </span>
    );
  }
  const isPos = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5
      ${isPos ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      {isPos
        ? <ArrowTrendingUpIcon className="w-2.5 h-2.5" />
        : <ArrowTrendingDownIcon className="w-2.5 h-2.5" />}
      {isPos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function Reports() {
  const { user } = useAuthStore();
  const isCashier = user?.role === 'cashier';
  const [activeTab, setActiveTab] = useState<ReportTab>(isCashier ? 'inventory' : 'sales');
  const [salesReportType, setSalesReportType] = useState<SalesReportType>('summary');
  const [purchaseReportType, setPurchaseReportType] = useState<PurchaseReportType>('summary');
  const [inventoryReportType, setInventoryReportType] = useState<InventoryReportType>('stock');
  const [loading, setLoading] = useState(false);

  // Date preset + custom range
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState<string>(presetRange('month').start);
  const [endDate,   setEndDate]   = useState<string>(presetRange('month').end);

  const handlePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { start, end } = presetRange(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Report data
  const [salesSummary, setSalesSummary] = useState<SalesSummary[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesReport[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSalesReport[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodReport[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseReport[]>([]);
  const [stockReport, setStockReport] = useState<StockReport[]>([]);
  const [lowStock, setLowStock] = useState<LowStockReport[]>([]);

  const loadReport = async () => {
    setLoading(true);

    try {
      const filters: ReportFilters = {
        start_date: startDate,
        end_date: endDate,
        limit: 100,
      };

      if (activeTab === 'sales') {
        switch (salesReportType) {
          case 'summary':
            const summary = await reportService.getSalesSummary(filters);
            setSalesSummary(summary);
            break;
          case 'products':
            const products = await reportService.getProductSales(filters);
            setProductSales(products);
            break;
          case 'customers':
            const customers = await reportService.getCustomerSales(filters);
            setCustomerSales(customers);
            break;
          case 'payment-methods':
            const payments = await reportService.getPaymentMethodReport(filters);
            setPaymentMethods(payments);
            break;
        }
      } else if (activeTab === 'purchases') {
        switch (purchaseReportType) {
          case 'summary':
            const summary = await reportService.getPurchaseSummary(filters);
            setPurchaseSummary(summary);
            break;
          case 'suppliers':
            const suppliers = await reportService.getSupplierPurchases(filters);
            setSupplierPurchases(suppliers);
            break;
        }
      } else if (activeTab === 'inventory') {
        switch (inventoryReportType) {
          case 'stock':
            const stock = await reportService.getStockReport();
            setStockReport(stock);
            break;
          case 'low-stock':
            const low = await reportService.getLowStockReport(undefined, 10);
            setLowStock(low);
            break;
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load report');
      logger.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Redirect cashiers to inventory tab if they try to access other tabs
    if (isCashier && activeTab !== 'inventory') {
      setActiveTab('inventory');
      return;
    }
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, salesReportType, purchaseReportType, inventoryReportType, startDate, endDate, isCashier]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate summary totals for cards
  const totalRevenue = useMemo(() => salesSummary.reduce((sum, item) => sum + Number(item.total_revenue || 0), 0), [salesSummary]);
  const totalTransactions = useMemo(() => salesSummary.reduce((sum, item) => sum + Number(item.transaction_count || 0), 0), [salesSummary]);
  const totalCost = useMemo(() => purchaseSummary.reduce((sum, item) => sum + Number(item.total_cost || 0), 0), [purchaseSummary]);
  const totalPOs = useMemo(() => purchaseSummary.reduce((sum, item) => sum + Number(item.po_count || 0), 0), [purchaseSummary]);

  // Trend: compare second half of period vs first half
  const trend = useMemo(() => {
    if (salesSummary.length < 2) return { revenue: 0, transactions: 0, avgOrder: 0 };
    const mid = Math.floor(salesSummary.length / 2);
    const first  = salesSummary.slice(0, mid);
    const second = salesSummary.slice(mid);
    const rev1 = first.reduce((s, d)  => s + Number(d.total_revenue   || 0), 0);
    const rev2 = second.reduce((s, d) => s + Number(d.total_revenue   || 0), 0);
    const tx1  = first.reduce((s, d)  => s + Number(d.transaction_count || 0), 0);
    const tx2  = second.reduce((s, d) => s + Number(d.transaction_count || 0), 0);
    const avg1 = tx1 > 0 ? rev1 / tx1 : 0;
    const avg2 = tx2 > 0 ? rev2 / tx2 : 0;
    const pct  = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : 0);
    return { revenue: pct(rev1, rev2), transactions: pct(tx1, tx2), avgOrder: pct(avg1, avg2) };
  }, [salesSummary]);

  // Chart colors - using secondary color variations and semantic colors
  const CHART_COLORS = ['#3582e2', '#2a68b5', '#3582e2', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <>
      <PageBanner
        title="Reports & Analytics"
        subtitle="View sales, purchases, and inventory insights"
        icon={<PresentationChartBarIcon className="w-5 h-5 text-white" />}
        action={
          <Button
            onClick={loadReport}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold"
            leftIcon={<ArrowPathIcon className="w-4 h-4" />}
            isLoading={loading}
          >
            Refresh
          </Button>
        }
      />

      <Card padding="none" className="border-2 border-gray-100 shadow-md">

        {/* Enhanced Tabs */}
        <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <nav className="flex -mb-px px-3">
            {!isCashier && (
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${activeTab === 'sales'
                  ? 'border-secondary-500 text-secondary-600 bg-secondary-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
              >
                <CurrencyDollarIcon className="w-4 h-4" />
                Sales Reports
              </button>
            )}
            {!isCashier && (
              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${activeTab === 'purchases'
                  ? 'border-secondary-500 text-secondary-600 bg-secondary-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
              >
                <ShoppingCartIcon className="w-4 h-4" />
                Purchase Reports
              </button>
            )}
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${activeTab === 'inventory'
                ? 'border-secondary-500 text-secondary-600 bg-secondary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
            >
              <CubeIcon className="w-4 h-4" />
              Inventory Reports
            </button>
          </nav>
        </div>

        {/* Date Range Filter */}
        {(activeTab === 'sales' || activeTab === 'purchases') && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-white">
            <div className="flex flex-wrap items-center gap-3">

              {/* Preset pills */}
              <div className="flex gap-1.5 flex-wrap">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap
                      ${datePreset === p.id
                        ? 'bg-secondary-500 text-white shadow-sm'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-secondary-300 hover:text-secondary-600 hover:bg-secondary-50'
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-gray-200 hidden sm:block" />

              {/* Custom date pickers */}
              {datePreset === 'custom' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
                      className="pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500 bg-white w-36 font-medium text-gray-700"
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">→</span>
                  <div className="relative">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
                      className="pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500 bg-white w-36 font-medium text-gray-700"
                    />
                  </div>
                </div>
              ) : (
                /* Active range label */
                <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                  {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' — '}
                  {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Report Content */}
        <div className="p-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
              <TableSkeleton rows={8} columns={5} />
            </div>
          ) : (
            <>
              {/* Sales Reports */}
              {activeTab === 'sales' && (
                <div className="space-y-4">
                  {/* Premium Summary Cards */}
                  {salesReportType === 'summary' && salesSummary.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Revenue */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        <div className="h-1 w-full bg-secondary-500" />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-secondary-50">
                              <CurrencyDollarIcon className="w-4 h-4 text-secondary-500" />
                            </div>
                            <TrendBadge pct={trend.revenue} />
                          </div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Revenue</p>
                          <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">
                            {formatCurrency(totalRevenue)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1.5">vs prior half of period</p>
                        </div>
                      </div>

                      {/* Transactions */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        <div className="h-1 w-full bg-indigo-500" />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-indigo-50">
                              <ShoppingCartIcon className="w-4 h-4 text-indigo-500" />
                            </div>
                            <TrendBadge pct={trend.transactions} />
                          </div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Transactions</p>
                          <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">
                            {totalTransactions.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1.5">vs prior half of period</p>
                        </div>
                      </div>

                      {/* Avg Order Value */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        <div className="h-1 w-full bg-amber-400" />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-amber-50">
                              <ChartBarIcon className="w-4 h-4 text-amber-500" />
                            </div>
                            <TrendBadge pct={trend.avgOrder} />
                          </div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Avg. Order Value</p>
                          <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">
                            {totalTransactions > 0 ? formatCurrency(totalRevenue / totalTransactions) : '—'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1.5">vs prior half of period</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setSalesReportType('summary')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${salesReportType === 'summary'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setSalesReportType('products')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${salesReportType === 'products'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      By Product
                    </button>
                    <button
                      onClick={() => setSalesReportType('customers')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${salesReportType === 'customers'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      By Customer
                    </button>
                    <button
                      onClick={() => setSalesReportType('payment-methods')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${salesReportType === 'payment-methods'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      Payment Methods
                    </button>
                  </div>

                  {/* Sales Summary */}
                  {salesReportType === 'summary' && (
                    <div className="space-y-4">
                      {/* Chart */}
                      {salesSummary.length > 0 && (
                        <Card>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Revenue Trend</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={salesSummary}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                              <YAxis tickFormatter={(value) => `$${value}`} />
                              <Tooltip
                                formatter={(value: any) => formatCurrency(Number(value))}
                                labelFormatter={(label) => formatDate(label)}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="total_revenue"
                                stroke="#6366f1"
                                strokeWidth={2}
                                name="Revenue"
                              />
                              <Line
                                type="monotone"
                                dataKey="total_tax"
                                stroke="#3582e2"
                                strokeWidth={2}
                                name="Tax"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {/* Enhanced Table */}
                      <Card padding="none" className="border-2 border-gray-100 shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Date</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Transactions</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Revenue</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Tax</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {salesSummary.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8">
                                    <EmptyState
                                      icon={<ChartBarIcon className="w-10 h-10" />}
                                      title="No data available"
                                      description="No sales data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                salesSummary.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-all duration-150 hover:bg-secondary-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                      }`}
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900">
                                      {formatDate(item.date)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                      {item.transaction_count}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-secondary-500 text-right">
                                      {formatCurrency(item.total_revenue)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                      {formatCurrency(item.total_tax)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Product Sales */}
                  {salesReportType === 'products' && (
                    <div className="space-y-4">
                      {/* Chart */}
                      {productSales.length > 0 && (
                        <Card>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Products by Revenue</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart
                              data={productSales.slice(0, 10)}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                              <YAxis dataKey="product_name" type="category" width={150} />
                              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                              <Legend />
                              <Bar dataKey="total_revenue" fill="#6366f1" name="Revenue" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {/* Table */}
                      <Card padding="none">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                  Product
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Quantity Sold
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Revenue
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Sales Count
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productSales.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-8">
                                    <EmptyState
                                      icon={<CubeIcon className="w-10 h-10" />}
                                      title="No data available"
                                      description="No product sales data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                productSales.map((item, idx) => (
                                  <tr
                                    key={item.product_id}
                                    className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                      } hover:bg-secondary-50/50`}
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                      {item.product_name}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                      {item.total_quantity}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-secondary-500 text-right">
                                      {formatCurrency(item.total_revenue)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                      {item.sale_count}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Customer Sales */}
                  {salesReportType === 'customers' && (
                    <Card padding="none">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Customer
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Orders
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Total Spent
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Last Order
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {customerSales.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8">
                                  <EmptyState
                                    icon={<ChartBarIcon className="w-10 h-10" />}
                                    title="No data available"
                                    description="No customer sales data found for the selected date range"
                                  />
                                </td>
                              </tr>
                            ) : (
                              customerSales.map((item, idx) => (
                                <tr
                                  key={item.customer_id}
                                  className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-secondary-50/50`}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                    {item.customer_name}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                    {item.total_orders}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-secondary-500 text-right">
                                    {formatCurrency(item.total_spent)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                    {formatDate(item.last_order_date)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* Payment Methods */}
                  {salesReportType === 'payment-methods' && (
                    <div className="space-y-4">
                      {/* Pie Chart */}
                      {paymentMethods.length > 0 && (
                        <Card>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Methods Distribution</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={paymentMethods as any}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(props: any) => {
                                  const { method, percent } = props;
                                  return `${method || 'Unknown'}: ${percent ? (percent * 100).toFixed(0) : 0}%`;
                                }}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="total_amount"
                              >
                                {paymentMethods.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                            </PieChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {/* Table */}
                      <Card padding="none">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                  Payment Method
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Transactions
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Total Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {paymentMethods.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-4 py-8">
                                    <EmptyState
                                      icon={<ChartBarIcon className="w-10 h-10" />}
                                      title="No data available"
                                      description="No payment method data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                paymentMethods.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                      } hover:bg-secondary-50/50`}
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <Badge variant="primary" size="sm" className="capitalize">
                                        {item.method}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                      {item.transaction_count}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-secondary-500 text-right">
                                      {formatCurrency(item.total_amount)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* Purchase Reports */}
              {activeTab === 'purchases' && (
                <div className="space-y-4">
                  {/* Enhanced Summary Cards */}
                  {purchaseReportType === 'summary' && purchaseSummary.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-secondary-200 bg-white shadow-md hover:shadow-lg transition-all" padding="none">
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Total Cost</p>
                              <p className="text-xl font-extrabold text-secondary-500">
                                {formatCurrency(totalCost)}
                              </p>
                            </div>
                            <div className="p-2 bg-secondary-500 rounded-lg shadow-md">
                              <CurrencyDollarIcon className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                      <Card className="border-2 border-secondary-200 bg-white shadow-md hover:shadow-lg transition-all" padding="none">
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Purchase Orders</p>
                              <p className="text-xl font-extrabold text-secondary-500">
                                {totalPOs}
                              </p>
                            </div>
                            <div className="p-2 bg-secondary-500 rounded-lg shadow-md">
                              <ShoppingCartIcon className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setPurchaseReportType('summary')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${purchaseReportType === 'summary'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setPurchaseReportType('suppliers')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${purchaseReportType === 'suppliers'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      By Supplier
                    </button>
                  </div>

                  {/* Purchase Summary */}
                  {purchaseReportType === 'summary' && (
                    <div className="space-y-4">
                      {/* Chart */}
                      {purchaseSummary.length > 0 && (
                        <Card>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Purchase Cost Trend</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={purchaseSummary}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                              <YAxis tickFormatter={(value) => `$${value}`} />
                              <Tooltip
                                formatter={(value: any) => formatCurrency(Number(value))}
                                labelFormatter={(label) => formatDate(label)}
                              />
                              <Legend />
                              <Bar dataKey="total_cost" fill="#f59e0b" name="Total Cost" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {/* Table */}
                      <Card padding="none">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                  Date
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Purchase Orders
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                  Total Cost
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {purchaseSummary.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-4 py-8">
                                    <EmptyState
                                      icon={<ShoppingCartIcon className="w-10 h-10" />}
                                      title="No data available"
                                      description="No purchase data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                purchaseSummary.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                      } hover:bg-secondary-50/50`}
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                      {formatDate(item.date)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                      {item.po_count}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-secondary-500 text-right">
                                      {formatCurrency(item.total_cost)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Supplier Purchases */}
                  {purchaseReportType === 'suppliers' && (
                    <Card padding="none">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Supplier
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Orders
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Total Cost
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Last Order
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {supplierPurchases.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8">
                                  <EmptyState
                                    icon={<ShoppingCartIcon className="w-10 h-10" />}
                                    title="No data available"
                                    description="No supplier purchase data found for the selected date range"
                                  />
                                </td>
                              </tr>
                            ) : (
                              supplierPurchases.map((item, idx) => (
                                <tr
                                  key={item.supplier_id}
                                  className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-secondary-50/50`}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                    {item.supplier_name}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                    {item.total_orders}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-secondary-500 text-right">
                                    {formatCurrency(item.total_cost)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                    {formatDate(item.last_order_date)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Inventory Reports */}
              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setInventoryReportType('stock')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${inventoryReportType === 'stock'
                        ? 'bg-secondary-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-secondary-300 hover:bg-secondary-50'
                        }`}
                    >
                      Stock Levels
                    </button>
                    <button
                      onClick={() => setInventoryReportType('low-stock')}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${inventoryReportType === 'low-stock'
                        ? 'bg-warning-500 text-white shadow-md'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-warning-300 hover:bg-warning-50'
                        }`}
                    >
                      <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                      Low Stock
                    </button>
                  </div>

                  {/* Stock Report */}
                  {inventoryReportType === 'stock' && (
                    <Card padding="none">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Product
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Quantity on Hand
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Track Inventory
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {stockReport.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-4 py-8">
                                  <EmptyState
                                    icon={<CubeIcon className="w-10 h-10" />}
                                    title="No data available"
                                    description="No stock data found"
                                  />
                                </td>
                              </tr>
                            ) : (
                              stockReport.map((item, idx) => (
                                <tr
                                  key={item.product_id}
                                  className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-secondary-50/50`}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                    {item.product_name}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                    {item.track_inventory ? item.qty_on_hand : <span className="text-gray-400">N/A</span>}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <Badge
                                      variant={item.track_inventory ? 'success' : 'gray'}
                                      size="sm"
                                    >
                                      {item.track_inventory ? 'Yes' : 'No'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* Low Stock Report */}
                  {inventoryReportType === 'low-stock' && (
                    <Card padding="none">
                      {lowStock.length > 0 && (
                        <div className="px-3 py-2.5 bg-warning-50 border-b border-warning-200">
                          <div className="flex items-center gap-1.5">
                            <ExclamationTriangleIcon className="w-4 h-4 text-warning-600" />
                            <p className="text-xs font-semibold text-warning-800">
                              {lowStock.length} {lowStock.length === 1 ? 'item' : 'items'} need restocking
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Product
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Quantity on Hand
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase">
                                Threshold
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {lowStock.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8">
                                  <EmptyState
                                    icon={<CubeIcon className="w-10 h-10" />}
                                    title="All items are well stocked"
                                    description="No low stock items found"
                                  />
                                </td>
                              </tr>
                            ) : (
                              lowStock.map((item, idx) => (
                                <tr
                                  key={item.product_id}
                                  className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-warning-50`}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                                    {item.product_name}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-error-600 text-right">
                                    {item.qty_on_hand}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 text-right">
                                    {item.min_threshold || 10}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <Badge variant="error" size="sm">
                                      Low Stock
                                    </Badge>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </>
  );
}

