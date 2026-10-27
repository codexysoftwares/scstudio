import 'server-only'

import { query } from '@/lib/db'

export type WhatsappProviderSettings = {
  provider: 'evolution' | 'disabled'
  evolutionBaseUrl: string | null
  evolutionApiKey: string | null
  evolutionInstanceName: string | null
  evolutionInstanceId: string | null
  evolutionWebhookSecret: string | null
  evolutionConnected: boolean
  ollamaBaseUrl: string | null
  ollamaModel: string
  agentEnabled: boolean
  autoReplyEnabled: boolean
  bookingEnabled: boolean
  invisibleHandoffEnabled: boolean
  humanHandoffTarget: string | null
  testPhone: string | null
}

export type AgentBehaviorSettings = {
  assistantName: string
  personaPrompt: string
  welcomeMessage: string
  fallbackMessage: string
  handoffMessage: string
}

export type WhatsappDeliveryResult = {
  ok: boolean
  provider: 'evolution' | 'disabled'
  providerMessageId?: string | null
  error?: string
}

type MessageLogInput = {
  orgId: string
  phone: string
  direction: 'inbound' | 'outbound'
  body: string
  provider?: string
  providerMessageId?: string | null
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  metadata?: Record<string, unknown>
  contactName?: string | null
}

function normalizePhone(phone: string) {
  // JIDs like @lid or @s.whatsapp.net pass through as-is for Evolution routing
  if (phone.includes('@')) return phone
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

export async function resolveDefaultOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const result = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return result.rows[0]?.id ?? null
}

