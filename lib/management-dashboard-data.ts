import { isDatabaseConfigured, query } from '@/lib/db'

export type DashboardMetric = {
  label: string
  value: string
  detail: string
}

export type DashboardBooking = {
  id: string
  time: string
  dateLabel: string
  client: string
  service: string
  professional: string
  channel: string
  status: string
  amount: number
}

export type DashboardProfessional = {
  id: string
  name: string
  role: string
  specialty: string
  access: string
  occupancy: number
  initials: string
  bookings: number
  revenue: number
  commissionRate: number
  payout: number
  salonShare: number
}

export type DashboardFinance = {
  grossRevenue: number
  confirmedRevenue: number
  pendingRevenue: number
  payrollProjected: number
  salonNetProjected: number
  averageTicket: number
}

export type DashboardBlock = {
  id: string
  professional: string
  period: string
  reason: string
  action: string
}

export type DashboardTransfer = {
  id: string
  client: string
  from: string
  to: string
  slot: string
  reason: string
}

export type DashboardService = {
  id: string
  name: string
  category: string
  durationMin: number
  priceCents: number
  professional: string
  onlineEnabled: boolean
  isFeatured: boolean
}

export type DashboardProduct = {
  id: string
  name: string
  sku: string
  stockQuantity: number
  attachedService: string
}

export type DashboardBusinessHour = {
  weekday: number
  opensAt: string | null
  closesAt: string | null
  isClosed: boolean
}

export type DashboardOrgSettings = {
  id: string
  slug: string
  name: string
  whatsappPhone: string | null
  bookingSlotMinutes: number
  allowProfessionalSelection: boolean
  requireDeposit: boolean
  confirmationChannel: string
  showWhatsappButton: boolean
  autoConfirmWhatsapp: boolean
  smartWaitlist: boolean
  assistedTransfer: boolean
  dailyClosure: boolean
}

export type DashboardLandingSettings = {
  heroTitle: string
  heroSubtitle: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
  themeVariant: string
  showProfessionals: boolean
  showProducts: boolean
  showTestimonials: boolean
  socialProofEnabled: boolean
  showPackages: boolean
}

export type DashboardStaff = {
  id: string
  fullName: string
  email: string
  roleKey: string
  roleName: string
  isActive: boolean
}

export type ManagementOverviewData = {
  selectedDate: string
  metrics: DashboardMetric[]
  bookings: DashboardBooking[]
  professionals: DashboardProfessional[]
  finance: DashboardFinance
}

export type ManagementDashboardData = {
  orgId: string | null
  overview: ManagementOverviewData
  professionals: DashboardProfessional[]
  finance: DashboardFinance
  blocks: DashboardBlock[]
  transfers: DashboardTransfer[]
  services: DashboardService[]
  products: DashboardProduct[]
  businessHours: DashboardBusinessHour[]
  orgSettings: DashboardOrgSettings
  landingSettings: DashboardLandingSettings
  staff: DashboardStaff[]
}

const EMPTY_ORG: DashboardOrgSettings = {
  id: '',
  slug: '',
  name: '',
  whatsappPhone: null,
  bookingSlotMinutes: 30,
  allowProfessionalSelection: true,
  requireDeposit: false,
  confirmationChannel: 'whatsapp',
  showWhatsappButton: true,
  autoConfirmWhatsapp: false,
  smartWaitlist: false,
  assistedTransfer: false,
  dailyClosure: false,
}

const EMPTY_LANDING: DashboardLandingSettings = {
  heroTitle: '',
  heroSubtitle: '',
  primaryCtaLabel: 'Agendar meu horario',
  secondaryCtaLabel: 'Ver servicos',
  themeVariant: 'sofisticado',
  showProfessionals: true,
  showProducts: true,
  showTestimonials: true,
  socialProofEnabled: true,
  showPackages: false,
}

function toCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function priceToNumber(s: string) {
  const n = Number(s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function getStatusLabel(s: string) {
  switch (s) {
    case 'confirmed':
      return 'Confirmado'
    case 'completed':
      return 'Concluído'
    case 'cancelled':
      return 'Cancelado'
    case 'rescheduled':
      return 'Reagendado'
    default:
      return 'Pendente'
  }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function isValidDateInput(date?: string | null): date is string {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date))
}

function emptyFinance(): DashboardFinance {
  return {
    grossRevenue: 0,
    confirmedRevenue: 0,
    pendingRevenue: 0,
    payrollProjected: 0,
    salonNetProjected: 0,
    averageTicket: 0,
  }
}

export async function resolveManagementOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

async function resolveDashboardDate(date?: string | null): Promise<string> {
  const requestedDate = isValidDateInput(date) ? date : null
  const r = await query<{ selected_date: string }>(
    'SELECT COALESCE($1::date, CURRENT_DATE)::text AS selected_date',
    [requestedDate]
  )
  return r.rows[0]?.selected_date ?? new Date().toISOString().slice(0, 10)
}

async function dbBookings(orgId: string, date?: string | null): Promise<DashboardBooking[]> {
  const requestedDate = isValidDateInput(date) ? date : null
  const r = await query<{
    id: string
    booking_date: string
    booking_time: string
    client_name: string
    service_name_snapshot: string
    source: string
    status: string
    service_price_snapshot: string
    professional_name: string | null
  }>(`
    SELECT b.id,
           b.booking_date::text,
           to_char(b.booking_time, 'HH24:MI') AS booking_time,
           c.full_name AS client_name,
           b.service_name_snapshot,
           b.source,
           b.status,
           b.service_price_snapshot,
           p.display_name AS professional_name
    FROM bookings b
    INNER JOIN customers c ON c.id = b.customer_id
    LEFT JOIN professionals p ON p.id = b.professional_id
    WHERE b.organization_id = $1
      AND b.booking_date = COALESCE($2::date, CURRENT_DATE)
    ORDER BY b.booking_date, b.booking_time
    LIMIT 50
  `, [orgId, requestedDate])

  return r.rows.map((row: {
    id: string
    booking_date: string
    booking_time: string
    client_name: string
    service_name_snapshot: string
    source: string
    status: string
    service_price_snapshot: string
    professional_name: string | null
  }) => ({
    id: row.id,
    time: row.booking_time,
    dateLabel: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(`${row.booking_date}T00:00:00`)
    ),
    client: row.client_name,
    service: row.service_name_snapshot,
    professional: row.professional_name ?? '-',
    channel: row.source === 'site' ? 'Site' : row.source,
    status: getStatusLabel(row.status),
    amount: priceToNumber(row.service_price_snapshot),
  }))
}

async function dbProfessionals(orgId: string, date?: string | null): Promise<DashboardProfessional[]> {
  const requestedDate = isValidDateInput(date) ? date : null
  const r = await query<{
    id: string
    display_name: string
    specialty: string | null
    booking_count: string
    revenue_sum: string
    commission_percent: string | null
    access_key: string | null
    booked_minutes: string
    available_minutes: string
  }>(`
    SELECT pr.id,
           pr.display_name,
           pr.specialty,
           COUNT(
             DISTINCT CASE
               WHEN $2::date IS NULL OR b.booking_date = $2::date THEN b.id
               ELSE NULL
             END
           )::text AS booking_count,
           COALESCE(
             SUM(
               CASE
                 WHEN ($2::date IS NULL OR b.booking_date = $2::date) AND b.status <> 'cancelled' THEN
                   CAST(NULLIF(REGEXP_REPLACE(REPLACE(b.service_price_snapshot, ',', '.'), '[^0-9.]', '', 'g'), '') AS numeric)
                 ELSE 0
               END
             ),
             0
           )::text AS revenue_sum,
           COALESCE(
             SUM(
               CASE
                 WHEN b.booking_date = COALESCE($2::date, CURRENT_DATE) AND b.status <> 'cancelled' THEN COALESCE(b.service_duration_snapshot, 0)
                 ELSE 0
               END
             ),
             0
           )::text AS booked_minutes,
           CASE
             WHEN bh.is_closed OR bh.opens_at IS NULL OR bh.closes_at IS NULL THEN '0'
             ELSE ROUND(EXTRACT(EPOCH FROM (bh.closes_at - bh.opens_at)) / 60)::text
           END AS available_minutes,
           ppr.commission_percent::text,
           ar.key AS access_key
    FROM professionals pr
    LEFT JOIN bookings b
      ON b.professional_id = pr.id
     AND b.organization_id = $1
    LEFT JOIN professional_payout_rules ppr
      ON ppr.professional_id = pr.id
     AND ppr.applies_to = 'service'
    LEFT JOIN staff_users su ON su.id = pr.staff_user_id
    LEFT JOIN staff_role_assignments sra ON sra.staff_user_id = su.id
    LEFT JOIN access_roles ar ON ar.id = sra.role_id
    LEFT JOIN business_hours bh
      ON bh.organization_id = pr.organization_id
     AND bh.weekday = EXTRACT(DOW FROM COALESCE($2::date, CURRENT_DATE))::int
    WHERE pr.organization_id = $1
    GROUP BY
      pr.id,
      pr.display_name,
      pr.specialty,
      ppr.commission_percent,
      ar.key,
      bh.is_closed,
      bh.opens_at,
      bh.closes_at
    ORDER BY pr.display_name
  `, [orgId, requestedDate])

  return r.rows.map((row: {
    id: string
    display_name: string
    specialty: string | null
    booking_count: string
    revenue_sum: string
    commission_percent: string | null
    access_key: string | null
    booked_minutes: string
    available_minutes: string
  }) => {
    const commissionRate = row.commission_percent ? parseFloat(row.commission_percent) : 40
    const bookingCount = parseInt(row.booking_count ?? '0', 10)
    const revenue = parseFloat(row.revenue_sum ?? '0')
    const payout = revenue * (commissionRate / 100)
    const bookedMinutes = parseInt(row.booked_minutes ?? '0', 10)
    const availableMinutes = parseInt(row.available_minutes ?? '0', 10)
    const occupancy = availableMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)) : 0
    const accessMap: Record<string, string> = { admin: 'Admin', frontdesk: 'Recepcao', professional: 'Equipe' }

    return {
      id: row.id,
      name: row.display_name,
      role: 'Profissional',
      specialty: row.specialty ?? '',
      access: accessMap[row.access_key ?? ''] ?? 'Equipe',
      occupancy,
      initials: initials(row.display_name),
      bookings: bookingCount,
      revenue,
      commissionRate,
      payout,
      salonShare: revenue - payout,
    }
  })
}

