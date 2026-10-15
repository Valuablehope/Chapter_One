-- Migration: Add receipt_printer to store_settings
-- Description: Adds a column to store the specific receipt printer for silent printing.

ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS receipt_printer VARCHAR(255);
