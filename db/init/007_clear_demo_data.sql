-- Remove seeded/demo records from the default organization.
-- This keeps the organization itself and access roles intact, so the system
-- can be populated from inside the management dashboard after deployment.

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM booking_transfers bt
USING target_org o
WHERE bt.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM schedule_blocks sb
USING target_org o
WHERE sb.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM service_professionals sp
USING services s, target_org o
WHERE sp.service_id = s.id
  AND s.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM professional_payout_rules ppr
USING target_org o
WHERE ppr.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM bookings b
USING target_org o
WHERE b.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM customers c
USING target_org o
WHERE c.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM service_product_recommendations spr
USING products p, target_org o
WHERE spr.product_id = p.id
  AND p.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM products p
USING target_org o
WHERE p.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM testimonials t
USING target_org o
WHERE t.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM team_members tm
USING target_org o
WHERE tm.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM business_hours bh
USING target_org o
WHERE bh.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM landing_page_settings lp
USING target_org o
WHERE lp.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM services s
USING target_org o
WHERE s.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM professionals p
USING target_org o
WHERE p.organization_id = o.id;

WITH target_org AS (
  SELECT id
  FROM organizations
  WHERE slug = 'sc-studio'
  LIMIT 1
)
DELETE FROM staff_users su
USING target_org o
WHERE su.organization_id = o.id;