async function dbFinanceSummary(orgId: string): Promise<DashboardFinance> {
  const r = await query<{
    gross_revenue: string
    confirmed_revenue: string
    pending_revenue: string
    booking_count: string
  }>(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status <> 'cancelled' THEN
              CAST(NULLIF(REGEXP_REPLACE(REPLACE(service_price_snapshot, ',', '.'), '[^0-9.]', '', 'g'), '') AS numeric)
            ELSE 0
          END
        ),
        0
      )::text AS gross_revenue,
      COALESCE(
        SUM(
          CASE
            WHEN status IN ('confirmed', 'completed') THEN
              CAST(NULLIF(REGEXP_REPLACE(REPLACE(service_price_snapshot, ',', '.'), '[^0-9.]', '', 'g'), '') AS numeric)
            ELSE 0
          END
        ),
        0
      )::text AS confirmed_revenue,
      COALESCE(
        SUM(
          CASE
            WHEN status = 'pending' THEN
              CAST(NULLIF(REGEXP_REPLACE(REPLACE(service_price_snapshot, ',', '.'), '[^0-9.]', '', 'g'), '') AS numeric)
            ELSE 0
          END
        ),
        0
      )::text AS pending_revenue,
      COUNT(*)::text AS booking_count
    FROM bookings
    WHERE organization_id = $1
  `, [orgId])

  const row = r.rows[0]
  const grossRevenue = parseFloat(row?.gross_revenue ?? '0')
  const confirmedRevenue = parseFloat(row?.confirmed_revenue ?? '0')
  const pendingRevenue = parseFloat(row?.pending_revenue ?? '0')
  const bookingCount = parseInt(row?.booking_count ?? '0', 10)

  return {
    grossRevenue,
    confirmedRevenue,
    pendingRevenue,
    payrollProjected: 0,
    salonNetProjected: grossRevenue,
    averageTicket: bookingCount ? grossRevenue / bookingCount : 0,
  }
}

async function dbServices(orgId: string): Promise<DashboardService[]> {
  const r = await query<{
    id: string
    name: string
    category: string
    duration_min: number
    price_cents: number
    online_booking_enabled: boolean
    is_featured: boolean
    professional_name: string | null
  }>(`
    SELECT s.id, s.name, s.category, s.duration_min, s.price_cents,
           s.online_booking_enabled, s.is_featured,
           p.display_name AS professional_name
    FROM services s
    LEFT JOIN service_professionals sp ON sp.service_id = s.id
    LEFT JOIN professionals p ON p.id = sp.professional_id
    WHERE s.organization_id = $1 AND s.is_active = true
    ORDER BY s.is_featured DESC, s.name
  `, [orgId])

  return r.rows.map((row: {
    id: string
    name: string
    category: string
    duration_min: number
    price_cents: number
    online_booking_enabled: boolean
    is_featured: boolean
    professional_name: string | null
  }) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    durationMin: row.duration_min,
    priceCents: row.price_cents,
    professional: row.professional_name ?? '-',
    onlineEnabled: row.online_booking_enabled,
    isFeatured: row.is_featured,
  }))
}

async function dbProducts(orgId: string): Promise<DashboardProduct[]> {
  const r = await query<{
    id: string
    name: string
    sku: string
    stock_quantity: number
    service_name: string | null
  }>(`
    SELECT p.id, p.name, p.sku, p.stock_quantity,
           s.name AS service_name
    FROM products p
    LEFT JOIN service_product_recommendations spr ON spr.product_id = p.id
    LEFT JOIN services s ON s.id = spr.service_id
    WHERE p.organization_id = $1 AND p.is_active = true
    ORDER BY p.name
  `, [orgId])

  return r.rows.map((row: {
    id: string
    name: string
    sku: string
    stock_quantity: number
    service_name: string | null
  }) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    stockQuantity: row.stock_quantity,
    attachedService: row.service_name ?? '-',
  }))
}

async function dbBusinessHours(orgId: string): Promise<DashboardBusinessHour[]> {
  const r = await query<{
    weekday: number
    opens_at: string | null
    closes_at: string | null
    is_closed: boolean
  }>(`
    SELECT weekday, to_char(opens_at, 'HH24:MI') AS opens_at,
           to_char(closes_at, 'HH24:MI') AS closes_at, is_closed
    FROM business_hours
    WHERE organization_id = $1
    ORDER BY weekday
  `, [orgId])

  return r.rows.map((row: {
    weekday: number
    opens_at: string | null
    closes_at: string | null
    is_closed: boolean
  }) => ({
    weekday: row.weekday,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isClosed: row.is_closed,
  }))
}

async function dbBlocks(orgId: string): Promise<DashboardBlock[]> {
  const r = await query<{
    id: string
    professional_name: string | null
    starts_at: string
    ends_at: string
    reason: string
  }>(`
    SELECT sb.id,
           p.display_name AS professional_name,
           sb.starts_at, sb.ends_at, sb.reason
    FROM schedule_blocks sb
    LEFT JOIN professionals p ON p.id = sb.professional_id
    WHERE sb.organization_id = $1 AND sb.ends_at > NOW()
    ORDER BY sb.starts_at
    LIMIT 10
  `, [orgId])

  return r.rows.map((row: {
    id: string
    professional_name: string | null
    starts_at: string
    ends_at: string
    reason: string
  }) => {
    const start = new Date(row.starts_at)
    const end = new Date(row.ends_at)
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)

    return {
      id: row.id,
      professional: row.professional_name ?? 'Todas',
      period: `${fmt(start)}-${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(end)}`,
      reason: row.reason,
      action: 'Bloquear agenda online',
    }
  })
}

async function dbTransfers(orgId: string): Promise<DashboardTransfer[]> {
  const r = await query<{
    id: string
    client_name: string
    from_name: string | null
    to_name: string | null
    booking_date: string
    booking_time: string
    transfer_reason: string | null
  }>(`
    SELECT bt.id,
           c.full_name AS client_name,
           fp.display_name AS from_name,
           tp.display_name AS to_name,
           b.booking_date::text,
           to_char(b.booking_time, 'HH24:MI') AS booking_time,
           bt.transfer_reason
    FROM booking_transfers bt
    INNER JOIN bookings b ON b.id = bt.booking_id
    INNER JOIN customers c ON c.id = b.customer_id
    LEFT JOIN professionals fp ON fp.id = bt.from_professional_id
    LEFT JOIN professionals tp ON tp.id = bt.to_professional_id
    WHERE bt.organization_id = $1
    ORDER BY bt.transferred_at DESC
    LIMIT 10
  `, [orgId])

  return r.rows.map((row: {
    id: string
    client_name: string
    from_name: string | null
    to_name: string | null
    booking_date: string
    booking_time: string
    transfer_reason: string | null
  }) => ({
    id: row.id,
    client: row.client_name,
    from: row.from_name ?? '-',
    to: row.to_name ?? '-',
    slot: `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${row.booking_date}T00:00:00`))} · ${row.booking_time}`,
    reason: row.transfer_reason ?? '-',
  }))
}

