-- =====================================================
-- Migration: Add self_checkout role to app_users
-- =====================================================

-- Drop old constraint
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

-- Add new constraint with self_checkout
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
  CHECK (role IN ('cashier', 'manager', 'admin', 'self_checkout'));
