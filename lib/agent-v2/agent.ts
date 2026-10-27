import 'server-only'

import { buildAgentBookingAutomationPayload, resolveAgentBookingInitialStatus } from '@/lib/booking-automation'
import { createBooking } from '@/lib/booking-repository'
import { query } from '@/lib/db'
import { getBundleAvailability, getServiceAvailability } from '@/lib/online-booking'
import { getAgentCatalog, resolveServiceFromText, findProfessionalFromText, type AgentCatalog, type AgentService } from '@/lib/agent-v2/catalog'
import { extractMessage, type ExtractedMessage } from '@/lib/agent-v2/extract'
import { searchAgentKnowledge } from '@/lib/agent-v2/knowledge'
import { answerWithAI } from '@/lib/agent-v2/llm/agent-ai'
import { recordAgentUsageEvent } from '@/lib/agent-v2/llm/usage'
import {
  getOrCreateAgentSession,
  markAgentSessionInbound,
  resetAgentSession,
  saveAgentSession,
  withAgentSessionLock,
  type AgentGathered,
  type AgentSession,
} from '@/lib/agent-v2/session'
import { addDays, formatBRL, formatDatePt, hasAny, normalizePhone, normalizeText, todayInBrazil, toIsoDate, toTimeLabel } from '@/lib/agent-v2/utils'

export type AgentV2Result = {
  responseText: string
  phase: string
  actionType: string
  metadata?: Record<string, unknown>
}

type ActiveBooking = {
  id: string
  booking_group_id: string | null
  booking_date: string
  booking_time: string
  status: string
  service_name_snapshot: string
  professional_name: string | null
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? ''
}

function serviceLabel(gathered: AgentGathered, catalog: AgentCatalog) {
  if (gathered.serviceLabel) return gathered.serviceLabel
  if (gathered.serviceIds?.length) {
    return gathered.serviceIds
      .map((id) => catalog.services.find((service) => service.id === id)?.name)
      .filter(Boolean)
      .join(' + ')
  }
  return catalog.services.find((service) => service.id === gathered.serviceId)?.name ?? 'seu atendimento'
}

function slotsByPeriod(slots: string[], period?: 'manha' | 'tarde' | 'noite') {
  if (!period) return slots
  return slots.filter((slot) => {
    const hour = Number(slot.slice(0, 2))
    if (period === 'manha') return hour < 12
    if (period === 'tarde') return hour >= 12 && hour < 18
    return hour >= 18
  })
}

function slotsMessage(slots: string[]) {
  return slots.slice(0, 6).map(toTimeLabel).join(', ')
}

function buildConfirmation(session: AgentSession, catalog: AgentCatalog) {
  const name = firstName(session.gathered.name)
  const label = serviceLabel(session.gathered, catalog)
  const date = session.gathered.date ? formatDatePt(session.gathered.date) : 'a data escolhida'
  const time = session.gathered.time ? toTimeLabel(session.gathered.time) : 'o horario escolhido'

  return `Fica assim${name ? `, ${name}` : ''}: ${label} na ${date} as ${time}. Confirma pra eu reservar?`
}

function buildMissingService(catalog: AgentCatalog) {
  const examples = catalog.services.slice(0, 4).map((service) => service.name).join(', ')
  return examples
    ? `Consigo te ajudar com o agendamento. Qual servico voce quer fazer? Temos, por exemplo: ${examples}.`
    : 'Consigo te ajudar com o agendamento. Qual servico voce quer fazer?'
}

function buildInfoForService(text: string, catalog: AgentCatalog) {
  const resolution = resolveServiceFromText(text, catalog)
  if (resolution.type === 'single') {
    const service = resolution.service
    return `${service.name} fica ${service.priceLabel} e dura ${service.durationLabel}. Quer que eu veja horarios pra voce?`
  }

  if (resolution.type === 'bundle') {
    const total = resolution.services.reduce((sum, service) => sum + service.priceCents, 0)
    const duration = resolution.rule.mode === 'simultaneous'
      ? Math.max(...resolution.services.map((service) => service.durationMin))
      : resolution.services.reduce((sum, service) => sum + service.durationMin, 0)
    return `${resolution.rule.name} fica ${formatBRL(total)} e dura em media ${duration}min. Quer ver horarios disponiveis?`
  }

  return null
}

