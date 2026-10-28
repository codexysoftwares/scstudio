import 'server-only'

import { query } from '@/lib/db'

const PIX_KEY = process.env.PIX_KEY || '27.333.912/0001-31'
const PIX_THRESHOLD_CENTS = 3500

type AgentBookingMessageRow = {
  id: string
  booking_group_id: string | null
  booking_sequence: number
  service_name_snapshot: string
  service_price_snapshot: string
  booking_date: string
  booking_time: string
  customer_name: string
}

export type AgentBookingAutomationPayload = {
  requiresDeposit: boolean
  paymentStatus: 'confirmed' | 'pending_payment'
  paymentMessage: string | null
  bookingSummaryMessage: string
}

function parsePriceToCents(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDatePt(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekdays = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado']
  const months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${weekdays[date.getDay()]}, ${day} de ${months[month - 1]}`
}

function calculateDepositAmount(totalPriceCents: number) {
  if (totalPriceCents > PIX_THRESHOLD_CENTS) {
    return { cents: Math.round(totalPriceCents * 0.5), label: '50% de sinal' }
  }

  return { cents: totalPriceCents, label: 'valor integral' }
}

function buildServiceLabel(rows: AgentBookingMessageRow[]) {
  const ordered = [...rows].sort((a, b) => a.booking_sequence - b.booking_sequence)
  const uniqueNames = ordered
    .map((row) => row.service_name_snapshot)
    .filter((name, index, all) => all.indexOf(name) === index)

  if (uniqueNames.length <= 1) return uniqueNames[0] ?? 'seu atendimento'
  return uniqueNames.join(' + ')
}

function buildBookingSummaryMessage(rows: AgentBookingMessageRow[], requiresDeposit: boolean) {
  const firstRow = [...rows].sort((a, b) => a.booking_sequence - b.booking_sequence)[0]
  const firstName = firstRow.customer_name.trim().split(/\s+/)[0] ?? ''
  const serviceLabel = buildServiceLabel(rows)
  const dateLabel = formatDatePt(firstRow.booking_date)
  const timeLabel = firstRow.booking_time

  if (requiresDeposit) {
    return `Perfeito${firstName ? `, ${firstName}` : ''}! Separei seu horario para ${serviceLabel} na ${dateLabel} as ${timeLabel}. Ja vou te enviar a mensagem com os dados do sinal para confirmar, ta bem?`
  }

  return `Prontinho${firstName ? `, ${firstName}` : ''}! Seu agendamento para ${serviceLabel} ficou confirmado na ${dateLabel} as ${timeLabel}. Se precisar de mais alguma coisa, estou por aqui.`
}

function buildPaymentMessage(totalPriceCents: number, customerName: string, pixKey?: string | null) {
  const { cents, label } = calculateDepositAmount(totalPriceCents)
  const firstName = customerName.trim().split(/\s+/)[0] ?? ''
  const key = (pixKey && pixKey.trim()) ? pixKey.trim() : PIX_KEY

  return `Agora e so enviar o ${label} para confirmar${firstName ? `, ${firstName}` : ''}.\n\nValor: ${formatBRL(cents)}\nChave PIX: ${key}\n\nAssim que fizer o pagamento, pode me mandar o comprovante por aqui.`
}

export async function resolveAgentBookingInitialStatus(input: {
  orgId: string
  serviceId?: string
  serviceIds?: string[]
  servicePrice?: string
}) {
  const orgResult = await query<{ require_deposit: boolean }>(
    'SELECT require_deposit FROM organizations WHERE id = $1 LIMIT 1',
    [input.orgId]
  )
  const requireDeposit = orgResult.rows[0]?.require_deposit ?? false

  let totalPriceCents = 0

  if (input.serviceIds?.length) {
    const servicesResult = await query<{ price_cents: number }>(
      `SELECT price_cents
       FROM services
       WHERE organization_id = $1
         AND id = ANY($2::uuid[])`,
      [input.orgId, input.serviceIds]
    )
    totalPriceCents = servicesResult.rows.reduce((sum, row) => sum + (row.price_cents ?? 0), 0)
  } else if (input.serviceId) {
    const serviceResult = await query<{ price_cents: number }>(
      `SELECT price_cents
       FROM services
       WHERE organization_id = $1
         AND id = $2
       LIMIT 1`,
      [input.orgId, input.serviceId]
    )
    totalPriceCents = serviceResult.rows[0]?.price_cents ?? 0
  } else if (input.servicePrice) {
    totalPriceCents = parsePriceToCents(input.servicePrice)
  }

  const requiresDeposit = requireDeposit && totalPriceCents > 0

  return {
    requiresDeposit,
    initialStatus: requiresDeposit ? 'pending_payment' as const : 'confirmed' as const,
  }
}

export async function buildAgentBookingAutomationPayload(orgId: string, bookingIds: string[]): Promise<AgentBookingAutomationPayload> {
  const [orgResult, rowsResult] = await Promise.all([
    query<{ require_deposit: boolean; pix_key: string | null }>(
      'SELECT require_deposit, pix_key FROM organizations WHERE id = $1 LIMIT 1',
      [orgId]
    ),
    query<AgentBookingMessageRow>(
      `SELECT b.id,
              b.booking_group_id,
              b.booking_sequence,
              b.service_name_snapshot,
              b.service_price_snapshot,
              b.booking_date::text AS booking_date,
              to_char(b.booking_time, 'HH24:MI') AS booking_time,
              c.full_name AS customer_name
       FROM bookings b
       INNER JOIN customers c ON c.id = b.customer_id
       WHERE b.organization_id = $1
         AND b.id = ANY($2::uuid[])
       ORDER BY b.booking_sequence ASC, b.booking_time ASC`,
      [orgId, bookingIds]
    ),
  ])

  const rows = rowsResult.rows
  if (!rows.length) {
    throw new Error('Nao foi possivel montar as mensagens do agendamento.')
  }

  const totalPriceCents = rows.reduce((sum, row) => sum + parsePriceToCents(row.service_price_snapshot), 0)
  const requiresDeposit = (orgResult.rows[0]?.require_deposit ?? false) && totalPriceCents > 0
  const customerName = rows[0].customer_name

  return {
    requiresDeposit,
    paymentStatus: requiresDeposit ? 'pending_payment' as const : 'confirmed' as const,
    paymentMessage: requiresDeposit ? buildPaymentMessage(totalPriceCents, customerName, orgResult.rows[0]?.pix_key ?? null) : null,
    bookingSummaryMessage: buildBookingSummaryMessage(rows, requiresDeposit),
  }
}
