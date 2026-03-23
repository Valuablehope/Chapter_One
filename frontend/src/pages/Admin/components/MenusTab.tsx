import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { menuService, adminService, Menu, MenuType, Store } from '../../../services/adminService';
import { MenuModal } from './MenuModal';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import Card from '../../../components/ui/Card';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// ── helpers ────────────────────────────────────────────────────────────────
const MENU_TYPE_META: Record<MenuType, { label: string; emoji: string; badgeClass: string }> = {
  regular:  { label: 'Regular',  emoji: '🍽️', badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200' },
  holiday:  { label: 'Holiday',  emoji: '🎄', badgeClass: 'bg-red-100 text-red-800 border border-red-200' },
  seasonal: { label: 'Seasonal', emoji: '🌸', badgeClass: 'bg-green-100 text-green-800 border border-green-200' },
  event:    { label: 'Event',    emoji: '🎉', badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200' },
  special:  { label: 'Special',  emoji: '⭐', badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200' },
};

function MenuTypePill({ type }: { type: MenuType }) {
  const meta = MENU_TYPE_META[type] ?? MENU_TYPE_META.regular;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeClass}`}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

function itemCount(menu: Menu): number {
  return menu.categories.reduce((s, c) => s + c.items.length, 0);
}

// ── Menu Card ──────────────────────────────────────────────────────────────
interface MenuCardProps {
  menu: Menu;
  onEdit: (m: Menu) => void;
  onDelete: (m: Menu) => void;
  onToggleActive: (m: Menu) => void;
  toggling: boolean;
}

function MenuCard({ menu, onEdit, onDelete, onToggleActive, toggling }: MenuCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalItems = itemCount(menu);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 shadow-sm transition-all duration-200
        bg-white group overflow-hidden
        ${menu.is_active
          ? 'border-gray-100 hover:border-secondary-200 hover:shadow-md'
          : 'border-dashed border-gray-200 opacity-70 hover:opacity-90'
        }`}
    >
      {/* Active ribbon */}
      {menu.is_active && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-t-2xl" />
      )}

      <div className="p-4 pt-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0
            ${menu.is_active ? 'bg-secondary-50' : 'bg-gray-100'}`}>
            {MENU_TYPE_META[menu.menu_type]?.emoji ?? '🍽️'}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{menu.name}</h3>
            {menu.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{menu.description}</p>
            )}
          </div>

          {/* Active badge */}
          <Badge variant={menu.is_active ? 'success' : 'error'} size="sm" className="flex-shrink-0">
            {menu.is_active
              ? <><CheckCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />Active</>
              : <><XCircleIcon className="w-2.5 h-2.5 inline mr-0.5" />Inactive</>
            }
          </Badge>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <MenuTypePill type={menu.menu_type} />
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500 font-medium">
            {menu.categories.length} {menu.categories.length === 1 ? 'category' : 'categories'}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500 font-medium">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </span>
          {menu.display_order > 0 && (
            <>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">Order #{menu.display_order}</span>
            </>
          )}
        </div>

        {/* Preview toggle */}
        {menu.categories.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(x => !x)}
            className="flex items-center gap-1 text-xs text-secondary-600 hover:text-secondary-700 font-semibold transition-colors mb-3"
          >
            <EyeIcon className="w-3.5 h-3.5" />
            {expanded ? 'Hide preview' : 'Preview'}
          </button>
        )}

        {/* Category/item preview */}
        {expanded && (
          <div className="mb-3 space-y-2">
            {menu.categories.map((cat, ci) => (
              <div key={ci} className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  {cat.name}
                </p>
                <div className="space-y-1">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 truncate">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-800 flex-shrink-0">
                        {item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
          {/* Toggle active */}
          <button
            type="button"
            onClick={() => onToggleActive(menu)}
            disabled={toggling}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold
              transition-all border
              ${menu.is_active
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50`}
          >
            {menu.is_active
              ? <><XCircleIcon className="w-3.5 h-3.5" />Deactivate</>
              : <><CheckCircleIcon className="w-3.5 h-3.5" />Activate</>
            }
          </button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<PencilIcon className="w-3.5 h-3.5" />}
            onClick={() => onEdit(menu)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            leftIcon={<TrashIcon className="w-3.5 h-3.5" />}
            onClick={() => onDelete(menu)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MenusTab ───────────────────────────────────────────────────────────────
export default function MenusTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MenuType | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const restaurantStores = stores.filter((s) => s.pos_module_type === 'restaurant');
  const selectedRestaurantStore = restaurantStores.find((s) => s.store_id === selectedStoreId) || null;

  // load stores for selector
  useEffect(() => {
    adminService.getStores({ limit: 100 }).then(r => {
      setStores(r.data);
      const firstRestaurantStore = r.data.find((s) => s.pos_module_type === 'restaurant');
      if (firstRestaurantStore) {
        setSelectedStoreId(firstRestaurantStore.store_id);
      } else {
        setSelectedStoreId('');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (restaurantStores.length === 0) {
      if (selectedStoreId) setSelectedStoreId('');
      return;
    }
    const selectedIsRestaurant = restaurantStores.some((s) => s.store_id === selectedStoreId);
    if (!selectedIsRestaurant) {
      setSelectedStoreId(restaurantStores[0].store_id);
    }
  }, [restaurantStores, selectedStoreId]);

  const loadMenus = useCallback(async () => {
    if (!selectedRestaurantStore) {
      setMenus([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const filters: Parameters<typeof menuService.getMenus>[0] = {
        store_id: selectedRestaurantStore.store_id,
        page,
        limit: LIMIT,
      };
      if (search) filters.search = search;
      if (typeFilter) filters.menu_type = typeFilter;
      if (activeFilter === 'active') filters.is_active = true;
      if (activeFilter === 'inactive') filters.is_active = false;
      const res = await menuService.getMenus(filters);
      setMenus(res.data);
      setTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load menus');
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurantStore, search, typeFilter, activeFilter, page]);

  useEffect(() => { loadMenus(); }, [loadMenus]);

  const debouncedSearch = useDebouncedCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, 300);

  const handleToggleActive = async (menu: Menu) => {
    setTogglingId(menu.menu_id);
    try {
      await menuService.updateMenu(menu.menu_id, { is_active: !menu.is_active });
      toast.success(menu.is_active ? 'Menu deactivated' : 'Menu activated');
      loadMenus();
    } catch {
      toast.error('Failed to update menu');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (menu: Menu) => {
    if (!window.confirm(`Delete "${menu.name}"? This action cannot be undone.`)) return;
    try {
      await menuService.deleteMenu(menu.menu_id);
      toast.success('Menu deleted');
      loadMenus();
    } catch {
      toast.error('Failed to delete menu');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const activeCount = menus.filter(m => m.is_active).length;

  return (
    <div className="p-3 space-y-3">

      {/* ── Controls bar ── */}
      <Card className="border-2 border-gray-100 shadow-md">
        <div className="p-3 space-y-3">
          {/* Row 1: store selector + add button */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-3 w-full sm:w-auto flex-wrap">

              {/* Store selector */}
              <div className="relative min-w-[180px] flex-1 sm:flex-none">
                <BuildingStorefrontIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedStoreId}
                  onChange={e => { setSelectedStoreId(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 appearance-none bg-white font-medium"
                >
                  <option value="">Select store…</option>
                  {restaurantStores.map(s => (
                    <option key={s.store_id} value={s.store_id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search menus…"
                  defaultValue={search}
                  onChange={e => debouncedSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 bg-white font-medium"
                />
              </div>
            </div>

            <Button
              onClick={() => { setEditingMenu(null); setShowModal(true); }}
              size="sm"
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              disabled={!selectedRestaurantStore}
            >
              Add Menu
            </Button>
          </div>

          {/* Row 2: filters + stats */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter */}
            <div className="relative">
              <FunnelIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value as MenuType | ''); setPage(1); }}
                className="pl-9 pr-3 py-1.5 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 appearance-none bg-white font-medium"
              >
                <option value="">All Types</option>
                <option value="regular">🍽️ Regular</option>
                <option value="holiday">🎄 Holiday</option>
                <option value="seasonal">🌸 Seasonal</option>
                <option value="event">🎉 Event</option>
                <option value="special">⭐ Special</option>
              </select>
            </div>

            {/* Active filter */}
            <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden text-xs font-semibold">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setActiveFilter(f); setPage(1); }}
                  className={`px-3 py-1.5 capitalize transition-colors
                    ${activeFilter === f
                      ? 'bg-secondary-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Stats badges */}
            <Badge variant="primary" size="sm">{total} Menu{total !== 1 ? 's' : ''}</Badge>
            {activeCount > 0 && (
              <Badge variant="success" size="sm">{activeCount} active</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* ── Content ── */}
      {!selectedRestaurantStore ? (
        <EmptyState
          icon={<BuildingStorefrontIcon className="w-12 h-12" />}
          title="No restaurant stores available"
          description="Set at least one store POS module to Restaurant to manage menus."
        />
      ) : loading ? (
        <div className="px-4 py-6">
          <TableSkeleton rows={6} columns={3} />
        </div>
      ) : menus.length === 0 ? (
        <EmptyState
          icon={<ClipboardDocumentListIcon className="w-12 h-12" />}
          title="No menus found"
          description={
            search || typeFilter || activeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first menu to get started'
          }
          action={
            !search && !typeFilter && activeFilter === 'all' ? (
              <Button
                onClick={() => { setEditingMenu(null); setShowModal(true); }}
                variant="primary"
                size="sm"
                leftIcon={<PlusIcon className="w-4 h-4" />}
              >
                Add Menu
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Menu cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {menus.map(menu => (
              <MenuCard
                key={menu.menu_id}
                menu={menu}
                onEdit={m => { setEditingMenu(m); setShowModal(true); }}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                toggling={togglingId === menu.menu_id}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="border-2 border-gray-100">
              <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="text-xs text-gray-600 font-medium">
                  Showing <span className="font-bold text-gray-900">{(page - 1) * LIMIT + 1}</span> to{' '}
                  <span className="font-bold text-gray-900">{Math.min(page * LIMIT, total)}</span> of{' '}
                  <span className="font-bold text-gray-900">{total}</span> menus
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Modal ── */}
      {selectedRestaurantStore && (
        <MenuModal
          isOpen={showModal}
          storeId={selectedRestaurantStore.store_id}
          editingMenu={editingMenu}
          onClose={() => setShowModal(false)}
          onSaved={loadMenus}
        />
      )}
    </div>
  );
}
