import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ScaleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BoltIcon,
  ArrowPathIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import {
  scaleService,
  ScaleDevice,
  ScaleBarcodeFormat,
  ScaleBrandPreset,
  ScalePluProduct,
  ScaleTestParseResult,
} from '../../../services/scaleService';
import { useTranslation } from '../../../i18n/I18nContext';

interface DeviceForm {
  name: string;
  brand: string;
  driver: 'generic_tcp' | 'csv_export';
  host: string;
  port: string;
  department: string;
  record_template: string;
  line_ending: 'crlf' | 'lf';
  csv_header: string;
  is_active: boolean;
}

const emptyDeviceForm: DeviceForm = {
  name: '',
  brand: 'generic',
  driver: 'generic_tcp',
  host: '',
  port: '',
  department: '',
  record_template: '',
  line_ending: 'crlf',
  csv_header: '',
  is_active: true,
};

interface FormatForm {
  name: string;
  prefixes: string;
  plu_length: string;
  value_length: string;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  value_divisor: string;
  check_digit: 'none' | 'ean13';
  priority: string;
  is_active: boolean;
}

const emptyFormatForm: FormatForm = {
  name: '',
  prefixes: '20,21,22,23,24,25,26,27,28,29',
  plu_length: '5',
  value_length: '5',
  value_type: 'price',
  value_divisor: '100',
  check_digit: 'ean13',
  priority: '0',
  is_active: true,
};

function formatLayoutPreview(form: FormatForm): string {
  const prefix = form.prefixes.split(',')[0]?.trim() || '2X';
  const plu = 'P'.repeat(Math.max(0, parseInt(form.plu_length, 10) || 0));
  const val =
    form.value_type === 'none'
      ? ''
      : (form.value_type === 'weight' ? 'W' : form.value_type === 'quantity' ? 'Q' : 'V').repeat(
          Math.max(0, parseInt(form.value_length, 10) || 0)
        );
  const check = form.check_digit === 'ean13' ? ' C' : '';
  return `${prefix} ${plu}${val ? ' ' + val : ''}${check}`;
}

