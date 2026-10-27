CREATE TABLE IF NOT EXISTS booking_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_group_id UUID REFERENCES booking_groups(id) ON DELETE SET NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_sequence SMALLINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_bookings_group
  ON bookings (booking_group_id, booking_sequence);

CREATE INDEX IF NOT EXISTS idx_booking_groups_org_date_time
  ON booking_groups (organization_id, booking_date, booking_time);
