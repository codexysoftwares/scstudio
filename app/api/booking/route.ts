import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  buildAgentBookingAutomationPayload,
  type AgentBookingAutomationPayload,
  resolveAgentBookingInitialStatus,
} from '@/lib/booking-automation'
import { createBooking } from '@/lib/booking-repository'
import { isDatabaseConfigured, query } from '@/lib/db'
import { expandServiceIfBundle, formatServiceSnapshots, getServiceById, resolveBundleForBooking } from '@/lib/online-booking'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  serviceId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).max(12).optional(),
  professionalId: z.string().uuid().nullable().optional(),
  professionalSelections: z.array(z.object({
    serviceId: z.string().uuid(),
    professionalId: z.string().uuid().nullable().optional(),
  })).optional(),
  serviceName: z.string().min(1).optional(),
  serviceDuration: z.string().optional(),
  servicePrice: z.string().optional(),
  date: z.string(),
  time: z.string(),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.serviceId && !value.serviceIds?.length && !value.serviceName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceId'],
      message: 'Informe o servico do agendamento.',
    })
  }

  if (value.serviceId && value.serviceIds?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceIds'],
      message: 'Use um servico unico ou uma lista de servicos.',
    })
  }
})

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const result = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return result.rows[0]?.id ?? null
}

const STUDIO_ADDRESS = 'Rua Padre Correia de Almeida, 38 - Santa Efigenia, BH'

