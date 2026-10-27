import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { expandServiceIfBundle, getBundleAvailability, getServiceAvailability } from '@/lib/online-booking'

export async function GET(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const serviceIds = [
    ...new Set(searchParams.getAll('serviceId').filter(Boolean)),
  ]

  if (!date || serviceIds.length === 0) {
    return NextResponse.json({ error: 'Informe data e pelo menos um servico.' }, { status: 400 })
  }

  const expandedIds = serviceIds.length === 1
    ? await expandServiceIfBundle(serviceIds[0])
    : serviceIds

  if (expandedIds.length === 1) {
    const availability = await getServiceAvailability(expandedIds[0], date)
    return NextResponse.json(availability)
  }

  const availability = await getBundleAvailability(expandedIds, date)
  return NextResponse.json(availability)
}
