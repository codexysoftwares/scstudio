import { NextResponse } from 'next/server'
import { isDatabaseConfigured, query, withTransaction } from '@/lib/db'
import { ensureManagementAdminReadAccess, ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }
  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError
  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

    const [orgRes, lpRes] = await Promise.all([
      query('SELECT * FROM organizations WHERE id = $1', [orgId]),
      query('SELECT * FROM landing_page_settings WHERE organization_id = $1', [orgId]),
    ])

    return NextResponse.json({ org: orgRes.rows[0] ?? null, lp: lpRes.rows[0] ?? null })
  } catch (err) {
    console.error('[settings GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB não configurado' }, { status: 503 })
  }
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError
  try {
    const body = await req.json()
    const { org, lp } = body as {
      org?: {
        name?: string
        whatsappPhone?: string | null
        whatsappDisplay?: string
        bookingSlotMinutes?: number
        allowProfessionalSelection?: boolean
        requireDeposit?: boolean
        reminderHoursBefore?: number
        pixKey?: string | null
        confirmationChannel?: string
        showWhatsappButton?: boolean
        autoConfirmWhatsapp?: boolean
        smartWaitlist?: boolean
        assistedTransfer?: boolean
        dailyClosure?: boolean
        instagramHandle?: string
        addressText?: string
        mapsEmbedUrl?: string
      }
      lp?: {
        heroTitle?: string
        heroSubtitle?: string
        primaryCtaLabel?: string
        secondaryCtaLabel?: string
        themeVariant?: string
        showProfessionals?: boolean
        showProducts?: boolean
        showTestimonials?: boolean
        socialProofEnabled?: boolean
        showPackages?: boolean
        heroBadgeText?: string
        heroTitleHighlight?: string
        heroAccentColor?: string
        heroImageUrl?: string
        heroStat1Value?: string
        heroStat1Label?: string
        heroStat2Value?: string
        heroStat2Label?: string
        heroStat3Value?: string
        heroStat3Label?: string
        aboutTitle?: string
        aboutBody1?: string
        aboutBody2?: string
        aboutAccentColor?: string
        aboutImageUrl?: string
        aboutFeature1Title?: string
        aboutFeature1Desc?: string
        aboutFeature2Title?: string
        aboutFeature2Desc?: string
        aboutFeature3Title?: string
        aboutFeature3Desc?: string
        contactTitle?: string
        contactSubtitle?: string
      }
    }

    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

    await withTransaction(async (client) => {
      if (org && Object.keys(org).length > 0) {
        const updates: string[] = []
        const values: unknown[] = []
        let idx = 1

        if (org.name !== undefined) { updates.push(`name = $${idx++}`); values.push(org.name) }
        if (org.whatsappPhone !== undefined) { updates.push(`whatsapp_phone = $${idx++}`); values.push(org.whatsappPhone) }
        if (org.bookingSlotMinutes !== undefined) { updates.push(`booking_slot_minutes = $${idx++}`); values.push(org.bookingSlotMinutes) }
        if (org.allowProfessionalSelection !== undefined) { updates.push(`allow_professional_selection = $${idx++}`); values.push(org.allowProfessionalSelection) }
        if (org.requireDeposit !== undefined) { updates.push(`require_deposit = $${idx++}`); values.push(org.requireDeposit) }
        if (org.reminderHoursBefore !== undefined) { updates.push(`reminder_hours_before = $${idx++}`); values.push(org.reminderHoursBefore) }
        if (org.pixKey !== undefined) { updates.push(`pix_key = $${idx++}`); values.push(org.pixKey) }
        if (org.confirmationChannel !== undefined) { updates.push(`confirmation_channel = $${idx++}`); values.push(org.confirmationChannel) }
        if (org.showWhatsappButton !== undefined) { updates.push(`show_whatsapp_button = $${idx++}`); values.push(org.showWhatsappButton) }
        if (org.autoConfirmWhatsapp !== undefined) { updates.push(`auto_confirm_whatsapp = $${idx++}`); values.push(org.autoConfirmWhatsapp) }
        if (org.smartWaitlist !== undefined) { updates.push(`smart_waitlist = $${idx++}`); values.push(org.smartWaitlist) }
        if (org.assistedTransfer !== undefined) { updates.push(`assisted_transfer = $${idx++}`); values.push(org.assistedTransfer) }
        if (org.dailyClosure !== undefined) { updates.push(`daily_closure = $${idx++}`); values.push(org.dailyClosure) }
        if (org.whatsappDisplay !== undefined) { updates.push(`whatsapp_display = $${idx++}`); values.push(org.whatsappDisplay) }
        if (org.instagramHandle !== undefined) { updates.push(`instagram_handle = $${idx++}`); values.push(org.instagramHandle) }
        if (org.addressText !== undefined) { updates.push(`address_text = $${idx++}`); values.push(org.addressText) }
        if (org.mapsEmbedUrl !== undefined) { updates.push(`maps_embed_url = $${idx++}`); values.push(org.mapsEmbedUrl) }

        if (updates.length > 0) {
          values.push(orgId)
          await client.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`, values)
        }
      }

      if (lp && Object.keys(lp).length > 0) {
        const existing = await client.query('SELECT 1 FROM landing_page_settings WHERE organization_id = $1', [orgId])
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO landing_page_settings (organization_id, hero_title, hero_subtitle,
              primary_cta_label, secondary_cta_label, theme_variant,
              show_professionals, show_products, show_testimonials, social_proof_enabled, show_packages)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              orgId,
              lp.heroTitle ?? null,
              lp.heroSubtitle ?? null,
              lp.primaryCtaLabel ?? null,
              lp.secondaryCtaLabel ?? null,
              lp.themeVariant ?? 'sofisticado',
              lp.showProfessionals ?? true,
              lp.showProducts ?? true,
              lp.showTestimonials ?? false,
              lp.socialProofEnabled ?? true,
              lp.showPackages ?? false,
            ]
          )
        } else {
          const updates: string[] = []
          const values: unknown[] = []
          let idx = 1

          if (lp.heroTitle !== undefined) { updates.push(`hero_title = $${idx++}`); values.push(lp.heroTitle) }
          if (lp.heroSubtitle !== undefined) { updates.push(`hero_subtitle = $${idx++}`); values.push(lp.heroSubtitle) }
          if (lp.primaryCtaLabel !== undefined) { updates.push(`primary_cta_label = $${idx++}`); values.push(lp.primaryCtaLabel) }
          if (lp.secondaryCtaLabel !== undefined) { updates.push(`secondary_cta_label = $${idx++}`); values.push(lp.secondaryCtaLabel) }
          if (lp.themeVariant !== undefined) { updates.push(`theme_variant = $${idx++}`); values.push(lp.themeVariant) }
          if (lp.showProfessionals !== undefined) { updates.push(`show_professionals = $${idx++}`); values.push(lp.showProfessionals) }
          if (lp.showProducts !== undefined) { updates.push(`show_products = $${idx++}`); values.push(lp.showProducts) }
          if (lp.showTestimonials !== undefined) { updates.push(`show_testimonials = $${idx++}`); values.push(lp.showTestimonials) }
          if (lp.socialProofEnabled !== undefined) { updates.push(`social_proof_enabled = $${idx++}`); values.push(lp.socialProofEnabled) }
          if (lp.showPackages !== undefined) { updates.push(`show_packages = $${idx++}`); values.push(lp.showPackages) }
          if (lp.heroBadgeText !== undefined) { updates.push(`hero_badge_text = $${idx++}`); values.push(lp.heroBadgeText) }
          if (lp.heroTitleHighlight !== undefined) { updates.push(`hero_title_highlight = $${idx++}`); values.push(lp.heroTitleHighlight) }
          if (lp.heroAccentColor !== undefined) { updates.push(`hero_accent_color = $${idx++}`); values.push(lp.heroAccentColor) }
          if (lp.heroImageUrl !== undefined) { updates.push(`hero_image_url = $${idx++}`); values.push(lp.heroImageUrl) }
          if (lp.heroStat1Value !== undefined) { updates.push(`hero_stat_1_value = $${idx++}`); values.push(lp.heroStat1Value) }
          if (lp.heroStat1Label !== undefined) { updates.push(`hero_stat_1_label = $${idx++}`); values.push(lp.heroStat1Label) }
          if (lp.heroStat2Value !== undefined) { updates.push(`hero_stat_2_value = $${idx++}`); values.push(lp.heroStat2Value) }
          if (lp.heroStat2Label !== undefined) { updates.push(`hero_stat_2_label = $${idx++}`); values.push(lp.heroStat2Label) }
          if (lp.heroStat3Value !== undefined) { updates.push(`hero_stat_3_value = $${idx++}`); values.push(lp.heroStat3Value) }
          if (lp.heroStat3Label !== undefined) { updates.push(`hero_stat_3_label = $${idx++}`); values.push(lp.heroStat3Label) }
          if (lp.aboutTitle !== undefined) { updates.push(`about_title = $${idx++}`); values.push(lp.aboutTitle) }
          if (lp.aboutBody1 !== undefined) { updates.push(`about_body_1 = $${idx++}`); values.push(lp.aboutBody1) }
          if (lp.aboutBody2 !== undefined) { updates.push(`about_body_2 = $${idx++}`); values.push(lp.aboutBody2) }
          if (lp.aboutAccentColor !== undefined) { updates.push(`about_accent_color = $${idx++}`); values.push(lp.aboutAccentColor) }
          if (lp.aboutImageUrl !== undefined) { updates.push(`about_image_url = $${idx++}`); values.push(lp.aboutImageUrl) }
          if (lp.aboutFeature1Title !== undefined) { updates.push(`about_feature_1_title = $${idx++}`); values.push(lp.aboutFeature1Title) }
          if (lp.aboutFeature1Desc !== undefined) { updates.push(`about_feature_1_desc = $${idx++}`); values.push(lp.aboutFeature1Desc) }
          if (lp.aboutFeature2Title !== undefined) { updates.push(`about_feature_2_title = $${idx++}`); values.push(lp.aboutFeature2Title) }
          if (lp.aboutFeature2Desc !== undefined) { updates.push(`about_feature_2_desc = $${idx++}`); values.push(lp.aboutFeature2Desc) }
          if (lp.aboutFeature3Title !== undefined) { updates.push(`about_feature_3_title = $${idx++}`); values.push(lp.aboutFeature3Title) }
          if (lp.aboutFeature3Desc !== undefined) { updates.push(`about_feature_3_desc = $${idx++}`); values.push(lp.aboutFeature3Desc) }
          if (lp.contactTitle !== undefined) { updates.push(`contact_title = $${idx++}`); values.push(lp.contactTitle) }
          if (lp.contactSubtitle !== undefined) { updates.push(`contact_subtitle = $${idx++}`); values.push(lp.contactSubtitle) }

          if (updates.length > 0) {
            values.push(orgId)
            await client.query(`UPDATE landing_page_settings SET ${updates.join(', ')} WHERE organization_id = $${idx}`, values)
          }
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[settings PATCH]', err)
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })
  }
}
