import 'server-only'

import { query } from '@/lib/db'
import { getFallbackBusinessHourForWeekday } from '@/lib/services'

type BookingContext = {
  orgId: string
  timezone: string
  bookingSlotMinutes: number
  allowProfessionalSelection: boolean
}

type ServiceRow = {
  id: string
  name: string
  category: string
  durationMin: number
  priceCents: number
  bundleServiceIds?: string[]
  bundleMode?: BundleMode
  fallbackServiceId?: string | null
  requireDistinctProfessionals?: boolean
}

export type AvailableProfessional = {
  id: string
  displayName: string
  specialty: string
  isFeatured: boolean
  availableSlots: string[]
  activeBookingCount: number
}

export type ServiceAvailability = {
  service: ServiceRow
  allowProfessionalSelection: boolean
  slotMinutes: number
  professionals: AvailableProfessional[]
  allAvailableSlots: string[]
}

export type SlotAssignment = {
  serviceId: string
  serviceName: string
  professionalId: string
  professionalName: string
  startsAt: string
  sequence: number
  durationMin: number
}

export type BundleAvailability = {
  services: ServiceRow[]
  mode: BundleMode
  slotMinutes: number
  allAvailableSlots: string[]
  slotAssignments: Record<string, SlotAssignment[]>
}

type BookingRow = {
  professional_id: string | null
  booking_time: string
  duration_min: number | null
  service_duration_snapshot: string
}

type BlockRow = {
  professional_id: string | null
  starts_at: string
  ends_at: string
}

type BundleMode = 'sequential' | 'simultaneous'

type BundleRuleRow = {
  id: string
  mode: BundleMode
  service_ids: string[]
  fallback_service_id: string | null
  require_distinct_professionals: boolean
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 0
}

function resolveSlotMinutes(baseSlotMinutes: number, durations: number[]) {
  const candidates = [baseSlotMinutes, ...durations].filter((n) => Number.isFinite(n) && n > 0)
  let g = candidates[0] ?? 30
  for (const n of candidates.slice(1)) g = gcd(g, n)
  // Evita granularidade absurda (0/1/2/3/4) e mantém previsível
  if (g < 5) return 5
  return g
}