function buildFallbackClientMessage(input: {
  customerName: string
  serviceLabel: string
  date: string
  time: string
  priceLabel: string
  bundleAssignments: Array<{ serviceName: string; professionalName: string; startsAt: string }>
}) {
  return [
    'Agendamento Solicitado - SC Studio & Esmalteria',
    '',
    `Olá, ${input.customerName}!`,
    'Seu agendamento foi solicitado com sucesso.',
    '',
    `Serviço: ${input.serviceLabel || '-'}`,
    `Data: ${input.date}`,
    `Horário inicial: ${input.time}`,
    `Valor: ${input.priceLabel || '-'}`,
    ...(input.bundleAssignments.length > 0
      ? ['', 'Sequência prevista:', ...input.bundleAssignments.map((item) => `${item.startsAt} · ${item.serviceName} com ${item.professionalName}`)]
      : []),
    `Endereço: ${STUDIO_ADDRESS}`,
    '',
    'Cancelamentos: avise com pelo menos 2h de antecedência.',
    '',
    'Aguardamos você!',
  ].join('\n')
}

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const {
    name,
    phone,
    serviceId,
    serviceIds,
    professionalId,
    professionalSelections,
    serviceName,
    serviceDuration,
    servicePrice,
    date,
    time,
    notes,
  } = parsed.data

  let bookingId: string | null = null
  let dbPersisted = false
  let resolvedProfessionalId: string | null = null
  let resolvedServiceName = serviceName ?? ''
  let resolvedServiceDuration = serviceDuration ?? ''
  let resolvedServicePrice = servicePrice ?? ''
  let resolvedBundleAssignments: Array<{ serviceName: string; professionalName: string; startsAt: string }> = []
  let ownerPhone = process.env.OWNER_WHATSAPP_PHONE ?? ''
  let automation: AgentBookingAutomationPayload | null = null

  if (isDatabaseConfigured()) {
    try {
      const effectiveServiceIds = serviceId
        ? await expandServiceIfBundle(serviceId)
        : serviceIds ?? []

      const orgId = await resolveOrgId()
      const automationStatus = orgId
        ? await resolveAgentBookingInitialStatus({
            orgId,
            serviceId: effectiveServiceIds.length > 1 ? undefined : serviceId,
            serviceIds: effectiveServiceIds.length > 1 ? effectiveServiceIds : serviceIds,
            servicePrice,
          })
        : { requiresDeposit: false, initialStatus: 'pending' as const }

      // Regra "Pé e Mão": se vier como serviço único mas expandir para 2 serviços,
      // tenta agendar os 2 simultâneos (2 profissionais no mesmo horário). Se não der,
      // cai para o serviço único (1 profissional em sequência).
      let booking = null as Awaited<ReturnType<typeof createBooking>> | null
      if (serviceId && effectiveServiceIds.length > 1) {
        try {
          const bundle = await resolveBundleForBooking({
            date,
            time,
            items: effectiveServiceIds.map((bundleServiceId) => ({
              serviceId: bundleServiceId,
              professionalId: professionalSelections?.find((selection) => selection.serviceId === bundleServiceId)?.professionalId ?? null,
            })),
          })

          resolvedBundleAssignments = bundle.map((item) => ({
            serviceName: item.service.name,
            professionalName: item.professionalName,
            startsAt: item.startsAt,
          }))
          resolvedServiceName = bundle.map((item) => item.service.name).join(' + ')
          resolvedServiceDuration = bundle
            .map((item) => `${item.startsAt} ${item.service.name}`)
            .join(' | ')
          resolvedServicePrice = bundle
            .reduce((total, item) => total + item.service.priceCents, 0)
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

          booking = await createBooking({
            name,
            phone,
            serviceIds: effectiveServiceIds,
            professionalSelections,
            date,
            time,
            notes,
            source: 'site',
            initialStatus: automationStatus.initialStatus,
          })
        } catch {
          // fallback para serviço único
          booking = null
        }
      }

      if (!booking) {
        if (serviceId) {
          const orgIdForService = await resolveOrgId()
          if (orgIdForService) {
            const service = await getServiceById(orgIdForService, serviceId)
            if (service) {
              const snapshots = formatServiceSnapshots(service)
              resolvedServiceName = snapshots.serviceName
              resolvedServiceDuration = snapshots.serviceDuration
              resolvedServicePrice = snapshots.servicePrice
            }
          }
        }

        booking = await createBooking({
          name,
          phone,
          serviceId,
          serviceIds,
          professionalId,
          professionalSelections,
          serviceName,
          serviceDuration,
          servicePrice,
          date,
          time,
          notes,
          source: 'site',
          initialStatus: automationStatus.initialStatus,
        })
      }

      bookingId = booking.bookingId
      dbPersisted = true
      resolvedProfessionalId = booking.professionalId
      automation = await buildAgentBookingAutomationPayload(booking.organizationId, booking.bookingIds)

      const orgResult = await query<{ whatsapp_phone: string | null }>(
        'SELECT whatsapp_phone FROM organizations WHERE id = $1 LIMIT 1',
        [booking.organizationId]
      )
      ownerPhone = orgResult.rows[0]?.whatsapp_phone ?? ownerPhone
    } catch (error) {
      console.error('Falha ao persistir agendamento no Postgres:', error)
      return NextResponse.json({ error: 'Horario indisponivel ou profissional nao elegivel.' }, { status: 409 })
    }
  }

  const ownerMsg = [
    'Novo Agendamento - SC Studio',
    '',
    `Cliente: ${name}`,
    `WhatsApp: ${phone}`,
    `Serviço: ${resolvedServiceName || serviceName || '-'} (${resolvedServiceDuration || serviceDuration || '-'})`,
    `Data: ${date}`,
    `Horário inicial: ${time}`,
    `Valor: ${resolvedServicePrice || servicePrice || '-'}`,
    ...(resolvedBundleAssignments.length > 0
      ? ['Sequência do atendimento:', ...resolvedBundleAssignments.map((item) => `- ${item.startsAt} · ${item.serviceName} com ${item.professionalName}`)]
      : []),
    ...(resolvedProfessionalId ? [`Profissional ID: ${resolvedProfessionalId}`] : []),
    ...(notes ? [`Obs: ${notes}`] : []),
    automation?.requiresDeposit ? 'Status inicial: aguardando pagamento do sinal.' : 'Status inicial: confirmado.',
    '',
    'Responda a este numero para confirmar ou cancelar.',
  ].join('\n')

  const fallbackClientMsg = buildFallbackClientMessage({
    customerName: name,
    serviceLabel: resolvedServiceName || serviceName || '-',
    date,
    time,
    priceLabel: resolvedServicePrice || servicePrice || '-',
    bundleAssignments: resolvedBundleAssignments,
  })

  const clientMessages = automation
    ? [
        automation.bookingSummaryMessage,
        ...(automation.paymentMessage ? [automation.paymentMessage] : []),
      ]
    : [fallbackClientMsg]

  const clientPhone = formatPhone(phone)
  const orgId = isDatabaseConfigured() ? await resolveOrgId() : null
  const ownerSentResult = orgId && ownerPhone
    ? await sendWhatsAppMessage({
        orgId,
        phone: ownerPhone,
        message: ownerMsg,
        metadata: { type: 'booking-owner-notification', bookingId },
        contactName: 'Studio SC',
      })
    : { ok: false }

  const clientSendResults = orgId
    ? await Promise.all(
        clientMessages.map((message, index) =>
          sendWhatsAppMessage({
            orgId,
            phone: clientPhone,
            message,
            metadata: {
              type: index === 0 ? 'booking-client-confirmation' : 'booking-client-payment',
              bookingId,
            },
            contactName: name,
          })
        )
      )
    : []

  return NextResponse.json({
    success: true,
    bookingId,
    bundleAssignments: resolvedBundleAssignments,
    automation,
    dbPersisted,
    ownerSent: ownerSentResult.ok,
    clientSent: clientSendResults.length > 0 ? clientSendResults.every((result) => result.ok) : false,
    ownerWhatsAppFallback: ownerPhone ? `https://wa.me/${ownerPhone}?text=${encodeURIComponent(ownerMsg)}` : null,
    clientWhatsAppFallback: `https://wa.me/${clientPhone}?text=${encodeURIComponent(clientMessages.join('\n\n'))}`,
  })
}