export default function ScalesTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<ScaleDevice[]>([]);
  const [formats, setFormats] = useState<ScaleBarcodeFormat[]>([]);
  const [presets, setPresets] = useState<ScaleBrandPreset[]>([]);
  const [pluProducts, setPluProducts] = useState<ScalePluProduct[]>([]);

  // Device modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ScaleDevice | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(emptyDeviceForm);
  const [savingDevice, setSavingDevice] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);

  // Format modal
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<ScaleBarcodeFormat | null>(null);
  const [formatForm, setFormatForm] = useState<FormatForm>(emptyFormatForm);
  const [savingFormat, setSavingFormat] = useState(false);

  // Label test
  const [testBarcode, setTestBarcode] = useState('');
  const [testResult, setTestResult] = useState<ScaleTestParseResult | null>(null);
  const [testing, setTesting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesData, formatsData, presetsData, pluData] = await Promise.all([
        scaleService.getDevices(),
        scaleService.getFormats(),
        scaleService.getPresets(),
        scaleService.getPluProducts(),
      ]);
      setDevices(devicesData);
      setFormats(formatsData);
      setPresets(presetsData);
      setPluProducts(pluData);
    } catch {
      toast.error(t('admin.scales.load_failed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------- Devices ----------

  const openCreateDevice = () => {
    setEditingDevice(null);
    setDeviceForm(emptyDeviceForm);
    setShowDeviceModal(true);
  };

  const openEditDevice = (device: ScaleDevice) => {
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      brand: device.brand,
      driver: device.driver,
      host: device.host || '',
      port: device.port != null ? String(device.port) : '',
      department: device.department != null ? String(device.department) : '',
      record_template: device.options?.record_template || '',
      line_ending: device.options?.line_ending === 'lf' ? 'lf' : 'crlf',
      csv_header: device.options?.csv_header || '',
      is_active: device.is_active,
    });
    setShowDeviceModal(true);
  };

  const applyPreset = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    setDeviceForm((prev) => ({
      ...prev,
      brand: key,
      driver: preset?.driver || prev.driver,
      port: preset?.default_port ? String(preset.default_port) : prev.port,
      record_template: preset?.default_options?.record_template ?? prev.record_template,
      line_ending: preset?.default_options?.line_ending === 'lf' ? 'lf' : prev.line_ending,
    }));
  };

  const saveDevice = async () => {
    if (!deviceForm.name.trim()) {
      toast.error(t('admin.scales.name_required'));
      return;
    }
    if (deviceForm.driver === 'generic_tcp' && (!deviceForm.host.trim() || !deviceForm.port)) {
      toast.error(t('admin.scales.host_port_required'));
      return;
    }
    setSavingDevice(true);
    try {
      const options: Record<string, any> = {};
      if (deviceForm.record_template.trim()) options.record_template = deviceForm.record_template.trim();
      if (deviceForm.line_ending) options.line_ending = deviceForm.line_ending;
      if (deviceForm.csv_header.trim()) options.csv_header = deviceForm.csv_header.trim();

      const payload = {
        name: deviceForm.name.trim(),
        brand: deviceForm.brand,
        driver: deviceForm.driver,
        host: deviceForm.host.trim() || null,
        port: deviceForm.port ? parseInt(deviceForm.port, 10) : null,
        department: deviceForm.department ? parseInt(deviceForm.department, 10) : null,
        options,
        is_active: deviceForm.is_active,
      };

      if (editingDevice) {
        await scaleService.updateDevice(editingDevice.scale_id, payload);
        toast.success(t('admin.scales.device_updated'));
      } else {
        await scaleService.createDevice(payload);
        toast.success(t('admin.scales.device_created'));
      }
      setShowDeviceModal(false);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('admin.scales.save_failed'));
    } finally {
      setSavingDevice(false);
    }
  };

  const deleteDevice = async (device: ScaleDevice) => {
    if (!window.confirm(t('admin.scales.confirm_delete_device'))) return;
    try {
      await scaleService.deleteDevice(device.scale_id);
      toast.success(t('admin.scales.device_deleted'));
      loadAll();
    } catch {
      toast.error(t('admin.scales.save_failed'));
    }
  };

  const testConnection = async (device: ScaleDevice) => {
    setBusyDeviceId(device.scale_id);
    try {
      const result = await scaleService.testDevice(device.scale_id);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('admin.scales.test_failed'));
    } finally {
      setBusyDeviceId(null);
    }
  };

  const syncDevice = async (device: ScaleDevice) => {
    setBusyDeviceId(device.scale_id);
    try {
      const result = await scaleService.syncDevice(device.scale_id);
      toast.success(result.message);
      // File-based drivers return the generated PLU file — download it.
      if (result.payload && result.filename) {
        const blob = new Blob([result.payload], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('admin.scales.sync_failed'));
      loadAll();
    } finally {
      setBusyDeviceId(null);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await scaleService.exportPluCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scale_plu_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('admin.scales.export_failed'));
    }
  };

  // ---------- Formats ----------

  const openCreateFormat = () => {
    setEditingFormat(null);
    setFormatForm(emptyFormatForm);
    setShowFormatModal(true);
  };

  const openEditFormat = (format: ScaleBarcodeFormat) => {
    setEditingFormat(format);
    setFormatForm({
      name: format.name,
      prefixes: format.prefixes,
      plu_length: String(format.plu_length),
      value_length: String(format.value_length),
      value_type: format.value_type,
      value_divisor: String(format.value_divisor),
      check_digit: format.check_digit,
      priority: String(format.priority),
      is_active: format.is_active,
    });
    setShowFormatModal(true);
  };

  const saveFormat = async () => {
    if (!formatForm.name.trim() || !formatForm.prefixes.trim()) {
      toast.error(t('admin.scales.format_fields_required'));
      return;
    }
    setSavingFormat(true);
    try {
      const payload = {
        name: formatForm.name.trim(),
        prefixes: formatForm.prefixes.replace(/\s+/g, ''),
        plu_length: parseInt(formatForm.plu_length, 10) || 5,
        value_length: parseInt(formatForm.value_length, 10) || 0,
        value_type: formatForm.value_type,
        value_divisor: parseFloat(formatForm.value_divisor) || 100,
        check_digit: formatForm.check_digit,
        priority: parseInt(formatForm.priority, 10) || 0,
        is_active: formatForm.is_active,
      };
      if (editingFormat) {
        await scaleService.updateFormat(editingFormat.format_id, payload);
        toast.success(t('admin.scales.format_updated'));
      } else {
        await scaleService.createFormat(payload);
        toast.success(t('admin.scales.format_created'));
      }
      setShowFormatModal(false);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('admin.scales.save_failed'));
    } finally {
      setSavingFormat(false);
    }
  };

  const toggleFormatActive = async (format: ScaleBarcodeFormat) => {
    try {
      await scaleService.updateFormat(format.format_id, { is_active: !format.is_active });
      loadAll();
    } catch {
      toast.error(t('admin.scales.save_failed'));
    }
  };

  const deleteFormat = async (format: ScaleBarcodeFormat) => {
    if (!window.confirm(t('admin.scales.confirm_delete_format'))) return;
    try {
      await scaleService.deleteFormat(format.format_id);
      toast.success(t('admin.scales.format_deleted'));
      loadAll();
    } catch {
      toast.error(t('admin.scales.save_failed'));
    }
  };

  // ---------- Label test ----------

  const runTestParse = async () => {
    if (!testBarcode.trim()) return;
    setTesting(true);
    try {
      const result = await scaleService.testParse(testBarcode.trim());
      setTestResult(result);
    } catch {
      toast.error(t('admin.scales.test_failed'));
    } finally {
      setTesting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-secondary-500 focus:outline-none';
  const labelClass = 'block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1';

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">{t('admin.scales.loading')}</div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* ---------- Devices ---------- */}
      <Card className="border-2 border-gray-100 shadow-md">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScaleIcon className="w-5 h-5 text-secondary-500" />
              <h3 className="text-sm font-bold text-gray-900">{t('admin.scales.devices_title')}</h3>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="xs" leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />} onClick={exportCsv}>
                {t('admin.scales.export_csv')}
              </Button>
              <Button size="xs" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={openCreateDevice}>
                {t('admin.scales.add_device')}
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {t('admin.scales.devices_hint', { count: String(pluProducts.length) })}
          </p>

          {devices.length === 0 ? (
            <EmptyState
              icon={<ScaleIcon className="w-10 h-10" />}
              title={t('admin.scales.no_devices')}
              description={t('admin.scales.no_devices_desc')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="py-2 pr-3">{t('admin.scales.col_name')}</th>
                    <th className="py-2 pr-3">{t('admin.scales.col_brand')}</th>
                    <th className="py-2 pr-3">{t('admin.scales.col_connection')}</th>
                    <th className="py-2 pr-3">{t('admin.scales.col_last_sync')}</th>
                    <th className="py-2 pr-3">{t('admin.scales.col_status')}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.scale_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-3 font-medium text-gray-900">{device.name}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {presets.find((p) => p.key === device.brand)?.label || device.brand}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {device.driver === 'csv_export'
                          ? t('admin.scales.driver_csv')
                          : `${device.host || '—'}:${device.port || '—'}`}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {device.last_sync_at ? (
                          <span className="inline-flex items-center gap-1">
                            {device.last_sync_status === 'success' ? (
                              <CheckCircleIcon className="w-4 h-4 text-success-500" />
                            ) : (
                              <XCircleIcon className="w-4 h-4 text-error-500" />
                            )}
                            {new Date(device.last_sync_at).toLocaleString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={device.is_active ? 'success' : 'gray'}>
                          {device.is_active ? t('admin.scales.active') : t('admin.scales.inactive')}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            isLoading={busyDeviceId === device.scale_id}
                            leftIcon={<BoltIcon className="w-4 h-4" />}
                            onClick={() => testConnection(device)}
                          >
                            {t('admin.scales.test')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            isLoading={busyDeviceId === device.scale_id}
                            leftIcon={<ArrowPathIcon className="w-4 h-4" />}
                            onClick={() => syncDevice(device)}
                          >
                            {t('admin.scales.sync')}
                          </Button>
                          <button
                            onClick={() => openEditDevice(device)}
                            className="p-1.5 text-gray-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteDevice(device)}
                            className="p-1.5 text-gray-400 hover:text-error-600 rounded-lg hover:bg-error-50"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* ---------- Barcode formats ---------- */}
      <Card className="border-2 border-gray-100 shadow-md">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCodeIcon className="w-5 h-5 text-secondary-500" />
              <h3 className="text-sm font-bold text-gray-900">{t('admin.scales.formats_title')}</h3>
            </div>
            <Button size="xs" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={openCreateFormat}>
              {t('admin.scales.add_format')}
            </Button>
          </div>

          <p className="text-xs text-gray-500">{t('admin.scales.formats_hint')}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 pr-3">{t('admin.scales.col_name')}</th>
                  <th className="py-2 pr-3">{t('admin.scales.col_layout')}</th>
                  <th className="py-2 pr-3">{t('admin.scales.col_value')}</th>
                  <th className="py-2 pr-3">{t('admin.scales.col_status')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {formats.map((format) => (
                  <tr key={format.format_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-900">{format.name}</td>
                    <td className="py-2 pr-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {formatLayoutPreview({
                          name: format.name,
                          prefixes: format.prefixes,
                          plu_length: String(format.plu_length),
                          value_length: String(format.value_length),
                          value_type: format.value_type,
                          value_divisor: String(format.value_divisor),
                          check_digit: format.check_digit,
                          priority: String(format.priority),
                          is_active: format.is_active,
                        })}
                      </code>
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {t(`admin.scales.value_type_${format.value_type}`)} ÷ {Number(format.value_divisor)}
                    </td>
                    <td className="py-2 pr-3">
                      <button onClick={() => toggleFormatActive(format)}>
                        <Badge variant={format.is_active ? 'success' : 'gray'}>
                          {format.is_active ? t('admin.scales.active') : t('admin.scales.inactive')}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditFormat(format)}
                          className="p-1.5 text-gray-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteFormat(format)}
                          className="p-1.5 text-gray-400 hover:text-error-600 rounded-lg hover:bg-error-50"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Label test box */}
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-3 space-y-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {t('admin.scales.test_label_title')}
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                placeholder={t('admin.scales.test_label_placeholder')}
                value={testBarcode}
                onChange={(e) => setTestBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runTestParse();
                }}
              />
              <Button size="sm" isLoading={testing} onClick={runTestParse}>
                {t('admin.scales.decode')}
              </Button>
            </div>
            {testResult && (
              <div className="text-sm">
                {!testResult.matched ? (
                  <p className="text-error-600">
                    {t('admin.scales.test_no_match', {
                      count: String(testResult.active_formats ?? 0),
                    })}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-success-600 font-medium">
                      ✓ {testResult.parsed?.format_name}
                    </p>
                    <p className="text-gray-700">
                      PLU <b>{testResult.parsed?.plu_code}</b>
                      {testResult.parsed?.value != null && (
                        <>
                          {' · '}
                          {t(`admin.scales.value_type_${testResult.parsed?.value_type}`)}:{' '}
                          <b>{testResult.parsed?.value}</b>
                        </>
                      )}
                    </p>
                    {testResult.product ? (
                      <p className="text-gray-700">
                        → {testResult.product.name}
                        {testResult.line && (
                          <>
                            {' — '}
                            {t('admin.scales.qty')}: <b>{testResult.line.qty}</b>
                            {testResult.line.line_total != null && (
                              <>
                                {' · '}
                                {t('admin.scales.total')}: <b>{testResult.line.line_total}</b>
                              </>
                            )}
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-warning-600">{t('admin.scales.test_no_product')}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ---------- Device modal ---------- */}
      <Modal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        title={editingDevice ? t('admin.scales.edit_device') : t('admin.scales.add_device')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDeviceModal(false)}>
              {t('admin.scales.cancel')}
            </Button>
            <Button size="sm" isLoading={savingDevice} onClick={saveDevice}>
              {t('admin.scales.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('admin.scales.device_name')}</label>
              <input
                type="text"
                className={inputClass}
                value={deviceForm.name}
                onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                placeholder="Deli scale 1"
              />
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.brand')}</label>
              <select
                className={inputClass}
                value={deviceForm.brand}
                onChange={(e) => applyPreset(e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {presets.find((p) => p.key === deviceForm.brand)?.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              {presets.find((p) => p.key === deviceForm.brand)?.notes}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('admin.scales.driver')}</label>
              <select
                className={inputClass}
                value={deviceForm.driver}
                onChange={(e) =>
                  setDeviceForm({ ...deviceForm, driver: e.target.value as DeviceForm['driver'] })
                }
              >
                <option value="generic_tcp">{t('admin.scales.driver_tcp')}</option>
                <option value="csv_export">{t('admin.scales.driver_csv')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.department')}</label>
              <input
                type="number"
                className={inputClass}
                value={deviceForm.department}
                onChange={(e) => setDeviceForm({ ...deviceForm, department: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>

          {deviceForm.driver === 'generic_tcp' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('admin.scales.host')}</label>
                <input
                  type="text"
                  className={inputClass}
                  value={deviceForm.host}
                  onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })}
                  placeholder="192.168.1.50"
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.scales.port')}</label>
                <input
                  type="number"
                  className={inputClass}
                  value={deviceForm.port}
                  onChange={(e) => setDeviceForm({ ...deviceForm, port: e.target.value })}
                  placeholder="20304"
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{t('admin.scales.record_template')}</label>
            <input
              type="text"
              className={inputClass}
              value={deviceForm.record_template}
              onChange={(e) => setDeviceForm({ ...deviceForm, record_template: e.target.value })}
              placeholder="{plu},{name},{price}"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {'{plu} {name} {price} {price_cents} {unit} {tax_rate} {department} — {field:N} pads/truncates to N'}
            </p>
          </div>

          {deviceForm.driver === 'csv_export' && (
            <div>
              <label className={labelClass}>{t('admin.scales.csv_header')}</label>
              <input
                type="text"
                className={inputClass}
                value={deviceForm.csv_header}
                onChange={(e) => setDeviceForm({ ...deviceForm, csv_header: e.target.value })}
                placeholder="PLU,Name,Price,Unit,Department"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={deviceForm.is_active}
              onChange={(e) => setDeviceForm({ ...deviceForm, is_active: e.target.checked })}
            />
            {t('admin.scales.active')}
          </label>
        </div>
      </Modal>

      {/* ---------- Format modal ---------- */}
      <Modal
        isOpen={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        title={editingFormat ? t('admin.scales.edit_format') : t('admin.scales.add_format')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowFormatModal(false)}>
              {t('admin.scales.cancel')}
            </Button>
            <Button size="sm" isLoading={savingFormat} onClick={saveFormat}>
              {t('admin.scales.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t('admin.scales.format_name')}</label>
            <input
              type="text"
              className={inputClass}
              value={formatForm.name}
              onChange={(e) => setFormatForm({ ...formatForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('admin.scales.prefixes')}</label>
              <input
                type="text"
                className={inputClass}
                value={formatForm.prefixes}
                onChange={(e) => setFormatForm({ ...formatForm, prefixes: e.target.value })}
                placeholder="20,21,22"
              />
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.check_digit')}</label>
              <select
                className={inputClass}
                value={formatForm.check_digit}
                onChange={(e) =>
                  setFormatForm({ ...formatForm, check_digit: e.target.value as FormatForm['check_digit'] })
                }
              >
                <option value="ean13">EAN-13 (mod-10)</option>
                <option value="none">{t('admin.scales.none')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>{t('admin.scales.plu_length')}</label>
              <input
                type="number"
                className={inputClass}
                value={formatForm.plu_length}
                onChange={(e) => setFormatForm({ ...formatForm, plu_length: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.value_length')}</label>
              <input
                type="number"
                className={inputClass}
                value={formatForm.value_length}
                onChange={(e) => setFormatForm({ ...formatForm, value_length: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.value_type')}</label>
              <select
                className={inputClass}
                value={formatForm.value_type}
                onChange={(e) =>
                  setFormatForm({ ...formatForm, value_type: e.target.value as FormatForm['value_type'] })
                }
              >
                <option value="price">{t('admin.scales.value_type_price')}</option>
                <option value="weight">{t('admin.scales.value_type_weight')}</option>
                <option value="quantity">{t('admin.scales.value_type_quantity')}</option>
                <option value="none">{t('admin.scales.value_type_none')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('admin.scales.value_divisor')}</label>
              <input
                type="number"
                className={inputClass}
                value={formatForm.value_divisor}
                onChange={(e) => setFormatForm({ ...formatForm, value_divisor: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-2 text-center">
            <span className="text-xs text-gray-500">{t('admin.scales.layout_preview')}: </span>
            <code className="text-sm font-bold">{formatLayoutPreview(formatForm)}</code>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={labelClass}>{t('admin.scales.priority')}</label>
              <input
                type="number"
                className={inputClass}
                value={formatForm.priority}
                onChange={(e) => setFormatForm({ ...formatForm, priority: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input
                type="checkbox"
                checked={formatForm.is_active}
                onChange={(e) => setFormatForm({ ...formatForm, is_active: e.target.checked })}
              />
              {t('admin.scales.active')}
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
