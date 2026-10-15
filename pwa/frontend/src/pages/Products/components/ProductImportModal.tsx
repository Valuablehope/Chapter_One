import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { productService, CreateProductData } from '../../../services/productService';
import toast from 'react-hot-toast';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  [fileHeader: string]: ProductField | '';
}

type ProductField =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'product_type'
  | 'unit_of_measure'
  | 'list_price'
  | 'sale_price'
  | 'tax_rate'
  | 'track_inventory'
  | 'skip';

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

const PRODUCT_FIELDS: { value: ProductField; label: string; required?: boolean }[] = [
  { value: 'name', label: 'Product Name', required: true },
  { value: 'sku', label: 'SKU' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'product_type', label: 'Product Type / Category' },
  { value: 'unit_of_measure', label: 'Unit of Measure' },
  { value: 'list_price', label: 'List Price' },
  { value: 'sale_price', label: 'Sale Price' },
  { value: 'tax_rate', label: 'Tax Rate (%)' },
  { value: 'track_inventory', label: 'Track Inventory' },
  { value: 'skip', label: '— Skip this column —' },
];

// Smart auto-detect: map file header → product field
const ALIASES: Record<string, ProductField> = {
  name: 'name', 'product name': 'name', title: 'name', item: 'name', 'item name': 'name',
  sku: 'sku', 'item code': 'sku', code: 'sku', 'product code': 'sku', 'item sku': 'sku',
  barcode: 'barcode', upc: 'barcode', ean: 'barcode', isbn: 'barcode', 'bar code': 'barcode',
  'product type': 'product_type', type: 'product_type', category: 'product_type',
  'product category': 'product_type', 'item type': 'product_type',
  unit: 'unit_of_measure', uom: 'unit_of_measure', 'unit of measure': 'unit_of_measure',
  'list price': 'list_price', 'cost price': 'list_price', cost: 'list_price', price: 'list_price',
  'retail price': 'sale_price', 'sale price': 'sale_price', 'selling price': 'sale_price',
  'tax rate': 'tax_rate', tax: 'tax_rate', vat: 'tax_rate',
  'track inventory': 'track_inventory', inventory: 'track_inventory', track: 'track_inventory',
};

