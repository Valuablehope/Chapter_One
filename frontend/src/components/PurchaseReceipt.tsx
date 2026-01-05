import { StoreSettings } from '../services/storeService';
import { Supplier } from '../services/supplierService';
import { PurchaseOrder } from '../services/purchaseService';
import { logger } from '../utils/logger';

interface PurchaseReceiptProps {
    settings: StoreSettings | null;
    purchaseOrder: PurchaseOrder;
    supplier: Supplier | null;
}

export default function PurchaseReceipt({
    settings,
    purchaseOrder,
    supplier,
}: PurchaseReceiptProps) {
    // Currency formatter
    const formatCurrency = (amount: number) => {
        const currency = settings?.currency_code || 'USD';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // Date formatter
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!purchaseOrder) return null;

    return (
        <div className="bg-white print:shadow-none">
            <div className="receipt-container-po max-w-md mx-auto p-8 print:p-6 bg-white">

                {/* Modern Header */}
                <div className="text-center mb-8 relative">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-secondary-500 rounded-full"></div>
                    <div className="pt-6 border-b-2 border-gray-200 pb-6">
                        {settings?.receipt_header ? (
                            <div className="text-sm text-black whitespace-pre-line mb-2 leading-relaxed">
                                {settings.receipt_header}
                            </div>
                        ) : (
                            <>
                                <h1 className="text-4xl font-extrabold text-black mb-3 tracking-tight">
                                    {(settings?.name && settings.name.trim()) ? settings.name : (settings?.code ? settings.code : 'Store')}
                                </h1>
                                {settings?.address && (
                                    <p className="text-sm text-black leading-relaxed">{settings.address}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Purchase Order Info */}
                <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-4 border border-black">
                    <div className="flex justify-between items-center">
                        <span className="text-black font-medium">PO Number</span>
                        <span className="font-mono font-bold text-black text-base tracking-wider">
                            {purchaseOrder.po_number || 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-black font-medium">Date</span>
                        <span className="text-black font-semibold">
                            {formatDate(purchaseOrder.ordered_at || new Date().toISOString())}
                        </span>
                    </div>
                    {purchaseOrder.expected_at && (
                        <div className="flex justify-between items-center">
                            <span className="text-black font-medium">Expected Delivery</span>
                            <span className="text-black font-semibold">
                                {new Date(purchaseOrder.expected_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-black font-medium">Status</span>
                        <span className="font-bold text-black">
                            {purchaseOrder.status}
                        </span>
                    </div>
                    {supplier && (
                        <div className="mt-4 pt-4 border-t border-black">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-black font-medium">Supplier</span>
                                <span className="font-bold text-black">
                                    {supplier.name}
                                </span>
                            </div>
                            {supplier.phone && (
                                <div className="flex justify-between items-center">
                                    <span className="text-black font-medium">Phone</span>
                                    <span className="text-black">{supplier.phone}</span>
                                </div>
                            )}
                            {supplier.contact_name && (
                                <div className="flex justify-between items-center">
                                    <span className="text-black font-medium">Contact</span>
                                    <span className="text-black">{supplier.contact_name}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="mb-8">
                    <div className="border-t-2 border-b-2 border-black py-4">
                        <div className="space-y-4">
                            {purchaseOrder.items.map((item, index) => {
                                const lineTotal = item.qty_ordered * item.unit_cost;
                                return (
                                    <div key={index} className="flex justify-between items-start gap-4 pb-3 border-b border-black last:border-0 last:pb-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-black text-base leading-snug">
                                                {item.product_name || `Product ID: ${item.product_id.substring(0, 8)}...`}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-black">
                                                <span className="font-mono">
                                                    {item.qty_ordered} × {formatCurrency(item.unit_cost)}
                                                </span>
                                                {item.qty_received > 0 && item.qty_received !== item.qty_ordered && (
                                                    <span className="px-2 py-0.5 text-black rounded font-medium">
                                                        Received: {item.qty_received}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-black text-base">
                                                {formatCurrency(lineTotal)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Totals */}
                <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-5 border-2 border-black shadow-sm">
                    <div className="flex justify-between items-center pt-3 border-t-2 border-black">
                        <span className="text-lg font-bold text-black">Total Cost</span>
                        <span className="text-2xl font-extrabold text-black">{formatCurrency(Number(purchaseOrder.total_cost))}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center space-y-4 border-t-2 border-black pt-6">
                    {settings?.receipt_footer ? (
                        <div className="whitespace-pre-line text-sm text-black leading-relaxed">
                            {settings.receipt_footer}
                        </div>
                    ) : (
                        <>
                            <p className="font-semibold text-black text-base">Thank you for your business!</p>
                            <p className="text-sm text-black">Have a great day!</p>
                        </>
                    )}

                    {/* Cubiq Solutions Branding */}
                    <div className="mt-8 pt-6 border-t border-black">
                        <div className="flex flex-col items-center justify-center space-y-3">
                            <img
                                src="/cubiq-logo.jpg"
                                alt="Cubiq Solutions"
                                className="h-16 w-auto object-contain opacity-90 print:opacity-100 max-w-xs"
                                onError={(e) => {
                                    // Fallback if image doesn't exist
                                    logger.error('Failed to load logo image:', e);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="text-center">
                                <a
                                    href="https://www.cubiq-solutions.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-black hover:text-blue-700 transition-colors print:text-black print:no-underline"
                                >
                                    www.cubiq-solutions.com
                                </a>
                                <p className="text-xs text-black mt-1 print:text-black">
                                    Digital Innovation Agency
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
