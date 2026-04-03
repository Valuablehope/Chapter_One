import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useDebouncedCallback } from 'use-debounce';
import { productService, Product } from '../services/productService';
import { productTypeService } from '../services/productTypeService';
import { customerService, Customer } from '../services/customerService';
import { saleService, CartItem, PaymentMethod, OfflineError } from '../services/saleService';
import { storeService, StoreSettings } from '../services/storeService';
import { stockService, StockBalance } from '../services/stockService';
import { logger } from '../utils/logger';
import { gradients } from '../styles/tokens';
import { useTranslation } from '../i18n/I18nContext';
import { useSaleSessions } from '../hooks/useSaleSessions';
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
  ArrowLeftIcon,
  ScaleIcon,
  BackspaceIcon,
  PauseCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import Receipt from '../components/Receipt';
import {
  computeLineAmounts,
  discountAndGrand,
  effectiveProductTaxRate,
  roundMoney,
  type SaleTaxMode,
} from '../utils/saleTotals';

export default function Sales() {
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
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
  const [stockBalances, setStockBalances] = useState<Map<string, StockBalance>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cartListContainerRef = useRef<HTMLDivElement>(null);
  const [cartListWidth, setCartListWidth] = useState(400);

  // Quick Add / Weigh Item Modal State
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddQty, setQuickAddQty] = useState<string>('1');
  const [quickAddTotal, setQuickAddTotal] = useState<string>('');
  const [quickAddFocus, setQuickAddFocus] = useState<'qty' | 'total'>('qty');

  const [posProducts, setPosProducts] = useState<Product[]>([]);
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

  // LBP conversion helper — returns formatted string or null when rate not set
  const lbpRate = Number(storeSettings?.lbp_exchange_rate ?? 0);
  const formatLBP = (amount: number): string | null => {
    if (!lbpRate || lbpRate <= 0) return null;
    return Math.round(amount * lbpRate).toLocaleString() + ' LBP';
  };


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
        const requestedQty = existingItem ? existingItem.qty + quantity : quantity;

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
      updateCartItemQuantity(existingItem.product.product_id, existingItem.qty + quantity);
    } else {
      const price = Number(product.sale_price || product.list_price || 0);
      const taxInclusive = !!(storeSettings?.tax_inclusive);
      const defaultTax = Number(storeSettings?.tax_rate ?? 0);
      const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';
      const eff = taxInclusive
        ? effectiveProductTaxRate(product.tax_rate, defaultTax)
        : 0;
      const amounts = computeLineAmounts(quantity, price, eff, mode);

      setCart([
        ...cart,
        {
          product,
          qty: quantity,
          unit_price: amounts.unit_price,
          tax_rate: amounts.tax_rate,
          line_total: amounts.line_total,
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

    const taxInclusive = !!(storeSettings?.tax_inclusive);
    const defaultTax = Number(storeSettings?.tax_rate ?? 0);
    const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';

    setCart(
      cart.map((item) => {
        if (item.product.product_id === productId) {
          const price = Number(item.product.sale_price || item.product.list_price || 0);
          const eff = taxInclusive
            ? effectiveProductTaxRate(item.product.tax_rate, defaultTax)
            : 0;
          const amounts = computeLineAmounts(qty, price, eff, mode);
          return {
            ...item,
            qty,
            unit_price: amounts.unit_price,
            tax_rate: amounts.tax_rate,
            line_total: amounts.line_total,
          };
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

  // Open payment modal — reset both tender fields; cashier enters what the customer hands over
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPaymentAmount('');
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
  }, []);

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
            name: settings.name ?? '',
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
            name: '',
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

  // Fetch products and categories designated for POS quick add
  const [posCategories, setPosCategories] = useState<string[]>([]);
  useEffect(() => {
    const fetchPosData = async () => {
      try {
        const [productsRes, typesRes] = await Promise.all([
          productService.getProducts({ pos_category_only: true, limit: 1000 }),
          productTypeService.getProductTypes()
        ]);
        setPosProducts(productsRes.data);
        const visibleTypes = typesRes.data.filter((t: any) => t.display_on_pos).map((t: any) => t.name).sort();
        setPosCategories(visibleTypes);
      } catch (err) {
        logger.error('Failed to fetch POS data', err);
      }
    };
    fetchPosData();
  }, []);

  // removed default setActiveCategory

  const displayedPosProducts = useMemo(() => {
    if (!activeCategory) return [];
    return posProducts.filter(p => p.product_type === activeCategory);
  }, [posProducts, activeCategory]);

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {/* Left Column - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Add POS Categories/Grid */}
          {posCategories.length > 0 && (
            <Card className="border border-[#e2e8f0] shadow-soft bg-white">
              <div className="p-4">
                {!activeCategory ? (
                  <>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="p-1.5 bg-secondary-500 rounded-lg">
                         <BookOpenIcon className="w-4 h-4 text-white" />
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900">{t('pos_sales.quick_add')}</h2>
                    </div>
                    {/* Categories Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 border-b border-gray-100 pb-4 gap-2">
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <button 
                        onClick={() => setActiveCategory(null)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                      >
                        <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
                      </button>
                      <h2 className="text-sm font-semibold text-gray-900 flex-1">{activeCategory} {t('pos_sales.items')}</h2>
                    </div>
                    {/* Products Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-2 cursor-pointer">
                      {displayedPosProducts.map(product => (
                        <button
                          key={product.product_id}
                          onClick={() => handlePosItemClick(product)}
                          className="flex flex-col h-full min-h-[90px] bg-white border border-gray-100 hover:border-secondary-500 hover:shadow-md rounded-xl p-2 items-center text-center transition-all group"
                        >
                          <div className="w-8 h-8 mb-1.5 rounded-full bg-secondary-50 flex items-center justify-center group-hover:bg-secondary-100 transition-colors">
                            <span className="text-xs font-bold text-secondary-500">
                              {product.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-900 line-clamp-2 leading-tight flex-1 mb-0.5">
                            {product.name}
                          </span>
                          <span className="text-xs font-bold text-secondary-500 mt-auto">
                            ${Number(product.sale_price || product.list_price || 0).toFixed(2)}
                          </span>
                          {formatLBP(Number(product.sale_price || product.list_price || 0)) && (
                            <span className="text-[9px] font-semibold text-amber-600 mt-0.5 leading-none">
                              ≈ {formatLBP(Number(product.sale_price || product.list_price || 0))}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Product Search */}
          <Card className="border border-[#e2e8f0] shadow-soft bg-white">
            <div className="p-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <MagnifyingGlassIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">{t('pos_sales.find_products')}</h2>
              </div>

              {/* Barcode Scanner */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <QrCodeIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('pos_sales.barcode_scan')}</span>
                </div>
                <div className="relative">
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
                    className="input-premium w-full px-3 py-2.5 text-sm font-medium"
                  />
                </div>
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">{t('pos_sales.or')}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Product Search */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('pos_sales.search_by')}</span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                    placeholder={t('pos_sales.search_placeholder')}
                    className="input-premium w-full pl-10 pr-3 py-2.5 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-gray-50 bg-white shadow-sm">
                  {searchResults.map((product) => (
                    <button
                      key={product.product_id}
                      onClick={() => addToCart(product)}
                      className="w-full px-3 py-2.5 text-left hover:bg-secondary-50 transition-all duration-150 group"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="p-1.5 bg-secondary-50 group-hover:bg-secondary-100 rounded-lg flex-shrink-0 transition-colors">
                            <BookOpenIcon className="w-3.5 h-3.5 text-secondary-400 group-hover:text-secondary-500 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-gray-900 group-hover:text-secondary-600 transition-colors truncate">{product.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {product.sku && (
                                <span className="text-[10px] text-gray-400 font-mono">SKU {product.sku}</span>
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
                          {product.track_inventory && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{t('pos_sales.in_stock')}</p>
                          )}
                        </div>
                        <ArrowRightIcon className="w-3 h-3 text-gray-300 group-hover:text-secondary-400 flex-shrink-0 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="mt-3 text-center py-3">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-secondary-200 border-t-secondary-500"></div>
                  <p className="mt-1.5 text-xs text-gray-500 font-medium">{t('pos_sales.searching')}</p>
                </div>
              )}
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
                {/* Hold Sale + Held Sales panel buttons */}
                <div className="flex items-center gap-2 relative">
                  <button
                    id="hold-sale-btn"
                    ref={holdBtnRef}
                    onClick={handleHoldSale}
                    disabled={cart.length === 0}
                    title="Hold current sale"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <PauseCircleIcon className="w-3.5 h-3.5" />
                    Hold
                  </button>
                  <button
                    id="held-sales-btn"
                    onClick={() => setShowHeldPanel(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      heldSales.length > 0
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ShoppingCartIcon className="w-3.5 h-3.5" />
                    Held
                    {heldSales.length > 0 && (
                      <span className="ml-0.5 min-w-[16px] h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
                  />
                </div>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<BookOpenIcon className="w-12 h-12" />}
                  title={t('pos_sales.no_items')}
                  description={t('pos_sales.scan_to_add')}
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
                            <div className="p-1 bg-secondary-50 rounded-lg">
                              <BookOpenIcon className="w-3.5 h-3.5 text-secondary-400" />
                            </div>
                            <p className="font-semibold text-xs text-gray-900">{item.product.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-gray-600">
                              ${Number(item.unit_price).toFixed(2)}{' '}
                              <span className="font-semibold text-blue-500">
                                {item.product.unit_of_measure || t('pos_sales.each')}
                              </span>
                            </span>
                            {item.product.track_inventory && availableStock !== null && (
                              <span className={`text-xs font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-500'}`}>
                                {t('pos_sales.stock')}: {availableStock}
                              </span>
                            )}
                            {Number(item.tax_rate) > 0 && (
                              <Badge variant="info" size="sm">
                                {t('pos_sales.tax')}: {Number(item.tax_rate)}%
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
                              min="0"
                              step="any"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  updateCartItemQuantity(item.product.product_id, val);
                                } else if (e.target.value === '') {
                                  // Optional: allow empty temporary state if needed, 
                                  // but usually safer to just ignore or set to 1 on blur.
                                  // For now, let's just not update if invalid
                                }
                              }}
                              className="w-14 text-center font-bold text-xs text-gray-900 py-1.5 focus:outline-none focus:bg-gray-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            {formatLBP(Number(item.line_total)) && (
                              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                ≈ {formatLBP(Number(item.line_total))}
                              </p>
                            )}
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
        <div className="space-y-4">
          {/* Customer Selection */}
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
                  className="w-full border-2 hover:bg-sky-50 hover:border-sky-300 transition-all"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  {t('pos_sales.add_customer')}
                </Button>
              )}
            </div>
          </Card>

          {/* Totals */}
          <Card className="border border-[#e2e8f0] bg-white shadow-medium overflow-hidden">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <CurrencyDollarIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{t('pos_sales.totals')}</h2>
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

                <div className="border-t border-[#e2e8f0] pt-2 mt-2">
                  <div className="flex justify-between items-center p-3.5 rounded-xl text-white" style={{ background: gradients.brandBlue, boxShadow: '0 4px 14px rgba(53,130,226,0.30)' }}>
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
              style={{ background: 'linear-gradient(135deg, #3582e2 0%, #1f4e88 100%)' }}
                leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                isLoading={processing}
              >
                {t('pos_sales.process_payment')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

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
          <div className="flex justify-end gap-3 w-full">
            <Button
              onClick={closeQuickAddModal}
              variant="outline"
              className="flex-1"
            >
              {t('pos_sales.cancel')}
            </Button>
            <Button
              onClick={handleQuickConfirm}
              variant="primary"
              className="flex-1"
              leftIcon={<PlusIcon className="w-5 h-5" />}
            >
              {t('pos_sales.add_to_cart')}
            </Button>
          </div>
        }
      >
        {quickAddProduct && (
          <div className="space-y-5">
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{quickAddProduct.name}</h3>
              <p className="text-secondary-600 font-semibold mb-3">
                ${Number(quickAddProduct.sale_price || quickAddProduct.list_price || 0).toFixed(2)} / {quickAddProduct.unit_of_measure?.toLowerCase() || 'unit'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => setQuickAddFocus('qty')}>
                <Input
                  label={`${t('pos_sales.quantity')} (${quickAddProduct.unit_of_measure?.toLowerCase() || t('pos_sales.units')})`}
                  type="text"
                  inputMode="decimal"
                  value={quickAddQty}
                  onChange={(e) => handleQuickQtyChange(e.target.value)}
                  onFocus={() => setQuickAddFocus('qty')}
                  className={`text-lg font-bold text-center h-12 transition-all ${quickAddFocus === 'qty' ? 'ring-2 ring-secondary-500 border-secondary-500 bg-secondary-50 shadow-sm outline-none' : ''}`}
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
                  className={`text-lg font-bold text-center h-12 transition-all ${quickAddFocus === 'total' ? 'ring-2 ring-secondary-500 border-secondary-500 bg-secondary-50 shadow-sm outline-none' : ''}`}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-sm font-bold text-gray-900">
              <span>{t('pos_sales.selected_amount')}</span>
              <span className="text-secondary-600">
                {parseFloat(quickAddQty || '0').toFixed(3).replace(/\.?0+$/, '') || '0'} {quickAddProduct.unit_of_measure?.toLowerCase() || t('pos_sales.units')}
              </span>
            </div>

            {/* Touch Screen Numpad */}
            <div className="pt-4 mt-2 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleNumpadInput(btn)}
                    className="h-14 bg-white border-2 border-gray-200 rounded-xl text-2xl font-black text-gray-800 hover:border-secondary-500 hover:bg-secondary-50 hover:text-secondary-600 transition-colors shadow-sm active:scale-[0.97]"
                  >
                    {btn}
                  </button>
                ))}
                <button
                  onClick={handleNumpadBackspace}
                  className="h-14 bg-red-50 border-2 border-red-100 rounded-xl text-xl font-bold text-red-600 hover:border-red-500 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm flex items-center justify-center active:scale-[0.97]"
                >
                  <BackspaceIcon className="w-8 h-8 opacity-90" />
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
              {(['cash', 'card', 'voucher', 'other'] as PaymentMethod[]).map((method) => {
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
            <div className="grid grid-cols-2 gap-3">

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
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
                />
              </div>

              {/* LBP field */}
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
                  placeholder={lbpRate > 0 ? '0' : 'No rate set'}
                  disabled={lbpRate <= 0}
                  title={lbpRate <= 0 ? 'Set LBP exchange rate in Admin → Store → Regional to enable this field' : undefined}
                  className={`w-full px-3 py-2.5 text-sm font-bold rounded-lg border transition-all
                    ${lbpRate > 0
                      ? 'border-amber-200 bg-amber-50 text-amber-900 placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
                      : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                />
                {lbpRate > 0 && lbpPaid > 0 && (
                  <p className="mt-1 text-[10px] text-amber-600 font-medium">≈ ${lbpPaidInUSD.toFixed(2)}</p>
                )}
                {lbpRate <= 0 && (
                  <p className="mt-1 text-[10px] text-gray-400">Set in Admin → Store → Regional</p>
                )}
              </div>
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
                <span className="ml-2">≈ <span className="font-semibold text-amber-600">{Math.ceil(grandTotal * lbpRate).toLocaleString()} LBP</span></span>
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
    </>
  );
}

