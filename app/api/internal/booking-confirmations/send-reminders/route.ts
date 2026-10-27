import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { sendDueBookingConfirmationReminders } from '@/lib/booking-confirmation-reminders'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function POST(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  try {
    const result = await sendDueBookingConfirmationReminders(orgId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[internal booking confirmations]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar lembretes' },
      { status: 500 }
    )
  }
}
