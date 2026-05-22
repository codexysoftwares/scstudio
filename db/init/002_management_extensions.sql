CREATE TABLE IF NOT EXISTS professional_payout_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  bonus_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  applies_to TEXT NOT NULL DEFAULT 'service',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_professional_payout_rule UNIQUE (organization_id, professional_id, rule_name)
);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  created_by_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  affects_online_booking BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS booking_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  to_professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  transfer_reason TEXT,
  transferred_by_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
