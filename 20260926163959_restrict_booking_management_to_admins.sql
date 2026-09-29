/*
# Restrict booking management to authenticated admins

1. Changes to policies on public.booking_requests
- Replace the deny-all SELECT policy with an authenticated-only SELECT policy so signed-in admins can view all booking requests.
- Add an authenticated-only UPDATE policy scoped to status changes (pending / confirmed / cancelled), so an admin can confirm or cancel reservations without touching customer-supplied data.
- Keep the public INSERT policy unchanged so the public booking form continues to work.
- Keep the deny-all DELETE policy so reservations are never erased from the admin view.

2. Column privileges
- Revoke the table-wide UPDATE grant from authenticated.
- Grant UPDATE only on the status column so authenticated admins can change the status and nothing else.

3. Security notes
- Customer contact and payment details remain unreadable to anonymous users.
- Only authenticated users (the business owner) can read bookings and change their status.
- No booking data can be deleted through the data API.
*/

DROP POLICY IF EXISTS "Booking requests are not publicly readable" ON public.booking_requests;
CREATE POLICY "Admins can read booking requests"
  ON public.booking_requests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Booking requests are not publicly editable" ON public.booking_requests;
CREATE POLICY "Admins can update booking status"
  ON public.booking_requests FOR UPDATE
  TO authenticated
  USING (status IN ('pending', 'confirmed', 'cancelled'))
  WITH CHECK (status IN ('pending', 'confirmed', 'cancelled'));

REVOKE UPDATE ON public.booking_requests FROM authenticated;
GRANT UPDATE (status) ON public.booking_requests TO authenticated;
