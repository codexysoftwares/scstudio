import { NextResponse } from 'next/server'

import { ensureManagementSession } from '@/lib/management-auth'
import { getWhatsappInboxConversations } from '@/lib/management-whatsapp-inbox'
import { resolveManagementOrgId } from '@/lib/management-dashboard-data'
import { requireStaffSession } from '@/lib/staff-auth'

export async function GET() {
  const session = await requireStaffSession()
  const authError = ensureManagementSession(session)
  if (authError) return authError

  const orgId = await resolveManagementOrgId()
  if (!orgId) return NextResponse.json({ conversations: [] })

  const conversations = await getWhatsappInboxConversations(orgId)
  return NextResponse.json({ conversations })
}
