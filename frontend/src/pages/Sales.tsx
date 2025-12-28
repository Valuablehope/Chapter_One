import { useState, useEffect, useRef } from 'react';
import { productService, Product } from '../services/productService';
import { customerService, Customer } from '../services/customerService';
import { saleService, CartItem, PaymentMethod } from '../services/saleService';
import { storeService, StoreSettings } from '../services/storeService';
import { logger } from '../utils/logger';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  ShoppingCartIcon,
  UserIcon,
  CurrencyDollarIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  CreditCardIcon,
  BanknotesIcon,
  TicketIcon,
  PrinterIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [receiptCartItems, setReceiptCartItems] = useState<CartItem[]>([]);
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals
  // line_total already includes tax, so we need to calculate subtotal and tax separately
  const subtotal = cart.reduce((sum, item) => {
    const itemSubtotal = Number(item.unit_price) * item.qty;
    return sum + itemSubtotal;
  }, 0);
  const taxTotal = cart.reduce((sum, item) => {
    const itemSubtotal = Number(item.unit_price) * item.qty;
    const tax = item.tax_rate ? (itemSubtotal * Number(item.tax_rate)) / 100 : 0;
    return sum + tax;
  }, 0);
  const grandTotal = subtotal + taxTotal;

  // Search products
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await productService.getProducts({
        search: query,
        limit: 10,
      });
      setSearchResults(response.data);
    } catch (err: any) {
      toast.error('Failed to search products');
      logger.error('Error searching products:', err);
    } finally {
      setSearching(false);
    }
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    try {
      const product = await productService.getProductByBarcode(barcode);
      addToCart(product);
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = '';
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error(`Product with barcode ${barcode} not found`);
      } else {
        toast.error('Failed to lookup product by barcode');
      }
    }
  };

  // Add product to cart
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.product_id === product.product_id);

    if (existingItem) {
      // Increase quantity
      updateCartItemQuantity(existingItem.product.product_id, existingItem.qty + 1);
    } else {
      // Add new item
      const price = Number(product.sale_price || product.list_price || 0);
      const taxRate = Number(product.tax_rate || 0);
      // line_total is the total including tax for the current quantity
      const lineTotal = price * (1 + taxRate / 100);

      setCart([
        ...cart,
        {
          product,
          qty: 1,
          unit_price: price,
          tax_rate: taxRate,
          line_total: lineTotal,
        },
      ]);
    }

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    // Focus barcode input instead of search
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Update cart item quantity
  const updateCartItemQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) => {
        if (item.product.product_id === productId) {
          // Calculate line total: unit_price * qty * (1 + tax_rate/100)
          const lineTotal = Number(item.unit_price) * qty * (1 + (Number(item.tax_rate) || 0) / 100);
          return { ...item, qty, line_total: lineTotal };
        }
        return item;
      })
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.product_id !== productId));
  };

  // Search customers
  const handleCustomerSearch = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }

    try {
      const response = await customerService.getCustomers({
        search: query,
        limit: 10,
      });
      setCustomerResults(response.data);
    } catch (err: any) {
      toast.error('Failed to search customers');
      logger.error('Error searching customers:', err);
    }
  };

  // Select customer
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  // Open payment modal
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPaymentAmount(grandTotal.toFixed(2));
    setShowPaymentModal(true);
  };

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < grandTotal) {
      toast.error(`Payment amount must be at least $${grandTotal.toFixed(2)}`);
      return;
    }

    try {
      setProcessing(true);

      const saleData = {
        customer_id: selectedCustomer?.customer_id,
        items: cart.map((item) => ({
          product_id: item.product.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
        payments: [
          {
            method: paymentMethod,
            amount: amount,
          },
        ],
      };

      const sale = await saleService.createSale(saleData);
      setCompletedSale(sale);
      setReceiptCartItems([...cart]); // Store cart items for receipt
      setReceiptCustomer(selectedCustomer); // Store customer for receipt
      setShowPaymentModal(false);
      toast.success('Sale completed successfully!');
      
      // Clear cart and customer
      setCart([]);
      setSelectedCustomer(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to process payment');
      logger.error('Error processing payment:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Start new sale
  const startNewSale = () => {
    setCompletedSale(null);
    setReceiptCartItems([]);
    setReceiptCustomer(null);
    setCart([]);
    setSelectedCustomer(null);
    // Focus barcode input instead of search
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Print receipt
  const handlePrint = () => {
    window.print();
  };

  // Fetch store settings when sale completes
  useEffect(() => {
    if (completedSale?.store_id) {
      storeService.getStoreSettings(completedSale.store_id)
        .then((settings) => {
          // Merge with defaults since not all columns exist in DB
          setStoreSettings({
            store_id: settings.store_id,
            code: settings.code || '',
            name: settings.name || 'Chapter One',
            address: settings.address,
            // Use defaults for settings that don't exist in DB
            currency_code: settings.currency_code || 'USD',
            tax_inclusive: settings.tax_inclusive ?? false,
            theme: settings.theme || 'classic',
            timezone: settings.timezone || 'UTC',
            tax_rate: settings.tax_rate || 0,
            receipt_footer: settings.receipt_footer || '',
            receipt_header: settings.receipt_header || '',
            auto_backup: settings.auto_backup ?? false,
            backup_frequency: settings.backup_frequency || 'daily',
          });
        })
        .catch((err) => {
          logger.error('Failed to fetch store settings:', err);
          // Set defaults if fetch fails
          setStoreSettings({
            store_id: completedSale.store_id,
            code: '',
            name: 'Chapter One',
            currency_code: 'USD',
            tax_inclusive: false,
            timezone: 'UTC',
          } as StoreSettings);
        });
    }
  }, [completedSale?.store_id]);

  // Currency formatter
  const formatCurrency = (amount: number) => {
    const currency = storeSettings?.currency_code || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Date formatter with timezone
  const formatDate = (dateString: string) => {
    const timezone = storeSettings?.timezone || 'UTC';
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

  // Focus barcode input on mount (not search - user chooses when to search)
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return <BanknotesIcon className="w-5 h-5" />;
      case 'card':
        return <CreditCardIcon className="w-5 h-5" />;
      case 'voucher':
        return <TicketIcon className="w-5 h-5" />;
      default:
        return <CurrencyDollarIcon className="w-5 h-5" />;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Enhanced Product Search */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <MagnifyingGlassIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Product Search</h2>
              </div>
              
              {/* Barcode Scanner */}
              <div className="mb-3">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <QrCodeIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan or enter barcode..."
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        const barcode = (e.target as HTMLInputElement).value.trim();
                        if (barcode) {
                          handleBarcodeScan(barcode);
                        }
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 ml-3">Press Enter to scan</p>
              </div>

              {/* Product Search */}
              <div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, SKU, or barcode..."
                    className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
                  />
                </div>
              </div>

              {/* Enhanced Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 border-2 border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white shadow-inner">
                  {searchResults.map((product) => (
                    <button
                      key={product.product_id}
                      onClick={() => addToCart(product)}
                      className="w-full px-3 py-2.5 text-left hover:bg-secondary-50 transition-all duration-150 group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <div className="p-1 bg-secondary-100 rounded-lg">
                              <SparklesIcon className="w-3.5 h-3.5 text-secondary-500" />
                            </div>
                            <p className="font-bold text-xs text-gray-900 group-hover:text-secondary-500 transition-colors">{product.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {product.barcode && (
                              <Badge variant="gray" size="sm" className="font-mono text-[10px]">
                                {product.barcode}
                              </Badge>
                            )}
                            {product.sku && (
                              <span className="text-[10px] text-gray-500 font-mono">SKU: {product.sku}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-bold text-sm text-secondary-500">
                            ${Number(product.sale_price || product.list_price || 0).toFixed(2)}
                          </p>
                          {product.track_inventory && (
                            <p className="text-[10px] text-gray-500 mt-0.5">In Stock</p>
                          )}
                          <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 mt-1 ml-auto transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="mt-3 text-center py-3">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-blue-200 border-t-blue-600"></div>
                  <p className="mt-1.5 text-xs text-gray-500 font-medium">Searching...</p>
                </div>
              )}
            </div>
          </Card>

          {/* Enhanced Shopping Cart */}
          <Card padding="none" className="border-2 border-gray-100 shadow-md overflow-hidden">
            <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-secondary-500 rounded-lg">
                    <ShoppingCartIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Shopping Cart</h2>
                    {cart.length > 0 && (
                      <p className="text-xs text-gray-600">{cart.length} {cart.length === 1 ? 'item' : 'items'}</p>
                    )}
                  </div>
                </div>
                {cart.length > 0 && (
                  <Badge variant="success" size="sm" className="font-bold">
                    {cart.reduce((sum, item) => sum + item.qty, 0)} items
                  </Badge>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<ShoppingCartIcon className="w-12 h-12" />}
                  title="Cart is empty"
                  description="Search and add products to get started"
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {cart.map((item) => (
                  <div key={item.product.product_id} className="px-3 py-2.5 hover:bg-secondary-50 transition-all group">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5 mb-1">
                          <div className="p-1 bg-secondary-100 rounded-lg">
                            <SparklesIcon className="w-3.5 h-3.5 text-secondary-500" />
                          </div>
                          <p className="font-bold text-xs text-gray-900">{item.product.name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-gray-600">
                            ${Number(item.unit_price).toFixed(2)} each
                          </span>
                          {Number(item.tax_rate) > 0 && (
                            <Badge variant="info" size="sm">
                              Tax: {Number(item.tax_rate)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-1 border-2 border-gray-200 rounded-lg bg-white">
                          <Button
                            onClick={() => updateCartItemQuantity(item.product.product_id, item.qty - 1)}
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 hover:bg-gray-100"
                          >
                            <MinusIcon className="w-3 h-3" />
                          </Button>
                          <span className="w-10 text-center font-bold text-xs text-gray-900">{item.qty}</span>
                          <Button
                            onClick={() => updateCartItemQuantity(item.product.product_id, item.qty + 1)}
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 hover:bg-gray-100"
                          >
                            <PlusIcon className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <p className="font-bold text-sm text-secondary-500">
                            ${Number(item.line_total).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          onClick={() => removeFromCart(item.product.product_id)}
                          variant="danger"
                          size="sm"
                          className="!p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Customer & Totals */}
        <div className="space-y-3">
          {/* Enhanced Customer Selection */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Customer</h2>
              </div>
              {selectedCustomer ? (
                <div className="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-xs text-gray-900">
                        {selectedCustomer.full_name || 'Unnamed Customer'}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-gray-600 mt-0.5">{selectedCustomer.phone}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => setSelectedCustomer(null)}
                      variant="ghost"
                      size="sm"
                      className="!p-1 hover:bg-white"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowCustomerModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full border-2 hover:bg-sky-50 hover:border-sky-300 transition-all"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  Add Customer
                </Button>
              )}
            </div>
          </Card>

          {/* Enhanced Totals */}
          <Card className="border-2 border-secondary-200 bg-white shadow-lg">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-secondary-500 rounded-lg">
                  <CurrencyDollarIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Totals</h2>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">Subtotal:</span>
                  <span className="font-bold text-xs text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="font-medium text-xs text-gray-700">Tax:</span>
                  <span className="font-bold text-xs text-gray-900">${taxTotal.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-secondary-300 pt-2 mt-2">
                  <div className="flex justify-between items-center p-3 bg-secondary-500 rounded-lg text-white">
                    <span className="text-base font-bold">Total:</span>
                    <span className="text-xl font-extrabold">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={openPaymentModal}
                disabled={cart.length === 0 || processing}
                className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm"
                leftIcon={<CurrencyDollarIcon className="w-4 h-4" />}
                isLoading={processing}
              >
                Process Payment
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Enhanced Customer Selection Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setCustomerSearch('');
          setCustomerResults([]);
        }}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">Select Customer</span>
          </div>
        }
        size="md"
      >
        <div>
          <Input
            type="text"
            value={customerSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setCustomerSearch(e.target.value);
              handleCustomerSearch(e.target.value);
            }}
            placeholder="Search customers..."
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            autoFocus
          />
          <div className="mt-3 max-h-48 overflow-y-auto">
            {customerResults.length > 0 ? (
              <div className="space-y-1.5">
                {customerResults.map((customer) => (
                  <button
                    key={customer.customer_id}
                    onClick={() => selectCustomer(customer)}
                    className="w-full px-3 py-2 text-left hover:bg-secondary-50 border-2 border-gray-200 hover:border-secondary-300 rounded-lg transition-all group"
                  >
                    <div className="flex items-center space-x-1.5">
                      <div className="p-1 bg-secondary-100 rounded-lg">
                        <UserIcon className="w-3.5 h-3.5 text-secondary-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-xs text-gray-900 group-hover:text-secondary-500">
                          {customer.full_name || 'Unnamed Customer'}
                        </p>
                        {customer.phone && (
                          <p className="text-xs text-gray-600 mt-0.5">{customer.phone}</p>
                        )}
                      </div>
                      <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-secondary-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : customerSearch ? (
              <EmptyState
                title="No customers found"
                description="Try a different search term"
              />
            ) : (
              <EmptyState
                title="Search for customers"
                description="Start typing to search"
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Enhanced Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-secondary-500 rounded-lg">
              <CurrencyDollarIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-base">Process Payment</span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowPaymentModal(false)}
              disabled={processing}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={processPayment}
              disabled={processing}
              className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              isLoading={processing}
              leftIcon={getPaymentIcon(paymentMethod)}
            >
              Complete Sale
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card', 'voucher', 'other'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === method
                      ? 'border-secondary-500 bg-secondary-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1.5">
                    <div className={`p-1.5 rounded-lg ${
                      paymentMethod === method
                        ? 'bg-secondary-500'
                        : 'bg-gray-200'
                    }`}>
                      {method === 'cash' && <BanknotesIcon className="w-4 h-4 text-white" />}
                      {method === 'card' && <CreditCardIcon className="w-4 h-4 text-white" />}
                      {method === 'voucher' && <TicketIcon className="w-4 h-4 text-white" />}
                      {method === 'other' && <CurrencyDollarIcon className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`font-semibold text-xs capitalize ${
                      paymentMethod === method ? 'text-secondary-500' : 'text-gray-700'
                    }`}>
                      {method}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Input
              type="number"
              step="0.01"
              min={grandTotal}
              value={paymentAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
              label="Payment Amount"
              leftIcon={<CurrencyDollarIcon className="w-5 h-5" />}
              helperText={`Total due: $${grandTotal.toFixed(2)}`}
            />
          </div>
          <div className="p-3 bg-secondary-50 rounded-lg border-2 border-secondary-200">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-gray-700">Grand Total:</span>
              <span className="text-xl font-extrabold text-secondary-500">${grandTotal.toFixed(2)}</span>
            </div>
            {parseFloat(paymentAmount) > grandTotal && (
              <div className="mt-2 pt-2 border-t border-secondary-300 flex justify-between items-center">
                <span className="font-semibold text-xs text-secondary-700">Change:</span>
                <span className="text-base font-bold text-secondary-500">
                  ${(parseFloat(paymentAmount) - grandTotal).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      {completedSale && (
        <Modal
          isOpen={!!completedSale}
          onClose={startNewSale}
          title=""
          size="lg"
          showCloseButton={false}
          footer={
            <div className="flex gap-3 print:hidden">
              <Button
                onClick={handlePrint}
                className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                leftIcon={<PrinterIcon className="w-5 h-5" />}
              >
                Print Receipt
              </Button>
              <Button
                onClick={startNewSale}
                variant="outline"
                className="flex-1 border-2"
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                New Sale
              </Button>
            </div>
          }
        >
          {/* Enhanced Print Styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .receipt-container, .receipt-container * {
                visibility: visible;
              }
              .receipt-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                max-width: 100%;
                padding: 20px;
                background: white;
              }
              .print\\:hidden {
                display: none !important;
              }
              .modal-content {
                box-shadow: none !important;
                border: none !important;
              }
              @page {
                margin: 0.5cm;
                size: auto;
              }
            }
          `}</style>

          {/* Modern Receipt Content */}
          <div className="bg-white print:shadow-none">
            <div className="receipt-container max-w-md mx-auto p-8 print:p-6 bg-gradient-to-b from-white to-gray-50">
              
              {/* Modern Header with gradient accent */}
              <div className="text-center mb-8 relative">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-secondary-500 rounded-full"></div>
                <div className="pt-6 border-b-2 border-gray-200 pb-6">
                  {storeSettings?.receipt_header ? (
                    <div className="text-sm text-gray-700 whitespace-pre-line mb-2 leading-relaxed">
                      {storeSettings.receipt_header}
                    </div>
                  ) : (
                    <>
                      <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
                        {storeSettings?.name || 'Chapter One'}
                      </h1>
                      {storeSettings?.address && (
                        <p className="text-sm text-gray-600 leading-relaxed">{storeSettings.address}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Receipt Info - Modern card style */}
              <div className="mb-8 space-y-3 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Receipt #</span>
                  <span className="font-mono font-bold text-gray-900 text-base tracking-wider">
                    {completedSale.receipt_no}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Date</span>
                  <span className="text-gray-900 font-semibold">
                    {formatDate(completedSale.created_at)}
                  </span>
                </div>
                {receiptCustomer && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 font-medium">Customer</span>
                      <span className="font-bold text-gray-900">
                        {receiptCustomer.full_name || 'Unnamed Customer'}
                      </span>
                    </div>
                    {receiptCustomer.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Phone</span>
                        <span className="text-gray-900">{receiptCustomer.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items List - Enhanced with better spacing */}
              <div className="mb-8">
                <div className="border-t-2 border-b-2 border-gray-300 py-4">
                  <div className="space-y-4">
                    {receiptCartItems.map((item, index) => {
                      return (
                        <div key={index} className="flex justify-between items-start gap-4 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-base leading-snug">
                              {item.product.name}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                              <span className="font-mono">
                                {item.qty} × {formatCurrency(Number(item.unit_price))}
                              </span>
                              {item.tax_rate && Number(item.tax_rate) > 0 && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                  Tax: {Number(item.tax_rate)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 text-base">
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
              <div className="mb-8 space-y-3 text-sm bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                {storeSettings?.tax_inclusive ? (
                  // Show inclusive pricing
                  <>
                    {Number(completedSale.discount_total) > 0 && (
                      <div className="flex justify-between items-center text-secondary-500 pb-2">
                        <span className="font-medium">Discount</span>
                        <span className="font-bold">-{formatCurrency(Number(completedSale.discount_total))}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                      <span className="text-lg font-bold text-gray-900">Total (Tax Inclusive)</span>
                      <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(Number(completedSale.grand_total))}</span>
                    </div>
                  </>
                ) : (
                  // Show breakdown
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Subtotal</span>
                      <span className="text-gray-900 font-semibold">{formatCurrency(Number(completedSale.subtotal))}</span>
                    </div>
                    {Number(completedSale.tax_total) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Tax</span>
                        <span className="text-gray-900 font-semibold">{formatCurrency(Number(completedSale.tax_total))}</span>
                      </div>
                    )}
                    {Number(completedSale.discount_total) > 0 && (
                      <div className="flex justify-between items-center text-secondary-500">
                        <span className="font-medium">Discount</span>
                        <span className="font-bold">-{formatCurrency(Number(completedSale.discount_total))}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(Number(completedSale.grand_total))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment - Enhanced styling */}
              <div className="mb-8 space-y-2 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                {completedSale.payments.map((payment: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium capitalize">
                      {payment.method} Payment
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
                {Number(completedSale.payments[0]?.amount || 0) > Number(completedSale.grand_total) && (
                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
                    <span className="font-bold text-secondary-500">Change</span>
                    <span className="font-extrabold text-xl text-secondary-500">
                      {formatCurrency((Number(completedSale.payments[0]?.amount || 0) - Number(completedSale.grand_total)))}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer - Enhanced with modern styling */}
              <div className="text-center space-y-4 border-t-2 border-gray-200 pt-6">
                {storeSettings?.receipt_footer ? (
                  <div className="whitespace-pre-line text-sm text-gray-600 leading-relaxed">
                    {storeSettings.receipt_footer}
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-gray-800 text-base">Thank you for your business!</p>
                    <p className="text-sm text-gray-600">Have a great day!</p>
                  </>
                )}
                
                {/* Cubiq Solutions Branding */}
                <div className="mt-8 pt-6 border-t border-gray-200">
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
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors print:text-gray-600 print:no-underline"
                      >
                        www.cubiq-solutions.com
                      </a>
                      <p className="text-xs text-gray-500 mt-1 print:text-gray-400">
                        Digital Innovation Agency
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

