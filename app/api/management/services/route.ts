import { NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

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
  category: z.enum(['unhas', 'cilios']),
  durationMin: z.number().int().min(5).max(480),
  priceCents: z.number().int().min(0),
  description: z.string().optional(),
  isFeatured: z.boolean().optional(),
  onlineEnabled: z.boolean().optional(),
})

export async function POST(req: Request) {
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

  const { name, category, durationMin, priceCents, description, isFeatured = false, onlineEnabled = true } = parsed.data

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

  const r = await query<{ id: string }>(
    `INSERT INTO services
       (organization_id, name, slug, category, duration_min, price_cents, description, is_active, is_featured, online_booking_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
     RETURNING id`,
    [orgId, name, slug, category, durationMin, priceCents, description ?? name, isFeatured, onlineEnabled]
  )

  return NextResponse.json({ success: true, id: r.rows[0].id })
}

// ─── PATCH — update service ───────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  category: z.enum(['unhas', 'cilios']).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  priceCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  onlineEnabled: z.boolean().optional(),
})

export async function PATCH(req: Request) {
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

  const { id, name, category, durationMin, priceCents, isActive, isFeatured, onlineEnabled } = parsed.data

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = [id, orgId]
  let idx = 3

  if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name) }
  if (category !== undefined) { setClauses.push(`category = $${idx++}`); values.push(category) }
  if (durationMin !== undefined) { setClauses.push(`duration_min = $${idx++}`); values.push(durationMin) }
  if (priceCents !== undefined) { setClauses.push(`price_cents = $${idx++}`); values.push(priceCents) }
  if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive) }
  if (isFeatured !== undefined) { setClauses.push(`is_featured = $${idx++}`); values.push(isFeatured) }
  if (onlineEnabled !== undefined) { setClauses.push(`online_booking_enabled = $${idx++}`); values.push(onlineEnabled) }

  if (setClauses.length === 1) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  await query(
    `UPDATE services SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
    values
  )

  return NextResponse.json({ success: true })
}

// ─── DELETE — remove service ──────────────────────────────────────────────────

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export async function DELETE(req: Request) {
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

  return NextResponse.json({ success: true })
}
