import 'server-only'

import { z } from 'zod'

import type { AgentCatalog } from '@/lib/agent-v2/catalog'
import type { ExtractedMessage } from '@/lib/agent-v2/extract'
import { callAgentModel } from '@/lib/agent-v2/llm/model'
import { todayInBrazil, toIsoDate } from '@/lib/agent-v2/utils'

type AgentAIContext = {
  orgId: string
  sessionId?: string | null
  phone?: string | null
  phase?: string | null
  summary?: string | null
}

const extractedMessageSchema = z.object({
  intent: z.enum([
    'booking',
    'info',
    'confirm',
    'deny',
    'cancel',
    'reschedule',
    'payment',
    'handoff',
    'greeting',
    'thanks',
    'unknown',
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  period: z.enum(['manha', 'tarde', 'noite']).nullable(),
  name: z.string().nullable(),
  serviceText: z.string().nullable(),
  professionalText: z.string().nullable(),
  question: z.string().nullable(),
  wantsAnyTime: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsHuman: z.boolean(),
  reason: z.string(),
})

const answerSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  shouldHandoff: z.boolean(),
})

function compactCatalog(catalog: AgentCatalog) {
  return {
    services: catalog.services.slice(0, 80).map((service) => ({
      name: service.name,
      aliases: service.aliases,
      category: service.category,
      professionals: service.professionals.map((professional) => professional.name),
    })),
    bundles: catalog.bundleRules.map((rule) => ({
      name: rule.name,
      aliases: rule.triggerAliases,
      mode: rule.mode,
    })),
  }
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export async function extractWithAI(
  text: string,
  catalog: AgentCatalog,
  deterministic: ExtractedMessage,
  context: AgentAIContext
): Promise<ExtractedMessage | null> {
  const today = toIsoDate(todayInBrazil())
  const result = await callAgentModel({
    orgId: context.orgId,
    sessionId: context.sessionId,
    phone: context.phone,
    callType: 'extract',
    reason: 'low_confidence_or_ambiguous_message',
    allowFallback: true,
    critical: ['confirm', 'cancel', 'payment'].includes(deterministic.intent),
    temperature: 0,
    maxOutputTokens: 500,
    tags: [`phase:${context.phase ?? 'unknown'}`],
    schema: extractedMessageSchema,
    system: [
      'Voce extrai campos de mensagens de WhatsApp para o Agent V2 do SC Studio.',
      'Nunca decida disponibilidade, preco, duracao, profissional final ou criacao de booking.',
      'Retorne somente dados estruturados. Use null quando nao tiver certeza.',
      'Datas devem ser YYYY-MM-DD considerando o calendario do Brasil.',
      'Horarios devem ser HH:MM em 24h.',
      'serviceText deve conter o trecho/nome do servico pedido, mesmo com typo, sem inventar servico novo.',
    ].join('\n'),
    prompt: JSON.stringify({
      today,
      phase: context.phase,
      summary: context.summary,
      message: text,
      deterministic,
      catalog: compactCatalog(catalog),
    }),
  })

  if (!result.ok) return null
  if (result.output.confidence < 0.45 && !result.output.needsHuman) return null

  return {
    intent: result.output.needsHuman ? 'handoff' : result.output.intent,
    date: result.output.date ?? deterministic.date,
    time: result.output.time ?? deterministic.time,
    period: result.output.period ?? deterministic.period,
    name: cleanOptionalText(result.output.name) ?? deterministic.name,
    wantsAnyTime: result.output.wantsAnyTime || deterministic.wantsAnyTime,
    serviceText: cleanOptionalText(result.output.serviceText),
    professionalText: cleanOptionalText(result.output.professionalText),
    question: cleanOptionalText(result.output.question),
    confidence: result.output.confidence,
    source: result.fallbackUsed ? 'ai-fallback' : 'ai',
    aiReason: result.output.reason,
  }
}

export async function answerWithAI(input: {
  orgId: string
  sessionId?: string | null
  phone?: string | null
  question: string
  knowledge: Array<{ title: string; content: string; sourceType: string }>
}) {
  if (!input.knowledge.length) return null

  const result = await callAgentModel({
    orgId: input.orgId,
    sessionId: input.sessionId,
    phone: input.phone,
    callType: 'rag',
    reason: 'rag_answer',
    allowFallback: false,
    temperature: 0.2,
    maxOutputTokens: 220,
    tags: ['rag:knowledge'],
    schema: answerSchema,
    system: [
      'Voce responde como recepcao do SC Studio por WhatsApp.',
      'Use somente o conhecimento enviado.',
      'Nao decida preco, duracao, disponibilidade ou agenda se a pergunta depender de dados estruturados.',
      'Responda curto, natural e em portugues do Brasil.',
    ].join('\n'),
    prompt: JSON.stringify({
      question: input.question,
      knowledge: input.knowledge.map((hit) => ({
        title: hit.title,
        sourceType: hit.sourceType,
        content: hit.content.slice(0, 1200),
      })),
    }),
  })

  if (!result.ok || result.output.shouldHandoff || result.output.confidence < 0.45) return null
  return result.output.answer.trim()
}