function detectField(header: string): ProductField {
  const key = header.toLowerCase().trim();
  return ALIASES[key] || 'skip';
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProductImportModal({ isOpen, onClose, onImported }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setImporting(false);
    onClose();
  }, [onClose]);

  // ── File Parsing ───────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    if (!file) return;
    const allowed = ['csv', 'xlsx', 'xls'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(ext)) {
      toast.error('Please upload a .csv, .xlsx, or .xls file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be smaller than 50 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          toast.error('File appears to be empty or has no data rows');
          return;
        }

        const fileHeaders = (json[0] as string[]).map(String);
        const dataRows: ParsedRow[] = json.slice(1).map((row) => {
          const obj: ParsedRow = {};
          fileHeaders.forEach((h, i) => { obj[h] = String((row as string[])[i] ?? ''); });
          return obj;
        }).filter(row => fileHeaders.some(h => row[h]?.trim()));

        const autoMapping: ColumnMapping = {};
        fileHeaders.forEach(h => { autoMapping[h] = detectField(h); });

        setFileName(file.name);
        setHeaders(fileHeaders);
        setRows(dataRows);
        setMapping(autoMapping);
        setStep(2);
      } catch {
        toast.error('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) parseFile(e.target.files[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) parseFile(e.dataTransfer.files[0]);
  };

  // ── Mapping helpers ────────────────────────────────────────────────────────

  const mappedField = (field: ProductField) => headers.find(h => mapping[h] === field);
  const nameIsMapped = headers.some(h => mapping[h] === 'name');

  // ── Preview: first 3 data rows ─────────────────────────────────────────────

  const previewRows = rows.slice(0, 3);

  // ── New product types that would be created ───────────────────────────────

  const newTypes = (() => {
    const typeHeader = mappedField('product_type');
    if (!typeHeader) return [];
    const types = [...new Set(rows.map(r => r[typeHeader]?.trim().toUpperCase()).filter(Boolean))];
    return types;
  })();

  // ── Build payload ──────────────────────────────────────────────────────────

  const buildPayload = (): CreateProductData[] => {
    return rows.map(row => {
      const get = (field: ProductField) => {
        const h = headers.find(header => mapping[header] === field);
        return h ? row[h]?.trim() : undefined;
      };
      const parseNum = (v?: string) => v && !isNaN(parseFloat(v)) ? parseFloat(v) : undefined;
      const parseBool = (v?: string) => {
        if (!v) return undefined;
        return ['true', 'yes', '1'].includes(v.toLowerCase());
      };

      return {
        name: get('name') || '',
        sku: get('sku') || undefined,
        barcode: get('barcode') || undefined,
        product_type: get('product_type') || undefined,
        unit_of_measure: get('unit_of_measure') || undefined,
        list_price: parseNum(get('list_price')),
        sale_price: parseNum(get('sale_price')),
        tax_rate: parseNum(get('tax_rate')),
        track_inventory: parseBool(get('track_inventory')),
      } as CreateProductData;
    });
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    try {
      const payload = buildPayload();
      const res = await productService.bulkImport(payload);
      setResult(res);
      onImported();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // ── Modal footer ───────────────────────────────────────────────────────────

  const footer = (() => {
    if (step === 1) return null;
    if (result) {
      return (
        <div className="flex justify-end">
          <Button onClick={handleClose} className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold">
            Done
          </Button>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="flex justify-between items-center w-full">
          <Button variant="outline" onClick={() => setStep(1)} leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
            Back
          </Button>
          <Button
            onClick={() => setStep(3)}
            disabled={!nameIsMapped}
            className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold"
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
          >
            Review Import
          </Button>
        </div>
      );
    }
    // step 3
    return (
      <div className="flex justify-between items-center w-full">
        <Button variant="outline" onClick={() => setStep(2)} leftIcon={<ArrowLeftIcon className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          onClick={handleImport}
          isLoading={importing}
          className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg"
          leftIcon={<ArrowUpTrayIcon className="w-4 h-4" />}
        >
          Start Import
        </Button>
      </div>
    );
  })();

  // ── Step indicator ─────────────────────────────────────────────────────────

  const StepDot = ({ n, label }: { n: number; label: string }) => {
    const active = step === n;
    const done = step > n || !!result;
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
          ${done ? 'bg-emerald-500 text-white' : active ? 'bg-secondary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {done ? '✓' : n}
        </div>
        <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-secondary-600' : 'text-gray-400'}`}>{label}</span>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-secondary-500 rounded-lg">
            <ArrowUpTrayIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold">Import Products</span>
          {/* Step indicators */}
          <div className="flex items-center gap-2 ml-4">
            <StepDot n={1} label="Upload" />
            <div className="w-6 h-px bg-gray-300" />
            <StepDot n={2} label="Map Columns" />
            <div className="w-6 h-px bg-gray-300" />
            <StepDot n={3} label="Review" />
          </div>
        </div>
      }
      size="xl"
      footer={footer}
    >
      {/* ── STEP 1: File Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload a <strong>CSV</strong> or <strong>Excel (.xlsx / .xls)</strong> file. The first row must be column headers.</p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
              ${dragging
                ? 'border-secondary-500 bg-secondary-50 scale-[1.01]'
                : 'border-gray-300 bg-gray-50 hover:border-secondary-400 hover:bg-secondary-50/40'
              }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
              ${dragging ? 'bg-secondary-100' : 'bg-gray-100'}`}>
              <ArrowUpTrayIcon className={`w-7 h-7 ${dragging ? 'text-secondary-500' : 'text-gray-400'}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Drag & drop your file here</p>
              <p className="text-xs text-gray-500 mt-1">or <span className="text-secondary-600 font-semibold underline">click to browse</span></p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {['CSV', 'XLSX', 'XLS'].map(ext => (
                <span key={ext} className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-500 shadow-sm">{ext}</span>
              ))}
              <span className="text-[10px] text-gray-400">· Max 50 MB</span>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
          </div>

          {/* Template hint */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <SparklesIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Column headers are auto-detected. Supported names include: <em>Name, SKU, Barcode, Category, Price, Sale Price, Tax Rate</em>, and more.
              You'll be able to adjust the mapping in the next step.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {step === 2 && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                <DocumentTextIcon className="w-4 h-4 inline mr-1 text-secondary-500" />
                {fileName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{rows.length} data rows detected · {headers.length} columns</p>
            </div>
            {!nameIsMapped && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">Map "Product Name" to continue</span>
              </div>
            )}
          </div>

          {/* Mapping table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-gray-50 border-b border-gray-200 px-4 py-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">File Column</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center px-4">→</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Maps To Field</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {headers.map(header => (
                <div key={header} className="grid grid-cols-[1fr_auto_1fr] gap-0 items-center px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate" title={header}>{header}</span>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-gray-300 mx-4 flex-shrink-0" />
                  <select
                    value={mapping[header] || ''}
                    onChange={(e) => setMapping(prev => ({ ...prev, [header]: e.target.value as ProductField }))}
                    className={`w-full text-sm px-2.5 py-1.5 border-2 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all font-medium
                      ${mapping[header] === 'skip' || !mapping[header]
                        ? 'border-gray-200 bg-gray-50 text-gray-400'
                        : mapping[header] === 'name'
                          ? 'border-secondary-300 bg-secondary-50 text-secondary-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                  >
                    {PRODUCT_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data preview */}
          {previewRows.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview (first {previewRows.length} rows)</p>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                          {h}
                          {mapping[h] && mapping[h] !== 'skip' && (
                            <span className="ml-1 text-secondary-500">({mapping[h]})</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[140px] truncate" title={row[h]}>{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Review & Confirm / Results ── */}
      {step === 3 && (
        <div className="space-y-4">
          {!result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-xl text-center">
                  <p className="text-3xl font-bold text-secondary-700">{rows.length}</p>
                  <p className="text-xs font-semibold text-secondary-600 mt-1">Rows to Import</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-3xl font-bold text-amber-700">{newTypes.length}</p>
                  <p className="text-xs font-semibold text-amber-600 mt-1">New Product Types</p>
                </div>
              </div>

              {newTypes.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700">These new product types will be auto-created:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {newTypes.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-white border border-amber-300 rounded-full text-xs font-semibold text-amber-800">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapped fields summary */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Column Mapping Summary</p>
                {headers
                  .filter(h => mapping[h] && mapping[h] !== 'skip')
                  .map(h => (
                    <div key={h} className="flex items-center gap-2 text-xs">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-500">{h}</span>
                      <ArrowRightIcon className="w-3 h-3 text-gray-300" />
                      <span className="font-semibold text-gray-700">{PRODUCT_FIELDS.find(f => f.value === mapping[h])?.label}</span>
                    </div>
                  ))
                }
              </div>
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-3xl font-bold text-emerald-600">{result.created}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Created</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-3xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs font-semibold text-amber-600 mt-1">Skipped</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-3xl font-bold text-red-500">{result.errors.length}</p>
                  <p className="text-xs font-semibold text-red-500 mt-1">Errors</p>
                </div>
              </div>

              {result.created > 0 && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">
                    Successfully imported {result.created} product{result.created !== 1 ? 's' : ''}!
                  </span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-700">Issues ({result.errors.length})</span>
                  </div>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                        <XMarkIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