export const DEFAULT_AGENT_BEHAVIOR: AgentBehaviorSettings = {
  assistantName: 'Recepcao SC',
  personaPrompt:
    'Voce atende em nome da Recepcao SC. Fale com naturalidade, clareza e simpatia. Ajude a cliente com servicos, horarios, localizacao e agendamentos, sempre seguindo a disponibilidade real da agenda. Nunca use linguagem tecnica e nunca diga que e um bot.',
  welcomeMessage: 'Ola! Recepcao SC por aqui. Como posso te ajudar hoje?',
  fallbackMessage:
    'Consigo te ajudar com servicos, horarios, localizacao e agendamentos. Se preferir, continuo seu atendimento por aqui.',
  handoffMessage: 'Perfeito. Vou seguir com seu atendimento por aqui.',
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappProviderSettings = {
  provider: 'disabled',
  evolutionBaseUrl: null,
  evolutionApiKey: null,
  evolutionInstanceName: null,
  evolutionInstanceId: null,
  evolutionWebhookSecret: null,
  evolutionConnected: false,
  ollamaBaseUrl: 'http://ollama:11434',
  ollamaModel: 'llama3.1:8b',
  agentEnabled: false,
  autoReplyEnabled: false,
  bookingEnabled: true,
  invisibleHandoffEnabled: true,
  humanHandoffTarget: null,
  testPhone: null,
}

export async function getWhatsappSettings(orgId: string): Promise<WhatsappProviderSettings> {
  const result = await query<{
    provider: 'evolution' | 'disabled'
    evolution_base_url: string | null
    evolution_api_key: string | null
    evolution_instance_name: string | null
    evolution_instance_id: string | null
    evolution_webhook_secret: string | null
    evolution_connected: boolean
    ollama_base_url: string | null
    ollama_model: string
    agent_enabled: boolean
    auto_reply_enabled: boolean
    booking_enabled: boolean
    invisible_handoff_enabled: boolean
    human_handoff_target: string | null
    test_phone: string | null
  }>(
    `SELECT provider,
            evolution_base_url,
            evolution_api_key,
            evolution_instance_name,
            evolution_instance_id,
            evolution_webhook_secret,
            evolution_connected,
            ollama_base_url,
            ollama_model,
            agent_enabled,
            auto_reply_enabled,
            booking_enabled,
            invisible_handoff_enabled,
            human_handoff_target,
            test_phone
     FROM whatsapp_integration_settings
     WHERE organization_id = $1
     LIMIT 1`,
    [orgId]
  )

  const row = result.rows[0]
  if (!row) return DEFAULT_WHATSAPP_SETTINGS

  return {
    provider: row.provider,
    evolutionBaseUrl: row.evolution_base_url,
    evolutionApiKey: row.evolution_api_key,
    evolutionInstanceName: row.evolution_instance_name,
    evolutionInstanceId: row.evolution_instance_id,
    evolutionWebhookSecret: row.evolution_webhook_secret,
    evolutionConnected: row.evolution_connected,
    ollamaBaseUrl: row.ollama_base_url,
    ollamaModel: row.ollama_model,
    agentEnabled: row.agent_enabled,
    autoReplyEnabled: row.auto_reply_enabled,
    bookingEnabled: row.booking_enabled,
    invisibleHandoffEnabled: row.invisible_handoff_enabled,
    humanHandoffTarget: row.human_handoff_target,
    testPhone: row.test_phone,
  }
}

export async function getAgentBehaviorSettings(orgId: string): Promise<AgentBehaviorSettings> {
  const result = await query<{
    assistant_name: string
    persona_prompt: string
    welcome_message: string
    fallback_message: string
    handoff_message: string
  }>(
    `SELECT assistant_name,
            persona_prompt,
            welcome_message,
            fallback_message,
            handoff_message
     FROM agent_behavior_settings
     WHERE organization_id = $1
     LIMIT 1`,
    [orgId]
  )

  const row = result.rows[0]
  if (!row) return DEFAULT_AGENT_BEHAVIOR

  return {
    assistantName: row.assistant_name,
    personaPrompt: row.persona_prompt,
    welcomeMessage: row.welcome_message,
    fallbackMessage: row.fallback_message,
    handoffMessage: row.handoff_message,
  }
}

async function sendViaEvolution(
  settings: WhatsappProviderSettings,
  phone: string,
  message: string
): Promise<WhatsappDeliveryResult> {
  if (!settings.evolutionBaseUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    return { ok: false, provider: 'evolution', error: 'Configuracao da Evolution incompleta.' }
  }

  try {
    const normalizedBase = settings.evolutionBaseUrl.replace(/\/+$/, '')
    const response = await fetch(
      `${normalizedBase}/message/sendText/${encodeURIComponent(settings.evolutionInstanceName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: settings.evolutionApiKey,
        },
        body: JSON.stringify({
          number: normalizePhone(phone),
          text: message,
          delay: Math.min(Math.max(message.length * 50, 1000), 4000),
        }),
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        ok: false,
        provider: 'evolution',
        error: body || `Falha HTTP ${response.status} ao enviar pela Evolution.`,
      }
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>))
    const providerMessageId = typeof data?.key === 'object' && data.key && 'id' in data.key
      ? String((data.key as { id?: unknown }).id ?? '')
      : typeof data?.messageId === 'string'
        ? data.messageId
        : null

    return {
      ok: true,
      provider: 'evolution',
      providerMessageId,
    }
  } catch (error) {
    return {
      ok: false,
      provider: 'evolution',
      error: error instanceof Error ? error.message : 'Falha desconhecida ao enviar pela Evolution.',
    }
  }
}

export async function sendWhatsAppMessage(input: {
  orgId: string
  phone: string
  message: string
  metadata?: Record<string, unknown>
  contactName?: string | null
}) {
  const settings = await getWhatsappSettings(input.orgId)

  let result: WhatsappDeliveryResult
  if (settings.provider === 'evolution') {
    result = await sendViaEvolution(settings, input.phone, input.message)
  } else {
    result = {
      ok: false,
      provider: 'disabled',
      error: 'Nenhum provedor de WhatsApp configurado.',
    }
  }

  await logWhatsappMessage({
    orgId: input.orgId,
    phone: input.phone,
    direction: 'outbound',
    body: input.message,
    provider: result.provider,
    providerMessageId: result.providerMessageId ?? null,
    deliveryStatus: result.ok ? 'sent' : 'failed',
    metadata: {
      ...(input.metadata ?? {}),
      error: result.error ?? null,
    },
    contactName: input.contactName ?? null,
  })

  return result
}

export async function logWhatsappMessage(input: MessageLogInput) {
  const phone = normalizePhone(input.phone)
  if (!phone) return null

  const contactResult = await query<{ id: string }>(
    `INSERT INTO whatsapp_contacts (organization_id, phone_e164, display_name, last_inbound_at, last_outbound_at, updated_at)
     VALUES (
       $1,
       $2,
       $3,
       CASE WHEN $4 = 'inbound' THEN NOW() ELSE NULL END,
       CASE WHEN $4 = 'outbound' THEN NOW() ELSE NULL END,
       NOW()
     )
     ON CONFLICT (organization_id, phone_e164)
     DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, whatsapp_contacts.display_name),
       last_inbound_at = CASE WHEN $4 = 'inbound' THEN NOW() ELSE whatsapp_contacts.last_inbound_at END,
       last_outbound_at = CASE WHEN $4 = 'outbound' THEN NOW() ELSE whatsapp_contacts.last_outbound_at END,
       updated_at = NOW()
     RETURNING id`,
    [input.orgId, phone, input.contactName ?? null, input.direction]
  )

  const contactId = contactResult.rows[0]?.id
  if (!contactId) return null

  const conversationResult = await query<{ id: string }>(
    `WITH existing AS (
       SELECT id
       FROM whatsapp_conversations
       WHERE organization_id = $1
         AND contact_id = $2
         AND status = 'open'
       ORDER BY updated_at DESC
       LIMIT 1
     )
     INSERT INTO whatsapp_conversations (
       id,
       organization_id,
       contact_id,
       status,
       channel,
       handoff_state,
       last_message_at,
       updated_at
     )
     SELECT gen_random_uuid(), $1, $2, 'open', 'whatsapp', 'agent', NOW(), NOW()
     WHERE NOT EXISTS (SELECT 1 FROM existing)
     RETURNING id`,
    [input.orgId, contactId]
  )

  const conversationId = conversationResult.rows[0]?.id ?? (
    await query<{ id: string }>(
      `SELECT id
       FROM whatsapp_conversations
       WHERE organization_id = $1
         AND contact_id = $2
         AND status = 'open'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [input.orgId, contactId]
    )
  ).rows[0]?.id

  if (!conversationId) return null

  await query(
    `UPDATE whatsapp_conversations
     SET last_message_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  )

  await query(
    `INSERT INTO whatsapp_messages (
       organization_id,
       conversation_id,
       contact_id,
       direction,
       provider,
       provider_message_id,
       message_type,
       body,
       delivery_status,
       metadata,
       sent_at,
       received_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, 'text', $7, $8, $9::jsonb,
       CASE WHEN $4 = 'outbound' THEN NOW() ELSE NULL END,
       CASE WHEN $4 = 'inbound' THEN NOW() ELSE NULL END
     )`,
    [
      input.orgId,
      conversationId,
      contactId,
      input.direction,
      input.provider ?? 'evolution',
      input.providerMessageId ?? null,
      input.body,
      input.deliveryStatus ?? (input.direction === 'inbound' ? 'received' : 'pending'),
      JSON.stringify(input.metadata ?? {}),
    ]
  )

  return {
    contactId,
    conversationId,
  }
}

export async function logAgentAction(input: {
  orgId: string
  conversationId?: string | null
  contactId?: string | null
  bookingId?: string | null
  bookingGroupId?: string | null
  actionType: string
  toolName: string
  inputPayload?: Record<string, unknown>
  outputPayload?: Record<string, unknown>
  resultStatus?: 'success' | 'failed' | 'handoff'
}) {
  await query(
    `INSERT INTO agent_action_logs (
       organization_id,
       conversation_id,
       contact_id,
       booking_id,
       booking_group_id,
       source,
       action_type,
       tool_name,
       input_payload,
       output_payload,
       result_status
     )
     VALUES ($1, $2, $3, $4, $5, 'agent', $6, $7, $8::jsonb, $9::jsonb, $10)`,
    [
      input.orgId,
      input.conversationId ?? null,
      input.contactId ?? null,
      input.bookingId ?? null,
      input.bookingGroupId ?? null,
      input.actionType,
      input.toolName,
      JSON.stringify(input.inputPayload ?? {}),
      JSON.stringify(input.outputPayload ?? {}),
      input.resultStatus ?? 'success',
    ]
  )
}

export async function getEvolutionConnectionStatus(orgId: string) {
  const settings = await getWhatsappSettings(orgId)
  if (settings.provider !== 'evolution') {
    return {
      provider: settings.provider,
      connected: false,
      instanceName: settings.evolutionInstanceName,
      instanceId: settings.evolutionInstanceId,
      raw: null,
      error: settings.provider === 'disabled' ? 'Provedor de WhatsApp desativado.' : null,
    }
  }

  if (!settings.evolutionBaseUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    return {
      provider: settings.provider,
      connected: false,
      instanceName: settings.evolutionInstanceName,
      instanceId: settings.evolutionInstanceId,
      raw: null,
      error: 'Configuracao da Evolution incompleta.',
    }
  }

  try {
    const normalizedBase = settings.evolutionBaseUrl.replace(/\/+$/, '')
    const response = await fetch(
      `${normalizedBase}/instance/connectionState/${encodeURIComponent(settings.evolutionInstanceName)}`,
      {
        headers: {
          apikey: settings.evolutionApiKey,
        },
      }
    )

    if (!response.ok) {
      return {
        provider: settings.provider,
        connected: false,
        instanceName: settings.evolutionInstanceName,
        instanceId: settings.evolutionInstanceId,
        raw: null,
        error: `Falha HTTP ${response.status} ao consultar status da Evolution.`,
      }
    }

    const raw = await response.json().catch(() => ({} as Record<string, unknown>))
    const state =
      typeof raw?.instance?.state === 'string'
        ? raw.instance.state
        : typeof raw?.state === 'string'
          ? raw.state
          : ''
    const connected = ['open', 'connected'].includes(state.toLowerCase())

    return {
      provider: settings.provider,
      connected,
      instanceName: settings.evolutionInstanceName,
      instanceId: settings.evolutionInstanceId,
      raw,
      error: null,
    }
  } catch (error) {
    return {
      provider: settings.provider,
      connected: false,
      instanceName: settings.evolutionInstanceName,
      instanceId: settings.evolutionInstanceId,
      raw: null,
      error: error instanceof Error ? error.message : 'Falha desconhecida ao consultar Evolution.',
    }
  }
}

export async function getEvolutionQrCode(orgId: string): Promise<{
  ok: boolean
  base64?: string | null
  pairingCode?: string | null
  error?: string
}> {
  const settings = await getWhatsappSettings(orgId)
  if (settings.provider !== 'evolution') {
    return { ok: false, error: 'Provedor nao e Evolution.' }
  }
  if (!settings.evolutionBaseUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    return { ok: false, error: 'Configuracao da Evolution incompleta.' }
  }

  try {
    const normalizedBase = settings.evolutionBaseUrl.replace(/\/+$/, '')
    const response = await fetch(
      `${normalizedBase}/instance/connect/${encodeURIComponent(settings.evolutionInstanceName)}`,
      {
        headers: { apikey: settings.evolutionApiKey },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: body || `Falha HTTP ${response.status}` }
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>))
    const base64 =
      typeof data?.base64 === 'string'
        ? data.base64
        : typeof data?.qrcode?.base64 === 'string'
          ? data.qrcode.base64
          : null
    const pairingCode =
      typeof data?.pairingCode === 'string' ? data.pairingCode : null

    if (!base64) {
      return { ok: false, error: 'QR code nao disponivel. A instancia pode ja estar conectada.' }
    }

    return { ok: true, base64, pairingCode }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Falha desconhecida ao obter QR code.',
    }
  }
}

export async function createOrBindEvolutionInstance(orgId: string, webhookUrl: string) {
  const settings = await getWhatsappSettings(orgId)
  if (!settings.evolutionBaseUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    return {
      ok: false,
      error: 'Configuracao da Evolution incompleta.',
    }
  }

  const normalizedBase = settings.evolutionBaseUrl.replace(/\/+$/, '')
  const payload = {
    instanceName: settings.evolutionInstanceName,
    webhook: webhookUrl,
    webhook_by_events: false,
    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
  }

  try {
    const response = await fetch(`${normalizedBase}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: settings.evolutionApiKey,
      },
      body: JSON.stringify(payload),
    })

    const raw = await response.json().catch(() => ({} as Record<string, unknown>))
    return {
      ok: response.ok,
      raw,
      error: response.ok ? null : JSON.stringify(raw),
    }
  } catch (error) {
    return {
      ok: false,
      raw: null,
      error: error instanceof Error ? error.message : 'Falha desconhecida ao criar/vincular instancia.',
    }
  }
}
