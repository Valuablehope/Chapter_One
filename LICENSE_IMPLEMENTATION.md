# License & Subscription System Implementation

## Overview

A complete trial and yearly subscription system has been implemented with record count restrictions for trial users. The system allows users to log in and use basic functionalities but limits the number of records they can create during the trial period.

## Features

### ✅ Trial Mode
- **30-day trial period** (configurable in database)
- **Record count limits:**
  - Products: 50
  - Customers: 50
  - Sales: 100
  - Purchase Orders: 50
  - Suppliers: 10
  - Users: 3
- Users can **view all existing records** and use basic features
- **Graceful error messages** when limits are reached
- **Trial banner** showing days remaining and usage statistics

### ✅ Yearly Subscription
- **Full access** with no record limits
- **License key activation** system
- **Device fingerprinting** for security
- **Expiry date tracking** with renewal reminders

### ✅ User Experience
- **Non-blocking**: Users can always log in
- **Clear messaging**: Shows trial status and limits
- **Upgrade prompts**: Easy path to activate yearly subscription
- **Offline support**: 24-48 hour grace period for license validation

## Database Tables Used

The system uses your existing tables:

1. **`licenses`** - Stores license information
   - `store_id` (UUID, primary key)
   - `license_key` (VARCHAR, unique)
   - `subscription_type` ('trial', 'yearly', 'lifetime')
   - `status` ('active', 'expired', 'suspended')
   - `start_date`, `expiry_date`
   - `max_devices`
   - `valid` (boolean)

2. **`device_activations`** - Tracks activated devices
   - `license_id`, `store_id`
   - `device_fingerprint`
   - `device_name`, `device_info`
   - `is_active`, `activated_at`, `last_validated_at`

3. **`license_validations`** - Audit log
   - `license_id`, `store_id`
   - `device_fingerprint`
   - `validation_result`
   - `validation_date`, `ip_address`, `user_agent`

## Backend Implementation

### Files Created

1. **`backend/src/models/LicenseModel.ts`**
   - License status checking
   - Record count tracking
   - Device activation/validation
   - Trial limit enforcement

2. **`backend/src/middleware/licenseCheck.ts`**
   - `checkLicense()` - Validates license status
   - `checkRecordLimit()` - Enforces record limits before creation

3. **`backend/src/controllers/licenseController.ts`**
   - `getLicenseInfo()` - Returns license status and record counts
   - `activateLicense()` - Activates license with key
   - `validateDevice()` - Validates device fingerprint

4. **`backend/src/routes/license.ts`**
   - `GET /api/license/info` - Get license information
   - `POST /api/license/activate` - Activate license
   - `POST /api/license/validate` - Validate device

### Routes Updated

All create endpoints now include license checks:
- `POST /api/products` - Checks product limit
- `POST /api/customers` - Checks customer limit
- `POST /api/sales` - Checks sale limit
- `POST /api/purchases` - Checks purchase limit
- `POST /api/suppliers` - Checks supplier limit
- `POST /api/admin/users` - Checks user limit

## Frontend Implementation

### Files Created

1. **`frontend/src/services/licenseService.ts`**
   - API client for license operations
   - Device fingerprint generation

2. **`frontend/src/store/licenseStore.ts`**
   - Zustand store for license state
   - Persistent storage (localStorage)
   - License checking functions

3. **`frontend/src/components/TrialBanner.tsx`**
   - Displays trial status
   - Shows usage statistics
   - Upgrade button

4. **`frontend/src/components/LicenseActivation.tsx`**
   - License key input form
   - Activation handling
   - Success/error states

### Components Updated

- **`frontend/src/components/Layout.tsx`** - Added TrialBanner component

## Usage

### Creating a Trial License

```sql
-- Create a trial license for a store
INSERT INTO licenses (
  store_id, 
  subscription_type, 
  status, 
  valid,
  start_date, 
  expiry_date,
  max_devices
) VALUES (
  'your-store-id-here',
  'trial',
  'active',
  true,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  1
);
```

### Creating a Yearly Subscription License

```sql
-- Create a yearly subscription license
INSERT INTO licenses (
  store_id,
  license_key,
  subscription_type,
  status,
  valid,
  start_date,
  expiry_date,
  max_devices,
  customer_name,
  customer_email
) VALUES (
  'your-store-id-here',
  'XXXX-XXXX-XXXX-XXXX', -- Generate unique key
  'yearly',
  'active',
  true,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  1,
  'Customer Name',
  'customer@example.com'
);
```

