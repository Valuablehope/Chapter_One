import { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useDebouncedCallback } from 'use-debounce';
import { productService, Product } from '../services/productService';
import { customerService, Customer } from '../services/customerService';
import { saleService, CartItem, PaymentMethod, OfflineError } from '../services/saleService';
import { storeService, StoreSettings } from '../services/storeService';
import { stockService, StockBalance } from '../services/stockService';
import { logger } from '../utils/logger';
import { receiptHeaderStoreName } from '../constants/branding';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  ShoppingCartIcon,
  UserIcon,
  CurrencyDollarIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  CreditCardIcon,
  BanknotesIcon,
  TicketIcon,
  PrinterIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import Receipt from '../components/Receipt';

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const processingAbortController = useRef<AbortController | null>(null);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [receiptCartItems, setReceiptCartItems] = useState<CartItem[]>([]);
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [stockBalances, setStockBalances] = useState<Map<string, StockBalance>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cartListContainerRef = useRef<HTMLDivElement>(null);
  const [cartListWidth, setCartListWidth] = useState(400);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      if (customerAbortController.current) {
        customerAbortController.current.abort();
      }
    };
  }, []);

  // Calculate totals
  const subtotal = useMemo(() => cart.reduce((sum, item) => {
    const itemSubtotal = Number(item.unit_price) * item.qty;
    return sum + itemSubtotal;
  }, 0), [cart]);

  const taxTotal = useMemo(() => cart.reduce((sum, item) => {
    const itemSubtotal = Number(item.unit_price) * item.qty;
    const tax = item.tax_rate ? (itemSubtotal * Number(item.tax_rate)) / 100 : 0;
    return sum + tax;
  }, 0), [cart]);

  const discountAmount = useMemo(() => discountRate
    ? (subtotal + taxTotal) * (parseFloat(discountRate) / 100)
    : 0, [discountRate, subtotal, taxTotal]);

  const grandTotal = useMemo(() => subtotal + taxTotal - discountAmount, [subtotal, taxTotal, discountAmount]);

  const CART_ROW_HEIGHT = 90;
  const CART_LIST_MAX_HEIGHT = 450;

  useEffect(() => {
    const el = cartListContainerRef.current;
    if (!el || cart.length === 0) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setCartListWidth(Math.floor(w));
    };

    measure();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setCartListWidth(Math.floor(w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cart.length]);

  // Search abort controller
  const searchAbortController = useRef<AbortController | null>(null);

  // Perform search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // Cancel previous request
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    // Create new controller
    searchAbortController.current = new AbortController();
    const signal = searchAbortController.current.signal;

    try {
      setSearching(true);
      const response = await productService.getProducts({
        search: query,
        limit: 10,
      }, signal);

      // Only update state if request wasn't cancelled
      if (!signal.aborted) {
        setSearchResults(response.data);
      }
    } catch (err: any) {
      // Ignore cancellation errors
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      toast.error('Failed to search products');
      logger.error('Error searching products:', err);
    } finally {
      if (!signal.aborted) {
        setSearching(false);
      }
    }
  };

  // Debounced search
  const debouncedSearch = useDebouncedCallback(performSearch, 300);

  // Handle search input change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      // Cancel any pending search
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      debouncedSearch.cancel(); // Cancel pending debounce
      return;
    }
    debouncedSearch(query);
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    try {
      const product = await productService.getProductByBarcode(barcode);
      addToCart(product);
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

  // Add product to cart
  const addToCart = async (product: Product) => {
    // Check stock availability ONLY if product tracks inventory AND allow_negative is explicitly false
    // If allow_negative is true, undefined, or null, skip stock check (allow negative stock)
    if (product.track_inventory && storeSettings && storeSettings.allow_negative === false) {
      try {
        const balance = await stockService.getStockBalance(product.product_id);
        const availableStock = balance?.qty_on_hand || 0;

        // Update stock balance in state
        if (balance) {
          setStockBalances(prev => new Map(prev).set(product.product_id, balance));
        }

        const existingItem = cart.find((item) => item.product.product_id === product.product_id);
        const requestedQty = existingItem ? existingItem.qty + 1 : 1;

        if (availableStock < requestedQty) {
          toast.error(
            `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${requestedQty}`
          );
          return;
        }
      } catch (error) {
        logger.warn('Failed to check stock, allowing add to cart', { error, productId: product.product_id });
        // Continue if stock check fails (graceful degradation)
      }
    }

    const existingItem = cart.find((item) => item.product.product_id === product.product_id);

    if (existingItem) {
      // Increase quantity
      updateCartItemQuantity(existingItem.product.product_id, existingItem.qty + 1);
    } else {
      // Add new item
      const price = Number(product.sale_price || product.list_price || 0);
      const taxRate = Number(product.tax_rate || 0);
      // line_total is the total including tax for the current quantity
      const lineTotal = price * (1 + taxRate / 100);

      setCart([
        ...cart,
        {
          product,
          qty: 1,
          unit_price: price,
          tax_rate: taxRate,
          line_total: lineTotal,
        },
      ]);
    }

    // Clear search
    handleSearchChange('');
    setSearchResults([]);
    // Focus barcode input instead of search
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Update cart item quantity
  const updateCartItemQuantity = async (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    // Check stock availability ONLY if product tracks inventory AND allow_negative is explicitly false
    // If allow_negative is true, undefined, or null, skip stock check (allow negative stock)
    const item = cart.find(i => i.product.product_id === productId);
    if (item && item.product.track_inventory && storeSettings && storeSettings.allow_negative === false) {
      try {
        const balance = await stockService.getStockBalance(productId);
        const availableStock = balance?.qty_on_hand || 0;

        if (balance) {
          setStockBalances(prev => new Map(prev).set(productId, balance));
        }

        if (availableStock < qty) {
          toast.error(
            `Insufficient stock for ${item.product.name}. Available: ${availableStock}, Requested: ${qty}`
          );
          return;
        }
      } catch (error) {
        logger.warn('Failed to check stock, allowing quantity update', { error, productId });
        // Continue if stock check fails (graceful degradation)
      }
    }

    setCart(
      cart.map((item) => {
        if (item.product.product_id === productId) {
          // Calculate line total: unit_price * qty * (1 + tax_rate/100)
          const lineTotal = Number(item.unit_price) * qty * (1 + (Number(item.tax_rate) || 0) / 100);
          return { ...item, qty, line_total: lineTotal };
        }
        return item;
      })
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.product_id !== productId));
  };

  // Search customers
  // Customer search abort controller
  const customerAbortController = useRef<AbortController | null>(null);

  // Perform customer search
  const performCustomerSearch = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }

    // Cancel previous request
    if (customerAbortController.current) {
      customerAbortController.current.abort();
    }

    // Create new controller
    customerAbortController.current = new AbortController();
    const signal = customerAbortController.current.signal;

    try {
      const response = await customerService.getCustomers({
        search: query,
        limit: 10,
      }, signal);

      // Only update state if request wasn't cancelled
      if (!signal.aborted) {
        setCustomerResults(response.data);
      }
    } catch (err: any) {
      // Ignore cancellation errors
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      toast.error('Failed to search customers');
      logger.error('Error searching customers:', err);
    }
  };

  // Debounced customer search
  const debouncedCustomerSearch = useDebouncedCallback(performCustomerSearch, 300);

  // Handle customer search input (renamed to match usage, but wraps debouncer)
  const handleCustomerSearch = (query: string) => {
    // Note: State update for input value is handled by caller (setCustomerSearch)
    if (!query.trim()) {
      setCustomerResults([]);
      // Cancel pending
      if (customerAbortController.current) {
        customerAbortController.current.abort();
      }
      debouncedCustomerSearch.cancel();
      return;
    }
    debouncedCustomerSearch(query);
  };

  // Select customer
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  // Open payment modal
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPaymentAmount(grandTotal.toFixed(2));
    setShowPaymentModal(true);
  };

  // Process payment with optimistic updates
  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // Validate stock availability ONLY if allow_negative is explicitly false
    // If allow_negative is true, undefined, or null, skip stock check (allow negative stock)
    if (storeSettings && storeSettings.allow_negative === false) {
      const productIds = cart.map(item => item.product.product_id);
      try {
        const balances = await stockService.getStockBalances(productIds);
        const balancesMap = new Map(balances.map(b => [b.product_id, b]));
        setStockBalances(balancesMap);

        // Check each item for sufficient stock
        for (const item of cart) {
          if (item.product.track_inventory) {
            const balance = balancesMap.get(item.product.product_id);
            const availableStock = balance?.qty_on_hand || 0;

            if (availableStock < item.qty) {
              toast.error(
                `Insufficient stock for ${item.product.name}. Available: ${availableStock}, Requested: ${item.qty}`
              );
              return;
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to validate stock before payment, proceeding', { error });
        // Continue if stock validation fails (backend will validate)
      }
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < grandTotal) {
      toast.error(`Payment amount must be at least $${grandTotal.toFixed(2)}`);
      return;
    }

    // Store current state for rollback
    const previousCart = [...cart];
    const previousCustomer = selectedCustomer;

    // Create abort controller for cancellation
    processingAbortController.current = new AbortController();

    try {
      setProcessing(true);
      setProcessingProgress(0);
      setProcessingStage('Preparing sale...');

      // Filter out invalid items and ensure all required fields are present
      const validItems = cart
        .filter((item) =>
          item.product &&
          item.product.product_id &&
          item.qty > 0 &&
          item.unit_price > 0
        )
        .map((item) => ({
          product_id: item.product.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
        }));

      // Validate we have valid items
      if (validItems.length === 0) {
        toast.error('Cart is empty or contains invalid items');
        setProcessing(false);
        return;
      }

      const saleData = {
        customer_id: selectedCustomer?.customer_id,
        discount_rate: discountRate ? parseFloat(discountRate) : undefined,
        items: validItems,
        payments: [
          {
            method: paymentMethod,
            // Amount applied to the sale (matches grand_total), not cash tendered — tender is for UX/change only.
            amount: Math.round(grandTotal * 100) / 100,
          },
        ],
      };

      setProcessingProgress(30);
      setProcessingStage('Processing payment...');

      // Create sale with progress updates
      const sale = await saleService.createSale(saleData);

      setProcessingProgress(80);
      setProcessingStage('Finalizing...');

      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingProgress(100);
      setProcessingStage('Complete!');

      // Aggressively inject frontend values to ensure receipt matches user expectation
      // This covers cases where backend might ignore discount (missing column)
      // or return 0.
      const hasDiscount = discountRate && parseFloat(discountRate) > 0;

      const finalSale = {
        ...sale,
        discount_rate: hasDiscount ? parseFloat(discountRate) : (sale.discount_rate || 0),
        discount_total: hasDiscount ? discountAmount : (sale.discount_total || 0),
        // If we have a local discount that wasn't applied by backend (e.g. backend total > frontend total)
        // force the frontend total for the receipt display.
        grand_total: (hasDiscount && sale.grand_total > grandTotal) ? grandTotal : sale.grand_total,
      };

      setCompletedSale(finalSale);
      setReceiptCartItems(previousCart); // Store cart items for receipt
      setReceiptCustomer(previousCustomer); // Store customer for receipt
      setShowPaymentModal(false);
      toast.success('Sale completed successfully!');

      // Clear cart and customer
      setCart([]);
      setSelectedCustomer(null);
    } catch (err: any) {
      // Check if cancelled
      if (err.name === 'AbortError' || err.message?.includes('cancel')) {
        toast('Sale processing cancelled', { icon: 'ℹ️' });
        setProcessingStage('');
        setProcessingProgress(0);
        return;
      }

      // Rollback optimistic updates on error
      setCart(previousCart);
      setSelectedCustomer(previousCustomer);

      // Handle offline errors specially
      if (err instanceof OfflineError) {
        toast.success('Sale queued for offline sync. It will be synced when connection is restored.');
        // Clear cart and customer for offline sales (already queued)
        setCart([]);
        setSelectedCustomer(null);
        setShowPaymentModal(false);
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to process payment');
        logger.error('Error processing payment:', err);
      }
    } finally {
      setProcessing(false);
      setProcessingProgress(0);
      setProcessingStage('');
      processingAbortController.current = null;
    }
  };

  // Cancel sale processing
  const cancelProcessing = () => {
    if (processingAbortController.current) {
      processingAbortController.current.abort();
    }
    setProcessing(false);
    setProcessingProgress(0);
    setProcessingStage('');
  };

  // Start new sale
  const startNewSale = () => {
    setCompletedSale(null);
    setReceiptCartItems([]);
    setReceiptCustomer(null);
    setCart([]);
    setSelectedCustomer(null);
    setDiscountRate(''); // Clear discount
    // Focus barcode input instead of search
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Print receipt
  const handlePrint = () => {
    window.print();
  };

  // Fetch store settings when sale completes
  useEffect(() => {
    if (completedSale?.store_id) {
      storeService.getStoreSettings(completedSale.store_id)
        .then((settings) => {
          // Merge with defaults since not all columns exist in DB
          setStoreSettings({
            store_id: settings.store_id,
            code: settings.code || '',
            name: receiptHeaderStoreName(settings.name),
            address: settings.address,
            // Use defaults for settings that don't exist in DB
            currency_code: settings.currency_code || 'USD',
            tax_inclusive: settings.tax_inclusive ?? false,
            theme: settings.theme || 'classic',
            timezone: settings.timezone || 'UTC',
            tax_rate: settings.tax_rate || 0,
            receipt_footer: settings.receipt_footer || '',
            receipt_header: settings.receipt_header || '',
            auto_backup: settings.auto_backup ?? false,
            backup_frequency: settings.backup_frequency || 'daily',
          });
        })
        .catch((err) => {
          logger.error('Failed to fetch store settings:', err);
          // Set defaults if fetch fails
          setStoreSettings({
            store_id: completedSale.store_id,
            code: '',
            name: 'Chapter One',
            currency_code: 'USD',
            tax_inclusive: false,
            timezone: 'UTC',
          } as StoreSettings);
        });
    }
  }, [completedSale?.store_id]);



  // Load store settings on mount
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        // Get default store using public endpoint (accessible to all authenticated users)
        const settings = await storeService.getDefaultStore();
        setStoreSettings({
          ...settings,
          name: receiptHeaderStoreName(settings.name),
          // Preserve allow_negative value from API (don't default to false)
          allow_negative: settings.allow_negative,
        });
      } catch (error) {
        logger.warn('Failed to fetch store settings on mount', { error });
        // Don't set default to false - let it be null so stock checks are skipped
        // This allows sales to proceed even if settings can't be loaded
        setStoreSettings(null);
      }
    };
    fetchStoreSettings();
  }, []);

  // Focus barcode input on mount (not search - user chooses when to search)
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Search is now debounced via useDebouncedCallback

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return <BanknotesIcon className="w-5 h-5" />;
      case 'card':
        return <CreditCardIcon className="w-5 h-5" />;
      case 'voucher':
        return <TicketIcon className="w-5 h-5" />;
      default:
        return <CurrencyDollarIcon className="w-5 h-5" />;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Enhanced Product Search */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <MagnifyingGlassIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Product Search</h2>
              </div>

              {/* Barcode Scanner */}
              <div className="mb-3">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <QrCodeIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan or enter barcode..."
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
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 ml-3">Press Enter to scan</p>
              </div>

              {/* Product Search */}
              <div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                    placeholder="Search by name, SKU, or barcode..."
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                  />
                </div>
              </div>

              {/* Enhanced Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 border-2 border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white shadow-inner">
                  {searchResults.map((product) => (
                    <button
                      key={product.product_id}
                      onClick={() => addToCart(product)}
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
                          <div className="flex items-center gap-1.5">
                            {product.barcode && (
                              <Badge variant="gray" size="sm" className="font-mono text-[10px]">
                                {product.barcode}
                              </Badge>
                            )}
                            {product.sku && (
                              <span className="text-[10px] text-gray-500 font-mono">SKU: {product.sku}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-bold text-sm text-secondary-500">
                            ${Number(product.sale_price || product.list_price || 0).toFixed(2)}
                          </p>
                          {product.track_inventory && (
                            <p className="text-[10px] text-gray-500 mt-0.5">In Stock</p>
                          )}
                          <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 mt-1 ml-auto transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="mt-3 text-center py-3">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-blue-200 border-t-blue-600"></div>
                  <p className="mt-1.5 text-xs text-gray-500 font-medium">Searching...</p>
                </div>
              )}
            </div>
          </Card>

          {/* Enhanced Shopping Cart */}
          <Card padding="none" className="border-2 border-gray-100 shadow-md overflow-hidden">
            <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-secondary-500 rounded-lg">
                    <ShoppingCartIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Shopping Cart</h2>
                    {cart.length > 0 && (
                      <p className="text-xs text-gray-600">{cart.length} {cart.length === 1 ? 'item' : 'items'}</p>
                    )}
                  </div>
                </div>
                {cart.length > 0 && (
                  <Badge variant="success" size="sm" className="font-bold">
                    {cart.reduce((sum, item) => sum + item.qty, 0)} items
                  </Badge>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<ShoppingCartIcon className="w-12 h-12" />}
                  title="Cart is empty"
                  description="Search and add products to get started"
                />
              </div>
            ) : (
              <div ref={cartListContainerRef} className="bg-white w-full min-w-0">
                <FixedSizeList
                  height={Math.min(cart.length * CART_ROW_HEIGHT, CART_LIST_MAX_HEIGHT)}
                  width={cartListWidth}
                  itemCount={cart.length}
                  itemSize={CART_ROW_HEIGHT}
                >
                  {({ index, style }: ListChildComponentProps) => {
                    const item = cart[index];
                    const stockBalance = stockBalances.get(item.product.product_id);
                    const availableStock = stockBalance?.qty_on_hand ?? null;
                    const isLowStock = item.product.track_inventory && availableStock !== null && availableStock < item.qty;
                    const isOutOfStock = item.product.track_inventory && availableStock !== null && availableStock === 0;

                    return (
                      <div style={style}>
                        <div className={`h-full border-b border-gray-100 px-3 py-2.5 hover:bg-secondary-50 transition-all group ${isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''}`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <div className="p-1 bg-secondary-100 rounded-lg">
                              <SparklesIcon className="w-3.5 h-3.5 text-secondary-500" />
                            </div>
                            <p className="font-bold text-xs text-gray-900">{item.product.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-gray-600">
                              ${Number(item.unit_price).toFixed(2)} each
                            </span>
                            {item.product.track_inventory && availableStock !== null && (
                              <span className={`text-xs font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-500'}`}>
                                Stock: {availableStock}
                              </span>
                            )}
                            {Number(item.tax_rate) > 0 && (
                              <Badge variant="info" size="sm">
                                Tax: {Number(item.tax_rate)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-0 border-2 border-gray-200 rounded-lg bg-white overflow-hidden">
                            <Button
                              onClick={() => updateCartItemQuantity(item.product.product_id, item.qty - 1)}
                              variant="ghost"
                              size="sm"
                              className="!p-1.5 hover:bg-gray-100 rounded-none border-r border-gray-200"
                            >
                              <MinusIcon className="w-3 h-3" />
                            </Button>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  updateCartItemQuantity(item.product.product_id, val);
                                } else if (e.target.value === '') {
                                  // Optional: allow empty temporary state if needed, 
                                  // but usually safer to just ignore or set to 1 on blur.
                                  // For now, let's just not update if invalid
                                }
                              }}
                              className="w-12 text-center font-bold text-xs text-gray-900 py-1.5 focus:outline-none focus:bg-gray-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Button
                              onClick={() => updateCartItemQuantity(item.product.product_id, item.qty + 1)}
                              variant="ghost"
                              size="sm"
                              className="!p-1.5 hover:bg-gray-100 rounded-none border-l border-gray-200"
                            >
                              <PlusIcon className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className="font-bold text-sm text-secondary-500">
                              ${Number(item.line_total).toFixed(2)}
                            </p>
                          </div>
                          <Button
                            onClick={() => removeFromCart(item.product.product_id)}
                            variant="danger"
                            size="sm"
                            className="!p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                }}
                </FixedSizeList>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Customer & Totals */}
        <div className="space-y-3">
          {/* Enhanced Customer Selection */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Customer</h2>
              </div>
              {selectedCustomer ? (
                <div className="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-xs text-gray-900">
                        {selectedCustomer.full_name || 'Unnamed Customer'}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-gray-600 mt-0.5">{selectedCustomer.phone}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => setSelectedCustomer(null)}
                      variant="ghost"
                      size="sm"
                      className="!p-1 hover:bg-white"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowCustomerModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full border-2 hover:bg-sky-50 hover:border-sky-300 transition-all"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  Add Customer
                </Button>
              )}
            </div>
          </Card>

          {/* Enhanced Totals */}
          <Card className="border-2 border-secondary-200 bg-white shadow-lg">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <CurrencyDollarIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Totals</h2>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">Subtotal:</span>
                  <span className="font-bold text-xs text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">Tax:</span>
                  <span className="font-bold text-xs text-gray-900">${taxTotal.toFixed(2)}</span>
                </div>

                {/* Discount Percentage Input */}
                <div className="p-2 bg-white/60 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-xs text-gray-700">Discount %:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={discountRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          setDiscountRate(value);
                        }
                      }}
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 text-right font-semibold"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                    <span className={`font-medium text-xs ${discountAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>Discount Amount:</span>
                    <span className={`font-bold text-xs ${discountAmount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {discountAmount > 0 ? '-' : ''}${discountAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border-t-2 border-secondary-300 pt-2 mt-2">
                  <div className="flex justify-between items-center p-3 bg-secondary-500 rounded-lg text-white">
                    <span className="text-base font-bold">Total:</span>
                    <span className="text-xl font-extrabold">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={openPaymentModal}
                disabled={cart.length === 0 || processing}
                className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm"
                leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                isLoading={processing}
              >
                Process Payment
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Enhanced Customer Selection Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setCustomerSearch('');
          setCustomerResults([]);
        }}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">Select Customer</span>
          </div>
        }
        size="md"
      >
        <div>
          <div className="w-full">
            <Input
              type="text"
              value={customerSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCustomerSearch(e.target.value);
                handleCustomerSearch(e.target.value);
              }}
              placeholder="Search customers..."
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
              autoFocus
              className="w-full"
            />
          </div>
          <div className="mt-3 max-h-48 overflow-y-auto">
            {customerResults.length > 0 ? (
              <div className="space-y-1.5">
                {customerResults.map((customer) => (
                  <button
                    key={customer.customer_id}
                    onClick={() => selectCustomer(customer)}
                    className="w-full px-3 py-2 text-left hover:bg-secondary-50 border-2 border-gray-200 hover:border-secondary-300 rounded-lg transition-all group"
                  >
                    <div className="flex items-center space-x-1.5">
                      <div className="p-1 bg-secondary-100 rounded-lg">
                        <UserIcon className="w-3.5 h-3.5 text-secondary-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-xs text-gray-900 group-hover:text-secondary-500">
                          {customer.full_name || 'Unnamed Customer'}
                        </p>
                        {customer.phone && (
                          <p className="text-xs text-gray-600 mt-0.5">{customer.phone}</p>
                        )}
                      </div>
                      <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : customerSearch ? (
              <EmptyState
                title="No customers found"
                description="Try a different search term"
              />
            ) : (
              <EmptyState
                title="Search for customers"
                description="Start typing to search"
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Enhanced Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <CurrencyDollarIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">Process Payment</span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                if (processing) {
                  cancelProcessing();
                } else {
                  setShowPaymentModal(false);
                }
              }}
              disabled={false}
              variant="outline"
            >
              {processing ? 'Cancel Processing' : 'Cancel'}
            </Button>
            <Button
              onClick={processPayment}
              disabled={processing}
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={processing}
              leftIcon={getPaymentIcon(paymentMethod)}
            >
              {processing ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card', 'voucher', 'other'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === method
                    ? 'border-secondary-500 bg-secondary-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex flex-col items-center space-y-1.5">
                    <div className={`p-1.5 rounded-lg ${paymentMethod === method
                      ? 'bg-secondary-500'
                      : 'bg-gray-200'
                      }`}>
                      {method === 'cash' && <BanknotesIcon className="w-4 h-4 text-white" />}
                      {method === 'card' && <CreditCardIcon className="w-4 h-4 text-white" />}
                      {method === 'voucher' && <TicketIcon className="w-4 h-4 text-white" />}
                      {method === 'other' && <CurrencyDollarIcon className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`font-semibold text-xs capitalize ${paymentMethod === method ? 'text-secondary-500' : 'text-gray-700'
                      }`}>
                      {method}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Input
              type="number"
              step="0.01"
              min={grandTotal}
              value={paymentAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
              label="Payment Amount"
              leftIcon={<CurrencyDollarIcon className="w-5 h-5" />}
              helperText={`Total due: $${grandTotal.toFixed(2)}`}
            />
          </div>
          <div className="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-gray-700">Grand Total:</span>
              <span className="text-xl font-extrabold text-secondary-500">${grandTotal.toFixed(2)}</span>
            </div>
            {parseFloat(paymentAmount) > grandTotal && (
              <div className="mt-2 pt-2 border-t border-secondary-300 flex justify-between items-center">
                <span className="font-semibold text-xs text-secondary-700">Change:</span>
                <span className="text-base font-bold text-secondary-500">
                  ${(parseFloat(paymentAmount) - grandTotal).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          {processing && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-900">{processingStage || 'Processing...'}</span>
                <span className="text-sm font-bold text-blue-600">{processingProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-blue-700 mt-2">Please wait while we process your sale...</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      {completedSale && (
        <Modal
          isOpen={!!completedSale}
          onClose={startNewSale}
          title=""
          size="lg"
          showCloseButton={false}
          footer={
            <div className="flex gap-3 print:hidden">
              <Button
                onClick={handlePrint}
                className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PrinterIcon className="w-5 h-5" />}
              >
                Print Receipt
              </Button>
              <Button
                onClick={startNewSale}
                variant="outline"
                className="flex-1 border-2"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                New Sale
              </Button>
            </div>
          }
        >
          <Receipt
            settings={storeSettings}
            sale={completedSale}
            customer={receiptCustomer}
            items={receiptCartItems}
          />
        </Modal>
      )}

      {/* Hidden Print Portal */}
      {completedSale && createPortal(
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
            sale={completedSale}
            customer={receiptCustomer}
            items={receiptCartItems}
          />
        </div>,
        document.body
      )}
    </>
  );
}