async function dbOrgSettings(orgId: string): Promise<DashboardOrgSettings | null> {
  const r = await query<{
    id: string
    slug: string
    name: string
    whatsapp_phone: string | null
    booking_slot_minutes: number
    allow_professional_selection: boolean
    require_deposit: boolean
  }>(
    'SELECT id, slug, name, whatsapp_phone, booking_slot_minutes, allow_professional_selection, require_deposit FROM organizations WHERE id = $1',
    [orgId]
  )

  const org = r.rows[0]
  if (!org) return null

  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    whatsappPhone: org.whatsapp_phone,
    bookingSlotMinutes: org.booking_slot_minutes,
    allowProfessionalSelection: org.allow_professional_selection,
    requireDeposit: org.require_deposit,
    confirmationChannel: 'whatsapp',
    showWhatsappButton: true,
    autoConfirmWhatsapp: false,
    smartWaitlist: false,
    assistedTransfer: false,
    dailyClosure: false,
  }
}

async function dbLandingSettings(orgId: string): Promise<DashboardLandingSettings | null> {
  const r = await query<{
    hero_title: string | null
    hero_subtitle: string | null
    primary_cta_label: string | null
    secondary_cta_label: string | null
    theme_variant: string
    show_professionals: boolean
    show_products: boolean
    show_testimonials: boolean
    social_proof_enabled: boolean
  }>('SELECT * FROM landing_page_settings WHERE organization_id = $1', [orgId])

  const lp = r.rows[0]
  if (!lp) return null

  return {
    heroTitle: lp.hero_title ?? '',
    heroSubtitle: lp.hero_subtitle ?? '',
    primaryCtaLabel: lp.primary_cta_label ?? 'Agendar meu horario',
    secondaryCtaLabel: lp.secondary_cta_label ?? 'Ver servicos',
    themeVariant: lp.theme_variant,
    showProfessionals: lp.show_professionals,
    showProducts: lp.show_products,
    showTestimonials: lp.show_testimonials,
    socialProofEnabled: lp.social_proof_enabled,
    showPackages: false,
  }
}

