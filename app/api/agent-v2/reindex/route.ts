import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { reindexAgentKnowledge } from '@/lib/agent-v2/knowledge'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function POST(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const orgId = await resolveDefaultOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  try {
    const result = await reindexAgentKnowledge(orgId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao reindexar conhecimento.' },
      { status: 500 }
    )
  }
}
