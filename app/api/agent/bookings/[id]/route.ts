import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { query, withTransaction } from '@/lib/db'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

const schema = z.object({
  status: z.enum(['cancelled', 'rescheduled', 'pending_payment']).optional(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const { status, newDate, newTime } = parsed.data
  if (!status && !(newDate && newTime)) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  await withTransaction(async (client) => {
    if (status) {
      await client.query(
        `UPDATE bookings
         SET status = $1, source = 'agent', updated_at = NOW()
         WHERE id = $2
           AND organization_id = $3`,
        [status, id, orgId]
      )
    }

    if (newDate && newTime) {
      await client.query(
        `UPDATE bookings
         SET booking_date = $1::date,
             booking_time = $2::time,
             source = 'agent',
             updated_at = NOW()
         WHERE id = $3
           AND organization_id = $4`,
        [newDate, `${newTime}:00`, id, orgId]
      )
    }
  })

  const result = await query<{ id: string }>(
    `SELECT id FROM bookings WHERE id = $1 AND organization_id = $2 LIMIT 1`,
    [id, orgId]
  )

  if (!result.rows[0]) {
    return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