async function answerInfo(orgId: string, text: string, catalog: AgentCatalog, session?: AgentSession, phone?: string) {
  const direct = buildInfoForService(text, catalog)
  if (direct) return direct

  const normalized = normalizeText(text)
  if (normalized.includes('servicos')) {
    const byCategory = new Map<string, string[]>()
    for (const service of catalog.services) {
      byCategory.set(service.category, [...(byCategory.get(service.category) ?? []), service.name])
    }
    const list = [...byCategory.entries()]
      .map(([category, services]) => `${category}: ${services.slice(0, 8).join(', ')}`)
      .join('. ')
    return list ? `Temos estes servicos: ${list}.` : 'Ainda nao encontrei servicos ativos no sistema.'
  }

  const hits = await searchAgentKnowledge(orgId, text)
  if (hits.length) {
    const aiAnswer = await answerWithAI({
      orgId,
      sessionId: session?.id,
      phone,
      question: text,
      knowledge: hits,
    })
    if (aiAnswer) return aiAnswer

    const hit = hits[0]
    return `${hit.content.split('\n').slice(0, 4).join(' ')}`
  }

  return 'Consigo te ajudar com servicos, valores, horarios, localizacao e agendamentos. Me fala o que voce quer saber.'
}

function applyServiceResolution(session: AgentSession, catalog: AgentCatalog, text: string) {
  const resolution = resolveServiceFromText(text, catalog)

  if (resolution.type === 'single') {
    session.gathered = {
      ...session.gathered,
      serviceId: resolution.service.id,
      serviceIds: undefined,
      serviceLabel: resolution.service.name,
      fallbackServiceId: null,
      time: undefined,
      slotAssignments: undefined,
    }
  }

  if (resolution.type === 'bundle') {
    session.gathered = {
      ...session.gathered,
      serviceId: undefined,
      serviceIds: resolution.services.map((service) => service.id),
      serviceLabel: resolution.rule.name,
      fallbackServiceId: resolution.fallbackService?.id ?? resolution.rule.fallbackServiceId,
      time: undefined,
      slotAssignments: undefined,
    }
  }

  return resolution
}

async function getAvailabilityForGathered(gathered: AgentGathered) {
  if (!gathered.date) return null

  if (gathered.serviceIds?.length) {
    const bundle = await getBundleAvailability(gathered.serviceIds, gathered.date)
    if (bundle?.allAvailableSlots.length) return { kind: 'bundle' as const, availability: bundle }

    if (gathered.fallbackServiceId) {
      const fallback = await getServiceAvailability(gathered.fallbackServiceId, gathered.date)
      if (fallback?.allAvailableSlots.length) return { kind: 'single' as const, availability: fallback, fallback: true }
    }

    return { kind: 'bundle' as const, availability: bundle }
  }

  if (gathered.serviceId) {
    const single = await getServiceAvailability(gathered.serviceId, gathered.date)
    return { kind: 'single' as const, availability: single }
  }

  return null
}

async function findNextAvailableDays(gathered: AgentGathered, count = 3) {
  const found: Array<{ date: string; slots: string[] }> = []
  const base = todayInBrazil()

  for (let offset = 1; offset <= 21 && found.length < count; offset++) {
    const date = toIsoDate(addDays(base, offset))
    const nextGathered = { ...gathered, date }
    const result = await getAvailabilityForGathered(nextGathered)
    const slots = result?.availability?.allAvailableSlots ?? []
    if (slots.length) found.push({ date, slots })
  }

  return found
}

async function createBookingFromSession(orgId: string, phone: string, session: AgentSession, catalog: AgentCatalog) {
  const name = session.gathered.name || firstName(phone) || 'Cliente'
  const date = session.gathered.date
  const time = session.gathered.time
  if (!date || !time) throw new Error('Data ou horario ausente para criar agendamento.')

  const assignments = session.gathered.slotAssignments?.[time] ?? []
  const payload = session.gathered.serviceIds?.length
    ? {
        name,
        phone,
        serviceIds: session.gathered.serviceIds,
        professionalSelections: assignments.map((assignment) => ({
          serviceId: assignment.serviceId,
          professionalId: assignment.professionalId,
        })),
        date,
        time,
        notes: 'Criado pelo Agent V2',
      }
    : {
        name,
        phone,
        serviceId: session.gathered.serviceId ?? session.gathered.fallbackServiceId ?? undefined,
        professionalId: session.gathered.professionalId ?? null,
        date,
        time,
        notes: 'Criado pelo Agent V2',
      }

  const automationStatus = await resolveAgentBookingInitialStatus({
    orgId,
    serviceId: 'serviceId' in payload ? payload.serviceId ?? undefined : undefined,
    serviceIds: 'serviceIds' in payload ? payload.serviceIds : undefined,
  })

  const booking = await createBooking({
    ...payload,
    source: 'agent-v2',
    initialStatus: automationStatus.initialStatus,
  })

  const automation = await buildAgentBookingAutomationPayload(orgId, booking.bookingIds)
  await rememberBookingPreference(orgId, phone, session, catalog)
  session.gathered = {
    ...session.gathered,
    bookingId: booking.bookingId,
    bookingIds: booking.bookingIds,
    bookingGroupId: booking.bookingGroupId,
  }

  if (automation.requiresDeposit && automation.paymentMessage) {
    session.phase = 'payment'
    await recordAgentUsageEvent(orgId, 'booking_created')
    return `${automation.bookingSummaryMessage}\n\n${automation.paymentMessage}`
  }

  await resetAgentSession(session)
  await recordAgentUsageEvent(orgId, 'booking_created')
  return automation.bookingSummaryMessage || `Prontinho! Seu agendamento para ${serviceLabel(session.gathered, catalog)} ficou confirmado.`
}

