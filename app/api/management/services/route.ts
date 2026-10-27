import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, withTransaction } from '@/lib/db'
import { ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return r.rows[0]?.id ?? null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ─── POST — create service ────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  photoUrl: z.string().min(1).optional().or(z.literal('')),
  durationMin: z.number().int().min(5).max(480),
  priceCents: z.number().int().min(0),
  description: z.string().optional(),
  isFeatured: z.boolean().optional(),
  onlineEnabled: z.boolean().optional(),
  professionalIds: z.array(z.string().uuid()).max(100).optional(),
})

export async function POST(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const {
    name,
    category,
    photoUrl,
    durationMin,
    priceCents,
    description,
    isFeatured = false,
    onlineEnabled = true,
    professionalIds = [],
  } = parsed.data

  // Generate unique slug (append random suffix on conflict)
  let baseSlug = slugify(name)
  let slug = baseSlug
  const existing = await query<{ slug: string }>(
    'SELECT slug FROM services WHERE organization_id = $1 AND slug LIKE $2',
    [orgId, `${baseSlug}%`]
  )
  if (existing.rows.some((r) => r.slug === slug)) {
    slug = `${baseSlug}-${Date.now().toString(36)}`
  }

  const normalizedProfessionalIds = [...new Set(professionalIds)] as string[]
  let createdId = ''

  await withTransaction(async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO services
         (organization_id, name, slug, category, photo_url, duration_min, price_cents, description, is_active, is_featured, online_booking_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)
       RETURNING id`,
      [orgId, name, slug, category, photoUrl || null, durationMin, priceCents, description ?? name, isFeatured, onlineEnabled]
    )

    createdId = r.rows[0].id

    if (normalizedProfessionalIds.length > 0) {
      await client.query(
        `INSERT INTO service_professionals (service_id, professional_id)
         SELECT $1, p.id
         FROM professionals p
         WHERE p.organization_id = $2
           AND p.id = ANY($3::uuid[])`,
        [createdId, orgId, normalizedProfessionalIds]
      )
    }
  })

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true, id: createdId })
}

// ─── PATCH — update service ───────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(60).optional(),
  photoUrl: z.string().min(1).optional().or(z.literal('')),
  durationMin: z.number().int().min(5).max(480).optional(),
  priceCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  onlineEnabled: z.boolean().optional(),
  professionalIds: z.array(z.string().uuid()).max(100).optional(),
})

export async function PATCH(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const { id, name, category, photoUrl, durationMin, priceCents, isActive, isFeatured, onlineEnabled, professionalIds } = parsed.data

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = [id, orgId]
  let idx = 3

  if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name) }
  if (category !== undefined) { setClauses.push(`category = $${idx++}`); values.push(category) }
  if (photoUrl !== undefined) { setClauses.push(`photo_url = $${idx++}`); values.push(photoUrl || null) }
  if (durationMin !== undefined) { setClauses.push(`duration_min = $${idx++}`); values.push(durationMin) }
  if (priceCents !== undefined) { setClauses.push(`price_cents = $${idx++}`); values.push(priceCents) }
  if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive) }
  if (isFeatured !== undefined) { setClauses.push(`is_featured = $${idx++}`); values.push(isFeatured) }
  if (onlineEnabled !== undefined) { setClauses.push(`online_booking_enabled = $${idx++}`); values.push(onlineEnabled) }

  const shouldUpdateProfessionals = professionalIds !== undefined

  if (setClauses.length === 1 && !shouldUpdateProfessionals) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  await withTransaction(async (client) => {
    if (setClauses.length > 1) {
      await client.query(
        `UPDATE services SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
        values
      )
    }

    if (shouldUpdateProfessionals) {
      const normalizedProfessionalIds = [...new Set(professionalIds ?? [])] as string[]
      await client.query('DELETE FROM service_professionals WHERE service_id = $1', [id])

      if (normalizedProfessionalIds.length > 0) {
        await client.query(
          `INSERT INTO service_professionals (service_id, professional_id)
           SELECT $1, p.id
           FROM professionals p
           WHERE p.organization_id = $2
             AND p.id = ANY($3::uuid[])`,
          [id, orgId, normalizedProfessionalIds]
        )
      }
    }
  })

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}

// ─── DELETE — remove service ──────────────────────────────────────────────────

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export async function DELETE(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  await query(
    'DELETE FROM services WHERE id = $1 AND organization_id = $2',
    [parsed.data.id, orgId]
  )

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}
