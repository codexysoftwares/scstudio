import { NextResponse } from 'next/server'
import { z } from 'zod'

import { query, withTransaction } from '@/lib/db'
import { ensureManagementAdminReadAccess, ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import {
  DEFAULT_AGENT_BEHAVIOR,
  DEFAULT_WHATSAPP_SETTINGS,
  getAgentBehaviorSettings,
  getWhatsappSettings,
  resolveDefaultOrgId,
} from '@/lib/whatsapp-service'

const schema = z.object({
  provider: z.enum(['evolution', 'disabled']).optional(),
  evolutionBaseUrl: z.string().optional(),
  evolutionApiKey: z.string().optional(),
  evolutionInstanceName: z.string().optional(),
  evolutionInstanceId: z.string().optional(),
  evolutionWebhookSecret: z.string().optional(),
  evolutionConnected: z.boolean().optional(),
  ollamaBaseUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  agentEnabled: z.boolean().optional(),
  autoReplyEnabled: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  invisibleHandoffEnabled: z.boolean().optional(),
  humanHandoffTarget: z.string().optional(),
  testPhone: z.string().optional(),
  assistantName: z.string().optional(),
  personaPrompt: z.string().optional(),
  welcomeMessage: z.string().optional(),
  fallbackMessage: z.string().optional(),
  handoffMessage: z.string().optional(),
})

export async function GET() {
  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const [whatsappSettings, agentBehaviorSettings] = await Promise.all([
    getWhatsappSettings(orgId),
    getAgentBehaviorSettings(orgId),
  ])

  return NextResponse.json({
    whatsappSettings,
    agentBehaviorSettings,
  })
}

export async function PATCH(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const data = parsed.data

  await withTransaction(async (client) => {
    const currentWhatsApp = await getWhatsappSettings(orgId)
    const currentAgent = await getAgentBehaviorSettings(orgId)

    const nextWhatsApp = {
      ...DEFAULT_WHATSAPP_SETTINGS,
      ...currentWhatsApp,
      provider: data.provider ?? currentWhatsApp.provider,
      evolutionBaseUrl: data.evolutionBaseUrl ?? currentWhatsApp.evolutionBaseUrl,
      evolutionApiKey: data.evolutionApiKey ?? currentWhatsApp.evolutionApiKey,
      evolutionInstanceName: data.evolutionInstanceName ?? currentWhatsApp.evolutionInstanceName,
      evolutionInstanceId: data.evolutionInstanceId ?? currentWhatsApp.evolutionInstanceId,
      evolutionWebhookSecret: data.evolutionWebhookSecret ?? currentWhatsApp.evolutionWebhookSecret,
      evolutionConnected: data.evolutionConnected ?? currentWhatsApp.evolutionConnected,
      ollamaBaseUrl: data.ollamaBaseUrl ?? currentWhatsApp.ollamaBaseUrl,
      ollamaModel: data.ollamaModel ?? currentWhatsApp.ollamaModel,
      agentEnabled: data.agentEnabled ?? currentWhatsApp.agentEnabled,
      autoReplyEnabled: data.autoReplyEnabled ?? currentWhatsApp.autoReplyEnabled,
      bookingEnabled: data.bookingEnabled ?? currentWhatsApp.bookingEnabled,
      invisibleHandoffEnabled: data.invisibleHandoffEnabled ?? currentWhatsApp.invisibleHandoffEnabled,
      humanHandoffTarget: data.humanHandoffTarget ?? currentWhatsApp.humanHandoffTarget,
      testPhone: data.testPhone ?? currentWhatsApp.testPhone,
    }

    await client.query(
      `INSERT INTO whatsapp_integration_settings (
         organization_id,
         provider,
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
         test_phone,
         updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET
         provider = EXCLUDED.provider,
         evolution_base_url = EXCLUDED.evolution_base_url,
         evolution_api_key = EXCLUDED.evolution_api_key,
         evolution_instance_name = EXCLUDED.evolution_instance_name,
         evolution_instance_id = EXCLUDED.evolution_instance_id,
         evolution_webhook_secret = EXCLUDED.evolution_webhook_secret,
         evolution_connected = EXCLUDED.evolution_connected,
         ollama_base_url = EXCLUDED.ollama_base_url,
         ollama_model = EXCLUDED.ollama_model,
         agent_enabled = EXCLUDED.agent_enabled,
         auto_reply_enabled = EXCLUDED.auto_reply_enabled,
         booking_enabled = EXCLUDED.booking_enabled,
         invisible_handoff_enabled = EXCLUDED.invisible_handoff_enabled,
         human_handoff_target = EXCLUDED.human_handoff_target,
         test_phone = EXCLUDED.test_phone,
         updated_at = NOW()`,
      [
        orgId,
        nextWhatsApp.provider,
        nextWhatsApp.evolutionBaseUrl,
        nextWhatsApp.evolutionApiKey,
        nextWhatsApp.evolutionInstanceName,
        nextWhatsApp.evolutionInstanceId,
        nextWhatsApp.evolutionWebhookSecret,
        nextWhatsApp.evolutionConnected,
        nextWhatsApp.ollamaBaseUrl,
        nextWhatsApp.ollamaModel,
        nextWhatsApp.agentEnabled,
        nextWhatsApp.autoReplyEnabled,
        nextWhatsApp.bookingEnabled,
        nextWhatsApp.invisibleHandoffEnabled,
        nextWhatsApp.humanHandoffTarget,
        nextWhatsApp.testPhone,
      ]
    )

    const nextAgent = {
      ...DEFAULT_AGENT_BEHAVIOR,
      ...currentAgent,
      assistantName: data.assistantName ?? currentAgent.assistantName,
      personaPrompt: data.personaPrompt ?? currentAgent.personaPrompt,
      welcomeMessage: data.welcomeMessage ?? currentAgent.welcomeMessage,
      fallbackMessage: data.fallbackMessage ?? currentAgent.fallbackMessage,
      handoffMessage: data.handoffMessage ?? currentAgent.handoffMessage,
    }

    await client.query(
      `INSERT INTO agent_behavior_settings (
         organization_id,
         assistant_name,
         persona_prompt,
         welcome_message,
         fallback_message,
         handoff_message,
         updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET
         assistant_name = EXCLUDED.assistant_name,
         persona_prompt = EXCLUDED.persona_prompt,
         welcome_message = EXCLUDED.welcome_message,
         fallback_message = EXCLUDED.fallback_message,
         handoff_message = EXCLUDED.handoff_message,
         updated_at = NOW()`,
      [
        orgId,
        nextAgent.assistantName,
        nextAgent.personaPrompt,
        nextAgent.welcomeMessage,
        nextAgent.fallbackMessage,
        nextAgent.handoffMessage,
      ]
    )
  })

  return NextResponse.json({ ok: true })
}
