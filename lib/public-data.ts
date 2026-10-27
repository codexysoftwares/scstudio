import 'server-only'
import { isDatabaseConfigured, query } from '@/lib/db'
import type { Service, PublicBusinessHour } from '@/lib/services'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return r.rows[0]?.id ?? null
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type PublicTestimonial = {
  id: string
  authorName: string
  body: string
  serviceName: string
}

export type PublicSiteContent = {
  themeVariant: string
  customPrimary: string
  customAccent: string
  hero: {
    title: string
    subtitle: string
    badgeText: string
    titleHighlight: string
    accentColor: string
    imageUrl: string
    primaryCtaLabel: string
    secondaryCtaLabel: string
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
  }
  about: {
    title: string
    body1: string
    body2: string
    accentColor: string
    imageUrl: string
    feature1Title: string
    feature1Desc: string
    feature2Title: string
    feature2Desc: string
    feature3Title: string
    feature3Desc: string
  }
  contact: {
    title: string
    subtitle: string
    phone: string
    whatsappDisplay: string
    instagramHandle: string
    addressText: string
    mapsEmbedUrl: string
  }
  testimonials: PublicTestimonial[]
  requireDeposit: boolean
}

// ─── Public queries ───────────────────────────────────────────────────────────

export async function getPublicServices(): Promise<Service[]> {
  if (!isDatabaseConfigured()) return []

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return []

    const r = await query<{
      id: string
      name: string
      category: string
      photo_url: string | null
      duration_min: number
      price_cents: number
      description: string | null
      professionals: Array<{
        id: string
        name: string
        specialty: string
        isFeatured: boolean
      }>
    }>(
      `SELECT s.id,
              s.name,
              s.category,
              s.photo_url,
              s.duration_min,
              s.price_cents,
              s.description,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', p.id,
                    'name', p.display_name,
                    'specialty', COALESCE(p.specialty, ''),
                    'isFeatured', p.is_featured
                  )
                  ORDER BY p.is_featured DESC, p.display_name ASC
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'::json
              ) AS professionals
       FROM services s
       LEFT JOIN service_professionals sp ON sp.service_id = s.id
       LEFT JOIN professionals p
         ON p.id = sp.professional_id
        AND p.accepts_online_booking = TRUE
       WHERE s.organization_id = $1 AND s.is_active = true AND s.online_booking_enabled = true
       GROUP BY s.id, s.name, s.category, s.duration_min, s.price_cents, s.description, s.is_featured
       ORDER BY s.is_featured DESC, s.name`,
      [orgId]
    )

    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      duration: formatDuration(row.duration_min),
      durationMin: row.duration_min,
      price: formatPrice(row.price_cents),
      priceCents: row.price_cents,
      category: row.category as Service['category'],
      photo: row.photo_url || (row.category === 'cilios' ? 'VWvTbDUwbUM' : 'gb6gtiTZKB8'),
      description: row.description || row.name,
      professionals: row.professionals ?? [],
    }))
  } catch (err) {
    console.error('[public-data] getPublicServices failed:', err)
    return []
  }
}

export async function getPublicSiteContent(): Promise<PublicSiteContent | null> {
  if (!isDatabaseConfigured()) return null

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return null

    const [lpRes, orgRes, testRes] = await Promise.all([
      query<Record<string, string | null | boolean>>(
        'SELECT * FROM landing_page_settings WHERE organization_id = $1',
        [orgId]
      ),
      query<Record<string, string | null | boolean>>(
        'SELECT whatsapp_phone, whatsapp_display, instagram_handle, address_text, maps_embed_url, require_deposit FROM organizations WHERE id = $1',
        [orgId]
      ),
      query<{ id: string; author_name: string; body: string; service_name: string | null }>(
        'SELECT id, author_name, body, service_name FROM testimonials WHERE organization_id = $1 AND is_active = true ORDER BY sort_order ASC, created_at ASC',
        [orgId]
      ),
    ])

    const lp = lpRes.rows[0]
    const org = orgRes.rows[0]

    return {
      themeVariant: (lp?.theme_variant as string) || 'sofisticado',
      customPrimary: (lp?.hero_accent_color as string) || '',
      customAccent: (lp?.about_accent_color as string) || '',
      hero: {
        title: (lp?.hero_title as string) || '',
        subtitle: (lp?.hero_subtitle as string) || '',
        badgeText: (lp?.hero_badge_text as string) || 'Especialistas em Unhas & Alongamento',
        titleHighlight: (lp?.hero_title_highlight as string) || 'valoriza',
        accentColor: (lp?.hero_accent_color as string) || '',
        imageUrl: (lp?.hero_image_url as string) || '',
        primaryCtaLabel: (lp?.primary_cta_label as string) || 'Agendar Horário',
        secondaryCtaLabel: (lp?.secondary_cta_label as string) || 'Ver Serviços',
        stat1Value: (lp?.hero_stat_1_value as string) || '5+',
        stat1Label: (lp?.hero_stat_1_label as string) || 'Anos de Experiência',
        stat2Value: (lp?.hero_stat_2_value as string) || '1000+',
        stat2Label: (lp?.hero_stat_2_label as string) || 'Clientes Felizes',
        stat3Value: (lp?.hero_stat_3_value as string) || '15+',
        stat3Label: (lp?.hero_stat_3_label as string) || 'Serviços Disponíveis',
      },
      about: {
        title: (lp?.about_title as string) || 'Muito mais do que uma esmalteria, nasceu um sonho',
        body1: (lp?.about_body_1 as string) || '',
        body2: (lp?.about_body_2 as string) || '',
        accentColor: (lp?.about_accent_color as string) || '',
        imageUrl: (lp?.about_image_url as string) || '',
        feature1Title: (lp?.about_feature_1_title as string) || 'Atendimento Acolhedor',
        feature1Desc: (lp?.about_feature_1_desc as string) || 'Cada cliente é única e merece um atendimento personalizado e carinhoso.',
        feature2Title: (lp?.about_feature_2_title as string) || 'Qualidade Premium',
        feature2Desc: (lp?.about_feature_2_desc as string) || 'Utilizamos apenas produtos de alta qualidade para garantir durabilidade e beleza.',
        feature3Title: (lp?.about_feature_3_title as string) || 'Profissionais Especializados',
        feature3Desc: (lp?.about_feature_3_desc as string) || 'Nossa equipe é constantemente atualizada nas últimas técnicas e tendências.',
      },
      contact: {
        title: (lp?.contact_title as string) || 'Vem nos visitar',
        subtitle: (lp?.contact_subtitle as string) || 'Estamos esperando você para cuidar da sua beleza',
        phone: org?.whatsapp_phone || '5531990725053',
        whatsappDisplay: org?.whatsapp_display || '(31) 99072-5053',
        instagramHandle: org?.instagram_handle || 'scstudioeesmalteria',
        addressText: org?.address_text || 'Rua Padre Correia de Almeida, 38 - Santa Efigênia, Belo Horizonte - MG',
        mapsEmbedUrl: org?.maps_embed_url || '',
      },
      testimonials: testRes.rows.map((row: { id: string; author_name: string; body: string; service_name: string | null }) => ({
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        serviceName: row.service_name ?? '',
      })),
      requireDeposit: Boolean(org?.require_deposit),
    }
  } catch (err) {
    console.error('[public-data] getPublicSiteContent failed:', err)
    return null
  }
}

