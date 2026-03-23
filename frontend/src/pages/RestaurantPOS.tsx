import { useState, useEffect, useMemo } from 'react';
import { storeService } from '../services/storeService';
import type { StoreSettings } from '../services/storeService';
import { menuService } from '../services/adminService';
import type { Menu } from '../services/adminService';
import { saleService } from '../services/saleService';
import { useAuthStore } from '../store/authStore';
import { gradients, fonts } from '../styles/tokens';
import { receiptHeaderStoreName } from '../constants/branding';
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
  CheckIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  menuName: string;
  categoryName: string;
  itemName: string;
  price: number;
  qty: number;
  productId?: string;
}

type TableStatus = 'available' | 'occupied' | 'bill_requested';

interface TableOrder {
  tableNumber: number;
  guestCount: number;
  startTime: string;
  items: OrderItem[];
  status: 'occupied' | 'bill_requested';
  waiterName?: string;
  serviceFeeEnabled: boolean;
  serviceFeeRate: number;       // percentage, e.g. 10 = 10%
}

interface CompletedOrder {
  tableNumber: number;
  guestCount: number;
  startTime: string;
  items: OrderItem[];
  paymentMethod: 'cash' | 'card' | 'other';
  amountGiven: number;
  grandTotal: number;
  subtotal: number;
  taxAmount: number;
  serviceFeeAmount: number;
  serviceFeeRate: number;
  serviceFeeEnabled: boolean;
  change: number;
  completedAt: string;
  receiptNo: string;
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
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);

  const [tableOrders, setTableOrders] = useState<Record<string, TableOrder>>({});
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [activeMenuIdx, setActiveMenuIdx] = useState(0);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatTableNum, setSeatTableNum] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(2);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [billPrintOrder, setBillPrintOrder] = useState<{
    order: TableOrder;
    totals: { subtotal: number; taxAmount: number; serviceFeeAmount: number; total: number };
  } | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Load settings
  useEffect(() => {
    storeService.getDefaultStore()
      .then(s => { setSettings(s); setIsLoading(false); })
      .catch(() => { setLoadError('Failed to load store settings'); setIsLoading(false); });
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
        setMenuLoadError('Failed to load menus from Admin. Please try again.');
      });
  }, [settings?.store_id]);

  // Restore from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTableOrders(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tableOrders));
  }, [tableOrders]);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Derived
  const tableCount = Math.max(1, settings?.restaurant_table_count || 10);
  const tableNumbers = Array.from({ length: tableCount }, (_, i) => i + 1);

  const getTableStatus = (n: number): TableStatus => tableOrders[n]?.status ?? 'available';
  const getOrder = (n: number): TableOrder | null => tableOrders[n] ?? null;

  const availableCount = tableNumbers.filter(n => getTableStatus(n) === 'available').length;
  const occupiedCount  = tableNumbers.filter(n => getTableStatus(n) === 'occupied').length;
  const billCount      = tableNumbers.filter(n => getTableStatus(n) === 'bill_requested').length;

  const computeTotals = (order: TableOrder) => {
    const subtotal         = order.items.reduce((s, i) => s + i.price * i.qty, 0);
    const taxRate          = settings?.tax_rate ?? 0;
    const taxAmount        = (settings?.tax_inclusive || !taxRate) ? 0 : subtotal * (taxRate / 100);
    const sfRate           = order.serviceFeeEnabled ? (order.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE) : 0;
    const serviceFeeAmount = order.serviceFeeEnabled ? subtotal * (sfRate / 100) : 0;
    return { subtotal, taxAmount, serviceFeeAmount, total: subtotal + taxAmount + serviceFeeAmount, taxRate };
  };

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency_code || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  // ── Items to display in the menu grid
  const itemsToDisplay = useMemo(() => {
    type DisplayItem = {
      item: { name: string; price: number; product_id?: string };
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
    const cat  = menu?.categories[activeMenuIdx === 0 ? activeCategoryIdx : activeCategoryIdx];
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
    if (!selectedTable) return 0;
    return getOrder(selectedTable)?.items.find(
      i => i.itemName === itemName && i.menuName === menuName && i.categoryName === categoryName
    )?.qty ?? 0;
  };

  // ── Handlers
  const handleTableClick = (n: number) => {
    if (getTableStatus(n) === 'available') {
      setSeatTableNum(n); setGuestCount(2); setShowSeatModal(true);
    } else {
      setSelectedTable(n); setActiveMenuIdx(0); setActiveCategoryIdx(0); setMenuSearchQuery('');
    }
  };

  const confirmSeat = () => {
    if (!seatTableNum) return;
    setTableOrders(prev => ({
      ...prev,
      [seatTableNum]: {
        tableNumber: seatTableNum,
        guestCount,
        startTime: new Date().toISOString(),
        items: [],
        status: 'occupied',
        waiterName: user?.fullName,
        serviceFeeEnabled: false,
        serviceFeeRate: DEFAULT_SERVICE_FEE_RATE,
      },
    }));
    setSelectedTable(seatTableNum);
    setMenuSearchQuery('');
    setShowSeatModal(false);
    setSeatTableNum(null);
  };

  const addMenuItem = (item: { name: string; price: number; product_id?: string }, menuName: string, categoryName: string) => {
    if (!selectedTable) return;
    setTableOrders(prev => {
      const order = prev[selectedTable];
      if (!order) return prev;
      const existingIdx = order.items.findIndex(
        i => i.itemName === item.name && i.menuName === menuName && i.categoryName === categoryName
      );
      const newItems = existingIdx >= 0
        ? order.items.map((i, idx) => idx === existingIdx ? { ...i, qty: i.qty + 1 } : i)
        : [
            ...order.items,
            {
              id: generateId(),
              menuName,
              categoryName,
              itemName: item.name,
              price: item.price,
              qty: 1,
              productId: item.product_id,
            },
          ];
      return { ...prev, [selectedTable]: { ...order, items: newItems } };
    });
  };

  const updateItemQty = (itemId: string, delta: number) => {
    if (!selectedTable) return;
    setTableOrders(prev => {
      const order = prev[selectedTable];
      if (!order) return prev;
      const newItems = order.items
        .map(i => i.id === itemId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0);
      return { ...prev, [selectedTable]: { ...order, items: newItems } };
    });
  };

  const removeItem = (itemId: string) => {
    if (!selectedTable) return;
    setTableOrders(prev => {
      const order = prev[selectedTable];
      if (!order) return prev;
      return { ...prev, [selectedTable]: { ...order, items: order.items.filter(i => i.id !== itemId) } };
    });
  };

  const toggleServiceFee = () => {
    if (!selectedTable) return;
    setTableOrders(prev => {
      const order = prev[selectedTable];
      if (!order) return prev;
      return { ...prev, [selectedTable]: { ...order, serviceFeeEnabled: !order.serviceFeeEnabled } };
    });
  };

  const updateServiceFeeRate = (rate: number) => {
    if (!selectedTable) return;
    const clamped = Math.max(0, Math.min(100, rate));
    setTableOrders(prev => {
      const order = prev[selectedTable];
      if (!order) return prev;
      return { ...prev, [selectedTable]: { ...order, serviceFeeRate: clamped } };
    });
  };

  const handlePrintBill = () => {
    if (!selectedTable) return;
    const order = getOrder(selectedTable);
    if (!order) return;
    const updated = { ...order, status: 'bill_requested' as const };
    setTableOrders(prev => ({ ...prev, [selectedTable]: updated }));
    const { subtotal, taxAmount, serviceFeeAmount, total } = computeTotals(updated);
    setBillPrintOrder({ order: updated, totals: { subtotal, taxAmount, serviceFeeAmount, total } });
    setTimeout(() => window.print(), 100);
  };

  const handleCheckout = () => {
    if (!selectedTable) return;
    const order = getOrder(selectedTable);
    if (!order || order.items.length === 0) return;
    const { total } = computeTotals(order);
    setCashGiven(total.toFixed(2));
    setPaymentMethod('cash');
    setCheckoutError(null);
    setShowCheckoutModal(true);
  };

  const resolveProductIdForOrderItem = async (orderItem: OrderItem): Promise<string> => {
    if (orderItem.productId) {
      return orderItem.productId;
    }
    throw new Error(
      `Menu item "${orderItem.itemName}" is missing a linked product. Edit this menu item in Admin -> Menus and select a product.`
    );
  };

  const confirmCheckout = async () => {
    if (!selectedTable) return;
    const order = getOrder(selectedTable);
    if (!order) return;
    setCheckoutError(null);
    setIsSubmittingCheckout(true);

    const { subtotal, taxAmount, serviceFeeAmount, total } = computeTotals(order);
    const given = paymentMethod === 'cash' ? (parseFloat(cashGiven) || total) : total;

    try {
      const saleItems = [];
      for (const orderItem of order.items) {
        const productId = await resolveProductIdForOrderItem(orderItem);
        saleItems.push({
          product_id: productId,
          qty: orderItem.qty,
          unit_price: orderItem.price,
          tax_rate: settings?.tax_rate ?? 0,
        });
      }

      const checkoutAt = new Date().toISOString();
      const sale = await saleService.createSale({
        items: saleItems,
        payments: [
          {
            method: paymentMethod,
            amount: given,
          },
        ],
        restaurant_context: {
          table_number: selectedTable,
          guest_count: order.guestCount,
          waiter_name: order.waiterName,
          seated_at: order.startTime,
          checkout_at: checkoutAt,
          service_fee_enabled: order.serviceFeeEnabled,
          service_fee_rate: order.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE,
          service_fee_amount: serviceFeeAmount,
          subtotal_before_service: subtotal,
        },
      });

      const completed: CompletedOrder = {
        tableNumber: selectedTable,
        guestCount: order.guestCount,
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
        completedAt: sale.created_at || checkoutAt,
        receiptNo: sale.receipt_no,
      };

      setCompletedOrder(completed);
      setTableOrders(prev => { const n = { ...prev }; delete n[selectedTable]; return n; });
      setSelectedTable(null);
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

  const selectedOrder  = selectedTable ? getOrder(selectedTable) : null;
  const selectedTotals = selectedOrder ? computeTotals(selectedOrder) : null;

  // ── Loading / error states
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-secondary-200 border-t-secondary-600 mb-3" />
        <p className="text-gray-500 text-sm">Loading restaurant...</p>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{loadError}</p>
      </div>
    </div>
  );

  const inOrderView = !!(selectedTable && selectedOrder && selectedTotals);

  // ── Render
  return (
    <>
      <div
        className="flex flex-col -mx-4 -my-6 sm:-mx-6 lg:-mx-8 overflow-hidden print:hidden"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        {/* ══════════════════════ HEADER ══════════════════════ */}
        {inOrderView ? (
          // Order-view header
          <div
            style={{ background: gradients.brandBlue }}
            className="text-white px-5 py-3 flex items-center justify-between flex-shrink-0"
          >
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => { setSelectedTable(null); setMenuSearchQuery(''); }}
                className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm font-medium flex-shrink-0"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Tables</span>
              </button>
              <div className="w-px h-6 bg-white/20 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-extrabold text-lg leading-tight">Table {selectedTable}</div>
                <div className="flex items-center gap-2 text-blue-200 text-xs mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <UsersIcon className="w-3.5 h-3.5" />
                    {selectedOrder!.guestCount} guest{selectedOrder!.guestCount !== 1 ? 's' : ''}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDuration(selectedOrder!.startTime)}
                  </span>
                  {selectedOrder!.status === 'bill_requested' && (
                    <><span>·</span><span className="text-amber-300 font-semibold animate-pulse">● Bill Out</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <div className="text-2xl font-extrabold tabular-nums">{formatCurrency(selectedTotals!.total)}</div>
              <div className="text-blue-200 text-xs">
                {selectedOrder!.items.reduce((s, i) => s + i.qty, 0)} item{selectedOrder!.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ) : (
          // Table-grid header
          <div
            style={{ background: gradients.brand }}
            className="text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0"
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
                { label: 'Available', value: availableCount, color: 'text-emerald-300' },
                { label: 'Occupied',  value: occupiedCount,  color: 'text-blue-200'   },
                { label: 'Bill Req.', value: billCount,      color: 'text-amber-300'  },
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
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Menu</p>
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
                    placeholder="Search items across all menus…"
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
                    <><span className="font-semibold text-gray-600">{itemsToDisplay.length}</span> result{itemsToDisplay.length !== 1 ? 's' : ''} for "<span className="text-gray-700">{menuSearchQuery}</span>"</>
                  ) : (
                    <><span className="text-gray-500 font-medium">{menus[activeMenuIdx]?.name}</span> › <span className="font-semibold text-gray-700">{menus[activeMenuIdx]?.categories[activeCategoryIdx]?.name}</span> <span className="text-gray-300">·</span> {menus[activeMenuIdx]?.categories[activeCategoryIdx]?.items.length ?? 0} items</>
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
                        <p className="text-sm font-semibold">No items found for "{menuSearchQuery}"</p>
                        <p className="text-xs mt-1 text-gray-300">Try a different search term</p>
                      </>
                    ) : (
                      <>
                        <DocumentTextIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-sm font-semibold">No items in this category</p>
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
                          <div className={`font-semibold text-sm leading-snug mb-3 line-clamp-2 ${inOrder ? 'text-secondary-700' : 'text-gray-800 group-hover:text-secondary-700'}`}>
                            {item.name}
                          </div>
                          <div className="flex items-end justify-between">
                            <div className={`font-extrabold text-sm ${inOrder ? 'text-secondary-600' : 'text-secondary-600'}`}>
                              {formatCurrency(item.price)}
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
            <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 shadow-xl overflow-hidden">

              {/* Cart header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
                <span className="font-bold text-gray-700 text-sm">Order</span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {selectedOrder!.items.reduce((s, i) => s + i.qty, 0)} item{selectedOrder!.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto">
                {selectedOrder!.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300 p-6 text-center">
                    <DocumentTextIcon className="w-10 h-10 mb-2" />
                    <p className="text-sm font-medium text-gray-400">Order is empty</p>
                    <p className="text-xs mt-1 text-gray-300">Tap items from the menu to add them</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {selectedOrder!.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-3 hover:bg-gray-50 group transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 text-xs leading-tight">{item.itemName}</div>
                          <div className="text-[11px] text-gray-400 truncate mt-0.5">{item.categoryName}</div>
                        </div>
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
                        <div className="text-xs font-bold text-gray-700 w-14 text-right flex-shrink-0 tabular-nums">
                          {formatCurrency(item.price * item.qty)}
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals + Action buttons */}
              <div className="border-t border-gray-200 flex-shrink-0">

                {/* ── Service Fee Toggle ── */}
                <div className="px-4 py-3 bg-white border-b border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Toggle switch */}
                      <button
                        onClick={toggleServiceFee}
                        role="switch"
                        aria-checked={selectedOrder!.serviceFeeEnabled}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                          selectedOrder!.serviceFeeEnabled ? 'bg-secondary-500' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          selectedOrder!.serviceFeeEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className={`text-sm font-semibold truncate ${selectedOrder!.serviceFeeEnabled ? 'text-gray-800' : 'text-gray-400'}`}>
                        Service Fee
                      </span>
                    </div>
                    {/* Rate input */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        value={selectedOrder!.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE}
                        onChange={e => updateServiceFeeRate(parseFloat(e.target.value) || 0)}
                        disabled={!selectedOrder!.serviceFeeEnabled}
                        className="w-14 text-right text-sm font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-secondary-400 disabled:opacity-30 disabled:bg-gray-50 bg-white transition-colors tabular-nums"
                        min="0" max="100" step="0.5"
                      />
                      <span className={`text-sm font-semibold ${selectedOrder!.serviceFeeEnabled ? 'text-gray-500' : 'text-gray-300'}`}>%</span>
                    </div>
                  </div>
                  {selectedOrder!.serviceFeeEnabled && selectedTotals!.serviceFeeAmount > 0 && (
                    <div className="flex justify-between text-xs text-secondary-600 mt-2 pl-[52px]">
                      <span>+{selectedOrder!.serviceFeeRate}% on subtotal</span>
                      <span className="font-bold tabular-nums">{formatCurrency(selectedTotals!.serviceFeeAmount)}</span>
                    </div>
                  )}
                </div>

                {/* ── Totals ── */}
                {selectedOrder!.items.length > 0 && (
                  <div className="px-4 pt-3 pb-2 space-y-1.5 text-sm bg-gray-50">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.subtotal)}</span>
                    </div>
                    {selectedOrder!.serviceFeeEnabled && selectedTotals!.serviceFeeAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Service Fee ({selectedOrder!.serviceFeeRate}%)</span>
                        <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.serviceFeeAmount)}</span>
                      </div>
                    )}
                    {selectedTotals!.taxAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Tax ({settings?.tax_rate}%)</span>
                        <span className="font-medium tabular-nums">{formatCurrency(selectedTotals!.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-gray-900 text-base pt-1.5 border-t border-gray-200">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCurrency(selectedTotals!.total)}</span>
                    </div>
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <button
                    onClick={handlePrintBill}
                    disabled={selectedOrder!.items.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-amber-400 text-amber-600 font-semibold text-sm hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    {selectedOrder!.status === 'bill_requested' ? 'Reprint Bill' : 'Print Bill'}
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={selectedOrder!.items.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Checkout
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
                {menuLoadError}
              </div>
            )}
            {menus.length === 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                No menus configured. Go to Admin → Menus to add menus.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {tableNumbers.map(num => {
                const status = getTableStatus(num);
                const order  = getOrder(num);
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
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Table</div>
                    {status === 'available' ? (
                      <div className="text-xs text-emerald-600 font-semibold">Available</div>
                    ) : order ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <UsersIcon className="w-3 h-3" />
                          <span>{order.guestCount} guest{order.guestCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <ClockIcon className="w-3 h-3" />
                          <span>{formatDuration(order.startTime)}</span>
                        </div>
                        {totals && (
                          <div className={`text-sm font-extrabold mt-1 tabular-nums ${
                            status === 'bill_requested' ? 'text-amber-600' : 'text-secondary-600'
                          }`}>
                            {formatCurrency(totals.total)}
                          </div>
                        )}
                        {status === 'bill_requested' && (
                          <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Bill Requested</div>
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
                <h2 className="text-lg font-bold text-gray-900">Seat Guests — Table {seatTableNum}</h2>
                <button onClick={() => setShowSeatModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-500 text-sm text-center mb-4">How many guests?</p>
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
                Seat {guestCount} Guest{guestCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Checkout */}
        {showCheckoutModal && selectedOrder && selectedTotals && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Checkout — Table {selectedTable}</h2>
                <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Order summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm max-h-48 overflow-y-auto">
                  {selectedOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600 truncate pr-2">{item.qty}× {item.itemName}</span>
                      <span className="font-medium text-gray-800 tabular-nums flex-shrink-0">{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(selectedTotals.total)}</span>
                  </div>
                </div>
                {/* Payment method */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'cash',  label: 'Cash',  icon: BanknotesIcon   },
                      { value: 'card',  label: 'Card',  icon: CreditCardIcon  },
                      { value: 'other', label: 'Other', icon: DocumentTextIcon },
                    ] as const).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentMethod(value)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                          paymentMethod === value
                            ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Cash amount */}
                {paymentMethod === 'cash' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount Given</label>
                    <input
                      type="number"
                      value={cashGiven}
                      onChange={e => setCashGiven(e.target.value)}
                      className="w-full text-right text-2xl font-extrabold px-4 py-3 border-2 border-gray-200 focus:border-secondary-400 rounded-xl outline-none transition-colors tabular-nums"
                      min="0"
                      step="0.01"
                    />
                    {parseFloat(cashGiven) >= selectedTotals.total && (
                      <div className="mt-2 flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <span className="text-emerald-700 font-medium">Change Due</span>
                        <span className="text-emerald-700 font-extrabold tabular-nums">
                          {formatCurrency(Math.max(0, parseFloat(cashGiven) - selectedTotals.total))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {checkoutError && (
                  <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
                    {checkoutError}
                  </div>
                )}
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCheckout}
                  disabled={
                    isSubmittingCheckout ||
                    (paymentMethod === 'cash' && parseFloat(cashGiven) < selectedTotals.total)
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <CheckCircleIconSolid className="w-5 h-5" />
                  {isSubmittingCheckout ? 'Processing...' : 'Complete & Checkout'}
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
                  <h2 className="text-lg font-bold text-gray-900">Checkout Complete!</h2>
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
                  Print Receipt
                </button>
                <button
                  onClick={() => { setShowReceipt(false); setCompletedOrder(null); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Close
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
  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium', timeStyle: 'short',
        timeZone: settings?.timezone || 'UTC',
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString();
    }
  };

  return (
    <div className="bg-white max-w-sm mx-auto p-8 font-mono text-sm">
      <div className="text-center mb-6 pb-4 border-b-2 border-black">
        <div className="w-16 h-1 bg-secondary-500 rounded-full mx-auto mb-4" />
        {settings?.receipt_header ? (
          <div className="text-sm text-black whitespace-pre-line">{settings.receipt_header}</div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-black tracking-tight">{receiptHeaderStoreName(settings?.name)}</h1>
            {settings?.address && <p className="text-xs text-black mt-1">{settings.address}</p>}
          </>
        )}
      </div>
      <div className="mb-4 space-y-1 text-xs border border-black rounded p-3">
        <div className="flex justify-between"><span className="text-black">Receipt #</span><span className="font-bold text-black font-mono">{order.receiptNo}</span></div>
        <div className="flex justify-between"><span className="text-black">Date</span><span className="font-semibold text-black">{formatDate(order.completedAt)}</span></div>
        <div className="flex justify-between"><span className="text-black">Table</span><span className="font-bold text-black">Table {order.tableNumber}</span></div>
        <div className="flex justify-between"><span className="text-black">Guests</span><span className="text-black">{order.guestCount}</span></div>
        <div className="flex justify-between"><span className="text-black">Seated</span><span className="text-black">{formatDate(order.startTime)}</span></div>
      </div>
      <div className="mb-4 border-t-2 border-b-2 border-black py-3 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-black text-xs">{item.itemName}</div>
              <div className="text-[10px] text-black">{item.qty} × {formatCurrency(item.price)}</div>
            </div>
            <div className="font-bold text-black text-xs whitespace-nowrap">{formatCurrency(item.price * item.qty)}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 border-2 border-black rounded p-3 space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-black">Subtotal</span><span className="font-semibold text-black">{formatCurrency(order.subtotal)}</span></div>
        {order.serviceFeeEnabled && order.serviceFeeAmount > 0 && (
          <div className="flex justify-between"><span className="text-black">Service Fee ({order.serviceFeeRate}%)</span><span className="font-semibold text-black">{formatCurrency(order.serviceFeeAmount)}</span></div>
        )}
        {order.taxAmount > 0 && <div className="flex justify-between"><span className="text-black">Tax</span><span className="font-semibold text-black">{formatCurrency(order.taxAmount)}</span></div>}
        <div className="flex justify-between border-t border-black pt-1.5 font-extrabold text-sm">
          <span className="text-black">TOTAL</span><span className="text-black">{formatCurrency(order.grandTotal)}</span>
        </div>
      </div>
      <div className="mb-4 border border-black rounded p-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-black capitalize">{order.paymentMethod} Payment</span>
          <span className="font-bold text-black">{formatCurrency(order.amountGiven)}</span>
        </div>
        {order.change > 0 && (
          <div className="flex justify-between border-t border-black pt-1">
            <span className="font-bold text-black">Change</span>
            <span className="font-extrabold text-black">{formatCurrency(order.change)}</span>
          </div>
        )}
      </div>
      <div className="text-center border-t-2 border-black pt-4 space-y-2">
        {settings?.receipt_footer ? (
          <div className="text-xs text-black whitespace-pre-line">{settings.receipt_footer}</div>
        ) : (
          <>
            <p className="font-bold text-black text-sm">Thank you for dining with us!</p>
            <p className="text-xs text-black">We hope to see you again soon.</p>
          </>
        )}
        <div className="mt-4 pt-3 border-t border-black">
          <img
            src="/cubiq-logo.jpg"
            alt="Cubiq Solutions"
            className="h-12 w-auto mx-auto object-contain opacity-90"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-[10px] text-black mt-1">www.cubiq-solutions.com</p>
        </div>
      </div>
    </div>
  );
}

// ─── BillReceipt (print before checkout) ────────────────────────────────────

interface BillReceiptProps {
  data: { order: TableOrder; totals: { subtotal: number; taxAmount: number; serviceFeeAmount: number; total: number } };
  settings: StoreSettings | null;
  formatCurrency: (n: number) => string;
}

function BillReceipt({ data, settings, formatCurrency }: BillReceiptProps) {
  const { order, totals } = data;
  return (
    <div className="bg-white max-w-sm mx-auto p-8 font-mono text-sm">
      <div className="text-center mb-6 pb-4 border-b-2 border-black">
        <div className="w-16 h-1 bg-secondary-500 rounded-full mx-auto mb-4" />
        {settings?.receipt_header ? (
          <div className="text-sm text-black whitespace-pre-line">{settings.receipt_header}</div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-black">{receiptHeaderStoreName(settings?.name)}</h1>
            {settings?.address && <p className="text-xs text-black mt-1">{settings.address}</p>}
          </>
        )}
      </div>
      <div className="mb-4 space-y-1 text-xs border border-black rounded p-3">
        <div className="flex justify-between"><span className="text-black font-bold">** BILL **</span><span className="text-black">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>
        <div className="flex justify-between"><span className="text-black">Table</span><span className="font-bold text-black">Table {order.tableNumber}</span></div>
        <div className="flex justify-between"><span className="text-black">Guests</span><span className="text-black">{order.guestCount}</span></div>
        <div className="flex justify-between"><span className="text-black">Seated</span><span className="text-black">{new Date(order.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>
      </div>
      <div className="mb-4 border-t-2 border-b-2 border-black py-3 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <div className="font-bold text-black text-xs">{item.itemName}</div>
              <div className="text-[10px] text-black">{item.qty} × {formatCurrency(item.price)}</div>
            </div>
            <div className="font-bold text-black text-xs">{formatCurrency(item.price * item.qty)}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 border-2 border-black rounded p-3 space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-black">Subtotal</span><span className="font-semibold text-black">{formatCurrency(totals.subtotal)}</span></div>
        {order.serviceFeeEnabled && totals.serviceFeeAmount > 0 && (
          <div className="flex justify-between"><span className="text-black">Service Fee ({order.serviceFeeRate}%)</span><span className="font-semibold text-black">{formatCurrency(totals.serviceFeeAmount)}</span></div>
        )}
        {totals.taxAmount > 0 && <div className="flex justify-between"><span className="text-black">Tax</span><span className="font-semibold text-black">{formatCurrency(totals.taxAmount)}</span></div>}
        <div className="flex justify-between border-t border-black pt-1.5 font-extrabold text-sm">
          <span className="text-black">TOTAL</span><span className="text-black">{formatCurrency(totals.total)}</span>
        </div>
      </div>
      <div className="text-center border-t-2 border-black pt-4">
        {settings?.receipt_footer ? (
          <div className="text-xs text-black whitespace-pre-line">{settings.receipt_footer}</div>
        ) : (
          <p className="font-bold text-black text-sm">Thank you for dining with us!</p>
        )}
      </div>
    </div>
  );
}
