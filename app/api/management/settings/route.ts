import { NextResponse } from 'next/server'
import { isDatabaseConfigured, query, withTransaction } from '@/lib/db'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }
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
  try {
    const body = await req.json()
    const { org, lp } = body as {
      org?: {
        name?: string
        whatsappPhone?: string | null
        bookingSlotMinutes?: number
        allowProfessionalSelection?: boolean
        requireDeposit?: boolean
        confirmationChannel?: string
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
              show_professionals, show_products, show_testimonials, social_proof_enabled)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