// Keep backward-compat export used by Hero
export type PublicLandingSettings = {
  heroTitle: string
  heroSubtitle: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
}

export async function getPublicLandingSettings(): Promise<PublicLandingSettings | null> {
  const content = await getPublicSiteContent()
  if (!content) return null
  return {
    heroTitle: content.hero.title,
    heroSubtitle: content.hero.subtitle,
    primaryCtaLabel: content.hero.primaryCtaLabel,
    secondaryCtaLabel: content.hero.secondaryCtaLabel,
  }
}

export type PublicTeamMember = {
  id: string
  name: string
  role: string
  photoUrl: string
}

export async function getPublicTeamMembers(): Promise<PublicTeamMember[]> {
  if (!isDatabaseConfigured()) return []

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return []

    const r = await query<{
      id: string
      display_name: string
      specialty: string | null
      photo_url: string | null
    }>(
      `SELECT id, display_name, specialty, photo_url
       FROM professionals
       WHERE organization_id = $1
       ORDER BY is_featured DESC, display_name ASC`,
      [orgId]
    )

    return r.rows.map((row) => ({
      id: row.id,
      name: row.display_name,
      role: row.specialty ?? '',
      photoUrl: row.photo_url ?? '',
    }))
  } catch (err) {
    console.error('[public-data] getPublicTeamMembers failed:', err)
    return []
  }
}

export async function getPublicBusinessHours(): Promise<PublicBusinessHour[]> {
  if (!isDatabaseConfigured()) return []

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return []

    const r = await query<{
      weekday: number
      opens_at: string | null
      closes_at: string | null
      is_closed: boolean
    }>(
      `SELECT weekday,
              to_char(opens_at, 'HH24:MI') AS opens_at,
              to_char(closes_at, 'HH24:MI') AS closes_at,
              is_closed
       FROM business_hours
       WHERE organization_id = $1
       ORDER BY weekday`,
      [orgId]
    )

    return r.rows.map((row) => ({
      weekday: row.weekday,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
    }))
  } catch (err) {
    console.error('[public-data] getPublicBusinessHours failed:', err)
    return []
  }
}

// ─── Single professional (for personal booking pages) ─────────────────────────

export type PublicProfessional = {
  id: string
  name: string
  role: string
  photoUrl: string
  acceptsOnlineBooking: boolean
}

export async function getPublicProfessionalById(id: string): Promise<PublicProfessional | null> {
  if (!isDatabaseConfigured()) return null

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return null

    const r = await query<{
      id: string
      display_name: string
      specialty: string | null
      photo_url: string | null
      accepts_online_booking: boolean
    }>(
      `SELECT id, display_name, specialty, photo_url, accepts_online_booking
       FROM professionals
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [id, orgId]
    )

    const row = r.rows[0]
    if (!row) return null

    return {
      id: row.id,
      name: row.display_name,
      role: row.specialty ?? '',
      photoUrl: row.photo_url ?? '',
      acceptsOnlineBooking: row.accepts_online_booking,
    }
  } catch (err) {
    console.error('[public-data] getPublicProfessionalById failed:', err)
    return null
  }
}