async function getRecentMemories(orgId: string, phone: string) {
  const result = await query<{ content: string }>(
    `SELECT content
     FROM agent_memories
     WHERE organization_id = $1
       AND phone_e164 = $2
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY updated_at DESC
     LIMIT 5`,
    [orgId, normalizePhone(phone)]
  )
  return result.rows.map((row) => row.content)
}

async function rememberBookingPreference(orgId: string, phone: string, session: AgentSession, catalog: AgentCatalog) {
  const service = serviceLabel(session.gathered, catalog)
  const parts = [
    `Cliente agendou ${service}`,
    session.gathered.professionalName ? `com ${session.gathered.professionalName}` : null,
    session.gathered.time ? `por volta de ${toTimeLabel(session.gathered.time)}` : null,
  ].filter(Boolean)

  try {
    await query(
      `INSERT INTO agent_memories
         (organization_id, phone_e164, memory_type, content, metadata, expires_at)
       VALUES ($1, $2, 'booking_preference', $3, $4::jsonb, NOW() + INTERVAL '1 year')`,
      [
        orgId,
        normalizePhone(phone),
        parts.join(' '),
        JSON.stringify({
          serviceId: session.gathered.serviceId ?? null,
          serviceIds: session.gathered.serviceIds ?? null,
          professionalId: session.gathered.professionalId ?? null,
          time: session.gathered.time ?? null,
        }),
      ]
    )
  } catch (error) {
    console.warn('[agent-v2-memory] failed to remember booking preference', error)
  }
}

async function getActiveBookings(orgId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone)
  const result = await query<ActiveBooking>(
    `SELECT b.id,
            b.booking_group_id,
            b.booking_date::text AS booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time,
            b.status,
            b.service_name_snapshot,
            p.display_name AS professional_name
     FROM bookings b
     INNER JOIN customers c ON c.id = b.customer_id
     LEFT JOIN professionals p ON p.id = b.professional_id
     WHERE b.organization_id = $1
       AND regexp_replace(c.phone, '\\D', '', 'g') = $2
       AND b.status IN ('pending', 'confirmed', 'pending_payment')
       AND b.booking_date >= CURRENT_DATE
     ORDER BY b.booking_date ASC, b.booking_time ASC
     LIMIT 10`,
    [orgId, normalizedPhone]
  )

  return result.rows
}

async function cancelBooking(orgId: string, bookingId: string) {
  await query(
    `UPDATE bookings
     SET status = 'cancelled',
         source = 'agent-v2',
         updated_at = NOW()
     WHERE id = $1
       AND organization_id = $2`,
    [bookingId, orgId]
  )
}

async function handleCancel(orgId: string, phone: string, session: AgentSession, text: string) {
  const active = await getActiveBookings(orgId, phone)
  if (!active.length) {
    await resetAgentSession(session)
    return 'Nao encontrei agendamentos ativos nesse telefone. Se estiver em outro numero, me manda o telefone usado no agendamento.'
  }

  if (session.phase === 'cancel_confirm' && session.gathered.cancelBookingId) {
    if (hasAny(text, ['sim', 'confirmo', 'pode cancelar', 'cancela'])) {
      await cancelBooking(orgId, session.gathered.cancelBookingId)
      await resetAgentSession(session)
      return 'Cancelado certinho. Se quiser remarcar, vejo novos horarios pra voce.'
    }
    session.phase = 'idle'
    session.gathered.cancelBookingId = undefined
    await saveAgentSession(session)
    return 'Tudo bem, mantive seu agendamento como estava.'
  }

  const selected = active.length === 1
    ? active[0]
    : active.find((booking) => normalizeText(text).includes(normalizeText(booking.service_name_snapshot)))

  if (!selected) {
    session.phase = 'cancel_select'
    await saveAgentSession(session)
    const list = active
      .map((booking) => `${booking.service_name_snapshot} em ${formatDatePt(booking.booking_date)} as ${toTimeLabel(booking.booking_time)}`)
      .join(' ou ')
    return `Encontrei estes horarios: ${list}. Qual deles voce quer cancelar?`
  }

  session.phase = 'cancel_confirm'
  session.gathered.cancelBookingId = selected.id
  await saveAgentSession(session)
  return `Voce quer cancelar ${selected.service_name_snapshot} em ${formatDatePt(selected.booking_date)} as ${toTimeLabel(selected.booking_time)}, certo? Me confirma.`
}

