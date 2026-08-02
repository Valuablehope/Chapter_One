import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};

export const uploadProductImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Store's "Scan to Pay" QR code image (uploaded from the payment app, e.g. Whish Money) —
// printed as-is on the Modern receipt template, never regenerated/re-encoded.
const qrUploadDir = path.join(__dirname, '../../uploads/receipt-qr');
if (!fs.existsSync(qrUploadDir)) {
  fs.mkdirSync(qrUploadDir, { recursive: true });
}

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, qrUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-qr-' + uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadReceiptQrImage = multer({
  storage: qrStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Store's logo image, printed at the top of both the Classic and Modern receipt templates.
const logoUploadDir = path.join(__dirname, '../../uploads/receipt-logo');
if (!fs.existsSync(logoUploadDir)) {
  fs.mkdirSync(logoUploadDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadReceiptLogoImage = multer({
  storage: logoStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
