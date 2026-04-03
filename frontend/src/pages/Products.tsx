import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { productService, Product, ProductFilters } from '../services/productService';
import { productTypeService, ProductType } from '../services/productTypeService';
import { storeService, StoreSettings } from '../services/storeService';
import { logger } from '../utils/logger';
import { INPUT_LIMITS } from '../config/constants';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import PageBanner from '../components/ui/PageBanner';
import { ProductRow } from './Products/components/ProductRow';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  CubeIcon,
  BookOpenIcon,
  FunnelIcon,
  ArrowPathIcon,
  TagIcon,
  TrashIcon,
  PencilIcon,
  AdjustmentsVerticalIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n/I18nContext';

export const STANDARD_UNITS = ['each', 'pair', 'dozen', 'pack', 'box', 'carton', 'kg', 'g', 'lb', 'oz', 'L', 'mL', 'm', 'cm'];

export interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  minWidth: number;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', width: 250, visible: true, minWidth: 100 },
  { id: 'sku', label: 'SKU', width: 120, visible: true, minWidth: 80 },
  { id: 'barcode', label: 'Barcode', width: 140, visible: true, minWidth: 80 },
  { id: 'type', label: 'Type', width: 120, visible: true, minWidth: 80 },
  { id: 'unit', label: 'Unit', width: 80, visible: true, minWidth: 60 },
  { id: 'list_price', label: 'List Price', width: 100, visible: true, minWidth: 80 },
  { id: 'sale_price', label: 'Sale Price', width: 100, visible: true, minWidth: 80 },
  { id: 'inventory', label: 'Inventory', width: 100, visible: true, minWidth: 80 },
  { id: 'qty_in', label: 'Qty In', width: 80, visible: true, minWidth: 60 },
  { id: 'qty_out', label: 'Qty Out', width: 80, visible: true, minWidth: 60 },
  { id: 'balance', label: 'Balance', width: 80, visible: true, minWidth: 60 },
  { id: 'actions', label: 'Actions', width: 120, visible: true, minWidth: 100 },
];

