-- Review and run manually against the PostgreSQL database before deploying the
-- pack/loose-unit purchase and billing changes. This file is not auto-executed.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER NOT NULL DEFAULT 1;

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS free_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ocr_snapshot JSON;

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS pack_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loose_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER NOT NULL DEFAULT 1;