async function dbStaff(orgId: string): Promise<DashboardStaff[]> {
  const r = await query<{
    id: string
    full_name: string
    email: string
    role_key: string | null
    role_name: string | null
    is_active: boolean
  }>(`
    SELECT su.id, su.full_name, su.email, su.is_active,
           ar.key AS role_key, ar.name AS role_name
    FROM staff_users su
    LEFT JOIN staff_role_assignments sra ON sra.staff_user_id = su.id
    LEFT JOIN access_roles ar ON ar.id = sra.role_id
    WHERE su.organization_id = $1
    ORDER BY su.full_name
  `, [orgId])

  return r.rows.map((row: {
    id: string
    full_name: string
    email: string
    role_key: string | null
    role_name: string | null
    is_active: boolean
  }) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roleKey: row.role_key ?? 'professional',
    roleName: row.role_name ?? 'Profissional',
    isActive: row.is_active,
  }))
}

function computeFinance(bookings: DashboardBooking[], professionals: DashboardProfessional[]): DashboardFinance {
  const grossRevenue = bookings.filter((b) => b.status !== 'Cancelado').reduce((t, b) => t + b.amount, 0)
  const confirmedRevenue = bookings
    .filter((b) => b.status === 'Confirmado' || b.status === 'Concluído')
    .reduce((t, b) => t + b.amount, 0)
  const pendingRevenue = bookings.filter((b) => b.status === 'Pendente').reduce((t, b) => t + b.amount, 0)
  const payrollProjected = professionals.reduce((t, p) => t + p.payout, 0)

  return {
    grossRevenue,
    confirmedRevenue,
    pendingRevenue,
    payrollProjected,
    salonNetProjected: grossRevenue - payrollProjected,
    averageTicket: bookings.length ? grossRevenue / bookings.length : 0,
  }
}

function computeMetrics(
  bookings: DashboardBooking[],
  finance: DashboardFinance,
  professionals: DashboardProfessional[]
): DashboardMetric[] {
  const confirmedCount = bookings.filter((b) => b.status === 'Confirmado' || b.status === 'Concluído').length
  const avgOccupancy = professionals.length
    ? Math.round(professionals.reduce((t, p) => t + p.occupancy, 0) / professionals.length)
    : 0

  return [
    { label: 'Agendamentos do dia', value: String(bookings.length), detail: `${confirmedCount} confirmados` },
    { label: 'Receita do dia', value: toCurrency(finance.grossRevenue), detail: `${toCurrency(finance.pendingRevenue)} pendente` },
    { label: 'Ticket médio', value: toCurrency(finance.averageTicket), detail: 'Calculado da agenda' },
    { label: 'Ocupação média', value: `${avgOccupancy}%`, detail: 'Carga atual da equipe' },
  ]
}

