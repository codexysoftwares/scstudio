import 'server-only'

import crypto from 'node:crypto'

import { query } from '@/lib/db'
import { normalizePhone } from '@/lib/agent-v2/utils'

export type AgentModelCallType = 'extract' | 'rag' | 'summary' | 'embedding'
export type AgentModelCallStatus = 'success' | 'failed' | 'blocked' | 'unavailable'

type ModelPricing = {
  inputUsdPerMillion: number
  outputUsdPerMillion: number
}

type UsageInput = {
  orgId: string
  sessionId?: string | null
  phone?: string | null
  callType: AgentModelCallType
  model: string
  fallbackUsed?: boolean
  fallbackFrom?: string | null
  status: AgentModelCallStatus
  reason?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  latencyMs?: number | null
  tags?: string[]
  metadata?: Record<string, unknown>
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'openai/gpt-5.4-nano': { inputUsdPerMillion: 0.2, outputUsdPerMillion: 1.25 },
  'openai/gpt-5.4-mini': { inputUsdPerMillion: 0.75, outputUsdPerMillion: 4.5 },
  'openai/gpt-5.4': { inputUsdPerMillion: 2.5, outputUsdPerMillion: 15 },
  'google/gemini-2.5-flash-lite': { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
  'google/gemini-2.5-flash': { inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 },
  'google/gemini-3-flash': { inputUsdPerMillion: 0.5, outputUsdPerMillion: 3 },
  'google/gemini-3.1-flash-lite': { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 },
  'anthropic/claude-haiku-4.5': { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
  'anthropic/claude-sonnet-4.6': { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  'text-embedding-3-small': { inputUsdPerMillion: 0.02, outputUsdPerMillion: 0 },
}

export type AgentAIBudgetState = {
  monthCostUsd: number
  monthCostBrl: number
  freeCreditUsd: number
  freeCreditBrl: number
  paidBudgetBrl: number
  paidUsedBrl: number
  usdBrlRate: number
  isEconomicMode: boolean
  shouldDisableFallback: boolean
  isHardBlocked: boolean
}

function envNumber(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function getAgentModel() {
  return process.env.AGENT_MODEL || 'openai/gpt-5.4-nano'
}

export function getAgentFallbackModel() {
  return process.env.AGENT_FALLBACK_MODEL || 'openai/gpt-5.4-mini'
}

export function getUsdBrlRate() {
  return envNumber('AGENT_AI_USD_BRL_RATE', 5.02)
}

export function hashAgentPhone(phone?: string | null) {
  if (!phone) return null
  return crypto.createHash('sha256').update(normalizePhone(phone)).digest('hex')
}

export function isAgentAIConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL ||
    process.env.CI
  )
}

export function estimateModelCost(model: string, inputTokens = 0, outputTokens = 0) {
  const pricing = MODEL_PRICING[model] ?? { inputUsdPerMillion: 0, outputUsdPerMillion: 0 }
  const usd =
    (Math.max(0, inputTokens) / 1_000_000) * pricing.inputUsdPerMillion +
    (Math.max(0, outputTokens) / 1_000_000) * pricing.outputUsdPerMillion
  const brl = usd * getUsdBrlRate()
  return { usd, brl }
}

export async function getAgentAIBudgetState(orgId: string): Promise<AgentAIBudgetState> {
  const freeCreditUsd = envNumber('AGENT_AI_FREE_CREDIT_USD', 5)
  const paidBudgetBrl = envNumber('AGENT_AI_MONTHLY_PAID_BUDGET_BRL', 100)
  const usdBrlRate = getUsdBrlRate()
  const freeCreditBrl = freeCreditUsd * usdBrlRate

  try {
    const result = await query<{ usd: string | null; brl: string | null }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0)::text AS usd,
              COALESCE(SUM(estimated_cost_brl), 0)::text AS brl
       FROM agent_model_calls
       WHERE organization_id = $1
         AND status = 'success'
         AND created_at >= date_trunc('month', NOW())`,
      [orgId]
    )
    const monthCostUsd = Number(result.rows[0]?.usd ?? 0)
    const monthCostBrl = Number(result.rows[0]?.brl ?? 0)
    const paidUsedBrl = Math.max(0, monthCostBrl - freeCreditBrl)

    return {
      monthCostUsd,
      monthCostBrl,
      freeCreditUsd,
      freeCreditBrl,
      paidBudgetBrl,
      paidUsedBrl,
      usdBrlRate,
      isEconomicMode: monthCostBrl >= freeCreditBrl * 0.7,
      shouldDisableFallback: paidBudgetBrl > 0 && paidUsedBrl >= paidBudgetBrl * 0.9,
      isHardBlocked: paidBudgetBrl > 0 && paidUsedBrl >= paidBudgetBrl,
    }
  } catch {
    return {
      monthCostUsd: 0,
      monthCostBrl: 0,
      freeCreditUsd,
      freeCreditBrl,
      paidBudgetBrl,
      paidUsedBrl: 0,
      usdBrlRate,
      isEconomicMode: false,
      shouldDisableFallback: false,
      isHardBlocked: false,
    }
  }
}

export async function recordAgentModelCall(input: UsageInput) {
  const inputTokens = Math.max(0, input.inputTokens ?? 0)
  const outputTokens = Math.max(0, input.outputTokens ?? 0)
  const totalTokens = Math.max(input.totalTokens ?? 0, inputTokens + outputTokens)
  const cost = estimateModelCost(input.model, inputTokens, outputTokens)
  const phoneHash = hashAgentPhone(input.phone)

  try {
    await query(
      `WITH inserted AS (
         INSERT INTO agent_model_calls
           (organization_id, session_id, phone_hash, call_type, model, fallback_used, fallback_from,
            status, reason, input_tokens, output_tokens, total_tokens, estimated_cost_usd,
            estimated_cost_brl, latency_ms, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::text[], $17::jsonb)
         RETURNING organization_id, created_at::date AS usage_date, model, call_type, status,
                   input_tokens, output_tokens, total_tokens, estimated_cost_usd, estimated_cost_brl
       )
       INSERT INTO agent_usage_daily
         (organization_id, usage_date, model, call_type, total_calls, successful_calls, failed_calls,
          input_tokens, output_tokens, total_tokens, estimated_cost_usd, estimated_cost_brl)
       SELECT organization_id,
              usage_date,
              model,
              call_type,
              1,
              CASE WHEN status = 'success' THEN 1 ELSE 0 END,
              CASE WHEN status IN ('failed', 'blocked', 'unavailable') THEN 1 ELSE 0 END,
              input_tokens,
              output_tokens,
              total_tokens,
              estimated_cost_usd,
              estimated_cost_brl
       FROM inserted
       ON CONFLICT (organization_id, usage_date, model, call_type)
       DO UPDATE SET
         total_calls = agent_usage_daily.total_calls + 1,
         successful_calls = agent_usage_daily.successful_calls + EXCLUDED.successful_calls,
         failed_calls = agent_usage_daily.failed_calls + EXCLUDED.failed_calls,
         input_tokens = agent_usage_daily.input_tokens + EXCLUDED.input_tokens,
         output_tokens = agent_usage_daily.output_tokens + EXCLUDED.output_tokens,
         total_tokens = agent_usage_daily.total_tokens + EXCLUDED.total_tokens,
         estimated_cost_usd = agent_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
         estimated_cost_brl = agent_usage_daily.estimated_cost_brl + EXCLUDED.estimated_cost_brl,
         updated_at = NOW()`,
      [
        input.orgId,
        input.sessionId ?? null,
        phoneHash,
        input.callType,
        input.model,
        Boolean(input.fallbackUsed),
        input.fallbackFrom ?? null,
        input.status,
        input.reason ?? null,
        inputTokens,
        outputTokens,
        totalTokens,
        cost.usd,
        cost.brl,
        Math.max(0, input.latencyMs ?? 0),
        input.tags ?? [],
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  } catch (error) {
    console.warn('[agent-v2-usage] failed to record model call', error)
  }

  return cost
}

export async function recordAgentUsageEvent(orgId: string, event: 'booking_created' | 'handoff') {
  try {
    await query(
      `INSERT INTO agent_usage_daily
         (organization_id, usage_date, model, call_type, bookings_created, handoffs)
       VALUES ($1, CURRENT_DATE, '__agent__', $2, $3, $4)
       ON CONFLICT (organization_id, usage_date, model, call_type)
       DO UPDATE SET
         bookings_created = agent_usage_daily.bookings_created + EXCLUDED.bookings_created,
         handoffs = agent_usage_daily.handoffs + EXCLUDED.handoffs,
         updated_at = NOW()`,
      [
        orgId,
        event,
        event === 'booking_created' ? 1 : 0,
        event === 'handoff' ? 1 : 0,
      ]
    )
  } catch (error) {
    console.warn('[agent-v2-usage] failed to record usage event', error)
  }
}
