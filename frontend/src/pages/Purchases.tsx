import { useState, useEffect, useRef } from 'react';
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
import {
  ShoppingCartIcon,
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

interface PurchaseOrderItem {
  product: Product;
  qty_ordered: number;
  unit_cost: number;
}

export default function Purchases() {
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

  // Load purchase orders
  useEffect(() => {
    loadPurchaseOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.supplier_id, filters.status, filters.search, filters.page, filters.limit]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await purchaseService.getPurchaseOrders(filters);
      setPurchaseOrders(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load purchase orders');
      logger.error('Error loading purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleFilterChange = (key: keyof PurchaseOrderFilters, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
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
      toast.error('Failed to search suppliers');
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
      toast.error('Failed to search products');
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
        toast.error(`Product with barcode ${barcode} not found`);
      } else {
        toast.error('Failed to lookup product by barcode');
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
          name: item.product_name || `[Deleted Product - ID: ${item.product_id.substring(0, 8)}...]`,
          barcode: item.barcode || 'N/A',
        } as Product,
        qty_ordered: item.qty_ordered,
        unit_cost: item.unit_cost,
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
      toast.error('Failed to load purchase order details');
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
      toast.error('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
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
          toast.error('Only OPEN purchase orders can be edited');
          setSubmitting(false);
          return;
        }
        
        await purchaseService.updatePurchaseOrder(editingPO.po_id, purchaseOrderData);
        closeModal();
        toast.success('Purchase order updated successfully');
      } else {
        await purchaseService.createPurchaseOrder(purchaseOrderData);
        closeModal();
        toast.success('Purchase order created successfully');
      }

      loadPurchaseOrders();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to save purchase order');
      }
      logger.error('Error saving purchase order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Receive purchase order
  const handleReceive = async (po: PurchaseOrder) => {
    if (!window.confirm(`Receive purchase order ${po.po_number}? This will update stock levels.`)) {
      return;
    }

    try {
      await purchaseService.receivePurchaseOrder(po.po_id);
      toast.success('Purchase order received successfully');
      loadPurchaseOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to receive purchase order');
      logger.error('Error receiving purchase order:', err);
    }
  };

  // Delete purchase order
  const handleDelete = async (po: PurchaseOrder) => {
    if (!window.confirm(`Are you sure you want to delete purchase order ${po.po_number}?`)) {
      return;
    }

    try {
      await purchaseService.deletePurchaseOrder(po.po_id);
      toast.success('Purchase order deleted successfully');
      loadPurchaseOrders();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to delete purchase order');
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
        return <Badge variant="success" size="sm">{status}</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" size="sm">{status}</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size="sm">{status}</Badge>;
      default:
        return <Badge variant="primary" size="sm">{status}</Badge>;
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

  // Print receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-secondary-500 rounded-xl shadow-lg p-3 sm:p-4 mb-3 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <ShoppingCartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold">Purchase Orders</h1>
                <p className="text-white/80 text-xs mt-0.5">Manage your inventory purchases and suppliers</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-white !text-secondary-500 hover:bg-gray-50 font-semibold shadow-md hover:shadow-lg transition-all"
            leftIcon={<PlusIcon className="w-4 h-4 !text-secondary-500" />}
          >
            New Purchase Order
          </Button>
        </div>
      </div>

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
                  placeholder="Search by PO number or supplier..."
                  value={filters.search || ''}
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
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="warning" size="sm">{pagination.total} Orders</Badge>
              {filters.search && (
                <Badge variant="primary" size="sm">
                  Filtered: {purchaseOrders.length} results
                </Badge>
              )}
            </div>
            <button
              onClick={loadPurchaseOrders}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Refresh</span>
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
                title="No purchase orders found"
                description={filters.search ? "Try adjusting your search or filters" : "Get started by creating your first purchase order"}
                action={
                  !filters.search && (
                    <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                      New Purchase Order
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">PO Number</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Items</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Total Cost</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Ordered At</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseOrders.map((po, index) => (
                  <tr
                    key={po.po_id}
                    className={`transition-all duration-150 hover:bg-secondary-50/50 group ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
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
                        {po.supplier?.name || <span className="text-gray-400">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Badge variant="primary" size="sm">{po.items.length}</Badge>
                        <span className="text-xs text-gray-600">{po.items.length === 1 ? 'item' : 'items'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs font-bold text-secondary-500">
                        {formatCurrency(Number(po.total_cost))}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-gray-600">
                        {new Date(po.ordered_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5 relative">
                        {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                          <Button
                            onClick={() => handleReceive(po)}
                            variant="success"
                            size="sm"
                            leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Receive
                          </Button>
                        )}
                        <Button
                          onClick={() => openEditModal(po)}
                          variant="ghost"
                          size="sm"
                          leftIcon={<PencilIcon className="w-4 h-4" />}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View
                        </Button>
                        {po.status !== 'RECEIVED' && (
                          <Button
                            onClick={() => handleDelete(po)}
                            variant="danger"
                            size="sm"
                            leftIcon={<TrashIcon className="w-4 h-4" />}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Delete
                          </Button>
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
              Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> purchase orders
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                size="sm"
              >
                Next
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
              {showPrintPreview ? `Print Preview: ${editingPO?.po_number}` : (editingPO ? 'View Purchase Order' : 'New Purchase Order')}
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
                Print Preview
              </Button>
            )}
            {editingPO && showPrintPreview && (
              <Button
                onClick={handlePrint}
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PrinterIcon className="w-5 h-5" />}
              >
                Print
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
              {showPrintPreview ? 'Back' : (editingPO ? 'Close' : 'Cancel')}
            </Button>
            {editingPO && !showPrintPreview && editingPO.status === 'OPEN' && (
              <Button
                type="submit"
                form="purchase-order-form"
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                isLoading={submitting}
                leftIcon={<PencilIcon className="w-5 h-5" />}
              >
                Save Changes
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
                Create Purchase Order
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
              Supplier <span className="text-red-500">*</span>
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
                  Change
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
                Select Supplier
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
            <p className="text-[10px] text-gray-500 mt-1 ml-3">Expected Delivery Date (Optional)</p>
          </div>

          {/* Enhanced Items Section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-semibold text-gray-700">
                Items <span className="text-red-500">*</span>
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
                    placeholder="Scan barcode..."
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
                    placeholder="Search products..."
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
                title="No items added"
                description="Search and add products to get started"
              />
            ) : (
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-secondary-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Quantity</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Unit Cost</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase">Total</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase">Actions</th>
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
                          Total:
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
          <>
            {/* Enhanced Print Styles */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                .receipt-container-po, .receipt-container-po * {
                  visibility: visible;
                }
                .receipt-container-po {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  max-width: 100%;
                  padding: 20px;
                  background: white;
                }
                .print\\:hidden {
                  display: none !important;
                }
                .modal-content {
                  box-shadow: none !important;
                  border: none !important;
                }
                @page {
                  margin: 0.5cm;
                  size: auto;
                }
              }
            `}</style>

            {/* Receipt Preview */}
            {editingPO && (
              <div className="bg-white print:shadow-none">
                <div className="receipt-container-po max-w-md mx-auto p-8 print:p-6 bg-gradient-to-b from-white to-gray-50">
                
                {/* Modern Header */}
                <div className="text-center mb-8 relative">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-secondary-500 rounded-full"></div>
                  <div className="pt-6 border-b-2 border-gray-200 pb-6">
                    {storeSettings?.receipt_header ? (
                      <div className="text-sm text-gray-700 whitespace-pre-line mb-2 leading-relaxed">
                        {storeSettings.receipt_header}
                      </div>
                    ) : (
                      <>
                        <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
                          {(storeSettings?.name && storeSettings.name.trim()) ? storeSettings.name : (storeSettings?.code ? storeSettings.code : 'Store')}
                        </h1>
                        {storeSettings?.address && (
                          <p className="text-sm text-gray-600 leading-relaxed">{storeSettings.address}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Purchase Order Info */}
                <div className="mb-8 space-y-3 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">PO Number</span>
                    <span className="font-mono font-bold text-gray-900 text-base tracking-wider">
                      {editingPO.po_number}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Date</span>
                    <span className="text-gray-900 font-semibold">
                      {formatDate(editingPO.ordered_at)}
                    </span>
                  </div>
                  {editingPO.expected_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Expected Delivery</span>
                      <span className="text-gray-900 font-semibold">
                        {new Date(editingPO.expected_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Status</span>
                    <span className="font-bold text-gray-900">
                      {editingPO.status}
                    </span>
                  </div>
                  {selectedSupplier && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 font-medium">Supplier</span>
                        <span className="font-bold text-gray-900">
                          {selectedSupplier.name}
                        </span>
                      </div>
                      {selectedSupplier.phone && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Phone</span>
                          <span className="text-gray-900">{selectedSupplier.phone}</span>
                        </div>
                      )}
                      {selectedSupplier.contact_name && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Contact</span>
                          <span className="text-gray-900">{selectedSupplier.contact_name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="mb-8">
                  <div className="border-t-2 border-b-2 border-gray-300 py-4">
                    <div className="space-y-4">
                      {editingPO.items.map((item) => {
                        const lineTotal = item.qty_ordered * item.unit_cost;
                        return (
                          <div key={item.po_item_id} className="flex justify-between items-start gap-4 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-base leading-snug">
                                {item.product_name || `Product ID: ${item.product_id.substring(0, 8)}...`}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                                <span className="font-mono">
                                  {item.qty_ordered} × {formatCurrency(item.unit_cost)}
                                </span>
                                {item.qty_received > 0 && item.qty_received !== item.qty_ordered && (
                                  <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded font-medium">
                                    Received: {item.qty_received}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900 text-base">
                                {formatCurrency(lineTotal)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                    <span className="text-lg font-bold text-gray-900">Total Cost</span>
                    <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(Number(editingPO.total_cost))}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center space-y-4 border-t-2 border-gray-200 pt-6">
                  {storeSettings?.receipt_footer ? (
                    <div className="whitespace-pre-line text-sm text-gray-600 leading-relaxed">
                      {storeSettings.receipt_footer}
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-800 text-base">Thank you for your business!</p>
                      <p className="text-sm text-gray-600">Have a great day!</p>
                    </>
                  )}
                  
                  {/* Cubiq Solutions Branding */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <img 
                        src="/cubiq-logo.jpg" 
                        alt="Cubiq Solutions" 
                        className="h-16 w-auto object-contain opacity-90 print:opacity-100 max-w-xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="text-center">
                        <a 
                          href="https://www.cubiq-solutions.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors print:text-gray-600 print:no-underline"
                        >
                          www.cubiq-solutions.com
                        </a>
                        <p className="text-xs text-gray-500 mt-1 print:text-gray-400">
                          Digital Innovation Agency
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}
          </>
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
            <span className="text-base">Select Supplier</span>
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
            placeholder="Search suppliers..."
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
                title="No suppliers found"
                description="Try a different search term"
              />
            ) : (
              <EmptyState
                title="Search for suppliers"
                description="Start typing to search"
              />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

