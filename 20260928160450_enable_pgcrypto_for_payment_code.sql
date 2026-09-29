/*
# Fix payment code generation trigger

1. Enable pgcrypto extension
- The generate_payment_code() trigger function uses gen_random_bytes() from the pgcrypto extension.
- pgcrypto was not enabled, causing the trigger to fail with "function gen_random_bytes(integer) does not exist".
- This means every UPDATE to booking_requests that transitions status to 'confirmed' was failing, blocking the admin from confirming bookings.

2. Fix
- CREATE EXTENSION IF NOT EXISTS pgcrypto so gen_random_bytes() is available.
- The existing trigger and function do not need to change — they will work once pgcrypto is enabled.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;
