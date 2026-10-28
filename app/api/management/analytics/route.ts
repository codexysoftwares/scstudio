import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db'
import { ensureManagementAdminReadAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'
import { getManagementAnalytics } from '@/lib/management-dashboard-data'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB não configurado' }, { status: 503 })
  }
  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError
  try {
    const { searchParams } = new URL(req.url)
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : null
    const to = toRaw && DATE_RE.test(toRaw) ? toRaw : null
    const data = await getManagementAnalytics(from, to)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[analytics GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
