# Login Troubleshooting Guide

## Issue: Login Failing with "Invalid username or password"

The database connection is working, but login is failing. This is likely because:
1. The password in the database doesn't match what you're entering
2. The password hash format might be incompatible

## Available Users from Database

From your backup, these users exist:
- **Username:** `test` (System Admin, admin role)
- **Username:** `admin` (System Administrator, admin role)  
- **Username:** `cashier` (Default Cashier, cashier role)

## Solution: Create/Reset a Test User

I've created a utility script to help you create or reset a user with a known password.

### Option 1: Create/Reset Admin User

From the root directory, run:

```bash
cd backend
npm run create-user admin admin123 "System Administrator" admin
```

This will:
- Create or update user `admin`
- Set password to `admin123`
- Set role to `admin`

### Option 2: Create/Reset Any User

```bash
cd backend
npm run create-user <username> <password> "<full name>" <role>
```

Examples:
```bash
# Create admin user
npm run create-user admin admin123 "Admin User" admin

# Create cashier user
npm run create-user cashier cashier123 "Cashier User" cashier

# Create manager user
npm run create-user manager manager123 "Manager User" manager
```

### Option 3: Manual Database Update

If you prefer to update directly in the database:

```sql
-- Update admin password to 'admin123'
UPDATE app_users 
SET password_hash = '$2a$12$YourHashedPasswordHere' 
WHERE username = 'admin';
```

To generate a new password hash, you can use the create-user script or Node.js:

```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('yourpassword', 12);
console.log(hash);
```

## Testing Login

After creating/resetting a user, try logging in with:
- **Username:** `admin`
- **Password:** `admin123` (or whatever you set)

## Debug Information

The login controller now:
- Searches users case-insensitively
- Provides better error logging
- Shows which step failed (user not found vs password mismatch)

Check the backend console for detailed error messages.

## Next Steps

1. Run the create-user script to set a known password
2. Try logging in with the new credentials
3. If it still fails, check the backend console for detailed error messages

---

**Note:** The password hashes in your database backup are bcrypt hashes, but we don't know the original passwords. The create-user script will generate new hashes with the current bcrypt configuration.