function toTimeString(totalMinutes: number) {
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function parseDurationToMinutes(value: string) {
  const hoursMatch = value.match(/(\d+)\s*h/i)
  const minutesMatch = value.match(/(\d+)\s*min/i)
  const hours = hoursMatch ? Number(hoursMatch[1]) * 60 : 0
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0
  return hours + minutes || 60
}

function priceToLabel(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function durationToLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

function dateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function inferBundleMode(services: ServiceRow[]) : BundleMode {
  if (services.length !== 2) return 'sequential'
  const names = new Set(services.map((s) => normalizeLabel(s.name)))
  // Regra especial: "Pé" + "Mão" devem ser simultâneos (2 profissionais no mesmo horário)
  if (names.has('pe') && names.has('mao')) return 'simultaneous'
  return 'sequential'
}

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const result = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return result.rows[0]?.id ?? null
}

export async function getBookingContext(): Promise<BookingContext | null> {
  const orgId = await resolveOrgId()
  if (!orgId) return null

  const result = await query<{
    timezone: string
    booking_slot_minutes: number
    allow_professional_selection: boolean
  }>(
    `SELECT timezone, booking_slot_minutes, allow_professional_selection
     FROM organizations
     WHERE id = $1`,
    [orgId]
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    orgId,
    timezone: row.timezone,
    bookingSlotMinutes: row.booking_slot_minutes,
    allowProfessionalSelection: row.allow_professional_selection,
  }
}

export async function getServiceById(orgId: string, serviceId: string): Promise<ServiceRow | null> {
  const result = await query<{
    id: string
    name: string
    category: string
    duration_min: number
    price_cents: number
  }>(
    `SELECT id, name, category, duration_min, price_cents
     FROM services
     WHERE id = $1
       AND organization_id = $2
       AND is_active = TRUE
       AND online_booking_enabled = TRUE`,
    [serviceId, orgId]
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    durationMin: row.duration_min,
    priceCents: row.price_cents,
  }
}

async function getActiveBundleRules(orgId: string): Promise<BundleRuleRow[]> {
  const result = await query<BundleRuleRow>(
    `SELECT id, mode, service_ids, fallback_service_id, require_distinct_professionals
     FROM service_bundle_rules
     WHERE organization_id = $1
       AND is_active = TRUE`,
    [orgId]
  )

  return result.rows
}

function sameServiceSet(a: string[], b: string[]) {
  const left = [...new Set(a)].sort()
  const right = [...new Set(b)].sort()
  return left.length === right.length && left.every((item, index) => item === right[index])
}

async function findBundleRuleByFallback(orgId: string, serviceId: string) {
  const result = await query<BundleRuleRow>(
    `SELECT id, mode, service_ids, fallback_service_id, require_distinct_professionals
     FROM service_bundle_rules
     WHERE organization_id = $1
       AND fallback_service_id = $2
       AND is_active = TRUE
     LIMIT 1`,
    [orgId, serviceId]
  )

  return result.rows[0] ?? null
}

async function findBundleRuleForServices(orgId: string, serviceIds: string[]) {
  const rules = await getActiveBundleRules(orgId)
  return rules.find((rule) => sameServiceSet(rule.service_ids, serviceIds)) ?? null
}

export async function expandServiceIfBundle(serviceId: string): Promise<string[]> {
  const context = await getBookingContext()
  if (!context) return [serviceId]
  const rule = await findBundleRuleByFallback(context.orgId, serviceId)
  if (rule?.service_ids?.length) return rule.service_ids
  return [serviceId]
}

async function getBusinessHours(orgId: string, weekday: number) {
  const result = await query<{
    opens_at: string | null
    closes_at: string | null
    is_closed: boolean
  }>(
    `SELECT to_char(opens_at, 'HH24:MI') AS opens_at,
            to_char(closes_at, 'HH24:MI') AS closes_at,
            is_closed
     FROM business_hours
     WHERE organization_id = $1
       AND weekday = $2
     LIMIT 1`,
    [orgId, weekday]
  )

  const row = result.rows[0]
  if (row) return row

  const fallback = getFallbackBusinessHourForWeekday(weekday)
  return {
    opens_at: fallback.opensAt,
    closes_at: fallback.closesAt,
    is_closed: fallback.isClosed,
  }
}

async function getProfessionalWorkingHours(
  orgId: string,
  professionalId: string,
  weekday: number,
  businessHour: { opens_at: string | null; closes_at: string | null; is_closed: boolean }
) {
  const result = await query<{
    opens_at: string | null
    closes_at: string | null
    is_closed: boolean
    inherits_business_hours: boolean
  }>(
    `SELECT to_char(opens_at, 'HH24:MI') AS opens_at,
            to_char(closes_at, 'HH24:MI') AS closes_at,
            is_closed,
            inherits_business_hours
     FROM professional_working_hours
     WHERE organization_id = $1
       AND professional_id = $2
       AND weekday = $3
     LIMIT 1`,
    [orgId, professionalId, weekday]
  )

  const row = result.rows[0]
  if (!row || row.inherits_business_hours) return businessHour

  return {
    opens_at: row.opens_at,
    closes_at: row.closes_at,
    is_closed: row.is_closed,
  }
}

async function getEligibleProfessionals(orgId: string, service: ServiceRow) {
  const direct = await query<{
    id: string
    display_name: string
    specialty: string | null
    is_featured: boolean
  }>(
    `SELECT DISTINCT p.id, p.display_name, p.specialty, p.is_featured
     FROM professionals p
     INNER JOIN service_professionals sp ON sp.professional_id = p.id
     WHERE p.organization_id = $1
       AND sp.service_id = $2
       AND p.accepts_online_booking = TRUE
     ORDER BY p.is_featured DESC, p.display_name ASC`,
    [orgId, service.id]
  )

  if (direct.rows.length > 0) return direct.rows

  const fallback = await query<{
    id: string
    display_name: string
    specialty: string | null
    is_featured: boolean
  }>(
    `SELECT id, display_name, specialty, is_featured
     FROM professionals
     WHERE organization_id = $1
       AND accepts_online_booking = TRUE
     ORDER BY is_featured DESC, display_name ASC`,
    [orgId]
  )

  return fallback.rows
}

async function getBookingsForDate(orgId: string, date: string, professionalIds: string[]) {
  if (professionalIds.length === 0) return []

  const result = await query<BookingRow>(
    `SELECT professional_id,
            to_char(booking_time, 'HH24:MI') AS booking_time,
            s.duration_min,
            b.service_duration_snapshot
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     WHERE b.organization_id = $1
       AND b.booking_date = $2::date
       AND b.professional_id = ANY($3::uuid[])
       AND b.status NOT IN ('cancelled', 'rescheduled')`,
    [orgId, date, professionalIds]
  )

  return result.rows
}

async function getBlocksForDate(orgId: string, date: string, professionalIds: string[]) {
  if (professionalIds.length === 0) return []

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59`)

  const result = await query<BlockRow>(
    `SELECT professional_id, starts_at::text, ends_at::text
     FROM schedule_blocks
     WHERE organization_id = $1
       AND affects_online_booking = TRUE
       AND starts_at < $2::timestamptz
       AND ends_at > $3::timestamptz
       AND (professional_id IS NULL OR professional_id = ANY($4::uuid[]))`,
    [orgId, dayEnd.toISOString(), dayStart.toISOString(), professionalIds]
  )

  return result.rows
}

function buildBaseSlots(
  opensAt: string,
  closesAt: string,
  durationMin: number,
  slotMinutes: number
) {
  const openMinutes = toMinutes(opensAt)
  const closeMinutes = toMinutes(closesAt)
  const slots: string[] = []

  for (let start = openMinutes; start + durationMin <= closeMinutes; start += slotMinutes) {
    slots.push(toTimeString(start))
  }

  return slots
}

export async function getServiceAvailability(serviceId: string, date: string): Promise<ServiceAvailability | null> {
  const context = await getBookingContext()
  if (!context) return null

  const service = await getServiceById(context.orgId, serviceId)
  if (!service) return null

  const slotMinutes = resolveSlotMinutes(context.bookingSlotMinutes, [service.durationMin])

  const day = new Date(`${date}T00:00:00`)
  const weekday = day.getDay()
  const businessHour = await getBusinessHours(context.orgId, weekday)
  if (!businessHour || businessHour.is_closed || !businessHour.opens_at || !businessHour.closes_at) {
    return {
      service,
      allowProfessionalSelection: context.allowProfessionalSelection,
      slotMinutes,
      professionals: [],
      allAvailableSlots: [],
    }
  }

  const professionals = await getEligibleProfessionals(context.orgId, service)
  const professionalIds = professionals.map((professional) => professional.id)
  const [bookings, blocks] = await Promise.all([
    getBookingsForDate(context.orgId, date, professionalIds),
    getBlocksForDate(context.orgId, date, professionalIds),
  ])

  const normalizedBlocks = blocks.map((block) => ({
    professionalId: block.professional_id,
    start: new Date(block.starts_at),
    end: new Date(block.ends_at),
  }))

  const normalizedBookings = bookings.map((booking) => {
    const duration = booking.duration_min ?? parseDurationToMinutes(booking.service_duration_snapshot)
    const start = dateTime(date, booking.booking_time)
    const end = new Date(start.getTime() + duration * 60_000)

    return {
      professionalId: booking.professional_id,
      start,
      end,
    }
  })

  const availableProfessionals: AvailableProfessional[] = await Promise.all(professionals.map(async (professional) => {
    const activeBookingCount = normalizedBookings.filter(
      (booking) => booking.professionalId === professional.id
    ).length

    const professionalHour = await getProfessionalWorkingHours(
      context.orgId,
      professional.id,
      weekday,
      businessHour
    )

    const baseSlots = (!professionalHour || professionalHour.is_closed || !professionalHour.opens_at || !professionalHour.closes_at)
      ? []
      : buildBaseSlots(
          professionalHour.opens_at,
          professionalHour.closes_at,
          service.durationMin,
          slotMinutes
        )

    const availableSlots = baseSlots.filter((slot) => {
      const slotStart = dateTime(date, slot)
      const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000)

      const blocked = normalizedBlocks.some((block) => {
        if (block.professionalId && block.professionalId !== professional.id) return false
        return overlaps(slotStart, slotEnd, block.start, block.end)
      })
      if (blocked) return false

      const occupied = normalizedBookings.some((booking) => {
        if (booking.professionalId !== professional.id) return false
        return overlaps(slotStart, slotEnd, booking.start, booking.end)
      })

      return !occupied
    })

    return {
      id: professional.id,
      displayName: professional.display_name,
      specialty: professional.specialty ?? '',
      isFeatured: professional.is_featured,
      availableSlots,
      activeBookingCount,
    }
  }))

  const allAvailableSlots = [...new Set(availableProfessionals.flatMap((professional) => professional.availableSlots))]
    .sort((a, b) => toMinutes(a) - toMinutes(b))

  return {
    service,
    allowProfessionalSelection: context.allowProfessionalSelection,
    slotMinutes,
    professionals: availableProfessionals,
    allAvailableSlots,
  }
}

function sortProfessionalCandidates(a: AvailableProfessional, b: AvailableProfessional) {
  if (a.activeBookingCount !== b.activeBookingCount) {
    return a.activeBookingCount - b.activeBookingCount
  }
  if (a.isFeatured !== b.isFeatured) {
    return a.isFeatured ? -1 : 1
  }
  return a.displayName.localeCompare(b.displayName, 'pt-BR')
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  return toTimeString(toMinutes(time) + minutesToAdd)
}

function addMinutesToTimeAligned(time: string, minutesToAdd: number, slotMinutes: number) {
  const next = toMinutes(time) + minutesToAdd
  const aligned = slotMinutes > 0 ? Math.ceil(next / slotMinutes) * slotMinutes : next
  return toTimeString(aligned)
}

function findSequentialBundleAssignments(
  services: ServiceAvailability[],
  slot: string,
  slotMinutes: number,
  requestedProfessionalIds: Record<string, string | null | undefined> = {}
): SlotAssignment[] | null {
  function backtrack(
    index: number,
    currentTime: string,
    currentAssignments: SlotAssignment[]
  ): SlotAssignment[] | null {
    const availability = services[index]
    if (!availability) return currentAssignments

    const requestedProfessionalId = requestedProfessionalIds[availability.service.id]
    const usedProfessionalIds = new Set(currentAssignments.map((assignment) => assignment.professionalId))
    const baseCandidates = availability.professionals
      .filter((professional) => professional.availableSlots.includes(currentTime))
      .sort(sortProfessionalCandidates)

    const candidates = requestedProfessionalId
      ? baseCandidates.filter((candidate) => candidate.id === requestedProfessionalId)
      : [
          ...baseCandidates.filter((candidate) => !usedProfessionalIds.has(candidate.id)),
          ...baseCandidates.filter((candidate) => usedProfessionalIds.has(candidate.id)),
        ]

    for (const selected of candidates) {
      const resolved = backtrack(
        index + 1,
        addMinutesToTimeAligned(currentTime, availability.service.durationMin, slotMinutes),
        [
          ...currentAssignments,
          {
            serviceId: availability.service.id,
            serviceName: availability.service.name,
            professionalId: selected.id,
            professionalName: selected.displayName,
            startsAt: currentTime,
            sequence: index + 1,
            durationMin: availability.service.durationMin,
          },
        ]
      )

      if (resolved) return resolved
    }

    return null
  }

  return backtrack(0, slot, [])
}

function findSimultaneousAssignments(
  services: ServiceAvailability[],
  slot: string,
  requestedProfessionalIds: Record<string, string | null | undefined> = {}
): SlotAssignment[] | null {
  const assignments: SlotAssignment[] = []
  const usedProfessionalIds = new Set<string>()

  for (const [index, availability] of services.entries()) {
    // Todos os serviços começam no mesmo horário (simultâneo)
    const requestedProfessionalId = requestedProfessionalIds[availability.service.id]
    const candidates = availability.professionals
      .filter((professional) => professional.availableSlots.includes(slot) && !usedProfessionalIds.has(professional.id))
      .sort(sortProfessionalCandidates)

    const selected = requestedProfessionalId
      ? candidates.find((candidate) => candidate.id === requestedProfessionalId)
      : candidates[0]

    if (!selected) return null

    usedProfessionalIds.add(selected.id)
    assignments.push({
      serviceId: availability.service.id,
      serviceName: availability.service.name,
      professionalId: selected.id,
      professionalName: selected.displayName,
      startsAt: slot,
      sequence: index + 1,
      durationMin: availability.service.durationMin,
    })
  }

  return assignments
}

export async function getBundleAvailability(
  serviceIds: string[],
  date: string,
  requestedProfessionalIds: Record<string, string | null | undefined> = {},
  options?: { mode?: BundleMode }
): Promise<BundleAvailability | null> {
  const uniqueServiceIds = [...new Set(serviceIds)].filter(Boolean)
  if (uniqueServiceIds.length === 0) return null

  const availabilities = await Promise.all(uniqueServiceIds.map((serviceId) => getServiceAvailability(serviceId, date)))
  if (availabilities.some((availability) => !availability)) return null

  const validAvailabilities = availabilities as ServiceAvailability[]
  const context = await getBookingContext()
  const rule = context ? await findBundleRuleForServices(context.orgId, uniqueServiceIds) : null
  const mode = options?.mode ?? rule?.mode ?? inferBundleMode(validAvailabilities.map((a) => a.service))
  const slotMinutes = resolveSlotMinutes(
    validAvailabilities[0]?.slotMinutes ?? 30,
    validAvailabilities.map((availability) => availability.service.durationMin)
  )
  const slotAssignments: Record<string, SlotAssignment[]> = {}

  const candidateSlots = [...new Set(validAvailabilities.flatMap((availability) => availability.allAvailableSlots))]
    .sort((a, b) => toMinutes(a) - toMinutes(b))

  for (const slot of candidateSlots) {
    const assignments = mode === 'simultaneous'
      ? findSimultaneousAssignments(validAvailabilities, slot, requestedProfessionalIds)
      : findSequentialBundleAssignments(validAvailabilities, slot, slotMinutes, requestedProfessionalIds)
    if (assignments && assignments.length === validAvailabilities.length) {
      slotAssignments[slot] = assignments
    }
  }

  return {
    services: validAvailabilities.map((availability) => availability.service),
    mode,
    slotMinutes,
    allAvailableSlots: Object.keys(slotAssignments).sort((a, b) => toMinutes(a) - toMinutes(b)),
    slotAssignments,
  }
}

export async function resolveProfessionalForBooking(input: {
  serviceId: string
  date: string
  time: string
  professionalId?: string | null
}) {
  const availability = await getServiceAvailability(input.serviceId, input.date)
  if (!availability) {
    throw new Error('Servico ou disponibilidade nao encontrados para o agendamento online.')
  }

  const candidates = availability.professionals.filter((professional) =>
    professional.availableSlots.includes(input.time)
  )

  if (candidates.length === 0) {
    throw new Error('Nenhum profissional disponivel para esse horario.')
  }

  if (input.professionalId) {
    const selected = candidates.find((candidate) => candidate.id === input.professionalId)
    if (!selected) {
      throw new Error('A profissional selecionada nao esta disponivel neste horario.')
    }

    return {
      professionalId: selected.id,
      service: availability.service,
    }
  }

  const best = [...candidates].sort(sortProfessionalCandidates)[0]

  return {
    professionalId: best.id,
    service: availability.service,
  }
}

export async function resolveBundleForBooking(input: {
  date: string
  time: string
  items: Array<{
    serviceId: string
    professionalId?: string | null
  }>
  mode?: BundleMode
}) {
  const bundleAvailability = await getBundleAvailability(
    input.items.map((item) => item.serviceId),
    input.date,
    Object.fromEntries(input.items.map((item) => [item.serviceId, item.professionalId])),
    input.mode ? { mode: input.mode } : undefined
  )

  if (!bundleAvailability) {
    throw new Error('Servicos ou disponibilidade nao encontrados para o agendamento online.')
  }

  const assignments = bundleAvailability.slotAssignments[input.time]
  if (!assignments || assignments.length !== input.items.length) {
    throw new Error('Nao foi possivel montar a sequencia de servicos nesse horario.')
  }

  return assignments.map((assignment) => {
    const service = bundleAvailability.services.find((item) => item.id === assignment.serviceId)
    if (!service) {
      throw new Error('Servico nao encontrado para o pacote de agendamento.')
    }

    return {
      service,
      serviceId: assignment.serviceId,
      professionalId: assignment.professionalId,
      professionalName: assignment.professionalName,
      startsAt: assignment.startsAt,
      sequence: assignment.sequence,
      durationMin: assignment.durationMin,
    }
  })
}

export function formatServiceSnapshots(service: ServiceRow) {
  return {
    serviceName: service.name,
    serviceDuration: durationToLabel(service.durationMin),
    servicePrice: priceToLabel(service.priceCents),
  }
}
