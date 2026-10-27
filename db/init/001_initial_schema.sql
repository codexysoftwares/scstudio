CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  whatsapp_phone TEXT,
  contact_email TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Bahia',
  address_line TEXT,
  city TEXT,
  state TEXT,
  booking_slot_minutes INTEGER NOT NULL DEFAULT 30,
  booking_buffer_minutes INTEGER NOT NULL DEFAULT 15,
  allow_professional_selection BOOLEAN NOT NULL DEFAULT TRUE,
  require_deposit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landing_page_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  hero_title TEXT,
  hero_subtitle TEXT,
  primary_cta_label TEXT,
  secondary_cta_label TEXT,
  theme_variant TEXT NOT NULL DEFAULT 'sofisticado',
  show_professionals BOOLEAN NOT NULL DEFAULT TRUE,
  show_products BOOLEAN NOT NULL DEFAULT TRUE,
  show_testimonials BOOLEAN NOT NULL DEFAULT TRUE,
  social_proof_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS staff_role_assignments (
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_user_id, role_id)
);

CREATE TABLE IF NOT EXISTS professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_user_id UUID UNIQUE REFERENCES staff_users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  specialty TEXT,
  bio TEXT,
  color_hex TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_online_booking BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_hours_org_weekday UNIQUE (organization_id, weekday)
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  photo_url TEXT,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  online_booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_services_org_slug UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS service_professionals (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, professional_id)
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_products_org_sku UNIQUE (organization_id, sku)
);

CREATE TABLE IF NOT EXISTS service_product_recommendations (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, product_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT NOT NULL,
  service_duration_snapshot TEXT NOT NULL,
  service_price_snapshot TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'site',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rescheduled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_org_phone
  ON customers (organization_id, phone);

CREATE INDEX IF NOT EXISTS idx_bookings_org_date_time
  ON bookings (organization_id, booking_date, booking_time);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
  ON bookings (customer_id);

INSERT INTO access_roles (key, name, description)
VALUES
  ('admin', 'Administradora', 'Controle total do sistema e das configuracoes.'),
  ('frontdesk', 'Recepcao', 'Opera agenda, confirma clientes e acompanha pagamentos.'),
  ('professional', 'Profissional', 'Acessa apenas a propria agenda e seus atendimentos.')
ON CONFLICT (key) DO NOTHING;