async function continueBooking(
  orgId: string,
  phone: string,
  contactName: string | null,
  session: AgentSession,
  catalog: AgentCatalog,
  text: string,
  extracted: ExtractedMessage
) {
  const serviceSourceText = extracted.serviceText ? `${text} ${extracted.serviceText}` : text
  const resolution = applyServiceResolution(session, catalog, serviceSourceText)

  if (resolution.type === 'ambiguous') {
    session.phase = 'collecting'
    await saveAgentSession(session)
    return `Encontrei algumas opcoes: ${resolution.matches.map((service) => service.name).join(', ')}. Qual delas voce quer?`
  }

  const activeServices = session.gathered.serviceIds?.length
    ? session.gathered.serviceIds.map((id) => catalog.services.find((service) => service.id === id)).filter((service): service is AgentService => Boolean(service))
    : [catalog.services.find((service) => service.id === session.gathered.serviceId)].filter((service): service is AgentService => Boolean(service))

  const professionalSourceText = extracted.professionalText ? `${text} ${extracted.professionalText}` : text
  const professional = findProfessionalFromText(professionalSourceText, activeServices)
  if (professional) {
    session.gathered.professionalId = professional.id
    session.gathered.professionalName = professional.name
    session.gathered.time = undefined
  }

  if (extracted.date && extracted.date !== session.gathered.date) {
    session.gathered.date = extracted.date
    session.gathered.time = undefined
    session.gathered.slotAssignments = undefined
  }

  if (extracted.time) session.gathered.time = extracted.time
  if (extracted.name) session.gathered.name = extracted.name
  if (!session.gathered.name && contactName) session.gathered.name = firstName(contactName)

  if (!session.gathered.serviceId && !session.gathered.serviceIds?.length) {
    session.phase = 'collecting'
    await saveAgentSession(session)
    return buildMissingService(catalog)
  }

  if (!session.gathered.date) {
    session.phase = 'collecting'
    await saveAgentSession(session)
    return `Perfeito, para ${serviceLabel(session.gathered, catalog)}. Qual dia voce prefere?`
  }

  const availabilityResult = await getAvailabilityForGathered(session.gathered)
  if (availabilityResult?.kind === 'single' && availabilityResult.fallback && session.gathered.fallbackServiceId) {
    const fallbackService = catalog.services.find((service) => service.id === session.gathered.fallbackServiceId)
    session.gathered.serviceId = session.gathered.fallbackServiceId
    session.gathered.serviceIds = undefined
    session.gathered.serviceLabel = fallbackService?.name ?? session.gathered.serviceLabel
  }

  const allSlots = availabilityResult?.kind === 'single' && session.gathered.professionalId
    ? availabilityResult.availability?.professionals.find((professional) => professional.id === session.gathered.professionalId)?.availableSlots ?? []
    : availabilityResult?.availability?.allAvailableSlots ?? []
  session.gathered.slotAssignments = availabilityResult?.availability && 'slotAssignments' in availabilityResult.availability
    ? availabilityResult.availability.slotAssignments
    : undefined

  if (!allSlots.length) {
    const nextDays = await findNextAvailableDays(session.gathered)
    session.phase = 'offering_slots'
    session.gathered.time = undefined
    await saveAgentSession(session)
    if (!nextDays.length) return 'Nao encontrei horarios disponiveis para essa combinacao nos proximos dias. Posso chamar a recepcao para te ajudar.'
    return `Nao achei vaga nesse dia. As proximas opcoes sao ${nextDays.map((day) => `${formatDatePt(day.date)} as ${toTimeLabel(day.slots[0])}`).join(', ')}.`
  }

  const filteredSlots = slotsByPeriod(allSlots, extracted.period)
  const candidateSlots = filteredSlots.length ? filteredSlots : allSlots

  if (session.gathered.time && !allSlots.includes(session.gathered.time)) {
    const requested = session.gathered.time
    session.gathered.time = undefined
    session.phase = 'offering_slots'
    await saveAgentSession(session)
    return `${toTimeLabel(requested)} nao esta disponivel. Tenho ${slotsMessage(candidateSlots)}. Qual prefere?`
  }

  if (!session.gathered.time && extracted.wantsAnyTime) {
    session.gathered.time = candidateSlots[0]
  }

  if (!session.gathered.time) {
    session.phase = 'offering_slots'
    await saveAgentSession(session)
    return `Tenho ${slotsMessage(candidateSlots)} para ${serviceLabel(session.gathered, catalog)} em ${formatDatePt(session.gathered.date)}. Qual horario voce prefere?`
  }

  session.phase = 'confirming'
  await saveAgentSession(session)
  return buildConfirmation(session, catalog)
}

