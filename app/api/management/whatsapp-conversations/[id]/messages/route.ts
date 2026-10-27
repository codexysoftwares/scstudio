import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ensureManagementWriteAccess } from '@/lib/management-auth'
import {
  getWhatsappInboxConversation,
  sendManualWhatsappConversationMessage,
} from '@/lib/management-whatsapp-inbox'
import { resolveManagementOrgId } from '@/lib/management-dashboard-data'
import { requireStaffSession } from '@/lib/staff-auth'

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const orgId = await resolveManagementOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const { id } = await params

  try {
    await sendManualWhatsappConversationMessage({
      orgId,
      conversationId: id,
      message: parsed.data.message,
      staffName: session?.fullName ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar mensagem.' },
      { status: 400 }
    )
  }

  const conversation = await getWhatsappInboxConversation(orgId, id)
  return NextResponse.json({ ok: true, conversation })
}