### Activating a License (Frontend)

Users can activate their license by:
1. Navigating to Admin panel (or dedicated license page)
2. Entering their license key
3. System automatically generates device fingerprint
4. License is activated and validated

### Checking License Status

The system automatically checks license status:
- On app startup
- Every hour while app is running
- Before creating new records
- When accessing protected routes

## Error Handling

### Trial Limit Reached

When a trial user tries to create a record beyond the limit:

**Backend Response:**
```json
{
  "success": false,
  "error": {
    "message": "Trial limit reached: 50 products maximum. Please upgrade to continue.",
    "code": "TRIAL_LIMIT_REACHED",
    "limit": 50,
    "current": 50,
    "recordType": "products"
  }
}
```

**Frontend Handling:**
- Error message displayed to user
- Upgrade prompt shown
- Create button disabled (if implemented in UI)

## Configuration

### Trial Limits

Edit `backend/src/models/LicenseModel.ts`:

```typescript
const TRIAL_LIMITS = {
  products: 50,      // Adjust as needed
  customers: 50,
  sales: 100,
  purchases: 50,
  suppliers: 10,
  users: 3,
};
```

### Trial Duration

Set in database when creating trial license:
- Default: 30 days
- Can be adjusted in `expiry_date` field

## Security Features

1. **Device Fingerprinting**: Unique device identification
2. **Server-side Validation**: All checks performed on backend
3. **Audit Logging**: All validation attempts logged
4. **Device Limits**: Prevents license sharing
5. **Offline Grace Period**: 24-48 hours for network issues

## Testing

### Test Trial Limits

1. Create a trial license in database
2. Log in to the application
3. Try creating records up to the limit
4. Verify error message when limit is reached
5. Check trial banner shows correct usage

### Test Yearly Subscription

1. Create a yearly license with a license key
2. Log in to the application
3. Activate license using the license key
4. Verify no record limits are enforced
5. Check license status shows "yearly" subscription

### Test Device Activation

1. Activate license on one device
2. Try activating on another device
3. Verify device limit is enforced
4. Check `device_activations` table for records

## API Endpoints

### Get License Info
```http
GET /api/license/info
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasLicense": true,
    "licenseStatus": {
      "isValid": true,
      "subscriptionType": "trial",
      "status": "active",
      "expiryDate": "2026-01-05",
      "daysRemaining": 15,
      "isTrial": true,
      "isExpired": false
    },
    "recordCounts": {
      "products": 45,
      "customers": 30,
      "sales": 75,
      "purchases": 20,
      "suppliers": 5,
      "users": 2
    },
    "limits": {
      "products": 50,
      "customers": 50,
      "sales": 100,
      "purchases": 50,
      "suppliers": 10,
      "users": 3
    }
  }
}
```

### Activate License
```http
POST /api/license/activate
Authorization: Bearer <token>
Content-Type: application/json

{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceFingerprint": "abc123...",
  "deviceName": "Windows PC",
  "deviceInfo": {...}
}
```

## Troubleshooting

### License Not Found
- Verify `store_id` exists in `licenses` table
- Check that license is linked to correct store

### Trial Limits Not Enforcing
- Verify license `subscription_type` is 'trial'
- Check that `valid` is `true` and `status` is 'active'
- Ensure `expiry_date` is in the future

### Device Activation Failing
- Check `max_devices` limit
- Verify device fingerprint is being generated correctly
- Check `device_activations` table for existing activations

### Record Counts Incorrect
- Verify database queries in `LicenseModel.getRecordCounts()`
- Check that `store_id` is correctly linked to records

## Next Steps

1. **License Key Generation**: Create a script to generate unique license keys
2. **Payment Integration**: Integrate with payment processor for subscriptions
3. **Email Notifications**: Send expiry reminders and activation confirmations
4. **Admin Dashboard**: Create UI for managing licenses
5. **Analytics**: Track license usage and conversions

## Notes

- The system is designed to be **non-blocking** - users can always log in
- **Read operations** are never restricted (viewing, searching, reporting)
- Only **create operations** are limited for trial users
- **Yearly subscribers** have unlimited access
- System gracefully handles **missing licenses** (allows usage for backward compatibility)