export async function handleAgentV2Inbound(input: {
  orgId: string
  phone: string
  text: string
  contactName?: string | null
}): Promise<AgentV2Result> {
  return withAgentSessionLock(input.orgId, input.phone, async () => {
    const phone = normalizePhone(input.phone)
    const catalog = await getAgentCatalog(input.orgId)
    const session = await getOrCreateAgentSession(input.orgId, phone)
    await markAgentSessionInbound(session.id)
    const memories = await getRecentMemories(input.orgId, phone)

    const extracted = await extractMessage(input.text, catalog, {
      orgId: input.orgId,
      sessionId: session.id,
      phone,
      phase: session.phase,
      summary: [session.summary, ...memories].filter(Boolean).join('\n'),
    })

    if (session.phase === 'payment') {
      if (extracted.intent === 'cancel') {
        if (session.gathered.bookingId) await cancelBooking(input.orgId, session.gathered.bookingId)
        await resetAgentSession(session)
        return { responseText: 'Cancelei esse horario pra voce. Quando quiser remarcar, e so me chamar.', phase: 'idle', actionType: 'booking_cancelled_payment' }
      }
      return {
        responseText: 'Seu horario esta separado e estou aguardando o comprovante do PIX por aqui. Assim que enviar, a recepcao confere e confirma certinho.',
        phase: session.phase,
        actionType: 'payment_reminder',
      }
    }

    if (extracted.intent === 'cancel' || session.phase === 'cancel_select' || session.phase === 'cancel_confirm') {
      const responseText = await handleCancel(input.orgId, phone, session, input.text)
      return { responseText, phase: session.phase, actionType: 'cancel_flow' }
    }

    if (session.phase === 'confirming') {
      if (extracted.intent === 'confirm') {
        const responseText = await createBookingFromSession(input.orgId, phone, session, catalog)
        await saveAgentSession(session)
        return { responseText, phase: session.phase, actionType: 'booking_created' }
      }

      if (extracted.intent === 'deny') {
        session.phase = 'collecting'
        session.gathered.time = undefined
        await saveAgentSession(session)
        return { responseText: 'Sem problema. Quer escolher outro horario ou mudar algum dado?', phase: session.phase, actionType: 'confirmation_denied' }
      }

      if (extracted.intent === 'info') {
        const info = await answerInfo(input.orgId, input.text, catalog, session, phone)
        return {
          responseText: `${info}\n\nO agendamento que separei ainda esta aguardando sua confirmacao. ${buildConfirmation(session, catalog)}`,
          phase: session.phase,
          actionType: 'info_during_confirmation',
        }
      }
    }

    if (extracted.intent === 'info' && !session.gathered.serviceId && !session.gathered.serviceIds?.length) {
      const responseText = await answerInfo(input.orgId, input.text, catalog, session, phone)
      session.phase = 'info'
      await saveAgentSession(session)
      return { responseText, phase: session.phase, actionType: 'info_answered' }
    }

    if (extracted.intent === 'handoff') {
      session.phase = 'handoff'
      await saveAgentSession(session)
      await recordAgentUsageEvent(input.orgId, 'handoff')
      return { responseText: 'Claro. Vou deixar a recepcao assumir por aqui para te ajudar melhor.', phase: session.phase, actionType: 'handoff' }
    }

    if (extracted.intent === 'greeting' && !session.gathered.serviceId && !session.gathered.serviceIds?.length) {
      session.phase = 'idle'
      await saveAgentSession(session)
      return { responseText: 'Oi! Posso te ajudar com servicos, valores, horarios ou agendamento. O que voce quer fazer hoje?', phase: session.phase, actionType: 'greeting' }
    }

    const responseText = await continueBooking(input.orgId, phone, input.contactName ?? null, session, catalog, input.text, extracted)
    return { responseText, phase: session.phase, actionType: 'booking_flow' }
  })
}
