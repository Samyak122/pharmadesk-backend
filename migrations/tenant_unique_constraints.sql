-- Tenant-aware uniqueness migration for existing PostgreSQL databases.
-- This keeps duplicates allowed across pharmacies but rejects duplicates within the same pharmacy.

BEGIN;

-- Customers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'customers'::regclass
      AND conname = 'customers_phone_key'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_phone_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'customers'::regclass
      AND conname = 'customers_email_key'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_email_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND indexname = 'customers_phone_key'
  ) THEN
    DROP INDEX IF EXISTS customers_phone_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND indexname = 'customers_email_key'
  ) THEN
    DROP INDEX IF EXISTS customers_email_key;
  END IF;
END $$;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_pharmacy_phone_unique,
  DROP CONSTRAINT IF EXISTS customers_pharmacy_email_unique;

ALTER TABLE customers
  ADD CONSTRAINT customers_pharmacy_phone_unique UNIQUE (pharmacy_id, phone);

ALTER TABLE customers
  ADD CONSTRAINT customers_pharmacy_email_unique UNIQUE (pharmacy_id, email);

-- Suppliers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'suppliers'::regclass
      AND conname = 'suppliers_phone_key'
  ) THEN
    ALTER TABLE suppliers DROP CONSTRAINT suppliers_phone_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'suppliers'::regclass
      AND conname = 'suppliers_email_key'
  ) THEN
    ALTER TABLE suppliers DROP CONSTRAINT suppliers_email_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'suppliers'::regclass
      AND conname = 'suppliers_gstin_key'
  ) THEN
    ALTER TABLE suppliers DROP CONSTRAINT suppliers_gstin_key;
  END IF;
END $$;

ALTER TABLE suppliers
  DROP CONSTRAINT IF EXISTS suppliers_pharmacy_phone_unique,
  DROP CONSTRAINT IF EXISTS suppliers_pharmacy_email_unique,
  DROP CONSTRAINT IF EXISTS suppliers_pharmacy_gstin_unique;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_pharmacy_phone_unique UNIQUE (pharmacy_id, phone);

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_pharmacy_email_unique UNIQUE (pharmacy_id, email);

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_pharmacy_gstin_unique UNIQUE (pharmacy_id, gstin);

-- Inventory
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'inventory'::regclass
      AND conname = 'inventory_medicine_id_batch_no_is_active_key'
  ) THEN
    ALTER TABLE inventory DROP CONSTRAINT inventory_medicine_id_batch_no_is_active_key;
  END IF;
END $$;

ALTER TABLE inventory
  DROP CONSTRAINT IF EXISTS inventory_pharmacy_batch_unique;

ALTER TABLE inventory
  ADD CONSTRAINT inventory_pharmacy_batch_unique UNIQUE (pharmacy_id, batch_no);

-- Invoices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'invoices'::regclass
      AND conname = 'invoices_invoice_no_key'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_invoice_no_key;
  END IF;
END $$;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_pharmacy_invoice_no_unique;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_pharmacy_invoice_no_unique UNIQUE (pharmacy_id, invoice_no);

-- Purchases
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_pharmacy_invoice_no_unique;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_pharmacy_invoice_no_unique UNIQUE (pharmacy_id, invoice_no);

COMMIT;
