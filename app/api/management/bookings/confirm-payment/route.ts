import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isDatabaseConfigured, query } from '@/lib/db'
import { ensureManagementAgendaWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

const schema = z.object({
  bookingId: z.string().uuid(),
})

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const { bookingId } = parsed.data

  const bookingRes = await query<{
    id: string
    status: string
    customer_phone: string
    customer_name: string
    service_name_snapshot: string
    booking_date: string
    booking_time: string
  }>(
    `SELECT b.id, b.status,
            c.phone AS customer_phone, c.full_name AS customer_name,
            b.service_name_snapshot,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     WHERE b.id = $1 AND b.organization_id = $2
     LIMIT 1`,
    [bookingId, orgId]
  )

  const booking = bookingRes.rows[0]
  if (!booking) return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
  if (booking.status !== 'pending_payment') {
    return NextResponse.json({ error: 'Agendamento nao esta aguardando pagamento' }, { status: 400 })
  }

  await query(
    `UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
    [bookingId, orgId]
  )

  // Send WhatsApp confirmation to customer
  const [y, m, d] = booking.booking_date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const wd = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado']
  const mo = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const dateLabel = `${wd[dt.getDay()]}, ${d} de ${mo[m - 1]}`
  const firstName = booking.customer_name.split(' ')[0]

  const message = `Pagamento confirmado! ✅ Tudo certo, ${firstName}! Te esperamos na ${dateLabel} às ${booking.booking_time} para ${booking.service_name_snapshot}. Qualquer dúvida é só chamar 😊`

  try {
    await sendWhatsAppMessage({ orgId, phone: booking.customer_phone, message })
  } catch (err) {
    console.error('[confirm-payment] falha ao enviar WhatsApp:', err)
    // Don't fail the request — payment was confirmed, just log the WhatsApp error
  }

  return NextResponse.json({ ok: true })
}
