-- ─── Organização ─────────────────────────────────────────────────────────────

INSERT INTO organizations (slug, name, whatsapp_phone, contact_email, address_line, city, state, booking_slot_minutes, allow_professional_selection, require_deposit)
VALUES (
  'sc-studio',
  'SC Studio & Esmalteria',
  '5531990725053',
  'contato@scstudio.com.br',
  'Rua Padre Correia de Almeida, 38 — Santa Efigênia',
  'Belo Horizonte',
  'MG',
  30,
  TRUE,
  FALSE
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Landing page settings ────────────────────────────────────────────────────

INSERT INTO landing_page_settings (organization_id, hero_title, hero_subtitle, primary_cta_label, secondary_cta_label, theme_variant, show_professionals, show_products, show_testimonials, social_proof_enabled)
SELECT
  id,
  'Unhas e cílios feitos com arte e precisão',
  'Agende online em segundos. Especialistas em alongamento, esmaltação e design de cílios em BH.',
  'Agendar meu horário',
  'Ver serviços',
  'sofisticado',
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM organizations WHERE slug = 'sc-studio'
ON CONFLICT (organization_id) DO NOTHING;

-- ─── Horários de funcionamento ────────────────────────────────────────────────
-- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb

INSERT INTO business_hours (organization_id, weekday, opens_at, closes_at, is_closed)
SELECT id, 0, NULL::TIME, NULL::TIME, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 1, NULL::TIME, NULL::TIME, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 2, '09:00'::TIME, '16:00'::TIME, FALSE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 3, '08:00'::TIME, '16:00'::TIME, FALSE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 4, '08:00'::TIME, '16:00'::TIME, FALSE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 5, '08:00'::TIME, '18:00'::TIME, FALSE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 6, '08:00'::TIME, '16:00'::TIME, FALSE FROM organizations WHERE slug = 'sc-studio'
ON CONFLICT (organization_id, weekday) DO NOTHING;

-- ─── Staff users ──────────────────────────────────────────────────────────────

INSERT INTO staff_users (organization_id, full_name, email, is_active)
SELECT id, 'Camila Souza',        'camila@scstudio.com.br',   TRUE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Bruna Lima',          'bruna@scstudio.com.br',    TRUE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Paula Mendes',        'paula@scstudio.com.br',    TRUE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Recepcao SC Studio',  'recepcao@scstudio.com.br', TRUE FROM organizations WHERE slug = 'sc-studio'
ON CONFLICT (email) DO NOTHING;

-- ─── Role assignments ─────────────────────────────────────────────────────────

INSERT INTO staff_role_assignments (staff_user_id, role_id)
SELECT su.id, ar.id
FROM staff_users su, access_roles ar
WHERE su.email = 'camila@scstudio.com.br' AND ar.key = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO staff_role_assignments (staff_user_id, role_id)
SELECT su.id, ar.id
FROM staff_users su, access_roles ar
WHERE su.email = 'recepcao@scstudio.com.br' AND ar.key = 'frontdesk'
ON CONFLICT DO NOTHING;

INSERT INTO staff_role_assignments (staff_user_id, role_id)
SELECT su.id, ar.id
FROM staff_users su, access_roles ar
WHERE su.email = 'bruna@scstudio.com.br' AND ar.key = 'professional'
ON CONFLICT DO NOTHING;

INSERT INTO staff_role_assignments (staff_user_id, role_id)
SELECT su.id, ar.id
FROM staff_users su, access_roles ar
WHERE su.email = 'paula@scstudio.com.br' AND ar.key = 'professional'
ON CONFLICT DO NOTHING;

-- ─── Profissionais ────────────────────────────────────────────────────────────

INSERT INTO professionals (organization_id, staff_user_id, display_name, specialty, is_featured, accepts_online_booking)
SELECT o.id, su.id, 'Camila Souza', 'Alongamento, blindagem e decoração premium', TRUE, TRUE
FROM organizations o, staff_users su
WHERE o.slug = 'sc-studio' AND su.email = 'camila@scstudio.com.br';

INSERT INTO professionals (organization_id, staff_user_id, display_name, specialty, is_featured, accepts_online_booking)
SELECT o.id, su.id, 'Bruna Lima', 'Cílios brasileiros, design e henna', TRUE, TRUE
FROM organizations o, staff_users su
WHERE o.slug = 'sc-studio' AND su.email = 'bruna@scstudio.com.br';

INSERT INTO professionals (organization_id, staff_user_id, display_name, specialty, is_featured, accepts_online_booking)
SELECT o.id, su.id, 'Paula Mendes', 'Pedicure, spa dos pés e combos express', TRUE, TRUE
FROM organizations o, staff_users su
WHERE o.slug = 'sc-studio' AND su.email = 'paula@scstudio.com.br';

-- ─── Payout rules ─────────────────────────────────────────────────────────────

INSERT INTO professional_payout_rules (organization_id, professional_id, rule_name, commission_percent, applies_to)
SELECT o.id, p.id, 'Comissão padrão', 45.00, 'service'
FROM organizations o, professionals p
WHERE o.slug = 'sc-studio' AND p.display_name = 'Camila Souza' AND p.organization_id = o.id;

INSERT INTO professional_payout_rules (organization_id, professional_id, rule_name, commission_percent, applies_to)
SELECT o.id, p.id, 'Comissão padrão', 42.00, 'service'
FROM organizations o, professionals p
WHERE o.slug = 'sc-studio' AND p.display_name = 'Bruna Lima' AND p.organization_id = o.id;

INSERT INTO professional_payout_rules (organization_id, professional_id, rule_name, commission_percent, applies_to)
SELECT o.id, p.id, 'Comissão padrão', 40.00, 'service'
FROM organizations o, professionals p
WHERE o.slug = 'sc-studio' AND p.display_name = 'Paula Mendes' AND p.organization_id = o.id;

-- ─── Serviços ─────────────────────────────────────────────────────────────────

INSERT INTO services (organization_id, name, slug, category, duration_min, price_cents, is_active, is_featured, online_booking_enabled)
SELECT id, 'Alongamento Signature',  'alongamento-signature',  'unhas',      90,  17000, TRUE, TRUE,  TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Blindagem em Gel',       'blindagem-em-gel',       'unhas',      75,  13000, TRUE, FALSE, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Esmaltação Simples',     'esmaltacao-simples',     'unhas',      45,   5000, TRUE, FALSE, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Manicure + Pedicure',    'manicure-pedicure',      'unhas',      90,   7000, TRUE, FALSE, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Spa dos Pés Ritual',     'spa-dos-pes-ritual',     'bem-estar',  80,  11000, TRUE, TRUE,  TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Cílios Brasileiros',     'cilios-brasileiros',     'cilios',    110,  13000, TRUE, TRUE,  TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Designer com Henna',     'designer-com-henna',     'cilios',     60,   5000, TRUE, FALSE, TRUE  FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Combo Noiva',            'combo-noiva',            'pacote',    180,  32000, TRUE, TRUE,  FALSE FROM organizations WHERE slug = 'sc-studio'
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ─── Vínculo serviço × profissional ──────────────────────────────────────────

INSERT INTO service_professionals (service_id, professional_id)
SELECT s.id, p.id
FROM services s, professionals p, organizations o
WHERE o.slug = 'sc-studio'
  AND s.organization_id = o.id
  AND p.organization_id = o.id
  AND s.slug IN ('alongamento-signature', 'blindagem-em-gel', 'esmaltacao-simples', 'manicure-pedicure', 'combo-noiva')
  AND p.display_name = 'Camila Souza'
ON CONFLICT DO NOTHING;

INSERT INTO service_professionals (service_id, professional_id)
SELECT s.id, p.id
FROM services s, professionals p, organizations o
WHERE o.slug = 'sc-studio'
  AND s.organization_id = o.id
  AND p.organization_id = o.id
  AND s.slug IN ('cilios-brasileiros', 'designer-com-henna')
  AND p.display_name = 'Bruna Lima'
ON CONFLICT DO NOTHING;

INSERT INTO service_professionals (service_id, professional_id)
SELECT s.id, p.id
FROM services s, professionals p, organizations o
WHERE o.slug = 'sc-studio'
  AND s.organization_id = o.id
  AND p.organization_id = o.id
  AND s.slug IN ('spa-dos-pes-ritual', 'manicure-pedicure')
  AND p.display_name = 'Paula Mendes'
ON CONFLICT DO NOTHING;

-- ─── Produtos ─────────────────────────────────────────────────────────────────

INSERT INTO products (organization_id, name, sku, price_cents, stock_quantity, is_active)
SELECT id, 'Kit Home Care',      'SC-CARE-01', 8900, 22, TRUE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Óleo Fortalecedor',  'SC-NAIL-04', 4500, 13, TRUE FROM organizations WHERE slug = 'sc-studio'
UNION ALL
SELECT id, 'Máscara para Cílios','SC-LASH-02', 5500,  9, TRUE FROM organizations WHERE slug = 'sc-studio'
ON CONFLICT (organization_id, sku) DO NOTHING;
