import { useState, useEffect, useRef, useMemo, useCallback } from 'react'; 
import { createPortal } from 'react-dom';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useDebouncedCallback } from 'use-debounce';
import { productService, Product } from '../services/productService';
import { productTypeService } from '../services/productTypeService';
import { customerService, Customer } from '../services/customerService';
import { saleService, CartItem, PaymentMethod, OfflineError } from '../services/saleService';
import { storeService, StoreSettings } from '../services/storeService';
import { getStoreDisplayName, showCustomerDisplay } from '../services/customerDisplayService';
import { API_BASE_URL } from '../services/api';
import { stockService, StockBalance } from '../services/stockService';
import { logger } from '../utils/logger';
import { gradients } from '../styles/tokens';
import { useTranslation } from '../i18n/I18nContext';
import { useSaleSessions } from '../hooks/useSaleSessions';
import { useAuthStore } from '../store/authStore';
import HeldSalesPanel from './Sales/HeldSalesPanel';

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
  BookOpenIcon,
  TagIcon,
  ScaleIcon,
  CheckIcon,
  BackspaceIcon,
  PauseCircleIcon,
  GlobeAltIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Receipt from '../components/Receipt';
import {
  computeLineAmounts,
  discountAndGrand,
  effectiveProductTaxRate,
  roundMoney,
  type SaleTaxMode,
} from '../utils/saleTotals';

