import { useCallback, useEffect, useRef, useState } from 'react';
import { CartItem } from '../services/saleService';
import { Customer } from '../services/customerService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalSale {
  id: string;
  items: CartItem[];
  customer: Customer | null;
  discountRate: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;   // ISO timestamp
  status: 'active' | 'held';
}

interface SessionState {
  activeSale: LocalSale | null;
  heldSales: LocalSale[];
}

const STORAGE_KEY = 'pos_sales_sessions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  // Use crypto.randomUUID if available, fallback to timestamp+random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeEmptySale(status: 'active' | 'held' = 'active'): LocalSale {
  return {
    id: generateId(),
    items: [],
    customer: null,
    discountRate: '',
    subtotal: 0,
    tax: 0,
    total: 0,
    createdAt: new Date().toISOString(),
    status,
  };
}

function isValidSale(s: unknown): s is LocalSale {
  if (!s || typeof s !== 'object') return false;
  const sale = s as any;
  return (
    typeof sale.id === 'string' &&
    Array.isArray(sale.items) &&
    typeof sale.createdAt === 'string' &&
    (sale.status === 'active' || sale.status === 'held')
  );
}

function loadFromStorage(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeSale: makeEmptySale(), heldSales: [] };

    const parsed = JSON.parse(raw) as Partial<SessionState>;

    const activeSale =
      parsed.activeSale && isValidSale(parsed.activeSale)
        ? { ...parsed.activeSale, status: 'active' as const }
        : makeEmptySale();

    const heldSales = Array.isArray(parsed.heldSales)
      ? parsed.heldSales
          .filter(isValidSale)
          .map((s) => ({ ...s, status: 'held' as const }))
      : [];

    // Ensure no duplicate IDs
    const seenIds = new Set<string>([activeSale.id]);
    const dedupedHeld = heldSales.filter((s) => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    return { activeSale, heldSales: dedupedHeld };
  } catch {
    return { activeSale: makeEmptySale(), heldSales: [] };
  }
}

function saveToStorage(state: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private browsing — silent fail
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSaleSessionsReturn {
  activeSale: LocalSale | null;
  heldSales: LocalSale[];

  /** Sync live cart/customer/discount state back into activeSale */
  updateActiveSale: (patch: {
    items: CartItem[];
    customer: Customer | null;
    discountRate: string;
    subtotal: number;
    tax: number;
    total: number;
  }) => void;

  /**
   * Hold the current active sale.
   * - Returns false (noop) if cart is empty.
   * - Automatically creates a fresh empty activeSale.
   */
  holdSale: () => boolean;

  /**
   * Resume a held sale by id.
   * - If current active sale has items it is automatically re-held first.
   * - Returns the resumed sale so caller can restore UI state.
   */
  resumeSale: (id: string) => LocalSale | null;

  /** Permanently delete a held sale by id. */
  deleteHeldSale: (id: string) => void;

  /**
   * Call AFTER a successful API completion.
   * Removes the active sale from local state and resets to a fresh sale.
   */
  completeActiveSale: () => void;

  /** Replace the entire active sale (used internally on mount/resume). */
  setActiveSaleDirectly: (sale: LocalSale) => void;
}

export function useSaleSessions(): UseSaleSessionsReturn {
  const [state, setStateRaw] = useState<SessionState>(() => loadFromStorage());

  // Keep a ref so callbacks close over the latest state without stale closures
  const stateRef = useRef(state);

  const setState = useCallback((updater: SessionState | ((prev: SessionState) => SessionState)) => {
    setStateRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      stateRef.current = next;
      saveToStorage(next);
      return next;
    });
  }, []);

  // On mount: load from storage (already done in useState initialiser above)
  useEffect(() => {
    // Re-sync the ref on first render
    stateRef.current = state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── updateActiveSale ──────────────────────────────────────────────────────
  const updateActiveSale = useCallback(
    (patch: {
      items: CartItem[];
      customer: Customer | null;
      discountRate: string;
      subtotal: number;
      tax: number;
      total: number;
    }) => {
      setState((prev) => {
        if (!prev.activeSale) return prev;
        return {
          ...prev,
          activeSale: { ...prev.activeSale, ...patch },
        };
      });
    },
    [setState]
  );

  // ── holdSale ─────────────────────────────────────────────────────────────
  const holdSale = useCallback((): boolean => {
    const current = stateRef.current;
    if (!current.activeSale || current.activeSale.items.length === 0) {
      return false; // Nothing to hold
    }

    const held: LocalSale = { ...current.activeSale, status: 'held' };
    const freshActive = makeEmptySale('active');

    setState((prev) => ({
      activeSale: freshActive,
      heldSales: [...prev.heldSales, held],
    }));

    return true;
  }, [setState]);

  // ── resumeSale ────────────────────────────────────────────────────────────
  const resumeSale = useCallback(
    (id: string): LocalSale | null => {
      const current = stateRef.current;
      const target = current.heldSales.find((s) => s.id === id);
      if (!target) return null;

      // Auto-hold the current active sale if it has items
      const newHeld = current.heldSales.filter((s) => s.id !== id);
      if (
        current.activeSale &&
        current.activeSale.items.length > 0
      ) {
        newHeld.push({ ...current.activeSale, status: 'held' });
      }

      const resumed: LocalSale = { ...target, status: 'active' };

      setState({
        activeSale: resumed,
        heldSales: newHeld,
      });

      return resumed;
    },
    [setState]
  );

  // ── deleteHeldSale ────────────────────────────────────────────────────────
  const deleteHeldSale = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        heldSales: prev.heldSales.filter((s) => s.id !== id),
      }));
    },
    [setState]
  );

  // ── completeActiveSale ────────────────────────────────────────────────────
  const completeActiveSale = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeSale: makeEmptySale('active'),
    }));
  }, [setState]);

  // ── setActiveSaleDirectly ─────────────────────────────────────────────────
  const setActiveSaleDirectly = useCallback(
    (sale: LocalSale) => {
      setState((prev) => ({ ...prev, activeSale: sale }));
    },
    [setState]
  );

  return {
    activeSale: state.activeSale,
    heldSales: state.heldSales,
    updateActiveSale,
    holdSale,
    resumeSale,
    deleteHeldSale,
    completeActiveSale,
    setActiveSaleDirectly,
  };
}
