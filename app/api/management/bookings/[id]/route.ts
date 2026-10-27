import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isDatabaseConfigured, query, withTransaction } from '@/lib/db'
import { ensureManagementAgendaWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'rescheduled']).optional(),
  professionalId: z.string().uuid().nullable().optional(),
})

type BookingRow = {
  id: string
  booking_group_id: string | null
  booking_date: string
  booking_time: string
  professional_id: string | null
  status: string
  duration_min: number | null
  service_duration_snapshot: string
}

function parseDurationToMinutes(value: string) {
  const hoursMatch = value.match(/(\d+)\s*h/i)
  const minutesMatch = value.match(/(\d+)\s*min/i)
  const hours = hoursMatch ? Number(hoursMatch[1]) * 60 : 0
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0
  const total = hours + minutes
  return total > 0 ? total : 60
}

function isActiveStatus(status: string) {
  return status !== 'cancelled' && status !== 'rescheduled'
}

async function ensureAgendaAvailability(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  orgId: string,
  bookings: Array<BookingRow & { professional_id: string | null; status: string }>
) {
  for (const booking of bookings) {
    if (!booking.professional_id || !isActiveStatus(booking.status)) continue

    const durationMinutes = booking.duration_min ?? parseDurationToMinutes(booking.service_duration_snapshot)
    const startsAt = `${booking.booking_date}T${booking.booking_time}:00`

    const blockConflict = await client.query<{ id: string }>(
      `SELECT id
       FROM schedule_blocks
       WHERE organization_id = $1
         AND affects_online_booking = TRUE
         AND (professional_id IS NULL OR professional_id = $2)
         AND starts_at < ($3::timestamptz + make_interval(mins => $4))
         AND ends_at > $3::timestamptz
       LIMIT 1`,
      [orgId, booking.professional_id, startsAt, durationMinutes]
    )

    if (blockConflict.rows[0]) {
      throw new Error('Existe um bloqueio na agenda para este horario.')
    }

    const bookingConflict = await client.query<{ id: string }>(
      `SELECT b.id
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.organization_id = $1
         AND b.professional_id = $2
         AND b.id <> $3
         AND b.status NOT IN ('cancelled', 'rescheduled')
         AND (b.booking_date + b.booking_time) < ($4::date + $5::time + make_interval(mins => $6))
         AND (b.booking_date + b.booking_time + make_interval(mins => COALESCE(s.duration_min, 60))) > ($4::date + $5::time)
       LIMIT 1`,
      [orgId, booking.professional_id, booking.id, booking.booking_date, booking.booking_time, durationMinutes]
    )

    if (bookingConflict.rows[0]) {
      throw new Error('A profissional selecionada nao esta livre nesse horario.')
    }
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })
  }

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaWriteAccess(session)
  if (authError) return authError

  try {
    const { id } = await params

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { status, professionalId } = parsed.data
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    if (status === undefined && professionalId === undefined) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const updated = await withTransaction(async (client) => {
      const bookingRes = await client.query<BookingRow>(
        `SELECT b.id,
                b.booking_group_id,
                b.booking_date::text AS booking_date,
                to_char(b.booking_time, 'HH24:MI') AS booking_time,
                b.professional_id,
                b.status,
                s.duration_min,
                b.service_duration_snapshot
         FROM bookings b
         LEFT JOIN services s ON s.id = b.service_id
         WHERE b.id = $1
           AND b.organization_id = $2
         LIMIT 1`,
        [id, orgId]
      )

      const booking = bookingRes.rows[0]
      if (!booking) return false

      const shouldCascade = Boolean(
        booking.booking_group_id && status !== undefined && (status === 'cancelled' || status === 'rescheduled')
      )

      const affectedBookings = shouldCascade
        ? (
            await client.query<BookingRow>(
              `SELECT b.id,
                      b.booking_group_id,
                      b.booking_date::text AS booking_date,
                      to_char(b.booking_time, 'HH24:MI') AS booking_time,
                      b.professional_id,
                      b.status,
                      s.duration_min,
                      b.service_duration_snapshot
               FROM bookings b
               LEFT JOIN services s ON s.id = b.service_id
               WHERE b.booking_group_id = $1
                 AND b.organization_id = $2
               ORDER BY b.booking_sequence`,
              [booking.booking_group_id, orgId]
            )
          ).rows
        : [booking]

      const bookingsForValidation = affectedBookings.map((item) => ({
        ...item,
        professional_id: item.id === id && professionalId !== undefined ? professionalId : item.professional_id,
        status: status !== undefined
          ? (shouldCascade || item.id === id ? status : item.status)
          : item.status,
      }))

      await ensureAgendaAvailability(client, orgId, bookingsForValidation)

      if (status !== undefined) {
        if (shouldCascade) {
          await client.query(
            `UPDATE bookings
             SET status = $1, updated_at = NOW()
             WHERE booking_group_id = $2
               AND organization_id = $3`,
            [status, booking.booking_group_id, orgId]
          )
        } else {
          await client.query(
            `UPDATE bookings
             SET status = $1, updated_at = NOW()
             WHERE id = $2
               AND organization_id = $3`,
            [status, id, orgId]
          )
        }
      }

      if (professionalId !== undefined) {
        await client.query(
          `UPDATE bookings
           SET professional_id = $1, updated_at = NOW()
           WHERE id = $2
             AND organization_id = $3`,
          [professionalId, id, orgId]
        )
      }

      return true
    })

    if (!updated) {
      return NextResponse.json({ error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bookings/:id PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar agendamento' },
      { status: 409 }
    )
  }
}
