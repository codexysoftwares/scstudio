import { NextResponse } from 'next/server'

import { query } from '@/lib/db'
import { getAgentAIBudgetState, getAgentFallbackModel } from '@/lib/agent-v2/llm/usage'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

type UsageRow = {
  usage_date: string
  model: string
  call_type: string
  total_calls: number
  successful_calls: number
  failed_calls: number
  input_tokens: string
  output_tokens: string
  total_tokens: string
  estimated_cost_usd: string
  estimated_cost_brl: string
  bookings_created: number
  handoffs: number
}

function isAuthorized(req: Request) {
  const token = process.env.AGENT_INTERNAL_TOKEN
  if (!token) return false
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const headerToken = req.headers.get('x-agent-internal-token')
  return bearer === token || headerToken === token
}

function toDateParam(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const url = new URL(req.url)
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayIso = today.toISOString().slice(0, 10)
  const from = toDateParam(url.searchParams.get('from'), firstDay)
  const to = toDateParam(url.searchParams.get('to'), todayIso)

  const [usage, budget, conversations] = await Promise.all([
    query<UsageRow>(
      `SELECT usage_date::text,
              model,
              call_type,
              total_calls,
              successful_calls,
              failed_calls,
              input_tokens::text,
              output_tokens::text,
              total_tokens::text,
              estimated_cost_usd::text,
              estimated_cost_brl::text,
              bookings_created,
              handoffs
       FROM agent_usage_daily
       WHERE organization_id = $1
         AND usage_date BETWEEN $2::date AND $3::date
       ORDER BY usage_date DESC, model ASC, call_type ASC`,
      [orgId, from, to]
    ),
    getAgentAIBudgetState(orgId),
    query<{ conversations: string; phones: string }>(
      `SELECT COUNT(DISTINCT session_id)::text AS conversations,
              COUNT(DISTINCT phone_hash)::text AS phones
       FROM agent_model_calls
       WHERE organization_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date`,
      [orgId, from, to]
    ),
  ])

  const rows = usage.rows.map((row) => ({
    date: row.usage_date,
    model: row.model,
    callType: row.call_type,
    totalCalls: Number(row.total_calls),
    successfulCalls: Number(row.successful_calls),
    failedCalls: Number(row.failed_calls),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    totalTokens: Number(row.total_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
    estimatedCostBrl: Number(row.estimated_cost_brl),
    bookingsCreated: Number(row.bookings_created),
    handoffs: Number(row.handoffs),
  }))

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalCalls += row.totalCalls
      acc.successfulCalls += row.successfulCalls
      acc.failedCalls += row.failedCalls
      acc.inputTokens += row.inputTokens
      acc.outputTokens += row.outputTokens
      acc.totalTokens += row.totalTokens
      acc.estimatedCostUsd += row.estimatedCostUsd
      acc.estimatedCostBrl += row.estimatedCostBrl
      acc.bookingsCreated += row.bookingsCreated
      acc.handoffs += row.handoffs
      return acc
    },
    {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostBrl: 0,
      bookingsCreated: 0,
      handoffs: 0,
    }
  )

  const fallbackModel = getAgentFallbackModel()
  const fallbackCalls = rows
    .filter((row) => row.model === fallbackModel)
    .reduce((sum, row) => sum + row.totalCalls, 0)
  const phones = Number(conversations.rows[0]?.phones ?? 0)
  const bookingCostBrl = totals.bookingsCreated ? totals.estimatedCostBrl / totals.bookingsCreated : 0
  const conversationCostBrl = phones ? totals.estimatedCostBrl / phones : 0

  return NextResponse.json({
    orgId,
    from,
    to,
    budget,
    totals: {
      ...totals,
      fallbackRate: totals.totalCalls ? fallbackCalls / totals.totalCalls : 0,
      handoffRate: phones ? totals.handoffs / phones : 0,
      costPerBookingBrl: bookingCostBrl,
      costPerConversationBrl: conversationCostBrl,
      freeCreditUsedBrl: Math.min(budget.monthCostBrl, budget.freeCreditBrl),
      paidUsedBrl: budget.paidUsedBrl,
    },
    rows,
  })
}
