import { NextResponse } from 'next/server'

import { ensureManagementAdminReadAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import { getEvolutionQrCode, resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function GET() {
  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError

  const orgId = await resolveDefaultOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

  const result = await getEvolutionQrCode(orgId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Falha ao obter QR code' }, { status: 400 })
  }

  return NextResponse.json({ base64: result.base64, pairingCode: result.pairingCode ?? null })
}
