import { useState, useEffect } from 'react';
import { TableSkeleton } from '../components/ui/Skeleton';
import { saleService, Sale, SaleFilters } from '../services/saleService';
import { customerService, Customer } from '../services/customerService';
import { logger } from '../utils/logger';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SalesManagement() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SaleFilters>({
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Load sales
  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.search, filters.customer_id, filters.start_date, filters.end_date, filters.page, filters.limit]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const response = await saleService.getSales(filters);
      setSales(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load sales');
      logger.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleFilterChange = (key: keyof SaleFilters, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Search customers
  const handleCustomerSearch = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }

    try {
      const response = await customerService.getCustomers({ search: query, limit: 10 });
      setCustomerResults(response.data);
    } catch (err: any) {
      logger.error('Error searching customers:', err);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    handleFilterChange('customer_id', customer.customer_id);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const clearCustomerFilter = () => {
    setSelectedCustomer(null);
    handleFilterChange('customer_id', undefined);
  };

  const viewSaleDetails = async (sale: Sale) => {
    try {
      const fullSale = await saleService.getSaleById(sale.sale_id);
      setSelectedSale(fullSale);
      setShowDetailsModal(true);
    } catch (err: any) {
      toast.error('Failed to load sale details');
      logger.error('Error loading sale details:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success" size="sm">Paid</Badge>;
      case 'void':
        return <Badge variant="error" size="sm">Void</Badge>;
      case 'open':
        return <Badge variant="warning" size="sm">Open</Badge>;
      default:
        return <Badge variant="primary" size="sm">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'voucher':
        return 'Voucher';
      case 'other':
        return 'Other';
      default:
        return method;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-secondary-500 rounded-xl shadow-lg p-3 sm:p-4 mb-3 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold">Sales Management</h1>
                <p className="text-white/80 text-xs mt-0.5">View and manage all sales invoices</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold"
            leftIcon={<FunnelIcon className="w-4 h-4" />}
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Search
              </label>
              <Input
                type="text"
                placeholder="Receipt No, Customer, Cashier..."
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="open">Open</option>
                <option value="void">Void</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value || undefined)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value || undefined)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Customer
              </label>
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="text-sm">{selectedCustomer.full_name || 'N/A'}</span>
                    <button
                      onClick={clearCustomerFilter}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      type="text"
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        handleCustomerSearch(e.target.value);
                      }}
                      leftIcon={<UserGroupIcon className="w-4 h-4" />}
                    />
                    {customerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {customerResults.map((customer) => (
                          <button
                            key={customer.customer_id}
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                          >
                            {customer.full_name || 'N/A'}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Sales Table */}
      <Card>
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : sales.length === 0 ? (
          <EmptyState
            icon={<DocumentTextIcon className="w-12 h-12" />}
            title="No sales found"
            description="There are no sales invoices matching your filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Receipt No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.sale_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {sale.receipt_no}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sale.customer?.full_name || 'Walk-in'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(sale.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sale.payments.map(p => getPaymentMethodLabel(p.method)).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(sale.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewSaleDetails(sale)}
                          leftIcon={<EyeIcon className="w-4 h-4" />}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} sales
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Sale Details Modal */}
      {showDetailsModal && selectedSale && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSale(null);
          }}
          title={`Sale Invoice: ${selectedSale.receipt_no}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedSale.created_at)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                <div className="mt-1">{getStatusBadge(selectedSale.status)}</div>
              </div>
              {selectedSale.customer && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Customer</label>
                    <p className="text-sm font-medium text-gray-900">{selectedSale.customer.full_name || 'N/A'}</p>
                  </div>
                  {selectedSale.customer.phone && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
                      <p className="text-sm font-medium text-gray-900">{selectedSale.customer.phone}</p>
                    </div>
                  )}
                </>
              )}
              {selectedSale.cashier_name && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Cashier</label>
                  <p className="text-sm font-medium text-gray-900">{selectedSale.cashier_name}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Items</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedSale.items.map((item) => (
                      <tr key={item.sale_item_id}>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {item.product_name || `Product ID: ${item.product_id.substring(0, 8)}...`}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">{item.qty}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.tax_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(selectedSale.tax_total)}</span>
                  </div>
                )}
                {selectedSale.discount_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-gray-900">-{formatCurrency(selectedSale.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(selectedSale.grand_total)}</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            {selectedSale.payments.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Payments</label>
                <div className="space-y-2">
                  {selectedSale.payments.map((payment) => (
                    <div key={payment.sale_payment_id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="text-gray-600">{getPaymentMethodLabel(payment.method)}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

