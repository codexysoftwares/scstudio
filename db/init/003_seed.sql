-- Minimal organization bootstrap for a clean production install.
-- All content (services, professionals, hours, testimonials, team, etc.)
-- should be created from inside the system after deployment.

INSERT INTO organizations (
  slug,
  name,
  whatsapp_phone,
  contact_email,
  address_line,
  city,
  state,
  booking_slot_minutes,
  allow_professional_selection,
  require_deposit
)
VALUES (
  'sc-studio',
  'SC Studio & Esmalteria',
  '5531990725053',
  'contato@scstudio.com.br',
  'Rua Padre Correia de Almeida, 38 - Santa Efigênia',
  'Belo Horizonte',
  'MG',
  30,
  TRUE,
  FALSE
)
ON CONFLICT (slug) DO NOTHING;
