import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { registerCustomerConfirmationResponse } from '@/lib/booking-confirmation-reminders'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

const schema = z.object({
  response: z.enum(['confirmed', 'declined']),
})

export async function POST(
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

  const orgId = await resolveDefaultOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  const { id } = await params
  const ok = await registerCustomerConfirmationResponse({
    orgId,
    bookingId: id,
    response: parsed.data.response,
  })

  if (!ok) {
    return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
