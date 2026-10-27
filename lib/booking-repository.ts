import type { PoolClient } from 'pg'

import { withTransaction } from '@/lib/db'
import {
  formatServiceSnapshots,
  getBookingContext,
  resolveProfessionalForBooking,
  resolveBundleForBooking,
} from '@/lib/online-booking'

type BookingInput = {
  name: string
  phone: string
  serviceName?: string
  serviceDuration?: string
  servicePrice?: string
  serviceId?: string
  serviceIds?: string[]
  professionalId?: string | null
  professionalSelections?: Array<{
    serviceId: string
    professionalId?: string | null
  }>
  date: string
  time: string
  notes?: string
  source?: string
  initialStatus?: 'pending' | 'confirmed' | 'pending_payment' | 'cancelled' | 'completed' | 'rescheduled'
}

type PersistedBooking = {
  bookingId: string
  bookingIds: string[]
  bookingGroupId: string | null
  customerId: string
  organizationId: string
  professionalId: string | null
  professionalIds: string[]
}

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return value

  const dmy = value.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`

  return null
}

function parseTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  return `${match[1]}:${match[2]}:00`
}

function parsePriceToCents(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function parseDurationToMinutes(value: string) {
  const hoursMatch = value.match(/(\d+)\s*h/i)
  const minutesMatch = value.match(/(\d+)\s*min/i)
  const hours = hoursMatch ? Number(hoursMatch[1]) * 60 : 0
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0
  const total = hours + minutes
  return total > 0 ? total : 60
}

async function ensureOrganization(client: PoolClient) {
  const context = await getBookingContext()
  if (context?.orgId) return context.orgId

  const slug = process.env.DEFAULT_ORGANIZATION_SLUG || 'sc-studio'
  const name = process.env.DEFAULT_ORGANIZATION_NAME || 'SC Studio & Esmalteria'

  const existing = await client.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )

  if (existing.rows[0]) return existing.rows[0].id

  const created = await client.query<{ id: string }>(
    `INSERT INTO organizations (slug, name)
     VALUES ($1, $2)
     RETURNING id`,
    [slug, name]
  )

  return created.rows[0].id
}

async function ensureLegacyService(
  client: PoolClient,
  organizationId: string,
  input: Required<Pick<BookingInput, 'serviceName' | 'serviceDuration' | 'servicePrice'>>
) {
  const slug = toSlug(input.serviceName)
  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM services
     WHERE organization_id = $1 AND slug = $2
     LIMIT 1`,
    [organizationId, slug]
  )

  if (existing.rows[0]) return existing.rows[0].id

  const created = await client.query<{ id: string }>(
    `INSERT INTO services (
       organization_id,
       name,
       slug,
       category,
       duration_min,
       price_cents,
       description,
       is_active,
       online_booking_enabled
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE)
     RETURNING id`,
    [
      organizationId,
      input.serviceName,
      slug,
      'geral',
      parseDurationToMinutes(input.serviceDuration),
      parsePriceToCents(input.servicePrice),
      'Servico criado automaticamente a partir do primeiro agendamento online.',
    ]
  )

  return created.rows[0].id
}

