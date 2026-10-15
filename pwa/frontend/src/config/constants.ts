/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers throughout the codebase
 */

// Debounce delays (in milliseconds)
export const DEBOUNCE_DELAY = 300;
export const SEARCH_DEBOUNCE_DELAY = 300;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Rate limits (from backend, for reference)
export const AUTH_RATE_LIMIT_MAX = 5; // 5 attempts per 15 minutes
export const API_RATE_LIMIT_MAX = 100; // 100 requests per 15 minutes
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Input validation limits
export const INPUT_LIMITS = {
  // User inputs
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  FULL_NAME_MAX_LENGTH: 100,
  
  // Product inputs
  PRODUCT_NAME_MAX_LENGTH: 200,
  SKU_MAX_LENGTH: 50,
  BARCODE_MAX_LENGTH: 50,
  ISBN_MAX_LENGTH: 17, // ISBN-13 format
  DESCRIPTION_MAX_LENGTH: 1000,
  
  // Customer/Supplier inputs
  CUSTOMER_NAME_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  EMAIL_MAX_LENGTH: 100,
  ADDRESS_MAX_LENGTH: 500,
  NOTES_MAX_LENGTH: 1000,
  
  // Store inputs
  STORE_CODE_MAX_LENGTH: 20,
  STORE_NAME_MAX_LENGTH: 100,
  STORE_ADDRESS_MAX_LENGTH: 500,
  TIMEZONE_MAX_LENGTH: 50,
  CURRENCY_CODE_MAX_LENGTH: 3,
  RECEIPT_HEADER_MAX_LENGTH: 500,
  RECEIPT_FOOTER_MAX_LENGTH: 500,
  
  // Terminal inputs
  TERMINAL_CODE_MAX_LENGTH: 20,
  TERMINAL_NAME_MAX_LENGTH: 100,
  
  // Purchase/Sale inputs
  PO_NUMBER_MAX_LENGTH: 50,
  
  // Numeric limits
  PRICE_MIN: 0,
  PRICE_MAX: 999999.99,
  QUANTITY_MIN: 0,
  QUANTITY_MAX: 999999,
  TAX_RATE_MIN: 0,
  TAX_RATE_MAX: 100,
  LOW_STOCK_THRESHOLD_MIN: 0,
  LOW_STOCK_THRESHOLD_MAX: 9999,
} as const;

// Request size limits
export const REQUEST_SIZE_LIMIT = '10mb';

// Timeout values (in milliseconds)
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const CONNECTION_TIMEOUT = 2000; // 2 seconds

// Database pool settings
export const DB_POOL_MAX = 20;
export const DB_IDLE_TIMEOUT_MS = 30000; // 30 seconds

// JWT settings (for reference)
export const JWT_EXPIRATION_HOURS = 24;

// Date/Time formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const TIME_FORMAT = 'HH:mm:ss';

// Default values
export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_THEME = 'classic';
export const DEFAULT_PAPER_SIZE = '80mm';
export const DEFAULT_BACKUP_FREQUENCY = 'daily';
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

