import { useState, useEffect } from 'react';
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
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CubeIcon,
  CalendarIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
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

type ReportTab = 'sales' | 'purchases' | 'inventory';
type SalesReportType = 'summary' | 'products' | 'customers' | 'payment-methods';
type PurchaseReportType = 'summary' | 'suppliers';
type InventoryReportType = 'stock' | 'low-stock';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [salesReportType, setSalesReportType] = useState<SalesReportType>('summary');
  const [purchaseReportType, setPurchaseReportType] = useState<PurchaseReportType>('summary');
  const [inventoryReportType, setInventoryReportType] = useState<InventoryReportType>('stock');
  const [loading, setLoading] = useState(false);

  // Date filters
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

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
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, salesReportType, purchaseReportType, inventoryReportType, startDate, endDate]);

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
  const totalRevenue = salesSummary.reduce((sum, item) => sum + Number(item.total_revenue || 0), 0);
  const totalTransactions = salesSummary.reduce((sum, item) => sum + (item.transaction_count || 0), 0);
  const totalCost = purchaseSummary.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const totalPOs = purchaseSummary.reduce((sum, item) => sum + (item.po_count || 0), 0);

  // Chart colors
  const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <ChartBarIcon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Reports & Analytics</h1>
                <p className="text-cyan-50 text-xs sm:text-sm mt-1">View sales, purchases, and inventory insights</p>
              </div>
            </div>
          </div>
          <Button
            onClick={loadReport}
            className="bg-white !text-cyan-700 hover:bg-cyan-50 font-semibold shadow-lg hover:shadow-xl transition-all"
            leftIcon={<ArrowPathIcon className="w-5 h-5 !text-cyan-700" />}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card padding="none" className="border-2 border-gray-100 shadow-lg">

        {/* Enhanced Tabs */}
        <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <nav className="flex -mb-px px-6">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'sales'
                  ? 'border-green-500 text-green-600 bg-gradient-to-b from-green-50 to-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CurrencyDollarIcon className="w-5 h-5" />
              Sales Reports
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'purchases'
                  ? 'border-orange-500 text-orange-600 bg-gradient-to-b from-orange-50 to-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <ShoppingCartIcon className="w-5 h-5" />
              Purchase Reports
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'border-emerald-500 text-emerald-600 bg-gradient-to-b from-emerald-50 to-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CubeIcon className="w-5 h-5" />
              Inventory Reports
            </button>
          </nav>
        </div>

        {/* Enhanced Filters */}
        {(activeTab === 'sales' || activeTab === 'purchases') && (
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b-2 border-gray-200 bg-white">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                    className="w-64 pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all bg-white font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                    className="w-64 pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all bg-white font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Content */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="space-y-6">
                  {/* Enhanced Summary Cards */}
                  {salesReportType === 'summary' && salesSummary.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50 shadow-lg hover:shadow-xl transition-all" padding="none">
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 mb-2">Total Revenue</p>
                              <p className="text-3xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                {formatCurrency(totalRevenue)}
                              </p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
                              <CurrencyDollarIcon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                      <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50 shadow-lg hover:shadow-xl transition-all" padding="none">
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 mb-2">Total Transactions</p>
                              <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                                {totalTransactions}
                              </p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                              <ShoppingCartIcon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                      <Card className="border-2 border-cyan-200 bg-gradient-to-br from-white to-cyan-50 shadow-lg hover:shadow-xl transition-all" padding="none">
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 mb-2">Average per Transaction</p>
                              <p className="text-3xl font-extrabold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                                {totalTransactions > 0 ? formatCurrency(totalRevenue / totalTransactions) : formatCurrency(0)}
                              </p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
                              <ChartBarIcon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => setSalesReportType('summary')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        salesReportType === 'summary'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setSalesReportType('products')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        salesReportType === 'products'
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      By Product
                    </button>
                    <button
                      onClick={() => setSalesReportType('customers')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        salesReportType === 'customers'
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-sky-300 hover:bg-sky-50'
                      }`}
                    >
                      By Customer
                    </button>
                    <button
                      onClick={() => setSalesReportType('payment-methods')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        salesReportType === 'payment-methods'
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      Payment Methods
                    </button>
                  </div>

                  {/* Sales Summary */}
                  {salesReportType === 'summary' && (
                    <div className="space-y-6">
                      {/* Chart */}
                      {salesSummary.length > 0 && (
                        <Card>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={salesSummary}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                              <YAxis tickFormatter={(value) => `$${value}`} />
                              <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
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
                                stroke="#10b981"
                                strokeWidth={2}
                                name="Tax"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {/* Enhanced Table */}
                      <Card padding="none" className="border-2 border-gray-100 shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                              <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Transactions</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Revenue</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Tax</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {salesSummary.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-6 py-12">
                                    <EmptyState
                                      icon={<ChartBarIcon className="w-12 h-12" />}
                                      title="No data available"
                                      description="No sales data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                salesSummary.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-all duration-150 hover:bg-green-50/50 ${
                                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                    }`}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                      {formatDate(item.date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                      {item.transaction_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 text-right">
                                      {formatCurrency(item.total_revenue)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
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
                    <div className="space-y-6">
                      {/* Chart */}
                      {productSales.length > 0 && (
                        <Card>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={productSales.slice(0, 10)}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                              <YAxis dataKey="product_name" type="category" width={150} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                  Product
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Quantity Sold
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Revenue
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Sales Count
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productSales.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-6 py-12">
                                    <EmptyState
                                      icon={<CubeIcon className="w-12 h-12" />}
                                      title="No data available"
                                      description="No product sales data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                productSales.map((item, idx) => (
                                  <tr
                                    key={item.product_id}
                                    className={`transition-colors duration-150 ${
                                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-primary-50`}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                      {item.product_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                      {item.total_quantity}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600 text-right">
                                      {formatCurrency(item.total_revenue)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
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
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Customer
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Orders
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Total Spent
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Last Order
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {customerSales.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-12">
                                  <EmptyState
                                    icon={<ChartBarIcon className="w-12 h-12" />}
                                    title="No data available"
                                    description="No customer sales data found for the selected date range"
                                  />
                                </td>
                              </tr>
                            ) : (
                              customerSales.map((item, idx) => (
                                <tr
                                  key={item.customer_id}
                                  className={`transition-colors duration-150 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-primary-50`}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {item.customer_name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                    {item.total_orders}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600 text-right">
                                    {formatCurrency(item.total_spent)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                    <div className="space-y-6">
                      {/* Pie Chart */}
                      {paymentMethods.length > 0 && (
                        <Card>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Distribution</h3>
                          <ResponsiveContainer width="100%" height={300}>
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
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                  Payment Method
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Transactions
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Total Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {paymentMethods.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-6 py-12">
                                    <EmptyState
                                      icon={<ChartBarIcon className="w-12 h-12" />}
                                      title="No data available"
                                      description="No payment method data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                paymentMethods.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-colors duration-150 ${
                                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-primary-50`}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <Badge variant="primary" size="sm" className="capitalize">
                                        {item.method}
                                      </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                      {item.transaction_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600 text-right">
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
                <div className="space-y-6">
                  {/* Enhanced Summary Cards */}
                  {purchaseReportType === 'summary' && purchaseSummary.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50 shadow-lg hover:shadow-xl transition-all" padding="none">
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 mb-2">Total Cost</p>
                              <p className="text-3xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                {formatCurrency(totalCost)}
                              </p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-lg">
                              <CurrencyDollarIcon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                      <Card className="border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50 shadow-lg hover:shadow-xl transition-all" padding="none">
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-600 mb-2">Purchase Orders</p>
                              <p className="text-3xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                {totalPOs}
                              </p>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                              <ShoppingCartIcon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => setPurchaseReportType('summary')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        purchaseReportType === 'summary'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setPurchaseReportType('suppliers')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        purchaseReportType === 'suppliers'
                          ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      By Supplier
                    </button>
                  </div>

                  {/* Purchase Summary */}
                  {purchaseReportType === 'summary' && (
                    <div className="space-y-6">
                      {/* Chart */}
                      {purchaseSummary.length > 0 && (
                        <Card>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Cost Trend</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={purchaseSummary}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                              <YAxis tickFormatter={(value) => `$${value}`} />
                              <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                  Date
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Purchase Orders
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                  Total Cost
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {purchaseSummary.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-6 py-12">
                                    <EmptyState
                                      icon={<ShoppingCartIcon className="w-12 h-12" />}
                                      title="No data available"
                                      description="No purchase data found for the selected date range"
                                    />
                                  </td>
                                </tr>
                              ) : (
                                purchaseSummary.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`transition-colors duration-150 ${
                                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                    } hover:bg-primary-50`}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {formatDate(item.date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                      {item.po_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-warning-600 text-right">
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
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Supplier
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Orders
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Total Cost
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Last Order
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {supplierPurchases.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-12">
                                  <EmptyState
                                    icon={<ShoppingCartIcon className="w-12 h-12" />}
                                    title="No data available"
                                    description="No supplier purchase data found for the selected date range"
                                  />
                                </td>
                              </tr>
                            ) : (
                              supplierPurchases.map((item, idx) => (
                                <tr
                                  key={item.supplier_id}
                                  className={`transition-colors duration-150 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-primary-50`}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {item.supplier_name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                    {item.total_orders}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-warning-600 text-right">
                                    {formatCurrency(item.total_cost)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                <div className="space-y-6">
                  {/* Enhanced Report Type Selector */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => setInventoryReportType('stock')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        inventoryReportType === 'stock'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      Stock Levels
                    </button>
                    <button
                      onClick={() => setInventoryReportType('low-stock')}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        inventoryReportType === 'low-stock'
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <ExclamationTriangleIcon className="w-4 h-4" />
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
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Product
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Quantity on Hand
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Track Inventory
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {stockReport.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-6 py-12">
                                  <EmptyState
                                    icon={<CubeIcon className="w-12 h-12" />}
                                    title="No data available"
                                    description="No stock data found"
                                  />
                                </td>
                              </tr>
                            ) : (
                              stockReport.map((item, idx) => (
                                <tr
                                  key={item.product_id}
                                  className={`transition-colors duration-150 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-primary-50`}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {item.product_name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                    {item.track_inventory ? item.qty_on_hand : <span className="text-gray-400">N/A</span>}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
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
                        <div className="px-6 py-4 bg-warning-50 border-b border-warning-200">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />
                            <p className="text-sm font-semibold text-warning-800">
                              {lowStock.length} {lowStock.length === 1 ? 'item' : 'items'} need restocking
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Product
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Quantity on Hand
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                                Threshold
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {lowStock.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-12">
                                  <EmptyState
                                    icon={<CubeIcon className="w-12 h-12" />}
                                    title="All items are well stocked"
                                    description="No low stock items found"
                                  />
                                </td>
                              </tr>
                            ) : (
                              lowStock.map((item, idx) => (
                                <tr
                                  key={item.product_id}
                                  className={`transition-colors duration-150 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-warning-50`}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {item.product_name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-error-600 text-right">
                                    {item.qty_on_hand}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                    {item.min_threshold || 10}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
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

