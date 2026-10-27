import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import { resolveDefaultOrgId, sendWhatsAppMessage } from '@/lib/whatsapp-service'

const schema = z.object({
  phone: z.string().min(8).optional(),
  message: z.string().min(1).max(2000).optional(),
})

export async function POST(req: Request) {
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

  const phone = parsed.data.phone ?? process.env.TEST_WHATSAPP_PHONE ?? ''
  if (!phone) {
    return NextResponse.json({ error: 'Informe um telefone de teste.' }, { status: 400 })
  }

  const result = await sendWhatsAppMessage({
    orgId,
    phone,
    message: parsed.data.message ?? 'Mensagem de teste da integracao WhatsApp do Studio SC.',
    metadata: { type: 'test-message' },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Falha ao enviar mensagem de teste.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId ?? null })
}
