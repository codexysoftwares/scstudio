import 'server-only'

import { query } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'

type DueReminderRow = {
  id: string
  booking_group_id: string | null
  customer_id: string
  customer_name: string
  customer_phone: string
  service_name_snapshot: string
  booking_date: string
  booking_time: string
}

export type PendingCustomerConfirmation = {
  bookingId: string
  bookingGroupId: string | null
  customerName: string
  serviceLabel: string
  bookingDate: string
  bookingTime: string
}

function normalizePhoneDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

function formatDatePt(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekdays = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado']
  const months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${weekdays[date.getDay()]}, ${day} de ${months[month - 1]}`
}

function buildReminderMessage(row: DueReminderRow) {
  const firstName = row.customer_name.trim().split(/\s+/)[0] ?? ''
  return `Oi${firstName ? `, ${firstName}` : ''}! Passando para confirmar se segue tudo certo com seu horario na ${formatDatePt(row.booking_date)} as ${row.booking_time}. Se estiver tudo certinho, me responde "sim". Se precisar ajustar, pode responder "nao" que a equipe te ajuda.`
}

async function fetchGroupedServiceLabel(orgId: string, bookingId: string) {
  const rows = await query<{ service_name_snapshot: string; booking_sequence: number }>(
    `WITH target AS (
       SELECT booking_group_id
       FROM bookings
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1
     )
     SELECT b.service_name_snapshot,
            b.booking_sequence
     FROM bookings b
     CROSS JOIN target
     WHERE b.organization_id = $2
       AND (
         b.id = $1
         OR (target.booking_group_id IS NOT NULL AND b.booking_group_id = target.booking_group_id)
       )
     ORDER BY b.booking_sequence ASC, b.booking_time ASC`,
    [bookingId, orgId]
  )

  const uniqueNames = rows.rows
    .map((row) => row.service_name_snapshot)
    .filter((name, index, all) => all.indexOf(name) === index)

  if (uniqueNames.length <= 1) return uniqueNames[0] ?? 'seu atendimento'
  return uniqueNames.join(' + ')
}

export async function sendDueBookingConfirmationReminders(orgId: string) {
  const settingsResult = await query<{ auto_confirm_whatsapp: boolean; reminder_hours_before: number }>(
    `SELECT auto_confirm_whatsapp, reminder_hours_before
     FROM organizations
     WHERE id = $1
     LIMIT 1`,
    [orgId]
  )

  if (!(settingsResult.rows[0]?.auto_confirm_whatsapp ?? false)) {
    return { ok: true, sent: 0, skipped: 0 }
  }

  const reminderHours = settingsResult.rows[0]?.reminder_hours_before ?? 24

  const dueRows = await query<DueReminderRow>(
    `SELECT b.id,
            b.booking_group_id,
            b.customer_id,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            b.service_name_snapshot,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time
     FROM bookings b
     INNER JOIN customers c ON c.id = b.customer_id
     WHERE b.organization_id = $1
       AND b.status = 'confirmed'
       AND b.confirmation_request_sent_at IS NULL
       AND (b.booking_group_id IS NULL OR b.booking_sequence = 1)
       AND (b.booking_date + b.booking_time) >= NOW() + make_interval(hours => $2::int) - INTERVAL '30 minutes'
       AND (b.booking_date + b.booking_time) <= NOW() + make_interval(hours => $2::int) + INTERVAL '30 minutes'
     ORDER BY b.booking_date ASC, b.booking_time ASC`,
    [orgId, reminderHours]
  )

  let sent = 0
  let skipped = 0

  for (const row of dueRows.rows) {
    const message = buildReminderMessage(row)
    const result = await sendWhatsAppMessage({
      orgId,
      phone: row.customer_phone,
      message,
      contactName: row.customer_name,
      metadata: {
        type: 'booking-confirmation-reminder',
        bookingId: row.id,
        bookingGroupId: row.booking_group_id,
      },
    })

    if (!result.ok) {
      skipped += 1
      continue
    }

    await query(
      `WITH target AS (
         SELECT booking_group_id
         FROM bookings
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1
       )
       UPDATE bookings b
       SET confirmation_request_sent_at = NOW(),
           customer_confirmation_status = 'pending',
           updated_at = NOW()
       FROM target
       WHERE b.organization_id = $2
         AND (
           b.id = $1
           OR (target.booking_group_id IS NOT NULL AND b.booking_group_id = target.booking_group_id)
         )`,
      [row.id, orgId]
    )

    sent += 1
  }

  return { ok: true, sent, skipped }
}

export async function findPendingCustomerConfirmation(orgId: string, phone: string): Promise<PendingCustomerConfirmation | null> {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null

  const result = await query<{
    id: string
    booking_group_id: string | null
    customer_name: string
    booking_date: string
    booking_time: string
  }>(
    `SELECT b.id,
            b.booking_group_id,
            c.full_name AS customer_name,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time
     FROM bookings b
     INNER JOIN customers c ON c.id = b.customer_id
     WHERE b.organization_id = $1
       AND b.status = 'confirmed'
       AND b.customer_confirmation_status = 'pending'
       AND b.confirmation_request_sent_at IS NOT NULL
       AND regexp_replace(c.phone, '[^0-9]', '', 'g') = $2
       AND (b.booking_group_id IS NULL OR b.booking_sequence = 1)
     ORDER BY b.booking_date ASC, b.booking_time ASC
     LIMIT 1`,
    [orgId, digits]
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    bookingId: row.id,
    bookingGroupId: row.booking_group_id ?? null,
    customerName: row.customer_name,
    serviceLabel: await fetchGroupedServiceLabel(orgId, row.id),
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
  }
}

export async function registerCustomerConfirmationResponse(input: {
  orgId: string
  bookingId: string
  response: 'confirmed' | 'declined'
}) {
  const result = await query<{ id: string }>(
    `WITH target AS (
       SELECT booking_group_id
       FROM bookings
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1
     )
     UPDATE bookings b
     SET customer_confirmation_status = $3,
         customer_confirmed_at = CASE WHEN $3 = 'confirmed' THEN NOW() ELSE NULL END,
         updated_at = NOW()
     FROM target
     WHERE b.organization_id = $2
       AND (
         b.id = $1
         OR (target.booking_group_id IS NOT NULL AND b.booking_group_id = target.booking_group_id)
       )
     RETURNING b.id`,
    [input.bookingId, input.orgId, input.response]
  )

  return result.rowCount > 0
}
