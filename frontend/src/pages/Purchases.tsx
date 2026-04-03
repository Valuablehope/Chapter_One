import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createPortal } from 'react-dom';
import PurchaseReceipt from '../components/PurchaseReceipt';
import { TableSkeleton } from '../components/ui/Skeleton';
import { purchaseService, PurchaseOrder, PurchaseOrderFilters } from '../services/purchaseService';
import { supplierService, Supplier } from '../services/supplierService';
import { productService, Product } from '../services/productService';
import { logger } from '../utils/logger';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import PageBanner from '../components/ui/PageBanner';
import {
  ShoppingCartIcon,
  TruckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  CalendarIcon,
  ArrowRightIcon,
  SparklesIcon,
  ArrowPathIcon,
  MinusIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { storeService, StoreSettings } from '../services/storeService';
import { useTranslation } from '../i18n/I18nContext';

interface PurchaseOrderItem {
  product: Product;
  qty_ordered: number;
  unit_cost: number;
  unit_of_measure?: string;
}

export default function Purchases() {
  const { t, language } = useTranslation();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PurchaseOrderFilters>({
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [expectedAt, setExpectedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const purchasesAbortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (purchasesAbortController.current) {
        purchasesAbortController.current.abort();
      }
    };
  }, []);

  const loadPurchaseOrders = useCallback(async () => {
    // Cancel previous request
    if (purchasesAbortController.current) {
      purchasesAbortController.current.abort();
    }

    // Create new controller
    purchasesAbortController.current = new AbortController();
    const signal = purchasesAbortController.current.signal;

    try {
      setLoading(true);
      const response = await purchaseService.getPurchaseOrders(filters);

      // Check if request was cancelled (though getPurchaseOrders might not accept signal yet? Need to check)
      if (signal.aborted) return;

      setPurchaseOrders(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      toast.error(err.response?.data?.error?.message || t('purchases.errors.load_orders'));
      logger.error('Error loading purchase orders:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, t]);

  // Load purchase orders
  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const handleSearch = (search: string) => {
    setSearchQuery(search);
    debouncedSearch(search);
  };

  const handleFilterChange = (key: keyof PurchaseOrderFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Search suppliers
  const handleSupplierSearch = async (query: string) => {
    if (!query.trim()) {
      setSupplierResults([]);
      return;
    }

    try {
      const response = await supplierService.getSuppliers({
        search: query,
        limit: 10,
      });
      setSupplierResults(response.data);
    } catch (err: any) {
      toast.error(t('purchases.errors.search_suppliers'));
      logger.error('Error searching suppliers:', err);
    }
  };

  // Search products
  const handleProductSearch = async (query: string) => {
    if (!query.trim()) {
      setProductResults([]);
      return;
    }

    try {
      const response = await productService.getProducts({
        search: query,
        limit: 10,
      });
      setProductResults(response.data);
    } catch (err: any) {
      toast.error(t('purchases.errors.search_products'));
      logger.error('Error searching products:', err);
    }
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    try {
      const product = await productService.getProductByBarcode(barcode);
      addItem(product);
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = '';
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error(t('purchases.errors.barcode_not_found', { barcode }));
      } else {
        toast.error(t('purchases.errors.lookup_barcode'));
      }
    }
  };

  // Add product to items
  const addItem = (product: Product) => {
    const existingItem = items.find((item) => item.product.product_id === product.product_id);

    if (existingItem) {
      // Increase quantity
      setItems(
        items.map((item) =>
          item.product.product_id === product.product_id
            ? { ...item, qty_ordered: item.qty_ordered + 1 }
            : item
        )
      );
    } else {
      // Add new item
      setItems([
        ...items,
        {
          product,
          qty_ordered: 1,
          unit_cost: Number(product.list_price || 0),
          unit_of_measure: product.unit_of_measure || t('purchases.common.each'),
        },
      ]);
    }

    setProductSearch('');
    setProductResults([]);
    // Focus barcode input instead of search
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Update item
  const updateItem = (productId: string, field: 'qty_ordered' | 'unit_cost', value: number) => {
    setItems(
      items.map((item) =>
        item.product.product_id === productId
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  // Remove item
  const removeItem = (productId: string) => {
    setItems(items.filter((item) => item.product.product_id !== productId));
  };

  // Open add modal
  const openAddModal = () => {
    setEditingPO(null);
    setSelectedSupplier(null);
    setItems([]);
    setExpectedAt('');
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = async (po: PurchaseOrder) => {
    try {
      // Load full purchase order details if needed
      const fullPO = await purchaseService.getPurchaseOrderById(po.po_id);
      setEditingPO(fullPO);
      setSelectedSupplier(fullPO.supplier ? {
        supplier_id: fullPO.supplier_id,
        name: fullPO.supplier.name,
        contact_name: fullPO.supplier.contact_name,
        phone: fullPO.supplier.phone,
        created_at: '',
        updated_at: '',
      } as Supplier : null);
      // Convert PO items to form items
      const formItems: PurchaseOrderItem[] = fullPO.items.map((item) => ({
        product: {
          product_id: item.product_id,
            name: item.product_name || t('purchases.common.deleted_product', { id: item.product_id.substring(0, 8) }),
            barcode: item.barcode || t('purchases.common.not_available'),
        } as Product,
        qty_ordered: item.qty_ordered,
        unit_cost: item.unit_cost,
          unit_of_measure: item.unit_of_measure || t('purchases.common.each'),
      }));
      setItems(formItems);
      setExpectedAt(fullPO.expected_at ? fullPO.expected_at.split('T')[0] : '');
      setShowModal(true);

      // Load store settings for printing
      if (fullPO.store_id) {
        try {
          const settings = await storeService.getStoreSettings(fullPO.store_id);
          setStoreSettings(settings);
        } catch (err) {
          logger.error('Error loading store settings:', err);
        }
      }
    } catch (err: any) {
      toast.error(t('purchases.errors.load_order_details'));
      logger.error('Error loading purchase order:', err);
    }
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingPO(null);
    setSelectedSupplier(null);
    setItems([]);
    setExpectedAt('');
    setShowPrintPreview(false);
  };

  // Select supplier
  const selectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(false);
    setSupplierSearch('');
    setSupplierResults([]);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      toast.error(t('purchases.errors.select_supplier'));
      return;
    }

    if (items.length === 0) {
      toast.error(t('purchases.errors.add_one_item'));
      return;
    }

    try {
      setSubmitting(true);

      const purchaseOrderData = {
        supplier_id: selectedSupplier.supplier_id,
        expected_at: expectedAt || undefined,
        items: items.map((item) => ({
          product_id: item.product.product_id,
          qty_ordered: item.qty_ordered,
          unit_cost: item.unit_cost,
        })),
      };

      if (editingPO) {
        // Only allow editing if status is OPEN
        if (editingPO.status !== 'OPEN') {
          toast.error(t('purchases.errors.only_open_editable'));
          setSubmitting(false);
          return;
        }

        await purchaseService.updatePurchaseOrder(editingPO.po_id, purchaseOrderData);
        closeModal();
        toast.success(t('purchases.success.order_updated'));
      } else {
        await purchaseService.createPurchaseOrder(purchaseOrderData);
        closeModal();
        toast.success(t('purchases.success.order_created'));
      }

      loadPurchaseOrders();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('purchases.errors.timeout'));
      } else {
        toast.error(err.response?.data?.error?.message || t('purchases.errors.save_order'));
      }
      logger.error('Error saving purchase order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Receive purchase order
  const handleReceive = async (po: PurchaseOrder) => {
    if (!window.confirm(t('purchases.confirm.receive_order', { poNumber: po.po_number }))) {
      return;
    }

    try {
      await purchaseService.receivePurchaseOrder(po.po_id);
      toast.success(t('purchases.success.order_received'));
      loadPurchaseOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('purchases.errors.receive_order'));
      logger.error('Error receiving purchase order:', err);
    }
  };

  // Delete purchase order
  const handleDelete = async (po: PurchaseOrder) => {
    if (!window.confirm(t('purchases.confirm.delete_order', { poNumber: po.po_number }))) {
      return;
    }

    try {
      await purchaseService.deletePurchaseOrder(po.po_id);
      toast.success(t('purchases.success.order_deleted'));
      loadPurchaseOrders();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('purchases.errors.timeout'));
      } else {
        toast.error(err.response?.data?.error?.message || t('purchases.errors.delete_order'));
      }
      logger.error('Error deleting purchase order:', err);
    }
  };

  // Calculate total
  const totalCost = items.reduce((sum, item) => sum + (item.qty_ordered * item.unit_cost), 0);

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleProductSearch(productSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  // Focus barcode input when modal opens (both new and view modes)
  useEffect(() => {
    if (showModal && barcodeInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }, 100);
    }
  }, [showModal]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <Badge variant="success" size="sm">{t('purchases.status.received')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" size="sm">{t('purchases.status.cancelled')}</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size="sm">{t('purchases.status.pending')}</Badge>;
      default:
        return <Badge variant="primary" size="sm">{t('purchases.status.open')}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };



  // Print receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <PageBanner
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        icon={<TruckIcon className="w-5 h-5 text-white" />}
        action={
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold"
            leftIcon={<PlusIcon className="w-4 h-4" />}
          >
            {t('purchases.actions.new_order')}
          </Button>
        }
      />

      {/* Enhanced Filters */}
      <Card className="mb-3 border-2 border-gray-100 shadow-md">
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder={t('purchases.filters.search_placeholder')}
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FunnelIcon className="w-4 h-4" />
              </div>
              <select
                value={filters.status || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 appearance-none bg-white font-medium"
              >
                <option value="">{t('purchases.filters.all_statuses')}</option>
                <option value="OPEN">{t('purchases.status.open')}</option>
                <option value="PENDING">{t('purchases.status.pending')}</option>
                <option value="RECEIVED">{t('purchases.status.received')}</option>
                <option value="CANCELLED">{t('purchases.status.cancelled')}</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="warning" size="sm">{t('purchases.filters.orders_count', { count: pagination.total })}</Badge>
              {filters.search && (
                <Badge variant="primary" size="sm">
                  {t('purchases.filters.filtered_results', { count: purchaseOrders.length })}
                </Badge>
              )}
            </div>
            <button
              onClick={loadPurchaseOrders}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>{t('purchases.actions.refresh')}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Purchase Orders Table */}
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={7} />
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="px-4 py-12">
                <EmptyState
                  icon={<ShoppingCartIcon className="w-12 h-12" />}
                  title={t('purchases.empty.title')}
                  description={filters.search ? t('purchases.empty.filtered_description') : t('purchases.empty.default_description')}
                  action={
                    !filters.search && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                        {t('purchases.actions.new_order')}
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.po_number')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.supplier')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.status')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.items')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.total_cost')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.ordered_at')}</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('purchases.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {purchaseOrders.map((po, index) => (
                    <tr
                      key={po.po_id}
                      className={`transition-all duration-150 hover:bg-secondary-50/50 group ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <div className="p-1.5 bg-secondary-100 rounded-lg">
                            <ShoppingCartIcon className="w-3.5 h-3.5 text-secondary-500" />
                          </div>
                          <div className="text-xs font-bold text-gray-900 font-mono">
                            {po.po_number}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-semibold text-gray-900">
                          {po.supplier?.name || <span className="text-gray-400">{t('purchases.common.unknown')}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Badge variant="primary" size="sm">{po.items.length}</Badge>
                           <span className="text-xs text-gray-600">{t('purchases.table.items_count', { count: po.items.length })}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-bold text-secondary-500">
                          {formatCurrency(Number(po.total_cost))}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-600">
                          {new Date(po.ordered_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                            <button
                              title={t('purchases.actions.receive')}
                              aria-label={t('purchases.actions.receive')}
                              onClick={() => handleReceive(po)}
                              className="p-1.5 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            title={t('purchases.actions.view')}
                            aria-label={t('purchases.actions.view')}
                            onClick={() => openEditModal(po)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          {po.status !== 'RECEIVED' && (
                            <button
                              title={t('purchases.actions.delete')}
                              aria-label={t('purchases.actions.delete')}
                              onClick={() => handleDelete(po)}
                              className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Enhanced Pagination */}
      {pagination.totalPages > 1 && (
        <Card className="mt-3 border-2 border-gray-100">
          <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-xs text-gray-600 font-medium">
              {t('purchases.pagination.showing')} <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> {t('purchases.pagination.to')}{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> {t('purchases.pagination.of')}{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> {t('purchases.pagination.orders')}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                {t('purchases.pagination.previous')}
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                {t('purchases.pagination.page')} {pagination.page} {t('purchases.pagination.of')} {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                size="sm"
              >
                {t('purchases.pagination.next')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Enhanced Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <ShoppingCartIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">
              {showPrintPreview ? t('purchases.modal.print_preview_title', { poNumber: editingPO?.po_number || '' }) : (editingPO ? t('purchases.modal.view_title') : t('purchases.modal.new_title'))}
            </span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex justify-end gap-3 print:hidden">
            {editingPO && !showPrintPreview && (
              <Button
                onClick={() => setShowPrintPreview(true)}
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PrinterIcon className="w-5 h-5" />}
              >
                {t('purchases.actions.print_preview')}
              </Button>
            )}
            {editingPO && showPrintPreview && (
              <Button
                onClick={handlePrint}
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PrinterIcon className="w-5 h-5" />}
              >
                {t('purchases.actions.print')}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (showPrintPreview) {
                  setShowPrintPreview(false);
                } else {
                  closeModal();
                }
              }}
              variant="outline"
              disabled={submitting}
            >
              {showPrintPreview ? t('purchases.actions.back') : (editingPO ? t('purchases.actions.close') : t('purchases.actions.cancel'))}
            </Button>
            {editingPO && !showPrintPreview && editingPO.status === 'OPEN' && (
              <Button
                type="submit"
                form="purchase-order-form"
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                isLoading={submitting}
                leftIcon={<PencilIcon className="w-5 h-5" />}
              >
                {t('purchases.actions.save_changes')}
              </Button>
            )}
            {!editingPO && (
              <Button
                type="submit"
                form="purchase-order-form"
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                isLoading={submitting}
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                {t('purchases.actions.create_order')}
              </Button>
            )}
          </div>
        }
      >
        {!showPrintPreview ? (
          // Editable Form
          <form id="purchase-order-form" onSubmit={handleSubmit}>
            {/* Enhanced Supplier Selection */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                {t('purchases.form.supplier')} <span className="text-red-500">*</span>
              </label>
              {selectedSupplier ? (
                <div className="flex justify-between items-center p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-secondary-500 rounded-lg">
                      <BuildingOfficeIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-900">{selectedSupplier.name}</p>
                      {selectedSupplier.phone && (
                        <p className="text-xs text-gray-600">{selectedSupplier.phone}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setSelectedSupplier(null)}
                    variant="ghost"
                    size="sm"
                    className="hover:bg-white !p-1"
                  >
                      {t('purchases.actions.change')}
                    </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full border-2 hover:bg-secondary-50 hover:border-secondary-300 transition-all"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  {t('purchases.actions.select_supplier')}
                </Button>
              )}
            </div>

            {/* Enhanced Expected Date */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={expectedAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpectedAt(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1 ml-3">{t('purchases.form.expected_delivery_optional')}</p>
            </div>

            {/* Enhanced Items Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-xs font-semibold text-gray-700">
                  {t('purchases.form.items')} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  {/* Barcode Scanner */}
                  <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <QrCodeIcon className="w-3.5 h-3.5" />
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                       placeholder={t('purchases.form.scan_barcode_placeholder')}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          e.preventDefault(); // Prevent form submission
                          e.stopPropagation(); // Stop event from bubbling
                          const barcode = (e.target as HTMLInputElement).value.trim();
                          if (barcode) {
                            handleBarcodeScan(barcode);
                          }
                        }
                      }}
                      className="w-40 pl-9 pr-2.5 py-2 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                    />
                  </div>
                  {/* Product Search */}
                  <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                    </div>
                    <input
                      ref={productSearchRef}
                      type="text"
                      value={productSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                       placeholder={t('purchases.form.search_products_placeholder')}
                      className="w-56 pl-9 pr-2.5 py-2 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Product Search Results */}
              {productResults.length > 0 && (
                <div className="mb-3 border-2 border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 bg-white shadow-inner">
                  {productResults.map((product) => (
                    <button
                      key={product.product_id}
                      type="button"
                      onClick={() => addItem(product)}
                      className="w-full px-3 py-2.5 text-left hover:bg-secondary-50 transition-all duration-150 group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <div className="p-1 bg-secondary-100 rounded-lg">
                              <SparklesIcon className="w-3.5 h-3.5 text-secondary-500" />
                            </div>
                            <p className="font-bold text-xs text-gray-900 group-hover:text-secondary-500 transition-colors">{product.name}</p>
                          </div>
                          {product.barcode && (
                            <Badge variant="gray" size="sm" className="font-mono text-[10px]">
                              {product.barcode}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-bold text-sm text-secondary-500">
                            {formatCurrency(Number(product.list_price || 0))}
                          </p>
                          <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 mt-1 ml-auto transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Enhanced Items List */}
              {items.length === 0 ? (
                <EmptyState
                  icon={<ShoppingCartIcon className="w-10 h-10" />}
                   title={t('purchases.form.no_items_title')}
                   description={t('purchases.form.no_items_description')}
                 />
              ) : (
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-secondary-50">
                        <tr>
                           <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">{t('purchases.form.product')}</th>
                           <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">{t('purchases.form.quantity')}</th>
                           <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">{t('purchases.form.unit_cost')}</th>
                           <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">{t('purchases.form.total')}</th>
                           <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">{t('purchases.table.actions')}</th>
                         </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item) => (
                          <tr key={item.product.product_id} className="hover:bg-secondary-50/50 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center space-x-1.5">
                                <div className="p-1 bg-secondary-100 rounded-lg">
                                  <SparklesIcon className="w-3.5 h-3.5 text-secondary-500" />
                                </div>
                                <div className="text-xs font-bold text-gray-900">
                                  {item.product.name}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 border-2 border-gray-200 rounded-lg bg-white w-20">
                                  <Button
                                    type="button"
                                    onClick={() => updateItem(item.product.product_id, 'qty_ordered', Math.max(1, item.qty_ordered - 1))}
                                    variant="ghost"
                                    size="sm"
                                    className="!p-0.5 hover:bg-gray-100"
                                  >
                                    <MinusIcon className="w-2.5 h-2.5" />
                                  </Button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.qty_ordered}
                                    onChange={(e) => updateItem(item.product.product_id, 'qty_ordered', parseInt(e.target.value) || 1)}
                                    className="w-10 text-center text-xs font-bold text-gray-900 border-0 focus:ring-0 p-0"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => updateItem(item.product.product_id, 'qty_ordered', item.qty_ordered + 1)}
                                    variant="ghost"
                                    size="sm"
                                    className="!p-0.5 hover:bg-gray-100"
                                  >
                                    <PlusIcon className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                                {item.unit_of_measure && item.unit_of_measure !== 'each' && (
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
                                    {item.unit_of_measure}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_cost}
                                onChange={(e) => updateItem(item.product.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 font-medium"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs font-bold text-secondary-500">
                                {formatCurrency(item.qty_ordered * item.unit_cost)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                onClick={() => removeItem(item.product.product_id)}
                                variant="danger"
                                size="sm"
                                className="!p-1.5"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-secondary-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-xs text-gray-700">
                            {t('purchases.form.total_label')}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-base font-extrabold text-secondary-500">
                              {formatCurrency(totalCost)}
                            </div>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </form>
        ) : (
          // Print Preview
          <div className="h-[600px] overflow-y-auto bg-gray-100 p-4 rounded-lg">
            <PurchaseReceipt
              settings={storeSettings}
              purchaseOrder={editingPO!}
              supplier={selectedSupplier}
            />
            {showPrintPreview && createPortal(
              <div className="hidden print:block fixed inset-0 z-[9999] bg-white print-portal-container-po">
                <style>{`
                   @media print {
                     @page { size: auto; margin: 0; }
                     body { margin: 0; padding: 0; }
                     body > * { display: none !important; }
                     body > .print-portal-container-po { display: block !important; }
                     .print-portal-container-po { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
                   }
                 `}</style>
                <PurchaseReceipt
                  settings={storeSettings}
                  purchaseOrder={editingPO!}
                  supplier={selectedSupplier}
                />
              </div>,
              document.body
            )}
          </div>
        )}
      </Modal>

      {/* Enhanced Supplier Selection Modal */}
      <Modal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setSupplierSearch('');
          setSupplierResults([]);
        }}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <BuildingOfficeIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">{t('purchases.supplier_modal.title')}</span>
          </div>
        }
        size="md"
      >
        <div>
          <Input
            type="text"
            value={supplierSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSupplierSearch(e.target.value);
              handleSupplierSearch(e.target.value);
            }}
            placeholder={t('purchases.supplier_modal.search_placeholder')}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            autoFocus
          />
          <div className="mt-3 max-h-48 overflow-y-auto">
            {supplierResults.length > 0 ? (
              <div className="space-y-1.5">
                {supplierResults.map((supplier) => (
                  <button
                    key={supplier.supplier_id}
                    onClick={() => selectSupplier(supplier)}
                    className="w-full px-3 py-2 text-left hover:bg-secondary-50 border-2 border-gray-200 hover:border-secondary-300 rounded-lg transition-all group"
                  >
                    <div className="flex items-center space-x-1.5">
                      <div className="p-1 bg-secondary-100 rounded-lg">
                        <BuildingOfficeIcon className="w-3.5 h-3.5 text-secondary-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-xs text-gray-900 group-hover:text-secondary-500">
                          {supplier.name}
                        </p>
                        {supplier.phone && (
                          <p className="text-xs text-gray-600 mt-0.5">{supplier.phone}</p>
                        )}
                      </div>
                      <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : supplierSearch ? (
              <EmptyState
                title={t('purchases.supplier_modal.no_suppliers_title')}
                description={t('purchases.supplier_modal.no_suppliers_description')}
              />
            ) : (
              <EmptyState
                title={t('purchases.supplier_modal.search_title')}
                description={t('purchases.supplier_modal.search_description')}
              />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

