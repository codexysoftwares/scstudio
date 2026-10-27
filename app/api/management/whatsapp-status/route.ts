import { NextResponse } from 'next/server'

import { ensureManagementAdminReadAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import { getEvolutionConnectionStatus, resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function GET() {
  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const status = await getEvolutionConnectionStatus(orgId)
  return NextResponse.json(status)
}
