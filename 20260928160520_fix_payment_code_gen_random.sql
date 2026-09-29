/*
# Fix payment code generation — replace gen_random_bytes with gen_random_uuid

1. Problem
- The generate_payment_code() trigger function used gen_random_bytes(6) from the pgcrypto extension.
- pgcrypto is not available on this Supabase instance, so every UPDATE that confirmed a booking failed with "function gen_random_bytes(integer) does not exist".
- This blocked the admin from confirming any booking.

2. Fix
- Rewrite generate_payment_code() to use gen_random_uuid() (built into Postgres core) instead of gen_random_bytes().
- Derive 8 hex characters from the UUID to keep the same 8PF-PAY-XXXXXXXX format.
- The trigger itself is unchanged — only the function body changes.
*/

CREATE OR REPLACE FUNCTION public.generate_payment_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') AND NEW.payment_code IS NULL THEN
    NEW.payment_code = '8PF-PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;
