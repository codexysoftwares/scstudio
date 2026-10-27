import { NextResponse } from 'next/server'

import { ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import {
  createOrBindEvolutionInstance,
  resolveDefaultOrgId,
} from '@/lib/whatsapp-service'

export async function POST() {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const webhookBaseUrl = process.env.AGENT_WEBHOOK_BASE_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? 'http://localhost:3000'
  const webhookPath = process.env.AGENT_WEBHOOK_PATH ?? '/webhooks/evolution'
  const webhookUrl = `${webhookBaseUrl.replace(/\/+$/, '')}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`

  const result = await createOrBindEvolutionInstance(orgId, webhookUrl)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Falha ao conectar Evolution', raw: result.raw ?? null }, { status: 400 })
  }

  return NextResponse.json({ ok: true, raw: result.raw ?? null })
}