export default function Products() {
  const { t, language } = useTranslation();
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
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    product_type: '',
    unit_of_measure: 'each',
    list_price: '',
    sale_price: '',
    margin_pct: '',
    tax_rate: '',
    track_inventory: true,
  });
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeFormData, setTypeFormData] = useState({ name: '', display_on_pos: false });
  const [editingProductType, setEditingProductType] = useState<ProductType | null>(null);
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypeInput, setProductTypeInput] = useState('');
  const searchAbortController = useRef<AbortController | null>(null);
  const loadRequestIdRef = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const isCustomSizedRef = useRef(!!localStorage.getItem('products_table_resized_v1'));
  const [isCustomSized, setIsCustomSized] = useState(isCustomSizedRef.current);

  const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('products_table_columns_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return DEFAULT_COLUMNS.map(def => {
            const found = parsed.find((p: any) => p.id === def.id);
            return found ? { ...def, ...found } : def;
          });
        }
      } catch (e) {
        logger.warn('Failed to parse saved columns config');
      }
    }
    return DEFAULT_COLUMNS;
  });

  const [showManageColumns, setShowManageColumns] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const colResizeDataRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('products_table_columns_v1', JSON.stringify(columnsConfig));
    if (isCustomSizedRef.current) {
      localStorage.setItem('products_table_resized_v1', 'true');
    }
  }, [columnsConfig]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) {
        setShowManageColumns(false);
      }
    };
    if (showManageColumns) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageColumns]);

  const startColumnResize = useCallback((e: React.MouseEvent, id: string, width: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isCustomSizedRef.current && tableRef.current) {
      // First time resize: capture actual rendered widths of all visible headers
      const ths = tableRef.current.querySelectorAll('th');
      setColumnsConfig(prev => {
        const visibleCols = prev.filter(c => c.visible);
        const next = [...prev];
        visibleCols.forEach((col, index) => {
          if (ths[index]) {
            const rect = ths[index].getBoundingClientRect();
            const configIndex = next.findIndex(c => c.id === col.id);
            if (configIndex > -1) {
              next[configIndex] = { ...next[configIndex], width: rect.width };
            }
          }
        });
        
        // Setup initial start width specifically from the new snapshot
        const newCol = next.find(c => c.id === id);
        colResizeDataRef.current = { id, startX: e.clientX, startWidth: newCol?.width || width };
        
        return next;
      });
      isCustomSizedRef.current = true;
      setIsCustomSized(true);
    } else {
      colResizeDataRef.current = { id, startX: e.clientX, startWidth: width };
    }

    const handleMouseMove = (mvEvent: MouseEvent) => {
      if (!colResizeDataRef.current) return;
      const { id, startX, startWidth } = colResizeDataRef.current;
      const delta = mvEvent.clientX - startX;
      setColumnsConfig(prev => prev.map(c => 
        c.id === id ? { ...c, width: Math.max(20, startWidth + delta) } : c
      ));
    };

    const handleMouseUp = () => {
      colResizeDataRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Abort list requests and invalidate in-flight handlers on unmount (avoids stale setState / stuck loading)
  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  const loadProducts = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
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

      if (signal.aborted || requestId !== loadRequestIdRef.current) return;

      setProducts(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || err.name === 'CanceledError' || signal.aborted) {
        return;
      }
      if (requestId !== loadRequestIdRef.current) return;
      toast.error(err.response?.data?.error?.message || t('products.errors.load_products'));
      logger.error('Error loading products:', err);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filters, t]);

  const loadConfigData = useCallback(async () => {
    try {
      const [{ data: typesData }, settingsData] = await Promise.all([
        productTypeService.getProductTypes(),
        storeService.getDefaultStore().catch(() => null),
      ]);
      setProductTypes(typesData || []);
      setStoreSettings(settingsData);
    } catch (err) {
      logger.error('Failed to load types or settings', err);
    }
  }, []);

  // Load products when filters change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadConfigData();
  }, [loadConfigData]);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  }, 300);

  const debouncedProductTypeFilter = useDebouncedCallback((value: string) => {
    const normalized = value.trim().toUpperCase();
    setFilters(prev => ({ ...prev, product_type: normalized || undefined, page: 1 }));
  }, 300);

  const handleSearch = useCallback((search: string) => {
    // Update local state immediately for responsive UI
    setSearchQuery(search);
    // Debounced update will trigger the actual API call
    debouncedSearch(search);
  }, [debouncedSearch]);

  const handleProductTypeChange = useCallback(
    (raw: string) => {
      const upper = raw.toUpperCase();
      setProductTypeInput(upper);
      debouncedProductTypeFilter(upper);
    },
    [debouncedProductTypeFilter]
  );

  const handlePageChange = useCallback((newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setShowCustomUnit(false);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      product_type: '',
      unit_of_measure: 'each',
      list_price: '',
      sale_price: '',
      margin_pct: '',
      tax_rate: '',
      track_inventory: true,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((product: Product) => {
    setEditingProduct(product);
    const _uom = product.unit_of_measure || 'each';
    setShowCustomUnit(!STANDARD_UNITS.includes(_uom));
    const _list = product.list_price?.toString() || '';
    const _sale = product.sale_price?.toString() || '';
    let _margin = '';
    if (_list && _sale && parseFloat(_list) > 0) {
      _margin = (((parseFloat(_sale) - parseFloat(_list)) / parseFloat(_list)) * 100).toFixed(2);
    }
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      product_type: product.product_type,
      unit_of_measure: _uom,
      list_price: _list,
      sale_price: _sale,
      margin_pct: _margin,
      tax_rate: product.tax_rate?.toString() || '',
      track_inventory: product.track_inventory,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowCustomUnit(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      product_type: '',
      unit_of_measure: 'each',
      list_price: '',
      sale_price: '',
      margin_pct: '',
      tax_rate: '',
      track_inventory: true,
    });
    setFormErrors({});
  }, []);

  const closeTypeModal = useCallback(() => {
    setShowTypeModal(false);
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('products.validation.name_required');
    }

    if (formData.barcode) {
      const barcodeRegex = /^\d{8,13}$/;
      if (!barcodeRegex.test(formData.barcode)) {
        errors.barcode = t('products.validation.barcode_invalid');
      }
    }

    if (formData.list_price && parseFloat(formData.list_price) < 0) {
      errors.list_price = t('products.validation.list_price_positive');
    }

    if (formData.sale_price && parseFloat(formData.sale_price) < 0) {
      errors.sale_price = t('products.validation.sale_price_positive');
    }

    if (formData.tax_rate) {
      const taxRate = parseFloat(formData.tax_rate);
      if (taxRate < 0 || taxRate > 100) {
        errors.tax_rate = t('products.validation.tax_rate_range');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const handlePriceChange = useCallback((field: 'list_price' | 'sale_price' | 'margin_pct', value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      
      const listPrice = parseFloat(next.list_price);
      if (isNaN(listPrice) || listPrice <= 0) {
        return next;
      }

      if (field === 'margin_pct') {
        const margin = parseFloat(value);
        if (!isNaN(margin)) {
          // Sale Price = List Price + (List Price * Margin %)
          next.sale_price = (listPrice * (1 + margin / 100)).toFixed(2);
        } else if (value === '') {
          next.sale_price = '';
        }
      } else if (field === 'sale_price') {
        const salePrice = parseFloat(value);
        if (!isNaN(salePrice)) {
          next.margin_pct = (((salePrice - listPrice) / listPrice) * 100).toFixed(2);
        } else if (value === '') {
          next.margin_pct = '';
        }
      } else if (field === 'list_price') {
        // If List Price changes, keep Sale Price static if it exists and adjust Margin
        const salePrice = parseFloat(next.sale_price);
        if (!isNaN(salePrice)) {
          next.margin_pct = (((salePrice - listPrice) / listPrice) * 100).toFixed(2);
        }
      }

      return next;
    });
  }, []);

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
        unit_of_measure: formData.unit_of_measure || 'each',
        list_price: formData.list_price ? parseFloat(formData.list_price) : undefined,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : undefined,
        margin_pct: formData.margin_pct ? parseFloat(formData.margin_pct) : undefined,
        tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : undefined,
        track_inventory: formData.track_inventory,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.product_id, productData);
      } else {
        await productService.createProduct(productData);
      }

      closeModal();
      toast.success(editingProduct ? t('products.success.product_updated') : t('products.success.product_created'));
      loadProducts();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('products.errors.timeout'));
      } else {
        const errorMessage = err.response?.data?.error?.message || t('products.errors.save_product');
        toast.error(errorMessage);
      }
      console.error('Error saving product:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingProduct, closeModal, loadProducts, validateForm, t]);

  const handleDelete = useCallback(async (product: Product) => {
    if (!window.confirm(t('products.confirm.delete_product', { name: product.name }))) {
      return;
    }

    try {
      await productService.deleteProduct(product.product_id);
      toast.success(t('products.success.product_deleted'));
      loadProducts();
    } catch (err: any) {
      if (err.isTimeout || err.message?.includes('timeout')) {
        toast.error(t('products.errors.timeout'));
      } else {
        const errorMessage = err.response?.data?.error?.message || t('products.errors.delete_product');
        toast.error(errorMessage);
      }
      console.error('Error deleting product:', err);
    }
  }, [loadProducts, t]);

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
        toast.error(t('products.errors.lookup_barcode'));
      }
    }
  };

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, [language]);

  const getColumnLabel = useCallback((columnId: string) => {
    return t(`products.columns.${columnId}`);
  }, [t]);

  const handleTypeSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeFormData.name.trim()) return;
    try {
      setTypeSubmitting(true);
      if (editingProductType) {
        await productTypeService.updateProductType(editingProductType.id, { 
          name: typeFormData.name.trim(),
          display_on_pos: typeFormData.display_on_pos 
        });
        toast.success(t('products.success.product_type_updated'));
      } else {
        await productTypeService.createProductType({ 
          name: typeFormData.name.trim(),
          display_on_pos: typeFormData.display_on_pos
        });
        toast.success(t('products.success.product_type_created'));
      }
      setTypeFormData({ name: '', display_on_pos: false });
      setEditingProductType(null);
      loadConfigData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('products.errors.finish_action'));
    } finally {
      setTypeSubmitting(false);
    }
  }, [typeFormData, editingProductType, loadConfigData, t]);

  const handleDeleteProductType = async (id: string) => {
    if (!window.confirm(t('products.confirm.delete_type'))) return;
    try {
      await productTypeService.deleteProductType(id);
      toast.success(t('products.success.product_type_deleted'));
      loadConfigData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('products.errors.delete_product_type'));
    }
  };

  const handleEditProductType = (type: ProductType) => {
    setEditingProductType(type);
    setTypeFormData({ name: type.name, display_on_pos: type.display_on_pos });
  };

  return (
    <>
      <PageBanner
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        icon={<BookOpenIcon className="w-5 h-5 text-white" />}
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowTypeModal(true);
                setEditingProductType(null);
                setTypeFormData({ name: '', display_on_pos: false });
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all"
              leftIcon={<TagIcon className="w-4 h-4" />}
            >
              {t('products.actions.manage_product_types')}
            </Button>
            <Button
              onClick={openAddModal}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all"
              leftIcon={<PlusIcon className="w-4 h-4" />}
            >
              {t('products.actions.add_product')}
            </Button>
          </div>
        }
      />

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
                  placeholder={t('products.filters.search_placeholder')}
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
                placeholder={t('products.filters.type_placeholder')}
                value={productTypeInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProductTypeChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 bg-white font-medium uppercase"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <QrCodeIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder={t('products.filters.scan_barcode_placeholder')}
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
              <Badge variant="success" size="sm">{t('products.filters.products_count', { count: pagination.total })}</Badge>
              {filters.search && (
                <Badge variant="primary" size="sm">
                  {t('products.filters.filtered_results', { count: products.length })}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative" ref={columnsMenuRef}>
                <button
                  onClick={() => setShowManageColumns(!showManageColumns)}
                  className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200"
                >
                  <AdjustmentsVerticalIcon className="w-3.5 h-3.5" />
                  <span>{t('products.actions.columns')}</span>
                </button>
                {showManageColumns && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1.5 max-h-80 overflow-y-auto">
                    <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('products.columns.show_hide')}</span>
                    </div>
                    {columnsConfig.map(col => (
                      <label key={col.id} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-3 rounded border-gray-300 text-secondary-500 focus:ring-secondary-500 h-4 w-4"
                          checked={col.visible}
                          onChange={() => {
                            setColumnsConfig(prev => prev.map(c => 
                              c.id === col.id ? { ...c, visible: !c.visible } : c
                            ));
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">{getColumnLabel(col.id)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={loadProducts}
                className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                <span>{t('products.actions.refresh')}</span>
              </button>
            </div>
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
                  title={t('products.empty.title')}
                  description={filters.search ? t('products.empty.filtered_description') : t('products.empty.default_description')}
                  action={
                    !filters.search && (
                      <Button onClick={openAddModal} leftIcon={<PlusIcon className="w-4 h-4" />} variant="primary" size="sm">
                        {t('products.actions.add_product')}
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <table
                ref={tableRef}
                className="divide-y divide-gray-200"
                style={isCustomSized ? { tableLayout: 'fixed', width: columnsConfig.filter(c => c.visible).reduce((sum, c) => sum + c.width, 0) } : { tableLayout: 'auto', minWidth: '100%' }}
              >
                {isCustomSized && (
                  <colgroup>
                    {columnsConfig.filter(c => c.visible).map(c => (
                      <col key={c.id} style={{ width: c.width }} />
                    ))}
                  </colgroup>
                )}
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    {columnsConfig.filter(c => c.visible).map((c, idx, arr) => (
                      <th
                        key={c.id}
                        className={`relative px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider ${isCustomSized ? 'max-w-0' : 'w-min'} ${c.id === 'actions' ? 'text-right' : 'text-left'}`}
                      >
                        <div className="truncate">{getColumnLabel(c.id)}</div>
                        {idx < arr.length - 1 && (
                          <div
                            onMouseDown={(e) => startColumnResize(e, c.id, c.width)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-secondary-400 active:bg-secondary-600 transition-colors z-10"
                          />
                        )}
                      </th>
                    ))}
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
                      visibleColumns={columnsConfig.filter(c => c.visible).map(c => c.id)}
                      isCustomSized={isCustomSized}
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
              {t('products.pagination.showing')} <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> {t('products.pagination.to')}{' '}
              <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> {t('products.pagination.of')}{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> {t('products.pagination.products')}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                {t('products.pagination.previous')}
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                {t('products.pagination.page')} {pagination.page} {t('products.pagination.of')} {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                size="sm"
              >
                {t('products.pagination.next')}
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
            <span className="text-base">{editingProduct ? t('products.modal.edit_title') : t('products.modal.add_title')}</span>
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
              {t('products.actions.cancel')}
            </Button>
            <Button
              type="submit"
              form="product-form"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={submitting}
            >
              {editingProduct ? t('products.actions.update_product') : t('products.actions.create_product')}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label={t('products.form.product_name')}
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
                label={t('products.form.sku')}
                type="text"
                value={formData.sku}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  if (value.length <= INPUT_LIMITS.SKU_MAX_LENGTH) {
                    setFormData({ ...formData, sku: value });
                  }
                }}
                maxLength={INPUT_LIMITS.SKU_MAX_LENGTH}
                helperText={t('products.form.sku_helper')}
              />
            </div>

            <div>
              <Input
                label={t('products.form.barcode')}
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
                helperText={t('products.form.barcode_helper')}
                leftIcon={<QrCodeIcon className="w-5 h-5" />}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t('products.form.product_type')}
              </label>
              <select
                value={formData.product_type}
                onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                required
              >
                <option value="" disabled>{t('products.form.select_type')}</option>
                {productTypes.map(type => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t('products.form.unit_of_measure')}
              </label>
              <select
                value={showCustomUnit ? 'custom_number' : formData.unit_of_measure}
                onChange={(e) => {
                  if (e.target.value === 'custom_number') {
                    setShowCustomUnit(true);
                    setFormData({ ...formData, unit_of_measure: '' });
                  } else {
                    setShowCustomUnit(false);
                    setFormData({ ...formData, unit_of_measure: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
              >
                <optgroup label={t('products.units.groups.count')}>
                  <option value="each">{t('products.units.each')}</option>
                  <option value="pair">{t('products.units.pair')}</option>
                  <option value="dozen">{t('products.units.dozen')}</option>
                  <option value="pack">{t('products.units.pack')}</option>
                  <option value="box">{t('products.units.box')}</option>
                  <option value="carton">{t('products.units.carton')}</option>
                </optgroup>
                <optgroup label={t('products.units.groups.weight')}>
                  <option value="kg">{t('products.units.kg')}</option>
                  <option value="g">{t('products.units.g')}</option>
                  <option value="lb">{t('products.units.lb')}</option>
                  <option value="oz">{t('products.units.oz')}</option>
                </optgroup>
                <optgroup label={t('products.units.groups.volume')}>
                  <option value="L">{t('products.units.L')}</option>
                  <option value="mL">{t('products.units.mL')}</option>
                </optgroup>
                <optgroup label={t('products.units.groups.length')}>
                  <option value="m">{t('products.units.m')}</option>
                  <option value="cm">{t('products.units.cm')}</option>
                </optgroup>
                <optgroup label={t('products.units.groups.other')}>
                  <option value="custom_number">{t('products.units.custom_number')}</option>
                </optgroup>
              </select>
              {showCustomUnit && (
                <input
                  type="text"
                  placeholder={t('products.form.custom_unit_placeholder')}
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                  className="mt-2 w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 bg-gray-50"
                  autoFocus
                />
              )}
              <p className="text-[10px] text-gray-500 mt-1">{t('products.form.unit_helper')}</p>
            </div>

            <div>
              <Input
                label={t('products.form.list_price')}
                type="number"
                step="0.01"
                min={INPUT_LIMITS.PRICE_MIN}
                max={INPUT_LIMITS.PRICE_MAX}
                value={formData.list_price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceChange('list_price', e.target.value)}
                error={formErrors.list_price}
                leftIcon={<span className="text-gray-500 font-semibold">$</span>}
              />
            </div>

            <div>
              <Input
                label={t('products.form.margin')}
                type="number"
                step="0.01"
                value={formData.margin_pct}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceChange('margin_pct', e.target.value)}
                rightIcon={<span className="text-gray-500 font-semibold">%</span>}
                helperText={t('products.form.margin_helper')}
              />
            </div>

            <div>
              <Input
                label={t('products.form.sale_price')}
                type="number"
                step="0.01"
                min={INPUT_LIMITS.PRICE_MIN}
                max={INPUT_LIMITS.PRICE_MAX}
                value={formData.sale_price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceChange('sale_price', e.target.value)}
                error={formErrors.sale_price}
                leftIcon={<span className="text-gray-500 font-semibold">$</span>}
              />
            </div>

            <div>
              <Input
                label={t('products.form.tax_rate')}
                type="number"
                step="0.01"
                min={INPUT_LIMITS.TAX_RATE_MIN}
                max={INPUT_LIMITS.TAX_RATE_MAX}
                value={formData.tax_rate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tax_rate: e.target.value })}
                error={formErrors.tax_rate}
                helperText={t('products.form.tax_rate_helper')}
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
                    {t('products.form.track_inventory')}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t('products.form.track_inventory_helper')}</p>
                </div>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Manage Product Type Modal */}
      <Modal
        isOpen={showTypeModal}
        onClose={closeTypeModal}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <TagIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">{t('products.types.modal_title')}</span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            {editingProductType && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingProductType(null);
                  setTypeFormData({ name: '', display_on_pos: false });
                }}
                disabled={typeSubmitting}
              >
                {t('products.types.cancel_edit')}
              </Button>
            )}
            <Button
              type="submit"
              form="product-type-form"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold transition-all"
              isLoading={typeSubmitting}
            >
              {editingProductType ? t('products.types.save_changes') : t('products.types.create_category')}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {productTypes.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl max-h-48 overflow-y-auto w-full">
              <ul className="divide-y divide-gray-200">
                {productTypes.map(type => (
                  <li key={type.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                    <div>
                      <span className="font-semibold text-gray-900 text-sm">{type.name}</span>
                      {type.display_on_pos && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          {t('products.types.pos_visible')}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditProductType(type)}
                        className="p-1.5 text-gray-400 hover:text-secondary-500 hover:bg-secondary-50 rounded-lg transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProductType(type.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{editingProductType ? t('products.types.edit_type') : t('products.types.add_new_category')}</h3>
            <form id="product-type-form" onSubmit={handleTypeSubmit} className="space-y-4">
              <Input
                label={t('products.types.name_label')}
                type="text"
                value={typeFormData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setTypeFormData({ ...typeFormData, name: e.target.value.toUpperCase() });
                }}
                required
                placeholder={t('products.types.name_placeholder')}
                className="uppercase"
              />

              {storeSettings?.pos_module_type === 'store' && (
                <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-secondary-500 hover:bg-secondary-50/50 cursor-pointer transition-all group">
                  <input
                    type="checkbox"
                    checked={typeFormData.display_on_pos}
                    onChange={(e) => setTypeFormData({ ...typeFormData, display_on_pos: e.target.checked })}
                    className="mr-2.5 h-4 w-4 text-secondary-500 focus:ring-secondary-500 border-gray-300 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-secondary-700">
                      {t('products.types.display_on_pos')}
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('products.types.display_on_pos_helper')}</p>
                  </div>
                </label>
              )}

            </form>
          </div>
        </div>
      </Modal>
    </>
  );
}
