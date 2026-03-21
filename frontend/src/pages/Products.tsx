import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { productService, Product, ProductFilters } from '../services/productService';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ProductRow } from './Products/components/ProductRow';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  CubeIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>({
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    product_type: '',
    list_price: '',
    sale_price: '',
    tax_rate: '',
    track_inventory: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAbortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  const loadProducts = useCallback(async () => {
    // Cancel previous request
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    // Create new controller
    searchAbortController.current = new AbortController();
    const signal = searchAbortController.current.signal;

    try {
      setLoading(true);
      const response = await productService.getProducts(filters, signal);

      // Check if request was cancelled
      if (signal.aborted) return;

      setProducts(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      toast.error(err.response?.data?.error?.message || 'Failed to load products');
      logger.error('Error loading products:', err);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Load products when filters change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const handleSearch = useCallback((search: string) => {
    // Update local state immediately for responsive UI
    setSearchQuery(search);
    // Debounced update will trigger the actual API call
    debouncedSearch(search);
  }, [debouncedSearch]);

  const handleFilterChange = useCallback((key: keyof ProductFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      product_type: '',
      list_price: '',
      sale_price: '',
      tax_rate: '',
      track_inventory: true,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      product_type: product.product_type,
      list_price: product.list_price?.toString() || '',
      sale_price: product.sale_price?.toString() || '',
      tax_rate: product.tax_rate?.toString() || '',
      track_inventory: product.track_inventory,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      product_type: '',
      list_price: '',
      sale_price: '',
      tax_rate: '',
      track_inventory: true,
    });
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    if (formData.barcode) {
      const barcodeRegex = /^\d{8,13}$/;
      if (!barcodeRegex.test(formData.barcode)) {
        errors.barcode = 'Barcode must be 8-13 digits';
      }
    }

    if (formData.list_price && parseFloat(formData.list_price) < 0) {
      errors.list_price = 'List price must be positive';
    }

    if (formData.sale_price && parseFloat(formData.sale_price) < 0) {
      errors.sale_price = 'Sale price must be positive';
    }

    if (formData.tax_rate) {
      const taxRate = parseFloat(formData.tax_rate);
      if (taxRate < 0 || taxRate > 100) {
        errors.tax_rate = 'Tax rate must be between 0 and 100';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const productData = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        product_type: formData.product_type,
        list_price: formData.list_price ? parseFloat(formData.list_price) : undefined,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : undefined,
        tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : undefined,
        track_inventory: formData.track_inventory,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.product_id, productData);
      } else {
        await productService.createProduct(productData);
      }

      closeModal();
      toast.success(editingProduct ? 'Product updated successfully' : 'Product created successfully');
      loadProducts();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage = err.response?.data?.error?.message || 'Failed to save product';
        toast.error(errorMessage);
      }
      console.error('Error saving product:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingProduct, closeModal, loadProducts, validateForm]);

  const handleDelete = useCallback(async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      await productService.deleteProduct(product.product_id);
      toast.success('Product deleted successfully');
      loadProducts();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        const errorMessage = err.response?.data?.error?.message || 'Failed to delete product';
        toast.error(errorMessage);
      }
      console.error('Error deleting product:', err);
    }
  }, [loadProducts]);

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const product = await productService.getProductByBarcode(barcode);
      openEditModal(product);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Product not found, open add modal with barcode pre-filled
        setFormData({
          ...formData,
          barcode: barcode,
        });
        openAddModal();
      } else {
        toast.error('Failed to lookup product by barcode');
      }
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
      <div className="bg-secondary-500 rounded-xl shadow-lg p-3 sm:p-4 mb-3 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <CubeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold">Products</h1>
                <p className="text-white/80 text-xs mt-0.5">Manage your product inventory</p>
              </div>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-white !text-secondary-500 hover:bg-gray-50 font-semibold shadow-lg hover:shadow-xl transition-all"
            leftIcon={<PlusIcon className="w-5 h-5 !text-secondary-500" />}
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <Card className="mb-3 border-2 border-gray-100 shadow-md">
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or barcode..."
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
              <input
                type="text"
                placeholder="Filter by type..."
                value={filters.product_type || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('product_type', e.target.value.toUpperCase() || undefined)}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 bg-white font-medium uppercase"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <QrCodeIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Scan barcode..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    e.stopPropagation(); // Stop event from bubbling
                    const barcode = (e.target as HTMLInputElement).value.trim();
                    if (barcode) {
                      handleBarcodeScan(barcode);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="success" size="sm">{pagination.total} Products</Badge>
              {filters.search && (
                <Badge variant="primary" size="sm">
                  Filtered: {products.length} results
                </Badge>
              )}
            </div>
            <button
              onClick={loadProducts}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md min-w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-4 py-6">
                <TableSkeleton rows={10} columns={7} />
              </div>
            ) : products.length === 0 ? (
              <div className="px-4 py-12">
                <EmptyState
                  icon={<CubeIcon className="w-12 h-12" />}
                  title="No products found"
                  description={filters.search ? "Try adjusting your search or filters" : "Get started by adding your first product"}
                  action={
                    !filters.search && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                        Add Product
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Barcode</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Type</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">List Price</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider">Sale Price</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Inventory</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Qty In</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Qty Out</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Balance</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product, index) => (
                    <ProductRow
                      key={product.product_id}
                      product={product}
                      index={index}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                      formatCurrency={formatCurrency}
                    />
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
              <span className="font-bold text-gray-900">{pagination.total}</span> products
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
              <CubeIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">{editingProduct ? 'Edit Product' : 'Add New Product'}</span>
          </div>
        }
        size="lg"
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
            <Button
              type="submit"
              form="product-form"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Product Name"
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.PRODUCT_NAME_MAX_LENGTH) {
                    setFormData({ ...formData, name: value });
                  }
                }}
                error={formErrors.name}
                required
                maxLength={INPUT_LIMITS.PRODUCT_NAME_MAX_LENGTH}
                className="text-sm"
              />
            </div>

            <div>
              <Input
                label="SKU"
                type="text"
                value={formData.sku}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.SKU_MAX_LENGTH) {
                    setFormData({ ...formData, sku: value });
                  }
                }}
                maxLength={INPUT_LIMITS.SKU_MAX_LENGTH}
                helperText="Stock Keeping Unit"
              />
            </div>

            <div>
              <Input
                label="Barcode"
                type="text"
                value={formData.barcode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.BARCODE_MAX_LENGTH) {
                    setFormData({ ...formData, barcode: value });
                  }
                }}
                error={formErrors.barcode}
                maxLength={INPUT_LIMITS.BARCODE_MAX_LENGTH}
                helperText="8-13 digits"
                leftIcon={<QrCodeIcon className="w-5 h-5" />}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Product Type
              </label>
              <input
                type="text"
                list="product-types-list"
                value={formData.product_type}
                onChange={(e) => setFormData({ ...formData, product_type: e.target.value.toUpperCase() })}
                placeholder="e.g. GROCERY, MEAT, DAIRY"
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all uppercase"
                required
              />
              <datalist id="product-types-list">
                {Array.from(new Set(products.map(p => p.product_type).filter(Boolean))).map(type => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>

            <div>
              <Input
                label="List Price"
                type="number"
                step="0.01"
                min={INPUT_LIMITS.PRICE_MIN}
                max={INPUT_LIMITS.PRICE_MAX}
                value={formData.list_price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, list_price: e.target.value })}
                error={formErrors.list_price}
                leftIcon={<span className="text-gray-500 font-semibold">$</span>}
              />
            </div>

            <div>
              <Input
                label="Sale Price"
                type="number"
                step="0.01"
                min={INPUT_LIMITS.PRICE_MIN}
                max={INPUT_LIMITS.PRICE_MAX}
                value={formData.sale_price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, sale_price: e.target.value })}
                error={formErrors.sale_price}
                leftIcon={<span className="text-gray-500 font-semibold">$</span>}
              />
            </div>

            <div>
              <Input
                label="Tax Rate (%)"
                type="number"
                step="0.01"
                min={INPUT_LIMITS.TAX_RATE_MIN}
                max={INPUT_LIMITS.TAX_RATE_MAX}
                value={formData.tax_rate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tax_rate: e.target.value })}
                error={formErrors.tax_rate}
                helperText="0-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-secondary-500 hover:bg-secondary-50/50 cursor-pointer transition-all group">
                <input
                  type="checkbox"
                  checked={formData.track_inventory}
                  onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
                  className="mr-2.5 h-4 w-4 text-secondary-500 focus:ring-secondary-500 border-gray-300 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-secondary-700">
                    Track Inventory
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Enable inventory tracking for this product</p>
                </div>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
