import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { query } from '@/lib/db'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

export async function GET(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'Informe o telefone.' }, { status: 400 })

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const normalizedPhone = normalizePhone(phone)
  const result = await query<{
    id: string
    booking_group_id: string | null
    booking_date: string
    booking_time: string
    status: string
    service_name_snapshot: string
    professional_name: string | null
    customer_name: string
  }>(
    `SELECT b.id,
            b.booking_group_id,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time,
            b.status,
            b.service_name_snapshot,
            p.display_name AS professional_name,
            c.full_name AS customer_name
     FROM bookings b
     INNER JOIN customers c ON c.id = b.customer_id
     LEFT JOIN professionals p ON p.id = b.professional_id
     WHERE b.organization_id = $1
       AND regexp_replace(c.phone, '\\D', '', 'g') = $2
     ORDER BY b.booking_date DESC, b.booking_time DESC
     LIMIT 20`,
    [orgId, normalizedPhone]
  )

  return NextResponse.json({ bookings: result.rows })
}
