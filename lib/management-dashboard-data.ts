import { isDatabaseConfigured, query } from '@/lib/db'
import {
  getWhatsappInboxConversations,
  type DashboardWhatsappConversationDetail,
  type DashboardWhatsappConversationSummary,
} from '@/lib/management-whatsapp-inbox'
import { getDefaultBusinessHours } from '@/lib/services'
import {
  getAgentBehaviorSettings,
  getWhatsappSettings,
} from '@/lib/whatsapp-service'

export type DashboardMetric = {
  label: string
  value: string
  detail: string
}

export type DashboardBooking = {
  id: string
  bookingGroupId: string | null
  bookingSequence: number
  bookingGroupSize: number
  time: string
  dateLabel: string
  client: string
  service: string
  professional: string
  professionalId: string | null
  channel: string
  status: string
  amount: number
  durationMin: number
  confirmationRequestSentAt: string | null
  customerConfirmationStatus: 'pending' | 'confirmed' | 'declined' | null
  customerConfirmedAt: string | null
}

export type DashboardProfessional = {
  id: string
  name: string
  photoUrl: string
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
  professionalId: string | null
  period: string
  startsAt: string
  endsAt: string
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
  photoUrl: string
  durationMin: number
  priceCents: number
  professional: string
  professionalIds: string[]
  professionals: Array<{
    id: string
    name: string
  }>
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
  whatsappDisplay: string
  bookingSlotMinutes: number
  allowProfessionalSelection: boolean
  requireDeposit: boolean
  confirmationChannel: string
  showWhatsappButton: boolean
  autoConfirmWhatsapp: boolean
  smartWaitlist: boolean
  assistedTransfer: boolean
  dailyClosure: boolean
  instagramHandle: string
  addressText: string
  mapsEmbedUrl: string
}

export type DashboardWhatsappSettings = {
  provider: 'evolution' | 'disabled'
  evolutionBaseUrl: string
  evolutionApiKey: string
  evolutionInstanceName: string
  evolutionInstanceId: string
  evolutionWebhookSecret: string
  evolutionConnected: boolean
  ollamaBaseUrl: string
  ollamaModel: string
  agentEnabled: boolean
  autoReplyEnabled: boolean
  bookingEnabled: boolean
  invisibleHandoffEnabled: boolean
  humanHandoffTarget: string
  testPhone: string
}

export type DashboardAgentBehaviorSettings = {
  assistantName: string
  personaPrompt: string
  welcomeMessage: string
  fallbackMessage: string
  handoffMessage: string
}

export type {
  DashboardWhatsappConversationDetail,
  DashboardWhatsappConversationSummary,
} from '@/lib/management-whatsapp-inbox'

export type DashboardLandingSettings = {
  // existing
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
  // hero extensions
  heroBadgeText: string
  heroTitleHighlight: string
  heroAccentColor: string
  heroImageUrl: string
  heroStat1Value: string
  heroStat1Label: string
  heroStat2Value: string
  heroStat2Label: string
  heroStat3Value: string
  heroStat3Label: string
  // about
  aboutTitle: string
  aboutBody1: string
  aboutBody2: string
  aboutAccentColor: string
  aboutImageUrl: string
  aboutFeature1Title: string
  aboutFeature1Desc: string
  aboutFeature2Title: string
  aboutFeature2Desc: string
  aboutFeature3Title: string
  aboutFeature3Desc: string
  // contact section titles
  contactTitle: string
  contactSubtitle: string
}

export type DashboardTestimonial = {
  id: string
  authorName: string
  body: string
  serviceName: string
  sortOrder: number
}

export type DashboardTeamMember = {
  id: string
  name: string
  role: string
  photoUrl: string
  sortOrder: number
}

