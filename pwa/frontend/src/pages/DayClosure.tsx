import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageBanner from '../components/ui/PageBanner';
import EmptyState from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';
import { CashBreakdown } from './DayClosure/components/CashBreakdown';
import {
  dayClosureService,
  DayClosurePreview,
  DayClosureRecord,
} from '../services/dayClosureService';
import { logger } from '../utils/logger';
import { restoreInputFocus } from '../utils/nativeDialogFocusFix';
import { useTranslation } from '../i18n/I18nContext';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function openPrintWindow(
  title: string,
  rows: { label: string; value: string }[],
  language: string
): void {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const lang = language === 'ar' ? 'ar' : 'en';
  const rowHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(r.label)}</td>` +
        `<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:end;font-weight:600">${escapeHtml(r.value)}</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:420px;margin:0 auto} h1{font-size:1.25rem;margin:0 0 16px} table{width:100%;border-collapse:collapse}</style></head>
    <body><h1>${escapeHtml(title)}</h1><table>${rowHtml}</table></body></html>`;
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Popup blocked — allow popups to print');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
  // The popup's print dialog + close trigger the Windows keyboard-freeze bug
  // on the main window (not covered by the global window.print patch).
  restoreInputFocus();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function DayClosure() {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DayClosurePreview | null>(null);
  const [cashActualStr, setCashActualStr] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState<DayClosureRecord | null>(null);
  const [cashBreakdown, setCashBreakdown] = useState<Record<string, number> | null>(null);

  // Opening float: carried from the previous closure's "left in drawer" amount.
  // Editable in case the actual count in the drawer differs from what was recorded.
  const [openingFloat, setOpeningFloat] = useState(0);
  const [openingFloatBreakdown, setOpeningFloatBreakdown] = useState<Record<string, number> | null>(null);
  const [editingOpeningFloat, setEditingOpeningFloat] = useState(false);
  const [openingFloatEditorKey, setOpeningFloatEditorKey] = useState(0);

  // Cash left in drawer for tomorrow (becomes the next closure's opening float).
  const [cashLeftTotal, setCashLeftTotal] = useState(0);
  const [cashLeftBreakdown, setCashLeftBreakdown] = useState<Record<string, number> | null>(null);
  const [cashLeftEditorKey, setCashLeftEditorKey] = useState(0);
  const [leaveFloatInDrawer, setLeaveFloatInDrawer] = useState(false);

  const formatCurrency = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount),
    [language]
  );

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      const p = await dayClosureService.getPreview();
      setPreview(p);
      setCashActualStr(String(round2(p.cash_expected)));
      setOpeningFloat(round2(p.opening_float));
      setOpeningFloatBreakdown(p.opening_float_breakdown);
      setEditingOpeningFloat(false);
      setOpeningFloatEditorKey((k) => k + 1);
      setLeaveFloatInDrawer(false);
      setCashLeftTotal(0);
      setCashLeftBreakdown(null);
      setCashLeftEditorKey((k) => k + 1);
    } catch (err: unknown) {
      logger.error('Day closure preview', err);
      toast.error(t('day_closure.errors.load_preview'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // The portion of expected cash that isn't the carried-over float (sales − refunds − expenses).
  const rawExpected = preview ? round2(preview.cash_expected - preview.opening_float) : 0;
  const cashExpected = round2(openingFloat + rawExpected);

  const cashActualNum = useMemo(() => {
    const n = parseFloat(cashActualStr.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return round2(n);
  }, [cashActualStr]);

  const difference = cashActualNum !== null && preview ? round2(cashActualNum - cashExpected) : null;

  const diffLabel = useMemo(() => {
    if (difference === null) return '';
    if (difference === 0) return t('day_closure.balanced');
    if (difference < 0) return t('day_closure.short');
    return t('day_closure.over');
  }, [difference, t]);

  const cashLeftNum = leaveFloatInDrawer ? round2(cashLeftTotal) : 0;
  const cashLeftExceedsActual = cashActualNum !== null && cashLeftNum > cashActualNum;
  const cashToBank = cashActualNum !== null ? round2(cashActualNum - cashLeftNum) : null;

  const canClose =
    preview &&
    preview.total_transactions > 0 &&
    cashActualNum !== null &&
    !cashLeftExceedsActual &&
    !closing;

  const handleUseSameFloat = useCallback(() => {
    setLeaveFloatInDrawer(true);
    setCashLeftBreakdown(openingFloatBreakdown);
    setCashLeftEditorKey((k) => k + 1);
  }, [openingFloatBreakdown]);

  const handlePrint = useCallback(
    (closure: DayClosureRecord, storeLabel: string) => {
      const rows = [
        { label: t('day_closure.store'), value: storeLabel },
        { label: t('day_closure.z_number'), value: String(closure.z_number) },
        { label: t('day_closure.closed_at'), value: new Date(closure.closed_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') },
        { label: t('day_closure.total_sales'), value: formatCurrency(closure.total_sales) },
        { label: t('day_closure.transactions'), value: String(closure.total_transactions) },
        { label: t('day_closure.card'), value: formatCurrency(closure.card_total) },
        { label: t('day_closure.other_payments'), value: formatCurrency(closure.other_payments) },
      ];
      if ((closure.opening_float ?? 0) > 0) {
        rows.push({ label: t('day_closure.opening_float'), value: formatCurrency(closure.opening_float) });
      }
      if ((closure.total_expenses ?? 0) > 0) {
        rows.push({ label: `  ${t('day_closure.total_expenses')}`, value: `− ${formatCurrency(closure.total_expenses)}` });
      }
      rows.push(
        { label: t('day_closure.cash_expected'), value: formatCurrency(closure.cash_expected) },
        { label: t('day_closure.cash_actual_label'), value: formatCurrency(closure.cash_actual ?? 0) },
        { label: t('day_closure.cash_difference'), value: formatCurrency(closure.cash_difference ?? 0) },
      );
      if ((closure.cash_left_in_drawer ?? 0) > 0) {
        rows.push(
          { label: t('day_closure.cash_left_in_drawer_label'), value: formatCurrency(closure.cash_left_in_drawer) },
          { label: t('day_closure.cash_to_bank'), value: formatCurrency(closure.cash_to_bank) },
        );
      } else {
        rows.push({ label: t('day_closure.cash_to_bank'), value: formatCurrency(closure.cash_to_bank) });
      }
      if (closure.notes?.trim()) {
        rows.push({ label: t('day_closure.notes_label'), value: closure.notes.trim() });
      }
      openPrintWindow(`${t('day_closure.title')} — Z-${closure.z_number}`, rows, language);
    },
    [formatCurrency, language, t]
  );

  const submitClose = async () => {
    if (cashActualNum === null) {
      toast.error(t('day_closure.errors.invalid_cash'));
      return;
    }
    if (cashLeftExceedsActual) {
      toast.error(t('day_closure.errors.float_exceeds_cash'));
      return;
    }
    try {
      setClosing(true);
      const closure = await dayClosureService.close({
        cashActual: cashActualNum,
        notes: notes.trim() || undefined,
        cashBreakdown: cashBreakdown || undefined,
        cashLeftInDrawer: cashLeftNum,
        cashLeftInDrawerBreakdown: leaveFloatInDrawer ? cashLeftBreakdown || undefined : undefined,
        openingFloat,
        openingFloatBreakdown,
      });
      setResult(closure);
      setShowConfirm(false);
      toast.success(t('day_closure.success_title'));
      await loadPreview();
    } catch (err: unknown) {
      logger.error('Day closure close', err);
      const ax = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = ax.response?.data?.error?.message;
      toast.error(typeof msg === 'string' && msg ? msg : t('day_closure.errors.close_failed'));
    } finally {
      setClosing(false);
    }
  };

  const otherNonVoucher =
    preview != null ? round2(Math.max(0, preview.other_payments - preview.voucher_total)) : 0;

  if (result) {
    const storeLabel = preview?.store_name ?? '—';
    return (
      <div className="space-y-6 max-w-2xl mx-auto p-4 sm:p-6">
        <PageBanner
          icon={<ClipboardDocumentCheckIcon className="w-5 h-5 text-white" />}
          title={t('day_closure.success_title')}
          subtitle={t('day_closure.subtitle')}
        />
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-gray-500">{t('day_closure.z_number')}</span>
            <span className="text-2xl font-bold tabular-nums">Z-{result.z_number}</span>
          </div>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.closed_at')}</dt>
              <dd className="font-medium tabular-nums">
                {new Date(result.closed_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.total_sales')}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(result.total_sales)}</dd>
            </div>
            {(result.opening_float ?? 0) > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 text-xs">{t('day_closure.opening_float')}</dt>
                <dd className="font-medium tabular-nums text-xs">{formatCurrency(result.opening_float)}</dd>
              </div>
            )}
            {(result.total_expenses ?? 0) > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 text-xs">{t('day_closure.total_expenses')}</dt>
                <dd className="font-medium tabular-nums text-orange-600 text-xs">− {formatCurrency(result.total_expenses)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.cash_expected')}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(result.cash_expected)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.cash_difference')}</dt>
              <dd className={`font-semibold tabular-nums ${(result.cash_difference ?? 0) < 0 ? 'text-red-600' : (result.cash_difference ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatCurrency(result.cash_difference ?? 0)}
              </dd>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.cash_left_in_drawer_label')}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(result.cash_left_in_drawer ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-900 font-medium">{t('day_closure.cash_to_bank')}</dt>
              <dd className="font-bold tabular-nums text-emerald-700">{formatCurrency(result.cash_to_bank ?? 0)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="primary" onClick={() => handlePrint(result, storeLabel)} leftIcon={<PrinterIcon className="w-5 h-5" />}>
              {t('day_closure.print')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                void loadPreview();
              }}
            >
              {t('day_closure.new_closure')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 sm:p-6">
      <PageBanner
        icon={<ClipboardDocumentCheckIcon className="w-5 h-5 text-white" />}
        title={t('day_closure.title')}
        subtitle={t('day_closure.subtitle')}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
        <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>{t('day_closure.banner')}</p>
      </div>

      {loading && !preview ? (
        <CardSkeleton />
      ) : preview && preview.total_transactions === 0 ? (
        <EmptyState
          title={t('day_closure.empty_title')}
          description={t('day_closure.empty_body')}
          action={
            <Button variant="secondary" onClick={() => void loadPreview()} leftIcon={<ArrowPathIcon className="w-5 h-5" />}>
              {t('day_closure.refresh')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadPreview()}
              disabled={loading}
              leftIcon={<ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            >
              {t('day_closure.refresh')}
            </Button>
          </div>

          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t('day_closure.store')}</h3>
              <p className="text-lg font-semibold text-gray-900">{preview?.store_name || '—'}</p>
            </div>

            {/* Opening float carried from the previous closure */}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-900">{t('day_closure.opening_float')}</p>
                  <p className="text-xs text-indigo-700/80 mt-0.5">
                    {preview?.previous_z_number
                      ? t('day_closure.opening_float_carried', {
                          z: preview.previous_z_number,
                          date: preview.previous_closed_at
                            ? new Date(preview.previous_closed_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')
                            : '',
                        })
                      : t('day_closure.opening_float_none')}
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums text-indigo-900 whitespace-nowrap">
                  {formatCurrency(openingFloat)}
                </span>
              </div>
              {!editingOpeningFloat ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingOpeningFloat(true)}
                  leftIcon={<PencilSquareIcon className="w-4 h-4" />}
                >
                  {t('day_closure.opening_float_adjust')}
                </Button>
              ) : (
                <div className="space-y-3 pt-1">
                  <CashBreakdown
                    key={openingFloatEditorKey}
                    currencyCode={preview?.currency_code || 'USD'}
                    lbpRate={preview?.lbp_exchange_rate}
                    initialBreakdown={openingFloatBreakdown || undefined}
                    onChange={(total, breakdown) => {
                      setOpeningFloat(round2(total));
                      setOpeningFloatBreakdown(breakdown);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpeningFloat(round2(preview?.opening_float ?? 0));
                      setOpeningFloatBreakdown(preview?.opening_float_breakdown ?? null);
                      setOpeningFloatEditorKey((k) => k + 1);
                      setEditingOpeningFloat(false);
                    }}
                    leftIcon={<ArrowUturnLeftIcon className="w-4 h-4" />}
                  >
                    {t('day_closure.opening_float_reset')}
                  </Button>
                </div>
              )}
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-gray-50 p-4">
                <dt className="text-gray-600">{t('day_closure.total_sales')}</dt>
                <dd className="text-xl font-bold tabular-nums mt-1">{formatCurrency(preview?.total_sales ?? 0)}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <dt className="text-gray-600">{t('day_closure.transactions')}</dt>
                <dd className="text-xl font-bold tabular-nums mt-1">{preview?.total_transactions ?? 0}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <dt className="text-gray-600">{t('day_closure.card')}</dt>
                <dd className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(preview?.card_total ?? 0)}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <dt className="text-gray-600">{t('day_closure.voucher')}</dt>
                <dd className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(preview?.voucher_total ?? 0)}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <dt className="text-gray-600">{t('day_closure.other_excl_voucher')}</dt>
                <dd className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(otherNonVoucher)}</dd>
              </div>
            </dl>

            {/* Expected cash breakdown */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 text-sm">
              {openingFloat > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-indigo-700">{t('day_closure.opening_float')}</span>
                  <span className="tabular-nums font-medium text-indigo-700">{formatCurrency(openingFloat)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('day_closure.gross_cash')}</span>
                <span className="tabular-nums font-medium">{formatCurrency(preview?.gross_cash ?? 0)}</span>
              </div>
              {(preview?.cash_refunds_out ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-red-700">{t('day_closure.refund_payouts')}</span>
                  <span className="tabular-nums font-medium text-red-700">
                    − {formatCurrency(preview?.cash_refunds_out ?? 0)}
                  </span>
                </div>
              )}
              {(preview?.total_expenses ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-orange-700">{t('day_closure.total_expenses')}</span>
                  <span className="tabular-nums font-medium text-orange-700">
                    − {formatCurrency(preview?.total_expenses ?? 0)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-gray-900 font-semibold">{t('day_closure.cash_expected')}</span>
                <span className="text-lg font-bold tabular-nums text-gray-900">
                  {formatCurrency(cashExpected)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">{t('day_closure.cash_actual_label')}</label>
              <CashBreakdown
                currencyCode={preview?.currency_code || 'USD'}
                lbpRate={preview?.lbp_exchange_rate}
                onChange={(total, breakdown) => {
                  setCashActualStr(total.toString());
                  setCashBreakdown(breakdown);
                }}
              />
            </div>

            {difference !== null && (
              <div
                className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  difference === 0
                    ? 'bg-emerald-50 text-emerald-900'
                    : difference < 0
                      ? 'bg-red-50 text-red-900'
                      : 'bg-amber-50 text-amber-900'
                }`}
              >
                <span className="block text-gray-600 font-normal mb-1">{t('day_closure.difference')}</span>
                <span className="text-lg tabular-nums">
                  {formatCurrency(difference)} ({diffLabel})
                </span>
              </div>
            )}

            {/* Leave cash in the drawer for tomorrow */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-emerald-900">{t('day_closure.leave_float_question')}</p>
                  <p className="text-xs text-emerald-700/80 mt-0.5">{t('day_closure.leave_float_hint')}</p>
                </div>
                <div className="flex rounded-lg border border-emerald-200 bg-white overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setLeaveFloatInDrawer(false)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      !leaveFloatInDrawer ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t('day_closure.no')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveFloatInDrawer(true)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      leaveFloatInDrawer ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t('day_closure.yes')}
                  </button>
                </div>
              </div>

              {leaveFloatInDrawer && (
                <div className="space-y-4">
                  {openingFloat > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleUseSameFloat}>
                      {t('day_closure.use_same_float', { amount: formatCurrency(openingFloat) })}
                    </Button>
                  )}
                  <CashBreakdown
                    key={cashLeftEditorKey}
                    currencyCode={preview?.currency_code || 'USD'}
                    lbpRate={preview?.lbp_exchange_rate}
                    initialBreakdown={cashLeftBreakdown || undefined}
                    onChange={(total, breakdown) => {
                      setCashLeftTotal(round2(total));
                      setCashLeftBreakdown(breakdown);
                    }}
                  />
                  {cashLeftExceedsActual && (
                    <p className="text-sm text-red-700 font-medium">{t('day_closure.errors.float_exceeds_cash')}</p>
                  )}
                </div>
              )}

              {cashToBank !== null && (
                <div className="rounded-lg bg-white border border-emerald-200 px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{t('day_closure.cash_to_bank')}</span>
                  <span className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(cashToBank)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('day_closure.notes_label')}</label>
              <textarea
                className="input-premium w-full px-4 py-2.5 rounded-lg border border-gray-200 min-h-[88px] text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!canClose}
              onClick={() => setShowConfirm(true)}
            >
              {t('day_closure.close_day')}
            </Button>
          </Card>
        </>
      )}

      <Modal
        isOpen={showConfirm}
        onClose={() => !closing && setShowConfirm(false)}
        title={t('day_closure.confirm_title')}
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={closing}>
              {t('day_closure.confirm_cancel')}
            </Button>
            <Button variant="primary" onClick={() => void submitClose()} disabled={closing || !canClose}>
              {closing ? '…' : t('day_closure.confirm_submit')}
            </Button>
          </div>
        }
      >
        <p className="text-gray-700 text-sm leading-relaxed">{t('day_closure.confirm_body')}</p>
        {preview && (
          <ul className="mt-4 text-sm text-gray-600 space-y-1">
            {openingFloat > 0 && (
              <li>
                {t('day_closure.opening_float')}: <strong className="text-indigo-700">{formatCurrency(openingFloat)}</strong>
              </li>
            )}
            <li>
              {t('day_closure.total_sales')}: <strong className="text-gray-900">{formatCurrency(preview.total_sales)}</strong>
            </li>
            {(preview.cash_refunds_out ?? 0) > 0 && (
              <li>
                {t('day_closure.refund_payouts')}:{' '}
                <strong className="text-red-700">− {formatCurrency(preview.cash_refunds_out)}</strong>
              </li>
            )}
            {(preview.total_expenses ?? 0) > 0 && (
              <li>
                {t('day_closure.total_expenses')}:{' '}
                <strong className="text-orange-700">− {formatCurrency(preview.total_expenses)}</strong>
              </li>
            )}
            <li>
              {t('day_closure.cash_expected')}:{' '}
              <strong className="text-gray-900">{formatCurrency(cashExpected)}</strong>
            </li>
            <li>
              {t('day_closure.cash_actual_label')}:{' '}
              <strong className="text-gray-900">{cashActualNum !== null ? formatCurrency(cashActualNum) : '—'}</strong>
            </li>
            <li className="pt-2 border-t border-gray-100 mt-2">
              {t('day_closure.cash_left_in_drawer_label')}:{' '}
              <strong className="text-gray-900">{formatCurrency(cashLeftNum)}</strong>
            </li>
            <li>
              {t('day_closure.cash_to_bank')}:{' '}
              <strong className="text-emerald-700">{cashToBank !== null ? formatCurrency(cashToBank) : '—'}</strong>
            </li>
          </ul>
        )}
      </Modal>
    </div>
  );
}