async function upsertCustomer(
  client: PoolClient,
  organizationId: string,
  input: BookingInput
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM customers
     WHERE organization_id = $1 AND phone = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [organizationId, input.phone]
  )

  if (existing.rows[0]) {
    await client.query(
      `UPDATE customers
       SET full_name = $1,
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3`,
      [input.name, input.notes ?? null, existing.rows[0].id]
    )

    return existing.rows[0].id
  }

  const created = await client.query<{ id: string }>(
    `INSERT INTO customers (organization_id, full_name, phone, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [organizationId, input.name, input.phone, input.notes ?? null]
  )

  return created.rows[0].id
}

export async function createBooking(input: BookingInput): Promise<PersistedBooking> {
  const bookingDate = parseDate(input.date)
  const bookingTime = parseTime(input.time)

  if (!bookingDate || !bookingTime) {
    throw new Error('Nao foi possivel converter data/horario para persistencia.')
  }

  return withTransaction(async (client) => {
    const initialStatus = input.initialStatus ?? 'pending'
    const organizationId = await ensureOrganization(client)
    const customerId = await upsertCustomer(client, organizationId, input)

    // Serializes booking creation by organization/day to avoid double-booking races.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [organizationId, bookingDate]
    )

    if (input.serviceIds && input.serviceIds.length > 0) {
      const bundleItems = await resolveBundleForBooking({
        date: bookingDate,
        time: input.time,
        items: input.serviceIds.map((serviceId) => ({
          serviceId,
          professionalId: input.professionalSelections?.find((selection) => selection.serviceId === serviceId)?.professionalId ?? null,
        })),
      })

      const groupResult = await client.query<{ id: string }>(
        `INSERT INTO booking_groups (organization_id, customer_id, booking_date, booking_time, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [organizationId, customerId, bookingDate, bookingTime, input.notes ?? null]
      )

      const bookingGroupId = groupResult.rows[0].id
      const bookingIds: string[] = []

      for (const [index, item] of bundleItems.entries()) {
        const snapshots = formatServiceSnapshots(item.service)
        const created = await client.query<{ id: string }>(
          `INSERT INTO bookings (
             organization_id,
             customer_id,
             professional_id,
             service_id,
             booking_group_id,
             booking_sequence,
             service_name_snapshot,
             service_duration_snapshot,
             service_price_snapshot,
             booking_date,
             booking_time,
             notes,
             source,
             status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            organizationId,
            customerId,
            item.professionalId,
            item.serviceId,
            bookingGroupId,
            item.sequence,
            snapshots.serviceName,
            snapshots.serviceDuration,
            snapshots.servicePrice,
            bookingDate,
            `${item.startsAt}:00`,
            input.notes ?? null,
            input.source ?? 'site',
            initialStatus,
          ]
        )

        bookingIds.push(created.rows[0].id)
      }

      return {
        bookingId: bookingIds[0],
        bookingIds,
        bookingGroupId,
        customerId,
        organizationId,
        professionalId: bundleItems[0]?.professionalId ?? null,
        professionalIds: bundleItems.map((item) => item.professionalId),
      }
    }

    let serviceId: string
    let professionalId: string | null = null
    let serviceNameSnapshot: string
    let serviceDurationSnapshot: string
    let servicePriceSnapshot: string

    if (input.serviceId) {
      const resolved = await resolveProfessionalForBooking({
        serviceId: input.serviceId,
        date: bookingDate,
        time: input.time,
        professionalId: input.professionalId,
      })

      serviceId = input.serviceId
      professionalId = resolved.professionalId

      const snapshots = formatServiceSnapshots(resolved.service)
      serviceNameSnapshot = snapshots.serviceName
      serviceDurationSnapshot = snapshots.serviceDuration
      servicePriceSnapshot = snapshots.servicePrice
    } else {
      if (!input.serviceName || !input.serviceDuration || !input.servicePrice) {
        throw new Error('Servico nao informado para o agendamento.')
      }

      serviceId = await ensureLegacyService(client, organizationId, {
        serviceName: input.serviceName,
        serviceDuration: input.serviceDuration,
        servicePrice: input.servicePrice,
      })

      serviceNameSnapshot = input.serviceName
      serviceDurationSnapshot = input.serviceDuration
      servicePriceSnapshot = input.servicePrice
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO bookings (
         organization_id,
         customer_id,
         professional_id,
         service_id,
         service_name_snapshot,
         service_duration_snapshot,
         service_price_snapshot,
         booking_date,
         booking_time,
         notes,
         source,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        organizationId,
        customerId,
        professionalId,
        serviceId,
        serviceNameSnapshot,
        serviceDurationSnapshot,
        servicePriceSnapshot,
        bookingDate,
        bookingTime,
        input.notes ?? null,
        input.source ?? 'site',
        initialStatus,
      ]
    )

    return {
      bookingId: created.rows[0].id,
      bookingIds: [created.rows[0].id],
      bookingGroupId: null,
      customerId,
      organizationId,
      professionalId,
      professionalIds: professionalId ? [professionalId] : [],
    }
  })
}
