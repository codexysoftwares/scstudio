import { NextResponse } from 'next/server'

import { handleAgentV2Inbound } from '@/lib/agent-v2/agent'
import {
  getAgentBehaviorSettings,
  getWhatsappSettings,
  logAgentAction,
  logWhatsappMessage,
  resolveDefaultOrgId,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-service'

type EvolutionMessagePayload = {
  event?: string
  instance?: string
  data?: {
    key?: {
      remoteJid?: string
      fromMe?: boolean
      id?: string
    }
    pushName?: string
    message?: {
      conversation?: string
      extendedTextMessage?: {
        text?: string
      }
    }
    text?: string
  }
}

function extractPhone(payload: EvolutionMessagePayload) {
  const remoteJid = payload.data?.key?.remoteJid ?? ''
  if (remoteJid.endsWith('@lid')) return remoteJid
  return remoteJid.split('@')[0] ?? ''
}

function extractText(payload: EvolutionMessagePayload) {
  return (
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    payload.data?.text ??
    ''
  ).trim()
}

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase())
}

export async function POST(req: Request) {
  let body: EvolutionMessagePayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const settings = await getWhatsappSettings(orgId)
  const secretHeader = req.headers.get('x-evolution-secret') ?? req.headers.get('x-webhook-secret')
  if (settings.evolutionWebhookSecret && secretHeader !== settings.evolutionWebhookSecret) {
    return NextResponse.json({ error: 'Webhook nao autorizado' }, { status: 401 })
  }

  const event = body.event ?? 'unknown'
  const phone = extractPhone(body)
  const text = extractText(body)
  const fromMe = Boolean(body.data?.key?.fromMe)

  if (event === 'CONNECTION_UPDATE') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (!phone || fromMe || !text) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const logged = await logWhatsappMessage({
    orgId,
    phone,
    direction: 'inbound',
    body: text,
    provider: 'evolution',
    providerMessageId: body.data?.key?.id ?? null,
    deliveryStatus: 'received',
    contactName: body.data?.pushName ?? null,
    metadata: {
      event,
      instance: body.instance ?? null,
    },
  })

  const behavior = await getAgentBehaviorSettings(orgId)

  if (!settings.agentEnabled || !settings.autoReplyEnabled) {
    await logAgentAction({
      orgId,
      conversationId: logged?.conversationId ?? null,
      contactId: logged?.contactId ?? null,
      actionType: 'inbound_message_logged',
      toolName: 'webhook.capture',
      inputPayload: { text },
      outputPayload: { autoReplyEnabled: settings.autoReplyEnabled, agentEnabled: settings.agentEnabled },
    })

    return NextResponse.json({ ok: true, queued: false })
  }

  const agentV2Enabled = isEnabled(process.env.AGENT_V2_ENABLED)
  const agentShadowMode = isEnabled(process.env.AGENT_SHADOW_MODE)
  const agentV2StrictMode = isEnabled(process.env.AGENT_V2_STRICT_MODE)
  const testPhone = (process.env.TEST_WHATSAPP_PHONE ?? '').replace(/\D/g, '')
  const canUseV2ForPhone = !testPhone || phone.replace(/\D/g, '') === testPhone

  if ((agentV2Enabled || agentShadowMode) && canUseV2ForPhone) {
    try {
      const agentV2 = await handleAgentV2Inbound({
        orgId,
        phone,
        text,
        contactName: body.data?.pushName ?? null,
      })

      await logAgentAction({
        orgId,
        conversationId: logged?.conversationId ?? null,
        contactId: logged?.contactId ?? null,
        actionType: agentShadowMode && !agentV2Enabled ? 'agent_v2_shadow_reply' : agentV2.actionType,
        toolName: 'agent-v2.handleInbound',
        inputPayload: { text, phase: agentV2.phase },
        outputPayload: { responseText: agentV2.responseText, metadata: agentV2.metadata ?? null },
        resultStatus: 'success',
      })

      if (agentV2Enabled) {
        const delivery = await sendWhatsAppMessage({
          orgId,
          phone,
          message: agentV2.responseText,
          contactName: body.data?.pushName ?? null,
          metadata: {
            source: 'agent-v2',
            replyToMessageId: body.data?.key?.id ?? null,
            phase: agentV2.phase,
          },
        })

        return NextResponse.json({ ok: true, delivered: delivery.ok, agent: 'v2' })
      }
    } catch (error) {
      await logAgentAction({
        orgId,
        conversationId: logged?.conversationId ?? null,
        contactId: logged?.contactId ?? null,
        actionType: 'agent_v2_failed',
        toolName: 'agent-v2.handleInbound',
        inputPayload: { text },
        outputPayload: { error: error instanceof Error ? error.message : 'unknown' },
        resultStatus: 'failed',
      })

      if (agentV2Enabled && agentV2StrictMode) {
        return NextResponse.json({
          ok: false,
          agent: 'v2',
          strict: true,
          error: 'agent_v2_failed',
        })
      }
    }
  }

  if (agentV2Enabled && agentV2StrictMode && canUseV2ForPhone) {
    await logAgentAction({
      orgId,
      conversationId: logged?.conversationId ?? null,
      contactId: logged?.contactId ?? null,
      actionType: 'agent_v2_strict_no_fallback',
      toolName: 'agent-v2.strict',
      inputPayload: { text },
      outputPayload: { reason: 'v2_enabled_strict_mode' },
      resultStatus: 'failed',
    })

    return NextResponse.json({
      ok: false,
      agent: 'v2',
      strict: true,
      error: 'agent_v2_strict_no_fallback',
    })
  }

  const responseText = `${behavior.welcomeMessage}\n\nRecebi sua mensagem: "${text}". Posso te ajudar com servicos, horarios, localizacao, agendamentos, cancelamentos ou remarcacoes por aqui.`
  const delivery = await sendWhatsAppMessage({
    orgId,
    phone,
    message: responseText,
    contactName: body.data?.pushName ?? null,
    metadata: {
      source: 'agent-webhook',
      replyToMessageId: body.data?.key?.id ?? null,
    },
  })

  await logAgentAction({
    orgId,
    conversationId: logged?.conversationId ?? null,
    contactId: logged?.contactId ?? null,
    actionType: 'auto_reply',
    toolName: 'agent.reply',
    inputPayload: { text },
    outputPayload: {
      deliveryOk: delivery.ok,
      providerMessageId: delivery.providerMessageId ?? null,
    },
    resultStatus: delivery.ok ? 'success' : 'failed',
  })

  return NextResponse.json({ ok: true, delivered: delivery.ok })
}
