-- =====================================================
-- Add press_to_add to product_types Table
-- =====================================================
-- When enabled on a product type, clicking a product
-- in the Quick Access grid adds it directly to the cart
-- with quantity 1, bypassing the Quick Add modal.
-- =====================================================

ALTER TABLE product_types
  ADD COLUMN IF NOT EXISTS press_to_add BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN product_types.press_to_add
  IS 'If true, clicking a product of this type in Quick Access adds it directly to the cart (qty 1) instead of opening the Quick Add modal.';
