import 'server-only'

import { generateText, Output, type LanguageModelUsage } from 'ai'
import { z } from 'zod'

import {
  getAgentAIBudgetState,
  getAgentFallbackModel,
  getAgentModel,
  hashAgentPhone,
  isAgentAIConfigured,
  recordAgentModelCall,
  type AgentModelCallType,
} from '@/lib/agent-v2/llm/usage'

type CallAgentModelInput<T> = {
  orgId: string
  sessionId?: string | null
  phone?: string | null
  callType: AgentModelCallType
  system: string
  prompt: string
  schema?: z.ZodType<T>
  reason: string
  tags?: string[]
  allowFallback?: boolean
  critical?: boolean
  temperature?: number
  maxOutputTokens?: number
  timeoutMs?: number
}

export type AgentModelResult<T> =
  | {
      ok: true
      model: string
      output: T
      text: string
      usage: LanguageModelUsage
      fallbackUsed: boolean
      budget: Awaited<ReturnType<typeof getAgentAIBudgetState>>
    }
  | {
      ok: false
      blocked: boolean
      unavailable: boolean
      reason: string
      budget: Awaited<ReturnType<typeof getAgentAIBudgetState>>
    }

function usagePart(value: number | undefined | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function shouldRetryWithFallback(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('429') ||
    message.includes('402') ||
    message.includes('503') ||
    message.includes('timeout') ||
    message.includes('rate') ||
    message.includes('quota') ||
    message.includes('unavailable') ||
    message.includes('invalid') ||
    message.includes('no output')
  )
}

async function runModel<T>(input: CallAgentModelInput<T>, model: string) {
  const result = await generateText({
    model: model as never,
    system: input.system,
    prompt: input.prompt,
    temperature: input.temperature ?? 0,
    maxOutputTokens: input.maxOutputTokens ?? (input.schema ? 450 : 700),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(input.timeoutMs ?? 12_000),
    output: input.schema
      ? Output.object({
          schema: input.schema,
          name: `${input.callType}_result`,
          description: 'Resultado estruturado do Agent V2 do SC Studio.',
        })
      : undefined,
    providerOptions: {
      gateway: {
        user: hashAgentPhone(input.phone) ?? undefined,
        tags: [
          'feature:agent-v2',
          `org:${input.orgId}`,
          `kind:${input.callType}`,
          `model:${model}`,
          ...(input.tags ?? []),
        ],
      },
    },
  })

  return {
    text: result.text,
    output: (input.schema ? result.output : result.text) as T,
    usage: result.usage,
  }
}

export async function callAgentModel<T = string>(input: CallAgentModelInput<T>): Promise<AgentModelResult<T>> {
  const budget = await getAgentAIBudgetState(input.orgId)
  const primaryModel = getAgentModel()
  const fallbackModel = getAgentFallbackModel()

  if (!isAgentAIConfigured()) {
    await recordAgentModelCall({
      orgId: input.orgId,
      sessionId: input.sessionId,
      phone: input.phone,
      callType: input.callType,
      model: primaryModel,
      status: 'unavailable',
      reason: 'ai_gateway_not_configured',
      tags: input.tags,
    })
    return { ok: false, blocked: false, unavailable: true, reason: 'ai_gateway_not_configured', budget }
  }

  if (budget.isHardBlocked && !input.critical) {
    await recordAgentModelCall({
      orgId: input.orgId,
      sessionId: input.sessionId,
      phone: input.phone,
      callType: input.callType,
      model: primaryModel,
      status: 'blocked',
      reason: 'monthly_budget_reached',
      tags: input.tags,
    })
    return { ok: false, blocked: true, unavailable: false, reason: 'monthly_budget_reached', budget }
  }

  const allowFallback = Boolean(input.allowFallback) && fallbackModel && fallbackModel !== primaryModel
  const canUseFallback = allowFallback && (!budget.shouldDisableFallback || input.critical)
  const models = canUseFallback ? [primaryModel, fallbackModel] : [primaryModel]
  let lastError: unknown = null

  for (const [index, model] of models.entries()) {
    const fallbackUsed = index > 0
    const started = Date.now()
    try {
      const result = await runModel(input, model)
      const latencyMs = Date.now() - started
      await recordAgentModelCall({
        orgId: input.orgId,
        sessionId: input.sessionId,
        phone: input.phone,
        callType: input.callType,
        model,
        fallbackUsed,
        fallbackFrom: fallbackUsed ? primaryModel : null,
        status: 'success',
        reason: fallbackUsed ? 'fallback_success' : input.reason,
        inputTokens: usagePart(result.usage.inputTokens),
        outputTokens: usagePart(result.usage.outputTokens),
        totalTokens: usagePart(result.usage.totalTokens),
        latencyMs,
        tags: input.tags,
        metadata: {
          finishReason: 'finishReason' in result ? result.finishReason : undefined,
          budgetEconomicMode: budget.isEconomicMode,
          fallbackDisabled: budget.shouldDisableFallback,
        },
      })
      return { ok: true, model, output: result.output, text: result.text, usage: result.usage, fallbackUsed, budget }
    } catch (error) {
      lastError = error
      const latencyMs = Date.now() - started
      await recordAgentModelCall({
        orgId: input.orgId,
        sessionId: input.sessionId,
        phone: input.phone,
        callType: input.callType,
        model,
        fallbackUsed,
        fallbackFrom: fallbackUsed ? primaryModel : null,
        status: 'failed',
        reason: error instanceof Error ? error.message.slice(0, 500) : 'model_call_failed',
        latencyMs,
        tags: input.tags,
      })
      if (!shouldRetryWithFallback(error)) break
    }
  }

  const reason = lastError instanceof Error ? lastError.message : 'model_call_failed'
  return { ok: false, blocked: false, unavailable: false, reason, budget }
}
