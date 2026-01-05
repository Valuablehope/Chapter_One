import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Receipt from '../components/Receipt';
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
  PencilIcon,
  PlusIcon,
  MinusIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { productService, Product } from '../services/productService';
import { storeService, StoreSettings } from '../services/storeService';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editPayments, setEditPayments] = useState<any[]>([]);
  const [editDiscountRate, setEditDiscountRate] = useState(0);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showEditPrintPreview, setShowEditPrintPreview] = useState(false);

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

      // Load store settings for printing
      if (fullSale.store_id) {
        try {
          const settings = await storeService.getStoreSettings(fullSale.store_id);
          logger.info('Store settings loaded for view:', { name: settings.name, code: settings.code, settings });
          setStoreSettings(settings);
        } catch (err) {
          logger.error('Error loading store settings:', err);
        }
      }
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

  // Print receipt
  const handlePrint = () => {
    window.print();
  };

  const openEditModal = async (sale: Sale) => {
    try {
      const fullSale = await saleService.getSaleById(sale.sale_id);
      setEditingSale(fullSale);
      setEditItems(fullSale.items.map(item => ({
        ...item,
        product: null,
      })));
      setEditPayments(fullSale.payments);
      setEditDiscountRate(fullSale.discount_rate || 0);
      // Convert sale customer to full Customer object
      setEditCustomer(fullSale.customer ? {
        ...fullSale.customer,
        email: undefined,
        created_at: '',
        updated_at: '',
      } as Customer : null);
      setShowEditModal(true);

      // Load store settings for printing
      if (fullSale.store_id) {
        try {
          const settings = await storeService.getStoreSettings(fullSale.store_id);
          logger.info('Store settings loaded for edit:', { name: settings.name, code: settings.code, settings });
          setStoreSettings(settings);
        } catch (err) {
          logger.error('Error loading store settings:', err);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load sale for editing');
      logger.error('Error loading sale:', err);
    }
  };

  const handleProductSearch = async (query: string) => {
    if (!query.trim()) {
      setProductResults([]);
      return;
    }
    try {
      const response = await productService.getProducts({ search: query, limit: 10 });
      setProductResults(response.data);
    } catch (err: any) {
      logger.error('Error searching products:', err);
    }
  };

  const addProductToEdit = (product: Product) => {
    const price = Number(product.sale_price || product.list_price || 0);
    const taxRate = Number(product.tax_rate || 0);
    setEditItems([...editItems, {
      product_id: product.product_id,
      product_name: product.name,
      qty: 1,
      unit_price: price,
      tax_rate: taxRate,
      line_total: price * (1 + taxRate / 100),
      product: product,
    }]);
    setProductSearch('');
    setProductResults([]);
  };

  const removeItemFromEdit = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, qty: number) => {
    if (qty <= 0) {
      removeItemFromEdit(index);
      return;
    }
    const newItems = [...editItems];
    const item = newItems[index];
    item.qty = qty;
    item.line_total = item.qty * item.unit_price * (1 + (item.tax_rate || 0) / 100);
    setEditItems(newItems);
  };

  const addPayment = () => {
    setEditPayments([...editPayments, { method: 'cash', amount: 0 }]);
  };

  const removePayment = (index: number) => {
    setEditPayments(editPayments.filter((_, i) => i !== index));
  };

  const calculateEditTotals = () => {
    const subtotal = editItems.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
    const taxTotal = editItems.reduce((sum, item) => {
      const lineTotal = item.qty * item.unit_price;
      return sum + (lineTotal * ((item.tax_rate || 0) / 100));
    }, 0);
    const discountAmount = editDiscountRate > 0
      ? (subtotal + taxTotal) * (editDiscountRate / 100)
      : 0;
    const grandTotal = subtotal + taxTotal - discountAmount;
    const paidTotal = editPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    return { subtotal, taxTotal, discountAmount, grandTotal, paidTotal };
  };

  const handleSaveEdit = async () => {
    if (!editingSale) return;

    const { grandTotal, paidTotal } = calculateEditTotals();
    if (paidTotal < grandTotal) {
      toast.error('Payment amount must be at least equal to grand total');
      return;
    }

    if (editItems.length === 0) {
      toast.error('Sale must have at least one item');
      return;
    }

    if (editPayments.length === 0) {
      toast.error('Sale must have at least one payment');
      return;
    }

    try {
      setSubmitting(true);
      await saleService.updateSale(editingSale.sale_id, {
        customer_id: editCustomer?.customer_id,
        discount_rate: editDiscountRate,
        items: editItems.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
        })),
        payments: editPayments.map(p => ({
          method: p.method,
          amount: p.amount,
        })),
      });
      toast.success('Sale updated successfully');
      setShowEditModal(false);
      setEditingSale(null);
      setEditItems([]);
      setEditPayments([]);
      setEditCustomer(null);
      loadSales();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to update sale');
      }
      logger.error('Error updating sale:', err);
    } finally {
      setSubmitting(false);
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
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewSaleDetails(sale)}
                            leftIcon={<EyeIcon className="w-4 h-4" />}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(sale)}
                            leftIcon={<PencilIcon className="w-4 h-4" />}
                          >
                            Edit
                          </Button>
                        </div>
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
            setShowPrintPreview(false);
          }}
          title={showPrintPreview ? `Print Preview: ${selectedSale.receipt_no}` : `Sale Invoice: ${selectedSale.receipt_no}`}
          size="lg"
          footer={
            <div className="flex gap-3 print:hidden">
              {!showPrintPreview ? (
                <>
                  <Button
                    onClick={() => setShowPrintPreview(true)}
                    className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PrinterIcon className="w-5 h-5" />}
                  >
                    Print Preview
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedSale(null);
                      setShowPrintPreview(false);
                    }}
                  >
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handlePrint}
                    className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PrinterIcon className="w-5 h-5" />}
                  >
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPrintPreview(false)}
                  >
                    Back
                  </Button>
                </>
              )}
            </div>
          }
        >
          {!showPrintPreview ? (
            // Original View Content
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
          ) : (
            // Print Preview
            <div className="h-[600px] overflow-y-auto bg-gray-100 p-4 rounded-lg">
              <Receipt
                settings={storeSettings}
                sale={selectedSale}
                customer={selectedSale.customer as any}
                items={selectedSale.items as any}
              />
              {showPrintPreview && createPortal(
                <div className="hidden print:block fixed inset-0 z-[9999] bg-white print-portal-container">
                  <style>{`
                       @media print {
                         @page { size: auto; margin: 0; }
                         body { margin: 0; padding: 0; }
                         body > * { display: none !important; }
                         body > .print-portal-container { display: block !important; }
                         .print-portal-container { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
                       }
                     `}</style>
                  <Receipt
                    settings={storeSettings}
                    sale={selectedSale}
                    customer={selectedSale.customer as any}
                    items={selectedSale.items as any}
                  />
                </div>,
                document.body
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Edit Sale Modal */}
      {showEditModal && editingSale && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingSale(null);
            setEditItems([]);
            setEditPayments([]);
            setEditCustomer(null);
            setShowEditPrintPreview(false);
          }}
          title={showEditPrintPreview ? `Print Preview: ${editingSale.receipt_no}` : `Edit Sale: ${editingSale.receipt_no}`}
          size="xl"
          footer={
            <div className="flex justify-end gap-3 print:hidden">
              {!showEditPrintPreview ? (
                <>
                  <Button
                    onClick={() => setShowEditPrintPreview(true)}
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PrinterIcon className="w-5 h-5" />}
                  >
                    Print Preview
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSale(null);
                      setEditItems([]);
                      setEditPayments([]);
                      setEditCustomer(null);
                      setShowEditPrintPreview(false);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    isLoading={submitting}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handlePrint}
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    leftIcon={<PrinterIcon className="w-5 h-5" />}
                  >
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowEditPrintPreview(false)}
                  >
                    Back
                  </Button>
                </>
              )}
            </div>
          }
        >
          {!showEditPrintPreview ? (
            // Editable Form
            <div className="space-y-4">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Customer</label>
                {editCustomer ? (
                  <div className="flex items-center justify-between p-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span>{editCustomer.full_name}</span>
                    <button onClick={() => setEditCustomer(null)}>
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
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
                )}
                {customerResults.length > 0 && !editCustomer && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.customer_id}
                        onClick={() => {
                          setEditCustomer(customer);
                          setCustomerSearch('');
                          setCustomerResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        {customer.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Items</label>

                {/* Product Search */}
                <div className="mb-3">
                  <Input
                    type="text"
                    placeholder="Search products to add..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      handleProductSearch(e.target.value);
                    }}
                    leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
                  />
                  {productResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                      {productResults.map((product) => (
                        <button
                          key={product.product_id}
                          onClick={() => addProductToEdit(product)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          {product.name} - {formatCurrency(product.sale_price || product.list_price || 0)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold">Product</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold">Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-sm">{item.product_name || 'Product'}</td>
                          <td className="px-3 py-2 text-sm text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => updateItemQuantity(index, item.qty - 1)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <MinusIcon className="w-4 h-4" />
                              </button>
                              <span>{item.qty}</span>
                              <button
                                onClick={() => updateItemQuantity(index, item.qty + 1)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-sm text-right font-semibold">
                            {formatCurrency(item.line_total)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removeItemFromEdit(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payments</label>
                <Button
                  size="sm"
                  onClick={addPayment}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                  className="mb-2"
                >
                  Add Payment
                </Button>
                <div className="space-y-2">
                  {editPayments.map((payment, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                      <select
                        value={payment.method}
                        onChange={(e) => {
                          const newPayments = [...editPayments];
                          newPayments[index].method = e.target.value;
                          setEditPayments(newPayments);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="voucher">Voucher</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        value={payment.amount || ''}
                        onChange={(e) => {
                          const newPayments = [...editPayments];
                          newPayments[index].amount = parseFloat(e.target.value) || 0;
                          setEditPayments(newPayments);
                        }}
                        placeholder="Amount"
                        className="flex-1"
                      />
                      <button
                        onClick={() => removePayment(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                {(() => {
                  const { subtotal, taxTotal, discountAmount, grandTotal, paidTotal } = calculateEditTotals();
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax:</span>
                        <span>{formatCurrency(taxTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1">
                        <span>Discount %:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editDiscountRate}
                          onChange={(e) => setEditDiscountRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="w-20 px-2 py-1 text-right border border-gray-300 rounded"
                        />
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-secondary-600">
                          <span>Discount ({editDiscountRate}%):</span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(grandTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Paid:</span>
                        <span>{formatCurrency(paidTotal)}</span>
                      </div>
                      {paidTotal < grandTotal && (
                        <p className="text-xs text-red-600">Payment amount is less than grand total</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            // Print Preview
            (() => {
              const { subtotal, taxTotal, discountAmount, grandTotal } = calculateEditTotals();
              const previewSale = {
                ...editingSale,
                subtotal,
                tax_total: taxTotal,
                grand_total: grandTotal,
                discount_total: discountAmount,
                discount_rate: editDiscountRate,
                payments: editPayments
              };
              return (
                <div className="h-[600px] overflow-y-auto bg-gray-100 p-4 rounded-lg">
                  <Receipt
                    settings={storeSettings}
                    sale={previewSale}
                    customer={editCustomer}
                    items={editItems as any}
                  />
                  {showEditPrintPreview && createPortal(
                    <div className="hidden print:block fixed inset-0 z-[9999] bg-white print-portal-container">
                      <style>{`
                                 @media print {
                                   @page { size: auto; margin: 0; }
                                   body { margin: 0; padding: 0; }
                                   body > * { display: none !important; }
                                   body > .print-portal-container { display: block !important; }
                                   .print-portal-container { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
                                 }
                               `}</style>
                      <Receipt
                        settings={storeSettings}
                        sale={previewSale}
                        customer={editCustomer}
                        items={editItems as any}
                      />
                    </div>,
                    document.body
                  )}
                </div>
              );
            })()
          )}
        </Modal>
      )}
    </>
  );
}