export type DashboardStaff = {
  id: string
  fullName: string
  email: string
  roleKey: string
  roleName: string
  isActive: boolean
  professionalId: string | null
  professionalName: string | null
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
  whatsappSettings: DashboardWhatsappSettings
  agentBehaviorSettings: DashboardAgentBehaviorSettings
  whatsappInboxConversations: DashboardWhatsappConversationSummary[]
  landingSettings: DashboardLandingSettings
  staff: DashboardStaff[]
  testimonials: DashboardTestimonial[]
  teamMembers: DashboardTeamMember[]
}

const EMPTY_ORG: DashboardOrgSettings = {
  id: '',
  slug: '',
  name: '',
  whatsappPhone: null,
  whatsappDisplay: '(31) 99072-5053',
  bookingSlotMinutes: 30,
  allowProfessionalSelection: true,
  requireDeposit: false,
  confirmationChannel: 'whatsapp',
  showWhatsappButton: true,
  autoConfirmWhatsapp: false,
  smartWaitlist: false,
  assistedTransfer: false,
  dailyClosure: false,
  instagramHandle: 'scstudioeesmalteria',
  addressText: 'Rua Padre Correia de Almeida, 38 - Santa Efigênia, Belo Horizonte - MG',
  mapsEmbedUrl: '',
}

const EMPTY_LANDING: DashboardLandingSettings = {
  heroTitle: 'Beleza que valoriza você',
  heroSubtitle: 'Muito mais do que uma esmalteria, nasceu um sonho e um propósito. Elevamos sua autoestima com unhas impecáveis e atendimento cuidadoso, focado em detalhes e elegância.',
  primaryCtaLabel: 'Agendar meu horário',
  secondaryCtaLabel: 'Ver serviços',
  themeVariant: 'sofisticado',
  showProfessionals: true,
  showProducts: true,
  showTestimonials: true,
  socialProofEnabled: true,
  showPackages: false,
  heroBadgeText: 'Especialistas em Unhas & Alongamento',
  heroTitleHighlight: 'valoriza',
  heroAccentColor: '',
  heroImageUrl: '',
  heroStat1Value: '5+',
  heroStat1Label: 'Anos de Experiência',
  heroStat2Value: '1000+',
  heroStat2Label: 'Clientes Felizes',
  heroStat3Value: '15+',
  heroStat3Label: 'Serviços Disponíveis',
  aboutTitle: 'Muito mais do que uma esmalteria, nasceu um sonho',
  aboutBody1: 'O SC Studio & Esmalteria nasceu do propósito de valorizar cada mulher que passa por aqui.',
  aboutBody2: 'Localizado no coração de Santa Efigênia, em Belo Horizonte, nosso espaço foi pensado para proporcionar conforto, relaxamento e uma experiência única de beleza.',
  aboutAccentColor: '',
  aboutImageUrl: '',
  aboutFeature1Title: 'Atendimento Acolhedor',
  aboutFeature1Desc: 'Cada cliente é única e merece um atendimento personalizado e carinhoso.',
  aboutFeature2Title: 'Qualidade Premium',
  aboutFeature2Desc: 'Utilizamos apenas produtos de alta qualidade para garantir durabilidade e beleza.',
  aboutFeature3Title: 'Profissionais Especializados',
  aboutFeature3Desc: 'Nossa equipe é constantemente atualizada nas últimas técnicas e tendências.',
  contactTitle: 'Vem nos visitar',
  contactSubtitle: 'Estamos esperando você para cuidar da sua beleza',
}

const EMPTY_WHATSAPP: DashboardWhatsappSettings = {
  provider: 'disabled',
  evolutionBaseUrl: '',
  evolutionApiKey: '',
  evolutionInstanceName: '',
  evolutionInstanceId: '',
  evolutionWebhookSecret: '',
  evolutionConnected: false,
  ollamaBaseUrl: 'http://ollama:11434',
  ollamaModel: 'llama3.1:8b',
  agentEnabled: false,
  autoReplyEnabled: false,
  bookingEnabled: true,
  invisibleHandoffEnabled: true,
  humanHandoffTarget: '',
  testPhone: '',
}