export async function getManagementOverviewData(date?: string): Promise<ManagementOverviewData> {
  const selectedDate = isDatabaseConfigured()
    ? await resolveDashboardDate(date)
    : (isValidDateInput(date) ? date : new Date().toISOString().slice(0, 10))

  if (!isDatabaseConfigured()) {
    const finance = emptyFinance()
    return {
      selectedDate,
      metrics: computeMetrics([], finance, []),
      bookings: [],
      professionals: [],
      finance,
    }
  }

  try {
    const orgId = await resolveManagementOrgId()
    if (!orgId) {
      const finance = emptyFinance()
      return {
        selectedDate,
        metrics: computeMetrics([], finance, []),
        bookings: [],
        professionals: [],
        finance,
      }
    }

    const [bookings, professionals] = await Promise.all([
      dbBookings(orgId, selectedDate),
      dbProfessionals(orgId, selectedDate),
    ])
    const finance = computeFinance(bookings, professionals)

    return {
      selectedDate,
      metrics: computeMetrics(bookings, finance, professionals),
      bookings,
      professionals,
      finance,
    }
  } catch (error) {
    console.error('[management] Falha ao carregar overview:', error)
    const finance = emptyFinance()
    return {
      selectedDate,
      metrics: computeMetrics([], finance, []),
      bookings: [],
      professionals: [],
      finance,
    }
  }
}

export async function getManagementDashboardData(): Promise<ManagementDashboardData> {
  const overview = await getManagementOverviewData()

  if (!isDatabaseConfigured()) {
    return {
      orgId: null,
      overview,
      professionals: [],
      finance: emptyFinance(),
      blocks: [],
      transfers: [],
      services: [],
      products: [],
      businessHours: [],
      orgSettings: EMPTY_ORG,
      landingSettings: EMPTY_LANDING,
      staff: [],
    }
  }

  let orgId: string | null = null
  let professionals: DashboardProfessional[] = []
  let finance: DashboardFinance = emptyFinance()
  let services: DashboardService[] = []
  let products: DashboardProduct[] = []
  let businessHours: DashboardBusinessHour[] = []
  let blocks: DashboardBlock[] = []
  let transfers: DashboardTransfer[] = []
  let orgSettings: DashboardOrgSettings = EMPTY_ORG
  let landingSettings: DashboardLandingSettings = EMPTY_LANDING
  let staff: DashboardStaff[] = []

  try {
    orgId = await resolveManagementOrgId()

    if (orgId) {
      const [dbP, dbF, dbS, dbPr, dbBh, dbBl, dbTr, dbOrg, dbLp, dbSt] = await Promise.allSettled([
        dbProfessionals(orgId),
        dbFinanceSummary(orgId),
        dbServices(orgId),
        dbProducts(orgId),
        dbBusinessHours(orgId),
        dbBlocks(orgId),
        dbTransfers(orgId),
        dbOrgSettings(orgId),
        dbLandingSettings(orgId),
        dbStaff(orgId),
      ])

      if (dbP.status === 'fulfilled') professionals = dbP.value
      if (dbF.status === 'fulfilled') finance = dbF.value
      if (dbS.status === 'fulfilled') services = dbS.value
      if (dbPr.status === 'fulfilled') products = dbPr.value
      if (dbBh.status === 'fulfilled') businessHours = dbBh.value
      if (dbBl.status === 'fulfilled') blocks = dbBl.value
      if (dbTr.status === 'fulfilled') transfers = dbTr.value
      if (dbOrg.status === 'fulfilled' && dbOrg.value) orgSettings = { ...dbOrg.value, id: orgId }
      if (dbLp.status === 'fulfilled' && dbLp.value) landingSettings = dbLp.value
      if (dbSt.status === 'fulfilled') staff = dbSt.value

      if (professionals.length) {
        const payrollProjected = professionals.reduce((t, p) => t + p.payout, 0)
        finance = {
          ...finance,
          payrollProjected,
          salonNetProjected: finance.grossRevenue - payrollProjected,
        }
      }
    }
  } catch (error) {
    console.error('[management] Falha ao carregar dados:', error)
  }

  return {
    orgId,
    overview,
    professionals,
    finance,
    blocks,
    transfers,
    services,
    products,
    businessHours,
    orgSettings,
    landingSettings,
    staff,
  }
}
