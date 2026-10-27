import { NextResponse } from 'next/server'

import { isDatabaseConfigured, query } from '@/lib/db'
import { expandServiceIfBundle, getBundleAvailability, getServiceAvailability } from '@/lib/online-booking'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const serviceId = searchParams.get('serviceId')
  const serviceIds = searchParams.getAll('serviceId')
  const csvServiceIds = searchParams.get('serviceIds')
  const profId = searchParams.get('professionalId')
  const rawProfessionalSelections = searchParams.get('professionalSelections')

  let professionalSelections: Record<string, string | null | undefined> = {}
  if (rawProfessionalSelections) {
    try {
      const parsed = JSON.parse(rawProfessionalSelections) as Array<{ serviceId?: string; professionalId?: string | null }>
      professionalSelections = Object.fromEntries(
        parsed
          .filter((item) => item.serviceId)
          .map((item) => [item.serviceId as string, item.professionalId ?? null])
      )
    } catch {
      professionalSelections = {}
    }
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({
      bookedSlots: [],
      allAvailableSlots: [],
      professionals: [],
    })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      bookedSlots: [],
      allAvailableSlots: [],
      professionals: [],
    })
  }

  const requestedServiceIds = [
    ...new Set(
      [
        ...serviceIds,
        ...(csvServiceIds ? csvServiceIds.split(',') : []),
      ].filter(Boolean)
    ),
  ]

  if (requestedServiceIds.length > 1) {
    try {
      const availability = await getBundleAvailability(
        requestedServiceIds,
        date,
        professionalSelections
      )
      if (!availability) {
        return NextResponse.json({
          bookedSlots: [],
          allAvailableSlots: [],
          professionals: [],
          slotAssignments: {},
        })
      }

      return NextResponse.json({
        bookedSlots: [],
        slotMinutes: availability.slotMinutes,
        allowProfessionalSelection: false,
        professionals: [],
        allAvailableSlots: availability.allAvailableSlots,
        slotAssignments: availability.slotAssignments,
      })
    } catch (err) {
      console.error('[availability bundle]', err)
      return NextResponse.json({
        bookedSlots: [],
        allAvailableSlots: [],
        professionals: [],
        slotAssignments: {},
      })
    }
  }

  if (serviceId || requestedServiceIds.length === 1) {
    try {
      const resolvedServiceId = serviceId ?? requestedServiceIds[0]
      const expandedIds = await expandServiceIfBundle(resolvedServiceId)

      if (expandedIds.length > 1) {
        const availability = await getBundleAvailability(expandedIds, date, professionalSelections)

        // Bundle tem slots com 2 profissionais simultâneos → retorna bundle
        if (availability?.allAvailableSlots?.length) {
          return NextResponse.json({
            bookedSlots: [],
            slotMinutes: availability.slotMinutes,
            allowProfessionalSelection: false,
            professionals: [],
            allAvailableSlots: availability.allAvailableSlots,
            slotAssignments: availability.slotAssignments,
          })
        }

        // Sem 2 profissionais simultâneos → fallback para o serviço único original
        const singleAvailability = await getServiceAvailability(resolvedServiceId, date)
        if (!singleAvailability) {
          return NextResponse.json({ bookedSlots: [], allAvailableSlots: [], professionals: [], slotAssignments: {} })
        }
        const requestedProfId = profId ?? professionalSelections[resolvedServiceId] ?? null
        const selectedProf = requestedProfId
          ? singleAvailability.professionals.find((p) => p.id === requestedProfId)
          : null
        return NextResponse.json({
          bookedSlots: [],
          slotMinutes: singleAvailability.slotMinutes,
          allowProfessionalSelection: singleAvailability.allowProfessionalSelection,
          professionals: singleAvailability.professionals,
          allAvailableSlots: selectedProf ? selectedProf.availableSlots : singleAvailability.allAvailableSlots,
        })
      }

      const requestedProfessionalId = profId ?? professionalSelections[resolvedServiceId] ?? null
      const availability = await getServiceAvailability(resolvedServiceId, date)
      if (!availability) {
        return NextResponse.json({
          bookedSlots: [],
          allAvailableSlots: [],
          professionals: [],
        })
      }

      const selectedProfessional = requestedProfessionalId
        ? availability.professionals.find((professional) => professional.id === requestedProfessionalId)
        : null

      return NextResponse.json({
        bookedSlots: [],
        slotMinutes: availability.slotMinutes,
        allowProfessionalSelection: availability.allowProfessionalSelection,
        professionals: availability.professionals,
        allAvailableSlots: selectedProfessional
          ? selectedProfessional.availableSlots
          : availability.allAvailableSlots,
      })
    } catch (err) {
      console.error('[availability]', err)
      return NextResponse.json({
        bookedSlots: [],
        allAvailableSlots: [],
        professionals: [],
      })
    }
  }

  try {
    const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
    const orgRes = await query<{ id: string }>(
      'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
      [slug]
    )
    const orgId = orgRes.rows[0]?.id
    if (!orgId) return NextResponse.json({ bookedSlots: [] })

    const params: unknown[] = [orgId, date]
    let profFilter = ''
    if (profId) {
      params.push(profId)
      profFilter = `AND professional_id = $${params.length}`
    }

    const result = await query<{ booking_time: string; service_duration_snapshot: string }>(
      `SELECT to_char(booking_time, 'HH24:MI') AS booking_time,
              service_duration_snapshot
       FROM bookings
       WHERE organization_id = $1
         AND booking_date = $2
         AND status NOT IN ('cancelled', 'rescheduled')
         ${profFilter}`,
      params
    )

    const bookedSlots = new Set<string>()
    for (const row of result.rows) {
      const [hh, mm] = row.booking_time.split(':').map(Number)
      const durationMatch = row.service_duration_snapshot?.match(/(\d+)\s*h/i)
      const minMatch = row.service_duration_snapshot?.match(/(\d+)\s*min/i)
      const totalMin = (durationMatch ? parseInt(durationMatch[1], 10) * 60 : 0) + (minMatch ? parseInt(minMatch[1], 10) : 0) || 60
      const start = hh * 60 + mm
      for (let minutes = start; minutes < start + totalMin; minutes += 30) {
        bookedSlots.add(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
      }
    }

    return NextResponse.json({ bookedSlots: [...bookedSlots] })
  } catch (err) {
    console.error('[availability legacy]', err)
    return NextResponse.json({ bookedSlots: [] })
  }
}
