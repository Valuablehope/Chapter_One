# Licensing System Implementation

## Overview

The licensing system has been implemented to support yearly subscriptions and prevent unauthorized use on other devices. The system uses device fingerprinting and license key validation to ensure each installation is properly licensed.

## Architecture

### Backend Components

1. **LicenseModel** (`backend/src/models/LicenseModel.ts`)
   - Manages license data and validation logic
   - Supports validation by `store_id` or `license_key`
   - Handles device activation and tracking
   - Logs validation attempts for audit purposes

2. **LicenseController** (`backend/src/controllers/licenseController.ts`)
   - API endpoints for license operations
   - Validation, activation, renewal, and information retrieval

3. **License Routes** (`backend/src/routes/license.ts`)
   - `/api/license/validate` - Validate by license key
   - `/api/license/validate/store` - Validate by store ID
   - `/api/license/activate` - Activate device
   - `/api/license/store/:store_id` - Get license info
   - `/api/license/store/:store_id/renew` - Renew license

4. **Device Fingerprint Utility** (`backend/src/utils/deviceFingerprint.ts`)
   - Generates unique device identifiers using system information

### Frontend Components

1. **LicenseService** (`frontend/src/services/licenseService.ts`)
   - API client for license operations

2. **LicenseStore** (`frontend/src/store/licenseStore.ts`)
   - Zustand store for license state management
   - Persists license data to localStorage
   - Handles validation and activation logic

3. **LicenseActivation** (`frontend/src/pages/LicenseActivation.tsx`)
   - UI for entering and activating license keys

4. **LicenseGuard** (`frontend/src/components/LicenseGuard.tsx`)
   - Protects all routes, requiring valid license before access
   - Shows activation screen if license is invalid

5. **Device Fingerprint Utility** (`frontend/src/utils/deviceFingerprint.ts`)
   - Generates device fingerprint using browser APIs

## Database Schema

The system uses the existing `licenses` table with `store_id` as the primary key. Additional tables:

- **device_activations**: Tracks activated devices per license
- **license_validations**: Audit log of validation attempts

## Usage

### Creating a License

Use the provided script to create licenses for stores:

```bash
npm run create-license <store_id> [customer_name] [customer_email] [subscription_type] [max_devices]
```

**Example:**
```bash
npm run create-license 123e4567-e89b-12d3-a456-426614174000 "John Doe" "john@example.com" yearly 2
```

**Parameters:**
- `store_id` (required): UUID of the store
- `customer_name` (optional): Customer name
- `customer_email` (optional): Customer email
- `subscription_type` (optional): `yearly`, `monthly`, or `lifetime` (default: `yearly`)
- `max_devices` (optional): Maximum number of devices (default: 1)

### License Activation Flow

1. User launches the application
2. `LicenseGuard` checks if a valid license exists
3. If invalid or missing, shows `LicenseActivation` screen
4. User enters license key
5. System validates and activates the device
6. User can now access the application

### License Validation

The system validates licenses:
- On application startup
- Every hour while the app is running
- Before accessing protected routes

### Offline Grace Period

If a license was validated within the last 24 hours, the app will work offline without re-validation. This provides a grace period for network issues.

## Features

- ✅ Device fingerprinting for unique device identification
- ✅ License key-based activation
- ✅ Store-based license management
- ✅ Device limit enforcement
- ✅ Expiry date checking
- ✅ Automatic renewal support
- ✅ Validation audit logging
- ✅ Offline grace period (24 hours)
- ✅ Persistent license storage

## Security Considerations

1. **Device Fingerprinting**: Uses multiple system characteristics to create a unique identifier
2. **License Key Format**: Generated as hexadecimal with dashes (e.g., `A1B2-C3D4-E5F6-...`)
3. **Validation Logging**: All validation attempts are logged for security auditing
4. **Device Limits**: Prevents license sharing by limiting active devices per license

## API Endpoints

### Validate License (by Key)
```http
POST /api/license/validate
Content-Type: application/json

{
  "license_key": "A1B2-C3D4-E5F6-...",
  "device_fingerprint": "abc123..."
}
```

### Validate License (by Store)
```http
POST /api/license/validate/store
Content-Type: application/json

{
  "store_id": "123e4567-e89b-12d3-a456-426614174000",
  "device_fingerprint": "abc123..."
}
```

### Activate Device
```http
POST /api/license/activate
Content-Type: application/json

{
  "store_id": "123e4567-e89b-12d3-a456-426614174000",
  "device_fingerprint": "abc123...",
  "device_name": "Windows PC",
  "device_info": {...}
}
```

## Troubleshooting

### License Not Activating
- Verify the license key is correct
- Check that the store_id exists in the database
- Ensure the license hasn't expired
- Verify device limit hasn't been reached

### Validation Failing
- Check network connectivity
- Verify database connection
- Review validation logs in `license_validations` table
- Ensure license status is 'active' and `valid` is `true`

## Next Steps

1. Run the SQL script provided earlier to set up the database tables
2. Create a license for your store using the `create-license` script
3. Test the activation flow in the application
4. Monitor validation logs for any issues











