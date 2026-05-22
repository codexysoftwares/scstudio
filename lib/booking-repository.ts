import type { PoolClient } from 'pg'

import { withTransaction } from '@/lib/db'

type BookingInput = {
  name: string
  phone: string
  serviceName: string
  serviceDuration: string
  servicePrice: string
  date: string
  time: string
  notes?: string
}

type PersistedBooking = {
  bookingId: string
  customerId: string
  organizationId: string
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
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
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
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG || 'sc-studio'
  const name = process.env.DEFAULT_ORGANIZATION_NAME || 'SC Studio & Esmalteria'

  const existing = await client.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )

  if (existing.rows[0]) {
    return existing.rows[0].id
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO organizations (slug, name)
      VALUES ($1, $2)
      RETURNING id
    `,
    [slug, name]
  )

  return created.rows[0].id
}

async function ensureService(
  client: PoolClient,
  organizationId: string,
  input: BookingInput
) {
  const slug = toSlug(input.serviceName)

  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM services
      WHERE organization_id = $1 AND slug = $2
      LIMIT 1
    `,
    [organizationId, slug]
  )

  if (existing.rows[0]) {
    return existing.rows[0].id
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO services (
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
      RETURNING id
    `,
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
    `
      SELECT id
      FROM customers
      WHERE organization_id = $1 AND phone = $2
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [organizationId, input.phone]
  )

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE customers
        SET full_name = $1,
            notes = COALESCE($2, notes),
            updated_at = NOW()
        WHERE id = $3
      `,
      [input.name, input.notes ?? null, existing.rows[0].id]
    )

    return existing.rows[0].id
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO customers (organization_id, full_name, phone, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
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
    const organizationId = await ensureOrganization(client)
    const customerId = await upsertCustomer(client, organizationId, input)
    const serviceId = await ensureService(client, organizationId, input)

    const created = await client.query<{ id: string }>(
      `
        INSERT INTO bookings (
          organization_id,
          customer_id,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'site', 'pending')
        RETURNING id
      `,
      [
        organizationId,
        customerId,
        serviceId,
        input.serviceName,
        input.serviceDuration,
        input.servicePrice,
        bookingDate,
        bookingTime,
        input.notes ?? null,
      ]
    )

    return {
      bookingId: created.rows[0].id,
      customerId,
      organizationId,
    }
  })
}
