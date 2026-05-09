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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
            <BanknotesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500">Record daily operational costs</p>
          </div>
        </div>
        {unclosedTotal > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Unclosed total</span>
            <span className="text-lg font-bold text-orange-600">${fmt(unclosedTotal)}</span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200">
        {(['expenses', 'categories'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Add Expense</h2>

            {addError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> {addError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={catId}
                  onChange={e => setCatId(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  <option value="">Select…</option>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. Invoice #123"
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              {adding ? 'Adding…' : 'Add Expense'}
            </button>
          </div>

          {/* Expenses list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {expError && (
              <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                {expError}
              </div>
            )}

            {loadingExp ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-orange-200 border-t-orange-500" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No expenses for this date.</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden sm:table-cell">Description</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">Amount</th>
                      <th className="text-center px-3 py-2.5 font-medium text-gray-600 hidden md:table-cell">Status</th>
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

                {/* Total row */}
                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-orange-50">
                  <span className="text-sm font-medium text-gray-700">Total for {date}</span>
                  <span className="text-base font-bold text-orange-700">${fmt(expTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CATEGORIES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <div className="space-y-4">

          {/* Add custom category (admin/manager) */}
          {isManager && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Add Custom Category</h2>
              </div>
              {catError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" /> {catError}
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
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={handleAddCat}
                  disabled={catSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Categories list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                  <th className="text-center px-3 py-2.5 font-medium text-gray-600">Type</th>
                  {isAdmin && <th className="px-4 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map(cat => (
                  <tr key={cat.category_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{cat.name}</td>
                    <td className="px-3 py-2.5 text-center">
                      {cat.is_system ? (
                        <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">System</span>
                      ) : (
                        <span className="text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">Custom</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
