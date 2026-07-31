import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { storeService } from '../services/storeService';
import type { StoreSettings } from '../services/storeService';
import { menuService } from '../services/adminService';
import type { Menu } from '../services/adminService';
import { saleService } from '../services/saleService';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import type { Customer } from '../services/customerService';
import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { gradients, fonts } from '../styles/tokens';
import { useTranslation } from '../i18n/I18nContext';
import {
  MinimalReceiptHeader,
  MinimalReceiptMeta,
  MinimalReceiptLineTable,
  MinimalReceiptTotals,
  MinimalReceiptFooter,
  MinimalReceiptPayments,
  ModernReceiptHeader,
  ModernReceiptMeta,
  ModernReceiptLineTable,
  ModernReceiptTotals,
  ModernReceiptFooter,
  ModernReceiptPayments,
  ModernReceiptQr,
  formatLbpGrand,
  formatLbpPlain,
} from '../components/printReceipt';
import {
  UsersIcon,
  ClockIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PrinterIcon,
  CreditCardIcon,
  XMarkIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  CheckIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TruckIcon,
  PencilIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  menuName: string;
  categoryName: string;
  itemName: string;
  price: number;
  /** Exact per-unit LBP price from the product; null/undefined ⇒ rate-derived. */
  lbpPrice?: number | null;
  qty: number;
  productId?: string;
}

type TableStatus = 'available' | 'occupied' | 'bill_requested';

type RestaurantOrderType = 'dine_in' | 'takeaway' | 'delivery';

interface RestaurantOrder {
  orderType: RestaurantOrderType;
  tableNumber?: number;         // dine_in only
  seq?: number;                 // takeaway/delivery order number (#1, #2, …)
  guestCount: number;
  customerId?: string;          // set when linked to an existing Customers record
  customerName?: string;
  customerPhone?: string;       // delivery
  deliveryAddress?: string;     // delivery
  deliveryCharge?: number;      // delivery
  startTime: string;
  items: OrderItem[];
  status: 'occupied' | 'bill_requested';
  waiterName?: string;
  serviceFeeEnabled: boolean;
  serviceFeeRate: number;       // percentage, e.g. 10 = 10%
  notes?: string;
}

interface CompletedOrder {
  orderType: RestaurantOrderType;
  tableNumber?: number;
  seq?: number;
  guestCount: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryCharge: number;
  startTime: string;
  items: OrderItem[];
  paymentMethod: 'cash' | 'card' | 'other';
  amountGiven: number;
  grandTotal: number;           // full invoice total (incl. delivery fee)
  subtotal: number;
  taxAmount: number;
  serviceFeeAmount: number;
  serviceFeeRate: number;
  serviceFeeEnabled: boolean;
  change: number;
  /** LBP grand total honouring each line's exact LBP price; null when LBP is off. */
  grandTotalLbp: number | null;
  completedAt: string;
  receiptNo: string;
  notes?: string;
}

