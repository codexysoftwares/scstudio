import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { resolveDefaultOrgId, sendWhatsAppMessage } from '@/lib/whatsapp-service'

const schema = z.object({
  phone: z.string().min(8),
  message: z.string().min(1).max(4000),
  contactName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

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

  const result = await sendWhatsAppMessage({
    orgId,
    phone: parsed.data.phone,
    message: parsed.data.message,
    contactName: parsed.data.contactName ?? null,
    metadata: parsed.data.metadata,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Falha ao enviar mensagem.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId ?? null })
}
