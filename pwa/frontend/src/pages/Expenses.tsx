import { useState, useEffect, useCallback } from 'react';
import {
  BanknotesIcon,
  PlusIcon,
  TrashIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { expenseService, Expense, ExpenseCategory } from '../services/expenseService';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageBanner from '../components/ui/PageBanner';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Tab = 'expenses' | 'categories';

export default function Expenses() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<Tab>('expenses');
  const [date, setDate] = useState(todayISO());

  // ── expense state ──────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expTotal, setExpTotal] = useState(0);
  const [loadingExp, setLoadingExp] = useState(true);
  const [expError, setExpError] = useState('');

  // add-expense form
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [catId, setCatId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // ── category state ─────────────────────────────────────────────────────────
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // ── load ───────────────────────────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const cats = await expenseService.getCategories();
      setCategories(cats);
      if (cats.length > 0 && catId === '') setCatId(cats[0].category_id);
    } catch { /* ignore */ }
  }, [catId]);

  const loadExpenses = useCallback(async () => {
    setLoadingExp(true);
    setExpError('');
    try {
      const result = await expenseService.getExpenses(date);
      setExpenses(result.data);
      setExpTotal(result.data.reduce((s, e) => s + Number(e.amount), 0));
    } catch {
      setExpError('Failed to load expenses.');
    } finally {
      setLoadingExp(false);
    }
  }, [date]);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // ── add expense ────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const parsedAmt = parseFloat(amount.replace(',', '.'));
    if (!catId) { setAddError('Select a category.'); return; }
    if (!parsedAmt || parsedAmt <= 0) { setAddError('Enter a valid amount.'); return; }

    setAdding(true);
    setAddError('');
    try {
      const expense = await expenseService.createExpense({
        category_id: Number(catId),
        amount: parsedAmt,
        description: desc.trim() || undefined,
        expense_date: date,
      });
      setExpenses(prev => [expense, ...prev]);
      setExpTotal(prev => Math.round((prev + parsedAmt) * 100) / 100);
      setAmount('');
      setDesc('');
    } catch (err: any) {
      setAddError(err?.response?.data?.message ?? 'Failed to add expense.');
    } finally {
      setAdding(false);
    }
  };

  // ── delete expense ─────────────────────────────────────────────────────────
  const handleDelete = async (expenseId: string, amt: number) => {
    try {
      await expenseService.deleteExpense(expenseId);
      setExpenses(prev => prev.filter(e => e.expense_id !== expenseId));
      setExpTotal(prev => Math.round((prev - amt) * 100) / 100);
    } catch (err: any) {
      setExpError(err?.response?.data?.message ?? 'Failed to delete expense.');
    }
  };

  // ── add category ───────────────────────────────────────────────────────────
  const handleAddCat = async () => {
    if (!newCatName.trim()) { setCatError('Enter a category name.'); return; }
    setCatSaving(true);
    setCatError('');
    try {
      const cat = await expenseService.createCategory(newCatName.trim());
      setCategories(prev => [...prev, cat]);
      setNewCatName('');
    } catch (err: any) {
      setCatError(err?.response?.data?.message ?? 'Failed to add category.');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (catId: number) => {
    try {
      await expenseService.deleteCategory(catId);
      setCategories(prev => prev.filter(c => c.category_id !== catId));
    } catch (err: any) {
      setCatError(err?.response?.data?.message ?? 'Cannot delete category (may have expenses linked).');
    }
  };

  const unclosedTotal = expenses.filter(e => !e.day_closure_id).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      {/* ── Page banner ── */}
      <PageBanner
        title="Expenses"
        subtitle="Record and track daily operational costs"
        icon={<BanknotesIcon className="w-5 h-5 text-white" />}
        action={
          unclosedTotal > 0 ? (
            <div className="flex flex-col items-end bg-white/10 border border-white/20 rounded-xl px-4 py-2 backdrop-blur-sm">
              <span className="text-white/60 text-xs font-medium">Unclosed today</span>
              <span className="text-white text-lg font-bold leading-tight">${fmt(unclosedTotal)}</span>
            </div>
          ) : undefined
        }
      />

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 mb-5">
        {(['expenses', 'categories'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-secondary-500 text-secondary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t === 'expenses' ? 'Expenses' : 'Categories'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EXPENSES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <div className="space-y-4">

          {/* Add expense form */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <PlusIcon className="w-4 h-4 text-secondary-500" />
                <h2 className="text-sm font-semibold text-gray-700">Add Expense</h2>
              </div>

              {addError && (
                <div className="flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={catId}
                    onChange={e => setCatId(Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                  >
                    <option value="">Select…</option>
                    {categories.map(c => (
                      <option key={c.category_id} value={c.category_id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="e.g. Invoice #123"
                    maxLength={200}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={adding}
                isLoading={adding}
                leftIcon={<PlusIcon className="w-4 h-4" />}
              >
                {adding ? 'Adding…' : 'Add Expense'}
              </Button>
            </div>
          </Card>

          {/* Expenses list */}
          <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md">
            {expError && (
              <div className="flex items-center gap-1.5 px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                {expError}
              </div>
            )}

            {loadingExp ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-secondary-200 border-t-secondary-600" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No expenses for this date.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Category</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Description</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Status</th>
                        {isManager && <th className="px-4 py-2.5 w-10" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {expenses.map(exp => (
                        <tr key={exp.expense_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{exp.category_name}</td>
                          <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{exp.description ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800">${fmt(Number(exp.amount))}</td>
                          <td className="px-3 py-2.5 text-center hidden md:table-cell">
                            {exp.day_closure_id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <LockClosedIcon className="w-3 h-3" /> Closed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                Open
                              </span>
                            )}
                          </td>
                          {isManager && (
                            <td className="px-4 py-2.5 text-center">
                              {!exp.day_closure_id ? (
                                <button
                                  onClick={() => handleDelete(exp.expense_id, Number(exp.amount))}
                                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              ) : (
                                <LockClosedIcon className="w-4 h-4 text-gray-300 mx-auto" />
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total row */}
                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-secondary-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Total for {date}</span>
                    <Badge variant="primary" size="sm">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</Badge>
                  </div>
                  <span className="text-base font-bold text-secondary-700">${fmt(expTotal)}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CATEGORIES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <div className="space-y-4">

          {/* Add custom category (admin/manager) */}
          {isManager && (
            <Card className="border-2 border-gray-100 shadow-md">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Cog6ToothIcon className="w-4 h-4 text-secondary-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Add Custom Category</h2>
                </div>
                {catError && (
                  <div className="flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    {catError}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCat()}
                    placeholder="Category name…"
                    maxLength={100}
                    className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddCat}
                    disabled={catSaving}
                    isLoading={catSaving}
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Categories list */}
          <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Type</th>
                  {isAdmin && <th className="px-4 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="text-center py-10 text-gray-400 text-sm">
                      No categories yet.
                    </td>
                  </tr>
                ) : categories.map(cat => (
                  <tr key={cat.category_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{cat.name}</td>
                    <td className="px-3 py-2.5 text-center">
                      {cat.is_system ? (
                        <span className="text-xs text-secondary-600 bg-secondary-50 border border-secondary-200 rounded-full px-2 py-0.5">System</span>
                      ) : (
                        <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Custom</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 text-center">
                        {!cat.is_system ? (
                          <button
                            onClick={() => handleDeleteCat(cat.category_id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <LockClosedIcon className="w-4 h-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
