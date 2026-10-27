import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ensureManagementSession, ensureManagementWriteAccess } from '@/lib/management-auth'
import {
  getWhatsappInboxConversation,
  setWhatsappConversationHandoffState,
} from '@/lib/management-whatsapp-inbox'
import { resolveManagementOrgId } from '@/lib/management-dashboard-data'
import { requireStaffSession } from '@/lib/staff-auth'

const patchSchema = z.object({
  handoffState: z.enum(['agent', 'queued', 'human']),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaffSession()
  const authError = ensureManagementSession(session)
  if (authError) return authError

  const orgId = await resolveManagementOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const { id } = await params
  const conversation = await getWhatsappInboxConversation(orgId, id)
  if (!conversation) {
    return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 })
  }

  return NextResponse.json({ conversation })
}

export async function PATCH(
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveManagementOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const { id } = await params
  const ok = await setWhatsappConversationHandoffState({
    orgId,
    conversationId: id,
    handoffState: parsed.data.handoffState,
  })

  if (!ok) {
    return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 })
  }

  const conversation = await getWhatsappInboxConversation(orgId, id)
  return NextResponse.json({ ok: true, conversation })
}