const STORAGE_KEY = 'restaurant_table_orders_v1';
const DEFAULT_SERVICE_FEE_RATE = 10; // 10%

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatDuration(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RestaurantPOS() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string>>({});

  const [orders, setOrders] = useState<Record<string, RestaurantOrder>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeMenuIdx, setActiveMenuIdx] = useState(0);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  const [showNotesInput, setShowNotesInput] = useState(false);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatTableNum, setSeatTableNum] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [seatEditMode, setSeatEditMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Walk-in / delivery order creation + customer-details editing
  const [newOrderModal, setNewOrderModal] = useState<'takeaway' | 'delivery' | null>(null);
  const [editCustomerKey, setEditCustomerKey] = useState<string | null>(null);
  const [custId, setCustId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custDeliveryFee, setCustDeliveryFee] = useState('');
  const [newOrderError, setNewOrderError] = useState<string | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [cashGivenLBP, setCashGivenLBP] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [billPrintOrder, setBillPrintOrder] = useState<{
    order: RestaurantOrder;
    totals: { subtotal: number; taxAmount: number; serviceFeeAmount: number; deliveryCharge: number; total: number; totalLbp: number | null };
  } | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Load settings
  useEffect(() => {
    storeService.getDefaultStore()
      .then(s => { setSettings(s); setIsLoading(false); })
      .catch(() => { setLoadError('load_failed'); setIsLoading(false); });
  }, []);

  // Load active menus for the current restaurant store
  useEffect(() => {
    if (!settings?.store_id) return;

    menuService
      .getMenus({ store_id: settings.store_id, is_active: true, page: 1, limit: 200 })
      .then((response) => {
        setMenus(
          response.data
        );
        setMenuLoadError(null);
      })
      .catch(() => {
        setMenus([]);
        setMenuLoadError('menu_load_failed');
      });
  }, [settings?.store_id]);

  // Load product images for menu items that are synced to a product (Admin -> Products image)
  useEffect(() => {
    if (!settings?.store_id) return;

    productService
      .getProducts({ limit: 1000 })
      .then((response) => {
        const images: Record<string, string> = {};
        for (const product of response.data) {
          if (product.image_url) images[product.product_id] = product.image_url;
        }
        setProductImages(images);
      })
      .catch(() => setProductImages({}));
  }, [settings?.store_id]);

  // Search existing Customers as the walk-in/delivery customer name is typed —
  // an empty query still fetches a default list so the field can be "browsed" on focus.
  useEffect(() => {
    if (!newOrderModal || !showCustomerSuggestions) return;
    const query = custName.trim();
    const handle = setTimeout(() => {
      customerService
        .getCustomers({ search: query || undefined, limit: 6 })
        .then(res => setCustomerSuggestions(res.data))
        .catch(() => setCustomerSuggestions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [custName, newOrderModal, showCustomerSuggestions]);

  // Restore from localStorage (older entries predate orderType — normalize to dine_in)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, RestaurantOrder> = JSON.parse(stored);
        const normalized: Record<string, RestaurantOrder> = {};
        for (const [key, order] of Object.entries(parsed)) {
          normalized[key] = {
            ...order,
            orderType: order.orderType ?? 'dine_in',
            tableNumber: order.tableNumber ?? (order.orderType == null ? Number(key) : undefined),
          };
        }
        setOrders(normalized);
      }
    } catch { /* ignore */ }
  }, []);

  // Back-fill the exact LBP price on orders that were opened before menu items
  // carried one, so a table left open across the upgrade still prices correctly.
  useEffect(() => {
    if (menus.length === 0) return;
    const lbpByProduct = new Map<string, number>();
    const lbpByName = new Map<string, number>();
    for (const menu of menus) {
      for (const cat of menu.categories) {
        for (const item of cat.items) {
          if (item.lbp_price == null) continue;
          const lbp = Number(item.lbp_price);
          if (item.product_id) lbpByProduct.set(item.product_id, lbp);
          lbpByName.set(`${menu.name}|${cat.name}|${item.name}`, lbp);
        }
      }
    }
    if (lbpByProduct.size === 0 && lbpByName.size === 0) return;

    setOrders(prev => {
      let changed = false;
      const next: Record<string, RestaurantOrder> = {};
      for (const [key, order] of Object.entries(prev)) {
        let orderChanged = false;
        const items = order.items.map(i => {
          if (i.lbpPrice != null) return i;
          const lbp = (i.productId ? lbpByProduct.get(i.productId) : undefined)
            ?? lbpByName.get(`${i.menuName}|${i.categoryName}|${i.itemName}`);
          if (lbp == null) return i;
          orderChanged = true;
          return { ...i, lbpPrice: lbp };
        });
        if (orderChanged) changed = true;
        next[key] = orderChanged ? { ...order, items } : order;
      }
      return changed ? next : prev;
    });
  }, [menus]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-print receipt when checkout completes and auto_print is enabled
  useEffect(() => {
    if (showReceipt && completedOrder && settings?.auto_print) {
      // Defer slightly to ensure React has fully rendered the print portal in the DOM.
      // window.print() blocks until the dialog is resolved, so cleanup can safely follow.
      const timer = setTimeout(() => {
        window.print();
        setShowReceipt(false);
        setCompletedOrder(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showReceipt, completedOrder, settings?.auto_print]);

  // ── Derived
  const tableCount = Math.max(1, settings?.restaurant_table_count || 10);
  const tableNumbers = Array.from({ length: tableCount }, (_, i) => i + 1);
  const trackGuests = !!settings?.restaurant_track_guests_per_table;
  const enabledPaymentMethods = ([
    { value: 'cash' as const,  enabled: settings?.pm_cash  !== false },
    { value: 'card' as const,  enabled: settings?.pm_card  !== false },
    { value: 'other' as const, enabled: settings?.pm_other !== false },
  ]).filter(m => m.enabled).map(m => m.value);

  const getTableStatus = (n: number): TableStatus => orders[n]?.status ?? 'available';
  const getTableOrder = (n: number): RestaurantOrder | null => orders[n] ?? null;
  const getOrderByKey = (key: string): RestaurantOrder | null => orders[key] ?? null;

  const availableCount = tableNumbers.filter(n => getTableStatus(n) === 'available').length;
  const occupiedCount  = tableNumbers.filter(n => getTableStatus(n) === 'occupied').length;
  const billCount      = tableNumbers.filter(n => getTableStatus(n) === 'bill_requested').length;

  const walkinEntries   = Object.entries(orders)
    .filter(([, o]) => o.orderType === 'takeaway')
    .sort(([, a], [, b]) => (a.seq ?? 0) - (b.seq ?? 0));
  const deliveryEntries = Object.entries(orders)
    .filter(([, o]) => o.orderType === 'delivery')
    .sort(([, a], [, b]) => (a.seq ?? 0) - (b.seq ?? 0));

  const nextSeq = (type: 'takeaway' | 'delivery') =>
    Object.values(orders)
      .filter(o => o.orderType === type)
      .reduce((max, o) => Math.max(max, o.seq ?? 0), 0) + 1;

  const orderLabel = (order: RestaurantOrder): string => {
    if (order.orderType === 'takeaway') return `${t('restaurant_pos.walk_in')} #${order.seq ?? '?'}`;
    if (order.orderType === 'delivery') return `${t('restaurant_pos.delivery')} #${order.seq ?? '?'}`;
    return `${t('restaurant_pos.table')} ${order.tableNumber ?? '?'}`;
  };

  // ── LBP amounts
  // A product can carry the exact LBP price typed on the Products page, and that
  // value is authoritative: converting its USD price back through the exchange
  // rate drifts (300,000 LBP → $3.35 → 299,825 LBP), which is what used to show
  // on the item cards and in the cart. Only rate-derived figures get rounded —
  // an exact price is displayed verbatim.
  const lbpEnabled = settings?.show_lbp_price !== false;
  const isLbpPrimary = !!settings?.lbp_primary_price;
  const lbpRate = lbpEnabled ? Math.max(0, Number(settings?.lbp_exchange_rate ?? 0) || 0) : 0;
  const lbpAvailable = lbpEnabled && lbpRate > 0;

  const roundLbp = (lbp: number): number =>
    settings?.round_lbp_to_1000 ? Math.ceil(lbp / 1000) * 1000 : Math.round(lbp);

  type LbpPriced = { price: number; lbpPrice?: number | null; qty: number };

  /** Unrounded LBP for a line: exact price × qty when known, else rate-derived. */
  const rawLineLbp = (item: LbpPriced): number =>
    item.lbpPrice != null ? Number(item.lbpPrice) * item.qty : item.price * item.qty * lbpRate;

  /** Displayable LBP for a single order line, or null when LBP is unavailable. */
  const lineLbp = (item: LbpPriced): number | null =>
    lbpAvailable ? (item.lbpPrice != null ? Number(item.lbpPrice) * item.qty : roundLbp(rawLineLbp(item))) : null;

  /** Displayable LBP for one unit of a menu item (item cards). */
  const menuItemLbp = (item: { price: number; lbp_price?: number | null }): number | null =>
    lineLbp({ price: item.price, lbpPrice: item.lbp_price, qty: 1 });

  const lbpText = (lbp: number | null | undefined): string | null =>
    lbp == null ? null : `${formatLbpPlain(lbp)} LBP`;

  const computeTotals = (order: RestaurantOrder) => {
    const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
    const taxInclusive = !!(settings?.tax_inclusive);
    const taxRate = Number(settings?.tax_rate ?? 0);
    let taxAmount = 0;
    if (taxInclusive && taxRate > 0) {
      const gross = subtotal;
      const net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
      taxAmount = Math.round((gross - net) * 100) / 100;
    } else {
      taxAmount = 0;
    }
    const sfBase = subtotal;
    const sfRate = order.serviceFeeEnabled ? (order.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE) : 0;
    // Round to cents so the total matches the backend's recomputed grand total exactly
    const serviceFeeAmount = order.serviceFeeEnabled ? Math.round(sfBase * (sfRate / 100) * 100) / 100 : 0;
    const deliveryCharge = order.orderType === 'delivery'
      ? Math.max(0, Math.round(Number(order.deliveryCharge || 0) * 100) / 100)
      : 0;
    // Full invoice total the customer pays; the drawer total may exclude the
    // delivery fee when include_delivery_in_drawer is off (mirrors retail POS).
    const total = Math.round((subtotal + serviceFeeAmount + deliveryCharge) * 100) / 100;
    const deliveryInDrawer = settings?.include_delivery_in_drawer !== false;
    const drawerTotal = Math.round((subtotal + serviceFeeAmount + (deliveryInDrawer ? deliveryCharge : 0)) * 100) / 100;

    // LBP side of the same invoice, summed from each line's exact LBP price where
    // the product has one so the cart, checkout and receipt all agree with the
    // Products page. With no exact prices this reduces to total × rate.
    let subtotalLbp: number | null = null;
    let serviceFeeLbp: number | null = null;
    let deliveryLbp: number | null = null;
    let totalLbp: number | null = null;
    if (lbpAvailable) {
      subtotalLbp = order.items.reduce((s, i) => s + rawLineLbp(i), 0);
      serviceFeeLbp = order.serviceFeeEnabled ? subtotalLbp * (sfRate / 100) : 0;
      deliveryLbp = deliveryCharge * lbpRate;
      totalLbp = roundLbp(subtotalLbp + serviceFeeLbp + deliveryLbp);
      subtotalLbp = roundLbp(subtotalLbp);
      serviceFeeLbp = roundLbp(serviceFeeLbp);
      deliveryLbp = roundLbp(deliveryLbp);
    }

    return {
      subtotal, taxAmount, serviceFeeAmount, deliveryCharge, total, drawerTotal, taxRate,
      subtotalLbp, serviceFeeLbp, deliveryLbp, totalLbp,
    };
  };

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency_code || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  /** Rate-derived LBP for a plain USD amount (fees, change) — no exact price exists. */
  const formatLBP = useCallback((amount: number): string | null => {
    if (settings?.show_lbp_price === false) return null;
    const lbp = formatLbpGrand(amount, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000);
    return lbp === null ? null : `${formatLbpPlain(lbp)} LBP`;
  }, [settings?.show_lbp_price, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000]);

  // USD/LBP price-tag pair: same size for both lines, amber-600 = LBP, secondary-400 = muted USD
  // (mirrors Sales.tsx cart-item price display). When lbp_primary_price is on, LBP renders first.
  // Pass lbpAmount to show a resolved LBP figure (exact product price) instead of converting.
  const renderDualAmount = (
    amount: number,
    baseClass: string,
    contextColor = 'text-secondary-600',
    lbpAmount?: number | null
  ) => {
    const lbp = lbpText(lbpAmount) ?? formatLBP(amount);
    if (isLbpPrimary && lbp) {
      return (
        <>
          <div className={`${baseClass} text-amber-600`}>{lbp}</div>
          <div className={`${baseClass} text-secondary-400`}>{formatCurrency(amount)}</div>
        </>
      );
    }
    return (
      <>
        <div className={`${baseClass} ${contextColor}`}>{formatCurrency(amount)}</div>
        {lbp && <div className={`${baseClass} text-amber-600`}>{lbp}</div>}
      </>
    );
  };

  // Hero banner total (white text on brand-blue gradient), mirrors Sales.tsx payment modal grand total
  const renderHeroAmount = (
    amount: number,
    primaryClass = 'text-2xl font-extrabold tabular-nums',
    secondaryClass = 'text-xs font-semibold text-white/80 mt-0.5 tabular-nums',
    lbpAmount?: number | null
  ) => {
    const lbp = lbpText(lbpAmount) ?? formatLBP(amount);
    if (isLbpPrimary && lbp) {
      return (
        <>
          <div className={primaryClass}>{lbp}</div>
          <div className={secondaryClass}>{formatCurrency(amount)}</div>
        </>
      );
    }
    return (
      <>
        <div className={primaryClass}>{formatCurrency(amount)}</div>
        {lbp && <div className={secondaryClass}>≈ {lbp}</div>}
      </>
    );
  };

  const usdGiven = parseFloat(cashGiven || '0') || 0;
  const lbpGiven = parseFloat(cashGivenLBP || '0') || 0;
  const lbpGivenInUsd = lbpRate > 0 && lbpGiven > 0 ? lbpGiven / lbpRate : 0;
  const totalTenderedUSD = usdGiven + lbpGivenInUsd;
  // Tender measured in LBP, so change against an exact-LBP total nets to zero
  // when the customer hands over precisely the LBP figure on the bill.
  const totalTenderedLBP = lbpAvailable ? lbpGiven + usdGiven * lbpRate : null;

  // ── Items to display in the menu grid
  const itemsToDisplay = useMemo(() => {
    type DisplayItem = {
      item: { name: string; price: number; product_id?: string; lbp_price?: number | null };
      menuName: string;
      categoryName: string;
      menuIdx: number;
      catIdx: number;
    };
    if (menuSearchQuery.trim()) {
      const q = menuSearchQuery.toLowerCase();
      const results: DisplayItem[] = [];
      menus.forEach((menu, mi) => {
        menu.categories.forEach((cat, ci) => {
          cat.items.forEach(item => {
            if (item.name.toLowerCase().includes(q)) {
              results.push({ item, menuName: menu.name, categoryName: cat.name, menuIdx: mi, catIdx: ci });
            }
          });
        });
      });
      return results;
    }
    const menu = menus[activeMenuIdx];
    const cat  = menu?.categories[activeCategoryIdx];
    if (!menu || !cat) return [];
    return cat.items.map(item => ({
      item,
      menuName: menu.name,
      categoryName: cat.name,
      menuIdx: activeMenuIdx,
      catIdx: activeCategoryIdx,
    }));
  }, [menuSearchQuery, menus, activeMenuIdx, activeCategoryIdx]);

  // ── How many of this menu item are already in the current order
  const getItemQtyInOrder = (itemName: string, menuName: string, categoryName: string): number => {
    if (!selectedKey) return 0;
    return getOrderByKey(selectedKey)?.items.find(
      i => i.itemName === itemName && i.menuName === menuName && i.categoryName === categoryName
    )?.qty ?? 0;
  };

  // ── Handlers
  const openOrder = (key: string) => {
    setSelectedKey(key);
    setActiveMenuIdx(0);
    setActiveCategoryIdx(0);
    setMenuSearchQuery('');
    setShowNotesInput(false);
  };

  const seatTable = (n: number, guests: number) => {
    setOrders(prev => ({
      ...prev,
      [n]: {
        orderType: 'dine_in',
        tableNumber: n,
        guestCount: guests,
        startTime: new Date().toISOString(),
        items: [],
        status: 'occupied',
        waiterName: user?.fullName,
        serviceFeeEnabled: false,
        serviceFeeRate: DEFAULT_SERVICE_FEE_RATE,
      },
    }));
    openOrder(String(n));
  };

  const handleTableClick = (n: number) => {
    if (getTableStatus(n) === 'available') {
      if (trackGuests) {
        setSeatTableNum(n); setGuestCount(2); setSeatEditMode(false); setShowSeatModal(true);
      } else {
        // Guest tracking disabled in store settings — seat immediately
        seatTable(n, 1);
      }
    } else {
      openOrder(String(n));
    }
  };

  const openNewOrderModal = (type: 'takeaway' | 'delivery') => {
    setCustId(null); setCustName(''); setCustPhone(''); setCustAddress(''); setCustDeliveryFee('');
    setCustomerSuggestions([]); setShowCustomerSuggestions(false);
    setNewOrderError(null);
    setEditCustomerKey(null);
    setNewOrderModal(type);
  };

  const openEditCustomer = () => {
    if (!selectedKey) return;
    const order = getOrderByKey(selectedKey);
    if (!order || order.orderType === 'dine_in') return;
    setCustId(order.customerId ?? null);
    setCustName(order.customerName ?? '');
    setCustPhone(order.customerPhone ?? '');
    setCustAddress(order.deliveryAddress ?? '');
    setCustDeliveryFee(order.deliveryCharge != null ? String(order.deliveryCharge) : '');
    setCustomerSuggestions([]); setShowCustomerSuggestions(false);
    setNewOrderError(null);
    setEditCustomerKey(selectedKey);
    setNewOrderModal(order.orderType);
  };

  const confirmNewOrder = () => {
    if (!newOrderModal) return;
    const name = custName.trim();
    const phone = custPhone.trim();
    const address = custAddress.trim();
    const fee = Math.max(0, Math.round((parseFloat(custDeliveryFee) || 0) * 100) / 100);

    if (newOrderModal === 'delivery' && (!name || !address)) {
      setNewOrderError('delivery_details_required');
      return;
    }

    if (editCustomerKey) {
      setOrders(prev => {
        const order = prev[editCustomerKey];
        if (!order) return prev;
        return {
          ...prev,
          [editCustomerKey]: {
            ...order,
            customerId: custId ?? undefined,
            customerName: name || undefined,
            customerPhone: phone || undefined,
            deliveryAddress: order.orderType === 'delivery' ? address : undefined,
            deliveryCharge: order.orderType === 'delivery' ? fee : undefined,
          },
        };
      });
    } else {
      const seq = nextSeq(newOrderModal);
      const key = `${newOrderModal === 'takeaway' ? 'w' : 'd'}${seq}_${Date.now()}`;
      setOrders(prev => ({
        ...prev,
        [key]: {
          orderType: newOrderModal,
          seq,
          guestCount: 1,
          customerId: custId ?? undefined,
          customerName: name || undefined,
          customerPhone: phone || undefined,
          deliveryAddress: newOrderModal === 'delivery' ? address : undefined,
          deliveryCharge: newOrderModal === 'delivery' ? fee : undefined,
          startTime: new Date().toISOString(),
          items: [],
          status: 'occupied',
          waiterName: user?.fullName,
          serviceFeeEnabled: false,
          serviceFeeRate: DEFAULT_SERVICE_FEE_RATE,
        },
      }));
      openOrder(key);
    }
    setNewOrderModal(null);
    setEditCustomerKey(null);
  };

  const updateDeliveryFee = (fee: number) => {
    if (!selectedKey) return;
    const clamped = Math.max(0, Math.round(fee * 100) / 100);
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order || order.orderType !== 'delivery') return prev;
      return { ...prev, [selectedKey]: { ...order, deliveryCharge: clamped } };
    });
  };

  const openEditGuests = () => {
    if (!selectedKey) return;
    const order = getOrderByKey(selectedKey);
    if (!order || order.orderType !== 'dine_in' || !order.tableNumber) return;
    setSeatTableNum(order.tableNumber);
    setGuestCount(order.guestCount);
    setSeatEditMode(true);
    setShowSeatModal(true);
  };

  const confirmSeat = () => {
    if (!seatTableNum) return;
    if (seatEditMode) {
      setOrders(prev => {
        const order = prev[seatTableNum];
        if (!order) return prev;
        return { ...prev, [seatTableNum]: { ...order, guestCount } };
      });
    } else {
      seatTable(seatTableNum, guestCount);
    }
    setShowSeatModal(false);
    setSeatTableNum(null);
    setSeatEditMode(false);
  };

  const confirmCancelOrder = () => {
    if (!selectedKey) return;
    setOrders(prev => { const n = { ...prev }; delete n[selectedKey]; return n; });
    setSelectedKey(null);
    setMenuSearchQuery('');
    setShowCancelConfirm(false);
  };

  const updateOrderNotes = (notes: string) => {
    if (!selectedKey) return;
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      return { ...prev, [selectedKey]: { ...order, notes } };
    });
  };

  const addMenuItem = (
    item: { name: string; price: number; product_id?: string; lbp_price?: number | null },
    menuName: string,
    categoryName: string
  ) => {
    if (!selectedKey) return;
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      const existingIdx = order.items.findIndex(
        i => i.itemName === item.name && i.menuName === menuName && i.categoryName === categoryName
      );
      const newItems = existingIdx >= 0
        // Re-stamp the LBP price so open orders restored from localStorage before
        // this existed pick it up on the next tap.
        ? order.items.map((i, idx) => idx === existingIdx
            ? { ...i, qty: i.qty + 1, lbpPrice: item.lbp_price ?? i.lbpPrice ?? null }
            : i)
        : [
            ...order.items,
            {
              id: generateId(),
              menuName,
              categoryName,
              itemName: item.name,
              price: item.price,
              lbpPrice: item.lbp_price ?? null,
              qty: 1,
              productId: item.product_id,
            },
          ];
      return { ...prev, [selectedKey]: { ...order, items: newItems } };
    });
  };

  const updateItemQty = (itemId: string, delta: number) => {
    if (!selectedKey) return;
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      const newItems = order.items
        .map(i => i.id === itemId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0);
      return { ...prev, [selectedKey]: { ...order, items: newItems } };
    });
  };

  const removeItem = (itemId: string) => {
    if (!selectedKey) return;
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      return { ...prev, [selectedKey]: { ...order, items: order.items.filter(i => i.id !== itemId) } };
    });
  };

  const toggleServiceFee = () => {
    if (!selectedKey) return;
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      return { ...prev, [selectedKey]: { ...order, serviceFeeEnabled: !order.serviceFeeEnabled } };
    });
  };

  const updateServiceFeeRate = (rate: number) => {
    if (!selectedKey) return;
    const clamped = Math.max(0, Math.min(100, rate));
    setOrders(prev => {
      const order = prev[selectedKey];
      if (!order) return prev;
      return { ...prev, [selectedKey]: { ...order, serviceFeeRate: clamped } };
    });
  };

  const handlePrintBill = () => {
    if (!selectedKey) return;
    const order = getOrderByKey(selectedKey);
    if (!order) return;
    const updated = { ...order, status: 'bill_requested' as const };
    setOrders(prev => ({ ...prev, [selectedKey]: updated }));
    const { subtotal, taxAmount, serviceFeeAmount, deliveryCharge, total, totalLbp } = computeTotals(updated);
    setBillPrintOrder({ order: updated, totals: { subtotal, taxAmount, serviceFeeAmount, deliveryCharge, total, totalLbp } });
    // window.print() blocks until the dialog resolves; clear the print overlay afterwards
    // so a later receipt print doesn't also include the bill.
    setTimeout(() => { window.print(); setBillPrintOrder(null); }, 100);
  };

  const handleCheckout = () => {
    if (!selectedKey) return;
    const order = getOrderByKey(selectedKey);
    if (!order || order.items.length === 0) return;
    const { total } = computeTotals(order);
    setPaymentMethod(enabledPaymentMethods.includes('cash') ? 'cash' : (enabledPaymentMethods[0] ?? 'cash'));
    setCashGiven(total > 0 ? total.toFixed(2) : '');
    setCashGivenLBP('');
    setCheckoutError(null);
    setShowCheckoutModal(true);
  };

  const resolveProductIdForOrderItem = async (orderItem: OrderItem): Promise<string> => {
    if (orderItem.productId) {
      return orderItem.productId;
    }
    throw new Error(
      `Menu item "${orderItem.itemName}" isn't linked to a product yet. Assign it to a menu & category from the Products page, then add the item to the table again.`
    );
  };

  const confirmCheckout = async () => {
    if (!selectedKey) return;
    const order = getOrderByKey(selectedKey);
    if (!order) return;
    setCheckoutError(null);
    setIsSubmittingCheckout(true);

    const { subtotal, taxAmount, serviceFeeAmount, deliveryCharge, total, drawerTotal, totalLbp } = computeTotals(order);
    const given = paymentMethod === 'cash' ? (totalTenderedUSD || total) : total;

    try {
      const saleItems = [];
      for (const orderItem of order.items) {
        const productId = await resolveProductIdForOrderItem(orderItem);
        saleItems.push({
          product_id: productId,
          qty: orderItem.qty,
          unit_price: orderItem.price,
          tax_rate: settings?.tax_inclusive ? Number(settings?.tax_rate ?? 0) : 0,
          lbp_price: orderItem.lbpPrice ?? null,
        });
      }

      const checkoutAt = new Date().toISOString();
      const orderNotes = order.notes?.trim();
      const isDineIn = order.orderType === 'dine_in';
      const sale = await saleService.createSale({
        items: saleItems,
        customer_id: order.customerId || undefined,
        delivery_charge: deliveryCharge > 0 ? deliveryCharge : undefined,
        grand_total_lbp: totalLbp,
        payments: [
          {
            method: paymentMethod,
            // Amount applied to the sale (matches grand_total), not cash tendered — tender is for UX/change only.
            amount: drawerTotal,
          },
        ],
        restaurant_context: {
          order_type: order.orderType,
          table_number: isDineIn ? order.tableNumber : undefined,
          guest_count: isDineIn ? order.guestCount : undefined,
          waiter_name: order.waiterName,
          customer_name: order.customerName || undefined,
          customer_phone: order.customerPhone || undefined,
          delivery_address: order.orderType === 'delivery' ? (order.deliveryAddress || undefined) : undefined,
          seated_at: order.startTime,
          checkout_at: checkoutAt,
          service_fee_enabled: order.serviceFeeEnabled,
          service_fee_rate: order.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE,
          service_fee_amount: serviceFeeAmount,
          subtotal_before_service: subtotal,
          notes: orderNotes || undefined,
        },
      });

      const completed: CompletedOrder = {
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        seq: order.seq,
        guestCount: order.guestCount,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryCharge,
        startTime: order.startTime,
        items: [...order.items],
        paymentMethod,
        amountGiven: given,
        grandTotal: total,
        subtotal,
        taxAmount,
        serviceFeeAmount,
        serviceFeeRate: order.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE,
        serviceFeeEnabled: order.serviceFeeEnabled,
        change: paymentMethod === 'cash' ? Math.max(0, given - total) : 0,
        grandTotalLbp: totalLbp,
        completedAt: sale.created_at || checkoutAt,
        receiptNo: sale.receipt_no,
        notes: orderNotes || undefined,
      };

      setCompletedOrder(completed);
      setBillPrintOrder(null);
      setOrders(prev => { const n = { ...prev }; delete n[selectedKey]; return n; });
      setSelectedKey(null);
      setMenuSearchQuery('');
      setShowCheckoutModal(false);
      setShowReceipt(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Checkout failed. Please review product mapping and try again.';
      setCheckoutError(message);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const selectedOrder  = selectedKey ? getOrderByKey(selectedKey) : null;
  const selectedTotals = selectedOrder ? computeTotals(selectedOrder) : null;

  // Fill exactly down to the viewport edge — measured instead of a hardcoded
  // vh offset, since LicenseBanner/TrialBanner/offline-sync banners above this
  // page push its top down by a variable amount.
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootHeight, setRootHeight] = useState<number | null>(null);
  useEffect(() => {
    const updateHeight = () => {
      if (rootRef.current) {
        setRootHeight(window.innerHeight - rootRef.current.getBoundingClientRect().top);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
    // Re-measure once loading/error resolve and the real ref'd div actually mounts —
    // on first mount isLoading is still true, so rootRef.current is null and this
    // effect would otherwise never get a second chance to measure.
  }, [isLoading, loadError]);

  // ── Loading / error states
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-secondary-200 border-t-secondary-600 mb-3" />
        <p className="text-gray-500 text-sm">{t('restaurant_pos.loading')}</p>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{t(`restaurant_pos.${loadError}`)}</p>
      </div>
    </div>
  );

  const inOrderView = !!(selectedKey && selectedOrder && selectedTotals);

  // ── Render
  return (
    <>
      <div
        ref={rootRef}
        className="flex flex-col -mx-4 -my-6 sm:-mx-6 lg:-mx-8 overflow-hidden print:hidden"
        style={{ height: rootHeight != null ? `${rootHeight}px` : 'calc(100vh - 64px)' }}
      >
        {/* ══════════════════════ HEADER ══════════════════════ */}
        {inOrderView ? (
          // Order-view header
          <div
            style={{ background: gradients.brandBlue }}
            className="brand-surface text-white px-5 py-3 flex items-center justify-between flex-shrink-0"
          >
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => { setSelectedKey(null); setMenuSearchQuery(''); }}
                className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm font-medium flex-shrink-0"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('restaurant_pos.tables')}</span>
              </button>
              <div className="w-px h-6 bg-white/20 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-extrabold text-lg leading-tight flex items-center gap-2">
                  {selectedOrder!.orderType === 'takeaway' && <ShoppingBagIcon className="w-5 h-5 text-blue-200 flex-shrink-0" />}
                  {selectedOrder!.orderType === 'delivery' && <TruckIcon className="w-5 h-5 text-blue-200 flex-shrink-0" />}
                  <span className="truncate">{orderLabel(selectedOrder!)}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-200 text-xs mt-0.5 flex-wrap">
                  {selectedOrder!.orderType === 'dine_in' && trackGuests && (
                    <>
                      <button
                        onClick={openEditGuests}
                        className="flex items-center gap-1 hover:text-white transition-colors underline decoration-dotted underline-offset-2"
                        title={t('restaurant_pos.edit_guests_title', { table: selectedOrder!.tableNumber ?? '' })}
                      >
                        <UsersIcon className="w-3.5 h-3.5" />
                        {selectedOrder!.guestCount} {t(selectedOrder!.guestCount !== 1 ? 'restaurant_pos.guests_v' : 'restaurant_pos.guest_v')}
                      </button>
                      <span>·</span>
                    </>
                  )}
                  {selectedOrder!.orderType !== 'dine_in' && (
                    <>
                      <button
                        onClick={openEditCustomer}
                        className="flex items-center gap-1 hover:text-white transition-colors underline decoration-dotted underline-offset-2 max-w-[180px]"
                        title={t('restaurant_pos.edit_customer_title')}
                      >
                        <PencilIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {selectedOrder!.customerName || t('restaurant_pos.customer_name')}
                        </span>
                      </button>
                      {selectedOrder!.customerPhone && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="w-3 h-3" />
                            {selectedOrder!.customerPhone}
                          </span>
                        </>
                      )}
                      <span>·</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDuration(selectedOrder!.startTime)}
                  </span>
                  {selectedOrder!.status === 'bill_requested' && (
                    <><span>·</span><span className="text-amber-300 font-semibold animate-pulse">● {t('restaurant_pos.bill_out')}</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <div className="text-right">
                {renderHeroAmount(selectedTotals!.total, 'text-2xl font-extrabold tabular-nums', 'text-xs font-semibold text-blue-200 mt-0.5 tabular-nums', selectedTotals!.totalLbp)}
                <div className="text-blue-200 text-xs">
                  {selectedOrder!.items.reduce((s, i) => s + i.qty, 0)} {t(selectedOrder!.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 'restaurant_pos.items_v' : 'restaurant_pos.item_v')}
                </div>
              </div>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
                title={t('restaurant_pos.cancel_order')}
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          // Table-grid header
          <div
            style={{ background: gradients.brand }}
            className="brand-surface text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0"
          >
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ fontFamily: fonts.display }}>
                {settings?.name || 'Restaurant'}
              </h1>
              <p className="text-blue-200 text-xs">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                &nbsp;·&nbsp;
                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            </div>
            <div className="flex items-center gap-5">
              {[
                { label: t('restaurant_pos.available'),            value: availableCount,         color: 'text-emerald-300' },
                { label: t('restaurant_pos.occupied'),             value: occupiedCount,          color: 'text-blue-200'   },
                { label: t('restaurant_pos.bill_requested_short'), value: billCount,              color: 'text-amber-300'  },
                { label: t('restaurant_pos.walk_in'),              value: walkinEntries.length,   color: 'text-violet-300' },
                { label: t('restaurant_pos.delivery'),             value: deliveryEntries.length, color: 'text-orange-300' },
              ].map(s => (
                <div key={s.label} className="text-center hidden sm:block">
                  <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-blue-200 uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════ BODY ══════════════════════ */}
        {inOrderView ? (
          /* ── 3-panel ORDER VIEW ── */
          <div className="flex flex-1 overflow-hidden">

            {/* ── LEFT: Category Sidebar ── */}
            <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 hidden md:flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('restaurant_pos.menu')}</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {menus.map((menu, mi) => (
                  <div key={mi}>
                    {/* Menu group header */}
                    <div className="sticky top-0 px-4 py-2 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest bg-gray-50 border-y border-gray-100 z-10">
                      {menu.name}
                    </div>
                    {/* Categories */}
                    {menu.categories.map((cat, ci) => {
                      const isActive = !menuSearchQuery && activeMenuIdx === mi && activeCategoryIdx === ci;
                      return (
                        <button
                          key={ci}
                          onClick={() => { setActiveMenuIdx(mi); setActiveCategoryIdx(ci); setMenuSearchQuery(''); }}
                          className={[
                            'w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors border-r-2',
                            isActive
                              ? 'bg-secondary-50 text-secondary-700 font-semibold border-secondary-500'
                              : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                          ].join(' ')}
                        >
                          <span className="truncate">{cat.name}</span>
                          <span className={`text-xs ml-2 flex-shrink-0 tabular-nums ${isActive ? 'text-secondary-400' : 'text-gray-300'}`}>
                            {cat.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* ── CENTER: Menu Items Grid ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f4fa]">

              {/* Search + breadcrumb bar */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 space-y-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={menuSearchQuery}
                    onChange={e => setMenuSearchQuery(e.target.value)}
                    placeholder={t('restaurant_pos.search_placeholder')}
                    className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors placeholder-gray-400"
                  />
                  {menuSearchQuery && (
                    <button
                      onClick={() => setMenuSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 px-0.5">
                  {menuSearchQuery ? (
                    <>{t('restaurant_pos.search_results', { count: itemsToDisplay.length, query: menuSearchQuery })}</>
                  ) : (
                    <><span className="text-gray-500 font-medium">{menus[activeMenuIdx]?.name}</span> › <span className="font-semibold text-gray-700">{menus[activeMenuIdx]?.categories[activeCategoryIdx]?.name}</span> <span className="text-gray-300">·</span> {t('restaurant_pos.items_in_category', { count: menus[activeMenuIdx]?.categories[activeCategoryIdx]?.items.length ?? 0 })}</>
                  )}
                </p>
              </div>

              {/* Mobile category chips */}
              <div className="md:hidden flex gap-2 px-3 py-2 bg-white border-b border-gray-100 overflow-x-auto flex-shrink-0">
                {menus.flatMap((menu, mi) =>
                  menu.categories.map((cat, ci) => {
                    const isActive = !menuSearchQuery && activeMenuIdx === mi && activeCategoryIdx === ci;
                    return (
                      <button
                        key={`${mi}-${ci}`}
                        onClick={() => { setActiveMenuIdx(mi); setActiveCategoryIdx(ci); setMenuSearchQuery(''); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                          isActive ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Items grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {itemsToDisplay.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                    {menuSearchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-sm font-semibold">{t('restaurant_pos.no_search_results', { query: menuSearchQuery })}</p>
                        <p className="text-xs mt-1 text-gray-300">{t('restaurant_pos.try_different')}</p>
                      </>
                    ) : (
                      <>
                        <DocumentTextIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-sm font-semibold">{t('restaurant_pos.no_items_in_category')}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {itemsToDisplay.map(({ item, menuName, categoryName }, idx) => {
                      const qty = getItemQtyInOrder(item.name, menuName, categoryName);
                      const inOrder = qty > 0;
                      return (
                        <button
                          key={idx}
                          onClick={() => addMenuItem(item, menuName, categoryName)}
                          className={[
                            'relative text-left p-3.5 rounded-xl border-2 transition-all duration-150 group active:scale-[0.95] focus:outline-none',
                            inOrder
                              ? 'border-secondary-400 bg-secondary-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-secondary-300 hover:shadow-md hover:bg-white',
                          ].join(' ')}
                        >
                          {/* In-order qty badge */}
                          {inOrder && (
                            <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-secondary-500 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                              {qty}
                            </span>
                          )}
                          {/* Category label (search mode) */}
                          {menuSearchQuery && (
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 truncate">
                              {categoryName}
                            </div>
                          )}
                          {/* Item image */}
                          <div className="w-full h-16 mb-2 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group-hover:bg-secondary-50 transition-colors">
                            {item.product_id && productImages[item.product_id] ? (
                              <img
                                src={`${API_BASE_URL}${productImages[item.product_id]}`}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('.fallback-initials')) {
                                    const span = document.createElement('span');
                                    span.className = 'text-lg font-bold text-secondary-400 fallback-initials';
                                    span.innerText = item.name.charAt(0).toUpperCase();
                                    parent.appendChild(span);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-lg font-bold text-secondary-300">
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className={`font-semibold text-sm leading-snug mb-3 line-clamp-2 ${inOrder ? 'text-secondary-700' : 'text-gray-800 group-hover:text-secondary-700'}`}>
                            {item.name}
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <div className="flex flex-col leading-tight min-w-0">
                              {renderDualAmount(item.price, 'font-extrabold text-sm', 'text-secondary-600', menuItemLbp(item))}
                            </div>
                            <div className={[
                              'w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0',
                              inOrder
                                ? 'bg-secondary-500 text-white'
                                : 'bg-gray-100 group-hover:bg-secondary-500 group-hover:text-white',
                            ].join(' ')}>
                              <PlusIcon className={`w-4 h-4 ${inOrder ? 'text-white' : 'text-secondary-600 group-hover:text-white'}`} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Order Cart ── */}
            <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 shadow-xl overflow-hidden">

              {/* Cart header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
                <span className="font-bold text-gray-700 text-sm">{t('restaurant_pos.order')}</span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {selectedOrder!.items.reduce((s, i) => s + i.qty, 0)} {t(selectedOrder!.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 'restaurant_pos.items_v' : 'restaurant_pos.item_v')}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto">
                {selectedOrder!.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300 p-6 text-center">
                    <DocumentTextIcon className="w-10 h-10 mb-2" />
                    <p className="text-sm font-medium text-gray-400">{t('restaurant_pos.order_empty')}</p>
                    <p className="text-xs mt-1 text-gray-300">{t('restaurant_pos.tap_to_add')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {/* Newest addition shown first — the underlying order (receipts, kitchen bill) stays chronological */}
                    {[...selectedOrder!.items].reverse().map(item => (
                      <div key={item.id} className="group px-3 py-2 hover:bg-gray-50 transition-colors">
                        {/* Name gets the full row width so long names wrap cleanly instead of truncating */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800 leading-snug break-words min-w-0 flex-1">
                            {item.itemName}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => updateItemQty(item.id, -1)}
                              className="w-6 h-6 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50 flex items-center justify-center transition-colors"
                            >
                              <MinusIcon className="w-3 h-3 text-gray-500" />
                            </button>
                            <span className="w-5 text-center font-bold text-sm text-gray-800 tabular-nums">{item.qty}</span>
                            <button
                              onClick={() => updateItemQty(item.id, 1)}
                              className="w-6 h-6 rounded-md border border-gray-200 hover:border-secondary-300 hover:bg-secondary-50 flex items-center justify-center transition-colors"
                            >
                              <PlusIcon className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                          <div className="text-right flex-shrink-0 flex flex-col leading-tight">
                            {renderDualAmount(item.price * item.qty, 'text-xs font-bold tabular-nums', 'text-gray-700', lineLbp(item))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals + Action buttons */}
              <div className="border-t border-gray-200 flex-shrink-0">

                {/* ── Order Notes (collapsed to a one-line link until needed) ── */}
                <div className="px-4 py-1.5 bg-white border-b border-gray-100">
                  {selectedOrder!.notes || showNotesInput ? (
                    <textarea
                      autoFocus={showNotesInput && !selectedOrder!.notes}
                      value={selectedOrder!.notes ?? ''}
                      onChange={e => updateOrderNotes(e.target.value)}
                      onBlur={() => { if (!selectedOrder!.notes) setShowNotesInput(false); }}
                      placeholder={t('restaurant_pos.order_notes_placeholder')}
                      rows={selectedOrder!.notes ? 2 : 1}
                      maxLength={1000}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors placeholder-gray-300 resize-none overflow-hidden"
                    />
                  ) : (
                    <button
                      onClick={() => setShowNotesInput(true)}
                      className="w-full text-left text-xs font-medium text-gray-400 hover:text-secondary-600 py-1 transition-colors"
                    >
                      + {t('restaurant_pos.order_notes')}
                    </button>
                  )}
                </div>

                {/* ── Service Fee Toggle (dine-in only) — amount itself shows in Totals below ── */}
                {selectedOrder!.orderType === 'dine_in' && (
                  <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Toggle switch */}
                      <button
                        onClick={toggleServiceFee}
                        role="switch"
                        aria-checked={selectedOrder!.serviceFeeEnabled}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                          selectedOrder!.serviceFeeEnabled ? 'bg-secondary-500' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          selectedOrder!.serviceFeeEnabled ? 'translate-x-[18px]' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className={`text-sm font-semibold truncate ${selectedOrder!.serviceFeeEnabled ? 'text-gray-800' : 'text-gray-400'}`}>
                        {t('restaurant_pos.service_fee')}
                      </span>
                    </div>
                    {/* Rate input */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        value={selectedOrder!.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE}
                        onChange={e => updateServiceFeeRate(parseFloat(e.target.value) || 0)}
                        disabled={!selectedOrder!.serviceFeeEnabled}
                        className="w-12 text-right text-xs font-bold border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-secondary-400 disabled:opacity-30 disabled:bg-gray-50 bg-white transition-colors tabular-nums"
                        min="0" max="100" step="0.5"
                      />
                      <span className={`text-xs font-semibold ${selectedOrder!.serviceFeeEnabled ? 'text-gray-500' : 'text-gray-300'}`}>%</span>
                    </div>
                  </div>
                )}

                {/* ── Delivery Fee (delivery only) — mirrors Sales.tsx's Delivery Charge input ── */}
                {selectedOrder!.orderType === 'delivery' && (
                  <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 min-w-0">
                      <TruckIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="truncate">{t('restaurant_pos.delivery_fee')}</span>
                      {settings?.include_delivery_in_drawer === false && (selectedOrder!.deliveryCharge ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none flex-shrink-0">
                          Not in drawer
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={selectedOrder!.deliveryCharge ?? 0}
                        onChange={e => updateDeliveryFee(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 text-right font-semibold transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ── Totals ── */}
                {selectedOrder!.items.length > 0 && (
                  <div className="px-4 pt-2 pb-1.5 space-y-1 text-sm bg-gray-50">
                    <div className="flex justify-between text-gray-500">
                      <span>{t('restaurant_pos.subtotal')}</span>
                      <span className="font-medium tabular-nums text-right">
                        {formatCurrency(selectedTotals!.subtotal)}
                        {lbpText(selectedTotals!.subtotalLbp) && (
                          <span className="block text-xs text-amber-600">{lbpText(selectedTotals!.subtotalLbp)}</span>
                        )}
                      </span>
                    </div>
                    {selectedOrder!.serviceFeeEnabled && selectedTotals!.serviceFeeAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t('receipt.service_fee', { rate: selectedOrder!.serviceFeeRate })}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.serviceFeeAmount)}</span>
                      </div>
                    )}
                    {selectedTotals!.deliveryCharge > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t('receipt.delivery')}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.deliveryCharge)}</span>
                      </div>
                    )}
                    {selectedTotals!.taxAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t('restaurant_pos.tax_with_rate', { rate: settings?.tax_rate ?? 0 })}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-start font-extrabold text-gray-900 text-base pt-1.5 border-t border-gray-200">
                      <span>{t('restaurant_pos.total')}</span>
                      <div className="text-right">
                        {renderDualAmount(selectedTotals!.total, 'font-extrabold text-base tabular-nums', 'text-gray-900', selectedTotals!.totalLbp)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 flex gap-2">
                  <button
                    onClick={handlePrintBill}
                    disabled={selectedOrder!.items.length === 0}
                    title={selectedOrder!.status === 'bill_requested' ? t('restaurant_pos.reprint_bill') : t('restaurant_pos.print_bill')}
                    className="w-11 flex-shrink-0 flex items-center justify-center py-2.5 rounded-xl border-2 border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PrinterIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={selectedOrder!.items.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {t('restaurant_pos.checkout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── TABLE GRID VIEW ── */
          <div className="flex-1 overflow-y-auto p-5 bg-[#f0f4fa]">
            {menuLoadError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                {t(`restaurant_pos.${menuLoadError}`)}
              </div>
            )}
            {menus.length === 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                {t('restaurant_pos.no_menus')}
              </div>
            )}

            {/* ── Walk-in & Delivery strip ── */}
            <div className="mb-6">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                {t('restaurant_pos.takeaway_delivery')}
              </p>
              <div className="flex gap-3 flex-wrap">
                {/* New Walk-in */}
                <button
                  onClick={() => openNewOrderModal('takeaway')}
                  className="flex flex-col items-center justify-center gap-1.5 w-32 min-h-[104px] rounded-2xl border-2 border-dashed border-violet-300 text-violet-500 hover:bg-violet-50 hover:border-violet-400 transition-all active:scale-[0.97] focus:outline-none"
                >
                  <span className="relative">
                    <ShoppingBagIcon className="w-7 h-7" />
                    <PlusIcon className="w-3.5 h-3.5 absolute -top-1 -right-2 bg-violet-500 text-white rounded-full p-0.5" />
                  </span>
                  <span className="text-xs font-bold">{t('restaurant_pos.new_walkin')}</span>
                </button>
                {/* New Delivery */}
                <button
                  onClick={() => openNewOrderModal('delivery')}
                  className="flex flex-col items-center justify-center gap-1.5 w-32 min-h-[104px] rounded-2xl border-2 border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 hover:border-orange-400 transition-all active:scale-[0.97] focus:outline-none"
                >
                  <span className="relative">
                    <TruckIcon className="w-7 h-7" />
                    <PlusIcon className="w-3.5 h-3.5 absolute -top-1 -right-2 bg-orange-500 text-white rounded-full p-0.5" />
                  </span>
                  <span className="text-xs font-bold">{t('restaurant_pos.new_delivery')}</span>
                </button>
                {/* Active walk-in / delivery order cards */}
                {[...walkinEntries, ...deliveryEntries].map(([key, order]) => {
                  const totals = computeTotals(order);
                  const isDelivery = order.orderType === 'delivery';
                  const isBill = order.status === 'bill_requested';
                  return (
                    <button
                      key={key}
                      onClick={() => openOrder(key)}
                      className={[
                        'relative w-44 min-h-[104px] rounded-2xl p-3.5 text-left transition-all duration-200 focus:outline-none',
                        'hover:scale-[1.03] hover:shadow-lg active:scale-[0.97] bg-white border-2',
                        isBill
                          ? 'border-amber-400 bg-amber-50 shadow-md'
                          : isDelivery
                            ? 'border-orange-300 hover:border-orange-400 shadow-sm'
                            : 'border-violet-300 hover:border-violet-400 shadow-sm',
                      ].join(' ')}
                    >
                      <span className={[
                        'absolute top-3 right-3 w-2.5 h-2.5 rounded-full',
                        isBill ? 'bg-amber-500 animate-pulse' : isDelivery ? 'bg-orange-400' : 'bg-violet-400',
                      ].join(' ')} />
                      <div className={`flex items-center gap-1.5 font-extrabold text-sm mb-1 ${
                        isBill ? 'text-amber-600' : isDelivery ? 'text-orange-600' : 'text-violet-600'
                      }`}>
                        {isDelivery ? <TruckIcon className="w-4 h-4 flex-shrink-0" /> : <ShoppingBagIcon className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate">{orderLabel(order)}</span>
                      </div>
                      {order.customerName && (
                        <div className="text-xs text-gray-600 font-medium truncate mb-0.5">{order.customerName}</div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatDuration(order.startTime)}</span>
                      </div>
                      {renderDualAmount(totals.total, 'text-sm font-extrabold mt-1 tabular-nums',
                        isBill ? 'text-amber-600' : isDelivery ? 'text-orange-600' : 'text-violet-600',
                        totals.totalLbp
                      )}
                      {isBill && (
                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">{t('restaurant_pos.bill_requested')}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Tables ── */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
              {t('restaurant_pos.tables')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {tableNumbers.map(num => {
                const status = getTableStatus(num);
                const order  = getTableOrder(num);
                const totals = order ? computeTotals(order) : null;
                return (
                  <button
                    key={num}
                    onClick={() => handleTableClick(num)}
                    className={[
                      'relative rounded-2xl p-4 text-left transition-all duration-200 focus:outline-none',
                      'hover:scale-[1.03] hover:shadow-lg active:scale-[0.97] bg-white border-2',
                      status === 'available'      ? 'border-emerald-200 hover:border-emerald-400' : '',
                      status === 'occupied'       ? 'border-blue-300 hover:border-blue-400 shadow-sm' : '',
                      status === 'bill_requested' ? 'border-amber-400 bg-amber-50 shadow-md' : '',
                    ].join(' ')}
                  >
                    <span className={[
                      'absolute top-3 right-3 w-2.5 h-2.5 rounded-full',
                      status === 'available'      ? 'bg-emerald-400' : '',
                      status === 'occupied'       ? 'bg-blue-500' : '',
                      status === 'bill_requested' ? 'bg-amber-500 animate-pulse' : '',
                    ].join(' ')} />
                    <div className={[
                      'text-3xl font-extrabold mb-0.5',
                      status === 'available'      ? 'text-gray-200' : '',
                      status === 'occupied'       ? 'text-secondary-600' : '',
                      status === 'bill_requested' ? 'text-amber-600' : '',
                    ].join(' ')}>{num}</div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t('restaurant_pos.table')}</div>
                    {status === 'available' ? (
                      <div className="text-xs text-emerald-600 font-semibold">{t('restaurant_pos.available')}</div>
                    ) : order ? (
                      <div className="space-y-1">
                        {trackGuests && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <UsersIcon className="w-3 h-3" />
                            <span>{order.guestCount} {t(order.guestCount !== 1 ? 'restaurant_pos.guests_v' : 'restaurant_pos.guest_v')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <ClockIcon className="w-3 h-3" />
                          <span>{formatDuration(order.startTime)}</span>
                        </div>
                        {totals && renderDualAmount(totals.total, 'text-sm font-extrabold mt-1 tabular-nums',
                          status === 'bill_requested' ? 'text-amber-600' : 'text-secondary-600',
                          totals.totalLbp
                        )}
                        {status === 'bill_requested' && (
                          <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">{t('restaurant_pos.bill_requested')}</div>
                        )}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════ MODALS ══════════════════════ */}

        {/* Seat Guests */}
        {showSeatModal && seatTableNum && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {t(seatEditMode ? 'restaurant_pos.edit_guests_title' : 'restaurant_pos.seat_guests_title', { table: seatTableNum })}
                </h2>
                <button onClick={() => { setShowSeatModal(false); setSeatEditMode(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-500 text-sm text-center mb-4">{t('restaurant_pos.how_many_guests')}</p>
              <div className="flex items-center justify-center gap-6 mb-5">
                <button
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <MinusIcon className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-5xl font-extrabold text-secondary-600 w-16 text-center tabular-nums">{guestCount}</div>
                <button
                  onClick={() => setGuestCount(guestCount + 1)}
                  className="w-12 h-12 rounded-full bg-secondary-100 hover:bg-secondary-200 flex items-center justify-center transition-colors"
                >
                  <PlusIcon className="w-5 h-5 text-secondary-600" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setGuestCount(n)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      guestCount === n ? 'bg-secondary-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={confirmSeat}
                className="w-full py-3.5 bg-secondary-500 hover:bg-secondary-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckIcon className="w-5 h-5" />
                {seatEditMode
                  ? t('restaurant_pos.update_guests_cta')
                  : t('restaurant_pos.seat_guests_cta', { count: guestCount })}
              </button>
            </div>
          </div>
        )}

        {/* New Walk-in / Delivery order + edit customer details */}
        {newOrderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {newOrderModal === 'delivery'
                    ? <TruckIcon className="w-5 h-5 text-orange-500" />
                    : <ShoppingBagIcon className="w-5 h-5 text-violet-500" />}
                  {editCustomerKey
                    ? t('restaurant_pos.edit_customer_title')
                    : t(newOrderModal === 'delivery' ? 'restaurant_pos.new_delivery_title' : 'restaurant_pos.new_walkin_title')}
                </h2>
                <button
                  onClick={() => { setNewOrderModal(null); setEditCustomerKey(null); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('restaurant_pos.customer_name')}
                    {newOrderModal === 'takeaway' && (
                      <span className="text-gray-400 font-normal"> ({t('restaurant_pos.optional')})</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={custName}
                    onChange={e => {
                      setCustName(e.target.value);
                      setCustId(null);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                    maxLength={255}
                    autoComplete="off"
                    autoFocus
                    placeholder={t('restaurant_pos.customer_name_placeholder')}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors"
                  />
                  {custId && (
                    <p className="mt-1 text-[11px] font-medium text-secondary-600">
                      {t('restaurant_pos.linked_customer')}
                    </p>
                  )}
                  {showCustomerSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {customerSuggestions.map(c => (
                        <button
                          key={c.customer_id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCustName(c.full_name || '');
                            setCustPhone(c.phone || '');
                            setCustId(c.customer_id);
                            setShowCustomerSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="font-medium text-gray-800 truncate">
                            {c.full_name || t('restaurant_pos.customer_name')}
                          </span>
                          {c.phone && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{c.phone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('restaurant_pos.customer_phone')}
                    <span className="text-gray-400 font-normal"> ({t('restaurant_pos.optional')})</span>
                  </label>
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
                {newOrderModal === 'delivery' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('restaurant_pos.delivery_address')}</label>
                      <textarea
                        value={custAddress}
                        onChange={e => setCustAddress(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {t('restaurant_pos.delivery_fee')}
                        <span className="text-gray-400 font-normal"> ({t('restaurant_pos.optional')})</span>
                      </label>
                      <input
                        type="number"
                        value={custDeliveryFee}
                        onChange={e => setCustDeliveryFee(e.target.value)}
                        min="0"
                        step="0.25"
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 text-sm text-right font-bold border border-gray-200 rounded-xl focus:outline-none focus:border-secondary-400 bg-gray-50 focus:bg-white transition-colors tabular-nums"
                      />
                    </div>
                  </>
                )}
                {newOrderError && (
                  <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
                    {t(`restaurant_pos.${newOrderError}`)}
                  </div>
                )}
                <button
                  onClick={confirmNewOrder}
                  className={`w-full py-3.5 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm ${
                    newOrderModal === 'delivery' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-violet-500 hover:bg-violet-600'
                  }`}
                >
                  <CheckIcon className="w-5 h-5" />
                  {editCustomerKey ? t('restaurant_pos.save_details') : t('restaurant_pos.start_order')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkout — mirrors the Store POS (Sales.tsx) payment modal styling & flow */}
        {showCheckoutModal && selectedOrder && selectedTotals && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">{t('restaurant_pos.checkout_title', { label: orderLabel(selectedOrder) })}</h2>
                <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {/* Payment method */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">
                    {t('restaurant_pos.payment_method')}
                  </label>
                  <div className={`grid gap-1.5 ${enabledPaymentMethods.length === 3 ? 'grid-cols-3' : enabledPaymentMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {([
                      { value: 'cash',  label: t('restaurant_pos.cash'),  icon: BanknotesIcon   },
                      { value: 'card',  label: t('restaurant_pos.card'),  icon: CreditCardIcon  },
                      { value: 'other', label: t('restaurant_pos.other'), icon: DocumentTextIcon },
                    ] as const).filter(({ value }) => enabledPaymentMethods.includes(value)).map(({ value, label, icon: Icon }) => {
                      const active = paymentMethod === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setPaymentMethod(value)}
                          className={`p-2 rounded-lg border-2 transition-all duration-150 ${
                            active ? 'border-secondary-500 bg-secondary-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className={`p-1 rounded-md ${active ? 'bg-secondary-500' : 'bg-gray-100'}`}>
                              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-gray-500'}`} />
                            </div>
                            <span className={`font-semibold text-[11px] ${active ? 'text-secondary-600' : 'text-gray-600'}`}>
                              {label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cash Received — hidden for non-cash methods */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('restaurant_pos.amount_given')}</p>
                    <div className={`grid ${lbpRate > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 mb-1">
                          <CurrencyDollarIcon className="w-3 h-3 text-gray-400" />
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          onFocus={e => e.target.select()}
                          autoFocus
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {lbpRate > 0 && (
                        <div>
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 mb-1">
                            <span className="text-xs">🇱🇧</span>
                            Amount (LBP)
                          </label>
                          <input
                            type="number"
                            value={cashGivenLBP}
                            onChange={e => setCashGivenLBP(e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
                            min="0"
                            step="500"
                          />
                          {lbpGiven > 0 && (
                            <p className="mt-0.5 text-[10px] text-gray-500 font-medium">≈ {formatCurrency(lbpGivenInUsd)}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Live total received row */}
                    {(usdGiven > 0 || (lbpRate > 0 && lbpGiven > 0)) && (
                      <div className="flex justify-between items-center px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-[11px] font-semibold text-gray-600">Total Received</span>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900">{formatCurrency(totalTenderedUSD)}</span>
                          {lbpRate > 0 && usdGiven > 0 && lbpGiven > 0 && (
                            <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                              {formatCurrency(usdGiven)} + {lbpGiven.toLocaleString()} LBP
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-gray-400">
                      Total due:&nbsp;<span className="font-semibold text-gray-600">{formatCurrency(selectedTotals.total)}</span>
                    </p>
                  </div>
                )}

                {/* Grand Total + Change Due — mirrors Sales.tsx payment modal exactly */}
                <div
                  className="brand-surface flex justify-between items-center p-2.5 rounded-xl text-white"
                  style={{ background: gradients.brandBlue, boxShadow: `0 4px 14px color-mix(in srgb, var(--color-secondary) 30%, transparent)` }}
                >
                  <span className="text-xs font-semibold opacity-90">{t('restaurant_pos.total')}</span>
                  <div className="text-right">
                    {renderHeroAmount(selectedTotals.total, 'text-xl font-bold tabular-nums', 'text-[11px] font-semibold text-white/80 mt-0.5 tabular-nums', selectedTotals.totalLbp)}
                  </div>
                </div>

                {paymentMethod === 'cash' && totalTenderedUSD > 0 && (
                  totalTenderedUSD >= selectedTotals.total ? (
                    <div className="flex justify-between items-start px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-xs font-semibold text-emerald-700">{t('restaurant_pos.change_due')}</span>
                      <div className="text-right">
                        {renderDualAmount(totalTenderedUSD - selectedTotals.total, 'font-bold text-base tabular-nums', 'text-emerald-700',
                          // Netted in LBP, so handing over the exact LBP on the bill leaves no change
                          totalTenderedLBP != null && selectedTotals.totalLbp != null
                            ? Math.max(0, roundLbp(totalTenderedLBP - selectedTotals.totalLbp))
                            : null
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start px-2.5 py-2 bg-red-50 border border-red-200 rounded-xl">
                      <span className="text-xs font-semibold text-red-700">Remaining</span>
                      <div className="text-right">
                        {renderDualAmount(selectedTotals.total - totalTenderedUSD, 'font-bold text-base tabular-nums', 'text-red-700',
                          totalTenderedLBP != null && selectedTotals.totalLbp != null
                            ? Math.max(0, roundLbp(selectedTotals.totalLbp - totalTenderedLBP))
                            : null
                        )}
                      </div>
                    </div>
                  )
                )}

                {checkoutError && (
                  <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5">
                    {checkoutError}
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-colors"
                >
                  {t('restaurant_pos.cancel')}
                </button>
                <button
                  onClick={confirmCheckout}
                  disabled={
                    isSubmittingCheckout ||
                    (paymentMethod === 'cash' && totalTenderedUSD < selectedTotals.total)
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <CheckCircleIconSolid className="w-4 h-4" />
                  {isSubmittingCheckout ? t('restaurant_pos.processing') : t('restaurant_pos.complete_checkout')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order confirmation */}
        {showCancelConfirm && selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {t('restaurant_pos.cancel_order_title', { label: orderLabel(selectedOrder) })}
                </h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">{t('restaurant_pos.cancel_order_message')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  {t('restaurant_pos.keep_order')}
                </button>
                <button
                  onClick={confirmCancelOrder}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-sm"
                >
                  {t('restaurant_pos.cancel_order')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt after checkout */}
        {showReceipt && completedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircleIconSolid className="w-6 h-6 text-emerald-500" />
                  <h2 className="text-lg font-bold text-gray-900">{t('restaurant_pos.checkout_complete')}</h2>
                </div>
                <button onClick={() => { setShowReceipt(false); setCompletedOrder(null); }} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <RestaurantReceipt order={completedOrder} settings={settings} formatCurrency={formatCurrency} />
              </div>
              <div className="flex gap-3 px-6 pb-6 pt-2 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold rounded-xl transition-colors"
                >
                  <PrinterIcon className="w-5 h-5" />
                  {t('restaurant_pos.print_receipt')}
                </button>
                <button
                  onClick={() => { setShowReceipt(false); setCompletedOrder(null); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  {t('restaurant_pos.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Print-only receipt (outside print:hidden container) ── */}
      {completedOrder && (
        <div className="hidden print:block fixed inset-0 z-[9999] bg-white overflow-auto">
          <RestaurantReceipt order={completedOrder} settings={settings} formatCurrency={formatCurrency} />
        </div>
      )}

      {/* ── Bill print (outside print:hidden container) ── */}
      {billPrintOrder && (
        <div className="hidden print:block fixed inset-0 z-[9999] bg-white overflow-auto">
          <BillReceipt data={billPrintOrder} settings={settings} formatCurrency={formatCurrency} />
        </div>
      )}
    </>
  );
}

// ─── RestaurantReceipt ───────────────────────────────────────────────────────

interface RestaurantReceiptProps {
  order: CompletedOrder;
  settings: StoreSettings | null;
  formatCurrency: (n: number) => string;
}

function RestaurantReceipt({ order, settings, formatCurrency }: RestaurantReceiptProps) {
  const { t } = useTranslation();

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: settings?.timezone || 'UTC',
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString();
    }
  };

  // Prefer the LBP total built from each line's exact LBP price; fall back to a
  // rate conversion for orders captured before that was tracked.
  const lbp = order.grandTotalLbp ?? (settings?.show_lbp_price !== false
    ? formatLbpGrand(order.grandTotal, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000)
    : null);

  const metaRows = [
    { label: t('receipt.receipt_no'), value: order.receiptNo },
    { label: t('receipt.date'), value: formatDate(order.completedAt) },
    ...(order.orderType === 'dine_in'
      ? [
          { label: t('receipt.table'), value: String(order.tableNumber ?? '') },
          ...(settings?.restaurant_track_guests_per_table
            ? [{ label: t('receipt.guests'), value: String(order.guestCount) }]
            : []),
          { label: t('receipt.seated'), value: formatDate(order.startTime) },
        ]
      : [
          {
            label: t('receipt.order_type'),
            value: `${t(order.orderType === 'delivery' ? 'restaurant_pos.delivery' : 'restaurant_pos.walk_in')} #${order.seq ?? ''}`,
          },
          ...(order.customerName ? [{ label: t('receipt.customer'), value: order.customerName }] : []),
          ...(order.customerPhone ? [{ label: t('receipt.phone'), value: order.customerPhone }] : []),
          ...(order.orderType === 'delivery' && order.deliveryAddress
            ? [{ label: t('receipt.address'), value: order.deliveryAddress }]
            : []),
        ]),
    ...(order.notes?.trim()
      ? [{ label: t('receipt.notes'), value: order.notes.trim() }]
      : []),
  ];

  const lineRows = order.items.map((item) => ({
    description: item.itemName,
    qty: String(item.qty),
    price: formatCurrency(item.price),
    total: formatCurrency(item.price * item.qty),
  }));

  const totalRows: {
    label: string;
    value: string;
    emphasis?: 'normal' | 'strong' | 'strongSub';
  }[] = [{ label: t('receipt.subtotal'), value: formatCurrency(order.subtotal) }];

  if (order.serviceFeeEnabled && order.serviceFeeAmount > 0) {
    totalRows.push({
      label: t('receipt.service_fee', { rate: order.serviceFeeRate }),
      value: formatCurrency(order.serviceFeeAmount),
    });
  }
  if (order.deliveryCharge > 0) {
    totalRows.push({
      label: t('receipt.delivery'),
      value: formatCurrency(order.deliveryCharge),
    });
  }
  if (order.taxAmount > 0) {
    totalRows.push({
      label: t('receipt.tax'),
      value: formatCurrency(order.taxAmount),
    });
  }
  totalRows.push({
    label: t('receipt.net_total'),
    value: formatCurrency(order.grandTotal),
    emphasis: 'strong',
  });
  if (lbp != null) {
    totalRows.push({
      label: t('receipt.net_total_lbp'),
      value: `${formatLbpPlain(lbp)} LBP`,
      emphasis: 'strongSub',
    });
  }

  if (settings?.receipt_template === 'modern') {
    return (
      <div className="bg-white receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 text-black text-xs">
        <ModernReceiptHeader settings={settings} />
        <ModernReceiptMeta rows={metaRows} />
        <ModernReceiptLineTable rows={lineRows} />
        <ModernReceiptTotals rows={totalRows} itemCount={lineRows.length} />
        <ModernReceiptPayments
          payments={[{ method: order.paymentMethod, amount: order.amountGiven }]}
          grandTotal={order.grandTotal}
          formatCurrency={formatCurrency}
        />
        <ModernReceiptQr imageUrl={settings?.receipt_qr_payment_link} />
        <ModernReceiptFooter settings={settings} variant="restaurant" />
      </div>
    );
  }

  return (
    <div className="bg-white receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 text-black text-xs">
      <MinimalReceiptHeader settings={settings} />
      <MinimalReceiptMeta rows={metaRows} />
      <MinimalReceiptLineTable rows={lineRows} />
      <MinimalReceiptTotals rows={totalRows} />
      <MinimalReceiptPayments
        payments={[{ method: order.paymentMethod, amount: order.amountGiven }]}
        grandTotal={order.grandTotal}
        formatCurrency={formatCurrency}
      />
      <MinimalReceiptFooter settings={settings} variant="restaurant" />
    </div>
  );
}

// ─── BillReceipt (print before checkout) ────────────────────────────────────

interface BillReceiptProps {
  data: { order: RestaurantOrder; totals: { subtotal: number; taxAmount: number; serviceFeeAmount: number; deliveryCharge: number; total: number; totalLbp?: number | null } };
  settings: StoreSettings | null;
  formatCurrency: (n: number) => string;
}

function BillReceipt({ data, settings, formatCurrency }: BillReceiptProps) {
  const { t } = useTranslation();
  const { order, totals } = data;
  const lbp = totals.totalLbp ?? (settings?.show_lbp_price !== false
    ? formatLbpGrand(totals.total, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000)
    : null);

  const metaRows = [
    {
      label: t('receipt.bill'),
      value: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    },
    ...(order.orderType === 'dine_in'
      ? [
          { label: t('receipt.table'), value: String(order.tableNumber ?? '') },
          ...(settings?.restaurant_track_guests_per_table
            ? [{ label: t('receipt.guests'), value: String(order.guestCount) }]
            : []),
          {
            label: t('receipt.seated'),
            value: new Date(order.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          },
        ]
      : [
          {
            label: t('receipt.order_type'),
            value: `${t(order.orderType === 'delivery' ? 'restaurant_pos.delivery' : 'restaurant_pos.walk_in')} #${order.seq ?? ''}`,
          },
          ...(order.customerName ? [{ label: t('receipt.customer'), value: order.customerName }] : []),
          ...(order.customerPhone ? [{ label: t('receipt.phone'), value: order.customerPhone }] : []),
          ...(order.orderType === 'delivery' && order.deliveryAddress
            ? [{ label: t('receipt.address'), value: order.deliveryAddress }]
            : []),
        ]),
    ...(order.notes?.trim()
      ? [{ label: t('receipt.notes'), value: order.notes.trim() }]
      : []),
  ];

  const lineRows = order.items.map((item) => ({
    description: item.itemName,
    qty: String(item.qty),
    price: formatCurrency(item.price),
    total: formatCurrency(item.price * item.qty),
  }));

  const totalRows: {
    label: string;
    value: string;
    emphasis?: 'normal' | 'strong' | 'strongSub';
  }[] = [{ label: t('receipt.subtotal'), value: formatCurrency(totals.subtotal) }];

  if (order.serviceFeeEnabled && totals.serviceFeeAmount > 0) {
    totalRows.push({
      label: t('receipt.service_fee', { rate: order.serviceFeeRate }),
      value: formatCurrency(totals.serviceFeeAmount),
    });
  }
  if (totals.deliveryCharge > 0) {
    totalRows.push({
      label: t('receipt.delivery'),
      value: formatCurrency(totals.deliveryCharge),
    });
  }
  if (totals.taxAmount > 0) {
    totalRows.push({
      label: t('receipt.tax'),
      value: formatCurrency(totals.taxAmount),
    });
  }
  totalRows.push({
    label: t('receipt.net_total'),
    value: formatCurrency(totals.total),
    emphasis: 'strong',
  });
  if (lbp != null) {
    totalRows.push({
      label: t('receipt.net_total_lbp'),
      value: `${formatLbpPlain(lbp)} LBP`,
      emphasis: 'strongSub',
    });
  }

  if (settings?.receipt_template === 'modern') {
    return (
      <div className="bg-white receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 text-black text-xs">
        <ModernReceiptHeader settings={settings} />
        <ModernReceiptMeta rows={metaRows} />
        <ModernReceiptLineTable rows={lineRows} />
        <ModernReceiptTotals rows={totalRows} itemCount={lineRows.length} />
        <ModernReceiptFooter settings={settings} variant="restaurant" />
      </div>
    );
  }

  return (
    <div className="bg-white receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 text-black text-xs">
      <MinimalReceiptHeader settings={settings} />
      <MinimalReceiptMeta rows={metaRows} />
      <MinimalReceiptLineTable rows={lineRows} />
      <MinimalReceiptTotals rows={totalRows} />
      <MinimalReceiptFooter settings={settings} variant="restaurant" />
    </div>
  );
}
