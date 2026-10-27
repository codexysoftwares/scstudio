import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createBooking } from '@/lib/booking-repository'
import { isDatabaseConfigured, query } from '@/lib/db'
import { getManagementOverviewData } from '@/lib/management-dashboard-data'
import { ensureManagementAgendaWriteAccess, ensureManagementSession, isProfessionalSession } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? undefined
  const session = await requireStaffSession()
  const authError = ensureManagementSession(session)
  if (authError) return authError

  try {
    const overview = await getManagementOverviewData(date)
    if (isProfessionalSession(session)) {
      return NextResponse.json({
        selectedDate: overview.selectedDate,
        metrics: [],
        bookings: overview.bookings,
        professionals: overview.professionals,
        finance: {
          grossRevenue: 0,
          confirmedRevenue: 0,
          pendingRevenue: 0,
          payrollProjected: 0,
          salonNetProjected: 0,
          averageTicket: 0,
        },
      })
    }

    return NextResponse.json(overview)
  } catch (err) {
    console.error('[bookings GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar agenda' }, { status: 500 })
  }
}

const manualBookingSchema = z.object({
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().min(1).max(30),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'DB não configurado' }, { status: 503 })

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = manualBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { clientName, clientPhone, serviceId, professionalId, date, time, notes } = parsed.data

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

    const booking = await createBooking({
      name: clientName,
      phone: clientPhone,
      serviceId,
      professionalId: professionalId ?? null,
      date,
      time,
      notes,
    })

    await query(
      `UPDATE bookings
       SET status = 'confirmed', source = 'gestor', updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [booking.bookingIds]
    )

    return NextResponse.json({ id: booking.bookingId, ids: booking.bookingIds })
  } catch (err) {
    console.error('[bookings POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao criar agendamento' }, { status: 409 })
  }
}
