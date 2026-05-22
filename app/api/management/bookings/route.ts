import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db'
import { getManagementOverviewData } from '@/lib/management-dashboard-data'

function isValidDate(date: string | null) {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date))
}

export async function GET(req: Request) {
  if (!isDatabaseConfigured()) {
    const overview = await getManagementOverviewData()
    return NextResponse.json(overview)
  }

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')

    if (date && !isValidDate(date)) {
      return NextResponse.json({ error: 'Data invalida. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const overview = await getManagementOverviewData(date ?? undefined)
    return NextResponse.json(overview)
  } catch (err) {
    console.error('[management bookings GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
