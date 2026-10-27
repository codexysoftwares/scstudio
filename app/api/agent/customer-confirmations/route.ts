import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { findPendingCustomerConfirmation } from '@/lib/booking-confirmation-reminders'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function GET(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone') ?? ''

  if (!phone) {
    return NextResponse.json({ error: 'Telefone obrigatorio' }, { status: 400 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  const pending = await findPendingCustomerConfirmation(orgId, phone)
  return NextResponse.json({ ok: true, pending })
}
