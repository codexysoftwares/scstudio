import 'server-only'
import { isDatabaseConfigured, query } from '@/lib/db'
import type { Service, PublicBusinessHour } from '@/lib/services'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return r.rows[0]?.id ?? null
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// ─── Public queries ───────────────────────────────────────────────────────────

export async function getPublicServices(): Promise<Service[]> {
  if (!isDatabaseConfigured()) return []

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return []

    const r = await query<{
      name: string
      category: string
      duration_min: number
      price_cents: number
    }>(
      `SELECT name, category, duration_min, price_cents
       FROM services
       WHERE organization_id = $1 AND is_active = true AND online_booking_enabled = true
       ORDER BY is_featured DESC, name`,
      [orgId]
    )

    return r.rows.map((row) => ({
      name: row.name,
      duration: formatDuration(row.duration_min),
      durationMin: row.duration_min,
      price: formatPrice(row.price_cents),
      category: row.category as Service['category'],
      photo: row.category === 'cilios' ? 'VWvTbDUwbUM' : 'gb6gtiTZKB8',
      description: row.name,
    }))
  } catch (err) {
    console.error('[public-data] getPublicServices failed:', err)
    return []
  }
}

export async function getPublicBusinessHours(): Promise<PublicBusinessHour[]> {
  if (!isDatabaseConfigured()) return []

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return []

    const r = await query<{
      weekday: number
      opens_at: string | null
      closes_at: string | null
      is_closed: boolean
    }>(
      `SELECT weekday,
              to_char(opens_at, 'HH24:MI') AS opens_at,
              to_char(closes_at, 'HH24:MI') AS closes_at,
              is_closed
       FROM business_hours
       WHERE organization_id = $1
       ORDER BY weekday`,
      [orgId]
    )

    return r.rows.map((row) => ({
      weekday: row.weekday,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
    }))
  } catch (err) {
    console.error('[public-data] getPublicBusinessHours failed:', err)
    return []
  }
}
