import 'server-only'

import { resolveServiceFromText, type AgentCatalog } from '@/lib/agent-v2/catalog'
import { extractWithAI } from '@/lib/agent-v2/llm/agent-ai'
import { addDays, normalizeText, todayInBrazil, toIsoDate } from '@/lib/agent-v2/utils'

export type ExtractedMessage = {
  intent:
    | 'booking'
    | 'info'
    | 'confirm'
    | 'deny'
    | 'cancel'
    | 'reschedule'
    | 'payment'
    | 'handoff'
    | 'greeting'
    | 'thanks'
    | 'unknown'
  date?: string
  time?: string
  period?: 'manha' | 'tarde' | 'noite'
  name?: string
  wantsAnyTime: boolean
  serviceText?: string
  professionalText?: string
  question?: string
  confidence?: number
  source?: 'deterministic' | 'ai' | 'ai-fallback'
  aiReason?: string
}

export type ExtractMessageContext = {
  orgId?: string
  sessionId?: string | null
  phone?: string | null
  phase?: string | null
  summary?: string | null
}

const weekdayNames = [
  ['domingo'],
  ['segunda', 'segunda feira'],
  ['terca', 'terca feira'],
  ['quarta', 'quarta feira'],
  ['quinta', 'quinta feira'],
  ['sexta', 'sexta feira'],
  ['sabado'],
]

function nextWeekday(targetWeekday: number) {
  const today = todayInBrazil()
  const diff = (targetWeekday - today.getDay() + 7) % 7 || 7
  return toIsoDate(addDays(today, diff))
}

function parseDate(text: string) {
  const normalized = normalizeText(text)
  const today = todayInBrazil()

  if (/\bhoje\b/.test(normalized)) return toIsoDate(today)
  if (/\bamanha\b/.test(normalized)) return toIsoDate(addDays(today, 1))
  if (/\b(depois de amanha|depois da amanha)\b/.test(normalized)) return toIsoDate(addDays(today, 2))

  const dmy = normalized.match(/\b(\d{1,2})[\/\s](\d{1,2})(?:[\/\s](\d{2,4}))?\b/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = dmy[3] ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : today.getFullYear()
    return toIsoDate(new Date(year, month - 1, day))
  }

  for (const [weekday, aliases] of weekdayNames.entries()) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return nextWeekday(weekday)
    }
  }

  return undefined
}

function parseTime(text: string) {
  const normalized = normalizeText(text)
  if (/\bmeio dia\b/.test(normalized)) return '12:00'

  const clock = normalized.match(/\b([01]?\d|2[0-3])[:h](\d{2})\b/)
  if (clock) {
    return `${clock[1].padStart(2, '0')}:${clock[2]}`
  }

  const hour = normalized.match(/\b([01]?\d|2[0-3])\s*(?:horas|hora|hrs|h)\b/)
  if (hour) {
    return `${hour[1].padStart(2, '0')}:00`
  }

  return undefined
}

function parsePeriod(text: string): ExtractedMessage['period'] {
  const normalized = normalizeText(text)
  if (/\b(manha|cedo|primeiro horario|abertura)\b/.test(normalized)) return 'manha'
  if (/\b(tarde|almoco|apos o almoco)\b/.test(normalized)) return 'tarde'
  if (/\b(noite|fim do dia|ultimo horario|mais tarde)\b/.test(normalized)) return 'noite'
  return undefined
}

function parseName(text: string) {
  const match = text.match(/\b(?:meu nome e|me chamo|sou a?|sou o|para|pra)\s+([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,})?)/i)
  return match?.[1]?.trim()
}

function inferIntent(text: string, catalog: AgentCatalog): ExtractedMessage['intent'] {
  const normalized = normalizeText(text)
  if (/\b(cancelar|cancela|desmarcar|desmarca)\b/.test(normalized)) return 'cancel'
  if (/\b(remarcar|remarca|mudar horario|trocar horario|mudar data)\b/.test(normalized)) return 'reschedule'
  if (/\b(sim|confirmo|confirma|confirmado|pode ser|isso mesmo|fechado|ta bom|tudo certo)\b/.test(normalized)) return 'confirm'
  if (/\b(nao|negativo|melhor nao|deixa pra la)\b/.test(normalized)) return 'deny'
  if (/\b(paguei|pix|comprovante|pagamento|sinal)\b/.test(normalized)) return 'payment'
  if (/\b(humano|atendente|recepcao|pessoa)\b/.test(normalized)) return 'handoff'
  if (/\b(preco|preco|valor|quanto|duracao|tempo|demora|endereco|onde|localizacao|instagram|funcionamento|horario de funcionamento|servicos)\b/.test(normalized)) return 'info'
  if (/\b(agendar|marcar|fazer|colocar|tem horario|tem vaga|disponibilidade|quero)\b/.test(normalized)) return 'booking'
  if (catalog.services.some((service) => normalized.includes(service.normalizedName))) return 'booking'
  if (/\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(normalized)) return 'greeting'
  if (/\b(obrigad|valeu)\b/.test(normalized)) return 'thanks'
  return 'unknown'
}

function deterministicExtractMessage(text: string, catalog: AgentCatalog): ExtractedMessage {
  const normalized = normalizeText(text)
  return {
    intent: inferIntent(text, catalog),
    date: parseDate(text),
    time: parseTime(text),
    period: parsePeriod(text),
    name: parseName(text),
    wantsAnyTime: /\b(qualquer|primeiro|mais cedo|tanto faz|disponivel)\b/.test(normalized),
    confidence: 0.75,
    source: 'deterministic',
  }
}

function shouldUseAI(text: string, catalog: AgentCatalog, deterministic: ExtractedMessage, context?: ExtractMessageContext) {
  if ((process.env.AGENT_LLM_ENABLED ?? 'true').toLowerCase() === 'false') return false
  if (!context?.orgId) return false

  const normalized = normalizeText(text)
  if (normalized.length < 4) return false
  if (['confirm', 'deny', 'cancel', 'greeting', 'thanks', 'payment'].includes(deterministic.intent)) {
    return false
  }

  const resolution = resolveServiceFromText(text, catalog)
  if (resolution.type === 'ambiguous') return true
  if (resolution.type === 'none' && ['booking', 'unknown', 'reschedule'].includes(deterministic.intent)) return true
  if (deterministic.intent === 'unknown' && ['confirming', 'payment', 'collecting', 'offering_slots'].includes(context.phase ?? '')) {
    return true
  }
  if (/\b(remarcar|trocar|mudar|outro|outra|antes|depois)\b/.test(normalized)) return true
  if (/\?/.test(text) && deterministic.intent !== 'info') return true

  return false
}

export async function extractMessage(
  text: string,
  catalog: AgentCatalog,
  context?: ExtractMessageContext
): Promise<ExtractedMessage> {
  const deterministic = deterministicExtractMessage(text, catalog)
  if (!shouldUseAI(text, catalog, deterministic, context)) return deterministic

  const aiExtracted = await extractWithAI(text, catalog, deterministic, {
    orgId: context?.orgId ?? '',
    sessionId: context?.sessionId,
    phone: context?.phone,
    phase: context?.phase,
    summary: context?.summary,
  })

  return aiExtracted ?? deterministic
}
