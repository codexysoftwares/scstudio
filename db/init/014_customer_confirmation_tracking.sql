ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmation_request_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_confirmation_status TEXT,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_confirmation_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_confirmation_status_check
  CHECK (
    customer_confirmation_status IS NULL
    OR customer_confirmation_status IN ('pending', 'confirmed', 'declined')
  );
