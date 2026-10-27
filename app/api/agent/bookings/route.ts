import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import {
  buildAgentBookingAutomationPayload,
  resolveAgentBookingInitialStatus,
} from '@/lib/booking-automation'
import { createBooking } from '@/lib/booking-repository'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  serviceId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).max(12).optional(),
  professionalId: z.string().uuid().nullable().optional(),
  professionalSelections: z.array(z.object({
    serviceId: z.string().uuid(),
    professionalId: z.string().uuid().nullable().optional(),
  })).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
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

  try {
    const orgId = await resolveDefaultOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    const automationStatus = await resolveAgentBookingInitialStatus({
      orgId,
      serviceId: parsed.data.serviceId,
      serviceIds: parsed.data.serviceIds,
    })

    const booking = await createBooking({
      ...parsed.data,
      source: 'agent',
      initialStatus: automationStatus.initialStatus,
    })

    const automation = await buildAgentBookingAutomationPayload(orgId, booking.bookingIds)

    return NextResponse.json({
      ok: true,
      bookingId: booking.bookingId,
      bookingIds: booking.bookingIds,
      bookingGroupId: booking.bookingGroupId,
      automation,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao criar agendamento.' },
      { status: 409 }
    )
  }
}
