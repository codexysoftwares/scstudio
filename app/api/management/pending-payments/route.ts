import { NextResponse } from 'next/server'

import { isDatabaseConfigured, query } from '@/lib/db'
import { ensureManagementAgendaAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ payments: [] })

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaAccess(session)
  if (authError) return authError

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ payments: [] })

  const r = await query<{
    id: string
    customer_name: string
    customer_phone: string
    service_name: string
    booking_date: string
    booking_time: string
    price_snapshot: string
    created_at: string
  }>(
    `SELECT b.id,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            b.service_name_snapshot AS service_name,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time,
            b.service_price_snapshot AS price_snapshot,
            b.created_at::text AS created_at
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     WHERE b.organization_id = $1
       AND b.status = 'pending_payment'
     ORDER BY b.created_at DESC
     LIMIT 50`,
    [orgId]
  )

  return NextResponse.json({ payments: r.rows })
}