const EMPTY_AGENT_BEHAVIOR: DashboardAgentBehaviorSettings = {
  assistantName: 'Recepcao SC',
  personaPrompt:
    'Voce atende em nome da Recepcao SC. Fale com naturalidade, clareza e simpatia. Ajude a cliente com servicos, horarios, localizacao e agendamentos, sempre seguindo a disponibilidade real da agenda. Nunca use linguagem tecnica e nunca diga que e um bot.',
  welcomeMessage: 'Ola! Recepcao SC por aqui. Como posso te ajudar hoje?',
  fallbackMessage:
    'Consigo te ajudar com servicos, horarios, localizacao e agendamentos. Se preferir, continuo seu atendimento por aqui.',
  handoffMessage: 'Perfeito. Vou seguir com seu atendimento por aqui.',
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
    case 'pending_payment':
      return 'Ag. Pagamento'
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
    booking_group_id: string | null
    booking_sequence: number
    booking_group_size: string
    booking_date: string
    booking_time: string
    client_name: string
    service_name_snapshot: string
    source: string
    status: string
    service_price_snapshot: string
    professional_id: string | null
    professional_name: string | null
    duration_min: number
    confirmation_request_sent_at: string | null
    customer_confirmation_status: 'pending' | 'confirmed' | 'declined' | null
    customer_confirmed_at: string | null
  }>(`
    SELECT b.id,
           b.booking_group_id,
           b.booking_sequence,
           COALESCE(bg.group_size, 1)::text AS booking_group_size,
           b.booking_date::text,
           to_char(b.booking_time, 'HH24:MI') AS booking_time,
           c.full_name AS client_name,
           b.service_name_snapshot,
           b.source,
           b.status,
           b.service_price_snapshot,
           b.professional_id,
           p.display_name AS professional_name,
           COALESCE(s.duration_min, 60) AS duration_min,
           b.confirmation_request_sent_at::text AS confirmation_request_sent_at,
           b.customer_confirmation_status,
           b.customer_confirmed_at::text AS customer_confirmed_at
    FROM bookings b
    INNER JOIN customers c ON c.id = b.customer_id
    LEFT JOIN professionals p ON p.id = b.professional_id
    LEFT JOIN services s ON s.id = b.service_id
    LEFT JOIN (
      SELECT booking_group_id, COUNT(*) AS group_size
      FROM bookings
      WHERE booking_group_id IS NOT NULL
      GROUP BY booking_group_id
    ) bg ON bg.booking_group_id = b.booking_group_id
    WHERE b.organization_id = $1
      AND b.booking_date = COALESCE($2::date, CURRENT_DATE)
    ORDER BY b.booking_date, b.booking_time, b.booking_sequence
    LIMIT 50
  `, [orgId, requestedDate])

  return r.rows.map((row: {
    id: string
    booking_group_id: string | null
    booking_sequence: number
    booking_group_size: string
    booking_date: string
    booking_time: string
    client_name: string
    service_name_snapshot: string
    source: string
    status: string
    service_price_snapshot: string
    professional_id: string | null
    professional_name: string | null
    duration_min: number
    confirmation_request_sent_at: string | null
    customer_confirmation_status: 'pending' | 'confirmed' | 'declined' | null
    customer_confirmed_at: string | null
  }) => ({
    id: row.id,
    bookingGroupId: row.booking_group_id ?? null,
    bookingSequence: row.booking_sequence ?? 1,
    bookingGroupSize: parseInt(row.booking_group_size ?? '1', 10),
    time: row.booking_time,
    dateLabel: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(`${row.booking_date}T00:00:00`)
    ),
    client: row.client_name,
    service: row.service_name_snapshot,
    professional: row.professional_name ?? '-',
    professionalId: row.professional_id ?? null,
    channel: row.source === 'site' ? 'Site' : row.source === 'gestor' ? 'Gestor' : row.source,
    status: getStatusLabel(row.status),
    amount: priceToNumber(row.service_price_snapshot),
    durationMin: row.duration_min,
    confirmationRequestSentAt: row.confirmation_request_sent_at ?? null,
    customerConfirmationStatus: row.customer_confirmation_status ?? null,
    customerConfirmedAt: row.customer_confirmed_at ?? null,
  }))
}

