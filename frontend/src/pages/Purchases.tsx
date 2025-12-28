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
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  const openEditModal = (po: PurchaseOrder) => {
    setEditingPO(po);
    setSelectedSupplier(po.supplier ? {
      supplier_id: po.supplier_id,
      name: po.supplier.name,
      contact_name: po.supplier.contact_name,
      phone: po.supplier.phone,
      created_at: '',
      updated_at: '',
    } as Supplier : null);
    // Convert PO items to form items
    const formItems: PurchaseOrderItem[] = po.items.map((item) => ({
      product: {
        product_id: item.product_id,
        name: item.product_name || `[Deleted Product - ID: ${item.product_id.substring(0, 8)}...]`,
        barcode: item.barcode || 'N/A',
      } as Product,
      qty_ordered: item.qty_ordered,
      unit_cost: item.unit_cost,
    }));
    setItems(formItems);
    setExpectedAt(po.expected_at ? po.expected_at.split('T')[0] : '');
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingPO(null);
    setSelectedSupplier(null);
    setItems([]);
    setExpectedAt('');
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
        // For now, we can only create new POs. Update functionality can be added later.
        toast.error('Editing purchase orders is not yet supported');
        return;
      } else {
        await purchaseService.createPurchaseOrder(purchaseOrderData);
      }

      closeModal();
      toast.success('Purchase order created successfully');
      loadPurchaseOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save purchase order');
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
      toast.error(err.response?.data?.error?.message || 'Failed to delete purchase order');
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

  return (
    <>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <ShoppingCartIcon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Purchase Orders</h1>
                <p className="text-orange-50 text-xs sm:text-sm mt-1">Manage your inventory purchases and suppliers</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-white !text-orange-700 hover:bg-orange-50 font-semibold shadow-lg hover:shadow-xl transition-all"
            leftIcon={<PlusIcon className="w-5 h-5 !text-orange-700" />}
          >
            New Purchase Order
          </Button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <Card className="mb-4 sm:mb-6 border-2 border-gray-100 shadow-lg">
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Search by PO number or supplier..."
                  value={filters.search || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white font-medium"
                />
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <FunnelIcon className="w-5 h-5" />
              </div>
              <select
                value={filters.status || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none bg-white font-medium"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="warning" size="sm">{pagination.total} Orders</Badge>
              {filters.search && (
                <Badge variant="primary" size="sm">
                  Filtered: {purchaseOrders.length} results
                </Badge>
              )}
            </div>
            <button
              onClick={loadPurchaseOrders}
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Purchase Orders Table */}
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-lg min-w-full">
          <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-8">
              <TableSkeleton rows={10} columns={7} />
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="px-6 py-16">
              <EmptyState
                icon={<ShoppingCartIcon className="w-16 h-16" />}
                title="No purchase orders found"
                description={filters.search ? "Try adjusting your search or filters" : "Get started by creating your first purchase order"}
                action={
                  !filters.search && (
                    <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-5 h-5" />} variant="primary">
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">PO Number</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ordered At</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseOrders.map((po, index) => (
                  <tr
                    key={po.po_id}
                    className={`transition-all duration-150 hover:bg-orange-50/50 group ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg">
                          <ShoppingCartIcon className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="text-sm font-bold text-gray-900 font-mono">
                          {po.po_number}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {po.supplier?.name || <span className="text-gray-400">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Badge variant="primary" size="sm">{po.items.length}</Badge>
                        <span className="text-sm text-gray-600">{po.items.length === 1 ? 'item' : 'items'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-orange-600">
                        {formatCurrency(Number(po.total_cost))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {new Date(po.ordered_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
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
        <Card className="mt-4 sm:mt-6 border-2 border-gray-100">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 font-medium">
              Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> purchase orders
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">
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
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
              <ShoppingCartIcon className="w-5 h-5 text-white" />
            </div>
            <span>{editingPO ? 'View Purchase Order' : 'New Purchase Order'}</span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={closeModal}
              variant="outline"
              disabled={submitting}
            >
              Cancel
            </Button>
            {!editingPO && (
              <Button
                type="submit"
                form="purchase-order-form"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                isLoading={submitting}
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Create Purchase Order
              </Button>
            )}
          </div>
        }
      >
        <form id="purchase-order-form" onSubmit={handleSubmit}>
          {/* Enhanced Supplier Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Supplier <span className="text-red-500">*</span>
            </label>
            {selectedSupplier ? (
              <div className="flex justify-between items-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
                    <BuildingOfficeIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedSupplier.name}</p>
                    {selectedSupplier.phone && (
                      <p className="text-sm text-gray-600">{selectedSupplier.phone}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  variant="ghost"
                  size="sm"
                  className="hover:bg-white"
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                variant="outline"
                className="w-full border-2 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Select Supplier
              </Button>
            )}
          </div>

          {/* Enhanced Expected Date */}
          <div className="mb-6">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <input
                type="date"
                value={expectedAt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpectedAt(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white font-medium"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-4">Expected Delivery Date (Optional)</p>
          </div>

          {/* Enhanced Items Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-semibold text-gray-700">
                Items <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {/* Barcode Scanner */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <QrCodeIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan barcode..."
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        const barcode = (e.target as HTMLInputElement).value.trim();
                        if (barcode) {
                          handleBarcodeScan(barcode);
                        }
                      }
                    }}
                    className="w-48 pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white font-medium text-sm"
                  />
                </div>
                {/* Product Search */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={productSearchRef}
                    type="text"
                    value={productSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-64 pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Product Search Results */}
            {productResults.length > 0 && (
              <div className="mb-4 border-2 border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white shadow-inner">
                {productResults.map((product) => (
                  <button
                    key={product.product_id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="w-full px-4 py-4 text-left hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-150 group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="p-1.5 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg">
                            <SparklesIcon className="w-4 h-4 text-orange-600" />
                          </div>
                          <p className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{product.name}</p>
                        </div>
                        {product.barcode && (
                          <Badge variant="gray" size="sm" className="font-mono text-xs">
                            {product.barcode}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-lg text-orange-600">
                          {formatCurrency(Number(product.list_price || 0))}
                        </p>
                        <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-orange-600 mt-2 ml-auto transition-colors" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Enhanced Items List */}
            {items.length === 0 ? (
              <EmptyState
                icon={<ShoppingCartIcon className="w-12 h-12" />}
                title="No items added"
                description="Search and add products to get started"
              />
            ) : (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-orange-50 to-amber-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Unit Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item) => (
                        <tr key={item.product.product_id} className="hover:bg-orange-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg">
                                <SparklesIcon className="w-4 h-4 text-orange-600" />
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                {item.product.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 border-2 border-gray-200 rounded-lg bg-white w-24">
                              <Button
                                type="button"
                                onClick={() => updateItem(item.product.product_id, 'qty_ordered', Math.max(1, item.qty_ordered - 1))}
                                variant="ghost"
                                size="sm"
                                className="!p-1 hover:bg-gray-100"
                              >
                                <MinusIcon className="w-3 h-3" />
                              </Button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty_ordered}
                                onChange={(e) => updateItem(item.product.product_id, 'qty_ordered', parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-bold text-gray-900 border-0 focus:ring-0 p-0"
                              />
                              <Button
                                type="button"
                                onClick={() => updateItem(item.product.product_id, 'qty_ordered', item.qty_ordered + 1)}
                                variant="ghost"
                                size="sm"
                                className="!p-1 hover:bg-gray-100"
                              >
                                <PlusIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_cost}
                              onChange={(e) => updateItem(item.product.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                              className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-bold text-orange-600">
                              {formatCurrency(item.qty_ordered * item.unit_cost)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              onClick={() => removeItem(item.product.product_id)}
                              variant="danger"
                              size="sm"
                              className="!p-2"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gradient-to-r from-orange-50 to-amber-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-right font-bold text-gray-700">
                          Total:
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xl font-extrabold text-orange-600">
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
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
              <BuildingOfficeIcon className="w-5 h-5 text-white" />
            </div>
            <span>Select Supplier</span>
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
          <div className="mt-4 max-h-64 overflow-y-auto">
            {supplierResults.length > 0 ? (
              <div className="space-y-2">
                {supplierResults.map((supplier) => (
                  <button
                    key={supplier.supplier_id}
                    onClick={() => selectSupplier(supplier)}
                    className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 border-2 border-gray-200 hover:border-indigo-300 rounded-xl transition-all group"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
                        <BuildingOfficeIcon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 group-hover:text-indigo-600">
                          {supplier.name}
                        </p>
                        {supplier.phone && (
                          <p className="text-sm text-gray-600 mt-1">{supplier.phone}</p>
                        )}
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
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

