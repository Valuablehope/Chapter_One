import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import PageBanner from '../components/ui/PageBanner';
import EmptyState from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';
import {
  dayClosureService,
  DayClosurePreview,
  DayClosureRecord,
} from '../services/dayClosureService';
import { logger } from '../utils/logger';
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

  const cashExpected = preview?.cash_expected ?? 0;
  const cashActualNum = useMemo(() => {
    const n = parseFloat(cashActualStr.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return round2(n);
  }, [cashActualStr]);

  const difference =
    cashActualNum !== null && preview ? round2(cashActualNum - cashExpected) : null;

  const diffLabel = useMemo(() => {
    if (difference === null) return '';
    if (difference === 0) return t('day_closure.balanced');
    if (difference < 0) return t('day_closure.short');
    return t('day_closure.over');
  }, [difference, t]);

  const canClose =
    preview &&
    preview.total_transactions > 0 &&
    cashActualNum !== null &&
    !closing;

  const handlePrint = useCallback(
    (closure: DayClosureRecord, storeLabel: string) => {
      const rows = [
        { label: t('day_closure.store'), value: storeLabel },
        { label: t('day_closure.z_number'), value: String(closure.z_number) },
        { label: t('day_closure.closed_at'), value: new Date(closure.closed_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') },
        { label: t('day_closure.total_sales'), value: formatCurrency(closure.total_sales) },
        { label: t('day_closure.transactions'), value: String(closure.total_transactions) },
        { label: t('day_closure.cash_expected'), value: formatCurrency(closure.cash_expected) },
        { label: t('day_closure.cash_actual_label'), value: formatCurrency(closure.cash_actual ?? 0) },
        { label: t('day_closure.cash_difference'), value: formatCurrency(closure.cash_difference ?? 0) },
        { label: t('day_closure.card'), value: formatCurrency(closure.card_total) },
        { label: t('day_closure.other_payments'), value: formatCurrency(closure.other_payments) },
      ];
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
    try {
      setClosing(true);
      const closure = await dayClosureService.close(cashActualNum, notes.trim() || undefined);
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
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t('day_closure.cash_difference')}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(result.cash_difference ?? 0)}</dd>
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
                <dt className="text-gray-600">{t('day_closure.cash_expected')}</dt>
                <dd className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(preview?.cash_expected ?? 0)}</dd>
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

            <Input
              label={t('day_closure.cash_actual_label')}
              type="text"
              inputMode="decimal"
              value={cashActualStr}
              onChange={(e) => setCashActualStr(e.target.value)}
              fullWidth
            />

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
            <li>
              {t('day_closure.total_sales')}: <strong className="text-gray-900">{formatCurrency(preview.total_sales)}</strong>
            </li>
            <li>
              {t('day_closure.cash_expected')}:{' '}
              <strong className="text-gray-900">{formatCurrency(preview.cash_expected)}</strong>
            </li>
            <li>
              {t('day_closure.cash_actual_label')}:{' '}
              <strong className="text-gray-900">{cashActualNum !== null ? formatCurrency(cashActualNum) : '—'}</strong>
            </li>
          </ul>
        )}
      </Modal>
    </div>
  );
}