async function dbProfessionals(orgId: string, date?: string | null): Promise<DashboardProfessional[]> {
  const requestedDate = isValidDateInput(date) ? date : null
  const r = await query<{
    id: string
    display_name: string
    photo_url: string | null
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
           pr.photo_url,
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
                  WHEN ($2::date IS NULL OR b.booking_date = $2::date) AND b.status NOT IN ('cancelled', 'rescheduled') THEN
                   CAST(NULLIF(REGEXP_REPLACE(REPLACE(b.service_price_snapshot, ',', '.'), '[^0-9.]', '', 'g'), '') AS numeric)
                 ELSE 0
               END
             ),
             0
           )::text AS revenue_sum,
           COALESCE(
             SUM(
               CASE
                  WHEN b.booking_date = COALESCE($2::date, CURRENT_DATE) AND b.status NOT IN ('cancelled', 'rescheduled')
                   THEN COALESCE(s.duration_min, 60)
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
    LEFT JOIN services s ON s.id = b.service_id
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
      pr.photo_url,
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
    photo_url: string | null
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
      photoUrl: row.photo_url ?? '',
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
            WHEN status NOT IN ('cancelled', 'rescheduled') THEN
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
            WHEN status IN ('pending', 'pending_payment') THEN
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
    photo_url: string | null
    duration_min: number
    price_cents: number
    online_booking_enabled: boolean
    is_featured: boolean
    professional_name: string | null
    professionals: Array<{
      id: string
      name: string
    }>
  }>(`
    SELECT s.id, s.name, s.category, s.photo_url, s.duration_min, s.price_cents,
           s.online_booking_enabled, s.is_featured,
           STRING_AGG(p.display_name, ', ' ORDER BY p.display_name) AS professional_name,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', p.id,
                 'name', p.display_name
               )
               ORDER BY p.display_name
             ) FILTER (WHERE p.id IS NOT NULL),
             '[]'::json
           ) AS professionals
    FROM services s
    LEFT JOIN service_professionals sp ON sp.service_id = s.id
    LEFT JOIN professionals p ON p.id = sp.professional_id
    WHERE s.organization_id = $1 AND s.is_active = true
    GROUP BY s.id, s.name, s.category, s.duration_min, s.price_cents, s.online_booking_enabled, s.is_featured
    ORDER BY s.is_featured DESC, s.name
  `, [orgId])

  return r.rows.map((row: {
    id: string
    name: string
    category: string
    photo_url: string | null
    duration_min: number
    price_cents: number
    online_booking_enabled: boolean
    is_featured: boolean
    professional_name: string | null
    professionals: Array<{
      id: string
      name: string
    }>
  }) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    photoUrl: row.photo_url ?? '',
    durationMin: row.duration_min,
    priceCents: row.price_cents,
    professional: row.professional_name ?? '-',
    professionalIds: (row.professionals ?? []).map((professional) => professional.id),
    professionals: row.professionals ?? [],
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

  if (r.rows.length === 0) {
    return getDefaultBusinessHours().map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
      isClosed: hour.isClosed,
    }))
  }

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
    professional_id: string | null
    professional_name: string | null
    starts_at: string
    ends_at: string
    reason: string
  }>(`
    SELECT sb.id,
           sb.professional_id,
           p.display_name AS professional_name,
           sb.starts_at, sb.ends_at, sb.reason
    FROM schedule_blocks sb
    LEFT JOIN professionals p ON p.id = sb.professional_id
    WHERE sb.organization_id = $1 AND sb.ends_at > NOW()
    ORDER BY sb.starts_at
    LIMIT 20
  `, [orgId])

  return r.rows.map((row: {
    id: string
    professional_id: string | null
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
      professionalId: row.professional_id ?? null,
      period: `${fmt(start)}–${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(end)}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
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
    whatsapp_display: string | null
    booking_slot_minutes: number
    allow_professional_selection: boolean
    require_deposit: boolean
    confirmation_channel: string
    show_whatsapp_button: boolean
    auto_confirm_whatsapp: boolean
    smart_waitlist: boolean
    assisted_transfer: boolean
    daily_closure: boolean
    instagram_handle: string | null
    address_text: string | null
    maps_embed_url: string | null
  }>(
    `SELECT id, slug, name, whatsapp_phone, whatsapp_display,
            booking_slot_minutes, allow_professional_selection, require_deposit,
            confirmation_channel, show_whatsapp_button, auto_confirm_whatsapp,
            smart_waitlist, assisted_transfer, daily_closure,
            instagram_handle, address_text, maps_embed_url
     FROM organizations WHERE id = $1`,
    [orgId]
  )

  const org = r.rows[0]
  if (!org) return null

  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    whatsappPhone: org.whatsapp_phone,
    whatsappDisplay: org.whatsapp_display ?? '(31) 99072-5053',
    bookingSlotMinutes: org.booking_slot_minutes,
    allowProfessionalSelection: org.allow_professional_selection,
    requireDeposit: org.require_deposit,
    confirmationChannel: org.confirmation_channel,
    showWhatsappButton: org.show_whatsapp_button,
    autoConfirmWhatsapp: org.auto_confirm_whatsapp,
    smartWaitlist: org.smart_waitlist,
    assistedTransfer: org.assisted_transfer,
    dailyClosure: org.daily_closure,
    instagramHandle: org.instagram_handle ?? 'scstudioeesmalteria',
    addressText: org.address_text ?? 'Rua Padre Correia de Almeida, 38 - Santa Efigênia, Belo Horizonte - MG',
    mapsEmbedUrl: org.maps_embed_url ?? '',
  }
}

async function dbWhatsappSettings(orgId: string): Promise<DashboardWhatsappSettings> {
  const settings = await getWhatsappSettings(orgId)
  return {
    provider: settings.provider,
    evolutionBaseUrl: settings.evolutionBaseUrl ?? '',
    evolutionApiKey: settings.evolutionApiKey ?? '',
    evolutionInstanceName: settings.evolutionInstanceName ?? '',
    evolutionInstanceId: settings.evolutionInstanceId ?? '',
    evolutionWebhookSecret: settings.evolutionWebhookSecret ?? '',
    evolutionConnected: settings.evolutionConnected,
    ollamaBaseUrl: settings.ollamaBaseUrl ?? 'http://ollama:11434',
    ollamaModel: settings.ollamaModel,
    agentEnabled: settings.agentEnabled,
    autoReplyEnabled: settings.autoReplyEnabled,
    bookingEnabled: settings.bookingEnabled,
    invisibleHandoffEnabled: settings.invisibleHandoffEnabled,
    humanHandoffTarget: settings.humanHandoffTarget ?? '',
    testPhone: settings.testPhone ?? '',
  }
}

async function dbAgentBehaviorSettings(orgId: string): Promise<DashboardAgentBehaviorSettings> {
  const settings = await getAgentBehaviorSettings(orgId)
  return {
    assistantName: settings.assistantName,
    personaPrompt: settings.personaPrompt,
    welcomeMessage: settings.welcomeMessage,
    fallbackMessage: settings.fallbackMessage,
    handoffMessage: settings.handoffMessage,
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
    show_packages: boolean
    hero_badge_text: string | null
    hero_title_highlight: string | null
    hero_accent_color: string | null
    hero_image_url: string | null
    hero_stat_1_value: string | null
    hero_stat_1_label: string | null
    hero_stat_2_value: string | null
    hero_stat_2_label: string | null
    hero_stat_3_value: string | null
    hero_stat_3_label: string | null
    about_title: string | null
    about_body_1: string | null
    about_body_2: string | null
    about_accent_color: string | null
    about_feature_1_title: string | null
    about_feature_1_desc: string | null
    about_feature_2_title: string | null
    about_feature_2_desc: string | null
    about_feature_3_title: string | null
    about_feature_3_desc: string | null
    contact_title: string | null
    contact_subtitle: string | null
  }>('SELECT * FROM landing_page_settings WHERE organization_id = $1', [orgId])

  const lp = r.rows[0]
  if (!lp) return null

  return {
    heroTitle: lp.hero_title ?? 'Beleza que valoriza você',
    heroSubtitle: lp.hero_subtitle ?? 'Muito mais do que uma esmalteria, nasceu um sonho e um propósito. Elevamos sua autoestima com unhas impecáveis e atendimento cuidadoso, focado em detalhes e elegância.',
    primaryCtaLabel: lp.primary_cta_label ?? 'Agendar meu horário',
    secondaryCtaLabel: lp.secondary_cta_label ?? 'Ver serviços',
    themeVariant: lp.theme_variant,
    showProfessionals: lp.show_professionals,
    showProducts: lp.show_products,
    showTestimonials: lp.show_testimonials,
    socialProofEnabled: lp.social_proof_enabled,
    showPackages: lp.show_packages,
    heroBadgeText: lp.hero_badge_text ?? 'Especialistas em Unhas & Alongamento',
    heroTitleHighlight: lp.hero_title_highlight ?? 'valoriza',
    heroAccentColor: lp.hero_accent_color ?? '',
    heroImageUrl: lp.hero_image_url ?? '',
    heroStat1Value: lp.hero_stat_1_value ?? '5+',
    heroStat1Label: lp.hero_stat_1_label ?? 'Anos de Experiência',
    heroStat2Value: lp.hero_stat_2_value ?? '1000+',
    heroStat2Label: lp.hero_stat_2_label ?? 'Clientes Felizes',
    heroStat3Value: lp.hero_stat_3_value ?? '15+',
    heroStat3Label: lp.hero_stat_3_label ?? 'Serviços Disponíveis',
    aboutTitle: lp.about_title ?? 'Muito mais do que uma esmalteria, nasceu um sonho',
    aboutBody1: lp.about_body_1 ?? '',
    aboutBody2: lp.about_body_2 ?? '',
    aboutAccentColor: lp.about_accent_color ?? '',
    aboutImageUrl: lp.about_image_url ?? '',
    aboutFeature1Title: lp.about_feature_1_title ?? 'Atendimento Acolhedor',
    aboutFeature1Desc: lp.about_feature_1_desc ?? '',
    aboutFeature2Title: lp.about_feature_2_title ?? 'Qualidade Premium',
    aboutFeature2Desc: lp.about_feature_2_desc ?? '',
    aboutFeature3Title: lp.about_feature_3_title ?? 'Profissionais Especializados',
    aboutFeature3Desc: lp.about_feature_3_desc ?? '',
    contactTitle: lp.contact_title ?? 'Vem nos visitar',
    contactSubtitle: lp.contact_subtitle ?? 'Estamos esperando você para cuidar da sua beleza',
  }
}

async function dbTestimonials(orgId: string): Promise<DashboardTestimonial[]> {
  const r = await query<{
    id: string
    author_name: string
    body: string
    service_name: string | null
    sort_order: number
  }>(
    `SELECT id, author_name, body, service_name, sort_order
     FROM testimonials WHERE organization_id = $1 AND is_active = true
     ORDER BY sort_order ASC, created_at ASC`,
    [orgId]
  )
  return r.rows.map((row: { id: string; author_name: string; body: string; service_name: string | null; sort_order: number }) => ({
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    serviceName: row.service_name ?? '',
    sortOrder: row.sort_order,
  }))
}

async function dbTeamMembers(orgId: string): Promise<DashboardTeamMember[]> {
  const r = await query<{
    id: string
    display_name: string
    role: string
    photo_url: string | null
    sort_order: number
  }>(
    `SELECT id, display_name, role, photo_url, sort_order
     FROM team_members
     WHERE organization_id = $1 AND is_active = true
     ORDER BY sort_order ASC, created_at ASC`,
    [orgId]
  )
  return r.rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    role: row.role,
    photoUrl: row.photo_url ?? '',
    sortOrder: row.sort_order,
  }))
}

async function dbStaff(orgId: string): Promise<DashboardStaff[]> {
  const r = await query<{
    id: string
    full_name: string
    email: string
    role_key: string | null
    role_name: string | null
    is_active: boolean
    professional_id: string | null
    professional_name: string | null
  }>(`
    SELECT su.id, su.full_name, su.email, su.is_active,
           ar.key AS role_key, ar.name AS role_name,
           p.id AS professional_id, p.display_name AS professional_name
    FROM staff_users su
    LEFT JOIN staff_role_assignments sra ON sra.staff_user_id = su.id
    LEFT JOIN access_roles ar ON ar.id = sra.role_id
    LEFT JOIN professionals p ON p.staff_user_id = su.id
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
    professional_id: string | null
    professional_name: string | null
  }) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roleKey: row.role_key ?? '',
    roleName: row.role_name ?? '',
    isActive: row.is_active,
    professionalId: row.professional_id ?? null,
    professionalName: row.professional_name ?? null,
  }))
}

