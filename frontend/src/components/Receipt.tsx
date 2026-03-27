import { StoreSettings } from '../services/storeService';
import { receiptPrintTitle } from '../constants/branding';
import { Customer } from '../services/customerService';
import { CartItem } from '../services/saleService';
import { logger } from '../utils/logger';

interface ReceiptProps {
    settings: StoreSettings | null;
    sale: any;
    customer: Customer | null;
    items: CartItem[];
}

export default function Receipt({
    settings,
    sale,
    customer,
    items,
}: ReceiptProps) {
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

    // Date formatter with timezone
    const formatDate = (dateString: string) => {
        const timezone = settings?.timezone || 'UTC';
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: timezone,
            }).format(date);
        } catch (error) {
            // Fallback to local time if timezone is invalid
            return new Date(dateString).toLocaleString();
        }
    };

    if (!sale) return null;

    return (
        <div className="bg-white print:shadow-none">
            <div className="receipt-container max-w-md mx-auto p-8 print:p-6 bg-white">

                {/* Modern Header with gradient accent */}
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
                                    {receiptPrintTitle(settings?.name, settings?.code)}
                                </h1>
                                {settings?.address && (
                                    <p className="text-sm text-black leading-relaxed">{settings.address}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Receipt Info - Modern card style */}
                <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-4 border border-black">
                    <div className="flex justify-between items-center">
                        <span className="text-black font-medium">Receipt #</span>
                        <span className="font-mono font-bold text-black text-base tracking-wider">
                            {sale.receipt_no}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-black font-medium">Date</span>
                        <span className="text-black font-semibold">
                            {formatDate(sale.created_at)}
                        </span>
                    </div>
                    {customer && (
                        <div className="mt-4 pt-4 border-t border-black">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-black font-medium">Customer</span>
                                <span className="font-bold text-black">
                                    {customer.full_name || 'Unnamed Customer'}
                                </span>
                            </div>
                            {customer.phone && (
                                <div className="flex justify-between items-center">
                                    <span className="text-black font-medium">Phone</span>
                                    <span className="text-black">{customer.phone}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Items List - Enhanced with better spacing */}
                <div className="mb-8">
                    <div className="border-t-2 border-b-2 border-black py-4">
                        <div className="space-y-4">
                            {items.map((item, index) => {
                                return (
                                    <div key={index} className="flex justify-between items-start gap-4 pb-3 border-b border-black last:border-0 last:pb-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-black text-base leading-snug">
                                                {item.product?.name || (item as any).product_name || 'Unknown Product'}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-black">
                                                <span className="font-mono">
                                                    {Number(item.qty).toString()} × {formatCurrency(Number(item.unit_price))}
                                                </span>
                                                {item.tax_rate && Number(item.tax_rate) > 0 && (
                                                    <span className="px-2 py-0.5 text-black rounded font-medium">
                                                        Tax: {Number(item.tax_rate)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-black text-base">
                                                {formatCurrency(Number(item.line_total))}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Totals - Enhanced with visual hierarchy */}
                <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-5 border-2 border-black shadow-sm">
                    {settings?.tax_inclusive ? (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-black font-medium">Merchandise (tax included in prices)</span>
                                <span className="text-black font-semibold">
                                    {formatCurrency(Number(sale.subtotal) + Number(sale.tax_total))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-700">
                                <span>Net / Tax breakdown</span>
                                <span className="text-right font-mono">
                                    {formatCurrency(Number(sale.subtotal))} + {formatCurrency(Number(sale.tax_total))}
                                </span>
                            </div>
                            {Number(sale.discount_total) > 0 && (
                                <div className="flex justify-between items-center text-black pb-2">
                                    <span className="font-medium">Discount{sale.discount_rate ? ` (${sale.discount_rate}%)` : ''}</span>
                                    <span className="font-bold">-{formatCurrency(Number(sale.discount_total))}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-3 border-t-2 border-black">
                                <span className="text-lg font-bold text-black">Total (tax inclusive)</span>
                                <span className="text-2xl font-extrabold text-black">{formatCurrency(Number(sale.grand_total))}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-black font-medium">Subtotal</span>
                                <span className="text-black font-semibold">{formatCurrency(Number(sale.subtotal))}</span>
                            </div>
                            {Number(sale.tax_total) > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-black font-medium">Tax</span>
                                    <span className="text-black font-semibold">{formatCurrency(Number(sale.tax_total))}</span>
                                </div>
                            )}
                            {Number(sale.discount_total) > 0 && (
                                <div className="flex justify-between items-center text-black">
                                    <span className="font-medium">Discount{sale.discount_rate ? ` (${sale.discount_rate}%)` : ''}</span>
                                    <span className="font-bold">-{formatCurrency(Number(sale.discount_total))}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-3 border-t-2 border-black">
                                <span className="text-lg font-bold text-black">Total</span>
                                <span className="text-2xl font-extrabold text-black">{formatCurrency(Number(sale.grand_total))}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Payment - Enhanced styling */}
                <div className="mb-8 space-y-2 text-sm bg-white rounded-xl p-4 border border-black">
                    {sale.payments.map((payment: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                            <span className="text-black font-medium capitalize">
                                {payment.method} Payment
                            </span>
                            <span className="font-bold text-black">
                                {formatCurrency(payment.amount)}
                            </span>
                        </div>
                    ))}
                    {Number(sale.payments[0]?.amount || 0) > Number(sale.grand_total) && (
                        <div className="flex justify-between items-center pt-3 mt-2 border-t border-black">
                            <span className="font-bold text-black">Change</span>
                            <span className="font-extrabold text-xl text-black">
                                {formatCurrency((Number(sale.payments[0]?.amount || 0) - Number(sale.grand_total)))}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer - Enhanced with modern styling */}
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
                            {/* Logo Image */}
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
                            {/* Website URL */}
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
