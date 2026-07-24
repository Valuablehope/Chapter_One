-- Migration 051: Menu items are now managed from the Products page
-- Instead of storing menu categories/items as a JSONB blob on restaurant_menus,
-- each product can now be tagged directly with which menu/category it belongs to.
-- Admin -> Menus becomes a read-only view derived live from these product tags.

ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_id UUID REFERENCES restaurant_menus(menu_id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_display_order INT NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_note TEXT;

CREATE INDEX IF NOT EXISTS idx_products_menu_id ON products(menu_id);

-- Backfill: every existing menu item already has a product_id stamped onto it
-- (syncProducts ran on every prior create/update), so we can carry the
-- category/order/note straight over to the linked product row.
DO $$
DECLARE
  menu_row RECORD;
  cat JSONB;
  item JSONB;
  cat_idx INT;
  item_idx INT;
BEGIN
  FOR menu_row IN SELECT menu_id, categories FROM restaurant_menus LOOP
    cat_idx := 0;
    FOR cat IN SELECT * FROM jsonb_array_elements(COALESCE(menu_row.categories, '[]'::jsonb)) LOOP
      item_idx := 0;
      FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(cat->'items', '[]'::jsonb)) LOOP
        IF item->>'product_id' IS NOT NULL THEN
          UPDATE products
          SET menu_id = menu_row.menu_id,
              menu_category = cat->>'name',
              menu_display_order = cat_idx * 1000 + item_idx,
              menu_note = NULLIF(item->>'description', '')
          WHERE product_id = (item->>'product_id')::uuid;
        END IF;
        item_idx := item_idx + 1;
      END LOOP;
      cat_idx := cat_idx + 1;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE restaurant_menus DROP COLUMN IF EXISTS categories;