export default function Sales() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // ── Multi-sale session management ──────────────────────────────────────────
  const {
    activeSale,
    heldSales,
    updateActiveSale,
    holdSale,
    resumeSale,
    deleteHeldSale,
    completeActiveSale,
  } = useSaleSessions();

  // Track whether we are currently restoring a resumed sale to avoid feedback loops
  const isResumingRef = useRef(false);
  const holdBtnRef = useRef<HTMLButtonElement>(null);
  const [showHeldPanel, setShowHeldPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchResultsDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    user?.role === 'self_checkout' ? 'card' : 'cash'
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountLBP, setPaymentAmountLBP] = useState('');
  const [discountRate, setDiscountRate] = useState(
    () => activeSale?.discountRate ?? ''
  );
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const processingAbortController = useRef<AbortController | null>(null);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [receiptCartItems, setReceiptCartItems] = useState<CartItem[]>([]);
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  /** LBP per 1 unit of store currency (from DB); single source for all POS LBP UI and math */
  const [lbpExchangeRatePerUsd, setLbpExchangeRatePerUsd] = useState(0);
  const [posSettingsStatus, setPosSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stockBalances, setStockBalances] = useState<Map<string, StockBalance>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cartListContainerRef = useRef<HTMLDivElement>(null);

  // Quick Add / Weigh Item Modal State
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddQty, setQuickAddQty] = useState<string>('1');
  const [quickAddTotal, setQuickAddTotal] = useState<string>('');
  const [quickAddFocus, setQuickAddFocus] = useState<'qty' | 'total'>('qty');

  const [posProducts, setPosProducts] = useState<Product[]>([]);
  const [posCategories, setPosCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // ── Restore active sale from localStorage on mount/resume ─────────────────
  useEffect(() => {
    if (!activeSale) return;
    // Avoid overwriting current state when we haven't just resumed
    if (isResumingRef.current) {
      isResumingRef.current = false;
      return;
    }
    // Only apply if there's something meaningful in the session
    if (activeSale.items.length > 0 || activeSale.customer || activeSale.discountRate) {
      isResumingRef.current = true;
      setCart(activeSale.items);
      setSelectedCustomer(activeSale.customer);
      setDiscountRate(activeSale.discountRate);
    }
  // Only run when activeSale.id changes (i.e. on mount or after a resume)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSale?.id]);


  // ── Hold sale handler ───────────────────────────────────────────────────────
  const handleHoldSale = useCallback(() => {
    const held = holdSale();
    if (!held) {
      toast.error('Cart is empty — nothing to hold');
      return;
    }
    setCart([]);
    setSelectedCustomer(null);
    setDiscountRate('');
    toast('Sale held', { icon: '⏸️' });
  }, [holdSale]);

  // ── Resume sale handler ─────────────────────────────────────────────────────
  const handleResumeSale = useCallback((id: string) => {
    const resumed = resumeSale(id);
    if (!resumed) return;
    isResumingRef.current = true;
    setCart(resumed.items);
    setSelectedCustomer(resumed.customer);
    setDiscountRate(resumed.discountRate);
    toast('Sale resumed', { icon: '▶️' });
  }, [resumeSale]);

  // ── Cleanup on unmount
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

  const loadPosInitialData = useCallback(async () => {
    setPosSettingsStatus('loading');
    try {
      const settings = await storeService.getDefaultStore();
      const showLbp = settings.show_lbp_price !== false;
      const rate = showLbp ? Math.max(0, Number(settings.lbp_exchange_rate ?? 0) || 0) : 0;
      setLbpExchangeRatePerUsd(rate);
      setStoreSettings({
        ...settings,
        allow_negative: settings.allow_negative,
      });
      try {
        const [productsRes, typesRes] = await Promise.all([
          productService.getProducts({ pos_category_only: true, limit: 1000 }),
          productTypeService.getProductTypes(),
        ]);
        setPosProducts(productsRes.data);
        const visibleTypes = typesRes.data
          .filter((t: { display_on_pos?: boolean }) => t.display_on_pos)
          .map((t: { name: string }) => t.name)
          .sort();
        setPosCategories(visibleTypes);
      } catch (err) {
        logger.error('Failed to load POS quick-add data', err);
      }
      setPosSettingsStatus('ready');
    } catch (error) {
      logger.warn('Failed to load store settings for POS', { error });
      setStoreSettings(null);
      setLbpExchangeRatePerUsd(0);
      setPosSettingsStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadPosInitialData();
  }, [loadPosInitialData]);

  useEffect(() => {
    if (posSettingsStatus !== 'ready' || !storeSettings) return;
    // Only when POS becomes ready — do not depend on storeSettings identity or refreshes after a sale will clear the pole during receipt.
    showCustomerDisplay(getStoreDisplayName(storeSettings), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once when switching to ready
  }, [posSettingsStatus]);

  // Recalculate cart lines when store tax mode or default rate changes (catalog price unchanged)
  useEffect(() => {
    if (!storeSettings) return;
    const taxInclusive = !!(storeSettings.tax_inclusive);
    const defaultTax = Number(storeSettings.tax_rate ?? 0);
    const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';
    setCart((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((item) => {
        const price = Number(item.product.sale_price || item.product.list_price || 0);
        const eff = taxInclusive
          ? effectiveProductTaxRate(item.product.tax_rate, defaultTax)
          : 0;
        const amounts = computeLineAmounts(item.qty, price, eff, mode);
        return {
          ...item,
          unit_price: amounts.unit_price,
          tax_rate: amounts.tax_rate,
          line_total: amounts.line_total,
        };
      });
    });
  }, [storeSettings?.tax_inclusive, storeSettings?.tax_rate]);

  const taxMode: SaleTaxMode = storeSettings?.tax_inclusive ? 'inclusive' : 'exclusive';

  const lbpRate = lbpExchangeRatePerUsd;

  const formatLBP = useCallback((amount: number): string | null => {
    if (!lbpExchangeRatePerUsd || lbpExchangeRatePerUsd <= 0) return null;
    const rawLbp = amount * lbpExchangeRatePerUsd;
    const finalLbp = storeSettings?.round_lbp_to_1000 ? Math.ceil(rawLbp / 1000) * 1000 : Math.round(rawLbp);
    return finalLbp.toLocaleString() + ' LBP';
  }, [lbpExchangeRatePerUsd, storeSettings?.round_lbp_to_1000]);


  const cartAmounts = useMemo(
    () =>
      cart.map((item) =>
        computeLineAmounts(
          item.qty,
          Number(item.unit_price),
          Number(item.tax_rate ?? 0),
          taxMode
        )
      ),
    [cart, taxMode]
  );

  const merchandiseGross = useMemo(
    () => roundMoney(cartAmounts.reduce((s, a) => s + a.line_total, 0)),
    [cartAmounts]
  );

  const subtotalNet = useMemo(
    () => roundMoney(cartAmounts.reduce((s, a) => s + a.line_net, 0)),
    [cartAmounts]
  );

  const taxExtracted = useMemo(
    () => roundMoney(cartAmounts.reduce((s, a) => s + a.line_tax, 0)),
    [cartAmounts]
  );

  const { discountAmount, grandTotal } = useMemo(() => {
    const dr = discountRate ? parseFloat(discountRate) : 0;
    return discountAndGrand(merchandiseGross, dr);
  }, [merchandiseGross, discountRate]);

  // ── Sync live cart/customer/discount → active session (must be after grandTotal) ──
  useEffect(() => {
    if (isResumingRef.current) return;
    updateActiveSale({
      items: cart,
      customer: selectedCustomer,
      discountRate,
      subtotal: merchandiseGross,
      tax: taxExtracted,
      total: grandTotal,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedCustomer, discountRate, grandTotal]);

  const isCompact = storeSettings?.ui_resolution === '1024x768';
  const CART_ROW_HEIGHT = isCompact ? 70 : 90;


  // Search abort controller
  const searchAbortController = useRef<AbortController | null>(null);

  // Update dropdown position for portal
  const updateDropdownPosition = useCallback(() => {
    if (searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (searchResults.length > 0 || searching) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      
      // Close on outside click
      const handleClickOutside = (e: MouseEvent) => {
        if (
          searchContainerRef.current && 
          !searchContainerRef.current.contains(e.target as Node) &&
          (!searchResultsDropdownRef.current || !searchResultsDropdownRef.current.contains(e.target as Node))
        ) {
          setSearchResults([]);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [searchResults.length, searching, updateDropdownPosition]);

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

  // Quick Add Modal Handlers
  const handlePosItemClick = useCallback((product: Product) => {
    setQuickAddProduct(product);
    setQuickAddQty('1');
    const unitPrice = Number(product.sale_price || product.list_price || 0);
    setQuickAddTotal(unitPrice.toFixed(2));
  }, []);

  const closeQuickAddModal = useCallback(() => {
    setQuickAddProduct(null);
    setQuickAddQty('1');
    setQuickAddTotal('');
    setQuickAddFocus('qty');
  }, []);

  const handleQuickQtyChange = useCallback((val: string) => {
    setQuickAddQty(val);
    if (!quickAddProduct) return;
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      const unitPrice = Number(quickAddProduct.sale_price || quickAddProduct.list_price || 0);
      setQuickAddTotal((parsed * unitPrice).toFixed(2));
    } else {
      setQuickAddTotal('');
    }
  }, [quickAddProduct]);

  const handleQuickTotalChange = useCallback((val: string) => {
    setQuickAddTotal(val);
    if (!quickAddProduct) return;
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      const unitPrice = Number(quickAddProduct.sale_price || quickAddProduct.list_price || 0);
      if (unitPrice > 0) {
        setQuickAddQty((parsed / unitPrice).toFixed(3).replace(/\.?0+$/, ''));
      }
    } else {
      setQuickAddQty('');
    }
  }, [quickAddProduct]);

  const handleQuickConfirm = () => {
    if (!quickAddProduct) return;
    const qty = parseFloat(quickAddQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    addToCart(quickAddProduct, qty);
    closeQuickAddModal();
  };

  const handleNumpadInput = (char: string) => {
    if (quickAddFocus === 'qty') {
      if (char === '.' && quickAddQty.includes('.')) return;
      const newVal = quickAddQty === '0' && char !== '.' ? char : quickAddQty + char;
      handleQuickQtyChange(newVal);
    } else {
      if (char === '.' && quickAddTotal.includes('.')) return;
      const newVal = quickAddTotal === '0' && char !== '.' ? char : quickAddTotal + char;
      handleQuickTotalChange(newVal);
    }
  };

  const handleNumpadBackspace = () => {
    if (quickAddFocus === 'qty') {
      const newVal = quickAddQty.length > 1 ? quickAddQty.slice(0, -1) : '0';
      handleQuickQtyChange(newVal);
    } else {
      const newVal = quickAddTotal.length > 1 ? quickAddTotal.slice(0, -1) : '0';
      handleQuickTotalChange(newVal);
    }
  };

  // Add product to cart
  const addToCart = async (product: Product, quantity: number = 1) => {
    // Check stock availability ONLY if product tracks inventory AND allow_negative is explicitly false.
    // Use the already-fetched stockBalances map to avoid an API/IndexedDB round-trip on every tap.
    // If the product is not yet in the map, fall back to a single async fetch to prime it.
    if (product.track_inventory && storeSettings && storeSettings.allow_negative === false) {
      try {
        let balance = stockBalances.get(product.product_id);
        if (!balance) {
          const fetched = await stockService.getStockBalance(product.product_id);
          if (fetched) {
            balance = fetched;
            setStockBalances(prev => new Map(prev).set(product.product_id, fetched));
          }
        }

        const availableStock = balance?.qty_on_hand || 0;
        const existingItem = cart.find((item) => item.product.product_id === product.product_id);
        const requestedQty = existingItem ? existingItem.qty + quantity : quantity;

        if (availableStock < requestedQty) {
          toast.error(
            `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${requestedQty}`
          );
          return;
        }
      } catch (error) {
        logger.warn('Failed to check stock, allowing add to cart', { error, productId: product.product_id });
      }
    }

    const price = Number(product.sale_price || product.list_price || 0);
    const taxInclusive = !!(storeSettings?.tax_inclusive);
    const defaultTax = Number(storeSettings?.tax_rate ?? 0);
    const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';
    const eff = taxInclusive
      ? effectiveProductTaxRate(product.tax_rate, defaultTax)
      : 0;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.product_id === product.product_id);
      if (existing) {
        const newQty = existing.qty + quantity;
        const amounts = computeLineAmounts(newQty, price, eff, mode);
        return prevCart.map((item) =>
          item.product.product_id === product.product_id
            ? {
                ...item,
                qty: newQty,
                unit_price: amounts.unit_price,
                tax_rate: amounts.tax_rate,
                line_total: amounts.line_total,
              }
            : item
        );
      } else {
        const amounts = computeLineAmounts(quantity, price, eff, mode);
        return [
          ...prevCart,
          {
            product,
            qty: quantity,
            unit_price: amounts.unit_price,
            tax_rate: amounts.tax_rate,
            line_total: amounts.line_total,
          },
        ];
      }
    });

    const displayAmounts = computeLineAmounts(quantity, price, eff, mode);
    showCustomerDisplay(getStoreDisplayName(storeSettings), displayAmounts.unit_price);

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

    // Check stock from in-memory map (same approach as addToCart — no API call on every +/-)
    const item = cart.find(i => i.product.product_id === productId);
    if (!item) return;

    if (item.product.track_inventory && storeSettings && storeSettings.allow_negative === false) {
      try {
        let balance = stockBalances.get(productId);
        if (!balance) {
          const fetched = await stockService.getStockBalance(productId);
          if (fetched) {
            balance = fetched;
            setStockBalances(prev => new Map(prev).set(productId, fetched));
          }
        }

        const availableStock = balance?.qty_on_hand || 0;
        if (availableStock < qty) {
          toast.error(
            `Insufficient stock for ${item.product.name}. Available: ${availableStock}, Requested: ${qty}`
          );
          return;
        }
      } catch (error) {
        logger.warn('Failed to check stock, allowing quantity update', { error, productId });
      }
    }

    const taxInclusive = !!(storeSettings?.tax_inclusive);
    const defaultTax = Number(storeSettings?.tax_rate ?? 0);
    const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';
    const price = Number(item.product.sale_price || item.product.list_price || 0);
    const eff = taxInclusive
      ? effectiveProductTaxRate(item.product.tax_rate, defaultTax)
      : 0;
    const amounts = computeLineAmounts(qty, price, eff, mode);

    setCart((prevCart) =>
      prevCart.map((row) => {
        if (row.product.product_id === productId) {
          return {
            ...row,
            qty,
            unit_price: amounts.unit_price,
            tax_rate: amounts.tax_rate,
            line_total: amounts.line_total,
          };
        }
        return row;
      })
    );

    showCustomerDisplay(getStoreDisplayName(storeSettings), amounts.unit_price);
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.product_id !== productId));
  };

  // Clear cart
  const confirmClearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountRate('');
    setShowClearCartModal(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setShowClearCartModal(true);
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

  // Open payment modal — default USD tender to grand total; cashier can edit
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPaymentAmount(grandTotal > 0 ? grandTotal.toFixed(2) : '');
    setPaymentAmountLBP('');
    setShowPaymentModal(true);
  };

  // USD field changed — independent, do NOT touch LBP field
  const handlePaymentAmountChange = (val: string) => {
    setPaymentAmount(val);
  };

  // LBP field changed — independent, do NOT touch USD field
  const handlePaymentAmountLBPChange = (val: string) => {
    setPaymentAmountLBP(val);
  };

  // Total tendered in USD = USD cash + LBP cash converted to USD
  const usdPaid = parseFloat(paymentAmount || '0') || 0;
  const lbpPaid = parseFloat(paymentAmountLBP || '0') || 0;
  const lbpPaidInUSD = lbpRate > 0 && lbpPaid > 0 ? lbpPaid / lbpRate : 0;
  const totalTenderedUSD = usdPaid + lbpPaidInUSD;

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

    const totalTendered = totalTenderedUSD;
    if (totalTendered <= 0 || totalTendered < grandTotal) {
      const shortfallUSD = (grandTotal - totalTendered).toFixed(2);
      const shortfallLBP = lbpRate > 0 ? ` (${Math.ceil((grandTotal - totalTendered) * lbpRate).toLocaleString()} LBP)` : '';
      toast.error(`Insufficient payment. Short by $${shortfallUSD}${shortfallLBP}`);
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

      // Clear cart and customer, mark session as complete
      setCart([]);
      setSelectedCustomer(null);
      setDiscountRate('');
      completeActiveSale();
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
  const startNewSale = useCallback(() => {
    showCustomerDisplay(getStoreDisplayName(storeSettings), 0);
    setCompletedSale(null);
    setReceiptCartItems([]);
    setReceiptCustomer(null);
    setCart([]);
    setSelectedCustomer(null);
    setDiscountRate(''); // Clear discount
    // Defer focus so React finishes flushing state before we call .focus()
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }, [storeSettings]);

  // Print receipt
  const handlePrint = () => {
    if (completedSale) {
      showCustomerDisplay(
        getStoreDisplayName(storeSettings),
        Number(completedSale.grand_total)
      );
    }
    if (window.electronAPI?.printSilent) {
      window.electronAPI.printSilent(storeSettings?.receipt_printer || undefined).then(res => {
        if (!res.success) {
          toast.error(`Print failed: ${res.error || 'Unknown error'}`);
          // Fallback to normal print if silent fails
          window.print();
        }
      });
    } else {
      window.print();
    }
  };

  // Refresh store settings + LBP rate from DB after a sale completes (receipt flow)
  useEffect(() => {
    if (completedSale?.store_id) {
      storeService
        .getStoreSettings(completedSale.store_id)
        .then((settings) => {
          setStoreSettings((prev) => ({ ...(prev ?? {}), ...settings } as StoreSettings));
          setLbpExchangeRatePerUsd(Math.max(0, Number(settings.lbp_exchange_rate ?? 0) || 0));
        })
        .catch((err) => {
          logger.error('Failed to fetch store settings after sale:', err);
        });
    }
  }, [completedSale?.store_id]);

  // removed default setActiveCategory

  const displayedPosProducts = useMemo(() => {
    if (!activeCategory) return [];
    return posProducts.filter(p => p.product_type === activeCategory);
  }, [posProducts, activeCategory]);

  // Focus barcode once POS settings (and LBP rate) have loaded.
  // Deferred 150 ms so Electron finishes the BrowserWindow show/maximize sequence
  // before we request DOM focus — prevents the OS-level focus desync that causes
  // inputs to appear focused but not accept keyboard input until minimize/restore.
  useEffect(() => {
    if (posSettingsStatus !== 'ready') return;
    const t = setTimeout(() => barcodeInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [posSettingsStatus]);

  // Re-focus barcode when the Electron window regains OS-level focus.
  // Handles: alt-tab back, minimize → restore, Windows task-switcher.
  // Without this the DOM element stays "focused" but the OS routes keystrokes
  // elsewhere and inputs remain frozen until the user clicks inside the window.
  useEffect(() => {
    if (posSettingsStatus !== 'ready') return;
    const refocus = () => {
      if (!completedSale && !showPaymentModal && !showCustomerModal && !quickAddProduct) {
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('focus', refocus);
    return () => window.removeEventListener('focus', refocus);
  }, [posSettingsStatus, completedSale, showPaymentModal, showCustomerModal, quickAddProduct]);

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

  const closeCustomerModal = useCallback(() => {
    setShowCustomerModal(false);
    setCustomerSearch('');
    setCustomerResults([]);
  }, []);

  const closePaymentModal = useCallback(() => {
    setShowPaymentModal(false);
  }, []);

  return (
    <>
      {posSettingsStatus === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-[min(70vh,520px)] gap-4 px-4">
          <div className="w-10 h-10 border-4 border-secondary-200 border-t-secondary-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">{t('pos_sales.loading_store')}</p>
        </div>
      )}
      {posSettingsStatus === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[min(70vh,520px)] gap-4 px-4 text-center max-w-md mx-auto">
          <p className="text-sm text-gray-700">{t('pos_sales.load_failed')}</p>
          <Button type="button" onClick={() => void loadPosInitialData()}>
            {t('pos_sales.retry')}
          </Button>
        </div>
      )}
      {posSettingsStatus === 'ready' && (
      <>
      {isCompact && storeSettings?.show_lbp_price !== false && (
        <div className="max-w-7xl mx-auto mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-amber-900 text-sm">{t('pos_sales.exchange_rate_title')}</span>
          </div>
          {lbpExchangeRatePerUsd > 0 ? (
            <span className="font-bold text-amber-900 text-sm tabular-nums">
              {t('pos_sales.exchange_rate_value', {
                amount: lbpExchangeRatePerUsd.toLocaleString(),
                currency: storeSettings?.currency_code || 'USD',
              })}
            </span>
          ) : (
            <span className="text-sm font-medium text-amber-900/80">{t('pos_sales.exchange_rate_not_set')}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {/* Left Column - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Selection & Quick Add */}
          <Card className="border border-[#e2e8f0] shadow-soft bg-white overflow-visible">
            <div className="p-4 overflow-visible">
              {posCategories.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 bg-secondary-500 rounded-lg">
                       <BookOpenIcon className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-900">{t('pos_sales.quick_add')}</h2>
                  </div>
                  {/* Categories Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {posCategories.map(category => (
                      <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className="h-20 bg-gradient-to-br from-secondary-50 to-white hover:from-secondary-100 hover:to-secondary-50 border border-secondary-100 hover:border-secondary-500 rounded-xl flex flex-col items-center justify-center p-2 transition-all shadow-sm hover:shadow-md group"
                      >
                        <TagIcon className="w-6 h-6 text-secondary-500 mb-1.5 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-secondary-900 text-[11px] text-center line-clamp-2 leading-tight">{category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Integrated Compact Search Section */}
              <div className={posCategories.length > 0 ? "pt-6 border-t border-gray-100" : ""}>
                <div className="flex flex-col gap-5">
                  {/* Barcode Scanner */}
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-1.5">
                      <QrCodeIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('pos_sales.barcode_scan')}</span>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary-500 transition-colors">
                        <QrCodeIcon className="w-4 h-4" />
                      </div>
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder={t('pos_sales.scan_placeholder')}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const barcode = (e.target as HTMLInputElement).value.trim();
                            if (barcode) {
                              handleBarcodeScan(barcode);
                            }
                          }
                        }}
                        className="w-full pl-10 pr-3 py-2.5 text-sm font-bold bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-secondary-500 focus:ring-4 focus:ring-secondary-500/10 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Search by Name/SKU */}
                  <div className="w-full relative" ref={searchContainerRef}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('pos_sales.search_by')}</span>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary-500 transition-colors">
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      </div>
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (searchResults.length > 0) {
                              addToCart(searchResults[0]);
                              setSearchResults([]);
                              setSearchQuery('');
                              debouncedSearch.cancel();
                            }
                          }
                        }}
                        placeholder={t('pos_sales.search_placeholder')}
                        className="w-full pl-10 pr-3 py-2.5 text-sm font-bold bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-secondary-500 focus:ring-4 focus:ring-secondary-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Search Results Portal */}
                    {searchResults.length > 0 && createPortal(
                      <div 
                        ref={searchResultsDropdownRef}
                        className="fixed border border-gray-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-gray-50 bg-white shadow-2xl z-[9999]"
                        style={{
                          top: `${dropdownPosition.top - window.scrollY}px`,
                          left: `${dropdownPosition.left - window.scrollX}px`,
                          width: `${dropdownPosition.width}px`,
                        }}
                      >
                        {searchResults.map((product) => (
                          <button
                            key={product.product_id}
                            onClick={() => {
                              addToCart(product);
                              setSearchResults([]);
                              setSearchQuery('');
                              debouncedSearch.cancel();
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-secondary-50 transition-all duration-150 group"
                          >
                            <div className="flex justify-between items-center gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-secondary-50 group-hover:bg-secondary-100 rounded-lg flex-shrink-0 transition-colors">
                                  <BookOpenIcon className="w-4 h-4 text-secondary-400 group-hover:text-secondary-500 transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-gray-900 group-hover:text-secondary-600 transition-colors truncate">{product.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {product.sku && (
                                      <span className="text-[11px] text-gray-400 font-mono">SKU {product.sku}</span>
                                    )}
                                    {product.barcode && (
                                      <Badge variant="gray" size="sm" className="font-mono text-[10px]">
                                        {product.barcode}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm text-secondary-500">
                                  ${Number(product.sale_price || product.list_price || 0).toFixed(2)}
                                </p>
                              </div>
                              <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-secondary-400 flex-shrink-0 transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}

                    {searching && createPortal(
                      <div 
                        className="fixed border border-gray-200 rounded-xl py-4 bg-white shadow-2xl z-[9999] text-center"
                        style={{
                          top: `${dropdownPosition.top - window.scrollY}px`,
                          left: `${dropdownPosition.left - window.scrollX}px`,
                          width: `${dropdownPosition.width}px`,
                        }}
                      >
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-secondary-200 border-t-secondary-500"></div>
                        <p className="mt-2 text-sm text-gray-500 font-medium">{t('pos_sales.searching')}</p>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>



          {/* Shopping Cart */}
          <Card padding="none" className="border border-[#e2e8f0] shadow-soft bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-secondary-500 rounded-lg">
                    <ShoppingCartIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{t('pos_sales.cart')}</h2>
                    {cart.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {cart.length} {cart.length === 1 ? t('pos_sales.item_v') : t('pos_sales.items_v')} · {cart.reduce((sum, item) => sum + item.qty, 0).toFixed(3).replace(/\.?0+$/, '')} {cart.reduce((sum, item) => sum + item.qty, 0) === 1 ? t('pos_sales.unit') : t('pos_sales.units')}
                      </p>
                    )}
                  </div>
                </div>
                {/* Clear Cart + Hold Sale + Held Sales panel buttons */}
                <div className="flex items-center gap-2">
                  <button
                    id="clear-cart-btn"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    title={t('pos_sales.clear_cart') || 'Clear cart'}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    Clear
                  </button>
                  <button
                    id="hold-sale-btn"
                    ref={holdBtnRef}
                    onClick={handleHoldSale}
                    disabled={cart.length === 0}
                    title="Hold current sale"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <PauseCircleIcon className="w-3.5 h-3.5" />
                    Hold
                  </button>
                  <button
                    id="held-sales-btn"
                    onClick={() => setShowHeldPanel(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      heldSales.length > 0
                        ? 'border-secondary-200 bg-secondary-50 text-secondary-700 hover:bg-secondary-100'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ShoppingCartIcon className="w-3.5 h-3.5" />
                    Held
                    {heldSales.length > 0 && (
                      <span className="ml-0.5 min-w-[16px] h-4 bg-secondary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {heldSales.length}
                      </span>
                    )}
                  </button>
                  <HeldSalesPanel
                    isOpen={showHeldPanel}
                    onClose={() => setShowHeldPanel(false)}
                    heldSales={heldSales}
                    onResume={handleResumeSale}
                    onDelete={deleteHeldSale}
                    currency={storeSettings?.currency_code || 'USD'}
                    anchorRef={holdBtnRef}
                  />
                </div>
              </div>
            </div>

            <div ref={cartListContainerRef} className="bg-white w-full flex-1 min-h-0">
              {cart.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<BookOpenIcon className="w-12 h-12" />}
                    title={t('pos_sales.no_items')}
                    description={t('pos_sales.scan_to_add')}
                  />
                </div>
              ) : (
                <FixedSizeList
                  height={cart.length * CART_ROW_HEIGHT}
                  width="100%"
                  itemCount={cart.length}
                  itemSize={CART_ROW_HEIGHT}
                  className="w-full"
                >
                  {({ index, style }: ListChildComponentProps) => {
                    const item = cart[index];
                    const stockBalance = stockBalances.get(item.product.product_id);
                    const availableStock = stockBalance?.qty_on_hand ?? null;
                    const isLowStock = item.product.track_inventory && availableStock !== null && availableStock < item.qty;
                    const isOutOfStock = item.product.track_inventory && availableStock !== null && availableStock === 0;

                    return (
                      <div style={style}>
                        <div className={`h-full border-b border-gray-100 px-3 py-2 transition-all group ${isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''}`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 h-full">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1.5 mb-0.5">
                                <div className="p-1 bg-secondary-50 rounded-lg flex-shrink-0">
                                  <BookOpenIcon className="w-3.5 h-3.5 text-secondary-400" />
                                </div>
                                <p className="font-semibold text-xs text-gray-900 truncate">{item.product.name}</p>
                              </div>
                              {!isCompact ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-medium text-gray-600">
                                    ${Number(item.unit_price).toFixed(2)}{' '}
                                    <span className="font-semibold text-secondary-500">
                                      {item.product.unit_of_measure || t('pos_sales.each')}
                                    </span>
                                  </span>
                                  {item.product.track_inventory && availableStock !== null && (
                                    <span className={`text-xs font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-500'}`}>
                                      {t('pos_sales.stock')}: {availableStock}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                item.product.track_inventory && availableStock !== null && (
                                  <span className={`text-[10px] font-medium ml-6 ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-500'}`}>
                                    {t('pos_sales.stock')}: {availableStock}
                                  </span>
                                )
                              )}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                              {/* Quantity Controls */}
                              <div className="flex items-center gap-0 border-2 border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
                                <Button
                                  onClick={() => updateCartItemQuantity(item.product.product_id, item.qty - 1)}
                                  variant="ghost"
                                  size="sm"
                                  className="!p-1.5 hover:bg-gray-100 rounded-none border-r border-gray-200"
                                >
                                  <MinusIcon className="w-3 h-3 text-gray-500" />
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.qty}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0) {
                                      updateCartItemQuantity(item.product.product_id, val);
                                    }
                                  }}
                                  className="w-12 text-center font-bold text-xs text-gray-900 py-1 focus:outline-none focus:bg-gray-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  onClick={() => updateCartItemQuantity(item.product.product_id, item.qty + 1)}
                                  variant="ghost"
                                  size="sm"
                                  className="!p-1.5 hover:bg-gray-100 rounded-none border-l border-gray-200"
                                >
                                  <PlusIcon className="w-3 h-3 text-gray-500" />
                                </Button>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Price Display */}
                                <div className="text-right min-w-[70px] sm:min-w-[90px]">
                                  {isCompact && (
                                    <p className="text-[10px] font-medium text-gray-400 leading-none mb-0.5">
                                      {item.qty} x ${Number(item.unit_price).toFixed(2)}
                                    </p>
                                  )}
                                  <p className="font-bold text-sm text-secondary-600 leading-tight">
                                    ${Number(item.line_total).toFixed(2)}
                                  </p>
                                  {formatLBP(Number(item.line_total)) && (
                                    <p className="text-[9px] text-amber-600 font-bold mt-0.5 leading-none">
                                      ≈ {formatLBP(Number(item.line_total))}
                                    </p>
                                  )}
                                </div>

                                <Button
                                  onClick={() => removeFromCart(item.product.product_id)}
                                  variant="ghost"
                                  size="sm"
                                  className="!p-1.5 hover:bg-gray-100 opacity-100 transition-colors flex-shrink-0 rounded-md"
                                >
                                  <TrashIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  );
                }}
                </FixedSizeList>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Customer & Totals */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* Customer Selection */}
          {storeSettings?.ui_resolution !== '1024x768' && (
          <Card className="border border-[#e2e8f0] shadow-soft bg-white">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('pos_sales.customer')}</h2>
              </div>
              {selectedCustomer ? (
                <div className="p-3 bg-secondary-50 rounded-xl border border-secondary-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">
                        {(selectedCustomer.full_name || t('pos_sales.customer_placeholder')).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-gray-900 truncate">
                        {selectedCustomer.full_name || t('pos_sales.customer_placeholder')}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer.phone}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => setSelectedCustomer(null)}
                      variant="ghost"
                      size="sm"
                      className="!p-1 hover:bg-white flex-shrink-0"
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
                  className="w-full border-2 hover:bg-secondary-50 hover:border-secondary-300 transition-all"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  {t('pos_sales.add_customer')}
                </Button>
              )}
            </div>
          </Card>
          )}

          {/* LBP exchange rate (same value as all ≈ LBP math on this page) */}
          {storeSettings?.show_lbp_price !== false && !isCompact && (
            <Card className="border border-amber-100 bg-amber-50/80 shadow-sm overflow-hidden">
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-amber-500/90 rounded-lg">
                    <GlobeAltIcon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-amber-950">{t('pos_sales.exchange_rate_title')}</h2>
                </div>
                {lbpExchangeRatePerUsd > 0 ? (
                  <p className="text-sm font-semibold tabular-nums text-amber-950 pl-0.5">
                    {t('pos_sales.exchange_rate_value', {
                      amount: lbpExchangeRatePerUsd.toLocaleString(),
                      currency: storeSettings?.currency_code || 'USD',
                    })}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-amber-900/80">{t('pos_sales.exchange_rate_not_set')}</p>
                )}
                <p className="text-[10px] text-amber-900/70 mt-1.5 leading-snug">{t('pos_sales.exchange_rate_hint')}</p>
              </div>
            </Card>
          )}

          {/* Totals */}
          <Card className="border border-[#e2e8f0] bg-white shadow-medium overflow-hidden">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold text-gray-900 flex-1">{t('pos_sales.totals')}</h2>
                {storeSettings?.ui_resolution === '1024x768' && (
                  <Button
                    onClick={() => setShowCustomerModal(true)}
                    variant="ghost"
                    size="sm"
                    className="!p-1 text-secondary-600 hover:bg-secondary-50"
                    leftIcon={<UserIcon className="w-3.5 h-3.5" />}
                  >
                    {selectedCustomer ? (
                      <span className="truncate max-w-[80px] font-bold">{selectedCustomer.full_name}</span>
                    ) : (
                      <span className="font-bold">+ {t('pos_sales.customer')}</span>
                    )}
                  </Button>
                )}
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">
                    {storeSettings?.tax_inclusive ? t('pos_sales.subtotal_tax_inc') : t('pos_sales.subtotal')}
                  </span>
                  <span className="font-bold text-xs text-gray-900">${merchandiseGross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">
                    {storeSettings?.tax_inclusive ? t('pos_sales.tax_inc_prices') : t('pos_sales.tax_exc')}
                  </span>
                  <span className="font-bold text-xs text-gray-900">
                    ${(storeSettings?.tax_inclusive ? taxExtracted : 0).toFixed(2)}
                  </span>
                </div>
                {storeSettings?.tax_inclusive && taxExtracted > 0 && (
                  <p className="text-[10px] text-gray-500 px-2">
                    {t('pos_sales.net_merch', { net: subtotalNet.toFixed(2), tax: taxExtracted.toFixed(2), gross: merchandiseGross.toFixed(2) }).replace('{{net}}', subtotalNet.toFixed(2)).replace('{{tax}}', taxExtracted.toFixed(2)).replace('{{gross}}', merchandiseGross.toFixed(2))}
                  </p>
                )}

                {/* Discount Percentage Input */}
                {user?.role !== 'self_checkout' && (
                  <div className="p-2 bg-white/60 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-medium text-xs text-gray-700">{t('pos_sales.discount_pct')}</label>
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
                      <span className={`font-medium text-xs ${discountAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>{t('pos_sales.discount_amount')}</span>
                      <span className={`font-bold text-xs ${discountAmount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {discountAmount > 0 ? '-' : ''}${discountAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-[#e2e8f0] pt-2 mt-2">
                  <div className="flex justify-between items-center p-3.5 rounded-xl text-white" style={{ background: gradients.brandBlue, boxShadow: `0 4px 14px color-mix(in srgb, var(--color-secondary) 30%, transparent)` }}>
                    <span className="text-sm font-semibold opacity-90">{t('pos_sales.total_due')}</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold tabular-nums">${grandTotal.toFixed(2)}</span>
                      {formatLBP(grandTotal) && (
                        <p className="text-xs font-semibold text-white/80 mt-0.5 tabular-nums">
                          ≈ {formatLBP(grandTotal)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={openPaymentModal}
                disabled={cart.length === 0 || processing}
                className="w-full text-white font-semibold shadow-brand hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm rounded-xl mt-1"
              style={{ background: gradients.brandBlue }}
                leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                isLoading={processing}
              >
                {t('pos_sales.process_payment')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Category Items Modal */}
      <Modal
        isOpen={!!activeCategory}
        onClose={() => setActiveCategory(null)}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <TagIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">{activeCategory}</span>
          </div>
        }
        size="lg"
        footer={
          <div className="flex justify-end w-full">
            <Button
              onClick={() => setActiveCategory(null)}
              variant="primary"
              size="md"
              className="px-8 shadow-brand hover:shadow-lg transition-all"
              leftIcon={<CheckIcon className="w-4 h-4" />}
            >
              {t('pos_sales.close') || 'Close'}
            </Button>
          </div>
        }
      >
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 cursor-pointer p-1">
            {displayedPosProducts.map(product => (
              <button
                key={product.product_id}
                onClick={() => {
                  handlePosItemClick(product);
                  // Optionally close modal if it's not a weight-required item
                  if (product.unit_of_measure !== 'kg' && product.unit_of_measure !== 'g') {
                    // We don't close it so user can add multiple items from same category
                  }
                }}
                className="flex flex-col h-full min-h-[140px] bg-white border border-gray-100 hover:border-secondary-500 hover:shadow-lg rounded-2xl p-3 items-center text-center transition-all group"
              >
                <div className="w-20 h-20 mb-3 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-secondary-50 transition-colors overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300">
                  {product.image_url ? (
                    <img 
                      src={`${API_BASE_URL}${product.image_url}`} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.fallback-initials')) {
                          const span = document.createElement('span');
                          span.className = 'text-xl font-bold text-secondary-500 fallback-initials';
                          span.innerText = product.name.charAt(0).toUpperCase();
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xl font-bold text-secondary-500">
                      {product.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight flex-1 mb-1.5 px-1">
                  {product.name}
                </span>
                <div className="mt-auto pt-2 border-t border-gray-50 w-full">
                  <span className="text-sm font-black text-secondary-600 block">
                    ${Number(product.sale_price || product.list_price || 0).toFixed(2)}
                  </span>
                  {formatLBP(Number(product.sale_price || product.list_price || 0)) && (
                    <span className="text-[10px] font-bold text-amber-600 leading-none">
                      ≈ {formatLBP(Number(product.sale_price || product.list_price || 0))}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {displayedPosProducts.length === 0 && (
            <div className="py-12 text-center">
              <EmptyState
                icon={<BookOpenIcon className="w-12 h-12" />}
                title={t('pos_sales.no_items_category')}
                description={t('pos_sales.try_another_category')}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Quick Add Weigh / Quantity Modal */}
      <Modal
        isOpen={!!quickAddProduct}
        onClose={closeQuickAddModal}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <ScaleIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">{t('pos_sales.add_item')}</span>
          </div>
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              onClick={closeQuickAddModal}
              variant="outline"
              size="sm"
              className="flex-1 py-2"
            >
              {t('pos_sales.cancel')}
            </Button>
            <Button
              onClick={handleQuickConfirm}
              variant="primary"
              size="sm"
              className="flex-1 py-2 shadow-brand"
              leftIcon={<PlusIcon className="w-4 h-4" />}
            >
              {t('pos_sales.add_to_cart')}
            </Button>
          </div>
        }
      >
        {quickAddProduct && (
          <div className="space-y-2.5">
            <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between px-3">
              <h3 className="text-sm font-bold text-gray-900 truncate flex-1 mr-2">{quickAddProduct.name}</h3>
              <p className="text-secondary-600 font-bold whitespace-nowrap text-sm">
                ${Number(quickAddProduct.sale_price || quickAddProduct.list_price || 0).toFixed(2)} / {quickAddProduct.unit_of_measure?.toLowerCase() || 'unit'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => setQuickAddFocus('qty')}>
                <Input
                  label={`${t('pos_sales.quantity')} (${quickAddProduct.unit_of_measure?.toLowerCase() || t('pos_sales.units')})`}
                  type="text"
                  inputMode="decimal"
                  value={quickAddQty}
                  onChange={(e) => handleQuickQtyChange(e.target.value)}
                  onFocus={() => setQuickAddFocus('qty')}
                  className={`text-base font-bold text-center h-10 transition-all ${quickAddFocus === 'qty' ? 'ring-2 ring-secondary-500 border-secondary-500 bg-secondary-50 outline-none' : ''}`}
                  autoFocus
                />
              </div>
              <div onClick={() => setQuickAddFocus('total')}>
                <Input
                  label={t('pos_sales.total_price')}
                  type="text"
                  inputMode="decimal"
                  value={quickAddTotal}
                  onChange={(e) => handleQuickTotalChange(e.target.value)}
                  onFocus={() => setQuickAddFocus('total')}
                  className={`text-base font-bold text-center h-10 transition-all ${quickAddFocus === 'total' ? 'ring-2 ring-secondary-500 border-secondary-500 bg-secondary-50 outline-none' : ''}`}
                />
              </div>
            </div>

            {/* Touch Screen Numpad */}
            <div className="pt-2 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleNumpadInput(btn)}
                    className="h-10 bg-white border-2 border-gray-100 rounded-lg text-lg font-black text-gray-800 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-600 transition-all shadow-sm active:scale-[0.95]"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={handleNumpadBackspace}
                  className="h-10 bg-red-50 border-2 border-red-100 rounded-lg text-lg font-bold text-red-600 hover:border-red-500 hover:bg-red-100 hover:text-red-700 transition-all shadow-sm flex items-center justify-center active:scale-[0.95]"
                >
                  <BackspaceIcon className="w-5 h-5 opacity-90" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Enhanced Customer Selection Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={closeCustomerModal}
        title={t('pos_sales.select_customer')}
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
              placeholder={t('pos_sales.search_customers')}
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
                          {customer.full_name || t('pos_sales.customer_placeholder')}
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
                title={t('pos_sales.no_customers_found')}
                description={t('pos_sales.try_different_search')}
              />
            ) : (
              <EmptyState
                title={t('pos_sales.search_for_customers')}
                description={t('pos_sales.start_typing')}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Enhanced Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={closePaymentModal}
        title={t('pos_sales.process_payment_title')}
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
              variant="primary"
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
              {t('pos_sales.payment_method')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card', 'voucher', 'other'] as PaymentMethod[])
                .filter(method => user?.role !== 'self_checkout' || method === 'card')
                .map((method) => {
                const active = paymentMethod === method;
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-xl border-2 transition-all duration-150 ${active
                      ? 'border-secondary-500 bg-secondary-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex flex-col items-center space-y-1.5">
                      <div className={`p-1.5 rounded-lg ${active ? 'bg-secondary-500' : 'bg-gray-100'}`}>
                        {method === 'cash' && <BanknotesIcon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />}
                        {method === 'card' && <CreditCardIcon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />}
                        {method === 'voucher' && <TicketIcon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />}
                        {method === 'other' && <CurrencyDollarIcon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />}
                      </div>
                      <span className={`font-semibold text-xs capitalize ${active ? 'text-secondary-600' : 'text-gray-600'}`}>
                        {t(`pos_sales.${method}`)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* ── Cash Received ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cash Received</p>

            {/* Two-column layout for currency fields */}
            <div className={`grid ${lbpRate > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>

              {/* USD field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  <CurrencyDollarIcon className="w-3.5 h-3.5 text-gray-400" />
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePaymentAmountChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
                />
              </div>

              {/* LBP field */}
              {lbpRate > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                    <span className="text-xs">🇱🇧</span>
                    Amount (LBP)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={paymentAmountLBP}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePaymentAmountLBPChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
                  />
                  {lbpPaid > 0 && (
                    <p className="mt-1 text-[10px] text-gray-500 font-medium">≈ ${lbpPaidInUSD.toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Live total received row — shown when at least one field is filled and rate exists */}
            {(usdPaid > 0 || (lbpRate > 0 && lbpPaid > 0)) && (
              <div className="flex justify-between items-center px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-xs font-semibold text-gray-600">Total Received</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">${totalTenderedUSD.toFixed(2)}</span>
                  {lbpRate > 0 && (usdPaid > 0 && lbpPaid > 0) && (
                    <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                      ${usdPaid.toFixed(2)} + {lbpPaid.toLocaleString()} LBP
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hint line — due amounts for reference */}
            <p className="text-xs text-gray-400">
              Total due:&nbsp;<span className="font-semibold text-gray-600">${grandTotal.toFixed(2)}</span>
              {lbpRate > 0 && (
                <span className="ml-2">≈ <span className="font-semibold text-gray-600">{Math.ceil(grandTotal * lbpRate).toLocaleString()} LBP</span></span>
              )}
            </p>
          </div>

          {/* ── Grand Total + Change Due ── */}
          <div className="p-4 rounded-xl text-white" style={{ background: gradients.brandBlue }}>
            {/* Grand Total row */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm opacity-80">{t('pos_sales.grand_total')}</span>
              <div className="text-right">
                <span className="text-2xl font-bold tabular-nums">${grandTotal.toFixed(2)}</span>
                {formatLBP(grandTotal) && (
                  <p className="text-xs font-semibold text-white/80 mt-0.5 tabular-nums">
                    ≈ {formatLBP(grandTotal)}
                  </p>
                )}
              </div>
            </div>

            {/* Change Due — uses combined totalTenderedUSD */}
            {totalTenderedUSD > grandTotal && (() => {
              const changeDueUSD = totalTenderedUSD - grandTotal;
              const changeDueLBP = lbpRate > 0 ? Math.round(changeDueUSD * lbpRate) : null;
              return (
                <div className="mt-2.5 pt-2.5 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium opacity-70">{t('pos_sales.change_due')}</span>
                    <div className="text-right">
                      <span className="text-base font-bold tabular-nums opacity-90">
                        ${changeDueUSD.toFixed(2)}
                      </span>
                      {changeDueLBP !== null && (
                        <p className="text-xs font-semibold text-white/70 mt-0.5 tabular-nums">
                          ≈ {changeDueLBP.toLocaleString()} LBP
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Shortfall indicator — shows how much more is needed */}
            {totalTenderedUSD > 0 && totalTenderedUSD < grandTotal && (() => {
              const shortfallUSD = grandTotal - totalTenderedUSD;
              return (
                <div className="mt-2.5 pt-2.5 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium opacity-70 text-red-200">Still needed</span>
                    <div className="text-right">
                      <span className="text-sm font-bold tabular-nums text-red-200">
                        ${shortfallUSD.toFixed(2)}
                      </span>
                      {lbpRate > 0 && (
                        <p className="text-xs font-semibold text-red-200/80 mt-0.5 tabular-nums">
                          ≈ {Math.ceil(shortfallUSD * lbpRate).toLocaleString()} LBP
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Progress indicator */}
          {processing && (
            <div className="mt-4 p-4 bg-secondary-50 rounded-xl border border-secondary-200">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-semibold text-secondary-800">{processingStage || t('pos_sales.processing')}</span>
                <span className="text-sm font-bold text-secondary-600 tabular-nums">{processingProgress}%</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2">
                <div
                  className="bg-secondary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className="text-xs text-secondary-600 mt-2">{t('pos_sales.please_wait')}</p>
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
                {t('pos_sales.print_receipt')}
              </Button>
              <Button
                onClick={startNewSale}
                variant="outline"
                className="flex-1 border-2"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                {t('pos_sales.new_sale')}
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
      {/* Clear Cart Modal */}
      <Modal
        isOpen={showClearCartModal}
        onClose={() => setShowClearCartModal(false)}
        title={t('pos_sales.clear_cart') || 'Clear Cart'}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => setShowClearCartModal(false)}
              variant="outline"
              className="flex-1"
            >
              {t('pos_sales.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={confirmClearCart}
              variant="danger"
              className="flex-1 shadow-sm"
            >
              {t('pos_sales.clear') || 'Clear'}
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <p className="text-gray-700 text-base">
            {t('pos_sales.confirm_clear_cart') || 'Are you sure you want to clear the active cart?'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This action will remove all items from the current active cart.
          </p>
        </div>
      </Modal>

      </>
      )}
    </>
  );
}