function computeFinance(bookings: DashboardBooking[], professionals: DashboardProfessional[]): DashboardFinance {
  const grossRevenue = bookings.filter((b) => b.status !== 'Cancelado' && b.status !== 'Reagendado').reduce((t, b) => t + b.amount, 0)
  const confirmedRevenue = bookings
    .filter((b) => b.status === 'Confirmado' || b.status === 'Concluído')
    .reduce((t, b) => t + b.amount, 0)
  const pendingRevenue = bookings
    .filter((b) => b.status === 'Pendente' || b.status === 'Ag. Pagamento')
    .reduce((t, b) => t + b.amount, 0)
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

function toAgendaReadOnlyOverview(overview: ManagementOverviewData): ManagementOverviewData {
  return {
    selectedDate: overview.selectedDate,
    metrics: [],
    bookings: overview.bookings,
    professionals: overview.professionals,
    finance: emptyFinance(),
  }
}

export async function getManagementOverviewData(date?: string): Promise<ManagementOverviewData> {
  const fallbackDate = isValidDateInput(date) ? date : new Date().toISOString().slice(0, 10)

  if (!isDatabaseConfigured()) {
    const finance = emptyFinance()
    return {
      selectedDate: fallbackDate,
      metrics: computeMetrics([], finance, []),
      bookings: [],
      professionals: [],
      finance,
    }
  }

  try {
    const selectedDate = await resolveDashboardDate(date).catch(() => fallbackDate)
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
      selectedDate: fallbackDate,
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
      whatsappSettings: EMPTY_WHATSAPP,
      agentBehaviorSettings: EMPTY_AGENT_BEHAVIOR,
      whatsappInboxConversations: [],
      landingSettings: EMPTY_LANDING,
      testimonials: [],
      teamMembers: [],
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
  let whatsappSettings: DashboardWhatsappSettings = EMPTY_WHATSAPP
  let agentBehaviorSettings: DashboardAgentBehaviorSettings = EMPTY_AGENT_BEHAVIOR
  let whatsappInboxConversations: DashboardWhatsappConversationSummary[] = []
  let landingSettings: DashboardLandingSettings = EMPTY_LANDING
  let staff: DashboardStaff[] = []
  let testimonials: DashboardTestimonial[] = []
  let teamMembers: DashboardTeamMember[] = []

  try {
    orgId = await resolveManagementOrgId()

    if (orgId) {
      const [dbP, dbF, dbS, dbPr, dbBh, dbBl, dbTr, dbOrg, dbWa, dbAgent, dbInbox, dbLp, dbSt, dbTes, dbTm] = await Promise.allSettled([
        dbProfessionals(orgId),
        dbFinanceSummary(orgId),
        dbServices(orgId),
        dbProducts(orgId),
        dbBusinessHours(orgId),
        dbBlocks(orgId),
        dbTransfers(orgId),
        dbOrgSettings(orgId),
        dbWhatsappSettings(orgId),
        dbAgentBehaviorSettings(orgId),
        getWhatsappInboxConversations(orgId),
        dbLandingSettings(orgId),
        dbStaff(orgId),
        dbTestimonials(orgId),
        dbTeamMembers(orgId),
      ])

      if (dbP.status === 'fulfilled') professionals = dbP.value
      if (dbF.status === 'fulfilled') finance = dbF.value
      if (dbS.status === 'fulfilled') services = dbS.value
      if (dbPr.status === 'fulfilled') products = dbPr.value
      if (dbBh.status === 'fulfilled') businessHours = dbBh.value
      if (dbBl.status === 'fulfilled') blocks = dbBl.value
      if (dbTr.status === 'fulfilled') transfers = dbTr.value
      if (dbOrg.status === 'fulfilled' && dbOrg.value) orgSettings = { ...dbOrg.value, id: orgId }
      if (dbWa.status === 'fulfilled') whatsappSettings = dbWa.value
      if (dbAgent.status === 'fulfilled') agentBehaviorSettings = dbAgent.value
      if (dbInbox.status === 'fulfilled') whatsappInboxConversations = dbInbox.value
      if (dbLp.status === 'fulfilled' && dbLp.value) landingSettings = dbLp.value
      if (dbSt.status === 'fulfilled') staff = dbSt.value
      if (dbTes.status === 'fulfilled') testimonials = dbTes.value
      if (dbTm.status === 'fulfilled') teamMembers = dbTm.value

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
    whatsappSettings,
    agentBehaviorSettings,
    whatsappInboxConversations,
    landingSettings,
    staff,
    testimonials,
    teamMembers,
  }
}

export async function getManagementAgendaOnlyData(date?: string): Promise<ManagementDashboardData> {
  const overview = toAgendaReadOnlyOverview(await getManagementOverviewData(date))

  if (!isDatabaseConfigured()) {
    return {
      orgId: null,
      overview,
      professionals: overview.professionals,
      finance: emptyFinance(),
      blocks: [],
      transfers: [],
      services: [],
      products: [],
      businessHours: [],
      orgSettings: EMPTY_ORG,
      whatsappSettings: EMPTY_WHATSAPP,
      agentBehaviorSettings: EMPTY_AGENT_BEHAVIOR,
      whatsappInboxConversations: [],
      landingSettings: EMPTY_LANDING,
      testimonials: [],
      teamMembers: [],
      staff: [],
    }
  }

  let orgId: string | null = null
  let blocks: DashboardBlock[] = []

  try {
    orgId = await resolveManagementOrgId()
    if (orgId) {
      blocks = await dbBlocks(orgId)
    }
  } catch (error) {
    console.error('[management] Falha ao carregar agenda somente leitura:', error)
  }

  return {
    orgId,
    overview,
    professionals: overview.professionals,
    finance: emptyFinance(),
    blocks,
    transfers: [],
    services: [],
    products: [],
    businessHours: [],
    orgSettings: EMPTY_ORG,
    whatsappSettings: EMPTY_WHATSAPP,
    agentBehaviorSettings: EMPTY_AGENT_BEHAVIOR,
    whatsappInboxConversations: [],
    landingSettings: EMPTY_LANDING,
    testimonials: [],
    teamMembers: [],
    staff: [],
  }
}
