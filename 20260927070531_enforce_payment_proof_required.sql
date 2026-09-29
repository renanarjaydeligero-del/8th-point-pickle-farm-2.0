/*
# Enforce required payment proof

1. Make payment_reference and receipt_path required (NOT NULL)
- payment_reference: was optional, now required. Customers must enter their transfer reference number.
- receipt_path: was optional, now required. Customers must upload a payment receipt screenshot.
- Existing rows with NULL values are backfilled with placeholders so the NOT NULL constraint can be added without losing data.

2. Security notes
- The public booking form still works (anon INSERT on booking_requests is unchanged).
- Only the admin can read and manage bookings (authenticated SELECT + UPDATE on status).
- Receipt storage policies are unchanged (anon can upload, only authenticated can read).
- Auth sign-up blocking is handled at the application level (UI removed) and by deleting non-admin accounts.
*/

-- Backfill existing NULL values so we can add NOT NULL constraints
UPDATE public.booking_requests
  SET payment_reference = 'N/A (pre-existing)'
  WHERE payment_reference IS NULL;

UPDATE public.booking_requests
  SET receipt_path = 'none'
  WHERE receipt_path IS NULL;

-- Now make both columns required
ALTER TABLE public.booking_requests
  ALTER COLUMN payment_reference SET NOT NULL,
  ALTER COLUMN receipt_path SET NOT NULL;
