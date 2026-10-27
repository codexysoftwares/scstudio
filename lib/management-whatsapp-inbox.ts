import 'server-only'

import { query, withTransaction } from '@/lib/db'
import { logAgentAction, sendWhatsAppMessage } from '@/lib/whatsapp-service'

export type DashboardWhatsappConversationSummary = {
  id: string
  contactId: string
  contactName: string
  phone: string
  status: 'open' | 'closed' | 'archived'
  handoffState: 'agent' | 'queued' | 'human'
  lastMessageAt: string | null
  lastMessagePreview: string
  lastMessageDirection: 'inbound' | 'outbound' | null
}

export type DashboardWhatsappMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  messageType: string
  deliveryStatus: string
  sentAt: string | null
  receivedAt: string | null
  createdAt: string
}

export type DashboardWhatsappConversationDetail = DashboardWhatsappConversationSummary & {
  messages: DashboardWhatsappMessage[]
}

type ConversationSummaryRow = {
  id: string
  contact_id: string
  contact_name: string | null
  phone: string
  status: 'open' | 'closed' | 'archived'
  handoff_state: 'agent' | 'queued' | 'human'
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: 'inbound' | 'outbound' | null
}

function mapConversationSummary(row: ConversationSummaryRow): DashboardWhatsappConversationSummary {
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: row.contact_name?.trim() || 'Contato sem nome',
    phone: row.phone,
    status: row.status,
    handoffState: row.handoff_state,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview?.trim() || 'Sem mensagens ainda',
    lastMessageDirection: row.last_message_direction,
  }
}

export async function getWhatsappInboxConversations(orgId: string, limit = 50) {
  const result = await query<ConversationSummaryRow>(
    `SELECT c.id,
            c.contact_id,
            wc.display_name AS contact_name,
            wc.phone_e164 AS phone,
            c.status,
            c.handoff_state,
            c.last_message_at::text AS last_message_at,
            wm.body AS last_message_preview,
            wm.direction AS last_message_direction
     FROM whatsapp_conversations c
     INNER JOIN whatsapp_contacts wc ON wc.id = c.contact_id
     LEFT JOIN LATERAL (
       SELECT body, direction
       FROM whatsapp_messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) wm ON TRUE
     WHERE c.organization_id = $1
     ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
     LIMIT $2`,
    [orgId, limit]
  )

  return result.rows.map(mapConversationSummary)
}

export async function getWhatsappInboxConversation(orgId: string, conversationId: string) {
  const conversationResult = await query<ConversationSummaryRow>(
    `SELECT c.id,
            c.contact_id,
            wc.display_name AS contact_name,
            wc.phone_e164 AS phone,
            c.status,
            c.handoff_state,
            c.last_message_at::text AS last_message_at,
            wm.body AS last_message_preview,
            wm.direction AS last_message_direction
     FROM whatsapp_conversations c
     INNER JOIN whatsapp_contacts wc ON wc.id = c.contact_id
     LEFT JOIN LATERAL (
       SELECT body, direction
       FROM whatsapp_messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) wm ON TRUE
     WHERE c.organization_id = $1
       AND c.id = $2
     LIMIT 1`,
    [orgId, conversationId]
  )

  const row = conversationResult.rows[0]
  if (!row) return null

  const messageResult = await query<{
    id: string
    direction: 'inbound' | 'outbound'
    body: string
    message_type: string
    delivery_status: string
    sent_at: string | null
    received_at: string | null
    created_at: string
  }>(
    `SELECT id,
            direction,
            body,
            message_type,
            delivery_status,
            sent_at::text AS sent_at,
            received_at::text AS received_at,
            created_at::text AS created_at
     FROM whatsapp_messages
     WHERE organization_id = $1
       AND conversation_id = $2
     ORDER BY created_at ASC
     LIMIT 200`,
    [orgId, conversationId]
  )

  return {
    ...mapConversationSummary(row),
    messages: messageResult.rows.map((message) => ({
      id: message.id,
      direction: message.direction,
      body: message.body,
      messageType: message.message_type,
      deliveryStatus: message.delivery_status,
      sentAt: message.sent_at,
      receivedAt: message.received_at,
      createdAt: message.created_at,
    })),
  } satisfies DashboardWhatsappConversationDetail
}

export async function setWhatsappConversationHandoffState(input: {
  orgId: string
  conversationId: string
  handoffState: 'agent' | 'queued' | 'human'
}) {
  const result = await query<{ id: string }>(
    `UPDATE whatsapp_conversations
     SET handoff_state = $1,
         updated_at = NOW()
     WHERE organization_id = $2
       AND id = $3
     RETURNING id`,
    [input.handoffState, input.orgId, input.conversationId]
  )

  return Boolean(result.rows[0]?.id)
}

export async function sendManualWhatsappConversationMessage(input: {
  orgId: string
  conversationId: string
  message: string
  staffName?: string | null
}) {
  const conversation = await query<{
    id: string
    contact_id: string
    phone_e164: string
    display_name: string | null
  }>(
    `SELECT c.id, c.contact_id, wc.phone_e164, wc.display_name
     FROM whatsapp_conversations c
     INNER JOIN whatsapp_contacts wc ON wc.id = c.contact_id
     WHERE c.organization_id = $1
       AND c.id = $2
     LIMIT 1`,
    [input.orgId, input.conversationId]
  )

  const target = conversation.rows[0]
  if (!target) {
    throw new Error('Conversa nao encontrada.')
  }

  const delivery = await sendWhatsAppMessage({
    orgId: input.orgId,
    phone: target.phone_e164,
    message: input.message,
    contactName: target.display_name ?? null,
    metadata: {
      source: 'management-inbox',
      conversationId: input.conversationId,
      sentBy: input.staffName ?? null,
    },
  })

  if (!delivery.ok) {
    throw new Error(delivery.error ?? 'Falha ao enviar mensagem manual.')
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE whatsapp_conversations
       SET handoff_state = 'human',
           updated_at = NOW()
       WHERE organization_id = $1
         AND id = $2`,
      [input.orgId, input.conversationId]
    )
  })

  await logAgentAction({
    orgId: input.orgId,
    conversationId: input.conversationId,
    contactId: target.contact_id,
    actionType: 'manual_reply',
    toolName: 'management.inbox.send',
    inputPayload: {
      message: input.message,
      staffName: input.staffName ?? null,
    },
    outputPayload: {
      providerMessageId: delivery.providerMessageId ?? null,
    },
    resultStatus: 'handoff',
  })

  return delivery
}
